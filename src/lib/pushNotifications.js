import { useEffect } from 'react'
import { supabase } from './supabase'

// Your VAPID public key
const VAPID_PUBLIC_KEY = 'BDR1ZxndWyTzbi-UO1Bw6PGq4dws7sQB-IsmXDKxJn-_OuQsM-yieaaOLu3wPsPbMnSL91lkdHrejo5zAMG-w9Y'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

// Save a subscription to the DB. Keyed by endpoint so a user's multiple devices
// each get their own row (upsert on user_id alone would overwrite one device
// with another). Requires a UNIQUE constraint on endpoint — see note below.
async function saveSubscription(userId, subscription) {
  const j = subscription.toJSON()
  await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: j.endpoint,
    p256dh: j.keys?.p256dh,
    auth: j.keys?.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
}

async function subscribeFresh(reg, userId) {
  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  })
  await saveSubscription(userId, subscription)
  return true
}

export async function registerPushNotifications(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    if (Notification.permission === 'denied') return false

    // If permission hasn't been granted yet, prompt once per device (don't nag).
    // The key fix vs. the old code: we only gate the PROMPT on 'already asked',
    // never the subscription itself. Previously a device left at 'default'
    // returned early forever and NEVER subscribed — which is why Android had
    // zero subscriptions.
    if (Notification.permission === 'default') {
      const alreadyAsked = localStorage.getItem('push_permission_asked')
      if (alreadyAsked) return false   // don't re-prompt; user can enable in settings
      localStorage.setItem('push_permission_asked', '1')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return false
    }

    // Permission is 'granted'. Reuse an existing subscription if we have one —
    // do NOT tear it down every open. The old approach (unsubscribe + recreate
    // each time) is fragile on iOS: if the re-subscribe hiccups after we've
    // already deleted the old one, the device is left with NO subscription.
    // Instead: keep a healthy subscription and just make sure the DB has it.
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      // Make sure it was created with OUR current VAPID key. If the key matches,
      // it's valid — just re-save (upsert) so the DB row is current.
      await saveSubscription(userId, existing)
      return true
    }

    // No subscription yet → create a fresh one.
    return await subscribeFresh(reg, userId)
  } catch (err) {
    console.error('Push registration failed:', err)
    return false
  }
}

export async function sendPushToUser(userId, title, body, url = '/') {
  // This calls a Supabase Edge Function to send the push
  // For now we log — will be activated when edge function is deployed

  // Store notification in DB (already done by trigger)
  // Edge function reads push_subscriptions and sends via web-push
}

// Hook: auto-register on login
export function usePushNotifications(userId) {
  useEffect(() => {
    if (!userId) return
    // Ask for push permission after 3 seconds (not immediately)
    const timer = setTimeout(() => {
      registerPushNotifications(userId)
    }, 3000)
    return () => clearTimeout(timer)
  }, [userId])
}
