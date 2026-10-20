import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

// Admin-published image popup on Home (greetings, offers, festival wishes).
// - Shows once per device per popup: closing it marks that popup id as seen;
//   publishing a new popup (new id) shows again.
// - Respects an optional "show until" date (IST, end of day).
// - Never appears on top of the first-time guided tour — waits until it's done.
export default function HomePopup({ popup }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const seenKey = popup?.id ? `ck_popup_seen_${popup.id}` : null

  useEffect(() => {
    if (!popup?.image_url || !seenKey || !user?.id) return
    if (popup.until && new Date(`${popup.until}T23:59:59+05:30`) < new Date()) return
    let seen = false
    let tourDone = true
    try {
      seen = !!localStorage.getItem(seenKey)
      tourDone = !!localStorage.getItem(`ck_tour_${user.id}`)
    } catch (_) {}
    if (seen || !tourDone) return
    const t = setTimeout(() => setOpen(true), 800)
    return () => clearTimeout(t)
  }, [popup?.id, user?.id])

  function close() {
    try { localStorage.setItem(seenKey, '1') } catch (_) {}
    setOpen(false)
  }

  function go() {
    const link = popup.link?.trim()
    close()
    if (!link) return
    if (link.startsWith('/')) navigate(link)
    else window.open(link, '_blank', 'noopener')
  }

  if (!open) return null

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
          onError={() => setOpen(false)}
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
