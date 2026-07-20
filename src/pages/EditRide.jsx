import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import LocationInput from '../components/LocationInput'

const inp = {
  width: '100%', padding: '11px 14px',
  border: '1.5px solid #e5e7eb', borderRadius: 10,
  fontSize: 14, background: '#fafafa',
  fontFamily: 'inherit', boxSizing: 'border-box',
}
const label = { fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 5, display: 'block' }

export default function EditRide() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()

  const [ride, setRide] = useState(null)
  const [bookingCount, setBookingCount] = useState(0)
  const [bookedSeats, setBookedSeats] = useState(0)
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
    // A single booking can hold multiple seats, so derive booked seats from the
    // ride itself rather than counting booking rows.
    const totalSeats = rideData.seats_total ?? rideData.seats_available
    setBookedSeats(Math.max(0, totalSeats - rideData.seats_available))
    setForm({
      ride_type: rideData.ride_type,
      ride_date: rideData.ride_date,
      ride_time: rideData.ride_time?.slice(0, 5),
      from_location: rideData.from_location,
      to_location: rideData.to_location,
      route_description: rideData.route_description || '',
      fare: String(rideData.fare),
      seats_available: String(totalSeats),   // form holds TOTAL seats offered
    })
    setLoading(false)
  }

  async function saveChanges() {
    setError(''); setSaving(true)

    const newTotal = Number(form.seats_available)
    const openSeats = newTotal - bookedSeats          // seats still bookable after this edit
    const prevOpen = ride?.seats_available || 0

    // Can never offer fewer seats than are already booked.
    if (newTotal < bookedSeats) {
      alert(
        `⚠️ Cannot reduce seats\n\n` +
        `${bookedSeats} seat${bookedSeats > 1 ? 's are' : ' is'} already booked.\n` +
        `You can set the total to ${bookedSeats} or more.\n\n` +
        `To free up a booked seat, the co-rider must cancel.`
      )
      setError(`${bookedSeats} seat${bookedSeats > 1 ? 's are' : ' is'} already booked — total cannot be lower.`)
      setSaving(false)
      return
    }

    // Same wallet rule as posting: ₹2 per seat that could still be booked.
    // Only enforced when the driver OPENS UP more seats. Pro pays ₹0.
    if (openSeats > prevOpen) {
      const isPro = profile?.subscription_expires_at && new Date(profile.subscription_expires_at) > new Date()
      if (!isPro) {
        const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle()
        const balance = w?.balance || 0
        if (balance < openSeats * 200) {
          alert(
            `⚠️ Insufficient wallet balance\n\n` +
            `${openSeats} open seat${openSeats > 1 ? 's need' : ' needs'} ₹${openSeats * 2} ` +
            `(₹2 per seat, deducted only when someone books).\n` +
            `Your balance: ₹${balance / 100}\n\n` +
            `Please recharge your wallet and try again.`
          )
          setError(`Insufficient balance. ${openSeats} open seat${openSeats > 1 ? 's need' : ' needs'} ₹${openSeats * 2}, you have ₹${balance / 100}.`)
          setSaving(false)
          return
        }
      }
    }

    const timeChanged = form.ride_time !== ride?.ride_time?.slice(0, 5)
    const seatsChanged = newTotal !== (ride?.seats_total ?? ride?.seats_available)

    // Time and seats can always be changed — even with bookings.
    const updates = {
      ride_time: form.ride_time,
      seats_total: newTotal,
      seats_available: openSeats,
    }
    // Only recompute status for a live ride — never revive a cancelled or
    // completed one by editing it.
    if (ride?.status === 'active' || ride?.status === 'full') {
      updates.status = openSeats === 0 ? 'full' : 'active'
    }

    // Everything else only while nobody has booked
    if (bookingCount === 0) {
      Object.assign(updates, {
        ride_type: form.ride_type,
        ride_date: form.ride_date,
        from_location: form.from_location,
        to_location: form.to_location,
        route_description: form.route_description || null,
        fare: Number(form.fare),
      })
    }

    const { error: err } = await supabase
      .from('rides').update(updates).eq('id', id)

    if (err) { setError(err.message); setSaving(false); return }

    // Notify co-riders only about changes that actually affect them
    if (bookingCount > 0 && timeChanged) {
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
    setSuccess(
      seatsChanged && !timeChanged ? 'Seats updated successfully! ✅'
        : 'Ride updated successfully! ✅'
    )
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
    <div style={{ minHeight: '100vh', background: '#f5f6fa', paddingBottom: 40 }}>
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
              Only <strong>ride time</strong> and <strong>seat count</strong> can be changed now. Co-rider{bookingCount > 1 ? 's' : ''} will be notified if the time changes. To change route, date or fare, cancel this ride and post a new one.
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

        <div style={{ background: '#fff', borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>

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

          {/* Seats — always editable (can't go below already-booked seats) */}
          <div style={{ marginBottom: 16 }}>
            <span style={label}>
              Total Seats {hasBookings && (
                <span style={{ color: '#16a34a', fontWeight: 400 }}>
                  ({bookedSeats} booked, {Math.max(0, Number(form.seats_available) - bookedSeats)} open)
                </span>
              )}
            </span>
            <select style={{ ...inp, border: '2px solid #111' }} value={form.seats_available}
              onChange={e => set('seats_available', e.target.value)}>
              {[1, 2, 3, 4].filter(n => n >= Math.max(1, bookedSeats)).map(n => (
                <option key={n} value={n}>{n} seat{n > 1 ? 's' : ''}</option>
              ))}
            </select>
            {hasBookings && (
              <div style={{ fontSize: 11, color: '#888', marginTop: 5, lineHeight: 1.5 }}>
                Reduce if seats filled elsewhere, or increase to open more.
                Minimum is {bookedSeats} (already booked).
              </div>
            )}
          </div>

          {/* Fare — locked if bookings */}
          {!hasBookings && (
            <div style={{ marginBottom: 16 }}>
              <span style={label}>Fare (₹)</span>
              <input style={inp} type="number" value={form.fare}
                onChange={e => set('fare', e.target.value)} />
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
        <div style={{ background: '#fff', borderRadius: 16, padding: 16, marginTop: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
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
