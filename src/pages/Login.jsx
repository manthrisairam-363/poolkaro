import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [tab, setTab] = useState('google')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  // Email (testing only)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showEmail, setShowEmail] = useState(false)

  async function sendOTP() {
    setError('Phone OTP coming soon. Please use Google login.')
  }

  async function verifyOTP() {}

  async function googleLogin() {
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (err) setError(err.message)
  }

  async function handleEmail() {
    setError(''); setSuccess('')
    if (!email || !password) { setError('Enter email and password'); return }
    setLoading(true)
    const { error: err } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) { setError(err.message); return }
    if (isSignUp) setSuccess('Account created! You can now log in.')
  }

  const inp = {
    width: '100%', padding: '13px 14px',
    background: '#222', border: '1.5px solid #333',
    borderRadius: 12, color: '#fff', fontSize: 15,
    fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14,
  }

  const tabActive = (v) => tab === v

  return (
    <div style={{
      minHeight: '100vh', background: '#111',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      {/* Logo */}
      <div style={{
        width: 80, height: 80, borderRadius: 24,
        background: '#facc15', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: 44, marginBottom: 12,
        boxShadow: '0 8px 32px rgba(250,204,21,0.3)',
      }}>🚗</div>

      <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-1px', marginBottom: 4 }}>
        <span style={{ color: '#facc15' }}>Pool</span>
        <span style={{ color: '#fff' }}>Karo</span>
      </div>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 36, textAlign: 'center' }}>
        Hyderabad's IT Carpool Community
      </div>

      <div style={{ background: '#1a1a1a', borderRadius: 24, padding: 24, width: '100%', maxWidth: 400 }}>

        {/* Tab buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {[['google', '🔵 Google'], ['phone', '📱 Phone']].map(([v, l]) => (
            <button key={v} onClick={() => { setTab(v); setError(''); setSuccess('') }} style={{
              flex: 1, padding: '11px', borderRadius: 12, cursor: 'pointer',
              background: tabActive(v) ? '#facc15' : 'transparent',
              color: tabActive(v) ? '#111' : '#666',
              fontWeight: tabActive(v) ? 700 : 400, fontSize: 14,
              border: `2px solid ${tabActive(v) ? '#facc15' : '#333'}`,
            }}>{l}</button>
          ))}
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13, marginBottom: 14, padding: '10px 12px', borderRadius: 10, textAlign: 'center' }}>
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', fontSize: 13, marginBottom: 14, padding: '10px 12px', borderRadius: 10, textAlign: 'center' }}>
            ✅ {success}
          </div>
        )}

        {/* PHONE TAB */}
        {tab === 'phone' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
              Phone OTP Coming Soon
            </div>
            <div style={{ color: '#666', fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
              We're setting up secure phone verification.{'
'}
              For now, please use Google login — it's faster!
            </div>
            <button onClick={() => { setTab('google'); setError('') }} style={{
              width: '100%', padding: 13, background: '#facc15',
              color: '#111', border: 'none', borderRadius: 12,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
            }}>
              🔵 Use Google Login Instead
            </button>
          </div>
        )}

        {/* GOOGLE TAB */}
        {tab === 'google' && (
          <>
            <div style={{ color: '#888', fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 1.6 }}>
              Sign in with your Google account in one tap. No password needed.
            </div>
            <button onClick={googleLogin} style={{
              width: '100%', padding: 15, background: '#fff',
              color: '#111', border: 'none', borderRadius: 12,
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            }}>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.7 0 6.8 5.4 2.9 13.3l7.8 6.1C12.6 13.1 17.8 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
                <path fill="#FBBC05" d="M10.7 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6L2.4 13.3A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l8.2-6.1z"/>
                <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.2 0-11.4-3.6-13.3-8.8l-7.8 6.1C6.8 42.6 14.7 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
            <div style={{ fontSize: 11, color: '#555', textAlign: 'center', marginTop: 12 }}>
              Works with any Gmail account
            </div>
          </>
        )}

        {/* Email — hidden testing option */}
        <div style={{ marginTop: 24, borderTop: '1px solid #222', paddingTop: 16 }}>
          <button
            onClick={() => setShowEmail(!showEmail)}
            style={{ background: 'none', border: 'none', color: '#444', fontSize: 11, cursor: 'pointer', width: '100%', textAlign: 'center' }}>
            {showEmail ? '▲ Hide' : '···'} Other options
          </button>

          {showEmail && (
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6, display: 'block' }}>Email</label>
              <input style={inp} type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
              <label style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 6, display: 'block' }}>Password</label>
              <input style={inp} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEmail()} />
              <button onClick={handleEmail} disabled={loading} style={{
                width: '100%', padding: 12, background: '#222', color: '#fff',
                border: '1px solid #333', borderRadius: 10, fontSize: 14,
                fontWeight: 600, cursor: 'pointer', marginBottom: 8,
              }}>
                {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Login with Email'}
              </button>
              <button onClick={() => setIsSignUp(!isSignUp)} style={{
                background: 'none', border: 'none', color: '#666',
                fontSize: 11, cursor: 'pointer', width: '100%', textAlign: 'center',
              }}>
                {isSignUp ? 'Already have account? Login' : "No account? Sign Up"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={{ color: '#333', fontSize: 11, marginTop: 20, textAlign: 'center', lineHeight: 1.8 }}>
        By continuing you agree to our Terms & Privacy Policy
      </div>
    </div>
  )
}
