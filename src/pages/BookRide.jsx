import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { formatTime, formatDate } from '../lib/utils'
import { getCompanyFromEmail } from '../lib/companyDomains'

export default function BookRide() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [ride, setRide] = useState(null)
  const [owner, setOwner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [step, setStep] = useState('confirm')
  const [error, setError] = useState('')
  const [alreadyBooked, setAlreadyBooked] = useState(false)
  const [walletBalance, setWalletBalance] = useState(0)
  const [bookingData, setBookingData] = useState(null)
  const [seatsToBook, setSeatsToBook] = useState(1)

  useEffect(() => { fetchRide() }, [id])

  async function fetchRide() {
    const { data } = await supabase
      .from('rides')
      .select('*, profiles(id, full_name, phone, vehicle_model, vehicle_number, upi_id, avg_rating, total_ratings, email, work_email, work_email_verified, is_verified)')
      .eq('id', id).maybeSingle()
    if (!data) { navigate('/'); return }
    setRide(data)
    setOwner(data.profiles)

    // If this rider ALREADY has a confirmed booking on this ride, never show the
    // Confirm screen again — go straight to payment. Prevents accidental double booking.
    const { data: existing } = await supabase
      .from('bookings').select('id, seats_booked, ride_fare')
      .eq('ride_id', id)
      .eq('rider_id', user.id)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing) {
      setAlreadyBooked(true)
      setBookingData(existing)
      setStep('pay')
    }

    const { data: wallet } = await supabase
      .from('wallets').select('balance').eq('user_id', user.id).maybeSingle()
    setWalletBalance(wallet?.balance || 0)
    setLoading(false)
  }

  async function confirmBooking() {
    setError('')
    if (ride.driver_id === user.id) { setError("You can't book your own ride!"); return }
    setBooking(true)
    const { data, error: err } = await supabase.rpc('book_ride_atomic', {
      p_ride_id: ride.id,
      p_rider_id: user.id,
      p_seats: seatsToBook,
    })
    setBooking(false)
    if (err || !data?.success) {
      setError(data?.message || err?.message || 'Booking failed. Please try again.')
      return
    }
    setBookingData(data.booking)

    // Notify driver of new booking
    const { data: myProf } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: ride.driver_id,
      type: 'booking', title: '🎉 New Booking!',
      message: `${myProf?.full_name || 'Someone'} booked ${seatsToBook} seat${seatsToBook > 1 ? 's' : ''} on your ${ride.from_location} → ${ride.to_location} ride.`,
      is_read: false,
    })
    if (notifErr) console.error('Booking notification failed:', notifErr.message)

    setStep('pay')
  }

  // UPI deep links to open payment apps
  function getUPILink() {
    // Standard upi://pay scheme. Do NOT use URLSearchParams — it turns @ into
    // %40 and spaces into "+", which UPI apps reject. Build manually with
    // encodeURIComponent so @ stays literal and spaces become %20.
    const pa = String(owner?.upi_id || '').trim()
    const pn = encodeURIComponent(String(owner?.full_name || 'Car Owner').trim())
    const am = Number(ride?.fare || 0).toFixed(2)
    const tn = encodeURIComponent(`CarpoolKaro fare ${ride?.from_location || ''} to ${ride?.to_location || ''}`.trim())
    return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${tn}`
  }


  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa' }}>
      <div style={{ textAlign: 'center', color: '#aaa' }}>
        <div style={{ fontSize: 40 }}>🚗</div>
        <div style={{ marginTop: 8 }}>Loading ride...</div>
      </div>
    </div>
  )

  // ── PAY FARE SCREEN ──
  if (step === 'pay') {

    return (
      <div style={{ minHeight: '100vh', background: '#111', color: '#fff' }}>
        <div style={{ background: '#16a34a', padding: '20px 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28 }}>✅</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Seat Confirmed!</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>Now pay the ride fare to car owner</div>
          </div>
        </div>

        <div style={{ padding: 16 }}>

          {/* Booking summary */}
          <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#888', fontWeight: 700, marginBottom: 12, letterSpacing: 1 }}>BOOKING CONFIRMED</div>
            {[
              ['📍 Route', `${ride.from_location} → ${ride.to_location}`],
              ['🕐 Time', `${formatTime(ride.ride_time)} · ${formatDate(ride.ride_date)}`],
              ['🚘 Vehicle', `${owner?.vehicle_model} · ${owner?.vehicle_number}`],
              ['✅ Platform fee', '₹2 deducted from your wallet'],
            ].map(([k,v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #222' }}>
                <span style={{ fontSize: 12, color: '#888' }}>{k}</span>
                <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Pay fare section */}
          <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 16, marginBottom: 12, border: '1px solid #facc15' }}>
            <div style={{ fontSize: 13, color: '#facc15', fontWeight: 700, marginBottom: 4 }}>
              💰 Now Pay Ride Fare to Car Owner
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 16, lineHeight: 1.6 }}>
              Pay directly via any UPI app. This goes straight to the car owner.
            </div>

            {/* Amount highlight */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 40, fontWeight: 800, color: '#facc15' }}>₹{bookingData?.ride_fare || ride.fare}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                to {owner?.full_name}
                {bookingData?.seats_booked > 1 && ` · ${bookingData.seats_booked} seats`}
              </div>
            </div>

            {/* UPI ID */}
            {!owner?.upi_id ? (
              <div style={{ background: '#2a1500', border: '1px solid #78350f', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: '#f97316', fontWeight: 700, marginBottom: 4 }}>
                  ⚠️ Car owner hasn't set UPI ID
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  Use the chat button below to coordinate payment with them directly.
                </div>
              </div>
            ) : null}

            {/* Payment app buttons - only show if UPI is set */}
            {owner?.upi_id && (
            <>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 10, textAlign: 'center' }}>
              Open payment app directly:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {[
                { app: 'gpay', icon: '🟢', label: 'Google Pay' },
                { app: 'phonepe', icon: '🟣', label: 'PhonePe' },
                { app: 'paytm', icon: '🔵', label: 'Paytm' },
                { app: 'upi', icon: '⚡', label: 'Any UPI' },
              ].map(({ app, icon, label }) => (
                <a key={app} href={getUPILink(app)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, padding: '12px', background: '#222', borderRadius: 10,
                    color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 600,
                    border: '1px solid #333',
                  }}>
                  {icon} {label}
                </a>
              ))}
            </div>

            </>
            )}
            {/* Chat with car owner */}
            {bookingData?.id && (
              <button onClick={() => navigate(`/chat/${bookingData.id}`)}
                style={{
                  display: 'block', width: '100%', background: '#facc15',
                  color: '#111', borderRadius: 12, padding: 13,
                  fontSize: 14, fontWeight: 700, textAlign: 'center',
                  border: 'none', cursor: 'pointer',
                }}>
                💬 Chat with {owner?.full_name?.split(' ')[0]}
              </button>
            )}
          </div>

          {/* Disclaimer */}
          <div style={{ background: '#1a1a1a', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#666', lineHeight: 1.7 }}>
              ℹ️ CarpoolKaro only collects ₹2 platform fee. The ride fare ₹{ride.fare} goes directly to the car owner. CarpoolKaro is not responsible for fare transactions between users.
            </div>
          </div>

          <button onClick={() => navigate('/my-rides')} style={{
            width: '100%', padding: 14, background: '#222',
            color: '#888', border: '1px solid #333', borderRadius: 12,
            fontSize: 14, cursor: 'pointer', fontWeight: 600,
          }}>
            ← View My Rides
          </button>
        </div>
      </div>
    )
  }

  // ── CONFIRM SCREEN ──
  const isToOffice = ride.ride_type === 'to_office'
  const initials = owner?.full_name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?'
  const emailForBadge = (owner?.work_email_verified && owner?.work_email) ? owner.work_email : owner?.email
  const company = getCompanyFromEmail(emailForBadge)

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa' }}>
      <div style={{ background: '#111', padding: '20px 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>Confirm Booking</div>
      </div>

      <div style={{ padding: 16 }}>

        {alreadyBooked && (
          <div style={{ background: '#f0f4ff', color: '#2563eb', padding: '12px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14, fontWeight: 600 }}>
            ℹ️ You already have a seat booked. You can book one more for a colleague.
          </div>
        )}

        {/* Car Owner */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 12, letterSpacing: 1 }}>CAR OWNER</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
              {initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {owner?.full_name}
                {owner?.is_verified && <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 9, padding: '2px 5px', borderRadius: 6, fontWeight: 700 }}>✓</span>}
                {company && <span style={{ background: company.bg, color: company.color, fontSize: 9, padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>{company.name}</span>}
              </div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>{owner?.vehicle_model} · {owner?.vehicle_number}</div>
              {owner?.avg_rating > 0 && (
                <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 2 }}>
                  {'★'.repeat(Math.round(owner.avg_rating))} {Number(owner.avg_rating).toFixed(1)} ({owner.total_ratings} ratings)
                </div>
              )}
            </div>
            <span style={{ background: isToOffice ? '#dbeafe' : '#fce7f3', color: isToOffice ? '#1d4ed8' : '#be185d', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>
              {isToOffice ? '🏢 Office' : '🏠 Home'}
            </span>
          </div>
        </div>

        {/* Ride Details */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 12, letterSpacing: 1 }}>RIDE DETAILS</div>
          {[
            ['📍 From', ride.from_location],
            ['🏁 To', ride.to_location],
            ['🕐 Time', formatTime(ride.ride_time)],
            ['📅 Date', new Date(ride.ride_date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })],
            ['💺 Seats', `${ride.seats_available} of ${ride.seats_total} available`],
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

        {/* Payment Breakdown - CLEAR */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 12, letterSpacing: 1 }}>PAYMENT DETAILS</div>

          {/* Seats selector */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              How many seats?
              <span style={{ color: '#888', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>
                (max {ride.seats_available} available)
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4].filter(n => n <= ride.seats_available).map(n => (
                <button key={n} onClick={() => setSeatsToBook(n)} style={{
                  width: 48, height: 48, borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: seatsToBook === n ? '#111' : '#f3f4f6',
                  color: seatsToBook === n ? '#fff' : '#333',
                  fontWeight: 700, fontSize: 16,
                }}>{n}</button>
              ))}
            </div>
            {seatsToBook > 1 && (
              <div style={{ marginTop: 6, fontSize: 12, color: '#888' }}>
                Booking for yourself + {seatsToBook - 1} colleague{seatsToBook > 2 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Platform fee */}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid #f5f5f5', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>CarpoolKaro Platform Fee</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>₹2 × {seatsToBook} seat{seatsToBook > 1 ? 's' : ''} — from wallet</div>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#16a34a' }}>₹{2 * seatsToBook}</span>
          </div>

          {/* Ride fare */}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid #f5f5f5', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Ride Fare</div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>₹{ride.fare} × {seatsToBook} seat{seatsToBook > 1 ? 's' : ''} — pay to car owner</div>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#2563eb' }}>₹{ride.fare * seatsToBook}</span>
          </div>

          {/* Wallet balance */}
          <div style={{ background: walletBalance >= 200 * seatsToBook ? '#f0fdf4' : '#fef2f2', borderRadius: 8, padding: '10px 12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#555' }}>💰 Your wallet balance</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: walletBalance >= 200 * seatsToBook ? '#16a34a' : '#dc2626' }}>
              ₹{walletBalance / 100} {walletBalance < 200 * seatsToBook ? '⚠️ Low!' : '✅'}
            </span>
          </div>

          <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8f9fa', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: '#888', lineHeight: 1.7 }}>
              ℹ️ After confirming, you'll see the car owner's UPI ID to pay ₹{ride.fare * seatsToBook} directly.
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            ⚠️ {error}
            {error.includes('wallet') && (
              <button onClick={() => navigate('/wallet')} style={{ display: 'block', marginTop: 8, padding: '6px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                💰 Add Money to Wallet →
              </button>
            )}
          </div>
        )}

        <button onClick={confirmBooking} disabled={booking} style={{
          width: '100%', padding: 15,
          background: '#111', color: '#fff',
          border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700,
          cursor: booking ? 'not-allowed' : 'pointer', marginBottom: 10,
        }}>
          {booking ? 'Confirming...' : `✅ Confirm ${seatsToBook} Seat${seatsToBook > 1 ? 's' : ''} (₹${2 * seatsToBook} from wallet)`}
        </button>

        <button onClick={() => navigate(-1)} style={{ width: '100%', padding: 12, background: '#f3f4f6', color: '#666', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer' }}>
          Cancel
        </button>

        <div style={{ textAlign: 'center', fontSize: 11, color: '#bbb', marginTop: 12 }}>
          🔒 ₹2 platform fee deducted from your CarpoolKaro wallet
        </div>
      </div>
    </div>
  )
}
