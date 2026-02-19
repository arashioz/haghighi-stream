#!/usr/bin/env node
/**
 * سرور چت WebSocket برای حقیقی استریم
 * همهٔ کلاینت‌ها به این پورت وصل می‌شوند و پیام‌ها بین همه سینک می‌شود.
 */
import { WebSocketServer } from 'ws'

const PORT = Number(process.env.CHAT_PORT) || 8765
const wss = new WebSocketServer({ port: PORT })

const clients = new Set()

wss.on('connection', (ws) => {
  clients.add(ws)
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString())
      const payload = JSON.stringify({
        ...msg,
        id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        time: msg.time || new Date().toISOString(),
      })
      clients.forEach((c) => {
        if (c.readyState === 1) c.send(payload)
      })
    } catch (_) {}
  })
  ws.on('close', () => clients.delete(ws))
})

wss.on('listening', () => {
  console.log('✅ سرور چت حقیقی استریم روشن است روی پورت', PORT)
  console.log('   ws://0.0.0.0:' + PORT)
})
