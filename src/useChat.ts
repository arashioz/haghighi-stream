import { useState, useEffect, useCallback, useRef } from 'react'

export type ChatMessage = {
  id: string
  userName: string
  text: string
  time: string
}

export type ChatRole = 'admin' | 'operator' | 'viewer'

function getWsUrl(): string {
  if (typeof window === 'undefined') return ''
  const env = import.meta.env.VITE_CHAT_WS_URL
  if (env) return env
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}`
}

type UseChatOptions = {
  userName: string
  role?: ChatRole
  onKicked?: () => void
  joinToken?: string
  /** ادمین/اپراتور: وقتی کاربری بلاک شد */
  onUserBlocked?: (targetUserName: string, blockDurationMinutes: number) => void
  /** کاربر عادی: وقتی خودش بلاک شد */
  onBlocked?: (blockDurationMinutes: number) => void
  /** ادمین/اپراتور: وقتی کاربری اخراج شد */
  onUserKicked?: (targetUserName: string) => void
}

export function useChat(userName: string | UseChatOptions) {
  const opts: UseChatOptions =
    typeof userName === 'string' ? { userName } : userName
  const { userName: name, role = 'viewer', onKicked, joinToken, onUserBlocked, onBlocked, onUserKicked } = opts

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [connected, setConnected] = useState(false)
  const [registerFailed, setRegisterFailed] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const onKickedRef = useRef(onKicked)
  onKickedRef.current = onKicked
  const onUserBlockedRef = useRef(onUserBlocked)
  onUserBlockedRef.current = onUserBlocked
  const onBlockedRef = useRef(onBlocked)
  onBlockedRef.current = onBlocked
  const onUserKickedRef = useRef(onUserKicked)
  onUserKickedRef.current = onUserKicked

  useEffect(() => {
    setRegisterFailed(false)
    const url = getWsUrl()
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      const payload: Record<string, unknown> = { type: 'register', userName: name, role }
      if (role === 'viewer' && joinToken) payload.joinToken = joinToken
      ws.send(JSON.stringify(payload))
      setConnected(true)
    }
    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)
    ws.onmessage = (e) => {
      try {
        const raw = JSON.parse(e.data) as {
          type?: string
          id: string
          userName: string
          text: string
          time: string
          reason?: string
        }
        if (raw.type === 'kicked') {
          onKickedRef.current?.()
          return
        }
        if (raw.type === 'blocked') {
          onBlockedRef.current?.(Number((raw as { blockDurationMinutes?: number }).blockDurationMinutes) || 1)
          return
        }
        if (raw.type === 'user_blocked') {
          const payload = raw as { targetUserName?: string; blockDurationMinutes?: number }
          onUserBlockedRef.current?.(payload.targetUserName || '', payload.blockDurationMinutes || 1)
          return
        }
        if (raw.type === 'user_kicked') {
          const payload = raw as { targetUserName?: string }
          onUserKickedRef.current?.(payload.targetUserName || '')
          return
        }
        if (raw.type === 'register_failed') {
          setRegisterFailed(true)
          setConnected(false)
          ws.close()
          return
        }
        if (raw.type !== 'chat' && raw.userName == null) return
        const timeDisplay = raw.time
          ? new Date(raw.time).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })
        setMessages((prev) => [...prev, { ...raw, time: timeDisplay }])
      } catch (_) {}
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [name, role, joinToken])

  const send = useCallback(
    (text: string) => {
      const msg = {
        userName: name,
        text,
        time: new Date().toISOString(),
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg))
      }
    },
    [name]
  )

  const sendCommand = useCallback(
    (
      command: 'block_chat' | 'unblock_chat' | 'kick',
      payload: { targetUserName: string; blockDurationMinutes?: number }
    ) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: command, ...payload }))
      }
    },
    []
  )

  return { messages, send, connected, sendCommand, registerFailed }
}
