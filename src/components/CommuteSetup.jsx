import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { getZones } from '../lib/cities'

// Map profile.city ("Hyderabad", "Delhi NCR") → cities.js key ("hyderabad","delhi")
function cityKey(city) {
  if (!city) return 'hyderabad'
  const c = city.toLowerCase()
  if (c.includes('delhi')) return 'delhi'
  if (c.includes('bang') || c.includes('bengal')) return 'bangalore'
  if (c.includes('chenn')) return 'chennai'
  if (c.includes('mumb')) return 'mumbai'
  if (c.includes('pune')) return 'pune'
  return 'hyderabad'
}
const slug = s => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const DAYS = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 7]]

// One reusable area field: dropdown grouped by zone + "Other" free text.
function AreaField({ label, zones, value, onChange }) {
  const isOther = value?.custom
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 5, display: 'block' }}>{label}</label>
      <select
        value={isOther ? '__other__' : (value?.label || '')}
        onChange={e => {
          const v = e.target.value
          if (v === '__other__') { onChange({ custom: true, label: '', area: '', zone: null }); return }
          if (!v) { onChange(null); return }
          // find the zone for this area
          let zone = null
          for (const z of Object.keys(zones)) if (zones[z].includes(v)) { zone = z; break }
          onChange({ custom: false, label: v, area: slug(v), zone })
        }}
        style={{ width: '100%', padding: '12px 14px', background: '#222', border: '1.5px solid #333', borderRadius: 10, color: '#fff', fontSize: 14 }}
      >
        <option value="">Select area…</option>
        {Object.keys(zones).map(z => (
          <optgroup key={z} label={z}>
            {zones[z].map(a => <option key={a} value={a}>{a}</option>)}
          </optgroup>
        ))}
        <option value="__other__">✏️ Other — type my own</option>
      </select>
      {isOther && (
        <input
          autoFocus
          placeholder="Type your area / locality"
          value={value?.label || ''}
          onChange={e => onChange({ custom: true, label: e.target.value, area: slug(e.target.value), zone: null })}
          style={{ width: '100%', padding: '12px 14px', marginTop: 8, background: '#222', border: '1.5px solid #facc15', borderRadius: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
        />
      )}
    </div>
  )
}

