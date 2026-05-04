import { useState } from 'react'
import { supabase } from '../lib/supabase'

const styles = {
  page: {
    minHeight: '100vh',
    background: '#111',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  logo: { fontSize: 48, marginBottom: 8 },
  appName: { fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-1px' },
  tagline: { fontSize: 14, color: '#888', marginBottom: 40, marginTop: 4 },
  card: {
    background: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  tabRow: { display: 'flex', gap: 8, marginBottom: 20 },
  tab: (active) => ({
    flex: 1, padding: '10px', borderRadius: 10,
    background: active ? '#facc15' : 'transparent',
    color: active ? '#111' : '#888',
    fontWeight: active ? 700 : 400,
    fontSize: 13, border: '1px solid',
    borderColor: active ? '#facc15' : '#333',
    cursor: 'pointer',
  }),
  label: { fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 6, display: 'block' },
  input: {
    width: '100%', padding: '12px 14px',
    background: '#222', border: '1.5px solid #333',
    borderRadius: 10, color: '#fff', fontSize: 14,
    marginBottom: 14,
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
  orRow: { textAlign: 'center', color: '#555', fontSize: 12, margin: '4px 0 12px' },
  btnGoogle: {
    width: '100%', padding: 14, background: '#fff',
    color: '#111', border: 'none', borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  otpNote: { fontSize: 11, color: '#666', textAlign: 'center', marginTop: 8 },
  errMsg: { color: '#ef4444', fontSize: 12, marginBottom: 10, textAlign: 'center' },
  successMsg: { color: '#22c55e', fontSize: 13, marginBottom: 10, textAlign: 'center' },
}

export default function Login() {
  const [tab, setTab] = useState('phone') // 'phone' | 'otp'
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function sendOTP() {
    setError('')
    if (!phone || phone.length < 10) { setError('Enter valid 10-digit phone number'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      phone: `+91${phone}`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setOtpSent(true)
    setSuccess(`OTP sent to +91 ${phone}`)
  }

  async function verifyOTP() {
    setError('')
    if (!otp || otp.length !== 6) { setError('Enter 6-digit OTP'); return }
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      phone: `+91${phone}`,
      token: otp,
      type: 'sms',
    })
    setLoading(false)
    if (error) { setError('Invalid OTP. Try again.'); return }
    // AuthContext will handle redirect via onAuthStateChange
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (error) setError(error.message)
  }

  return (
    <div style={styles.page}>
      <div style={styles.logo}>🚗</div>
      <div style={styles.appName}>PoolKaro</div>
      <div style={styles.tagline}>Hyderabad's IT Carpool Community</div>

      <div style={styles.card}>
        {!otpSent ? (
          <>
            <div style={styles.tabRow}>
              <button style={styles.tab(tab === 'phone')} onClick={() => setTab('phone')}>
                📱 Phone OTP
              </button>
              <button style={styles.tab(tab === 'google')} onClick={() => setTab('google')}>
                🔵 Google
              </button>
            </div>

            {error && <div style={styles.errMsg}>{error}</div>}

            {tab === 'phone' && (
              <>
                <label style={styles.label}>Phone Number</label>
                <div style={styles.phoneRow}>
                  <div style={styles.countryCode}>🇮🇳 +91</div>
                  <input
                    style={{ ...styles.input, marginBottom: 0, flex: 1 }}
                    type="tel"
                    maxLength={10}
                    placeholder="98765 43210"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <div style={{ height: 14 }} />
                <button style={styles.btnPrimary} onClick={sendOTP} disabled={loading}>
                  {loading ? 'Sending...' : 'Send OTP →'}
                </button>
                <div style={styles.orRow}>— or —</div>
                <button style={styles.btnGoogle} onClick={signInWithGoogle}>
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.7 0 6.8 5.4 2.9 13.3l7.8 6.1C12.6 13.1 17.8 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
                    <path fill="#FBBC05" d="M10.7 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6L2.4 13.3A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l8.2-6.1z"/>
                    <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.2 0-11.4-3.6-13.3-8.8l-7.8 6.1C6.8 42.6 14.7 48 24 48z"/>
                  </svg>
                  Continue with Google
                </button>
              </>
            )}

            {tab === 'google' && (
              <>
                {error && <div style={styles.errMsg}>{error}</div>}
                <button style={styles.btnGoogle} onClick={signInWithGoogle}>
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.5 30.2 0 24 0 14.7 0 6.8 5.4 2.9 13.3l7.8 6.1C12.6 13.1 17.8 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17z"/>
                    <path fill="#FBBC05" d="M10.7 28.6A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.1.7-4.6L2.4 13.3A23.9 23.9 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l8.2-6.1z"/>
                    <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2 1.4-4.6 2.2-7.7 2.2-6.2 0-11.4-3.6-13.3-8.8l-7.8 6.1C6.8 42.6 14.7 48 24 48z"/>
                  </svg>
                  Continue with Google
                </button>
              </>
            )}
          </>
        ) : (
          <>
            {success && <div style={styles.successMsg}>{success}</div>}
            {error && <div style={styles.errMsg}>{error}</div>}
            <label style={styles.label}>Enter 6-digit OTP</label>
            <input
              style={styles.input}
              type="number"
              maxLength={6}
              placeholder="• • • • • •"
              value={otp}
              onChange={e => setOtp(e.target.value.slice(0, 6))}
            />
            <button style={styles.btnPrimary} onClick={verifyOTP} disabled={loading}>
              {loading ? 'Verifying...' : '✅ Verify & Login'}
            </button>
            <button
              style={{ ...styles.btnPrimary, background: 'transparent', color: '#888', marginTop: 4 }}
              onClick={() => { setOtpSent(false); setOtp(''); setError(''); setSuccess('') }}
            >
              ← Change Number
            </button>
            <div style={styles.otpNote}>Didn't receive? Wait 30 seconds and try again</div>
          </>
        )}
      </div>

      <div style={{ color: '#555', fontSize: 11, marginTop: 20, textAlign: 'center' }}>
        By continuing you agree to our Terms & Privacy Policy
      </div>
    </div>
  )
}
