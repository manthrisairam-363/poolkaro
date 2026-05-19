import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Hidden admin-only email login (no signup)
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

  // Secret: tap logo 7 times to show email login
  function handleLogoTap() {
    const next = taps + 1
    setTaps(next)
    if (next >= 7) { setShowEmail(true); setTaps(0) }
  }

  const inp = {
    width: '100%', padding: '13px 14px',
    background: '#222', border: '1.5px solid #333',
    borderRadius: 12, color: '#fff', fontSize: 15,
    fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>

      {/* Logo — tap 7x to unlock email login */}
      <div onClick={handleLogoTap} style={{ width: 80, height: 80, borderRadius: 24, background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, marginBottom: 12, boxShadow: '0 8px 32px rgba(250,204,21,0.3)', cursor: 'default' }}>
        <svg width="44" height="36" viewBox="0 0 48 36" fill="none">
          <path d="M8 20L12 8h24l4 12" stroke="#111" strokeWidth="3" strokeLinecap="round"/>
          <rect x="3" y="20" width="42" height="12" rx="3" fill="#111"/>
          <circle cx="13" cy="32" r="3.5" fill="#111" stroke="#facc15" strokeWidth="2"/>
          <circle cx="35" cy="32" r="3.5" fill="#111" stroke="#facc15" strokeWidth="2"/>
          <rect x="3" y="24" width="42" height="1.5" fill="#facc15"/>
          <rect x="16" y="11" width="16" height="9" rx="2" fill="#222"/>
        </svg>
      </div>

      <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', marginBottom: 4 }}>
        <span style={{ color: '#facc15' }}>Carpool</span>
        <span style={{ color: '#fff' }}>Karo</span>
      </div>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 36, textAlign: 'center' }}>
        Hyderabad's IT Carpool Community
      </div>

      <div style={{ background: '#1a1a1a', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 }}>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13, marginBottom: 14, padding: '10px 12px', borderRadius: 10, textAlign: 'center' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Google login — main option */}
        <button onClick={googleLogin} disabled={loading} style={{ width: '100%', padding: 15, background: '#fff', color: '#111', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.7 0 6.8 5.4 2.9 13.3l7.8 6.1C12.6 13.1 17.8 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
            <path fill="#FBBC05" d="M10.7 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6L2.4 13.3A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l8.2-6.1z"/>
            <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.2 0-11.4-3.6-13.3-8.8l-7.8 6.1C6.8 42.6 14.7 48 24 48z"/>
          </svg>
          Continue with Google
        </button>
        <div style={{ fontSize: 11, color: '#555', textAlign: 'center', marginTop: 10 }}>
          Sign in with your Gmail — one tap, no password needed
        </div>

        {/* Hidden email login — only shown after 7 logo taps */}
        {showEmail && (
          <div style={{ marginTop: 20, borderTop: '1px solid #222', paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: '#555', textAlign: 'center', marginBottom: 12 }}>Admin login</div>
            <input style={inp} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoCapitalize="none" />
            <input style={inp} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && emailLogin()} />
            <button onClick={emailLogin} disabled={loading} style={{ width: '100%', padding: 12, background: '#222', color: '#fff', border: '1px solid #333', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {loading ? 'Please wait...' : 'Login'}
            </button>
          </div>
        )}
      </div>

      <div style={{ color: '#333', fontSize: 11, marginTop: 20, textAlign: 'center', lineHeight: 1.8 }}>
        By continuing you agree to our Terms & Privacy Policy
        <br />
        <a href="mailto:support@carpoolkaro.com" style={{ color: '#888', textDecoration: 'none' }}>
          Need help? support@carpoolkaro.com
        </a>
      </div>
    </div>
  )
}
