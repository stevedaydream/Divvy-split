import {
  addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { isCategory } from '@/data/categories'
import type { ItineraryItem, ItineraryKind } from '@/types/models'

function itemsOf(groupId: string) {
  return collection(db, 'groups', groupId, 'itinerary')
}

const KINDS: ItineraryKind[] = ['spot', 'flight', 'lodging']

function toItem(id: string, data: Record<string, unknown>): ItineraryItem {
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
  const ref = await addDoc(itemsOf(groupId), {
    ...draft,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateItem(
  groupId: string,
  itemId: string,
  draft: ItineraryDraft,
  uid: string,
): Promise<void> {
  await updateDoc(doc(itemsOf(groupId), itemId), {
    ...draft,
    updatedBy: uid,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteItem(groupId: string, itemId: string): Promise<void> {
  await deleteDoc(doc(itemsOf(groupId), itemId))
}
