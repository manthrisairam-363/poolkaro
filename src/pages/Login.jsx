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
    // Return to wherever the user was trying to go (e.g. a shared /book/{id}
    // link from WhatsApp), not always the home page. window.location.href
    // includes the path they landed on before being sent to login.
    const returnTo = window.location.pathname + window.location.search
    const redirectTo = window.location.origin + (returnTo && returnTo !== '/' ? returnTo : '')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
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
      height: '100dvh',
      width: '100%',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #eef2ff 0%, #f0f4ff 50%, #fff 100%)',
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top)',
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
            fontSize: 'clamp(20px, 4.5vw, 26px)',
            fontWeight: 900,
            color: '#0f172a',
            lineHeight: 1.3,
          }}>
            Good Journeys ,<br />
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
            padding: '14px 18px',
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
          {/* Google "G" icon */}
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden focusable="false">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>

          <span style={{ display: 'inline-block' }}>
            {loading ? 'Signing in...' : 'Continue with Google'}
          </span>
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
