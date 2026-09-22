/**
 * Where the app is running, for picking a sign-in flow that works there.
 *
 * - Installed PWA: a sign-in popup opens in a separate browser context that
 *   cannot hand the result back ("missing initial state"), so use redirect.
 * - In-app browsers (LINE, Facebook, ...): Google refuses sign-in inside
 *   embedded webviews, so the user has to move to a real browser.
 */

export type InAppBrowser = 'line' | 'facebook' | 'instagram' | 'wechat' | 'other'

export function inAppBrowser(userAgent: string): InAppBrowser | null {
  if (/\bLine\//i.test(userAgent)) return 'line'
  if (/FBAN|FBAV|FB_IAB/i.test(userAgent)) return 'facebook'
  if (/Instagram/i.test(userAgent)) return 'instagram'
  if (/MicroMessenger/i.test(userAgent)) return 'wechat'
  // Android system WebView marks itself with "; wv)".
  if (/; wv\)/.test(userAgent)) return 'other'
  return null
}

/** LINE opens a URL in the phone's default browser when it carries this flag. */
export function externalBrowserUrl(href: string, app: InAppBrowser | null): string | null {
  if (app !== 'line') return null
  const url = new URL(href)
  url.searchParams.set('openExternalBrowser', '1')
  return url.toString()
}

export function isStandalone(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}
