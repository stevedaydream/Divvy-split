import type { Entry, ExpenseItem } from '@/types/models'

export const MAX_EXPENSE_ITEMS = 12

export interface ExpenseItemInput {
  key: number
  title: string
  amount: string
  payerId: string
  participantIds: string[]
}

export function validExpenseItems(items: ExpenseItem[], amountMinor: number, memberIds: string[]): boolean {
  const members = new Set(memberIds)
  return items.length > 0 && items.length <= MAX_EXPENSE_ITEMS
    && items.every((item) => item.title.trim().length > 0 && item.title.length <= 120
      && Number.isSafeInteger(item.amountMinor) && item.amountMinor > 0 && item.amountMinor <= 1_000_000_000_000
      && members.has(item.payerId) && item.participantIds.length > 0
      && new Set(item.participantIds).size === item.participantIds.length
      && item.participantIds.every((uid) => members.has(uid)))
    && items.reduce((sum, item) => sum + item.amountMinor, 0) === amountMinor
}

/** 依明細比例分配換算後總額，最大餘數法確保尾差不會改變整筆金額。 */
export function expenseParts(entry: Pick<Entry, 'items' | 'payerId' | 'participantIds' | 'groupAmountMinor'>) {
  const items = entry.items
  if (!items?.length) return [{ payerId: entry.payerId, participantIds: entry.participantIds, amountMinor: entry.groupAmountMinor }]
  const total = items.reduce((sum, item) => sum + item.amountMinor, 0)
  if (total <= 0 || !Number.isSafeInteger(entry.groupAmountMinor)) return []
  const target = BigInt(entry.groupAmountMinor)
  const divisor = BigInt(total)
  const allocations = items.map((item, index) => {
    const product = BigInt(item.amountMinor) * target
    return { index, amount: Number(product / divisor), remainder: product % divisor }
  })
  const remainder = entry.groupAmountMinor - allocations.reduce((sum, item) => sum + item.amount, 0)
  const order = [...allocations].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1)
  for (let i = 0; i < remainder; i++) order[i]!.amount++
  return items.map((item, index) => ({ payerId: item.payerId, participantIds: item.participantIds, amountMinor: allocations[index]!.amount }))
}

export function expensePayments(entry: Pick<Entry, 'items' | 'payerId' | 'participantIds' | 'groupAmountMinor'>): Record<string, number> {
  const payments: Record<string, number> = {}
  for (const part of expenseParts(entry)) payments[part.payerId] = (payments[part.payerId] ?? 0) + part.amountMinor
  return payments
}
