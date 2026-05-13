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
import Install from './pages/Install'
import { usePushNotifications } from './lib/pushNotifications'

function Loader() {
  return (
    <div style={{
      minHeight: '100vh', background: '#111',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 12,
    }}>
      <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #facc15, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(250,204,21,0.4)' }}>
        <svg width="52" height="40" viewBox="0 0 48 36" fill="none">
          <path d="M8 20L12 8h24l4 12" stroke="#111" strokeWidth="3" strokeLinecap="round"/>
          <rect x="3" y="20" width="42" height="12" rx="3" fill="#111"/>
          <circle cx="13" cy="32" r="3.5" fill="#111" stroke="#facc15" strokeWidth="2"/>
          <circle cx="35" cy="32" r="3.5" fill="#111" stroke="#facc15" strokeWidth="2"/>
          <rect x="3" y="24" width="42" height="1.5" fill="#facc15"/>
          <rect x="16" y="11" width="16" height="9" rx="2" fill="#222"/>
        </svg>
      </div>
      <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: '-1px' }}>
        <span style={{ color: '#facc15' }}>Carpool</span><span style={{ color: '#fff' }}>Karo</span>
      </div>
      <div style={{ color: '#555', fontSize: 13 }}>Hyderabad IT Carpool</div>
    </div>
  )
}

function AppRoutes() {
  const { user, profile, loading } = useAuth()
  // Auto-register push notifications when logged in
  usePushNotifications(user?.id)
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
      <Route path="/install" element={<Install />} />
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
