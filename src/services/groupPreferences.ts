import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export function watchHiddenGroups(uid: string, onChange: (ids: string[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(collection(db, 'users', uid, 'groupPreferences'), (snapshot) =>
    onChange(snapshot.docs.filter((item) => item.data().hidden === true).map((item) => item.id)), onError)
}

export async function setGroupHidden(uid: string, groupId: string, hidden: boolean): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'groupPreferences', groupId), { hidden })
}
