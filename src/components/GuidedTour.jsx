import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../lib/AuthContext'

export default function GuidedTour() {
  const { user } = useAuth()
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [animIn, setAnimIn] = useState(false)
  const [hlRect, setHlRect] = useState(null)
  const [ttPos, setTtPos] = useState({ top: 0, left: 0 })
  const TOUR_KEY = user ? `ck_tour_${user.id}` : null

  const steps = [
    {
      elId: 'tour-header',
      emoji: '👋',
      tag: 'WELCOME',
      title: 'Good to have you here!',
      desc: 'Your city and greeting are shown here. Tap your avatar anytime to access profile, settings and Pro subscription.',
      color: '#6366f1',
      bg: 'rgba(99,102,241,0.08)',
    },
    {
      elId: 'tour-tabs',
      emoji: '🔍',
      tag: 'DISCOVER',
      title: 'Find your perfect ride',
      desc: 'Switch between Office and Home rides. Use the Requests tab to post where you need to go — drivers will find you.',
      color: '#0891b2',
      bg: 'rgba(8,145,178,0.08)',
    },
    {
      elId: 'tour-post',
      emoji: '🚗',
      tag: 'EARN',
      title: 'Post a ride, earn daily',
      desc: 'Tap + to offer seats on your commute. Set Mon–Fri repeat once — never post manually again. Your car, your earnings.',
      color: '#facc15',
      bg: 'rgba(250,204,21,0.08)',
      round: true,
    },
    {
      elId: 'tour-wallet',
      emoji: '💰',
      tag: 'WALLET',
      title: 'Your ₹10 bonus is waiting!',
      desc: 'Check your wallet balance here. Each booking is just ₹2. Go Pro from ₹79/month for zero fees on every ride.',
      color: '#16a34a',
      bg: 'rgba(22,163,74,0.08)',
    },
    {
      elId: 'tour-profile',
      emoji: '⭐',
      tag: 'LAST STEP',
      title: 'Get your company badge',
      desc: 'Verify your work email in Profile to show your company badge. Verified users get 3× more ride matches.',
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.08)',
      last: true,
    },
  ]

  useEffect(() => {
    if (!TOUR_KEY) return
    if (!localStorage.getItem(TOUR_KEY)) {
      setTimeout(() => { setActive(true); setTimeout(() => setAnimIn(true), 50) }, 1500)
    }
  }, [TOUR_KEY])

  useEffect(() => {
    if (active) setTimeout(() => position(step), 200)
  }, [active, step])

  function position(i) {
    const el = document.getElementById(steps[i].elId)
    if (!el) { i < steps.length - 1 ? setStep(i + 1) : endTour(); return }
    const r = el.getBoundingClientRect()
    setHlRect({ top: r.top, left: r.left, width: r.width, height: r.height, round: steps[i].round })
    const ttW = Math.min(300, window.innerWidth - 32)
    const isTop = r.top > window.innerHeight * 0.5
    setTtPos({
      top: isTop ? r.top - 220 : r.bottom + 16,
      left: Math.max(16, Math.min(window.innerWidth - ttW - 16, r.left + r.width / 2 - ttW / 2)),
      width: ttW,
    })
  }

  function goNext() {
    setAnimIn(false)
    setTimeout(() => {
      step < steps.length - 1 ? setStep(s => s + 1) : endTour()
      setTimeout(() => setAnimIn(true), 100)
    }, 200)
  }

  function endTour() {
    setAnimIn(false)
    setTimeout(() => { setActive(false); if (TOUR_KEY) localStorage.setItem(TOUR_KEY, 'true') }, 350)
  }

  if (!active || !hlRect) return null
  const s = steps[step]
  const pad = 8

  return (
    <>
      {/* Backdrop with cutout */}
      <div onClick={endTour} style={{ position: 'fixed', inset: 0, zIndex: 9998,
        background: `radial-gradient(ellipse at ${hlRect.left + hlRect.width/2}px ${hlRect.top + hlRect.height/2}px, transparent ${Math.max(hlRect.width, hlRect.height) * 0.7}px, rgba(0,0,0,0.82) ${Math.max(hlRect.width, hlRect.height) * 0.9}px)`,
        transition: 'all 0.4s ease',
        backdropFilter: 'blur(1px)',
      }} />

      {/* Animated highlight border */}
      <div style={{
        position: 'fixed', zIndex: 9999, pointerEvents: 'none',
        top: hlRect.top - pad, left: hlRect.left - pad,
        width: hlRect.width + pad * 2, height: hlRect.height + pad * 2,
        borderRadius: hlRect.round ? '50%' : 18,
        border: `2px solid ${s.color}`,
        boxShadow: `0 0 0 3px ${s.color}33, 0 0 30px ${s.color}44`,
        transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
        animation: 'hlPulse 2s ease-in-out infinite',
      }} />

      {/* Corner dots */}
      {!hlRect.round && [
        { top: hlRect.top - pad - 3, left: hlRect.left - pad - 3 },
        { top: hlRect.top - pad - 3, left: hlRect.left + hlRect.width + pad - 3 },
        { top: hlRect.top + hlRect.height + pad - 3, left: hlRect.left - pad - 3 },
        { top: hlRect.top + hlRect.height + pad - 3, left: hlRect.left + hlRect.width + pad - 3 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: 'fixed', zIndex: 10000, pointerEvents: 'none',
          width: 7, height: 7, borderRadius: '50%',
          background: s.color,
          ...pos,
          boxShadow: `0 0 8px ${s.color}`,
          transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
        }} />
      ))}

      {/* Tooltip card */}
      <div style={{
        position: 'fixed', zIndex: 10001,
        top: ttPos.top, left: ttPos.left, width: ttPos.width,
        opacity: animIn ? 1 : 0,
        transform: animIn ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.95)',
        transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        background: '#fff',
        borderRadius: 22,
        overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06)',
      }}>
        {/* Colored top bar */}
        <div style={{ background: s.bg, borderBottom: `1px solid ${s.color}22`, padding: '14px 18px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: `${s.color}18`, border: `1.5px solid ${s.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
            {s.emoji}
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: s.color, marginBottom: 2 }}>{s.tag}</div>
            <div style={{ fontFamily: 'system-ui', fontSize: 15, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{s.title}</div>
          </div>
        </div>

        {/* Description */}
        <div style={{ padding: '12px 18px 16px' }}>
          <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.65, marginBottom: 16 }}>{s.desc}</p>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {/* Step pills */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {steps.map((st, i) => (
                <div key={i} style={{
                  height: 4, borderRadius: 100,
                  background: i < step ? s.color : i === step ? s.color : '#e2e8f0',
                  width: i === step ? 20 : 4,
                  opacity: i < step ? 0.5 : 1,
                  transition: 'all 0.3s ease',
                }} />
              ))}
              <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 4, fontWeight: 600 }}>{step + 1}/{steps.length}</span>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {!s.last && (
                <button onClick={endTour} style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: 12, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, fontFamily: 'inherit' }}>
                  Skip tour
                </button>
              )}
              <button onClick={goNext} style={{
                background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)`,
                color: s.color === '#facc15' ? '#111' : '#fff',
                border: 'none', borderRadius: 100, padding: '9px 18px',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                boxShadow: `0 4px 14px ${s.color}44`,
                transition: '0.2s',
              }}>
                {s.last ? '🎉 Let\'s go!' : 'Next'}
                {!s.last && <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hlPulse {
          0%, 100% { box-shadow: 0 0 0 3px ${s.color}33, 0 0 20px ${s.color}33; }
          50% { box-shadow: 0 0 0 6px ${s.color}22, 0 0 40px ${s.color}44; }
        }
      `}</style>
    </>
  )
}
