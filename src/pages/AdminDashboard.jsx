import { useState, useEffect } from ‘react’
import { useNavigate } from ‘react-router-dom’
import { supabase } from ‘../lib/supabase’
import { useAuth } from ‘../lib/AuthContext’
import { formatTime, formatDate } from ‘../lib/utils’

export default function AdminDashboard() {
const { user, profile } = useAuth()
const navigate = useNavigate()
const [stats, setStats] = useState(null)
const [users, setUsers] = useState([])
const [rides, setRides] = useState([])
const [bookings, setBookings] = useState([])
const [wallets, setWallets] = useState({})
const [loading, setLoading] = useState(true)
const [tab, setTab] = useState(‘overview’)

const isAdmin = profile?.is_admin === true

useEffect(() => {
if (profile === undefined) return // still loading
if (!profile?.is_admin) { navigate(’/’); return }
fetchAll()
}, [profile])

async function fetchAll() {
setLoading(true)
try {
const [usersRes, ridesRes, bookingsRes] = await Promise.all([
supabase.from(‘profiles’).select(’*’).order(‘created_at’, { ascending: false }),
supabase.from(‘rides’).select(’*, profiles(full_name, phone)’).order(‘created_at’, { ascending: false }).limit(100),
supabase.from(‘bookings’).select(’*, profiles(full_name)’).order(‘created_at’, { ascending: false }).limit(100),
])

```
  const usersData = usersRes.data || []
  const ridesData = ridesRes.data || []
  const bookingsData = bookingsRes.data || []

  const confirmedBookings = bookingsData.filter(b => b.status === 'confirmed')
  const cancelledBookings = bookingsData.filter(b => b.status === 'cancelled')
  const totalRevenue = confirmedBookings.length * 4

  const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const todayIST = istNow.toISOString().split('T')[0]

  // Wallets — fetch separately, handle RLS gracefully
  const { data: walletsData } = await supabase.from('wallets').select('user_id, balance')
  const walletMap = {}
  ;(walletsData || []).forEach(w => { walletMap[w.user_id] = Math.round(w.balance / 100) })
  setWallets(walletMap)

  const totalWalletBalance = (walletsData || []).reduce((s, w) => s + (w.balance || 0), 0)

  setStats({
    totalUsers: usersData.length,
    totalRides: ridesData.length,
    activeRides: ridesData.filter(r => ['active','full'].includes(r.status)).length,
    totalBookings: confirmedBookings.length,
    cancelledBookings: cancelledBookings.length,
    totalRevenue,
    totalWalletBalance: Math.round(totalWalletBalance / 100),
    todayRides: ridesData.filter(r => r.ride_date === todayIST).length,
    todayRevenue: confirmedBookings.filter(b => b.created_at?.startsWith(todayIST)).length * 4,
    verifiedUsers: usersData.filter(u => u.is_verified).length,
    workVerifiedUsers: usersData.filter(u => u.work_email_verified).length,
    totalReferrals: usersData.filter(u => u.referred_by).length,
  })
  setUsers(usersData)
  setRides(ridesData)
  setBookings(bookingsData)
} catch (err) {
  console.error('Admin fetch error:', err.message)
} finally {
  setLoading(false)
}
```

}

const [selectedUser, setSelectedUser] = useState(null)
const [viewAdminPhoto, setViewAdminPhoto] = useState(null)

async function toggleVerified(userId, current) {
await supabase.from(‘profiles’).update({ is_verified: !current }).eq(‘id’, userId)
setSelectedUser(prev => prev?.id === userId ? { …prev, is_verified: !current } : prev)
fetchAll()
}

async function deleteUser(u) {
if (!confirm(`⚠️ DELETE ${u.full_name || u.email}?\n\nThis permanently removes their account, all rides, bookings and wallet. Cannot be undone.`)) return
// Delete from profiles (cascades to most tables)
await supabase.from(‘bookings’).delete().eq(‘rider_id’, u.id)
await supabase.from(‘rides’).delete().eq(‘driver_id’, u.id)
await supabase.from(‘wallets’).delete().eq(‘user_id’, u.id)
await supabase.from(‘profiles’).delete().eq(‘id’, u.id)
setSelectedUser(null)
fetchAll()
}

async function cancelRideAdmin(rideId) {
if (!confirm(‘Cancel this ride?’)) return
await supabase.from(‘rides’).update({ status: ‘cancelled’ }).eq(‘id’, rideId)
await supabase.from(‘bookings’).update({ status: ‘cancelled’ }).eq(‘ride_id’, rideId)
fetchAll()
}

if (!isAdmin) return null

const tabStyle = (v) => ({
padding: ‘8px 14px’, borderRadius: 20, border: ‘none’, cursor: ‘pointer’,
background: tab === v ? ‘#facc15’ : ‘#222’,
color: tab === v ? ‘#111’ : ‘#888’,
fontWeight: tab === v ? 700 : 400, fontSize: 12,
})

return (
<>
<div style={{ minHeight: ‘100vh’, background: ‘#0a0a0a’, color: ‘#fff’, paddingBottom: 40 }}>
{/* Header */}
<div style={{ background: ‘#111’, padding: ‘20px 16px 16px’, borderBottom: ‘1px solid #222’ }}>
<div style={{ display: ‘flex’, alignItems: ‘center’, gap: 12, marginBottom: 16 }}>
<button onClick={() => navigate(’/’)} style={{ background: ‘none’, border: ‘none’, color: ‘#fff’, fontSize: 20, cursor: ‘pointer’ }}>←</button>
<div>
<div style={{ fontWeight: 800, fontSize: 20 }}>⚙️ Admin Dashboard</div>
<div style={{ color: ‘#666’, fontSize: 11 }}>CarpoolKaro Control Panel</div>
</div>
<button onClick={fetchAll} style={{ marginLeft: ‘auto’, background: ‘#222’, border: ‘none’, color: ‘#facc15’, padding: ‘8px 12px’, borderRadius: 8, cursor: ‘pointer’ }}>
↺ Refresh
</button>
</div>
<div style={{ display: ‘flex’, gap: 8, overflowX: ‘auto’, paddingBottom: 4 }}>
{[[‘overview’,‘📊 Overview’],[‘users’,‘👥 Users’],[‘rides’,‘🚗 Rides’],[‘bookings’,‘🎫 Bookings’]].map(([v,l]) => (
<button key={v} onClick={() => setTab(v)} style={tabStyle(v)}>{l}</button>
))}
</div>
</div>

```
  <div style={{ padding: 16 }}>
    {loading ? (
      <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Loading...</div>
    ) : (
      <>
        {/* OVERVIEW */}
        {tab === 'overview' && stats && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                ['👥', 'Total Users', stats.totalUsers, '#2563eb'],
                ['🏢', 'Work Verified', stats.workVerifiedUsers, '#7c3aed'],
                ['🚗', 'Active Rides', stats.activeRides, '#7c3aed'],
                ['🎫', 'Confirmed Bookings', stats.totalBookings, '#d97706'],
                ['❌', 'Cancelled Bookings', stats.cancelledBookings, '#dc2626'],
                ['💰', 'Revenue (₹)', stats.totalRevenue, '#16a34a'],
                ['🏦', 'Wallet Pool (₹)', stats.totalWalletBalance, '#f59e0b'],
                ['🎁', 'Referrals', stats.totalReferrals, '#7c3aed'],
              ].map(([icon, label, value, color]) => (
                <div key={label} style={{ background: '#1a1a1a', borderRadius: 14, padding: 16, border: '1px solid #222' }}>
                  <div style={{ fontSize: 24 }}>{icon}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color, marginTop: 8 }}>{value}</div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#1a1a1a', borderRadius: 14, padding: 16, border: '1px solid #222' }}>
              <div style={{ fontWeight: 700, marginBottom: 12, color: '#facc15' }}>Today's Activity</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222' }}>
                <span style={{ color: '#888', fontSize: 13 }}>Rides posted today</span>
                <span style={{ fontWeight: 700 }}>{stats.todayRides}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: '#888', fontSize: 13 }}>Est. today's revenue</span>
                <span style={{ fontWeight: 700, color: '#16a34a' }}>₹{stats.todayRevenue}</span>
              </div>
            </div>
          </>
        )}

        {tab === 'users' && (
          <div>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>{users.length} total users — tap to view details</div>
            {users.map(u => {
              const initials = u.full_name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'
              return (
                <div key={u.id} onClick={() => setSelectedUser(u)}
                  style={{ background: '#1a1a1a', borderRadius: 12, padding: 12, marginBottom: 8, border: '1px solid #222', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Avatar */}
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="avatar" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #333' }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#333', color: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                      {initials}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{u.full_name || 'No name'}</span>
                      {u.is_verified && <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 9, padding: '2px 5px', borderRadius: 8, fontWeight: 700 }}>✓</span>}
                      {u.work_email_verified && <span style={{ background: '#16a34a', color: '#fff', fontSize: 9, padding: '2px 5px', borderRadius: 8, fontWeight: 700 }}>🏢</span>}
                    </div>
                    <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>{u.phone} · {u.email?.slice(0,22)}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                      <span style={{ background: wallets[u.id] > 5 ? '#14532d' : '#1a1a1a', color: wallets[u.id] > 5 ? '#4ade80' : '#888', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>
                        💰 ₹{wallets[u.id] ?? '—'}
                      </span>
                      <span style={{ color: '#444', fontSize: 10 }}>Joined {new Date(u.created_at).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                  <span style={{ color: '#444', fontSize: 16 }}>›</span>
                </div>
              )
            })}
          </div>
        )}

        {/* User Detail Modal */}
        {selectedUser && (() => {
          const u = selectedUser
          const initials = u.full_name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'
          const userBookings = bookings.filter(b => b.rider_id === u.id || b.driver_id === u.id)
          return (
            <div onClick={() => setSelectedUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#111', borderRadius: '20px 20px 0 0', padding: 20, width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '85vh', overflowY: 'auto' }}>
                {/* Handle */}
                <div style={{ width: 40, height: 4, background: '#333', borderRadius: 2, margin: '0 auto 20px' }} />

                {/* Profile photo - large */}
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  {u.avatar_url ? (
                    <img onClick={() => setViewAdminPhoto(u.avatar_url)} src={u.avatar_url} alt="avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid #facc15', marginBottom: 10, cursor: 'pointer' }} />
                  ) : (
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#222', color: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 28, margin: '0 auto 10px' }}>
                      {initials}
                    </div>
                  )}
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>{u.full_name || 'No name'}</div>
                  <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{u.email}</div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                    {u.is_verified && <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 10, padding: '3px 8px', borderRadius: 10, fontWeight: 700 }}>✓ Verified</span>}
                    {u.work_email_verified && <span style={{ background: '#16a34a', color: '#fff', fontSize: 10, padding: '3px 8px', borderRadius: 10, fontWeight: 700 }}>🏢 Work Verified</span>}
                    {u.is_admin && <span style={{ background: '#dc2626', color: '#fff', fontSize: 10, padding: '3px 8px', borderRadius: 10, fontWeight: 700 }}>👑 Admin</span>}
                  </div>
                </div>

                {/* Details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {[
                    ['📱 Phone', u.phone || '—'],
                    ['💰 Wallet', `₹${wallets[u.id] ?? '—'}`],
                    ['🚗 Rides given', u.total_rides_given || 0],
                    ['🙋 Rides taken', u.total_rides_taken || 0],
                    ['⭐ Rating', Number(u.avg_rating || 0).toFixed(1)],
                    ['🎁 Referral code', u.referral_code || '—'],
                    ['🚘 Vehicle', u.vehicle_model || '—'],
                    ['💳 UPI', u.upi_id || '—'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: '#1a1a1a', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: '#666' }}>{k}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginTop: 2 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Work email */}
                {u.work_email && (
                  <div style={{ background: '#0a2e1a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, border: '1px solid #166534' }}>
                    <div style={{ fontSize: 10, color: '#16a34a' }}>🏢 VERIFIED WORK EMAIL</div>
                    <div style={{ fontSize: 13, color: '#4ade80', fontWeight: 600, marginTop: 2 }}>{u.work_email}</div>
                  </div>
                )}

                {/* Emergency contact */}
                {u.emergency_contact_phone && (
                  <div style={{ background: '#2a0a0a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, border: '1px solid #7f1d1d' }}>
                    <div style={{ fontSize: 10, color: '#f87171' }}>🆘 EMERGENCY CONTACT</div>
                    <div style={{ fontSize: 13, color: '#fca5a5', fontWeight: 600, marginTop: 2 }}>{u.emergency_contact_name} · {u.emergency_contact_phone}</div>
                  </div>
                )}

                {/* Referred by */}
                {u.referred_by && (
                  <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#888' }}>🎁 REFERRED BY CODE</div>
                    <div style={{ fontSize: 13, color: '#facc15', fontWeight: 700, marginTop: 2 }}>{u.referred_by} → {users.find(x => x.referral_code === u.referred_by)?.full_name || 'Unknown'}</div>
                  </div>
                )}

                {/* Joined */}
                <div style={{ color: '#444', fontSize: 11, textAlign: 'center', marginBottom: 14 }}>
                  Member since {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => toggleVerified(u.id, u.is_verified)} style={{
                    flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                    background: u.is_verified ? '#333' : '#1d4ed8', color: '#fff',
                  }}>
                    {u.is_verified ? '✕ Unverify' : '✓ Verify'}
                  </button>
                  {!u.is_admin && (
                    <button onClick={() => deleteUser(u)} style={{
                      flex: 1, padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                      background: '#7f1d1d', color: '#fca5a5',
                    }}>
                      🗑️ Delete Account
                    </button>
                  )}
                </div>
                <button onClick={() => setSelectedUser(null)} style={{ width: '100%', marginTop: 8, padding: 10, background: 'none', border: '1px solid #333', borderRadius: 10, color: '#666', fontSize: 13, cursor: 'pointer' }}>
                  Close
                </button>
              </div>
            </div>
          )
        })()}

        {/* RIDES */}
        {tab === 'rides' && (
          <div>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>{rides.length} recent rides</div>
            {rides.map(r => (
              <div key={r.id} style={{ background: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{r.from_location} → {r.to_location}</div>
                    <div style={{ color: '#666', fontSize: 12, marginTop: 3 }}>
                      {r.profiles?.full_name} · {formatDate(r.ride_date)} · {formatTime(r.ride_time)}
                    </div>
                    <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>
                      ₹{r.fare} · {r.seats_available}/{r.seats_total} seats · {r.ride_type}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                      background: r.status === 'active' ? '#052e16' : r.status === 'full' ? '#1e3a5f' : '#3b0764',
                      color: r.status === 'active' ? '#22c55e' : r.status === 'full' ? '#60a5fa' : '#c084fc',
                    }}>● {r.status}</span>
                    {r.status === 'active' && (
                      <button onClick={() => cancelRideAdmin(r.id)}
                        style={{ padding: '4px 8px', background: '#3b0764', color: '#f0abfc', border: 'none', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* BOOKINGS */}
        {tab === 'bookings' && (
          <div>
            <div style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>{bookings.length} recent bookings</div>
            {bookings.map(b => (
              <div key={b.id} style={{ background: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{b.profiles?.full_name || 'Unknown'}</div>
                    <div style={{ color: '#666', fontSize: 12, marginTop: 3 }}>
                      Paid ₹{b.total_paid} · Owner gets ₹{b.driver_receives}
                    </div>
                    <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>
                      CarpoolKaro earned: ₹4 · {new Date(b.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, height: 'fit-content',
                    background: b.status === 'confirmed' ? '#052e16' : '#3b1212',
                    color: b.status === 'confirmed' ? '#22c55e' : '#f87171',
                  }}>● {b.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )}
  </div>
</div>

{/* Photo fullscreen viewer */}
{viewAdminPhoto && (
  <div onClick={() => setViewAdminPhoto(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <img src={viewAdminPhoto} alt="avatar" style={{ maxWidth: '88vw', maxHeight: '80vh', borderRadius: 16, objectFit: 'contain' }} />
    <button onClick={() => setViewAdminPhoto(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 24, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer' }}>✕</button>
  </div>
)}
```

</>
)
}
