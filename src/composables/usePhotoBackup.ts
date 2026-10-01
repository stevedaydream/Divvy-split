import { ref } from 'vue'
import { auth } from '@/lib/firebase'
import { photoRevision } from '@/lib/photos'
import { getLocalPhoto, listLocalPhotos, saveLocalPhoto } from '@/services/localPhotos'
import { backupPhoto, driveConnected } from '@/services/photoDrive'
import { maintainDriveShares } from '@/services/sharedPhotos'

export const photoBackupBusy = ref(false)
export const photoBackupError = ref('')
let running: Promise<void> | null = null

export function runPhotoBackup(force = false): Promise<void> {
  if (running) return running
  if (!driveConnected.value || !auth.currentUser) return Promise.resolve()
  const uid = auth.currentUser.uid
  running = (async () => {
    photoBackupBusy.value = true; photoBackupError.value = ''
    try {
      await maintainDriveShares(force)
      for (const photo of await listLocalPhotos(uid)) {
        if (!driveConnected.value || auth.currentUser?.uid !== uid) break
        const revision = photoRevision(photo)
        if (photo.backupId && photo.backupRevision === revision) continue
        await saveLocalPhoto({ ...photo, backupState: 'running' })
        try {
          const backupId = await backupPhoto(photo)
          const current = await getLocalPhoto(uid, photo.id)
          if (current) await saveLocalPhoto({ ...current, backupId, backupRevision: revision, backupState: photoRevision(current) === revision ? 'done' : 'pending' })
        } catch (error) {
          const current = await getLocalPhoto(uid, photo.id)
          if (current) await saveLocalPhoto({ ...current, backupState: 'failed' })
          throw error
        }
      }
    } catch (error) { photoBackupError.value = (error as Error).message }
    finally { photoBackupBusy.value = false; running = null }
  })()
  return running
}
