import { useState, useEffect, useRef } from 'react'
import { formatTime, formatDate } from '../lib/utils'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { hasRated, getBookingRatings, submitRating as submitRatingLib } from '../lib/ratings'
import BottomNav from '../components/BottomNav'
import PayFare from '../components/PayFare'

// Fare payment state of a booking. The rider only CLAIMS; the owner CONFIRMS.
//   confirmed → owner ticked received · claimed → rider says paid, owner hasn't checked
//   disputed  → owner said "not received" after the last claim · unpaid → nothing yet
function payState(b) {
  if (b?.driver_confirmed) return 'confirmed'
  if (b?.payment_status === 'paid') return 'claimed'
  const d = b?.payment_disputed_at ? new Date(b.payment_disputed_at).getTime() : 0
  const c = b?.payment_claimed_at ? new Date(b.payment_claimed_at).getTime() : 0
  return d && d > c ? 'disputed' : 'unpaid'
}
const PAY_RANK = { unpaid: 0, disputed: 0, claimed: 1, confirmed: 2 }
function summarizePay(rows) {
  const sum = f => rows.filter(f).reduce((t, r) => t + r.amount, 0)
  const cnt = f => rows.filter(f).length
  const conf = r => r.state === 'confirmed', cl = r => r.state === 'claimed', un = r => !conf(r) && !cl(r)
  return { collected: sum(conf), claimed: sum(cl), pending: sum(un), paidCount: cnt(conf), claimedCount: cnt(cl), unpaidCount: cnt(un) }
}
function payeeAvailable(p) {
  return !!(p?.upi_id || (p?.pay_by_phone !== false && p?.phone))
}

// Contact buttons — call + in-app chat
function ContactButtons({ phone, name, bookingId, navigate }) {
  if (!bookingId) return null
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <button onClick={() => navigate(`/chat/${bookingId}`)} style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: '9px', background: '#fefce8', color: '#854d0e',
        borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        border: '1px solid #fef08a',
      }}>
        💬 Chat
      </button>
    </div>
  )
}

