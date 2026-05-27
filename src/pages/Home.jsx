import { useState, useEffect } from 'react'
import { formatTime, formatDate } from '../lib/utils'
import { getCompanyFromEmail } from '../lib/companyDomains'
import DriverProfileModal from '../components/DriverProfileModal'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'
import NotificationBell from '../components/NotificationBell'

// Hyderabad IT corridor locations — IT parks, offices, residential areas
const HYD_LOCATIONS = [
  // ── IT HUBS & OFFICES ──────────────────────────────
  'HITEC City', 'Hitech City', 'Madhapur', 'Raheja Mindspace', 'Mindspace Madhapur',
  'Financial District', 'Nanakramguda', 'WaveRock SEZ', 'DLF Cyber City',
  'Gachibowli', 'Divyasree Orion', 'Salarpuria Knowledge City',
  'Kokapet', 'GAR Kokapet', 'Raidurgam', 'Khajaguda',
  'Manikonda', 'Narsingi', 'Puppalaguda',
  'Kondapur', 'Kothaguda', 'Whitefield Kondapur',
  'Mindspace Pocharam', 'Pocharam', 'Nacharam',
  'Mindspace Shamshabad', 'Shamshabad', 'Aerospace SEZ',
  'TCS Synergy Park', 'ISB Campus', 'University of Hyderabad',
  'Cyberabad', 'L&T Infocity', 'Vanenburg IT Park',

  // ── MAJOR COMPANY CAMPUSES ─────────────────────────
  'Amazon Hyderabad', 'Amazon Campus', 'Microsoft Campus',
  'Google Hyderabad', 'Oracle Hyderabad', 'Facebook Hyderabad',
  'Infosys Pocharam', 'TCS Gachibowli', 'Wipro Gachibowli',
  'Accenture Gachibowli', 'Capgemini Gachibowli',
  'Cognizant Gachibowli', 'HCL Uppal',
  'Tech Mahindra Gachibowli', 'IBM Gachibowli',
  'Deloitte Hyderabad', 'JP Morgan Madhapur',

  // ── WESTERN RESIDENTIAL (near IT) ─────────────────
  'Kondapur', 'Miyapur', 'Chanda Nagar', 'Lingampally',
  'KPHB', 'Kukatpally', 'Bachupally', 'Nizampet',
  'Pragathi Nagar', 'Sri Nagar Colony', 'Aminpur',
  'Hafeezpet', 'Vattinagulapally', 'Tellapur',

  // ── GACHIBOWLI BELT ────────────────────────────────
  'Gachibowli', 'Attapur', 'Rajendra Nagar',
  'Puppalaguda', 'Kismatpur', 'Gandipet',
  'Nallagandla', 'Serilingampally',

  // ── MADHAPUR / JUBILEE HILLS ────────────────────────
  'Madhapur', 'Jubilee Hills', 'Banjara Hills',
  'Panjagutta', 'Film Nagar', 'Kavuri Hills',
  'Durgam Cheruvu', 'Road No 36', 'Ayyappa Society',

  // ── CENTRAL & AMEERPET ────────────────────────────
  'Ameerpet', 'SR Nagar', 'Punjagutta', 'Somajiguda',
  'Khairatabad', 'Lakdikapul', 'Mehdipatnam',
  'Tolichowki', 'Masab Tank', 'Himayatnagar',
  'Narayanguda', 'Koti', 'Abids', 'Nampally',

  // ── SECUNDERABAD & NORTH ───────────────────────────
  'Secunderabad', 'Begumpet', 'Old Bowenpally', 'Bowenpally',
  'Jeedimetla', 'IDA Jeedimetla', 'Balanagar',
  'Alwal', 'Malkajgiri', 'Sainikpuri', 'AS Rao Nagar',
  'Yapral', 'Kapra', 'Ecil', 'Kushaiguda', 'Neredmet',
  'Kompally', 'Medchal', 'Shamirpet',

  // ── EAST HYDERABAD ─────────────────────────────────
  'Uppal', 'Uppal Ring Road', 'Uppal Metro', 'Nagole', 'Nagole Metro',
  'LB Nagar', 'Dilsukhnagar', 'Kothapet',
  'Mallapur', 'Habsiguda', 'Tarnaka', 'Mettuguda',
  'Boduppal', 'Peerzadiguda', 'Ghatkesar',
  'Hayathnagar', 'Vanasthalipuram', 'Saroornagar',
  'Nacharam', 'Ramanthapur', 'Amberpet',
  'Moulali', 'Chilkalguda',

  // ── SOUTH & OUTSKIRTS ─────────────────────────────
  'Attapur', 'Bandlaguda', 'Kothur', 'Chevella',
  'Patancheru', 'Sangareddy', 'Isnapur',
  'Shadnagar', 'Maheshwaram', 'Adibatla',
  'Fab City', 'Genome Valley', 'IKP Knowledge Park',

  // ── METRO STATIONS ────────────────────────────────
  'Miyapur Metro', 'JNTU Metro', 'KPHB Metro',
  'Kukatpally Metro', 'Balanagar Metro', 'Moosapet Metro',
  'Bharat Nagar Metro', 'Erragadda Metro', 'ESI Metro',
  'SR Nagar Metro', 'Ameerpet Metro', 'Punjagutta Metro',
  'Irrum Manzil Metro', 'Khairatabad Metro', 'Lakdikapul Metro',
  'Assembly Metro', 'Nampally Metro', 'Gandhi Bhavan Metro',
  'Osmania Medical Metro', 'MJ Market Metro', 'Museerambagh Metro',
  'Dilsukhnagar Metro', 'Chaitanyapuri Metro', 'LB Nagar Metro',
  'Nagole Metro', 'Uppal Metro', 'Stadium Metro',
  'NGRI Metro', 'Habsiguda Metro', 'Tarnaka Metro',
  'Mettuguda Metro', 'Secunderabad East Metro', 'Secunderabad Metro',
  'Paradise Metro', 'Rasoolpura Metro', 'Prakash Nagar Metro',
  'Begumpet Metro', 'Ameerpet Metro', 'Yusufguda Metro',
  'Madhura Nagar Metro', 'Vittal Rao Nagar Metro',
  'Madhapur Metro', 'Durgam Cheruvu Metro',
  'Hitec City Metro', 'Raidurg Metro',

  // ── AIRPORT & OUTSKIRTS ───────────────────────────
  'Rajiv Gandhi International Airport', 'Shamshabad Airport',
  'ORR Gachibowli', 'ORR Patancheru', 'ORR Shamshabad',
]

