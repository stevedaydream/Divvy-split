import { addDays, daysBetween, isIsoDate } from './dates'
import type { Group, ItineraryItem, TripPlanItem, TripRecord } from '@/types/models'

export function tripSnapshot(group: Group, items: ItineraryItem[]): Omit<TripRecord, 'id' | 'savedAt'> {
  return {
    name: group.name, currency: group.currency, destination: group.destination ?? '', location: group.location ?? '',
    startDate: group.startDate ?? '', endDate: group.endDate ?? '',
    items: items.map(({ kind, date, time, endDate, title, place, note, estimateMinor, category }) =>
      ({ kind, date, time, endDate, title, place, note, estimateMinor, category })),
  }
}

export function copyTripPlan(record: TripRecord, newStart: string): { endDate: string; items: TripPlanItem[] } {
  const originalStart = record.startDate || [...record.items].map((item) => item.date).sort()[0]
  if (!originalStart || !isIsoDate(newStart)) throw new Error('invalid-trip-dates')
  const offset = daysBetween(originalStart, newStart)
  const ends = record.items.map((item) => item.endDate || item.date).sort()
  const oldEnd = record.endDate || ends[ends.length - 1] || originalStart
  return {
    endDate: addDays(oldEnd, offset),
    items: record.items.map((item) => ({ ...item, date: addDays(item.date, offset), endDate: item.endDate ? addDays(item.endDate, offset) : '' })),
  }
}
