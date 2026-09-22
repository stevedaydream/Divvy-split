import { describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase/firestore'
import { listContacts } from '@/services/contacts'
import type { Group } from '@/types/models'

function group(id: string, memberIds: string[], updatedMs: number): Group {
  return {
    id,
    name: id,
    currency: 'TWD',
    destination: '',
    location: '',
    startDate: '',
    endDate: '',
    ownerId: memberIds[0]!,
    memberIds,
    members: Object.fromEntries(memberIds.map((uid) => [uid, { nickname: uid.toUpperCase(), payment: null }])),
    inviteCode: 'code1234',
    archived: false,
    createdAt: null,
    updatedAt: Timestamp.fromMillis(updatedMs),
  }
}

describe('listContacts', () => {
  const groups = [
    group('old', ['me', 'amy', 'bob'], 1_000),
    group('new', ['me', 'bob', 'cat'], 2_000),
  ]

  it('lists co-members once, most recently shared first', () => {
    expect(listContacts(groups, 'me').map((c) => [c.uid, c.sharedGroup])).toEqual([
      ['bob', 'new'],
      ['cat', 'new'],
      ['amy', 'old'],
    ])
  })

  it('never lists yourself or excluded people', () => {
    expect(listContacts(groups, 'me', ['bob']).map((c) => c.uid)).toEqual(['cat', 'amy'])
  })

  it('marks everyone as a recent companion', () => {
    expect(new Set(listContacts(groups, 'me').map((c) => c.source))).toEqual(new Set(['recent']))
    expect(listContacts([], 'me')).toEqual([])
  })
})
