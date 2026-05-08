import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') || 'rzp_live_SmmsIwgzymP6m6'
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || ''

// CORS headers — required for browser requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  // Handle preflight CORS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, amount, payment_id, order_id, signature, user_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

    // ── CREATE ORDER ──
    if (action === 'create_order') {
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount * 100,
          currency: 'INR',
          receipt: `wallet_${Date.now()}`,
        })
      })

      const order = await res.json()
      console.log('Order created:', order.id)

      return new Response(JSON.stringify(order), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── VERIFY PAYMENT + CREDIT WALLET ──
    if (action === 'verify_payment') {
      // Verify Razorpay signature
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(RAZORPAY_KEY_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
      )
      const sig = await crypto.subtle.sign(
        'HMAC', key,
        new TextEncoder().encode(`${order_id}|${payment_id}`)
      )
      const expectedSig = Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0')).join('')

      if (expectedSig !== signature) {
        return new Response(
          JSON.stringify({ error: 'Payment verification failed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Credit wallet
      const amountPaise = amount * 100
      await supabase.rpc('credit_wallet', {
        p_user_id: user_id,
        p_amount: amountPaise,
        p_type: 'razorpay',
        p_description: `Wallet recharge ₹${amount} via Razorpay`,
        p_booking_id: null,
      })

      console.log('Wallet credited:', amount, 'for user:', user_id)

      return new Response(
        JSON.stringify({ success: true, credited: amount }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response('Invalid action', {
      status: 400,
      headers: corsHeaders
    })

  } catch (err) {
    console.error('Error:', err.message)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
