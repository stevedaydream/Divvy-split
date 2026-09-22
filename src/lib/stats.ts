import { CATEGORIES } from '@/data/categories'
import { dateRange, type IsoDate } from '@/lib/dates'
import { expenseShares } from '@/lib/settlement'
import type { Entry, EntryCategory } from '@/types/models'

/**
 * Spending statistics. Like `settlement.ts`, free of Vue and Firestore so it
 * can be unit-tested; every amount is in the group currency's minor unit.
 */

export interface SpendItem {
  date: IsoDate
  category: EntryCategory
  amountMinor: number
}

/**
 * What was spent, entry by entry. With `uid` it is that member's own share —
 * an even split counts only their slice, a "just me" expense counts in full.
 * Settlements move money between members and are never spending.
 */
export function spendItems(entries: Entry[], memberIds: string[], uid: string | null): SpendItem[] {
  const members = new Set(memberIds)
  const items: SpendItem[] = []

  for (const entry of entries) {
    if (entry.type !== 'expense') continue
    const amountMinor = uid === null ? entry.groupAmountMinor : (expenseShares(entry, members)[uid] ?? 0)
    if (amountMinor === 0) continue
    items.push({ date: entry.date, category: entry.category, amountMinor })
  }

  return items
}

export function sumItems(items: SpendItem[]): number {
  return items.reduce((sum, item) => sum + item.amountMinor, 0)
}

export interface CategoryTotal {
  category: EntryCategory
  amountMinor: number
  /** Share of the total, 0–1. */
  ratio: number
}

/** Categories that have spending, largest first; ties keep the fixed list order. */
export function byCategory(items: SpendItem[]): CategoryTotal[] {
  const totals = new Map<EntryCategory, number>()
  for (const item of items) totals.set(item.category, (totals.get(item.category) ?? 0) + item.amountMinor)

  const total = sumItems(items)
  const order = CATEGORIES.map((c) => c.code)

  return [...totals.entries()]
    .filter(([, amount]) => amount !== 0)
    .map(([category, amountMinor]) => ({ category, amountMinor, ratio: total ? amountMinor / total : 0 }))
    .sort((a, b) => b.amountMinor - a.amountMinor || order.indexOf(a.category) - order.indexOf(b.category))
}

export interface DayTotal {
  date: IsoDate
  amountMinor: number
}

/**
 * Spending per day, with empty days filled in as zero so a chart's x-axis is
 * continuous. `range` fixes the span (e.g. the trip dates); without it the
 * span runs from the first to the last day that has spending.
 */
export function byDay(items: SpendItem[], range?: { from: IsoDate; to: IsoDate }): DayTotal[] {
  const totals = new Map<IsoDate, number>()
  for (const item of items) totals.set(item.date, (totals.get(item.date) ?? 0) + item.amountMinor)

  let from = range?.from
  let to = range?.to
  if (!from || !to) {
    const dates = [...totals.keys()].sort()
    if (!dates.length) return []
    from = dates[0]!
    to = dates[dates.length - 1]!
  }

  return dateRange(from, to).map((date) => ({ date, amountMinor: totals.get(date) ?? 0 }))
}

/** Running total of a series, for the cumulative chart. */
export function cumulative(values: number[]): number[] {
  let running = 0
  return values.map((value) => (running += value))
}
