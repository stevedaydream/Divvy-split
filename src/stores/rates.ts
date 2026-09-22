import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { rateFrom } from '@/lib/money'
import type { CurrencyCode, RateTable } from '@/types/currency'

const CACHE_KEY = 'divvy:rates'
const MAX_AGE_MS = 60 * 60 * 1000

interface CachedRates {
  rates: RateTable
  fetchedAt: number
}

function readCache(): CachedRates | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedRates
    return parsed.rates && parsed.fetchedAt ? parsed : null
  } catch {
    return null
  }
}

/**
 * USD-based exchange rates from Open Exchange Rates, cached for an hour in
 * localStorage so a reload does not burn a request from the free-tier quota.
 */
export const useRatesStore = defineStore('rates', () => {
  const cached = readCache()
  const rates = ref<RateTable>(cached?.rates ?? {})
  const fetchedAt = ref<number>(cached?.fetchedAt ?? 0)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isStale = computed(() => Date.now() - fetchedAt.value > MAX_AGE_MS)
  const hasRates = computed(() => Object.keys(rates.value).length > 0)

  async function load(force = false): Promise<void> {
    if (loading.value) return
    if (hasRates.value && !isStale.value && !force) return

    loading.value = true
    error.value = null

    try {
      const key = import.meta.env.VITE_OER_API_KEY
      const response = await fetch(`https://openexchangerates.org/api/latest.json?app_id=${key}`)
      if (!response.ok) throw new Error(`rates-http-${response.status}`)

      const data = (await response.json()) as { rates?: RateTable }
      if (!data.rates) throw new Error('rates-malformed')

      rates.value = data.rates
      fetchedAt.value = Date.now()
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ rates: rates.value, fetchedAt: fetchedAt.value }),
        )
      } catch { /* storage full or unavailable — the in-memory copy still works */ }
    } catch (cause) {
      // Stale rates beat no rates; the UI surfaces the staleness instead.
      error.value = (cause as Error).message
    } finally {
      loading.value = false
    }
  }

  /** Units of `to` that one unit of `from` buys. 0 when either is unknown. */
  function rate(from: CurrencyCode, to: CurrencyCode): number {
    return rateFrom(rates.value, from, to)
  }

  return { rates, fetchedAt, loading, error, isStale, hasRates, load, rate }
})
