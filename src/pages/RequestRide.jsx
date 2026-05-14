import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'
import LocationInput from '../components/LocationInput'

const inp = { width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 14, background: '#fafafa', fontFamily: 'inherit', boxSizing: 'border-box' }
const label = { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5, display: 'block' }

export default function RequestRide() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [form, setForm] = useState({
    from_location: '', to_location: '',
    ride_date: today, ride_time: '',
    seats_needed: '1', note: '',
  })
  const [existingId, setExistingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [posted, setPosted] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Load existing active request to pre-fill for editing
  useEffect(() => {
    async function loadExisting() {
      const istOffset = 5.5 * 60 * 60 * 1000
      const todayIST = new Date(Date.now() + istOffset).toISOString().split('T')[0]
      const { data } = await supabase.from('ride_requests')
        .select('*').eq('rider_id', user.id).eq('status', 'active')
        .gte('ride_date', todayIST).maybeSingle()
      if (data) {
        setExistingId(data.id)
        setForm({
          from_location: data.from_location,
          to_location: data.to_location,
          ride_date: data.ride_date,
          ride_time: data.ride_time || '',
          seats_needed: String(data.seats_needed || 1),
          note: data.note || '',
        })
      }
    }
    loadExisting()
  }, [])

  async function postRequest() {
    setError('')
    if (!form.from_location || !form.to_location || !form.ride_date) {
      setError('Please fill From, To and Date')
      return
    }
    if (form.ride_date < today) {
      setError('Cannot request rides for past dates')
      return
    }
    setLoading(true)

    const payload = {
      from_location: form.from_location,
      to_location: form.to_location,
      ride_date: form.ride_date,
      ride_time: form.ride_time || null,
      seats_needed: Number(form.seats_needed),
      note: form.note || null,
      status: 'active',
    }

    if (existingId) {
      // Update existing request
      const { error: err } = await supabase.from('ride_requests')
        .update(payload).eq('id', existingId)
      setLoading(false)
      if (err) { setError(err.message); return }
    } else {
      // Cancel old ones + insert new
      await supabase.from('ride_requests')
        .update({ status: 'cancelled' })
        .eq('rider_id', user.id).eq('status', 'active')
      const { error: err } = await supabase.from('ride_requests')
        .insert({ ...payload, rider_id: user.id })
      setLoading(false)
      if (err) { setError(err.message); return }
    }
    setPosted(true)
  }

  if (posted) return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', paddingBottom: 90 }}>
      <div style={{ background: '#111', padding: '20px 16px' }}>
        <div style={{ color: '#facc15', fontWeight: 800, fontSize: 20 }}>🙋 Request Posted!</div>
        <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>Car owners can now see your request</div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Looking for a ride from</div>
          <div style={{ color: '#2563eb', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{form.from_location}</div>
          <div style={{ color: '#888', fontSize: 13, marginBottom: 4 }}>→</div>
          <div style={{ color: '#2563eb', fontWeight: 600, fontSize: 15, marginBottom: 12 }}>{form.to_location}</div>
          <div style={{ background: '#f8f9fa', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#555' }}>
            Car owners on your route will see your request on the home screen.
          </div>
        </div>
        <button onClick={() => navigate('/')} style={{ width: '100%', padding: 14, background: '#111', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
          🔍 Browse Matching Rides
        </button>
        <button onClick={() => { setPosted(false); setForm({ from_location: '', to_location: '', ride_date: today, ride_time: '', seats_needed: '1', note: '' }) }}
          style={{ width: '100%', padding: 12, background: '#f5f5f5', color: '#555', border: 'none', borderRadius: 12, fontSize: 14, cursor: 'pointer' }}>
          Post Another Request
        </button>
      </div>
      <BottomNav />
    </div>
  )

  return (
    <div style={{ background: '#f5f6fa', minHeight: '100vh', paddingBottom: 90 }}>
      {/* Header with tab switcher */}
      <div style={{ background: '#111', padding: '20px 16px 16px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <button onClick={() => navigate('/post')} style={{
            flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: 'transparent', border: '1.5px solid #333', color: '#888',
          }}>🚗 Post a Ride</button>
          <button style={{
            flex: 1, padding: 10, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
            background: '#facc15', border: '1.5px solid #facc15', color: '#111',
          }}>🙋 Need a Ride</button>
        </div>
        <div style={{ color: '#666', fontSize: 11, marginTop: 6 }}>{existingId ? 'Update your ride request' : 'Tell car owners where you need to go'}</div>
      </div>

      <div style={{ padding: 16 }}>
        {error && (
          <div style={{ background: '#fef2f2', color: '#dc2626', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <LocationInput
          label="From (your pickup area) *"
          value={form.from_location}
          onChange={v => set('from_location', v)}
          placeholder="e.g. Uppal, Nagole"
        />

        <LocationInput
          label="To (your destination) *"
          value={form.to_location}
          onChange={v => set('to_location', v)}
          placeholder="e.g. HITEC City, GAR Kokapet"
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <span style={label}>Date *</span>
            <input style={inp} type="date" min={today} value={form.ride_date}
              onChange={e => set('ride_date', e.target.value)} />
          </div>
          <div>
            <span style={label}>Time (optional)</span>
            <input style={inp} type="time" value={form.ride_time}
              onChange={e => set('ride_time', e.target.value)} />
          </div>
        </div>

        <span style={label}>Seats Needed</span>
        <select style={{ ...inp, marginBottom: 14 }} value={form.seats_needed} onChange={e => set('seats_needed', e.target.value)}>
          {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} seat{n > 1 ? 's' : ''}</option>)}
        </select>

        <span style={label}>Note (optional)</span>
        <input style={{ ...inp, marginBottom: 20 }}
          placeholder="e.g. flexible on time, can wait at metro"
          value={form.note}
          onChange={e => set('note', e.target.value)}
        />

        <button onClick={postRequest} disabled={loading} style={{
          width: '100%', padding: 14, background: '#111', color: '#fff',
          border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>
          {loading ? 'Saving...' : existingId ? '✏️ Update My Request' : '🙋 Post My Ride Request'}
        </button>

        <div style={{ marginTop: 12, background: '#f0f4ff', borderRadius: 10, padding: '12px 14px', fontSize: 12, color: '#2563eb' }}>
          💡 Car owners will see your request on the home screen. Only 1 active request allowed at a time.
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
