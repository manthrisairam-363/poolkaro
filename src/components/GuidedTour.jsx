import { useState, useEffect } from 'react'

const TOUR_KEY = 'carpoolkaro_tour_seen'

const steps = [
  {
    elId: 'tour-header',
    title: 'Your Location & Greeting',
    desc: 'The app shows your city. Tap your avatar (top right) to go to your profile and settings.',
    pos: 'bottom',
  },
  {
    elId: 'tour-tabs',
    title: 'Filter Rides Fast',
    desc: 'Tap "Office" for morning rides to work. "Home" for evening rides back. "Requests" to see riders needing a car.',
    pos: 'bottom',
  },
  {
    elId: 'tour-ridecard',
    title: 'Tap Any Ride Card',
    desc: 'Tap a card to see full driver details, vehicle, route and the Book Now button. Company badges show verified IT colleagues.',
    pos: 'bottom',
  },
  {
    elId: 'tour-post',
    title: 'Post a Ride in 30 Seconds',
    desc: 'Tap here to offer seats in your car. Set route, time and fare. Use Mon–Fri repeat — post once, done for the week!',
    pos: 'top',
    round: true,
  },
  {
    elId: 'tour-wallet',
    title: 'Your Wallet',
    desc: 'You started with ₹10 free bonus! Each booking costs just ₹2. Upgrade to Pro for zero platform fees.',
    pos: 'top',
  },
  {
    elId: 'tour-profile',
    title: 'Your Profile',
    desc: 'Verify your work email to get a company badge. The badge builds trust with other riders and drivers.',
    pos: 'top',
    last: true,
  },
]

export default function GuidedTour() {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [hlStyle, setHlStyle] = useState({})
  const [ttStyle, setTtStyle] = useState({})
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(TOUR_KEY)
    if (!seen) {
      // Small delay so app has rendered
      setTimeout(() => setActive(true), 1000)
    }
  }, [])

  useEffect(() => {
    if (active) {
      setTimeout(() => positionStep(step), 100)
    }
  }, [active, step])

  function positionStep(i) {
    const s = steps[i]
    const el = document.getElementById(s.elId)
    if (!el) return

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

    // Tooltip positioning
    const ttWidth = Math.min(270, window.innerWidth - 32)
    let ttTop, ttLeft

    if (s.pos === 'bottom') {
      ttTop = rect.bottom + pad + 12
    } else {
      ttTop = rect.top - pad - 170
    }

    ttLeft = Math.max(16, Math.min(window.innerWidth - ttWidth - 16, rect.left + rect.width / 2 - ttWidth / 2))
    ttTop = Math.max(80, Math.min(window.innerHeight - 200, ttTop))

    setTtStyle({ position: 'fixed', top: ttTop, left: ttLeft, width: ttWidth })
    setVisible(false)
    setTimeout(() => setVisible(true), 50)
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
      localStorage.setItem(TOUR_KEY, 'true')
    }, 300)
  }

  if (!active) return null

  const s = steps[step]

  return (
    <>
      {/* Dark overlay */}
      <div
        onClick={endTour}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.75)',
          transition: '0.3s',
        }}
      />

      {/* Highlight ring */}
      <div style={{
        ...hlStyle,
        zIndex: 9999,
        boxShadow: '0 0 0 4px rgba(250,204,21,0.9)',
        pointerEvents: 'none',
        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
      }} />

      {/* Tooltip */}
      <div style={{
        ...ttStyle,
        zIndex: 10000,
        background: '#fff',
        borderRadius: 18,
        padding: 18,
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(8px)',
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Step indicator */}
        <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 1, marginBottom: 6 }}>
          STEP {step + 1} OF {steps.length}
        </div>

        {/* Title */}
        <div style={{ fontFamily: 'system-ui', fontSize: 15, fontWeight: 800, color: '#0f172a', marginBottom: 6 }}>
          {s.title}
        </div>

        {/* Description */}
        <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6, marginBottom: 14 }}>
          {s.desc}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Dots */}
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
            <button
              onClick={endTour}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', padding: '4px 8px' }}
            >
              Skip
            </button>
            <button
              onClick={goNext}
              style={{
                background: '#0f172a', color: '#facc15',
                border: 'none', borderRadius: 100,
                padding: '8px 16px', fontSize: 12, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {s.last ? '🎉 Got it!' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
