/**
 * LINE publishes no URL scheme for LINE Pay transfers or for opening a chat
 * with a specific person, so the best we can do is open their profile page.
 * `~id` is a personal LINE ID; `@id` is an Official Account.
 */
export function lineProfileUrl(lineId: string): string {
  const id = lineId.trim()
  if (id.startsWith('@')) return `https://line.me/R/ti/p/${encodeURIComponent(id)}`
  return `https://line.me/ti/p/~${encodeURIComponent(id.replace(/^~/, ''))}`
}
