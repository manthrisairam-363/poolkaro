import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'
import { StarDisplay } from '../components/RatingModal'
import { getCompanyFromEmail, isCompanyEmail } from '../lib/companyDomains'
import { CITIES } from '../lib/cities'

export default function Profile() {
  const { user, profile, signOut, fetchProfile } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [workEmail, setWorkEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [verifySuccess, setVerifySuccess] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    vehicle_model: profile?.vehicle_model || '',
    vehicle_number: profile?.vehicle_number || '',
    upi_id: profile?.upi_id || '',
    role: profile?.role || 'both',
    city: profile?.city || 'hyderabad',
    emergency_contact_name: profile?.emergency_contact_name || '',  // ADDED this after white blank screen
    emergency_contact_phone: profile?.emergency_contact_phone || '', // ADDED this after white blank screen
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const initials = profile?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  async function saveProfile() {
    setLoading(true)
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name,
      phone: form.phone,
      vehicle_model: form.vehicle_model,
      vehicle_number: form.vehicle_number?.toUpperCase(),
      upi_id: form.upi_id,
      role: form.role,
      city: form.city,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
    }).eq('id', user.id)
    setLoading(false)
    if (!error) {
      fetchProfile(user.id)
      setEditing(false)
      setSuccess('Profile updated! ✅')
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  async function sendWorkEmailOTP() {
    setVerifyError(''); setVerifying(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-work-email`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'send_otp', work_email: workEmail }),
      }
    )
    const data = await res.json()
    setVerifying(false)
    if (data.error) { setVerifyError(data.error); return }
    setOtpSent(true)
    setVerifySuccess(`OTP sent to ${workEmail}`)
  }

  async function verifyWorkOTP() {
    setVerifyError(''); setVerifying(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-work-email`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'verify_otp', otp: otpCode }),
      }
    )
    const data = await res.json()
    setVerifying(false)
    if (data.error) { setVerifyError(data.error); return }
    setVerifySuccess(data.message)
    setOtpSent(false)
    setOtpCode('')
    fetchProfile(user.id)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  const inp = {
    width: '100%', padding: '11px 14px',
    border: '1.5px solid #e5e7eb', borderRadius: 10,
    fontSize: 14, background: '#fafafa', marginBottom: 12,
    fontFamily: 'inherit',
  }
  const label = { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4, display: 'block' }

  return (
    <div style={{ paddingBottom: 90, background: '#f5f6fa', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ background: '#111', padding: '20px 16px 30px' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 20 }}>My Profile</div>
        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#facc15', color: '#111',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 24,
          }}>{initials}</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
              {profile?.full_name || 'Your Name'}
              {profile?.is_verified && <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>✓ VERIFIED</span>}
            </div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{user?.email}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <span style={{
                background: profile?.role === 'driver' ? '#dbeafe' : profile?.role === 'rider' ? '#fce7f3' : '#f0fdf4',
                color: profile?.role === 'driver' ? '#1d4ed8' : profile?.role === 'rider' ? '#be185d' : '#16a34a',
                borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
              }}>
                {profile?.role === 'driver' ? '🚗 Car Owner' : profile?.role === 'rider' ? '🙋 Co-rider' : '🔄 Car Owner & Co-rider'}
              </span>
              {(() => {
                const emailForCompany = (profile?.work_email_verified && profile?.work_email)
                  ? profile.work_email : user?.email
                const co = getCompanyFromEmail(emailForCompany)
                if (co) return (
                  <span style={{ background: '#facc15', color: '#111', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 800 }}>
                    🏢 {co.name}
                  </span>
                )
                if (profile?.work_email_verified) return (
                  <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>
                    ✓ Work Verified
                  </span>
                )
                return null
              })()}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {success && (
          <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
            {success}
          </div>
        )}

        {/* Profile card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Personal Details</div>
            <button onClick={() => setEditing(!editing)} style={{
              background: editing ? '#f3f4f6' : '#111', color: editing ? '#666' : '#fff',
              border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600,
            }}>
              {editing ? 'Cancel' : '✏️ Edit'}
            </button>
          </div>

          {!editing ? (
            // View mode
            <div style={{ display: 'grid', gap: 10 }}>
              {[
                ['✏️ Name', profile?.full_name],
                ['📱 Phone', profile?.phone],
                ['📧 Email', user?.email],
                ['🚘 Vehicle', profile?.vehicle_model ? `${profile.vehicle_model} · ${profile.vehicle_number}` : 'Not set'],
                ['💳 UPI ID', profile?.upi_id || 'Not set'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <span style={{ fontSize: 13, color: '#888' }}>{k}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: v?.includes('Not set') ? '#ccc' : '#111' }}>{v || '—'}</span>
                </div>
              ))}
            </div>
          ) : (
            // Edit mode
            <div>
              <label style={label}>Full Name</label>
              <input style={inp} value={form.full_name} onChange={e => set('full_name', e.target.value)} />

              <label style={label}>Phone</label>
              <input style={inp} value={form.phone} onChange={e => set('phone', e.target.value)} />

              <label style={label}>Role</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[['driver','🚗 Car Owner'],['rider','🙋 Co-rider'],['both','🔄 Both']].map(([v,l]) => (
                  <button key={v} onClick={() => set('role', v)} style={{
                    flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 12,
                    border: `2px solid ${form.role === v ? '#111' : '#e5e7eb'}`,
                    background: form.role === v ? '#111' : '#fff',
                    color: form.role === v ? '#fff' : '#666', fontWeight: form.role === v ? 700 : 400,
                  }}>{l}</button>
                ))}
              </div>

              <label style={label}>Vehicle Model</label>
              <input style={inp} placeholder="e.g. Tata Nexon, Hyundai Creta" value={form.vehicle_model} onChange={e => set('vehicle_model', e.target.value)} />

              <label style={label}>Vehicle Number</label>
              <input style={inp} placeholder="e.g. TS09AB1234" value={form.vehicle_number} onChange={e => set('vehicle_number', e.target.value.toUpperCase())} />

              <label style={label}>UPI ID</label>
              <input style={inp} placeholder="9876543210@upi" value={form.upi_id} onChange={e => set('upi_id', e.target.value)} />

              <label style={label}>Emergency Contact Name</label>
              <input style={inp} placeholder="e.g. Mom, Wife, Friend" value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} />

              <label style={label}>Emergency Contact Phone</label>
              <input style={inp} placeholder="10-digit mobile number" type="tel" value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value.replace(/\D/g,'').slice(0,10))} />

              <label style={label}>Your City</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                {Object.entries(CITIES).map(([key, city]) => (
                  <button key={key} onClick={() => set('city', key)}
                    disabled={!city.active}
                    style={{
                      padding: '10px 8px', borderRadius: 10,
                      cursor: city.active ? 'pointer' : 'default',
                      border: `2px solid ${form.city === key ? '#111' : '#e5e7eb'}`,
                      background: form.city === key ? '#111' : '#fff',
                      color: form.city === key ? '#fff' : city.active ? '#333' : '#ccc',
                      fontWeight: form.city === key ? 700 : 400,
                      fontSize: 12, textAlign: 'left',
                      opacity: city.active ? 1 : 0.5,
                    }}>
                    {city.icon} {city.name}
                    {!city.active && <span style={{ fontSize: 9, display: 'block', color: '#bbb' }}>Coming soon</span>}
                  </button>
                ))}
              </div>

              <button onClick={saveProfile} disabled={loading} style={{
                width: '100%', padding: 13, background: '#111', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
              }}>
                {loading ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          )}
        </div>

        {/* Rich Stats Card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>My Impact 🌱</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {[
              { icon: '🚗', val: profile?.total_rides_given || 0, label: 'Rides Given' },
              { icon: '🙋', val: profile?.total_rides_taken || 0, label: 'Rides Taken' },
              { icon: '💰', val: `₹${((profile?.total_rides_taken || 0) * 150 * 0.6).toFixed(0)}`, label: 'Est. Saved' },
              { icon: '🌿', val: `${((profile?.total_rides_taken || 0) * 2.1).toFixed(1)}kg`, label: 'CO₂ Avoided' },
            ].map(item => (
              <div key={item.label} style={{ background: '#f8f9fa', borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 22 }}>{item.icon}</div>
                <div style={{ fontWeight: 800, fontSize: 18, marginTop: 4 }}>{item.val}</div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
          {profile?.avg_rating > 0 && (
            <div style={{ background: '#fffbeb', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#888' }}>⭐ Community Rating</span>
              <span style={{ fontWeight: 800, fontSize: 16, color: '#f59e0b' }}>{Number(profile.avg_rating).toFixed(1)} / 5.0</span>
            </div>
          )}
        </div>

        {/* Referral Card */}
        <div style={{ background: '#f0fdf4', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12, border: '1px solid #bbf7d0' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🎁 Invite & Earn</div>
          <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 10 }}>
            Share your code — both you and your friend get ₹10 wallet credit!
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, background: '#fff', borderRadius: 10, padding: '10px 14px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>Your Referral Code</div>
              <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: 3, color: '#111' }}>{profile?.referral_code || '------'}</div>
            </div>
            <button onClick={() => {
              const msg = `Join me on CarpoolKaro — Hyderabad's IT Carpool app! Use my code ${profile?.referral_code} to get ₹10 free wallet credit. Install: https://app.carpoolkaro.com`
              if (navigator.share) {
                navigator.share({ title: 'CarpoolKaro Invite', text: msg })
              } else {
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`)
              }
            }} style={{
              background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10,
              padding: '12px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              📤 Share
            </button>
          </div>
          {profile?.referral_count > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
              🎉 {profile.referral_count} friend{profile.referral_count > 1 ? 's' : ''} joined using your code!
            </div>
          )}
        </div>

        {/* SOS Emergency Contact */}
        <div style={{ background: '#fef2f2', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12, border: '1px solid #fecaca' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🆘 Emergency Contact</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            During a ride, one tap sends your live location to this contact via WhatsApp.
          </div>
          {profile?.emergency_contact_phone ? (
            <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{profile.emergency_contact_name || 'Emergency Contact'}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{profile.emergency_contact_phone}</div>
              </div>
              <button onClick={() => setEditing(true)} style={{ background: 'none', border: '1px solid #f5f5f5', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#888', cursor: 'pointer' }}>
                Edit
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} style={{
              width: '100%', padding: 12, background: '#dc2626', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>
              + Add Emergency Contact
            </button>
          )}
        </div>

        {/* Work Email Verification — prominent placement */}
        <div style={{
          background: profile?.work_email_verified ? '#f0fdf4' : '#fff',
          borderRadius: 16, padding: 16, marginBottom: 12,
          border: `2px solid ${profile?.work_email_verified ? '#22c55e' : '#facc15'}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: profile?.work_email_verified ? 0 : 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>🏢 Verify Work Email</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                {profile?.work_email_verified
                  ? `✓ ${profile.work_email}`
                  : 'Verify to show company badge on your rides'}
              </div>
            </div>
            {profile?.work_email_verified
              ? <span style={{ background: '#22c55e', color: '#fff', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>✓ Verified</span>
              : <span style={{ background: '#fef9c3', color: '#854d0e', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>Tap to verify</span>
            }
          </div>

          {!profile?.work_email_verified && (
            <>
              {verifySuccess && (
                <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>
                  {verifySuccess}
                </div>
              )}
              {verifyError && (
                <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10 }}>
                  ⚠️ {verifyError}
                </div>
              )}
              {!otpSent ? (
                <>
                  <input
                    placeholder="e.g. sairam@capgemini.com"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, marginBottom: 10, boxSizing: 'border-box', background: '#fafafa' }}
                    value={workEmail}
                    onChange={e => setWorkEmail(e.target.value)}
                    type="email"
                    autoCapitalize="none"
                  />
                  <button onClick={sendWorkEmailOTP} disabled={verifying || !workEmail} style={{
                    width: '100%', padding: 12, background: '#111', color: '#fff',
                    border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    opacity: !workEmail ? 0.5 : 1,
                  }}>
                    {verifying ? 'Sending...' : '📧 Send OTP to Work Email'}
                  </button>
                  <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 6 }}>
                    Only company emails. Gmail/Yahoo not allowed.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 8, fontWeight: 600 }}>
                    ✅ OTP sent to {workEmail} — check your inbox!
                  </div>
                  <input
                    placeholder="000000"
                    style={{ width: '100%', padding: '14px', borderRadius: 10, border: '2px solid #111', fontSize: 24, textAlign: 'center', letterSpacing: 10, marginBottom: 10, boxSizing: 'border-box' }}
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    type="number"
                  />
                  <button onClick={verifyWorkOTP} disabled={verifying || otpCode.length !== 6} style={{
                    width: '100%', padding: 12, background: '#16a34a', color: '#fff',
                    border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8,
                    opacity: otpCode.length !== 6 ? 0.5 : 1,
                  }}>
                    {verifying ? 'Verifying...' : '✅ Verify & Get Badge'}
                  </button>
                  <button onClick={() => { setOtpSent(false); setOtpCode(''); setVerifyError('') }} style={{
                    width: '100%', padding: 9, background: '#f5f5f5', color: '#888',
                    border: 'none', borderRadius: 10, fontSize: 12, cursor: 'pointer',
                  }}>
                    ← Change Email
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* App info */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>About CarpoolKaro</div>
          {[
            ['🚗', 'Version', '1.0.0 Beta'],
            ['📍', 'City', CITIES[profile?.city || 'hyderabad']?.name || 'Hyderabad'],
            ['💰', 'Platform Fee', '₹2 per booking'],
            ['⚡', 'Payments', 'Instant UPI'],
          ].map(([icon, k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
              <span style={{ fontSize: 13, color: '#888' }}>{icon} {k}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Links */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          {[
            { label: '📄 Terms of Use & Privacy Policy', path: '/terms' },
            { label: '⚙️ Admin Dashboard', path: '/admin', adminOnly: true },
          ].filter(l => !l.adminOnly || profile?.is_admin === true)
          .map(l => (
            <button key={l.path} onClick={() => navigate(l.path)} style={{
              width: '100%', padding: '14px 16px', background: 'none', border: 'none',
              borderBottom: '1px solid #f5f5f5', textAlign: 'left', cursor: 'pointer',
              fontSize: 14, color: '#333', display: 'flex', justifyContent: 'space-between',
            }}>
              {l.label} <span style={{ color: '#ccc' }}>›</span>
            </button>
          ))}
        </div>

        {/* Logout */}
        <button onClick={handleSignOut} style={{
          width: '100%', padding: 14, background: '#fff',
          color: '#dc2626', border: '2px solid #fecaca',
          borderRadius: 12, fontSize: 15, fontWeight: 700, marginBottom: 8,
        }}>
          🚪 Logout
        </button>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#ccc', marginTop: 8 }}>
          CarpoolKaro · Made with ❤️ in Hyderabad
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
