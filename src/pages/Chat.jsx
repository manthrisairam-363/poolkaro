import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Convert common word numbers to digits for detection
function wordsToDigits(text) {
  const map = {
    'zero':'0','one':'1','two':'2','three':'3','four':'4',
    'five':'5','six':'6','seven':'7','eight':'8','nine':'9',
    'ek':'1','do':'2','teen':'3','char':'4','paanch':'5',
    'chhe':'6','saat':'7','aath':'8','nau':'9','dus':'0',
  }
  let t = text.toLowerCase()
  Object.entries(map).forEach(([w, d]) => {
    t = t.replace(new RegExp('\\b' + w + '\\b', 'g'), d)
  })
  return t
}

// Normalize unicode/fullwidth digits to ASCII
function normalizeDigits(text) {
  return text
    .replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))  // Arabic
    .replace(/[०१२३४५६७८९]/g, d => '०१२३४५६७८९'.indexOf(d))    // Devanagari
    .replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFF10 + 48)) // Fullwidth
}

function stripSeparators(text) {
  return text.replace(/[\s.\-,/\\|_*()\[\]{}:;~@#!?'"`]+/g, '')
}

function hasSensitive(text) {
  const normalized = normalizeDigits(wordsToDigits(text))
  const stripped = stripSeparators(normalized)
  // 10 digit Indian mobile (6-9 start)
  const hasPhone = /[6-9]\d{9}/.test(stripped) ||
                   /\d{10,}/.test(stripped) ||
                   /91[6-9]\d{9}/.test(stripped)
  // UPI ID
  const hasUPI = /[\w.\-+]+@[\w.\-]+/.test(text)
  return hasPhone || hasUPI
}

function sanitize(text) {
  const normalized = normalizeDigits(wordsToDigits(text))
  const stripped = stripSeparators(normalized)
  let result = text
  if (/[6-9]\d{9}/.test(stripped) || /\d{10,}/.test(stripped)) {
    result = result.replace(/[\d][\s.\-,/\\|_*()\[\]{}:;~]*[\d][\s.\-,/\\|_*()\[\]{}:;~]*[\d][\s.\-,/\\|_*()\[\]{}:;~]*[\d][\s.\-,/\\|_*()\[\]{}:;~]*[\d][\s.\-,/\\|_*()\[\]{}:;~]*[\d][\s.\-,/\\|_*()\[\]{}:;~]*[\d][\s.\-,/\\|_*()\[\]{}:;~]*[\d][\s.\-,/\\|_*()\[\]{}:;~]*[\d][\s.\-,/\\|_*()\[\]{}:;~]*[\d]/g, '📵 [number hidden]')
  }
  result = result.replace(/[\w.\-+]+@[\w.\-]+/, '🚫 [UPI hidden]')
  return result
}

const QUICK = [
  '👋 Hi! I booked your ride',
  '📍 What\'s the exact pickup point?',
  '🕐 Running 5 mins late, sorry!',
  '✅ I\'m here, ready to go!',
  '🙏 Thanks for the ride!',
]

export default function Chat() {
  const { bookingId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [info, setInfo] = useState(null) // { rideInfo, otherName, otherAvatar, otherPhone, otherId, isCancelled }
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [warn, setWarn] = useState('')
  const [senderName, setSenderName] = useState('')
  const [isLive, setIsLive] = useState(false)
  const [liveLocations, setLiveLocations] = useState({})
  const liveWatchRef = useRef(null)
  const liveIntervalRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const latestMsgId = useRef(null)

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [])

  useEffect(() => { init() }, [bookingId])

  async function init() {
    setLoading(true)

    // 1. Fetch booking simply
    const { data: b, error: bErr } = await supabase
      .from('bookings')
      .select('id, status, rider_id, ride_id')
      .eq('id', bookingId)
      .single()

    if (bErr || !b) { navigate('/my-rides'); return }

    const isRider = b.rider_id === user.id

    // 2. Fetch ride + driver
    const { data: ride } = await supabase
      .from('rides')
      .select('from_location, to_location, ride_date, ride_time, fare, driver_id')
      .eq('id', b.ride_id)
      .single()

    const isDriver = ride?.driver_id === user.id
    if (!isRider && !isDriver) { navigate('/my-rides'); return }

    const otherId = isRider ? ride?.driver_id : b.rider_id

    // 3. Fetch other user profile
    const { data: other } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, phone')
      .eq('id', otherId)
      .single()

    // 4. Fetch own name for notifications
    const { data: me } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single()

    setSenderName(me?.full_name || 'Someone')
    setInfo({
      rideInfo: `${ride?.from_location} → ${ride?.to_location} · ${ride?.ride_date}`,
      otherName: other?.full_name || 'Co-rider',
      otherAvatar: other?.avatar_url,
      otherPhone: other?.phone,
      otherId,
      isCancelled: b.status === 'cancelled',
    })

    // 5. Load messages
    await loadMessages()
    setLoading(false)

    // 6. Mark as read
    supabase.from('messages')
      .update({ read: true })
      .eq('booking_id', bookingId)
      .neq('sender_id', user.id)
      .then(() => {})
  }

  async function loadMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })
    if (data) {
      setMsgs(data)
      if (data.length > 0) latestMsgId.current = data[data.length - 1].id
    }
    return data
  }

  // Realtime subscription
  useEffect(() => {
    if (loading) return

    const channel = supabase
      .channel(`chat_${bookingId}_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `booking_id=eq.${bookingId}`,
      }, payload => {
        const newMsg = payload.new
        setMsgs(prev => {
          if (prev.find(m => m.id === newMsg.id)) return prev
          latestMsgId.current = newMsg.id
          return [...prev, newMsg]
        })
        scrollBottom()
        // Mark as read if from other person
        if (newMsg.sender_id !== user.id) {
          supabase.from('messages').update({ read: true }).eq('id', newMsg.id).then(() => {})
        }
      })
      .subscribe((status) => {
        console.log('Chat realtime status:', status)
      })

    return () => { supabase.removeChannel(channel) }
  }, [loading, bookingId])

  // Polling fallback — every 4 seconds fetch new messages
  useEffect(() => {
    if (loading) return
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true })
      if (data && data.length > 0) {
        const latestId = data[data.length - 1].id
        if (latestId !== latestMsgId.current) {
          latestMsgId.current = latestId
          setMsgs(data)
          scrollBottom()
          // Mark new messages as read
          supabase.from('messages').update({ read: true })
            .eq('booking_id', bookingId).neq('sender_id', user.id).then(() => {})
        }
      }
    }, 4000)
    return () => clearInterval(poll)
  }, [loading, bookingId])

  useEffect(() => { scrollBottom() }, [msgs.length])

  // ── LOCATION SHARING ──
  async function sendLocation() {
    if (!navigator.geolocation) { alert('Location not supported on this device'); return }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords
      const { data: saved } = await supabase.from('messages').insert({
        booking_id: bookingId, sender_id: user.id,
        text: `📍LOC:${lat.toFixed(6)},${lng.toFixed(6)}`, read: false,
      }).select().single()
      if (saved) { setMsgs(prev => [...prev, saved]); scrollBottom() }
      if (info?.otherId) await supabase.from('notifications').insert({
        user_id: info.otherId, title: `📍 ${senderName} shared location`,
        message: 'Tap to see pickup point', type: 'booking', is_read: false,
      })
    }, () => alert('Could not get location. Please enable GPS.'))
  }

  async function startLiveLocation() {
    if (!navigator.geolocation) { alert('Location not supported'); return }
    setIsLive(true)
    const { data: saved } = await supabase.from('messages').insert({
      booking_id: bookingId, sender_id: user.id, text: `📡LIVE:${user.id}`, read: false,
    }).select().single()
    if (saved) { setMsgs(prev => [...prev, saved]); scrollBottom() }
    let lastLat = null, lastLng = null
    liveWatchRef.current = navigator.geolocation.watchPosition(pos => {
      lastLat = pos.coords.latitude; lastLng = pos.coords.longitude
    })
    liveIntervalRef.current = setInterval(async () => {
      if (lastLat && lastLng) await supabase.from('live_locations').upsert({
        booking_id: bookingId, user_id: user.id,
        lat: lastLat, lng: lastLng, is_active: true, updated_at: new Date().toISOString(),
      }, { onConflict: 'booking_id,user_id' })
    }, 10000)
    if (info?.otherId) await supabase.from('notifications').insert({
      user_id: info.otherId, title: `📡 ${senderName} is sharing live location`,
      message: 'Tap to track in real time', type: 'booking', is_read: false,
    })
  }

  async function stopLiveLocation() {
    setIsLive(false)
    if (liveWatchRef.current) navigator.geolocation.clearWatch(liveWatchRef.current)
    if (liveIntervalRef.current) clearInterval(liveIntervalRef.current)
    await supabase.from('live_locations').update({ is_active: false })
      .eq('booking_id', bookingId).eq('user_id', user.id)
    const { data: saved } = await supabase.from('messages').insert({
      booking_id: bookingId, sender_id: user.id, text: '📡STOP:ended', read: false,
    }).select().single()
    if (saved) setMsgs(prev => [...prev, saved])
  }

  // Poll live locations every 8s
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase.from('live_locations')
        .select('user_id,lat,lng,updated_at,is_active')
        .eq('booking_id', bookingId).eq('is_active', true)
      if (data) { const m = {}; data.forEach(l => { m[l.user_id] = l }); setLiveLocations(m) }
    }, 8000)
    return () => clearInterval(interval)
  }, [bookingId])

  function renderMsg(item) {
    const mine = item.sender_id === user.id
    const txt = item.text || ''

    if (txt.startsWith('📍LOC:')) {
      const [lat, lng] = txt.replace('📍LOC:', '').split(',')
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`
      return (
        <div style={{ background: mine ? '#facc15' : '#1e1e1e', borderRadius: 14, overflow: 'hidden', width: 230 }}>
          <div style={{ background: mine ? '#f59e0b' : '#333', padding: '8px 12px', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>📍</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: mine ? '#111' : '#fff' }}>Shared Location</span>
          </div>
          <div style={{ padding: 10 }}>
            <div style={{ background: mine ? 'rgba(0,0,0,0.08)' : '#2a2a2a', borderRadius: 8, height: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 36 }}>🗺️</span>
            </div>
            <a href={mapsUrl} target="_blank" rel="noreferrer"
              style={{ display: 'block', textAlign: 'center', background: mine ? '#111' : '#facc15', color: mine ? '#facc15' : '#111', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
              Open in Google Maps →
            </a>
          </div>
          <div style={{ fontSize: 10, color: mine ? '#78350f' : '#555', padding: '0 12px 8px', textAlign: 'right' }}>{fmtTime(item.created_at)}</div>
        </div>
      )
    }

    if (txt.startsWith('📡LIVE:')) {
      const senderId = txt.replace('📡LIVE:', '')
      const live = liveLocations[senderId]
      const mapsUrl = live ? `https://www.google.com/maps?q=${live.lat},${live.lng}` : null
      const secAgo = live ? Math.round((Date.now() - new Date(live.updated_at)) / 1000) : null
      return (
        <div style={{ background: mine ? '#facc15' : '#1e1e1e', borderRadius: 14, overflow: 'hidden', width: 230 }}>
          <div style={{ background: mine ? '#f59e0b' : '#333', padding: '8px 12px', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>📡</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: mine ? '#111' : '#fff' }}>Live Location</span>
            {live && <span style={{ marginLeft: 'auto', fontSize: 9, background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: 100 }}>● LIVE</span>}
          </div>
          <div style={{ padding: 10 }}>
            {live ? (
              <>
                <div style={{ fontSize: 11, color: mine ? '#78350f' : '#888', marginBottom: 8 }}>Updated {secAgo}s ago</div>
                <a href={mapsUrl} target="_blank" rel="noreferrer"
                  style={{ display: 'block', textAlign: 'center', background: mine ? '#111' : '#facc15', color: mine ? '#facc15' : '#111', borderRadius: 8, padding: '8px', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                  📍 Track Live in Maps →
                </a>
              </>
            ) : (
              <div style={{ textAlign: 'center', fontSize: 12, color: mine ? '#78350f' : '#888', padding: '6px 0' }}>Waiting for location...</div>
            )}
          </div>
          <div style={{ fontSize: 10, color: mine ? '#78350f' : '#555', padding: '0 12px 8px', textAlign: 'right' }}>{fmtTime(item.created_at)}</div>
        </div>
      )
    }

    if (txt.startsWith('📡STOP:')) return (
      <div style={{ background: mine ? '#fef9c3' : '#1a1a1a', borderRadius: 12, padding: '8px 14px', fontSize: 12, color: mine ? '#78350f' : '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>📡</span> Live location ended
        <div style={{ fontSize: 10, marginLeft: 'auto' }}>{fmtTime(item.created_at)}</div>
      </div>
    )

    return (
      <div style={{ maxWidth: '78%', background: mine ? '#facc15' : '#1e1e1e', color: mine ? '#111' : '#fff', borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '10px 14px', fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word' }}>
        {item.text}
        <div style={{ fontSize: 10, color: mine ? '#78350f' : '#555', marginTop: 4, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
          {fmtTime(item.created_at)}
          {mine && <span style={{ color: item.read ? '#16a34a' : '#777' }}>{item.read ? '✓✓' : '✓'}</span>}
        </div>
      </div>
    )
  }

  async function send(e) {
    e?.preventDefault()
    if (!text.trim() || sending) return
    if (hasSensitive(text)) {
      setWarn('⚠️ Phone numbers and UPI IDs are not allowed in chat for your safety.')
      return
    }
    setSending(true)
    setWarn('')
    const msgText = sanitize(text.trim())
    setText('')

    const { data: saved } = await supabase.from('messages').insert({
      booking_id: bookingId,
      sender_id: user.id,
      text: msgText,
      read: false,
    }).select().single()

    if (saved) {
      setMsgs(prev => prev.find(m => m.id === saved.id) ? prev : [...prev, saved])
      latestMsgId.current = saved.id
      scrollBottom()
      // Notify other user
      if (info?.otherId) {
        await supabase.from('notifications').insert({
          user_id: info.otherId,
          title: `💬 ${senderName}`,
          message: msgText.slice(0, 80),
          type: 'booking',
          is_read: false,
        })
      }
    }
    setSending(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function fmtTime(ts) {
    const d = new Date(ts)
    const isToday = d.toDateString() === new Date().toDateString()
    if (isToday) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' +
           d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  // Group by date
  const grouped = []
  let lastDate = ''
  msgs.forEach(m => {
    const d = new Date(m.created_at).toDateString()
    if (d !== lastDate) {
      grouped.push({ type: 'date', label: d === new Date().toDateString() ? 'Today' : new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) })
      lastDate = d
    }
    grouped.push({ type: 'msg', ...m })
  })

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 36 }}>💬</div>
      Loading chat...
    </div>
  )

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fff' }}>

      {/* Header */}
      <div style={{ background: '#111', padding: '12px 16px', borderBottom: '1px solid #1a1a1a', flexShrink: 0, paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', paddingRight: 6 }}>←</button>

          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#222', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#facc15', fontSize: 16 }}>
            {info?.otherAvatar
              ? <img src={info.otherAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', WebkitTouchCallout: 'none' }} alt="" />
              : info?.otherName?.[0]?.toUpperCase()}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{info?.otherName}</div>
            <div style={{ color: '#555', fontSize: 11, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info?.rideInfo}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <span style={{ background: info?.isCancelled ? '#3b0000' : '#052e16', padding: '4px 10px', borderRadius: 20, fontSize: 11, color: info?.isCancelled ? '#f87171' : '#4ade80', fontWeight: 700 }}>
            ● {info?.isCancelled ? 'cancelled' : 'confirmed'}
          </span>
        </div>
      </div>

      {/* Safety bar */}
      <div style={{ background: '#1a0f00', borderBottom: '1px solid #2a1800', padding: '7px 16px', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: '#92400e' }}>
          🔒 Phone numbers & UPI IDs are blocked. Use 📞 to call or UPI section to pay.
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {msgs.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <div style={{ fontWeight: 700, color: '#444', marginBottom: 6 }}>No messages yet</div>
            <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>Coordinate pickup point,<br/>timing or anything else here.</div>
          </div>
        )}

        {grouped.map((item, i) => {
          if (item.type === 'date') return (
            <div key={i} style={{ textAlign: 'center', margin: '10px 0 6px' }}>
              <span style={{ background: '#1a1a1a', color: '#555', fontSize: 11, padding: '4px 12px', borderRadius: 10 }}>{item.label}</span>
            </div>
          )
          const mine = item.sender_id === user.id
          return (
            <div key={item.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 4, alignItems: 'flex-end', gap: 4 }}>
              {renderMsg(item)}
              {!mine && !item.text?.startsWith('📍') && !item.text?.startsWith('📡') && (
                <button onClick={async () => {
                  if (!confirm('Report this message for sharing personal contact info?')) return
                  await supabase.from('reported_messages').insert({ booking_id: bookingId, reported_by: user.id, message_text: item.text })
                  alert('✅ Reported. We will review within 24 hours.')
                }} style={{ background: 'none', border: 'none', color: '#333', fontSize: 14, cursor: 'pointer', padding: 2, flexShrink: 0, opacity: 0.5 }}>⚑</button>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {!info?.isCancelled && msgs.length < 3 && (
        <div style={{ padding: '6px 10px', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
          {QUICK.map(q => (
            <button key={q} onClick={() => { setText(q); inputRef.current?.focus() }}
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#bbb', padding: '7px 12px', borderRadius: 18, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {warn && (
        <div style={{ background: '#2a1500', padding: '9px 16px', flexShrink: 0 }}>
          <div style={{ fontSize: 12, color: '#f97316' }}>{warn}</div>
        </div>
      )}

      {!info?.isCancelled ? (
        <div style={{ background: '#111', borderTop: '1px solid #1a1a1a', paddingBottom: 'max(10px, env(safe-area-inset-bottom))', flexShrink: 0 }}>
          {/* Location buttons */}
          <div style={{ display: 'flex', gap: 8, padding: '8px 12px 4px' }}>
            <button onClick={sendLocation} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#facc15', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              📍 Location
            </button>
            {isLive ? (
              <button onClick={stopLiveLocation} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#dc2626', border: 'none', color: '#fff', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ⏹ Stop Live
              </button>
            ) : (
              <button onClick={startLiveLocation} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#4ade80', borderRadius: 20, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                📡 Live Location
              </button>
            )}
          </div>
          {/* Message input */}
          <div style={{ padding: '0 12px 10px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef} value={text}
              onChange={e => { setText(e.target.value); if (warn) setWarn('') }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Type a message..."
              rows={1}
              style={{ flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff', borderRadius: 22, padding: '10px 16px', fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120 }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
            />
            <button onClick={send} disabled={!text.trim() || sending}
              style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: text.trim() ? 'pointer' : 'default', background: text.trim() ? '#facc15' : '#1a1a1a', color: text.trim() ? '#111' : '#444', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: '0.2s' }}>
              {sending ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ background: '#111', borderTop: '1px solid #1a1a1a', padding: '14px', textAlign: 'center', color: '#555', fontSize: 13, flexShrink: 0 }}>
          This booking was cancelled. Chat is read-only.
        </div>
      )}
    </div>
  )
}
