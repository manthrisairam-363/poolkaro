import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [tab, setTab] = useState('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)

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

  async function sendOTP() {
    setError('')
    if (!phone || phone.length < 10) { setError('Enter valid 10-digit number'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithOtp({ phone: `+91${phone}` })
    setLoading(false)
    if (err) { setError(err.message); return }
    setOtpSent(true)
    setSuccess(`OTP sent to +91 ${phone}`)
  }

  async function verifyOTP() {
    setError('')
    if (!otp || otp.length !== 6) { setError('Enter 6-digit OTP'); return }
    setLoading(true)
    const { error: err } = await supabase.auth.verifyOtp({ phone: `+91${phone}`, token: otp, type: 'sms' })
    setLoading(false)
    if (err) setError('Invalid OTP. Try again.')
  }

  async function googleLogin() {
    const { error: err } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (err) setError(err.message)
  }

  const tabBtn = (v, l) => (
    <button key={v} onClick={() => { setTab(v); setError(''); setSuccess('') }} style={{
      flex: 1, padding: '10px 4px', borderRadius: 10, cursor: 'pointer',
      background: tab === v ? '#facc15' : 'transparent',
      color: tab === v ? '#111' : '#888',
      fontWeight: tab === v ? 700 : 400, fontSize: 12,
      border: `1px solid ${tab === v ? '#facc15' : '#333'}`,
    }}>{l}</button>
  )

  const inp = { width: '100%', padding: '12px 14px', background: '#222', border: '1.5px solid #333', borderRadius: 10, color: '#fff', fontSize: 14, marginBottom: 14, fontFamily: 'inherit', boxSizing: 'border-box' }

  return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Logo */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ width: 72, height: 72, borderRadius: 20, background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, marginBottom: 12 }}>🚗</div>
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-1px', marginBottom: 4 }}>
        <span style={{ color: '#facc15' }}>Pool</span><span style={{ color: '#fff' }}>Karo</span>
      </div>
      <div style={{ fontSize: 13, color: '#555', marginBottom: 32 }}>Hyderabad IT Carpool Community</div>

      <div style={{ background: '#1a1a1a', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {tabBtn('email', '📧 Email')}
          {tabBtn('phone', '📱 Phone')}
          {tabBtn('google', '🔵 Google')}
        </div>

        {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>⚠️ {error}</div>}
        {success && <div style={{ color: '#22c55e', fontSize: 13, marginBottom: 10, textAlign: 'center' }}>✅ {success}</div>}

        {tab === 'email' && (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 6, display: 'block' }}>Email Address</label>
            <input style={inp} type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} />
            <label style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 6, display: 'block' }}>Password</label>
            <input style={inp} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleEmail()} />
            <button onClick={handleEmail} disabled={loading} style={{ width: '100%', padding: 14, background: '#facc15', color: '#111', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
              {loading ? 'Please wait...' : isSignUp ? '🚀 Create Account' : '→ Login'}
            </button>
            <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess('') }}
              style={{ background: 'none', border: 'none', color: '#facc15', fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'center', padding: 4 }}>
              {isSignUp ? 'Already have account? Login' : "No account? Sign Up"}
            </button>
          </>
        )}

        {tab === 'phone' && !otpSent && (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 6, display: 'block' }}>Phone Number</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <div style={{ padding: '12px 10px', background: '#222', border: '1.5px solid #333', borderRadius: 10, color: '#fff', fontSize: 14 }}>🇮🇳 +91</div>
              <input style={{ ...inp, marginBottom: 0, flex: 1 }} type="tel" maxLength={10} placeholder="98765 43210" value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,''))} />
            </div>
            <button onClick={sendOTP} disabled={loading} style={{ width: '100%', padding: 14, background: '#facc15', color: '#111', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {loading ? 'Sending...' : 'Send OTP →'}
            </button>
          </>
        )}

        {tab === 'phone' && otpSent && (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 6, display: 'block' }}>Enter 6-digit OTP</label>
            <input style={inp} type="number" maxLength={6} placeholder="• • • • • •" value={otp} onChange={e => setOtp(e.target.value.slice(0,6))} />
            <button onClick={verifyOTP} disabled={loading} style={{ width: '100%', padding: 14, background: '#facc15', color: '#111', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 8 }}>
              {loading ? 'Verifying...' : '✅ Verify OTP'}
            </button>
            <button onClick={() => { setOtpSent(false); setOtp(''); setError('') }}
              style={{ width: '100%', padding: 10, background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>
              ← Change Number
            </button>
          </>
        )}

        {tab === 'google' && (
          <button onClick={googleLogin} style={{ width: '100%', padding: 14, background: '#fff', color: '#111', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.7 0 6.8 5.4 2.9 13.3l7.8 6.1C12.6 13.1 17.8 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
              <path fill="#FBBC05" d="M10.7 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6L2.4 13.3A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l8.2-6.1z"/>
              <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.2 0-11.4-3.6-13.3-8.8l-7.8 6.1C6.8 42.6 14.7 48 24 48z"/>
            </svg>
            Continue with Google
          </button>
        )}
      </div>
      <div style={{ color: '#333', fontSize: 11, marginTop: 20, textAlign: 'center' }}>By continuing you agree to our Terms & Privacy Policy</div>
    </div>
  )
}
