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
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    phone: profile?.phone || '',
    vehicle_model: profile?.vehicle_model || '',
    vehicle_number: profile?.vehicle_number || '',
    upi_id: profile?.upi_id || '',
    role: profile?.role || 'both',
    city: profile?.city || 'hyderabad',
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
    }).eq('id', user.id)
    setLoading(false)
    if (!error) {
      fetchProfile(user.id)
      setEditing(false)
      setSuccess('Profile updated! ✅')
      setTimeout(() => setSuccess(''), 3000)
    }
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
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 20 }}>👤 Profile</div>
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
              {(() => { const co = getCompanyFromEmail(user?.email); return co ? <span style={{ background: co.bg, color: co.color, borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>🏢 {co.name}</span> : isCompanyEmail(user?.email) ? <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600 }}>🏢 IT Professional</span> : null })()}
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
                ['👤 Name', profile?.full_name],
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

              <button onClick={saveProfile} disabled={loading} style={{
                width: '100%', padding: 13, background: '#111', color: '#fff',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
              }}>
                {loading ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          )}
        </div>

        {/* Stats card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>My Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20 }}>🚗</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>{profile?.total_rides_given || 0}</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>Rides Given</div>
            </div>
            <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20 }}>🙋</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>{profile?.total_rides_taken || 0}</div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>Rides Taken</div>
            </div>
            <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 20 }}>⭐</div>
              {profile?.total_ratings > 0 ? (
                <>
                  <div style={{ fontWeight: 700, fontSize: 15, marginTop: 4 }}>{Number(profile.avg_rating).toFixed(1)}</div>
                  <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>{profile.total_ratings} rating{profile.total_ratings > 1 ? 's' : ''}</div>
                </>
              ) : (
                <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4, color: '#aaa' }}>New</div>
              )}
            </div>
          </div>
        </div>

        {/* App info */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>About PoolKaro</div>
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
          PoolKaro · Made with ❤️ in Hyderabad
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
