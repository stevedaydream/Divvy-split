import { describe, expect, it } from 'vitest'
import { activeGuestIds, claimConflicts, displayMembers, guestAliases, guestInUse, ledgerIdsOf, resolveEntry } from '../guests'
import { computeBalances } from '../settlement'
import type { Entry } from '@/types/models'

const entry = (patch: Partial<Entry>): Entry => ({
  id: 'e', groupId: 'g', type: 'expense', title: '', payerId: 'a', participantIds: ['a'], items: [],
  amountMinor: 300, currency: 'TWD', rate: 1, groupAmountMinor: 300, method: null, category: 'other',
  note: '', date: '2026-11-01', createdAt: null, createdBy: 'a', ...patch,
})

describe('虛擬成員', () => {
  const guests = { guest_B: { nickname: '阿明' }, guest_A: { nickname: '小華', linkedUid: 'c' } }

  it('帳本成員包含未認領的虛擬成員，已認領的併入本人', () => {
    expect(activeGuestIds(guests)).toEqual(['guest_B'])
    expect(ledgerIdsOf({ memberIds: ['a', 'c'], guests })).toEqual(['a', 'c', 'guest_B'])
    expect(guestAliases(guests)).toEqual({ guest_A: 'c' })
    const members = displayMembers({ a: { nickname: 'A', payment: null }, c: { nickname: 'C', payment: null } }, guests)
    expect(members.guest_B!.nickname).toBe('阿明')
    expect(members.guest_A!.nickname).toBe('C')
  })

  it('認領後帳目算到本人名下，餘額一致', () => {
    const entries = [
      entry({ payerId: 'guest_A', participantIds: ['a', 'guest_A', 'guest_B'] }),
      entry({ type: 'settlement', payerId: 'guest_B', participantIds: ['a'], amountMinor: 100, groupAmountMinor: 100 }),
    ]
    const resolved = entries.map((e) => resolveEntry(e, guestAliases(guests)))
    expect(resolved[0]).toMatchObject({ payerId: 'c', participantIds: ['a', 'c', 'guest_B'] })
    expect(resolved[1]).toBe(entries[1])
    expect(computeBalances(resolved, ledgerIdsOf({ memberIds: ['a', 'c'], guests }))).toEqual({ a: -200, c: 200, guest_B: 0 })
  })

  it('同一筆帳同時記了本人與虛擬成員時拒絕認領', () => {
    const both = entry({ participantIds: ['c', 'guest_B'] })
    const self = entry({ type: 'settlement', payerId: 'guest_B', participantIds: ['c'] })
    const fine = entry({ participantIds: ['a', 'guest_B'] })
    expect(claimConflicts([both, self, fine], 'guest_B', 'c')).toEqual([both, self])
    expect(guestInUse([fine], 'guest_B')).toBe(true)
    expect(guestInUse([both], 'guest_X')).toBe(false)
  })
})
