import { useState } from 'react'
import type { FormEvent } from 'react'

type UserRole = 'admin' | 'client'

const STATIC_USERS: { username: string; password: string; role: UserRole }[] = [
  { username: 'admin', password: '1234', role: 'admin' },
  { username: 'ادمین', password: '1234', role: 'admin' },
  { username: 'کاربر۱', password: '1234', role: 'client' },
  { username: 'کاربر۲', password: '1234', role: 'client' },
  { username: 'user1', password: '1234', role: 'client' },
  { username: 'user2', password: '1234', role: 'client' },
]

export type LoginResult = { username: string; role: UserRole }

type Props = {
  onLogin: (result: LoginResult) => void
}

const Login = ({ onLogin }: Props) => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const found = STATIC_USERS.find(
      (u) => u.username === username.trim() && u.password === password
    )
    if (found) {
      onLogin({ username: found.username, role: found.role })
    } else {
      setError('نام کاربری یا رمز عبور اشتباه است.')
    }
  }

  return (
    <div className="login-page" dir="rtl">
      <div className="login-card">
        <h1 className="login-title">حقیقی استریم</h1>
        <p className="login-subtitle">ورود به اتاق پخش. اطلاعات خود را وارد کنید.</p>

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label">
            نام کاربری
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ادمین یا کاربر۱"
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
            ورود به اتاق
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login
