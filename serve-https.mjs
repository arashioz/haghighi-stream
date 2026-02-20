#!/usr/bin/env node
/**
 * سرور اپ: فرانت + API + چت WebSocket.
 * - حالت عادی: HTTPS با گواهی (npm run ssl) روی پورت ثابت.
 * - حالت پشت nginx: BEHIND_PROXY=1 → HTTP روی localhost (SSL را nginx با Let's Encrypt می‌گیرد).
 * - متغیرهای env از فایل .env در ریشهٔ پروژه خوانده می‌شوند (با dotenv).
 */
import 'dotenv/config'
import http from 'http'
import https from 'https'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { WebSocketServer } from 'ws'

const STREAM_API_SECRET = process.env.STREAM_API_SECRET || process.env.VITE_STREAM_SECRET || ''
const STREAM_API_KEY = process.env.STREAM_API_KEY || process.env.VITE_STREAM_API_KEY || '69twsx7eb4ry'

function base64url (buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function createStreamVideoToken (userId, validitySeconds = 24 * 3600) {
  if (!STREAM_API_SECRET) return null
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    user_id: userId,
    iat: now,
    exp: now + validitySeconds,
  }
  const headerB64 = base64url(JSON.stringify(header))
  const payloadB64 = base64url(JSON.stringify(payload))
  const signature = crypto
    .createHmac('sha256', STREAM_API_SECRET)
    .update(headerB64 + '.' + payloadB64)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return headerB64 + '.' + payloadB64 + '.' + signature
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, 'dist')
const sslDir = path.join(__dirname, 'nginx', 'ssl')
const certPath = path.join(sslDir, 'cert.pem')
const keyPath = path.join(sslDir, 'key.pem')

const BEHIND_PROXY = process.env.BEHIND_PROXY === '1' || process.env.BEHIND_PROXY === 'true'

if (!fs.existsSync(distDir)) {
  console.error('❌ پوشه dist نیست. اول اجرا کن: npm run build')
  process.exit(1)
}

if (!BEHIND_PROXY && (!fs.existsSync(certPath) || !fs.existsSync(keyPath))) {
  console.error('❌ گواهی SSL پیدا نشد. اول اجرا کن: npm run ssl')
  console.error('   یا برای پشت nginx با Let\'s Encrypt: BEHIND_PROXY=1 node serve-https.mjs')
  process.exit(1)
}

const PORT = parseInt(process.env.PORT || '17443', 10)
const listenHost = BEHIND_PROXY ? '127.0.0.1' : '0.0.0.0'

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
}

// وضعیت اتاق
let roomCode = '1234'
const bannedUsers = new Set()
/** IPهای بلاک‌شده (اخراج) — جلوگیری از ورود مجدد با همان IP */
const bannedIPs = new Set()
/** کاربران بلاک‌شدهٔ چت: نام → زمان انقضا (timestamp) */
const chatBlockedUsers = new Map()
const connectionMap = new Map()
const validJoinTokens = new Map()

function addJoinToken() {
  const token = crypto.randomBytes(24).toString('base64url')
  validJoinTokens.set(token, Date.now() + 5 * 60 * 1000)
  return token
}

function consumeJoinToken(token) {
  if (!token) return false
  const exp = validJoinTokens.get(token)
  if (!exp || Date.now() > exp) return false
  validJoinTokens.delete(token)
  return true
}

function sendJson(res, statusCode, obj) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.statusCode = statusCode
  res.end(JSON.stringify(obj))
}

function serveFile(req, res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    filePath = path.join(distDir, 'index.html')
  }
  const ext = path.extname(filePath)
  res.setHeader('Content-Type', mime[ext] || 'application/octet-stream')
  res.end(fs.readFileSync(filePath))
}

const requestHandler = (req, res) => {
    const url = (req.url || '').split('?')[0]

    if (req.method === 'GET' && url === '/api/room-code') {
      sendJson(res, 200, { code: roomCode })
      return
    }

    if (req.method === 'POST' && url === '/api/room-code') {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}')
          const code = String(data.code || '').replace(/\D/g, '').slice(0, 4)
          if (code.length === 4) {
            roomCode = code
            sendJson(res, 200, { ok: true, code: roomCode })
          } else {
            sendJson(res, 400, { ok: false, error: 'کد باید ۴ رقم باشد' })
          }
        } catch (_) {
          sendJson(res, 400, { ok: false })
        }
      })
      return
    }

    if (req.method === 'GET' && url === '/api/stream-token') {
      const u = new URL(req.url || '', 'http://localhost')
      const userId = u.searchParams.get('userId') || u.searchParams.get('user_id') || 'demo-user-PDL5QQZ9'
      const token = createStreamVideoToken(userId)
      if (token) {
        sendJson(res, 200, { token })
      } else {
        sendJson(res, 503, { error: 'STREAM_API_SECRET not set' })
      }
      return
    }

    if (req.method === 'POST' && url === '/api/join-request') {
      let body = ''
      req.on('data', (chunk) => { body += chunk })
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}')
          const code = String(data.code || '').replace(/\D/g, '')
          const userName = (data.userName || '').trim() || 'کاربر'
          const clientIP = (req.headers['x-forwarded-for'] && typeof req.headers['x-forwarded-for'] === 'string'
            ? req.headers['x-forwarded-for'].split(',')[0].trim()
            : null) || req.socket?.remoteAddress || ''
          if (bannedIPs.has(clientIP)) {
            sendJson(res, 200, { allowed: false, reason: 'banned' })
            return
          }
          if (bannedUsers.has(userName)) {
            sendJson(res, 200, { allowed: false, reason: 'banned' })
            return
          }
          if (code !== roomCode) {
            sendJson(res, 200, { allowed: false, reason: 'wrong_code' })
            return
          }
          const joinToken = addJoinToken()
          sendJson(res, 200, { allowed: true, joinToken })
        } catch (_) {
          sendJson(res, 400, { allowed: false, reason: 'error' })
        }
      })
      return
    }

    let file = url === '/' ? '/index.html' : url
    file = path.join(distDir, path.normalize(file).replace(/^(\.\.(\/|\\))+/, ''))
    if (!file.startsWith(distDir)) {
      res.statusCode = 403
      res.end()
      return
    }
    serveFile(req, res, file)
  }

