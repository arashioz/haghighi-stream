import { useState, useRef, useEffect } from 'react'
import type { ChatMessage } from './useChat'
import './ChatPanel.css'

type Props = {
  currentUserName: string
  messages: ChatMessage[]
  onSend: (text: string) => void
  connected?: boolean
  registerFailed?: boolean
}

const ChatPanel = ({ currentUserName, messages, onSend, connected = false, registerFailed = false }: Props) => {
  const [input, setInput] = useState('')
  const [showRetryHint, setShowRetryHint] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight)
  }, [messages])

  useEffect(() => {
    if (connected || registerFailed) return
    const t = setTimeout(() => setShowRetryHint(true), 6000)
    return () => clearTimeout(t)
  }, [connected, registerFailed])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = input.trim()
    if (!t) return
    onSend(t)
    setInput('')
  }

  return (
    <div className="chat-panel" dir="rtl">
      <div className="chat-panel-header">
        <span className="chat-panel-header-icon">💬</span>
        <h2 className="chat-panel-header-title">چت اتاق</h2>
        {registerFailed && (
          <span className="chat-panel-header-status chat-panel-header-status--error">اتصال به چت ممکن نیست</span>
        )}
        {!connected && !registerFailed && (
          <span className="chat-panel-header-status">در حال اتصال…</span>
        )}
      </div>
      <div className="chat-panel-messages" ref={listRef}>
        {registerFailed ? (
          <p className="chat-panel-empty chat-panel-empty--error">
            ورود به چت فقط بعد از ورود به اتاق با کد صحیح امکان‌پذیر است.
          </p>
        ) : messages.length === 0 ? (
          <>
            <p className="chat-panel-empty">
              {connected
                ? 'هنوز پیامی ارسال نشده. اولین نفر باشید!'
                : 'در حال اتصال به چت…'}
            </p>
            {showRetryHint && !connected && !registerFailed && (
              <p className="chat-panel-empty chat-panel-retry-hint">
                اگر اتصال برقرار نشد، صفحه را رفرش کنید و دوباره با کد اتاق وارد شوید.
              </p>
            )}
          </>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`chat-message ${m.userName === currentUserName ? 'is-self' : ''}`}
            >
              <div className="chat-message-header">
                <span className="chat-message-user">{m.userName}</span>
                <span className="chat-message-time">{m.time}</span>
              </div>
              <p className="chat-message-text">{m.text}</p>
            </div>
          ))
        )}
      </div>
      <form className="chat-panel-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={registerFailed ? 'چت در دسترس نیست' : 'پیام خود را بنویسید...'}
          className="chat-panel-input"
          maxLength={500}
          disabled={registerFailed}
        />
        <button type="submit" className="chat-panel-send" disabled={!input.trim() || registerFailed}>
          ارسال
        </button>
      </form>
    </div>
  )
}

export default ChatPanel
