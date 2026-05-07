// Supabase Edge Function: send-push
// Triggered when a new notification is inserted in the notifications table
// Sends a real push notification to the user's device

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = 'BDR1ZxndWyTzbi-UO1Bw6PGq4dws7sQB-IsmXDKxJn-_OuQsM-yieaaOLu3wPsPbMnSL91lkdHrejo5zAMG-w9Y'
const VAPID_PRIVATE_KEY = 'XEHpfUFILjEOf6Xo6psHXEk6O_POmYmGSfI3odkdezY'
const VAPID_SUBJECT = 'mailto:poolkaro.app@gmail.com'

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function signJWT(header: object, payload: object, privateKeyPem: string): Promise<string> {
  const encoder = new TextEncoder()
  const headerB64 = base64url(encoder.encode(JSON.stringify(header)))
  const payloadB64 = base64url(encoder.encode(JSON.stringify(payload)))
  const signingInput = `${headerB64}.${payloadB64}`

  const keyData = Uint8Array.from(
    atob(privateKeyPem.replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0)
  )

  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(signingInput)
  )

  return `${signingInput}.${base64url(new Uint8Array(signature))}`
}

async function sendPushNotification(subscription: any, payload: object) {
  const { endpoint, p256dh, auth } = subscription

  const now = Math.floor(Date.now() / 1000)
  const origin = new URL(endpoint).origin

  const jwt = await signJWT(
    { typ: 'JWT', alg: 'ES256' },
    { aud: origin, exp: now + 12 * 60 * 60, sub: VAPID_SUBJECT },
    VAPID_PRIVATE_KEY
  )

  const payloadStr = JSON.stringify(payload)
  const payloadBytes = new TextEncoder().encode(payloadStr)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aesgcm',
      'TTL': '86400',
    },
    body: payloadBytes,
  })

  return response.status
}

Deno.serve(async (req) => {
  try {
    const body = await req.json()
    const record = body.record // new notification record

    if (!record?.user_id) {
      return new Response('No user_id', { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get push subscription for this user
    const { data: sub } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', record.user_id)
      .maybeSingle()

    if (!sub) {
      return new Response('No subscription found', { status: 200 })
    }

    // Send push notification
    const status = await sendPushNotification(sub, {
      title: record.title,
      body: record.message,
      url: record.ride_id ? `/my-rides` : '/',
      tag: record.type,
    })

    return new Response(JSON.stringify({ sent: true, status }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Push error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
