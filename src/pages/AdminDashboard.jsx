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
  const [wallets, setWallets] = useState({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  const isAdmin = profile?.is_admin === true

  useEffect(() => {
    if (profile === undefined) return // still loading
    if (!profile?.is_admin) { navigate('/'); return }
    fetchAll()
  }, [profile])

  async function fetchAll() {
    setLoading(true)
    try {
      const [usersRes, ridesRes, bookingsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('rides').select('*, profiles(full_name, phone)').order('created_at', { ascending: false }).limit(100),
        supabase.from('bookings').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(100),
      ])

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
                <div style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>{users.length} total users</div>
                {users.map(u => (
                  <div key={u.id} style={{ background: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #222' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{u.full_name || 'No name'}</span>
                          {u.is_verified && <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>✓ VERIFIED</span>}
                          {u.work_email_verified && <span style={{ background: '#16a34a', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 10, fontWeight: 700 }}>🏢 WORK</span>}
                        </div>
                        <div style={{ color: '#666', fontSize: 12, marginTop: 3 }}>{u.phone} · {u.email?.slice(0, 25)}</div>
                        {u.work_email && <div style={{ color: '#16a34a', fontSize: 11, marginTop: 2 }}>🏢 {u.work_email}</div>}
                        {u.referral_code && (
                          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                            🎁 Code: <span style={{ color: '#facc15', fontWeight: 700 }}>{u.referral_code}</span>
                            {u.referred_by && <span style={{ color: '#888' }}> · Referred by: {users.find(x => x.referral_code === u.referred_by)?.full_name || u.referred_by}</span>}
                          </div>
                        )}
                        <div style={{ color: '#555', fontSize: 11, marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <span>🚗 {u.total_rides_given || 0} given</span>
                          <span>🙋 {u.total_rides_taken || 0} taken</span>
                          <span>⭐ {Number(u.avg_rating || 0).toFixed(1)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                          <span style={{
                            background: wallets[u.id] > 5 ? '#14532d' : wallets[u.id] > 0 ? '#422006' : '#3b0764',
                            color: wallets[u.id] > 5 ? '#4ade80' : wallets[u.id] > 0 ? '#fb923c' : '#c084fc',
                            fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                          }}>
                            💰 ₹{wallets[u.id] ?? '—'}
                          </span>
                          <span style={{ color: '#444', fontSize: 10 }}>
                            Joined {new Date(u.created_at).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleVerified(u.id, u.is_verified)}
                        style={{
                          padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                          background: u.is_verified ? '#1d4ed8' : '#333',
                          color: u.is_verified ? '#fff' : '#888', flexShrink: 0, marginLeft: 8,
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
