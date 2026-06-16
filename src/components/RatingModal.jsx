import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Display stars (read-only)
export function StarDisplay({ rating, size = 14, showNumber = true }) {
  const stars = Math.round(rating || 0)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {[1,2,3,4,5].map(i => (
        <span key={i} style={{ fontSize: size, color: i <= stars ? '#facc15' : '#e5e7eb' }}>★</span>
      ))}
      {showNumber && rating > 0 && (
        <span style={{ fontSize: size - 2, color: '#888', fontWeight: 600, marginLeft: 2 }}>
          {Number(rating).toFixed(1)}
        </span>
      )}
    </span>
  )
}

// Rating modal — shows after ride
export function RatingModal({ booking, rideOwner, onClose }) {
  const { user } = useAuth()
  const [stars, setStars] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function submitRating() {
    if (stars === 0) return
    setLoading(true)
    const { error } = await supabase.from('ratings').insert({
      booking_id: booking.id,
      rated_by: user.id,
      rated_user: rideOwner.id,
      ride_id: booking.ride_id,
      stars,
      comment: comment || null,
    })
    if (!error) {
      // Recalculate rated user's average
      const { data: allRatings } = await supabase
        .from('ratings').select('stars').eq('rated_user', rideOwner.id)
      if (allRatings && allRatings.length > 0) {
        const avg = allRatings.reduce((s, r) => s + r.stars, 0) / allRatings.length
        await supabase.from('profiles').update({
          avg_rating: Math.round(avg * 10) / 10,
          total_ratings: allRatings.length,
        }).eq('id', rideOwner.id)
      }
      setDone(true)
    }
    setLoading(false)
  }

  if (done) return (
    <div style={overlayStyle}>
      <div style={sheetStyle}>
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 56 }}>⭐</div>
          <div style={{ fontWeight: 800, fontSize: 20, marginTop: 8 }}>Thanks for rating!</div>
          <div style={{ color: '#888', fontSize: 13, marginTop: 4 }}>Your feedback helps build trust</div>
          <button onClick={onClose} style={btnStyle}>Done</button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={overlayStyle}>
      <div style={sheetStyle}>
        <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 4, margin: '0 auto 20px' }} />
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>
            {rideOwner?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>Rate your ride with</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#111' }}>{rideOwner?.full_name}</div>
        </div>

        {/* Stars */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
          {[1,2,3,4,5].map(i => (
            <button key={i}
              onClick={() => setStars(i)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(0)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 40, color: i <= (hover || stars) ? '#facc15' : '#e5e7eb',
                transition: 'color 0.1s',
              }}>★</button>
          ))}
        </div>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#888', marginBottom: 16 }}>
          {['', 'Poor', 'Below Average', 'Average', 'Good', 'Excellent!'][hover || stars]}
        </div>

        <textarea
          placeholder="Add a comment (optional)..."
          value={comment}
          onChange={e => setComment(e.target.value)}
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 10,
            border: '1.5px solid #e5e7eb', fontSize: 13, resize: 'none',
            height: 80, fontFamily: 'inherit', boxSizing: 'border-box',
            marginBottom: 14,
          }}
        />

        <button onClick={submitRating} disabled={stars === 0 || loading} style={{
          ...btnStyle,
          opacity: stars === 0 ? 0.5 : 1,
        }}>
          {loading ? 'Submitting...' : '⭐ Submit Rating'}
        </button>

        <button onClick={onClose} style={{
          width: '100%', padding: 12, background: 'none', border: 'none',
          color: '#aaa', fontSize: 13, cursor: 'pointer', marginTop: 4,
        }}>Skip for now</button>
      </div>
    </div>
  )
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
}
const sheetStyle = {
  background: '#fff', borderRadius: '20px 20px 0 0',
  width: '100%', maxWidth: 480, padding: '20px 20px 40px',
}
const btnStyle = {
  width: '100%', padding: 14, background: '#111', color: '#fff',
  border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700,
  cursor: 'pointer', marginTop: 4,
}
