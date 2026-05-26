import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function Chat() {
  const { bookingId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [booking, setBooking] = useState(null)
  const [otherUser, setOtherUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { fetchBooking() }, [bookingId])

  useEffect(() => {
    if (!booking) return
    fetchMessages()

    // Realtime subscription
    const channel = supabase
      .channel(`chat:${bookingId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `booking_id=eq.${bookingId}`
      }, payload => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .subscribe()

    // Mark messages as read
    supabase.from('messages')
      .update({ read: true })
      .eq('booking_id', bookingId)
      .neq('sender_id', user.id)

    return () => supabase.removeChannel(channel)
  }, [booking])

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)
  }, [messages])

  async function fetchBooking() {
    const { data } = await supabase
      .from('bookings')
      .select('*, rides(*, profiles(id, full_name, avatar_url, phone)), profiles(id, full_name, avatar_url, phone)')
      .eq('id', bookingId)
      .single()

    if (!data) { navigate('/my-rides'); return }

    // Verify user is part of this booking
    const isRider = data.rider_id === user.id
    const isDriver = data.rides?.driver_id === user.id
    if (!isRider && !isDriver) { navigate('/my-rides'); return }

    setBooking(data)
    setOtherUser(isRider ? data.rides?.profiles : data.profiles)
    setLoading(false)
  }

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
  }

  async function sendMessage(e) {
    e?.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    const msgText = text.trim()
    setText('')

    const { data: msg, error } = await supabase.from('messages').insert({
      booking_id: bookingId,
      sender_id: user.id,
      text: msgText,
      read: false,
    }).select().single()

    if (!error && msg) {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
      // Notify other user
      if (otherUser?.id) {
        await supabase.from('notifications').insert({
          user_id: otherUser.id,
          title: '💬 New Message',
          message: `${user.user_metadata?.full_name || 'Someone'}: ${msgText.slice(0, 60)}`,
          type: 'booking',
          is_read: false,
          data: JSON.stringify({ booking_id: bookingId, chat: true }),
        })
      }
    }
    setSending(false)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function formatTime(ts) {
    const d = new Date(ts)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    if (isToday) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  function groupMessages(msgs) {
    const groups = []
    let lastDate = ''
    msgs.forEach(m => {
      const d = new Date(m.created_at).toDateString()
      if (d !== lastDate) {
        groups.push({ type: 'date', label: d === new Date().toDateString() ? 'Today' : new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' }) })
        lastDate = d
      }
      groups.push({ type: 'msg', ...m })
    })
    return groups
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
      Loading chat...
    </div>
  )

  const ride = booking?.rides
  const isCancelled = booking?.status === 'cancelled'
  const grouped = groupMessages(messages)

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', color: '#fff' }}>

      {/* Header */}
      <div style={{ background: '#111', padding: '16px', borderBottom: '1px solid #1a1a1a', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer', padding: '0 4px' }}>←</button>

          <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#222', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#facc15', fontSize: 16 }}>
            {otherUser?.avatar_url
              ? <img src={otherUser.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : otherUser?.full_name?.[0]?.toUpperCase() || '?'}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{otherUser?.full_name || 'Unknown'}</div>
            <div style={{ color: '#555', fontSize: 11, marginTop: 1 }}>
              {ride?.from_location} → {ride?.to_location} · {ride?.ride_date}
            </div>
          </div>

          {otherUser?.phone && (
            <a href={`tel:${otherUser.phone}`} style={{ background: '#1a1a1a', border: '1px solid #222', color: '#4ade80', padding: '8px 12px', borderRadius: 10, fontSize: 18, textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              📞
            </a>
          )}
        </div>

        {/* Ride info bar */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <span style={{ background: '#1a1a1a', border: '1px solid #222', padding: '4px 10px', borderRadius: 20, fontSize: 11, color: '#888' }}>
            🚗 {ride?.fare ? `₹${ride.fare}/seat` : '—'}
          </span>
          <span style={{ background: isCancelled ? '#3b0000' : '#052e16', border: `1px solid ${isCancelled ? '#7f1d1d' : '#166534'}`, padding: '4px 10px', borderRadius: 20, fontSize: 11, color: isCancelled ? '#f87171' : '#4ade80' }}>
            ● {booking?.status}
          </span>
          {isCancelled && (
            <span style={{ background: '#1a1a1a', padding: '4px 10px', borderRadius: 20, fontSize: 11, color: '#666' }}>
              Chat read-only
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {grouped.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#333', textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
            <div style={{ fontWeight: 700, color: '#555', marginBottom: 8 }}>No messages yet</div>
            <div style={{ fontSize: 13, color: '#444', lineHeight: 1.6 }}>
              Say hi to {otherUser?.full_name?.split(' ')[0] || 'your co-rider'}!<br/>
              Coordinate pickup point, timing, etc.
            </div>
          </div>
        )}

        {grouped.map((item, i) => {
          if (item.type === 'date') return (
            <div key={`date-${i}`} style={{ textAlign: 'center', margin: '12px 0 8px' }}>
              <span style={{ background: '#1a1a1a', color: '#555', fontSize: 11, padding: '4px 12px', borderRadius: 10 }}>{item.label}</span>
            </div>
          )

          const isMine = item.sender_id === user.id
          return (
            <div key={item.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 2 }}>
              <div style={{
                maxWidth: '75%',
                background: isMine ? '#facc15' : '#1a1a1a',
                color: isMine ? '#111' : '#fff',
                borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                padding: '10px 14px',
                fontSize: 14,
                lineHeight: 1.5,
                wordBreak: 'break-word',
              }}>
                <div>{item.text}</div>
                <div style={{ fontSize: 10, color: isMine ? '#92400e' : '#555', marginTop: 4, textAlign: 'right' }}>
                  {formatTime(item.created_at)}
                  {isMine && <span style={{ marginLeft: 4 }}>{item.read ? '✓✓' : '✓'}</span>}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      {!isCancelled && messages.length === 0 && (
        <div style={{ padding: '8px 12px', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
          {[
            '👋 Hi! I booked your ride',
            '📍 What\'s the exact pickup?',
            '🕐 Running 5 mins late',
            '✅ I\'m here!',
            '🙏 Thanks for the ride!',
          ].map(q => (
            <button key={q} onClick={() => { setText(q); inputRef.current?.focus() }} style={{
              background: '#1a1a1a', border: '1px solid #222', color: '#ccc', padding: '8px 12px',
              borderRadius: 20, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}>{q}</button>
          ))}
        </div>
      )}

      {/* Input */}
      {!isCancelled ? (
        <div style={{ background: '#111', borderTop: '1px solid #1a1a1a', padding: '12px', flexShrink: 0, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
            placeholder="Type a message..."
            rows={1}
            style={{
              flex: 1, background: '#1a1a1a', border: '1px solid #222', color: '#fff',
              borderRadius: 22, padding: '10px 16px', fontSize: 14, resize: 'none',
              outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120,
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
              width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: text.trim() ? '#facc15' : '#1a1a1a',
              color: text.trim() ? '#111' : '#444',
              fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: '0.2s',
            }}
          >
            {sending ? '⏳' : '➤'}
          </button>
        </div>
      ) : (
        <div style={{ background: '#111', borderTop: '1px solid #1a1a1a', padding: '16px', textAlign: 'center', color: '#555', fontSize: 13, flexShrink: 0 }}>
          This ride was cancelled. Chat is read-only.
        </div>
      )}
    </div>
  )
}
