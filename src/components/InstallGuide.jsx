import { useState, useEffect } from 'react'
import { detectPlatform } from '../lib/platform'

// Shows OS-specific "add to home screen" instructions to users who are still in
// a browser (not the installed PWA). This is the bridge until the Play Store
// listing is live — installed users get proper push and a real app feel.
//
// - Only shows on mobile (iOS/Android) AND only when NOT already installed.
// - Dismissible; we remember the dismissal for this session (in-memory) so it
//   doesn't nag on every navigation, but it returns next visit until they
//   actually install (at which point isPWA flips true and it never shows).

export default function InstallGuide() {
  const [show, setShow] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [platform, setPlatform] = useState('android')

  useEffect(() => {
    const { platform: p, isPWA } = detectPlatform()
    // Already installed → never show. Desktop → not relevant.
    if (isPWA || p === 'desktop') return
    // Dismissed this session?
    if (sessionStorage.getItem('installGuideDismissed') === '1') return
    setPlatform(p)
    setShow(true)
  }, [])

  if (!show) return null

  const isIOS = platform === 'ios'

  const steps = isIOS
    ? [
        { icon: '⬆️', text: 'Tap the Share button at the bottom of Safari' },
        { icon: '➕', text: 'Scroll down and tap "Add to Home Screen"' },
        { icon: '✅', text: 'Tap "Add" — CarpoolKaro appears on your home screen' },
      ]
    : [
        { icon: '⋮', text: 'Tap the menu (⋮) in the top-right of Chrome' },
        { icon: '📲', text: 'Tap "Add to Home screen" (or "Install app")' },
        { icon: '✅', text: 'Tap "Add" — CarpoolKaro appears on your home screen' },
      ]

  function dismiss() {
    sessionStorage.setItem('installGuideDismissed', '1')
    setShow(false)
  }

  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 'calc(env(safe-area-inset-bottom) + 74px)', zIndex: 900, padding: '0 12px', pointerEvents: 'none' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', background: '#111', borderRadius: 14, boxShadow: '0 8px 30px rgba(0,0,0,0.4)', border: '1px solid #333', overflow: 'hidden', pointerEvents: 'auto' }}>

        {/* Collapsed bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
          <div style={{ fontSize: 22 }}>📲</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Add CarpoolKaro to your home screen</div>
            <div style={{ fontSize: 11, color: '#999' }}>Faster access + get ride notifications</div>
          </div>
          <button onClick={() => setExpanded(v => !v)} style={{ padding: '7px 12px', background: '#facc15', color: '#111', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
            {expanded ? 'Hide' : 'How?'}
          </button>
          <button onClick={dismiss} aria-label="Dismiss" style={{ background: 'none', border: 'none', color: '#666', fontSize: 18, cursor: 'pointer', flexShrink: 0, lineHeight: 1 }}>×</button>
        </div>

        {/* Expanded steps */}
        {expanded && (
          <div style={{ padding: '0 14px 14px' }}>
            <div style={{ fontSize: 11, color: '#facc15', fontWeight: 700, marginBottom: 8 }}>
              {isIOS ? '🍎 On your iPhone (Safari)' : '🤖 On your Android (Chrome)'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#1a1a1a', borderRadius: 8, padding: '9px 11px' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#facc15', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: 12.5, color: '#ddd' }}><span style={{ marginRight: 6 }}>{s.icon}</span>{s.text}</div>
                </div>
              ))}
            </div>
            {isIOS && (
              <div style={{ fontSize: 10.5, color: '#777', marginTop: 8, lineHeight: 1.5 }}>
                Note: on iPhone this only works in <b style={{ color: '#aaa' }}>Safari</b>, not Chrome. Notifications work once added to the home screen.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
