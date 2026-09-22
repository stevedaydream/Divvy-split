import { describe, expect, it } from 'vitest'
import { externalBrowserUrl, inAppBrowser } from '../browserEnv'

const UA = {
  line: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0 Mobile Safari/537.36 Line/14.12.0/IAB',
  lineIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.12.0',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]',
  instagram: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36 Instagram 340.0',
  webview: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0 Mobile Safari/537.36',
  chrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
}

describe('inAppBrowser', () => {
  it.each([
    ['line', 'line'], ['lineIos', 'line'], ['facebook', 'facebook'],
    ['instagram', 'instagram'], ['webview', 'other'],
  ] as const)('recognises %s', (key, expected) => {
    expect(inAppBrowser(UA[key])).toBe(expected)
  })

  it('leaves real browsers alone', () => {
    expect(inAppBrowser(UA.chrome)).toBeNull()
    expect(inAppBrowser(UA.safari)).toBeNull()
  })
})

describe('externalBrowserUrl', () => {
  it('adds LINE\'s flag and keeps the existing query', () => {
    expect(externalBrowserUrl('https://divvy-app-e4565.web.app/join?g=a&c=b', 'line')).toBe(
      'https://divvy-app-e4565.web.app/join?g=a&c=b&openExternalBrowser=1',
    )
  })

  it('has no escape hatch for other apps', () => {
    expect(externalBrowserUrl('https://x.test/', 'facebook')).toBeNull()
    expect(externalBrowserUrl('https://x.test/', null)).toBeNull()
  })
})
