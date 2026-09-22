import type { Entry, Transfer } from '@/types/models'

/**
 * Splitting and settlement maths — deliberately free of Vue, Firestore and
 * currency formatting so it can be unit-tested on its own.
 *
 * Every amount here is an integer in the group currency's minor unit.
 */

export type Balances = Record<string, number>

/**
 * Splits `totalMinor` across `n` participants without losing or inventing a
 * minor unit. The remainder goes to the first `remainder` shares, so callers
 * get a stable answer for a stable participant order.
 */
export function splitEvenly(totalMinor: number, n: number): number[] {
  if (n <= 0) return []
  const sign = totalMinor < 0 ? -1 : 1
  const total = Math.abs(totalMinor)
  const base = Math.floor(total / n)
  const remainder = total - base * n
  return Array.from({ length: n }, (_, i) => sign * (base + (i < remainder ? 1 : 0)))
}

/**
 * Net position of every member: positive means the group owes them,
 * negative means they owe the group. The balances always sum to zero.
 */
export function computeBalances(entries: Entry[], memberIds: string[]): Balances {
  const balances: Balances = {}
  for (const uid of memberIds) balances[uid] = 0

  const known = new Set(memberIds)

  for (const entry of entries) {
    const amount = entry.groupAmountMinor
    if (!Number.isFinite(amount) || amount === 0) continue
    if (!known.has(entry.payerId)) continue

    if (entry.type === 'settlement') {
      // A transfer: the payer discharges debt, the recipient's credit shrinks.
      const recipient = entry.participantIds[0]
      if (!recipient || !known.has(recipient)) continue
      balances[entry.payerId] = (balances[entry.payerId] ?? 0) + amount
      balances[recipient] = (balances[recipient] ?? 0) - amount
      continue
    }

    // An expense: the payer fronted the money, participants each owe a share.
    const participants = entry.participantIds.filter((uid) => known.has(uid))
    if (participants.length === 0) continue

    balances[entry.payerId] = (balances[entry.payerId] ?? 0) + amount

    const ordered = [...participants].sort()
    const shares = splitEvenly(amount, ordered.length)
    ordered.forEach((uid, i) => {
      balances[uid] = (balances[uid] ?? 0) - (shares[i] ?? 0)
    })
  }

  return balances
}

/**
 * Greedy minimal-transfer plan: repeatedly settle the largest debtor against
 * the largest creditor. Produces at most `members - 1` transfers.
 */
export function computeSettlements(balances: Balances): Transfer[] {
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < 0)
    .map(([uid, v]) => ({ uid, amount: -v }))
    .sort((a, b) => b.amount - a.amount || a.uid.localeCompare(b.uid))

  const creditors = Object.entries(balances)
    .filter(([, v]) => v > 0)
    .map(([uid, v]) => ({ uid, amount: v }))
    .sort((a, b) => b.amount - a.amount || a.uid.localeCompare(b.uid))

  const transfers: Transfer[] = []
  let d = 0
  let c = 0

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d]!
    const creditor = creditors[c]!
    const amount = Math.min(debtor.amount, creditor.amount)

    if (amount > 0) transfers.push({ from: debtor.uid, to: creditor.uid, amountMinor: amount })

    debtor.amount -= amount
    creditor.amount -= amount
    if (debtor.amount === 0) d++
    if (creditor.amount === 0) c++
  }

  return transfers
}

/** Total of all non-settlement entries, in the group currency's minor unit. */
export function totalSpend(entries: Entry[]): number {
  return entries.reduce((sum, e) => (e.type === 'expense' ? sum + e.groupAmountMinor : sum), 0)
}
