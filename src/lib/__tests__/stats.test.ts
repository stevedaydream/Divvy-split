import { describe, expect, it } from 'vitest'
import { computeBalances } from '../settlement'
import { byCategory, byDay, cumulative, spendItems, sumItems } from '../stats'
import type { Entry, EntryCategory } from '@/types/models'

let seq = 0
function entry(partial: Partial<Entry> & { groupAmountMinor: number }): Entry {
  return {
    id: String(seq++),
    groupId: 'g1',
    type: 'expense',
    title: '',
    payerId: 'a',
    participantIds: ['a', 'b', 'c'],
    amountMinor: partial.groupAmountMinor,
    currency: 'JPY',
    rate: 1,
    method: null,
    category: 'food' as EntryCategory,
    note: '',
    date: '2026-10-03',
    createdAt: null,
    createdBy: 'a',
    ...partial,
  }
}

const members = ['a', 'b', 'c']

describe('spendItems', () => {
  it('counts whole expenses for the group and skips settlements', () => {
    const entries = [
      entry({ groupAmountMinor: 3000 }),
      entry({ groupAmountMinor: 500, type: 'settlement', participantIds: ['b'] }),
    ]
    expect(sumItems(spendItems(entries, members, null))).toBe(3000)
  })

  it("counts only the member's own share, including just-me expenses", () => {
    const entries = [
      entry({ groupAmountMinor: 3000 }),
      entry({ groupAmountMinor: 1200, payerId: 'b', participantIds: ['b'] }),
    ]
    expect(sumItems(spendItems(entries, members, 'a'))).toBe(1000)
    expect(sumItems(spendItems(entries, members, 'b'))).toBe(2200)
    expect(sumItems(spendItems(entries, members, 'c'))).toBe(1000)
  })

  it('splits remainders exactly like the balances do', () => {
    const entries = [entry({ groupAmountMinor: 100 })]
    const balances = computeBalances(entries, members)
    for (const uid of members) {
      const paid = uid === 'a' ? 100 : 0
      expect(sumItems(spendItems(entries, members, uid))).toBe(paid - (balances[uid] ?? 0))
    }
  })

  it('ignores people who have left the group', () => {
    const entries = [entry({ groupAmountMinor: 900, participantIds: ['a', 'gone'] })]
    expect(sumItems(spendItems(entries, members, 'a'))).toBe(900)
  })
})

describe('byCategory', () => {
  it('sorts largest first with ratios', () => {
    const items = spendItems(
      [
        entry({ groupAmountMinor: 100, category: 'transport' }),
        entry({ groupAmountMinor: 300, category: 'food' }),
        entry({ groupAmountMinor: 100, category: 'food' }),
      ],
      members,
      null,
    )
    expect(byCategory(items)).toEqual([
      { category: 'food', amountMinor: 400, ratio: 0.8 },
      { category: 'transport', amountMinor: 100, ratio: 0.2 },
    ])
  })

  it('breaks ties by the fixed category order', () => {
    const items = spendItems(
      [entry({ groupAmountMinor: 100, category: 'other' }), entry({ groupAmountMinor: 100, category: 'lodging' })],
      members,
      null,
    )
    expect(byCategory(items).map((c) => c.category)).toEqual(['lodging', 'other'])
  })
})

describe('byDay', () => {
  const items = spendItems(
    [
      entry({ groupAmountMinor: 100, date: '2026-10-01' }),
      entry({ groupAmountMinor: 50, date: '2026-10-03' }),
      entry({ groupAmountMinor: 25, date: '2026-10-03' }),
    ],
    members,
    null,
  )

  it('fills the gap days with zero', () => {
    expect(byDay(items)).toEqual([
      { date: '2026-10-01', amountMinor: 100 },
      { date: '2026-10-02', amountMinor: 0 },
      { date: '2026-10-03', amountMinor: 75 },
    ])
  })

  it('respects an explicit range', () => {
    expect(byDay(items, { from: '2026-10-03', to: '2026-10-04' })).toEqual([
      { date: '2026-10-03', amountMinor: 75 },
      { date: '2026-10-04', amountMinor: 0 },
    ])
  })

  it('is empty with no spending', () => {
    expect(byDay([])).toEqual([])
  })
})

describe('cumulative', () => {
  it('keeps a running total', () => {
    expect(cumulative([1, 0, 2, 3])).toEqual([1, 1, 3, 6])
  })
})
