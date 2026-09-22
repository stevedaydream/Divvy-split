/**
 * Minimal Gemini client for the AI trip guide.
 *
 * Each person brings their own API key, kept on this device only (D16):
 * there is no server to hide a shared key behind without leaving the free
 * Firebase plan, and a key in the bundle or in Firestore would be public.
 */

/** Stable Flash model; see https://ai.google.dev/gemini-api/docs/models */
export const GEMINI_MODEL = 'gemini-3.6-flash'

const KEY_STORAGE = 'divvy:gemini-key'
const QUOTA_STORAGE = 'divvy:gemini-quota-until'

export function readGeminiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function writeGeminiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim())
    else localStorage.removeItem(KEY_STORAGE)
    // A different key has its own quota.
    localStorage.removeItem(QUOTA_STORAGE)
  } catch { /* the key then lasts for this session only */ }
}

/** When the user's own key may be used again (epoch ms), or 0 if it may now. */
export function readQuotaUntil(now = Date.now()): number {
  try {
    const until = Number(localStorage.getItem(QUOTA_STORAGE) ?? 0)
    return until > now ? until : 0
  } catch {
    return 0
  }
}

export function writeQuotaUntil(until: number): void {
  try {
    localStorage.setItem(QUOTA_STORAGE, String(until))
  } catch { /* the block then lasts for this session only */ }
}

/** Minutes east of UTC for `timeZone` at `instant` (PDT → -420). */
function offsetMinutes(instant: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(instant).map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!)
  return Math.round((asUtc - instant) / 60_000)
}

/** Daily Gemini quotas reset at midnight Pacific Time. */
export function nextPacificMidnight(now: number): number {
  const tz = 'America/Los_Angeles'
  const local = now + offsetMinutes(now, tz) * 60_000
  const d = new Date(local)
  const midnightAsUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
  // The offset at midnight itself can differ from now's across a DST change.
  const guess = midnightAsUtc - offsetMinutes(midnightAsUtc, tz) * 60_000
  return midnightAsUtc - offsetMinutes(guess, tz) * 60_000
}

/**
 * Reads a 429 body (google.rpc error details) and works out when the key
 * works again: a per-day quota resets at Pacific midnight, anything else
 * after the suggested `retryDelay` (a minute when none is given).
 */
export function quotaResetAt(body: unknown, now: number): number {
  const details = ((body as { error?: { details?: unknown[] } })?.error?.details ?? []) as Record<string, unknown>[]
  const daily = details.some((d) =>
    ((d.violations as { quotaId?: string }[] | undefined) ?? []).some((v) => /PerDay/i.test(v.quotaId ?? '')),
  )
  if (daily) return nextPacificMidnight(now)

  const delay = details.map((d) => d.retryDelay).find((v): v is string => typeof v === 'string')
  const seconds = delay ? Number.parseFloat(delay) : Number.NaN
  return now + Math.max(10, Number.isFinite(seconds) ? Math.ceil(seconds) : 60) * 1000
}

export type GeminiError = 'invalid-key' | 'quota' | 'blocked' | 'failed'

export class GeminiRequestError extends Error {
  constructor(
    readonly reason: GeminiError,
    /** For `quota`: when the key may be used again (epoch ms). */
    readonly resetAt = 0,
  ) {
    super(reason)
  }
}

/** Sends one prompt and returns the model's text, which should be JSON. */
export async function askGemini(apiKey: string, prompt: string, signal?: AbortSignal): Promise<string> {
  let response: Response
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        // The key goes in a header, not the URL, so it stays out of logs.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
        }),
        signal,
      },
    )
  } catch (cause) {
    if ((cause as Error).name === 'AbortError') throw cause
    throw new GeminiRequestError('failed')
  }

  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new GeminiRequestError('invalid-key')
  }
  if (response.status === 429) {
    const body = await response.json().catch(() => null)
    throw new GeminiRequestError('quota', quotaResetAt(body, Date.now()))
  }
  if (!response.ok) throw new GeminiRequestError('failed')

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
    promptFeedback?: { blockReason?: string }
  }
  if (data.promptFeedback?.blockReason) throw new GeminiRequestError('blocked')
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text) throw new GeminiRequestError('failed')
  return text
}

export interface FallbackOutcome {
  reply: string
  /** True when the fallback, not the user's key, produced `reply`. */
  usedFallback: boolean
  /** Set when the user's key hit its quota: when it works again (epoch ms). */
  resetAt: number
}

/**
 * Runs `primary`; only if it fails for quota does `fallback` get exactly one
 * try at the same request. Any other failure — or a failed fallback —
 * surfaces the original error, carrying the reset time for quota errors.
 */
export async function withQuotaFallback(
  primary: () => Promise<string>,
  fallback: (() => Promise<string>) | null,
): Promise<FallbackOutcome> {
  try {
    return { reply: await primary(), usedFallback: false, resetAt: 0 }
  } catch (cause) {
    if (!(cause instanceof GeminiRequestError) || cause.reason !== 'quota' || !fallback) throw cause
    try {
      return { reply: await fallback(), usedFallback: true, resetAt: cause.resetAt }
    } catch {
      throw cause
    }
  }
}
