import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  StreamCall,
  StreamVideo,
  StreamVideoClient,
  type User,
} from '@stream-io/video-react-sdk'
import ConferenceRoom from '../ConferenceRoom'
import { getStreamToken, streamApiKey, streamUserId, streamCallId } from '../streamToken'

const AdminCallPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as { username?: string; role?: string } | null
  const username = state?.username ?? 'ادمین'
  const role = state?.role ?? 'admin'
  const [token, setToken] = useState<string | null>(null)
  const [client, setClient] = useState<StreamVideoClient | null>(null)
  const [call, setCall] = useState<ReturnType<StreamVideoClient['call']> | null>(null)

  useEffect(() => {
    if (!state?.username) {
      navigate('/admin/room', { replace: true })
    }
  }, [location.state, navigate])

  useEffect(() => {
    let cancelled = false
    getStreamToken().then((t) => {
      if (!cancelled) setToken(t)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!token) return
    const user: User = { id: streamUserId, name: username }
    const c = new StreamVideoClient({ apiKey: streamApiKey, user, token })
    const callInstance = c.call('default', streamCallId)
    callInstance.join({ create: true })
    setClient(c)
    setCall(callInstance)
    return () => {
      callInstance.leave().catch(() => {})
    }
  }, [token, username])

  if (token === null) {
    return (
      <div className="app-loading" dir="rtl">
        در حال دریافت توکن…
      </div>
    )
  }

  if (!token) {
    return (
      <div className="app-loading app-loading--error" dir="rtl">
        <p>توکن Stream تنظیم نشده یا منقضی شده.</p>
        <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
          روی سرور متغیر <code>STREAM_API_SECRET</code> را در env بگذار، یا در فرانت <code>.env</code> و <code>VITE_STREAM_TOKEN</code> را پر کن و دوباره بیلد بگیر.
        </p>
      </div>
    )
  }

  if (!client || !call) {
    return (
      <div className="app-loading" dir="rtl">
        در حال اتصال به اتاق…
      </div>
    )
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <div className="app-call">
          <ConferenceRoom
          isAdmin={role === 'admin'}
          isOperator={role === 'operator'}
          userName={username}
        />
        </div>
      </StreamCall>
    </StreamVideo>
  )
}

export default AdminCallPage
