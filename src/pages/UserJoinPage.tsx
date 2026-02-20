import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import './UserJoinPage.css'

const UserJoinPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const wasKicked = (location.state as { kicked?: boolean } | null)?.kicked ?? false
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const codeNum = code.replace(/\D/g, '')
    const userName = name.trim() || 'کاربر'
    if (codeNum.length !== 4) {
      setError('کد اتاق باید ۴ رقم باشد.')
      return
    }
    setLoading(true)
    try {
      const base = window.location.origin
      const res = await fetch(`${base}/api/join-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeNum, userName }),
      })
      const data = (await res.json()) as { allowed?: boolean; reason?: string; joinToken?: string }
      if (data.allowed) {
        if (data.joinToken) {
          try {
            sessionStorage.setItem('stream_join_token', data.joinToken)
            sessionStorage.setItem('stream_join_userName', userName)
          } catch (_) {}
        }
        navigate('/watch', { state: { userName, joinToken: data.joinToken } })
      } else if (data.reason === 'banned') {
        setError('شما اجازهٔ ورود به این اتاق را ندارید.')
      } else {
        setError('کد اتاق اشتباه است.')
      }
    } catch (_) {
      setError('خطا در ارتباط با سرور. دوباره تلاش کنید.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="user-join-page" dir="rtl">
      <div className="user-join-card">
        <h1 className="user-join-title">ورود کاربران</h1>
        {wasKicked && (
          <p className="user-join-kicked" role="alert">
            شما از اتاق اخراج شده‌اید و در این session اجازهٔ ورود مجدد ندارید.
          </p>
        )}
        <p className="user-join-subtitle">
          کد ۴ رقمی اتاق و نام خود را وارد کنید تا وارد وبینار شوید.
        </p>
        <form onSubmit={handleSubmit} className="user-join-form">
          <label className="user-join-label">
            کد اتاق (۴ رقمی)
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="۱۲۳۴"
              className="user-join-input"
              autoComplete="off"
            />
          </label>
          <label className="user-join-label">
            نام شما
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="نام خود را بنویسید"
              className="user-join-input"
              autoComplete="name"
            />
          </label>
          {error && <p className="user-join-error">{error}</p>}
          <button type="submit" className="user-join-btn" disabled={loading}>
            {loading ? 'در حال بررسی…' : 'ورود به وبینار'}
          </button>
        </form>
        <p className="user-join-back">
          <Link to="/">بازگشت به صفحهٔ اصلی</Link>
        </p>
      </div>
    </div>
  )
}

export default UserJoinPage
