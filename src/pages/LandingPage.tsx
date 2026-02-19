import { Link } from 'react-router-dom'
import './LandingPage.css'

const LandingPage = () => (
  <div className="landing-page" dir="rtl">
    <div className="landing-card">
      <h1 className="landing-title">حقیقی استریم</h1>
      <p className="landing-subtitle">وبینار و پخش زنده</p>
      <div className="landing-actions">
        <Link to="/admin" className="landing-btn landing-btn-admin">
          ورود ادمین
        </Link>
        <Link to="/join" className="landing-btn landing-btn-user">
          ورود به وبینار
        </Link>
      </div>
    </div>
  </div>
)

export default LandingPage
