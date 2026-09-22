import { currencyMeta } from '@/data/currencies'
import type { CurrencyCode, RateTable } from '@/types/currency'

/**
 * All money in this app is an integer count of a currency's minor unit
 * (USD cents, JPY yen, KWD fils). Balances are summed as integers so they
 * never drift the way repeated float division does.
 */

export function decimalsOf(code: CurrencyCode): number {
  return currencyMeta(code).decimals
}

function factor(code: CurrencyCode): number {
  return 10 ** decimalsOf(code)
}

/** `12.34` USD -> `1234`. Returns 0 for anything unparseable. */
export function toMinor(amount: number | string, code: CurrencyCode): number {
  const value = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  if (!Number.isFinite(value)) return 0
  return Math.round(value * factor(code))
}

/** `1234` USD -> `12.34`. */
export function toMajor(minor: number, code: CurrencyCode): number {
  return minor / factor(code)
}

/**
 * Converts a minor-unit amount between currencies.
 * `rate` is how many units of `to` one unit of `from` buys.
 */
export function convertMinor(
  minor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rate: number,
): number {
  if (from === to) return minor
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return Math.round(toMajor(minor, from) * rate * factor(to))
}

/** Exchange rate between two currencies from a USD-based rate table. */
export function rateFrom(rates: RateTable, from: CurrencyCode, to: CurrencyCode): number {
  if (from === to) return 1
  const a = rates[from]
  const b = rates[to]
  if (!a || !b) return 0
  return b / a
}

/** `1234` USD -> `"$12.34"`, respecting the active locale. */
export function formatMoney(minor: number, code: CurrencyCode, locale = 'en'): string {
  const decimals = decimalsOf(code)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(toMajor(minor, code))
  } catch {
    return `${code} ${formatNumber(minor, code, locale)}`
  }
}

/** The amount without any currency symbol — for tables and big display figures. */
export function formatNumber(minor: number, code: CurrencyCode, locale = 'en'): string {
  const decimals = decimalsOf(code)
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(toMajor(minor, code))
}

/** True when a balance is close enough to zero to call it settled. */
export function isSettled(minor: number): boolean {
  return minor === 0
}
