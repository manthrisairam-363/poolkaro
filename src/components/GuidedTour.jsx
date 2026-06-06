import { useState, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function GuidedTour() {
  const { user } = useAuth()
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [animIn, setAnimIn] = useState(false)
  const [hlRect, setHlRect] = useState(null)
  const [ttPos, setTtPos] = useState({})
  const TOUR_KEY = user ? `ck_tour_${user.id}` : null

  const steps = [
    {
      elId: 'tour-header',
      emoji: '👋', tag: 'WELCOME', color: '#6366f1',
      title: 'Your Location & Greeting',
      desc: 'The app shows your city and greets you by name. Tap your avatar (top right) to access your profile and settings.',
      radius: 14,
    },
    {
      elId: 'tour-tabs',
      emoji: '🔍', tag: 'DISCOVER', color: '#0891b2',
      title: 'Filter Rides Fast',
      desc: 'Tap Office for morning rides. Home for evening rides. Requests tab shows riders looking for a car on your route.',
      radius: 24,
    },
    {
      elId: 'tour-post',
      emoji: '🚗', tag: 'EARN', color: '#facc15',
      title: 'Post a Ride & Earn',
      desc: 'Tap + to offer seats on your commute. Set Mon–Fri repeat — post once and you\'re done for the whole week!',
      radius: 16,
      navItem: true,
    },
    {
      elId: 'tour-wallet',
      emoji: '💰', tag: 'WALLET', color: '#16a34a',
      title: 'Your Wallet',
      desc: 'You started with ₹10 free! Each booking costs just ₹2. Go Pro from ₹79/month for zero fees on every ride.',
      radius: 16,
      navItem: true,
    },
    {
      elId: 'tour-profile',
      emoji: '⭐', tag: 'LAST STEP', color: '#f59e0b',
      title: 'Get Your Company Badge',
      desc: 'Verify your work email in Profile to earn your company badge. Verified users get 3× more ride matches!',
      radius: 16,
      navItem: true,
      last: true,
    },
  ]

  useEffect(() => {
    if (!TOUR_KEY) return
    if (!localStorage.getItem(TOUR_KEY)) {
      setTimeout(() => { setActive(true); setTimeout(() => setAnimIn(true), 80) }, 1500)
    }
  }, [TOUR_KEY])

  useEffect(() => {
    if (active) setTimeout(() => position(step), 200)
  }, [active, step])

  function position(i) {
    const el = document.getElementById(steps[i].elId)
    if (!el) {
      i < steps.length - 1 ? setStep(i + 1) : endTour()
      return
    }
    const r = el.getBoundingClientRect()
    const s = steps[i]
    // Extra padding for nav items so highlight looks clean
    const pad = s.navItem ? 8 : 6

    setHlRect({
      top: r.top - pad, left: r.left - pad,
      width: r.width + pad * 2, height: r.height + pad * 2,
      radius: s.radius || 14,
    })

    // Tooltip position
    const ttW = Math.min(300, window.innerWidth - 32)
    const isBottom = r.top > window.innerHeight * 0.55
    let ttTop = isBottom ? r.top - 210 : r.bottom + 14
    const ttLeft = Math.max(16, Math.min(window.innerWidth - ttW - 16, r.left + r.width / 2 - ttW / 2))
    ttTop = Math.max(80, Math.min(window.innerHeight - 220, ttTop))

    setTtPos({ top: ttTop, left: ttLeft, width: ttW })
  }

  function goNext() {
    setAnimIn(false)
    setTimeout(() => {
      step < steps.length - 1 ? setStep(s => s + 1) : endTour()
      setTimeout(() => setAnimIn(true), 120)
    }, 220)
  }

  function endTour() {
    setAnimIn(false)
    setTimeout(() => {
      setActive(false)
      if (TOUR_KEY) localStorage.setItem(TOUR_KEY, 'true')
    }, 350)
  }

  if (!active || !hlRect) return null
  const s = steps[step]

  return (
    <>
      {/* ── DARK OVERLAY (two halves above and below highlight) ── */}
      {/* Top dark area */}
      <div onClick={endTour} style={{
        position: 'fixed', zIndex: 9998,
        top: 0, left: 0, right: 0,
        height: hlRect.top,
        background: 'rgba(0,0,0,0.8)',
        transition: 'height 0.35s ease',
      }} />
      {/* Bottom dark area */}
      <div onClick={endTour} style={{
        position: 'fixed', zIndex: 9998,
        top: hlRect.top + hlRect.height,
        left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.8)',
        transition: 'top 0.35s ease',
      }} />
      {/* Left dark area */}
      <div onClick={endTour} style={{
        position: 'fixed', zIndex: 9998,
        top: hlRect.top, left: 0,
        width: hlRect.left,
        height: hlRect.height,
        background: 'rgba(0,0,0,0.8)',
        transition: 'all 0.35s ease',
      }} />
      {/* Right dark area */}
      <div onClick={endTour} style={{
        position: 'fixed', zIndex: 9998,
        top: hlRect.top, left: hlRect.left + hlRect.width,
        right: 0, height: hlRect.height,
        background: 'rgba(0,0,0,0.8)',
        transition: 'all 0.35s ease',
      }} />

      {/* ── HIGHLIGHT BORDER around focused element ── */}
      <div style={{
        position: 'fixed', zIndex: 9999, pointerEvents: 'none',
        top: hlRect.top, left: hlRect.left,
        width: hlRect.width, height: hlRect.height,
        borderRadius: hlRect.radius,
        border: `2px solid ${s.color}`,
        boxShadow: `0 0 0 1px ${s.color}44, 0 0 24px ${s.color}55`,
        transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
        animation: 'ringPulse 2s ease-in-out infinite',
      }} />

      {/* Corner accent dots */}
      {[
        { top: hlRect.top - 4, left: hlRect.left - 4 },
        { top: hlRect.top - 4, left: hlRect.left + hlRect.width - 3 },
        { top: hlRect.top + hlRect.height - 3, left: hlRect.left - 4 },
        { top: hlRect.top + hlRect.height - 3, left: hlRect.left + hlRect.width - 3 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: 'fixed', zIndex: 10000, pointerEvents: 'none',
          width: 7, height: 7, borderRadius: '50%',
          background: s.color, boxShadow: `0 0 8px ${s.color}`,
          transition: 'all 0.35s ease', ...pos,
        }} />
      ))}

      {/* ── TOOLTIP CARD ── */}
      <div style={{
        position: 'fixed', zIndex: 10001,
        top: ttPos.top, left: ttPos.left, width: ttPos.width,
        opacity: animIn ? 1 : 0,
        transform: animIn ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)',
        transition: 'all 0.35s cubic-bezier(0.34,1.4,0.64,1)',
        background: '#fff', borderRadius: 22,
        overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.05)',
      }}>
        {/* Coloured header */}
        <div style={{ background: `${s.color}12`, borderBottom: `1px solid ${s.color}20`, padding: '14px 18px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: `${s.color}18`, border: `1.5px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            {s.emoji}
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: s.color, marginBottom: 3, textTransform: 'uppercase' }}>{s.tag}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1.2, fontFamily: 'system-ui' }}>{s.title}</div>
          </div>
          {/* Step counter */}
          <div style={{ marginLeft: 'auto', flexShrink: 0, background: `${s.color}15`, borderRadius: 100, padding: '3px 10px', fontSize: 10, fontWeight: 700, color: s.color }}>
            {step + 1} / {steps.length}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '14px 18px 16px' }}>
          <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.7, marginBottom: 16 }}>{s.desc}</p>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Progress bar */}
            <div style={{ flex: 1, marginRight: 16 }}>
              <div style={{ height: 3, background: '#f1f5f9', borderRadius: 100, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 100,
                  background: `linear-gradient(90deg, ${s.color}, ${s.color}aa)`,
                  width: `${((step + 1) / steps.length) * 100}%`,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>
                {step < steps.length - 1 ? `${steps.length - step - 1} more steps` : 'Last step!'}
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              {!s.last && (
                <button onClick={endTour} style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: 12, cursor: 'pointer', padding: '7px 10px', borderRadius: 8, fontFamily: 'inherit', fontWeight: 500 }}>
                  Skip
                </button>
              )}
              <button onClick={goNext} style={{
                background: `linear-gradient(135deg, ${s.color} 0%, ${s.color}cc 100%)`,
                color: s.color === '#facc15' || s.color === '#16a34a' ? '#fff' : '#fff',
                border: 'none', borderRadius: 100, padding: '10px 20px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 5,
                boxShadow: `0 4px 16px ${s.color}55`,
              }}>
                {s.last ? '🎉 Let\'s go!' : <>Next <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg></>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ringPulse {
          0%,100% { box-shadow: 0 0 0 1px ${s.color}44, 0 0 20px ${s.color}44; }
          50%      { box-shadow: 0 0 0 3px ${s.color}22, 0 0 40px ${s.color}55; }
        }
      `}</style>
    </>
  )
}
