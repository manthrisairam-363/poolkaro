import { useEffect } from 'react'
import { supabase } from './supabase'

// ── Keeps installed apps on the latest build ──
// iOS home-screen apps (and the Play Store wrapper) resume from memory instead
// of reloading, so a phone can run code that is weeks old. On every open and
// every return to the foreground we compare our baked-in build id with the
// one on the server (/version.json, emitted by vite.config.js) and reload
// once when they differ.

const CURRENT_BUILD = typeof __BUILD_ID__ !== 'undefined' ? String(__BUILD_ID__) : 'dev'
const CHECK_EVERY_MS = 60 * 1000
let lastCheck = 0

async function fetchServerBuild() {
  try {
    const r = await fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json()
    return j?.build ? String(j.build) : null
  } catch (_) { return null }
}

function hardReload(guardKey, guardValue) {
  // Reload at most once per value per device — never loop.
  try {
    if (localStorage.getItem(guardKey) === guardValue) return
    localStorage.setItem(guardKey, guardValue)
  } catch (_) {}
  try { navigator.serviceWorker?.getRegistration?.().then(r => r?.update()) } catch (_) {}
  window.location.reload()
}

export async function checkForUpdate({ force = false } = {}) {
  const now = Date.now()
  if (!force && now - lastCheck < CHECK_EVERY_MS) return
  lastCheck = now
  if (CURRENT_BUILD === 'dev') return          // vite dev server has no version.json
  const server = await fetchServerBuild()
  if (server && server !== CURRENT_BUILD) hardReload('ck_reloaded_for_build', server)
}

// Admin → Version tab → "Force Update": when ON, every device reloads once for
// the current Min Version value. To push again later, bump Min Version.
export async function applyAdminForceUpdate() {
  try {
    const { data } = await supabase.from('app_settings').select('key,value').in('key', ['force_update', 'min_version'])
    const map = {}
    ;(data || []).forEach(s => { map[s.key] = s.value })
    if (map.force_update !== 'true') return
    hardReload('ck_forced_for_version', String(map.min_version || '0'))
  } catch (_) {}
}

export function useAppUpdate() {
  useEffect(() => {
    checkForUpdate({ force: true })
    applyAdminForceUpdate()
    const onVisible = () => { if (document.visibilityState === 'visible') checkForUpdate() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [])
}

export const APP_BUILD_ID = CURRENT_BUILD
