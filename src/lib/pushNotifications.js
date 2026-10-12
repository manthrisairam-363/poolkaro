import { useEffect } from 'react'
import { supabase } from './supabase'

// Your VAPID public key
const VAPID_PUBLIC_KEY = 'BJ-QZEJJ3W4XFnven7-nKYK14tJJQrHB6QnCTr0nqZEx8DqDLsbDc6yncSVGpW3IgjIHeokCDOmFUzacJpvC2Ck'

// Bump this string to force every device to re-subscribe once (heals stale
// subscriptions left over from when push was misconfigured). Stored per-device
// in localStorage; after a successful fresh subscribe we record it so there's
// no ongoing churn.
const FRESH_MARKER = 'push_fresh_v2'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

function keysEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

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

// Report state without prompting: 'on' | 'off' | 'blocked' | 'unsupported'.
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

// Permission is granted here. force=true tears down the existing subscription
// (even one that looks valid) and creates a brand-new one — this is what heals a
// stale endpoint that the browser still reports as fine but the push service has
// killed. force=false keeps a healthy, key-matching subscription.
async function ensureSubscribed(reg, userId, force = false) {
  const existing = await reg.pushManager.getSubscription()
  if (existing) {
    if (!force) {
      const currentKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      const existingKey = existing.options?.applicationServerKey
      const matches = existingKey && keysEqual(new Uint8Array(existingKey), currentKey)
      if (matches) { await saveSubscription(userId, existing); return true }
    }
    // force, or key mismatch → drop the old endpoint (DB + browser) and remake it.
    const oldEndpoint = existing.endpoint
    try { await existing.unsubscribe() } catch (_) {}
    if (oldEndpoint) await supabase.from('push_subscriptions').delete().eq('endpoint', oldEndpoint)
  }
  return await subscribeFresh(reg, userId)
}

// interactive=true → triggered by a user tap, so always prompt on 'default'
// (required on iOS). force=true → re-create the subscription from scratch.
// Returns 'on' | 'off' | 'blocked' | 'unsupported'.
export async function registerPushNotifications(userId, { interactive = false, force = false } = {}) {
  if (!supported()) return 'unsupported'
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    if (Notification.permission === 'denied') return 'blocked'

    if (Notification.permission === 'default') {
      if (!interactive) {
        const alreadyAsked = localStorage.getItem('push_permission_asked')
        if (alreadyAsked) return 'off'
        localStorage.setItem('push_permission_asked', '1')
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
    }

    await ensureSubscribed(reg, userId, force)
    return 'on'
  } catch (err) {
    console.error('Push registration failed:', err)
    return 'off'
  }
}

// Tap-initiated enable / refresh. Always prompts and always re-creates the
// subscription fresh — so one tap fixes a device whose alerts have gone stale.
export async function enablePush(userId) {
  return registerPushNotifications(userId, { interactive: true, force: true })
}

// Hook: quiet auto-attempt a few seconds after login. The FIRST time on each
// device after this version ships, it force-refreshes once to heal any stale
// subscription, then records FRESH_MARKER so it won't churn afterwards.
export function usePushNotifications(userId) {
  useEffect(() => {
    if (!userId) return
    const timer = setTimeout(() => {
      let needsFresh = false
      try { needsFresh = !localStorage.getItem(FRESH_MARKER) } catch (_) {}
      registerPushNotifications(userId, { force: needsFresh }).then(state => {
        if (state === 'on') { try { localStorage.setItem(FRESH_MARKER, '1') } catch (_) {} }
      })
    }, 3000)
    return () => clearTimeout(timer)
  }, [userId])
}
