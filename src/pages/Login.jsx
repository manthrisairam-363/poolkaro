import { useState } from 'react'
import { supabase } from '../lib/supabase'

const s = {
  page: {
    minHeight: '100vh', background: '#111',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: '24px',
  },
  logo: { fontSize: 48, marginBottom: 8 },
  appName: { fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-1px' },
  tagline: { fontSize: 14, color: '#888', marginBottom: 40, marginTop: 4 },
  card: { background: '#1a1a1a', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
  tabRow: { display: 'flex', gap: 6, marginBottom: 20 },
  tab: (active) => ({
    flex: 1, padding: '9px 4px', borderRadius: 10,
    background: active ? '#facc15' : 'transparent',
    color: active ? '#111' : '#888',
    fontWeight: active ? 700 : 400,
    fontSize: 12, border: '1px solid',
    borderColor: active ? '#facc15' : '#333', cursor: 'pointer',
  }),
  label: { fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 6, display: 'block' },
  input: {
    width: '100%', padding: '12px 14px',
    background: '#222', border: '1.5px solid #333',
    borderRadius: 10, color: '#fff', fontSize: 14, marginBottom: 14,
  },
  phoneRow: { display: 'flex', gap: 8, marginBottom: 14 },
  countryCode: {
    padding: '12px 10px', background: '#222',
    border: '1.5px solid #333', borderRadius: 10,
    color: '#fff', fontSize: 14, minWidth: 70,
  },
  btnPrimary: {
    width: '100%', padding: 14, background: '#facc15',
    color: '#111', border: 'none', borderRadius: 10,
    fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 12,
  },
  errMsg: { color: '#ef4444', fontSize: 12, marginBottom: 10, textAlign: 'center' },
  successMsg: { color: '#22c55e', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  note: { fontSize: 11, color: '#555', textAlign: 'center', marginTop: 8 },
}

export default function Login() {
  const [tab, setTab] = useState('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Email state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  // Phone state
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)

  async function handleEmail() {
    setError(''); setSuccess('')
    if (!email || !password) { setError('Enter email and password'); return }
    setLoading(true)
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    if (isSignUp) setSuccess('Account created! You can now login.')
  }

  async function sendOTP() {
    setError('')
    if (!phone || phone.length < 10) { setError('Enter valid 10-digit number'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ phone: `+91${phone}` })
    setLoading(false)
    if (error) { setError(error.message); return }
    setOtpSent(true)
    setSuccess(`OTP sent to +91 ${phone}`)
  }

  async function verifyOTP() {
    setError('')
    if (!otp || otp.length !== 6) { setError('Enter 6-digit OTP'); return }
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ phone: `+91${phone}`, token: otp, type: 'sms' })
    setLoading(false)
    if (error) { setError('Invalid OTP. Try again.'); return }
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) setError(error.message)
  }

  return (
    <div style={s.page}>
      <div style={s.logo}>🚗</div>
      <div style={s.appName}>PoolKaro</div>
      <div style={s.tagline}>Hyderabad's IT Carpool Community</div>

      <div style={s.card}>
        <div style={s.tabRow}>
          {[['email','📧 Email'],['phone','📱 Phone'],['google','🔵 Google']].map(([v,l]) => (
            <button key={v} style={s.tab(tab === v)}
              onClick={() => { setTab(v); setError(''); setSuccess('') }}>
              {l}
            </button>
          ))}
        </div>

        {error && <div style={s.errMsg}>⚠️ {error}</div>}
        {success && <div style={s.successMsg}>✅ {success}</div>}

        {/* EMAIL TAB */}
        {tab === 'email' && (
          <>
            <label style={s.label}>Email Address</label>
            <input style={s.input} type="email" placeholder="you@company.com"
              value={email} onChange={e => setEmail(e.target.value)} />

            <label style={s.label}>Password</label>
            <input style={s.input} type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleEmail()} />

            <button style={s.btnPrimary} onClick={handleEmail} disabled={loading}>
              {loading ? 'Please wait...' : isSignUp ? '🚀 Create Account' : '→ Login'}
            </button>

            <button onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess('') }}
              style={{ background: 'none', border: 'none', color: '#facc15', fontSize: 12, cursor: 'pointer', width: '100%', textAlign: 'center', padding: '4px' }}>
              {isSignUp ? 'Already have account? Login' : "No account? Sign Up"}
            </button>

            {/* Test credentials helper - remove before production */}
            <div style={{ marginTop: 16, background: '#222', borderRadius: 10, padding: '10px 12px', border: '1px dashed #333' }}>
              <div style={{ fontSize: 11, color: '#facc15', fontWeight: 600, marginBottom: 4 }}>🧪 Test Login</div>
              <div style={{ fontSize: 11, color: '#888', lineHeight: 1.9 }}>
                Email: <span style={{ color: '#ccc', userSelect: 'all' }}>test@poolkaro.app</span><br />
                Password: <span style={{ color: '#ccc', userSelect: 'all' }}>Test@1234</span>
              </div>
            </div>
          </>
        )}

        {/* PHONE TAB */}
        {tab === 'phone' && !otpSent && (
          <>
            <label style={s.label}>Phone Number</label>
            <div style={s.phoneRow}>
              <div style={s.countryCode}>🇮🇳 +91</div>
              <input style={{ ...s.input, marginBottom: 0, flex: 1 }}
                type="tel" maxLength={10} placeholder="98765 43210"
                value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div style={{ height: 14 }} />
            <button style={s.btnPrimary} onClick={sendOTP} disabled={loading}>
              {loading ? 'Sending...' : 'Send OTP →'}
            </button>
            <div style={s.note}>⚙️ Needs SMS provider setup — use Email tab for now</div>
          </>
        )}

        {tab === 'phone' && otpSent && (
          <>
            <label style={s.label}>Enter 6-digit OTP</label>
            <input style={s.input} type="number" placeholder="• • • • • •"
              value={otp} onChange={e => setOtp(e.target.value.slice(0, 6))} />
            <button style={s.btnPrimary} onClick={verifyOTP} disabled={loading}>
              {loading ? 'Verifying...' : '✅ Verify OTP'}
            </button>
            <button onClick={() => { setOtpSent(false); setOtp(''); setError('') }}
              style={{ ...s.btnPrimary, background: 'transparent', color: '#888' }}>
              ← Change Number
            </button>
          </>
        )}

        {/* GOOGLE TAB */}
        {tab === 'google' && (
          <>
            <button style={{
              width: '100%', padding: 14, background: '#fff',
              color: '#111', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }} onClick={signInWithGoogle}>
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.7 0 6.8 5.4 2.9 13.3l7.8 6.1C12.6 13.1 17.8 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
                <path fill="#FBBC05" d="M10.7 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6L2.4 13.3A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l8.2-6.1z"/>
                <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.2 0-11.4-3.6-13.3-8.8l-7.8 6.1C6.8 42.6 14.7 48 24 48z"/>
              </svg>
              Continue with Google
            </button>
            <div style={s.note}>⚙️ Needs Google OAuth setup — use Email tab for now</div>
          </>
        )}
      </div>

      <div style={{ color: '#555', fontSize: 11, marginTop: 20, textAlign: 'center' }}>
        By continuing you agree to our Terms & Privacy Policy
      </div>
    </div>
  )
}
