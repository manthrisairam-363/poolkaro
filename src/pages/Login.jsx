import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [taps, setTaps] = useState(0)
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function googleLogin() {
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (err) setError(err.message)
  }

  async function emailLogin() {
    setError('')
    if (!email || !password) { setError('Enter email and password'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) setError(err.message)
  }

  function handleLogoTap() {
    const next = taps + 1
    setTaps(next)
    if (next >= 7) { setShowEmail(true); setTaps(0) }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#F8F5FF 0%,#EEE8FF 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: 30 }}>

      {/* Logo Section */}
      <div style={{ width: '100%', textAlign: 'center', marginTop: 10 }}>
        <img
          src="/logo.png"
          alt="CarpoolKaro"
          onClick={handleLogoTap}
          style={{ width: 250, maxWidth: '85%', cursor: 'default' }}
        />
      </div>

      {/* Hero Section */}
      <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
        <h1 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.1, color: '#102A63', marginBottom: 10 }}>
          Good journeys<br/>start together
        </h1>
        <div style={{ color: '#4B5563', fontSize: 18, lineHeight: 1.5, marginBottom: 25 }}>
          Find your perfect ride<br/>with verified professionals
        </div>
        <img src="/login-illustration.png" alt="" style={{ width: '100%', maxWidth: 320, marginBottom: 30 }} />
      </div>

      {/* Bottom Section */}
      <div style={{ width: '100%', maxWidth: 420 }}>
        {error && <div style={{ background: '#FEE2E2', color: '#DC2626', padding: 12, borderRadius: 12, marginBottom: 15, textAlign: 'center' }}>{error}</div>}
        <button onClick={googleLogin} disabled={loading} style={{ width: '100%', height: 62, border: 'none', borderRadius: 18, background: '#FFC107', color: '#111', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, boxShadow: '0 8px 20px rgba(255,193,7,.35)' }}>
          Continue with Google
        </button>
        <div style={{ textAlign: 'center', marginTop: 14, color: '#102A63', fontWeight: 500, fontSize: 14 }}>🔒 100% Secure & Private</div>

        {/* Hidden Admin Login */}
        {showEmail && (
          <div style={{ marginTop: 25, background: 'white', padding: 20, borderRadius: 18 }}>
            <input style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #ddd', marginBottom: 12 }} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #ddd', marginBottom: 12 }} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <button onClick={emailLogin} style={{ width: '100%', height: 50, border: 'none', borderRadius: 12, background: '#102A63', color: 'white', fontWeight: 600 }}>Admin Login</button>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 18, fontSize: 12, color: '#6B7280' }}>
          By continuing you agree to our Terms & Privacy Policy
        </div>
      </div>

    </div>
  )
}
