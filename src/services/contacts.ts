import type { Group } from '@/types/models'

/**
 * "People you can invite" — the seam where a friend system will plug in.
 *
 * Today the only source is `recent`: anyone you have shared a group with,
 * read from group documents you can already see, so no extra query and no
 * way to discover strangers. A future friend list adds `source: 'friend'`
 * entries here; the invite UI consumes `Contact` and does not change.
 */
export type ContactSource = 'recent' | 'friend'

export interface Contact {
  uid: string
  nickname: string
  source: ContactSource
  /** Name of the most recent group you shared, for context in the list. */
  sharedGroup: string
}

function recency(group: Group): number {
  return group.updatedAt?.toMillis() ?? group.createdAt?.toMillis() ?? 0
}

/**
 * Co-members across `groups`, most recently shared first, excluding yourself
 * and anyone in `exclude` (e.g. people already in the group being filled).
 */
export function listContacts(groups: Group[], me: string, exclude: Iterable<string> = []): Contact[] {
  const skip = new Set([me, ...exclude])
  const seen = new Map<string, Contact>()

  for (const group of [...groups].sort((a, b) => recency(b) - recency(a))) {
    for (const uid of group.memberIds) {
      if (skip.has(uid) || seen.has(uid)) continue
      seen.set(uid, {
        uid,
        nickname: group.members[uid]?.nickname || '?',
        source: 'recent',
        sharedGroup: group.name,
      })
    }
  }

  return [...seen.values()]
}
