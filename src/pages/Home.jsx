import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'
import NotificationBell from '../components/NotificationBell'
import { formatTime, formatDate } from '../lib/utils'
import { getCompanyFromEmail } from '../lib/companyDomains'

function RideCard({ ride, onBook, myUserId }) {
  const [expanded, setExpanded] = useState(false)
  const isToOffice = ride.ride_type === 'to_office'
  const isMyRide = ride.driver_id === myUserId
  const initials = ride.profiles?.full_name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() || '?'
  const company = getCompanyFromEmail(ride.profiles?.email)

  return (
    <div style={{
      background: '#1a1a1a',
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      borderLeft: `3px solid ${isMyRide ? '#facc15' : '#333'}`,
      position: 'relative',
    }}>
      {isMyRide && (
        <div style={{ position: 'absolute', top: 12, right: 12, background: '#facc15', borderRadius: 6, padding: '2px 8px', fontSize: 9, fontWeight: 800, color: '#111' }}>
          YOUR RIDE
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: '#facc15', color: '#111',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 14, flexShrink: 0,
        }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
              {ride.profiles?.full_name || 'Car Owner'}
            </span>
            {ride.profiles?.is_verified && (
              <span style={{ background: '#3b82f6', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 6, fontWeight: 700 }}>✓</span>
            )}
            {company && (
              <span style={{ background: '#222', color: '#facc15', fontSize: 9, padding: '1px 6px', borderRadius: 6, fontWeight: 700, border: '1px solid #333' }}>
                {company.name}
              </span>
            )}
          </div>
          <div style={{ color: '#666', fontSize: 11, marginTop: 1 }}>{ride.vehicle_model}</div>
        </div>
        <span style={{
          background: isToOffice ? '#1a1a2e' : '#1a1020',
          color: isToOffice ? '#60a5fa' : '#f472b6',
          borderRadius: 20, padding: '3px 10px', fontSize: 10, fontWeight: 600,
          border: `1px solid ${isToOffice ? '#1d4ed8' : '#9d174d'}`,
        }}>{isToOffice ? '🏢 Office' : '🏠 Home'}</span>
      </div>

      {/* Route */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>FROM</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{ride.from_location}</div>
        </div>
        <div style={{ color: '#facc15', fontSize: 18 }}>→</div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>TO</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{ride.to_location}</div>
        </div>
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { icon: '🕐', val: formatTime(ride.ride_time) },
          { icon: '📅', val: formatDate(ride.ride_date) },
        ].map((item, i) => (
          <div key={i} style={{ background: '#222', borderRadius: 8, padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12 }}>{item.icon}</span>
            <span style={{ fontSize: 11, color: '#ccc', fontWeight: 500 }}>{item.val}</span>
          </div>
        ))}
        {ride.is_recurring && (
          <div style={{ background: '#1a1a2e', borderRadius: 8, padding: '5px 10px', border: '1px solid #1d4ed8' }}>
            <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 600 }}>🔁 Daily</span>
          </div>
        )}
      </div>

      {/* Route expand */}
      {expanded && ride.route_description && (
        <div style={{ background: '#222', borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 11, color: '#888' }}>
          🛣️ {ride.route_description}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ background: '#facc15', color: '#111', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 800 }}>
            ₹{ride.fare}
          </span>
          <span style={{ color: '#888', fontSize: 11 }}>
            🪑 {ride.seats_available} seat{ride.seats_available !== 1 ? 's' : ''} left
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {ride.route_description && (
            <button onClick={() => setExpanded(!expanded)} style={{
              background: '#222', border: '1px solid #333', color: '#888',
              borderRadius: 8, padding: '6px 10px', fontSize: 11, cursor: 'pointer',
            }}>
              {expanded ? '▲' : 'Route'}
            </button>
          )}
          {!isMyRide && (
            <button onClick={() => onBook(ride)} style={{
              background: '#facc15', color: '#111', border: 'none',
              borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}>
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

  const hasActiveFilters = filterFrom || filterTo || filterDate !== 'all' || filterTime !== 'all'

  useEffect(() => {
    fetchRides()
    const channel = supabase.channel('rides-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => fetchRides())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function fetchRides() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('rides')
      .select('*, profiles(full_name, vehicle_model, vehicle_number, avg_rating, is_verified, email)')
      .in('status', ['active', 'full'])
      .gte('ride_date', today)
      .order('ride_date', { ascending: true })
      .order('ride_time', { ascending: true })
    if (!error) setRides(data || [])
    setLoading(false)
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const filtered = rides.filter(r => {
    if (filter === 'to_office' && r.ride_type !== 'to_office') return false
    if (filter === 'to_home' && r.ride_type !== 'to_home') return false
    if (filterFrom && !r.from_location?.toLowerCase().includes(filterFrom.toLowerCase())) return false
    if (filterTo && !r.to_location?.toLowerCase().includes(filterTo.toLowerCase())) return false
    if (filterDate === 'today' && r.ride_date !== todayStr) return false
    if (filterDate === 'tomorrow' && r.ride_date !== tomorrowStr) return false
    if (filterTime === 'morning' && parseInt(r.ride_time?.split(':')[0] || 0) >= 12) return false
    if (filterTime === 'evening' && parseInt(r.ride_time?.split(':')[0] || 0) < 12) return false
    if (search) {
      const q = search.toLowerCase()
      return r.from_location?.toLowerCase().includes(q) || r.to_location?.toLowerCase().includes(q) || r.route_description?.toLowerCase().includes(q)
    }
    return true
  })

  const activeFilterCount = [filterFrom, filterTo, filterDate !== 'all' ? filterDate : '', filterTime !== 'all' ? filterTime : ''].filter(Boolean).length

  return (
    <div style={{ background: '#111', minHeight: '100vh', paddingBottom: 90 }}>
      {/* Sticky Header */}
      <div style={{ background: '#111', borderBottom: '1px solid #1a1a1a', padding: '16px 16px 12px', position: 'sticky', top: 0, zIndex: 40 }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px' }}>
              <span style={{ color: '#facc15' }}>Pool</span><span style={{ color: '#fff' }}>Karo</span>
            </div>
            <div style={{ color: '#555', fontSize: 11, marginTop: 1 }}>
              {profile?.full_name ? `Hey ${profile.full_name.split(' ')[0]}! 👋` : 'Hyderabad IT Carpool'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <NotificationBell />
            <button onClick={fetchRides} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, padding: '8px 12px', color: '#facc15', fontSize: 16, cursor: 'pointer' }}>
              ↺
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="Search area — Uppal, Kokapet, HITEC City..."
            style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid #222', fontSize: 12, background: '#1a1a1a', color: '#fff', boxSizing: 'border-box' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={() => setShowFilters(!showFilters)} style={{
            background: hasActiveFilters ? '#facc15' : '#1a1a1a',
            color: hasActiveFilters ? '#111' : '#888',
            border: `1px solid ${hasActiveFilters ? '#facc15' : '#333'}`,
            borderRadius: 10, padding: '10px 14px',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="4" y1="6" x2="20" y2="6"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
            {activeFilterCount > 0 && <span style={{ fontSize: 11, fontWeight: 800 }}>{activeFilterCount}</span>}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div style={{ marginTop: 10, background: '#1a1a1a', borderRadius: 12, padding: 14, border: '1px solid #222' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: '#666', marginBottom: 4, letterSpacing: 1 }}>FROM</div>
                <input placeholder="e.g. Uppal"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #333', background: '#222', color: '#fff', fontSize: 12, boxSizing: 'border-box' }}
                  value={filterFrom} onChange={e => setFilterFrom(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#666', marginBottom: 4, letterSpacing: 1 }}>TO</div>
                <input placeholder="e.g. Kokapet"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #333', background: '#222', color: '#fff', fontSize: 12, boxSizing: 'border-box' }}
                  value={filterTo} onChange={e => setFilterTo(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {[['all','Any Day'],['today','Today'],['tomorrow','Tomorrow']].map(([v,l]) => (
                <button key={v} onClick={() => setFilterDate(v)} style={{
                  padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                  background: filterDate === v ? '#facc15' : '#333',
                  color: filterDate === v ? '#111' : '#aaa', fontWeight: filterDate === v ? 700 : 400,
                }}>{l}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              {[['all','Any Time'],['morning','🌅 Morning'],['evening','🌆 Evening']].map(([v,l]) => (
                <button key={v} onClick={() => setFilterTime(v)} style={{
                  padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11,
                  background: filterTime === v ? '#facc15' : '#333',
                  color: filterTime === v ? '#111' : '#aaa', fontWeight: filterTime === v ? 700 : 400,
                }}>{l}</button>
              ))}
            </div>
            {hasActiveFilters && (
              <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterDate('all'); setFilterTime('all') }}
                style={{ width: '100%', padding: '7px', background: '#333', color: '#888', border: 'none', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>
                ✕ Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto', paddingBottom: 2 }}>
          {[['all','All Rides'],['to_office','🏢 To Office'],['to_home','🏠 To Home']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)} style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              background: filter === v ? '#facc15' : '#1a1a1a',
              color: filter === v ? '#111' : '#666',
              fontWeight: filter === v ? 700 : 400, fontSize: 12,
              border: `1px solid ${filter === v ? '#facc15' : '#333'}`,
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Ride list */}
      <div style={{ padding: '12px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#555' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🚗</div>
            Loading rides...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <div style={{ color: '#fff', fontWeight: 600 }}>No rides found</div>
            <div style={{ color: '#555', fontSize: 13, marginTop: 6 }}>
              {search ? `No rides matching "${search}"` : 'No rides posted yet'}
            </div>
            <button onClick={() => navigate('/post')} style={{ marginTop: 16, padding: '10px 20px', background: '#facc15', color: '#111', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              + Post a Ride
            </button>
          </div>
        ) : (
          filtered.map(ride => <RideCard key={ride.id} ride={ride} onBook={r => navigate(`/book/${r.id}`)} myUserId={user?.id} />)
        )}
      </div>

      <BottomNav />
    </div>
  )
}
