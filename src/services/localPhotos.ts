import { photoInfo, photoRevision, restorePhoto } from '@/lib/photos'
import type { LocalPhoto, PhotoInfo } from '@/types/photos'

let opening: Promise<IDBDatabase> | undefined
function database(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('divvy-photos', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('photos', { keyPath: ['uid', 'id'] })
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); opening = undefined }; resolve(request.result) }
    request.onerror = () => { opening = undefined; reject(request.error) }
    request.onblocked = () => { opening = undefined; reject(new Error('storage-blocked')) }
  })
  return opening
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('photos', mode)
    const request = action(tx.objectStore('photos'))
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = tx.onabort = () => reject(tx.error ?? request.error ?? new Error('storage-failed'))
  })
}

export async function listLocalPhotos(uid: string): Promise<LocalPhoto[]> {
  return transaction('readonly', (store) => store.getAll(IDBKeyRange.bound([uid, ''], [uid, '\uffff'])))
}
export async function getLocalPhoto(uid: string, id: string): Promise<LocalPhoto | undefined> {
  return transaction('readonly', (store) => store.get([uid, id]))
}
export async function saveLocalPhoto(photo: LocalPhoto): Promise<void> {
  await transaction('readwrite', (store) => store.put(photo))
  window.dispatchEvent(new Event('divvy:photos'))
}
export async function importLocalPhoto(info: PhotoInfo, blob: Blob, uid: string): Promise<void> {
  if (await getLocalPhoto(uid, info.id)) return
  await saveLocalPhoto(restorePhoto(info, blob, uid))
}
export async function editLocalPhoto(uid: string, id: string, patch: Partial<Pick<PhotoInfo, 'date' | 'itineraryId' | 'itineraryTitle'>>): Promise<void> {
  const photo = await getLocalPhoto(uid, id)
  if (!photo) return
  const next = { ...photo, ...patch }
  if (photoRevision(next) !== next.backupRevision) next.backupState = 'pending'
  await saveLocalPhoto(next)
}
export async function deleteLocalPhoto(uid: string, id: string): Promise<void> {
  await transaction('readwrite', (store) => store.delete([uid, id]))
  window.dispatchEvent(new Event('divvy:photos'))
}
export async function localStorageStatus(): Promise<{ used: number; quota: number; persistent: boolean }> {
  const estimate = await navigator.storage?.estimate()
  return { used: estimate?.usage ?? 0, quota: estimate?.quota ?? 0, persistent: await navigator.storage?.persisted() ?? false }
}
export async function requestPhotoPersistence(): Promise<boolean> { return await navigator.storage?.persist() ?? false }
export { photoInfo }
