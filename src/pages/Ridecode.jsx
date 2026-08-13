import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Resolves a short ride code (e.g. /r/A7X9K2) to the actual ride and forwards
// to the normal booking page. Keeps shared links clean without duplicating the
// booking logic — this is just a pretty front door.
export default function RideCode() {
  const { code } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function resolve() {
      const clean = (code || '').trim().toUpperCase()
      const { data, error: err } = await supabase
        .from('rides')
        .select('id')
        .eq('ride_code', clean)
        .maybeSingle()
      if (cancelled) return
      if (err || !data) {
        setError('This ride link is invalid or the ride was removed.')
        return
      }
      navigate(`/book/${data.id}`, { replace: true })
    }
    resolve()
    return () => { cancelled = true }
  }, [code, navigate])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f5f6fa', padding: 24, textAlign: 'center' }}>
      {error ? (
        <>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚗</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 6 }}>Ride not found</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>{error}</div>
          <button onClick={() => navigate('/')} style={{ padding: '10px 20px', background: '#111', color: '#facc15', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Browse rides
          </button>
        </>
      ) : (
        <div style={{ color: '#888', fontSize: 14 }}>Opening ride…</div>
      )}
    </div>
  )
}
