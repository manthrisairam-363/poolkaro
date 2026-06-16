import { useState, useEffect, useRef } from 'react'
import { formatTime } from '../lib/utils'
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
  const [alreadyRated, setAlreadyRated] = useState(false)
  const [rideEnded, setRideEnded] = useState(false)
  const [status, setStatus] = useState('loading')
  const [gpsError, setGpsError] = useState('')

  const watchRef = useRef(null)
  const autoStopRef = useRef(null)
  const bookingIdRef = useRef(null)
  const otherUserIdRef = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => {
    fetchData()
    return () => {
      stopTracking()
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [bookingId])

  async function fetchData() {
    setStatus('loading')
    const { data: bk, error } = await supabase
      .from('bookings')
      .select('*, rides(*)')
      .eq('id', bookingId)
      .maybeSingle()

    if (error || !bk) {
      setStatus('error')
      setTimeout(() => navigate('/my-rides'), 2000)
      return
    }

    setBooking(bk)
    setRide(bk.rides)
    bookingIdRef.current = bk.id

    const isOwner = bk.rides.driver_id === user.id
    const otherId = isOwner ? bk.rider_id : bk.rides.driver_id
    otherUserIdRef.current = otherId

    const { data: op } = await supabase
      .from('profiles').select('*').eq('id', otherId).maybeSingle()
    setOtherProfile(op)

    // Check if already rated
    const { data: existingRating } = await supabase
      .from('ratings')
      .select('id')
      .eq('booking_id', bk.id)
      .eq('rated_by', user.id)
      .maybeSingle()
    if (existingRating) setAlreadyRated(true)

    setStatus('ready')

    // Only track location if ride is NOT completed/cancelled
    if (bk.status === 'confirmed') {
      fetchOtherLocation(otherId, bk.id)
      setupRealtime(otherId, bk.id)
    }
  }

  function setupRealtime(otherId, bId) {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const ch = supabase
      .channel(`live-loc-${bId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_locations',
        filter: `booking_id=eq.${bId}`,
      }, (payload) => {
        if (payload.new?.user_id === otherId) {
          setOtherLocation(payload.new)
        }
      })
      .subscribe()
    channelRef.current = ch
  }

  async function fetchOtherLocation(otherId, bId) {
    const { data, error } = await supabase
      .from('live_locations')
      .select('*')
      .eq('user_id', otherId)
      .eq('booking_id', bId)
      .eq('is_active', true)
      .maybeSingle()
    if (!error && data) setOtherLocation(data)
  }

  function startTracking() {
    if (!navigator.geolocation) {
      setGpsError('GPS is not available on this device.')
      return
    }
    setGpsError('')
    setTracking(true)
    alert('⚠️ Keep the app open while sharing location. Closing the app will stop location sharing.')

    autoStopRef.current = setTimeout(() => {
      stopTracking()
      alert('Location sharing stopped after 3 hours to save battery.')
    }, 3 * 60 * 60 * 1000)

    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }
        setMyLocation(loc)
        setGpsError('')
        await supabase.from('live_locations').upsert({
          user_id: user.id,
          booking_id: bookingIdRef.current,
          lat: loc.latitude,
          lng: loc.longitude,
          is_active: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'booking_id,user_id' })
      },
      (err) => {
        console.error('GPS error:', err)
        setTracking(false)
        if (err.code === 1) setGpsError('Location permission denied. Please allow GPS access in your browser settings.')
        else if (err.code === 2) setGpsError('GPS signal not available. Move to an open area.')
        else setGpsError('GPS timed out. Please try again.')
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
  }

  function stopTracking() {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current)
      watchRef.current = null
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current)
      autoStopRef.current = null
    }
    // Mark inactive in DB
    if (bookingIdRef.current) {
      supabase.from('live_locations').update({ is_active: false })
        .eq('booking_id', bookingIdRef.current).eq('user_id', user.id)
    }
    setTracking(false)
  }

  async function endRide() {
    stopTracking()
    await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId)
    await supabase.from('live_locations').update({ is_active: false }).eq('booking_id', bookingIdRef.current)
    setRideEnded(true)
    if (!alreadyRated) setShowRating(true)
  }

  function openInMaps(lat, lng) {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank')
  }

  function triggerSOS() {
    if (!myLocation) {
      alert('Enable location sharing first, then use SOS.')
      return
    }
    const emergencyPhone = profile?.emergency_contact_phone
    if (!emergencyPhone) {
      alert('No emergency contact set! Please add one in your Profile settings.')
      return
    }
    const mapsLink = `https://www.google.com/maps?q=${myLocation.latitude},${myLocation.longitude}`
    const msg = encodeURIComponent(
      `🆘 SOS from ${profile?.full_name}!\n\nI am in a CarpoolKaro ride and need help.\n\nMy live location:\n${mapsLink}\n\nPlease contact me immediately!`
    )
    window.open(`https://wa.me/91${emergencyPhone.replace(/\D/g,'')}?text=${msg}`, '_blank')
  }

  if (status === 'loading') return (
    <div style={{ minHeight:'100vh', background:'#111', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', color:'#888' }}>
        <div style={{ fontSize:40 }}>🚗</div>
        <div style={{ marginTop:8 }}>Loading ride...</div>
      </div>
    </div>
  )

  if (status === 'error') return (
    <div style={{ minHeight:'100vh', background:'#111', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', color:'#888' }}>
        <div style={{ fontSize:40 }}>❌</div>
        <div style={{ marginTop:8 }}>Ride not found. Redirecting...</div>
      </div>
    </div>
  )

  const isOwner = ride?.driver_id === user?.id
  const otherName = otherProfile?.full_name || (isOwner ? 'Co-rider' : 'Car Owner')
  const otherInitials = otherName.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()
  const isCompleted = booking?.status === 'completed' || rideEnded
  const isCancelled = booking?.status === 'cancelled'

  return (
    <div style={{ minHeight:'100vh', background:'#111', color:'#fff' }}>
      {/* Header */}
      <div style={{ padding:'20px 16px 16px', display:'flex', alignItems:'center', gap:12, borderBottom:'1px solid #1a1a1a' }}>
        <button onClick={() => navigate('/my-rides')}
          style={{ background:'none', border:'none', color:'#fff', fontSize:22, cursor:'pointer' }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:18 }}>📍 {isCompleted ? 'Ride Summary' : 'Live Ride'}</div>
          <div style={{ color:'#555', fontSize:12 }}>
            {ride?.from_location} → {ride?.to_location} · {formatTime(ride?.ride_time)}
          </div>
        </div>
        {tracking && (
          <div style={{ background:'#16a34a', borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:700 }}>
            ● LIVE
          </div>
        )}
      </div>

      <div style={{ padding:'12px 16px 100px' }}>

        {/* Completed banner */}
        {isCompleted && (
          <div style={{ background:'#0a2e1a', border:'1px solid #166534', borderRadius:16, padding:16, marginBottom:10, textAlign:'center' }}>
            <div style={{ fontSize:32 }}>✅</div>
            <div style={{ fontWeight:800, fontSize:16, marginTop:6, color:'#22c55e' }}>Ride Completed</div>
            <div style={{ color:'#888', fontSize:13, marginTop:4 }}>Hope you had a great journey!</div>
          </div>
        )}

        {/* Other person — NO call/whatsapp (privacy: use in-app chat) */}
        <div style={{ background:'#1a1a1a', borderRadius:16, padding:16, marginBottom:10 }}>
          <div style={{ fontSize:10, color:'#555', marginBottom:10, letterSpacing:1, fontWeight:700 }}>
            {isOwner ? '🙋 CO-RIDER' : '🚗 CAR OWNER'}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:'#7c3aed', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:16, flexShrink:0 }}>
              {otherInitials}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:16 }}>{otherName}</div>
              {otherProfile?.vehicle_model && (
                <div style={{ color:'#555', fontSize:12, marginTop:2 }}>🚘 {otherProfile.vehicle_model}</div>
              )}
            </div>
            {!isCompleted && !isCancelled && (
              <button onClick={() => navigate(`/chat/${bookingId}`)}
                style={{ background:'#1d4ed8', color:'#fff', border:'none', borderRadius:10, padding:'10px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                💬 Chat
              </button>
            )}
          </div>
        </div>

        {/* Location sharing — ONLY when ride is active/confirmed */}
        {!isCompleted && !isCancelled && (
          <>
            <div style={{ background:'#1a1a1a', borderRadius:16, padding:16, marginBottom:10 }}>
              <div style={{ fontSize:10, color:'#555', marginBottom:10, letterSpacing:1, fontWeight:700 }}>📍 YOUR LOCATION</div>
              {gpsError && (
                <div style={{ background:'#2a0a0a', border:'1px solid #7f1d1d', borderRadius:10, padding:'10px 12px', marginBottom:10, fontSize:12, color:'#f87171' }}>
                  ⚠️ {gpsError}
                </div>
              )}
              {myLocation && (
                <div style={{ background:'#0a2e1a', borderRadius:10, padding:'10px 14px', marginBottom:10, border:'1px solid #166534' }}>
                  <div style={{ color:'#22c55e', fontSize:13, fontWeight:600 }}>● Sharing live location</div>
                  <div style={{ color:'#555', fontSize:11, marginTop:2, fontFamily:'monospace' }}>
                    {myLocation.latitude.toFixed(5)}, {myLocation.longitude.toFixed(5)}
                  </div>
                </div>
              )}
              <button onClick={tracking ? stopTracking : startTracking} style={{
                width:'100%', padding:13, borderRadius:10, cursor:'pointer', fontWeight:800, fontSize:14,
                background: tracking ? '#2a0a0a' : '#facc15',
                color: tracking ? '#f87171' : '#000',
                border: tracking ? '1px solid #7f1d1d' : 'none',
              }}>
                {tracking ? '⏹ Stop Sharing' : '▶ Start Sharing Location'}
              </button>
            </div>

            <div style={{ background:'#1a1a1a', borderRadius:16, padding:16, marginBottom:10 }}>
              <div style={{ fontSize:10, color:'#555', marginBottom:10, letterSpacing:1, fontWeight:700 }}>
                📍 {otherName.toUpperCase()}'S LOCATION
              </div>
              {otherLocation ? (
                <>
                  <div style={{ background:'#0a2e1a', borderRadius:10, padding:'10px 14px', marginBottom:10, border:'1px solid #166534' }}>
                    <div style={{ color:'#22c55e', fontSize:13, fontWeight:600 }}>● Location available</div>
                    <div style={{ color:'#555', fontSize:11, marginTop:2 }}>
                      Updated {new Date(otherLocation.updated_at).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' })}
                    </div>
                  </div>
                  <button onClick={() => openInMaps(otherLocation.lat, otherLocation.lng)}
                    style={{ width:'100%', padding:12, background:'#1d4ed8', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', marginBottom:8 }}>
                    🗺️ Open in Google Maps
                  </button>
                </>
              ) : (
                <div style={{ color:'#555', fontSize:13, padding:'8px 0' }}>
                  Waiting for {otherName} to share location...
                </div>
              )}
              <button onClick={() => fetchOtherLocation(otherUserIdRef.current, bookingIdRef.current)}
                style={{ width:'100%', padding:9, background:'transparent', color:'#555', border:'1px solid #333', borderRadius:8, fontSize:12, cursor:'pointer', marginTop:4 }}>
                🔄 Refresh
              </button>
            </div>

            {/* End Ride — driver only */}
            {isOwner && (
              <button onClick={endRide} style={{ width:'100%', padding:14, background:'#16a34a', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:10 }}>
                🏁 End Ride
              </button>
            )}
          </>
        )}

        {/* Rating — show if not already rated */}
        {!isCancelled && !alreadyRated && (
          <button onClick={() => setShowRating(true)} style={{ width:'100%', padding:14, background:'#7c3aed', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:10 }}>
            ⭐ Rate {isOwner ? 'Co-rider' : 'Car Owner'}
          </button>
        )}
        {alreadyRated && (
          <div style={{ width:'100%', padding:14, background:'#1a1a1a', color:'#22c55e', borderRadius:12, fontSize:14, fontWeight:700, textAlign:'center', marginBottom:10, border:'1px solid #166534' }}>
            ✓ You've rated this ride
          </div>
        )}

        {/* SOS — only during active ride */}
        {!isCompleted && !isCancelled && (
          <button onClick={triggerSOS} style={{ width:'100%', padding:14, background:'#dc2626', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 15px rgba(220,38,38,0.3)' }}>
            🆘 SOS — Send Location to Emergency Contact
          </button>
        )}
      </div>

      {showRating && otherProfile && !alreadyRated && (
        <RatingModal
          booking={booking}
          rideOwner={otherProfile}
          onClose={() => { setShowRating(false); setAlreadyRated(true); if (rideEnded) navigate('/my-rides') }}
        />
      )}
    </div>
  )
}
