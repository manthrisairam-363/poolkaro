import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'
import NotificationBell from '../components/NotificationBell'
import { formatTime, formatDate } from '../lib/utils'
import { getCompanyFromEmail } from '../lib/companyDomains'

function RideCard({ ride, onBook, myId }) {
  const [expanded, setExpanded] = useState(false)
  const isOffice = ride.ride_type === 'to_office'
  const isOwn = ride.driver_id === myId
  const initials = ride.profiles?.full_name?.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?'
  const company = getCompanyFromEmail(ride.profiles?.email)

  return (
    <div style={{
      background: '#1a1a1a', borderRadius: 16, padding: 16, marginBottom: 10,
      borderLeft: `3px solid ${isOwn ? '#facc15' : '#2a2a2a'}`,
    }}>
      {isOwn && (
        <div style={{ background: '#facc15', borderRadius: 6, padding: '2px 8px', fontSize: 9, fontWeight: 800, color: '#000', display: 'inline-block', marginBottom: 10 }}>
          YOUR RIDE
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#facc15', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{ride.profiles?.full_name || 'Car Owner'}</span>
            {ride.profiles?.is_verified && <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 8, padding: '1px 5px', borderRadius: 5, fontWeight: 700 }}>✓</span>}
            {company && <span style={{ background: '#222', color: '#facc15', fontSize: 8, padding: '1px 6px', borderRadius: 5, fontWeight: 700, border: '1px solid #333' }}>{company.name}</span>}
          </div>
          <div style={{ color: '#555', fontSize: 11, marginTop: 2 }}>{ride.vehicle_model} · {ride.vehicle_number}</div>
        </div>
        <span style={{ background: isOffice ? '#0f1a2e' : '#1a0f1e', color: isOffice ? '#60a5fa' : '#c084fc', borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 600, border: `1px solid ${isOffice ? '#1e3a5f' : '#3b1f5e'}`, flexShrink: 0 }}>
          {isOffice ? '🏢 Office' : '🏠 Home'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 2, letterSpacing: 0.5 }}>FROM</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{ride.from_location}</div>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#facc15', fontSize: 14, fontWeight: 800 }}>→</div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 2, letterSpacing: 0.5 }}>TO</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{ride.to_location}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          `🕐 ${formatTime(ride.ride_time)}`,
          `📅 ${formatDate(ride.ride_date)}`,
        ].map((t, i) => (
          <div key={i} style={{ background: '#222', borderRadius: 8, padding: '5px 10px', fontSize: 11, color: '#ccc' }}>{t}</div>
        ))}
        {ride.is_recurring && <div style={{ background: '#1a1a00', borderRadius: 8, padding: '5px 10px', fontSize: 11, color: '#facc15', border: '1px solid #333' }}>🔁 Daily</div>}
      </div>

      {expanded && ride.route_description && (
        <div style={{ background: '#222', borderRadius: 8, padding: '8px 12px', marginBottom: 10, fontSize: 11, color: '#888' }}>
          🛣️ {ride.route_description}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ background: '#facc15', color: '#000', borderRadius: 20, padding: '5px 14px', fontSize: 14, fontWeight: 800 }}>₹{ride.fare}</span>
          <span style={{ fontSize: 11, color: '#555' }}>🪑 {ride.seats_available} left</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {ride.route_description && (
            <button onClick={() => setExpanded(!expanded)} style={{ background: '#222', border: '1px solid #333', color: '#666', borderRadius: 8, padding: '6px 10px', fontSize: 11 }}>
              {expanded ? '▲' : '▼'}
            </button>
          )}
          {!isOwn && (
            <button onClick={() => onBook(ride)} style={{ background: '#facc15', color: '#000', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 800 }}>
              Book ₹{ride.fare + 2}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterDate, setFilterDate] = useState('all')
  const [filterTime, setFilterTime] = useState('all')

  const activeFilters = [filterFrom, filterTo, filterDate!=='all'?filterDate:'', filterTime!=='all'?filterTime:''].filter(Boolean).length

  useEffect(() => {
    fetchRides()
    const ch = supabase.channel('rides').on('postgres_changes',{event:'*',schema:'public',table:'rides'},()=>fetchRides()).subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function fetchRides() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('rides').select('*, profiles(full_name, vehicle_model, vehicle_number, avg_rating, is_verified, email)')
      .in('status',['active','full']).gte('ride_date',today)
      .order('ride_date',{ascending:true}).order('ride_time',{ascending:true})
    setRides(data||[])
    setLoading(false)
  }

  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now()+86400000).toISOString().split('T')[0]

  const filtered = rides.filter(r => {
    if (filter==='to_office'&&r.ride_type!=='to_office') return false
    if (filter==='to_home'&&r.ride_type!=='to_home') return false
    if (filterFrom&&!r.from_location?.toLowerCase().includes(filterFrom.toLowerCase())) return false
    if (filterTo&&!r.to_location?.toLowerCase().includes(filterTo.toLowerCase())) return false
    if (filterDate==='today'&&r.ride_date!==today) return false
    if (filterDate==='tomorrow'&&r.ride_date!==tomorrow) return false
    if (filterTime==='morning'&&parseInt(r.ride_time?.split(':')[0]||0)>=12) return false
    if (filterTime==='evening'&&parseInt(r.ride_time?.split(':')[0]||0)<12) return false
    if (search) { const q=search.toLowerCase(); return r.from_location?.toLowerCase().includes(q)||r.to_location?.toLowerCase().includes(q)||r.route_description?.toLowerCase().includes(q) }
    return true
  })

  const inp = { width:'100%', padding:'9px 12px', borderRadius:10, border:'1px solid #2a2a2a', background:'#161616', color:'#fff', fontSize:12, boxSizing:'border-box' }

  return (
    <div style={{ background:'#0f0f0f', minHeight:'100vh', paddingBottom:90 }}>
      <div style={{ background:'#0f0f0f', borderBottom:'1px solid #1a1a1a', padding:'16px 16px 12px', position:'sticky', top:0, zIndex:40 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:24, letterSpacing:'-0.5px' }}>
              <span style={{ color:'#facc15' }}>Pool</span><span style={{ color:'#fff' }}>Karo</span>
            </div>
            <div style={{ color:'#444', fontSize:11, marginTop:1 }}>
              {profile?.full_name ? `Welcome back, ${profile.full_name.split(' ')[0]}` : 'Hyderabad IT Carpool'}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <NotificationBell />
            <button onClick={fetchRides} style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:10, padding:'8px 12px', color:'#facc15', fontSize:16 }}>↺</button>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <input placeholder="Search Uppal, Kokapet, HITEC City..." style={{ flex:1, ...inp }} value={search} onChange={e=>setSearch(e.target.value)} />
          <button onClick={()=>setShowFilters(!showFilters)} style={{
            background: activeFilters>0?'#facc15':'#1a1a1a',
            color: activeFilters>0?'#000':'#666',
            border:`1px solid ${activeFilters>0?'#facc15':'#2a2a2a'}`,
            borderRadius:10, padding:'9px 13px', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:4, flexShrink:0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            {activeFilters>0&&<span style={{fontSize:10,fontWeight:800}}>{activeFilters}</span>}
          </button>
        </div>

        {showFilters && (
          <div style={{ background:'#1a1a1a', borderRadius:12, padding:14, border:'1px solid #2a2a2a', marginBottom:10 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
              <div>
                <div style={{ fontSize:9, color:'#555', marginBottom:4, letterSpacing:1 }}>FROM</div>
                <input placeholder="e.g. Uppal" style={inp} value={filterFrom} onChange={e=>setFilterFrom(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize:9, color:'#555', marginBottom:4, letterSpacing:1 }}>TO</div>
                <input placeholder="e.g. Kokapet" style={inp} value={filterTo} onChange={e=>setFilterTo(e.target.value)} />
              </div>
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
              {[['all','Any Day'],['today','Today'],['tomorrow','Tomorrow']].map(([v,l])=>(
                <button key={v} onClick={()=>setFilterDate(v)} style={{ padding:'5px 12px', borderRadius:20, border:'none', fontSize:11, background:filterDate===v?'#facc15':'#222', color:filterDate===v?'#000':'#666', fontWeight:filterDate===v?700:400 }}>{l}</button>
              ))}
            </div>
            <div style={{ display:'flex', gap:6, marginBottom:activeFilters>0?10:0 }}>
              {[['all','Any Time'],['morning','🌅 Morning'],['evening','🌆 Evening']].map(([v,l])=>(
                <button key={v} onClick={()=>setFilterTime(v)} style={{ padding:'5px 12px', borderRadius:20, border:'none', fontSize:11, background:filterTime===v?'#facc15':'#222', color:filterTime===v?'#000':'#666', fontWeight:filterTime===v?700:400 }}>{l}</button>
              ))}
            </div>
            {activeFilters>0&&<button onClick={()=>{setFilterFrom('');setFilterTo('');setFilterDate('all');setFilterTime('all')}} style={{ width:'100%', padding:'7px', background:'#222', color:'#666', border:'none', borderRadius:8, fontSize:12 }}>✕ Clear All</button>}
          </div>
        )}

        <div style={{ display:'flex', gap:6 }}>
          {[['all','All'],['to_office','🏢 To Office'],['to_home','🏠 To Home']].map(([v,l])=>(
            <button key={v} onClick={()=>setFilter(v)} style={{ padding:'5px 14px', borderRadius:20, border:`1px solid ${filter===v?'#facc15':'#2a2a2a'}`, background:filter===v?'#facc15':'transparent', color:filter===v?'#000':'#555', fontWeight:filter===v?700:400, fontSize:12 }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:'12px 16px' }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:60, color:'#333' }}>
            <div style={{ fontSize:32 }}>🚗</div>
            <div style={{ marginTop:8, color:'#444' }}>Loading rides...</div>
          </div>
        ) : filtered.length===0 ? (
          <div style={{ textAlign:'center', padding:60 }}>
            <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
            <div style={{ color:'#fff', fontWeight:600 }}>No rides found</div>
            <div style={{ color:'#444', fontSize:13, marginTop:6 }}>{search?`No rides for "${search}"`:'No rides posted yet'}</div>
            <button onClick={()=>navigate('/post')} style={{ marginTop:16, padding:'10px 24px', background:'#facc15', color:'#000', border:'none', borderRadius:10, fontWeight:800, fontSize:13 }}>+ Post a Ride</button>
          </div>
        ) : filtered.map(ride=><RideCard key={ride.id} ride={ride} onBook={r=>navigate(`/book/${r.id}`)} myId={user?.id} />)}
      </div>

      <BottomNav />
    </div>
  )
}
