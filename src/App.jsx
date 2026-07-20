import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
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

// ── Global offline banner ──
// navigator.onLine only tells us a network interface exists — WiFi with no
// internet still reports "online", and on iOS PWAs the offline event often
// never fires. So we actively probe Supabase, which our service worker
// deliberately does NOT intercept (same-origin requests fall back to cache
// and would falsely succeed).
function OfflineBanner() {
  const [offline, setOffline] = useState(false)
  const [showBack, setShowBack] = useState(false)

  useEffect(() => {
    let cancelled = false
    let wasOffline = false
    let timer = null

    async function reachable() {
      if (!navigator.onLine) return false
      const ctrl = new AbortController()
      const kill = setTimeout(() => ctrl.abort(), 6000)
      try {
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health?_=${Date.now()}`,
          { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal }
        )
        return true
      } catch {
        return false
      } finally {
        clearTimeout(kill)
      }
    }

    async function check() {
      const ok = await reachable()
      if (cancelled) return
      if (!ok) {
        wasOffline = true
        setOffline(true)
        setShowBack(false)
      } else {
        setOffline(false)
        if (wasOffline) {
          wasOffline = false
          setShowBack(true)
          setTimeout(() => { if (!cancelled) setShowBack(false) }, 3000)
        }
      }
    }

    // Instant signal when the browser does fire the events
    function onOffline() { wasOffline = true; setOffline(true); setShowBack(false) }
    function onOnline() { check() }
    function onVisible() { if (document.visibilityState === 'visible') check() }

    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)

    check()
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') check()
    }, 15000)

    return () => {
      cancelled = true
      clearInterval(timer)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!offline && !showBack) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 10000,
      background: offline ? '#dc2626' : '#16a34a', color: '#fff',
      padding: '10px 16px', fontSize: 13, fontWeight: 700,
      textAlign: 'center', boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
    }}>
      {offline
        ? '⚠️ No internet connection — please check your network'
        : '✅ Back online'}
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
      <OfflineBanner />
      <AppRoutes />
    </AuthProvider>
  )
}
