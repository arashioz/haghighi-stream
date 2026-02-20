import { useState, useLayoutEffect, useCallback } from 'react'
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
  const chatRole: ChatRole = isAdmin ? 'admin' : isOperator ? 'operator' : 'viewer'
  const { messages, send, connected, sendCommand, registerFailed } = useChat({
    userName,
    role: chatRole,
    onKicked,
    joinToken,
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

  const statsLine = callStatsReport && (
    <div className="conference-stats-bar">
      <span className="conference-stats-item" title="تأخیر">
        📶 {callStatsReport.publisherStats?.averageRoundTripTimeInMs ?? '-'} ms
      </span>
      <span className="conference-stats-item" title="رزولوشن ارسال">
        📐 {callStatsReport.publisherStats?.highestFrameWidth && callStatsReport.publisherStats?.highestFrameHeight
          ? `${callStatsReport.publisherStats.highestFrameWidth}×${callStatsReport.publisherStats.highestFrameHeight}`
          : '-'}
      </span>
      <span className="conference-stats-item" title="دیتاسنتر">
        🌐 {callStatsReport.datacenter || '-'}
      </span>
      {callStatsReport.subscriberStats && (
        <span className="conference-stats-item" title="رزولوشن دریافت">
          📺 {callStatsReport.subscriberStats.highestFrameWidth && callStatsReport.subscriberStats.highestFrameHeight
            ? `${callStatsReport.subscriberStats.highestFrameWidth}×${callStatsReport.subscriberStats.highestFrameHeight}`
            : '-'}
        </span>
      )}
    </div>
  )

  return (
    <div className={`conference-room ${isAdmin ? 'conference-room--admin' : ''} ${isOperator ? 'conference-room--operator' : ''}`}>
      {statsLine}
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
                    return (
                      <div
                        key={p.sessionId}
                        className={`conference-admin-sidebar-item ${!participantHasVideo ? 'conference-admin-sidebar-item--no-video' : ''}`}
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
                          <span className="conference-block-duration-label">بلاک:</span>
                          {([1, 5, 10] as const).map((min) => (
                            <button
                              key={min}
                              type="button"
                              className="conference-participant-btn conference-participant-btn-block"
                              onClick={() => sendCommand('block_chat', { targetUserName: displayName, blockDurationMinutes: min })}
                              title={`بلاک موقت چت ${min} دقیقه`}
                            >
                              {min}د
                            </button>
                          ))}
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
                            title="اخراج از اتاق"
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
                    return (
                      <div key={p.sessionId} className="conference-admin-sidebar-item conference-admin-sidebar-item--no-video">
                        <div className="conference-admin-sidebar-avatar" aria-hidden>
                          <span className="conference-admin-sidebar-avatar-inner">👤</span>
                        </div>
                        <span className="conference-admin-sidebar-name">{displayName}</span>
                        <div className="conference-admin-sidebar-actions">
                          <span className="conference-block-duration-label">بلاک:</span>
                          {([1, 5, 10] as const).map((min) => (
                            <button
                              key={min}
                              type="button"
                              className="conference-participant-btn conference-participant-btn-block"
                              onClick={() => sendCommand('block_chat', { targetUserName: displayName, blockDurationMinutes: min })}
                              title={`بلاک موقت چت ${min} دقیقه`}
                            >
                              {min}د
                            </button>
                          ))}
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
