/**
 * Calendar dates as `YYYY-MM-DD` strings. They carry no time or timezone, so a
 * purchase made at 23:00 in Tokyo stays on that day wherever it is viewed.
 * Arithmetic goes through UTC midnight so DST never shifts a day.
 */

export type IsoDate = string

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === 'string' && ISO_DATE.test(value)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** The device's local calendar date for `date`. */
export function toIsoDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayIso(): IsoDate {
  return toIsoDate(new Date())
}

function toUtc(iso: IsoDate): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!)
}

function fromUtc(ms: number): IsoDate {
  const date = new Date(ms)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

const DAY_MS = 86_400_000

export function addDays(iso: IsoDate, days: number): IsoDate {
  return fromUtc(toUtc(iso) + days * DAY_MS)
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS)
}

/** Every date from `from` to `to` inclusive. Empty when `to` is before `from`. */
export function dateRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const count = daysBetween(from, to)
  if (count < 0) return []
  return Array.from({ length: count + 1 }, (_, i) => addDays(from, i))
}

/** "10/3（五）" in zh-TW, "Fri, Oct 3" in English. */
export function formatDay(iso: IsoDate, locale: string): string {
  const date = new Date(toUtc(iso))
  if (locale.startsWith('zh')) {
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'narrow', timeZone: 'UTC' }).format(date)
    return `${date.getUTCMonth() + 1}/${date.getUTCDate()}（${weekday}）`
  }
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(date)
}

/** "10/3" — compact label for chart axes. */
export function formatShortDay(iso: IsoDate): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${m}/${d}`
}
