import { useState, useEffect, useRef } from 'react'
import { formatTime, formatDate } from '../lib/utils'
import { getCompanyFromEmail } from '../lib/companyDomains'
import DriverProfileModal from '../components/DriverProfileModal'
import GuidedTour from '../components/GuidedTour'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'

// City IT locations inline — no external import needed
const CITY_LOCATIONS = {
  'Hyderabad': [
    'Financial District','Nanakramguda','Kokapet','GAR Kokapet','Raidurgam','Khajaguda',
    'DLF Cyber City Hyderabad','WaveRock SEZ','Divyasree Orion','Salarpuria Knowledge City',
    'Cyber Towers','Cyber Gateway','HUDA Techno Enclave','iLabs Centre','RMZ Futura',
    'HITEC City','Madhapur','Mindspace Madhapur','Cyberabad','DLF Cyber City',
    'Inorbit Mall Area','ISB Hyderabad','Aparna Cyberzone',
    'Gachibowli','Kondapur','Manikonda','Narsingi','Serilingampally',
    'TCS Gachibowli','Wipro Gachibowli','Accenture Gachibowli','Capgemini Gachibowli',
    'Cognizant Gachibowli','Tech Mahindra Gachibowli','IBM Gachibowli',
    'JP Morgan Madhapur','Deloitte Hyderabad','Amazon Hyderabad',
    'Microsoft Campus Hyderabad','Google Hyderabad',
    'Pocharam','Nacharam','Mindspace Pocharam','TCS Synergy Park',
    'Infosys Pocharam','HCL Uppal','Uppal Ring Road',
    'Miyapur','KPHB','Kukatpally','Bachupally','Nizampet','Lingampally',
    'Chandanagar','Hafeezpet','Tellapur','Nallagandla','Borabanda',
    'Ameerpet','SR Nagar','Sanath Nagar','Erragadda',
    'Jubilee Hills','Banjara Hills','Panjagutta','Film Nagar','Kavuri Hills',
    'Somajiguda','Khairatabad','Mehdipatnam','Tolichowki','Masab Tank',
    'Lakdikapool','Nampally','Abids','Koti','Sultan Bazar',
    'Attapur','Shaikpet','Puppalaguda','Rajendra Nagar','Shamshabad','Gandipet',
    'Secunderabad','Begumpet','Jeedimetla','Balanagar','Kompally',
    'Medchal','Alwal','Bowenpally','Trimulgherry','Malkajgiri',
    'Uppal','LB Nagar','Dilsukhnagar','Nagole','Boduppal','Ghatkesar',
    'Hayathnagar','Vanasthalipuram','Amberpet','Kothapet','Ramanthapur',
    'Tarnaka','Habsiguda','ECIL','AS Rao Nagar',
    'Charminar','Malakpet','Nalgonda X Roads',
    'Miyapur Metro','KPHB Metro','Ameerpet Metro','Hitec City Metro',
    'Raidurg Metro','Nagole Metro','Uppal Metro','LB Nagar Metro',
    'Secunderabad Metro','Jubilee Bus Station','MGBS',
    'Rajiv Gandhi International Airport','Shamshabad Airport',
  ],
  'Bangalore': ['Whitefield','Marathahalli','Bellandur','Sarjapur Road','Outer Ring Road','Electronic City','Electronic City Phase 1','Electronic City Phase 2','Koramangala','HSR Layout','BTM Layout','Silk Board','Bommanahalli','Hebbal','Manyata Tech Park','Kirloskar Business Park','Yeshwanthpur','Rajajinagar','Indiranagar','CV Raman Nagar','Domlur','Airport Road','Jayanagar','JP Nagar','Bannerghatta Road','Yelahanka','Devanahalli','Kempegowda International Airport','Bagmane Tech Park','RMZ Infinity','Prestige Tech Park','Embassy TechVillage','Cessna Business Park','Ecospace','IBM Manyata','Cisco Bangalore','SAP Bangalore','Amazon Bangalore','Flipkart HQ','Infosys Bangalore','Wipro Sarjapur','HCL Bangalore','TCS Bangalore','Accenture Bangalore','MG Road','Church Street','Majestic','Shivajinagar'],
  'Pune': ['Hinjewadi','Hinjewadi Phase 1','Hinjewadi Phase 2','Hinjewadi Phase 3','Kharadi','Magarpatta','EON IT Park','World Trade Center Pune','Wakad','Baner','Balewadi','Sus Road','Viman Nagar','Kalyani Nagar','Nagar Road','Hadapsar','Fursungi','Aundh','Pimple Saudagar','Pimple Nilakh','Punawale','Shivajinagar','FC Road','JM Road','Deccan','Kothrud','Warje','Karve Road','Yerwada','Koregaon Park','Talegaon','Chakan','Infosys Pune','Wipro Pune','Cognizant Pune','TCS Pune','Zensar Pune','Tech Mahindra Pune','Persistent Pune','Katraj','Kondhwa','NIBM Road','Mundhwa','Commerzone','RMZ Westend'],
  'Mumbai': ['BKC','Bandra Kurla Complex','Bandra East','Bandra West','Powai','Hiranandani','Chandivali','SEEPZ','Andheri East','Andheri West','MIDC Andheri','Marol','Lower Parel','Worli','Kamala Mills','One BKC','Navi Mumbai','Belapur','Vashi','Nerul','Ghansoli','Mahape','Thane','Wagle Estate','Kolshet','Majiwada','Malad','Mindspace Malad','Link Road','Goregaon','NESCO IT Park','Goregaon East','Vikhroli','Kanjurmarg','LBS Marg','Kurla','Kalina','Santacruz East','Nariman Point','Fort','CSMT','Churchgate','Airoli','Rabale','TTC Industrial Area','Chembur','Ghatkopar','Mulund','Borivali','Kandivali','Dahisar','Chhatrapati Shivaji Airport','CSIA'],
  'Delhi NCR': ['Noida Sector 62','Noida Sector 63','Noida Sector 125','Noida Sector 132','Noida Sector 135','Noida Sector 142','Noida Sector 143','Noida Expressway','Noida City Centre','Botanical Garden','Gurugram','Gurgaon','Cyber City','DLF Phase 1','DLF Phase 2','DLF Phase 3','DLF Phase 4','DLF Phase 5','Golf Course Road','Sohna Road','NH 8','Udyog Vihar','MG Road Gurgaon','IFFCO Chowk','Manesar','IMT Manesar','Greater Noida','Alpha 1','Alpha 2','Knowledge Park','Techzone 4','Connaught Place','Barakhamba','Janpath','Nehru Place','Okhla','Saket','Malviya Nagar','Vasant Kunj','Vasant Vihar','RK Puram','Dwarka','Dwarka Sector 10','Dwarka Sector 21','Rohini','Pitampura','Laxmi Nagar','Preet Vihar','IP Extension','IGI Airport','Aerocity','TCS Noida','Infosys Noida','HCL Noida','Accenture Gurgaon','Wipro Gurgaon','IBM Gurgaon','Microsoft Noida','Adobe Noida','Samsung Noida'],
  'Chennai': ['OMR','Old Mahabalipuram Road','Sholinganallur','Perungudi','Taramani','Thoraipakkam','Karapakkam','Siruseri','SIPCOT IT Park','Tidel Park','RMZ Millenia','Ascendas IT Park','Anna Nagar','Anna Nagar West','Anna Nagar East','Nungambakkam','Egmore','T Nagar','Velachery','Medavakkam','Pallikaranai','Tambaram','Chrompet','Pallavaram','Porur','Ramapuram','Vadapalani','Guindy','Ekkatuthangal','St Thomas Mount','Ambattur','Ambattur Industrial Estate','Adyar','Besant Nagar','Thiruvanmiyur','Mylapore','Alwarpet','Kotturpuram','Maraimalai Nagar','Mahindra World City','TCS Chennai','Infosys Chennai','Wipro Chennai','Cognizant Chennai','HCL Chennai','Tech Mahindra Chennai','Chennai International Airport'],
}
function getLocationsForCity(city) {
  return CITY_LOCATIONS[city] || CITY_LOCATIONS['Hyderabad']
}


