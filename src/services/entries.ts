import {
  collection, doc, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { isCategory } from '@/data/categories'
import { isIsoDate, toIsoDate, todayIso } from '@/lib/dates'
import { validExpenseItems } from '@/lib/expenseItems'
import type { Entry, EntryCategory, EntryType, ExpenseItem, SettlementMethod } from '@/types/models'
import type { CurrencyCode } from '@/types/currency'

const COLLECTION = 'entries'

export function toEntry(id: string, data: Record<string, unknown>): Entry {
  const createdAt = (data.createdAt as Entry['createdAt']) ?? null
  return {
    id,
    groupId: (data.groupId as string) ?? '',
    type: (data.type as EntryType) ?? 'expense',
    title: (data.title as string) ?? '',
    payerId: (data.payerId as string) ?? '',
    participantIds: (data.participantIds as string[]) ?? [],
    items: (data.items as ExpenseItem[]) ?? [],
    amountMinor: (data.amountMinor as number) ?? 0,
    currency: (data.currency as string) ?? 'USD',
    rate: (data.rate as number) ?? 1,
    groupAmountMinor: (data.groupAmountMinor as number) ?? 0,
    method: (data.method as SettlementMethod) ?? null,
    // Entries written before categories and spend dates existed fall back to
    // "other" and the day they were recorded.
    category: isCategory(data.category) ? data.category : 'other',
    note: (data.note as string) ?? '',
    date: isIsoDate(data.date) ? data.date : createdAt ? toIsoDate(createdAt.toDate()) : todayIso(),
    createdAt,
    createdBy: (data.createdBy as string) ?? '',
  }
}

/** Spend date first, then most recently recorded — the ledger's display order. */
export function compareEntries(a: Entry, b: Entry): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  // A pending write has no server timestamp yet; it is the newest by definition.
  const at = a.createdAt?.toMillis() ?? Number.POSITIVE_INFINITY
  const bt = b.createdAt?.toMillis() ?? Number.POSITIVE_INFINITY
  return bt - at
}

/** Live ledger for one group, in `compareEntries` order. Returns an unsubscribe fn. */
export function watchEntries(
  groupId: string,
  onChange: (entries: Entry[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(
    collection(db, COLLECTION),
    where('groupId', '==', groupId),
    orderBy('createdAt', 'desc'),
  )
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => toEntry(d.id, d.data())).sort(compareEntries)),
    (error) => onError?.(error),
  )
}

export interface EntryDraft {
  groupId: string
  type: EntryType
  title: string
  payerId: string
  participantIds: string[]
  items?: ExpenseItem[]
  amountMinor: number
  currency: CurrencyCode
  /** Captured at write time so the entry never re-prices itself later. */
  rate: number
  groupAmountMinor: number
  method: SettlementMethod | null
  category: EntryCategory
  note: string
  date: string
}

export async function createEntry(draft: EntryDraft, uid: string): Promise<string> {
  const ref = doc(collection(db, COLLECTION))
  await runTransaction(db, async (transaction) => {
    const groupRef = doc(db, 'groups', draft.groupId)
    const group = await transaction.get(groupRef)
    validateDraft(draft, group.data(), uid)
    transaction.set(ref, { ...draft, items: draft.items ?? [], createdBy: uid, createdAt: serverTimestamp() })
    transaction.update(groupRef, { ledgerRevision: (group.data()?.ledgerRevision ?? 0) + 1, updatedAt: serverTimestamp() })
  })
  return ref.id
}

/**
 * Updates an entry. `rate` is part of the draft, so an edit that does not
 * touch the amount keeps the original rate and the figure stays put.
 */
export async function updateEntry(entryId: string, draft: EntryDraft): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const entryRef = doc(db, COLLECTION, entryId)
    const entry = await transaction.get(entryRef)
    if (!entry.exists() || entry.data().groupId !== draft.groupId) throw new Error('entry-changed')
    const groupRef = doc(db, 'groups', draft.groupId)
    const group = await transaction.get(groupRef)
    validateDraft(draft, group.data(), entry.data().createdBy)
    transaction.update(entryRef, { ...draft, items: draft.items ?? [] })
    transaction.update(groupRef, { ledgerRevision: (group.data()?.ledgerRevision ?? 0) + 1, updatedAt: serverTimestamp() })
  })
}

export async function deleteEntry(entryId: string): Promise<void> {
  const entryRef = doc(db, COLLECTION, entryId)
  await runTransaction(db, async (transaction) => {
    const entry = await transaction.get(entryRef)
    if (!entry.exists()) throw new Error('entry-not-found')
    const groupRef = doc(db, 'groups', entry.data().groupId)
    const group = await transaction.get(groupRef)
    if (!group.exists() || group.data().archived || group.data().deleting) throw new Error('group-archived')
    transaction.delete(entryRef)
    transaction.update(groupRef, { ledgerRevision: (group.data().ledgerRevision ?? 0) + 1, updatedAt: serverTimestamp() })
  })
}

function validateDraft(draft: EntryDraft, group: Record<string, unknown> | undefined, author: string): void {
  if (!group || group.archived || group.deleting) throw new Error('group-archived')
  const members = group.memberIds as string[]
  if (!members.includes(author) || !members.includes(draft.payerId)
    || !Number.isSafeInteger(draft.amountMinor) || draft.amountMinor <= 0 || draft.amountMinor > 1_000_000_000_000
    || !Number.isSafeInteger(draft.groupAmountMinor) || draft.groupAmountMinor < 0
    || !Number.isFinite(draft.rate) || draft.rate <= 0
    || !draft.participantIds.length || new Set(draft.participantIds).size !== draft.participantIds.length
    || !draft.participantIds.every((id) => members.includes(id))) throw new Error('invalid-entry')
  if (draft.type === 'settlement' && (draft.items?.length || draft.participantIds.length !== 1 || draft.participantIds[0] === draft.payerId)) throw new Error('invalid-settlement')
  if (draft.items?.length) {
    if (!validExpenseItems(draft.items, draft.amountMinor, members)) throw new Error('invalid-items')
    const ids = new Set(draft.items.flatMap((item) => item.participantIds))
    if (ids.size !== draft.participantIds.length || !draft.participantIds.every((id) => ids.has(id))) throw new Error('invalid-items')
  }
}
