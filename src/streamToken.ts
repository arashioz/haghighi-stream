/**
 * توکن Stream Video: اول از API سرور (/api/stream-token) می‌گیریم؛
 * اگر سرور STREAM_API_SECRET نداشته باشد، از VITE_STREAM_TOKEN استفاده می‌کنیم.
 */
const API_KEY = import.meta.env.VITE_STREAM_API_KEY || '69twsx7eb4ry'
const USER_ID = import.meta.env.VITE_STREAM_USER_ID || 'demo-user-PDL5QQZ9'
const CALL_ID = import.meta.env.VITE_STREAM_CALL_ID || 'demo-call-TDRPw16O'
const FALLBACK_TOKEN = import.meta.env.VITE_STREAM_TOKEN || ''

export const streamApiKey = API_KEY
export const streamUserId = USER_ID
export const streamCallId = CALL_ID

/** برای بیننده می‌توانی userId جدا بدهی تا هر کاربر در تماس یک شرکت‌کنندهٔ جدا باشد (و صدای ادمین درست پخش شود). */
export async function getStreamToken(forUserId?: string): Promise<string> {
  const userId = forUserId || USER_ID
  try {
    const url = `/api/stream-token?userId=${encodeURIComponent(userId)}`
    const res = await fetch(url)
    if (res.ok) {
      const data = (await res.json()) as { token?: string }
      if (data.token) return data.token
    }
  } catch (_) {
    // سرور توکن نمی‌دهد یا خطا — از env استفاده می‌کنیم
  }
  return FALLBACK_TOKEN
}