// Location autocomplete — uses city-specific locations
function LocationInput({ label, value, onChange, showSug, setShowSug, liveLocations, city }) {
  const cityLocs = getLocationsForCity(city || 'Hyderabad')
  const combined = [...new Set([...cityLocs, ...(liveLocations || [])])].sort()
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
  const [filterDate, setFilterDate] = useState('all')
  const [filterTime, setFilterTime] = useState('all')
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [showFromSug, setShowFromSug] = useState(false)
  const [showToSug, setShowToSug] = useState(false)
  const [suggestedRoutes, setSuggestedRoutes] = useState([])
  const [announcement, setAnnouncement] = useState('')
  const [maintenance, setMaintenance] = useState(false)

  // Fetch app settings
  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase.from('app_settings').select('key,value')
      const map = {}
      ;(data||[]).forEach(s => { map[s.key] = s.value })
      setAnnouncement(map.announcement || '')
      setMaintenance(map.maintenance_mode === 'true')
    }
    fetchSettings()
  }, [])

  useEffect(() => { fetchSuggestedRoutes() }, [])

  const hasActiveFilters = filterFrom || filterTo || filterDate !== 'all' || filterTime !== 'all'

  // Matching: extract first meaningful keyword from location
  function keyWord(loc) {
    return (loc || '').toLowerCase().split(/[\s,]+/).find(w => w.length > 2) || ''
  }

  // matchScore: checks from/to AND via (route_description)
  // rideVia = the driver's via/route_description field
  function matchScore(fromA, toA, fromB, toB, rideVia = '') {
    const fk = keyWord(fromA), tk = keyWord(toA)
    const searchText = `${fromB} ${toB} ${rideVia}`.toLowerCase()
    const fromMatch = fk && searchText.includes(fk)
    const toMatch = tk && (toB || '').toLowerCase().includes(tk)
    // Via match: rider's FROM is along driver's route
    const viaMatch = fk && rideVia?.toLowerCase().includes(fk)
    return (fromMatch ? 2 : 0) + (toMatch ? 2 : 0) + (viaMatch ? 1 : 0)
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

    // Only show today and tomorrow — no future clutter
    const tomorrow = new Date(istNow.getTime() + 86400000).toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('rides')
      .select('*, profiles(full_name, vehicle_model, vehicle_number, avg_rating, is_verified, email, work_email, work_email_verified, avatar_url)')
      .in('status', ['active'])
      .gte('ride_date', today)
      .lte('ride_date', tomorrow)
      .eq('city', profile?.city || 'Hyderabad')
      .order('ride_date', { ascending: true })
      .order('ride_time', { ascending: true })

    if (!error) {
      // Hide today's rides that departed more than 1 hour ago (IST-consistent)
      // Current time in IST minutes-since-midnight
      const istNowTime = new Date(now.getTime() + istOffset)
      const nowMinutes = istNowTime.getUTCHours() * 60 + istNowTime.getUTCMinutes()
      const fresh = (data || []).filter(ride => {
        if (ride.ride_date !== today) return true
        if (!ride.ride_time) return true
        const [h, m] = ride.ride_time.split(':')
        const rideMinutes = parseInt(h) * 60 + parseInt(m)
        // Show if ride departs in future OR within last 60 min
        return rideMinutes >= (nowMinutes - 60)
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
    // Only apply MANUAL filters (from the filter panel) — never auto-hide based on request
    if (filterFrom && !r.from_location?.toLowerCase().includes(filterFrom.toLowerCase())
      && !r.route_description?.toLowerCase().includes(filterFrom.toLowerCase())) return false
    if (filterTo && !r.to_location?.toLowerCase().includes(filterTo.toLowerCase())
      && !r.route_description?.toLowerCase().includes(filterTo.toLowerCase())) return false
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
      const sa = matchScore(myRequest.from_location, myRequest.to_location, a.from_location, a.to_location, a.route_description)
      const sb = matchScore(myRequest.from_location, myRequest.to_location, b.from_location, b.to_location, b.route_description)
      if (sb !== sa) return sb - sa
    }
    return 0
  })


  // Pull to refresh
  const touchStartY = useRef(null)
  const scrollRef = useRef(null)
  function onTouchStart(e) { touchStartY.current = e.touches[0].clientY }
  function onTouchEnd(e) {
    if (!touchStartY.current) return
    const diff = e.changedTouches[0].clientY - touchStartY.current
    if (diff > 80 && scrollRef.current?.scrollTop === 0) { fetchRides(); fetchRequests() }
    touchStartY.current = null
  }

  const liveFromLocations = rides.map(r => r.from_location).filter(Boolean)
  const liveToLocations = rides.map(r => r.to_location).filter(Boolean)

  const timeOfDay = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  // Bottom sheet state
  const [sheetRide, setSheetRide] = useState(null)
  const [booking, setBooking] = useState(false)

  async function handleBook(ride) {
    setBooking(true)
    const { data } = await supabase.rpc('book_ride_atomic', { p_ride_id: ride.id, p_rider_id: user.id, p_seats: 1 })
    setBooking(false)
    if (data?.success) {
      setSheetRide(null)
      alert('🎉 Booking confirmed!')
      navigate(`/book/${ride.id}`)
    } else {
      alert(data?.message || 'Booking failed. Please try again.')
    }
  }

  return (
    <div
      ref={scrollRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ background: '#f1f5f9', minHeight: '100vh', paddingBottom: 90, overflowY: 'auto' }}
    >
      {/* Maintenance Mode Screen — admin bypasses */}
      {maintenance && !profile?.is_admin && (
        <div style={{ position: 'fixed', inset: 0, background: '#0a0a0a', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🔧</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', marginBottom: 12, textAlign: 'center' }}>Under Maintenance</div>
          <div style={{ fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 1.6 }}>
            CarpoolKaro is undergoing scheduled maintenance. We'll be back shortly!
          </div>
          <div style={{ marginTop: 32, fontSize: 12, color: '#555' }}>support@carpoolkaro.com</div>
        </div>
      )}

      {/* Announcement Banner */}
      {announcement && (
        <div style={{ background: 'linear-gradient(135deg,#f59e0b,#facc15)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>📢</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111', flex: 1 }}>{announcement}</span>
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ background: '#fff', position: 'sticky', top: 0, zIndex: 40, boxShadow: '0 1px 8px rgba(0,0,0,0.06)' }}>
        {/* Top bar */}
        <div id="tour-header" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px 8px' }}>
          {/* Small logo */}
          <img src="/logo.png" alt="CarpoolKaro" style={{ height: 32, width: 'auto', flexShrink: 0 }} />
          {/* Location + greeting */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>📍</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{profile?.city || 'Hyderabad'}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', lineHeight: 1.2, letterSpacing: '-0.3px' }}>
              {timeOfDay()}, <span style={{ color: '#f59e0b' }}>{profile?.full_name?.split(' ')[0] || 'there'}</span>! 👋
            </div>
          </div>
          {/* Profile avatar — taps to profile */}
          <div
            onClick={() => navigate('/profile')}
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg,#facc15,#f59e0b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 13, color: '#111', cursor: 'pointer',
              overflow: 'hidden', border: '2px solid #fef3c7',
            }}
          >
            {profile?.avatar_url
              ? <img src={profile.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', WebkitTouchCallout: 'none' }} />
              : (profile?.full_name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?')
            }
          </div>
        </div>
        {/* Search */}
        <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8 }}>
          <input
            placeholder="🔍 Search area or company..."
            style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 12, background: '#f8fafc', color: '#111', outline: 'none', boxSizing: 'border-box' }}
            value={search} onChange={e => setSearch(e.target.value)}
          />
          <button onClick={() => setShowFilters(!showFilters)} style={{
            background: hasActiveFilters ? '#facc15' : '#f1f5f9', color: hasActiveFilters ? '#111' : '#64748b',
            border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            {hasActiveFilters && <span style={{ fontSize: 9, fontWeight: 900 }}>{[filterFrom,filterTo,filterDate!=='all'?filterDate:'',filterTime!=='all'?filterTime:''].filter(Boolean).length}</span>}
          </button>
        </div>
        {/* Tabs */}
        <div id="tour-tabs" style={{ display: 'flex', gap: 6, padding: '0 16px 10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[['all','All Rides'],['to_office','🏢 Office'],['to_home','🏠 Home'],['requests','🙋 Requests']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              background: filter === v ? '#0f172a' : '#f1f5f9',
              color: filter === v ? '#facc15' : '#64748b',
              fontWeight: filter === v ? 700 : 500, fontSize: 11,
            }}>
              {l}{v === 'requests' && requests.length > 0 ? ` (${requests.length})` : ''}
            </button>
          ))}
        </div>
        {/* Filters panel */}
        {showFilters && (
          <div style={{ padding: '10px 16px 12px', borderTop: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <LocationInput label="FROM" value={filterFrom} onChange={setFilterFrom} showSug={showFromSug} setShowSug={setShowFromSug} liveLocations={liveFromLocations} city={profile?.city} />
              <LocationInput label="TO" value={filterTo} onChange={setFilterTo} showSug={showToSug} setShowSug={setShowToSug} liveLocations={liveToLocations} city={profile?.city} />
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
              {[['all','Any Day'],['today','Today'],['tomorrow','Tomorrow']].map(([v,l]) => (
                <button key={v} onClick={() => setFilterDate(v)} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, background: filterDate === v ? '#0f172a' : '#f1f5f9', color: filterDate === v ? '#facc15' : '#64748b', fontWeight: filterDate === v ? 700 : 400 }}>{l}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
              {[['all','Any Time'],['morning','Morning'],['afternoon','Afternoon'],['evening','Evening']].map(([v,l]) => (
                <button key={v} onClick={() => setFilterTime(v)} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, background: filterTime === v ? '#0f172a' : '#f1f5f9', color: filterTime === v ? '#facc15' : '#64748b', fontWeight: filterTime === v ? 700 : 400 }}>{l}</button>
              ))}
            </div>
            {hasActiveFilters && (
              <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterDate('all'); setFilterTime('all') }}
                style={{ width: '100%', padding: '6px', background: '#f1f5f9', color: '#94a3b8', border: 'none', borderRadius: 8, fontSize: 11, cursor: 'pointer' }}>
                ✕ Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ padding: '10px 14px' }}>

        {/* Usual routes */}
        {suggestedRoutes.length > 0 && filter === 'all' && !search && !hasActiveFilters && (
          <div style={{ marginBottom: 10, display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {suggestedRoutes.map((r, i) => (
              <button key={i} onClick={() => { setFilterFrom(r.from.split(' ')[0]); setFilterTo(r.to.split(' ')[0]) }} style={{
                background: '#fff', border: '1px solid #e2e8f0', borderRadius: 20,
                padding: '5px 10px', fontSize: 10, fontWeight: 600, color: '#334155',
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                📍 {r.from.split(' ')[0]} → {r.to.split(' ')[0]}
              </button>
            ))}
          </div>
        )}

        {/* Rider requests for drivers */}
        {filter !== 'requests' && requests.filter(r => r.rider_id !== user?.id).length > 0 && (
          <div style={{ background: '#eff6ff', borderRadius: 12, padding: '10px 12px', marginBottom: 10, border: '1px solid #bfdbfe' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#2563eb', marginBottom: 5 }}>
              🙋 {requests.filter(r => r.rider_id !== user?.id).length} RIDERS LOOKING FOR A RIDE
            </div>
            {requests.filter(r => r.rider_id !== user?.id).slice(0,2).map(req => (
              <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderTop: '1px solid #dbeafe' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>{req.from_location} → {req.to_location}</div>
                  <div style={{ fontSize: 10, color: '#60a5fa' }}>{req.ride_time ? `${formatTime(req.ride_time)} · ` : ''}{new Date(req.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                </div>
                <button onClick={async () => {
                  await supabase.from('notifications').insert({ user_id: req.rider_id, type: 'booking', title: '🚗 A car owner can offer you a ride!', message: `Available for ${req.from_location} → ${req.to_location}.`, is_read: false })
                  alert('✅ Rider notified!')
                }} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}>Notify</button>
              </div>
            ))}
          </div>
        )}

        {/* Requests tab */}
        {filter === 'requests' ? (
          <div>
            <button onClick={() => navigate('/request')} style={{ width: '100%', padding: 13, background: '#0f172a', color: '#facc15', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
              + Post My Ride Request
            </button>
            {requests.map(req => {
              const initials = req.profiles?.full_name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
              const co = getCompanyFromEmail(req.profiles?.work_email_verified ? req.profiles?.work_email : req.profiles?.email)
              return (
                <div key={req.id} style={{ background: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', border: req.rider_id === user?.id ? '2px solid #facc15' : '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {req.profiles?.full_name}
                        {req.rider_id === user?.id && <span style={{ background: '#facc15', borderRadius: 5, padding: '1px 6px', fontSize: 9, fontWeight: 700, color: '#111' }}>YOURS</span>}
                        {co && <span style={{ background: '#f8fafc', color: '#334155', fontSize: 9, padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>{co.name}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#888' }}>Needs {req.seats_needed} seat{req.ride_time ? ` · ${formatTime(req.ride_time)}` : ''} · {new Date(req.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                    </div>
                    {req.rider_id !== user?.id && (
                      <button onClick={async () => {
                        await supabase.from('notifications').insert({ user_id: req.rider_id, type: 'booking', title: '🚗 Someone can offer you a ride!', message: `A car owner is available for ${req.from_location} → ${req.to_location}.`, is_read: false })
                        alert('✅ Rider notified!')
                      }} style={{ background: '#0f172a', color: '#facc15', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>🔔</button>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{req.from_location} → {req.to_location}</div>
                  {req.note && <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic', marginTop: 4 }}>"{req.note}"</div>}
                </div>
              )
            })}
          </div>
        ) : loading ? (
          <div>{[1,2,3,4].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, height: 80, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ width: '50%', height: 9, background: '#f1f5f9', borderRadius: 5, marginBottom: 8 }} />
              <div style={{ width: '80%', height: 11, background: '#f1f5f9', borderRadius: 5, marginBottom: 8 }} />
              <div style={{ width: '40%', height: 9, background: '#f1f5f9', borderRadius: 5 }} />
            </div>
          ))}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 44 }}>🔍</div>
            <div style={{ color: '#334155', fontWeight: 700, marginTop: 12, fontSize: 15 }}>No rides found</div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>
              {search ? `No rides matching "${search}"` : 'Pull down to refresh'}
            </div>
            <button onClick={() => navigate('/post')} style={{ marginTop: 16, padding: '10px 20px', background: '#0f172a', color: '#facc15', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Post a Ride
            </button>
          </div>
        ) : (
          <div>
            {/* MY RIDES shown at top — slightly bigger */}
            {filtered.filter(r => r.driver_id === user?.id).map(ride => (
              <MyRideCard key={ride.id} ride={ride} navigate={navigate} getCompanyFromEmail={getCompanyFromEmail} />
            ))}
            {/* ALL OTHER RIDES — compact */}
            {filtered.filter(r => r.driver_id !== user?.id).map(ride => (
              <CompactRideCard key={ride.id} ride={ride} onTap={() => setSheetRide(ride)} getCompanyFromEmail={getCompanyFromEmail} />
            ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM SHEET ── */}
      {sheetRide && (
        <div
          onClick={() => setSheetRide(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '24px 24px 0 0', width: '100%', maxHeight: '85vh', overflow: 'auto', padding: '0 20px 40px' }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
              <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 2 }} />
            </div>

            {/* Driver info */}
            {(() => {
              const emailForBadge = sheetRide.profiles?.work_email_verified ? sheetRide.profiles?.work_email : sheetRide.profiles?.email
              const co = getCompanyFromEmail(emailForBadge)
              const initials = sheetRide.profiles?.full_name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                    <div style={{ width: 54, height: 54, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, flexShrink: 0, overflow: 'hidden' }}>
                      {sheetRide.profiles?.avatar_url ? <img src={sheetRide.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', WebkitTouchCallout: 'none' }} /> : initials}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 17, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {sheetRide.profiles?.full_name}
                        {sheetRide.profiles?.is_verified && <span style={{ color: '#3b82f6', fontSize: 13 }}>✓</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                        {co && <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>🏢 {co.name}</span>}
                        {sheetRide.profiles?.avg_rating > 0 && <span style={{ background: '#fef9c3', color: '#854d0e', fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 700 }}>⭐ {Number(sheetRide.profiles.avg_rating).toFixed(1)}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Car */}
                  <div style={{ background: '#f8fafc', borderRadius: 14, padding: '12px 16px', marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Vehicle</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>
                      {sheetRide.vehicle_model || sheetRide.profiles?.vehicle_model || 'Car'} · {sheetRide.vehicle_number || sheetRide.profiles?.vehicle_number || '—'}
                    </div>
                  </div>

                  {/* Route */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6' }} />
                        <div style={{ width: 2, height: 20, background: '#e2e8f0' }} />
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>{sheetRide.from_location}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{sheetRide.to_location}</div>
                      </div>
                    </div>
                    {sheetRide.route_description && (
                      <div style={{ background: '#f0f9ff', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                        <span style={{ fontSize: 13 }}>🛣️</span>
                        <div>
                          <div style={{ fontSize: 10, color: '#0284c7', fontWeight: 700 }}>VIA</div>
                          <div style={{ fontSize: 13, color: '#0369a1', fontWeight: 600 }}>{sheetRide.route_description}</div>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>Time</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{formatTime(sheetRide.ride_time)}</div>
                      </div>
                      <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>Date</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{new Date(sheetRide.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                      </div>
                      <div style={{ flex: 1, background: '#f8fafc', borderRadius: 10, padding: '8px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>Seats</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{sheetRide.seats_available} left</div>
                      </div>
                    </div>
                  </div>

                  {/* Fare + fee */}
                  <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '10px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 22, fontWeight: 900, color: '#15803d' }}>₹{sheetRide.fare}</div>
                      <div style={{ fontSize: 10, color: '#86efac' }}>per seat</div>
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'right' }}>
                      + ₹2 platform fee<br/>from wallet
                    </div>
                  </div>

                  {/* Book button */}
                  <button
                    onClick={() => handleBook(sheetRide)}
                    disabled={booking}
                    style={{ width: '100%', padding: 16, background: booking ? '#e2e8f0' : 'linear-gradient(135deg,#facc15,#f59e0b)', color: '#111', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 900, cursor: booking ? 'default' : 'pointer', boxShadow: '0 6px 20px rgba(245,158,11,0.3)', letterSpacing: '-0.3px' }}>
                    {booking ? '⏳ Booking...' : `Book Now — ₹${sheetRide.fare}`}
                  </button>
                </>
              )
            })()}
          </div>
        </div>
      )}

      <BottomNav />
      <GuidedTour />
      {selectedDriver && <DriverProfileModal driverId={selectedDriver} onClose={() => setSelectedDriver(null)} />}
    </div>
  )
}

// ── COMPACT RIDE CARD (other rides) ──
function CompactRideCard({ ride, onTap, getCompanyFromEmail }) {
  const emailForBadge = ride.profiles?.work_email_verified ? ride.profiles?.work_email : ride.profiles?.email
  const co = getCompanyFromEmail(emailForBadge)
  const initials = ride.profiles?.full_name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
  const seatsLeft = ride.seats_available || 0
  const seatsColor = seatsLeft === 1 ? '#ef4444' : seatsLeft === 2 ? '#f97316' : '#16a34a'

  return (
    <div
      onClick={onTap}
      style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', marginBottom: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.06)', cursor: 'pointer', border: '1px solid #f1f5f9', transition: '0.15s' }}
    >
      {/* Driver row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 11, flexShrink: 0, overflow: 'hidden' }}>
          {ride.profiles?.avatar_url ? <img src={ride.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', WebkitTouchCallout: 'none' }} /> : initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 5 }}>
            {ride.profiles?.full_name}
            {ride.profiles?.is_verified && <span style={{ color: '#3b82f6', fontSize: 10 }}>✓</span>}
            {co && <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', fontSize: 9, padding: '1px 6px', borderRadius: 6, fontWeight: 700 }}>{co.name}</span>}
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>
            {formatTime(ride.ride_time)} · {new Date(ride.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            {ride.profiles?.avg_rating > 0 && <span style={{ marginLeft: 6, color: '#f59e0b' }}>⭐ {Number(ride.profiles.avg_rating).toFixed(1)}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>₹{ride.fare}</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: seatsColor }}>{seatsLeft} seat{seatsLeft !== 1 ? 's' : ''}</div>
        </div>
      </div>
      {/* Route */}
      <div style={{ background: '#f8fafc', borderRadius: 8, padding: '7px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: '#334155', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ride.from_location}</span>
          <span style={{ fontSize: 10, color: '#94a3b8' }}>→</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#334155', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{ride.to_location}</span>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
        </div>
        {ride.route_description && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, paddingTop: 4, borderTop: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: 9, color: '#94a3b8', flexShrink: 0 }}>via</span>
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ride.route_description}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MY RIDE CARD (driver's own posted ride — slightly bigger) ──
function MyRideCard({ ride, navigate, getCompanyFromEmail }) {
  const seatsLeft = ride.seats_available || 0
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: '14px 14px', marginBottom: 10, border: '2px solid #facc15', boxShadow: '0 2px 12px rgba(250,204,21,0.15)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ background: '#facc15', color: '#111', fontSize: 9, fontWeight: 900, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.5px' }}>⭐ YOUR POSTED RIDE</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => navigate(`/edit-ride/${ride.id}`)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#475569', cursor: 'pointer', fontWeight: 600 }}>Edit</button>
          <span style={{ background: ride.status === 'full' ? '#fef2f2' : '#f0fdf4', color: ride.status === 'full' ? '#ef4444' : '#16a34a', fontSize: 10, padding: '4px 8px', borderRadius: 8, fontWeight: 700 }}>
            {ride.status === 'full' ? '● Full' : `${seatsLeft} left`}
          </span>
        </div>
      </div>
      {/* Route */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} />
          <span style={{ width: 1.5, height: 14, background: '#e2e8f0' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>{ride.from_location}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{ride.to_location}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>₹{ride.fare}</div>
          <div style={{ fontSize: 10, color: '#94a3b8' }}>per seat</div>
        </div>
      </div>
      {/* Meta */}
      <div style={{ display: 'flex', gap: 6 }}>
        <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#475569', fontWeight: 600 }}>🕐 {formatTime(ride.ride_time)}</span>
        <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#475569', fontWeight: 600 }}>📅 {new Date(ride.ride_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
        <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: '#475569', fontWeight: 600 }}>💺 {seatsLeft}/{ride.seats_total || 3}</span>
      </div>
    </div>
  )
}
