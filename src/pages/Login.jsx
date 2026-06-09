import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { firebaseAuth } from '../lib/firebase'
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [taps, setTaps] = useState(0)
  const [showEmail, setShowEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Phone auth states
  const [showPhone, setShowPhone] = useState(false)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('phone') // 'phone' | 'otp'
  const [confirmation, setConfirmation] = useState(null)
  const [resendTimer, setResendTimer] = useState(0)
  const recaptchaRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  function startResendTimer() {
    setResendTimer(30)
    timerRef.current = setInterval(() => {
      setResendTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0 } return t - 1 })
    }, 1000)
  }

  const recaptchaVerifierRef = useRef(null)

  function getRecaptchaVerifier() {
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(
        firebaseAuth,
        'recaptcha-container',
        { size: 'invisible' }
      )
    }
    return recaptchaVerifierRef.current
  }

  async function sendOTP() {
    setError('')
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 10) { setError('Enter a valid 10-digit phone number'); return }
    const phoneWithCode = '+91' + cleaned.slice(-10)

    setLoading(true)
    try {
      const verifier = getRecaptchaVerifier()
      const result = await signInWithPhoneNumber(firebaseAuth, phoneWithCode, verifier)
      setConfirmation(result)
      setStep('otp')
      startResendTimer()
    } catch (err) {
      console.error('OTP send error:', err)
      // Clear verifier on error so it can be recreated
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear()
        recaptchaVerifierRef.current = null
      }
      if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.')
      } else if (err.code === 'auth/invalid-phone-number') {
        setError('Invalid phone number. Please check and try again.')
      } else {
        setError(err.message || 'Failed to send OTP. Please try again.')
      }
    }
    setLoading(false)
  }

  async function verifyOTP() {
    setError('')
    if (otp.length !== 6) { setError('Enter the 6-digit OTP'); return }
    setLoading(true)
    try {
      // Verify OTP with Firebase
      const result = await confirmation.confirm(otp)
      const firebaseUser = result.user
      const phoneNumber = firebaseUser.phoneNumber // e.g. +919876543210
      const idToken = await firebaseUser.getIdToken()

      // Call Supabase Edge Function to get/create Supabase session
      const { data, error: fnError } = await supabase.functions.invoke('phone-auth', {
        body: { phone: phoneNumber, firebase_token: idToken }
      })

      if (fnError || !data?.access_token) {
        throw new Error(fnError?.message || 'Authentication failed. Please try again.')
      }

      // Set Supabase session
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })

      if (sessionError) throw sessionError

    } catch (err) {
      console.error('OTP verify error:', err)
      if (err.code === 'auth/invalid-verification-code') {
        setError('Incorrect OTP. Please check and try again.')
      } else {
        setError(err.message || 'Verification failed. Please try again.')
      }
      setLoading(false)
    }
  }

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
      height: '100dvh', width: '100%', overflow: 'hidden',
      background: 'linear-gradient(180deg, #eef2ff 0%, #f0f4ff 50%, #fff 100%)',
      display: 'flex', flexDirection: 'column',
      paddingTop: 'env(safe-area-inset-top)',
    }}>
      {/* Invisible recaptcha container */}
      <div ref={recaptchaRef} id="recaptcha-container" />

      {/* Top section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={handleLogoTap} style={{ cursor: 'pointer', marginBottom: 12 }}>
          <img src="/logo.png" alt="CarpoolKaro" style={{ width: '85%', maxWidth: 300, height: 'auto', display: 'block', margin: '0 auto' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'clamp(20px, 4.5vw, 26px)', fontWeight: 900, color: '#0f172a', lineHeight: 1.3 }}>
            Good Journeys ,<br /><span style={{ color: '#f59e0b' }}>Start Together</span>
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 6, fontWeight: 500 }}>
            Share rides · Save money · Meet colleagues
          </div>
        </div>
      </div>

      {/* Illustration */}
      <div style={{ flex: 1 }}>
        <img src="/login-illustration.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      {/* Bottom section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 24px' }}>
        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 12, marginBottom: 12, padding: '10px 14px', borderRadius: 12, textAlign: 'center' }}>
            ⚠️ {error}
          </div>
        )}

        {/* Phone login flow */}
        {showPhone ? (
          <div>
            {step === 'phone' ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 12, textAlign: 'center' }}>
                  📱 Enter your phone number
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 12, padding: '13px 12px', fontSize: 14, fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>
                    🇮🇳 +91
                  </div>
                  <input
                    type="tel" placeholder="98765 43210" value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    style={{ flex: 1, padding: '13px 14px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 16, fontWeight: 600, outline: 'none', letterSpacing: 1 }}
                    maxLength={10} autoFocus
                  />
                </div>
                <button onClick={sendOTP} disabled={loading || phone.length < 10}
                  style={{ width: '100%', padding: '14px', background: phone.length === 10 ? 'linear-gradient(135deg,#facc15,#f59e0b)' : '#e2e8f0', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 800, color: phone.length === 10 ? '#111' : '#94a3b8', cursor: phone.length === 10 ? 'pointer' : 'default', marginBottom: 10 }}>
                  {loading ? 'Sending OTP...' : 'Send OTP →'}
                </button>
                <button onClick={() => { setShowPhone(false); setError('') }}
                  style={{ width: '100%', padding: '12px', background: 'none', border: 'none', fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>
                  ← Back to Google login
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4, textAlign: 'center' }}>
                  🔐 Enter OTP
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 14 }}>
                  Sent to +91 {phone}
                </div>
                <input
                  type="tel" placeholder="• • • • • •" value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ width: '100%', padding: '16px', borderRadius: 14, border: '2px solid #e2e8f0', fontSize: 24, fontWeight: 800, textAlign: 'center', letterSpacing: 8, outline: 'none', marginBottom: 12 }}
                  maxLength={6} autoFocus
                />
                <button onClick={verifyOTP} disabled={loading || otp.length !== 6}
                  style={{ width: '100%', padding: '14px', background: otp.length === 6 ? 'linear-gradient(135deg,#facc15,#f59e0b)' : '#e2e8f0', border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 800, color: otp.length === 6 ? '#111' : '#94a3b8', cursor: otp.length === 6 ? 'pointer' : 'default', marginBottom: 10 }}>
                  {loading ? 'Verifying...' : 'Verify OTP ✓'}
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button onClick={() => { setStep('phone'); setOtp(''); setError('') }}
                    style={{ background: 'none', border: 'none', fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>
                    ← Change number
                  </button>
                  {resendTimer > 0 ? (
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>Resend in {resendTimer}s</span>
                  ) : (
                    <button onClick={sendOTP} style={{ background: 'none', border: 'none', fontSize: 12, color: '#6366f1', cursor: 'pointer', fontWeight: 600 }}>
                      Resend OTP
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Google login */}
            <button onClick={googleLogin} disabled={loading}
              style={{ width: '100%', padding: '14px 18px', background: 'linear-gradient(135deg,#facc15 0%,#f59e0b 100%)', border: 'none', borderRadius: 20, fontSize: 16, fontWeight: 800, color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: loading ? 'default' : 'pointer', boxShadow: '0 6px 18px rgba(245,158,11,0.35)', marginBottom: 10 }}>
              <svg width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.35-8.16 2.35-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {loading ? 'Signing in...' : 'Continue with Google'}
            </button>

            {/* Phone login button */}
            <button onClick={() => { setShowPhone(true); setError('') }}
              style={{ width: '100%', padding: '14px 18px', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 20, fontSize: 15, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', marginBottom: 10 }}>
              📱 Continue with Phone
            </button>

            <div style={{ textAlign: 'center', marginTop: 4, color: '#94a3b8', fontSize: 12, fontWeight: 500 }}>
              🔒 Secure · Simple · Reliable
            </div>
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#cbd5e1' }}>
              By continuing you agree to our{' '}
              <a href="/terms" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>Terms & Privacy Policy</a>
            </div>
          </>
        )}

        {/* Admin login (7 taps) */}
        {showEmail && (
          <div style={{ marginTop: 14, padding: 16, background: '#f8faff', borderRadius: 14, border: '1px solid #e0e7ff' }}>
            <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, marginBottom: 10 }}>Admin Login</div>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #e0e7ff', fontSize: 13, marginBottom: 8 }} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1px solid #e0e7ff', fontSize: 13, marginBottom: 10 }} />
            <button onClick={emailLogin} disabled={loading}
              style={{ width: '100%', padding: 12, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700 }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
