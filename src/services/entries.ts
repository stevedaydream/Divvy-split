import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, updateDoc, where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { Entry, EntryType, SettlementMethod } from '@/types/models'
import type { CurrencyCode } from '@/types/currency'

const COLLECTION = 'entries'

function toEntry(id: string, data: Record<string, unknown>): Entry {
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
    createdAt: (data.createdAt as Entry['createdAt']) ?? null,
    createdBy: (data.createdBy as string) ?? '',
  }
}

/** Live ledger for one group, newest first. Returns an unsubscribe fn. */
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
    (snap) => onChange(snap.docs.map((d) => toEntry(d.id, d.data()))),
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
