import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { initializeApp, deleteApp } from 'firebase/app'
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, setDoc, updateDoc, writeBatch } from 'firebase/firestore'

const hooks = vi.hoisted(() => ({ afterRead: null as (() => Promise<void>) | null }))
vi.mock('firebase/firestore', async (importOriginal) => {
  const sdk = await importOriginal<typeof import('firebase/firestore')>()
  return { ...sdk, getDocsFromServer: async (...args: Parameters<typeof sdk.getDocsFromServer>) => {
    const snapshot = await sdk.getDocsFromServer(...args)
    const hook = hooks.afterRead
    if (hook) { hooks.afterRead = null; await hook() }
    return snapshot
  } }
})

vi.mock('@/lib/firebase', async () => {
  const { initializeApp } = await import('firebase/app')
  const { getAuth, connectAuthEmulator } = await import('firebase/auth')
  const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore')
  const app = initializeApp({ apiKey: 'demo-key', projectId: 'demo-divvy', appId: 'demo-app' }, 'integration')
  const db = getFirestore(app)
  const auth = getAuth(app)
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  return { db, auth, app }
})

import { app, auth, db } from '@/lib/firebase'
import { createGroup, deleteGroup, joinGroup, syncMemberProfile } from '@/services/groups'
import { createEntry, deleteEntry, updateEntry, type EntryDraft } from '@/services/entries'
import { createItem, updateItem } from '@/services/itinerary'
import { createTripFromRecord, finishTrip, reopenTrip } from '@/services/tripRecords'
import { applyPackingTemplate, savePackingTemplate } from '@/services/packingTemplates'
import { setGroupHidden } from '@/services/groupPreferences'
import type { TripRecord, UserProfile } from '@/types/models'

