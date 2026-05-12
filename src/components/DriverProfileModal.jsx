import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCompanyFromEmail } from '../lib/companyDomains'

export default function DriverProfileModal({ driverId, onClose }) {
  const [driver, setDriver] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ridesGiven, setRidesGiven] = useState(0)

  useEffect(() => {
    if (!driverId) return
    fetchDriver()
  }, [driverId])

  async function fetchDriver() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', driverId)
      .maybeSingle()

    const { count } = await supabase
      .from('rides')
      .select('*', { count: 'exact', head: true })
      .eq('driver_id', driverId)
      .eq('status', 'completed')

    setDriver(data)
    setRidesGiven(count || 0)
    setLoading(false)
  }

  if (!driverId) return null

  const initials = driver?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
  const company = getCompanyFromEmail(driver?.work_email_verified ? driver?.work_email : driver?.email)

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 100, display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: '20px 20px 0 0',
        padding: '20px 16px 40px', width: '100%', maxWidth: 480,
        margin: '0 auto', maxHeight: '80vh', overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 2, margin: '0 auto 20px' }} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading profile...</div>
        ) : driver ? (
          <>
            {/* Avatar + Name */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: '#facc15', color: '#111',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 26, margin: '0 auto 12px',
              }}>{initials}</div>
              <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>
                {driver.full_name}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {driver.is_verified && (
                  <span style={{ background: '#1d4ed8', color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>✓ Verified</span>
                )}
                {driver.work_email_verified && company && (
                  <span style={{ background: company.bg, color: company.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>🏢 {company.name}</span>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { icon: '🚗', val: driver.total_rides_given || ridesGiven, label: 'Rides Given' },
                { icon: '⭐', val: driver.avg_rating > 0 ? Number(driver.avg_rating).toFixed(1) : '—', label: `${driver.total_ratings || 0} ratings` },
                { icon: '🌿', val: `${((driver.total_rides_given || 0) * 2.1).toFixed(0)}kg`, label: 'CO₂ Saved' },
              ].map(item => (
                <div key={item.label} style={{ background: '#f8f9fa', borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20 }}>{item.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 16, marginTop: 4 }}>{item.val}</div>
                  <div style={{ fontSize: 9, color: '#888', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>

            {/* Vehicle info */}
            {driver.vehicle_model && (
              <div style={{ background: '#f8f9fa', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>VEHICLE</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>🚘 {driver.vehicle_model}</div>
                {driver.vehicle_number && (
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{driver.vehicle_number}</div>
                )}
              </div>
            )}

            {/* Work email verified */}
            {driver.work_email_verified && driver.work_email && (
              <div style={{ background: '#f0fdf4', borderRadius: 12, padding: '12px 14px', marginBottom: 12, border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>VERIFIED WORK EMAIL</div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#16a34a' }}>
                  ✓ {driver.work_email}
                </div>
              </div>
            )}

            {/* Role */}
            <div style={{ textAlign: 'center', fontSize: 12, color: '#888', marginBottom: 16 }}>
              {driver.role === 'driver' ? '🚗 Car Owner' : driver.role === 'rider' ? '🙋 Co-rider' : '🔄 Car Owner & Co-rider'} · Member since {new Date(driver.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </div>

            <button onClick={onClose} style={{
              width: '100%', padding: 14, background: '#111', color: '#fff',
              border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}>
              Close
            </button>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Profile not found</div>
        )}
      </div>
    </div>
  )
}
