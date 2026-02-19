import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'

const ADMIN_USERS = [
  { username: 'admin', password: '1234', role: 'admin' as const },
  { username: 'ادمین', password: '1234', role: 'admin' as const },
]
const OPERATOR_USERS = Array.from({ length: 10 }, (_, i) => ({
  username: `op${i + 1}`,
  password: '1234',
  role: 'operator' as const,
}))
const ALL_STAFF = [...ADMIN_USERS, ...OPERATOR_USERS]

const AdminLoginPage = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const found = ALL_STAFF.find(
      (u) => u.username === username.trim() && u.password === password
    )
    if (found) {
      navigate('/admin/room', { state: { username: found.username, role: found.role } })
    } else {
      setError('نام کاربری یا رمز عبور اشتباه است.')
    }
  }

  return (
    <div className="login-page" dir="rtl">
      <div className="login-card">
        <h1 className="login-title">ورود ادمین</h1>
        <p className="login-subtitle">حقیقی استریم — ادمین یا اپراتور (op1 تا op10)</p>
        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label">
            نام کاربری
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="login-input"
              autoComplete="username"
            />
          </label>
          <label className="login-label">
            رمز عبور
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="رمز عبور"
              className="login-input"
              autoComplete="current-password"
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="login-btn">
            ورود
          </button>
        </form>
        <p className="login-back">
          <Link to="/">بازگشت به صفحهٔ اصلی</Link>
        </p>
      </div>
    </div>
  )
}

export default AdminLoginPage
