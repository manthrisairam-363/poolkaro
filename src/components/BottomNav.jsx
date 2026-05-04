import { useNavigate, useLocation } from 'react-router-dom'

const tabs = [
  { path: '/', icon: '🚗', label: 'Rides' },
  { path: '/post', icon: '➕', label: 'Post' },
  { path: '/my-rides', icon: '📋', label: 'My Rides' },
  { path: '/profile', icon: '👤', label: 'Profile' },
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
          <button key={tab.path} onClick={() => navigate(tab.path)}
            style={{
              flex: 1, background: 'none', border: 'none',
              padding: '10px 0 6px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3,
            }}>
            {/* Post button special style */}
            {tab.path === '/post' ? (
              <div style={{
                width: 42, height: 42, borderRadius: '50%',
                background: '#111', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 20, marginTop: -16, marginBottom: 2,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}>➕</div>
            ) : (
              <span style={{ fontSize: 22 }}>{tab.icon}</span>
            )}
            <span style={{
              fontSize: 10, fontWeight: active ? 700 : 400,
              color: active ? '#111' : '#aaa',
            }}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
