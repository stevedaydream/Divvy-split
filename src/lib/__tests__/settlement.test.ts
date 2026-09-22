import { describe, expect, it } from 'vitest'
import { computeBalances, computeSettlements, splitEvenly, totalSpend } from '../settlement'
import type { Entry } from '@/types/models'

function expense(payerId: string, participantIds: string[], groupAmountMinor: number): Entry {
  return {
    id: Math.random().toString(36).slice(2),
    groupId: 'g1',
    type: 'expense',
    title: 'test',
    payerId,
    participantIds,
    amountMinor: groupAmountMinor,
    currency: 'TWD',
    rate: 1,
    groupAmountMinor,
    createdAt: null,
    createdBy: payerId,
  }
}

function settlement(from: string, to: string, groupAmountMinor: number): Entry {
  return { ...expense(from, [to], groupAmountMinor), type: 'settlement' }
}

describe('splitEvenly', () => {
  it('never loses or invents a minor unit', () => {
    for (const [total, n] of [[100, 3], [1, 3], [999, 7], [10, 4]] as const) {
      const shares = splitEvenly(total, n)
      expect(shares).toHaveLength(n)
      expect(shares.reduce((a, b) => a + b, 0)).toBe(total)
    }
  })

  it('gives the remainder to the earliest shares', () => {
    expect(splitEvenly(100, 3)).toEqual([34, 33, 33])
  })

  it('handles negative totals', () => {
    expect(splitEvenly(-100, 3).reduce((a, b) => a + b, 0)).toBe(-100)
  })
})

describe('computeBalances', () => {
  const members = ['alice', 'bob', 'carol']

  it('sums to zero even with an indivisible amount', () => {
    const balances = computeBalances([expense('alice', members, 100)], members)
    expect(Object.values(balances).reduce((a, b) => a + b, 0)).toBe(0)
  })

  it('credits the payer and debits each participant', () => {
    const balances = computeBalances([expense('alice', ['alice', 'bob'], 1000)], members)
    expect(balances.alice).toBe(500)
    expect(balances.bob).toBe(-500)
    expect(balances.carol).toBe(0)
  })

  it('leaves a payer who is not a participant fully in credit', () => {
    const balances = computeBalances([expense('alice', ['bob', 'carol'], 1000)], members)
    expect(balances.alice).toBe(1000)
    expect(balances.bob).toBe(-500)
  })

  it('discharges debt when a settlement is recorded', () => {
    const entries = [expense('alice', ['alice', 'bob'], 1000), settlement('bob', 'alice', 500)]
    const balances = computeBalances(entries, members)
    expect(balances.alice).toBe(0)
    expect(balances.bob).toBe(0)
  })

  it('ignores entries referencing members who have left', () => {
    const balances = computeBalances([expense('ghost', members, 900)], members)
    expect(Object.values(balances).every((v) => v === 0)).toBe(true)
  })
})

describe('computeSettlements', () => {
  it('returns nothing when everyone is square', () => {
    expect(computeSettlements({ alice: 0, bob: 0 })).toEqual([])
  })

  it('clears every balance it is given', () => {
    const balances = { alice: 1000, bob: -600, carol: -400 }
    const transfers = computeSettlements(balances)
    const applied: Record<string, number> = { ...balances }
    for (const t of transfers) {
      applied[t.from] = (applied[t.from] ?? 0) + t.amountMinor
      applied[t.to] = (applied[t.to] ?? 0) - t.amountMinor
    }
    expect(Object.values(applied).every((v) => v === 0)).toBe(true)
  })

  it('needs at most members - 1 transfers', () => {
    const balances = { a: 300, b: 200, c: -150, d: -350 }
    expect(computeSettlements(balances).length).toBeLessThanOrEqual(3)
  })
})

describe('totalSpend', () => {
  it('counts expenses but not settlements', () => {
    expect(totalSpend([expense('a', ['a'], 500), settlement('a', 'b', 200)])).toBe(500)
  })
})
