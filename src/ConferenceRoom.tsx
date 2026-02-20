import { useState, useLayoutEffect, useCallback, useRef } from 'react'
import { CallingState } from '@stream-io/video-client'
import {
  hasVideo,
  ParticipantView,
  SpeakerLayout,
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-sdk'
import ChatPanel from './ChatPanel'
import { useChat, type ChatRole } from './useChat'
import './ConferenceRoom.css'

type NotificationItem = { id: string; text: string; type: 'info' | 'success' | 'warn' }

type Props = {
  isAdmin: boolean
  isOperator?: boolean
  userName: string
  onKicked?: () => void
  joinToken?: string
}

const ConferenceRoom = ({ isAdmin, isOperator = false, userName, onKicked, joinToken }: Props) => {
  const call = useCall()
  const [streamStarted, setStreamStarted] = useState(false)
  const [isToggling, setIsToggling] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [blockedUserNames, setBlockedUserNames] = useState<Set<string>>(new Set())
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const notificationTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const [blockModal, setBlockModal] = useState<{ open: boolean; targetUserName: string; durationInput: string }>({
    open: false,
    targetUserName: '',
    durationInput: '5',
  })

  const addNotification = useCallback((text: string, type: NotificationItem['type'] = 'info', autoHideMs = 4000) => {
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setNotifications((prev) => [...prev, { id, text, type }])
    const t = setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      delete notificationTimeoutRef.current[id]
    }, autoHideMs)
    notificationTimeoutRef.current[id] = t
  }, [])

  const chatRole: ChatRole = isAdmin ? 'admin' : isOperator ? 'operator' : 'viewer'
  const { messages, send, connected, sendCommand, registerFailed } = useChat({
    userName,
    role: chatRole,
    onKicked,
    joinToken,
    onUserBlocked: useCallback((targetUserName: string, blockDurationMinutes: number) => {
      setBlockedUserNames((prev) => new Set(prev).add(targetUserName))
      addNotification(`${targetUserName} بلاک شد (${blockDurationMinutes} دقیقه)`, 'success')
    }, [addNotification]),
    onBlocked: useCallback((blockDurationMinutes: number) => {
      addNotification(`شما بلاک شدید. تا ${blockDurationMinutes} دقیقه امکان ارسال پیام ندارید.`, 'warn', 6000)
    }, [addNotification]),
    onUserKicked: useCallback((targetUserName: string) => {
      addNotification(`${targetUserName} اخراج شد`, 'info')
    }, [addNotification]),
  })
  const { useParticipants, useCameraState, useCallCallingState, useCallStatsReport } = useCallStateHooks()
  const participants = useParticipants()
  const { isMute: isCameraMute } = useCameraState()
  const callingState = useCallCallingState()
  const callStatsReport = useCallStatsReport()
  const count = participants.length
  const isJoined = callingState === CallingState.JOINED
  const canModerate = isAdmin || isOperator

  // فقط ادمین دوربین/میکروفون دارد؛ بیننده و اپراتور بدون تصویر و صدا (اپراتور فقط بلاک موقت چت و اخراج)
  useLayoutEffect(() => {
    if (isAdmin || !call || !isJoined) return
    call.camera.disable().catch(() => {})
    call.microphone.disable().catch(() => {})
  }, [isAdmin, call, isJoined])

  // باز کردن قفل پخش صدا در مرورگر (برای بیننده) با اولین کلیک/لمس — ضروری برای اندروید و iOS
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const handleUnlockAudio = useCallback(() => {
    if (audioUnlocked) return
    setAudioUnlocked(true)
    try {
      const Ac = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (Ac) {
        const ac = new Ac()
        if (ac.state === 'suspended') ac.resume()
      }
      // پخش یک صدای خیلی کوتاه برای باز کردن قفل صدا در iOS/Android (سیاست autoplay)
      const silentWav = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
      const audio = new window.Audio(silentWav)
      audio.volume = 0
      audio.play().catch(() => {})
    } catch (_) {}
  }, [audioUnlocked])

  const handleToggleStream = async () => {
    if (!call || isToggling || !isJoined) return
    setStreamError(null)
    setIsToggling(true)
    try {
      if (streamStarted) {
        await call.camera.disable()
        await call.microphone.disable()
        setStreamStarted(false)
      } else {
        await call.camera.enable()
        await call.microphone.enable()
        setStreamStarted(true)
      }
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'دسترسی به دوربین/میکروفون رد شد. در مرورگر اجازه دسترسی را بدهید.'
          : err instanceof Error
            ? err.message
            : 'خطا در روشن کردن دوربین یا میکروفون.'
      setStreamError(message)
      console.error(err)
    } finally {
      setIsToggling(false)
    }
  }

  const isLive = streamStarted || !isCameraMute

  const pingMs = callStatsReport?.publisherStats?.averageRoundTripTimeInMs ?? null
  const datacenter = callStatsReport?.datacenter ?? null
  const statsLine = (pingMs != null || datacenter) && (
    <div className="conference-stats-bar">
      <span className="conference-stats-ping" title="پینگ / تأخیر">
        <span className="conference-stats-ping-icon" aria-hidden>📶</span>
        <span className="conference-stats-ping-label">پینگ</span>
        <span className="conference-stats-ping-value">{pingMs != null ? `${pingMs} ms` : '—'}</span>
      </span>
      <span className="conference-stats-server" title="سرور / دیتاسنتر">
        <span className="conference-stats-server-icon" aria-hidden>🌐</span>
        <span className="conference-stats-server-label">سرور</span>
        <span className="conference-stats-server-value">{datacenter || '—'}</span>
      </span>
    </div>
  )

  const openBlockModal = (targetUserName: string) => {
    setBlockModal({ open: true, targetUserName, durationInput: '5' })
  }
  const closeBlockModal = () => {
    setBlockModal((m) => ({ ...m, open: false }))
  }
  const confirmBlock = () => {
    const min = Math.min(60, Math.max(1, parseInt(blockModal.durationInput, 10) || 5))
    sendCommand('block_chat', { targetUserName: blockModal.targetUserName, blockDurationMinutes: min })
    closeBlockModal()
  }

  return (
    <div className={`conference-room ${isAdmin ? 'conference-room--admin' : ''} ${isOperator ? 'conference-room--operator' : ''}`}>
      {statsLine}
      {notifications.length > 0 && (
        <div className="conference-notifications" role="region" aria-label="اعلان‌ها">
          {notifications.map((n) => (
            <div key={n.id} className={`conference-notification conference-notification--${n.type}`} role="alert">
              {n.text}
            </div>
          ))}
        </div>
      )}
      {blockModal.open && (
        <div className="conference-modal-backdrop" onClick={closeBlockModal} role="presentation">
          <div className="conference-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="block-modal-title">
            <h2 id="block-modal-title" className="conference-modal-title">بلاک چت</h2>
            <p className="conference-modal-desc">
              <strong>{blockModal.targetUserName}</strong> برای چند دقیقه از ارسال پیام محروم شود؟
            </p>
            <div className="conference-modal-field">
              <label htmlFor="block-duration">دقیقه (۱ تا ۶۰)</label>
              <input
                id="block-duration"
                type="number"
                min={1}
                max={60}
                value={blockModal.durationInput}
                onChange={(e) => setBlockModal((m) => ({ ...m, durationInput: e.target.value }))}
                className="conference-modal-input"
              />
            </div>
            <div className="conference-modal-actions">
              <button type="button" className="conference-modal-btn conference-modal-btn--cancel" onClick={closeBlockModal}>
                انصراف
              </button>
              <button type="button" className="conference-modal-btn conference-modal-btn--confirm" onClick={confirmBlock}>
                بلاک
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="conference-header">
        <div className="conference-header-right">
          <span className="conference-logo" aria-hidden>▶</span>
          <h1 className="conference-title">حقیقی استریم</h1>
        </div>
        <div className="conference-header-left">
          {!isAdmin && !isOperator && (
            <span className="conference-viewer-badge">شما در حال تماشا هستید</span>
          )}
          {isOperator && (
            <span className="conference-viewer-badge">اپراتور</span>
          )}
          <div className="conference-participants-badge" title="تعداد حاضرین">
            <span className="conference-participants-icon">👥</span>
            <span className="conference-participants-count">{count}</span>
            <span className="conference-participants-label">حاضرین</span>
          </div>
          {isLive && (
            <span className="conference-live-badge" dir="rtl">
              پخش زنده
            </span>
          )}
          {canModerate && (
            <>
              {isAdmin && (
                <>
                  <button
                    type="button"
                    className={`conference-start-btn ${isLive ? 'is-live' : ''}`}
                    onClick={handleToggleStream}
                    disabled={isToggling || !isJoined}
                    title={!isJoined ? 'صبر کنید تا به اتاق متصل شوید' : undefined}
                  >
                    {!isJoined
                      ? 'در حال اتصال…'
                      : isToggling
                        ? 'در حال تغییر…'
                        : isLive
                          ? 'توقف استریم'
                          : 'شروع استریم'}
                  </button>
                  {streamError && (
                    <p className="conference-stream-error" role="alert">
                      {streamError}
                    </p>
                  )}
                </>
              )}
            </>
          )}
          <span className="conference-user-name">{userName}</span>
        </div>
      </header>

      <div className="conference-body">
        <div className={`conference-video-frame ${isAdmin ? 'conference-video-frame--admin' : ''} ${isOperator ? 'conference-video-frame--operator' : ''}`}>
          {isAdmin && (
            <div className="conference-admin-sidebar">
              <span className="conference-admin-sidebar-title">کاربران حاضر</span>
              <div className="conference-admin-sidebar-scroll">
                {participants
                  .filter((p) => !p.isLocalParticipant)
                  .map((p) => {
                    const displayName = p.name || p.userId || `شرکت‌کننده ${p.sessionId.slice(0, 6)}`
                    const participantHasVideo = hasVideo(p)
                    const isBlocked = blockedUserNames.has(displayName)
                    return (
                      <div
                        key={p.sessionId}
                        className={`conference-admin-sidebar-item ${!participantHasVideo ? 'conference-admin-sidebar-item--no-video' : ''} ${isBlocked ? 'conference-admin-sidebar-item--blocked' : ''}`}
                      >
                        {participantHasVideo ? (
                          <div className="conference-admin-sidebar-video">
                            <ParticipantView participant={p} />
                          </div>
                        ) : (
                          <div className="conference-admin-sidebar-avatar" aria-hidden>
                            <span className="conference-admin-sidebar-avatar-inner">👤</span>
                          </div>
                        )}
                        <span className="conference-admin-sidebar-name">{displayName}</span>
                        <div className="conference-admin-sidebar-actions">
                          <button
                            type="button"
                            className="conference-participant-btn conference-participant-btn-block"
                            onClick={() => openBlockModal(displayName)}
                            title="بلاک موقت چت"
                          >
                            بلاک
                          </button>
                          <button
                            type="button"
                            className="conference-participant-btn conference-participant-btn-unblock"
                            onClick={() => sendCommand('unblock_chat', { targetUserName: displayName })}
                            title="انبلاک چت"
                          >
                            انبلاک
                          </button>
                          <button
                            type="button"
                            className="conference-participant-btn conference-participant-btn-kick"
                            onClick={() => sendCommand('kick', { targetUserName: displayName })}
                            title="اخراج از اتاق (IP در بلاک‌لیست)"
                          >
                            اخراج
                          </button>
                        </div>
                      </div>
                    )
                  })}
                {participants.filter((p) => !p.isLocalParticipant).length === 0 && (
                  <p className="conference-admin-sidebar-empty">هنوز کسی نیامده</p>
                )}
              </div>
            </div>
          )}
          {isOperator && !isAdmin && (
            <div className="conference-admin-sidebar conference-operator-sidebar">
              <span className="conference-admin-sidebar-title">کاربران حاضر</span>
              <div className="conference-admin-sidebar-scroll">
                {participants
                  .filter((p) => !p.isLocalParticipant)
                  .map((p) => {
                    const displayName = p.name || p.userId || `شرکت‌کننده ${p.sessionId.slice(0, 6)}`
                    const isBlocked = blockedUserNames.has(displayName)
                    return (
                      <div key={p.sessionId} className={`conference-admin-sidebar-item conference-admin-sidebar-item--no-video ${isBlocked ? 'conference-admin-sidebar-item--blocked' : ''}`}>
                        <div className="conference-admin-sidebar-avatar" aria-hidden>
                          <span className="conference-admin-sidebar-avatar-inner">👤</span>
                        </div>
                        <span className="conference-admin-sidebar-name">{displayName}</span>
                        <div className="conference-admin-sidebar-actions">
                          <button
                            type="button"
                            className="conference-participant-btn conference-participant-btn-block"
                            onClick={() => openBlockModal(displayName)}
                            title="بلاک موقت چت"
                          >
                            بلاک
                          </button>
                          <button
                            type="button"
                            className="conference-participant-btn conference-participant-btn-unblock"
                            onClick={() => sendCommand('unblock_chat', { targetUserName: displayName })}
                            title="انبلاک چت"
                          >
                            انبلاک
                          </button>
                        </div>
                      </div>
                    )
                  })}
                {participants.filter((p) => !p.isLocalParticipant).length === 0 && (
                  <p className="conference-admin-sidebar-empty">هنوز کاربر دیگری نیامده</p>
                )}
              </div>
            </div>
          )}
          <div
            className="conference-video-inner"
            role={!isAdmin && !isOperator ? 'button' : undefined}
            tabIndex={!isAdmin && !isOperator ? 0 : undefined}
            onClick={!isAdmin && !isOperator && !audioUnlocked ? handleUnlockAudio : undefined}
            onTouchStart={!isAdmin && !isOperator && !audioUnlocked ? (e) => { e.preventDefault(); handleUnlockAudio(); } : undefined}
            onKeyDown={(e) => {
              if (!isAdmin && !isOperator && !audioUnlocked && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                handleUnlockAudio()
              }
            }}
            aria-label={!audioUnlocked && !isAdmin && !isOperator ? 'کلیک یا لمس کنید تا صدا فعال شود' : undefined}
          >
            {!isAdmin && !isOperator && !audioUnlocked && (
              <div
                className="conference-audio-unlock"
                onClick={(e) => { e.stopPropagation(); handleUnlockAudio(); }}
                onTouchStart={(e) => { e.stopPropagation(); handleUnlockAudio(); }}
                role="button"
              >
                <span className="conference-audio-unlock-title">برای شنیدن صدای ادمین</span>
                <span className="conference-audio-unlock-hint">اینجا را لمس کنید (یا کلیک کنید)</span>
              </div>
            )}
            {isAdmin ? (
              (() => {
                const local = participants.find((p) => p.isLocalParticipant)
                return (
                  <div
                    className={`conference-admin-main-video${!local ? ' conference-admin-main-video--waiting' : ''}`}
                    aria-label="فقط تصویر خود ادمین"
                  >
                    {local ? (
                      <ParticipantView participant={local} />
                    ) : (
                      <span>در حال اتصال…</span>
                    )}
                  </div>
                )
              })()
            ) : (
              <SpeakerLayout excludeLocalParticipant={true} />
            )}
          </div>
        </div>
        <aside className="conference-chat">
          <ChatPanel
            currentUserName={userName}
            messages={messages}
            onSend={send}
            connected={connected}
            registerFailed={registerFailed}
          />
        </aside>
      </div>
    </div>
  )
}

export default ConferenceRoom
