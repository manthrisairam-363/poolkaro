import { useState, useRef, useEffect } from 'react'
import { formatTime } from '../lib/utils'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'
import LocationInput from '../components/LocationInput'
import { findRideConflicts, conflictMessage, fmtDate } from '../lib/rideConflict'

const inp = { width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, background: '#fafafa', fontFamily: 'inherit', boxSizing: 'border-box' }
const label = { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5, display: 'block' }
const errInp = { ...inp, border: '2px solid #dc2626', background: '#fef2f2' }
const errText = { fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 4 }

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

  const [lastRide, setLastRide] = useState(null)

  // Fetch the driver's most recent ride, but DON'T auto-fill the boxes — instead
  // offer it as a tappable suggestion so the user consciously chooses it rather
  // than accidentally re-posting a pre-filled route.
  useEffect(() => {
    if (!user?.id) return
    supabase.from('rides')
      .select('from_location, to_location, route_description, fare, ride_type')
      .eq('driver_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setLastRide(data) })
  }, [user?.id])

  function useLastRoute() {
    if (!lastRide) return
    setForm(f => ({
      ...f,
      from_location: lastRide.from_location || '',
      to_location: lastRide.to_location || '',
      route_description: lastRide.route_description || '',
      fare: lastRide.fare ? String(lastRide.fare) : '',
      ride_type: lastRide.ride_type || f.ride_type,
    }))
    setLastRide(null) // hide the chip once used
  }
  const [posted, setPosted] = useState(false)
  const [waMessage, setWaMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  // Refs so we can scroll + focus the first missing field
  const timeRef = useRef(null)
  const fromRef = useRef(null)
  const toRef = useRef(null)
  const fareRef = useRef(null)

  // Clear a field's error as soon as the user fills it
  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }))
    if (v) setFieldErrors(e => (e[k] ? { ...e, [k]: false } : e))
  }

  function focusField(ref) {
    if (!ref?.current) return
    ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => ref.current?.focus(), 300)
  }

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

