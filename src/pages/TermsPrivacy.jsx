import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const sections = {
  terms: [
    {
      title: '1. About CarpoolKaro',
      content: 'CarpoolKaro is a carpooling platform connecting IT professionals in Hyderabad. We help users share rides and split commute costs. CarpoolKaro is not a taxi or cab service — we are a platform that connects car owners and co-riders.',
    },
    {
      title: '2. Eligibility',
      content: 'You must be 18 years or older to use CarpoolKaro. By signing up, you confirm that the information you provide is accurate and complete. CarpoolKaro reserves the right to suspend accounts with false information.',
    },
    {
      title: '3. Car Owner Responsibilities',
      content: 'Car owners must hold a valid driving licence and vehicle insurance. The vehicle must be roadworthy and legally registered. Car owners are responsible for safe driving and must follow all traffic rules. CarpoolKaro is not liable for any accidents or incidents during rides.',
    },
    {
      title: '4. Co-rider Responsibilities',
      content: 'Co-riders must behave respectfully with car owners. Co-riders agree to pay the fare as agreed at time of booking. Co-riders must be present at the pickup point on time. Repeated no-shows may lead to account suspension.',
    },
    {
      title: '5. Payments & Wallet',
      content: 'CarpoolKaro charges a platform fee of ₹2 per booking from both car owner and co-rider. This fee is deducted from your CarpoolKaro wallet. Ride fares are paid directly between co-rider and car owner via UPI. CarpoolKaro does not handle ride fare payments. Wallet balances are non-refundable except in case of cancellation.',
    },
    {
      title: '6. Cancellations & Refunds',
      content: 'If a car owner cancels a ride, the ₹2 platform fee is refunded to both the car owner and co-rider wallets. If a co-rider cancels a booking, the ₹2 platform fee is refunded to both wallets. Ride fare refunds are managed directly between the car owner and co-rider. CarpoolKaro is not responsible for fare refunds.',
    },
    {
      title: '7. Safety',
      content: 'CarpoolKaro encourages users to verify each other before rides. Always share your live location with a trusted contact during rides. Do not share your personal financial details with other users. Report any safety concerns immediately through the app.',
    },
    {
      title: '8. Prohibited Activities',
      content: 'Users must not use CarpoolKaro for commercial taxi services. Discrimination based on gender, religion, or caste is strictly prohibited. Harassment of any kind will result in immediate account termination. Do not post false ride listings.',
    },
    {
      title: '9. Limitation of Liability',
      content: 'CarpoolKaro is a technology platform only. We are not responsible for the conduct of users, quality of rides, accidents, or losses incurred during rides. Our maximum liability is limited to the platform fee collected.',
    },
    {
      title: '10. Changes to Terms',
      content: 'CarpoolKaro may update these terms at any time. Users will be notified of significant changes. Continued use of the app after changes means you accept the new terms.',
    },
  ],
  privacy: [
    {
      title: '1. Information We Collect',
      content: 'We collect: your name, phone number, email address, vehicle details, UPI ID, and GPS location (only during active rides). We also collect usage data to improve the app.',
    },
    {
      title: '2. How We Use Your Information',
      content: 'Your information is used to: match car owners with co-riders, process wallet transactions, send ride notifications, and improve app performance. We do not sell your data to third parties.',
    },
    {
      title: '3. Location Data',
      content: 'GPS location is only shared with your matched co-rider or car owner during an active ride. Location data is deleted from our servers after the ride ends. We do not track your location outside of active rides.',
    },
    {
      title: '4. Data Sharing',
      content: 'We share your name and phone number with matched co-riders/car owners to facilitate rides. We use Supabase for database storage and Razorpay for payment processing. Both are RBI and GDPR compliant.',
    },
    {
      title: '5. Data Security',
      content: 'All data is encrypted in transit and at rest. We use industry-standard security practices. Your UPI ID is stored securely and only used for payment routing.',
    },
    {
      title: '6. Your Rights',
      content: 'You can request deletion of your account and data at any time by contacting us. You can update your profile information at any time. You can opt out of notifications in app settings.',
    },
    {
      title: '7. Contact Us',
      content: 'For any privacy concerns or data requests, contact us at: support@carpoolkaro.com\n\nAddress: Hyderabad, Telangana, India.',
    },
  ],
}

export default function TermsPrivacy() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('terms')

  return (
    <div style={{ minHeight: '100vh', background: '#f5f6fa', paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ background: '#111', padding: '20px 16px 16px', display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>←</button>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>📄 Legal</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#fff', borderBottom: '2px solid #f0f0f0' }}>
        {[['terms', '📋 Terms of Use'], ['privacy', '🔒 Privacy Policy']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} style={{
            flex: 1, padding: '14px 8px', background: 'none', border: 'none', cursor: 'pointer',
            fontWeight: tab === v ? 700 : 400, fontSize: 13,
            color: tab === v ? '#111' : '#888',
            borderBottom: `3px solid ${tab === v ? '#111' : 'transparent'}`,
            marginBottom: -2,
          }}>{l}</button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {/* Last updated */}
        <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>
          Last updated: May 2026
        </div>

        {sections[tab].map((section, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: '#111' }}>
              {section.title}
            </div>
            <div style={{ fontSize: 13, color: '#555', lineHeight: 1.8, whiteSpace: 'pre-line' }}>
              {section.content}
            </div>
          </div>
        ))}

        <div style={{ textAlign: 'center', padding: '20px 0', color: '#aaa', fontSize: 12 }}>
          🚗 CarpoolKaro · Hyderabad, India
        </div>
      </div>
    </div>
  )
}
