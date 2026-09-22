/** Who made this build, which build it is, and where problems get reported. */

export const APP_AUTHOR = 'stevedaydream'
export const APP_VERSION = __APP_VERSION__
export const APP_COMMIT = __APP_COMMIT__
export const REPO_URL = 'https://github.com/stevedaydream/Divvy-split'

/**
 * A new GitHub issue pre-filled with the build and the page it came from.
 * Deliberately nothing about the user: issues on this repo are public.
 */
export function bugReportUrl(page: string, userAgent: string): string {
  const body = [
    '**What happened?**',
    '',
    '',
    '**What did you expect?**',
    '',
    '',
    '---',
    `Version: ${APP_VERSION} (${APP_COMMIT})`,
    `Page: ${page}`,
    `Device: ${userAgent}`,
  ].join('\n')
  const params = new URLSearchParams({ labels: 'bug', body })
  return `${REPO_URL}/issues/new?${params}`
}
