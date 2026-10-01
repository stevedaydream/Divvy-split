import {
  collection, doc, getDocFromServer, getDocsFromServer, onSnapshot, query, runTransaction,
  serverTimestamp, where, writeBatch, deleteDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { computeBalances } from '@/lib/settlement'
import { copyTripPlan, tripSnapshot } from '@/lib/tripRecords'
import { inviteCode } from '@/lib/random'
import { toEntry } from './entries'
import { toItem } from './itinerary'
import type { Group, TripRecord, UserProfile } from '@/types/models'

function records(uid: string) { return collection(db, 'users', uid, 'trips') }

export function watchTripRecords(uid: string, onChange: (records: TripRecord[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(records(uid), (snapshot) => onChange(snapshot.docs.map((entry) =>
    ({ ...entry.data(), id: entry.id } as TripRecord)).sort((a, b) => (b.savedAt?.toMillis() ?? 0) - (a.savedAt?.toMillis() ?? 0))), onError)
}

/** 重新讀取伺服器帳本與行程，版本改變時要求重試，避免補帳與封存同時發生。 */
export async function finishTrip(groupId: string, uid: string, saveRecord: boolean, archive: boolean): Promise<void> {
  const groupRef = doc(db, 'groups', groupId)
  const baseline = await getDocFromServer(groupRef)
  if (!baseline.exists()) throw new Error('group-not-found')
  const [entries, itinerary] = await Promise.all([
    getDocsFromServer(query(collection(db, 'entries'), where('groupId', '==', groupId))),
    getDocsFromServer(collection(db, 'groups', groupId, 'itinerary')),
  ])
  const group = { ...baseline.data(), id: groupId } as Group
  if (archive && Object.values(computeBalances(entries.docs.map((entry) => toEntry(entry.id, entry.data())), group.memberIds)).some((amount) => amount !== 0)) throw new Error('unsettled')
  const snapshot = tripSnapshot(group, itinerary.docs.map((item) => toItem(item.id, item.data())))
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(groupRef)
    const data = current.data()
    if (!data || data.deleting || !data.memberIds.includes(uid)) throw new Error('not-member')
    if ((data.ledgerRevision ?? 0) !== (group.ledgerRevision ?? 0)
      || (data.planRevision ?? 0) !== (group.planRevision ?? 0)
      || (data.updatedAt ? !group.updatedAt || !data.updatedAt.isEqual(group.updatedAt) : !!group.updatedAt)) throw new Error('trip-changed')
    if (archive && (data.ownerId !== uid || data.archived)) throw new Error('cannot-archive')
    if (saveRecord) transaction.set(doc(records(uid), groupId), { ...snapshot, savedAt: serverTimestamp() })
    if (archive) transaction.update(groupRef, { archived: true, updatedAt: serverTimestamp() })
  })
}

export async function reopenTrip(groupId: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const ref = doc(db, 'groups', groupId)
    const group = await transaction.get(ref)
    if (!group.exists() || !group.data().archived) throw new Error('cannot-reopen')
    transaction.update(ref, { archived: false, updatedAt: serverTimestamp() })
  })
}

export async function createTripFromRecord(record: TripRecord, name: string, startDate: string, profile: UserProfile): Promise<string> {
  const plan = copyTripPlan(record, startDate)
  if (plan.items.length > 450) throw new Error('plan-too-large')
  const ref = doc(collection(db, 'groups'))
  const batch = writeBatch(db)
  batch.set(ref, {
    name, currency: record.currency, destination: record.destination, location: record.location,
    startDate, endDate: plan.endDate, ownerId: profile.uid, memberIds: [profile.uid],
    members: { [profile.uid]: { nickname: profile.nickname, payment: profile.payment } },
    inviteCode: inviteCode(), archived: false, ledgerRevision: 0, planRevision: 0,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
  plan.items.forEach((item) => batch.set(doc(collection(ref, 'itinerary')), { ...item, updatedBy: profile.uid, updatedAt: serverTimestamp() }))
  await batch.commit()
  return ref.id
}

export async function deleteTripRecord(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(records(uid), id))
}
