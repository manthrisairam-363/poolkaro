import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import LocationInput from '../components/LocationInput'

const inp = {
  width: '100%', padding: '11px 14px',
  border: '1px solid #2a2a2a', borderRadius: 10,
  fontSize: 14, background: '#161616',
  fontFamily: 'inherit', boxSizing: 'border-box',
}
const label = { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5, display: 'block' }

export default function EditRide() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [ride, setRide] = useState(null)
  const [bookingCount, setBookingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [form, setForm] = useState({
    ride_type: 'to_office',
    ride_date: '',
    ride_time: '',
    from_location: '',
    to_location: '',
    route_description: '',
    fare: '',
    seats_available: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => { fetchRide() }, [id])

  async function fetchRide() {
    const { data: rideData } = await supabase
      .from('rides').select('*').eq('id', id).maybeSingle()

    if (!rideData || rideData.driver_id !== user.id) {
      navigate('/my-rides')
      return
    }

    // Count active bookings
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('ride_id', id)
      .eq('status', 'confirmed')

    setRide(rideData)
    setBookingCount(count || 0)
    setForm({
      ride_type: rideData.ride_type,
      ride_date: rideData.ride_date,
      ride_time: rideData.ride_time?.slice(0, 5),
      from_location: rideData.from_location,
      to_location: rideData.to_location,
      route_description: rideData.route_description || '',
      fare: String(rideData.fare),
      seats_available: String(rideData.seats_available),
    })
    setLoading(false)
  }

  async function saveChanges() {
    setError(''); setSaving(true)

    const updates = { ride_time: form.ride_time }

    // If no bookings — allow full edit
    if (bookingCount === 0) {
      Object.assign(updates, {
        ride_type: form.ride_type,
        ride_date: form.ride_date,
        from_location: form.from_location,
        to_location: form.to_location,
        route_description: form.route_description || null,
        fare: Number(form.fare),
        seats_available: Number(form.seats_available),
        seats_total: Number(form.seats_available),
      })
    }

    const { error: err } = await supabase
      .from('rides').update(updates).eq('id', id)

    if (err) { setError(err.message); setSaving(false); return }

    // Notify co-riders if ride has bookings
    if (bookingCount > 0) {
      const { data: bookings } = await supabase
        .from('bookings').select('rider_id').eq('ride_id', id).eq('status', 'confirmed')

      if (bookings?.length > 0) {
        const notifications = bookings.map(b => ({
          user_id: b.rider_id,
          title: '🔔 Ride Updated',
          message: `${ride.from_location} → ${ride.to_location} time changed to ${form.ride_time}`,
          type: 'booking',
          ride_id: id,
        }))
        await supabase.from('notifications').insert(notifications)
      }
    }

    setSaving(false)
    setSuccess('Ride updated successfully! ✅')
    setTimeout(() => navigate('/my-rides'), 1500)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', color: '#aaa' }}>
        <div style={{ fontSize: 32 }}>🚗</div>
        <div style={{ marginTop: 8 }}>Loading...</div>
      </div>
    </div>
  )

  const hasBookings = bookingCount > 0
  const today = new Date().toISOString().split('T')[0]

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: '#111', padding: '20px 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/my-rides')}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>✏️ Edit Ride</div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 1 }}>
            {ride?.from_location} → {ride?.to_location}
          </div>
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Booking warning */}
        {hasBookings && (
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#c2410c', marginBottom: 4 }}>
              ⚠️ {bookingCount} co-rider{bookingCount > 1 ? 's have' : ' has'} booked this ride
            </div>
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
              Only <strong>ride time</strong> can be changed now. Co-rider{bookingCount > 1 ? 's' : ''} will be notified automatically. To change other details, cancel this ride and post a new one.
            </div>
          </div>
        )}

        {success && (
          <div style={{ background: '#f0fdf4', color: '#16a34a', padding: '12px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
            {success}
          </div>
        )}
        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>

          {/* Ride type — locked if bookings */}
          {!hasBookings && (
            <>
              <div style={label}>Ride Direction</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {[['to_office', '🏢 To Office'], ['to_home', '🏠 To Home']].map(([v, l]) => (
                  <button key={v} onClick={() => set('ride_type', v)} style={{
                    flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${form.ride_type === v ? '#111' : '#e5e7eb'}`,
                    background: form.ride_type === v ? '#111' : '#fff',
                    color: form.ride_type === v ? '#fff' : '#666',
                    fontWeight: form.ride_type === v ? 700 : 400, fontSize: 13,
                  }}>{l}</button>
                ))}
              </div>
            </>
          )}

          {/* Date — locked if bookings */}
          {!hasBookings && (
            <div style={{ marginBottom: 14 }}>
              <span style={label}>Date</span>
              <input style={inp} type="date" min={today}
                value={form.ride_date} onChange={e => set('ride_date', e.target.value)} />
            </div>
          )}

          {/* Time — always editable */}
          <div style={{ marginBottom: 16 }}>
            <span style={label}>
              Ride Time {hasBookings && <span style={{ color: '#16a34a', fontWeight: 400 }}>(only this can be changed)</span>}
            </span>
            <input style={{ ...inp, border: '2px solid #111' }} type="time"
              value={form.ride_time} onChange={e => set('ride_time', e.target.value)} />
          </div>

          {/* Location — locked if bookings */}
          {!hasBookings && (
            <>
              <LocationInput label="From" value={form.from_location}
                onChange={v => set('from_location', v)} placeholder="Starting point" />
              <LocationInput label="To" value={form.to_location}
                onChange={v => set('to_location', v)} placeholder="Destination" />
              <div style={{ marginBottom: 14 }}>
                <span style={label}>Route (via locations)</span>
                <input style={inp} placeholder="Uppal → Nagole → LB Nagar"
                  value={form.route_description} onChange={e => set('route_description', e.target.value)} />
              </div>
            </>
          )}

          {/* Fare & Seats — locked if bookings */}
          {!hasBookings && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div>
                <span style={label}>Fare (₹)</span>
                <input style={inp} type="number" value={form.fare}
                  onChange={e => set('fare', e.target.value)} />
              </div>
              <div>
                <span style={label}>Seats</span>
                <select style={inp} value={form.seats_available}
                  onChange={e => set('seats_available', e.target.value)}>
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} seat{n > 1 ? 's' : ''}</option>)}
                </select>
              </div>
            </div>
          )}

          <button onClick={saveChanges} disabled={saving} style={{
            width: '100%', padding: 14, background: '#111', color: '#fff',
            border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>
            {saving ? 'Saving...' : '💾 Save Changes'}
          </button>
        </div>

        {/* Recurring rides coming soon */}
        <div style={{ background: '#1a1a1a', borderRadius: 16, padding: 16, marginTop: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>🔁 Recurring Rides</div>
          <div style={{ color: '#888', fontSize: 13, lineHeight: 1.6 }}>
            Post once for your daily commute (Mon–Fri). Coming soon — this will save you from posting every day!
          </div>
          <div style={{ marginTop: 8, background: '#f0f4ff', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#2563eb', fontWeight: 600 }}>
            🔜 Coming in next update
          </div>
        </div>
      </div>
    </div>
  )
}
