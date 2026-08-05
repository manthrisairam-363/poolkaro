import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { platformText } from '../lib/platform'
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
  function switchTab(v) {
    setTab(v)
    // Refresh data when opening rides, bookings or overview
    if (['rides','bookings','overview','users'].includes(v)) fetchAll()
  }
  const [selectedUser, setSelectedUser] = useState(null)
  const [selectedRide, setSelectedRide] = useState(null)
  const [rideFilter, setRideFilter] = useState('all')
  const [viewAdminPhoto, setViewAdminPhoto] = useState(null)
  const [search, setSearch] = useState('')
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
        supabase.from('rides').select('*, profiles(full_name, phone, vehicle_model, vehicle_number)').order('created_at', { ascending: false }).limit(1000),
        supabase.from('bookings').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(1000),
        supabase.from('wallet_transactions').select('created_at, type, amount').in('type', ['booking_fee', 'posting_fee', 'razorpay', 'subscription']),
      ])

      const usersData = usersRes.data || []
      const ridesData = ridesRes.data || []
      const bookingsData = bookingsRes.data || []
      const txnData = txnRes.data || []

      const confirmedBookings = bookingsData.filter(b => b.status === 'confirmed')
      const cancelledBookings = bookingsData.filter(b => b.status === 'cancelled')
      // REAL revenue = recharges (razorpay) + Pro subscriptions — actual cash in
      // Platform fees are NOT counted (mostly paid from bonus money we gifted)
      const totalRevenue = txnData.filter(t =>
        t.type === 'razorpay' || t.type === 'subscription'
      ).reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0) / 100

      const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
      const todayIST = istNow.toISOString().split('T')[0]

      const { data: walletsData } = await supabase.from('wallets').select('user_id, balance')
      const walletMap = {}
      ;(walletsData || []).forEach(w => { walletMap[w.user_id] = w.balance })
      setWallets(walletMap)

      const totalWalletBalance = (walletsData || []).reduce((s, w) => s + (w.balance || 0), 0)

      // Revenue chart — REAL revenue (recharge + subscription) per day
      const dayMap = {}
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000)
        const key = d.toISOString().split('T')[0]
        dayMap[key] = 0
      }
      txnData.forEach(t => {
        if (t.type !== 'razorpay' && t.type !== 'subscription') return
        const key = t.created_at?.split('T')[0]
        if (key && dayMap[key] !== undefined) dayMap[key] += Math.abs(Number(t.amount || 0)) / 100
      })
      const rev = Object.entries(dayMap).map(([date, amount]) => ({
        date, revenue: amount,
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
        todayRevenue: txnData.filter(t => t.created_at?.startsWith(todayIST) && (t.type === 'razorpay' || t.type === 'subscription')).reduce((s,t) => s + Math.abs(Number(t.amount||0)), 0) / 100,
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
    if (!confirm(`⚠️ DELETE ${u.full_name || u.email}?\n\nThis permanently removes their account and ALL related data. Cannot be undone.`)) return
    const id = u.id
    // Delete all related data in correct order
    await supabase.from('messages').delete().eq('sender_id', id)
    await supabase.from('ratings').delete().eq('rated_by', id)
    await supabase.from('ratings').delete().eq('rated_user_id', id)
    await supabase.from('notifications').delete().eq('user_id', id)
    await supabase.from('ride_requests').delete().eq('rider_id', id)
    await supabase.from('wallet_transactions').delete().eq('user_id', id)
    await supabase.from('bookings').delete().eq('rider_id', id)
    await supabase.from('rides').delete().eq('driver_id', id)
    await supabase.from('wallets').delete().eq('user_id', id)
    await supabase.from('profiles').delete().eq('id', id)
    // Delete from Supabase auth.users via Edge Function
    const { error: fnError } = await supabase.functions.invoke('delete-user', { body: { user_id: id } })
    if (fnError) console.warn('Auth delete note:', fnError.message)
    setSelectedUser(null)
    fetchAll()
    alert(`✅ ${u.full_name || u.email} deleted successfully.`)
  }

  async function cleanGhostUsers() {
    if (!confirm('Delete all ghost users (signed up but never completed onboarding)?')) return
    const ghostIds = [
      'ea5f8ef9-2664-4d30-a988-c40bd81d7ce5',
      'fca62624-773a-409d-a9a5-dd1cc53ebe84',
      '24d1cf7d-8ff6-4177-9594-afd640481bee',
      'c06a9023-d6d2-42b4-a19a-752caeafe5bf',
      '50be6e8c-a540-4d92-8a39-26b1c8f1a75d',
      '0f167530-36f5-44fd-a5cd-4aec94875e88',
      '4260ac85-c36f-4afe-aff5-7ef199371d6b',
      '90146f23-8833-4777-aa07-5d7674c8cb21',
      'd3ecd24f-6039-4512-8174-6427cef7abd9',
      'a2a38884-76a0-4de1-8973-9ea1d59d47f4',
    ]
    let deleted = 0
    for (const id of ghostIds) {
      const { error } = await supabase.functions.invoke('delete-user', { body: { user_id: id } })
      if (!error) deleted++
    }
    alert(`✅ Cleaned ${deleted}/${ghostIds.length} ghost accounts`)
    fetchAll()
  }

  async function cancelRideAdmin(rideId) {
    if (!confirm('Cancel this ride?')) return
    const { data, error } = await supabase.from('rides').update({ status: 'cancelled' }).eq('id', rideId).select('id')
    if (error || !data || data.length === 0) {
      alert('Could not cancel. The admin update policy may be missing — run the admin RLS SQL.')
      return
    }
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('ride_id', rideId)
    alert('✅ Ride cancelled')
    fetchAll()
  }

  function shareRideAdmin(r) {
    const dateStr = new Date(r.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const t = r.ride_time?.slice(0, 5) || ''
    const [h, m] = t.split(':')
    const timeStr = h ? `${((+h % 12) || 12)}:${m} ${+h >= 12 ? 'PM' : 'AM'}` : ''
    // Vehicle may live on the ride row or the driver's profile — use whichever has it.
    const vModel = r.vehicle_model || r.profiles?.vehicle_model || ''
    const vNumber = r.vehicle_number || r.profiles?.vehicle_number || ''
    const vehicleLine = vModel || vNumber ? `\n🚘 Vehicle: ${vModel}${vNumber ? ` (${vNumber})` : ''}` : ''
    const msg = `🚗 Carpool Available — ${dateStr}\n\n🕘 Ride Time: ${timeStr}\n👤 Name: ${r.profiles?.full_name || ''}${vehicleLine}\n\n📍 From: ${r.from_location}\n📍 To: ${r.to_location}\n${r.route_description ? `🛣️ Route: ${r.route_description}\n` : ''}💰 Fare: ₹${r.fare} per seat\n💺 Seats Available: ${r.seats_available}\n\n🔗 Book on CarpoolKaro: https://app.carpoolkaro.com`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
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

  async function exportBookingsCSV() {
    const { data } = await supabase.from('bookings')
      .select('*, rides(from_location,to_location,ride_date,fare), profiles(full_name,phone,email)')
      .order('created_at', { ascending: false })
    const rows = [['Rider Name','Rider Phone','From','To','Date','Fare','Seats','Status','Booked On']]
    ;(data || []).forEach(b => rows.push([
      b.profiles?.full_name || '',
      b.profiles?.phone || '',
      b.rides?.from_location || '',
      b.rides?.to_location || '',
      b.rides?.ride_date || '',
      b.rides?.fare || '',
      b.seats_booked || 1,
      b.status || '',
      new Date(b.created_at).toLocaleDateString('en-IN'),
    ]))
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `carpoolkaro_bookings_${new Date().toISOString().split('T')[0]}.csv`
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
      if (userFilter === 'ios') return u.platform === 'ios'
      if (userFilter === 'android') return u.platform === 'android'
      if (userFilter === 'desktop') return u.platform === 'desktop'
      if (userFilter === 'installed') return u.is_pwa === true
      if (userFilter === 'browser') return !!u.platform && u.is_pwa !== true
      if (userFilter === 'unknown_platform') return !u.platform
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
    // Local state — keeps input focused (was remounting when state lived in parent)
    const [topupAmount, setTopupAmount] = useState('')
    const [topupNote, setTopupNote] = useState('')
    const [topupLoading, setTopupLoading] = useState(false)
    const [txns, setTxns] = useState(null)   // wallet transaction history

    // Load this user's full wallet transaction history when the panel opens.
    useEffect(() => {
      if (!u?.id) return
      supabase.from('wallet_transactions')
        .select('*')
        .eq('user_id', u.id)
        .order('created_at', { ascending: false })
        .limit(100)
        .then(({ data }) => setTxns(data || []))
    }, [u?.id])

    async function handleTopup() {
      if (!u || !topupAmount || !topupNote) return
      const amt = Math.round(parseFloat(topupAmount) * 100)
      if (isNaN(amt) || amt <= 0) return alert('Enter valid amount')
      setTopupLoading(true)
      await supabase.rpc('admin_credit_wallet', {
        p_user_id: u.id,
        p_amount: amt,
        p_description: topupNote,
      })
      await supabase.from('notifications').insert({
        user_id: u.id,
        title: '💰 Wallet Credited!',
        message: `₹${parseFloat(topupAmount).toFixed(0)} added to your wallet. Note: ${topupNote}`,
        type: 'booking', is_read: false,
      })
      setWallets(prev => ({ ...prev, [u.id]: (prev[u.id] || 0) + amt }))
      const addedAmt = parseFloat(topupAmount).toFixed(0)
      setTopupAmount(''); setTopupNote('')
      setTopupLoading(false)
      alert(`✅ ₹${addedAmt} added to ${u.full_name}'s wallet!`)
    }

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
              ['🚘 Vehicle', `${u.vehicle_model || '—'}${u.vehicle_number ? ' · ' + u.vehicle_number : ''}`],
              ['📲 Device', platformText(u)],
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
          {/* ── Wallet transaction history ── */}
          <div style={{ marginTop: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#facc15', marginBottom: 8 }}>
              💳 Transaction History {txns ? `(${txns.length})` : ''}
            </div>
            {txns === null ? (
              <div style={{ color: '#666', fontSize: 12, padding: 10 }}>Loading…</div>
            ) : txns.length === 0 ? (
              <div style={{ color: '#666', fontSize: 12, padding: 10, textAlign: 'center' }}>No transactions yet</div>
            ) : (
              <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {txns.map(t => {
                  const credit = t.amount > 0
                  const label = {
                    recharge: '➕ Wallet recharge',
                    booking_fee: '➖ Booking fee (₹2)',
                    posting_fee: '➖ Posting fee (₹2)',
                    refund_cancel: '↩️ Cancellation refund',
                    subscription: '⭐ Subscription',
                    admin_credit: '🎁 Admin credit',
                  }[t.type] || t.type
                  return (
                    <div key={t.id} style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: 8, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#ddd' }}>{label}</div>
                        {t.description && <div style={{ fontSize: 10, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>}
                        <div style={{ fontSize: 10, color: '#555', marginTop: 1 }}>{new Date(t.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: credit ? '#4ade80' : '#f87171', flexShrink: 0 }}>
                        {credit ? '+' : ''}₹{Math.abs(t.amount / 100).toFixed(0)}
                      </div>
                    </div>
                  )
                })}
              </div>
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
      <div style={{ background: '#111', padding: '20px 16px 16px', borderBottom: '1px solid #222', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>←</button>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20 }}>⚙️ Admin Dashboard</div>
            <div style={{ color: '#666', fontSize: 11 }}>CarpoolKaro Control Panel</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={exportCSV} style={{ background: '#222', border: 'none', color: '#4ade80', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
              📥 Users CSV
            </button>
            <button onClick={exportBookingsCSV} style={{ background: '#222', border: 'none', color: '#60a5fa', padding: '8px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
              📥 Bookings CSV
            </button>
            <button onClick={fetchAll} style={{ background: '#222', border: 'none', color: '#facc15', padding: '8px 12px', borderRadius: 8, cursor: 'pointer' }}>
              ↺
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
          <button onClick={() => setTab('overview')} style={{
            padding: '7px 20px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
            background: tab === 'overview' ? '#facc15' : '#222', color: tab === 'overview' ? '#111' : '#888',
          }}>📊 Overview</button>
          <button onClick={() => setTab('apps')} style={{
            padding: '7px 20px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
            background: tab === 'apps' || !['overview','apps'].includes(tab) ? '#facc15' : '#222',
            color: tab === 'apps' || !['overview','apps'].includes(tab) ? '#111' : '#888',
          }}>⚙️ Apps</button>
          {!['overview','apps'].includes(tab) && (
            <span style={{ padding: '7px 14px', borderRadius: 20, background: '#1a1a1a', color: '#facc15', fontSize: 11, fontWeight: 700, border: '1px solid #facc1544' }}>
              {{'users':'👥 Users','suspicious':'⚠️ Fraud','rides':'🚗 Rides','bookings':'🎫 Bookings','broadcast':'📢 Broadcast','reports':'🚨 Reports','feedback':'💡 Feedback','revenue':'💰 Revenue','recharges':'💳 Recharges','cities':'🏙️ Cities','ratings':'⭐ Ratings','referrals':'🎁 Referrals','notify':'🔔 Notify','subs':'⭐ Subscriptions','live':'🔴 Live Rides','payouts':'💸 Payouts','version':'⚙️ App Version'}[tab]}
            </span>
          )}
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
                  <div style={{ fontWeight: 700, marginBottom: 16, color: '#facc15' }}>📊 Real Revenue — Last 30 Days</div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, overflowX: 'auto' }}>
                    {revenueData.map((d, i) => (
                      <div key={d.date} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 18, gap: 2 }}>
                        {d.revenue > 0 && <div style={{ fontSize: 8, color: '#facc15', fontWeight: 700 }}>₹{d.revenue.toFixed(0)}</div>}
                        <div style={{
                          width: '100%', background: d.revenue > 0 ? '#facc15' : '#2a2a2a',
                          height: Math.max(4, (d.revenue / maxRevenue) * 70), borderRadius: '3px 3px 0 0',
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
                    Total: ₹{revenueData.reduce((s, d) => s + d.revenue, 0).toFixed(0)} this month · Real revenue (recharges + Pro)
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

            {/* APPS TAB — feature grid */}
            {(tab === 'apps') && (
              <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  ['users',     '👥', 'Users',     `${users.length} total`,    '#2563eb'],
                  ['suspicious','⚠️', 'Fraud',     suspiciousUsers.length > 0 ? `${suspiciousUsers.length} flagged` : 'Clean', '#ef4444'],
                  ['rides',     '🚗', 'Rides',     'All rides',                '#d97706'],
                  ['bookings',  '🎫', 'Bookings',  'History',                  '#0891b2'],
                  ['broadcast', '📢', 'Broadcast', 'Message all',              '#7c3aed'],
                  ['reports',   '🚨', 'Reports',   reports.length > 0 ? `${reports.length} open` : 'None', '#dc2626'],
                  ['feedback',  '💡', 'Feedback',  feedbackList.filter(f=>f.status==='open').length > 0 ? `${feedbackList.filter(f=>f.status==='open').length} new` : 'All done', '#16a34a'],
                  ['subs',      '⭐', 'Subscriptions', 'Pro members',           '#f59e0b'],
                  ['recharges', '💳', 'Recharges', 'Wallet top-ups',           '#22c55e'],
                  ['revenue',   '💰', 'Revenue',   'Earnings',                 '#facc15'],
                  ['cities',    '🏙️', 'Cities',    '6 cities',                 '#06b6d4'],
                  ['ratings',   '⭐', 'Ratings',   'Trust',                    '#f59e0b'],
                  ['referrals', '🎁', 'Referrals', 'Growth',                   '#a855f7'],
                  ['notify',    '🔔', 'Notify',    'Push',                     '#3b82f6'],
                  ['payouts',   '💸', 'Payouts',   'Driver earnings',          '#06b6d4'],
                  ['version',   '⚙️', 'Version',   'App control',              '#6366f1'],
                ].map(([v, icon, label, sub, color]) => (
                  <button key={v} onClick={() => switchTab(v)} style={{
                    background: '#1a1a1a', border: `1px solid ${color}44`,
                    borderRadius: 12, padding: '16px 8px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    cursor: 'pointer',
                  }}>
                    <span style={{ fontSize: 26 }}>{icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{label}</span>
                    <span style={{ fontSize: 9, color: '#666', textAlign: 'center' }}>{sub}</span>
                  </button>
                ))}
              </div>
              <button onClick={cleanGhostUsers} style={{ width: '100%', background: '#1a0a0a', border: '1px solid #333', color: '#666', borderRadius: 10, padding: '10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginTop: 12 }}>
                🧹 Clean Ghost Users (signed up but never completed onboarding)
              </button>
              </div>
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

                {/* Filter dropdown (was a long row of chips) */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#555', flexShrink: 0 }}>Filter:</span>
                  <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff', fontSize: 12, fontWeight: 600 }}>
                    {[
                      ['all', 'All users'],
                      ['pro', '⭐ Pro'],
                      ['free', '🆓 Free'],
                      ['verified', '✓ Verified'],
                      ['active_week', '👁 Active this week'],
                      ['low_balance', '⚠️ Low balance'],
                      ['no_rides', '😴 No rides'],
                      ['referred', '🎁 Referred'],
                      ['ios', '🍎 iOS'],
                      ['android', '🤖 Android'],
                      ['desktop', '💻 Desktop'],
                      ['installed', '📲 Installed app'],
                      ['browser', '🌐 Browser only'],
                      ['unknown_platform', '❓ Unknown device'],
                    ].map(([f, label]) => <option key={f} value={f}>{label}</option>)}
                  </select>
                </div>
                {false && (
                <div style={{ display: 'none' }}>
                  {[
                    ['low_balance', '⚠️ Low balance'],
                    ['no_rides', '😴 No rides'],
                    ['referred', '🎁 Referred'],
                    ['ios', '🍎 iOS'],
                    ['android', '🤖 Android'],
                    ['desktop', '💻 Desktop'],
                    ['installed', '📲 Installed app'],
                    ['browser', '🌐 Browser only'],
                    ['unknown_platform', '❓ Unknown device'],
                  ].map(([f, label]) => (
                    <button key={f} onClick={() => setUserFilter(f)} style={{
                      padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700,
                      background: userFilter === f ? '#facc15' : '#1a1a1a', color: userFilter === f ? '#111' : '#666',
                    }}>{label}</button>
                  ))}
                </div>
                )}

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

                {/* Device breakdown — who needs which install instructions */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  {(() => {
                    const c = { ios: 0, android: 0, desktop: 0, installed: 0, browser: 0, unknown: 0 }
                    users.forEach(u => {
                      if (!u.platform) { c.unknown++; return }
                      c[u.platform] = (c[u.platform] || 0) + 1
                      if (u.is_pwa) c.installed++; else c.browser++
                    })
                    return [
                      ['ios', '🍎', c.ios, '#a855f7'],
                      ['android', '🤖', c.android, '#22c55e'],
                      ['desktop', '💻', c.desktop, '#3b82f6'],
                      ['installed', '📲', c.installed, '#facc15'],
                      ['browser', '🌐', c.browser, '#f97316'],
                      ['unknown_platform', '❓', c.unknown, '#64748b'],
                    ].map(([f, icon, n, color]) => (
                      <button key={f} onClick={() => setUserFilter(f)} style={{
                        flex: '1 1 30%', background: '#1a1a1a', border: `1px solid ${userFilter === f ? color : '#222'}`,
                        borderRadius: 10, padding: '8px 6px', cursor: 'pointer', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 14 }}>{icon}</div>
                        <div style={{ fontSize: 16, fontWeight: 900, color }}>{n}</div>
                      </button>
                    ))
                  })()}
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
                {/* Filter: All / Upcoming / Past — replaces the separate Live tab */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  {[['all','All'],['upcoming','🟢 Upcoming'],['past','Past']].map(([v,l]) => (
                    <button key={v} onClick={() => setRideFilter(v)} style={{
                      flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: rideFilter === v ? '#facc15' : '#1a1a1a',
                      color: rideFilter === v ? '#111' : '#888', fontSize: 12, fontWeight: 700,
                    }}>{l}</button>
                  ))}
                </div>
                {(() => {
                  const istNow = new Date(Date.now() + 5.5 * 3600000)
                  const todayIST = istNow.toISOString().split('T')[0]
                  const nowTime = istNow.toISOString().slice(11, 16) // HH:MM in IST
                  let visible = rides
                    .filter(r => !r.from_location?.startsWith('TEST_'))
                    .filter(r => {
                      if (rideFilter === 'upcoming') {
                        if (!['active','full'].includes(r.status)) return false
                        if (r.ride_date > todayIST) return true          // future day
                        if (r.ride_date === todayIST) return (r.ride_time || '') >= nowTime // today, not yet passed
                        return false                                      // past day
                      }
                      if (rideFilter === 'past') return r.ride_date < todayIST || ['completed','cancelled'].includes(r.status)
                      return true
                    })
                  // Upcoming → soonest first. Past → most recent first.
                  // All → also chronological (upcoming first, then past).
                  if (rideFilter === 'upcoming') {
                    visible = [...visible].sort((a, b) =>
                      (a.ride_date + (a.ride_time || '')).localeCompare(b.ride_date + (b.ride_time || '')))
                  } else if (rideFilter === 'past') {
                    visible = [...visible].sort((a, b) =>
                      (b.ride_date + (b.ride_time || '')).localeCompare(a.ride_date + (a.ride_time || '')))
                  } else {
                    // All: upcoming rides first (soonest→latest), then past (recent→old)
                    const todayKey = todayIST + nowTime
                    visible = [...visible].sort((a, b) => {
                      const ka = a.ride_date + (a.ride_time || ''), kb = b.ride_date + (b.ride_time || '')
                      const aUp = ka >= todayKey, bUp = kb >= todayKey
                      if (aUp && bUp) return ka.localeCompare(kb)      // both upcoming: soonest first
                      if (!aUp && !bUp) return kb.localeCompare(ka)    // both past: recent first
                      return aUp ? -1 : 1                              // upcoming before past
                    })
                  }
                  return (
                    <>
                      <div style={{ color: '#888', fontSize: 12, marginBottom: 12 }}>{visible.length} rides</div>
                      {visible.map(r => (
                        <div key={r.id} onClick={() => setSelectedRide(r)} style={{ background: '#1a1a1a', borderRadius: 12, padding: 14, marginBottom: 10, border: '1px solid #222', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{r.from_location} → {r.to_location}</div>
                              <div style={{ color: '#666', fontSize: 12, marginTop: 3 }}>{r.profiles?.full_name} · {formatDate(r.ride_date)} · {formatTime(r.ride_time)}</div>
                              <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>₹{r.fare} · {r.seats_available}/{r.seats_total} seats · {r.ride_type}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: r.status === 'active' ? '#052e16' : r.status === 'full' ? '#1e3a5f' : '#3b0764', color: r.status === 'active' ? '#22c55e' : r.status === 'full' ? '#60a5fa' : '#c084fc' }}>● {r.status}</span>
                              {['active','full'].includes(r.status) && (
                                <button onClick={(e) => { e.stopPropagation(); shareRideAdmin(r) }} style={{ padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>📲 Share</button>
                              )}
                              {r.status === 'active' && <button onClick={(e) => { e.stopPropagation(); cancelRideAdmin(r.id) }} style={{ padding: '4px 8px', background: '#3b0764', color: '#f0abfc', border: 'none', borderRadius: 6, fontSize: 10, cursor: 'pointer' }}>Cancel</button>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )
                })()}
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
            {/* ── REVENUE DASHBOARD ── */}
            {tab === 'revenue' && (
              <RevenueTab supabase={supabase} />
            )}

            {tab === 'recharges' && (
              <RechargesTab supabase={supabase} />
            )}

            {/* ── CITY ANALYTICS ── */}
            {tab === 'cities' && (
              <CityAnalyticsTab supabase={supabase} />
            )}

            {/* ── RATINGS MONITOR ── */}
            {tab === 'ratings' && (
              <RatingsTab supabase={supabase} />
            )}

            {/* ── REFERRAL TRACKER ── */}
            {tab === 'referrals' && (
              <ReferralsTab supabase={supabase} users={users} />
            )}

            {/* ── NOTIFICATION CENTER ── */}
            {tab === 'notify' && (
              <NotifyTab supabase={supabase} users={users} />
            )}

            {/* ── SUBSCRIPTIONS ── */}
            {tab === 'subs' && (
              <SubscriptionsTab supabase={supabase} />
            )}

            {/* ── LIVE RIDES ── */}
            {tab === 'live' && (
              <LiveRidesTab supabase={supabase} />
            )}

            {/* ── PAYOUTS ── */}
            {tab === 'payouts' && (
              <PayoutsTab supabase={supabase} />
            )}

            {/* ── APP VERSION ── */}
            {tab === 'version' && (
              <AppVersionTab supabase={supabase} />
            )}
          </>
        )}
      </div>
    </div>

    {/* User detail panel */}
    {selectedUser && <UserDetailPanel u={selectedUser} />}
    {selectedRide && <RideDetailPanel ride={selectedRide} supabase={supabase} onClose={() => setSelectedRide(null)} />}

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

// ── REVENUE DASHBOARD ──
// Shows a ride's full booking detail: who booked, seats, payment status, contact.
function RideDetailPanel({ ride, supabase, onClose }) {
  const [bookings, setBookings] = useState(null)

  useEffect(() => {
    if (!ride?.id) return
    supabase.from('bookings')
      .select('*, profiles:rider_id(full_name, phone, email)')
      .eq('ride_id', ride.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setBookings(data || []))
  }, [ride?.id])

  const fmtDate = d => d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
  const payColor = { paid: '#4ade80', pending: '#fbbf24', failed: '#f87171', refunded: '#a78bfa' }
  const statusColor = { confirmed: '#4ade80', cancelled: '#f87171', completed: '#60a5fa' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#111', borderRadius: '20px 20px 0 0', padding: 20, width: '100%', maxWidth: 480, margin: '0 auto', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, background: '#333', borderRadius: 2, margin: '0 auto 16px' }} />

        {/* Ride summary */}
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{ride.from_location} → {ride.to_location}</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 3 }}>Driver: {ride.profiles?.full_name || '—'}</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 3 }}>{formatDate(ride.ride_date)} · {formatTime(ride.ride_time)} · ₹{ride.fare}</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>
          Seats: {ride.seats_available}/{ride.seats_total} available · <span style={{ color: statusColor[ride.status] || '#888' }}>● {ride.status}</span>
        </div>
        {ride.route_description && <div style={{ fontSize: 11, color: '#666', background: '#1a1a1a', borderRadius: 8, padding: '8px 10px', marginBottom: 14 }}>🛣️ {ride.route_description}</div>}

        {/* Bookings */}
        <div style={{ fontSize: 13, fontWeight: 800, color: '#facc15', marginBottom: 8 }}>
          🎫 Bookings {bookings ? `(${bookings.length})` : ''}
        </div>
        {bookings === null ? (
          <div style={{ color: '#666', fontSize: 12, padding: 10 }}>Loading…</div>
        ) : bookings.length === 0 ? (
          <div style={{ color: '#666', fontSize: 12, padding: 20, textAlign: 'center' }}>No bookings on this ride yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bookings.map(b => (
              <div key={b.id} style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{b.profiles?.full_name || 'Unknown'}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{b.profiles?.phone || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: statusColor[b.status] || '#888' }}>● {b.status}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: payColor[b.payment_status] || '#888', marginTop: 2 }}>💰 {b.payment_status}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#666', flexWrap: 'wrap' }}>
                  <span>💺 {b.seats_booked} seat{b.seats_booked > 1 ? 's' : ''}</span>
                  <span>💵 ₹{b.ride_fare || ride.fare} fare</span>
                  <span>📅 {fmtDate(b.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} style={{ width: '100%', marginTop: 16, padding: 10, background: 'none', border: '1px solid #333', borderRadius: 10, color: '#666', fontSize: 13, cursor: 'pointer' }}>
          Close
        </button>
      </div>
    </div>
  )
}

function RevenueTab({ supabase }) {
  const [data, setData] = useState(null)
  useEffect(() => { load() }, [])
  async function load() {
    const now = new Date()
    const d30 = new Date(now - 30 * 86400000).toISOString()
    const d7  = new Date(now - 7  * 86400000).toISOString()

    // REAL revenue = recharges (type 'razorpay') + Pro subscriptions (type 'subscription')
    // Platform fees (booking_fee/posting_fee) = engagement metric, mostly from bonus money
    const [allTxn, proSubs] = await Promise.all([
      supabase.from('wallet_transactions').select('amount, type, created_at')
        .in('type', ['razorpay', 'subscription', 'booking_fee', 'posting_fee']),
      supabase.from('profiles').select('id')
        .not('subscription_expires_at','is',null).gt('subscription_expires_at', now.toISOString()),
    ])

    const txns = allTxn.data || []
    const RAZ_RATE = 0.0236 // Razorpay ~2% + 18% GST on that

    // Helper: sum absolute rupees for given types within optional date
    const sumReal = (since) => {
      return txns.filter(t =>
        (t.type === 'razorpay' || t.type === 'subscription') &&
        (!since || t.created_at >= since)
      ).reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0) / 100
    }
    const sumByType = (type) =>
      txns.filter(t => t.type === type).reduce((s,t)=>s+Math.abs(Number(t.amount||0)),0) / 100

    const recharges = sumByType('razorpay')
    const subscriptions = sumByType('subscription')
    const platformFees = sumByType('booking_fee') + sumByType('posting_fee')
    const realAll = recharges + subscriptions
    const realNet = realAll * (1 - RAZ_RATE)

    // Daily REAL revenue chart (last 30 days)
    const byDay = {}
    txns.filter(t => (t.type === 'razorpay' || t.type === 'subscription') && t.created_at >= d30)
      .forEach(tx => {
        const d = tx.created_at?.split('T')[0]
        byDay[d] = (byDay[d] || 0) + Math.abs(Number(tx.amount)) / 100
      })

    setData({
      realAll, realNet, real30: sumReal(d30), real7: sumReal(d7),
      recharges, subscriptions, platformFees,
      proCount: proSubs.data?.length || 0, byDay,
    })
  }
  if (!data) return <div style={{color:'#888',padding:40,textAlign:'center'}}>Loading...</div>
  const days = Object.entries(data.byDay).sort(([a],[b])=>a.localeCompare(b))
  const maxRev = Math.max(...days.map(([,v])=>v), 1)
  return (
    <div>
      {/* Top cards — REAL revenue */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10,marginBottom:16}}>
        {[['💰 Real (All Time)',`₹${data.realAll.toFixed(0)}`,'#facc15','#111'],['📅 30 Days',`₹${data.real30.toFixed(0)}`,'#16a34a','#fff'],['📅 7 Days',`₹${data.real7.toFixed(0)}`,'#2563eb','#fff'],['⭐ Pro Active',`${data.proCount}`,'#7c3aed','#fff']].map(([l,v,bg,c])=>(
          <div key={l} style={{background:bg,borderRadius:12,padding:'14px 12px'}}>
            <div style={{fontSize:10,color:c==='#111'?'#854d0e':'rgba(255,255,255,0.6)',marginBottom:4}}>{l}</div>
            <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Breakdown */}
      <div style={{background:'#111',borderRadius:14,padding:16,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:700,color:'#facc15',marginBottom:14}}>💵 Real Revenue Breakdown</div>
        {[
          ['💳 Wallet Recharges', data.recharges, '#22c55e'],
          ['⭐ Pro Subscriptions', data.subscriptions, '#a855f7'],
        ].map(([l,v,c])=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid #1a1a1a'}}>
            <span style={{color:'#888',fontSize:13}}>{l}</span>
            <span style={{fontWeight:700,color:c,fontSize:14}}>₹{v.toFixed(0)}</span>
          </div>
        ))}
        <div style={{display:'flex',justifyContent:'space-between',padding:'12px 0 4px'}}>
          <span style={{color:'#fff',fontSize:14,fontWeight:800}}>🟢 Gross Revenue</span>
          <span style={{fontWeight:900,color:'#facc15',fontSize:16}}>₹{data.realAll.toFixed(0)}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',padding:'4px 0'}}>
          <span style={{color:'#888',fontSize:12}}>🏦 Net after Razorpay (~2.36%)</span>
          <span style={{fontWeight:700,color:'#86efac',fontSize:13}}>≈ ₹{data.realNet.toFixed(0)}</span>
        </div>
      </div>

      {/* Daily real revenue chart */}
      <div style={{background:'#111',borderRadius:14,padding:16}}>
        <div style={{fontSize:12,fontWeight:700,color:'#facc15',marginBottom:14}}>📈 Real Revenue — Last 30 Days</div>
        {days.length===0
          ? <div style={{color:'#555',textAlign:'center',padding:30}}>No real revenue yet</div>
          : <div style={{display:'flex',alignItems:'flex-end',gap:3,height:120,overflowX:'auto'}}>
              {days.map(([day,rev])=>(
                <div key={day} style={{flex:1,minWidth:20,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <div style={{fontSize:8,color:'#555'}}>₹{rev.toFixed(0)}</div>
                  <div style={{width:'100%',background:'#facc15',borderRadius:'3px 3px 0 0',height:`${(rev/maxRev)*90}px`,minHeight:4}}/>
                  <div style={{fontSize:7,color:'#444',transform:'rotate(-45deg)',transformOrigin:'top left',whiteSpace:'nowrap',marginTop:4}}>{new Date(day).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
                </div>
              ))}
            </div>
        }
      </div>

      {/* Platform fees — engagement metric (separate, not real revenue) */}
      <div style={{marginTop:12,padding:14,background:'#0a0a0a',border:'1px solid #1a1a1a',borderRadius:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{color:'#888',fontSize:13}}>📊 Platform fees collected</span>
          <span style={{fontWeight:700,color:'#64748b',fontSize:14}}>₹{data.platformFees.toFixed(0)}</span>
        </div>
        <div style={{fontSize:10,color:'#444',marginTop:6,lineHeight:1.5}}>
          ⚠️ Engagement metric only — NOT counted as real revenue. Most ₹2 fees are paid from signup/referral bonus money (gifted by us), so this isn't actual income.
        </div>
      </div>

      <div style={{marginTop:12,padding:12,background:'#111',borderRadius:12,fontSize:11,color:'#555',lineHeight:1.6}}>
        💡 <b style={{color:'#888'}}>Real Revenue</b> = actual cash in via Razorpay (wallet recharges + Pro subscriptions). Wallet recharges are user funds you hold; subscriptions are pure income. Net is after Razorpay's ~2.36% cut.
      </div>
    </div>
  )
}

// ── RECHARGES (real wallet top-ups via Razorpay) ──
function RechargesTab({ supabase }) {
  const [rows, setRows] = useState(null)
  useEffect(() => { load() }, [])
  async function load() {
    const { data: txns } = await supabase
      .from('wallet_transactions')
      .select('user_id, amount, description, created_at')
      .eq('type', 'razorpay')
      .order('created_at', { ascending: false })
    const ids = [...new Set((txns || []).map(t => t.user_id))]
    let names = {}
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles').select('id, full_name, phone').in('id', ids)
      ;(profs || []).forEach(p => { names[p.id] = p })
    }
    setRows((txns || []).map(t => ({
      ...t,
      name: names[t.user_id]?.full_name || 'Unknown',
      phone: names[t.user_id]?.phone || '—',
      rupees: Math.abs(Number(t.amount || 0)) / 100,
    })))
  }
  if (!rows) return <div style={{ color: '#888', padding: 40, textAlign: 'center' }}>Loading...</div>
  const total = rows.reduce((s, r) => s + r.rupees, 0)
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ background: '#22c55e', borderRadius: 12, padding: '14px 12px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>💳 Total Recharged</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>₹{total.toFixed(0)}</div>
        </div>
        <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '14px 12px' }}>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>🧾 Transactions</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#facc15' }}>{rows.length}</div>
        </div>
      </div>
      {rows.length === 0 ? (
        <div style={{ color: '#555', textAlign: 'center', padding: 40 }}>No recharges yet</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => (
            <div key={i} style={{ background: '#1a1a1a', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: 14 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{r.phone}</div>
                <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>
                  {new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <div style={{ fontWeight: 900, color: '#22c55e', fontSize: 18 }}>+₹{r.rupees.toFixed(0)}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 12, padding: 12, background: '#111', borderRadius: 12, fontSize: 11, color: '#555', lineHeight: 1.6 }}>
        💡 Real wallet recharges via Razorpay. This is money users added (held by you). Admin top-ups/gifts are NOT shown here.
      </div>
    </div>
  )
}

// ── CITY ANALYTICS ──
function CityAnalyticsTab({ supabase }) {
  const [data, setData] = useState(null)
  useEffect(()=>{load()},[])
  async function load() {
    const [ridesRes, usersRes, bookRes] = await Promise.all([
      supabase.from('rides').select('city,from_location,to_location,ride_time'),
      supabase.from('profiles').select('city'),
      supabase.from('bookings').select('status,rides(city)'),
    ])
    const cities = ['Hyderabad','Bangalore','Pune','Mumbai','Delhi NCR','Chennai']
    const cs = {}
    cities.forEach(c=>{cs[c]={rides:0,users:0,bookings:0,corridors:{},hours:{}}})
    ;(ridesRes.data||[]).forEach(r=>{
      const c=r.city||'Hyderabad'
      if(!cs[c])return
      cs[c].rides++
      const corr=`${r.from_location?.split(' ').slice(0,2).join(' ')} → ${r.to_location?.split(' ').slice(0,2).join(' ')}`
      cs[c].corridors[corr]=(cs[c].corridors[corr]||0)+1
      const hr=parseInt(r.ride_time?.split(':')[0]||0)
      cs[c].hours[hr]=(cs[c].hours[hr]||0)+1
    })
    ;(usersRes.data||[]).forEach(u=>{const c=u.city||'Hyderabad';if(cs[c])cs[c].users++})
    ;(bookRes.data||[]).forEach(b=>{const c=b.rides?.city||'Hyderabad';if(cs[c])cs[c].bookings++})
    setData(cs)
  }
  if(!data)return <div style={{color:'#888',padding:40,textAlign:'center'}}>Loading...</div>
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr',gap:12,marginBottom:16}}>
        {Object.entries(data).map(([city,stats])=>{
          const topC=Object.entries(stats.corridors).sort(([,a],[,b])=>b-a).slice(0,3)
          const peak=Object.entries(stats.hours).sort(([,a],[,b])=>b-a)[0]
          const warn=stats.rides===0||(stats.users>3&&stats.rides<2)
          return (
            <div key={city} style={{background:'#111',borderRadius:14,padding:14,border:warn?'1px solid #ef4444':'1px solid #222'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontWeight:800,fontSize:14,color:'#fff'}}>{city}</div>
                {warn&&<span style={{background:'#7f1d1d',color:'#fca5a5',fontSize:9,padding:'2px 8px',borderRadius:10,fontWeight:700}}>⚠️ Low Rides</span>}
              </div>
              <div style={{display:'flex',gap:6,marginBottom:10}}>
                {[['🚗',stats.rides,'Rides'],['👥',stats.users,'Users'],['🎫',stats.bookings,'Bookings']].map(([icon,val,label])=>(
                  <div key={label} style={{flex:1,background:'#1a1a1a',borderRadius:8,padding:'8px 4px',textAlign:'center'}}>
                    <div style={{fontSize:14,fontWeight:800,color:'#facc15'}}>{val}</div>
                    <div style={{fontSize:9,color:'#555',marginTop:2}}>{label}</div>
                  </div>
                ))}
              </div>
              {topC.length>0&&<div style={{marginBottom:8}}>{topC.map(([c,n])=>(
                <div key={c} style={{fontSize:10,color:'#666',marginBottom:2,display:'flex',justifyContent:'space-between'}}>
                  <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{c}</span>
                  <span style={{color:'#facc15',flexShrink:0,marginLeft:6}}>{n}x</span>
                </div>
              ))}</div>}
              {peak&&<div style={{fontSize:10,color:'#555'}}>⏰ Peak: {peak[0]}:00–{parseInt(peak[0])+1}:00</div>}
            </div>
          )
        })}
      </div>
      <div style={{background:'#111',borderRadius:12,padding:12,fontSize:12,color:'#555'}}>
        💡 Cities marked ⚠️ have users but low ride supply. Consider targeting drivers there.
      </div>
    </div>
  )
}

// ── RATINGS MONITOR ──
function RatingsTab({ supabase }) {
  const [ratings, setRatings] = useState([])
  const [lowUsers, setLowUsers] = useState([])
  useEffect(()=>{load()},[])
  async function load() {
    const [r1, r2, r3] = await Promise.all([
      supabase.from('ratings').select('*').order('created_at',{ascending:false}).limit(40),
      supabase.from('profiles').select('id,full_name,avg_rating,email').lt('avg_rating',3.5).gt('avg_rating',0).order('avg_rating'),
      supabase.from('profiles').select('id,full_name'),
    ])
    // Build name lookup
    const nameMap = {}
    ;(r3.data||[]).forEach(p => { nameMap[p.id] = p.full_name })
    // Attach names to ratings
    const ratedWithNames = (r1.data||[]).map(r => ({
      ...r,
      raterName: nameMap[r.rated_by] || r.rated_by?.slice(0,8) || '?',
      rateeName: nameMap[r.rated_user_id] || r.rated_user_id?.slice(0,8) || '?',
    }))
    setRatings(ratedWithNames)
    setLowUsers(r2.data||[])
  }
  return (
    <div>
      {lowUsers.length>0&&(
        <div style={{marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:800,color:'#ef4444',marginBottom:10,letterSpacing:1}}>⚠️ LOW RATED USERS (below 3.5 ⭐)</div>
          {lowUsers.map(u=>(
            <div key={u.id} style={{background:'#1a0a0a',border:'1px solid #7f1d1d',borderRadius:12,padding:14,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:'#fff'}}>{u.full_name}</div>
                <div style={{fontSize:10,color:'#555',marginTop:2}}>{u.email}</div>
              </div>
              <div style={{textAlign:'right'}}>
                <div style={{fontSize:20,fontWeight:900,color:'#ef4444'}}>⭐ {Number(u.avg_rating).toFixed(1)}</div>
                <button onClick={async()=>{
                  await supabase.from('notifications').insert({user_id:u.id,type:'system',title:'⚠️ Rating Notice',message:'Your rating has dropped. Please maintain good conduct to continue using CarpoolKaro.',is_read:false})
                  alert(`Warning sent to ${u.full_name}`)
                }} style={{marginTop:6,background:'#7f1d1d',color:'#fca5a5',border:'none',borderRadius:8,padding:'4px 10px',fontSize:11,fontWeight:700,cursor:'pointer'}}>⚠️ Warn</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {lowUsers.length===0&&<div style={{background:'#0d1f0d',border:'1px solid #166534',borderRadius:12,padding:16,marginBottom:16,textAlign:'center',color:'#4ade80',fontWeight:700}}>✅ All users have good ratings!</div>}
      <div style={{fontSize:11,fontWeight:800,color:'#888',marginBottom:10,letterSpacing:1}}>RECENT RATINGS</div>
      {ratings.length===0
        ? <div style={{color:'#555',textAlign:'center',padding:30}}>No ratings yet</div>
        : ratings.map(r=>(
          <div key={r.id} style={{background:'#111',borderRadius:12,padding:12,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,color:'#fff',fontWeight:600}}>
                <span style={{color:'#94a3b8'}}>{r.raterName}</span>
                <span style={{color:'#555',margin:'0 6px'}}>→</span>
                <span>{r.rateeName}</span>
              </div>
              {r.comment&&<div style={{fontSize:11,color:'#666',marginTop:4,fontStyle:'italic'}}>"{r.comment}"</div>}
              <div style={{fontSize:10,color:'#555',marginTop:3}}>{new Date(r.created_at).toLocaleDateString('en-IN')}</div>
            </div>
            <div style={{fontSize:18,fontWeight:900,color:r.rating>=4?'#facc15':r.rating>=3?'#f97316':'#ef4444',marginLeft:12}}>{'⭐'.repeat(Math.min(r.rating||0,5))}</div>
          </div>
        ))
      }
    </div>
  )
}

// ── REFERRAL TRACKER ──
function ReferralsTab({ supabase, users }) {
  const [txns, setTxns] = useState([])
  const [profiles, setProfiles] = useState([])
  useEffect(()=>{load()},[])
  async function load() {
    const [t,p] = await Promise.all([
      supabase.from('wallet_transactions').select('user_id,amount,description,created_at').ilike('description','%referral%').order('created_at',{ascending:false}).limit(50),
      supabase.from('profiles').select('id,full_name,referral_code,referral_count,email').order('referral_count',{ascending:false}),
    ])
    setTxns(t.data||[])
    setProfiles(p.data||[])
  }
  const totalPaid = txns.reduce((s,t)=>s+Number(t.amount),0)
  const topReferrers = profiles.filter(p=>p.referral_count>0).slice(0,10)
  const profileMap = {}
  profiles.forEach(p=>{ profileMap[p.id]=p })
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:20}}>
        {[['🎁 Bonuses Paid',`₹${totalPaid}`,'#facc15'],['👥 Total Signups',profiles.filter(p=>p.referred_by).length,'#22c55e'],['🏆 Top Referrer',topReferrers[0]?`${topReferrers[0].full_name?.split(' ')[0]} (${topReferrers[0].referral_count})`:'None','#a855f7']].map(([l,v,c])=>(
          <div key={l} style={{background:'#111',borderRadius:12,padding:14}}>
            <div style={{fontSize:10,color:'#555',marginBottom:6}}>{l}</div>
            <div style={{fontSize:18,fontWeight:800,color:c}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:11,fontWeight:800,color:'#888',marginBottom:10,letterSpacing:1}}>🏆 LEADERBOARD</div>
      {topReferrers.length===0
        ? <div style={{color:'#555',textAlign:'center',padding:30}}>No referrals yet</div>
        : topReferrers.map((p,i)=>(
          <div key={p.id} style={{background:'#111',borderRadius:12,padding:12,marginBottom:8,display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:28,height:28,borderRadius:'50%',background:i===0?'#facc15':i===1?'#9ca3af':i===2?'#b45309':'#222',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,color:i<3?'#111':'#555',flexShrink:0}}>{i+1}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13,color:'#fff'}}>{p.full_name}</div>
              <div style={{fontSize:10,color:'#555'}}>Code: <span style={{color:'#facc15',fontFamily:'monospace'}}>{p.referral_code}</span></div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:16,fontWeight:900,color:'#facc15'}}>{p.referral_count}</div>
              <div style={{fontSize:9,color:'#555'}}>referrals</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:14,fontWeight:700,color:'#22c55e'}}>₹{(p.referral_count||0)*10}</div>
              <div style={{fontSize:9,color:'#555'}}>earned</div>
            </div>
          </div>
        ))
      }
      {txns.length>0&&<>
        <div style={{fontSize:11,fontWeight:800,color:'#888',margin:'16px 0 10px',letterSpacing:1}}>RECENT TRANSACTIONS</div>
        {txns.slice(0,15).map((t,i)=>(
          <div key={i} style={{background:'#111',borderRadius:10,padding:'10px 12px',marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:12,color:'#fff'}}>{profileMap[t.user_id]?.full_name||t.user_id?.slice(0,8)||'?'}</div>
              <div style={{fontSize:10,color:'#555',marginTop:2}}>{new Date(t.created_at).toLocaleDateString('en-IN')}</div>
            </div>
            <div style={{fontSize:14,fontWeight:700,color:'#22c55e'}}>+₹{t.amount}</div>
          </div>
        ))}
      </>}
    </div>
  )
}

// ── NOTIFICATION CENTER ──
function NotifyTab({ supabase, users }) {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetType, setTargetType] = useState('all')
  const [targetCity, setTargetCity] = useState('Hyderabad')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(null)
  const [history, setHistory] = useState([])
  useEffect(()=>{loadHistory()},[])
  async function loadHistory() {
    const {data} = await supabase.from('notifications').select('title,message,created_at').eq('type','admin_broadcast').order('created_at',{ascending:false}).limit(15)
    setHistory(data||[])
  }
  const getTargets = () => {
    if(targetType==='city') return users.filter(u=>u.city===targetCity)
    if(targetType==='pro') return users.filter(u=>u.subscription_expires_at&&new Date(u.subscription_expires_at)>new Date())
    if(targetType==='drivers') return users.filter(u=>u.role==='driver'||u.role==='both')
    if(targetType==='riders') return users.filter(u=>u.role==='rider'||u.role==='both')
    // Device targeting — send the right install guidance to the right people
    if(targetType==='ios_browser') return users.filter(u=>u.platform==='ios'&&!u.is_pwa)
    if(targetType==='android_browser') return users.filter(u=>u.platform==='android'&&!u.is_pwa)
    if(targetType==='not_installed') return users.filter(u=>u.platform&&!u.is_pwa)
    return users
  }
  async function send() {
    if(!title.trim()||!message.trim()){alert('Title and message required');return}
    setSending(true)
    const targets = getTargets()
    if(targets.length>0) {
      await supabase.from('notifications').insert(targets.map(u=>({user_id:u.id,title,message,type:'admin_broadcast',is_read:false})))
    }
    setSending(false)
    setSent(targets.length)
    setTitle('');setMessage('')
    loadHistory()
    setTimeout(()=>setSent(null),4000)
  }
  const targetCount = getTargets().length
  return (
    <div>
      <div style={{background:'#111',borderRadius:14,padding:16,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:800,color:'#fff',marginBottom:14}}>🔔 Send Notification</div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:'#888',marginBottom:6,fontWeight:700}}>SEND TO</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {[['all','🌐 All'],['city','🏙️ City'],['pro','⭐ Pro'],['drivers','🚗 Drivers'],['riders','🙋 Riders'],['ios_browser','🍎 iOS (not installed)'],['android_browser','🤖 Android (not installed)'],['not_installed','📲 Not installed']].map(([v,l])=>(
              <button key={v} onClick={()=>setTargetType(v)} style={{padding:'6px 12px',borderRadius:20,border:'none',cursor:'pointer',fontSize:11,fontWeight:700,background:targetType===v?'#facc15':'#1a1a1a',color:targetType===v?'#111':'#888'}}>{l}</button>
            ))}
          </div>
          {targetType==='city'&&(
            <select value={targetCity} onChange={e=>setTargetCity(e.target.value)} style={{marginTop:8,padding:'8px 12px',background:'#1a1a1a',color:'#fff',border:'1px solid #333',borderRadius:8,fontSize:12,width:'100%'}}>
              {['Hyderabad','Bangalore','Pune','Mumbai','Delhi NCR','Chennai'].map(c=><option key={c}>{c}</option>)}
            </select>
          )}
          <div style={{marginTop:8,fontSize:11,color:'#facc15'}}>→ Will notify <strong>{targetCount}</strong> user{targetCount!==1?'s':''}</div>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:11,color:'#888',marginBottom:6,fontWeight:700}}>TITLE</div>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. 🎉 New Feature!" maxLength={60} style={{width:'100%',padding:'10px 12px',background:'#1a1a1a',color:'#fff',border:'1px solid #333',borderRadius:8,fontSize:13,boxSizing:'border-box'}}/>
        </div>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:'#888',marginBottom:6,fontWeight:700}}>MESSAGE</div>
          <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Write your message..." rows={3} maxLength={300} style={{width:'100%',padding:'10px 12px',background:'#1a1a1a',color:'#fff',border:'1px solid #333',borderRadius:8,fontSize:13,resize:'vertical',boxSizing:'border-box'}}/>
          <div style={{fontSize:10,color:'#555',textAlign:'right'}}>{message.length}/300</div>
        </div>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,color:'#888',marginBottom:6,fontWeight:700}}>QUICK TEMPLATES</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {[['🎉 Feature Update','We just launched a new feature! Open the app to check it out.'],['🏙️ New City','CarpoolKaro is now in your city! Start sharing rides today.'],['💰 Offer','Recharge ₹100 and get ₹20 bonus this week only!'],['🚗 Post a Ride','Driving tomorrow? Post your ride and earn on your commute!']].map(([t,m])=>(
              <button key={t} onClick={()=>{setTitle(t);setMessage(m)}} style={{padding:'5px 10px',background:'#1a1a1a',border:'1px solid #333',borderRadius:8,color:'#888',fontSize:10,cursor:'pointer'}}>{t}</button>
            ))}
          </div>
        </div>
        {sent!==null&&<div style={{background:'#0d1f0d',border:'1px solid #166534',borderRadius:8,padding:'10px 14px',marginBottom:12,color:'#4ade80',fontSize:13,fontWeight:700}}>✅ Sent to {sent} users!</div>}
        <button onClick={send} disabled={sending||!title||!message} style={{width:'100%',padding:14,background:sending||!title||!message?'#333':'#facc15',color:'#111',border:'none',borderRadius:10,fontSize:14,fontWeight:800,cursor:sending?'default':'pointer'}}>
          {sending?'⏳ Sending...':`🔔 Send to ${targetCount} User${targetCount!==1?'s':''}`}
        </button>
      </div>
      {history.length>0&&<>
        <div style={{fontSize:11,fontWeight:800,color:'#888',marginBottom:10,letterSpacing:1}}>SENT HISTORY</div>
        {history.map((n,i)=>(
          <div key={i} style={{background:'#111',borderRadius:10,padding:'10px 12px',marginBottom:6}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <div style={{fontWeight:700,fontSize:12,color:'#fff'}}>{n.title}</div>
              <div style={{fontSize:10,color:'#555'}}>{new Date(n.created_at).toLocaleDateString('en-IN')}</div>
            </div>
            <div style={{fontSize:11,color:'#666',marginTop:4}}>{n.message}</div>
          </div>
        ))}
      </>}
    </div>
  )
}

// ── FIX CITIES BUTTON ──
function FixCitiesButton({ supabase, onDone }) {
  const [fixing, setFixing] = useState(false)
  const [result, setResult] = useState(null)

  async function fixCities() {
    if (!window.confirm('This will normalise all user & ride city names to proper case (e.g. hyderabad → Hyderabad). Continue?')) return
    setFixing(true)
    const cityMap = [
      ['Hyderabad', ['hyderabad']],
      ['Bangalore', ['bangalore', 'bengaluru']],
      ['Pune',      ['pune']],
      ['Mumbai',    ['mumbai']],
      ['Delhi NCR', ['delhi ncr', 'delhi', 'ncr', 'gurgaon', 'noida']],
      ['Chennai',   ['chennai']],
    ]
    let totalFixed = 0
    for (const [proper, variants] of cityMap) {
      for (const v of variants) {
        const { count: c1 } = await supabase.from('profiles').update({ city: proper }).ilike('city', v).select('id', { count: 'exact', head: true })
        const { count: c2 } = await supabase.from('rides').update({ city: proper }).ilike('city', v).select('id', { count: 'exact', head: true })
        totalFixed += (c1 || 0) + (c2 || 0)
      }
    }
    // Fix nulls → Hyderabad
    await supabase.from('profiles').update({ city: 'Hyderabad' }).is('city', null)
    await supabase.from('profiles').update({ city: 'Hyderabad' }).eq('city', '')
    await supabase.from('rides').update({ city: 'Hyderabad' }).is('city', null)
    setFixing(false)
    setResult(totalFixed)
    if (onDone) onDone()
    setTimeout(() => setResult(null), 5000)
  }

  return (
    <div style={{ background: '#111', borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>🔧 Fix City Names</div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 3 }}>
          Normalises "hyderabad" → "Hyderabad" for all users & rides
        </div>
        {result !== null && <div style={{ fontSize: 11, color: '#4ade80', marginTop: 4 }}>✅ Fixed {result} records!</div>}
      </div>
      <button onClick={fixCities} disabled={fixing} style={{ background: fixing ? '#333' : '#facc15', color: '#111', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 12, fontWeight: 800, cursor: fixing ? 'default' : 'pointer', flexShrink: 0, marginLeft: 12 }}>
        {fixing ? '⏳ Fixing...' : '🔧 Fix Now'}
      </button>
    </div>
  )
}

// ── SUBSCRIPTIONS MANAGEMENT ──
function SubscriptionsTab({ supabase }) {
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)
  const [subRevenue, setSubRevenue] = useState(0)
  const [promoDate, setPromoDate] = useState('2026-12-31')
  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const [profRes, subRevRes] = await Promise.all([
      supabase.from('profiles')
        .select('id,full_name,email,phone,subscription_expires_at,created_at')
        .not('subscription_expires_at', 'is', null)
        .order('subscription_expires_at', { ascending: false }),
      supabase.from('wallet_transactions').select('amount').eq('type', 'subscription'),
    ])
    setSubs(profRes.data || [])
    const rev = (subRevRes.data || []).reduce((s,t) => s + Math.abs(Number(t.amount||0)), 0) / 100
    setSubRevenue(rev)
    setLoading(false)
  }
  async function grantPro(userId) {
    const expires = new Date(Date.now() + 30 * 86400000).toISOString()
    const { data, error } = await supabase.from('profiles')
      .update({ subscription_expires_at: expires }).eq('id', userId).select('id')
    if (error || !data?.length) {
      alert('Could not grant Pro. The admin update policy may be missing — run the admin RLS SQL for profiles.')
      return
    }
    alert('✅ Pro granted for 30 days')
    load()
  }

  // Grant Pro to a SINGLE user until a chosen date (for targeting VIPs / active drivers).
  async function grantProUntil(userId, dateStr) {
    if (!dateStr) return
    const expires = new Date(dateStr + 'T23:59:59').toISOString()
    const { data, error } = await supabase.from('profiles')
      .update({ subscription_expires_at: expires }).eq('id', userId).select('id')
    if (error || !data?.length) { alert('Could not grant. Check the admin profile-update policy.'); return }
    alert(`✅ Pro granted until ${new Date(dateStr).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`)
    load()
  }

  // LAUNCH PROMO: grant Pro to ALL users until a chosen date. This is the
  // "free Pro until Dec 31 to attract early users" move.
  async function grantProToAll(dateStr) {
    if (!dateStr) return
    const label = new Date(dateStr).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
    if (!confirm(`Give FREE Pro to ALL users until ${label}?\n\nThis updates every user's account. Use for launch promos.`)) return
    const expires = new Date(dateStr + 'T23:59:59').toISOString()
    // Update every profile. RLS admin policy allows this.
    const { data, error } = await supabase.from('profiles')
      .update({ subscription_expires_at: expires })
      .neq('id', '00000000-0000-0000-0000-000000000000') // matches all rows
      .select('id')
    if (error) { alert('Could not apply promo: ' + error.message); return }
    alert(`✅ Free Pro granted to ${data?.length || 0} users until ${label}`)
    load()
  }
  async function revokePro(userId) {
    if (!confirm('Revoke Pro access?')) return
    // Set expiry to yesterday (not null) so the user still appears under "Expired".
    const yesterday = new Date(Date.now() - 86400000).toISOString()
    const { data, error } = await supabase.from('profiles')
      .update({ subscription_expires_at: yesterday }).eq('id', userId).select('id')
    if (error || !data?.length) {
      alert('Could not revoke. The admin update policy may be missing — run the admin RLS SQL for profiles.')
      return
    }
    load()
  }
  const now = new Date()
  const active = subs.filter(s => new Date(s.subscription_expires_at) > now)
  const expired = subs.filter(s => new Date(s.subscription_expires_at) <= now)
  if (loading) return <div style={{color:'#888',padding:40,textAlign:'center'}}>Loading...</div>
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:20}}>
        {[['⭐ Active Pro',active.length,'#facc15'],['💀 Expired',expired.length,'#ef4444'],['💰 Revenue',`₹${subRevenue.toFixed(0)}`,'#22c55e']].map(([l,v,c])=>(
          <div key={l} style={{background:'#111',borderRadius:12,padding:14}}>
            <div style={{fontSize:10,color:'#555',marginBottom:6}}>{l}</div>
            <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
          </div>
        ))}
      </div>
      {/* 🎁 Launch promo — grant free Pro to ALL users until a chosen date */}
      <div style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', borderRadius: 12, padding: 14, marginBottom: 20, border: '1px solid #4f46e5' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#c7d2fe', marginBottom: 4 }}>🎁 Launch Promo</div>
        <div style={{ fontSize: 11, color: '#a5b4fc', marginBottom: 10 }}>Give free Pro to every user until a date — to attract early users.</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={promoDate} onChange={e => setPromoDate(e.target.value)}
            style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #4f46e5', background: '#1e1b4b', color: '#fff', fontSize: 12 }} />
          <button onClick={() => grantProToAll(promoDate)}
            style={{ padding: '9px 14px', background: '#facc15', color: '#111', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Grant to ALL
          </button>
        </div>
      </div>

      <div style={{fontSize:11,fontWeight:800,color:'#facc15',marginBottom:10,letterSpacing:1}}>⭐ ACTIVE PRO MEMBERS</div>
      {active.length === 0 ? <div style={{color:'#555',textAlign:'center',padding:20}}>No active subscriptions</div> :
        active.map(s => (
          <div key={s.id} style={{background:'#111',borderRadius:12,padding:14,marginBottom:8,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontWeight:700,fontSize:13,color:'#fff'}}>{s.full_name}</div>
              <div style={{fontSize:10,color:'#555',marginTop:2}}>{s.phone} · {s.email}</div>
              <div style={{fontSize:10,color:'#facc15',marginTop:4}}>
                Expires: {new Date(s.subscription_expires_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                &nbsp;({Math.ceil((new Date(s.subscription_expires_at)-now)/86400000)} days left)
              </div>
            </div>
            <button onClick={() => revokePro(s.id)} style={{background:'#7f1d1d',color:'#fca5a5',border:'none',borderRadius:8,padding:'6px 10px',fontSize:10,fontWeight:700,cursor:'pointer'}}>Revoke</button>
          </div>
        ))
      }
      {expired.length > 0 && <>
        <div style={{fontSize:11,fontWeight:800,color:'#555',margin:'16px 0 10px',letterSpacing:1}}>💀 EXPIRED</div>
        {expired.slice(0,10).map(s => (
          <div key={s.id} style={{background:'#111',borderRadius:12,padding:12,marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center',opacity:0.6}}>
            <div>
              <div style={{fontWeight:600,fontSize:13,color:'#888'}}>{s.full_name}</div>
              <div style={{fontSize:10,color:'#555',marginTop:2}}>Expired: {new Date(s.subscription_expires_at).toLocaleDateString('en-IN')}</div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button onClick={() => grantPro(s.id)} style={{background:'#111',color:'#facc15',border:'1px solid #facc15',borderRadius:8,padding:'6px 10px',fontSize:10,fontWeight:700,cursor:'pointer'}}>Grant 30d</button>
              <button onClick={() => grantProUntil(s.id, promoDate)} style={{background:'#111',color:'#c7d2fe',border:'1px solid #4f46e5',borderRadius:8,padding:'6px 10px',fontSize:10,fontWeight:700,cursor:'pointer'}} title={`Grant until ${promoDate}`}>Until {new Date(promoDate).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</button>
            </div>
          </div>
        ))}
      </>}
    </div>
  )
}

// ── LIVE RIDES MONITOR ──
function LiveRidesTab({ supabase }) {
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('rides')
      .select('*, profiles(full_name,phone,avg_rating,vehicle_model,vehicle_number)')
      .in('status', ['active','full'])
      .order('ride_date').order('ride_time')
    setRides(data || [])
    setLastRefresh(new Date())
    setLoading(false)
  }
  function shareRide(r) {
    const dateStr = new Date(r.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const t = r.ride_time?.slice(0,5) || ''
    const [h, m] = t.split(':')
    const timeStr = h ? `${((+h % 12) || 12)}:${m} ${+h >= 12 ? 'PM' : 'AM'}` : ''
    const msg = `🚗 Carpool Available — ${dateStr}

🕘 Ride Time: ${timeStr}
👤 Name: ${r.profiles?.full_name || ''}
🚘 Vehicle: ${r.profiles?.vehicle_model || ''}${r.profiles?.vehicle_number ? ` (${r.profiles.vehicle_number})` : ''}

📍 From: ${r.from_location}
📍 To: ${r.to_location}
${r.route_description ? `🛣️ Route: ${r.route_description}\n` : ''}💰 Fare: ₹${r.fare} per seat
💺 Seats Available: ${r.seats_available}

🔗 Book on CarpoolKaro: https://app.carpoolkaro.com`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }
  const istNow = new Date(Date.now() + 5.5*3600000)
  const todayIST = istNow.toISOString().split('T')[0]
  const todayRides = rides.filter(r => r.ride_date === todayIST)
  const upcomingRides = rides.filter(r => r.ride_date > todayIST)
  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,flex:1}}>
          {[['🔴 Live Today',todayRides.length,'#ef4444'],['📅 Upcoming',upcomingRides.length,'#facc15'],['🚗 Total Active',rides.length,'#22c55e']].map(([l,v,c])=>(
            <div key={l} style={{background:'#111',borderRadius:12,padding:14}}>
              <div style={{fontSize:9,color:'#555',marginBottom:4}}>{l}</div>
              <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{fontSize:10,color:'#555',marginBottom:12,textAlign:'right'}}>
        🔄 Auto-refreshes every 30s · Last: {lastRefresh.toLocaleTimeString('en-IN')}
      </div>
      {todayRides.length > 0 && <>
        <div style={{fontSize:11,fontWeight:800,color:'#ef4444',marginBottom:10,letterSpacing:1}}>🔴 TODAY'S RIDES</div>
        {todayRides.map(r => (
          <div key={r.id} style={{background:'#111',borderRadius:12,padding:14,marginBottom:8,borderLeft:`3px solid ${r.status==='full'?'#2563eb':'#16a34a'}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <div style={{fontWeight:700,fontSize:13,color:'#fff'}}>{r.from_location} → {r.to_location}</div>
                <div style={{fontSize:11,color:'#888',marginTop:3}}>{r.profiles?.full_name} · {r.ride_time?.slice(0,5)}</div>
              </div>
              <span style={{background:r.status==='full'?'#1d4ed8':'#166534',color:r.status==='full'?'#93c5fd':'#4ade80',fontSize:9,padding:'3px 8px',borderRadius:100,fontWeight:700}}>
                {r.status==='full'?'🔵 FULL':'🟢 OPEN'}
              </span>
            </div>
            <div style={{display:'flex',gap:8,marginTop:10,alignItems:'center'}}>
              {[['💺',`${r.seats_available}/${r.seats_total} seats`],['💰',`₹${r.fare}`],[r.ride_type==='to_office'?'🏢':'🏠',r.ride_type==='to_office'?'To Office':'To Home']].map(([icon,val])=>(
                <span key={val} style={{background:'#1a1a1a',borderRadius:20,padding:'3px 10px',fontSize:11,color:'#888'}}>{icon} {val}</span>
              ))}
              <button onClick={()=>shareRide(r)} style={{marginLeft:'auto',background:'#16a34a',color:'#fff',border:'none',borderRadius:20,padding:'5px 14px',fontSize:11,fontWeight:700,cursor:'pointer'}}>📲 Share</button>
            </div>
          </div>
        ))}
      </>}
      {upcomingRides.length > 0 && <>
        <div style={{fontSize:11,fontWeight:800,color:'#facc15',margin:'16px 0 10px',letterSpacing:1}}>📅 UPCOMING RIDES</div>
        {upcomingRides.slice(0,20).map(r => (
          <div key={r.id} style={{background:'#111',borderRadius:12,padding:12,marginBottom:6,opacity:0.85}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:13,color:'#fff'}}>{r.from_location} → {r.to_location}</div>
                <div style={{fontSize:11,color:'#555',marginTop:3}}>{new Date(r.ride_date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})} · {r.ride_time?.slice(0,5)} · {r.profiles?.full_name} · 💺 {r.seats_available}/{r.seats_total}</div>
              </div>
              <button onClick={()=>shareRide(r)} style={{background:'#16a34a',color:'#fff',border:'none',borderRadius:20,padding:'5px 12px',fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>📲 Share</button>
            </div>
          </div>
        ))}
      </>}
      {rides.length === 0 && !loading && (
        <div style={{color:'#555',textAlign:'center',padding:40}}>No active rides right now</div>
      )}
    </div>
  )
}

// ── PAYOUT TRACKER ──
function PayoutsTab({ supabase }) {
  const [data, setData] = useState(null)
  useEffect(() => { load() }, [])
  async function load() {
    const [completedRides, profiles] = await Promise.all([
      supabase.from('bookings').select('rider_id,seats_booked,ride_fare,rides(driver_id,fare,from_location,to_location,ride_date)').eq('status','completed'),
      supabase.from('profiles').select('id,full_name,phone,upi_id,total_rides_given,avg_rating'),
    ])
    const profileMap = {}
    ;(profiles.data||[]).forEach(p => { profileMap[p.id] = p })
    const driverMap = {}
    ;(completedRides.data||[]).forEach(b => {
      const dId = b.rides?.driver_id
      if (!dId) return
      if (!driverMap[dId]) driverMap[dId] = { rides: 0, earned: 0, profile: profileMap[dId] }
      driverMap[dId].rides++
      driverMap[dId].earned += Number(b.ride_fare || b.rides?.fare || 0) - 2
    })
    const sorted = Object.values(driverMap).sort((a,b) => b.earned - a.earned)
    setData({ drivers: sorted, totalPaid: sorted.reduce((s,d)=>s+d.earned,0) })
  }
  if (!data) return <div style={{color:'#888',padding:40,textAlign:'center'}}>Loading...</div>
  return (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
        {[['🚗 Active Drivers',data.drivers.length,'#facc15'],['💰 Total Earned',`₹${data.totalPaid}`,'#22c55e']].map(([l,v,c])=>(
          <div key={l} style={{background:'#111',borderRadius:12,padding:14}}>
            <div style={{fontSize:10,color:'#555',marginBottom:6}}>{l}</div>
            <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:'#555',background:'#111',borderRadius:10,padding:'10px 14px',marginBottom:16}}>
        💡 Earnings = fare collected via UPI directly from riders. CarpoolKaro only takes ₹2 platform fee per booking.
      </div>
      <div style={{fontSize:11,fontWeight:800,color:'#888',marginBottom:10,letterSpacing:1}}>🏆 TOP EARNERS</div>
      {data.drivers.length === 0 ? <div style={{color:'#555',textAlign:'center',padding:30}}>No completed rides yet</div> :
        data.drivers.map((d,i) => (
          <div key={i} style={{background:'#111',borderRadius:12,padding:14,marginBottom:8,display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:28,height:28,borderRadius:'50%',background:i===0?'#facc15':i===1?'#9ca3af':i===2?'#b45309':'#222',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,color:i<3?'#111':'#555',flexShrink:0}}>{i+1}</div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13,color:'#fff'}}>{d.profile?.full_name||'Unknown'}</div>
              <div style={{fontSize:10,color:'#555',marginTop:2}}>
                {d.profile?.phone} · UPI: {d.profile?.upi_id||'Not set'}
              </div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:18,fontWeight:900,color:'#22c55e'}}>₹{d.earned}</div>
              <div style={{fontSize:9,color:'#555'}}>{d.rides} rides</div>
            </div>
          </div>
        ))
      }
    </div>
  )
}

// ── APP VERSION CONTROL ──
function AppVersionTab({ supabase }) {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [version, setVersion] = useState('2.0.0')
  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('app_settings').select('key,value')
    const map = {}
    ;(data||[]).forEach(s => { map[s.key] = s.value })
    setSettings(map)
    setAnnouncement(map.announcement || '')
    setVersion(map.min_version || '2.0.0')
    setLoading(false)
  }
  async function saveSetting(key, value) {
    setSaving(true)
    await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() })
    await load()
    setSaving(false)
  }
  if (loading) return <div style={{color:'#888',padding:40,textAlign:'center'}}>Loading...</div>
  const isMaintenance = settings.maintenance_mode === 'true'
  const isForceUpdate = settings.force_update === 'true'
  return (
    <div>
      {/* Maintenance Mode */}
      <div style={{background:isMaintenance?'#1a0a0a':'#111',border:`1px solid ${isMaintenance?'#ef4444':'#222'}`,borderRadius:14,padding:16,marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontWeight:800,fontSize:14,color:isMaintenance?'#ef4444':'#fff'}}>
              🔧 Maintenance Mode {isMaintenance?'(ON)':'(OFF)'}
            </div>
            <div style={{fontSize:11,color:'#555',marginTop:4}}>
              When ON → users see maintenance screen, cannot use app
            </div>
          </div>
          <button onClick={() => saveSetting('maintenance_mode', isMaintenance?'false':'true')} disabled={saving}
            style={{background:isMaintenance?'#16a34a':'#dc2626',color:'#fff',border:'none',borderRadius:10,padding:'10px 16px',fontSize:12,fontWeight:800,cursor:'pointer',flexShrink:0,marginLeft:12}}>
            {isMaintenance?'Turn OFF':'Turn ON'}
          </button>
        </div>
      </div>

      {/* Force Update */}
      <div style={{background:'#111',borderRadius:14,padding:16,marginBottom:12}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div>
            <div style={{fontWeight:800,fontSize:14,color:'#fff'}}>🔄 Force Update</div>
            <div style={{fontSize:11,color:'#555',marginTop:4}}>Show update prompt to all users</div>
          </div>
          <button onClick={() => saveSetting('force_update', isForceUpdate?'false':'true')} disabled={saving}
            style={{background:isForceUpdate?'#16a34a':'#f59e0b',color:isForceUpdate?'#fff':'#111',border:'none',borderRadius:10,padding:'10px 14px',fontSize:12,fontWeight:800,cursor:'pointer',flexShrink:0,marginLeft:12}}>
            {isForceUpdate?'Disable':'Enable'}
          </button>
        </div>
        <div style={{fontSize:11,color:'#888',marginBottom:6,fontWeight:700}}>MIN VERSION</div>
        <div style={{display:'flex',gap:8}}>
          <input value={version} onChange={e=>setVersion(e.target.value)} placeholder="e.g. 2.1.0"
            style={{flex:1,padding:'8px 12px',background:'#1a1a1a',color:'#fff',border:'1px solid #333',borderRadius:8,fontSize:13}} />
          <button onClick={() => saveSetting('min_version', version)} disabled={saving}
            style={{background:'#facc15',color:'#111',border:'none',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:800,cursor:'pointer'}}>Save</button>
        </div>
      </div>

      {/* Announcement Banner */}
      <div style={{background:'#111',borderRadius:14,padding:16,marginBottom:12}}>
        <div style={{fontWeight:800,fontSize:14,color:'#fff',marginBottom:4}}>📢 Announcement Banner</div>
        <div style={{fontSize:11,color:'#555',marginBottom:12}}>Shows at top of app for all users. Leave empty to hide.</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
          {[
            '🔧 Scheduled maintenance tonight 11 PM – 1 AM IST. Please plan accordingly.',
            '🎉 New feature launched! Try live location sharing in chat.',
            '🚀 App updated! Restart the app for the latest version.',
            '🏖️ Holiday schedule: Fewer rides on 15 Aug. Post early!',
            '💰 Special offer: Refer a friend this week, earn ₹20 bonus!',
            '⚠️ Server maintenance on Sunday 2 AM – 4 AM IST.',
          ].map(t => (
            <button key={t} onClick={() => setAnnouncement(t)}
              style={{padding:'5px 10px',background:'#1a1a1a',border:'1px solid #333',borderRadius:8,color:'#888',fontSize:10,cursor:'pointer',textAlign:'left'}}>
              {t.slice(0,40)}...
            </button>
          ))}
        </div>
        <textarea value={announcement} onChange={e=>setAnnouncement(e.target.value)} rows={3}
          placeholder="e.g. 🎉 New feature: Live location sharing is now available!"
          style={{width:'100%',padding:'10px 12px',background:'#1a1a1a',color:'#fff',border:'1px solid #333',borderRadius:8,fontSize:13,resize:'vertical',boxSizing:'border-box',marginBottom:10}} />
        <div style={{display:'flex',gap:8}}>
          <button onClick={() => saveSetting('announcement', announcement)} disabled={saving}
            style={{flex:1,background:'#facc15',color:'#111',border:'none',borderRadius:10,padding:12,fontSize:13,fontWeight:800,cursor:'pointer'}}>
            💾 Save Announcement
          </button>
          {announcement && <button onClick={() => { setAnnouncement(''); saveSetting('announcement', '') }}
            style={{background:'#333',color:'#888',border:'none',borderRadius:10,padding:12,fontSize:12,cursor:'pointer'}}>Clear</button>}
        </div>
      </div>

      {/* Current Status */}
      <div style={{background:'#0a0a0a',borderRadius:12,padding:14,fontSize:11,color:'#555'}}>
        <div style={{fontWeight:700,color:'#888',marginBottom:8}}>CURRENT STATUS</div>
        {Object.entries(settings).map(([k,v]) => (
          <div key={k} style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
            <span style={{color:'#555'}}>{k}</span>
            <span style={{color:'#facc15',fontFamily:'monospace'}}>{v||'(empty)'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