function RideCard({ ride, onBook, myUserId }) {
  const [expanded, setExpanded] = useState(false)
  const isToOffice = ride.ride_type === 'to_office'
  const isMyRide = ride.driver_id === myUserId
  const initials = ride.profiles?.full_name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
  const colors = ['#2563eb','#7c3aed','#059669','#dc2626','#d97706']
  const color = colors[ride.driver_id?.charCodeAt(0) % colors.length] || '#2563eb'

  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.07)', marginBottom: 12,
      border: isMyRide ? '2px solid #facc15' : '1px solid #f0f0f0',
    }}>
      {isMyRide && (
        <div style={{ background: '#facc15', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#111', display: 'inline-block', marginBottom: 8 }}>
          YOUR RIDE
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {ride.profiles?.avatar_url ? (
          <img src={ride.profiles.avatar_url} alt="avatar"
            style={{ width: 42, height: 42, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #f0f0f0' }} />
        ) : (
          <div style={{
            width: 42, height: 42, borderRadius: '50%', background: color,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 15, flexShrink: 0,
          }}>{initials}</div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {ride.profiles?.full_name || 'Car Owner'}
              {ride.profiles?.is_verified && <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 9, padding: '2px 5px', borderRadius: 8, fontWeight: 700 }}>✓</span>}
              {(() => {
                const emailForCompany = (ride.profiles?.work_email_verified && ride.profiles?.work_email)
                  ? ride.profiles.work_email
                  : ride.profiles?.email
                const co = getCompanyFromEmail(emailForCompany)
                return co ? (
                  <span style={{
                    background: '#facc15', color: '#111',
                    fontSize: 9, padding: '2px 7px', borderRadius: 8,
                    fontWeight: 800, letterSpacing: 0.3,
                  }}>
                    🏢 {co.name}
                  </span>
                ) : null
              })()}
            </span>
            <span style={{
              background: isToOffice ? '#dbeafe' : '#fce7f3',
              color: isToOffice ? '#1d4ed8' : '#be185d',
              borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 600,
            }}>{isToOffice ? '🏢 To Office' : '🏠 To Home'}</span>
          </div>
          <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
            {ride.vehicle_model} · {ride.vehicle_number}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        {[
          { icon: '🕐', val: formatTime(ride.ride_time) },
          { icon: '📅', val: formatDate(ride.ride_date) },
          { icon: '📍', val: ride.from_location },
          { icon: '🏁', val: ride.to_location },
        ].map((item, i) => (
          <div key={i} style={{ background: '#f8f9fa', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 13 }}>{item.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.val}</span>
          </div>
        ))}
      </div>

      {expanded && ride.route_description && (
        <div style={{ marginTop: 10, background: '#f0f4ff', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#444' }}>
          🛣️ {ride.route_description}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ background: '#f0fdf4', color: '#16a34a', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>
            ₹{ride.fare}
          </span>
          <span style={{ background: '#fff7ed', color: '#c2410c', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 600 }}>
            💺 {ride.seats_available} seat{ride.seats_available !== 1 ? 's' : ''} left
          </span>
          {ride.is_recurring && (
            <span style={{ background: '#ede9fe', color: '#7c3aed', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 600 }}>
              🔁 Daily
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {ride.route_description && (
            <button onClick={() => setExpanded(!expanded)} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#666', cursor: 'pointer' }}>
              {expanded ? '▲' : 'Route ▼'}
            </button>
          )}
          {!isMyRide && (
            <button onClick={() => onBook(ride)} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Book ₹{ride.fare + 2}
            </button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 10, color: '#bbb', marginTop: 6, textAlign: 'right' }}>
        + ₹2 platform fee from wallet
      </div>
    </div>
  )
}

// Location autocomplete — must be outside Home to prevent remount on every keystroke
function LocationInput({ label, value, onChange, showSug, setShowSug, liveLocations }) {
  const combined = [...new Set([...HYD_LOCATIONS, ...(liveLocations || [])])].sort()
  const suggestions = combined.filter(s => s.toLowerCase().includes(value.toLowerCase())).slice(0, 6)
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{label}</div>
      <input
        placeholder={label === 'FROM' ? 'e.g. Uppal' : 'e.g. Kokapet'}
        style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #333', background: '#222', color: '#fff', fontSize: 12, boxSizing: 'border-box' }}
        value={value}
        onChange={e => { onChange(e.target.value); setShowSug(true) }}
        onFocus={() => setShowSug(true)}
        onBlur={() => setTimeout(() => setShowSug(false), 150)}
      />
      {showSug && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, zIndex: 100, maxHeight: 180, overflowY: 'auto', marginTop: 2 }}>
          {suggestions.map(s => (
            <button key={s} onMouseDown={() => { onChange(s); setShowSug(false) }}
              style={{ width: '100%', padding: '8px 12px', background: 'none', border: 'none', color: '#fff', fontSize: 12, textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid #222' }}>
              📍 {s}
            </button>
          ))}
          <div style={{ padding: '6px 12px', fontSize: 10, color: '#555' }}>Or type any location above</div>
        </div>
      )}
    </div>
  )
}

export default function Home() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [rides, setRides] = useState([])
  const [requests, setRequests] = useState([])
  const [myRequest, setMyRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterDate, setFilterDate] = useState('all') // all | today | tomorrow
  const [filterTime, setFilterTime] = useState('all') // all | morning | evening
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [showFromSug, setShowFromSug] = useState(false)
  const [showToSug, setShowToSug] = useState(false)
  const [suggestedRoutes, setSuggestedRoutes] = useState([])

  useEffect(() => { fetchSuggestedRoutes() }, [])

  const hasActiveFilters = filterFrom || filterTo || filterDate !== 'all' || filterTime !== 'all'

  // Matching: extract first meaningful keyword from location
  function keyWord(loc) {
    return (loc || '').toLowerCase().split(/[\s,]+/).find(w => w.length > 2) || ''
  }

  function matchScore(fromA, toA, fromB, toB) {
    const fk = keyWord(fromA), tk = keyWord(toA)
    const fromMatch = fk && (fromB || '').toLowerCase().includes(fk)
    const toMatch = tk && (toB || '').toLowerCase().includes(tk)
    return (fromMatch ? 2 : 0) + (toMatch ? 2 : 0)
  }

  useEffect(() => {
    fetchRides()
    fetchRequests()

    const channel = supabase
      .channel('rides-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => fetchRides())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchSuggestedRoutes() {
    if (!user?.id) return
    // Get user's 3 most used routes from past bookings
    const { data } = await supabase
      .from('bookings')
      .select('rides(from_location, to_location)')
      .eq('rider_id', user.id)
      .eq('status', 'confirmed')
      .order('created_at', { ascending: false })
      .limit(20)
    if (!data) return
    // Count route frequency
    const routeCount = {}
    data.forEach(b => {
      if (b.rides?.from_location && b.rides?.to_location) {
        const key = `${b.rides.from_location}||${b.rides.to_location}`
        routeCount[key] = (routeCount[key] || 0) + 1
      }
    })
    const top = Object.entries(routeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => {
        const [from, to] = key.split('||')
        return { from, to }
      })
    setSuggestedRoutes(top)
  }

  async function fetchRequests() {
    const istOffset = 5.5 * 60 * 60 * 1000
    const today = new Date(Date.now() + istOffset).toISOString().split('T')[0]

    const { data } = await supabase
      .from('ride_requests')
      .select('*, profiles(full_name, is_verified, work_email, work_email_verified, email)')
      .eq('status', 'active')
      .gte('ride_date', today)
      .order('created_at', { ascending: false })

    setRequests(data || [])

    // Check if current user has an active request
    const mine = (data || []).find(r => r.rider_id === user?.id)
    setMyRequest(mine || null)
  }

  async function fetchRides() {
    setLoading(true)

    // Use IST date (UTC+5:30) not UTC date — critical for India
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffset)
    const today = istNow.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('rides')
      .select('*, profiles(full_name, vehicle_model, vehicle_number, avg_rating, is_verified, email, work_email, work_email_verified, avatar_url)')
      .in('status', ['active'])
      .gte('ride_date', today)
      .order('ride_date', { ascending: true })
      .order('ride_time', { ascending: true })

    if (!error) {
      // Hide today's rides that departed more than 1 hour ago
      const cutoff = new Date(now.getTime() - 60 * 60 * 1000)
      const fresh = (data || []).filter(ride => {
        if (ride.ride_date !== today) return true
        if (!ride.ride_time) return true
        const [h, m] = ride.ride_time.split(':')
        const rideTime = new Date()
        rideTime.setHours(parseInt(h), parseInt(m), 0, 0)
        return rideTime >= cutoff
      })
      setRides(fresh)
    }
    setLoading(false)
  }

  const istOffset = 5.5 * 60 * 60 * 1000
  const today = new Date(Date.now() + istOffset).toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + istOffset + 86400000).toISOString().split('T')[0]

  const filtered = rides.filter(r => {
    if (filter === 'to_office' && r.ride_type !== 'to_office') return false
    if (filter === 'to_home' && r.ride_type !== 'to_home') return false
    // Auto-filter from rider's active request (if no manual filter set)
    const ef = !hasActiveFilters && myRequest
    const fromFilter = filterFrom || (ef ? keyWord(myRequest.from_location) : '')
    const toFilter = filterTo || (ef ? keyWord(myRequest.to_location) : '')
    if (fromFilter && !r.from_location?.toLowerCase().includes(fromFilter.toLowerCase())) return false
    if (toFilter && !r.to_location?.toLowerCase().includes(toFilter.toLowerCase())) return false
    if (filterDate === 'today' && r.ride_date !== today) return false
    if (filterDate === 'tomorrow' && r.ride_date !== tomorrow) return false
    if (filterTime === 'morning') {
      const hr = parseInt(r.ride_time?.split(':')[0] || 0)
      if (hr >= 12) return false
    }
    if (filterTime === 'evening') {
      const hr = parseInt(r.ride_time?.split(':')[0] || 0)
      if (hr < 12) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return r.from_location?.toLowerCase().includes(q) || r.to_location?.toLowerCase().includes(q) || r.route_description?.toLowerCase().includes(q)
    }
    return true
  }).sort((a, b) => {
    // Sort by match score with rider's request (best matches first)
    if (myRequest) {
      const sa = matchScore(myRequest.from_location, myRequest.to_location, a.from_location, a.to_location)
      const sb = matchScore(myRequest.from_location, myRequest.to_location, b.from_location, b.to_location)
      if (sb !== sa) return sb - sa
    }
    return 0
  })

  function handleNotificationClick(n) {
    if (n.title?.includes('offer you a ride')) {
      const match = n.message?.match(/for (.+) → (.+)\. Check/)
      if (match) {
        setFilterFrom(match[1])
        setFilterTo(match[2])
        setShowFilters(false)
        setFilter('all')
      }
    }
  }

  const liveFromLocations = rides.map(r => r.from_location).filter(Boolean)
  const liveToLocations = rides.map(r => r.to_location).filter(Boolean)

  return (
    <div style={{ background: '#f5f6fa', minHeight: '100vh', paddingBottom: 90 }}>
      <div style={{ background: '#111', padding: '20px 16px 14px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px' }}>
              <span style={{ color: '#facc15' }}>Carpool</span><span style={{ color: '#fff' }}>Karo</span>
            </div>
            <div style={{ color: '#666', fontSize: 11, marginTop: 1 }}>
              {profile?.full_name ? `Hey ${profile.full_name.split(' ')[0]}! 👋` : 'Hyderabad IT Carpool'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <NotificationBell onNotificationClick={handleNotificationClick} />
            <button onClick={fetchRides} style={{ background: '#222', border: 'none', borderRadius: 10, padding: '8px 12px', color: '#facc15', fontSize: 16, cursor: 'pointer' }}>
              ↺
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <input
            placeholder="🔍 Search area..."
            style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', fontSize: 13, background: '#222', color: '#fff', boxSizing: 'border-box' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={() => setShowFilters(!showFilters)} style={{
            background: hasActiveFilters ? '#facc15' : '#222',
            color: hasActiveFilters ? '#111' : '#fff',
            border: 'none', borderRadius: 10, padding: '10px 14px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasActiveFilters ? '#111' : '#fff'} strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            {hasActiveFilters && <span style={{ fontSize: 11, fontWeight: 800 }}>{[filterFrom,filterTo,filterDate!=='all'?filterDate:'',filterTime!=='all'?filterTime:''].filter(Boolean).length}</span>}
          </button>
        </div>

        {/* Advanced Filter Panel */}
        {showFilters && (
          <div style={{ marginTop: 10, background: '#1a1a1a', borderRadius: 12, padding: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <LocationInput label="FROM" value={filterFrom} onChange={setFilterFrom}
                showSug={showFromSug} setShowSug={setShowFromSug} liveLocations={liveFromLocations} />
              <LocationInput label="TO" value={filterTo} onChange={setFilterTo}
                showSug={showToSug} setShowSug={setShowToSug} liveLocations={liveToLocations} />
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {[['all','📅 Any Day'],['today','Today'],['tomorrow','Tomorrow']].map(([v,l]) => (
                <button key={v} onClick={() => setFilterDate(v)} style={{
                  padding: '5px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                  background: filterDate === v ? '#facc15' : '#333',
                  color: filterDate === v ? '#111' : '#aaa', fontWeight: filterDate === v ? 700 : 400,
                }}>{l}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {[['all','🕐 Any Time'],['morning','🌅 Morning (<12PM)'],['evening','🌆 Evening (>12PM)']].map(([v,l]) => (
                <button key={v} onClick={() => setFilterTime(v)} style={{
                  padding: '5px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                  background: filterTime === v ? '#facc15' : '#333',
                  color: filterTime === v ? '#111' : '#aaa', fontWeight: filterTime === v ? 700 : 400,
                }}>{l}</button>
              ))}
            </div>
            {hasActiveFilters && (
              <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterDate('all'); setFilterTime('all') }}
                style={{ width: '100%', padding: '7px', background: '#333', color: '#aaa', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                ✕ Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ padding: '12px 16px 6px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {[['all','All Rides'],['to_office','🏢 To Office'],['to_home','🏠 To Home'],['requests','🙋 Requests']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            background: filter === v ? '#111' : '#fff',
            color: filter === v ? '#fff' : '#555',
            fontWeight: filter === v ? 700 : 400, fontSize: 12,
            boxShadow: filter === v ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
          }}>
            {l}{v === 'requests' && requests.length > 0 ? ` (${requests.length})` : ''}
          </button>
        ))}
      </div>

      <div style={{ padding: '8px 16px' }}>

        {/* Show ride requests on All Rides tab for car owners */}
        {filter !== 'requests' && requests.filter(r => r.rider_id !== user?.id).length > 0 && (
          <div style={{ background: '#f0f4ff', borderRadius: 12, padding: 12, marginBottom: 12, border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', marginBottom: 8 }}>
              🙋 {requests.filter(r => r.rider_id !== user?.id).length} RIDER{requests.filter(r => r.rider_id !== user?.id).length > 1 ? 'S' : ''} LOOKING FOR A RIDE
            </div>
            {[...requests.filter(r => r.rider_id !== user?.id)].sort((a, b) => {
              const myRide = rides.find(r => r.driver_id === user?.id)
              if (!myRide) return 0
              return matchScore(myRide.from_location, myRide.to_location, b.from_location, b.to_location)
                   - matchScore(myRide.from_location, myRide.to_location, a.from_location, a.to_location)
            }).slice(0, 3).map(req => {
              const myRide = rides.find(r => r.driver_id === user?.id)
              const score = myRide ? matchScore(myRide.from_location, myRide.to_location, req.from_location, req.to_location) : 0
              return (
                <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #dbeafe' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>{req.profiles?.full_name}</span>
                      {score >= 2 && <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 9, padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>Route match</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#555' }}>{req.from_location} → {req.to_location}</div>
                    <div style={{ fontSize: 10, color: '#888' }}>{new Date(req.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}{req.ride_time ? ` · ${formatTime(req.ride_time)}` : ''}</div>
                  </div>
                  <button onClick={async () => {
                    await supabase.from('notifications').insert({
                      user_id: req.rider_id,
                      type: 'booking', title: '🚗 Someone can offer you a ride!',
                      message: `A car owner is available for ${req.from_location} → ${req.to_location}. Check All Rides now!`,
                      is_read: false,
                    })
                    alert('✅ Rider notified!')
                  }} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>
                    🔔 Notify
                  </button>
                </div>
              )
            })}
            {requests.filter(r => r.rider_id !== user?.id).length > 3 && (
              <button onClick={() => setFilter('requests')} style={{ marginTop: 8, background: 'none', border: 'none', color: '#2563eb', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                View all {requests.filter(r => r.rider_id !== user?.id).length} requests →
              </button>
            )}
          </div>
        )}

        {/* Route suggestions from history */}
        {suggestedRoutes.length > 0 && filter === 'all' && !search && !hasActiveFilters && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#888', fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>
              🕐 YOUR USUAL ROUTES
            </div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {suggestedRoutes.map((r, i) => (
                <button key={i} onClick={() => {
                  setFilterFrom(r.from.split(' ')[0])
                  setFilterTo(r.to.split(' ')[0])
                  setShowFilters(false)
                }} style={{
                  background: '#fff', border: '1px solid #e5e7eb', borderRadius: 20,
                  padding: '7px 12px', fontSize: 11, fontWeight: 600, color: '#111',
                  cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  📍 {r.from.split(' ')[0]} → {r.to.split(' ')[0]}
                </button>
              ))}
              <button onClick={() => { setFilterFrom(''); setFilterTo('') }} style={{
                background: 'none', border: '1px dashed #ddd', borderRadius: 20,
                padding: '7px 12px', fontSize: 11, color: '#aaa', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
              }}>
                + Add route
              </button>
            </div>
          </div>
        )}

        {/* My active request banner */}
        {myRequest && filter !== 'requests' && (
          <div style={{ background: '#f0f4ff', borderRadius: 12, padding: '12px 14px', marginBottom: 12, border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2563eb', marginBottom: 4 }}>🎯 SHOWING RIDES MATCHING YOUR REQUEST</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 12, color: '#333' }}>{myRequest.from_location} → {myRequest.to_location}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => navigate('/request')} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  ✏️ Edit
                </button>
                <button onClick={async () => {
                  await supabase.from('ride_requests').update({ status: 'cancelled' }).eq('id', myRequest.id)
                  fetchRequests()
                }} style={{ background: 'none', border: '1px solid #bfdbfe', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#888', cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>Tap ✕ to see all rides</div>
          </div>
        )}

        {/* Requests tab */}
        {filter === 'requests' ? (
          <div>
            <button onClick={() => navigate('/request')} style={{ width: '100%', padding: 13, background: '#111', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
              + Post My Ride Request
            </button>
            {requests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <div style={{ fontSize: 48 }}>🙋</div>
                <div style={{ color: '#555', fontWeight: 600, marginTop: 12 }}>No ride requests yet</div>
                <div style={{ color: '#aaa', fontSize: 13, marginTop: 6 }}>Be the first to post where you need to go</div>
              </div>
            ) : [...requests].sort((a, b) => {
              // Sort: own request first, then by match with owner's rides
              if (a.rider_id === user?.id) return -1
              if (b.rider_id === user?.id) return 1
              const myRide = rides.find(r => r.driver_id === user?.id)
              if (myRide) {
                const sa = matchScore(myRide.from_location, myRide.to_location, a.from_location, a.to_location)
                const sb = matchScore(myRide.from_location, myRide.to_location, b.from_location, b.to_location)
                if (sb !== sa) return sb - sa
              }
              return 0
            }).map(req => {
              const myRide = rides.find(r => r.driver_id === user?.id)
              const score = myRide ? matchScore(myRide.from_location, myRide.to_location, req.from_location, req.to_location) : 0
              const isMatch = score >= 2
              const initials = req.profiles?.full_name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
              const emailForBadge = req.profiles?.work_email_verified ? req.profiles?.work_email : req.profiles?.email
              const co = getCompanyFromEmail(emailForBadge)
              return (
                <div key={req.id} style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: req.rider_id === user?.id ? '2px solid #facc15' : isMatch ? '2px solid #22c55e' : '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    {req.rider_id === user?.id
                      ? <div style={{ background: '#facc15', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#111' }}>YOUR REQUEST</div>
                      : isMatch
                        ? <div style={{ background: '#f0fdf4', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, color: '#16a34a' }}>✓ MATCHES YOUR ROUTE</div>
                        : <div />
                    }
                    {co && <span style={{ background: '#facc15', color: '#111', fontSize: 9, padding: '2px 7px', borderRadius: 8, fontWeight: 800 }}>🏢 {co.name}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{initials}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{req.profiles?.full_name}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>Needs {req.seats_needed} seat{req.seats_needed > 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: req.note ? 10 : 0 }}>
                    <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: '#888' }}>FROM</div>
                      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{req.from_location}</div>
                    </div>
                    <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: '#888' }}>TO</div>
                      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 2 }}>{req.to_location}</div>
                    </div>
                  </div>
                  {req.note && <div style={{ fontSize: 12, color: '#666', marginTop: 8, fontStyle: 'italic' }}>"{req.note}"</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      📅 {new Date(req.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {req.ride_time ? ` · ${formatTime(req.ride_time)}` : ''}
                    </div>
                    {req.rider_id !== user?.id && (
                      <button onClick={async () => {
                        await supabase.from('notifications').insert({
                          user_id: req.rider_id,
                          type: 'booking', title: '🚗 Someone can offer you a ride!',
                          message: `A car owner is available for ${req.from_location} → ${req.to_location}. Check All Rides tab now!`,
                          is_read: false,
                        })
                        alert('✅ Rider has been notified! They will check the rides now.')
                      }} style={{ background: '#111', color: '#facc15', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        🔔 Notify Rider
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : loading ? (
          <div>
            {[1,2,3].map(i => (
              <div key={i} style={{
                borderRadius: 16, padding: 16, marginBottom: 10, height: 160,
                background: 'linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}>
                <div style={{ width: '60%', height: 14, background: '#e0e0e0', borderRadius: 7, marginBottom: 10 }} />
                <div style={{ width: '80%', height: 12, background: '#e8e8e8', borderRadius: 6, marginBottom: 8 }} />
                <div style={{ width: '40%', height: 12, background: '#e8e8e8', borderRadius: 6 }} />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48 }}>🔍</div>
            <div style={{ color: '#555', fontWeight: 600, marginTop: 12 }}>No rides found</div>
            <div style={{ color: '#aaa', fontSize: 13, marginTop: 6 }}>
              {search ? `No rides matching "${search}"` : 'No rides posted for today yet'}
            </div>
            <button onClick={() => navigate('/post')} style={{ marginTop: 16, padding: '10px 20px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              + Post a Ride
            </button>
          </div>
        ) : (
          filtered.map(ride => <RideCard key={ride.id} ride={ride} onBook={r => navigate(`/book/${r.id}`)} myUserId={user?.id} />)
        )}
      </div>
      <BottomNav />
      {selectedDriver && <DriverProfileModal driverId={selectedDriver} onClose={() => setSelectedDriver(null)} />}
    </div>
  )
}
