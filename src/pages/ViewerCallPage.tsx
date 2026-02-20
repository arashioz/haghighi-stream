import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  type User,
} from '@stream-io/video-react-sdk'
import ConferenceRoom from '../ConferenceRoom'
import { getStreamToken, streamApiKey, streamCallId } from '../streamToken'

function makeViewerUserId(name: string): string {
  const safe = name.trim().replace(/\s+/g, '-').slice(0, 20) || 'viewer'
  return `viewer-${safe}-${Math.random().toString(36).slice(2, 10)}`
}

const ViewerCallPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as { userName?: string; joinToken?: string } | null
  const userName = state?.userName ?? (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('stream_join_userName') : null) ?? 'کاربر'
  const joinToken = state?.joinToken ?? (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('stream_join_token') : null)
  const viewerUserIdRef = useRef<string | null>(null)
  if (!viewerUserIdRef.current) viewerUserIdRef.current = makeViewerUserId(userName)
  const viewerUserId = viewerUserIdRef.current
  const [token, setToken] = useState<string | null>(null)
  const [client, setClient] = useState<StreamVideoClient | null>(null)
  const [call, setCall] = useState<ReturnType<StreamVideoClient['call']> | null>(null)
  const [showKickedMessage, setShowKickedMessage] = useState(false)
  const callRef = useRef(call)
  callRef.current = call

  const handleKicked = () => {
    callRef.current?.leave().catch(() => {})
    setShowKickedMessage(true)
  }

  useEffect(() => {
    const hasUser = (location.state as { userName?: string } | null)?.userName || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('stream_join_userName'))
    if (!hasUser) navigate('/join', { replace: true })
  }, [location.state, navigate])

  useEffect(() => {
    if (!showKickedMessage) return
    const t = setTimeout(() => {
      try {
        sessionStorage.removeItem('stream_join_token')
        sessionStorage.removeItem('stream_join_userName')
      } catch (_) {}
      navigate('/join', { state: { kicked: true }, replace: true })
    }, 2800)
    return () => clearTimeout(t)
  }, [showKickedMessage, navigate])

  useEffect(() => {
    let cancelled = false
    getStreamToken(viewerUserId).then((t) => {
      if (!cancelled) setToken(t)
    })
    return () => { cancelled = true }
  }, [viewerUserId])

  useEffect(() => {
    if (!token) return
    const user: User = { id: viewerUserId, name: userName }
    const c = new StreamVideoClient({ apiKey: streamApiKey, user, token })
    const callInstance = c.call('default', streamCallId)
    callInstance.camera.deferServerDefaults = true
    callInstance.microphone.deferServerDefaults = true
    callInstance
      .join({ create: false })
      .then(() => {
        callInstance.camera.disable().catch(() => {})
        callInstance.microphone.disable().catch(() => {})
      })
    setClient(c)
    setCall(callInstance)
    return () => {
      callInstance.leave().catch(() => {})
    }
  }, [token, userName])

  if (token === null) {
    return (
      <div className="app-loading" dir="rtl">
        در حال اتصال…
      </div>
    )
  }

  if (!token) {
    return (
      <div className="app-loading app-loading--error" dir="rtl">
        <p>اتصال به تماس ممکن نیست (توکن منقضی یا تنظیم نشده).</p>
        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>به صفحهٔ اصلی برگردید یا با مدیر تماس بگیرید.</p>
      </div>
    )
  }

  if (!client || !call) {
    return (
      <div className="app-loading" dir="rtl">
        در حال اتصال به وبینار…
      </div>
    )
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <div className="app-call">
          {showKickedMessage && (
            <div className="app-kicked-overlay" dir="rtl" role="alert">
              <p className="app-kicked-title">شما اخراج شدید</p>
              <p className="app-kicked-desc">در حال انتقال به صفحهٔ ورود…</p>
            </div>
          )}
          <ConferenceRoom
            isAdmin={false}
            userName={userName}
            onKicked={handleKicked}
            joinToken={String(joinToken)}
          />
        </div>
      </StreamCall>
    </StreamVideo>
  )
}

export default ViewerCallPage
