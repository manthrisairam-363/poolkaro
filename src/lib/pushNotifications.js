import { useEffect } from 'react'
import { supabase } from './supabase'

// Your VAPID public key
const VAPID_PUBLIC_KEY = 'BJ-QZEJJ3W4XFnven7-nKYK14tJJQrHB6QnCTr0nqZEx8DqDLsbDc6yncSVGpW3IgjIHeokCDOmFUzacJpvC2Ck'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

// Byte-compare two Uint8Arrays — used to check if an existing push subscription
// was created with our current VAPID public key (mismatched keys silently drop).
function keysEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

// Save a subscription to the DB. Keyed by endpoint so a user's multiple devices
// each get their own row (upsert on user_id alone would overwrite one device
// with another). Requires a UNIQUE constraint on endpoint.
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

const supported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

// Report the current state WITHOUT prompting: 'on' | 'off' | 'blocked' | 'unsupported'.
// Used to render the right label on the Enable button / banner.
export async function getPushState() {
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted') return 'off'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = reg && (await reg.pushManager.getSubscription())
    return sub ? 'on' : 'off'
  } catch (_) { return 'off' }
}

// Permission is 'granted' here — reuse a healthy subscription, or (re)create one.
async function ensureSubscribed(reg, userId) {
  const existing = await reg.pushManager.getSubscription()
  if (existing) {
    const currentKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    const existingKey = existing.options?.applicationServerKey
    const matches = existingKey && keysEqual(new Uint8Array(existingKey), currentKey)
    if (matches) { await saveSubscription(userId, existing); return true }
    // Key mismatch → the device can't decrypt our pushes. Tear down + recreate.
    const oldEndpoint = existing.endpoint
    try { await existing.unsubscribe() } catch (_) {}
    if (oldEndpoint) await supabase.from('push_subscriptions').delete().eq('endpoint', oldEndpoint)
  }
  return await subscribeFresh(reg, userId)
}

// Core register. interactive=true means this was triggered by a USER TAP, so we
// always show the browser prompt (required on iOS, and the only reliable path on
// Chrome). interactive=false is the quiet auto-attempt after login, which asks
// at most once per device and never nags. Returns 'on' | 'off' | 'blocked' | 'unsupported'.
export async function registerPushNotifications(userId, { interactive = false } = {}) {
  if (!supported()) return 'unsupported'
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    if (Notification.permission === 'denied') return 'blocked'

    if (Notification.permission === 'default') {
      if (!interactive) {
        const alreadyAsked = localStorage.getItem('push_permission_asked')
        if (alreadyAsked) return 'off'          // auto path: don't nag
        localStorage.setItem('push_permission_asked', '1')
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
    }

    await ensureSubscribed(reg, userId)
    return 'on'
  } catch (err) {
    console.error('Push registration failed:', err)
    return 'off'
  }
}

// Tap-initiated enable, for the "Enable notifications" button/banner.
export async function enablePush(userId) {
  return registerPushNotifications(userId, { interactive: true })
}

// Hook: quiet auto-attempt a few seconds after login (helps Android/Chrome where
// it can work without a tap; on iOS it no-ops and the Enable button takes over).
export function usePushNotifications(userId) {
  useEffect(() => {
    if (!userId) return
    const timer = setTimeout(() => { registerPushNotifications(userId) }, 3000)
    return () => clearTimeout(timer)
  }, [userId])
}
