import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const LAST_UPDATED = '21 September 2026'
const OPERATOR = 'CarpoolKaro is operated by Manthri Sairam, an individual (sole proprietor) based in Hyderabad, Telangana, India ("CarpoolKaro", "we", "us"). CarpoolKaro is not a registered company. It is a technology platform that connects private car owners with co-riders for shared commutes.'

const sections = {
  terms: [
    { title: '1. About CarpoolKaro',
      content: 'CarpoolKaro is a carpooling platform that helps IT professionals share their daily office commute and split costs. We currently serve Hyderabad, Bangalore, Pune, Mumbai, Delhi NCR and Chennai. CarpoolKaro is NOT a taxi, cab or transport service — we do not own vehicles, employ drivers, or carry passengers. We only connect car owners and co-riders who choose to travel together voluntarily.\n\n' + OPERATOR },
    { title: '2. Eligibility',
      content: 'You must be 18 years or older to use CarpoolKaro. By signing up, you confirm the information you provide is accurate. We may suspend accounts that provide false information.' },
    { title: '3. How Payments Work',
      content: 'The ride fare (for example ₹150) is paid DIRECTLY by the co-rider to the car owner, usually by UPI. CarpoolKaro never receives, holds, or routes the ride fare — that money moves between the two users.\n\nCarpoolKaro charges only a small platform connection fee of ₹2 from the car owner and ₹2 from the co-rider per confirmed booking. This ₹2 fee is deducted from your CarpoolKaro wallet. It is the only money CarpoolKaro collects.' },
    { title: '4. Wallet & Refunds',
      content: 'Your CarpoolKaro wallet holds money you add (via Razorpay) to pay the ₹2 platform fees, plus any promotional credit we give you (such as signup or referral bonuses).\n\nMoney you have added yourself and not yet spent is refundable on request — contact us and we will return the unspent added balance to your original payment method. Promotional/bonus credit is not refundable and has no cash value. The ₹2 platform fee for a completed booking is non-refundable.' },
    { title: '5. Car Owner Responsibilities',
      content: 'Car owners must hold a valid driving licence and valid vehicle insurance, and the vehicle must be roadworthy and legally registered. Car owners are responsible for safe driving and following all traffic laws. CarpoolKaro does not verify licences, insurance or vehicles and is not liable for any accident or incident during a ride.' },
    { title: '6. Co-rider Responsibilities',
      content: 'Co-riders must behave respectfully, pay the agreed fare directly to the car owner, and be present at the pickup point on time. Repeated no-shows or misconduct may lead to account suspension.' },
    { title: '7. Cancellations',
      content: 'If a car owner cancels a ride, the ₹2 platform fee is refunded to each affected co-rider\u2019s wallet. If a co-rider cancels their own booking, seats are released; refund of the ₹2 fee follows the rules shown in the app at the time of cancellation. Ride fare refunds, if any, are settled directly between the car owner and co-rider — CarpoolKaro is not involved in fare refunds.' },
    { title: '8. Safety',
      content: 'CarpoolKaro is a connection platform, not a transport provider, and cannot guarantee the conduct or safety of any user. Verify the other person before travelling, share your live location with a trusted contact, keep your financial details private, and report any safety concern immediately through the app or to our Grievance Officer (see the Privacy Policy).' },
    { title: '9. Prohibited Activities',
      content: 'Do not use CarpoolKaro to run a commercial taxi service, post false or misleading ride listings, harass other users, or discriminate against anyone on the basis of gender, religion, caste, disability or any other protected ground. Violations may result in immediate account termination.' },
    { title: '10. Limitation of Liability',
      content: 'CarpoolKaro is a technology platform only. We do not own vehicles, employ drivers, or operate transport services; we connect independent users who share rides voluntarily. To the maximum extent permitted by law, CarpoolKaro and its operator are not liable for: (a) any accident, injury or death during a ride; (b) the conduct or reliability of any user; (c) loss of or damage to property; (d) disputes between users over fares, routes or safety. You use the platform at your own risk. Our total liability for any claim is limited to the platform fee we actually collected from you for the specific booking in question.' },
    { title: '11. CarpoolKaro Pro',
      content: 'CarpoolKaro Pro is an optional paid subscription that waives your ₹2 platform fee for its duration. Pro affects ONLY the platform fee — Pro users still pay the full ride fare directly to the car owner, exactly like everyone else. Pro grants no other in-app benefit. Subscriptions are non-refundable once activated, do not auto-renew, and remain valid until their expiry date.' },
    { title: '12. Account Deletion',
      content: 'You can delete your account at any time from Profile → Delete my account inside the app, or by writing to support@carpoolkaro.com. Deleting your account permanently removes your profile, wallet balance, ride history and messages. You cannot delete your account while you have an upcoming confirmed ride or booking — cancel those first.' },
    { title: '13. Changes to These Terms',
      content: 'We may update these Terms from time to time. We will notify users of significant changes in the app. Continued use after a change means you accept the updated Terms. These Terms are governed by the laws of India, with jurisdiction in the courts of Hyderabad, Telangana.' },
  ],
  privacy: [
    { title: '1. Who We Are',
      content: OPERATOR + '\n\nThis Privacy Policy explains what personal data we collect, why, and your rights under India\u2019s Digital Personal Data Protection Act, 2023 (DPDP Act).' },
    { title: '2. Information We Collect',
      content: 'We collect: your name, phone number, email address, and (for car owners) vehicle model, vehicle number and UPI ID. During an active ride, if you choose to share it, we collect your live GPS location. We also collect basic usage information to operate and improve the app. We ask only for data needed to run the carpooling service.' },
    { title: '3. How We Use Your Information',
      content: 'We use your information to: create your account, match car owners with co-riders, show your name and (to a matched counterpart) the details needed to coordinate a ride, process the ₹2 platform fee through your wallet, send ride-related notifications, and keep the service secure. We do not sell your personal data to anyone.' },
    { title: '4. Location Data',
      content: 'Live location is collected only during an active ride and only when you choose to share it, and is visible only to the car owner and co-riders on that same booking. When the ride ends, live location sharing is switched off and the location records for that ride are automatically deleted from our systems (within a few hours). We do not track your location when you are not on an active shared ride.' },
    { title: '5. How We Share Data',
      content: 'To coordinate a ride we share limited details (such as your name and phone number) with the specific car owner or co-rider you are matched with — not with other users. We use Supabase (database and hosting) and Razorpay (to process wallet top-ups). These providers process data on our behalf under their own security and privacy terms. We may disclose data if required by law.' },
    { title: '6. Data Security',
      content: 'Data is encrypted in transit and at rest, and access to personal data is restricted at the database level so that one user cannot read another user\u2019s private details. Your UPI ID is used only to let riders pay you directly and is shown only to a matched counterpart when needed for a booking. No system is perfectly secure, but we apply reasonable, industry-standard safeguards.' },
    { title: '7. Data Retention',
      content: 'We keep your personal data for as long as your account is active. When you delete your account, your profile, wallet balance, ride history and messages are permanently removed. Live-ride location records are deleted shortly after each ride ends. Some records may be retained briefly where required to comply with law or resolve disputes.' },
    { title: '8. Your Rights (DPDP Act, 2023)',
      content: 'You have the right to: access the personal data we hold about you; correct or update it (most fields are editable in Profile); withdraw consent; and request erasure of your data. You can delete your account and data yourself from Profile → Delete my account, or by contacting our Grievance Officer below. We will act on valid requests within the timelines required by the DPDP Act.' },
    { title: '9. Consent',
      content: 'By using CarpoolKaro you consent to the collection and use of your data as described here — in particular, sharing your name and phone number with a matched car owner or co-rider so the ride can happen. This consent is necessary to provide the service. You may withdraw it at any time by deleting your account, after which we stop processing your data except where the law requires otherwise.' },
    { title: '10. Children',
      content: 'CarpoolKaro is not intended for anyone under 18. We do not knowingly collect data from minors. If we learn that a minor has created an account, we will delete it.' },
    { title: '11. Grievance Officer & Contact',
      content: 'In accordance with the DPDP Act, 2023 and applicable Indian IT rules, our Grievance Officer is:\n\nName: Manthri Sairam (Grievance Officer)\nEmail: support@carpoolkaro.com\nLocation: Hyderabad, Telangana, India\n\nWe aim to acknowledge complaints within 24 hours and resolve them within 15 days. For any privacy question, data request or complaint, contact us at the email above.' },
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
          Last updated: {LAST_UPDATED}
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
