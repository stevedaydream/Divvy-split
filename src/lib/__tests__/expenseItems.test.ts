import { describe, expect, it } from 'vitest'
import { expenseParts, expensePayments, validExpenseItems } from '../expenseItems'
import { computeBalances, computeSettlements, expenseShares } from '../settlement'
import { spendItems, sumItems } from '../stats'
import type { Entry, ExpenseItem } from '@/types/models'

const members = ['a', 'b', 'c']
const dishes: ExpenseItem[] = [1, 2, 3].map((n) => ({ title: `菜 ${n}`, amountMinor: 30000, payerId: 'a', participantIds: members }))
const items: ExpenseItem[] = [...dishes,
  { title: 'A 飲料', amountMinor: 8000, payerId: 'a', participantIds: ['a'] },
  { title: 'B 甜點', amountMinor: 10000, payerId: 'b', participantIds: ['b'] },
  { title: 'C 飲料與甜點', amountMinor: 12000, payerId: 'b', participantIds: ['c'] },
]
const dinner: Entry = {
  id: 'dinner', groupId: 'trip', type: 'expense', title: '晚餐', payerId: 'a', participantIds: members,
  items, amountMinor: 120000, currency: 'TWD', rate: 1, groupAmountMinor: 120000,
  method: null, category: 'food', note: '', date: '2026-10-02', createdBy: 'a', createdAt: null,
}

describe('明細分帳', () => {
  it('共吃菜與個人飲料各自分攤，並計入不同付款人的代墊', () => {
    expect(expenseShares(dinner, new Set(members))).toEqual({ a: 38000, b: 40000, c: 42000 })
    expect(expensePayments(dinner)).toEqual({ a: 98000, b: 22000 })
    expect(computeBalances([dinner], members)).toEqual({ a: 60000, b: -18000, c: -42000 })
    expect(computeSettlements(computeBalances([dinner], members))).toEqual([
      { from: 'c', to: 'a', amountMinor: 42000 }, { from: 'b', to: 'a', amountMinor: 18000 },
    ])
  })

  it('統計與結算共用相同的個人負擔，整筆晚餐只計一次', () => {
    expect(sumItems(spendItems([dinner], members, null))).toBe(120000)
    for (const uid of members) expect(sumItems(spendItems([dinner], members, uid))).toBe(expenseShares(dinner, new Set(members))[uid])
  })

  it('先記總額後補明細，會從均分改為逐項分攤', () => {
    const original = { ...dinner, items: [] }
    expect(expenseShares(original, new Set(members))).toEqual({ a: 40000, b: 40000, c: 40000 })
    expect(expenseShares(dinner, new Set(members))).toEqual({ a: 38000, b: 40000, c: 42000 })
    expect(validExpenseItems(items, original.amountMinor, members)).toBe(true)
    expect(validExpenseItems(items, original.amountMinor + 1, members)).toBe(false)
  })

  it('跨幣別換算與均分尾差仍維持精確總和，順序穩定', () => {
    for (const groupAmountMinor of [0, 1, 2, 7, 3911, 999999999999]) {
      const converted = { ...dinner, groupAmountMinor }
      const parts = expenseParts(converted)
      expect(parts.reduce((sum, part) => sum + part.amountMinor, 0)).toBe(groupAmountMinor)
      const shares = expenseShares(converted, new Set(members))
      expect(Object.values(shares).reduce((sum, value) => sum + value, 0)).toBe(groupAmountMinor)
      expect(Object.values(computeBalances([converted], members)).reduce((sum, value) => sum + value, 0)).toBe(0)
      expect(expenseParts(converted)).toEqual(parts)
    }
  })

  it('拒絕空項、非成員、重複分攤者與錯誤金額', () => {
    for (const patch of [{ title: '' }, { amountMinor: 0 }, { amountMinor: -1 }, { amountMinor: 1.5 }, { payerId: 'stranger' }, { participantIds: [] }, { participantIds: ['a', 'a'] }, { participantIds: ['stranger'] }]) {
      expect(validExpenseItems([{ ...items[0]!, ...patch }], 30000, members)).toBe(false)
    }
  })
})
