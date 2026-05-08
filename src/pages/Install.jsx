import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Install() {
  const navigate = useNavigate()
  const [device, setDevice] = useState('unknown')
  const [browser, setBrowser] = useState('unknown')
  const [step, setStep] = useState(1)

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(ua)) setDevice('ios')
    else if (/android/.test(ua)) setDevice('android')
    else setDevice('desktop')

    if (/crios/.test(ua)) setBrowser('chrome-ios')
    else if (/fxios/.test(ua)) setBrowser('firefox-ios')
    else if (/safari/.test(ua) && !/chrome/.test(ua)) setBrowser('safari')
    else if (/chrome/.test(ua)) setBrowser('chrome')
    else setBrowser('other')

    // If already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      navigate('/')
    }
  }, [])

  const iosSteps = [
    { icon: '1️⃣', text: 'Open this page in Safari', note: 'Must use Safari, not Chrome' },
    { icon: '2️⃣', text: 'Tap the Share button', note: '⬆️ at the bottom of Safari' },
    { icon: '3️⃣', text: 'Scroll down and tap "Add to Home Screen"', note: 'Scroll in the share menu' },
    { icon: '4️⃣', text: 'Tap "Add" in top right', note: 'PoolKaro icon appears on home screen!' },
  ]

  const androidSteps = [
    { icon: '1️⃣', text: 'Open this page in Chrome', note: 'Must use Chrome browser' },
    { icon: '2️⃣', text: 'Tap the ⋮ menu (top right)', note: 'Three dots in Chrome' },
    { icon: '3️⃣', text: 'Tap "Add to Home screen"', note: 'Or "Install App" if shown' },
    { icon: '4️⃣', text: 'Tap "Add" or "Install"', note: 'PoolKaro icon appears on home screen!' },
  ]

  const steps = device === 'ios' ? iosSteps : androidSteps

  return (
    <div style={{ minHeight: '100vh', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px 40px' }}>

      {/* Logo */}
      <div style={{ marginTop: 20, textAlign: 'center', marginBottom: 28 }}>
        <div style={{ width: 88, height: 88, borderRadius: 24, background: '#facc15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 50, margin: '0 auto 12px', boxShadow: '0 8px 32px rgba(250,204,21,0.3)' }}>
          🚗
        </div>
        <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-1px' }}>
          <span style={{ color: '#facc15' }}>Pool</span>
          <span style={{ color: '#fff' }}>Karo</span>
        </div>
        <div style={{ color: '#666', fontSize: 13, marginTop: 4 }}>
          Hyderabad IT Carpool Community
        </div>
      </div>

      {/* Install prompt */}
      <div style={{ background: '#1a1a1a', borderRadius: 20, padding: 20, width: '100%', maxWidth: 400, marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 18, color: '#fff', marginBottom: 4 }}>
          📱 Add to Home Screen
        </div>
        <div style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
          Install PoolKaro as an app — no App Store needed!
        </div>

        {/* Device detected */}
        {device !== 'desktop' && (
          <>
            <div style={{ background: '#facc15', borderRadius: 10, padding: '8px 14px', marginBottom: 20, display: 'inline-block' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>
                {device === 'ios' ? '📱 iPhone / iPad detected' : '🤖 Android detected'}
              </span>
            </div>

            {/* Safari warning for iOS Chrome users */}
            {device === 'ios' && browser !== 'safari' && (
              <div style={{ background: '#fef2f2', borderRadius: 10, padding: '12px 14px', marginBottom: 16, border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, marginBottom: 4 }}>⚠️ Switch to Safari first!</div>
                <div style={{ fontSize: 12, color: '#888' }}>iPhone only allows home screen install from Safari. Copy and open this link in Safari:</div>
                <div style={{ fontSize: 12, color: '#2563eb', marginTop: 6, fontWeight: 600, wordBreak: 'break-all' }}>
                  poolkaro.vercel.app/install
                </div>
              </div>
            )}

            {/* Steps */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {steps.map((s, i) => (
                <div key={i} onClick={() => setStep(i + 1)} style={{
                  display: 'flex', gap: 12, padding: '12px', borderRadius: 12,
                  background: step === i + 1 ? '#222' : 'transparent',
                  border: `1px solid ${step === i + 1 ? '#facc15' : '#222'}`,
                  cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{s.icon}</span>
                  <div>
                    <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{s.text}</div>
                    <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{s.note}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Desktop message */}
        {device === 'desktop' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💻</div>
            <div style={{ color: '#fff', fontWeight: 700, marginBottom: 8 }}>Open on your phone!</div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>Scan this QR code or share the link to install on mobile</div>
            <div style={{ background: '#222', borderRadius: 10, padding: '12px', fontSize: 13, color: '#facc15', fontWeight: 600, wordBreak: 'break-all' }}>
              poolkaro.vercel.app/install
            </div>
          </div>
        )}
      </div>

      {/* App features */}
      <div style={{ background: '#1a1a1a', borderRadius: 20, padding: 20, width: '100%', maxWidth: 400, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginBottom: 14 }}>Why Install?</div>
        {[
          ['⚡', 'Opens instantly like a real app'],
          ['🔔', 'Get notifications when rides are booked'],
          ['📵', 'Works with no browser bar'],
          ['🔒', 'Safe & secure — no App Store needed'],
          ['💰', 'Save on commute costs daily'],
        ].map(([icon, text]) => (
          <div key={text} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ color: '#aaa', fontSize: 13 }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Open app button */}
      <button onClick={() => navigate('/')} style={{
        width: '100%', maxWidth: 400, padding: 16,
        background: '#facc15', color: '#111', border: 'none',
        borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer',
        marginBottom: 12,
      }}>
        🚗 Open PoolKaro
      </button>

      <div style={{ color: '#444', fontSize: 11, textAlign: 'center' }}>
        poolkaro.vercel.app · Free forever · No App Store needed
      </div>
    </div>
  )
}
