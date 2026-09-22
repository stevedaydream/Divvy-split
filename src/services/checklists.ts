import {
  addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { ChecklistItem } from '@/types/models'

/**
 * Two checklists per trip:
 * - packing — personal, at `users/{uid}/packing`, filtered by group
 * - to-dos  — shared by the group, at `groups/{groupId}/todos`
 */

function toItem(id: string, data: Record<string, unknown>): ChecklistItem {
  return {
    id,
    text: (data.text as string) ?? '',
    done: (data.done as boolean) ?? false,
    updatedBy: (data.updatedBy as string) ?? '',
    createdAt: (data.createdAt as ChecklistItem['createdAt']) ?? null,
  }
}

function byCreation(items: ChecklistItem[]): ChecklistItem[] {
  // Pending writes have no timestamp yet and belong at the end.
  return items.sort(
    (a, b) => (a.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER) - (b.createdAt?.toMillis() ?? Number.MAX_SAFE_INTEGER),
  )
}

export type ChecklistKind = 'packing' | 'todo'

function listRef(kind: ChecklistKind, groupId: string, uid: string) {
  return kind === 'packing' ? collection(db, 'users', uid, 'packing') : collection(db, 'groups', groupId, 'todos')
}

export function watchChecklist(
  kind: ChecklistKind,
  groupId: string,
  uid: string,
  onChange: (items: ChecklistItem[]) => void,
) {
  const ref = listRef(kind, groupId, uid)
  const source = kind === 'packing' ? query(ref, where('groupId', '==', groupId)) : ref
  return onSnapshot(source, (snap) => onChange(byCreation(snap.docs.map((d) => toItem(d.id, d.data())))))
}

export async function addChecklistItems(
  kind: ChecklistKind,
  groupId: string,
  uid: string,
  texts: string[],
): Promise<void> {
  const ref = listRef(kind, groupId, uid)
  const batch = writeBatch(db)
  for (const text of texts) {
    batch.set(doc(ref), {
      ...(kind === 'packing' ? { groupId } : {}),
      text: text.slice(0, 120),
      done: false,
      updatedBy: uid,
      createdAt: serverTimestamp(),
    })
  }
  await batch.commit()
}

export async function addChecklistItem(kind: ChecklistKind, groupId: string, uid: string, text: string): Promise<void> {
  await addDoc(listRef(kind, groupId, uid), {
    ...(kind === 'packing' ? { groupId } : {}),
    text: text.slice(0, 120),
    done: false,
    updatedBy: uid,
    createdAt: serverTimestamp(),
  })
}

export async function setChecklistDone(
  kind: ChecklistKind,
  groupId: string,
  uid: string,
  item: ChecklistItem,
  done: boolean,
): Promise<void> {
  await updateDoc(doc(listRef(kind, groupId, uid), item.id), { done, updatedBy: uid })
}

export async function deleteChecklistItem(
  kind: ChecklistKind,
  groupId: string,
  uid: string,
  item: ChecklistItem,
): Promise<void> {
  await deleteDoc(doc(listRef(kind, groupId, uid), item.id))
}
