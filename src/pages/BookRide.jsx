import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function BookRide() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [ride, setRide] = useState(null)
  const [driver, setDriver] = useState(null)
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [step, setStep] = useState('confirm') // 'confirm' | 'success'
  const [error, setError] = useState('')

  useEffect(() => { fetchRide() }, [id])

  async function fetchRide() {
    const { data, error } = await supabase
      .from('rides')
      .select('*, profiles(full_name, phone, vehicle_model, vehicle_number, upi_id)')
      .eq('id', id)
      .single()
    if (error || !data) { navigate('/'); return }
    setRide(data)
    setDriver(data.profiles)
    setLoading(false)
  }

  async function confirmBooking() {
    setError('')

    // Check user has UPI set up
    if (!profile?.upi_id) {
      setError('Please add your UPI ID in Profile before booking')
      return
    }

    // Check seats available
    if (ride.seats_available < 1) {
      setError('Sorry, no seats available for this ride')
      return
    }

    // Check user is not booking their own ride
    if (ride.driver_id === user.id) {
      setError("You can't book your own ride!")
      return
    }

    setBooking(true)
    const rideFare = ride.fare
    const platformFee = 2
    const totalPaid = rideFare + platformFee
    const driverReceives = rideFare - platformFee

    const { error: bookingError } = await supabase.from('bookings').insert({
      ride_id: ride.id,
      rider_id: user.id,
      seats_booked: 1,
      ride_fare: rideFare,
      platform_fee: platformFee,
      driver_deduction: platformFee,
      total_paid: totalPaid,
      driver_receives: driverReceives,
      payment_status: 'paid', // In production this comes from Razorpay
      status: 'confirmed',
    })

    if (bookingError) {
      setError('Booking failed: ' + bookingError.message)
      setBooking(false)
      return
    }

    // Reduce seats
    await supabase.from('rides')
      .update({
        seats_available: ride.seats_available - 1,
        status: ride.seats_available - 1 <= 0 ? 'full' : 'active'
      })
      .eq('id', ride.id)

    setBooking(false)
    setStep('success')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#aaa' }}>
        <div style={{ fontSize: 40 }}>🚗</div>
        <div style={{ marginTop: 8 }}>Loading ride...</div>
      </div>
    </div>
  )

  // ── SUCCESS SCREEN ──
  if (step === 'success') {
    const waMsg = encodeURIComponent(
      `Hi ${driver?.full_name}! 👋\n\nI just booked a seat on your PoolKaro ride.\n\n` +
      `📍 ${ride.from_location} → ${ride.to_location}\n` +
      `🕐 ${ride.ride_time?.slice(0,5)} on ${new Date(ride.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}\n\n` +
      `My name: ${profile?.full_name}\nLooking forward to the ride! 🚗`
    )

    return (
      <div style={{ minHeight: '100vh', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>🎉</div>
        <div style={{ color: '#facc15', fontWeight: 800, fontSize: 26, marginBottom: 8, textAlign: 'center' }}>
          Ride Booked!
        </div>
        <div style={{ color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 32 }}>
          Your seat is confirmed with {driver?.full_name}
        </div>

        {/* Booking summary */}
        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360, marginBottom: 20 }}>
          {[
            ['📍 Route', `${ride.from_location} → ${ride.to_location}`],
            ['🕐 Time', `${ride.ride_time?.slice(0,5)} · ${new Date(ride.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`],
            ['🚘 Vehicle', `${driver?.vehicle_model} · ${driver?.vehicle_number}`],
            ['💰 Fare paid', `₹${ride.fare + 2}`],
            ['💳 Driver receives', `₹${ride.fare - 2} via UPI`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222' }}>
              <span style={{ fontSize: 12, color: '#888' }}>{k}</span>
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        {/* WhatsApp driver */}
        <a
          href={`https://wa.me/91${driver?.phone}?text=${waMsg}`}
          target="_blank" rel="noreferrer"
          style={{
            display: 'block', width: '100%', maxWidth: 360,
            background: '#25D366', color: '#fff', border: 'none',
            borderRadius: 12, padding: 14, fontSize: 15,
            fontWeight: 700, textAlign: 'center', marginBottom: 10,
            textDecoration: 'none',
          }}
        >
          💬 WhatsApp {driver?.full_name}
        </a>

        <button
          onClick={() => navigate('/')}
          style={{
            width: '100%', maxWidth: 360, padding: 14,
            background: 'transparent', color: '#888',
            border: '1px solid #333', borderRadius: 12,
            fontSize: 14, fontWeight: 600,
          }}
        >
          ← Back to Rides
        </button>
      </div>
    )
  }

  // ── CONFIRM SCREEN ──
  const isToOffice = ride.ride_type === 'to_office'
  const initials = driver?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>
      {/* Header */}
      <div style={{ background: '#111', padding: '20px 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20 }}>←</button>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>Confirm Booking</div>
      </div>

      <div style={{ padding: 16 }}>
        {/* Driver card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#888', marginBottom: 12 }}>DRIVER</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: '#2563eb',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 16,
            }}>{initials}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{driver?.full_name}</div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                {driver?.vehicle_model} · {driver?.vehicle_number}
              </div>
            </div>
            <span style={{
              marginLeft: 'auto',
              background: isToOffice ? '#dbeafe' : '#fce7f3',
              color: isToOffice ? '#1d4ed8' : '#be185d',
              borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
            }}>
              {isToOffice ? '🏢 To Office' : '🏠 To Home'}
            </span>
          </div>
        </div>

        {/* Ride details */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#888', marginBottom: 12 }}>RIDE DETAILS</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {[
              ['📍 From', ride.from_location],
              ['🏁 To', ride.to_location],
              ['🕐 Time', ride.ride_time?.slice(0,5)],
              ['📅 Date', new Date(ride.ride_date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })],
              ['🪑 Seats left', `${ride.seats_available} of ${ride.seats_total}`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #f5f5f5' }}>
                <span style={{ fontSize: 13, color: '#888' }}>{k}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            {ride.route_description && (
              <div style={{ background: '#f0f4ff', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#444' }}>
                🛣️ {ride.route_description}
              </div>
            )}
          </div>
        </div>

        {/* Payment breakdown */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#888', marginBottom: 12 }}>PAYMENT BREAKDOWN</div>
          {[
            ['Ride fare', `₹${ride.fare}`],
            ['PoolKaro platform fee', '₹2'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, borderBottom: '1px solid #f5f5f5' }}>
              <span style={{ fontSize: 13, color: '#888' }}>{k}</span>
              <span style={{ fontSize: 13 }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Total you pay</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#16a34a' }}>₹{ride.fare + 2}</span>
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 6 }}>
            Driver receives ₹{ride.fare - 2} instantly to their UPI • PoolKaro earns ₹4
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            ⚠️ {error}
          </div>
        )}

        <button
          onClick={confirmBooking}
          disabled={booking}
          style={{
            width: '100%', padding: 15, background: '#111',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 16, fontWeight: 700, marginBottom: 10,
          }}
        >
          {booking ? 'Confirming...' : `✅ Confirm & Pay ₹${ride.fare + 2}`}
        </button>

        <button onClick={() => navigate(-1)} style={{
          width: '100%', padding: 12, background: '#f3f4f6',
          color: '#666', border: 'none', borderRadius: 12, fontSize: 14,
        }}>
          Cancel
        </button>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', marginTop: 12 }}>
          🔒 Payments powered by Razorpay · Instant UPI transfer
        </div>
      </div>
    </div>
  )
}
