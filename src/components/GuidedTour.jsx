import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function GuidedTour() {
  const { user } = useAuth()
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [hlStyle, setHlStyle] = useState({})
  const [ttStyle, setTtStyle] = useState({})
  const [visible, setVisible] = useState(false)

  // User-specific key so different accounts each get their own tour
  const TOUR_KEY = user ? `ck_tour_${user.id}` : null

  const steps = [
    { elId: 'tour-header',  title: 'Your Location & Greeting',   desc: 'Shows your city. Tap your avatar (top right) to visit your profile and settings.' },
    { elId: 'tour-tabs',    title: 'Filter Rides Fast',           desc: 'Tap Office for morning rides. Home for evening rides. Requests to see riders who need a car.' },
    { elId: 'tour-post',    title: 'Post a Ride in 30 Seconds',   desc: 'Tap + to offer seats in your car. Set route, time and fare. Use Mon–Fri repeat — post once, done for the week!', round: true },
    { elId: 'tour-wallet',  title: 'Your Wallet',                 desc: 'You started with ₹10 free! Each booking costs just ₹2. Upgrade to Pro for zero platform fees.' },
    { elId: 'tour-profile', title: 'Verify Your Work Email',      desc: 'Go to Profile → verify work email to get a company badge. Builds trust with co-riders.', last: true },
  ]

  useEffect(() => {
    if (!TOUR_KEY) return
    const seen = localStorage.getItem(TOUR_KEY)
    if (!seen) {
      setTimeout(() => setActive(true), 1500)
    }
  }, [TOUR_KEY])

  useEffect(() => {
    if (active) setTimeout(() => positionStep(step), 150)
  }, [active, step])

  function positionStep(i) {
    const s = steps[i]
    const el = document.getElementById(s.elId)

    // Element not found → skip to next step
    if (!el) {
      if (i < steps.length - 1) {
        setStep(i + 1)
      } else {
        endTour()
      }
      return
    }

    const rect = el.getBoundingClientRect()
    const pad = 6

    setHlStyle({
      position: 'fixed',
      top: rect.top - pad,
      left: rect.left - pad,
      width: rect.width + pad * 2,
      height: rect.height + pad * 2,
      borderRadius: s.round ? '50%' : 14,
    })

    const ttWidth = Math.min(270, window.innerWidth - 32)
    const isBottom = rect.top < window.innerHeight * 0.55
    let ttTop = isBottom
      ? rect.bottom + pad + 12
      : rect.top - pad - 175

    const ttLeft = Math.max(16, Math.min(window.innerWidth - ttWidth - 16, rect.left + rect.width / 2 - ttWidth / 2))
    ttTop = Math.max(80, Math.min(window.innerHeight - 210, ttTop))

    setTtStyle({ position: 'fixed', top: ttTop, left: ttLeft, width: ttWidth })
    setVisible(false)
    setTimeout(() => setVisible(true), 60)
  }

  function goNext() {
    setVisible(false)
    setTimeout(() => {
      if (step < steps.length - 1) {
        setStep(s => s + 1)
      } else {
        endTour()
      }
    }, 250)
  }

  function endTour() {
    setVisible(false)
    setTimeout(() => {
      setActive(false)
      if (TOUR_KEY) localStorage.setItem(TOUR_KEY, 'true')
    }, 300)
  }

  if (!active) return null

  const s = steps[step]

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={endTour}
        style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.72)' }}
      />

      {/* Highlight ring */}
      <div style={{
        ...hlStyle, zIndex: 9999, pointerEvents: 'none',
        boxShadow: '0 0 0 4px rgba(250,204,21,0.9)',
        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
      }} />

      {/* Tooltip */}
      <div style={{
        ...ttStyle, zIndex: 10000,
        background: '#fff', borderRadius: 18, padding: 18,
        boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(0.92)',
        transition: 'all 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, marginBottom: 5 }}>
          STEP {step + 1} OF {steps.length}
        </div>
        <div style={{ fontFamily: 'system-ui', fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
          {s.title}
        </div>
        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 14 }}>
          {s.desc}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 4 }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                height: 5, borderRadius: 100,
                background: i === step ? '#0f172a' : '#e2e8f0',
                width: i === step ? 16 : 5,
                transition: '0.3s',
              }} />
            ))}
          </div>
          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={endTour} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}>
              Skip
            </button>
            <button onClick={goNext} style={{
              background: '#0f172a', color: '#facc15', border: 'none',
              borderRadius: 100, padding: '8px 16px', fontSize: 12,
              fontWeight: 700, cursor: 'pointer',
            }}>
              {s.last ? '🎉 Got it!' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
