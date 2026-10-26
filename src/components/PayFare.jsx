import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ── Pay the driver (person-to-person UPI) ──
// Tested 25 Oct 2026 on iPhone + Android: PhonePe, Google Pay and Paytm all
// REFUSE payment links (upi://pay, phonepe://pay, tez://, paytmmp://) that point
// at a personal UPI ID, with or without an amount — "declined for security
// reasons". Only verified merchants get that flow. So this screen never tries
// a pay-link. It does what the apps themselves allow, as fast as possible:
//   1. One tap: copy the payee (UPI ID, or mobile number) AND open the app.
//      In the app: "To UPI ID" / "To Mobile Number" → paste → amount → pay.
//   2. UPI ID and mobile number shown with Copy buttons.
//   3. QR (amount pre-filled) for a second device, or save → Scan → Gallery.
//   4. "I've paid" → marks the booking and notifies the driver, who confirms.
// Used by BookRide (after booking) and MyRides (pay sheet). Change it here only.

const APPS = [
  { key: 'phonepe', label: 'PhonePe',    scheme: 'phonepe://', bg: '#5f259f', fg: '#fff' },
  { key: 'gpay',    label: 'Google Pay', scheme: 'tez://',     bg: '#1a73e8', fg: '#fff' },
  { key: 'paytm',   label: 'Paytm',      scheme: 'paytmmp://', bg: '#00b9f1', fg: '#fff' },
]

function buildQrUrl(upi, name, amount) {
  const pa = String(upi || '').trim()
  const pn = encodeURIComponent(String(name || 'Car Owner').trim())
  const am = Number(amount || 0).toFixed(2)
  return `upi://pay?pa=${pa}&pn=${pn}&am=${am}&cu=INR&tn=${encodeURIComponent('CarpoolKaro fare')}`
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch (_) {}
  try {
    const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'
    document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); return true
  } catch (_) { return false }
}

