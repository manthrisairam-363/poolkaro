import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { formatTime, formatDate } from '../lib/utils'

export default function AdminDashboard() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [rides, setRides] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [accessChecked, setAccessChecked] = useState(false)

  // Check admin access from DATABASE (not just email)
  const isAdmin = profile?.is_admin === true

  useEffect(() => {
    // Wait for profile to load before checking
    if (profile === null) return // still loading
    if (!profile?.is_admin) {
      navigate('/')
      return
    }
    fetchAll()
  }, [profile])

  async function fetchAll() {
    setLoading(true)
    const [usersRes, ridesRes, bookingsRes, walletsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('rides').select('*, profiles(full_name, phone)').order('created_at', { ascending: false }).limit(50),
      supabase.from('bookings').select('*, profiles!rider_id(full_name)').order('created_at', { ascending: false }).limit(50),
      supabase.from('wallets').select('balance'),
    ])

    const usersData = usersRes.data || []
    const ridesData = ridesRes.data || []
    const bookingsData = bookingsRes.data || []
    const walletsData = walletsRes.data || []

    const totalWalletBalance = walletsData.reduce((sum, w) => sum + (w.balance || 0), 0)
    const confirmedBookings = bookingsData.filter(b => b.payment_status === 'paid')
    const totalRevenue = confirmedBookings.length * 4 // ₹4 per booking

    setStats({
      totalUsers: usersData.length,
      totalRides: ridesData.length,
      activeRides: ridesData.filter(r => r.status === 'active').length,
      totalBookings: confirmedBookings.length,
      totalRevenue,
      totalWalletBalance: totalWalletBalance / 100,
      todayRides: ridesData.filter(r => r.ride_date === new Date().toISOString().split('T')[0]).length,
    })
    setUsers(usersData)
    setRides(ridesData)
    setBookings(bookingsData)
    setLoading(false)
  }

  async function toggleVerified(userId, current) {
    await supabase.from('profiles').update({ is_verified: !current }).eq('id', userId)
    fetchAll()
  }

  async function cancelRideAdmin(rideId) {
    if (!confirm('Cancel this ride?')) return
    await supabase.from('rides').update({ status: 'cancelled' }).eq('id', rideId)
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('ride_id', rideId)
    fetchAll()
  }

  if (!isAdmin) return null

  const tabStyle = (v) => ({
    padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
    background: tab === v ? '#facc15' : '#222',
    color: tab === v ? '#111' : '#888',
    fontWeight: tab === v ? 700 : 400, fontSize: 12,
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: '#111', padding: '20px 16px 16px', borderBottom: '1px solid #222' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>←</button>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>⚙️ Admin Dashboard</div>
            <div style={{ color: '#666', fontSize: 11 }}>CarpoolKaro Control Panel</div>
          </div>
          <button onClick={fetchAll} style={{ marginLeft: 'auto', background: '#222', border: 'none', color: '#facc15', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>
            ↺ Refresh
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {[['overview','📊 Overview'],['users','👥 Users'],['rides','🚗 Rides'],['bookings','🎫 Bookings']].map(([v,l]) => (
            <button key={v} onClick={() => setTab(v)} style={tabStyle(v)}>{l}</button>
          ))}
        </div>
      </div>

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
                    ['🚗', 'Total Rides', stats.totalRides, '#7c3aed'],
                    ['✅', 'Active Rides', stats.activeRides, '#16a34a'],
                    ['🎫', 'Bookings', stats.totalBookings, '#d97706'],
                    ['💰', 'Revenue (₹)', stats.totalRevenue, '#16a34a'],
                    ['🏦', 'Wallet Pool (₹)', Math.round(stats.totalWalletBalance), '#2563eb'],
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
                    <span style={{ fontWeight: 700, color: '#16a34a' }}>₹{stats.todayRides * 4}</span>
                  </div>
                </div>
              </>
            )}

            {/* USERS */}
            {tab === 'users' && (
              <div>
                <div style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>{users.length} total users</div>
                {users.map(u => (
                  <div key={u.id} style={{ background: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #222' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{u.full_name || 'No name'}</span>
                          {u.is_verified && <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>✓ VERIFIED</span>}
                        </div>
                        <div style={{ color: '#666', fontSize: 12, marginTop: 3 }}>{u.phone} · {u.email?.slice(0, 20)}</div>
                        <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>
                          {u.role} · {u.vehicle_model || 'No vehicle'} · ⭐{u.avg_rating || 0}
                        </div>
                        <div style={{ color: '#444', fontSize: 10, marginTop: 2 }}>
                          Joined: {new Date(u.created_at).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleVerified(u.id, u.is_verified)}
                        style={{
                          padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          background: u.is_verified ? '#1d4ed8' : '#333',
                          color: u.is_verified ? '#fff' : '#888',
                        }}>
                        {u.is_verified ? '✓ Verified' : 'Verify'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

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
  )
}
