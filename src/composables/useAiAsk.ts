import { computed, onScopeDispose, ref } from 'vue'
import { askFallback, isFallbackConfigured } from '@/lib/aiFallback'
import {
  askGemini, GeminiRequestError, readGeminiKey, readQuotaUntil, withQuotaFallback, writeGeminiKey, writeQuotaUntil,
  type AiImage,
} from '@/lib/gemini'

/**
 * Everything an AI feature needs around a request: the user's own key, the
 * quota block, and the one-shot fallback (D16, D18). Shared by the trip
 * guide and the checklist import so they behave identically.
 */
export function useAiAsk(locale: () => string) {
  const apiKey = ref(readGeminiKey())
  const quotaUntil = ref(readQuotaUntil())
  const usedFallback = ref(false)
  const now = ref(Date.now())
  const blocked = computed(() => quotaUntil.value > now.value)

  // Re-enable by itself once the reset time passes.
  const ticker = setInterval(() => {
    now.value = Date.now()
    if (quotaUntil.value && quotaUntil.value <= now.value) quotaUntil.value = 0
  }, 15_000)
  onScopeDispose(() => clearInterval(ticker))

  /** Re-reads device state, e.g. when a sheet opens. */
  function refresh(): void {
    apiKey.value = readGeminiKey()
    quotaUntil.value = readQuotaUntil()
    now.value = Date.now()
    usedFallback.value = false
  }

  function saveKey(key: string): void {
    writeGeminiKey(key)
    refresh()
  }

  function forgetKey(): void {
    writeGeminiKey('')
    refresh()
  }

  /** "14:05" today, otherwise "9/23 15:00", in the viewer's time zone. */
  function resetTime(ms = quotaUntil.value): string {
    const date = new Date(ms)
    const sameDay = date.toDateString() === new Date().toDateString()
    const time = date.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    return sameDay ? time : `${date.getMonth() + 1}/${date.getDate()} ${time}`
  }

  function block(until: number): void {
    writeQuotaUntil(until)
    quotaUntil.value = until
    now.value = Date.now()
  }

  /**
   * Asks with the user's key. On a quota error the fallback finishes this one
   * request; either way the feature then stays off until the quota resets.
   */
  async function ask(prompt: string, signal?: AbortSignal, images: AiImage[] = []): Promise<string> {
    usedFallback.value = false
    try {
      const outcome = await withQuotaFallback(
        () => askGemini(apiKey.value, prompt, signal, images),
        isFallbackConfigured() ? () => askFallback(prompt, images) : null,
      )
      if (outcome.usedFallback) {
        block(outcome.resetAt)
        usedFallback.value = true
      }
      return outcome.reply
    } catch (cause) {
      if (cause instanceof GeminiRequestError && cause.reason === 'quota') block(cause.resetAt)
      throw cause
    }
  }

  return { apiKey, quotaUntil, usedFallback, blocked, refresh, saveKey, forgetKey, resetTime, ask }
}
