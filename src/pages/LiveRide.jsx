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
  const [rideEnded, setRideEnded] = useState(false)
  const [status, setStatus] = useState('loading')
  const [gpsError, setGpsError] = useState('')

  const watchRef = useRef(null)
  const autoStopRef = useRef(null)
  const rideIdRef = useRef(null)
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
    rideIdRef.current = bk.rides.id

    const isOwner = bk.rides.driver_id === user.id
    const otherId = isOwner ? bk.rider_id : bk.rides.driver_id
    otherUserIdRef.current = otherId

    const { data: op } = await supabase
      .from('profiles').select('*').eq('id', otherId).maybeSingle()
    setOtherProfile(op)

    setStatus('ready')

    // Load their location immediately
    fetchOtherLocation(otherId, bk.rides.id)

    // Subscribe to realtime updates
    setupRealtime(otherId, bk.rides.id)
  }

  function setupRealtime(otherId, rideId) {
    // Remove existing channel
    if (channelRef.current) supabase.removeChannel(channelRef.current)

    const ch = supabase
      .channel(`live-loc-${rideId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_locations',
        filter: `ride_id=eq.${rideId}`,
      }, (payload) => {
        if (payload.new?.user_id === otherId) {
          setOtherLocation(payload.new)
        }
      })
      .subscribe((s) => console.log('Live location realtime:', s))

    channelRef.current = ch
  }

  async function fetchOtherLocation(otherId, rideId) {
    const { data, error } = await supabase
      .from('live_locations')
      .select('*')
      .eq('user_id', otherId)
      .eq('ride_id', rideId)
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

    // Auto-stop after 3 hours
    autoStopRef.current = setTimeout(() => {
      stopTracking()
      alert('Location sharing stopped after 3 hours to save battery.')
    }, 3 * 60 * 60 * 1000)

    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const loc = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }
        setMyLocation(loc)
        setGpsError('')

        await supabase.from('live_locations').upsert({
          user_id: user.id,
          ride_id: rideIdRef.current,
          latitude: loc.latitude,
          longitude: loc.longitude,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,ride_id' })
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

  // Loading / error states
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
  const phone = otherProfile?.phone?.replace(/\D/g,'')
  const waMsg = encodeURIComponent(`Hi ${otherName}! I'm sharing my live location on CarpoolKaro 🚗`)

  const btnBase = {
    flex:1, display:'flex', alignItems:'center', justifyContent:'center',
    gap:6, padding:'10px 8px', borderRadius:10,
    fontSize:13, fontWeight:600, textDecoration:'none',
  }

  return (
    <div style={{ minHeight:'100vh', background:'#111', color:'#fff' }}>
      {/* Header */}
      <div style={{ padding:'20px 16px 16px', display:'flex', alignItems:'center', gap:12, borderBottom:'1px solid #1a1a1a' }}>
        <button onClick={() => navigate('/my-rides')}
          style={{ background:'none', border:'none', color:'#fff', fontSize:22, cursor:'pointer' }}>←</button>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:18 }}>📍 Live Ride</div>
          <div style={{ color:'#555', fontSize:12 }}>
            {ride?.from_location} → {ride?.to_location} · {formatTime(ride?.ride_time)}
          </div>
        </div>
        {tracking && (
          <div style={{ background:'#16a34a', borderRadius:20, padding:'4px 12px', fontSize:11, fontWeight:700, animation:'pulse 2s infinite' }}>
            ● LIVE
          </div>
        )}
      </div>

      <div style={{ padding:'12px 16px 100px' }}>

        {/* Other person */}
        <div style={{ background:'#1a1a1a', borderRadius:16, padding:16, marginBottom:10 }}>
          <div style={{ fontSize:10, color:'#555', marginBottom:10, letterSpacing:1, fontWeight:700 }}>
            {isOwner ? '🙋 CO-RIDER' : '🚗 CAR OWNER'}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
            <div style={{ width:48, height:48, borderRadius:'50%', background:'#7c3aed', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:16, flexShrink:0 }}>
              {otherInitials}
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:16 }}>{otherName}</div>
              {otherProfile?.vehicle_model && (
                <div style={{ color:'#555', fontSize:12, marginTop:2 }}>🚘 {otherProfile.vehicle_model}</div>
              )}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <a href={`tel:+91${phone}`} style={{ ...btnBase, background:'#0a2e1a', color:'#22c55e', border:'1px solid #166534' }}>
              📞 Call
            </a>
            <a href={`https://wa.me/91${phone}?text=${waMsg}`} target="_blank" rel="noreferrer"
              style={{ ...btnBase, background:'#052e1a', color:'#22c55e', border:'1px solid #166534' }}>
              💬 WhatsApp
            </a>
          </div>
        </div>

        {/* My location */}
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
            width:'100%', padding:13, borderRadius:10, border:'none', cursor:'pointer', fontWeight:800, fontSize:14,
            background: tracking ? '#2a0a0a' : '#facc15',
            color: tracking ? '#f87171' : '#000',
            border: tracking ? '1px solid #7f1d1d' : 'none',
          }}>
            {tracking ? '⏹ Stop Sharing' : '▶ Start Sharing Location'}
          </button>
        </div>

        {/* Their location */}
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
              <button onClick={() => openInMaps(otherLocation.latitude, otherLocation.longitude)}
                style={{ width:'100%', padding:12, background:'#1d4ed8', color:'#fff', border:'none', borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer', marginBottom:8 }}>
                🗺️ Open in Google Maps
              </button>
            </>
          ) : (
            <div style={{ color:'#555', fontSize:13, padding:'8px 0' }}>
              Waiting for {otherName} to share location...
            </div>
          )}

          <button onClick={() => fetchOtherLocation(otherUserIdRef.current, rideIdRef.current)}
            style={{ width:'100%', padding:9, background:'transparent', color:'#555', border:'1px solid #333', borderRadius:8, fontSize:12, cursor:'pointer', marginTop:4 }}>
            🔄 Refresh
          </button>
        </div>

        {/* Actions */}
        {isOwner && !rideEnded && (
          <button onClick={endRide} style={{ width:'100%', padding:14, background:'#16a34a', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:10 }}>
            🏁 End Ride
          </button>
        )}

        <button onClick={() => setShowRating(true)} style={{ width:'100%', padding:14, background:'#7c3aed', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', marginBottom:10 }}>
          ⭐ Rate {isOwner ? 'Co-rider' : 'Car Owner'}
        </button>

        <button onClick={triggerSOS} style={{ width:'100%', padding:14, background:'#dc2626', color:'#fff', border:'none', borderRadius:12, fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 4px 15px rgba(220,38,38,0.3)' }}>
          🆘 SOS — Send Location to Emergency Contact
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
