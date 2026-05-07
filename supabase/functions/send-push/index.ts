// PoolKaro Push Notification Edge Function
// Uses npm:web-push for proper VAPID handling

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = 'BDR1ZxndWyTzbi-UO1Bw6PGq4dws7sQB-IsmXDKxJn-_OuQsM-yieaaOLu3wPsPbMnSL91lkdHrejo5zAMG-w9Y'
const VAPID_PRIVATE_KEY = 'XEHpfUFILjEOf6Xo6psHXEk6O_POmYmGSfI3odkdezY'

webpush.setVapidDetails(
  'mailto:poolkaro.app@gmail.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
)

Deno.serve(async (req) => {
  try {
    const body = await req.json()
    const record = body.record

    if (!record?.user_id) {
      return new Response('No user_id', { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get push subscription for this user
    const { data: sub, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', record.user_id)
      .maybeSingle()

    if (error) {
      console.error('DB error:', error)
      return new Response('DB error', { status: 500 })
    }

    if (!sub) {
      console.log('No subscription for user:', record.user_id)
      return new Response('No subscription', { status: 200 })
    }

    // Build subscription object for web-push
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      }
    }

    // Send push notification
    const payload = JSON.stringify({
      title: record.title || 'PoolKaro',
      body: record.message || 'You have a new notification',
      url: '/my-rides',
      tag: record.type || 'poolkaro',
    })

    await webpush.sendNotification(pushSubscription, payload)

    console.log('Push sent successfully to:', record.user_id)
    return new Response(JSON.stringify({ sent: true }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('Push error:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
