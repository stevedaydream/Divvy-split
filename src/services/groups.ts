import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, getDoc, getDocs,
  onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { inviteCode } from '@/lib/random'
import type { Group, GroupMember } from '@/types/models'
import type { CurrencyCode } from '@/types/currency'

const COLLECTION = 'groups'

function toGroup(id: string, data: Record<string, unknown>): Group {
  return {
    id,
    name: (data.name as string) ?? '',
    currency: (data.currency as string) ?? 'USD',
    destination: (data.destination as string) ?? '',
    location: (data.location as string) ?? '',
    ownerId: (data.ownerId as string) ?? '',
    memberIds: (data.memberIds as string[]) ?? [],
    members: (data.members as Record<string, GroupMember>) ?? {},
    inviteCode: (data.inviteCode as string) ?? '',
    archived: (data.archived as boolean) ?? false,
    createdAt: (data.createdAt as Group['createdAt']) ?? null,
    updatedAt: (data.updatedAt as Group['updatedAt']) ?? null,
  }
}

/** Live list of every group the user belongs to. Returns an unsubscribe fn. */
export function watchMyGroups(
  uid: string,
  onChange: (groups: Group[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(collection(db, COLLECTION), where('memberIds', 'array-contains', uid))
  return onSnapshot(
    q,
    (snap) => onChange(snap.docs.map((d) => toGroup(d.id, d.data()))),
    (error) => onError?.(error),
  )
}

export function watchGroup(
  groupId: string,
  onChange: (group: Group | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, COLLECTION, groupId),
    (snap) => onChange(snap.exists() ? toGroup(snap.id, snap.data()) : null),
    (error) => onError?.(error),
  )
}

export interface CreateGroupInput {
  name: string
  currency: CurrencyCode
  destination: string
  location: string
  owner: { uid: string; member: GroupMember }
}

export async function createGroup(input: CreateGroupInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    name: input.name,
    currency: input.currency,
    destination: input.destination,
    location: input.location,
    ownerId: input.owner.uid,
    memberIds: [input.owner.uid],
    members: { [input.owner.uid]: input.owner.member },
    inviteCode: inviteCode(),
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

/** The group currency is immutable once entries exist, so it is not editable. */
export async function updateGroup(
  groupId: string,
  patch: Pick<Partial<Group>, 'name' | 'destination' | 'location' | 'archived'>,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, groupId), { ...patch, updatedAt: serverTimestamp() })
}

/** Invalidates every invite link handed out so far. */
export async function rotateInviteCode(groupId: string): Promise<string> {
  const code = inviteCode()
  await updateDoc(doc(db, COLLECTION, groupId), { inviteCode: code, updatedAt: serverTimestamp() })
  return code
}

/** Mirrors a profile change into every group the member belongs to. */
export async function syncMemberProfile(uid: string, member: GroupMember): Promise<void> {
  const q = query(collection(db, COLLECTION), where('memberIds', 'array-contains', uid))
  const snap = await getDocs(q)
  if (snap.empty) return

  const batch = writeBatch(db)
  snap.docs.forEach((d) => batch.update(d.ref, { [`members.${uid}`]: member }))
  await batch.commit()
}

export type JoinResult = 'joined' | 'already-member' | 'invalid-code' | 'not-found'

/**
 * Adds the caller to a group using the secret half of an invite link.
 *
 * Non-members cannot read the group document, so `joinCode` is written as
 * proof; the security rule compares it against the stored `inviteCode` and
 * rejects the write if it does not match.
 */
export async function joinGroup(
  groupId: string,
  code: string,
  uid: string,
  member: GroupMember,
): Promise<JoinResult> {
  try {
    await updateDoc(doc(db, COLLECTION, groupId), {
      memberIds: arrayUnion(uid),
      [`members.${uid}`]: member,
      joinCode: code,
      updatedAt: serverTimestamp(),
    })
    return 'joined'
  } catch (error) {
    const reason = (error as { code?: string }).code
    if (reason === 'not-found') return 'not-found'
    if (reason === 'permission-denied') return 'invalid-code'
    throw error
  }
}

export async function leaveGroup(groupId: string, uid: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, groupId), {
    memberIds: arrayRemove(uid),
    [`members.${uid}`]: deleteField(),
    updatedAt: serverTimestamp(),
  })
}

/** Removes the group and every entry filed against it. Owner only. */
export async function deleteGroup(groupId: string): Promise<void> {
  const entries = await getDocs(query(collection(db, 'entries'), where('groupId', '==', groupId)))

  // A batch caps at 500 writes, so large ledgers are committed in chunks.
  const refs = entries.docs.map((d) => d.ref)
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db)
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }

  await deleteDoc(doc(db, COLLECTION, groupId))
}

export async function groupExists(groupId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, COLLECTION, groupId))
  return snap.exists()
}
