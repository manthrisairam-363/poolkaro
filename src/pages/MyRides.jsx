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

function DriverRideCard({ ride, onCancel, onEdit, onCancelAll, unreadCounts = {} }) {
  const [expanded, setExpanded] = useState(false)
  const [passengers, setPassengers] = useState([])
  const [loadingPax, setLoadingPax] = useState(false)
  const [actualBookedCount, setActualBookedCount] = useState(null)
  const isToOffice = ride.ride_type === 'to_office'
  const statusColor = { active: '#16a34a', full: '#2563eb', cancelled: '#dc2626', completed: '#888' }

  useEffect(() => {
    async function loadCount() {
      const { count } = await supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('ride_id', ride.id).eq('status', 'confirmed')
      setActualBookedCount(count || 0)
    }
    loadCount()
  }, [ride.id])

  const bookedCount = actualBookedCount ?? Math.max(0, ride.seats_total - ride.seats_available)

  async function loadPassengers() {
    if (expanded) { setExpanded(false); return }
    setExpanded(true)
    setLoadingPax(true)
    const { data } = await supabase.from('bookings').select('*, profiles(full_name, phone, upi_id)').eq('ride_id', ride.id).eq('status', 'confirmed')
    const grouped = {}
    ;(data || []).forEach(b => {
      if (grouped[b.rider_id]) { grouped[b.rider_id].seats_booked += b.seats_booked; grouped[b.rider_id].ride_fare += b.ride_fare; grouped[b.rider_id].driver_receives += b.driver_receives }
      else { grouped[b.rider_id] = { ...b } }
    })
    setPassengers(Object.values(grouped))
    setLoadingPax(false)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12, borderLeft: `4px solid ${statusColor[ride.status] || '#ccc'}` }}>
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
      {bookedCount > 0 && (
        <div style={{ marginTop: 10, background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>💰 You earn: ₹{(ride.fare - 2) * bookedCount} from {bookedCount} passenger{bookedCount > 1 ? 's' : ''}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>(₹{ride.fare - 2} per seat after ₹2 CarpoolKaro fee)</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {bookedCount > 0 && (
          <button onClick={loadPassengers} style={{ flex: 1, padding: '8px', background: expanded ? '#111' : '#f0f0ff', color: expanded ? '#fff' : '#7c3aed', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600 }}>
            {expanded ? '▲ Hide Passengers' : `👥 View ${bookedCount} Passenger${bookedCount > 1 ? 's' : ''}`}
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

// UPI App Logo SVGs
const UPI_APPS = [
  {
    name: 'PhonePe',
    url: (upi, name, fare) => `phonepe://pay?pa=${upi}&pn=${name}&am=${fare}&cu=INR&tn=CarpoolKaro+ride+fare`,
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
    url: (upi, name, fare) => `gpay://upi/pay?pa=${upi}&pn=${name}&am=${fare}&cu=INR`,
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
    url: (upi, name, fare) => `paytmmp://pay?pa=${upi}&pn=${name}&am=${fare}&cu=INR`,
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
    url: (upi, name, fare) => `upi://pay?pa=${upi}&pn=${name}&am=${fare}&cu=INR&tn=CarpoolKaro+ride+fare`,
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
    url: (upi, name, fare) => `amzn://pay?pa=${upi}&pn=${name}&am=${fare}&cu=INR`,
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
    url: (upi, name, fare) => `whatsapp://send?text=Please+send+₹${fare}+to+UPI+ID:+${upi}`,
    logo: (
      <svg viewBox="0 0 48 48" width="40" height="40">
        <rect width="48" height="48" rx="12" fill="#25D366"/>
        <path d="M24 10C16.27 10 10 16.27 10 24c0 2.61.71 5.05 1.95 7.14L10 38l7.14-1.87C19.1 37.32 21.48 38 24 38c7.73 0 14-6.27 14-14S31.73 10 24 10zm7.21 19.85c-.32.89-1.85 1.7-2.56 1.75-.69.05-1.34.33-4.5-.94-3.79-1.5-6.21-5.37-6.4-5.62-.19-.25-1.55-2.06-1.55-3.93s.97-2.79 1.33-3.17c.36-.38.78-.48 1.03-.48h.74c.24 0 .56-.09.88.67.32.76 1.07 2.6 1.16 2.79.09.19.15.41.03.66-.12.25-.18.41-.36.62-.18.22-.37.48-.53.65-.18.18-.36.37-.15.72.21.35.92 1.5 1.97 2.43 1.35 1.2 2.5 1.57 2.84 1.75.34.18.56.15.77-.09.21-.24.88-1.03 1.12-1.39.24-.35.49-.29.82-.18.33.12 2.09.99 2.45 1.17.36.18.59.27.68.42.09.16.09.88-.22 1.77z" fill="white"/>
      </svg>
    )
  },
  {
    name: 'Cred',
    url: (upi, name, fare) => `credpay://pay?pa=${upi}&pn=${name}&am=${fare}&cu=INR`,
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
    url: (upi, name, fare) => `upi://pay?pa=${upi}&pn=${name}&am=${fare}&cu=INR&tn=CarpoolKaro+ride+fare`,
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
  const [tab, setTab] = useState('posted')
  const [upiSheet, setUpiSheet] = useState(null)
  const [rides, setRides] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [unreadCounts, setUnreadCounts] = useState({})

  useEffect(() => { fetchData() }, [])

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
      supabase.from('bookings').select('*, rides(from_location, to_location, ride_date, ride_time, fare, ride_type, vehicle_model, vehicle_number, profiles(full_name, phone, upi_id))').eq('rider_id', user.id).order('created_at', { ascending: true }),
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
      <div style={{ background: '#111', padding: '20px 16px 0' }}>
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
          ) : (
            <>
              {/* Active rides — full colour */}
              {rides.filter(r => ['active','full'].includes(r.status)).map(r => (
                <DriverRideCard key={r.id} ride={r} onCancel={cancelRide} onEdit={id => navigate(`/edit-ride/${id}`)} onCancelAll={cancelAllRecurring} unreadCounts={unreadCounts} />
              ))}

              {/* Cancelled/expired rides — collapsed */}
              {rides.filter(r => !['active','full'].includes(r.status)).length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ fontSize: 12, color: '#aaa', cursor: 'pointer', padding: '8px 0', userSelect: 'none', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>▶</span> {rides.filter(r => !['active','full'].includes(r.status)).length} cancelled/expired ride{rides.filter(r => !['active','full'].includes(r.status)).length > 1 ? 's' : ''} (tap to show)
                  </summary>
                  {rides.filter(r => !['active','full'].includes(r.status)).map(r => (
                    <div key={r.id} style={{ background: '#fafafa', borderRadius: 12, padding: 12, marginTop: 8, border: '1px solid #f0f0f0', opacity: 0.7 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#888' }}>{r.from_location} → {r.to_location}</div>
                      <div style={{ color: '#bbb', fontSize: 12, marginTop: 2 }}>
                        {new Date(r.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {r.ride_time?.slice(0,5)} ·{' '}
                        {r.status === 'cancelled' ? '❌ Cancelled' : r.status === 'completed' ? '✅ Completed' : '⏰ Expired'}
                      </div>
                    </div>
                  ))}
                </details>
              )}
            </>
          )
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
                  {/* Pay driver — opens UPI picker */}
                  {b.rides?.profiles?.upi_id && b.status !== 'cancelled' && b.status !== 'completed' && (
                    <button onClick={() => setUpiSheet({ upi: b.rides.profiles.upi_id, fare: b.ride_fare || b.rides?.fare || 150, name: b.rides.profiles.full_name?.split(' ')[0] || 'Driver' })} style={{ width: '100%', marginTop: 8, padding: '11px', background: '#111', color: '#facc15', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      💳 Pay ₹{b.ride_fare || b.rides?.fare} to {b.rides?.profiles?.full_name?.split(' ')[0]}
                    </button>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => navigate(`/live/${b.id}?rate=true`)} style={{ flex: 1, padding: 9, background: '#ede9fe', color: '#7c3aed', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>⭐ Rate</button>
                    {b.status !== 'cancelled' && b.status !== 'completed' && (
                      <button onClick={() => cancelBooking(b.id, b.ride_id, b.seats_booked)} style={{ flex: 1, padding: 9, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🚫 Cancel</button>
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

      {/* UPI Picker Bottom Sheet */}
      {upiSheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }}>
          <div onClick={() => setUpiSheet(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px 20px 40px', animation: 'slideUp 0.3s ease' }}>
            <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 100, margin: '0 auto 20px' }} />
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1 }}>PAY DRIVER</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', margin: '6px 0' }}>₹{upiSheet.fare}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>to {upiSheet.name}</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, marginBottom: 14, textAlign: 'center' }}>SELECT PAYMENT APP</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
              {UPI_APPS.map(app => (
                <button key={app.name} onClick={() => { window.open(app.url(upiSheet.upi, encodeURIComponent(upiSheet.name), upiSheet.fare), '_blank'); setUpiSheet(null) }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 14, padding: '12px 4px', cursor: 'pointer' }}>
                  {app.logo}
                  <span style={{ fontSize: 9, fontWeight: 700, color: '#334155', textAlign: 'center', lineHeight: 1.2 }}>{app.name}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setUpiSheet(null)} style={{ width: '100%', padding: 12, background: 'none', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 13, color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          </div>
        </div>
      )}
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
    </div>
  )
}
