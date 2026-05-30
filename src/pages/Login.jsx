import { useState } from 'react'
import { supabase } from '../lib/supabase'

// SVG Illustration — car with people and route
function CarIllustration() {
  return (
    <svg viewBox="0 0 360 220" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
      {/* Sky background */}
      <rect width="360" height="220" fill="#eef2ff" rx="0"/>

      {/* City skyline silhouette */}
      <rect x="0" y="120" width="360" height="100" fill="#e8eaf6"/>
      <rect x="10" y="95" width="28" height="80" rx="3" fill="#c5cae9"/>
      <rect x="16" y="85" width="16" height="15" rx="2" fill="#c5cae9"/>
      <rect x="18" y="78" width="12" height="10" rx="1" fill="#c5cae9"/>
      <rect x="45" y="105" width="22" height="70" rx="3" fill="#d1d5db"/>
      <rect x="75" y="88" width="30" height="87" rx="3" fill="#c5cae9"/>
      <rect x="80" y="80" width="20" height="12" rx="2" fill="#c5cae9"/>
      <rect x="112" y="110" width="18" height="65" rx="3" fill="#d1d5db"/>
      <rect x="270" y="90" width="26" height="85" rx="3" fill="#c5cae9"/>
      <rect x="275" y="82" width="16" height="12" rx="2" fill="#c5cae9"/>
      <rect x="302" y="100" width="22" height="75" rx="3" fill="#d1d5db"/>
      <rect x="330" y="108" width="30" height="67" rx="3" fill="#c5cae9"/>

      {/* Road */}
      <rect x="0" y="158" width="360" height="62" rx="0" fill="#9fa8da" opacity="0.4"/>
      <rect x="0" y="162" width="360" height="50" rx="0" fill="#7986cb" opacity="0.25"/>
      {/* Road dashes */}
      <rect x="40" y="183" width="30" height="4" rx="2" fill="#fff" opacity="0.5"/>
      <rect x="100" y="183" width="30" height="4" rx="2" fill="#fff" opacity="0.5"/>
      <rect x="160" y="183" width="30" height="4" rx="2" fill="#fff" opacity="0.5"/>
      <rect x="220" y="183" width="30" height="4" rx="2" fill="#fff" opacity="0.5"/>
      <rect x="280" y="183" width="30" height="4" rx="2" fill="#fff" opacity="0.5"/>

      {/* Dotted route arc */}
      <path d="M 80 80 Q 180 30 280 75" stroke="#facc15" strokeWidth="2.5" strokeDasharray="6 5" fill="none" opacity="0.8"/>

      {/* Location pin A (start) */}
      <ellipse cx="82" cy="84" rx="14" ry="14" fill="#3b82f6" opacity="0.15"/>
      <path d="M82 68 C76 68 71 73 71 79 C71 87 82 97 82 97 C82 97 93 87 93 79 C93 73 88 68 82 68Z" fill="#3b82f6"/>
      <circle cx="82" cy="79" r="4" fill="#fff"/>

      {/* Location pin B (end) */}
      <ellipse cx="280" cy="80" rx="14" ry="14" fill="#f59e0b" opacity="0.15"/>
      <path d="M280 64 C274 64 269 69 269 75 C269 83 280 93 280 93 C280 93 291 83 291 75 C291 69 286 64 280 64Z" fill="#f59e0b"/>
      <circle cx="280" cy="75" r="4" fill="#fff"/>

      {/* Car body shadow */}
      <ellipse cx="182" cy="173" rx="85" ry="10" fill="#312e81" opacity="0.12"/>

      {/* Car body main -->  */}
      <rect x="100" y="140" width="164" height="38" rx="10" fill="#f8faff"/>
      <rect x="100" y="140" width="164" height="38" rx="10" fill="url(#carGrad)" stroke="#e0e7ff" strokeWidth="1"/>

      {/* Car roof -->  */}
      <path d="M130 140 L145 112 L220 112 L238 140Z" fill="#fff" stroke="#e0e7ff" strokeWidth="1"/>
      <path d="M130 140 L145 112 L220 112 L238 140Z" fill="url(#roofGrad)"/>

      {/* Windshield */}
      <path d="M136 138 L149 117 L217 117 L231 138Z" fill="#bfdbfe" opacity="0.7"/>
      <path d="M136 138 L149 117 L217 117 L231 138Z" fill="url(#glassGrad)" opacity="0.5"/>

      {/* Side windows */}
      <rect x="103" y="141" width="28" height="22" rx="5" fill="#bfdbfe" opacity="0.6"/>
      <rect x="233" y="141" width="28" height="22" rx="5" fill="#bfdbfe" opacity="0.6"/>

      {/* Door line -->  */}
      <line x1="183" y1="140" x2="183" y2="178" stroke="#c7d2fe" strokeWidth="1.5"/>

      {/* Headlight -->  */}
      <ellipse cx="262" cy="152" rx="7" ry="5" fill="#fef3c7"/>
      <ellipse cx="262" cy="152" rx="4" ry="3" fill="#fbbf24"/>

      {/* Tail light -->  */}
      <rect x="100" y="148" width="6" height="10" rx="3" fill="#fca5a5"/>
      <rect x="101" y="149" width="4" height="8" rx="2" fill="#ef4444"/>

      {/* Wheels -->  */}
      <circle cx="140" cy="176" r="18" fill="#374151"/>
      <circle cx="140" cy="176" r="12" fill="#6b7280"/>
      <circle cx="140" cy="176" r="6" fill="#9ca3af"/>
      <circle cx="140" cy="176" r="3" fill="#f8faff"/>

      <circle cx="225" cy="176" r="18" fill="#374151"/>
      <circle cx="225" cy="176" r="12" fill="#6b7280"/>
      <circle cx="225" cy="176" r="6" fill="#9ca3af"/>
      <circle cx="225" cy="176" r="3" fill="#f8faff"/>

      {/* People in car - driver -->  */}
      <circle cx="175" cy="128" r="9" fill="#fbbf24"/>
      <ellipse cx="175" cy="138" rx="7" ry="5" fill="#1e40af"/>

      {/* People in car - passenger -->  */}
      <circle cx="200" cy="128" r="8" fill="#f9a8d4"/>
      <ellipse cx="200" cy="138" rx="6" ry="4" fill="#dc2626"/>

      {/* Gradients */}
      <defs>
        <linearGradient id="carGrad" x1="100" y1="140" x2="264" y2="178" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f0f4ff"/>
          <stop offset="100%" stopColor="#e8eeff"/>
        </linearGradient>
        <linearGradient id="roofGrad" x1="130" y1="112" x2="238" y2="140" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f0f4ff"/>
          <stop offset="100%" stopColor="#dde4ff"/>
        </linearGradient>
        <linearGradient id="glassGrad" x1="136" y1="117" x2="231" y2="138" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.3"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #eef2ff 0%, #f0f4ff 50%, #fff 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '0',
      maxWidth: 430, margin: '0 auto',
    }}>

      {/* Top section */}
      <div style={{ width: '100%', padding: '48px 28px 0', textAlign: 'center' }}>
        {/* Logo */}
        <div onClick={handleLogoTap} style={{ cursor: 'default', marginBottom: 20 }}>
          <img
            src="/logo.png"
            alt="CarpoolKaro"
            style={{ width: '65%', maxWidth: 220, height: 'auto', display: 'block', margin: '0 auto' }}
          />
        </div>

        {/* Headline */}
        <div style={{ marginBottom: 6 }}>
          <div style={{
            fontSize: 28, fontWeight: 900, color: '#0f172a',
            letterSpacing: '-0.8px', lineHeight: 1.2,
          }}>
            Smart Commutes,<br />
            <span style={{ color: '#f59e0b' }}>Better Connections</span>
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8, fontWeight: 500 }}>
            Share rides · Save money · Meet colleagues
          </div>
        </div>
      </div>

      {/* Illustration */}
      <div style={{ width: '100%', padding: '0 0', flexShrink: 0 }}>
        <CarIllustration />
      </div>

      {/* Bottom section */}
      <div style={{ width: '100%', padding: '0 24px 40px' }}>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444', fontSize: 12, marginBottom: 14, padding: '10px 14px',
            borderRadius: 12, textAlign: 'center',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Google button — big yellow like reference */}
        <button
          onClick={googleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '18px 24px',
            background: 'linear-gradient(135deg, #facc15 0%, #f59e0b 100%)',
            border: 'none', borderRadius: 20,
            fontSize: 16, fontWeight: 800, color: '#111',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            cursor: loading ? 'default' : 'pointer',
            boxShadow: '0 8px 24px rgba(245,158,11,0.35)',
            letterSpacing: '-0.3px',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>

        {/* Security text */}
        <div style={{ textAlign: 'center', marginTop: 14, color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>
          🔒 Secure · Simple · Reliable
        </div>

        {/* Terms */}
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#cbd5e1', lineHeight: 1.6 }}>
          By continuing you agree to our{' '}
          <a href="/terms" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>Terms & Privacy Policy</a>
        </div>

        {/* Hidden email login */}
        {showEmail && (
          <div style={{ marginTop: 20, padding: 16, background: '#f8faff', borderRadius: 14, border: '1px solid #e0e7ff' }}>
            <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginBottom: 10 }}>Admin Login</div>
            <input
              type="email" placeholder="Email" value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e0e7ff', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
            />
            <input
              type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e0e7ff', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
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
