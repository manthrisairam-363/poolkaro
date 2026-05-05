import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'
import LocationInput from '../components/LocationInput'

const inp = {
  width: '100%', padding: '11px 14px',
  border: '1.5px solid #e5e7eb', borderRadius: 10,
  fontSize: 14, background: '#fafafa', marginBottom: 14,
}

export default function PostRide() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    ride_type: 'to_office',
    ride_date: today,
    ride_time: '',
    from_location: '',
    to_location: '',
    route_description: '',
    fare: '',
    seats_available: '2',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-generate WhatsApp message
  function generateWhatsApp() {
    const dateStr = new Date(form.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    return `🚗 Carpool Available – ${dateStr}

🕘 Ride Time: ${form.ride_time}
👤 Owner: ${profile?.full_name}
🚘 Vehicle: ${profile?.vehicle_model} (${profile?.vehicle_number})

📍 From: ${form.from_location}
📍 To: ${form.to_location}
${form.route_description ? `🛣️ Route: ${form.route_description}\n` : ''}
💰 Fare: ₹${form.fare}
🪑 Seats Available: ${form.seats_available}

📞 Contact: ${profile?.phone}
🔗 Book on PoolKaro: poolkaro.app`
  }

  async function postRide() {
    setError('')
    if (!form.ride_time || !form.from_location || !form.to_location || !form.fare) {
      setError('Please fill all required fields')
      return
    }
    if (!profile?.vehicle_model) {
      setError('Please add your vehicle details in Profile first')
      return
    }
    setLoading(true)
    const { error } = await supabase.from('rides').insert({
      driver_id: user.id,
      ride_type: form.ride_type,
      ride_date: form.ride_date,
      ride_time: form.ride_time,
      from_location: form.from_location,
      to_location: form.to_location,
      route_description: form.route_description || null,
      fare: Number(form.fare),
      seats_available: Number(form.seats_available),
      seats_total: Number(form.seats_available),
      vehicle_model: profile.vehicle_model,
      vehicle_number: profile.vehicle_number,
      status: 'active',
    })
    setLoading(false)
    if (error) { setError(error.message); return }

    // Navigate to success + option to share on WhatsApp
    const waMsg = encodeURIComponent(generateWhatsApp())
    navigate('/', { state: { posted: true, waMsg } })
  }

  return (
    <div style={{ paddingBottom: 90 }}>
      {/* Header */}
      <div style={{ background: '#111', padding: '20px 16px 16px' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>🚗 Post a Ride</div>
        <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>Share your route, earn from empty seats</div>
      </div>

      <div style={{ padding: 16 }}>
        {error && <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14 }}>{error}</div>}

        {/* Ride type */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[['to_office', '🏢 To Office'], ['to_home', '🏠 To Home']].map(([v, l]) => (
            <button key={v} onClick={() => set('ride_type', v)} style={{
              flex: 1, padding: 12, borderRadius: 10,
              border: `2px solid ${form.ride_type === v ? '#111' : '#e5e7eb'}`,
              background: form.ride_type === v ? '#111' : '#fff',
              color: form.ride_type === v ? '#fff' : '#666',
              fontWeight: form.ride_type === v ? 700 : 400, fontSize: 13,
            }}>{l}</button>
          ))}
        </div>

        {/* Date & Time */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 0 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5, display: 'block' }}>Date *</label>
            <input style={{ ...inp, marginBottom: 0 }} type="date" min={today} value={form.ride_date} onChange={e => set('ride_date', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5, display: 'block' }}>Time *</label>
            <input style={{ ...inp, marginBottom: 0 }} type="time" value={form.ride_time} onChange={e => set('ride_time', e.target.value)} />
          </div>
        </div>
        <div style={{ height: 14 }} />

        {/* From / To */}
        <LocationInput
          label="From *"
          value={form.from_location}
          onChange={v => set('from_location', v)}
          placeholder="Type area e.g. Uppal, GAR Kokapet..."
        />

        <LocationInput
          label="To *"
          value={form.to_location}
          onChange={v => set('to_location', v)}
          placeholder="Type destination e.g. Kokapet, Madhapur..."
        />

        {/* Route */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5, display: 'block' }}>Route (via locations)</label>
        <input style={inp} placeholder="Uppal → Nagole → LB Nagar → Kokapet" value={form.route_description} onChange={e => set('route_description', e.target.value)} />

        {/* Fare & Seats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5, display: 'block' }}>Fare per seat (₹) *</label>
            <input style={{ ...inp, marginBottom: 0 }} type="number" placeholder="150" value={form.fare} onChange={e => set('fare', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5, display: 'block' }}>Seats Available</label>
            <select style={{ ...inp, marginBottom: 0 }} value={form.seats_available} onChange={e => set('seats_available', e.target.value)}>
              {[1,2,3,4].map(n => <option key={n} value={n}>{n} seat{n > 1 ? 's' : ''}</option>)}
            </select>
          </div>
        </div>
        <div style={{ height: 14 }} />

        {/* Earnings preview */}
        {form.fare && (
          <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '12px 14px', marginBottom: 16, border: '1px solid #bbf7d0' }}>
            <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginBottom: 4 }}>💰 Your Earnings Preview</div>
            <div style={{ fontSize: 13, color: '#333' }}>
              {form.seats_available} seats × ₹{form.fare} = <strong>₹{form.seats_available * form.fare}</strong> per trip<br />
              <span style={{ fontSize: 11, color: '#888' }}>You receive ₹{form.fare - 2} per seat (₹2 PoolKaro fee deducted)</span>
            </div>
          </div>
        )}

        <button onClick={postRide} disabled={loading} style={{
          width: '100%', padding: 14, background: '#111',
          color: '#fff', border: 'none', borderRadius: 12,
          fontSize: 15, fontWeight: 700,
        }}>
          {loading ? 'Posting...' : '🚗 Post Ride'}
        </button>

        {/* WhatsApp share preview */}
        {form.from_location && form.to_location && form.fare && (
          <div style={{ marginTop: 12, background: '#f0fdf4', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginBottom: 8 }}>
              📱 After posting, share to WhatsApp group with one tap!
            </div>
            <div style={{ fontSize: 11, color: '#555', whiteSpace: 'pre-line', background: '#fff', padding: 10, borderRadius: 8 }}>
              {generateWhatsApp()}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
