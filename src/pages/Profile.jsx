import { useState, useRef } from 'react'
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

  const [openSection, setOpenSection] = useState(null)
  const toggleSection = (s) => setOpenSection(prev => prev === s ? null : s)

  // Profile completeness calculation
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
    const total = checks.reduce((s, c) => s + (c.done ? c.points : 0), 0)
    return { checks, total }
  })()

  async function uploadPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      // Use simple filename — avoid subfolder issues with RLS
      const ext = file.name.split('.').pop().toLowerCase()
      const filename = `avatar_${user.id}.${ext}`

      // Delete old file first if exists
      await supabase.storage.from('avatars').remove([filename])

      // Upload new file
      const { error: upErr } = await supabase.storage
        .from('avatars').upload(filename, file, {
          upsert: true,
          contentType: file.type,
        })
      if (upErr) throw upErr

      // Get public URL with cache bust
      const { data } = supabase.storage.from('avatars').getPublicUrl(filename)
      const publicUrl = data.publicUrl + '?t=' + Date.now()

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
      fetchProfile(user.id)
    } catch (err) {
      alert('Upload failed: ' + err.message)
    }
    setUploading(false)
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = ''
  }

  async function removePhoto() {
    if (!confirm('Remove profile photo?')) return
    setUploading(true)
    try {
      // List all files in bucket matching this user's ID and delete them all
      const { data: files } = await supabase.storage.from('avatars').list('', {
        search: user.id
      })
      if (files && files.length > 0) {
        const paths = files.map(f => f.name)
        await supabase.storage.from('avatars').remove(paths)
      }
      // Also try old subfolder format
      await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`, `${user.id}/avatar.png`, `${user.id}/avatar.webp`])
      // Clear avatar_url in profile
      await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
      fetchProfile(user.id)
    } catch (err) {
      console.error('Remove photo error:', err)
      // Still clear the URL even if file delete fails
      await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
      fetchProfile(user.id)
    }
    setUploading(false)
  }

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

  const inp = { width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, background: '#fafafa', marginBottom: 12, fontFamily: 'inherit', boxSizing: 'border-box' }
  const label = { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4, display: 'block' }
  const menuCard = { background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 10, overflow: 'hidden' }
  const menuRow = (open) => ({
    width: '100%', padding: '16px', background: 'none', border: 'none',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#111',
    borderBottom: open ? '1px solid #f0f0f0' : 'none',
  })
  const sectionBody = { padding: '14px 16px' }

  return (
    <div style={{ paddingBottom: 90, background: '#f5f6fa', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: '#111', padding: '20px 16px 24px' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 16 }}>My Profile</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Avatar with upload/remove */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar"
                style={{ width: 70, height: 70, borderRadius: '50%', objectFit: 'cover', border: '2px solid #facc15', display: 'block' }} />
            ) : (
              <div style={{ width: 70, height: 70, borderRadius: '50%', background: '#facc15', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 26 }}>
                {initials}
              </div>
            )}
            <button onClick={() => fileRef.current?.click()} style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer',
              borderRadius: '0 0 35px 35px', padding: '4px 0',
              fontSize: 10, color: '#fff', fontWeight: 600,
            }}>{uploading ? '⏳' : '📷'}</button>
            {profile?.avatar_url && (
              <button onClick={removePhoto} style={{
                position: 'absolute', top: -2, right: -2, width: 20, height: 20,
                borderRadius: '50%', background: '#dc2626', border: '2px solid #111',
                cursor: 'pointer', fontSize: 9, color: '#fff', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={uploadPhoto} />
          </div>

          {/* Name + badges */}
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {profile?.full_name || 'Your Name'}
              {profile?.is_verified && <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>✓ VERIFIED</span>}
            </div>
            <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{user?.email}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <span style={{
                background: profile?.role === 'driver' ? '#dbeafe' : profile?.role === 'rider' ? '#fce7f3' : '#f0fdf4',
                color: profile?.role === 'driver' ? '#1d4ed8' : profile?.role === 'rider' ? '#be185d' : '#16a34a',
                borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
              }}>{profile?.role === 'driver' ? '🚗 Car Owner' : profile?.role === 'rider' ? '🙋 Co-rider' : '🔄 Car Owner & Co-rider'}</span>
              {(() => {
                const co = getCompanyFromEmail((profile?.work_email_verified && profile?.work_email) ? profile.work_email : user?.email)
                if (co) return <span style={{ background: '#facc15', color: '#111', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 800 }}>🏢 {co.name}</span>
                if (profile?.work_email_verified) return <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 700 }}>✓ Work Verified</span>
                return null
              })()}
            </div>
          </div>
        </div>

        {/* Completeness bar — only when < 100% */}
        {completeness.total < 100 && (
          <div style={{ marginTop: 14, background: '#1a1a1a', borderRadius: 10, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#aaa', fontSize: 12 }}>Profile completeness</span>
              <span style={{ color: '#facc15', fontWeight: 700, fontSize: 12 }}>{completeness.total}%</span>
            </div>
            <div style={{ background: '#333', borderRadius: 99, height: 5 }}>
              <div style={{ height: 5, borderRadius: 99, width: `${completeness.total}%`, background: '#facc15' }} />
            </div>
            <div style={{ color: '#666', fontSize: 11, marginTop: 6 }}>
              💡 Next: {completeness.checks.find(c => !c.done)?.label} (+{completeness.checks.find(c => !c.done)?.points}%)
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 16px' }}>
        {success && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{success}</div>}

        {/* ── Personal Details ── */}
        <div style={menuCard}>
          <button style={menuRow(openSection === 'personal')} onClick={() => toggleSection('personal')}>
            <span>👤 Personal Details</span>
            <span style={{ color: '#ccc', fontSize: 18 }}>{openSection === 'personal' ? '∨' : '›'}</span>
          </button>
          {openSection === 'personal' && (
            <div style={sectionBody}>
              {!editing ? (
                <>
                  <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
                    {[
                      ['✏️ Name', profile?.full_name],
                      ['📱 Phone', profile?.phone],
                      ['📧 Email', user?.email],
                      ['🚘 Vehicle', profile?.vehicle_model ? `${profile.vehicle_model} · ${profile.vehicle_number}` : null],
                      ['💳 UPI ID', profile?.upi_id],
                    ].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                        <span style={{ fontSize: 13, color: '#888' }}>{k}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: v ? '#111' : '#ccc' }}>{v || 'Not set'}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setEditing(true)} style={{ width: '100%', padding: 11, background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    ✏️ Edit Details
                  </button>
                </>
              ) : (
                <div>
                  <label style={label}>Full Name</label>
                  <input style={inp} value={form.full_name} onChange={e => set('full_name', e.target.value)} />
                  <label style={label}>Phone</label>
                  <input style={inp} value={form.phone} onChange={e => set('phone', e.target.value)} type="tel" />
                  <label style={label}>Role</label>
                  <select style={inp} value={form.role} onChange={e => set('role', e.target.value)}>
                    <option value="both">Car Owner & Co-rider</option>
                    <option value="driver">Car Owner only</option>
                    <option value="rider">Co-rider only</option>
                  </select>
                  <label style={label}>Vehicle Model</label>
                  <input style={inp} placeholder="e.g. Tata Nexon EV" value={form.vehicle_model} onChange={e => set('vehicle_model', e.target.value)} />
                  <label style={label}>Vehicle Number</label>
                  <input style={inp} placeholder="e.g. TS09AB1234" value={form.vehicle_number} onChange={e => set('vehicle_number', e.target.value.toUpperCase())} />
                  <label style={label}>UPI ID</label>
                  <input style={inp} placeholder="e.g. 9999999999@upi" value={form.upi_id} onChange={e => set('upi_id', e.target.value)} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditing(false)} style={{ flex: 1, padding: 11, background: '#f5f5f5', color: '#555', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                    <button onClick={saveProfile} disabled={loading} style={{ flex: 2, padding: 11, background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                      {loading ? 'Saving...' : '✅ Save Changes'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── My Impact ── */}
        <div style={menuCard}>
          <button style={menuRow(openSection === 'impact')} onClick={() => toggleSection('impact')}>
            <span>🌱 My Impact</span>
            <span style={{ color: '#ccc', fontSize: 18 }}>{openSection === 'impact' ? '∨' : '›'}</span>
          </button>
          {openSection === 'impact' && (
            <div style={sectionBody}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  ['🚗', 'Rides Given', profile?.total_rides_given || 0],
                  ['🙋', 'Rides Taken', profile?.total_rides_taken || 0],
                  ['🌿', 'CO₂ Saved', `${((profile?.total_rides_given || 0) * 2.1).toFixed(1)} kg`],
                  ['💰', 'Money Saved', `₹${(profile?.total_rides_taken || 0) * 120}`],
                  ['⭐', 'Avg Rating', Number(profile?.avg_rating || 0).toFixed(1)],
                  ['🎁', 'Referrals', profile?.referral_count || 0],
                ].map(([icon, label, value]) => (
                  <div key={label} style={{ background: '#f8f9fa', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 20 }}>{icon}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, marginTop: 4 }}>{value}</div>
                    <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Refer & Earn ── */}
        <div style={menuCard}>
          <button style={menuRow(openSection === 'refer')} onClick={() => toggleSection('refer')}>
            <span>🎁 Refer & Earn</span>
            <span style={{ color: '#ccc', fontSize: 18 }}>{openSection === 'refer' ? '∨' : '›'}</span>
          </button>
          {openSection === 'refer' && (
            <div style={sectionBody}>
              <div style={{ background: '#fffbeb', borderRadius: 10, padding: 14, marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Your Referral Code</div>
                <div style={{ fontWeight: 800, fontSize: 26, letterSpacing: 4, color: '#111' }}>{profile?.referral_code || '——'}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Both you & your friend get ₹10</div>
              </div>
              {profile?.referral_count > 0 && (
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                  🎉 {profile.referral_count} friend{profile.referral_count > 1 ? 's' : ''} joined using your code!
                </div>
              )}
              <button onClick={() => {
                const msg = `Join me on CarpoolKaro — Hyderabad's IT Carpool app! Use my code ${profile?.referral_code} to get ₹10 free wallet credit. Install: https://app.carpoolkaro.com`
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
              }} style={{ width: '100%', padding: 12, background: '#25D366', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                💬 Share on WhatsApp
              </button>
            </div>
          )}
        </div>

        {/* ── Emergency Contact ── */}
        <div style={menuCard}>
          <button style={menuRow(openSection === 'emergency')} onClick={() => toggleSection('emergency')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🆘 Emergency Contact</span>
              {profile?.emergency_contact_phone
                ? <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 10, padding: '2px 6px', borderRadius: 8, fontWeight: 700 }}>Set</span>
                : <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: 10, padding: '2px 6px', borderRadius: 8, fontWeight: 700 }}>Not set</span>
              }
            </div>
            <span style={{ color: '#ccc', fontSize: 18 }}>{openSection === 'emergency' ? '∨' : '›'}</span>
          </button>
          {openSection === 'emergency' && (
            <div style={sectionBody}>
              {profile?.emergency_contact_phone && (
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#888' }}>Current</div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{profile.emergency_contact_name}</div>
                  <div style={{ fontSize: 13, color: '#555' }}>{profile.emergency_contact_phone}</div>
                </div>
              )}
              <label style={label}>Contact Name</label>
              <input style={inp} placeholder="e.g. Mom, Wife, Friend" value={form.emergency_contact_name} onChange={e => set('emergency_contact_name', e.target.value)} />
              <label style={label}>Phone Number</label>
              <input style={inp} placeholder="10-digit number" value={form.emergency_contact_phone} onChange={e => set('emergency_contact_phone', e.target.value)} type="tel" />
              <button onClick={saveProfile} disabled={loading} style={{ width: '100%', padding: 11, background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {loading ? 'Saving...' : '✅ Save Contact'}
              </button>
            </div>
          )}
        </div>

        {/* ── Verify Work Email ── */}
        <div style={menuCard}>
          <button style={menuRow(openSection === 'workemail')} onClick={() => toggleSection('workemail')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🏢 Verify Work Email</span>
              {profile?.work_email_verified
                ? <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 10, padding: '2px 6px', borderRadius: 8, fontWeight: 700 }}>✓ Verified</span>
                : <span style={{ background: '#fffbeb', color: '#92400e', fontSize: 10, padding: '2px 6px', borderRadius: 8, fontWeight: 700 }}>Not verified</span>
              }
            </div>
            <span style={{ color: '#ccc', fontSize: 18 }}>{openSection === 'workemail' ? '∨' : '›'}</span>
          </button>
          {openSection === 'workemail' && (
            <div style={sectionBody}>
              {profile?.work_email_verified ? (
                <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#16a34a', fontWeight: 600 }}>
                  ✅ Verified: {profile.work_email}
                </div>
              ) : (
                <>
                  {verifySuccess && <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{verifySuccess}</div>}
                  {verifyError && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 12px', borderRadius: 8, fontSize: 13, marginBottom: 10 }}>⚠️ {verifyError}</div>}
                  {!otpSent ? (
                    <>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>Shows your company badge on every ride card</div>
                      <input placeholder="sairam@capgemini.com" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }}
                        value={workEmail} onChange={e => setWorkEmail(e.target.value)} type="email" autoCapitalize="none" />
                      <button onClick={sendWorkEmailOTP} disabled={verifying || !workEmail} style={{ width: '100%', padding: 12, background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !workEmail ? 0.5 : 1 }}>
                        {verifying ? 'Sending...' : '📧 Send OTP'}
                      </button>
                      <div style={{ fontSize: 11, color: '#aaa', textAlign: 'center', marginTop: 6 }}>Only company emails. Gmail/Yahoo not allowed.</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: '#16a34a', marginBottom: 8, fontWeight: 600 }}>✅ OTP sent to {workEmail}</div>
                      <input placeholder="000000" style={{ width: '100%', padding: '14px', borderRadius: 10, border: '2px solid #111', fontSize: 24, textAlign: 'center', letterSpacing: 10, marginBottom: 10, boxSizing: 'border-box' }}
                        value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} type="number" />
                      <button onClick={verifyWorkOTP} disabled={verifying || otpCode.length !== 6} style={{ width: '100%', padding: 12, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 8, opacity: otpCode.length !== 6 ? 0.5 : 1 }}>
                        {verifying ? 'Verifying...' : '✅ Verify & Get Badge'}
                      </button>
                      <button onClick={() => { setOtpSent(false); setOtpCode(''); setVerifyError('') }} style={{ width: '100%', padding: 9, background: '#f5f5f5', color: '#888', border: 'none', borderRadius: 10, fontSize: 12, cursor: 'pointer' }}>
                        ← Change Email
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* ── About ── */}
        <div style={menuCard}>
          <button style={menuRow(openSection === 'about')} onClick={() => toggleSection('about')}>
            <span>ℹ️ About CarpoolKaro</span>
            <span style={{ color: '#ccc', fontSize: 18 }}>{openSection === 'about' ? '∨' : '›'}</span>
          </button>
          {openSection === 'about' && (
            <div style={sectionBody}>
              {[
                ['🚗', 'Version', '1.0.0 Beta'],
                ['📍', 'City', CITIES[profile?.city || 'hyderabad']?.name || 'Hyderabad'],
                ['💰', 'Platform Fee', '₹2 per booking'],
                ['⚡', 'Payments', 'Direct UPI between users'],
                ['🔒', 'Security', 'Supabase RLS + JWT'],
              ].map(([icon, k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f5f5f5' }}>
                  <span style={{ fontSize: 13, color: '#888' }}>{icon} {k}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Nav links ── */}
        <div style={menuCard}>
          <button onClick={() => navigate('/terms')} style={menuRow(false)}>
            <span>📄 Terms of Use & Privacy Policy</span>
            <span style={{ color: '#ccc', fontSize: 18 }}>›</span>
          </button>
          {profile?.is_admin && (
            <button onClick={() => navigate('/admin')} style={{ ...menuRow(false), borderTop: '1px solid #f0f0f0' }}>
              <span>⚙️ Admin Dashboard</span>
              <span style={{ color: '#ccc', fontSize: 18 }}>›</span>
            </button>
          )}
          <a href="mailto:support@carpoolkaro.com" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid #f0f0f0', textDecoration: 'none' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#111' }}>💬 Contact Support</span>
            <span style={{ fontSize: 12, color: '#aaa' }}>support@carpoolkaro.com</span>
          </a>
        </div>

        {/* Logout */}
        <button onClick={handleSignOut} style={{ width: '100%', padding: 14, background: '#fff', color: '#dc2626', border: '2px solid #fecaca', borderRadius: 12, fontSize: 15, fontWeight: 700, marginBottom: 8, cursor: 'pointer' }}>
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