🔗 Book on CarpoolKaro: https://app.carpoolkaro.com`
  }

  async function postRide() {
    setError('')

    // ── Highlight EVERY missing mandatory field, focus the first one ──
    const missing = {
      ride_time: !form.ride_time,
      from_location: !form.from_location,
      to_location: !form.to_location,
      fare: !form.fare,
    }
    setFieldErrors(missing)
    const firstMissing = Object.entries(missing).find(([, v]) => v)?.[0]
    if (firstMissing) {
      setError('Please fill the highlighted field(s) below')
      focusField({ ride_time: timeRef, from_location: fromRef, to_location: toRef, fare: fareRef }[firstMissing])
      return
    }

    if (form.from_location.trim().toLowerCase() === form.to_location.trim().toLowerCase()) {
      setError('Starting point and destination cannot be the same')
      setFieldErrors({ to_location: true })
      focusField(toRef)
      return
    }
    const fareNum = Number(form.fare)
    if (fareNum < 10) { setError('Minimum fare is ₹10'); setFieldErrors({ fare: true }); focusField(fareRef); return }
    if (fareNum > 500) { setError('Maximum fare is ₹500 per seat'); setFieldErrors({ fare: true }); focusField(fareRef); return }
    if (form.ride_date < today) { setError('Cannot post rides for past dates'); return }
    // If the ride is TODAY, the time must still be in the future. Compare in IST.
    if (form.ride_date === today && form.ride_time) {
      const nowIST = new Date(Date.now() + 5.5 * 3600000)
      const [hh, mm] = form.ride_time.split(':').map(Number)
      const rideMinutes = hh * 60 + mm
      const nowMinutes = nowIST.getUTCHours() * 60 + nowIST.getUTCMinutes()
      if (rideMinutes <= nowMinutes) {
        setError('That time has already passed today. Pick a later time or a future date.')
        setFieldErrors({ ride_time: true })
        focusField(timeRef)
        return
      }
    }
    if (!profile?.vehicle_model) {
      setError('Please add your vehicle details in Profile first')
      return
    }

    // ── Wallet check: ₹2 per seat. Pro subscribers pay ₹0, so they're exempt ──
    const isPro = profile?.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date()
    const seats = Number(form.seats_available)
    if (!isPro) {
      const { data: walletData } = await supabase
        .from('wallets').select('balance').eq('user_id', user.id).maybeSingle()
      const balance = walletData?.balance || 0
      const requiredPaise = seats * 200   // ₹2 per seat, in paise

      if (balance < requiredPaise) {
        alert(
          `⚠️ Insufficient wallet balance\n\n` +
          `You're posting ${seats} seat${seats > 1 ? 's' : ''}, which needs ₹${requiredPaise / 100} ` +
          `(₹2 per seat, deducted only when someone books).\n\n` +
          `Your balance: ₹${balance / 100}\n\n` +
          `Please recharge your wallet and try again.`
        )
        setError(`Insufficient balance. You need ₹${requiredPaise / 100} for ${seats} seat${seats > 1 ? 's' : ''}. Your balance is ₹${balance / 100}.`)
        setLoading(false)
        return
      }

      // Recurring (Mon–Fri): require the FULL week's fees up front, so the
      // driver can't get every seat booked and go negative. Free users must
      // fund it; Pro users skip all fees — so this doubles as a Pro nudge.
      if (form.recurring !== 'once') {
        const totalDays = form.recurring === 'weekdays' ? 5 : 7
        const fullCost = seats * 200 * totalDays
        if (balance < fullCost) {
          alert(
            `⚠️ Not enough balance for a weekly post\n\n` +
            `Posting ${totalDays} days × ${seats} seat${seats > 1 ? 's' : ''} can cost up to ₹${fullCost / 100} in platform fees (₹2 per booked seat).\n\n` +
            `Your balance: ₹${balance / 100}\n\n` +
            `Please recharge to ₹${fullCost / 100}, or get CarpoolKaro Pro to post unlimited rides with zero fees.`
          )
          setError(`For a ${totalDays}-day post you need ₹${fullCost / 100} (or go Pro for unlimited posting). Your balance is ₹${balance / 100}.`)
          setLoading(false)
          return
        }
      }
    }

    setLoading(true)
    // Build list of dates to post — ONE WEEK max
    const dates = []
    const start = new Date(form.ride_date)
    const days = form.recurring === 'once' ? 1 : 7
    for (let i = 0; i < days; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const dow = d.getDay()
      if (form.recurring === 'weekdays' && (dow === 0 || dow === 6)) continue
      dates.push(d.toISOString().split('T')[0])
    }
    // ── Conflict check: one driver, one car, one place at a time ──
    // Blocks repeating the same ride AND posting a different route at a
    // clashing time. Shared with EditRide so both screens agree.
    const conflicts = await findRideConflicts({
      supabase,
      driverId: user.id,
      dates,
      time: form.ride_time,
      from: form.from_location,
      to: form.to_location,
    })

    if (conflicts.length > 0) {
      const clashDates = new Set(conflicts.map(c => c.ride_date))
      const remaining = dates.filter(d => !clashDates.has(d))

      if (remaining.length === 0) {
        alert(conflictMessage(conflicts[0]))
        setError(
          conflicts[0].sameRoute
            ? 'This ride is already posted. Edit it from My Rides instead.'
            : 'You already have a ride at this time.'
        )
        setLoading(false)
        return
      }

      const ok = confirm(
        `⚠️ You already have rides on ${clashDates.size} of these dates\n\n` +
        `Clashing: ${[...clashDates].map(fmtDate).join(', ')}\n\n` +
        `Post only the remaining ${remaining.length} date${remaining.length > 1 ? 's' : ''}?`
      )
      if (!ok) { setLoading(false); return }
      dates.length = 0
      dates.push(...remaining)
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
    const ridesPosted = dates.length
    setWaMessage(generateWhatsApp() + (form.recurring !== 'once' ? `
🔁 Recurring: ${form.recurring === 'weekdays' ? 'Mon-Fri' : 'Daily'} for 1 week (${ridesPosted} rides posted)` : ''))
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
            <input ref={timeRef} style={fieldErrors.ride_time ? errInp : inp} type="time" value={form.ride_time} onChange={e => set('ride_time', e.target.value)} />
            {fieldErrors.ride_time && <div style={errText}>⚠️ Required</div>}
          </div>
        </div>

        {/* Tappable suggestion of the driver's last route — they CHOOSE to use
            it rather than it silently pre-filling the boxes. */}
        {lastRide && (
          <button type="button" onClick={useLastRoute}
            style={{ width: '100%', marginBottom: 12, padding: '10px 12px', background: '#faf5ff', border: '1px dashed #d8b4fe', borderRadius: 10, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>↩️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700 }}>Use your last route</div>
              <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lastRide.from_location} → {lastRide.to_location} · ₹{lastRide.fare}
              </div>
            </div>
            <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700, flexShrink: 0 }}>Tap to fill</span>
          </button>
        )}

        <LocationInput label="From (Starting point) *" value={form.from_location} onChange={v => set('from_location', v)} placeholder="e.g. Uppal Ring Road" city={profile?.city} error={fieldErrors.from_location} inputRef={fromRef} />

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

        <LocationInput label="To (Destination) *" value={form.to_location} onChange={v => set('to_location', v)} placeholder="e.g. GAR Kokapet, Financial District" city={profile?.city} error={fieldErrors.to_location} inputRef={toRef} />

        <span style={label}>Route via (optional)</span>
        <input style={{ ...inp, marginBottom: 14 }} placeholder="Uppal → Nagole → LB Nagar → Kokapet" value={form.route_description} onChange={e => set('route_description', e.target.value)} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <span style={label}>Fare per seat (₹) *</span>
            <input ref={fareRef} style={fieldErrors.fare ? errInp : inp} type="number" placeholder="150" value={form.fare} onChange={e => set('fare', e.target.value)} />
            {fieldErrors.fare && <div style={errText}>⚠️ Required</div>}
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
            {[['once','One Time'],['weekdays','Mon–Fri']].map(([v,l]) => (
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
              📅 Posts rides for the next 1 week automatically. You can cancel individual days from My Rides.
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
