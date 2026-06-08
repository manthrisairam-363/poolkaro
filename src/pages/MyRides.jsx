import { useState, useEffect } from 'react'
import { formatTime, formatDate } from '../lib/utils'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
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
function PassengerCard({ booking, unreadCount, onRate }) {
  const rider = booking.profiles
  const navigate = useNavigate()
  const { user } = useAuth()
  const initials = rider?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const [rating, setRating] = useState(0)
  const [rated, setRated] = useState(booking.driver_rated || false)
  const [submitting, setSubmitting] = useState(false)

  async function submitRating(stars) {
    setSubmitting(true)
    await supabase.from('ratings').insert({
      booking_id: booking.id,
      rated_by: user.id,
      rated_user: booking.rider_id,
      stars,
      role: 'driver',
    })
    // Update rider's avg_rating
    const { data: allRatings } = await supabase
      .from('ratings').select('stars').eq('rated_user', booking.rider_id)
    if (allRatings?.length) {
      const avg = allRatings.reduce((s, r) => s + r.stars, 0) / allRatings.length
      await supabase.from('profiles').update({ avg_rating: Math.round(avg * 10) / 10, total_ratings: allRatings.length }).eq('id', booking.rider_id)
    }
    setRated(true)
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

      <ContactButtons phone={rider?.phone} name={rider?.full_name} bookingId={booking.id} navigate={navigate} />
      
      {unreadCount > 0 && (
        <button onClick={() => navigate(`/chat/${booking.id}`)} style={{ width: '100%', marginTop: 10, padding: '10px', background: '#fefce8', border: '2px solid #facc15', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontWeight: 700, fontSize: 13, color: '#854d0e' }}>
          💬 {unreadCount} new message{unreadCount > 1 ? 's' : ''} from rider
        </button>
      )}

      {/* Driver rates passenger */}
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
                    onMouseEnter={() => setRating(s)} onMouseLeave={() => setRating(0)}>
                    ⭐
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Driver's posted ride card with passenger list
function DriverRideCard({ ride, onCancel, onEdit, onCancelAll, unreadCounts = {} }) {
  const [expanded, setExpanded] = useState(false)
  const [passengers, setPassengers] = useState([])
  const [loadingPax, setLoadingPax] = useState(false)
  const [actualBookedCount, setActualBookedCount] = useState(null)
  const isToOffice = ride.ride_type === 'to_office'
  const statusColor = { active: '#16a34a', full: '#2563eb', cancelled: '#dc2626', completed: '#888' }

  // Load actual confirmed booking count on mount
  useEffect(() => {
    async function loadCount() {
      const { count } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('ride_id', ride.id)
        .eq('status', 'confirmed')
      setActualBookedCount(count || 0)
    }
    loadCount()
  }, [ride.id])

  // Use actual DB count, not seat math
  const bookedCount = actualBookedCount ?? Math.max(0, ride.seats_total - ride.seats_available)

  async function loadPassengers() {
    if (expanded) { setExpanded(false); return }
    setExpanded(true)
    // Always reload to get fresh data
    setLoadingPax(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, profiles(full_name, phone, upi_id)')
      .eq('ride_id', ride.id)
      .eq('status', 'confirmed')
    // Group by rider_id — combine multiple bookings from same person
    const grouped = {}
    ;(data || []).forEach(b => {
      if (grouped[b.rider_id]) {
        grouped[b.rider_id].seats_booked += b.seats_booked
        grouped[b.rider_id].ride_fare += b.ride_fare
        grouped[b.rider_id].driver_receives += b.driver_receives
      } else {
        grouped[b.rider_id] = { ...b }
      }
    })
    setPassengers(Object.values(grouped))
    setLoadingPax(false)
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: 14,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12,
      borderLeft: `4px solid ${statusColor[ride.status] || '#ccc'}`,
    }}>
      {/* Ride header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            {ride.from_location} → {ride.to_location}
          </div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 3 }}>
            {new Date(ride.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {formatTime(ride.ride_time)}
          </div>
          {ride.route_description && (
            <div style={{ color: '#aaa', fontSize: 11, marginTop: 2 }}>🛣️ {ride.route_description}</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <span style={{
            background: isToOffice ? '#dbeafe' : '#fce7f3',
            color: isToOffice ? '#1d4ed8' : '#be185d',
            borderRadius: 20, padding: '2px 8px', fontSize: 10, fontWeight: 600,
          }}>{isToOffice ? '🏢 Office' : '🏠 Home'}</span>
          <span style={{
            background: '#f8f9fa', borderRadius: 20, padding: '2px 8px',
            fontSize: 10, fontWeight: 600, color: statusColor[ride.status],
          }}>● {ride.status}</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
          ₹{ride.fare}/seat
        </span>
        <span style={{ background: '#fff7ed', color: '#c2410c', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
          💺 {ride.seats_available} left of {ride.seats_total}
        </span>
        {bookedCount > 0 && (
          <span style={{ background: '#ede9fe', color: '#7c3aed', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
            👥 {bookedCount} passenger{bookedCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Earnings summary if booked */}
      {bookedCount > 0 && (
        <div style={{ marginTop: 10, background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
            💰 You earn: ₹{(ride.fare - 2) * bookedCount} from {bookedCount} passenger{bookedCount > 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            (₹{ride.fare - 2} per seat after ₹2 CarpoolKaro fee)
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {bookedCount > 0 && (
          <button onClick={loadPassengers} style={{
            flex: 1, padding: '8px', background: expanded ? '#111' : '#f0f0ff',
            color: expanded ? '#fff' : '#7c3aed', border: 'none',
            borderRadius: 8, fontSize: 12, fontWeight: 600,
          }}>
            {expanded ? '▲ Hide Passengers' : `👥 View ${bookedCount} Passenger${bookedCount > 1 ? 's' : ''}`}
          </button>
        )}
        {(ride.status === 'active' || ride.status === 'full') && (
          <button onClick={() => onEdit(ride.id)} style={{
            padding: '8px 14px', background: '#f0f4ff', color: '#2563eb',
            border: '1px solid #bfdbfe', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            ✏️ Edit
          </button>
        )}
        {ride.is_recurring && ride.status === 'active' && (
          <button onClick={() => onCancelAll(ride.id)} style={{
            padding: '8px 10px', background: '#fff7ed', color: '#c2410c',
            border: '1px solid #fed7aa', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>
            🔁 Cancel Series
          </button>
        )}
        {(ride.status === 'active' || ride.status === 'full') && (
          <button onClick={() => onCancel(ride.id)} style={{
            padding: '8px 14px', background: '#fef2f2', color: '#dc2626',
            border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            🚫 Cancel
          </button>
        )}
        {/* Complete Ride button — show for past rides or full rides */}
        {(ride.status === 'full' || (ride.status === 'active' && bookedCount > 0)) && (() => {
          const istNow = new Date(Date.now() + 5.5 * 3600000)
          const rideDateTime = new Date(`${ride.ride_date}T${ride.ride_time || '00:00'}`)
          const isPast = rideDateTime < new Date(istNow - 30 * 60000) // 30 min after ride time
          return isPast ? (
            <button onClick={async () => {
              if (!confirm('Mark this ride as completed? This will notify passengers to rate you.')) return
              const { data } = await supabase.rpc('complete_ride', { p_ride_id: ride.id, p_driver_id: ride.driver_id })
              if (data?.success) {
                alert('✅ Ride marked as completed!')
                window.location.reload()
              }
            }} style={{
              padding: '8px 14px', background: '#052e16', color: '#4ade80',
              border: '1px solid #166534', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}>
              ✅ Complete
            </button>
          ) : null
        })()}
      </div>

      {/* Passenger list */}
      {expanded && (
        <div>
          {loadingPax ? (
            <div style={{ textAlign: 'center', padding: 16, color: '#aaa', fontSize: 13 }}>Loading passengers...</div>
          ) : passengers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 12, color: '#aaa', fontSize: 13 }}>No confirmed bookings yet</div>
          ) : (
            passengers.map(b => <PassengerCard key={b.id} booking={b} unreadCount={unreadCounts[b.id] || 0} />)
          )}
        </div>
      )}
    </div>
  )
}

export default function MyRides() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [upiSheet, setUpiSheet] = useState(null)
  const [tab, setTab] = useState('posted')
  const [rides, setRides] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadCounts, setUnreadCounts] = useState({}) // bookingId → count

  useEffect(() => { fetchData() }, [])

  // Fetch unread message counts for all bookings
  async function fetchUnreadCounts(bookingIds) {
    if (!bookingIds.length) return
    const { data } = await supabase
      .from('messages')
      .select('booking_id')
      .in('booking_id', bookingIds)
      .eq('read', false)
      .neq('sender_id', user.id)
    const counts = {}
    ;(data || []).forEach(m => {
      counts[m.booking_id] = (counts[m.booking_id] || 0) + 1
    })
    setUnreadCounts(counts)
  }

  async function sendNotification(userId, title, message) {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId, title, message, type: 'booking', is_read: false
    })
    if (error) console.error('Notification failed:', error.message, '| user:', userId)
  }

  async function fetchData() {
    setLoading(true)
    const [ridesRes, bookingsRes] = await Promise.all([
      supabase.from('rides').select('*').eq('driver_id', user.id).order('ride_date', { ascending: false }),
      supabase.from('bookings')
        .select('*, rides(from_location, to_location, ride_date, ride_time, fare, ride_type, vehicle_model, vehicle_number, profiles(full_name, phone, upi_id))') 
        .eq('rider_id', user.id)
        .order('created_at', { ascending: false }),
    ])
    if (!ridesRes.error) setRides(ridesRes.data || [])
    if (!bookingsRes.error) {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const recentBookings = (bookingsRes.data || []).filter(b => {
        const rideDate = b.rides?.ride_date
        return !rideDate || rideDate >= cutoff
      })
      // Group confirmed + completed bookings by ride_id
      const grouped = {}
      allBookings.filter(b => b.status === 'confirmed' || b.status === 'completed').forEach(b => {
        if (grouped[b.ride_id]) {
          grouped[b.ride_id].seats_booked += b.seats_booked
          grouped[b.ride_id].total_paid += b.total_paid
          grouped[b.ride_id].ride_fare += b.ride_fare
        } else {
          grouped[b.ride_id] = { ...b }
        }
      })
      // Add cancelled bookings separately (not grouped)
      const cancelled = allBookings.filter(b => b.status === 'cancelled')
      const finalBookings = [...Object.values(grouped), ...cancelled]
      setBookings(finalBookings)
      // Fetch unread message counts
      fetchUnreadCounts(finalBookings.map(b => b.id))
    }
    setLoading(false)
  }

  async function cancelRide(rideId) {
    if (!confirm('Cancel this ride?\n\nAll co-riders will be refunded ₹2 to their wallets.')) return

    try {
      // Get all confirmed bookings for this ride
      const { data: bookings } = await supabase
        .from('bookings').select('id, rider_id, seats_booked')
        .eq('ride_id', rideId).eq('status', 'confirmed')

      // Cancel all bookings
      await supabase.from('bookings')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('ride_id', rideId)

      // Cancel the ride
      await supabase.from('rides').update({ status: 'cancelled' }).eq('id', rideId)

      // Refund both parties for each booking via SECURITY DEFINER RPC
      for (const b of (bookings || [])) {
        const { data: refundResult, error: refundErr } = await supabase.rpc('refund_cancellation', {
          p_rider_id: b.rider_id,
          p_driver_id: user.id,
          p_amount: 200,
        })
        if (refundErr) console.error('Refund error for rider', b.rider_id, ':', refundErr.message)
        if (refundResult?.success === false) console.error('Refund failed:', refundResult.error)
      }

      // Notify all cancelled riders
      for (const b of (bookings || [])) {
        await sendNotification(
          b.rider_id,
          '❌ Ride Cancelled',
          `Your ride has been cancelled by the car owner. ₹2 refunded to your wallet.`
        )
      }
      await fetchData()
    } catch (err) {
      console.error('Cancel ride error:', err)
      alert('Something went wrong. Please try again.')
    }
  }

  async function cancelAllRecurring(rideId) {
    if (!confirm('Cancel ALL future rides in this recurring series?\n\nOnly rides with no bookings will be cancelled.')) return
    const { data: ride } = await supabase.from('rides').select('ride_date, from_location, to_location, ride_time').eq('id', rideId).maybeSingle()
    if (!ride) return
    const { data: recurringRides } = await supabase
      .from('rides').select('id')
      .eq('driver_id', user.id).eq('is_recurring', true)
      .eq('from_location', ride.from_location).eq('to_location', ride.to_location)
      .eq('ride_time', ride.ride_time).gte('ride_date', ride.ride_date).eq('status', 'active')
    if (recurringRides?.length > 0) {
      for (const r of recurringRides) {
        const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('ride_id', r.id).eq('status', 'confirmed')
        if (count === 0) await supabase.from('rides').update({ status: 'cancelled' }).eq('id', r.id)
      }
    }
    await fetchData()
  }

  async function cancelBooking(bookingId, rideId, seatsBooked) {
    if (!confirm('Cancel your booking?\n\nYour ₹2 platform fee will be refunded to your wallet.')) return
    try {
      const { data, error } = await supabase.rpc('cancel_booking_atomic', {
        p_booking_id: bookingId,
        p_rider_id: user.id,
      })
      if (error) throw error
      if (!data?.success) throw new Error(data?.error || 'Cancel failed')

      await sendNotification(
        data.driver_id,
        '❌ Booking Cancelled',
        `A co-rider cancelled their booking for ${data.from_location} → ${data.to_location}. ₹2 refunded to your wallet.`
      )
      alert('✅ Booking cancelled. ₹2 refunded to your wallet.')
      await fetchData()
    } catch (err) {
      console.error('Cancel error:', err)
      alert('Something went wrong: ' + err.message)
    }
  }

  const today = new Date().toISOString().split('T')[0]
  const upcomingBookings = bookings.filter(b => b.status === 'confirmed' && b.rides?.ride_date >= today)
  const pastBookings = bookings.filter(b => b.status === 'completed' || (b.status === 'confirmed' && b.rides?.ride_date < today))
  const activeBookings = [...upcomingBookings, ...pastBookings]
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
      {/* Header */}
      <div style={{ background: '#111', padding: '20px 16px 0' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 16 }}>📋 My Rides</div>
        <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
          <button style={tabStyle(tab === 'posted')} onClick={() => setTab('posted')}>
            🚗 I Posted ({rides.length})
          </button>
          <button style={tabStyle(tab === 'booked')} onClick={() => setTab('booked')}>
            🎫 I Booked ({activeBookings.length})
          </button>
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
          ) : rides.map(r => <DriverRideCard key={r.id} ride={r} onCancel={cancelRide} onEdit={id => navigate(`/edit-ride/${id}`)} onCancelAll={cancelAllRecurring} unreadCounts={unreadCounts} />)

        ) : (
          activeBookings.length === 0 && cancelledBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40 }}>🎫</div>
              <div style={{ color: '#aaa', marginTop: 8 }}>No bookings yet</div>
              <div style={{ color: '#bbb', fontSize: 12, marginTop: 4 }}>Find a ride on the home screen</div>
            </div>
          ) : (
            <>
              {/* Anti-fraud policy notice */}
              <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: '#92400e' }}>
                ⚠️ Cancellation policy: Frequent cancellations will restrict your account. Platform fees are non-refundable for repeated cancellations.
              </div>

              {/* Upcoming bookings */}
              {upcomingBookings.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, marginBottom: 8, marginTop: 4 }}>UPCOMING</div>
              )}
              {/* Active bookings */}
              {activeBookings.map((b, idx) => (
                <>
                  {/* Past rides label - show before first past booking */}
                  {idx === upcomingBookings.length && pastBookings.length > 0 && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, marginBottom: 8, marginTop: 12 }}>PAST RIDES</div>
                  )}
            <div key={b.id} style={{
              background: '#fff', borderRadius: 14, padding: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 10,
              borderLeft: `4px solid ${b.payment_status === 'paid' ? '#16a34a' : '#f59e0b'}`,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {b.rides?.from_location} → {b.rides?.to_location}
              </div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 3 }}>
                {b.rides?.ride_date && new Date(b.rides.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {formatTime(b.rides?.ride_time)}
              </div>
              {/* Driver contact */}
              {b.rides?.profiles && (
                <div style={{ marginTop: 8, background: '#f8f9fa', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>🚗 Car Owner</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{b.rides.profiles.full_name}</div>
                  <ContactButtons phone={b.rides.profiles.phone} name={b.rides.profiles.full_name} bookingId={b.id} navigate={navigate} />
                </div>
              )}
              {/* Unread message badge + chat CTA */}
              {unreadCounts[b.id] > 0 && (
                <button onClick={() => navigate(`/chat/${b.id}`)} style={{
                  width: '100%', marginTop: 10, padding: '10px', background: '#fefce8',
                  border: '2px solid #facc15', borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontWeight: 700, fontSize: 13, color: '#854d0e',
                }}>
                  💬 {unreadCounts[b.id]} new message{unreadCounts[b.id] > 1 ? 's' : ''} from car owner
                </button>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                  ✅ {b.seats_booked} seat{b.seats_booked > 1 ? 's' : ''} confirmed
                </span>
                <span style={{ background: '#f8f9fa', color: '#555', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>
                  💰 ₹2 platform fee paid
                </span>
              </div>
              {/* Pay driver button - only for active/confirmed bookings */}
              {b.rides?.profiles?.upi_id && b.status === 'confirmed' && (
                <button onClick={() => {
                  const upi = b.rides.profiles.upi_id
                  const fare = b.ride_fare || b.rides?.fare || 150
                  const name = encodeURIComponent(b.rides.profiles.full_name || 'Car Owner')
                  const note = encodeURIComponent('CarpoolKaro ride fare')
                  setUpiSheet({ upi, fare, name: b.rides.profiles.full_name?.split(' ')[0], note })
                }} style={{
                  width: '100%', marginTop: 8, padding: '11px',
                  background: '#111', color: '#facc15',
                  border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  💳 Pay ₹{b.ride_fare || b.rides?.fare} to {b.rides?.profiles?.full_name?.split(' ')[0]}
                </button>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button onClick={() => navigate(`/live/${b.id}?rate=true`)} style={{
                  flex: 1, padding: 9, background: '#ede9fe', color: '#7c3aed',
                  border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>⭐ Rate</button>
                {b.status !== 'cancelled' && b.status !== 'completed' && (
                  <button onClick={() => cancelBooking(b.id, b.ride_id, b.seats_booked)} style={{
                    flex: 1, padding: 9, background: '#fef2f2', color: '#dc2626',
                    border: '1px solid #fecaca', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>🚫 Cancel</button>
                )}
              </div>
            </div>
                </>
          ))}

              {/* Cancelled bookings - collapsed section */}
              {cancelledBookings.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{
                    fontSize: 12, color: '#aaa', cursor: 'pointer',
                    padding: '8px 0', userSelect: 'none', listStyle: 'none',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span>▶</span> {cancelledBookings.length} cancelled booking{cancelledBookings.length > 1 ? 's' : ''} (tap to show)
                  </summary>
                  {cancelledBookings.map(b => (
                    <div key={b.id} style={{
                      background: '#fafafa', borderRadius: 12, padding: 12,
                      marginTop: 8, border: '1px solid #f0f0f0', opacity: 0.7,
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#888' }}>
                        {b.rides?.from_location} → {b.rides?.to_location}
                      </div>
                      <div style={{ color: '#bbb', fontSize: 12, marginTop: 2 }}>
                        {b.rides?.ride_date && new Date(b.rides.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · ❌ Cancelled
                      </div>
                    </div>
                  ))}
                </details>
              )}
            </>
          )
        )}
      </div>
      <BottomNav />

      {/* UPI Picker Bottom Sheet */}
      {upiSheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <div onClick={() => setUpiSheet(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px 20px 40px', animation: 'slideUp 0.3s ease' }}>
            <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 100, margin: '0 auto 20px' }} />
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', letterSpacing: 1 }}>PAY DRIVER</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: '4px 0' }}>₹{upiSheet.fare}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>to {upiSheet.name} · {upiSheet.upi}</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, marginBottom: 12, textAlign: 'center' }}>SELECT PAYMENT APP</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
              {[
                {
                  name: 'PhonePe', color: '#5f259f', bg: '#f3e8ff',
                  logo: <svg viewBox="0 0 40 40" width="32" height="32"><rect width="40" height="40" rx="10" fill="#5f259f"/><text x="20" y="26" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial">Pe</text></svg>,
                  url: `phonepe://pay?pa=${upiSheet.upi}&pn=${encodeURIComponent(upiSheet.name)}&am=${upiSheet.fare}&cu=INR&tn=CarpoolKaro+ride+fare`
                },
                {
                  name: 'Google Pay', color: '#1a73e8', bg: '#e8f0fe',
                  logo: <svg viewBox="0 0 40 40" width="32" height="32"><rect width="40" height="40" rx="10" fill="white" stroke="#e2e8f0" strokeWidth="1"/><text x="9" y="27" fill="#4285F4" fontSize="16" fontWeight="900" fontFamily="Arial">G</text><text x="20" y="27" fill="#EA4335" fontSize="16" fontWeight="900" fontFamily="Arial">P</text><text x="30" y="27" fill="#FBBC05" fontSize="16" fontWeight="900" fontFamily="Arial">a</text></svg>,
                  url: `gpay://upi/pay?pa=${upiSheet.upi}&pn=${encodeURIComponent(upiSheet.name)}&am=${upiSheet.fare}&cu=INR`
                },
                {
                  name: 'Paytm', color: '#00BAF2', bg: '#e0f7fd',
                  logo: <svg viewBox="0 0 40 40" width="32" height="32"><rect width="40" height="40" rx="10" fill="#00BAF2"/><text x="20" y="26" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="Arial">PAYTM</text></svg>,
                  url: `paytmmp://pay?pa=${upiSheet.upi}&pn=${encodeURIComponent(upiSheet.name)}&am=${upiSheet.fare}&cu=INR`
                },
                {
                  name: 'BHIM', color: '#FF6B00', bg: '#fff3e0',
                  logo: <svg viewBox="0 0 40 40" width="32" height="32"><rect width="40" height="40" rx="10" fill="#FF6B00"/><text x="20" y="27" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="Arial">BHIM</text></svg>,
                  url: `upi://pay?pa=${upiSheet.upi}&pn=${encodeURIComponent(upiSheet.name)}&am=${upiSheet.fare}&cu=INR&tn=CarpoolKaro+ride+fare`
                },
                {
                  name: 'Amazon Pay', color: '#FF9900', bg: '#fff8e1',
                  logo: <svg viewBox="0 0 40 40" width="32" height="32"><rect width="40" height="40" rx="10" fill="#1A1919"/><text x="20" y="22" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="Arial">amazon</text><text x="20" y="31" textAnchor="middle" fill="#FF9900" fontSize="7" fontWeight="bold" fontFamily="Arial">pay</text></svg>,
                  url: `amzn://pay?pa=${upiSheet.upi}&pn=${encodeURIComponent(upiSheet.name)}&am=${upiSheet.fare}&cu=INR`
                },
                {
                  name: 'WhatsApp', color: '#25D366', bg: '#e8f8f0',
                  logo: <svg viewBox="0 0 40 40" width="32" height="32"><rect width="40" height="40" rx="10" fill="#25D366"/><path d="M20 8C13.37 8 8 13.37 8 20c0 2.09.55 4.04 1.51 5.73L8 32l6.44-1.69A11.93 11.93 0 0020 32c6.63 0 12-5.37 12-12S26.63 8 20 8zm5.89 16.05c-.25.7-1.47 1.34-2.01 1.38-.54.04-1.05.26-3.54-.74-2.99-1.19-4.9-4.24-5.05-4.44-.15-.2-1.22-1.63-1.22-3.11s.77-2.2 1.05-2.5c.28-.3.61-.38.81-.38h.58c.19 0 .44-.07.69.53.25.6.84 2.05.91 2.2.07.15.12.32.02.52-.09.2-.14.32-.28.49-.14.17-.3.38-.42.51-.14.14-.28.29-.12.57.16.28.72 1.19 1.55 1.92 1.06.94 1.96 1.24 2.24 1.38.28.14.44.12.6-.07.16-.19.7-.82.89-1.1.19-.28.38-.23.64-.14.26.09 1.65.78 1.93.92.28.14.47.21.54.33.07.12.07.69-.18 1.4z" fill="white"/></svg>,
                  url: `whatsapp://send?pa=${upiSheet.upi}&am=${upiSheet.fare}`
                },
                {
                  name: 'Cred', color: '#1C1C1C', bg: '#f1f5f9',
                  logo: <svg viewBox="0 0 40 40" width="32" height="32"><rect width="40" height="40" rx="10" fill="#1C1C1C"/><text x="20" y="27" textAnchor="middle" fill="#FFD700" fontSize="11" fontWeight="bold" fontFamily="Arial">CRED</text></svg>,
                  url: `credpay://pay?pa=${upiSheet.upi}&pn=${encodeURIComponent(upiSheet.name)}&am=${upiSheet.fare}&cu=INR`
                },
                {
                  name: 'Any UPI', color: '#0f172a', bg: '#f8fafc',
                  logo: <svg viewBox="0 0 40 40" width="32" height="32"><rect width="40" height="40" rx="10" fill="#0f172a"/><text x="20" y="22" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold" fontFamily="Arial">ANY</text><text x="20" y="32" textAnchor="middle" fill="#facc15" fontSize="8" fontWeight="bold" fontFamily="Arial">UPI</text></svg>,
                  url: `upi://pay?pa=${upiSheet.upi}&pn=${encodeURIComponent(upiSheet.name)}&am=${upiSheet.fare}&cu=INR&tn=CarpoolKaro+ride+fare`
                },
              ].map(app => (
                <button key={app.name} onClick={() => { window.open(app.url, '_blank'); setUpiSheet(null) }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: app.bg, border: `1.5px solid ${app.color}22`, borderRadius: 14, padding: '11px 4px', cursor: 'pointer' }}>
                  {app.logo}
                  <span style={{ fontSize: 9, fontWeight: 700, color: app.color, textAlign: 'center', lineHeight: 1.2 }}>{app.name}</span>
                </button>
              ))}
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.5 }}>DRIVER'S UPI ID</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{upiSheet.upi}</div>
              </div>
              <button onClick={() => { navigator.clipboard?.writeText(upiSheet.upi); alert('UPI ID copied!') }} style={{ background: '#0f172a', color: '#facc15', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Copy</button>
            </div>
            <button onClick={() => setUpiSheet(null)} style={{ width: '100%', padding: 12, background: 'none', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          </div>
        </div>
      )}
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  )
}
