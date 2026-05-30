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
      minHeight: '100vh',
      width: '100%',
      background: 'linear-gradient(180deg, #eef2ff 0%, #f0f4ff 50%, #fff 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      margin: 0,
      padding: '0 5vw',
      boxSizing: 'border-box',
    }}>

      {/* Top section */}
      <div style={{ width: '100%', paddingTop: '12vh', textAlign: 'center' }}>
        {/* Logo */}
        <div onClick={handleLogoTap} style={{ cursor: 'pointer', marginBottom: '4vh' }}>
          <img
            src="/logo.png"
            alt="CarpoolKaro"
            style={{ width: '80%', maxWidth: 320, height: 'auto', display: 'block', margin: '0 auto' }}
          />
        </div>

        {/* Headline */}
        <div style={{ marginBottom: '3vh' }}>
          <div style={{
            fontSize: 'clamp(22px, 5vw, 32px)',
            fontWeight: 900,
            color: '#0f172a',
            letterSpacing: '-0.8px',
            lineHeight: 1.3,
          }}>
            Good Journeys,<br />
            <span style={{ color: '#f59e0b' }}>Start Together</span>
          </div>
          <div style={{
            fontSize: 'clamp(12px, 3vw, 15px)',
            color: '#64748b',
            marginTop: '1vh',
            fontWeight: 500
          }}>
            Share rides · Save money · Meet colleagues
          </div>
        </div>
      </div>

      {/* Illustration */}
      <div style={{ width: '100%', flexShrink: 0 }}>
        <img
          src="/login-illustration.png"
          alt="Carpool illustration"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>

      {/* Bottom section */}
      <div style={{ width: '100%', padding: '0 5vw 8vh' }}>
        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444',
            fontSize: 12,
            marginBottom: '2vh',
            padding: '10px 14px',
            borderRadius: 12,
            textAlign: 'center',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Google button */}
        <button
          onClick={googleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #facc15 0%, #f59e0b 100%)',
            border: 'none',
            borderRadius: 20,
            fontSize: 'clamp(14px, 3.5vw, 16px)',
            fontWeight: 800,
            color: '#111',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            cursor: loading ? 'default' : 'pointer',
            boxShadow: '0 8px 24px rgba(245,158,11,0.35)',
            letterSpacing: '-0.3px',
            marginTop: '2vh',
          }}
        >
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        {/* Security text */}
        <div style={{ textAlign: 'center', marginTop: '2vh', color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>
          🔒 Secure · Simple · Reliable
        </div>

        {/* Terms */}
        <div style={{ textAlign: 'center', marginTop: '2vh', fontSize: 11, color: '#cbd5e1', lineHeight: 1.6 }}>
          By continuing you agree to our{' '}
          <a href="/terms" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>Terms & Privacy Policy</a>
        </div>

        {/* Hidden email login */}
        {showEmail && (
          <div style={{
            marginTop: '3vh',
            padding: 16,
            background: '#f8faff',
            borderRadius: 14,
            border: '1px solid #e0e7ff'
          }}>
            <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginBottom: 12 }}>Admin Login</div>
            <input
              type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e0e7ff', fontSize: 13, marginBottom: 10 }}
            />
            <input
              type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e0e7ff', fontSize: 13, marginBottom: 12 }}
            />
            <button
              onClick={emailLogin} disabled={loading}
              style={{ width: '100%', padding: 12, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
