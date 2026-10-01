import {
  collection, doc, onSnapshot, runTransaction, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { isCategory } from '@/data/categories'
import type { ItineraryItem, ItineraryKind } from '@/types/models'

function itemsOf(groupId: string) {
  return collection(db, 'groups', groupId, 'itinerary')
}

const KINDS: ItineraryKind[] = ['spot', 'flight', 'lodging']

export function toItem(id: string, data: Record<string, unknown>): ItineraryItem {
  const kind = KINDS.includes(data.kind as ItineraryKind) ? (data.kind as ItineraryKind) : 'spot'
  return {
    id,
    kind,
    date: (data.date as string) ?? '',
    time: (data.time as string) ?? '',
    endDate: (data.endDate as string) ?? '',
    title: (data.title as string) ?? '',
    place: (data.place as string) ?? '',
    note: (data.note as string) ?? '',
    estimateMinor: (data.estimateMinor as number) ?? 0,
    category: isCategory(data.category) ? data.category : 'other',
    updatedBy: (data.updatedBy as string) ?? '',
    updatedAt: (data.updatedAt as ItineraryItem['updatedAt']) ?? null,
  }
}

/** Live trip plan for one group. Ordering is done by `lib/itinerary.ts`. */
export function watchItinerary(
  groupId: string,
  onChange: (items: ItineraryItem[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    itemsOf(groupId),
    (snap) => onChange(snap.docs.map((d) => toItem(d.id, d.data()))),
    (error) => onError?.(error),
  )
}

export type ItineraryDraft = Omit<ItineraryItem, 'id' | 'updatedBy' | 'updatedAt'>

export async function createItem(groupId: string, draft: ItineraryDraft, uid: string): Promise<string> {
  const ref = doc(itemsOf(groupId))
  await mutateItem(groupId, ref.id, draft, uid, true)
  return ref.id
}

export async function updateItem(
  groupId: string,
  itemId: string,
  draft: ItineraryDraft,
  uid: string,
): Promise<void> {
  await mutateItem(groupId, itemId, draft, uid, false)
}

export async function deleteItem(groupId: string, itemId: string): Promise<void> {
  await mutateItem(groupId, itemId, null, '', false)
}

async function mutateItem(groupId: string, itemId: string, draft: ItineraryDraft | null, uid: string, create: boolean): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const groupRef = doc(db, 'groups', groupId)
    const group = await transaction.get(groupRef)
    if (!group.exists() || group.data().archived || group.data().deleting) throw new Error('group-archived')
    const itemRef = doc(itemsOf(groupId), itemId)
    if (!create && !(await transaction.get(itemRef)).exists()) throw new Error('item-not-found')
    if (!draft) transaction.delete(itemRef)
    else if (create) transaction.set(itemRef, { ...draft, updatedBy: uid, updatedAt: serverTimestamp() })
    else transaction.update(itemRef, { ...draft, updatedBy: uid, updatedAt: serverTimestamp() })
    transaction.update(groupRef, { planRevision: (group.data().planRevision ?? 0) + 1, updatedAt: serverTimestamp() })
  })
}
