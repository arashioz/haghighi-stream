import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import AdminLoginPage from './pages/AdminLoginPage'
import AdminRoomInfoPage from './pages/AdminRoomInfoPage'
import AdminCallPage from './pages/AdminCallPage'
import UserJoinPage from './pages/UserJoinPage'
import ViewerCallPage from './pages/ViewerCallPage'
import './App.css'

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin" element={<AdminLoginPage />} />
      <Route path="/admin/room" element={<AdminRoomInfoPage />} />
      <Route path="/admin/call" element={<AdminCallPage />} />
      <Route path="/join" element={<UserJoinPage />} />
      <Route path="/watch" element={<ViewerCallPage />} />
    </Routes>
  </BrowserRouter>
)

export default App
