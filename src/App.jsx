import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from './lib/supabase'
import RequestRide from './pages/RequestRide'
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
import Chat from './pages/Chat'
import Subscription from './pages/Subscription'
import Feedback from './pages/Feedback'
import { usePushNotifications } from './lib/pushNotifications'

function Loader() {
  return (
    <div style={{
      minHeight: '100vh', background: '#fff',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 40,
    }}>
      <img src="/logo.png" alt="CarpoolKaro" style={{ width: '80%', maxWidth: 280, height: 'auto' }} />
    </div>
  )
}

function AppRoutes() {
  const { user, profile, loading } = useAuth()
  usePushNotifications(user?.id)

  // Track last seen
  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', user.id).then(() => {})
  }, [user?.id])

  if (loading) return <Loader />
  if (!user) return <Login />
  if (!profile?.onboarding_complete) return <Onboarding />
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/post" element={<PostRide />} />
      <Route path="/request" element={<RequestRide />} />
      <Route path="/my-rides" element={<MyRides />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/book/:id" element={<BookRide />} />
      <Route path="/live/:bookingId" element={<LiveRide />} />
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/edit-ride/:id" element={<EditRide />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/terms" element={<TermsPrivacy />} />
      <Route path="/install" element={<Install />} />
      <Route path="/chat/:bookingId" element={<Chat />} />
      <Route path="/subscription" element={<Subscription />} />
      <Route path="/feedback" element={<Feedback />} />
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
