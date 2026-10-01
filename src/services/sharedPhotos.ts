import { collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, setDoc, startAfter, updateDoc, where, type QueryDocumentSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { MAX_SHARED_PHOTOS, PHOTO_LIFETIME, photoInfo, validPhotoDate, validatePhotoInfo } from '@/lib/photos'
import { getLocalPhoto, importLocalPhoto, saveLocalPhoto } from '@/services/localPhotos'
import { driveConnected, driveFiles, readDrivePhoto, removeDriveFile, shareDrivePhoto, uploadDrivePhoto } from '@/services/photoDrive'
import { photoThumbnail } from '@/services/photoFiles'
import type { Group } from '@/types/models'
import type { LocalPhoto, SharedPhoto } from '@/types/photos'

export async function registerPhotoMember(groupId: string): Promise<void> {
  const user = auth.currentUser
  if (!user?.email || !user.emailVerified || !driveConnected.value) throw new Error('drive-connect')
  await setDoc(doc(db, 'groups', groupId, 'photoMembers', user.uid), { email: user.email })
}
export async function photoMembers(groupId: string): Promise<{ uid: string; email: string }[]> {
  const snap = await getDocs(query(collection(db, 'groups', groupId, 'photoMembers'), limit(100)))
  return snap.docs.map((item) => ({ uid: item.id, email: String(item.data().email) }))
}
export async function listSharedPhotos(groupId: string, cursor?: QueryDocumentSnapshot): Promise<{ photos: SharedPhoto[]; cursor?: QueryDocumentSnapshot; more: boolean }> {
  const snap = await getDocs(query(collection(db, 'groups', groupId, 'photos'), orderBy('expiresAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(50)))
  return { photos: snap.docs.map((item) => ({ ...item.data(), id: item.id } as SharedPhoto)).filter((photo) => !photo.deleted && photo.expiresAt > Date.now()), cursor: snap.docs[snap.docs.length - 1], more: snap.size === 50 }
}
export async function photoExpiryReminders(groupId: string): Promise<SharedPhoto[]> {
  const snap = await getDocs(query(collection(db, 'groups', groupId, 'photos'), where('expiresAt', '>', Date.now()), where('expiresAt', '<=', Date.now() + 7 * 86400000), orderBy('expiresAt'), limit(20)))
  return snap.docs.map((item) => ({ ...item.data(), id: item.id } as SharedPhoto)).filter((photo) => !photo.deleted)
}
export async function publishPhotoIndex(groupId: string, photo: SharedPhoto): Promise<void> {
  if (!validatePhotoInfo(photo) || photo.uploaderId !== auth.currentUser?.uid || photo.groupId !== groupId) throw new Error('photo-invalid')
  const ref = doc(db, 'groups', groupId, 'photos', photo.id)
  const count = doc(db, 'groups', groupId, 'photoCounters', 'total')
  await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref)
    const counter = await tx.get(count)
    if (existing.exists()) return
    const value = Number(counter.data()?.count ?? 0)
    if (value >= MAX_SHARED_PHOTOS) throw new Error('photo-quota')
    tx.set(count, { count: value + 1, lastId: photo.id })
    tx.set(ref, { ...photoInfo(photo), driveFileId: photo.driveFileId, thumbnailId: photo.thumbnailId ?? '', expiresAt: photo.expiresAt, deleted: false, indexedAt: serverTimestamp() })
  })
}
export async function shareLocalPhoto(photo: LocalPhoto, group: Group): Promise<void> {
  if (photo.uploaderId !== auth.currentUser?.uid || photo.uid !== auth.currentUser?.uid) throw new Error('photo-owner')
  if (photo.sharedFileId && photo.sharedUntil <= Date.now()) throw new Error('photo-expired')
  const members = await photoMembers(group.id)
  let file = photo.sharedFileId
  const expiresAt = photo.sharedUntil || Date.now() + PHOTO_LIFETIME
  if (!file) {
    file = await uploadDrivePhoto(photo.blob, photo.name, { divvyKind: 'shared', divvyPhoto: photo.id, divvyGroup: group.id, divvyExpires: String(expiresAt) })
    photo = { ...await getLocalPhoto(photo.uid, photo.id) ?? photo, sharedFileId: file, sharedUntil: expiresAt, sharedGroupId: group.id }
    await saveLocalPhoto(photo)
  }
  let thumbnailId = photo.sharedThumbnailId ?? ''
  if (!thumbnailId) {
    const thumbnail = await photoThumbnail(photo.blob)
    if (thumbnail) {
      thumbnailId = await uploadDrivePhoto(thumbnail, `${photo.id}-preview.jpg`, { divvyKind: 'shared', divvyPhoto: photo.id, divvyGroup: group.id, divvyExpires: String(expiresAt) })
      photo = { ...await getLocalPhoto(photo.uid, photo.id) ?? photo, sharedThumbnailId: thumbnailId }
      await saveLocalPhoto(photo)
    }
  }
  for (const member of members) if (member.uid !== photo.uid && group.memberIds.includes(member.uid)) {
    await shareDrivePhoto(file, member.email, expiresAt)
    if (thumbnailId) await shareDrivePhoto(thumbnailId, member.email, expiresAt)
  }
  await publishPhotoIndex(group.id, { ...photoInfo(photo), driveFileId: file, thumbnailId, expiresAt, deleted: false })
}
export async function saveSharedPhoto(photo: SharedPhoto, uid: string): Promise<void> {
  if (photo.deleted || photo.expiresAt <= Date.now()) throw new Error('photo-expired')
  if (await getLocalPhoto(uid, photo.id)) return
  const blob = await readDrivePhoto(photo.driveFileId)
  await importLocalPhoto(photo, new Blob([blob], { type: photo.mimeType }), uid)
}
export async function editSharedPhoto(photo: SharedPhoto, patch: Pick<SharedPhoto, 'date' | 'itineraryId' | 'itineraryTitle'>): Promise<void> {
  if (!validPhotoDate(patch.date)) throw new Error('photo-invalid')
  await updateDoc(doc(db, 'groups', photo.groupId, 'photos', photo.id), patch)
}
export async function deleteSharedPhoto(photo: SharedPhoto): Promise<void> {
  await updateDoc(doc(db, 'groups', photo.groupId, 'photos', photo.id), { deleted: true })
  if (photo.uploaderId === auth.currentUser?.uid && driveConnected.value) {
    await removeDriveFile(photo.driveFileId)
    if (photo.thumbnailId) await removeDriveFile(photo.thumbnailId)
  }
}

const maintained = new Map<string, number>()
export async function maintainDriveShares(force = false): Promise<number> {
  const uid = auth.currentUser?.uid
  if (!uid || (!force && Date.now() - (maintained.get(uid) ?? 0) < 6 * 3600000)) return 0
  let cursor = ''
  let cleaned = 0
  do {
    const page = await driveFiles('shared', cursor)
    cursor = page.nextPageToken ?? ''
    for (const file of page.files) {
      const properties = file.appProperties
      if (!properties?.divvyGroup || !properties.divvyPhoto) continue
      let shouldRemove = Number(properties.divvyExpires) <= Date.now()
      if (!shouldRemove) {
        try {
          const group = await getDoc(doc(db, 'groups', properties.divvyGroup))
          if (!group.exists() || group.data()?.deleting) shouldRemove = true
          else {
            const photo = await getDoc(doc(db, 'groups', properties.divvyGroup, 'photos', properties.divvyPhoto))
            shouldRemove = photo.exists() && photo.data().deleted === true
            if (!shouldRemove && photo.exists()) {
              const members = await photoMembers(properties.divvyGroup)
              for (const member of members) if (member.uid !== auth.currentUser?.uid && group.data()?.memberIds.includes(member.uid)) await shareDrivePhoto(file.id, member.email, Number(properties.divvyExpires))
            }
          }
        } catch (error) {
          if ((error as { code?: string }).code === 'permission-denied') shouldRemove = true
          else throw error
        }
      }
      if (shouldRemove) { await removeDriveFile(file.id); cleaned++ }
    }
  } while (cursor)
  maintained.set(uid, Date.now())
  return cleaned
}
