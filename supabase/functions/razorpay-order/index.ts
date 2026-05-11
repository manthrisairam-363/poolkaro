import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID') || 'rzp_live_SmmsIwgzymP6m6'
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // ── FIX: Get user from JWT FIRST, before reading body ──
    const authHeader = req.headers.get('Authorization') || ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const userId = user.id // Always from JWT — never from body

    const { action, amount, payment_id, order_id, signature } = await req.json()

    // Validate amount server-side
    if (amount && (amount < 20 || amount > 10000)) {
      return new Response(JSON.stringify({ error: 'Invalid amount. Min ₹20, Max ₹10,000' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const razorpayAuth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)

    // ── CREATE ORDER ──
    if (action === 'create_order') {
      const res = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: { 'Authorization': `Basic ${razorpayAuth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amount * 100, currency: 'INR', receipt: `wallet_${Date.now()}` })
      })
      const order = await res.json()
      console.log('Order created:', order.id, 'for user:', userId)
      return new Response(JSON.stringify(order), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── VERIFY PAYMENT + CREDIT WALLET ──
    if (action === 'verify_payment') {
      // Verify Razorpay signature
      const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(RAZORPAY_KEY_SECRET),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      )
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${order_id}|${payment_id}`))
      const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('')

      if (expectedSig !== signature) {
        return new Response(JSON.stringify({ error: 'Payment verification failed' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Credit wallet using JWT userId — not body
      const amountPaise = amount * 100
      await supabase.rpc('credit_wallet', {
        p_user_id: userId,
        p_amount: amountPaise,
        p_type: 'razorpay',
        p_description: `Wallet recharge ₹${amount} via Razorpay`,
        p_booking_id: null,
      })

      console.log('Wallet credited ₹', amount, 'for verified user:', userId)
      return new Response(JSON.stringify({ success: true, credited: amount }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response('Invalid action', { status: 400, headers: corsHeaders })

  } catch (err) {
    console.error('Error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
