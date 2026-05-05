import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { RatingModal } from '../components/RatingModal'

export default function LiveRide() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [booking, setBooking] = useState(null)
  const [ride, setRide] = useState(null)
  const [myLocation, setMyLocation] = useState(null)
  const [otherLocation, setOtherLocation] = useState(null)
  const [tracking, setTracking] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [otherProfile, setOtherProfile] = useState(null)
  const [rideEnded, setRideEnded] = useState(false)
  const watchRef = useRef(null)

  const isOwner = ride?.driver_id === user?.id
  const otherUserId = isOwner ? booking?.rider_id : ride?.driver_id

  useEffect(() => {
    fetchData()
    return () => stopTracking()
  }, [bookingId])

  useEffect(() => {
    if (!otherUserId || !ride?.id) return
    // Subscribe to other person's location in realtime
    const channel = supabase.channel(`location-${ride.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'live_locations',
        filter: `user_id=eq.${otherUserId}`,
      }, (payload) => {
        if (payload.new) setOtherLocation(payload.new)
      })
      .subscribe()
    // Also fetch current location
    fetchOtherLocation()
    return () => supabase.removeChannel(channel)
  }, [otherUserId, ride?.id])

  async function fetchData() {
    const { data: bk } = await supabase.from('bookings')
      .select('*, rides(*)')
      .eq('id', bookingId).single()
    if (!bk) { navigate('/my-rides'); return }
    setBooking(bk)
    setRide(bk.rides)
    // Fetch other user's profile
    const otherId = bk.rides.driver_id === user.id ? bk.rider_id : bk.rides.driver_id
    const { data: op } = await supabase.from('profiles').select('*').eq('id', otherId).single()
    setOtherProfile(op)
  }

  async function fetchOtherLocation() {
    const { data } = await supabase.from('live_locations')
      .select('*').eq('user_id', otherUserId).eq('ride_id', ride?.id).single()
    if (data) setOtherLocation(data)
  }

  function startTracking() {
    if (!navigator.geolocation) { alert('GPS not supported on this device'); return }
    setTracking(true)
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
        setMyLocation(loc)
        // Save to Supabase realtime
        await supabase.from('live_locations').upsert({
          user_id: user.id,
          ride_id: ride.id,
          ...loc,
          updated_at: new Date().toISOString(),
        })
      },
      (err) => console.error('GPS error:', err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
  }

  function stopTracking() {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current)
    setTracking(false)
  }

  async function endRide() {
    stopTracking()
    // Mark booking complete
    await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId)
    await supabase.from('rides').update({ status: 'completed' }).eq('id', ride.id)
    // Delete live locations
    await supabase.from('live_locations').delete().eq('ride_id', ride.id)
    setRideEnded(true)
    setShowRating(true)
  }

  function openInMaps(lat, lng, label) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(label)}`
    window.open(url, '_blank')
  }

  if (!booking || !ride) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#aaa' }}>Loading ride...</div>
    </div>
  )

  const otherName = otherProfile?.full_name || 'Co-rider'
  const otherInitials = otherName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const waMsg = encodeURIComponent(`Hi ${otherName}! I'm sharing my live location for our PoolKaro ride. 🚗`)

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/my-rides')} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20 }}>←</button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>🚗 Live Ride</div>
          <div style={{ color: '#888', fontSize: 12 }}>{ride.from_location} → {ride.to_location}</div>
        </div>
      </div>

      <div style={{ padding: '0 16px 100px' }}>

        {/* Status card */}
        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {isOwner ? '👥 Co-rider' : '🚗 Car Owner'}
            </div>
            <span style={{
              background: tracking ? '#f0fdf4' : '#f8f9fa',
              color: tracking ? '#16a34a' : '#888',
              borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600,
            }}>
              {tracking ? '● Live' : '○ Offline'}
            </span>
          </div>

          {/* Other person */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: '#7c3aed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 16, flexShrink: 0,
            }}>{otherInitials}</div>
            <div>
              <div style={{ fontWeight: 700 }}>{otherName}</div>
              <div style={{ color: '#888', fontSize: 12 }}>{otherProfile?.phone}</div>
            </div>
          </div>

          {/* Contact */}
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`tel:+91${otherProfile?.phone}`} style={contactBtn('#f0fdf4', '#16a34a')}>📞 Call</a>
            <a href={`https://wa.me/91${otherProfile?.phone?.replace(/\D/g,'')}?text=${waMsg}`}
              target="_blank" rel="noreferrer" style={contactBtn('#f0fff4', '#25D366')}>
              💬 WhatsApp
            </a>
          </div>
        </div>

        {/* My location */}
        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>📍 Location Sharing</div>
          {myLocation ? (
            <div style={{ background: '#0f2', color: '#000', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 10 }}>
              ✅ Sharing your live location<br />
              <span style={{ fontSize: 11, opacity: 0.7 }}>
                {myLocation.latitude.toFixed(5)}, {myLocation.longitude.toFixed(5)}
              </span>
            </div>
          ) : (
            <div style={{ color: '#888', fontSize: 13, marginBottom: 10 }}>
              Start sharing so {otherName} can find you easily
            </div>
          )}

          <button onClick={tracking ? stopTracking : startTracking} style={{
            width: '100%', padding: 12, borderRadius: 10, border: 'none',
            background: tracking ? '#fef2f2' : '#facc15',
            color: tracking ? '#dc2626' : '#111',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            {tracking ? '⏹ Stop Sharing Location' : '▶ Start Sharing Location'}
          </button>
        </div>

        {/* Other person's location */}
        {otherLocation && (
          <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>
              📍 {otherName}'s Location
            </div>
            <div style={{ color: '#facc15', fontSize: 13, marginBottom: 10 }}>
              ● Live location available
            </div>
            <button
              onClick={() => openInMaps(otherLocation.latitude, otherLocation.longitude, otherName)}
              style={{
                width: '100%', padding: 12, borderRadius: 10, border: 'none',
                background: '#1d4ed8', color: '#fff',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              🗺️ Open in Google Maps
            </button>
          </div>
        )}

        {/* End ride button — only car owner */}
        {isOwner && !rideEnded && (
          <button onClick={endRide} style={{
            width: '100%', padding: 14, background: '#16a34a',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8,
          }}>
            🏁 End Ride & Rate Co-rider
          </button>
        )}

        {!isOwner && !rideEnded && (
          <button onClick={() => setShowRating(true)} style={{
            width: '100%', padding: 14, background: '#7c3aed',
            color: '#fff', border: 'none', borderRadius: 12,
            fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8,
          }}>
            ⭐ Rate this Ride
          </button>
        )}
      </div>

      {/* Rating modal */}
      {showRating && otherProfile && (
        <RatingModal
          booking={booking}
          rideOwner={otherProfile}
          onClose={() => { setShowRating(false); if (rideEnded) navigate('/my-rides') }}
        />
      )}
    </div>
  )
}

const contactBtn = (bg, color) => ({
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 6, padding: 9, background: bg, color,
  borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none',
})
