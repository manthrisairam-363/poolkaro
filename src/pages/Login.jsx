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
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      })
      if (err) setError(err.message)
    } catch (e) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function emailLogin() {
    setError('')
    if (!email || !password) {
      setError('Enter email and password')
      return
    }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) setError(err.message)
    } catch (e) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleLogoTap() {
    const next = taps + 1
    setTaps(next)
    if (next >= 7) {
      setShowEmail(true)
      setTaps(0)
    }
  }

  return (
    <div style={{
      height: '100dvh',
      width: '100%',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #eef2ff 0%, #f0f4ff 50%, #fff 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center', // center everything vertically
      padding: 'env(safe-area-inset-top) 20px 20px env(safe-area-inset-left)',
      boxSizing: 'border-box',
      WebkitFontSmoothing: 'antialiased',
    }}>
      {/* Inline CSS for button states and spinner */}
      <style>{`
        .googleBtn {
          width: 100%;
          padding: 14px 18px;
          background: linear-gradient(135deg, #facc15 0%, #f59e0b 100%);
          border: none;
          border-radius: 20px;
          font-size: 16px;
          font-weight: 800;
          color: #111;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          box-shadow: 0 6px 18px rgba(245,158,11,0.35);
          transition: transform 120ms ease, box-shadow 120ms ease, opacity 120ms ease;
          -webkit-tap-highlight-color: transparent;
        }
        .googleBtn:active {
          transform: translateY(1px) scale(0.997);
          box-shadow: 0 4px 12px rgba(245,158,11,0.28);
        }
        .googleBtn[disabled] {
          opacity: 0.75;
          cursor: default;
        }
        .googleIcon {
          width: 20px;
          height: 20px;
          flex: 0 0 20px;
        }
        .spinner {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid rgba(0,0,0,0.12);
          border-top-color: rgba(0,0,0,0.6);
          animation: spin 0.9s linear infinite;
          box-sizing: border-box;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .btnText {
          display: inline-block;
        }
        .focusRing:focus {
          outline: none;
          box-shadow: 0 0 0 4px rgba(99,102,241,0.12);
          border-radius: 20px;
        }
        input:focus {
          outline: none;
          box-shadow: 0 0 0 4px rgba(99,102,241,0.08);
          border-radius: 10px;
        }
        @media (max-height: 640px) {
          .illustration {
            max-height: 24vh;
          }
          .logoImg {
            max-width: 240px;
          }
        }
      `}</style>

      {/* Content block centered */}
      <div style={{
        width: '100%',
        maxWidth: 430,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        boxSizing: 'border-box',
      }}>

        {/* Logo + tagline */}
        <div onClick={handleLogoTap} style={{ cursor: 'pointer', textAlign: 'center' }}>
          <img
            className="logoImg"
            src="/logo.png"
            alt="CarpoolKaro"
            style={{ width: '78%', maxWidth: 300, height: 'auto', display: 'block', margin: '0 auto 8px' }}
          />
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, letterSpacing: '0.6px' }}>
            RIDE TOGETHER, SAVE TOGETHER
          </div>
        </div>

        {/* Headline */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 'clamp(20px, 5vw, 26px)',
            fontWeight: 900,
            color: '#0f172a',
            lineHeight: 1.2,
            marginBottom: 6,
          }}>
            Good Journeys,<br />
            <span style={{ color: '#f59e0b' }}>Start Together</span>
          </div>
          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
            Share rides · Save money · Meet colleagues
          </div>
        </div>

        {/* Illustration (kept compact so layout stays centered) */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <img
            className="illustration"
            src="/login-illustration.png"
            alt="Carpool illustration"
            style={{ width: '100%', maxWidth: 380, maxHeight: '30vh', objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            width: '100%',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: '#ef4444',
            fontSize: 12,
            padding: '10px 14px',
            borderRadius: 12,
            textAlign: 'center',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Google button */}
        <div style={{ width: '100%' }}>
          <button
            onClick={googleLogin}
            disabled={loading}
            aria-label="Continue with Google"
            aria-busy={loading}
            className="googleBtn focusRing"
          >
            {loading ? (
              <div className="spinner" aria-hidden />
            ) : (
              <svg className="googleIcon" viewBox="0 0 48 48" aria-hidden focusable="false">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            )}

            <span className="btnText" style={{ verticalAlign: 'middle' }}>
              {loading ? 'Signing in...' : 'Continue with Google'}
            </span>
          </button>
        </div>

        {/* Security + Terms */}
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 6 }}>
          🔒 Secure · Simple · Reliable
        </div>
        <div style={{ textAlign: 'center', color: '#cbd5e1', fontSize: 11 }}>
          By continuing you agree to our{' '}
          <a href="/terms" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>Terms & Privacy Policy</a>
        </div>

        {/* Hidden email login */}
        {showEmail && (
          <div style={{ width: '100%', marginTop: 10, padding: 14, background: '#f8faff', borderRadius: 14, border: '1px solid #e0e7ff', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginBottom: 10 }}>Admin Login</div>
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              aria-label="Email"
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #e0e7ff', fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              aria-label="Password"
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #e0e7ff', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
            />
            <button
              onClick={emailLogin}
              disabled={loading}
              aria-label="Sign in with email"
              style={{ width: '100%', padding: 12, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer' }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
