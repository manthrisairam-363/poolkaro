import { useNavigate, useLocation } from 'react-router-dom'

// Clean SVG icons — no ghost emoji issues
const icons = {
  rides: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#111' : '#aaa'} strokeWidth="2" strokeLinecap="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
      <rect x="9" y="11" width="14" height="10" rx="2"/>
      <circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
    </svg>
  ),
  myrides: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#111' : '#aaa'} strokeWidth="2" strokeLinecap="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  wallet: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#111' : '#aaa'} strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M16 12h2"/><path d="M2 10h20"/>
    </svg>
  ),
  profile: (active) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#111' : '#aaa'} strokeWidth="2" strokeLinecap="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
}

const tabs = [
  { path: '/', iconKey: 'rides', label: 'Rides' },
  { path: '/my-rides', iconKey: 'myrides', label: 'My Rides' },
  { path: '/post', label: 'Post', special: true },
  { path: '/wallet', iconKey: 'wallet', label: 'Wallet' },
  { path: '/profile', iconKey: 'profile', label: 'Profile' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%',
      transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: '#fff',
      borderTop: '1px solid #f0f0f0',
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      zIndex: 50,
      boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
    }}>
      {tabs.map(tab => {
        const active = pathname === tab.path
        return (
          <button key={tab.path} id={tab.path === '/post' ? 'tour-post' : tab.path === '/wallet' ? 'tour-wallet' : tab.path === '/profile' ? 'tour-profile' : undefined} onClick={() => navigate(tab.path)} style={{
            flex: 1, background: 'none', border: 'none',
            padding: '10px 0 6px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 2,
          }}>
            {tab.special ? (
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: '#111', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                marginTop: -18, marginBottom: 2,
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </div>
            ) : (
              <div style={{ opacity: active ? 1 : 0.6 }}>
                {icons[tab.iconKey]?.(active)}
              </div>
            )}
            <span style={{
              fontSize: 9, fontWeight: active ? 700 : 400,
              color: active ? '#111' : '#aaa',
            }}>{tab.label}</span>
            {active && !tab.special && (
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#111', marginTop: 1 }} />
            )}
          </button>
        )
      })}
    </nav>
  )
}
