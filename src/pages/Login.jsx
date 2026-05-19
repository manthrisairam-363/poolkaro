import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'

// Init Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
}
const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
const firebaseAuth = getAuth(firebaseApp)

export default function Login() {
  const [tab, setTab] = useState('google') // google | phone
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Phone login state
  const [phone, setPhone] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [confirmResult, setConfirmResult] = useState(null)
  const recaptchaRef = useRef(null)

  // Hidden admin login
  const [taps, setTaps] = useState(0)
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    // Setup invisible reCAPTCHA
    if (tab === 'phone' && !recaptchaRef.current) {
      try {
        recaptchaRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
          size: 'invisible',
        })
      } catch (e) { console.error('Recaptcha init:', e) }
    }
  }, [tab])

  async function googleLogin() {
    setError('')
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (err) setError(err.message)
  }

  async function sendOTP() {
    setError('')
    const digits = phone.replace(/\D/g, '').slice(-10)
    if (digits.length !== 10) { setError('Enter a valid 10-digit phone number'); return }

    setLoading(true)
    try {
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', { size: 'invisible' })
      }
      const result = await signInWithPhoneNumber(firebaseAuth, `+91${digits}`, recaptchaRef.current)
      setConfirmResult(result)
      setOtpSent(true)
    } catch (err) {
      console.error('OTP error:', err)
      setError('Failed to send OTP. Try again.')
      recaptchaRef.current = null
    }
    setLoading(false)
  }

  async function verifyOTP() {
    setError('')
    if (otp.length !== 6) { setError('Enter 6-digit OTP'); return }
    setLoading(true)
    try {
      // Verify OTP with Firebase
      await confirmResult.confirm(otp)

      // Call our edge function to get Supabase session
      const digits = phone.replace(/\D/g, '').slice(-10)
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/phone-auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ phone: digits }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Sign into Supabase with magic link token
      const { error: authErr } = await supabase.auth.verifyOtp({
        token_hash: data.token_hash,
        type: 'email',
      })
      if (authErr) throw new Error(authErr.message)

    } catch (err) {
      console.error('Verify error:', err)
      setError('Invalid OTP or verification failed. Try again.')
    }
    setLoading(false)
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

  const inp = {
    width: '100%', padding: '13px 14px',
    background: '#222', border: '1.5px solid #333',
    borderRadius: 12, color: '#fff', fontSize: 15,
    fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 14,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>

      {/* Logo */}
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

        {/* Tab switcher */}
        <div style={{ display: 'flex', background: '#111', borderRadius: 12, padding: 4, marginBottom: 20 }}>
          {[['google','🔵 Google'],['phone','📱 Phone']].map(([v,l]) => (
            <button key={v} onClick={() => { setTab(v); setError(''); setOtpSent(false); setOtp('') }} style={{
              flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: tab === v ? '#facc15' : 'transparent',
              color: tab === v ? '#111' : '#555',
            }}>{l}</button>
          ))}
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 13, marginBottom: 14, padding: '10px 12px', borderRadius: 10, textAlign: 'center' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Google tab */}
        {tab === 'google' && (
          <>
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
          </>
        )}

        {/* Phone tab */}
        {tab === 'phone' && (
          <>
            {!otpSent ? (
              <>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                  Enter your mobile number to receive OTP
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <div style={{ background: '#222', border: '1.5px solid #333', borderRadius: 12, padding: '13px 14px', color: '#888', fontSize: 15, flexShrink: 0 }}>
                    +91
                  </div>
                  <input
                    style={{ ...inp, marginBottom: 0, flex: 1 }}
                    type="tel" placeholder="9999999999"
                    value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0,10))}
                    onKeyDown={e => e.key === 'Enter' && sendOTP()}
                    maxLength={10}
                  />
                </div>
                <button onClick={sendOTP} disabled={loading || phone.length < 10} style={{ width: '100%', padding: 15, background: phone.length === 10 ? '#facc15' : '#333', color: phone.length === 10 ? '#111' : '#666', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  {loading ? 'Sending...' : 'Send OTP 📱'}
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 12, fontWeight: 600 }}>
                  ✅ OTP sent to +91 {phone}
                </div>
                <input
                  style={{ ...inp, textAlign: 'center', fontSize: 28, letterSpacing: 14, fontWeight: 700 }}
                  type="number" placeholder="000000"
                  value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
                  onKeyDown={e => e.key === 'Enter' && verifyOTP()}
                />
                <button onClick={verifyOTP} disabled={loading || otp.length !== 6} style={{ width: '100%', padding: 15, background: otp.length === 6 ? '#facc15' : '#333', color: otp.length === 6 ? '#111' : '#666', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
                  {loading ? 'Verifying...' : 'Verify OTP ✅'}
                </button>
                <button onClick={() => { setOtpSent(false); setOtp(''); setError(''); recaptchaRef.current = null }} style={{ width: '100%', padding: 10, background: 'none', border: '1px solid #333', borderRadius: 10, color: '#888', fontSize: 13, cursor: 'pointer' }}>
                  ← Change Number
                </button>
              </>
            )}
          </>
        )}

        {/* Hidden admin login */}
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

      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container"></div>

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
