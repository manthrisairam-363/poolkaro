import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { getZones } from '../lib/cities'

function cityKey(city) {
  if (!city) return 'hyderabad'
  const c = city.toLowerCase()
  if (c.includes('delhi')) return 'delhi'
  if (c.includes('bang') || c.includes('bengal')) return 'bengaluru'
  if (c.includes('chenn')) return 'chennai'
  if (c.includes('mumb')) return 'mumbai'
  if (c.includes('pune')) return 'pune'
  return 'hyderabad'
}
const slug = s => (s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const DAYS = [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 7]]

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
      {isOther && (() => {
        // If what they type IS a known area (ignoring case/spaces/punctuation),
        // snap to it so it gets a zone and matches rides — people type
        // "ghatkesar" rather than scroll 80 options.
        const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const typed = norm(value?.label)
        let known = null
        if (typed.length >= 3) {
          for (const z of Object.keys(zones)) {
            const hit = zones[z].find(a => norm(a) === typed)
            if (hit) { known = { label: hit, zone: z }; break }
          }
        }
        return (
          <>
            <input
              autoFocus
              placeholder="Type your area / locality"
              value={value?.label || ''}
              onChange={e => onChange({ custom: true, label: e.target.value, area: slug(e.target.value), zone: null })}
              style={{ width: '100%', padding: '12px 14px', marginTop: 8, background: '#222', border: `1.5px solid ${known ? '#4ade80' : '#facc15'}`, borderRadius: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }}
            />
            {known && (
              <button type="button" onClick={() => onChange({ custom: false, label: known.label, area: slug(known.label), zone: known.zone })}
                style={{ marginTop: 6, background: 'rgba(74,222,128,0.12)', border: '1px solid #4ade80', color: '#4ade80', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ✓ Use "{known.label}" ({known.zone})
              </button>
            )}
          </>
        )
      })()}
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
  const [fare, setFare] = useState('')
  const [autoPost, setAutoPost] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      if (data.usual_fare) setFare(String(data.usual_fare))
      if (typeof data.auto_post === 'boolean') setAutoPost(data.auto_post)
    })
  }, [user?.id])

  const toggleDay = d => setDays(ds => ds.includes(d) ? ds.filter(x => x !== d) : [...ds, d].sort())

  async function save() {
    setError('')
    if (!home?.label?.trim() || !office?.label?.trim()) { setError('Please choose your home and office areas'); return }
    if (home.area === office.area) { setError('Home and office areas cannot be the same'); return }
    if (days.length === 0) { setError('Select at least one working day'); return }
    if (isCarOwner) {
      const f = Number(fare)
      if (!f || f <= 0) { setError('Enter the usual fare you charge per seat (₹)'); return }
      if (f > 2000) { setError('That fare looks too high — enter the per-seat fare in ₹'); return }
    }
    setSaving(true)
    const { error: err } = await supabase.from('commute_schedules').upsert({
      user_id: user.id,
      home_area: home.area, home_label: home.label.trim(), home_zone: home.zone, home_custom: !!home.custom,
      office_area: office.area, office_label: office.label.trim(), office_zone: office.zone, office_custom: !!office.custom,
      morning_time: morning || null, evening_time: evening || null,
      working_days: days, seats_offered: isCarOwner ? seats : 3,
      usual_fare: isCarOwner ? Number(fare) : null,
      auto_post: isCarOwner ? autoPost : true, is_active: true, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (err) { setError(err.message); setSaving(false); return }
    await supabase.from('profiles').update({ commute_setup_done: true }).eq('id', user.id)
    // If a car owner turned auto-post OFF, remove their upcoming unbooked auto rides.
    if (isCarOwner && !autoPost) { try { await supabase.rpc('cancel_future_autoposts') } catch (_) {} }
    // Post this user's rides right now so they appear immediately instead of
    // waiting for the nightly 4 AM job. Self-guards on role/fare/auto_post,
    // so it's safe to call for anyone (riders generate nothing).
    try { await supabase.rpc('generate_my_commute_rides') } catch (_) {}
    setSaving(false)
    await fetchProfile(user.id)
    onDone?.()
  }

  function skip() {
    if (mode !== 'edit') { try { sessionStorage.setItem('commute_skip', '1') } catch (_) {} }
    onDone?.()
  }

  const fieldLabel = { fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 5, display: 'block' }

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
            ? 'Tell us your route, timings and usual fare once. We’ll post your rides on your working days for the week ahead — you approve anyone who books. Nothing is confirmed without you, and you can edit or cancel any day’s ride.'
            : 'Tell us your route and timings once. We’ll show you matching rides for your commute automatically.'}
        </div>
      </div>

      <div style={{ background: '#1a1a1a', borderRadius: 20, padding: 20, flex: 1 }}>
        {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <AreaField label="🏠 Home area" zones={zones} value={home} onChange={setHome} />
        <AreaField label="🏢 Office area" zones={zones} value={office} onChange={setOffice} />

        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={fieldLabel}>🌅 Leave home</label>
            <input type="time" value={morning} onChange={e => setMorning(e.target.value)}
              style={{ width: '100%', padding: '11px 12px', background: '#222', border: '1.5px solid #333', borderRadius: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={fieldLabel}>🌆 Leave office</label>
            <input type="time" value={evening} onChange={e => setEvening(e.target.value)}
              style={{ width: '100%', padding: '11px 12px', background: '#222', border: '1.5px solid #333', borderRadius: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
        </div>

        <label style={{ ...fieldLabel, margin: '16px 0 8px' }}>📅 Working days</label>
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
            <label style={{ ...fieldLabel, margin: '16px 0 8px' }}>💺 Seats you can offer</label>
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

            <label style={{ ...fieldLabel, margin: '16px 0 8px' }}>💰 Usual fare per seat (₹)</label>
            <input type="number" inputMode="numeric" placeholder="e.g. 60" value={fare}
              onChange={e => setFare(e.target.value.replace(/\D/g, '').slice(0, 4))}
              style={{ width: '100%', padding: '12px 14px', background: '#222', border: '1.5px solid #333', borderRadius: 10, color: '#fff', fontSize: 14, boxSizing: 'border-box' }} />
            <div style={{ fontSize: 11, color: '#666', marginTop: 5 }}>
              What each rider pays you for the trip (paid directly to you). You can change it on any ride later.
            </div>

            <div onClick={() => setAutoPost(a => !a)} style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#222', border: '1.5px solid #333', borderRadius: 12, padding: '12px 14px', cursor: 'pointer' }}>
              <div style={{ paddingRight: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>🔄 Auto-post my rides</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                  {autoPost ? 'We post your rides on your working days for the week ahead.' : 'Off — we won’t post any rides. You can still post manually.'}
                </div>
              </div>
              <div style={{ flexShrink: 0, width: 44, height: 26, borderRadius: 999, background: autoPost ? '#facc15' : '#444', position: 'relative', transition: 'background .15s' }}>
                <div style={{ position: 'absolute', top: 3, left: autoPost ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
              </div>
            </div>
          </>
        )}

        <button onClick={save} disabled={saving} style={{
          width: '100%', padding: 14, marginTop: 20, background: '#facc15', color: '#111',
          border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>{saving ? 'Saving…' : (isCarOwner ? '🚗 Start auto-posting my rides' : '✅ Save my commute')}</button>

        {mode === 'edit' ? (
          <button onClick={skip} style={{
            width: '100%', padding: 12, marginTop: 8, background: 'transparent', color: '#888',
            border: '1px solid #333', borderRadius: 10, fontSize: 13, cursor: 'pointer',
          }}>Cancel</button>
        ) : (
          <div style={{ textAlign: 'center', color: '#666', fontSize: 11, marginTop: 12, lineHeight: 1.5 }}>
            Takes 20 seconds. You can change it any time from Profile.
          </div>
        )}
      </div>
    </div>
  )
}
