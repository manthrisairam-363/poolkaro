import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const STEPS = ['role', 'personal', 'vehicle', 'upi']

const s = {
  page: { minHeight: '100vh', background: '#111', padding: 24, display: 'flex', flexDirection: 'column' },
  header: { marginBottom: 32, paddingTop: 20 },
  step: { fontSize: 12, color: '#facc15', fontWeight: 600, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1.2 },
  sub: { fontSize: 13, color: '#888', marginTop: 6 },
  card: { background: '#1a1a1a', borderRadius: 20, padding: 24, flex: 1 },
  label: { fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 5, display: 'block' },
  input: {
    width: '100%', padding: '12px 14px', background: '#222',
    border: '1.5px solid #333', borderRadius: 10,
    color: '#fff', fontSize: 14, marginBottom: 14,
  },
  roleBtn: (active) => ({
    width: '100%', padding: 16, marginBottom: 10, borderRadius: 12,
    border: `2px solid ${active ? '#facc15' : '#333'}`,
    background: active ? 'rgba(250,204,21,0.1)' : 'transparent',
    color: active ? '#facc15' : '#aaa',
    fontSize: 14, fontWeight: active ? 700 : 400,
    textAlign: 'left', cursor: 'pointer',
  }),
  roleIcon: { fontSize: 24, marginBottom: 4, display: 'block' },
  roleTitle: { fontWeight: 700, marginBottom: 2 },
  roleDesc: { fontSize: 12, color: '#888', fontWeight: 400 },
  btnPrimary: {
    width: '100%', padding: 14, background: '#facc15',
    color: '#111', border: 'none', borderRadius: 10,
    fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8,
  },
  btnSecondary: {
    width: '100%', padding: 12, background: 'transparent',
    color: '#888', border: '1px solid #333', borderRadius: 10,
    fontSize: 13, cursor: 'pointer', marginTop: 8,
  },
  infoBox: {
    background: 'rgba(250,204,21,0.1)', borderRadius: 10,
    padding: '12px 14px', marginBottom: 16, border: '1px solid rgba(250,204,21,0.3)',
  },
  infoText: { fontSize: 12, color: '#facc15', lineHeight: 1.6 },
  errMsg: { color: '#ef4444', fontSize: 12, marginBottom: 10 },
}

