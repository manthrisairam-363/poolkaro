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
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    setLoading(false)
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
    <div style={{
      height: '100dvh', // dynamic viewport height for iOS
      width: '100%',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #eef2ff 0%, #f0f4ff 50%, #fff 100%)',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top)', // notch safe area
    }}>

      {/* Top section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={handleLogoTap} style={{ cursor: 'pointer', marginBottom: 12 }}>
          <img
            src="/logo.png"
            alt="CarpoolKaro"
            style={{ width: '85%', maxWidth: 300, height: 'auto', display: 'block', margin: '0 auto' }}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 'clamp(20px, 4.5vw, 26px)', // headline smaller than before
            fontWeight: 900,
            color: '#0f172a',
            lineHeight: 1.3,
          }}>
            Good Journeys,<br />
            <span style={{ color: '#f59e0b' }}>Start Together</span>
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 6, fontWeight: 500 }}>
            Share rides · Save money · Meet colleagues
          </div>
        </div>
      </div>

      {/* Illustration */}
      <div style={{ flex: 1 }}>
        <img
          src="/login-illustration.png"
          alt="Carpool illustration"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Bottom section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px' }}>
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444',
            fontSize: 12,
            marginBottom: 12,
            padding: '10px 14px',
            borderRadius: 12,
            textAlign: 'center',
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={googleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '16px',
            background: 'linear-gradient(135deg, #facc15 0%, #f59e0b 100%)',
            border: 'none',
            borderRadius: 20,
            fontSize: 16,
            fontWeight: 800,
            color: '#111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            cursor: loading ? 'default' : 'pointer',
            boxShadow: '0 6px 18px rgba(245,158,11,0.35)',
          }}
        >
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <div style={{ textAlign: 'center', marginTop: 10, color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>
          🔒 Secure · Simple · Reliable
        </div>

        <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#cbd5e1' }}>
          By continuing you agree to our{' '}
          <a href="/terms" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>Terms & Privacy Policy</a>
        </div>

        {showEmail && (
          <div style={{ marginTop: 14, padding: 16, background: '#f8faff', borderRadius: 14, border: '1px solid #e0e7ff' }}>
            <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginBottom: 10 }}>Admin Login</div>
            <input
              type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #e0e7ff', fontSize: 13, marginBottom: 8 }}
            />
            <input
              type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #e0e7ff', fontSize: 13, marginBottom: 10 }}
            />
            <button
              onClick={emailLogin}
              disabled={loading}
              style={{ width: '100%', padding: 12, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
