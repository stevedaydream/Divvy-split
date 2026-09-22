import { dateRange, isIsoDate, type IsoDate } from '@/lib/dates'
import type { ItineraryItem } from '@/types/models'

/**
 * Trip-plan maths — no Vue or Firestore, so it can be unit-tested.
 * Estimates are integers in the group currency's minor unit.
 */

export type TripPhase = 'none' | 'before' | 'during' | 'after'

export function hasTripDates(start: string, end: string): boolean {
  return isIsoDate(start) && isIsoDate(end) && start <= end
}

export function tripPhase(start: string, end: string, today: IsoDate): TripPhase {
  if (!hasTripDates(start, end)) return 'none'
  if (today < start) return 'before'
  if (today > end) return 'after'
  return 'during'
}

/** Which tab a group opens on: plan before, record during, review after. */
export function defaultTab(phase: TripPhase): 'itinerary' | 'ledger' | 'stats' {
  if (phase === 'before') return 'itinerary'
  if (phase === 'after') return 'stats'
  return 'ledger'
}

/** Untimed items (all-day) first, then by time, then by title. */
export function compareItems(a: ItineraryItem, b: ItineraryItem): number {
  if (a.time !== b.time) {
    if (!a.time) return -1
    if (!b.time) return 1
    return a.time < b.time ? -1 : 1
  }
  return a.title.localeCompare(b.title)
}

/** Date first, then `compareItems` within a day. */
function compareByDate(a: ItineraryItem, b: ItineraryItem): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  return compareItems(a, b)
}

export interface ItineraryDay {
  date: IsoDate
  /** 1-based day number within the trip. */
  index: number
  items: ItineraryItem[]
  estimateMinor: number
}

/**
 * Lays items out over the trip's days. Items whose date fell outside the trip
 * — typically after the dates were shortened — are returned separately so
 * the user can move them instead of losing track of them.
 */
export function layoutDays(
  items: ItineraryItem[],
  start: string,
  end: string,
): { days: ItineraryDay[]; outside: ItineraryItem[] } {
  if (!hasTripDates(start, end)) return { days: [], outside: [...items].sort(compareByDate) }

  const days = dateRange(start, end).map((date, i) => ({ date, index: i + 1, items: [] as ItineraryItem[], estimateMinor: 0 }))
  const byDate = new Map(days.map((day) => [day.date, day]))
  const outside: ItineraryItem[] = []

  for (const item of items) {
    const day = byDate.get(item.date)
    if (!day) {
      outside.push(item)
      continue
    }
    day.items.push(item)
    day.estimateMinor += item.estimateMinor
  }

  for (const day of days) day.items.sort(compareItems)
  outside.sort(compareByDate)
  return { days, outside }
}

/** Planned spending per day, for the stats tab's estimate line. */
export function estimatesByDay(items: ItineraryItem[]): Map<IsoDate, number> {
  const totals = new Map<IsoDate, number>()
  for (const item of items) {
    if (!item.estimateMinor) continue
    totals.set(item.date, (totals.get(item.date) ?? 0) + item.estimateMinor)
  }
  return totals
}

export function totalEstimate(items: ItineraryItem[]): number {
  return items.reduce((sum, item) => sum + item.estimateMinor, 0)
}

/** A Google Maps search for the place, falling back to the title. */
export function mapsUrl(item: Pick<ItineraryItem, 'place' | 'title'>): string {
  const query = item.place.trim() || item.title.trim()
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