// Single passenger card inside a ride
// Inline rating: rider rates the driver after a completed ride, right on the
// booked card. Uses the shared rating helper so it stays in sync with every
// other rating entry point (no double-rating, consistent averages).
function RiderRatesDriver({ booking }) {
  const { user } = useAuth()
  const driverId = booking.rides?.driver_id
  const driverName = booking.rides?.profiles?.full_name?.split(' ')[0] || 'the driver'
  const [given, setGiven] = useState(null)     // stars I gave (or null)
  const [received, setReceived] = useState(null) // stars they gave me (or null)
  const [checking, setChecking] = useState(true)
  const [rating, setRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!driverId || !user?.id) { setChecking(false); return }
    getBookingRatings(booking.id).then(rows => {
      const mine = rows.find(r => r.rated_by === user.id)
      const theirs = rows.find(r => r.rated_by === driverId && r.rated_user === user.id)
      if (mine) setGiven(mine.stars)
      if (theirs) setReceived(theirs.stars)
      setChecking(false)
    })
  }, [booking.id, driverId, user?.id])

  async function submit(stars) {
    if (submitting || !driverId) return
    setSubmitting(true); setRating(stars)
    const res = await submitRating({
      bookingId: booking.id, rideId: booking.ride_id,
      raterId: user.id, ratedUserId: driverId, stars,
    })
    if (res.ok) setGiven(stars)
    else alert(res.error || 'Could not submit rating')
    setSubmitting(false)
  }

  if (checking) return null

  return (
    <div style={{ marginTop: 8 }}>
      {given ? (
        <div style={{ textAlign: 'center', fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
          ✅ You rated {driverName} {'★'.repeat(given)}
        </div>
      ) : (
        <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>How was your ride with {driverName}?</div>
          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
            {[1,2,3,4,5].map(s => (
              <button key={s} onClick={() => submit(s)} disabled={submitting}
                style={{ background: 'none', border: 'none', fontSize: 30, cursor: submitting ? 'default' : 'pointer', color: rating >= s ? '#facc15' : '#e5e7eb', padding: 0, lineHeight: 1 }}>★</button>
            ))}
          </div>
        </div>
      )}
      {received && (
        <div style={{ textAlign: 'center', fontSize: 11, color: '#888', marginTop: 4 }}>
          {driverName} rated you {'★'.repeat(received)}
        </div>
      )}
    </div>
  )
}

function PassengerCard({ booking, unreadCount, onRate }) {
  const rider = booking.profiles
  const navigate = useNavigate()
  const { user } = useAuth()
  const initials = rider?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const [rating, setRating] = useState(0)
  const [rated, setRated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [submitting, setSubmitting] = useState(false)


  useEffect(() => {
    if (!user?.id) { setChecking(false); return }
    hasRated(booking.id, user.id).then(r => { if (r) { setRated(true); setRating(r.stars) } setChecking(false) })
  }, [booking.id, user?.id])

  async function submitRating(stars) {
    if (submitting) return
    setSubmitting(true); setRating(stars)
    // The old code omitted ride_id (a NOT NULL column) → the insert failed
    // silently, which is why driver→rider ratings never saved.
    const res = await submitRatingLib({
      bookingId: booking.id, rideId: booking.ride_id,
      raterId: user.id, ratedUserId: booking.rider_id, stars,
    })
    if (res.ok) setRated(true)
    else alert(res.error || 'Could not submit rating')
    setSubmitting(false)
  }

  return (
    <div style={{ background: '#f8f9fa', borderRadius: 12, padding: 12, marginTop: 10, border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{rider?.full_name || 'Co-rider'}</div>
          <div style={{ color: '#888', fontSize: 12 }}>📱 {rider?.phone || 'No phone'}</div>
        </div>
        <span style={{ background: booking.status === 'completed' ? '#f0f0f0' : '#f0fdf4', color: booking.status === 'completed' ? '#888' : '#16a34a', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
          {booking.status === 'completed' ? '✓ Done' : '✅ Confirmed'}
        </span>
      </div>
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {[
          ['📥 Fare (via UPI)', `₹${booking.ride_fare || booking.fare}`],
          ['💺 Seats', booking.seats_booked],
          ['📅 Booked', new Date(booking.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })],
        ].map(([k, v]) => (
          <div key={k} style={{ background: '#fff', borderRadius: 8, padding: '6px 10px' }}>
            <div style={{ fontSize: 10, color: '#aaa' }}>{k}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 1 }}>{v}</div>
          </div>
        ))}
      </div>
      {/* Payment is handled in the clean summary above; this detailed card is
          just for chat / rating / contact. */}
      <ContactButtons phone={rider?.phone} name={rider?.full_name} bookingId={booking.id} navigate={navigate} />
      {unreadCount > 0 && (
        <button onClick={() => navigate(`/chat/${booking.id}`)} style={{ width: '100%', marginTop: 10, padding: '10px', background: '#fefce8', border: '2px solid #facc15', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: '#854d0e' }}>
          💬 {unreadCount} new message{unreadCount > 1 ? 's' : ''} from rider
        </button>
      )}
      {booking.status === 'completed' && (
        <div style={{ marginTop: 10, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
          {rated ? (
            <div style={{ textAlign: 'center', fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✅ You rated this passenger</div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Rate this passenger:</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => !submitting && submitRating(s)} style={{ flex: 1, padding: '8px', background: rating >= s ? '#facc15' : '#f0f0f0', border: 'none', borderRadius: 8, fontSize: 16, cursor: 'pointer' }}
                    onMouseEnter={() => setRating(s)} onMouseLeave={() => setRating(0)}>⭐</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DriverRideCard({ ride, onCancel, onEdit, onCancelAll, unreadCounts = {}, isPast = false }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [passengers, setPassengers] = useState([])
  const [loadingPax, setLoadingPax] = useState(false)
  const [actualBookedCount, setActualBookedCount] = useState(null)
  const [payRows, setPayRows] = useState([])          // per-rider payment rows
  const paySummary = payRows.length ? summarizePay(payRows) : null
  const [payOpen, setPayOpen] = useState(false)       // past-ride payment expanded?
  const [busyRow, setBusyRow] = useState(null)        // bookingId being acted on
  const [pendingReqs, setPendingReqs] = useState([])  // riders awaiting approval
  const [busyReq, setBusyReq] = useState(null)        // request bookingId being acted on

  // Load pending join-requests for this ride so the owner can approve/decline.
  useEffect(() => {
    if (!['active', 'full'].includes(ride.status)) { setPendingReqs([]); return }
    supabase.from('bookings')
      .select('id, rider_id, seats_booked, guest_names, created_at, profiles(full_name, phone)')
      .eq('ride_id', ride.id).eq('status', 'pending')
      .order('created_at', { ascending: true })
      .then(({ data }) => setPendingReqs(data || []))
  }, [ride.id, ride.status])

  async function approveReq(r) {
    setBusyReq(r.id)
    const { data, error } = await supabase.rpc('approve_booking', { p_booking_id: r.id, p_driver_id: ride.driver_id })
    setBusyReq(null)
    if (error || !data?.success) { alert(data?.error || error?.message || 'Could not approve'); return }
    // Seats, counts and the payment summary all shift — reload for a clean state.
    window.location.reload()
  }

  async function declineReq(r) {
    if (!confirm(`Decline ${r.profiles?.full_name || 'this rider'}'s request?\n\nThe seat is released. No fee is charged to anyone.`)) return
    setBusyReq(r.id)
    const { data, error } = await supabase.rpc('decline_booking', { p_booking_id: r.id, p_driver_id: ride.driver_id })
    setBusyReq(null)
    if (error || !data?.success) { alert(data?.error || error?.message || 'Could not decline'); return }
    setPendingReqs(reqs => reqs.filter(x => x.id !== r.id))
  }

  function shareRide() {
    const dateStr = new Date(ride.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const link = ride.ride_code ? `https://app.carpoolkaro.com/r/${ride.ride_code}` : `https://app.carpoolkaro.com/book/${ride.id}`
    const p = profile || {}
    const msg = `🚗 Carpool Available — ${dateStr}

🕘 Ride Time: ${formatTime(ride.ride_time)}
👤 Name: ${p.full_name || ''}
🚘 Vehicle: ${p.vehicle_model || ''}${p.vehicle_number ? ` (${p.vehicle_number})` : ''}

📍 From: ${ride.from_location}
📍 To: ${ride.to_location}
${ride.route_description ? `🛣️ Route: ${ride.route_description}\n` : ''}💰 Fare: ₹${ride.fare} per seat
💺 Seats Available: ${ride.seats_available}

🔗 Book this ride: ${link}`
    if (navigator.share) navigator.share({ text: msg }).catch(() => {})
    else window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  // Owner confirms the money actually arrived in their UPI app / bank.
  async function confirmRow(row) {
    setBusyRow(row.bookingId)
    const { data } = await supabase.from('bookings')
      .update({ driver_confirmed: true, payment_status: 'paid' })
      .eq('id', row.bookingId).select('id')
    if (data?.length) {
      setPayRows(rows => rows.map(r => r.riderId === row.riderId ? { ...r, state: 'confirmed' } : r))
      await supabase.from('notifications').insert({
        user_id: row.riderId, title: '✅ Payment confirmed',
        message: `The driver confirmed receiving ₹${row.amount}. Thank you!`,
        type: 'booking', booking_id: row.bookingId, is_read: false,
      })
    } else {
      alert('Could not save. Please try again.')
    }
    setBusyRow(null)
  }

  // Owner says the money did NOT arrive. Rider is told and can pay again or message.
  async function rejectRow(row) {
    if (!window.confirm(`Mark ₹${row.amount} from ${row.name} as NOT received?\n\nCheck your UPI app or bank first. ${row.name} will be told to pay again or send you the transaction ID.`)) return
    setBusyRow(row.bookingId)
    const { data } = await supabase.from('bookings')
      .update({ driver_confirmed: false, payment_status: 'pending', payment_disputed_at: new Date().toISOString() })
      .eq('id', row.bookingId).select('id')
    if (data?.length) {
      setPayRows(rows => rows.map(r => r.riderId === row.riderId ? { ...r, state: 'disputed' } : r))
      await supabase.from('notifications').insert({
        user_id: row.riderId, title: '⚠️ Payment not received',
        message: `${profile?.full_name?.split(' ')[0] || 'The driver'} couldn't find your ₹${row.amount} payment for ${ride.from_location} → ${ride.to_location}. If you paid, message them your transaction ID. If not, please pay again.`,
        type: 'booking', booking_id: row.bookingId, is_read: false,
      })
    } else {
      alert('Could not save. Please try again.')
    }
    setBusyRow(null)
  }

  // Nudge a rider in-app to pay.
  async function remindRow(row) {
    setBusyRow(row.bookingId)
    await supabase.from('notifications').insert({
      user_id: row.riderId, title: '🔔 Payment reminder',
      message: `Please pay ₹${row.amount} for your ride (${ride.from_location} → ${ride.to_location}) and tap "I've Paid".`,
      type: 'booking', booking_id: row.bookingId, is_read: false,
    })
    setBusyRow(null)
    alert('Reminder sent.')
  }

  // One line of text + colour per rider, by payment state.
  function payLine(row) {
    const seats = row.seats > 1 ? ` · ${row.seats} seats` : ''
    if (row.state === 'confirmed') return { text: `₹${row.amount}${seats}`, color: '#94a3b8', bold: false }
    if (row.state === 'claimed') return { text: `🟡 says paid ₹${row.amount}${row.ref ? ` · ref ${row.ref}` : ''}${seats}`, color: '#b45309', bold: true }
    if (row.state === 'disputed') return { text: `❌ you marked not received · ₹${row.amount}${seats}`, color: '#dc2626', bold: true }
    return { text: `⏳ owes ₹${row.amount}${seats}`, color: '#dc2626', bold: true }
  }
  const payBg = row => row.state === 'confirmed' ? 'transparent' : row.state === 'claimed' ? '#fffbeb' : '#fff5f5'
  const needsAction = row => row.state !== 'confirmed'
  const isToOffice = ride.ride_type === 'to_office'
  const statusColor = { active: '#16a34a', full: '#2563eb', cancelled: '#dc2626', completed: '#888' }

  useEffect(() => {
    async function loadCount() {
      // Count confirmed AND completed bookings — a past/expired ride's bookings
      // become 'completed', so counting only 'confirmed' wrongly showed 0 and
      // hid the passenger details for finished rides.
      const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('ride_id', ride.id).in('status', ['confirmed', 'completed'])
      setActualBookedCount(count || 0)
    }
    loadCount()
  }, [ride.id])

  // Load a lightweight per-rider payment list for the clean summary. Runs for
  // BOTH active and past rides (active shows less detail). This is the core
  // "did everyone pay me?" data — name, amount, paid/not, per rider.
  useEffect(() => {
    supabase.from('bookings')
      .select('id, rider_id, ride_fare, seats_booked, payment_status, driver_confirmed, payment_ref, payment_claimed_at, payment_disputed_at, profiles(full_name, phone)')
      .eq('ride_id', ride.id).in('status', ['confirmed', 'completed'])
      .then(({ data }) => {
        if (!data) return
        // Group multiple bookings by the same rider into one row (worst state wins).
        const grouped = {}
        data.forEach(b => {
          const amt = b.ride_fare || ride.fare || 0
          const st = payState(b)
          const g = grouped[b.rider_id]
          if (g) {
            g.amount += amt; g.seats += b.seats_booked
            if (PAY_RANK[st] < PAY_RANK[g.state]) { g.state = st; g.ref = b.payment_ref || '' }
          } else {
            grouped[b.rider_id] = {
              bookingId: b.id, riderId: b.rider_id,
              name: b.profiles?.full_name || 'Rider',
              phone: b.profiles?.phone || '',
              amount: amt, seats: b.seats_booked, state: st, ref: b.payment_ref || '',
            }
          }
        })
        setPayRows(Object.values(grouped))
      })
  }, [ride.id])

  const bookedCount = actualBookedCount ?? Math.max(0, ride.seats_total - ride.seats_available)

  async function loadPassengers() {
    if (expanded) { setExpanded(false); return }
    setExpanded(true)
    setLoadingPax(true)
    const { data } = await supabase.from('bookings').select('*, profiles(full_name, phone, upi_id)').eq('ride_id', ride.id).in('status', ['confirmed', 'completed'])
    const grouped = {}
    ;(data || []).forEach(b => {
      if (grouped[b.rider_id]) { grouped[b.rider_id].seats_booked += b.seats_booked; grouped[b.rider_id].ride_fare += b.ride_fare; grouped[b.rider_id].driver_receives += b.driver_receives }
      else { grouped[b.rider_id] = { ...b } }
    })
    setPassengers(Object.values(grouped))
    setLoadingPax(false)
  }

  return (
    <div style={{ background: isPast ? '#fafafa' : '#fff', borderRadius: 14, padding: 14, boxShadow: isPast ? 'none' : '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12, border: isPast ? '1px solid #eee' : 'none', borderLeft: `4px solid ${isPast ? '#d1d5db' : (statusColor[ride.status] || '#ccc')}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{ride.from_location} → {ride.to_location}</div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 3 }}>{new Date(ride.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {formatTime(ride.ride_time)}</div>
          {ride.route_description && <div style={{ color: '#aaa', fontSize: 11, marginTop: 2 }}>🛣️ {ride.route_description}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{ background: isToOffice ? '#dbeafe' : '#fce7f3', color: isToOffice ? '#1d4ed8' : '#be185d', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600 }}>{isToOffice ? '🏢 Office' : '🏠 Home'}</span>
          <span style={{ background: '#f8f9fa', borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600, color: statusColor[ride.status] }}>● {ride.status}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'nowrap' }}>
        <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>₹{ride.fare}/seat</span>
        <span style={{ background: '#fff7ed', color: '#c2410c', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{ride.seats_available > 0 ? `💺 ${ride.seats_available} seat${ride.seats_available > 1 ? 's' : ''} left` : '💺 Full'}</span>
        {!isPast && (ride.status === 'active' || ride.status === 'full') && (
          <button onClick={shareRide} title="Share this ride" style={{ marginLeft: 'auto', flexShrink: 0, background: '#dcfce7', border: 'none', borderRadius: 20, padding: '4px 11px', fontSize: 14, color: '#15803d', cursor: 'pointer', fontWeight: 700, lineHeight: 1 }}>📤</button>
        )}
      </div>
      {/* ── Pending join-requests — the owner approves or declines here. ── */}
      {pendingReqs.length > 0 && (
        <div style={{ marginTop: 10, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#b45309', marginBottom: 8 }}>
            🙋 {pendingReqs.length} request{pendingReqs.length > 1 ? 's' : ''} waiting — ₹2 charged to each side only when you approve
          </div>
          {pendingReqs.map(r => (
            <div key={r.id} style={{ background: '#fff', borderRadius: 8, padding: '9px 11px', marginTop: 6, border: '1px solid #fef3c7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{r.profiles?.full_name || 'Rider'}</div>
                  <div style={{ fontSize: 11.5, color: '#888' }}>
                    {r.seats_booked} seat{r.seats_booked > 1 ? 's' : ''}{r.guest_names ? ` · ${r.guest_names}` : ''}
                  </div>
                </div>
                <button onClick={() => navigate(`/chat/${r.id}`)} style={{ flexShrink: 0, padding: '6px 10px', background: '#fefce8', border: '1px solid #fef08a', color: '#854d0e', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>💬 Message</button>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => approveReq(r)} disabled={busyReq === r.id}
                  style={{ flex: 1, padding: '8px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: busyReq === r.id ? 0.6 : 1 }}>
                  {busyReq === r.id ? '…' : '✅ Approve'}
                </button>
                <button onClick={() => declineReq(r)} disabled={busyReq === r.id}
                  style={{ flex: 1, padding: '8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ❌ Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Payment summary ──
          PAST rides: collapsed by default — show a single status line the
          driver can tap to expand. All-paid = quiet basic info; any unpaid =
          highlight + reveal phone numbers so the driver can chase the money.
          ACTIVE rides: keep the compact live summary always visible. */}
      {payRows.length > 0 && paySummary && isPast && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setPayOpen(o => !o)} style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
            background: paySummary.pending > 0 ? '#fef2f2' : paySummary.claimed > 0 ? '#fffbeb' : '#f3f4f6',
            border: paySummary.pending > 0 ? '1px solid #fecaca' : paySummary.claimed > 0 ? '1px solid #fde68a' : '1px solid #e5e7eb',
          }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: paySummary.pending > 0 ? '#dc2626' : paySummary.claimed > 0 ? '#b45309' : '#6b7280' }}>
              {paySummary.pending > 0
                ? `⚠️ ${paySummary.unpaidCount} unpaid · ₹${paySummary.pending} to collect`
                : paySummary.claimed > 0
                  ? `🟡 ${paySummary.claimedCount} to confirm · ₹${paySummary.claimed}`
                  : `✓ All ${paySummary.paidCount} paid · ₹${paySummary.collected}`}
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{payOpen ? '▲' : '▼'}</span>
          </button>

          {payOpen && (
            <div style={{ marginTop: 6, background: '#fff', borderRadius: 10, border: '1px solid #eef0f2', overflow: 'hidden' }}>
              {payRows.map(row => {
                const ln = payLine(row)
                return (
                <div key={row.riderId} style={{ padding: '10px 12px', borderTop: '1px solid #f1f2f4', background: payBg(row) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{row.name}</div>
                      <div style={{ fontSize: 12, fontWeight: ln.bold ? 800 : 400, color: ln.color }}>{ln.text}</div>
                    </div>
                    {row.state === 'confirmed' ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d', flexShrink: 0 }}>✓ Received</span>
                    ) : row.state === 'claimed' ? (
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                        <button onClick={() => rejectRow(row)} disabled={busyRow === row.bookingId}
                          style={{ padding: '6px 9px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✗ Not received</button>
                        <button onClick={() => confirmRow(row)} disabled={busyRow === row.bookingId}
                          style={{ padding: '6px 10px', background: '#16a34a', border: 'none', color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Received</button>
                      </div>
                    ) : (
                      <button onClick={() => confirmRow(row)} disabled={busyRow === row.bookingId}
                        style={{ padding: '6px 10px', background: '#16a34a', border: 'none', color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>✓ Got it</button>
                    )}
                  </div>
                  {row.state === 'claimed' && (
                    <div style={{ fontSize: 11, color: '#92400e', marginTop: 6, lineHeight: 1.4 }}>Open your UPI app or bank and look for ₹{row.amount} from {row.name}. Tap Received only if you can see it.</div>
                  )}
                  {/* Unpaid → give the driver the tools to chase: phone + remind */}
                  {needsAction(row) && row.state !== 'claimed' && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {row.phone && (
                        <a href={`tel:${row.phone}`} style={{ flex: 1, textAlign: 'center', padding: '7px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>📞 {row.phone}</a>
                      )}
                      <button onClick={() => remindRow(row)} disabled={busyRow === row.bookingId}
                        style={{ flex: 1, padding: '7px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🔔 Remind</button>
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ACTIVE rides — compact always-visible summary */}
      {payRows.length > 0 && paySummary && !isPast && (
        <div style={{ marginTop: 10, background: '#f9fafb', borderRadius: 10, border: '1px solid #eef0f2', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4, padding: '9px 12px', background: (paySummary.pending > 0 || paySummary.claimed > 0) ? '#fffbeb' : '#f0fdf4', fontSize: 12, fontWeight: 800 }}>
            <span style={{ color: '#15803d' }}>✓ Confirmed ₹{paySummary.collected}</span>
            {paySummary.claimed > 0 && <span style={{ color: '#b45309' }}>🟡 To confirm ₹{paySummary.claimed}</span>}
            {paySummary.pending > 0
              ? <span style={{ color: '#c2410c' }}>⏳ Pending ₹{paySummary.pending}</span>
              : paySummary.claimed === 0 && <span style={{ color: '#15803d' }}>All paid 🎉</span>}
          </div>
          <div>
            {payRows.map(row => {
              const ln = payLine(row)
              return (
              <div key={row.riderId} style={{ padding: '9px 12px', borderTop: '1px solid #f1f2f4', background: payBg(row) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
                    <div style={{ fontSize: 12, fontWeight: ln.bold ? 800 : 400, color: ln.color }}>{ln.text}</div>
                  </div>
                  {row.state === 'confirmed' ? (
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d', flexShrink: 0 }}>✓ Received</span>
                  ) : row.state === 'claimed' ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => rejectRow(row)} disabled={busyRow === row.bookingId}
                        style={{ padding: '5px 8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✗ Not received</button>
                      <button onClick={() => confirmRow(row)} disabled={busyRow === row.bookingId}
                        style={{ padding: '5px 9px', background: '#16a34a', border: 'none', color: '#fff', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Received</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => remindRow(row)} disabled={busyRow === row.bookingId}
                        style={{ padding: '5px 9px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🔔</button>
                      <button onClick={() => confirmRow(row)} disabled={busyRow === row.bookingId}
                        style={{ padding: '5px 9px', background: '#16a34a', border: 'none', color: '#fff', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Got it</button>
                    </div>
                  )}
                </div>
                {row.state === 'claimed' && (
                  <div style={{ fontSize: 11, color: '#92400e', marginTop: 5, lineHeight: 1.4 }}>Check your UPI app or bank for ₹{row.amount} from {row.name}. Tap Received only if you can see it.</div>
                )}
              </div>
              )
            })}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {bookedCount > 0 && (
          <button onClick={loadPassengers} style={{ flex: 1, padding: '8px', background: expanded ? '#111' : '#f3f4f6', color: expanded ? '#fff' : '#6b7280', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
            {expanded ? '▲ Hide details' : `💬 Chat & details`}
          </button>
        )}
        {(ride.status === 'active' || ride.status === 'full') && (
          <button onClick={() => onEdit(ride.id)} style={{ padding: '8px 14px', background: '#f0f4ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✏️ Edit</button>
        )}
        {(ride.status === 'active' || ride.status === 'full') && (
          <button onClick={() => onCancel(ride.id)} style={{ padding: '8px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🚫 Cancel</button>
        )}
        {(ride.status === 'full' || (ride.status === 'active' && bookedCount > 0)) && (() => {
          // Compare in IST consistently. `new Date("YYYY-MM-DDTHH:mm")` parses as
          // BROWSER-local time, so we must build the ride time as IST explicitly.
          const rideDateTime = new Date(`${ride.ride_date}T${ride.ride_time || '00:00'}:00+05:30`)
          const isPast = rideDateTime.getTime() < Date.now() - 30 * 60000
          return isPast ? (
            <button onClick={async () => {
              if (!confirm('Mark this ride as completed?')) return
              const { data } = await supabase.rpc('complete_ride', { p_ride_id: ride.id, p_driver_id: ride.driver_id })
              if (data?.success) { alert('✅ Ride marked as completed!'); window.location.reload() }
            }} style={{ padding: '8px 14px', background: '#052e16', color: '#4ade80', border: '1px solid #166534', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✅ Complete</button>
          ) : null
        })()}
      </div>
      {expanded && (
        <div>
          {loadingPax ? <div style={{ textAlign: 'center', padding: 16, color: '#aaa', fontSize: 13 }}>Loading passengers...</div>
          : passengers.length === 0 ? <div style={{ textAlign: 'center', padding: 12, color: '#aaa', fontSize: 13 }}>No confirmed bookings yet</div>
          : passengers.map(b => <PassengerCard key={b.id} booking={b} unreadCount={unreadCounts[b.id] || 0} />)}
        </div>
      )}
    </div>
  )
}



export default function MyRides() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  // A notification tap sets ?tab= and always wins. Otherwise we pick the tab
  // based on the user's most recent action (see chooseTabByActivity below).
  const urlTab = new URLSearchParams(window.location.search).get('tab')
  const [tab, setTab] = useState(urlTab === 'booked' ? 'booked' : 'posted')
  // Only auto-pick by activity once, and only when no ?tab= was given.
  const autoPickDone = useRef(!!urlTab)
  const [upiSheet, setUpiSheet] = useState(null)
  const [rides, setRides] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadCounts, setUnreadCounts] = useState({})

  const location = useLocation()
  // If a notification navigates here (even while the app is already open),
  // switch to the tab named in ?tab=.
  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab')
    if (t === 'booked' || t === 'posted') { setTab(t); autoPickDone.current = true }
  }, [location.search])

  // First load with NO ?tab=: open the tab matching the user's most recent
  // action — whichever they did more recently (posted vs booked). Handles
  // "Both" users by real activity rather than a fixed default. Runs once,
  // after loading finishes, using the settled rides/bookings arrays.
  useEffect(() => {
    if (autoPickDone.current) return
    if (loading) return
    autoPickDone.current = true

    const latest = (arr, field) => arr.reduce((max, x) => {
      const ts = new Date(x[field] || 0).getTime()
      return ts > max ? ts : max
    }, 0)

    const lastPosted = latest(rides, 'created_at')
    const lastBooked = latest(bookings, 'created_at')

    // Booked more recently → I Booked. Otherwise (posted more recently, only
    // posted, or nothing yet) → I Posted.
    setTab(lastBooked > lastPosted ? 'booked' : 'posted')
  }, [loading])

  useEffect(() => { fetchData() }, [])

  // Open the payment sheet for a booking (PayFare does the rest).
  function openUpiSheet(b) { setUpiSheet(b) }

  // Withdraw a payment claim made by mistake. Only possible until the owner
  // confirms (the DB trigger enforces that too). The owner is told, so they don't
  // go hunting for money that was never sent.
  async function unmarkPaid(b) {
    if (payState(b) !== 'claimed') return
    const ok = window.confirm('Withdraw your "I\'ve paid" claim?\n\nUse this only if you tapped it by mistake or the payment did not go through.')
    if (!ok) return
    const { data, error } = await supabase
      .from('bookings')
      .update({ payment_status: 'pending', payment_ref: null })
      .eq('id', b.id)
      .eq('rider_id', user.id)
      .select('id')
    if (error || !data || data.length === 0) {
      alert('Could not undo. Please try again.')
      return
    }
    if (b.rides?.driver_id) {
      await supabase.from('notifications').insert({
        user_id: b.rides.driver_id, type: 'booking', booking_id: b.id, is_read: false,
        title: '↩️ Payment claim withdrawn',
        message: `${profile?.full_name?.split(' ')[0] || 'Your rider'} withdrew the "paid" mark for ${b.rides?.from_location} → ${b.rides?.to_location}. Nothing to check yet.`,
      })
    }
    await fetchData()
  }


  async function fetchUnreadCounts(bookingIds) {
    if (!bookingIds.length) return
    const { data } = await supabase.from('messages').select('booking_id').in('booking_id', bookingIds).eq('read', false).neq('sender_id', user.id)
    const counts = {}
    ;(data || []).forEach(m => { counts[m.booking_id] = (counts[m.booking_id] || 0) + 1 })
    setUnreadCounts(counts)
  }

  async function sendNotification(userId, title, message) {
    await supabase.from('notifications').insert({ user_id: userId, title, message, type: 'booking', is_read: false })
  }

  async function fetchData() {
    setLoading(true)
    // Show cached data instantly (so offline users still see their history)
    // while we try to refresh from the network.
    try {
      const cachedRides = localStorage.getItem(`myrides_rides_${user.id}`)
      const cachedBookings = localStorage.getItem(`myrides_bookings_${user.id}`)
      if (cachedRides) setRides(JSON.parse(cachedRides))
      if (cachedBookings) {
        const cb = JSON.parse(cachedBookings)
        setBookings(cb)
      }
    } catch (_) {}

    try {
      const [ridesRes, bookingsRes] = await Promise.all([
        supabase.from('rides').select('*').eq('driver_id', user.id).order('ride_date', { ascending: false }),
        supabase.from('bookings').select('*, rides(driver_id, from_location, to_location, ride_date, ride_time, fare, ride_type, vehicle_model, vehicle_number, profiles(full_name, phone, upi_id, pay_by_phone))').eq('rider_id', user.id).order('created_at', { ascending: true }),
      ])
      if (!ridesRes.error) {
        setRides(ridesRes.data || [])
        try { localStorage.setItem(`myrides_rides_${user.id}`, JSON.stringify(ridesRes.data || [])) } catch (_) {}
      }
      if (!bookingsRes.error) {
        const allBookings = bookingsRes.data || []
        const grouped = {}
        allBookings.filter(b => b.status === 'confirmed' || b.status === 'completed').forEach(b => {
          if (grouped[b.ride_id]) { grouped[b.ride_id].seats_booked += b.seats_booked; grouped[b.ride_id].total_paid += b.total_paid; grouped[b.ride_id].ride_fare += b.ride_fare }
          else { grouped[b.ride_id] = { ...b } }
        })
        // Pending requests shown individually (never grouped) so each can be
        // withdrawn on its own. Declined/expired go in a collapsed section.
        const pending = allBookings.filter(b => b.status === 'pending')
        const cancelled = allBookings.filter(b => b.status === 'cancelled')
        const declined = allBookings.filter(b => b.status === 'declined' || b.status === 'expired')
        const finalBookings = [...Object.values(grouped), ...pending, ...cancelled, ...declined]
        setBookings(finalBookings)
        try { localStorage.setItem(`myrides_bookings_${user.id}`, JSON.stringify(finalBookings)) } catch (_) {}
        fetchUnreadCounts(finalBookings.map(b => b.id))
      }
    } catch (_) {
      // Offline or network failure — the cached data loaded above stays on screen.
    }
    setLoading(false)
  }

  async function cancelRide(rideId) {
    if (!confirm('Cancel this ride?\n\nRiders will get ₹2 refund. You will not be refunded.')) return
    try {
      // One server-side call: cancels the ride + all confirmed bookings,
      // refunds each rider, and notifies them. Driver is verified by auth.uid().
      const { data, error } = await supabase.rpc('cancel_ride_by_driver', { p_ride_id: rideId, p_driver_id: user.id })
      if (error || !data?.success) { alert(data?.message || 'Could not cancel the ride. Please try again.'); return }
      await fetchData()
    } catch (err) { alert('Something went wrong. Please try again.') }
  }

  async function cancelAllRecurring(rideId) {
    if (!confirm('Cancel ALL future rides in this recurring series?\n\nOnly rides with no bookings will be cancelled.')) return
    const { data: ride } = await supabase.from('rides').select('ride_date, from_location, to_location, ride_time').eq('id', rideId).maybeSingle()
    if (!ride) return
    const { data: recurringRides } = await supabase.from('rides').select('id').eq('driver_id', user.id).eq('is_recurring', true).eq('from_location', ride.from_location).eq('to_location', ride.to_location).eq('ride_time', ride.ride_time).gte('ride_date', ride.ride_date).eq('status', 'active')
    if (recurringRides?.length > 0) {
      for (const r of recurringRides) {
        const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('ride_id', r.id).eq('status', 'confirmed')
        if (count === 0) await supabase.from('rides').update({ status: 'cancelled' }).eq('id', r.id)
      }
    }
    await fetchData()
  }

  async function cancelBooking(bookingId, rideId, seatsBooked) {
    if (!confirm('Cancel your booking?\n\nYour ₹2 platform fee will NOT be refunded.')) return
    try {
      const { data, error } = await supabase.rpc('cancel_booking_atomic', { p_booking_id: bookingId, p_rider_id: user.id })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Cancel failed')
      await sendNotification(data.driver_id, '❌ Booking Cancelled', `A rider cancelled their booking for ${data.from_location} → ${data.to_location}. Your ₹2 platform fee has been refunded.`)
      alert('✅ Booking cancelled.')
      await fetchData()
    } catch (err) { alert('Something went wrong: ' + err.message) }
  }

  // Withdraw a still-pending request (owner hasn't approved). No fee was charged.
  async function withdrawRequest(bookingId) {
    if (!confirm('Withdraw your request?\n\nThe seat is released and nothing was charged.')) return
    const { data, error } = await supabase.rpc('cancel_pending_request', { p_booking_id: bookingId })
    if (error || !data?.success) { alert(data?.error || 'Could not withdraw. Please try again.'); return }
    await fetchData()
  }

  const activeBookings = bookings.filter(b => b.status === 'confirmed')
  const completedBookings = bookings.filter(b => b.status === 'completed')
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled')
  const pendingBookings = bookings.filter(b => b.status === 'pending')
  const declinedBookings = bookings.filter(b => b.status === 'declined' || b.status === 'expired')

  const tabStyle = (active) => ({
    flex: 1, padding: '10px', background: 'none', border: 'none',
    fontWeight: active ? 700 : 400, fontSize: 14,
    color: active ? '#fff' : '#888',
    borderBottom: `2px solid ${active ? '#facc15' : 'transparent'}`,
    cursor: 'pointer',
  })

  return (
    <div style={{ paddingBottom: 90, background: '#f5f6fa', minHeight: '100vh' }}>
      <div style={{ background: '#111', padding: '20px 16px 0', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 16 }}>📋 My Rides</div>
        <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
          <button style={tabStyle(tab === 'posted')} onClick={() => setTab('posted')}>🚗 I Posted ({rides.filter(r => ['active','full'].includes(r.status)).length})</button>
          <button style={tabStyle(tab === 'booked')} onClick={() => setTab('booked')}>🎫 I Booked ({activeBookings.length + completedBookings.length + pendingBookings.length})</button>
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading...</div>
        ) : tab === 'posted' ? (
          rides.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40 }}>🚗</div>
              <div style={{ color: '#aaa', marginTop: 8 }}>No rides posted yet</div>
              <div style={{ color: '#bbb', fontSize: 12, marginTop: 4 }}>Tap + below to post your first ride</div>
            </div>
          ) : (() => {
            // A ride is "past" if cancelled/completed OR its date+time already
            // passed. Nothing auto-flips an 'active' ride to completed when its
            // time is gone, which is why time-passed rides wrongly stayed in the
            // colourful current list instead of the grey past section.
            const nowMs = Date.now()
            const isPastRide = (r) => {
              if (['cancelled', 'completed'].includes(r.status)) return true
              const dt = new Date(`${r.ride_date}T${r.ride_time || '23:59'}`)
              return dt.getTime() < nowMs - 30 * 60000
            }
            // Soonest upcoming ride first (tomorrow before next week); for past
            // rides, most-recent first. 'YYYY-MM-DD'+'HH:MM' sorts correctly as text.
            const key = r => `${r.ride_date} ${r.ride_time || '23:59'}`
            const currentRides = rides.filter(r => !isPastRide(r)).sort((a, b) => key(a).localeCompare(key(b)))
            const pastRides = rides.filter(isPastRide).sort((a, b) => key(b).localeCompare(key(a)))
            return (
            <>
              {/* Current/upcoming rides — full colour */}
              {currentRides.map(r => (
                <DriverRideCard key={r.id} ride={r} onCancel={cancelRide} onEdit={id => navigate(`/edit-ride/${id}`)} onCancelAll={cancelAllRecurring} unreadCounts={unreadCounts} />
              ))}

              {/* Past rides — grey, open by default so payment shows at a glance. */}
              {pastRides.length > 0 && (
                <details style={{ marginTop: 12 }}>
                  <summary style={{ fontSize: 12, color: '#888', cursor: 'pointer', padding: '8px 0', userSelect: 'none', fontWeight: 700, listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>▶</span> Past rides — {pastRides.length} (tap to view)
                  </summary>
                  {pastRides.map(r => (
                    <DriverRideCard key={r.id} ride={r} onCancel={cancelRide} onEdit={id => navigate(`/edit-ride/${id}`)} onCancelAll={cancelAllRecurring} unreadCounts={unreadCounts} isPast />
                  ))}
                </details>
              )}
            </>
            )
          })()
        ) : (
          activeBookings.length === 0 && completedBookings.length === 0 && cancelledBookings.length === 0 && pendingBookings.length === 0 && declinedBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40 }}>🎫</div>
              <div style={{ color: '#aaa', marginTop: 8 }}>No bookings yet</div>
              <div style={{ color: '#bbb', fontSize: 12, marginTop: 4 }}>Find a ride on the home screen</div>
            </div>
          ) : (
            <>
              {/* Pending requests — waiting for the owner to approve. */}
              {pendingBookings.map(b => (
                <div key={b.id} style={{ background: '#fffbeb', borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 10, borderLeft: '4px solid #f59e0b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{b.rides?.from_location} → {b.rides?.to_location}</div>
                      <div style={{ color: '#888', fontSize: 12, marginTop: 3 }}>
                        {b.rides?.ride_date && new Date(b.rides.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {formatTime(b.rides?.ride_time)}
                      </div>
                    </div>
                    <span style={{ background: '#fef3c7', color: '#b45309', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>⏳ Awaiting approval</span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: '#92400e', background: '#fef9ec', borderRadius: 8, padding: '8px 10px', lineHeight: 1.6 }}>
                    Waiting for {b.rides?.profiles?.full_name?.split(' ')[0] || 'the owner'} to approve. <b>₹2 is charged only if they approve</b> — nothing yet.
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <button onClick={() => navigate(`/chat/${b.id}`)} style={{ flex: 1, padding: 9, background: '#fefce8', color: '#854d0e', border: '1px solid #fef08a', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>💬 Message owner</button>
                    <button onClick={() => withdrawRequest(b.id)} style={{ flex: 1, padding: 9, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Withdraw</button>
                  </div>
                </div>
              ))}

              {activeBookings.map(b => (
                <div key={b.id} style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 10, borderLeft: `4px solid ${payState(b) === 'confirmed' ? '#16a34a' : '#f59e0b'}` }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{b.rides?.from_location} → {b.rides?.to_location}</div>
                  <div style={{ color: '#888', fontSize: 12, marginTop: 3 }}>
                    {b.rides?.ride_date && new Date(b.rides.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {formatTime(b.rides?.ride_time)}
                  </div>
                  {b.rides?.profiles && (
                    <div style={{ marginTop: 8, background: '#f8f9fa', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>🚗 Car Owner</div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{b.rides.profiles.full_name}</div>
                      {(b.rides?.vehicle_model || b.rides?.vehicle_number) && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                          🚘 {b.rides.vehicle_model || 'Car'}{b.rides.vehicle_number ? ` · ${b.rides.vehicle_number}` : ''}
                        </div>
                      )}
                      <ContactButtons phone={b.rides.profiles.phone} name={b.rides.profiles.full_name} bookingId={b.id} navigate={navigate} />
                    </div>
                  )}
                  {unreadCounts[b.id] > 0 && (
                    <button onClick={() => navigate(`/chat/${b.id}`)} style={{ width: '100%', marginTop: 10, padding: '10px', background: '#fefce8', border: '2px solid #facc15', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: '#854d0e' }}>
                      💬 {unreadCounts[b.id]} new message{unreadCounts[b.id] > 1 ? 's' : ''} from car owner
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>✅ {b.seats_booked} seat{b.seats_booked > 1 ? 's' : ''} confirmed</span>
                    <span style={{ background: '#f8f9fa', color: '#555', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>💰 ₹2 platform fee paid</span>
                  </div>
                  {/* Pay driver — rider claims, owner confirms */}
                  {b.status !== 'cancelled' && b.status !== 'completed' && (() => {
                    const st = payState(b)
                    const owner = b.rides?.profiles?.full_name?.split(' ')[0] || 'the owner'
                    const fare = b.ride_fare || b.rides?.fare
                    const payBtn = (label) => payeeAvailable(b.rides?.profiles) ? (
                      <button onClick={() => openUpiSheet(b)} style={{ width: '100%', marginTop: 8, padding: '11px', background: '#111', color: '#facc15', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                        {label}
                      </button>
                    ) : null
                    if (st === 'confirmed') return (
                      <div style={{ marginTop: 8, padding: '11px', background: '#dcfce7', color: '#15803d', borderRadius: 10, fontSize: 13, fontWeight: 700, textAlign: 'center' }}>✓ {owner} confirmed ₹{fare}</div>
                    )
                    if (st === 'claimed') return (
                      <div style={{ marginTop: 8, padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#b45309' }}>⏳ Waiting for {owner} to confirm ₹{fare}</div>
                        <div style={{ fontSize: 11, color: '#92400e', marginTop: 3, lineHeight: 1.4 }}>They check their own UPI app. You'll be notified.</div>
                        <button onClick={() => unmarkPaid(b)} style={{ marginTop: 8, padding: '7px 12px', background: 'transparent', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Tapped by mistake? Undo</button>
                      </div>
                    )
                    if (st === 'disputed') return (
                      <div style={{ marginTop: 8, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626' }}>⚠️ {owner} didn't receive ₹{fare}</div>
                        <div style={{ fontSize: 11, color: '#7f1d1d', marginTop: 3, lineHeight: 1.4 }}>If you paid, send them your transaction ID in chat. If not, please pay again.</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button onClick={() => navigate(`/chat/${b.id}`)} style={{ flex: 1, padding: 9, background: '#fefce8', color: '#854d0e', border: '1px solid #fef08a', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>💬 Message {owner}</button>
                          {payeeAvailable(b.rides?.profiles) && <button onClick={() => openUpiSheet(b)} style={{ flex: 1, padding: 9, background: '#111', color: '#facc15', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>💳 Pay again</button>}
                        </div>
                      </div>
                    )
                    return payBtn(`💳 Pay ₹${fare} to ${owner}`)
                  })()}
                  {/* Rate the driver — inline, once the ride is completed */}
                  {b.status === 'completed' && (
                    <RiderRatesDriver booking={b} />
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    {b.status !== 'cancelled' && b.status !== 'completed' && (
                      <button onClick={() => cancelBooking(b.id, b.ride_id, b.seats_booked)} style={{ flex: 1, padding: 9, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🚫 Cancel Booking</button>
                    )}
                  </div>
                </div>
              ))}
              {cancelledBookings.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 12, color: '#aaa', cursor: 'pointer', padding: '8px 0', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>▶</span> {cancelledBookings.length} cancelled booking{cancelledBookings.length > 1 ? 's' : ''} (tap to show)
                  </summary>
                  {cancelledBookings.map(b => (
                    <div key={b.id} style={{ background: '#fafafa', borderRadius: 12, padding: 12, marginTop: 8, border: '1px solid #f0f0f0', opacity: 0.7 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#888' }}>{b.rides?.from_location} → {b.rides?.to_location}</div>
                      <div style={{ color: '#bbb', fontSize: 12, marginTop: 2 }}>{b.rides?.ride_date && new Date(b.rides.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ❌ Cancelled</div>
                    </div>
                  ))}
                </details>
              )}

              {/* Declined / expired requests — collapsed, no fee was ever charged */}
              {declinedBookings.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 12, color: '#aaa', cursor: 'pointer', padding: '8px 0', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>▶</span> {declinedBookings.length} request{declinedBookings.length > 1 ? 's' : ''} not approved (tap to show)
                  </summary>
                  {declinedBookings.map(b => (
                    <div key={b.id} style={{ background: '#fafafa', borderRadius: 12, padding: 12, marginTop: 8, border: '1px solid #f0f0f0', opacity: 0.75 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#888' }}>{b.rides?.from_location} → {b.rides?.to_location}</div>
                      <div style={{ color: '#bbb', fontSize: 12, marginTop: 2 }}>
                        {b.rides?.ride_date && new Date(b.rides.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {b.status === 'expired' ? '⌛ Expired (owner didn’t respond)' : '❌ Declined by owner'} · no fee charged
                      </div>
                    </div>
                  ))}
                </details>
              )}

              {/* Completed bookings - collapsed past rides */}
              {completedBookings.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer', padding: '8px 0', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>▶</span> {completedBookings.length} completed ride{completedBookings.length > 1 ? 's' : ''} (tap to show)
                  </summary>
                  {completedBookings.map(b => {
                    const st = payState(b)
                    const isPaid = st === 'confirmed' || st === 'claimed'
                    const fare = b.ride_fare || b.rides?.fare || 150
                    const driverName = b.rides?.profiles?.full_name?.split(' ')[0] || 'Driver'
                    return (
                    <div key={b.id} style={{ background: isPaid ? '#f8fafc' : '#fff7ed', borderRadius: 12, padding: 12, marginTop: 8, border: isPaid ? '1px solid #e2e8f0' : '1px solid #fed7aa' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#64748b' }}>{b.rides?.from_location} → {b.rides?.to_location}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                        {b.rides?.ride_date && new Date(b.rides.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ✅ Completed
                      </div>

                      {/* Payment status — a completed ride can still be UNPAID.
                          Don't hide the pay option just because the ride is over. */}
                      {st === 'confirmed' ? (
                        <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#15803d' }}>✓ {driverName} confirmed ₹{fare}</div>
                      ) : st === 'claimed' ? (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#b45309' }}>⏳ Waiting for {driverName} to confirm ₹{fare}</div>
                          <button onClick={() => unmarkPaid(b)} style={{ marginTop: 6, padding: '6px 10px', background: 'transparent', border: '1px solid #fcd34d', color: '#92400e', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Tapped by mistake? Undo</button>
                        </div>
                      ) : (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: st === 'disputed' ? '#dc2626' : '#c2410c', marginBottom: 6 }}>
                            {st === 'disputed' ? `⚠️ ${driverName} didn't receive ₹${fare}` : `⏳ You haven't paid ₹${fare} yet`}
                          </div>
                          {payeeAvailable(b.rides?.profiles) && (
                            <button onClick={() => openUpiSheet(b)} style={{ width: '100%', padding: '10px', background: '#111', color: '#facc15', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                              💳 {st === 'disputed' ? 'Pay again' : 'Pay'} ₹{fare} to {driverName}
                            </button>
                          )}
                        </div>
                      )}

                      <button onClick={() => navigate(`/live/${b.id}?rate=true`)} style={{ marginTop: 8, padding: '7px 14px', background: '#ede9fe', color: '#7c3aed', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⭐ Rate</button>
                    </div>
                    )
                  })}
                </details>
              )}
            </>
          )
        )}
      </div>

      <BottomNav />

      {/* UPI Payment Sheet — copy-first, because the rider is paying FROM this
          same phone and cannot scan a QR shown on its own screen. */}
      {upiSheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <div onClick={() => setUpiSheet(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px 20px 40px', animation: 'slideUp 0.3s ease', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 100, margin: '0 auto 20px' }} />
            <PayFare
              amount={upiSheet.ride_fare || upiSheet.rides?.fare || 150}
              ownerName={upiSheet.rides?.profiles?.full_name?.split(' ')[0] || 'Driver'}
              upiId={upiSheet.rides?.profiles?.upi_id}
              phone={upiSheet.rides?.profiles?.phone}
              payByPhone={upiSheet.rides?.profiles?.pay_by_phone}
              bookingId={upiSheet.id}
              driverId={upiSheet.rides?.driver_id}
              route={`${upiSheet.rides?.from_location || ''} → ${upiSheet.rides?.to_location || ''}`}
              onPaid={() => { setTimeout(() => { setUpiSheet(null); fetchData() }, 1200) }}
            />
            <div style={{ height: 12 }} />
            <button onClick={() => setUpiSheet(null)} style={{ width: '100%', padding: 12, background: 'none', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Close</button>
          </div>
        </div>
      )}
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  )
}
