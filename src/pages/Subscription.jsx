import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const PLANS = [
  { id: 'monthly', label: '1 Month', tag: 'Starter', duration: '30 days', price: 79, original: null, saving: null, days: 30, popular: false },
  { id: 'quarterly', label: '3 Months', tag: '⭐ Most Popular', duration: '90 days', price: 199, original: 237, saving: '₹38 (16%)', days: 90, popular: true },
  { id: 'half_yearly', label: '6 Months', tag: 'Best Value', duration: '180 days', price: 349, original: 474, saving: '₹125 (26%)', days: 180, popular: false },
  { id: 'yearly', label: '1 Year', tag: '🚀 Max Savings', duration: '365 days', price: 599, original: 948, saving: '₹349 (37%)', days: 365, popular: false },
]

export default function Subscription() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState('quarterly')
  const [paying, setPaying] = useState(false)
  const [currentSub, setCurrentSub] = useState(null)

  useEffect(() => { fetchSubscription() }, [])

  async function fetchSubscription() {
    const { data } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setCurrentSub(data)
  }

  async function loadRazorpay() {
    return new Promise(resolve => {
      if (window.Razorpay) { resolve(true); return }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  async function handleSubscribe() {
    const plan = PLANS.find(p => p.id === selected)
    if (!plan) return
    setPaying(true)

    try {
      const loaded = await loadRazorpay()
      if (!loaded) { alert('Failed to load payment gateway'); setPaying(false); return }

      const { data: { session } } = await supabase.auth.getSession()
      const authToken = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY

      // Create order
      const orderRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-order`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
          body: JSON.stringify({ action: 'create_order', purpose: 'subscription', plan_id: plan.id })
        }
      )
      const order = await orderRes.json()
      if (!order.id) throw new Error('Failed to create order')

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: 'INR',
        name: 'CarpoolKaro',
        description: `CarpoolKaro Pro — ${plan.label}`,
        order_id: order.id,
        prefill: { contact: profile?.phone || '', name: profile?.full_name || '' },
        theme: { color: '#facc15' },
        handler: async (response) => {
          // Verify payment
          const verifyRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-order`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
              body: JSON.stringify({
                action: 'verify_payment',
                payment_id: response.razorpay_payment_id,
                order_id: response.razorpay_order_id,
                signature: response.razorpay_signature,
              })
            }
          )
          const result = await verifyRes.json()
          if (result.success) {
            // Pro is granted server-side by the razorpay-order function.
            await fetchSubscription()
            const until = result.expires_at ? new Date(result.expires_at).toLocaleDateString('en-IN') : ''
            alert(`🎉 Welcome to CarpoolKaro Pro!\n\nYour ${plan.label} subscription is active.${until ? `\nZero platform fees until ${until}.` : ''}`)
          } else {
            alert('Payment verification failed. Contact support@carpoolkaro.com')
          }
          setPaying(false)
        },
        modal: { ondismiss: () => setPaying(false) }
      }
      new window.Razorpay(options).open()
    } catch (err) {
      alert('Payment error: ' + err.message)
      setPaying(false)
    }
  }

  function daysLeft(expiresAt) {
    const diff = new Date(expiresAt) - new Date()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }

  const planLabels = { monthly: '1 Month', quarterly: '3 Months', half_yearly: '6 Months', yearly: '1 Year' }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ background: '#111', padding: '20px 16px 16px', borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer' }}>←</button>
          <div style={{ fontWeight: 800, fontSize: 20 }}>⭐ CarpoolKaro Pro</div>
        </div>
        <div style={{ marginLeft: 36 }}>
          <div style={{ color: '#facc15', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
            India's Lowest Carpool Platform Fee
          </div>
          <div style={{ color: '#888', fontSize: 12 }}>
            Save more on every ride with CarpoolKaro Pro
          </div>
        </div>
      </div>

      {/* Savings calculator banner */}
      <div style={{ background: '#1a1200', borderBottom: '1px solid #2a1f00', padding: '12px 16px' }}>
        <div style={{ fontSize: 12, color: '#facc15', fontWeight: 700, marginBottom: 8 }}>💰 Break-even calculator</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
          Pro pays off if you do more than these rides per month:
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            ['₹79 plan', '40 rides', '~2/day'],
            ['₹199 plan', '33/mo avg', '~1.5/day'],
            ['₹599 plan', '25/mo avg', '~1/day'],
          ].map(([plan, rides, freq]) => (
            <div key={plan} style={{ flex: 1, background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.15)', borderRadius: 8, padding: '8px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#facc15', fontWeight: 700 }}>{plan}</div>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, marginTop: 2 }}>{rides}</div>
              <div style={{ fontSize: 10, color: '#666', marginTop: 1 }}>{freq}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#555', marginTop: 8 }}>
          Daily IT commuters do 40–60 rides/month — Pro saves you money from day 1.
        </div>
      </div>

      <div style={{ padding: 16 }}>

        {/* Active subscription banner */}
        {currentSub && (
          <div style={{ background: 'linear-gradient(135deg, #052e16, #064e3b)', borderRadius: 16, padding: 20, marginBottom: 20, border: '1px solid #166534' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 28 }}>✅</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: '#4ade80' }}>You're Pro!</div>
                <div style={{ color: '#86efac', fontSize: 13 }}>{planLabels[currentSub.plan]} plan active</div>
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '10px 14px' }}>
              <div style={{ fontSize: 13, color: '#4ade80', fontWeight: 700 }}>
                {daysLeft(currentSub.expires_at)} days remaining
              </div>
              <div style={{ fontSize: 11, color: '#666', marginTop: 3 }}>
                Expires {new Date(currentSub.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: '#888' }}>
              Renew below to extend your subscription before it expires.
            </div>
          </div>
        )}

        <div style={{ background: '#111', borderRadius: 16, padding: 16, marginBottom: 20, border: '1px solid #1a1a1a' }}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, color: '#facc15' }}>✅ What Pro includes</div>
          {[
            ['🆓', 'Zero platform fee per booking', 'Save ₹2 every time — both as rider and driver'],
            ['♾️', 'Unlimited rides & cancellations', 'No restrictions, no counting rides'],
            ['🚗', 'Post rides + Book rides', 'Everything in one subscription'],
            ['📊', 'Cheaper than every other carpool app', 'Built for daily IT commuters'],
          ].map(([icon, title, desc]) => (
            <div key={title} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{title}</div>
                <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Plan cards */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14 }}>Choose your plan</div>
          {PLANS.map(plan => (
            <div key={plan.id} onClick={() => setSelected(plan.id)} style={{
              background: selected === plan.id ? (plan.popular ? '#1a1200' : '#0f1a2e') : '#111',
              border: `2px solid ${selected === plan.id ? (plan.popular ? '#facc15' : '#2563eb') : '#1a1a1a'}`,
              borderRadius: 14, padding: '14px 16px', marginBottom: 10,
              cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              position: 'relative', transition: '0.15s',
            }}>
              {plan.popular && (
                <div style={{ position: 'absolute', top: -10, left: 16, background: '#facc15', color: '#111', fontSize: 10, fontWeight: 800, padding: '2px 10px', borderRadius: 10 }}>
                  ⭐ MOST POPULAR
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{plan.label}</div>
                <div style={{ color: '#666', fontSize: 11, marginTop: 1 }}>{plan.duration} · {plan.tag}</div>
                {plan.saving && <div style={{ color: '#4ade80', fontSize: 12, fontWeight: 700, marginTop: 4 }}>Save {plan.saving}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                {plan.original && <div style={{ color: '#555', fontSize: 12, textDecoration: 'line-through' }}>₹{plan.original}</div>}
                <div style={{ fontWeight: 900, fontSize: 22, color: selected === plan.id && plan.popular ? '#facc15' : '#fff' }}>₹{plan.price}</div>
                <div style={{ color: '#555', fontSize: 11 }}>
                  ₹{Math.round(plan.price / (plan.id === 'monthly' ? 1 : plan.id === 'quarterly' ? 3 : plan.id === 'half_yearly' ? 6 : 12))}/mo
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Selected plan summary */}
        <div style={{ background: '#111', borderRadius: 14, padding: 16, marginBottom: 20, border: '1px solid #222' }}>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>Order summary</div>
          {(() => {
            const plan = PLANS.find(p => p.id === selected)
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#ccc', fontSize: 14 }}>CarpoolKaro Pro — {plan.label}</span>
                  <span style={{ fontWeight: 700 }}>₹{plan.price}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#888', fontSize: 13 }}>GST</span>
                  <span style={{ color: '#888', fontSize: 13 }}>Included</span>
                </div>
                <div style={{ borderTop: '1px solid #222', paddingTop: 10, marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700 }}>Total Payable</span>
                  <span style={{ fontWeight: 900, fontSize: 18, color: '#facc15' }}>₹{plan.price}</span>
                </div>
              </>
            )
          })()}
        </div>

        {/* Terms */}
        <div style={{ background: '#0f0f0f', borderRadius: 10, padding: 12, marginBottom: 20, border: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: 12, color: '#555', fontWeight: 700, marginBottom: 6 }}>Terms & Conditions</div>
          <div style={{ fontSize: 11, color: '#444', lineHeight: 1.7 }}>
            1. Subscription is non-refundable once activated.<br/>
            2. No mid-period cancellation. Valid till expiry date.<br/>
            3. Platform fees waived for both posting and booking rides.<br/>
            4. Subscription auto-expires — no auto-renewal.<br/>
            5. One subscription per account.
          </div>
        </div>

        {/* Pay button */}
        <button
          onClick={handleSubscribe}
          disabled={paying}
          style={{
            width: '100%', padding: '16px', borderRadius: 14, border: 'none',
            background: paying ? '#333' : '#facc15', color: '#111',
            fontWeight: 900, fontSize: 16, cursor: paying ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {paying ? '⏳ Processing...' : `⭐ Subscribe for ₹${PLANS.find(p => p.id === selected)?.price}`}
        </button>

        <div style={{ textAlign: 'center', color: '#444', fontSize: 11, marginTop: 12 }}>
          Secured by Razorpay · UPI · Cards · Netbanking
        </div>
      </div>
    </div>
  )
}
