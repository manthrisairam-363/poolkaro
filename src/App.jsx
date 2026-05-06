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
import Wallet from './pages/Wallet'
import EditRide from './pages/EditRide'
import AdminDashboard from './pages/AdminDashboard'
import TermsPrivacy from './pages/TermsPrivacy'

function Loader() {
  return (
    <div style={{
      minHeight: '100vh', background: '#111',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
    }}>
      <div style={{ width: 80, height: 80, borderRadius: 24, background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, boxShadow: '0 8px 32px rgba(250,204,21,0.3)' }}>🚗</div>
      <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: '-1px' }}>
        <span style={{ color: '#facc15' }}>Pool</span><span style={{ color: '#fff' }}>Karo</span>
      </div>
      <div style={{ color: '#555', fontSize: 13 }}>Hyderabad IT Carpool</div>
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
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/edit-ride/:id" element={<EditRide />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/terms" element={<TermsPrivacy />} />
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
