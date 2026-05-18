import { useState, useEffect } from 'react'
import { formatTime, formatDate } from '../lib/utils'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'

// Contact buttons — call + WhatsApp
function ContactButtons({ phone, name }) {
  if (!phone) return null
  const clean = phone.replace(/\D/g, '')
  const waMsg = encodeURIComponent(`Hi ${name}! This is regarding our CarpoolKaro ride today. 🚗`)
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <a href={`tel:+91${clean}`} style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: '9px', background: '#f0fdf4', color: '#16a34a',
        borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none',
        border: '1px solid #bbf7d0',
      }}>
        📞 Call
      </a>
      <a href={`https://wa.me/91${clean}?text=${waMsg}`} target="_blank" rel="noreferrer"
        style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 6, padding: '9px', background: '#f0fdf9', color: '#25D366',
          borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none',
          border: '1px solid #bbf7d0',
        }}>
        💬 WhatsApp
      </a>
    </div>
  )
}

// Single passenger card inside a ride
function PassengerCard({ booking }) {
  const rider = booking.profiles
  const initials = rider?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div style={{
      background: '#f8f9fa', borderRadius: 12, padding: 12,
      marginTop: 10, border: '1px solid #e5e7eb',
    }}>
      {/* Rider info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: '#7c3aed', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, flexShrink: 0,
        }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{rider?.full_name || 'Co-rider'}</div>
          <div style={{ color: '#888', fontSize: 12 }}>📱 {rider?.phone || 'No phone'}</div>
        </div>
        <span style={{
          background: '#f0fdf4', color: '#16a34a',
          borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700,
        }}>✅ Confirmed</span>
      </div>

      {/* Booking details */}
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

      {/* Contact buttons */}
      <ContactButtons phone={rider?.phone} name={rider?.full_name} />
    </div>
  )
}

// Driver's posted ride card with passenger list
function DriverRideCard({ ride, onCancel, onEdit, onCancelAll }) {
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
        {(ride.status === 'active' || ride.status === 'full') && bookedCount > 0 && (
          <button onClick={async () => {
            const { data } = await supabase.from('bookings').select('id').eq('ride_id', ride.id).eq('status', 'confirmed').limit(1).maybeSingle()
            if (data?.id) navigate(`/live/${data.id}`)
            else alert('No confirmed bookings yet')
          }} style={{
            padding: '8px 12px', background: '#111', color: '#facc15',
            border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>
            📍 Live
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
      </div>

      {/* Passenger list */}
      {expanded && (
        <div>
          {loadingPax ? (
            <div style={{ textAlign: 'center', padding: 16, color: '#aaa', fontSize: 13 }}>Loading passengers...</div>
          ) : passengers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 12, color: '#aaa', fontSize: 13 }}>No confirmed bookings yet</div>
          ) : (
            passengers.map(b => <PassengerCard key={b.id} booking={b} />)
          )}
        </div>
      )}
    </div>
  )
}

export default function MyRides() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('posted')
  const [rides, setRides] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function sendNotification(userId, title, body) {
    const { error } = await supabase.from('notifications').insert({
      user_id: userId, title, body, read: false
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
      const allBookings = bookingsRes.data || []
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
      setBookings([...Object.values(grouped), ...cancelled])
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
      // Step 1: Get booking details first
      const { data: booking } = await supabase
        .from('bookings').select('*').eq('id', bookingId).maybeSingle()
      if (!booking) { alert('Booking not found'); return }

      // Step 2: Cancel the booking
      await supabase.from('bookings')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', bookingId)

      // Step 3: Restore seats in ride
      const { data: ride } = await supabase
        .from('rides').select('seats_available, seats_total, driver_id, status')
        .eq('id', rideId).maybeSingle()

      if (ride) {
        const newSeats = Math.min(ride.seats_total, (ride.seats_available || 0) + (seatsBooked || 1))
        await supabase.from('rides').update({
          seats_available: newSeats,
          status: newSeats > 0 ? 'active' : 'full'
        }).eq('id', rideId)

        // Refund both wallets via SECURITY DEFINER RPC
        const { data: refundResult, error: refundErr } = await supabase.rpc('refund_cancellation', {
          p_rider_id: user.id,
          p_driver_id: ride.driver_id,
          p_amount: 200,
        })
        if (refundErr) {
          console.error('Refund RPC error:', refundErr.message)
          alert('⚠️ Booking cancelled but refund failed. Contact support@carpoolkaro.com')
          await fetchData()
          return
        }
        if (refundResult?.success === false) {
          console.error('Refund failed:', refundResult.error)
          alert('⚠️ Booking cancelled but refund failed: ' + refundResult.error)
          await fetchData()
          return
        }
      }

      // Notify driver
      const { data: rideData } = await supabase
        .from('rides').select('driver_id, from_location, to_location').eq('id', rideId).maybeSingle()
      if (rideData) {
        await sendNotification(
          rideData.driver_id,
          '❌ Booking Cancelled',
          `A co-rider cancelled their booking for ${rideData.from_location} → ${rideData.to_location}. ₹2 refunded to your wallet.`
        )
      }
      alert('✅ Booking cancelled. ₹2 refunded to your wallet.')
      await fetchData()
    } catch (err) {
      console.error('Cancel error:', err)
      alert('Something went wrong. Please try again.')
    }
  }

  const activeBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed')
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
          ) : rides.map(r => <DriverRideCard key={r.id} ride={r} onCancel={cancelRide} onEdit={id => navigate(`/edit-ride/${id}`)} onCancelAll={cancelAllRecurring} />)

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

              {/* Active bookings */}
              {activeBookings.map(b => (
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
                  <ContactButtons phone={b.rides.profiles.phone} name={b.rides.profiles.full_name} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                  ✅ {b.seats_booked} seat{b.seats_booked > 1 ? 's' : ''} confirmed
                </span>
                <span style={{ background: '#f8f9fa', color: '#555', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>
                  💰 ₹2 platform fee paid
                </span>
              </div>
              {/* Pay driver button */}
              {b.rides?.profiles?.upi_id && b.status !== 'cancelled' && b.status !== 'completed' && (
                <button onClick={() => {
                  const upi = b.rides.profiles.upi_id
                  const fare = b.ride_fare || b.rides?.fare || 150
                  const name = b.rides.profiles.full_name || 'Car Owner'
                  window.open(`upi://pay?pa=${upi}&pn=${encodeURIComponent(name)}&am=${fare}&cu=INR&tn=${encodeURIComponent('CarpoolKaro ride fare')}`, '_blank')
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
                {b.status !== 'completed' && b.status !== 'cancelled' && (
                  <button onClick={() => navigate(`/live/${b.id}`)} style={{
                    flex: 1, padding: 9, background: '#0f172a', color: '#facc15',
                    border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}>📍 Live Ride</button>
                )}
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
    </div>
  )
}
