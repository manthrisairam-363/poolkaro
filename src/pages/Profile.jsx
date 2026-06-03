import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'
import { getCompanyFromEmail } from '../lib/companyDomains'
import { CITIES } from '../lib/cities'
import NotificationBell from '../components/NotificationBell'

export default function Profile() {
  const { user, profile, signOut, fetchProfile } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [openSection, setOpenSection] = useState(null)
  const [viewPhoto, setViewPhoto] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState('')
  const [workEmail, setWorkEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [verifySuccess, setVerifySuccess] = useState('')

  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    vehicle_model: profile?.vehicle_model || '',
    vehicle_number: profile?.vehicle_number || '',
    upi_id: profile?.upi_id || '',
    role: profile?.role || 'both',
    emergency_contact_name: profile?.emergency_contact_name || '',
    emergency_contact_phone: profile?.emergency_contact_phone || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleSection = (s) => setOpenSection(prev => prev === s ? null : s)

  const initials = profile?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const co = getCompanyFromEmail((profile?.work_email_verified && profile?.work_email) ? profile.work_email : user?.email)

  const completeness = (() => {
    const checks = [
      { label: 'Full name', done: !!profile?.full_name, points: 15 },
      { label: 'Phone', done: !!profile?.phone, points: 15 },
      { label: 'Profile photo', done: !!profile?.avatar_url, points: 10 },
      { label: 'Vehicle details', done: !!profile?.vehicle_model, points: 20 },
      { label: 'UPI ID', done: !!profile?.upi_id, points: 15 },
      { label: 'Work email', done: !!profile?.work_email_verified, points: 15 },
      { label: 'Emergency contact', done: !!profile?.emergency_contact_phone, points: 10 },
    ]
    return { checks, total: checks.reduce((s, c) => s + (c.done ? c.points : 0), 0) }
  })()

  async function saveProfile() {
    setLoading(true)
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name, phone: form.phone,
      city: form.city || 'Hyderabad',
      vehicle_model: form.vehicle_model || null,
      vehicle_number: form.vehicle_number?.toUpperCase() || null,
      upi_id: form.upi_id || null, role: form.role,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_phone: form.emergency_contact_phone || null,
    }).eq('id', user.id)
    setLoading(false)
    if (!error) { fetchProfile(user.id); setEditing(false); setSuccess('Saved! ✅'); setTimeout(() => setSuccess(''), 3000) }
  }

  async function uploadPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const filename = `avatar_${user.id}.${ext}`
      await supabase.storage.from('avatars').remove([filename])
      const { error: upErr } = await supabase.storage.from('avatars').upload(filename, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('avatars').getPublicUrl(filename)
      await supabase.from('profiles').update({ avatar_url: data.publicUrl + '?t=' + Date.now() }).eq('id', user.id)
      fetchProfile(user.id)
    } catch (err) { alert('Upload failed: ' + err.message) }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function removePhoto() {
    if (!confirm('Remove your profile photo?')) return
    setUploading(true)
    try {
      const { data: files } = await supabase.storage.from('avatars').list('', { search: user.id })
      if (files?.length > 0) await supabase.storage.from('avatars').remove(files.map(f => f.name))
      await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
      fetchProfile(user.id)
    } catch (err) { console.error(err) }
    setUploading(false)
  }

  async function sendWorkEmailOTP() {
    setVerifyError(''); setVerifying(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-work-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'send_otp', work_email: workEmail }),
    })
    const data = await res.json()
    setVerifying(false)
    if (data.error) { setVerifyError(data.error); return }
    setOtpSent(true); setVerifySuccess(`OTP sent to ${workEmail}`)
  }

  async function verifyWorkOTP() {
    setVerifyError(''); setVerifying(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-work-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action: 'verify_otp', otp: otpCode }),
    })
    const data = await res.json()
    setVerifying(false)
    if (data.error) { setVerifyError(data.error); return }
    setVerifySuccess(data.message); setOtpSent(false); setOtpCode(''); fetchProfile(user.id)
  }

  // Styles
  const card = { background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 10, overflow: 'hidden' }
  const inp = { width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, background: '#fafafa', marginBottom: 12, fontFamily: 'inherit', boxSizing: 'border-box' }
  const lbl = { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4, display: 'block' }

  function Row({ id, icon, title, badge, last }) {
    const open = openSection === id
    return (
      <button onClick={() => toggleSection(id)} style={{
        width: '100%', padding: '17px 16px', background: 'none', border: 'none',
        borderBottom: (open || last) ? 'none' : '1px solid #f5f5f5',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#111',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>{icon}</span>
          {title}
          {badge && <span style={{ marginLeft: 2 }}>{badge}</span>}
        </span>
        <span style={{ color: '#bbb', fontSize: 20, fontWeight: 400 }}>{open ? '∨' : '›'}</span>
      </button>
    )
  }

  const Tag = ({ text, green, yellow, red }) => (
    <span style={{ background: green ? '#f0fdf4' : yellow ? '#fffbeb' : red ? '#fef2f2' : '#f5f5f5', color: green ? '#16a34a' : yellow ? '#92400e' : red ? '#dc2626' : '#888', fontSize: 10, padding: '2px 7px', borderRadius: 8, fontWeight: 700 }}>{text}</span>
  )

  return (
    <div style={{ paddingBottom: 90, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ background: '#111', padding: '20px 16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>My Profile</div>
          <NotificationBell onNotificationClick={() => {}} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>

          {/* Avatar — tap to view full, upload is in Personal Details */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => profile?.avatar_url && setViewPhoto(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: profile?.avatar_url ? 'pointer' : 'default' }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" style={{ width: 70, height: 70, borderRadius: '50%', objectFit: 'cover', border: '2px solid #facc15', display: 'block', pointerEvents: 'none', WebkitTouchCallout: 'none' }} />
                : <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#facc15', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26 }}>{initials}</div>
              }
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={uploadPhoto} />
          </div>

          {/* Name & badges */}
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {profile?.full_name || 'Your Name'}
              {profile?.is_verified && <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>✓ VERIFIED</span>}
              {profile?.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date() && (
                <span style={{ background: '#facc15', color: '#111', fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>⭐ PRO</span>
              )}
            </div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{user?.email}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>
                {profile?.role === 'driver' ? '🚗 Car Owner' : profile?.role === 'rider' ? '🙋 Co-rider' : '🔄 Car Owner & Co-rider'}
              </span>
              {co && <span style={{ background: '#facc15', color: '#111', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 800 }}>🏢 {co.name}</span>}
              {!co && profile?.work_email_verified && <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>✓ Work Verified</span>}
            </div>
          </div>
        </div>

        {/* Completeness — only when < 100% */}
        {completeness.total < 100 && (
          <div style={{ marginTop: 14, background: '#1a1a1a', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#aaa', fontSize: 12 }}>Profile completeness</span>
              <span style={{ color: '#facc15', fontWeight: 700, fontSize: 12 }}>{completeness.total}%</span>
            </div>
            <div style={{ background: '#333', borderRadius: 99, height: 5 }}>
              <div style={{ height: 5, borderRadius: 99, width: `${completeness.total}%`, background: '#facc15' }} />
            </div>
            <div style={{ color: '#666', fontSize: 11, marginTop: 6 }}>💡 Next: {completeness.checks.find(c => !c.done)?.label} (+{completeness.checks.find(c => !c.done)?.points}%)</div>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 16px' }}>
        {success && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{success}</div>}

        {/* ── Admin Dashboard — top for easy access ── */}
        {profile?.is_admin && (
          <button onClick={() => navigate('/admin')} style={{ width: '100%', padding: '14px', background: '#111', color: '#facc15', border: '2px solid #facc15', borderRadius: 14, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 18 }}>⚙️</span> Admin Dashboard</span>
            <span>→</span>
          </button>
        )}

        {/* ── Group 1: Main sections ── */}
        <div style={card}>

          {/* City — visible outside Personal Details */}
          <div style={{ padding: '0 16px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8f9fa', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>📍</span>
                <div>
                  <div style={{ fontSize: 11, color: '#aaa' }}>Your City</div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{profile?.city || 'Hyderabad'}</div>
                </div>
              </div>
              <button onClick={() => { setOpenSection('personal'); setEditing(true) }} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Change
              </button>
            </div>
          </div>

          {/* Personal Details */}
          <Row id="personal" icon="👤" title="Personal Details" />
          {openSection === 'personal' && (
            <div style={{ padding: '4px 16px 16px', borderBottom: '1px solid #f5f5f5' }}>
              {!editing ? (
                <>
                  {[['✏️ Name', profile?.full_name], ['📱 Phone', profile?.phone], ['📧 Email', user?.email], ['🚘 Vehicle', profile?.vehicle_model ? `${profile.vehicle_model} · ${profile.vehicle_number}` : null], ['💳 UPI ID', profile?.upi_id]].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f9f9f9' }}>
                      <span style={{ fontSize: 13, color: '#888' }}>{k}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: v ? '#111' : '#ccc' }}>{v || 'Not set'}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: 10, background: '#f5f5f5', color: '#555', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      📷 {profile?.avatar_url ? 'Change Photo' : 'Add Photo'}
                    </button>
                    {profile?.avatar_url && (
                      <button onClick={removePhoto} style={{ flex: 1, padding: 10, background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        🗑️ Remove Photo
                      </button>
                    )}
                  </div>
                  <button onClick={() => setEditing(true)} style={{ width: '100%', padding: 11, background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>✏️ Edit Details</button>
                </>
              ) : (
                <>
                  <div style={{ height: 8 }} />
                  <span style={lbl}>Full Name</span><input style={inp} value={form.full_name} onChange={e => set('full_name', e.target.value)} />
                  <span style={lbl}>Phone</span><input style={inp} value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" />
                  <span style={lbl}>City</span>
                  <select style={inp} value={form.city || 'Hyderabad'} onChange={e => set('city', e.target.value)}>
                    {['Hyderabad','Bangalore','Pune','Mumbai','Delhi NCR','Chennai'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <span style={lbl}>Role</span>
                  <select style={inp} value={form.role} onChange={e => set('role', e.target.value)}>
                    <option value="both">Car Owner & Co-rider</option>
                    <option value="driver">Car Owner only</option>
                    <option value="rider">Co-rider only</option>
                  </select>
                  <span style={lbl}>Vehicle Model</span><input style={inp} placeholder="e.g. Tata Nexon EV" value={form.vehicle_model} onChange={e => set('vehicle_model', e.target.value)} />
                  <span style={lbl}>Vehicle Number</span><input style={inp} placeholder="e.g. TS09AB1234" value={form.vehicle_number} onChange={e => set('vehicle_number', e.target.value.toUpperCase())} />
                  <span style={lbl}>UPI ID</span><input style={inp} placeholder="e.g. 9999999999@upi" value={form.upi_id} onChange={e => set('upi_id', e.target.value)} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 11, background: '#f5f5f5', color: '#555', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={saveProfile} disabled={loading} style={{ flex: 2, padding: 11, background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{loading ? 'Saving...' : '✅ Save Changes'}</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Invite & Earn */}
          <Row id="invite" icon="🎉" title="Invite & Earn" />
          {openSection === 'invite' && (
            <div style={{ padding: '4px 16px 16px', borderBottom: '1px solid #f5f5f5' }}>
              <div style={{ background: '#fffbeb', borderRadius: 10, padding: 14, marginBottom: 12, textAlign: 'center', marginTop: 8 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Your Invite Code</div>
                <div style={{ fontWeight: 800, fontSize: 28, letterSpacing: 5, color: '#111' }}>{profile?.referral_code || '——'}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Both you and your friend get ₹10</div>
              </div>
              {profile?.referral_count > 0 && <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>🎉 {profile.referral_count} friend{profile.referral_count > 1 ? 's' : ''} joined using your code!</div>}
              <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Join me on CarpoolKaro! Use my code ${profile?.referral_code} to get ₹10 free. Install: https://app.carpoolkaro.com`)}`, '_blank')} style={{ width: '100%', padding: 12, background: '#25D366', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>💬 Invite on WhatsApp</button>
            </div>
          )}

          {/* Emergency Contact */}
          <Row id="emergency" icon="🆘" title="Emergency Contact" badge={profile?.emergency_contact_phone ? <Tag text="Set" green /> : <Tag text="Not set" red />} />
          {openSection === 'emergency' && (
            <div style={{ padding: '4px 16px 16px', borderBottom: '1px solid #f5f5f5' }}>
              {profile?.emergency_contact_phone && (
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 12px', marginBottom: 12, marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: '#888' }}>Current contact</div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{profile.emergency_contact_name}</div>
                  <div style={{ fontSize: 13, color: '#555' }}>{profile.emergency_contact_phone}</div>
                </div>
              )}
              {!profile?.emergency_contact_phone && <div style={{ height: 8 }} />}
              <span style={lbl}>Contact Name</span><input style={inp} placeholder="e.g. Mom, Wife, Friend" value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} />
              <span style={lbl}>Phone Number</span><input style={inp} placeholder="10-digit number" value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} type="tel" />
              <button onClick={saveProfile} disabled={loading} style={{ width: '100%', padding: 11, background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{loading ? 'Saving...' : '✅ Save Contact'}</button>
            </div>
          )}

          {/* Verify Work Email */}
          <Row id="workemail" icon="🏢" title="Verify Work Email" badge={profile?.work_email_verified ? <Tag text="✓ Verified" green /> : <Tag text="Pending" yellow />} />
          {openSection === 'workemail' && (
            <div style={{ padding: '4px 16px 16px', borderBottom: '1px solid #f5f5f5' }}>
              {profile?.work_email_verified ? (
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#16a34a', fontWeight: 600, marginTop: 8 }}>✅ Verified: {profile.work_email}</div>
              ) : (
                <>
                  {verifySuccess && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10, marginTop: 8, fontWeight: 600 }}>{verifySuccess}</div>}
                  {verifyError && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10 }}>⚠️ {verifyError}</div>}
                  {!otpSent ? (
                    <>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 10, marginTop: 8 }}>Shows your company badge on every ride card</div>
                      <input placeholder="sairam@capgemini.com" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} value={workEmail} onChange={e => setWorkEmail(e.target.value)} type="email" autoCapitalize="none" />
                      <button onClick={sendWorkEmailOTP} disabled={verifying || !workEmail} style={{ width: '100%', padding: 12, background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !workEmail ? 0.5 : 1 }}>{verifying ? 'Sending...' : '📧 Send OTP'}</button>
                      <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 6 }}>Only company emails accepted.</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 8, marginTop: 8, fontWeight: 600 }}>✅ OTP sent to {workEmail}</div>
                      <input placeholder="000000" style={{ width: '100%', padding: '14px', borderRadius: 10, border: '2px solid #111', fontSize: 24, textAlign: 'center', letterSpacing: 10, marginBottom: 10, boxSizing: 'border-box' }} value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} type="number" />
                      <button onClick={verifyWorkOTP} disabled={verifying || otpCode.length !== 6} style={{ width: '100%', padding: 12, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8, opacity: otpCode.length !== 6 ? 0.5 : 1 }}>{verifying ? 'Verifying...' : '✅ Verify & Get Badge'}</button>
                      <button onClick={() => { setOtpSent(false); setOtpCode(''); setVerifyError('') }} style={{ width: '100%', padding: 9, background: '#f5f5f5', color: '#888', border: 'none', borderRadius: 10, fontSize: 12, cursor: 'pointer' }}>← Change Email</button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* About */}
          <Row id="about" icon="ℹ️" title="About CarpoolKaro" last />
          {openSection === 'about' && (
            <div style={{ padding: '4px 16px 16px' }}>
              {[['🚗', 'Version', '1.0.0 Beta'], ['📍', 'City', CITIES[profile?.city || 'hyderabad']?.name || 'Hyderabad'], ['💰', 'Platform Fee', '₹2 per booking'], ['⚡', 'Payments', 'Direct UPI between users']].map(([icon, k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f9f9f9' }}>
                  <span style={{ fontSize: 13, color: '#888' }}>{icon} {k}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Pro Subscription Banner ── */}
        {profile?.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date() ? (
          <button onClick={() => navigate('/subscription')} style={{ width: '100%', padding: '14px 16px', background: 'linear-gradient(135deg, #052e16, #064e3b)', border: '1px solid #166534', borderRadius: 14, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 16 }}>⭐</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#4ade80' }}>Pro Active</span>
              </div>
              <div style={{ fontSize: 11, color: '#86efac' }}>
                {Math.max(0, Math.ceil((new Date(profile.subscription_expires_at) - new Date()) / 86400000))} days left · expires {new Date(profile.subscription_expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <span style={{ color: '#4ade80', fontSize: 20 }}>›</span>
          </button>
        ) : (
          <button onClick={() => navigate('/subscription')} style={{ width: '100%', padding: '14px 16px', background: '#fefce8', border: '2px solid #facc15', borderRadius: 14, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 16 }}>⭐</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#854d0e' }}>Upgrade to Pro</span>
              </div>
              <div style={{ fontSize: 11, color: '#92400e' }}>Zero platform fees · From ₹99/month</div>
            </div>
            <span style={{ color: '#854d0e', fontSize: 20 }}>›</span>
          </button>
        )}

        {/* ── Group 2: Links ── */}
        <div style={card}>
          <button onClick={() => navigate('/terms')} style={{ width: '100%', padding: '17px 16px', background: 'none', border: 'none', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#111' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 18 }}>📄</span> Terms of Use & Privacy Policy</span>
            <span style={{ color: '#bbb', fontSize: 20 }}>›</span>
          </button>
          <button onClick={() => navigate('/feedback')} style={{ width: '100%', padding: '17px 16px', background: 'none', border: 'none', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#111' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 18 }}>💡</span> Suggest a Feature</span>
            <span style={{ color: '#bbb', fontSize: 20 }}>›</span>
          </button>
          <a href="mailto:support@carpoolkaro.com" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '17px 16px', textDecoration: 'none' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#111' }}><span style={{ fontSize: 18 }}>💬</span> Contact Support</span>
            <span style={{ fontSize: 12, color: '#aaa' }}>support@carpoolkaro.com</span>
          </a>
        </div>

        {/* Logout */}
        <button onClick={async () => { await signOut(); navigate('/') }} style={{ width: '100%', padding: 14, background: '#fff', color: '#dc2626', border: '2px solid #fecaca', borderRadius: 12, fontSize: 15, fontWeight: 700, marginBottom: 8, cursor: 'pointer' }}>
          🚪 Logout
        </button>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#ccc', marginTop: 8 }}>CarpoolKaro · Made with ❤️ in India</div>
      </div>
      {/* Photo fullscreen viewer */}
      {viewPhoto && profile?.avatar_url && (
        <div onClick={() => setViewPhoto(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={profile.avatar_url} alt="avatar" style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 16, objectFit: 'contain' }} />
          <button onClick={() => setViewPhoto(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 24, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer' }}>✕</button>
        </div>
      )}
      <BottomNav />
    </div>
  )
}
