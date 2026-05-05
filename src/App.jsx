import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import PostRide from './pages/PostRide'
import MyRides from './pages/MyRides'
import Profile from './pages/Profile'
import BookRide from './pages/BookRide'
import LiveRide from './pages/LiveRide'

function Loader() {
  return (
    <div style={{
      minHeight: '100vh', background: '#111',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
    }}>
      <div style={{ fontSize: 48 }}>🚗</div>
      <div style={{ color: '#facc15', fontWeight: 800, fontSize: 24 }}>PoolKaro</div>
      <div style={{ color: '#555', fontSize: 13 }}>Loading...</div>
    </div>
  )
}

function AppRoutes() {
  const { user, profile, loading } = useAuth()
  if (loading) return <Loader />
  if (!user) return <Login />
  if (!profile?.onboarding_complete) return <Onboarding />
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/post" element={<PostRide />} />
      <Route path="/my-rides" element={<MyRides />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/book/:id" element={<BookRide />} />
      <Route path="/live/:bookingId" element={<LiveRide />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