export default function Onboarding() {
  const { user, fetchProfile } = useAuth()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    role: '',
    full_name: '',
    phone: user?.phone?.replace('+91', '') || '',
    email: user?.email || '',
    vehicle_model: '',
    vehicle_number: '',
    upi_id: '',
    referral_code: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function finish() {
    setError('')
    setLoading(true)

    const referralCode = form.referral_code?.trim().toUpperCase()

    // Find referrer if code entered
    let referrerId = null
    if (referralCode) {
      const { data: referrer } = await supabase
        .from('profiles').select('id').eq('referral_code', referralCode).maybeSingle()
      if (referrer) referrerId = referrer.id
    }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: form.full_name,
      phone: form.phone,
      email: form.email,
      role: form.role,
      vehicle_model: form.vehicle_model || null,
      vehicle_number: form.vehicle_number?.toUpperCase() || null,
      upi_id: form.upi_id || null,
      onboarding_complete: true,
      referred_by: referrerId ? referralCode : null,
    })
    if (error) { setError(error.message); setLoading(false); return }

    // Credit new user ₹10 signup bonus ONLY if wallet is at 0 or less
    const { data: myWallet } = await supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle()
    if (myWallet && myWallet.balance <= 0) {
      await supabase.from('wallets').update({ balance: 1000 }).eq('user_id', user.id)
      await supabase.from('wallet_transactions').insert({
        user_id: user.id, amount: 1000, type: 'signup_bonus', description: '₹10 signup bonus'
      })
    }

    // Credit referrer ₹10 if valid code — uses SECURITY DEFINER to bypass RLS
    if (referrerId) {
      // Check: don't give bonus if same phone already exists (duplicate account prevention)
      let isDuplicate = false
      if (form.phone) {
        const { data: existingPhone } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', form.phone)
          .neq('id', user.id)
          .maybeSingle()
        isDuplicate = !!existingPhone
      }

      if (!isDuplicate) {
        await supabase.rpc('credit_referral_bonus', {
          p_referrer_id: referrerId,
          p_referee_name: form.full_name,
        })
        await supabase.from('notifications').insert({
          user_id: referrerId,
          type: 'booking',
          title: '🎁 Referral Bonus!',
          message: `${form.full_name} joined CarpoolKaro using your invite code. ₹10 added to your wallet!`,
          is_read: false,
        })
      }
    }

    setLoading(false)
    fetchProfile(user.id)
  }

  function next() {
    // Validation
    if (STEPS[step] === 'role' && !form.role) { setError('Please select your role'); return }
    if (STEPS[step] === 'personal' && !form.full_name) { setError('Enter your name'); return }
    setError('')

    // Skip vehicle step if rider only
    if (STEPS[step] === 'personal' && form.role === 'rider') {
      setStep(s => s + 2) // skip to upi
      return
    }
    setStep(s => s + 1)
  }

  const currentStep = STEPS[step]

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div style={s.step}>Step {step + 1} of {form.role === 'rider' ? 3 : 4}</div>
        <div style={s.title}>
          {currentStep === 'role' && 'How will you use CarpoolKaro?'}
          {currentStep === 'personal' && 'Tell us about yourself'}
          {currentStep === 'vehicle' && 'Your vehicle details'}
          {currentStep === 'upi' && 'Set up instant payments'}
        </div>
        <div style={s.sub}>
          {currentStep === 'role' && 'You can always change this later in Settings'}
          {currentStep === 'personal' && 'Your name will be shown to co-riders'}
          {currentStep === 'vehicle' && 'Riders will see this when booking your seat'}
          {currentStep === 'upi' && 'Required to send and receive money instantly'}
        </div>
      </div>

      <div style={s.card}>
        {error && <div style={s.errMsg}>{error}</div>}

        {/* STEP 1 — Role */}
        {currentStep === 'role' && (
          <>
            {[
              { value: 'driver', icon: '🚗', title: 'I have a car — I give rides', desc: 'Post your daily route and earn money from empty seats' },
              { value: 'rider', icon: '🙋', title: 'I need a ride — I book seats', desc: 'Find affordable carpools on your daily commute' },
              { value: 'both', icon: '🔄', title: 'Both — I do both', desc: 'Some days I drive, some days I need a ride' },
            ].map(opt => (
              <button key={opt.value} style={s.roleBtn(form.role === opt.value)} onClick={() => set('role', opt.value)}>
                <span style={s.roleIcon}>{opt.icon}</span>
                <div style={s.roleTitle}>{opt.title}</div>
                <div style={s.roleDesc}>{opt.desc}</div>
              </button>
            ))}
          </>
        )}

        {/* STEP 2 — Personal */}
        {currentStep === 'personal' && (
          <>
            <label style={s.label}>Full Name *</label>
            <input style={s.input} placeholder="Your full name" value={form.full_name} onChange={e => set('full_name', e.target.value)} />
            <label style={s.label}>Phone Number</label>
            <input style={s.input} placeholder="10-digit mobile number" value={form.phone} onChange={e => set('phone', e.target.value)} readOnly={!!user?.phone} />
            <label style={s.label}>Email (optional)</label>
            <input style={s.input} type="email" placeholder="your@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
            <label style={s.label}>Referral Code (optional)</label>
            <input style={{ ...s.input, textTransform: 'uppercase', letterSpacing: 3 }}
              placeholder="Friend's code — get ₹10 bonus!"
              value={form.referral_code}
              onChange={e => set('referral_code', e.target.value.toUpperCase().slice(0, 6))}
            />
          </>
        )}

        {/* STEP 3 — Vehicle (drivers only) */}
        {currentStep === 'vehicle' && (
          <>
            <label style={s.label}>Vehicle Model *</label>
            <input style={s.input} placeholder="e.g. Tata Nexon, Hyundai Creta" value={form.vehicle_model} onChange={e => set('vehicle_model', e.target.value)} />
            <label style={s.label}>Vehicle Number *</label>
            <input style={s.input} placeholder="e.g. TS09AB1234" value={form.vehicle_number} onChange={e => set('vehicle_number', e.target.value.toUpperCase())} />
          </>
        )}

        {/* STEP 4 — UPI */}
        {currentStep === 'upi' && (
          <>
            <div style={s.infoBox}>
              <div style={s.infoText}>
                💡 <strong>Why we need your UPI ID?</strong>{'\n\n'}
                CarpoolKaro processes all payments instantly.{'\n'}
                {form.role !== 'rider'
                  ? '• When a rider books your seat, ₹ goes to your UPI ID in minutes\n• No waiting, no bank transfers'
                  : '• When you book a seat, the fare goes directly to the Car Owner'}
                {'\n'}• We collect only ₹2 platform fee
              </div>
            </div>
            <label style={s.label}>Your UPI ID *</label>
            <input style={s.input} placeholder="e.g. 9876543210@upi or name@okaxis" value={form.upi_id} onChange={e => set('upi_id', e.target.value)} />
            <div style={{ fontSize: 11, color: '#666', marginTop: -8, marginBottom: 14 }}>
              Examples: 9876543210@paytm · name@okaxis · name@ybl
            </div>
          </>
        )}

        {/* Navigation */}
        {currentStep !== 'upi' ? (
          <button style={s.btnPrimary} onClick={next}>Continue →</button>
        ) : (
          <button style={s.btnPrimary} onClick={finish} disabled={loading}>
            {loading ? 'Setting up...' : '🎉 Enter CarpoolKaro'}
          </button>
        )}

        {step > 0 && (
          <button style={s.btnSecondary} onClick={() => { setStep(s => s - 1); setError('') }}>← Back</button>
        )}
      </div>
    </div>
  )
}
