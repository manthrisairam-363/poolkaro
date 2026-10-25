import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { detectPlatform } from '../lib/platform'

// Admin-published image popups on Home (greetings, offers, festival wishes,
// device-specific install guidance).
// - Admin keeps a LIST of popups; each one has its own id and a target device.
// - A user sees at most ONE popup per app open: the first unseen one that
//   matches their device and hasn't expired. Closing marks it seen on this
//   device; the next unseen one shows on their next visit.
// - Never appears on top of the first-time guided tour — waits until it's done.

export function popupMatchesDevice(target) {
  const { platform, isPWA } = detectPlatform()
  switch (target || 'all') {
    case 'all': return true
    case 'ios': return platform === 'ios'
    case 'android': return platform === 'android'
    case 'desktop': return platform === 'desktop'
    case 'installed': return isPWA
    case 'browser': return !isPWA
    case 'ios_browser': return platform === 'ios' && !isPWA
    case 'android_browser': return platform === 'android' && !isPWA
    default: return true
  }
}

function isExpired(p) {
  return !!p.until && new Date(`${p.until}T23:59:59+05:30`) < new Date()
}

// City / role targeting (both optional; missing or 'all' = everyone)
export function popupMatchesUser(p, profile) {
  if (p.city && p.city !== 'all' && (profile?.city || 'Hyderabad') !== p.city) return false
  const role = profile?.role
  if (p.role === 'owners' && !(role === 'driver' || role === 'both')) return false
  if (p.role === 'riders' && !(role === 'rider' || role === 'both')) return false
  return true
}

export default function HomePopup({ popups }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [popup, setPopup] = useState(null)

  useEffect(() => {
    if (!Array.isArray(popups) || popups.length === 0 || !user?.id) return
    let tourDone = true
    try { tourDone = !!localStorage.getItem(`ck_tour_${user.id}`) } catch (_) {}
    if (!tourDone) return
    const next = popups.find(p => {
      if (!p?.id || !p.image_url || isExpired(p)) return false
      if (!popupMatchesDevice(p.target)) return false
      if (!popupMatchesUser(p, profile)) return false
      try { if (localStorage.getItem(`ck_popup_seen_${p.id}`)) return false } catch (_) {}
      return true
    })
    if (!next) return
    const t = setTimeout(() => setPopup(next), 800)
    return () => clearTimeout(t)
  }, [popups, user?.id, profile?.city, profile?.role])

  function close() {
    if (popup?.id) { try { localStorage.setItem(`ck_popup_seen_${popup.id}`, '1') } catch (_) {} }
    setPopup(null)
  }

  function go() {
    const link = popup?.link?.trim()
    close()
    if (!link) return
    if (link.startsWith('/')) navigate(link)
    else window.open(link, '_blank', 'noopener')
  }

  if (!popup) return null

  return (
    <div onClick={close} style={{
      position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
        <button onClick={close} aria-label="Close" style={{
          position: 'absolute', top: -14, right: -10, width: 36, height: 36, borderRadius: '50%',
          border: 'none', background: '#fff', color: '#111', fontSize: 18, fontWeight: 800,
          cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.3)', zIndex: 1,
        }}>✕</button>
        <img
          src={popup.image_url}
          alt={popup.title || 'CarpoolKaro'}
          onClick={popup.link ? go : undefined}
          onError={close}
          style={{
            width: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: 16,
            display: 'block', background: '#111', cursor: popup.link ? 'pointer' : 'default',
          }}
        />
        {popup.title && (
          <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, textAlign: 'center', marginTop: 12 }}>
            {popup.title}
          </div>
        )}
        {popup.link && (
          <button onClick={go} style={{
            display: 'block', margin: '12px auto 0', padding: '10px 24px', background: '#facc15',
            color: '#111', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer',
          }}>{popup.cta || 'Open'}</button>
        )}
      </div>
    </div>
  )
}
