import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import { supabase } from './lib/supabase'
import { detectPlatform } from './lib/platform'
import RequestRide from './pages/RequestRide'
import DeleteAccount from './pages/DeleteAccount'
import CommuteSetup from './components/CommuteSetup'
import { AuthProvider, useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Home from './pages/Home'
import PostRide from './pages/PostRide'
import MyRides from './pages/MyRides'
import Profile from './pages/Profile'
import BookRide from './pages/BookRide'
import RideCode from './pages/RideCode'
import LiveRide from './pages/LiveRide'
import Wallet from './pages/Wallet'
import EditRide from './pages/EditRide'
import AdminDashboard from './pages/AdminDashboard'
import TermsPrivacy from './pages/TermsPrivacy'
import Install from './pages/Install'
import Chat from './pages/Chat'
import InstallGuide from './components/InstallGuide'
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

// ── Shown when signed in but the profile could not be loaded (no connection) ──
function ConnectionError({ onRetry }) {
  const [retrying, setRetrying] = useState(false)
  const retryRef = useRef(onRetry)
  retryRef.current = onRetry

  async function retry() {
    setRetrying(true)
    await onRetry()
    setRetrying(false)
  }

  useEffect(() => {
    // Keep trying quietly so the app recovers on its own the moment the
    // network comes back — the user shouldn't have to tap anything.
    // onRetry is recreated each render, so hold it in a ref and register once.
    const fire = () => retryRef.current?.()
    const t = setInterval(fire, 5000)
    window.addEventListener('online', fire)
    return () => {
      clearInterval(t)
      window.removeEventListener('online', fire)
    }
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: '#111', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#facc15', marginBottom: 8 }}>
        No internet connection
      </div>
      <div style={{ fontSize: 14, color: '#888', lineHeight: 1.6, maxWidth: 300, marginBottom: 24 }}>
        CarpoolKaro needs a connection to load your account. Please check your
        network — we'll reconnect automatically.
      </div>
      <button onClick={retry} disabled={retrying} style={{
        padding: '12px 28px', background: '#facc15', color: '#111',
        border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700,
        cursor: retrying ? 'default' : 'pointer', opacity: retrying ? 0.6 : 1,
      }}>
        {retrying ? 'Reconnecting…' : '🔄 Try Again'}
      </button>
    </div>
  )
}

// ── Shown when a signed-in user has been banned by an admin (reversible) ──
function BannedScreen({ reason, onSignOut }) {
  return (
    <div style={{
      minHeight: '100vh', background: '#111', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 24, textAlign: 'center',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171', marginBottom: 8 }}>
        Account suspended
      </div>
      <div style={{ fontSize: 14, color: '#888', lineHeight: 1.6, maxWidth: 320, marginBottom: 8 }}>
        Your CarpoolKaro account has been suspended and you can't use the app right now.
      </div>
      {reason && (
        <div style={{ fontSize: 13, color: '#fca5a5', background: '#2a0a0a', border: '1px solid #7f1d1d', borderRadius: 10, padding: '10px 14px', maxWidth: 320, marginBottom: 16 }}>
          Reason: {reason}
        </div>
      )}
      <div style={{ fontSize: 13, color: '#888', maxWidth: 320, marginBottom: 24 }}>
        If you think this is a mistake, email us at <span style={{ color: '#facc15' }}>support@carpoolkaro.com</span>.
      </div>
      <button onClick={onSignOut} style={{
        padding: '12px 28px', background: '#222', color: '#fff',
        border: '1px solid #333', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
      }}>
        Sign out
      </button>
    </div>
  )
}

function CommuteEdit() {
  const navigate = useNavigate()
  return <CommuteSetup mode="edit" onDone={() => navigate('/profile')} />
}

function AppRoutes() {
  const { user, profile, loading, profileError, fetchProfile, signOut } = useAuth()
  usePushNotifications(user?.id)
  const [commuteSkipped, setCommuteSkipped] = useState(() => { try { return sessionStorage.getItem('commute_skip') === '1' } catch (_) { return false } })

  // Track last seen + what device/mode they're on (for admin install guidance)
  useEffect(() => {
    if (!user?.id) return
    const { platform, isPWA } = detectPlatform()
    supabase.from('profiles').update({
      last_seen_at: new Date().toISOString(),
      platform,
      is_pwa: isPWA,
      platform_updated_at: new Date().toISOString(),
    }).eq('id', user.id).then(() => {})
  }, [user?.id])

  // Public pages that must work WITHOUT login (Play requires a reachable
  // account-deletion URL; legal pages are handy public too).
  const publicPath = typeof window !== 'undefined' ? window.location.pathname : ''
  if (publicPath === '/delete-account') return <DeleteAccount />

  if (loading) return <Loader />
  if (!user) return <Login />
  // Signed in, but we couldn't reach the server to load the profile.
  // Never fall through to Onboarding here — that would restart setup for an
  // existing user just because they opened the app with no connection.
  if (profileError) return <ConnectionError onRetry={() => fetchProfile(user.id)} />
  // Banned users: reversible block — show a suspension screen instead of the app.
  if (profile?.banned) return <BannedScreen reason={profile.banned_reason} onSignOut={signOut} />
  if (!profile?.onboarding_complete) return <Onboarding />
  // After onboarding, prompt new AND existing users to set up their commute so
  // we can auto-post rides and match routes. Skippable per session; re-prompts
  // next open until completed (profiles.commute_setup_done).
  if (!profile?.commute_setup_done && !commuteSkipped) {
    return <CommuteSetup mode="existing" onDone={() => { setCommuteSkipped(true); fetchProfile(user.id) }} />
  }
  return (
    <>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/post" element={<PostRide />} />
      <Route path="/request" element={<RequestRide />} />
      <Route path="/my-rides" element={<MyRides />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/commute" element={<CommuteEdit />} />
      <Route path="/book/:id" element={<BookRide />} />
      <Route path="/r/:code" element={<RideCode />} />
      <Route path="/live/:bookingId" element={<LiveRide />} />
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/edit-ride/:id" element={<EditRide />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/terms" element={<TermsPrivacy />} />
      <Route path="/delete-account" element={<DeleteAccount />} />
      <Route path="/install" element={<Install />} />
      <Route path="/chat/:bookingId" element={<Chat />} />
      <Route path="/subscription" element={<Subscription />} />
      <Route path="/feedback" element={<Feedback />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <InstallGuide />
    </>
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
