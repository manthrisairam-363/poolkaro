import { useState } from 'react'
import { formatTime } from '../lib/utils'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'
import LocationInput from '../components/LocationInput'

const inp = { width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, background: '#fafafa', fontFamily: 'inherit', boxSizing: 'border-box' }
const label = { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5, display: 'block' }

export default function PostRide() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [form, setForm] = useState({
    ride_type: 'to_office', ride_date: today, ride_time: '',
    from_location: '', to_location: '', route_description: '',
    fare: '', seats_available: '2', recurring: 'once',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [posted, setPosted] = useState(false)
  const [waMessage, setWaMessage] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function generateWhatsApp() {
    const dateStr = new Date(form.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const timeStr = formatTime(form.ride_time)
    return `🚗 Carpool Available – ${dateStr}

🕘 Ride Time: ${timeStr}
👤 Name: ${profile?.full_name}
🚘 Vehicle: ${profile?.vehicle_model} (${profile?.vehicle_number})

📍 From: ${form.from_location}
📍 To: ${form.to_location}
${form.route_description ? `🛣️ Route: ${form.route_description}\n` : ''}
💰 Fare: ₹${form.fare} per seat
💺 Seats Available: ${form.seats_available}

📞 Contact: ${profile?.phone}
🔗 Book on CarpoolKaro: https://app.carpoolkaro.com`
  }

  async function postRide() {
    setError('')
    if (!form.ride_time || !form.from_location || !form.to_location || !form.fare) {
      setError('Please fill all required fields')
      return
    }
    if (form.from_location.trim().toLowerCase() === form.to_location.trim().toLowerCase()) {
      setError('Starting point and destination cannot be the same')
      return
    }
    const fareNum = Number(form.fare)
    if (fareNum < 10) { setError('Minimum fare is ₹10'); return }
    if (fareNum > 500) { setError('Maximum fare is ₹500 per seat'); return }
    if (form.ride_date < today) { setError('Cannot post rides for past dates'); return }
    if (!profile?.vehicle_model) {
      setError('Please add your vehicle details in Profile first')
      return
    }
    // Check wallet balance (single ride needs ₹2 minimum for first booking)
    const { data: walletData } = await supabase
      .from('wallets').select('balance').eq('user_id', user.id).maybeSingle()
    const balance = walletData?.balance || 0
    if (balance < 200) {
      setError('Insufficient wallet balance. Add minimum ₹2 to your wallet first — it will be deducted when someone books your ride.')
      return
    }
    // Warn for recurring rides with low balance
    const seats = Number(form.seats_available)
    const estimatedBookings = form.recurring === 'once' ? seats : seats * (form.recurring === 'weekdays' ? 20 : 28)
    const estimatedCost = estimatedBookings * 200 // ₹2 per booking in paise
    if (form.recurring !== 'once' && balance < estimatedCost) {
      const canCover = Math.floor(balance / 200)
      setError(`⚠️ Low balance: ₹${balance/100} covers ~${canCover} bookings. Top up wallet to ensure all bookings go through. Proceeding anyway...`)
      // Don't return — let them post but warn
    }
    setLoading(true)
    // Build list of dates to post
    const dates = []
    const start = new Date(form.ride_date)
    const days = form.recurring === 'once' ? 1 : 28
    for (let i = 0; i < days; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const dow = d.getDay()
      if (form.recurring === 'weekdays' && (dow === 0 || dow === 6)) continue
      dates.push(d.toISOString().split('T')[0])
    }
    const rideBase = {
      driver_id: user.id, ride_type: form.ride_type, ride_time: form.ride_time,
      from_location: form.from_location, to_location: form.to_location,
      route_description: form.route_description || null,
      fare: Number(form.fare), seats_available: Number(form.seats_available),
      seats_total: Number(form.seats_available),
      vehicle_model: profile.vehicle_model, vehicle_number: profile.vehicle_number,
      status: 'active', is_recurring: form.recurring !== 'once',
      city: profile?.city || 'Hyderabad',
    }
    const rideObjects = dates.map(date => ({ ...rideBase, ride_date: date }))
    const { error: err } = await supabase.from('rides').insert(rideObjects)
    setLoading(false)
    if (err) { setError(err.message); return }
    const ridesPosted = form.recurring === 'once' ? 1 : form.recurring === 'weekdays' ? 20 : 28
    setWaMessage(generateWhatsApp() + (form.recurring !== 'once' ? `
🔁 Recurring: ${form.recurring === 'weekdays' ? 'Mon-Fri' : 'Daily'} for 4 weeks (${ridesPosted} rides posted)` : ''))
    setPosted(true)
  }

  if (posted) return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', paddingBottom: 90 }}>
      <div style={{ background: '#111', padding: '20px 16px' }}>
        <div style={{ color: '#facc15', fontWeight: 800, fontSize: 20 }}>🎉 Ride Posted!</div>
        <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>Share it in your WhatsApp group</div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#888', marginBottom: 10 }}>WHATSAPP MESSAGE READY</div>
          <pre style={{ fontSize: 12, color: '#333', whiteSpace: 'pre-wrap', lineHeight: 1.8, fontFamily: 'inherit', background: '#f8f9fa', padding: 12, borderRadius: 8 }}>
            {waMessage}
          </pre>
        </div>
        <a href={`https://wa.me/?text=${encodeURIComponent(waMessage)}`} target="_blank" rel="noreferrer"
          style={{ display: 'block', width: '100%', background: '#25D366', color: '#fff', borderRadius: 12, padding: 14, fontSize: 15, fontWeight: 700, textAlign: 'center', textDecoration: 'none', marginBottom: 10 }}>
          💬 Share to WhatsApp Group
        </a>
        <button onClick={() => navigate('/')} style={{ width: '100%', padding: 13, background: '#111', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          ← Back to Rides
        </button>
      </div>
      <BottomNav />
    </div>
  )

  return (
    <div style={{ background: '#f5f6fa', minHeight: '100vh', paddingBottom: 90 }}>
      <div style={{ background: '#111', padding: '20px 16px 16px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <button style={{
            flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
            background: '#facc15', border: '1.5px solid #facc15', color: '#111',
          }}>🚗 Post a Ride</button>
          <button onClick={() => navigate('/request')} style={{
            flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: 'transparent', border: '1.5px solid #333', color: '#888',
          }}>🙋 Need a Ride</button>
        </div>
        <div style={{ color: '#666', fontSize: 11, marginTop: 6 }}>Share your route, earn from empty seats</div>
      </div>

      <div style={{ padding: 16 }}>
        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{error}</div>}

        {!profile?.vehicle_model && (
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: '#c2410c', fontWeight: 600 }}>⚠️ Vehicle details missing</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Please add your vehicle in Profile before posting</div>
            <button onClick={() => navigate('/profile')} style={{ marginTop: 8, padding: '6px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Go to Profile →
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['to_office','🏢 To Office'],['to_home','🏠 To Home']].map(([v,l]) => (
            <button key={v} onClick={() => set('ride_type', v)} style={{
              flex: 1, padding: 12, borderRadius: 10, cursor: 'pointer',
              border: `2px solid ${form.ride_type === v ? '#111' : '#e5e7eb'}`,
              background: form.ride_type === v ? '#111' : '#fff',
              color: form.ride_type === v ? '#fff' : '#666',
              fontWeight: form.ride_type === v ? 700 : 400, fontSize: 13,
            }}>{l}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <span style={label}>Date *</span>
            <input style={inp} type="date" min={today} value={form.ride_date} onChange={e => set('ride_date', e.target.value)} />
          </div>
          <div>
            <span style={label}>Time *</span>
            <input style={inp} type="time" value={form.ride_time} onChange={e => set('ride_time', e.target.value)} />
          </div>
        </div>

        <LocationInput label="From (Starting point) *" value={form.from_location} onChange={v => set('from_location', v)} placeholder="e.g. Uppal Ring Road" city={profile?.city} />

        {/* Swap button */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '-6px 0', position: 'relative', zIndex: 10 }}>
          <button
            type="button"
            onClick={() => {
              const temp = form.from_location
              set('from_location', form.to_location)
              set('to_location', temp)
            }}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#facc15', border: '3px solid #fff',
              cursor: 'pointer', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              transition: '0.2s',
            }}
            title="Swap from and to"
          >⇅</button>
        </div>

        <LocationInput label="To (Destination) *" value={form.to_location} onChange={v => set('to_location', v)} placeholder="e.g. GAR Kokapet, Financial District" city={profile?.city} />

        <span style={label}>Route via (optional)</span>
        <input style={{ ...inp, marginBottom: 14 }} placeholder="Uppal → Nagole → LB Nagar → Kokapet" value={form.route_description} onChange={e => set('route_description', e.target.value)} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <span style={label}>Fare per seat (₹) *</span>
            <input style={inp} type="number" placeholder="150" value={form.fare} onChange={e => set('fare', e.target.value)} />
          </div>
          <div>
            <span style={label}>Seats Available</span>
            <select style={inp} value={form.seats_available} onChange={e => set('seats_available', e.target.value)}>
              {[1,2,3,4].map(n => <option key={n} value={n}>{n} seat{n>1?'s':''}</option>)}
            </select>
          </div>
        </div>

        {form.fare && Number(form.fare) > 0 && (
          <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '12px 14px', marginBottom: 16, border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, marginBottom: 4 }}>💰 Your Earnings</div>
            <div style={{ fontSize: 13 }}>
              {form.seats_available} seats × ₹{form.fare} = <strong>₹{form.seats_available * form.fare}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>CarpoolKaro deducts ₹2 per confirmed booking from wallet balance</div>
          </div>
        )}

        {/* Recurring */}
        <div style={{ marginBottom: 16 }}>
          <span style={label}>🔁 Repeat This Ride</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[['once','One Time'],['weekdays','Mon–Fri'],['daily','Every Day']].map(([v,l]) => (
              <button key={v} onClick={() => set('recurring', v)} style={{
                padding: '10px 4px', borderRadius: 10, cursor: 'pointer', fontSize: 12,
                border: `2px solid ${form.recurring === v ? '#111' : '#e5e7eb'}`,
                background: form.recurring === v ? '#111' : '#fff',
                color: form.recurring === v ? '#fff' : '#666',
                fontWeight: form.recurring === v ? 700 : 400,
              }}>{l}</button>
            ))}
          </div>
          {form.recurring !== 'once' && (
            <div style={{ marginTop: 8, background: '#f0f4ff', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#2563eb' }}>
              📅 Posts rides for next 4 weeks automatically. You can cancel individual days from My Rides.
            </div>
          )}
        </div>

        <button onClick={postRide} disabled={loading} style={{ width: '100%', padding: 14, background: '#111', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          {loading ? 'Posting...' : form.recurring !== 'once' ? '🔁 Post Recurring Ride' : '🚗 Post Ride'}
        </button>
      </div>
      <BottomNav />
    </div>
  )
}
