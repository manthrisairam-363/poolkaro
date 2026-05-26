import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ── Smart content filter ──────────────────────────────────
// Masks phone numbers and UPI IDs typed in chat
function sanitizeMessage(text) {
  // Mask Indian phone numbers (10 digits, with or without +91/0)
  let safe = text.replace(/(\+91[\s-]?)?(\b[6-9]\d{9}\b)/g, '📵 [number hidden]')
  // Mask 91XXXXXXXXXX format
  safe = safe.replace(/\b91[6-9]\d{9}\b/g, '📵 [number hidden]')
  // Mask UPI IDs (anything@something)
  safe = safe.replace(/[\w.\-+]+@[\w.\-]+/g, '🚫 [UPI hidden]')
  // Mask written-out numbers (nine eight seven...)
  return safe
}

function containsSensitive(text) {
  const phoneRegex = /(\+91[\s-]?)?[6-9]\d{9}|91[6-9]\d{9}/
  const upiRegex = /[\w.\-+]+@[\w.\-]+/
  return phoneRegex.test(text) || upiRegex.test(text)
}

export default function Chat() {
  const { bookingId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [booking, setBooking] = useState(null)
  const [otherUser, setOtherUser] = useState(null)
  const [senderProfile, setSenderProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [warning, setWarning] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { fetchAll() }, [bookingId])

  useEffect(() => {
    if (!booking) return

    const channel = supabase
      .channel(`chat:${bookingId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `booking_id=eq.${bookingId}`
      }, payload => {
        setMessages(prev => prev.find(m => m.id === payload.new.id) ? prev : [...prev, payload.new])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        // Mark as read if from other user
        if (payload.new.sender_id !== user.id) {
          supabase.from('messages').update({ read: true }).eq('id', payload.new.id)
        }
      })
      .subscribe()

    // Mark existing messages as read
    supabase.from('messages')
      .update({ read: true })
      .eq('booking_id', bookingId)
      .neq('sender_id', user.id)

    return () => supabase.removeChannel(channel)
  }, [booking])

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)
  }, [messages])

  async function fetchAll() {
    // Fetch booking with ride + both users
    const { data: b } = await supabase
      .from('bookings')
      .select('*, rides(*, driver:profiles!rides_driver_id_fkey(id, full_name, avatar_url, phone)), rider:profiles!bookings_rider_id_fkey(id, full_name, avatar_url, phone)')
      .eq('id', bookingId)
      .single()

    if (!b) { navigate('/my-rides'); return }

    const isRider = b.rider_id === user.id
    const isDriver = b.rides?.driver_id === user.id
    if (!isRider && !isDriver) { navigate('/my-rides'); return }

    setBooking(b)
    setOtherUser(isRider ? b.rides?.driver : b.rider)

    // Get sender's profile name for notifications
    const { data: sp } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single()
    setSenderProfile(sp)

    // Fetch messages
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })
    setMessages(msgs || [])
    setLoading(false)

    // Mark all as read
    supabase.from('messages')
      .update({ read: true })
      .eq('booking_id', bookingId)
      .neq('sender_id', user.id)
  }

  async function sendMessage(e) {
    e?.preventDefault()
    if (!text.trim() || sending) return

    // Warn if sensitive content detected
    if (containsSensitive(text)) {
      setWarning('⚠️ Phone numbers and UPI IDs are not allowed in chat for your safety.')
      return
    }

    setSending(true)
    setWarning('')
    const msgText = sanitizeMessage(text.trim())
    setText('')

    const { data: msg, error } = await supabase.from('messages').insert({
      booking_id: bookingId,
      sender_id: user.id,
      text: msgText,
      read: false,
    }).select().single()

    if (!error && msg) {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])

      // Send notification to other user with correct sender name
      if (otherUser?.id) {
        const senderName = senderProfile?.full_name || 'Someone'
        await supabase.from('notifications').insert({
          user_id: otherUser.id,
          title: `💬 ${senderName}`,
          message: msgText.slice(0, 80),
          type: 'booking',
          is_read: false,
        })
      }
    }

    setSending(false)
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }, 100)
  }

  function handleTextChange(e) {
    setText(e.target.value)
    if (warning) setWarning('')
  }

  function formatTime(ts) {
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' +
           d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  function groupMessages(msgs) {
    const groups = []
    let lastDate = ''
    msgs.forEach(m => {
      const d = new Date(m.created_at).toDateString()
      if (d !== lastDate) {
        groups.push({
          type: 'date',
          label: d === new Date().toDateString() ? 'Today' :
                 new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })
        })
        lastDate = d
      }
      groups.push({ type: 'msg', ...m })
    })
    return groups
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>💬</div>
        Loading chat...
      </div>
    </div>
  )

  const ride = booking?.rides
  const isCancelled = booking?.status === 'cancelled'
  const grouped = groupMessages(messages)

  const QUICK_REPLIES = [
    '👋 Hi! I booked your ride',
    '📍 What\'s the exact pickup point?',
    '🕐 Running 5 mins late',
    '✅ I\'m here, ready!',
    '🙏 Thanks for the ride!',
    '💺 Can I book 2 seats?',
  ]

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fff' }}>

      {/* Header */}
      <div style={{ background: '#111', padding: '12px 16px', borderBottom: '1px solid #1a1a1a', flexShrink: 0, paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: '4px 6px 4px 0' }}>←</button>

          {/* Avatar */}
          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#222', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#facc15', fontSize: 16 }}>
            {otherUser?.avatar_url
              ? <img src={otherUser.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
              : (otherUser?.full_name?.[0]?.toUpperCase() || '?')}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {otherUser?.full_name || 'Co-rider'}
            </div>
            <div style={{ color: '#555', fontSize: 11, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ride?.from_location} → {ride?.to_location}
            </div>
          </div>

          {/* Call button — masked, number never shown */}
          {otherUser?.phone && (
            <a href={`tel:+91${otherUser.phone.replace(/\D/g, '')}`}
              style={{ background: '#1a1a1a', border: '1px solid #222', color: '#4ade80', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, textDecoration: 'none', flexShrink: 0 }}
              title="Call">
              📞
            </a>
          )}
        </div>

        {/* Ride status bar */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{ background: '#1a1a1a', padding: '4px 10px', borderRadius: 20, fontSize: 11, color: '#666' }}>
            📅 {ride?.ride_date} · {ride?.ride_time?.slice(0,5)}
          </span>
          <span style={{ background: isCancelled ? '#3b0000' : '#052e16', padding: '4px 10px', borderRadius: 20, fontSize: 11, color: isCancelled ? '#f87171' : '#4ade80', fontWeight: 700 }}>
            ● {booking?.status}
          </span>
        </div>
      </div>

      {/* Safety notice — shown once */}
      <div style={{ background: '#1a0f00', borderBottom: '1px solid #2a1800', padding: '8px 16px', flexShrink: 0 }}>
        <div style={{ fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
          🔒 For your safety, phone numbers and UPI IDs are blocked in chat. Use the 📞 call button to call or UPI section to pay.
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 4 }}>

        {grouped.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#333', textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <div style={{ fontWeight: 700, color: '#444', marginBottom: 6 }}>Say hello!</div>
            <div style={{ fontSize: 13, color: '#333', lineHeight: 1.6 }}>
              Coordinate your pickup point,<br/>timing, or anything else here.
            </div>
          </div>
        )}

        {grouped.map((item, i) => {
          if (item.type === 'date') return (
            <div key={`date-${i}`} style={{ textAlign: 'center', margin: '10px 0 6px' }}>
              <span style={{ background: '#1a1a1a', color: '#555', fontSize: 11, padding: '4px 12px', borderRadius: 10 }}>
                {item.label}
              </span>
            </div>
          )

          const isMine = item.sender_id === user.id
          return (
            <div key={item.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
              <div style={{
                maxWidth: '78%',
                background: isMine ? '#facc15' : '#1e1e1e',
                color: isMine ? '#111' : '#fff',
                borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                padding: '10px 14px',
                fontSize: 14,
                lineHeight: 1.5,
                wordBreak: 'break-word',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}>
                <div>{item.text}</div>
                <div style={{ fontSize: 10, color: isMine ? '#78350f' : '#555', marginTop: 4, textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
                  {formatTime(item.created_at)}
                  {isMine && (
                    <span style={{ color: item.read ? '#16a34a' : '#555' }}>
                      {item.read ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies — show when no messages */}
      {!isCancelled && messages.length < 2 && (
        <div style={{ padding: '6px 10px', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0, scrollbarWidth: 'none' }}>
          {QUICK_REPLIES.map(q => (
            <button key={q} onClick={() => { setText(q); inputRef.current?.focus() }} style={{
              background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#bbb',
              padding: '7px 12px', borderRadius: 18, fontSize: 12,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}>{q}</button>
          ))}
        </div>
      )}

      {/* Warning */}
      {warning && (
        <div style={{ background: '#2a1500', padding: '10px 16px', flexShrink: 0, borderTop: '1px solid #3a2000' }}>
          <div style={{ fontSize: 12, color: '#f97316' }}>{warning}</div>
        </div>
      )}

      {/* Input */}
      {!isCancelled ? (
        <div style={{ background: '#111', borderTop: '1px solid #1a1a1a', padding: '10px 12px', flexShrink: 0, display: 'flex', gap: 10, alignItems: 'flex-end', paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
          <textarea
            ref={inputRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Type a message..."
            rows={1}
            style={{
              flex: 1, background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#fff',
              borderRadius: 22, padding: '10px 16px', fontSize: 14, resize: 'none',
              outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120,
              transition: 'border-color 0.2s',
            }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!text.trim() || sending}
            style={{
              width: 44, height: 44, borderRadius: '50%', border: 'none',
              cursor: text.trim() ? 'pointer' : 'default',
              background: text.trim() ? '#facc15' : '#1a1a1a',
              color: text.trim() ? '#111' : '#444',
              fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: '0.2s',
            }}
          >
            {sending ? '⏳' : '➤'}
          </button>
        </div>
      ) : (
        <div style={{ background: '#111', borderTop: '1px solid #1a1a1a', padding: '14px 16px', textAlign: 'center', color: '#555', fontSize: 13, flexShrink: 0 }}>
          This booking was cancelled. Chat is read-only.
        </div>
      )}
    </div>
  )
}