describe.skipIf(process.env.DIVVY_EMULATOR_TEST !== '1')('旅行收尾與個人資料整合（本機模擬器）', () => {
  const suffix = Date.now()
  const password = 'test-only-password'
  const email = (index: number) => `test-${suffix}-${index}@example.invalid`
  let a = '', b = '', c = '', groupId = '', entryId = '', itemId = ''
  let dinner: EntryDraft
  let record: TripRecord
  const peer = initializeApp({ apiKey: 'demo-key', projectId: 'demo-divvy', appId: 'demo-peer' }, 'integration-peer')
  const peerAuth = getAuth(peer)
  const peerDb = getFirestore(peer)
  connectAuthEmulator(peerAuth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(peerDb, '127.0.0.1', 8080)
  const login = async (index: number) => { await signInWithEmailAndPassword(auth, email(index), password) }

  beforeAll(async () => {
    a = (await createUserWithEmailAndPassword(auth, email(0), password)).user.uid
    b = (await createUserWithEmailAndPassword(auth, email(1), password)).user.uid
    c = (await createUserWithEmailAndPassword(auth, email(2), password)).user.uid
    await login(0)
    groupId = await createGroup({ name: '測試旅行', currency: 'TWD', destination: 'TW', location: '墾丁', startDate: '2026-10-01', endDate: '2026-10-03', owner: { uid: a, member: { nickname: 'A', payment: null } } })
    const code = (await getDoc(doc(db, 'groups', groupId))).data()!.inviteCode
    await login(1); expect(await joinGroup(groupId, code, b, { nickname: 'B', payment: null })).toBe('joined')
    await login(2); expect(await joinGroup(groupId, code, c, { nickname: 'C', payment: null })).toBe('joined')
    await login(0)
  }, 30000)
  afterAll(async () => { await deleteApp(peer); await deleteApp(app) })

  it('不同付款人明細可保存及補編，未結清不能封存', async () => {
    dinner = { groupId, type: 'expense', title: '晚餐', payerId: a, participantIds: [a, b, c],
      amountMinor: 120000, currency: 'TWD', rate: 1, groupAmountMinor: 120000, method: null, category: 'food', note: '', date: '2026-10-02' }
    entryId = await createEntry(dinner, a)
    dinner.items = [
      ...[1, 2, 3].map((n) => ({ title: `菜 ${n}`, amountMinor: 30000, payerId: a, participantIds: [a, b, c] })),
      { title: 'A 飲料', amountMinor: 8000, payerId: a, participantIds: [a] },
      { title: 'B 甜點', amountMinor: 10000, payerId: b, participantIds: [b] },
      { title: 'C 飲料甜點', amountMinor: 12000, payerId: b, participantIds: [c] },
    ]
    await updateEntry(entryId, dinner)
    expect((await getDoc(doc(db, 'entries', entryId))).data()!.items).toHaveLength(6)
    await expect(finishTrip(groupId, a, false, true)).rejects.toThrow('unsettled')
    expect((await getDoc(doc(db, 'groups', groupId))).data()!.archived).toBe(false)
  })

  it('規則支援 12 項明細，並拒絕明細總和不符的直接寫入', async () => {
    const items = Array.from({ length: 12 }, (_, n) => ({ title: `測試 ${n}`, amountMinor: 100, payerId: a, participantIds: [a] }))
    const id = await createEntry({ ...dinner, participantIds: [a], items, amountMinor: 1200, groupAmountMinor: 1200 }, a)
    const group = (await getDoc(doc(db, 'groups', groupId))).data()!
    const batch = writeBatch(db)
    batch.update(doc(db, 'groups', groupId), { ledgerRevision: group.ledgerRevision + 1 })
    batch.update(doc(db, 'entries', id), { amountMinor: 1999 })
    await expect(batch.commit()).rejects.toMatchObject({ code: 'permission-denied' })
    await deleteEntry(id)
  })

  it('封存時若另一裝置新增帳目，版本檢查會阻止使用過期帳本', async () => {
    const id = await createGroup({ name: '並行測試', currency: 'TWD', destination: 'TW', location: '', startDate: '', endDate: '', owner: { uid: a, member: { nickname: 'A', payment: null } } })
    hooks.afterRead = async () => { await createEntry({ ...dinner, groupId: id, items: [], participantIds: [a], amountMinor: 100, groupAmountMinor: 100 }, a) }
    await expect(finishTrip(id, a, false, true)).rejects.toThrow('trip-changed')
    expect((await getDoc(doc(db, 'groups', id))).data()!.archived).toBe(false)
    await finishTrip(id, a, false, true)
    expect((await getDoc(doc(db, 'groups', id))).data()!.archived).toBe(true)
  })

  it('結清後原子封存與保存副本，阻擋所有共享內容修改及加入', async () => {
    const plan = { kind: 'lodging' as const, date: '2026-10-01', time: '15:00', endDate: '2026-10-03', title: '住宿', place: '墾丁', note: '可再次參考', estimateMinor: 100000, category: 'lodging' as const }
    itemId = await createItem(groupId, plan, a)
    await login(1); await createEntry({ ...dinner, items: [], type: 'settlement', title: '還款', payerId: b, participantIds: [a], amountMinor: 18000, groupAmountMinor: 18000 }, b)
    await login(2); await createEntry({ ...dinner, items: [], type: 'settlement', title: '還款', payerId: c, participantIds: [a], amountMinor: 42000, groupAmountMinor: 42000 }, c)
    await expect(finishTrip(groupId, c, true, true)).rejects.toThrow('cannot-archive')
    await login(0); await finishTrip(groupId, a, true, true)
    expect((await getDoc(doc(db, 'groups', groupId))).data()!.archived).toBe(true)
    record = { ...(await getDoc(doc(db, 'users', a, 'trips', groupId))).data(), id: groupId } as TripRecord
    expect(record.items[0]).toMatchObject({ note: '可再次參考', endDate: '2026-10-03' })
    expect(record).not.toHaveProperty('members')
    await expect(createEntry(dinner, a)).rejects.toThrow('group-archived')
    await expect(updateEntry(entryId, dinner)).rejects.toThrow('group-archived')
    await expect(deleteEntry(entryId)).rejects.toThrow('group-archived')
    await expect(updateItem(groupId, itemId, plan, a)).rejects.toThrow('group-archived')
    await expect(updateDoc(doc(db, 'entries', entryId), { title: '直接修改' })).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(setDoc(doc(db, 'groups', groupId, 'todos', 'direct'), { text: '修改', done: false, updatedBy: a })).rejects.toMatchObject({ code: 'permission-denied' })
    await syncMemberProfile(a, { nickname: 'A 新暱稱', payment: null })
    await login(1)
    await expect(reopenTrip(groupId)).rejects.toMatchObject({ code: 'permission-denied' })
    await expect(getDoc(doc(db, 'users', a, 'trips', groupId))).rejects.toMatchObject({ code: 'permission-denied' })
    await createUserWithEmailAndPassword(peerAuth, email(3), password)
    const archived = (await getDoc(doc(db, 'groups', groupId))).data()!
    await expect(updateDoc(doc(peerDb, 'groups', groupId), { memberIds: [...archived.memberIds, peerAuth.currentUser!.uid], members: { ...archived.members, [peerAuth.currentUser!.uid]: { nickname: 'D', payment: null } }, joinCode: archived.inviteCode })).rejects.toMatchObject({ code: 'permission-denied' })
    await login(0)
  })

  it('重新開啟後可以補帳；換日期複製只帶行程、自己與目的地', async () => {
    await reopenTrip(groupId)
    const self = await createEntry({ ...dinner, items: [], participantIds: [a] }, a)
    await deleteEntry(self)
    await finishTrip(groupId, a, false, true)
    const profile = { uid: a, nickname: 'A', payment: null } as UserProfile
    const copied = await createTripFromRecord(record, '下次潛水', '2027-02-28', profile)
    const group = (await getDoc(doc(db, 'groups', copied))).data()!
    expect(group.memberIds).toEqual([a])
    expect(group.endDate).toBe('2027-03-02')
    expect(group.archived).toBe(false)
    const plans = await getDocs(collection(db, 'groups', copied, 'itinerary'))
    expect(plans.docs[0]!.data()).toMatchObject({ date: '2027-02-28', endDate: '2027-03-02' })
  })

  it('保存多個私人行李範本，套用去重且不保留勾選狀態', async () => {
    await savePackingTemplate(a, '水肺', ['面鏡', '蛙鞋', '面鏡'])
    await savePackingTemplate(a, '自潛', ['面鏡', '防寒衣'])
    expect((await getDocs(collection(db, 'users', a, 'packingTemplates'))).size).toBe(2)
    expect(await applyPackingTemplate(a, groupId, ['面鏡', '蛙鞋'])).toBe(2)
    expect(await applyPackingTemplate(a, groupId, ['面鏡', '防寒衣'])).toBe(1)
    expect(await applyPackingTemplate(a, groupId, ['面鏡', '防寒衣'])).toBe(0)
    const concurrent = await Promise.all([applyPackingTemplate(a, groupId, ['共同裝備']), applyPackingTemplate(a, groupId, ['共同裝備'])])
    expect(concurrent.reduce((sum, count) => sum + count, 0)).toBe(1)
    const packing = await getDocs(collection(db, 'users', a, 'packing'))
    expect(packing.docs.every((item) => item.data().done === false)).toBe(true)
    await login(1)
    await expect(getDocs(collection(db, 'users', a, 'packingTemplates'))).rejects.toMatchObject({ code: 'permission-denied' })
    await login(0)
  })

  it('隱藏與刪除群組均不更動已保存的個人副本', async () => {
    await setGroupHidden(a, groupId, true)
    expect((await getDoc(doc(db, 'groups', groupId))).data()!.memberIds).toEqual([a, b, c])
    await deleteGroup(groupId)
    await expect(getDoc(doc(db, 'groups', groupId))).rejects.toMatchObject({ code: 'permission-denied' })
    expect((await getDoc(doc(db, 'users', a, 'trips', groupId))).exists()).toBe(true)
    expect((await getDocs(collection(db, 'users', a, 'packingTemplates'))).size).toBe(2)
  })
})
