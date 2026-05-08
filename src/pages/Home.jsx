import { useState, useEffect } from 'react'
import { formatTime, formatDate } from '../lib/utils'
import { getCompanyFromEmail } from '../lib/companyDomains'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'
import NotificationBell from '../components/NotificationBell'

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
        <div style={{
          width: 42, height: 42, borderRadius: '50%', background: color,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 15, flexShrink: 0,
        }}>{initials}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {ride.profiles?.full_name || 'Car Owner'}
              {ride.profiles?.is_verified && <span style={{ background: '#1d4ed8', color: '#fff', fontSize: 9, padding: '2px 5px', borderRadius: 8, fontWeight: 700 }}>✓</span>}
              {(() => { const co = getCompanyFromEmail(ride.profiles?.email); return co ? <span style={{ background: co.bg, color: co.color, fontSize: 9, padding: '2px 6px', borderRadius: 8, fontWeight: 700 }}>{co.name}</span> : null })()}
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
            🪑 {ride.seats_available} seat{ride.seats_available !== 1 ? 's' : ''} left
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
        Includes ₹2 PoolKaro platform fee
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

  useEffect(() => {
    fetchRides()

    // Realtime: auto-refresh when any ride changes
    const channel = supabase
      .channel('rides-changes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'rides'
      }, () => {
        fetchRides() // auto-refresh home when seats change
      })
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

  const filtered = rides.filter(r => {
    if (filter === 'to_office' && r.ride_type !== 'to_office') return false
    if (filter === 'to_home' && r.ride_type !== 'to_home') return false
    if (search) {
      const q = search.toLowerCase()
      return r.from_location?.toLowerCase().includes(q) || r.to_location?.toLowerCase().includes(q) || r.route_description?.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div style={{ background: '#f5f6fa', minHeight: '100vh', paddingBottom: 90 }}>
      <div style={{ background: '#111', padding: '20px 16px 14px', position: 'sticky', top: 0, zIndex: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 22, letterSpacing: '-0.5px' }}>
              <span style={{ color: '#facc15' }}>Pool</span>Karo
            </div>
            <div style={{ color: '#666', fontSize: 11, marginTop: 1 }}>
              {profile?.full_name ? `Hey ${profile.full_name.split(' ')[0]}! 👋` : 'Hyderabad IT Carpool'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <NotificationBell />
            <button onClick={fetchRides} style={{ background: '#222', border: 'none', borderRadius: 10, padding: '8px 12px', color: '#facc15', fontSize: 16, cursor: 'pointer' }}>
              ↺
            </button>
          </div>
        </div>
        <input
          placeholder="Search area (Uppal, Kokapet, Madhapur...)"
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', fontSize: 13, background: '#222', color: '#fff', boxSizing: 'border-box' }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div style={{ padding: '12px 16px 6px', display: 'flex', gap: 8 }}>
        {[['all','All Rides'],['to_office','🏢 To Office'],['to_home','🏠 To Home']].map(([v,l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: filter === v ? '#111' : '#fff',
            color: filter === v ? '#fff' : '#555',
            fontWeight: filter === v ? 700 : 400, fontSize: 12,
            boxShadow: filter === v ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
          }}>{l}</button>
        ))}
      </div>

      <div style={{ padding: '8px 16px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🚗</div>
            Loading rides...
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
    </div>
  )
}
