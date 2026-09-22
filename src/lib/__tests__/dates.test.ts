import { describe, expect, it } from 'vitest'
import { addDays, dateRange, daysBetween, formatDay, isIsoDate, toIsoDate } from '../dates'
import { guessCategory } from '@/data/categories'

describe('dates', () => {
  it('validates the stored format', () => {
    expect(isIsoDate('2026-10-03')).toBe(true)
    expect(isIsoDate('2026-10-3')).toBe(false)
    expect(isIsoDate(null)).toBe(false)
  })

  it('uses the local calendar day', () => {
    expect(toIsoDate(new Date(2026, 9, 3, 23, 30))).toBe('2026-10-03')
  })

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-10-01', '2026-10-05')).toBe(4)
    expect(daysBetween('2026-10-05', '2026-10-01')).toBe(-4)
  })

  it('builds inclusive ranges', () => {
    expect(dateRange('2026-10-30', '2026-11-01')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
    expect(dateRange('2026-10-02', '2026-10-01')).toEqual([])
  })

  it('formats zh-TW day labels', () => {
    expect(formatDay('2026-10-03', 'zh-TW')).toBe('10/3（六）')
  })
})

describe('guessCategory', () => {
  it.each([
    ['晚餐', 'food'],
    ['一蘭拉麵', 'food'],
    ['JR Pass', 'transport'],
    ['機場巴士', 'transport'],
    ['計程車', 'transport'],
    ['APA 飯店', 'lodging'],
    ['藥妝店', 'shopping'],
    ['伴手禮', 'shopping'],
    ['美麗海水族館門票', 'fun'],
    ['Parking', 'transport'],
  ])('%s -> %s', (title, expected) => {
    expect(guessCategory(title)).toBe(expected)
  })

  it('returns null when nothing matches', () => {
    expect(guessCategory('xyz')).toBeNull()
    expect(guessCategory('  ')).toBeNull()
  })
})
