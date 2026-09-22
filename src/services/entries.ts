import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { isCategory } from '@/data/categories'
import { isIsoDate, toIsoDate, todayIso } from '@/lib/dates'
import type { Entry, EntryCategory, EntryType, SettlementMethod } from '@/types/models'
import type { CurrencyCode } from '@/types/currency'

const COLLECTION = 'entries'

function toEntry(id: string, data: Record<string, unknown>): Entry {
  const createdAt = (data.createdAt as Entry['createdAt']) ?? null
  return {
    id,
    groupId: (data.groupId as string) ?? '',
    type: (data.type as EntryType) ?? 'expense',
    title: (data.title as string) ?? '',
    payerId: (data.payerId as string) ?? '',
    participantIds: (data.participantIds as string[]) ?? [],
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
  const ref = await addDoc(collection(db, COLLECTION), {
    ...draft,
    createdBy: uid,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/**
 * Updates an entry. `rate` is part of the draft, so an edit that does not
 * touch the amount keeps the original rate and the figure stays put.
 */
export async function updateEntry(entryId: string, draft: EntryDraft): Promise<void> {
  await updateDoc(doc(db, COLLECTION, entryId), { ...draft })
}

export async function deleteEntry(entryId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, entryId))
}
