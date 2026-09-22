import { describe, expect, it } from 'vitest'
import {
  defaultTab, estimatesByDay, hasTripDates, layoutDays, mapsUrl, totalEstimate, tripPhase,
} from '../itinerary'
import type { ItineraryItem } from '@/types/models'

let seq = 0
function item(partial: Partial<ItineraryItem>): ItineraryItem {
  return {
    id: String(seq++),
    kind: 'spot',
    date: '2026-10-02',
    time: '',
    endDate: '',
    title: 'x',
    place: '',
    note: '',
    estimateMinor: 0,
    category: 'other',
    updatedBy: 'a',
    updatedAt: null,
    ...partial,
  }
}

describe('trip phase', () => {
  it('needs both dates in order', () => {
    expect(hasTripDates('2026-10-02', '2026-10-05')).toBe(true)
    expect(hasTripDates('2026-10-05', '2026-10-02')).toBe(false)
    expect(hasTripDates('', '2026-10-02')).toBe(false)
  })

  it.each([
    ['2026-10-01', 'before', 'itinerary'],
    ['2026-10-02', 'during', 'ledger'],
    ['2026-10-05', 'during', 'ledger'],
    ['2026-10-06', 'after', 'stats'],
  ] as const)('%s is %s and opens %s', (today, phase, tab) => {
    expect(tripPhase('2026-10-02', '2026-10-05', today)).toBe(phase)
    expect(defaultTab(phase)).toBe(tab)
  })

  it('opens the ledger for groups without dates', () => {
    expect(tripPhase('', '', '2026-10-01')).toBe('none')
    expect(defaultTab('none')).toBe('ledger')
  })
})

describe('layoutDays', () => {
  it('numbers the days and sorts all-day items before timed ones', () => {
    const { days, outside } = layoutDays(
      [
        item({ title: 'dinner', time: '19:00', date: '2026-10-03', estimateMinor: 3000 }),
        item({ title: 'hotel', time: '', date: '2026-10-03', estimateMinor: 12000 }),
        item({ title: 'museum', time: '10:00', date: '2026-10-03' }),
      ],
      '2026-10-02',
      '2026-10-04',
    )
    expect(days.map((d) => [d.date, d.index])).toEqual([
      ['2026-10-02', 1], ['2026-10-03', 2], ['2026-10-04', 3],
    ])
    expect(days[1]!.items.map((i) => i.title)).toEqual(['hotel', 'museum', 'dinner'])
    expect(days[1]!.estimateMinor).toBe(15000)
    expect(outside).toEqual([])
  })

  it('keeps items that fell outside shortened dates', () => {
    const late = item({ date: '2026-10-09', title: 'late' })
    const early = item({ date: '2026-09-30', title: 'early' })
    const { outside } = layoutDays([late, early], '2026-10-02', '2026-10-04')
    expect(outside.map((i) => i.title)).toEqual(['early', 'late'])
  })

  it('puts everything outside, in date order, when the group has no dates', () => {
    const { outside } = layoutDays(
      [item({ date: '2026-10-08', title: 'b' }), item({ date: '2026-10-02', title: 'a' })],
      '',
      '',
    )
    expect(outside.map((i) => i.title)).toEqual(['a', 'b'])
  })
})

describe('estimates', () => {
  const items = [
    item({ date: '2026-10-02', estimateMinor: 100 }),
    item({ date: '2026-10-02', estimateMinor: 50 }),
    item({ date: '2026-10-03', estimateMinor: 0 }),
  ]

  it('totals per day and skips zero', () => {
    expect([...estimatesByDay(items)]).toEqual([['2026-10-02', 150]])
    expect(totalEstimate(items)).toBe(150)
  })
})

describe('mapsUrl', () => {
  it('searches the place, falling back to the title', () => {
    expect(mapsUrl({ place: '石垣島 川平灣', title: 'x' })).toBe(
      'https://www.google.com/maps/search/?api=1&query=%E7%9F%B3%E5%9E%A3%E5%B3%B6%20%E5%B7%9D%E5%B9%B3%E7%81%A3',
    )
    expect(mapsUrl({ place: ' ', title: 'Kabira Bay' })).toContain('query=Kabira%20Bay')
  })
})