const server = BEHIND_PROXY
  ? http.createServer(requestHandler)
  : https.createServer(
      { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) },
      requestHandler
    )

const chatClients = new Set()
const wss = new WebSocketServer({ noServer: true })

function findWsByUserName(userName) {
  for (const [ws, data] of connectionMap) {
    if (data.userName === userName && ws.readyState === 1) return ws
  }
  return null
}

wss.on('connection', (ws) => {
  chatClients.add(ws)
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      const type = msg.type

      if (type === 'register') {
        const role = msg.role || 'viewer'
        const userName = msg.userName || 'کاربر'
        if (role === 'viewer') {
          const joinToken = msg.joinToken
          if (!consumeJoinToken(joinToken)) {
            ws.send(JSON.stringify({ type: 'register_failed', reason: 'ورود به چت فقط بعد از ورود به اتاق امکان‌پذیر است.' }))
            return
          }
        }
        const ip = ws._clientIP || ''
        connectionMap.set(ws, { userName, role, ip })
        return
      }

      if (type === 'set_room_code') {
        const conn = connectionMap.get(ws)
        if (conn && (conn.role === 'admin' || conn.role === 'operator')) {
          const code = String(msg.code || '').replace(/\D/g, '').slice(0, 4)
          if (code.length === 4) roomCode = code
        }
        return
      }

      if (type === 'kick') {
        const conn = connectionMap.get(ws)
        if (conn && (conn.role === 'admin' || conn.role === 'operator')) {
          const target = (msg.targetUserName || '').trim()
          if (target) {
            bannedUsers.add(target)
            const targetWs = findWsByUserName(target)
            const targetConn = targetWs ? connectionMap.get(targetWs) : null
            if (targetConn?.ip) bannedIPs.add(targetConn.ip)
            if (targetWs) targetWs.send(JSON.stringify({ type: 'kicked' }))
            chatClients.forEach((c) => {
              if (c.readyState === 1 && c !== targetWs) {
                const d = connectionMap.get(c)
                if (d && (d.role === 'admin' || d.role === 'operator')) {
                  c.send(JSON.stringify({ type: 'user_kicked', targetUserName: target }))
                }
              }
            })
          }
        }
        return
      }

      if (type === 'block_chat') {
        const conn = connectionMap.get(ws)
        if (conn && (conn.role === 'admin' || conn.role === 'operator')) {
          const target = (msg.targetUserName || '').trim()
          const minutes = Math.min(60, Math.max(1, Number(msg.blockDurationMinutes) || 1))
          if (target) {
            chatBlockedUsers.set(target, Date.now() + minutes * 60 * 1000)
            const targetWs = findWsByUserName(target)
            if (targetWs) {
              targetWs.send(JSON.stringify({ type: 'blocked', blockDurationMinutes: minutes }))
            }
            chatClients.forEach((c) => {
              if (c.readyState === 1) {
                const d = connectionMap.get(c)
                if (d && (d.role === 'admin' || d.role === 'operator')) {
                  c.send(JSON.stringify({ type: 'user_blocked', targetUserName: target, blockDurationMinutes: minutes }))
                }
              }
            })
          }
        }
        return
      }

      if (type === 'unblock_chat') {
        const conn = connectionMap.get(ws)
        if (conn && (conn.role === 'admin' || conn.role === 'operator')) {
          const target = (msg.targetUserName || '').trim()
          if (target) chatBlockedUsers.delete(target)
        }
        return
      }

      if (type === 'chat' || (!type && msg.userName != null)) {
        if (!connectionMap.has(ws)) return
        const userName = msg.userName || 'کاربر'
        const blockExpiry = chatBlockedUsers.get(userName)
        if (blockExpiry != null) {
          if (Date.now() >= blockExpiry) chatBlockedUsers.delete(userName)
          else return
        }
        const payload = JSON.stringify({
          ...msg,
          type: 'chat',
          id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          time: msg.time || new Date().toISOString(),
        })
        chatClients.forEach((c) => {
          if (c.readyState === 1) c.send(payload)
        })
      }
    } catch (_) {}
  })
  ws.on('close', () => {
    chatClients.delete(ws)
    connectionMap.delete(ws)
  })
})

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded && typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress || ''
}

server.on('upgrade', (req, socket, head) => {
  if (req.headers.upgrade === 'websocket') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws._clientIP = getClientIP(req)
      wss.emit('connection', ws, req)
    })
  } else {
    socket.destroy()
  }
})

server.listen(PORT, listenHost, () => {
  const scheme = BEHIND_PROXY ? 'http' : 'https'
  console.log(BEHIND_PROXY
    ? '✅ سرور اپ (HTTP پشت nginx) روشن است.'
    : '✅ سرور HTTPS + چت روشن است (پورت ثابت).')
  console.log('   گوش دادن روی: ' + scheme + '://' + listenHost + ':' + PORT)
  console.log('   چت و API روی همان پورت فعال است.')
})
