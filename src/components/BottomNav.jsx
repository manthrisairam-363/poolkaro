import { useNavigate, useLocation } from 'react-router-dom'

const Icon = ({ name, active }) => {
  const c = active ? '#facc15' : '#444'
  const icons = {
    rides: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3m-4 12h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a1 1 0 11-2 0 1 1 0 012 0zm-8 0a1 1 0 11-2 0 1 1 0 012 0z"/></svg>,
    myrides: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline stroke={c} points="14 2 14 8 20 8"/><line stroke={c} x1="16" y1="13" x2="8" y2="13"/><line stroke={c} x1="16" y1="17" x2="8" y2="17"/></svg>,
    wallet: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path stroke={c} d="M16 12h2"/><path stroke={c} d="M2 10h20"/></svg>,
    profile: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle stroke={c} cx="12" cy="7" r="4"/></svg>,
  }
  return icons[name] || null
}

const tabs = [
  { path: '/', key: 'rides', label: 'Rides' },
  { path: '/my-rides', key: 'myrides', label: 'My Rides' },
  { path: '/post', key: 'post', label: 'Post', special: true },
  { path: '/wallet', key: 'wallet', label: 'Wallet' },
  { path: '/profile', key: 'profile', label: 'Profile' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 480,
      background: '#111',
      borderTop: '1px solid #1a1a1a',
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom, 6px)',
      zIndex: 50,
    }}>
      {tabs.map(tab => {
        const active = pathname === tab.path
        return (
          <button key={tab.path} onClick={() => navigate(tab.path)} style={{
            flex: 1, background: 'none', border: 'none',
            padding: '10px 0 6px', cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 3,
          }}>
            {tab.special ? (
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: '#facc15',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginTop: -20, marginBottom: 2,
                boxShadow: '0 4px 20px rgba(250,204,21,0.4)',
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </div>
            ) : (
              <Icon name={tab.key} active={active} />
            )}
            <span style={{ fontSize: 9, fontWeight: active ? 700 : 400, color: active ? '#facc15' : '#444' }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
