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
  const [selectedUser, setSelectedUser] = useState(null)
  const [viewAdminPhoto, setViewAdminPhoto] = useState(null)
  const [search, setSearch] = useState('')
  const [topupAmount, setTopupAmount] = useState('')
  const [topupNote, setTopupNote] = useState('')
  const [topupLoading, setTopupLoading] = useState(false)
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastMsg, setBroadcastMsg] = useState('')
  const [broadcastLoading, setBroadcastLoading] = useState(false)
  const [broadcastSent, setBroadcastSent] = useState(null)
  const [revenueData, setRevenueData] = useState([])
  const [popularRoutes, setPopularRoutes] = useState([])
  const [reports, setReports] = useState([])
  const [userFilter, setUserFilter] = useState('all')
  const [userSort, setUserSort] = useState('joined_desc')
  const [feedbackList, setFeedbackList] = useState([])
  const [replyText, setReplyText] = useState({})
  const [replyingTo, setReplyingTo] = useState(null)

  const isAdmin = profile?.is_admin === true

  useEffect(() => {
    if (profile === undefined) return
    if (!profile?.is_admin) { navigate('/'); return }
    fetchAll()
  }, [profile])

  async function fetchAll() {
    setLoading(true)
    try {
      const [usersRes, ridesRes, bookingsRes, txnRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('rides').select('*, profiles(full_name, phone)').order('created_at', { ascending: false }).limit(200),
        supabase.from('bookings').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(200),
        supabase.from('wallet_transactions').select('created_at').eq('type', 'booking_fee').gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString()),
      ])

      const usersData = usersRes.data || []
      const ridesData = ridesRes.data || []
      const bookingsData = bookingsRes.data || []
      const txnData = txnRes.data || []

      const confirmedBookings = bookingsData.filter(b => b.status === 'confirmed')
      const cancelledBookings = bookingsData.filter(b => b.status === 'cancelled')
      const totalRevenue = confirmedBookings.length * 4

      const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
      const todayIST = istNow.toISOString().split('T')[0]

      const { data: walletsData } = await supabase.from('wallets').select('user_id, balance')
      const walletMap = {}
      ;(walletsData || []).forEach(w => { walletMap[w.user_id] = w.balance })
      setWallets(walletMap)

      const totalWalletBalance = (walletsData || []).reduce((s, w) => s + (w.balance || 0), 0)

      // Revenue chart — count booking_fee txns per day (each pair = ₹4)
      const dayMap = {}
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000)
        const key = d.toISOString().split('T')[0]
        dayMap[key] = 0
      }
      txnData.forEach(t => {
        const key = t.created_at?.split('T')[0]
        if (key && dayMap[key] !== undefined) dayMap[key]++
      })
      const rev = Object.entries(dayMap).map(([date, count]) => ({
        date, revenue: Math.floor(count / 2) * 4,
        label: new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      }))
      setRevenueData(rev)

      // Popular routes
      const routeMap = {}
      ridesData.forEach(r => {
        if (!r.from_location?.startsWith('TEST_')) {
          const key = `${r.from_location} → ${r.to_location}`
          routeMap[key] = (routeMap[key] || 0) + 1
        }
      })
      const routes = Object.entries(routeMap).sort((a, b) => b[1] - a[1]).slice(0, 8)
      setPopularRoutes(routes)

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

      // Fetch reports
      const { data: reportsData } = await supabase
        .from('reported_messages')
        .select('*, reporter:profiles!reported_messages_reported_by_fkey(full_name)')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
      setReports(reportsData || [])

      // Fetch feedback
      const { data: fbData } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })

      if (fbData?.length) {
        // Get profile info for each feedback user
        const userIds = [...new Set(fbData.map(f => f.user_id))]
        const { data: fbProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', userIds)
        const profileMap = {}
        ;(fbProfiles || []).forEach(p => { profileMap[p.id] = p })
        setFeedbackList(fbData.map(f => ({ ...f, profiles: profileMap[f.user_id] || null })))
      } else {
        setFeedbackList([])
      }
    } catch (err) {
      console.error('Admin fetch error:', err.message)
    } finally {
      setLoading(false)
    }
  }

  async function toggleVerified(userId, current) {
    await supabase.rpc('admin_toggle_verified', { p_user_id: userId, p_verified: !current })
    setSelectedUser(prev => prev?.id === userId ? { ...prev, is_verified: !current } : prev)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_verified: !current } : u))
  }

  async function deleteUser(u) {
    if (!confirm(`⚠️ DELETE ${u.full_name || u.email}?\n\nThis permanently removes their account. Cannot be undone.`)) return
    await supabase.from('bookings').delete().eq('rider_id', u.id)
    await supabase.from('rides').delete().eq('driver_id', u.id)
    await supabase.from('wallets').delete().eq('user_id', u.id)
    await supabase.from('profiles').delete().eq('id', u.id)
    setSelectedUser(null)
    fetchAll()
  }

  async function cancelRideAdmin(rideId) {
    if (!confirm('Cancel this ride?')) return
    await supabase.from('rides').update({ status: 'cancelled' }).eq('id', rideId)
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('ride_id', rideId)
    fetchAll()
  }

  async function handleTopup() {
    if (!selectedUser || !topupAmount || !topupNote) return
    const amt = Math.round(parseFloat(topupAmount) * 100)
    if (isNaN(amt) || amt <= 0) return alert('Enter valid amount')
    setTopupLoading(true)
    await supabase.rpc('admin_credit_wallet', {
      p_user_id: selectedUser.id,
      p_amount: amt,
      p_description: topupNote,
    })
    await supabase.from('notifications').insert({
      user_id: selectedUser.id,
      title: '💰 Wallet Credited!',
      message: `₹${parseFloat(topupAmount).toFixed(0)} added to your wallet. Note: ${topupNote}`,
      type: 'booking', is_read: false,
    })
    setWallets(prev => ({ ...prev, [selectedUser.id]: (prev[selectedUser.id] || 0) + amt }))
    setTopupAmount(''); setTopupNote('')
    setTopupLoading(false)
    alert(`✅ ₹${parseFloat(topupAmount).toFixed(0)} added to ${selectedUser.full_name}'s wallet!`)
  }

  async function handleBroadcast() {
    if (!broadcastTitle || !broadcastMsg) return alert('Fill title and message')
    if (!confirm(`Send to ALL users?\n\nTitle: ${broadcastTitle}\nMessage: ${broadcastMsg}`)) return
    setBroadcastLoading(true)
    const { data } = await supabase.rpc('admin_broadcast_notification', {
      p_title: broadcastTitle, p_message: broadcastMsg
    })
    setBroadcastSent(data)
    setBroadcastLoading(false)
    setBroadcastTitle(''); setBroadcastMsg('')
  }

  function exportCSV() {
    const rows = [['Name', 'Email', 'Phone', 'Role', 'Verified', 'Wallet (₹)', 'Rides Given', 'Rides Taken', 'Rating', 'Referral Code', 'Referred By', 'Joined']]
    users.forEach(u => rows.push([
      u.full_name || '', u.email || '', u.phone || '',
      u.role || '', u.is_verified ? 'Yes' : 'No',
      Math.round((wallets[u.id] || 0) / 100),
      u.total_rides_given || 0, u.total_rides_taken || 0,
      Number(u.avg_rating || 0).toFixed(1),
      u.referral_code || '', u.referred_by || '',
      new Date(u.created_at).toLocaleDateString('en-IN'),
    ]))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `carpoolkaro_users_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // Suspicious users detection
  const phoneGroups = {}
  users.forEach(u => { if (u.phone) phoneGroups[u.phone] = [...(phoneGroups[u.phone] || []), u.id] })
  const duplicatePhones = new Set(Object.values(phoneGroups).filter(ids => ids.length > 1).flat())

  const suspiciousUsers = users.filter(u =>
    (u.cancellation_count || 0) >= 4 ||
    duplicatePhones.has(u.id) ||
    ((wallets[u.id] || 0) > 50000 && (u.total_rides_given || 0) === 0 && (u.total_rides_taken || 0) === 0)
  ).map(u => ({
    ...u,
    flags: [
      (u.cancellation_count || 0) >= 4 ? `🚫 ${u.cancellation_count} cancellations` : null,
      duplicatePhones.has(u.id) ? '📱 Duplicate phone' : null,
      ((wallets[u.id] || 0) > 50000 && !u.total_rides_given && !u.total_rides_taken) ? '💰 High wallet, no rides' : null,
    ].filter(Boolean)
  }))

  function getFilteredSortedUsers() {
    const now = new Date()
    const weekAgo = new Date(now - 7 * 86400000)
    let list = users.filter(u => {
      const q = search.toLowerCase()
      const matchSearch = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phone?.includes(q)
      if (!matchSearch) return false
      if (userFilter === 'pro') return u.subscription_expires_at && new Date(u.subscription_expires_at) > now
      if (userFilter === 'free') return !u.subscription_expires_at || new Date(u.subscription_expires_at) <= now
      if (userFilter === 'verified') return u.is_verified
      if (userFilter === 'active_week') return u.last_seen_at && new Date(u.last_seen_at) > weekAgo
      if (userFilter === 'low_balance') return (wallets[u.id] || 0) < 500
      if (userFilter === 'no_rides') return (u.total_rides_given || 0) === 0 && (u.total_rides_taken || 0) === 0
      if (userFilter === 'referred') return !!u.referred_by
      return true
    })
    list = [...list].sort((a, b) => {
      if (userSort === 'joined_desc') return new Date(b.created_at) - new Date(a.created_at)
      if (userSort === 'joined_asc') return new Date(a.created_at) - new Date(b.created_at)
      if (userSort === 'last_seen') return new Date(b.last_seen_at || 0) - new Date(a.last_seen_at || 0)
      if (userSort === 'balance_desc') return (wallets[b.id] || 0) - (wallets[a.id] || 0)
      if (userSort === 'balance_asc') return (wallets[a.id] || 0) - (wallets[b.id] || 0)
      if (userSort === 'rides_desc') return (b.total_rides_given || 0) - (a.total_rides_given || 0)
      if (userSort === 'cancellations_desc') return (b.cancellation_count || 0) - (a.cancellation_count || 0)
      if (userSort === 'referrals_desc') return (b.referral_count || 0) - (a.referral_count || 0)
      return 0
    })
    return list
  }

  if (!isAdmin) return null

  const tabStyle = (v) => ({
    padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
    background: tab === v ? '#facc15' : '#222', color: tab === v ? '#111' : '#888',
    fontWeight: tab === v ? 700 : 400, fontSize: 12,
  })

  const maxRevenue = Math.max(...revenueData.map(d => d.revenue), 1)

  const QUICK_NOTES = [
    '🎁 New Year Bonus',
    '🎉 Festive Bonus',
    '🙏 Compensation for issue',
    '🚀 Early adopter reward',
    '🎯 Referral makeup bonus',
    '💝 Thank you gift',
  ]

  const BROADCAST_TEMPLATES = [
    { title: '🚗 New Routes Available!', msg: 'New carpool routes are available in your area. Check the app for rides near you!' },
    { title: '🎉 Weekend Offer!', msg: 'Post or book a ride this weekend and earn bonus wallet credits. Happy carpooling!' },
    { title: '💰 Payday Special!', msg: "It's payday! Share rides this month and save ₹3,000+. Invite colleagues and earn ₹10 each!" },
    { title: '🌿 Go Green This Week', msg: 'Every carpool saves 2kg of CO₂. Join the movement — post or book a ride today!' },
    { title: '⭐ Rate Your Rides', msg: 'Have you rated your recent co-riders? Good ratings build trust in our community!' },
  ]

  function UserDetailPanel({ u }) {
    return (
      <div onClick={() => setSelectedUser(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
        <div onClick={e => e.stopPropagation()} style={{ background: '#111', borderRadius: '20px 20px 0 0', padding: 20, width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '90vh', overflowY: 'auto' }}>
          <div style={{ width: 40, height: 4, background: '#333', borderRadius: 2, margin: '0 auto 20px' }} />

          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            {u.avatar_url ? (
              <img src={u.avatar_url} onClick={() => setViewAdminPhoto(u.avatar_url)} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', marginBottom: 10 }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#222', color: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 28, margin: '0 auto 10px' }}>
                {u.full_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div style={{ fontWeight: 800, fontSize: 18 }}>{u.full_name || 'No name'}</div>
            <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{u.email}</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              {u.is_verified && <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 10, padding: '3px 8px', borderRadius: 10, fontWeight: 700 }}>✓ Verified</span>}
              {u.work_email_verified && <span style={{ background: '#7c3aed', color: '#fff', fontSize: 10, padding: '3px 8px', borderRadius: 10, fontWeight: 700 }}>🏢 Work</span>}
              {u.is_admin && <span style={{ background: '#facc15', color: '#111', fontSize: 10, padding: '3px 8px', borderRadius: 10, fontWeight: 700 }}>👑 Admin</span>}
              {suspiciousUsers.find(s => s.id === u.id) && <span style={{ background: '#7f1d1d', color: '#fca5a5', fontSize: 10, padding: '3px 8px', borderRadius: 10, fontWeight: 700 }}>⚠️ Flagged</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            {[
              ['📱 Phone', u.phone || '—'],
              ['💰 Wallet', `₹${Math.round((wallets[u.id] || 0) / 100)}`],
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

          {u.work_email && (
            <div style={{ background: '#0a2e1a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, border: '1px solid #166534' }}>
              <div style={{ fontSize: 10, color: '#16a34a' }}>🏢 VERIFIED WORK EMAIL</div>
              <div style={{ fontSize: 13, color: '#4ade80', fontWeight: 600, marginTop: 2 }}>{u.work_email}</div>
            </div>
          )}

          {u.emergency_contact_phone && (
            <div style={{ background: '#2a0a0a', borderRadius: 8, padding: '8px 12px', marginBottom: 10, border: '1px solid #7f1d1d' }}>
              <div style={{ fontSize: 10, color: '#f87171' }}>🆘 EMERGENCY CONTACT</div>
              <div style={{ fontSize: 13, color: '#fca5a5', fontWeight: 600, marginTop: 2 }}>{u.emergency_contact_name} · {u.emergency_contact_phone}</div>
            </div>
          )}

          {u.referred_by && (
            <div style={{ background: '#1a1a1a', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#888' }}>🎁 REFERRED BY CODE</div>
              <div style={{ fontSize: 13, color: '#facc15', fontWeight: 700, marginTop: 2 }}>{u.referred_by} → {users.find(x => x.referral_code === u.referred_by)?.full_name || 'Unknown'}</div>
            </div>
          )}

          {/* Suspicious flags */}
          {suspiciousUsers.find(s => s.id === u.id) && (
            <div style={{ background: '#2a0a0a', borderRadius: 8, padding: '10px 12px', marginBottom: 10, border: '1px solid #7f1d1d' }}>
              <div style={{ fontSize: 10, color: '#f87171', fontWeight: 700, marginBottom: 6 }}>⚠️ FRAUD FLAGS</div>
              {suspiciousUsers.find(s => s.id === u.id)?.flags.map(f => (
                <div key={f} style={{ fontSize: 12, color: '#fca5a5', marginBottom: 3 }}>• {f}</div>
              ))}
            </div>
          )}

          <div style={{ color: '#444', fontSize: 11, textAlign: 'center', marginBottom: 16 }}>
            Member since {new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>

          {/* Wallet Top-up */}
          <div style={{ background: '#0a1a0a', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid #166534' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#4ade80', marginBottom: 10 }}>💰 Add Wallet Credit</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {[10, 20, 50, 100].map(amt => (
                <button key={amt} onClick={() => setTopupAmount(String(amt))} style={{
                  padding: '5px 12px', borderRadius: 8, border: topupAmount === String(amt) ? '2px solid #4ade80' : '1px solid #333',
                  background: topupAmount === String(amt) ? '#052e16' : '#111', color: '#fff', fontSize: 12, cursor: 'pointer'
                }}>₹{amt}</button>
              ))}
              <input value={topupAmount} onChange={e => setTopupAmount(e.target.value)} placeholder="Custom ₹"
                style={{ width: 80, padding: '5px 8px', borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 12 }} />
            </div>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>Quick notes:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              {QUICK_NOTES.map(n => (
                <button key={n} onClick={() => setTopupNote(n)} style={{
                  padding: '4px 8px', borderRadius: 8, border: topupNote === n ? '2px solid #4ade80' : '1px solid #333',
                  background: topupNote === n ? '#052e16' : '#111', color: '#aaa', fontSize: 10, cursor: 'pointer'
                }}>{n}</button>
              ))}
            </div>
            <input value={topupNote} onChange={e => setTopupNote(e.target.value)} placeholder="Or type a custom note..."
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 12, marginBottom: 10, boxSizing: 'border-box' }} />
            <button onClick={handleTopup} disabled={topupLoading || !topupAmount || !topupNote} style={{
              width: '100%', padding: 10, borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: (!topupAmount || !topupNote) ? '#333' : '#16a34a', color: '#fff',
            }}>
              {topupLoading ? 'Adding...' : `✓ Add ₹${topupAmount || '0'} to Wallet`}
            </button>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
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
          <button onClick={() => setSelectedUser(null)} style={{ width: '100%', padding: 10, background: 'none', border: '1px solid #333', borderRadius: 10, color: '#666', fontSize: 13, cursor: 'pointer' }}>
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: '#111', padding: '20px 16px 16px', borderBottom: '1px solid #222' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>←</button>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>⚙️ Admin Dashboard</div>
            <div style={{ color: '#666', fontSize: 11 }}>CarpoolKaro Control Panel</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={exportCSV} style={{ background: '#222', border: 'none', color: '#4ade80', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
              📥 CSV
            </button>
            <button onClick={fetchAll} style={{ background: '#222', border: 'none', color: '#facc15', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>
              ↺
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {[
            ['overview','📊'],['users','👥'],['suspicious','⚠️'],
            ['rides','🚗'],['bookings','🎫'],['broadcast','📢'],
            ['reports','🚨'],['feedback','💡']
          ].map(([v,l]) => (
            <button key={v} onClick={() => setTab(v)} style={tabStyle(v)}>
              {l} {v === 'suspicious' && suspiciousUsers.length > 0 ? `(${suspiciousUsers.length})` : v === 'reports' && reports.length > 0 ? `(${reports.length})` : v === 'feedback' && feedbackList.filter(f => f.status === 'open').length > 0 ? `(${feedbackList.filter(f => f.status === 'open').length})` : v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
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
                    ['✅', 'Verified', stats.verifiedUsers, '#16a34a'],
                    ['🏢', 'Work Verified', stats.workVerifiedUsers, '#7c3aed'],
                    ['🚗', 'Active Rides', stats.activeRides, '#d97706'],
                    ['🎫', 'Bookings', stats.totalBookings, '#0891b2'],
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

                {/* Today's Activity */}
                <div style={{ background: '#1a1a1a', borderRadius: 14, padding: 16, border: '1px solid #222', marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 12, color: '#facc15' }}>📅 Today's Activity</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222' }}>
                    <span style={{ color: '#888', fontSize: 13 }}>🚗 Rides posted today</span>
                    <span style={{ fontWeight: 700 }}>{stats.todayRides}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                    <span style={{ color: '#888', fontSize: 13 }}>💰 Revenue today</span>
                    <span style={{ fontWeight: 700, color: '#16a34a' }}>₹{stats.todayRevenue}</span>
                  </div>
                </div>

                {/* Revenue Chart */}
                <div style={{ background: '#1a1a1a', borderRadius: 14, padding: 16, border: '1px solid #222', marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, marginBottom: 16, color: '#facc15' }}>📊 Revenue — Last 30 Days</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, overflowX: 'auto' }}>
                    {revenueData.map((d, i) => (
                      <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 18 }}>
                        <div style={{
                          width: '100%', background: d.revenue > 0 ? '#16a34a' : '#222',
                          height: Math.max(3, (d.revenue / maxRevenue) * 64), borderRadius: '3px 3px 0 0',
                          transition: '0.2s',
                        }} title={`${d.label}: ₹${d.revenue}`} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontSize: 9, color: '#444' }}>{revenueData[0]?.label}</span>
                    <span style={{ fontSize: 9, color: '#444' }}>{revenueData[revenueData.length-1]?.label}</span>
                  </div>
                  <div style={{ textAlign: 'center', fontSize: 11, color: '#666', marginTop: 4 }}>
                    Total: ₹{revenueData.reduce((s, d) => s + d.revenue, 0)} this month
                  </div>
                </div>

                {/* Popular Routes */}
                <div style={{ background: '#1a1a1a', borderRadius: 14, padding: 16, border: '1px solid #222' }}>
                  <div style={{ fontWeight: 700, marginBottom: 12, color: '#facc15' }}>🗺️ Popular Routes</div>
                  {popularRoutes.length === 0 ? (
                    <div style={{ color: '#666', fontSize: 13 }}>No ride data yet</div>
                  ) : popularRoutes.map(([route, count], i) => (
                    <div key={route} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < popularRoutes.length-1 ? '1px solid #222' : 'none' }}>
                      <div style={{ fontSize: 12, color: '#ccc' }}>
                        <span style={{ color: '#facc15', fontWeight: 700, marginRight: 8 }}>#{i+1}</span>{route}
                      </div>
                      <span style={{ background: '#222', padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, color: '#facc15' }}>{count} rides</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* USERS */}
            {tab === 'users' && (
              <div>
                {/* Search */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search name, email or phone..."
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 13 }} />
                  {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 18, cursor: 'pointer' }}>✕</button>}
                </div>

                {/* Filter chips */}
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10, paddingBottom: 4, scrollbarWidth: 'none' }}>
                  {[
                    ['all', 'All'],
                    ['pro', '⭐ Pro'],
                    ['free', '🆓 Free'],
                    ['verified', '✓ Verified'],
                    ['active_week', '👁 Active this week'],
                    ['low_balance', '⚠️ Low balance'],
                    ['no_rides', '😴 No rides'],
                    ['referred', '🎁 Referred'],
                  ].map(([f, label]) => (
                    <button key={f} onClick={() => setUserFilter(f)} style={{
                      padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700,
                      background: userFilter === f ? '#facc15' : '#1a1a1a', color: userFilter === f ? '#111' : '#666',
                    }}>{label}</button>
                  ))}
                </div>

                {/* Sort */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#555', flexShrink: 0 }}>Sort by:</span>
                  <select value={userSort} onChange={e => setUserSort(e.target.value)} style={{ flex: 1, padding: '7px 10px', borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 12 }}>
                    <option value="joined_desc">Joined (newest first)</option>
                    <option value="joined_asc">Joined (oldest first)</option>
                    <option value="last_seen">Last active</option>
                    <option value="balance_desc">Balance (highest)</option>
                    <option value="balance_asc">Balance (lowest)</option>
                    <option value="rides_desc">Most rides given</option>
                    <option value="cancellations_desc">Most cancellations</option>
                    <option value="referrals_desc">Most referrals</option>
                  </select>
                </div>

                <div style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>
                  {getFilteredSortedUsers().length} {search || userFilter !== 'all' ? 'results' : 'total users'}
                </div>

                {getFilteredSortedUsers().map(u => (
                  <div key={u.id} onClick={() => setSelectedUser(u)} style={{ background: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #222', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#333', color: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0, overflow: 'hidden' }}>
                      {u.avatar_url ? <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : u.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{u.full_name || 'No name'}</span>
                        {u.is_verified && <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 9, padding: '2px 5px', borderRadius: 8, fontWeight: 700 }}>✓</span>}
                        {u.subscription_expires_at && new Date(u.subscription_expires_at) > new Date() && <span style={{ background: '#facc15', color: '#111', fontSize: 9, padding: '2px 5px', borderRadius: 8, fontWeight: 700 }}>⭐</span>}
                        {suspiciousUsers.find(s => s.id === u.id) && <span style={{ background: '#7f1d1d', color: '#fca5a5', fontSize: 9, padding: '2px 5px', borderRadius: 8, fontWeight: 700 }}>⚠️</span>}
                      </div>
                      <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>{u.phone} · {u.email?.slice(0,25)}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                        <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 700 }}>₹{Math.round((wallets[u.id] || 0) / 100)}</span>
                        <span style={{ color: '#555', fontSize: 11 }}>🚗 {u.total_rides_given || 0} · 🙋 {u.total_rides_taken || 0}</span>
                        <span style={{ color: '#555', fontSize: 11, marginLeft: 'auto' }}>
                          {u.last_seen_at
                            ? `👁 ${new Date(u.last_seen_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                            : `📅 ${new Date(u.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SUSPICIOUS */}
            {tab === 'suspicious' && (
              <div>
                <div style={{ background: '#2a0a0a', borderRadius: 12, padding: 14, marginBottom: 16, border: '1px solid #7f1d1d' }}>
                  <div style={{ fontWeight: 700, color: '#fca5a5', marginBottom: 8 }}>⚠️ Fraud Detection</div>
                  <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
                    Flagging users with: 4+ cancellations, duplicate phone numbers, or unusually high wallet with zero rides.
                  </div>
                </div>
                {suspiciousUsers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#4ade80', fontSize: 20 }}>
                    ✅ No suspicious users detected
                  </div>
                ) : suspiciousUsers.map(u => (
                  <div key={u.id} onClick={() => setSelectedUser(u)} style={{ background: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #7f1d1d', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{u.full_name || 'No name'}</div>
                        <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{u.phone} · {u.email?.slice(0,25)}</div>
                      </div>
                      <span style={{ fontSize: 11, color: '#f87171', background: '#3b0000', padding: '3px 8px', borderRadius: 8 }}>Tap to action</span>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      {u.flags.map(f => (
                        <div key={f} style={{ fontSize: 12, color: '#fca5a5', marginTop: 4 }}>• {f}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* RIDES */}
            {tab === 'rides' && (
              <div>
                <div style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>{rides.filter(r => !r.from_location?.startsWith('TEST_')).length} rides</div>
                {rides.filter(r => !r.from_location?.startsWith('TEST_')).map(r => (
                  <div key={r.id} style={{ background: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #222' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{r.from_location} → {r.to_location}</div>
                        <div style={{ color: '#666', fontSize: 12, marginTop: 3 }}>{r.profiles?.full_name} · {formatDate(r.ride_date)} · {formatTime(r.ride_time)}</div>
                        <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>₹{r.fare} · {r.seats_available}/{r.seats_total} seats · {r.ride_type}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: r.status === 'active' ? '#052e16' : r.status === 'full' ? '#1e3a5f' : '#3b0764', color: r.status === 'active' ? '#22c55e' : r.status === 'full' ? '#60a5fa' : '#c084fc' }}>● {r.status}</span>
                        {r.status === 'active' && <button onClick={() => cancelRideAdmin(r.id)} style={{ padding: '4px 8px', background: '#3b0764', color: '#f0abfc', border: 'none', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>Cancel</button>}
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
                        <div style={{ color: '#666', fontSize: 12, marginTop: 3 }}>Paid ₹{b.total_paid} · Owner gets ₹{b.driver_receives}</div>
                        <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>CarpoolKaro earned: ₹4 · {new Date(b.created_at).toLocaleDateString('en-IN')}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, height: 'fit-content', background: b.status === 'confirmed' ? '#052e16' : '#3b1212', color: b.status === 'confirmed' ? '#22c55e' : '#f87171' }}>● {b.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* BROADCAST */}
            {tab === 'broadcast' && (
              <div>
                <div style={{ background: '#111827', borderRadius: 14, padding: 16, border: '1px solid #1f2937', marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: '#facc15', marginBottom: 4 }}>📢 Broadcast to All Users</div>
                  <div style={{ fontSize: 12, color: '#666' }}>Sends a push notification to all {stats?.totalUsers} users</div>
                </div>

                {/* Templates */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Quick Templates:</div>
                  {BROADCAST_TEMPLATES.map(t => (
                    <div key={t.title} onClick={() => { setBroadcastTitle(t.title); setBroadcastMsg(t.msg) }} style={{ background: '#1a1a1a', borderRadius: 10, padding: '10px 14px', marginBottom: 8, cursor: 'pointer', border: broadcastTitle === t.title ? '1px solid #facc15' : '1px solid #222' }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{t.title}</div>
                      <div style={{ color: '#666', fontSize: 11, marginTop: 3 }}>{t.msg.slice(0, 60)}...</div>
                    </div>
                  ))}
                </div>

                {/* Custom message */}
                <div style={{ background: '#1a1a1a', borderRadius: 14, padding: 16, border: '1px solid #333' }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Or write custom message:</div>
                  <input value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} placeholder="Notification title..."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 13, marginBottom: 10, boxSizing: 'border-box' }} />
                  <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Message body..."
                    rows={4} style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 13, marginBottom: 12, boxSizing: 'border-box', resize: 'vertical' }} />

                  {broadcastSent !== null && (
                    <div style={{ background: '#052e16', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#4ade80', fontSize: 13, fontWeight: 700 }}>
                      ✅ Sent to {broadcastSent} users!
                    </div>
                  )}

                  <button onClick={handleBroadcast} disabled={broadcastLoading || !broadcastTitle || !broadcastMsg} style={{
                    width: '100%', padding: 14, borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 15,
                    background: (!broadcastTitle || !broadcastMsg) ? '#333' : '#facc15', color: '#111',
                  }}>
                    {broadcastLoading ? 'Sending...' : `📢 Send to All ${stats?.totalUsers} Users`}
                  </button>
                </div>
              </div>
            )}

            {/* REPORTS */}
            {tab === 'reports' && (
              <div>
                <div style={{ background: '#2a0a0a', borderRadius: 12, padding: 14, marginBottom: 16, border: '1px solid #7f1d1d' }}>
                  <div style={{ fontWeight: 700, color: '#fca5a5', marginBottom: 4 }}>🚨 Reported Messages</div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    Users flagged these messages for sharing phone numbers or contact info.
                    You can warn or delete the offending user's account.
                  </div>
                </div>

                {reports.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#4ade80', fontSize: 20 }}>
                    ✅ No reports pending
                  </div>
                ) : reports.map(r => {
                  const offender = users.find(u => {
                    // Find user who sent this message via booking
                    return false // we'll show booking ID for now
                  })
                  return (
                    <div key={r.id} style={{ background: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #7f1d1d' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: '#666' }}>
                          Reported by: <span style={{ color: '#fca5a5' }}>{r.reporter?.full_name || 'Unknown'}</span>
                        </div>
                        <div style={{ fontSize: 10, color: '#555' }}>
                          {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div style={{ background: '#2a0a0a', borderRadius: 8, padding: '10px 12px', marginBottom: 10, border: '1px solid #450a0a' }}>
                        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Reported message:</div>
                        <div style={{ fontSize: 13, color: '#fca5a5' }}>"{r.message_text}"</div>
                      </div>

                      <div style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>
                        Booking ID: {r.booking_id?.slice(0, 8)}...
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={async () => {
                          // Warn user — send notification to all in this booking
                          const { data: booking } = await supabase.from('bookings').select('rider_id, rides(driver_id)').eq('id', r.booking_id).single()
                          const userIds = [booking?.rider_id, booking?.rides?.driver_id].filter(Boolean)
                          for (const uid of userIds) {
                            await supabase.from('notifications').insert({
                              user_id: uid,
                              title: '⚠️ Account Warning',
                              message: 'Sharing phone numbers or contact info in chat violates our terms. Repeated violations will result in account deletion.',
                              type: 'booking', is_read: false,
                            })
                          }
                          await supabase.from('reported_messages').update({ resolved: true }).eq('id', r.id)
                          setReports(prev => prev.filter(x => x.id !== r.id))
                          alert('⚠️ Warning sent to both users in this booking.')
                        }} style={{ flex: 1, padding: '10px', background: '#78350f', color: '#fed7aa', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                          ⚠️ Warn Both Users
                        </button>
                        <button onClick={async () => {
                          await supabase.from('reported_messages').update({ resolved: true }).eq('id', r.id)
                          setReports(prev => prev.filter(x => x.id !== r.id))
                        }} style={{ flex: 1, padding: '10px', background: '#222', color: '#888', border: '1px solid #333', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
                          ✓ Dismiss
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            {/* FEEDBACK */}
            {tab === 'feedback' && (
              <div>
                <div style={{ background: '#1a1200', borderRadius: 12, padding: 14, marginBottom: 16, border: '1px solid #2a1f00' }}>
                  <div style={{ fontWeight: 700, color: '#facc15', marginBottom: 4 }}>💡 User Feedback & Suggestions</div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {feedbackList.filter(f => f.status === 'open').length} pending · {feedbackList.filter(f => f.status === 'replied').length} replied · {feedbackList.length} total
                  </div>
                </div>

                {/* Filter bar */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, overflowX: 'auto' }}>
                  {['all', 'open', 'replied', 'suggestion', 'bug', 'feature'].map(f => (
                    <button key={f} style={{
                      padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                      background: '#1a1a1a', color: '#888',
                    }}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>

                {feedbackList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#555' }}>No feedback yet</div>
                ) : feedbackList.map(fb => {
                  const typeEmoji = { suggestion: '💡', bug: '🐛', feature: '🚀', other: '💬' }[fb.type] || '💬'
                  return (
                    <div key={fb.id} style={{ background: '#1a1a1a', borderRadius: 14, padding: 16, marginBottom: 12, border: fb.status === 'open' ? '1px solid #2a2a2a' : '1px solid #052e16' }}>
                      {/* User info */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#333', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#facc15', fontSize: 14 }}>
                          {fb.profiles?.avatar_url ? <img src={fb.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : fb.profiles?.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{fb.profiles?.full_name || 'Unknown'}</div>
                          <div style={{ fontSize: 11, color: '#555' }}>{fb.profiles?.email?.slice(0, 30)}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: '#666' }}>{typeEmoji} {fb.type}</div>
                          <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>
                            {new Date(fb.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      </div>

                      {/* Message */}
                      <div style={{ background: '#111', borderRadius: 10, padding: '10px 12px', marginBottom: 10, fontSize: 14, color: '#ccc', lineHeight: 1.5 }}>
                        {fb.message}
                      </div>

                      {/* Admin reply shown */}
                      {fb.admin_reply && (
                        <div style={{ background: '#052e16', borderRadius: 10, padding: '10px 12px', marginBottom: 10, border: '1px solid #166534' }}>
                          <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 700, marginBottom: 4 }}>Your reply:</div>
                          <div style={{ fontSize: 13, color: '#86efac' }}>{fb.admin_reply}</div>
                        </div>
                      )}

                      {/* Reply input */}
                      {replyingTo === fb.id ? (
                        <div>
                          <textarea
                            value={replyText[fb.id] || ''}
                            onChange={e => setReplyText(prev => ({ ...prev, [fb.id]: e.target.value }))}
                            placeholder="Write your reply..."
                            rows={3}
                            style={{ width: '100%', padding: '10px', background: '#222', border: '1px solid #333', color: '#fff', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
                          />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={async () => {
                              const reply = replyText[fb.id]?.trim()
                              if (!reply) return
                              await supabase.from('feedback').update({
                                admin_reply: reply,
                                status: 'replied',
                                replied_at: new Date().toISOString(),
                              }).eq('id', fb.id)
                              // Notify user
                              await supabase.from('notifications').insert({
                                user_id: fb.user_id,
                                title: '💡 Team replied to your suggestion!',
                                message: reply.slice(0, 80),
                                type: 'booking', is_read: false,
                              })
                              setReplyingTo(null)
                              setReplyText(prev => ({ ...prev, [fb.id]: '' }))
                              setFeedbackList(prev => prev.map(f => f.id === fb.id ? { ...f, admin_reply: reply, status: 'replied', replied_at: new Date().toISOString() } : f))
                            }} style={{ flex: 1, padding: '9px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                              ✅ Send Reply
                            </button>
                            <button onClick={() => setReplyingTo(null)} style={{ padding: '9px 14px', background: '#222', color: '#888', border: '1px solid #333', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setReplyingTo(fb.id)} style={{
                            flex: 1, padding: '9px', background: '#1e3a5f', color: '#60a5fa',
                            border: '1px solid #1e40af', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          }}>
                            {fb.admin_reply ? '✏️ Edit Reply' : '💬 Reply'}
                          </button>
                          <button onClick={async () => {
                            await supabase.from('feedback').update({ status: 'closed' }).eq('id', fb.id)
                            setFeedbackList(prev => prev.map(f => f.id === fb.id ? { ...f, status: 'closed' } : f))
                          }} style={{
                            padding: '9px 12px', background: '#222', color: '#555',
                            border: '1px solid #333', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                          }}>
                            ✓ Close
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>

    {/* User detail panel */}
    {selectedUser && <UserDetailPanel u={selectedUser} />}

    {/* Photo viewer */}
    {viewAdminPhoto && (
      <div onClick={() => setViewAdminPhoto(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={viewAdminPhoto} alt="avatar" style={{ maxWidth: '88vw', maxHeight: '80vh', borderRadius: 16, objectFit: 'contain' }} />
        <button onClick={() => setViewAdminPhoto(null)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 24, width: 44, height: 44, borderRadius: '50%', cursor: 'pointer' }}>✕</button>
      </div>
    )}
  </>
  )
}
