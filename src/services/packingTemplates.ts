import { addDoc, collection, deleteDoc, doc, getDocsFromServer, onSnapshot, query, runTransaction, serverTimestamp, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { newPackingTexts } from '@/lib/packingTemplates'
import type { Timestamp } from 'firebase/firestore'

export interface PackingTemplate {
  id: string
  name: string
  texts: string[]
  savedAt: Timestamp | null
}

function templates(uid: string) { return collection(db, 'users', uid, 'packingTemplates') }

export function watchPackingTemplates(uid: string, onChange: (items: PackingTemplate[]) => void, onError?: (error: Error) => void) {
  return onSnapshot(templates(uid), (snapshot) => onChange(snapshot.docs.map((item) => ({ ...item.data(), id: item.id } as PackingTemplate))
    .sort((a, b) => a.name.localeCompare(b.name))), onError)
}

export async function savePackingTemplate(uid: string, name: string, texts: string[]): Promise<void> {
  const unique = [...new Set(texts.map((text) => text.trim()).filter(Boolean))]
  if (!name.trim() || name.trim().length > 80 || !unique.length || unique.length > 450 || unique.some((text) => text.length > 120)) throw new Error('invalid-template')
  await addDoc(templates(uid), { name: name.trim(), texts: unique, savedAt: serverTimestamp() })
}

export async function deletePackingTemplate(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(templates(uid), id))
}

export async function applyPackingTemplate(uid: string, groupId: string, texts: string[]): Promise<number> {
  const existing = await getDocsFromServer(query(collection(db, 'users', uid, 'packing'), where('groupId', '==', groupId)))
  const additions = newPackingTexts(existing.docs.map((item) => item.data().text as string), texts)
  if (additions.length > 450 || additions.some((text) => text.length > 120)) throw new Error('invalid-template')
  const refs = await Promise.all(additions.map(async (text) => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    const id = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    return { text, ref: doc(db, 'users', uid, 'packing', `${groupId}_${id}`) }
  }))
  if (!refs.length) return 0
  // 固定文件 ID 搭配交易，避免兩個裝置同時套用重複裝備或重設已勾選的項目。
  return runTransaction(db, async (transaction) => {
    const snapshots = await Promise.all(refs.map(({ ref }) => transaction.get(ref)))
    let count = 0
    refs.forEach(({ text, ref }, index) => {
      if (snapshots[index]!.exists()) return
      transaction.set(ref, { groupId, text, done: false, updatedBy: uid, createdAt: serverTimestamp() })
      count++
    })
    return count
  })
}
