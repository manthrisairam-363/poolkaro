import { useState, useEffect } from 'react'
import { formatTime, formatDate } from '../lib/utils'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function BookRide() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [ride, setRide] = useState(null)
  const [owner, setOwner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [step, setStep] = useState('confirm') // confirm | success
  const [error, setError] = useState('')
  const [alreadyBooked, setAlreadyBooked] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)

  useEffect(() => { fetchRide() }, [id])

  async function fetchRide() {
    const { data } = await supabase
      .from('rides')
      .select('*, profiles(id, full_name, phone, vehicle_model, vehicle_number, upi_id, avg_rating, total_ratings)')
      .eq('id', id)
      .maybeSingle()
    if (!data) { navigate('/'); return }
    setRide(data)
    setOwner(data.profiles)

    // Check if already booked
    const { data: existing } = await supabase
      .from('bookings')
      .select('id')
      .eq('ride_id', id)
      .eq('rider_id', user.id)
      .maybeSingle()
    if (existing) setAlreadyBooked(true)

    // Check wallet balance
    const { data: walletData } = await supabase
      .from('wallets').select('balance').eq('user_id', user.id).maybeSingle()
    setWalletBalance(walletData?.balance || 0)
    setLoading(false)
  }

  async function confirmBooking() {
    setError('')
    if (ride.driver_id === user.id) { setError("You can't book your own ride!"); return }
    if (alreadyBooked) { setError("You've already booked this ride!"); return }
    if (!profile?.upi_id) { setError('Please add your UPI ID in Profile before booking'); return }
    if (ride.seats_available < 1) { setError('Sorry, this ride is full'); return }
    if (walletBalance < 200) { setError('Insufficient wallet balance. Add ₹2 minimum to your wallet first.'); return }

    setBooking(true)
    const { error: err } = await supabase.from('bookings').insert({
      ride_id: ride.id,
      rider_id: user.id,
      seats_booked: 1,
      ride_fare: ride.fare,
      platform_fee: 2,
      driver_deduction: 2,
      total_paid: ride.fare + 2,
      driver_receives: ride.fare - 2,
      payment_status: 'paid',
      status: 'confirmed',
    })
    if (err) { setError(err.message); setBooking(false); return }

    await supabase.from('rides').update({
      seats_available: ride.seats_available - 1,
      status: ride.seats_available - 1 <= 0 ? 'full' : 'active',
    }).eq('id', ride.id)

    setBooking(false)
    setStep('success')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>
      <div style={{ textAlign: 'center', color: '#aaa' }}>
        <div style={{ fontSize: 40 }}>🚗</div>
        <div style={{ marginTop: 8, fontSize: 14 }}>Loading ride...</div>
      </div>
    </div>
  )

  if (step === 'success') {
    const waMsg = encodeURIComponent(
      `Hi ${owner?.full_name}! 👋\n\nI just booked a seat on your PoolKaro ride.\n` +
      `📍 ${ride.from_location} → ${ride.to_location}\n` +
      `🕐 ${formatTime(ride.ride_time)}\n\nMy name: ${profile?.full_name}\n📱 ${profile?.phone}\n\nSee you there! 🚗`
    )
    return (
      <div style={{ minHeight: '100vh', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ fontSize: 72, marginBottom: 12 }}>🎉</div>
        <div style={{ color: '#facc15', fontWeight: 800, fontSize: 26, textAlign: 'center' }}>Booking Confirmed!</div>
        <div style={{ color: '#888', fontSize: 14, textAlign: 'center', marginTop: 8, marginBottom: 28 }}>
          Your seat is confirmed with {owner?.full_name}
        </div>
        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360, marginBottom: 20 }}>
          {[
            ['📍 Route', `${ride.from_location} → ${ride.to_location}`],
            ['🕐 Time', formatTime(ride.ride_time)],
            ['🚘 Vehicle', `${owner?.vehicle_model} · ${owner?.vehicle_number}`],
            ['💰 You paid', `₹${ride.fare + 2}`],
            ['📥 Car Owner gets', `₹${ride.fare - 2}`],
          ].map(([k,v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222' }}>
              <span style={{ fontSize: 12, color: '#888' }}>{k}</span>
              <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <a href={`https://wa.me/91${owner?.phone?.replace(/\D/g,'')}?text=${waMsg}`}
          target="_blank" rel="noreferrer"
          style={{ display: 'block', width: '100%', maxWidth: 360, background: '#25D366', color: '#fff', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, textAlign: 'center', marginBottom: 10, textDecoration: 'none' }}>
          💬 WhatsApp {owner?.full_name}
        </a>
        <button onClick={() => navigate('/')} style={{ width: '100%', maxWidth: 360, padding: 13, background: 'transparent', color: '#888', border: '1px solid #333', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          ← Back to Rides
        </button>
      </div>
    )
  }

  const isToOffice = ride.ride_type === 'to_office'
  const initials = owner?.full_name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>
      <div style={{ background: '#111', padding: '20px 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>Confirm Booking</div>
      </div>

      <div style={{ padding: 16 }}>
        {alreadyBooked && (
          <div style={{ background: '#fef9c3', color: '#854d0e', padding: '12px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
            ⚠️ You've already booked this ride
          </div>
        )}

        {/* Owner card */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 12, letterSpacing: 1 }}>CAR OWNER</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
              {initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{owner?.full_name}</div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{owner?.vehicle_model} · {owner?.vehicle_number}</div>
              {owner?.avg_rating > 0 && (
                <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 2 }}>
                  {'★'.repeat(Math.round(owner.avg_rating))} {Number(owner.avg_rating).toFixed(1)} ({owner.total_ratings} ratings)
                </div>
              )}
            </div>
            <span style={{
              background: isToOffice ? '#dbeafe' : '#fce7f3',
              color: isToOffice ? '#1d4ed8' : '#be185d',
              borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
            }}>{isToOffice ? '🏢 Office' : '🏠 Home'}</span>
          </div>
        </div>

        {/* Ride details */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 12, letterSpacing: 1 }}>RIDE DETAILS</div>
          {[
            ['📍 From', ride.from_location],
            ['🏁 To', ride.to_location],
            ['🕐 Time', formatTime(ride.ride_time)],
            ['📅 Date', new Date(ride.ride_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })],
            ['🪑 Seats available', `${ride.seats_available} of ${ride.seats_total}`],
          ].map(([k,v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid #f5f5f5', marginBottom: 10 }}>
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

        {/* Payment */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 12, letterSpacing: 1 }}>PAYMENT</div>
          {[
            ['Ride fare', `₹${ride.fare}`],
            ['PoolKaro platform fee', '₹2'],
          ].map(([k,v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8, marginBottom: 8, borderBottom: '1px solid #f5f5f5' }}>
              <span style={{ fontSize: 13, color: '#888' }}>{k}</span>
              <span style={{ fontSize: 13 }}>{v}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: '#16a34a' }}>₹{ride.fare + 2}</span>
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>
            Car Owner receives ₹{ride.fare - 2} • PoolKaro fee ₹4 total
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            ⚠️ {error}
            {error.includes('wallet') && (
              <button onClick={() => navigate('/wallet')} style={{ display: 'block', marginTop: 8, padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                💰 Go to Wallet →
              </button>
            )}
          </div>
        )}

        <button onClick={confirmBooking} disabled={booking || alreadyBooked}
          style={{ width: '100%', padding: 15, background: alreadyBooked ? '#e5e7eb' : '#111', color: alreadyBooked ? '#999' : '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: alreadyBooked ? 'not-allowed' : 'pointer', marginBottom: 10 }}>
          {booking ? 'Confirming...' : alreadyBooked ? 'Already Booked' : `✅ Confirm & Pay ₹${ride.fare + 2}`}
        </button>
        <button onClick={() => navigate(-1)} style={{ width: '100%', padding: 12, background: '#f3f4f6', color: '#666', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer' }}>
          Cancel
        </button>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', marginTop: 12 }}>🔒 Secured by Razorpay · Instant UPI</div>
      </div>
    </div>
  )
}
