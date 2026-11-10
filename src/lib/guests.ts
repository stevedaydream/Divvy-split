import type { Entry, GroupMember, GuestMember } from '@/types/models'
import { inviteCode } from './random'

/**
 * Virtual members ("guests") — people who share the bills but never sign in.
 *
 * A guest lives in the group document under `guests.<id>` and can appear in
 * entries exactly like a real member. When the real person later joins, they
 * claim the guest: `linkedUid` is set and every entry that names the guest is
 * read as if it named them. Entries are never rewritten, because only their
 * author may edit them.
 */

export const GUEST_PREFIX = 'guest_'
export const GUEST_NAME_MAX = 40

export type Guests = Record<string, GuestMember>

export function newGuestId(): string {
  return GUEST_PREFIX + inviteCode(12)
}

export function isGuestId(id: string): boolean {
  return id.startsWith(GUEST_PREFIX)
}

/** Guests not yet claimed by a real member, in a stable order. */
export function activeGuestIds(guests: Guests | undefined): string[] {
  return Object.keys(guests ?? {}).filter((id) => !guests![id]!.linkedUid).sort()
}

/** Everyone the ledger can name: real members first, then unclaimed guests. */
export function ledgerIdsOf(group: { memberIds: string[]; guests?: Guests }): string[] {
  return [...group.memberIds, ...activeGuestIds(group.guests)]
}

/** Every id an entry may legally reference, matching the security rule. */
export function entryIdsOf(group: { memberIds: string[]; guests?: Guests }): string[] {
  return [...group.memberIds, ...Object.keys(group.guests ?? {})]
}

/** `guestId → uid` for every claimed guest. */
export function guestAliases(guests: Guests | undefined): Record<string, string> {
  const aliases: Record<string, string> = {}
  for (const [id, guest] of Object.entries(guests ?? {})) if (guest.linkedUid) aliases[id] = guest.linkedUid
  return aliases
}

/** Display map with every guest folded in; a claimed guest shows its owner's name. */
export function displayMembers(members: Record<string, GroupMember>, guests: Guests | undefined): Record<string, GroupMember> {
  const result = { ...members }
  for (const [id, guest] of Object.entries(guests ?? {})) {
    result[id] = { nickname: (guest.linkedUid && members[guest.linkedUid]?.nickname) || guest.nickname, payment: null }
  }
  return result
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)]
}

/** Reads an entry with every claimed guest replaced by the member who claimed it. */
export function resolveEntry(entry: Entry, aliases: Record<string, string>): Entry {
  const map = (id: string) => aliases[id] ?? id
  if (!Object.keys(aliases).length) return entry
  const touches = (ids: string[]) => ids.some((id) => id in aliases)
  if (!(entry.payerId in aliases) && !touches(entry.participantIds)
    && !(entry.items ?? []).some((item) => item.payerId in aliases || touches(item.participantIds))) return entry
  return {
    ...entry,
    payerId: map(entry.payerId),
    participantIds: unique(entry.participantIds.map(map)),
    items: entry.items?.map((item) => ({ ...item, payerId: map(item.payerId), participantIds: unique(item.participantIds.map(map)) })),
  }
}

/**
 * Entries that name both the guest and the member about to claim it. Merging
 * would count that person once where the entry split for two, so claiming is
 * refused until those entries are fixed.
 */
export function claimConflicts(entries: Entry[], guestId: string, uid: string): Entry[] {
  const both = (ids: string[]) => ids.includes(guestId) && ids.includes(uid)
  return entries.filter((entry) => both(entry.participantIds)
    || (entry.type === 'settlement' && [entry.payerId, entry.participantIds[0]].every((id) => id === guestId || id === uid))
    || (entry.items ?? []).some((item) => both(item.participantIds)))
}

/** Whether any entry still names the guest; such a guest cannot be removed. */
export function guestInUse(entries: Entry[], guestId: string): boolean {
  return entries.some((entry) => entry.payerId === guestId || entry.participantIds.includes(guestId)
    || (entry.items ?? []).some((item) => item.payerId === guestId || item.participantIds.includes(guestId)))
}
