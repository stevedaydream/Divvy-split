import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { UserProfile } from '@/types/models'

const COLLECTION = 'users'

function toProfile(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    uid,
    nickname: (data.nickname as string) ?? '',
    email: (data.email as string) ?? '',
    currency: (data.currency as string) ?? 'USD',
    country: (data.country as string) ?? '',
    payment: (data.payment as UserProfile['payment']) ?? null,
    createdAt: (data.createdAt as UserProfile['createdAt']) ?? null,
    updatedAt: (data.updatedAt as UserProfile['updatedAt']) ?? null,
  }
}

export async function fetchProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, COLLECTION, uid))
  return snap.exists() ? toProfile(uid, snap.data()) : null
}

export function watchProfile(uid: string, onChange: (profile: UserProfile | null) => void) {
  return onSnapshot(doc(db, COLLECTION, uid), (snap) => {
    onChange(snap.exists() ? toProfile(uid, snap.data()) : null)
  })
}

/**
 * Merges `patch` into the profile. `createdAt` is stamped only when the
 * document does not exist yet, so re-saving never rewrites the join date.
 */
export async function saveProfile(uid: string, patch: Partial<UserProfile>): Promise<void> {
  const { uid: _uid, createdAt: _createdAt, updatedAt: _updatedAt, ...fields } = patch
  const ref = doc(db, COLLECTION, uid)
  const existing = await getDoc(ref)

  await setDoc(
    ref,
    {
      ...fields,
      updatedAt: serverTimestamp(),
      ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  )
}
