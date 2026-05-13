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

export async function registerPushNotifications(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false
  }

  try {
    // Register service worker
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    // Request permission
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return false
    }

    // Subscribe to push
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    // Save subscription to Supabase
    const subJSON = subscription.toJSON()
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subJSON.endpoint,
      p256dh: subJSON.keys?.p256dh,
      auth: subJSON.keys?.auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    return true
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
