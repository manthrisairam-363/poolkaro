import { useState, useEffect, useRef } from 'react'
import { formatTime, formatDate } from '../lib/utils'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { RatingModal } from '../components/RatingModal'

export default function LiveRide() {
  const { bookingId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [booking, setBooking] = useState(null)
  const [ride, setRide] = useState(null)
  const [otherProfile, setOtherProfile] = useState(null)
  const [myLocation, setMyLocation] = useState(null)
  const [otherLocation, setOtherLocation] = useState(null)
  const [tracking, setTracking] = useState(false)
  const [showRating, setShowRating] = useState(searchParams.get('rate') === 'true')
  const [rideEnded, setRideEnded] = useState(false)
  const [status, setStatus] = useState('Loading...')
  const watchRef = useRef(null)
  const rideIdRef = useRef(null)
  const otherUserIdRef = useRef(null)

  useEffect(() => {
    fetchData()
    return () => stopTracking()
  }, [bookingId])

  async function fetchData() {
    setStatus('Loading ride...')
    const { data: bk, error } = await supabase
      .from('bookings')
      .select('*, rides(*)')
      .eq('id', bookingId)
      .maybeSingle()   // won't throw if not found

    if (error || !bk) {
      setStatus('Ride not found')
      setTimeout(() => navigate('/my-rides'), 2000)
      return
    }

    setBooking(bk)
    setRide(bk.rides)
    rideIdRef.current = bk.rides.id

    const isOwner = bk.rides.driver_id === user.id
    const otherId = isOwner ? bk.rider_id : bk.rides.driver_id
    otherUserIdRef.current = otherId

    // Fetch other person's profile
    const { data: op } = await supabase
      .from('profiles').select('*').eq('id', otherId).maybeSingle()
    setOtherProfile(op)

    setStatus('ready')

    // Fetch their current location immediately
    await fetchOtherLocation(otherId, bk.rides.id)

    // Subscribe to realtime location updates
    setupRealtimeLocation(otherId, bk.rides.id)
  }

  function setupRealtimeLocation(otherId, rideId) {
    // Fix 11: Remove only THIS specific channel, not all channels
    const existingChannel = supabase.getChannels().find(c => c.topic.startsWith(`live-${rideId}`))
    if (existingChannel) supabase.removeChannel(existingChannel)

    const channel = supabase
      .channel(`live-${rideId}-${otherId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_locations',
        filter: `ride_id=eq.${rideId}`,
      }, (payload) => {
        // Only update if it's the other person's location
        if (payload.new && payload.new.user_id === otherId) {
          setOtherLocation(payload.new)
        }
      })
      .subscribe((status) => {
        console.log('Realtime status:', status)
      })

    return channel
  }

  async function fetchOtherLocation(otherId, rideId) {
    const { data, error } = await supabase
      .from('live_locations')
      .select('*')
      .eq('user_id', otherId)
      .eq('ride_id', rideId)

    if (error) { console.error('Location fetch error:', error); return }
    if (data && data.length > 0) setOtherLocation(data[0])
  }

  function startTracking() {
    if (!navigator.geolocation) {
      alert('GPS not available on this device')
      return
    }
    setTracking(true)

    // Fix 10: Auto-stop after 3 hours to save battery
    const autoStop = setTimeout(() => {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
      setTracking(false)
      alert('Location sharing auto-stopped after 3 hours to save battery.')
    }, 3 * 60 * 60 * 1000)
    watchRef.autoStop = autoStop

    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }
        setMyLocation(loc)

        const { error } = await supabase.from('live_locations').upsert({
          user_id: user.id,
          ride_id: rideIdRef.current,
          latitude: loc.latitude,
          longitude: loc.longitude,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,ride_id' })

        if (error) console.error('Location save error:', error)
      },
      (err) => {
        console.error('GPS error:', err)
        setTracking(false)
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
  }

  function stopTracking() {
    if (watchRef.current) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
    if (watchRef.autoStop) clearTimeout(watchRef.autoStop)
    setTracking(false)
  }

  async function endRide() {
    stopTracking()
    await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId)
    await supabase.from('live_locations').delete().eq('ride_id', rideIdRef.current)
    setRideEnded(true)
    setShowRating(true)
  }

  function openInMaps(lat, lng) {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank')
  }

  // ── Loading ──
  if (status !== 'ready') return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#888' }}>
        <div style={{ fontSize: 40 }}>🚗</div>
        <div style={{ marginTop: 8 }}>{status}</div>
      </div>
    </div>
  )

  const isOwner = ride?.driver_id === user?.id
  const otherName = otherProfile?.full_name || (isOwner ? 'Co-rider' : 'Car Owner')
  const otherInitials = otherName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const waMsg = encodeURIComponent(`Hi ${otherName}! Sharing live location for our PoolKaro ride 🚗`)
  const phone = otherProfile?.phone?.replace(/\D/g, '')

  return (
    <div style={{ minHeight: '100vh', background: '#111', color: '#fff' }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/my-rides')}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>📍 Live Ride</div>
          <div style={{ color: '#888', fontSize: 12 }}>
            {ride?.from_location} → {ride?.to_location}
          </div>
        </div>
        {tracking && (
          <div style={{ marginLeft: 'auto', background: '#16a34a', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>
            ● LIVE
          </div>
        )}
      </div>

      <div style={{ padding: '0 16px 100px' }}>

        {/* Other person card */}
        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 10, fontWeight: 600 }}>
            {isOwner ? '🙋 CO-RIDER' : '🚗 CAR OWNER'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: '#7c3aed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 16, flexShrink: 0,
            }}>{otherInitials}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{otherName}</div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                {otherProfile?.vehicle_model && `🚘 ${otherProfile.vehicle_model}`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`tel:+91${phone}`} style={contactBtn('#f0fdf4', '#16a34a')}>📞 Call</a>
            <a href={`https://wa.me/91${phone}?text=${waMsg}`}
              target="_blank" rel="noreferrer" style={contactBtn('#f0fff4', '#25D366')}>
              💬 WhatsApp
            </a>
          </div>
        </div>

        {/* My location sharing */}
        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 10, fontWeight: 600 }}>📍 YOUR LOCATION</div>
          {myLocation ? (
            <div style={{ background: '#052e16', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
              <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>● Sharing live location</div>
              <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
                {myLocation.latitude.toFixed(5)}, {myLocation.longitude.toFixed(5)}
              </div>
            </div>
          ) : (
            <div style={{ color: '#666', fontSize: 13, marginBottom: 10 }}>
              Tap below so {otherName} can find you
            </div>
          )}
          <button onClick={tracking ? stopTracking : startTracking} style={{
            width: '100%', padding: 12, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: tracking ? '#fef2f2' : '#facc15',
            color: tracking ? '#dc2626' : '#111',
            fontWeight: 700, fontSize: 14,
          }}>
            {tracking ? '⏹ Stop Sharing' : '▶ Start Sharing Location'}
          </button>
        </div>

        {/* Other person's location */}
        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 10, fontWeight: 600 }}>
            📍 {otherName?.toUpperCase()}'S LOCATION
          </div>
          {otherLocation ? (
            <>
              <div style={{ background: '#052e16', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
                <div style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>● Location available</div>
                <div style={{ color: '#666', fontSize: 11, marginTop: 2 }}>
                  Last updated: {new Date(otherLocation.updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <button onClick={() => openInMaps(otherLocation.latitude, otherLocation.longitude)}
                style={{ width: '100%', padding: 12, background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                🗺️ Open in Google Maps
              </button>
            </>
          ) : (
            <div style={{ color: '#666', fontSize: 13, padding: '8px 0' }}>
              Waiting for {otherName} to share location...
            </div>
          )}
          {/* Manual refresh */}
          <button
            onClick={() => fetchOtherLocation(otherUserIdRef.current, rideIdRef.current)}
            style={{ width: '100%', padding: 8, background: 'transparent', color: '#555', border: '1px solid #333', borderRadius: 8, fontSize: 12, cursor: 'pointer', marginTop: 8 }}>
            🔄 Refresh Location
          </button>
        </div>

        {/* End ride — car owner only */}
        {isOwner && !rideEnded && (
          <button onClick={endRide} style={{
            width: '100%', padding: 14, background: '#16a34a', color: '#fff',
            border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: 'pointer', marginBottom: 10,
          }}>
            🏁 End Ride
          </button>
        )}

        {/* Rate — both owner AND rider can rate each other */}
        <button onClick={() => setShowRating(true)} style={{
          width: '100%', padding: 14, background: '#7c3aed', color: '#fff',
          border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700,
          cursor: 'pointer',
        }}>
          ⭐ Rate {isOwner ? 'Co-rider' : 'Car Owner'}
        </button>
      </div>

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
  gap: 6, padding: 9, background: bg, color, borderRadius: 10,
  fontSize: 13, fontWeight: 600, textDecoration: 'none',
})
