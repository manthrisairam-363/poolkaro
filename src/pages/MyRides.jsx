import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'

// Contact buttons — call + WhatsApp
function ContactButtons({ phone, name }) {
  if (!phone) return null
  const clean = phone.replace(/\D/g, '')
  const waMsg = encodeURIComponent(`Hi ${name}! This is regarding our PoolKaro ride today. 🚗`)
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
          <div style={{ fontWeight: 700, fontSize: 14 }}>{rider?.full_name || 'Rider'}</div>
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
          ['💰 Paid', `₹${booking.total_paid}`],
          ['📥 You receive', `₹${booking.driver_receives}`],
          ['🪑 Seats', booking.seats_booked],
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
function DriverRideCard({ ride, onCancel }) {
  const [expanded, setExpanded] = useState(false)
  const [passengers, setPassengers] = useState([])
  const [loadingPax, setLoadingPax] = useState(false)
  const bookedCount = ride.seats_total - ride.seats_available
  const isToOffice = ride.ride_type === 'to_office'
  const statusColor = { active: '#16a34a', full: '#2563eb', cancelled: '#dc2626', completed: '#888' }

  async function loadPassengers() {
    if (expanded) { setExpanded(false); return }
    setExpanded(true)
    if (passengers.length > 0) return // already loaded
    setLoadingPax(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, profiles(full_name, phone, upi_id)')
      .eq('ride_id', ride.id)
      .eq('status', 'confirmed')
    setPassengers(data || [])
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
            {new Date(ride.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {ride.ride_time?.slice(0, 5)}
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
          🪑 {ride.seats_available} left of {ride.seats_total}
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
            (₹{ride.fare - 2} per seat after ₹2 PoolKaro fee)
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
        {ride.status === 'active' && (
          <button onClick={() => onCancel(ride.id)} style={{
            padding: '8px 14px', background: '#fef2f2', color: '#dc2626',
            border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, fontWeight: 600,
          }}>
            Cancel
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
  const [tab, setTab] = useState('posted')
  const [rides, setRides] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [ridesRes, bookingsRes] = await Promise.all([
      supabase.from('rides').select('*').eq('driver_id', user.id).order('ride_date', { ascending: false }),
      supabase.from('bookings')
        .select('*, rides(from_location, to_location, ride_date, ride_time, fare, ride_type, vehicle_model, vehicle_number, profiles(full_name, phone))') 
        .eq('rider_id', user.id)
        .order('created_at', { ascending: false }),
    ])
    if (!ridesRes.error) setRides(ridesRes.data || [])
    if (!bookingsRes.error) setBookings(bookingsRes.data || [])
    setLoading(false)
  }

  async function cancelRide(rideId) {
    if (!confirm('Cancel this ride? All passengers will be notified.')) return
    await supabase.from('rides').update({ status: 'cancelled' }).eq('id', rideId)
    fetchData()
  }

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
            🎫 I Booked ({bookings.length})
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
          ) : rides.map(r => <DriverRideCard key={r.id} ride={r} onCancel={cancelRide} />)

        ) : (
          bookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 40 }}>🎫</div>
              <div style={{ color: '#aaa', marginTop: 8 }}>No bookings yet</div>
              <div style={{ color: '#bbb', fontSize: 12, marginTop: 4 }}>Find a ride on the home screen</div>
            </div>
          ) : bookings.map(b => (
            <div key={b.id} style={{
              background: '#fff', borderRadius: 14, padding: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 10,
              borderLeft: `4px solid ${b.payment_status === 'paid' ? '#16a34a' : '#f59e0b'}`,
            }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {b.rides?.from_location} → {b.rides?.to_location}
              </div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 3 }}>
                {b.rides?.ride_date && new Date(b.rides.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {b.rides?.ride_time?.slice(0, 5)}
              </div>
              {/* Driver contact */}
              {b.rides?.profiles && (
                <div style={{ marginTop: 8, background: '#f8f9fa', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>🚗 Driver</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{b.rides.profiles.full_name}</div>
                  <ContactButtons phone={b.rides.profiles.phone} name={b.rides.profiles.full_name} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
                  Paid ₹{b.total_paid}
                </span>
                <span style={{
                  background: b.payment_status === 'paid' ? '#f0fdf4' : '#fff7ed',
                  color: b.payment_status === 'paid' ? '#16a34a' : '#c2410c',
                  borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600,
                }}>
                  {b.payment_status === 'paid' ? '✅ Confirmed' : '⏳ Pending'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      <BottomNav />
    </div>
  )
}
