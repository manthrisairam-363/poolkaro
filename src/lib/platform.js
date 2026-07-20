// Detects what device/mode a user is on, so admin can send the right guidance:
//   iOS + browser     → "Add to Home Screen" instructions
//   Android + browser → "Get it on Play Store"
//   installed (PWA)   → already set up, leave them alone

export function detectPlatform() {
  const ua = navigator.userAgent || ''

  // iPadOS 13+ reports itself as MacIntel, so touch points are the giveaway
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  const isAndroid = /Android/.test(ua)

  const platform = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop'

  // Installed PWA: standard API, plus the iOS-only legacy flag
  const isPWA =
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.navigator.standalone === true

  return { platform, isPWA }
}

export const PLATFORM_LABEL = {
  ios: '🍎 iOS',
  android: '🤖 Android',
  desktop: '💻 Desktop',
}

export function platformText(p) {
  if (!p?.platform) return '—'
  return `${PLATFORM_LABEL[p.platform] || p.platform} · ${p.is_pwa ? 'Installed' : 'Browser'}`
}
