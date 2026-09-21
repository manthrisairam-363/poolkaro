import { useNavigate } from 'react-router-dom'

// PUBLIC page — reachable at /delete-account WITHOUT logging in.
// Google Play requires a public URL where users (including those who
// uninstalled or can't sign in) can find out how to delete their data.
// No deletion happens here; this page explains the two ways to do it.
export default function DeleteAccount() {
  const navigate = useNavigate()

  const card = { background: '#fff', borderRadius: 14, padding: 18, marginBottom: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }
  const h = { fontWeight: 700, fontSize: 15, marginBottom: 8, color: '#111' }
  const p = { fontSize: 13.5, color: '#444', lineHeight: 1.7 }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', paddingBottom: 40 }}>
      <div style={{ background: '#111', padding: '20px 16px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>Delete Your Account</div>
      </div>

      <div style={{ padding: 16 }}>
        <div style={{ ...card, borderLeft: '4px solid #dc2626' }}>
          <div style={h}>What gets deleted</div>
          <div style={p}>
            Deleting your CarpoolKaro account permanently removes your profile, wallet
            balance, ride history, bookings and chat messages. This cannot be undone.
            Any unspent money you added yourself can be refunded before deletion — email
            us first if you want a refund.
          </div>
        </div>

        <div style={card}>
          <div style={h}>Option 1 — In the app (fastest)</div>
          <div style={p}>
            Open the CarpoolKaro app, go to <strong>Profile → Delete my account</strong>,
            and confirm. Your account and data are removed immediately. If you have an
            upcoming confirmed ride or booking, cancel it first.
          </div>
        </div>

        <div style={card}>
          <div style={h}>Option 2 — By email</div>
          <div style={p}>
            If you have uninstalled the app or cannot sign in, email us from the address
            registered on your account:
            <br /><br />
            <a href="mailto:support@carpoolkaro.com?subject=Delete%20my%20CarpoolKaro%20account"
               style={{ color: '#111', fontWeight: 700 }}>support@carpoolkaro.com</a>
            <br /><br />
            with the subject "Delete my account". We will verify your identity and delete
            your account and personal data within 7 days.
          </div>
        </div>

        <div style={{ ...card, background: '#eff6ff', boxShadow: 'none' }}>
          <div style={{ ...p, color: '#1e40af' }}>
            <strong>Grievance Officer:</strong> Manthri Sairam · support@carpoolkaro.com ·
            Hyderabad, Telangana, India. We acknowledge requests within 24 hours and
            resolve them within 15 days, in line with India's DPDP Act, 2023.
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '16px 0', color: '#aaa', fontSize: 12 }}>
          🚗 CarpoolKaro · Hyderabad, India
        </div>
      </div>
    </div>
  )
}
