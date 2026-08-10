import { useState, useEffect, useRef } from 'react'
import QRCode from 'qrcode'
import { formatTime, formatDate } from '../lib/utils'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { hasRated, getBookingRatings, submitRating as submitRatingLib } from '../lib/ratings'
import BottomNav from '../components/BottomNav'

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
          ['💰 Platform fee', '₹2 (wallet)'],
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
  const [expanded, setExpanded] = useState(false)
  const [passengers, setPassengers] = useState([])
  const [loadingPax, setLoadingPax] = useState(false)
  const [actualBookedCount, setActualBookedCount] = useState(null)
  const [paySummary, setPaySummary] = useState(null)  // { collected, pending, paidCount, unpaidCount }
  const [payRows, setPayRows] = useState([])          // per-rider payment rows
  const [payOpen, setPayOpen] = useState(false)       // past-ride payment expanded?
  const [busyRow, setBusyRow] = useState(null)        // bookingId being acted on

  // Confirm the driver received a rider's payment (marks paid + confirmed).
  async function confirmRow(row) {
    setBusyRow(row.bookingId)
    const { data } = await supabase.from('bookings')
      .update({ driver_confirmed: true, payment_status: 'paid' })
      .eq('id', row.bookingId).select('id')
    if (data?.length) {
      setPayRows(rows => rows.map(r => r.riderId === row.riderId ? { ...r, paid: true, driverConfirmed: true } : r))
      recomputeSummary(row.riderId, true)
      await supabase.from('notifications').insert({
        user_id: row.riderId, title: '✅ Payment confirmed',
        message: `The driver confirmed receiving ₹${row.amount}. Thank you!`,
        type: 'booking', booking_id: row.bookingId, is_read: false,
      })
    } else {
      alert('Could not save. The driver_confirmed column may be missing — tell the admin.')
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

  function recomputeSummary(riderId, nowPaid) {
    setPaySummary(s => {
      if (!s) return s
      const row = payRows.find(r => r.riderId === riderId)
      if (!row || row.paid === nowPaid) return s
      const delta = row.amount
      return {
        collected: s.collected + (nowPaid ? delta : -delta),
        pending: s.pending + (nowPaid ? -delta : delta),
        paidCount: s.paidCount + (nowPaid ? 1 : -1),
        unpaidCount: s.unpaidCount + (nowPaid ? -1 : 1),
      }
    })
  }
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
      .select('id, rider_id, ride_fare, seats_booked, payment_status, driver_confirmed, profiles(full_name, phone)')
      .eq('ride_id', ride.id).in('status', ['confirmed', 'completed'])
      .then(({ data }) => {
        if (!data) return
        // Group multiple bookings by the same rider into one row.
        const grouped = {}
        data.forEach(b => {
          const amt = b.ride_fare || ride.fare || 0
          if (grouped[b.rider_id]) {
            grouped[b.rider_id].amount += amt
            grouped[b.rider_id].seats += b.seats_booked
            grouped[b.rider_id].paid = grouped[b.rider_id].paid && (b.payment_status === 'paid' || b.driver_confirmed)
          } else {
            grouped[b.rider_id] = {
              bookingId: b.id, riderId: b.rider_id,
              name: b.profiles?.full_name || 'Rider',
              phone: b.profiles?.phone || '',
              amount: amt, seats: b.seats_booked,
              paid: b.payment_status === 'paid' || b.driver_confirmed,
              driverConfirmed: b.driver_confirmed,
            }
          }
        })
        const rows = Object.values(grouped)
        const collected = rows.filter(r => r.paid).reduce((s, r) => s + r.amount, 0)
        const pending = rows.filter(r => !r.paid).reduce((s, r) => s + r.amount, 0)
        setPayRows(rows)
        setPaySummary({ collected, pending, paidCount: rows.filter(r => r.paid).length, unpaidCount: rows.filter(r => !r.paid).length })
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
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>₹{ride.fare}/seat</span>
        <span style={{ background: '#fff7ed', color: '#c2410c', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>💺 {ride.seats_available} left of {ride.seats_total}</span>
        {bookedCount > 0 && <span style={{ background: '#ede9fe', color: '#7c3aed', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>👥 {bookedCount} passenger{bookedCount > 1 ? 's' : ''}</span>}
      </div>
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
            background: paySummary.pending > 0 ? '#fef2f2' : '#f3f4f6',
            border: paySummary.pending > 0 ? '1px solid #fecaca' : '1px solid #e5e7eb',
          }}>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: paySummary.pending > 0 ? '#dc2626' : '#6b7280' }}>
              {paySummary.pending > 0
                ? `⚠️ ${paySummary.unpaidCount} unpaid · ₹${paySummary.pending} to collect`
                : `✓ All ${paySummary.paidCount} paid · ₹${paySummary.collected}`}
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{payOpen ? '▲' : '▼'}</span>
          </button>

          {payOpen && (
            <div style={{ marginTop: 6, background: '#fff', borderRadius: 10, border: '1px solid #eef0f2', overflow: 'hidden' }}>
              {payRows.map(row => (
                <div key={row.riderId} style={{ padding: '10px 12px', borderTop: '1px solid #f1f2f4', background: row.paid ? 'transparent' : '#fff5f5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{row.name}</div>
                      <div style={{ fontSize: 12, fontWeight: row.paid ? 400 : 800, color: row.paid ? '#94a3b8' : '#dc2626' }}>
                        {row.paid ? `₹${row.amount}` : `⏳ owes ₹${row.amount}`}{row.seats > 1 ? ` · ${row.seats} seats` : ''}
                      </div>
                    </div>
                    {row.paid ? (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d', flexShrink: 0 }}>
                        {row.driverConfirmed ? '✓ Received' : '✓ Paid'}
                      </span>
                    ) : (
                      <button onClick={() => confirmRow(row)} disabled={busyRow === row.bookingId}
                        style={{ padding: '6px 10px', background: '#16a34a', border: 'none', color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>✓ Got it</button>
                    )}
                  </div>
                  {/* Unpaid → give the driver the tools to chase: phone + remind */}
                  {!row.paid && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      {row.phone && (
                        <a href={`tel:${row.phone}`} style={{ flex: 1, textAlign: 'center', padding: '7px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>📞 {row.phone}</a>
                      )}
                      <button onClick={() => remindRow(row)} disabled={busyRow === row.bookingId}
                        style={{ flex: 1, padding: '7px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🔔 Remind</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ACTIVE rides — compact always-visible summary (unchanged) */}
      {payRows.length > 0 && paySummary && !isPast && (
        <div style={{ marginTop: 10, background: '#f9fafb', borderRadius: 10, border: '1px solid #eef0f2', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: paySummary.pending > 0 ? '#fffbeb' : '#f0fdf4', fontSize: 12, fontWeight: 800 }}>
            <span style={{ color: '#15803d' }}>✓ Collected ₹{paySummary.collected}</span>
            {paySummary.pending > 0
              ? <span style={{ color: '#c2410c' }}>⏳ Pending ₹{paySummary.pending}</span>
              : <span style={{ color: '#15803d' }}>All paid 🎉</span>}
          </div>
          <div>
            {payRows.map(row => (
              <div key={row.riderId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderTop: '1px solid #f1f2f4', background: row.paid ? 'transparent' : '#fff5f5' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
                  <div style={{ fontSize: 12, fontWeight: row.paid ? 400 : 800, color: row.paid ? '#94a3b8' : '#dc2626' }}>
                    {row.paid ? '' : '⏳ owes '}₹{row.amount}{row.seats > 1 ? ` · ${row.seats} seats` : ''}
                  </div>
                </div>
                {row.paid ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d', flexShrink: 0 }}>
                    {row.driverConfirmed ? '✓ Received' : '✓ Paid'}
                  </span>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => remindRow(row)} disabled={busyRow === row.bookingId}
                      style={{ padding: '5px 9px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🔔</button>
                    <button onClick={() => confirmRow(row)} disabled={busyRow === row.bookingId}
                      style={{ padding: '5px 9px', background: '#16a34a', border: 'none', color: '#fff', borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✓ Got it</button>
                  </div>
                )}
              </div>
            ))}
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
        {ride.is_recurring && ride.status === 'active' && (
          <button onClick={() => onCancelAll(ride.id)} style={{ padding: '8px 10px', background: '#fff7ed', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>🔁 Cancel Series</button>
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

// Build a spec-compliant UPI intent. The standard `upi://pay` scheme is the
// ONLY one every UPI app + bank reliably honours. App-specific schemes like
// phonepe:// / gpay:// / paytmmp:// are unofficial and get rejected as
// "declined for security reasons" when built externally — which is exactly
// the bug we hit. So every button uses upi://pay and lets the OS/app resolve.
function buildUpiUrl(upi, name, fare) {
  // NOTE: do NOT use URLSearchParams here. It form-encodes — turning @ into
  // %40 and spaces into "+". UPI apps read those literally and reject the VPA
  // ("declined for security reasons"). UPI needs RFC-3986: @ stays literal,
  // spaces become %20. encodeURIComponent gives us exactly that.
  const pa = String(upi || '').trim()                 // VPA: keep @ literal
  const pn = encodeURIComponent(String(name || 'Driver').trim())
  const am = Number(fare || 0).toFixed(2)
  const tn = encodeURIComponent('CarpoolKaro ride fare')
  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`
}

// UPI App Logo SVGs. All use the standard builder; the label just tells the
// user which icon to look for in the app chooser.
const UPI_APPS = [
  {
    name: 'PhonePe',
    url: buildUpiUrl,
    logo: (
      <svg viewBox="0 0 48 48" width="40" height="40">
        <rect width="48" height="48" rx="12" fill="#5f259f"/>
        <circle cx="24" cy="20" r="8" fill="none" stroke="white" strokeWidth="2.5"/>
        <path d="M18 26 L24 14 L30 26" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16 32 Q24 28 32 32" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    )
  },
  {
    name: 'Google Pay',
    url: buildUpiUrl,
    logo: (
      <svg viewBox="0 0 48 48" width="40" height="40">
        <rect width="48" height="48" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1"/>
        <text x="5" y="32" fontSize="22" fontWeight="900" fontFamily="Arial" fill="#4285F4">G</text>
        <text x="22" y="32" fontSize="22" fontWeight="900" fontFamily="Arial" fill="#EA4335">P</text>
        <text x="36" y="32" fontSize="14" fontWeight="700" fontFamily="Arial" fill="#FBBC05">a</text>
        <text x="44" y="32" fontSize="14" fontWeight="700" fontFamily="Arial" fill="#34A853">y</text>
      </svg>
    )
  },
  {
    name: 'Paytm',
    url: buildUpiUrl,
    logo: (
      <svg viewBox="0 0 48 48" width="40" height="40">
        <rect width="48" height="48" rx="12" fill="#002970"/>
        <rect x="6" y="14" width="36" height="8" rx="2" fill="#00BAF2"/>
        <text x="24" y="36" textAnchor="middle" fontSize="10" fontWeight="800" fontFamily="Arial" fill="white">PAYTM</text>
      </svg>
    )
  },
  {
    name: 'BHIM',
    url: buildUpiUrl,
    logo: (
      <svg viewBox="0 0 48 48" width="40" height="40">
        <rect width="48" height="48" rx="12" fill="#00529C"/>
        <rect x="0" y="30" width="48" height="18" rx="12" fill="#FF6B00"/>
        <text x="24" y="22" textAnchor="middle" fontSize="13" fontWeight="900" fontFamily="Arial" fill="white">BHIM</text>
        <text x="24" y="42" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="Arial" fill="white">UPI</text>
      </svg>
    )
  },
  {
    name: 'Amazon Pay',
    url: buildUpiUrl,
    logo: (
      <svg viewBox="0 0 48 48" width="40" height="40">
        <rect width="48" height="48" rx="12" fill="#1A1919"/>
        <text x="24" y="22" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="Arial" fill="white">amazon</text>
        <path d="M10 26 Q24 32 38 26" fill="none" stroke="#FF9900" strokeWidth="2.5" strokeLinecap="round"/>
        <text x="24" y="38" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="Arial" fill="#FF9900">pay</text>
      </svg>
    )
  },
  {
    name: 'WhatsApp',
    url: (upi, name, fare) => `whatsapp://send?text=${encodeURIComponent(`Please send ₹${fare} to UPI ID: ${upi}`)}`,
    logo: (
      <svg viewBox="0 0 48 48" width="40" height="40">
        <rect width="48" height="48" rx="12" fill="#25D366"/>
        <path d="M24 10C16.27 10 10 16.27 10 24c0 2.61.71 5.05 1.95 7.14L10 38l7.14-1.87C19.1 37.32 21.48 38 24 38c7.73 0 14-6.27 14-14S31.73 10 24 10zm7.21 19.85c-.32.89-1.85 1.7-2.56 1.75-.69.05-1.34.33-4.5-.94-3.79-1.5-6.21-5.37-6.4-5.62-.19-.25-1.55-2.06-1.55-3.93s.97-2.79 1.33-3.17c.36-.38.78-.48 1.03-.48h.74c.24 0 .56-.09.88.67.32.76 1.07 2.6 1.16 2.79.09.19.15.41.03.66-.12.25-.18.41-.36.62-.18.22-.37.48-.53.65-.18.18-.36.37-.15.72.21.35.92 1.5 1.97 2.43 1.35 1.2 2.5 1.57 2.84 1.75.34.18.56.15.77-.09.21-.24.88-1.03 1.12-1.39.24-.35.49-.29.82-.18.33.12 2.09.99 2.45 1.17.36.18.59.27.68.42.09.16.09.88-.22 1.77z" fill="white"/>
      </svg>
    )
  },
  {
    name: 'Cred',
    url: buildUpiUrl,
    logo: (
      <svg viewBox="0 0 48 48" width="40" height="40">
        <rect width="48" height="48" rx="12" fill="#1C1C1C"/>
        <text x="24" y="20" textAnchor="middle" fontSize="11" fontWeight="900" fontFamily="Arial" fill="#FFD700">CRED</text>
        <rect x="10" y="24" width="28" height="2" rx="1" fill="#FFD700" opacity="0.5"/>
        <text x="24" y="36" textAnchor="middle" fontSize="8" fontWeight="600" fontFamily="Arial" fill="#888">pay</text>
      </svg>
    )
  },
  {
    name: 'Any UPI',
    url: buildUpiUrl,
    logo: (
      <svg viewBox="0 0 48 48" width="40" height="40">
        <rect width="48" height="48" rx="12" fill="#0f172a"/>
        <text x="24" y="20" textAnchor="middle" fontSize="8" fontWeight="700" fontFamily="Arial" fill="white">ANY</text>
        <text x="24" y="30" textAnchor="middle" fontSize="11" fontWeight="900" fontFamily="Arial" fill="#facc15">UPI</text>
        <rect x="8" y="33" width="32" height="2" rx="1" fill="#facc15" opacity="0.4"/>
      </svg>
    )
  },
]

export default function MyRides() {
  const { user } = useAuth()
  const navigate = useNavigate()
  // A notification tap sets ?tab= and always wins. Otherwise we pick the tab
  // based on the user's most recent action (see chooseTabByActivity below).
  const urlTab = new URLSearchParams(window.location.search).get('tab')
  const [tab, setTab] = useState(urlTab === 'booked' ? 'booked' : 'posted')
  // Only auto-pick by activity once, and only when no ?tab= was given.
  const autoPickDone = useRef(!!urlTab)
  const [upiSheet, setUpiSheet] = useState(null)
  const [copied, setCopied] = useState(false)
  const [payingId, setPayingId] = useState(null)
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

  // Open the payment sheet. Copy-first is the primary path because the rider is
  // paying from this same phone — a QR on its own screen can't be scanned by it.
  async function openUpiSheet(upi, fare, name, bookingId) {
    setCopied(false)
    setUpiSheet({ upi, fare, name, bookingId, qr: null })
    try {
      const url = buildUpiUrl(upi, name, fare)
      const qr = await QRCode.toDataURL(url, { width: 440, margin: 1 })
      setUpiSheet(s => (s && s.upi === upi ? { ...s, qr } : s))
    } catch (e) {
      // QR is optional — copy + open-app fallbacks still work without it.
    }
  }

  // Rider confirms they've paid → mark the booking and notify the driver.
  // Undo an accidental "I've Paid" — sets the booking back to pending.
  async function unmarkPaid(bookingId) {
    const ok = window.confirm('Mark this fare as NOT paid?\n\nUse this only if you tapped "I\'ve Paid" by mistake.')
    if (!ok) return
    const { data, error } = await supabase
      .from('bookings')
      .update({ payment_status: 'pending' })
      .eq('id', bookingId)
      .eq('rider_id', user.id)
      .select('id')
    if (error || !data || data.length === 0) {
      alert('Could not undo. Please try again.')
      return
    }
    await fetchData()
  }

  async function markPaid(bookingId) {
    if (!bookingId) { setUpiSheet(null); return }
    // Guard against accidental taps — this changes payment status and notifies
    // the driver, so confirm the rider actually paid first.
    const ok = window.confirm(
      "Confirm you've paid the fare to the driver?\n\nOnly tap OK if you have actually completed the UPI payment. The driver will be notified."
    )
    if (!ok) return
    setPayingId(bookingId)
    // .select() is essential: without it Supabase returns no error when RLS
    // blocks the update — it just affects 0 rows and looks like success.
    const { data, error } = await supabase
      .from('bookings')
      .update({ payment_status: 'paid' })
      .eq('id', bookingId)
      .eq('rider_id', user.id)
      .select('id')

    if (error) {
      alert(`Could not save: ${error.message}`)
      setPayingId(null)
      return
    }
    if (!data || data.length === 0) {
      alert("Couldn't update the payment status. Please tell the admin — the app doesn't have permission to save this.")
      setPayingId(null)
      return
    }

    const b = bookings.find(x => x.id === bookingId)
    if (b?.rides?.driver_id) {
      await sendNotification(
        b.rides.driver_id,
        '💰 Payment received',
        `Rider marked ₹${b.ride_fare || b.rides?.fare || ''} as paid for ${b.rides.from_location} → ${b.rides.to_location}`
      )
    }

    setPayingId(null)
    setUpiSheet(null)
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
    const [ridesRes, bookingsRes] = await Promise.all([
      supabase.from('rides').select('*').eq('driver_id', user.id).order('ride_date', { ascending: false }),
      supabase.from('bookings').select('*, rides(driver_id, from_location, to_location, ride_date, ride_time, fare, ride_type, vehicle_model, vehicle_number, profiles(full_name, phone, upi_id))').eq('rider_id', user.id).order('created_at', { ascending: true }),
    ])
    if (!ridesRes.error) setRides(ridesRes.data || [])
    if (!bookingsRes.error) {
      const allBookings = bookingsRes.data || []
      const grouped = {}
      allBookings.filter(b => b.status === 'confirmed' || b.status === 'completed').forEach(b => {
        if (grouped[b.ride_id]) { grouped[b.ride_id].seats_booked += b.seats_booked; grouped[b.ride_id].total_paid += b.total_paid; grouped[b.ride_id].ride_fare += b.ride_fare }
        else { grouped[b.ride_id] = { ...b } }
      })
      const cancelled = allBookings.filter(b => b.status === 'cancelled')
      const finalBookings = [...Object.values(grouped), ...cancelled]
      setBookings(finalBookings)
      fetchUnreadCounts(finalBookings.map(b => b.id))
    }
    setLoading(false)
  }

  async function cancelRide(rideId) {
    if (!confirm('Cancel this ride?\n\nRiders will get ₹2 refund. You will not be refunded.')) return
    try {
      const { data: bookingsData } = await supabase.from('bookings').select('id, rider_id, seats_booked').eq('ride_id', rideId).eq('status', 'confirmed')
      await supabase.from('bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('ride_id', rideId)
      await supabase.from('rides').update({ status: 'cancelled' }).eq('id', rideId)
      for (const b of (bookingsData || [])) {
        await supabase.rpc('refund_cancellation', { p_rider_id: b.rider_id, p_driver_id: user.id, p_amount: 200 })
        await sendNotification(b.rider_id, '❌ Ride Cancelled', 'Your ride was cancelled by the driver. ₹2 refunded to your wallet.')
      }
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

  const activeBookings = bookings.filter(b => b.status === 'confirmed')
  const completedBookings = bookings.filter(b => b.status === 'completed')
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled')

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
          <button style={tabStyle(tab === 'booked')} onClick={() => setTab('booked')}>🎫 I Booked ({activeBookings.length + completedBookings.length})</button>
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
            const currentRides = rides.filter(r => !isPastRide(r))
            const pastRides = rides.filter(isPastRide)
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
          activeBookings.length === 0 && completedBookings.length === 0 && cancelledBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40 }}>🎫</div>
              <div style={{ color: '#aaa', marginTop: 8 }}>No bookings yet</div>
              <div style={{ color: '#bbb', fontSize: 12, marginTop: 4 }}>Find a ride on the home screen</div>
            </div>
          ) : (
            <>
              {activeBookings.map(b => (
                <div key={b.id} style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 10, borderLeft: `4px solid ${b.payment_status === 'paid' ? '#16a34a' : '#f59e0b'}` }}>
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
                  {/* Pay driver — shows a clear paid state once confirmed */}
                  {b.rides?.profiles?.upi_id && b.status !== 'cancelled' && b.status !== 'completed' && (
                    b.payment_status === 'paid' ? (
                      <button onClick={() => unmarkPaid(b.id)} style={{ width: '100%', marginTop: 8, padding: '11px', background: '#dcfce7', color: '#15803d', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        ✓ Paid ₹{b.ride_fare || b.rides?.fare} to {b.rides?.profiles?.full_name?.split(' ')[0]} <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>· tap to undo</span>
                      </button>
                    ) : (
                      <button onClick={() => openUpiSheet(b.rides.profiles.upi_id, b.ride_fare || b.rides?.fare || 150, b.rides.profiles.full_name?.split(' ')[0] || 'Driver', b.id)} style={{ width: '100%', marginTop: 8, padding: '11px', background: '#111', color: '#facc15', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        💳 Pay ₹{b.ride_fare || b.rides?.fare} to {b.rides?.profiles?.full_name?.split(' ')[0]}
                      </button>
                    )
                  )}
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

              {/* Completed bookings - collapsed past rides */}
              {completedBookings.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer', padding: '8px 0', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>▶</span> {completedBookings.length} completed ride{completedBookings.length > 1 ? 's' : ''} (tap to show)
                  </summary>
                  {completedBookings.map(b => (
                    <div key={b.id} style={{ background: '#f8fafc', borderRadius: 12, padding: 12, marginTop: 8, border: '1px solid #e2e8f0', opacity: 0.8 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#64748b' }}>{b.rides?.from_location} → {b.rides?.to_location}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                        {b.rides?.ride_date && new Date(b.rides.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ✅ Completed
                      </div>
                      <button onClick={() => navigate(`/live/${b.id}?rate=true`)} style={{ marginTop: 8, padding: '7px 14px', background: '#ede9fe', color: '#7c3aed', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⭐ Rate</button>
                    </div>
                  ))}
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
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1 }}>PAY DRIVER</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: '6px 0' }}>₹{upiSheet.fare}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>to {upiSheet.name}</div>
            </div>

            {/* OPTION 1 — copy & paste. Works in every app, every time. */}
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
              OPTION 1 — Copy &amp; pay in your UPI app
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>UPI ID</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis' }}>{upiSheet.upi}</div>
              </div>
              <button onClick={() => {
                navigator.clipboard?.writeText(upiSheet.upi)
                setCopied(true); setTimeout(() => setCopied(false), 1500)
              }} style={{ flexShrink: 0, marginLeft: 12, padding: '9px 18px', background: copied ? '#16a34a' : '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
              Open PhonePe / GPay / Paytm → <b>Pay to UPI ID</b> → paste → enter <b>₹{upiSheet.fare}</b>
            </div>

            {/* OPTION 2 — save QR, upload in the UPI app. Amount comes pre-filled,
                and this works in PhonePe where the direct link does not. */}
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
              OPTION 2 — Save QR, then upload it in your UPI app
            </div>
            {upiSheet.qr ? (
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <img src={upiSheet.qr} alt="UPI QR code" style={{ width: 170, height: 170, border: '1px solid #e2e8f0', borderRadius: 14, padding: 6, background: '#fff' }} />
                <a href={upiSheet.qr} download={`carpoolkaro-pay-${upiSheet.fare}.png`}
                  style={{ display: 'block', marginTop: 8, padding: 11, background: '#0f172a', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                  ⬇ Save QR image
                </a>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#aaa', fontSize: 12, padding: 20 }}>Generating QR…</div>
            )}
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 16, lineHeight: 1.5 }}>
              In your UPI app tap <b>Scan</b> → gallery icon → pick the saved QR.
              The ₹{upiSheet.fare} amount fills in automatically.
            </div>

            {/* OPTION 3 — direct link. Works in some apps (CRED, GPay); PhonePe
                rejects links opened from a browser, which we can't control. */}
            <div style={{ fontSize: 11, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
              OPTION 3 — Try opening a UPI app directly
            </div>
            <a href={buildUpiUrl(upiSheet.upi, upiSheet.name, upiSheet.fare)}
              style={{ display: 'block', textAlign: 'center', padding: 12, background: '#f1f5f9', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none', marginBottom: 6 }}>
              Open UPI app
            </a>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 18, lineHeight: 1.5 }}>
              Your phone picks which app opens — PhonePe often blocks payments
              opened this way. If it fails, use Option 1 or 2.
            </div>

            <button
              onClick={() => markPaid(upiSheet.bookingId)}
              disabled={payingId === upiSheet.bookingId}
              style={{ width: '100%', padding: 14, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', marginBottom: 12, opacity: payingId === upiSheet.bookingId ? 0.6 : 1 }}>
              {payingId === upiSheet.bookingId ? 'Saving…' : "✓ I've Paid"}
            </button>

            <button onClick={() => setUpiSheet(null)} style={{ width: '100%', padding: 12, background: 'none', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Close</button>
          </div>
        </div>
      )}
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  )
}
