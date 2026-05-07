// Supabase Edge Function: razorpay-order
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAZORPAY_KEY_ID = 'rzp_test_Sma5HY4LkGPTa3'
const RAZORPAY_KEY_SECRET = 'gNlk15OB4UB1ToyX1n1kLlJK'

Deno.serve(async (req) => {
  try {
    const { action, amount, payment_id, order_id, signature, user_id } = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

    // CREATE ORDER
    if (action === 'create_order') {
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amount * 100, currency: 'INR', receipt: `wallet_${Date.now()}` })
      })
      const order = await res.json()
      return new Response(JSON.stringify(order), { headers: { 'Content-Type': 'application/json' } })
    }

    // VERIFY + CREDIT WALLET
    if (action === 'verify_payment') {
      // Verify Razorpay signature
      const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(RAZORPAY_KEY_SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      )
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${order_id}|${payment_id}`))
      const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('')

      if (expectedSig !== signature) {
        return new Response(JSON.stringify({ error: 'Payment verification failed' }), { status: 400 })
      }

      // Credit wallet atomically
      const amountPaise = amount * 100
      await supabase.rpc('credit_wallet', {
        p_user_id: user_id,
        p_amount: amountPaise,
        p_type: 'razorpay',
        p_description: `Wallet recharge ₹${amount} via Razorpay UPI`,
        p_booking_id: null
      })

      // Record Razorpay payment ID
      await supabase.from('wallet_transactions')
        .update({ razorpay_payment_id: payment_id })
        .eq('user_id', user_id)
        .eq('type', 'razorpay')
        .order('created_at', { ascending: false })
        .limit(1)

      return new Response(JSON.stringify({ success: true, credited: amount }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response('Invalid action', { status: 400 })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