export default function CommuteSetup({ mode = 'existing', onDone }) {
  const { user, profile, fetchProfile } = useAuth()
  const zones = getZones(cityKey(profile?.city))
  const isCarOwner = profile?.role === 'driver' || profile?.role === 'both'

  const [home, setHome] = useState(null)
  const [office, setOffice] = useState(null)
  const [morning, setMorning] = useState('09:00')
  const [evening, setEvening] = useState('18:30')
  const [days, setDays] = useState([1, 2, 3, 4, 5])
  const [seats, setSeats] = useState(3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Prefill if a schedule already exists (editing)
  useEffect(() => {
    if (!user?.id) return
    supabase.from('commute_schedules').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (!data) return
      setHome({ custom: data.home_custom, label: data.home_label, area: data.home_area, zone: data.home_zone })
      setOffice({ custom: data.office_custom, label: data.office_label, area: data.office_area, zone: data.office_zone })
      if (data.morning_time) setMorning(data.morning_time.slice(0, 5))
      if (data.evening_time) setEvening(data.evening_time.slice(0, 5))
      if (data.working_days?.length) setDays(data.working_days)
      if (data.seats_offered) setSeats(data.seats_offered)
    })
  }, [user?.id])

  const toggleDay = d => setDays(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d].sort())

  async function save() {
    setError('')
    if (!home?.label?.trim() || !office?.label?.trim()) { setError('Please choose your home and office areas'); return }
    if (home.area === office.area) { setError('Home and office areas cannot be the same'); return }
    if (days.length === 0) { setError('Select at least one working day'); return }
    setSaving(true)
    const { error: err } = await supabase.from('commute_schedules').upsert({
      user_id: user.id,
      home_area: home.area, home_label: home.label.trim(), home_zone: home.zone, home_custom: !!home.custom,
      office_area: office.area, office_label: office.label.trim(), office_zone: office.zone, office_custom: !!office.custom,
      morning_time: morning || null, evening_time: evening || null,
      working_days: days, seats_offered: isCarOwner ? seats : 3,
      auto_post: true, is_active: true, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (err) { setError(err.message); setSaving(false); return }
    await supabase.from('profiles').update({ commute_setup_done: true }).eq('id', user.id)
    setSaving(false)
    await fetchProfile(user.id)
    onDone?.()
  }

  function skip() {
    try { sessionStorage.setItem('commute_skip', '1') } catch (_) {}
    onDone?.()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111', padding: 24, display: 'flex', flexDirection: 'column' }}>
      <div style={{ paddingTop: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#facc15', fontWeight: 600, marginBottom: 4 }}>
          {isCarOwner ? '🚗 Set up your daily commute' : '🙋 Set up your daily commute'}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', lineHeight: 1.25 }}>
          {isCarOwner ? 'We’ll auto-post your rides' : 'See rides on your route, daily'}
        </div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 6, lineHeight: 1.6 }}>
          {isCarOwner
            ? 'Tell us your route and timings once. We’ll post your rides on your working days — you approve anyone who books. Nothing is confirmed without you.'
            : 'Tell us your route and timings once. We’ll show you matching rides for your commute automatically.'}
        </div>
      </div>

      <div style={{ background: '#1a1a1a', borderRadius: 20, padding: 20, flex: 1 }}>
        {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <AreaField label="🏠 Home area" zones={zones} value={home} onChange={setHome} />
        <AreaField label="🏢 Office area" zones={zones} value={office} onChange={setOffice} />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 5, display: 'block' }}>🌅 Leave home</label>
            <input type="time" value={morning} onChange={e => setMorning(e.target.value)}
              style={{ width: '100%', padding: '11px 12px', background: '#222', border: '1.5px solid #333', borderRadius: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 5, display: 'block' }}>🌆 Leave office</label>
            <input type="time" value={evening} onChange={e => setEvening(e.target.value)}
              style={{ width: '100%', padding: '11px 12px', background: '#222', border: '1.5px solid #333', borderRadius: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#aaa', margin: '16px 0 8px', display: 'block' }}>📅 Working days</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DAYS.map(([lbl, d]) => (
            <button key={d} onClick={() => toggleDay(d)} style={{
              flex: '1 0 12%', padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700,
              border: days.includes(d) ? '2px solid #facc15' : '1.5px solid #333',
              background: days.includes(d) ? 'rgba(250,204,21,0.12)' : 'transparent',
              color: days.includes(d) ? '#facc15' : '#777',
            }}>{lbl}</button>
          ))}
        </div>

        {isCarOwner && (
          <>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#aaa', margin: '16px 0 8px', display: 'block' }}>💺 Seats you can offer</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => setSeats(n)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                  border: seats === n ? '2px solid #facc15' : '1.5px solid #333',
                  background: seats === n ? 'rgba(250,204,21,0.12)' : 'transparent',
                  color: seats === n ? '#facc15' : '#777',
                }}>{n}</button>
              ))}
            </div>
          </>
        )}

        <button onClick={save} disabled={saving} style={{
          width: '100%', padding: 14, marginTop: 20, background: '#facc15', color: '#111',
          border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>{saving ? 'Saving…' : (isCarOwner ? '🚗 Start auto-posting my rides' : '✅ Save my commute')}</button>

        <button onClick={skip} style={{
          width: '100%', padding: 12, marginTop: 8, background: 'transparent', color: '#888',
          border: '1px solid #333', borderRadius: 10, fontSize: 13, cursor: 'pointer',
        }}>Maybe later</button>
      </div>
    </div>
  )
}
