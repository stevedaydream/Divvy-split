import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { joinGroup, type JoinResult } from '@/services/groups'
import type { Group, GroupMember, Invitation } from '@/types/models'

const COLLECTION = 'invitations'

/** One invitation per group and person, so re-inviting replaces the old one. */
function invitationId(groupId: string, toUid: string): string {
  return `${groupId}_${toUid}`
}

function toInvitation(id: string, data: Record<string, unknown>): Invitation {
  return {
    id,
    groupId: (data.groupId as string) ?? '',
    groupName: (data.groupName as string) ?? '',
    fromUid: (data.fromUid as string) ?? '',
    fromName: (data.fromName as string) ?? '',
    toUid: (data.toUid as string) ?? '',
    inviteCode: (data.inviteCode as string) ?? '',
    status: data.status === 'declined' ? 'declined' : 'pending',
    createdAt: (data.createdAt as Invitation['createdAt']) ?? null,
  }
}

/**
 * Invites `toUid` into `group`. The invitation carries the group's invite
 * code, so accepting goes through the same rule-checked join as a link.
 */
export async function sendInvitation(group: Group, toUid: string, from: { uid: string; name: string }): Promise<void> {
  await setDoc(doc(db, COLLECTION, invitationId(group.id, toUid)), {
    groupId: group.id,
    groupName: group.name,
    fromUid: from.uid,
    fromName: from.name,
    toUid,
    inviteCode: group.inviteCode,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}

/** Pending invitations addressed to `uid`, newest first. */
export function watchMyInvitations(uid: string, onChange: (invitations: Invitation[]) => void) {
  const q = query(collection(db, COLLECTION), where('toUid', '==', uid), where('status', '==', 'pending'))
  return onSnapshot(q, (snap) =>
    onChange(
      snap.docs
        .map((d) => toInvitation(d.id, d.data()))
        .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0)),
    ),
  )
}

/** Invitations `uid` has sent for one group — to mark people as already invited. */
export function watchSentInvitations(
  groupId: string,
  uid: string,
  onChange: (invitations: Invitation[]) => void,
) {
  const q = query(collection(db, COLLECTION), where('groupId', '==', groupId), where('fromUid', '==', uid))
  return onSnapshot(q, (snap) => onChange(snap.docs.map((d) => toInvitation(d.id, d.data()))))
}

/**
 * Joins the group, then clears the invitation. A rotated invite code makes
 * the join fail as `invalid-code`; the stale invitation is removed either way.
 */
export async function acceptInvitation(invitation: Invitation, member: GroupMember, uid: string): Promise<JoinResult> {
  const result = await joinGroup(invitation.groupId, invitation.inviteCode, uid, member)
  await deleteDoc(doc(db, COLLECTION, invitation.id))
  return result
}

export async function declineInvitation(invitation: Invitation): Promise<void> {
  await updateDoc(doc(db, COLLECTION, invitation.id), { status: 'declined' })
}
