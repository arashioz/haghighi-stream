import { useEffect, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import './AdminRoomInfoPage.css'

const AdminRoomInfoPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { username?: string; role?: string } | null
  const username = state?.username ?? 'ادمین'
  const role = state?.role ?? 'admin'

  const [roomCode, setRoomCode] = useState('')
  const [codeSaveStatus, setCodeSaveStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle')

  useEffect(() => {
    if (!state?.username) {
      navigate('/admin', { replace: true })
      return
    }
    const load = async () => {
      try {
        const res = await fetch(`${window.location.origin}/api/room-code`)
        const data = (await res.json()) as { code?: string }
        setRoomCode(data.code || '')
      } catch (_) {
        setRoomCode('1234')
      }
    }
    load()
  }, [state?.username, navigate])

  const saveRoomCode = async () => {
    const code = roomCode.replace(/\D/g, '').slice(0, 4)
    if (code.length !== 4) return
    setCodeSaveStatus('saving')
    try {
      const res = await fetch(`${window.location.origin}/api/room-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = (await res.json()) as { ok?: boolean }
      setCodeSaveStatus(data.ok ? 'ok' : 'error')
      if (data.ok) setRoomCode(code)
      setTimeout(() => setCodeSaveStatus('idle'), 2000)
    } catch (_) {
      setCodeSaveStatus('error')
      setTimeout(() => setCodeSaveStatus('idle'), 2000)
    }
  }

  const joinLink =
    typeof window !== 'undefined' ? `${window.location.origin}/join` : '/join'

  const copyLink = () => {
    navigator.clipboard?.writeText(joinLink)
  }

  return (
    <div className="admin-room-info-page" dir="rtl">
      <div className="admin-room-info-card">
        <h1 className="admin-room-info-title">صفحهٔ اطلاع‌رسانی</h1>
        <p className="admin-room-info-desc">
          لینک زیر را برای شرکت‌کنندگان بفرست. آن‌ها با وارد کردن کد اتاق و نام خود وارد وبینار می‌شوند.
        </p>
        <div className="admin-room-info-link-box">
          <label className="admin-room-info-label">لینک ورود کاربران</label>
          <div className="admin-room-info-link-row">
            <input
              type="text"
              readOnly
              value={joinLink}
              className="admin-room-info-input"
            />
            <button type="button" className="admin-room-info-copy" onClick={copyLink}>
              کپی
            </button>
          </div>
          <div className="admin-room-info-code-section">
            <label className="admin-room-info-label">کد ورود به اتاق (۴ رقمی)</label>
            <div className="admin-room-info-link-row">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, ''))}
                placeholder="۱۲۳۴"
                className="admin-room-info-input"
              />
              <button
                type="button"
                className="admin-room-info-copy"
                onClick={saveRoomCode}
                disabled={codeSaveStatus === 'saving' || roomCode.replace(/\D/g, '').length !== 4}
              >
                {codeSaveStatus === 'saving' ? '…' : codeSaveStatus === 'ok' ? 'ذخیره شد' : 'ذخیره کد'}
              </button>
            </div>
            <p className="admin-room-info-hint">
              این کد را به شرکت‌کنندگان بدهید. فقط با کد درست می‌توانند وارد شوند.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="admin-room-info-enter"
          onClick={() => navigate('/admin/call', { state: { username, role } })}
        >
          ورود به اتاق
        </button>
        <p className="admin-room-info-back">
          <Link to="/">بازگشت به صفحهٔ اصلی</Link>
        </p>
      </div>
    </div>
  )
}

export default AdminRoomInfoPage