export default function PayFare({
  amount, ownerName, upiId, phone, payByPhone = true,
  bookingId, driverId, route = '', dark = false, onPaid,
}) {
  const { user } = useAuth()
  const upi = String(upiId || '').trim()
  const mobile = payByPhone !== false ? String(phone || '').trim() : ''
  // What the one-tap buttons copy: UPI ID when the driver has one, else number.
  const payee = upi || mobile
  const payeeKind = upi ? 'UPI ID' : 'mobile number'
  const [qr, setQr] = useState(null)
  const [copied, setCopied] = useState('')      // 'upi' | 'phone' | app key
  const [hint, setHint] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!upi || !amount) { setQr(null); return }
    QRCode.toDataURL(buildQrUrl(upi, ownerName, amount), { width: 440, margin: 1 }).then(setQr).catch(() => setQr(null))
  }, [upi, amount, ownerName])

  function flash(key, text) { setCopied(key); setHint(text); setTimeout(() => setCopied(''), 1600) }

  async function copyAndOpen(app) {
    if (!payee) return
    await copyText(payee)
    flash(app.key, `✓ ${payeeKind} copied. In ${app.label}: tap "To ${upi ? 'UPI ID' : 'Mobile Number'}" → paste → enter ₹${amount} → pay.`)
    // Open the app itself (NOT a payment link — those are blocked for P2P).
    setTimeout(() => { try { window.location.href = app.scheme } catch (_) {} }, 250)
  }

  async function markPaid() {
    if (!bookingId || !user?.id) return
    if (!window.confirm(`Confirm you've paid ₹${amount} to ${ownerName || 'the driver'}?\n\nOnly tap OK after the UPI payment went through. The driver will be asked to confirm.`)) return
    setSaving(true)
    const { data, error } = await supabase.from('bookings')
      .update({ payment_status: 'paid' }).eq('id', bookingId).eq('rider_id', user.id).select('id')
    if (error || !data?.length) {
      setSaving(false)
      alert(error ? `Could not save: ${error.message}` : "Couldn't update the payment status. Please tell the admin.")
      return
    }
    if (driverId) {
      await supabase.from('notifications').insert({
        user_id: driverId, type: 'booking', booking_id: bookingId, is_read: false,
        title: '💰 Payment received?',
        message: `${user?.user_metadata?.full_name || 'Your rider'} marked ₹${amount} as paid${route ? ` for ${route}` : ''}. Tap "Got it" in My Rides to confirm.`,
      })
    }
    setSaving(false); setDone(true)
    onPaid?.()
  }

  // palette
  const c = dark
    ? { fg: '#fff', sub: '#9aa', muted: '#666', card: '#1a1a1a', line: '#333', btn: '#222', accent: '#facc15', accentFg: '#111', ok: '#16a34a', warnBg: '#2a1500', warnLine: '#78350f', warnFg: '#f97316' }
    : { fg: '#0f172a', sub: '#64748b', muted: '#94a3b8', card: '#f8fafc', line: '#e2e8f0', btn: '#111', accent: '#111', accentFg: '#fff', ok: '#16a34a', warnBg: '#fff7ed', warnLine: '#fed7aa', warnFg: '#c2410c' }
  const label = { fontSize: 11, fontWeight: 800, color: c.fg, letterSpacing: 0.4, marginBottom: 8 }
  const row = { background: c.card, border: `1px solid ${c.line}`, borderRadius: 12, padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }
  const copyBtn = (active) => ({ flexShrink: 0, padding: '9px 16px', background: active ? c.ok : c.btn, color: '#fff', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' })

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '18px 0' }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: c.fg, marginTop: 6 }}>Marked as paid</div>
        <div style={{ fontSize: 13, color: c.sub, marginTop: 4, lineHeight: 1.5 }}>{ownerName || 'The driver'} has been notified and will confirm receiving ₹{amount}.</div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: c.muted, letterSpacing: 1 }}>PAY DRIVER</div>
        <div style={{ fontSize: 34, fontWeight: 900, color: dark ? c.accent : c.fg, margin: '4px 0' }}>₹{amount}</div>
        <div style={{ fontSize: 12, color: c.sub }}>to {ownerName || 'car owner'} · paid directly, not through CarpoolKaro</div>
      </div>

      {!payee ? (
        <div style={{ background: c.warnBg, border: `1px solid ${c.warnLine}`, borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: c.warnFg, fontWeight: 700, marginBottom: 4 }}>⚠️ {ownerName || 'The car owner'} hasn't added a UPI ID yet</div>
          <div style={{ fontSize: 12, color: c.sub, lineHeight: 1.5 }}>Ask them in chat for their UPI ID or number, pay from your UPI app, then come back and tap "I've paid".</div>
        </div>
      ) : (
        <>
          {/* 1. One tap: copy payee + open the app */}
          <div style={label}>FASTEST — tap your app</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            {APPS.map(app => (
              <button key={app.key} onClick={() => copyAndOpen(app)} style={{ padding: '12px 6px', background: copied === app.key ? c.ok : app.bg, color: app.fg, border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                {copied === app.key ? '✓ Copied' : app.label}
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, color: hint ? (dark ? '#4ade80' : '#15803d') : c.sub, lineHeight: 1.5, marginBottom: 16, minHeight: 18 }}>
            {hint || `Copies the ${payeeKind} and opens the app. Then: "To ${upi ? 'UPI ID' : 'Mobile Number'}" → paste → ₹${amount} → pay.`}
          </div>

          {/* 2. Payee details with copy */}
          <div style={label}>OR COPY AND PAY IN ANY UPI APP</div>
          {upi && (
            <div style={row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, color: c.muted, fontWeight: 700 }}>UPI ID</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: c.fg, overflow: 'hidden', textOverflow: 'ellipsis' }}>{upi}</div>
              </div>
              <button onClick={async () => { await copyText(upi); flash('upi', `✓ UPI ID copied. In your app: "To UPI ID" → paste → ₹${amount}.`) }} style={copyBtn(copied === 'upi')}>{copied === 'upi' ? '✓ Copied' : 'Copy'}</button>
            </div>
          )}
          {mobile && (
            <div style={row}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, color: c.muted, fontWeight: 700 }}>MOBILE NUMBER (UPI)</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: c.fg }}>{mobile}</div>
              </div>
              <button onClick={async () => { await copyText(mobile); flash('phone', `✓ Number copied. In your app: "To Mobile Number" → paste → ₹${amount}.`) }} style={copyBtn(copied === 'phone')}>{copied === 'phone' ? '✓ Copied' : 'Copy'}</button>
            </div>
          )}

          {/* 3. QR */}
          {qr && (
            <details style={{ marginTop: 6, marginBottom: 14 }}>
              <summary style={{ fontSize: 12, fontWeight: 700, color: c.sub, cursor: 'pointer' }}>Show QR code (₹{amount} pre-filled)</summary>
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <img src={qr} alt="UPI QR code" style={{ width: 180, height: 180, background: '#fff', borderRadius: 14, padding: 6, border: `1px solid ${c.line}` }} />
                <a href={qr} download={`carpoolkaro-pay-${amount}.png`} style={{ display: 'block', margin: '8px auto 0', maxWidth: 220, padding: 10, background: c.btn, color: '#fff', borderRadius: 10, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>⬇ Save QR image</a>
                <div style={{ fontSize: 11, color: c.sub, marginTop: 8, lineHeight: 1.5 }}>Scan it with another phone, or save it and in your UPI app tap <b>Scan → Gallery</b>.</div>
              </div>
            </details>
          )}
        </>
      )}

      {/* 4. Confirm */}
      {bookingId && (
        <button onClick={markPaid} disabled={saving} style={{ width: '100%', padding: 14, background: c.ok, color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', opacity: saving ? 0.6 : 1, marginTop: 4 }}>
          {saving ? 'Saving…' : `✓ I've paid ₹${amount}`}
        </button>
      )}
    </div>
  )
}
