<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import type { QueryDocumentSnapshot } from 'firebase/firestore'
import { useI18n } from 'vue-i18n'
import AppButton from '@/components/ui/AppButton.vue'
import AppSheet from '@/components/ui/AppSheet.vue'
import PhotoTile from './PhotoTile.vue'
import { useAuthStore } from '@/stores/auth'
import { useConfirm } from '@/composables/useConfirm'
import { photoBackupBusy, photoBackupError, runPhotoBackup } from '@/composables/usePhotoBackup'
import { daysUntilExpiry, MAX_ARCHIVE_BYTES, MAX_PHOTO_BATCH, photoInfo, photoRevision, photoSections, validPhotoDate } from '@/lib/photos'
import { todayIso } from '@/lib/dates'
import { deleteLocalPhoto, editLocalPhoto, getLocalPhoto, importLocalPhoto, listLocalPhotos, localStorageStatus, requestPhotoPersistence, saveLocalPhoto } from '@/services/localPhotos'
import { authorizeSharedPhotos, connectDrive, disconnectDrive, driveConnected, driveFiles, readDrivePhoto, removeDriveFile, restoreDriveBackup } from '@/services/photoDrive'
import { deleteSharedPhoto, editSharedPhoto, listSharedPhotos, registerPhotoMember, saveSharedPhoto, shareLocalPhoto } from '@/services/sharedPhotos'
import { downloadPhotoBlob, photoArchive, preparePhoto, readPhotoArchive } from '@/services/photoFiles'
import type { Group, ItineraryItem } from '@/types/models'
import type { LocalPhoto, PhotoInfo, PhotoQuality, SharedPhoto } from '@/types/photos'

const props = defineProps<{ group?: Group; itinerary?: ItineraryItem[]; itineraryFilter?: string; localGroupId?: string }>()
const { t } = useI18n()
const auth = useAuthStore()
const { confirm } = useConfirm()
const localPhotos = ref<LocalPhoto[]>([])
const sharedPhotos = ref<SharedPhoto[]>([])
const selected = ref<string[]>([])
const busy = ref(false)
const loading = ref(false)
const error = ref('')
const progress = ref('')
const onlyMissing = ref(false)
const quality = ref<PhotoQuality>('standard')
const groupFilter = ref(props.localGroupId ?? '')
const dateFilter = ref('')
const editDate = ref(todayIso())
const linkId = ref('')
const removeBackup = ref(false)
const uploadInput = ref<HTMLInputElement>()
const importInput = ref<HTMLInputElement>()
const more = ref(false)
let cursor: QueryDocumentSnapshot | undefined
let generation = 0
const clock = ref(Date.now())
const timer = setInterval(() => { clock.value = Date.now() }, 60000)
const preview = ref<PhotoInfo | null>(null)
const previewUrl = ref('')
const externalDownloads = ref<string[]>([])
const backups = ref<{ id: string; name: string }[]>([])
const backupSelection = ref<string[]>([])
const backupCursor = ref('')
const storage = ref({ used: 0, quota: 0, persistent: false })
const saved = computed(() => new Set(localPhotos.value.map((photo) => photo.id)))
const savedBlobs = computed(() => new Map(localPhotos.value.map((photo) => [photo.id, photo.blob])))
const albumGroups = computed(() => [...new Map(localPhotos.value.map((photo) => [photo.groupId, photo.groupName])).entries()])
const visible = computed<PhotoInfo[]>(() => (props.group ? sharedPhotos.value.filter((photo) => !photo.deleted && photo.expiresAt > clock.value) : localPhotos.value)
  .filter((photo) => (!onlyMissing.value || !saved.value.has(photo.id)) && (!groupFilter.value || props.group || photo.groupId === groupFilter.value)
    && (!dateFilter.value || photo.date === dateFilter.value) && (!props.itineraryFilter || photo.itineraryId === props.itineraryFilter)))
const sections = computed(() => photoSections(visible.value))
const selectedPhotos = computed(() => visible.value.filter((photo) => selected.value.includes(photo.id)))
const manageable = computed(() => !props.group || selectedPhotos.value.every((photo) => photo.uploaderId === auth.uid || props.group?.ownerId === auth.uid))

function message(reason: unknown): string {
  const code = (reason as Error).message
  const key = ['drive-connect', 'drive-full', 'drive-access', 'drive-file', 'drive-picker', 'photo-format', 'photo-too-large', 'photo-expired', 'photo-quota', 'archive-limit', 'invalid-archive'].includes(code) ? code : 'failed'
  return t(`photos.errors.${key}`)
}
async function refreshLocal(): Promise<void> {
  const uid = auth.uid
  if (!uid) { localPhotos.value = []; return }
  const next = await listLocalPhotos(uid)
  if (auth.uid === uid) { localPhotos.value = next; storage.value = await localStorageStatus() }
}
async function refreshShared(append = false): Promise<void> {
  if (!props.group) return
  const ticket = generation
  const page = await listSharedPhotos(props.group.id, append ? cursor : undefined)
  if (ticket !== generation) return
  sharedPhotos.value = append ? [...sharedPhotos.value, ...page.photos] : page.photos
  cursor = page.cursor; more.value = page.more
}
async function reload(): Promise<void> {
  loading.value = true; error.value = ''
  try { await refreshLocal(); await refreshShared() } catch (reason) { error.value = message(reason) }
  finally { loading.value = false }
}
watch(() => [auth.uid, props.group?.id], () => { generation++; sharedPhotos.value = []; localPhotos.value = []; selected.value = []; cursor = undefined; void reload() }, { immediate: true })
watch(() => props.localGroupId, (value) => { groupFilter.value = value ?? '' })
watch(visible, () => { selected.value = selected.value.filter((id) => visible.value.some((photo) => photo.id === id)) })
const localChanged = () => { void refreshLocal().catch((reason) => { error.value = message(reason) }) }
window.addEventListener('divvy:photos', localChanged)
onScopeDispose(() => { generation++; clearInterval(timer); window.removeEventListener('divvy:photos', localChanged); if (previewUrl.value) URL.revokeObjectURL(previewUrl.value) })
function toggle(id: string): void { selected.value = selected.value.includes(id) ? selected.value.filter((value) => value !== id) : [...selected.value, id] }
function toggleAll(): void { selected.value = selectedPhotos.value.length === visible.value.length ? [] : visible.value.map((photo) => photo.id) }

async function action(task: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = true; error.value = ''; progress.value = ''
  try { await task(); await refreshLocal() } catch (reason) { error.value = message(reason) }
  finally { busy.value = false }
}
async function connect(): Promise<void> {
  await action(async () => { await connectDrive(); if (!driveConnected.value) return; if (props.group) await registerPhotoMember(props.group.id); await runPhotoBackup(true); await refreshShared() })
}
watch(driveConnected, (connected) => {
  if (connected && props.group && !busy.value) void action(async () => { await registerPhotoMember(props.group!.id); await runPhotoBackup(true); await refreshShared() })
}, { immediate: true })
async function upload(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = [...input.files ?? []]; input.value = ''
  if (!files.length || !auth.uid) return
  if (files.length > MAX_PHOTO_BATCH) { error.value = t('photos.batchLimit'); return }
  const uid = auth.uid
  const group = props.group ?? { id: 'personal', name: t('photos.personal'), startDate: '' }
  await action(async () => {
    await requestPhotoPersistence()
    const failed: string[] = []
    for (const [index, file] of files.entries()) {
      if (auth.uid !== uid) break
      progress.value = `${index + 1} / ${files.length}`
      try {
        const prepared = await preparePhoto(file, group, uid, auth.profile?.nickname ?? '', quality.value)
        const existing = await getLocalPhoto(uid, prepared.id)
        if (!existing) await saveLocalPhoto(prepared)
        if (props.group) await shareLocalPhoto(existing ?? prepared, props.group)
      } catch (reason) { failed.push(`${file.name}: ${message(reason)}`) }
    }
    await refreshShared(); void runPhotoBackup()
    if (failed.length) error.value = failed.join('\n')
  })
}
async function localCopies(photos: PhotoInfo[]): Promise<LocalPhoto[]> {
  if (photos.length > MAX_PHOTO_BATCH || (photos.length > 1 && photos.reduce((sum, photo) => sum + photo.size, 0) > MAX_ARCHIVE_BYTES)) throw new Error('archive-limit')
  const uid = auth.uid!
  const result: LocalPhoto[] = []
  for (const [index, photo] of photos.entries()) {
    progress.value = `${index + 1} / ${photos.length}`
    if (auth.uid !== uid) throw new Error('drive-connect')
    const local = await getLocalPhoto(uid, photo.id)
    if (local) result.push(local)
    else {
      const shared = photo as SharedPhoto
      if (shared.expiresAt <= Date.now()) throw new Error('photo-expired')
      const blob = await readDrivePhoto(shared.driveFileId)
      if (blob.size !== photo.size) throw new Error('drive-file')
      result.push({ ...photoInfo(photo), uid, blob: new Blob([blob], { type: photo.mimeType }), backupId: '', backupRevision: '', sharedFileId: '', sharedUntil: 0, sharedGroupId: '', backupState: 'pending' })
    }
  }
  return result
}
async function saveSelection(): Promise<void> {
  await action(async () => {
    await requestPhotoPersistence()
    for (const [index, photo] of selectedPhotos.value.entries()) { progress.value = `${index + 1} / ${selectedPhotos.value.length}`; await saveSharedPhoto(photo as SharedPhoto, auth.uid!) }
    void runPhotoBackup()
  })
}
async function downloadSelection(): Promise<void> {
  await action(async () => {
    if (selectedPhotos.value.length > MAX_PHOTO_BATCH) throw new Error('archive-limit')
    const photos = await localCopies(selectedPhotos.value)
    if (photos.length === 1) downloadPhotoBlob(photos[0]!.blob, photos[0]!.name)
    else downloadPhotoBlob(await photoArchive(photos), 'Divvy-photos.zip')
    externalDownloads.value = [...new Set([...externalDownloads.value, ...photos.map((photo) => photo.id)])]
  })
}
async function exportSelection(): Promise<void> { await action(async () => { downloadPhotoBlob(await photoArchive(await localCopies(selectedPhotos.value)), 'Divvy-album.zip') }) }
async function importArchive(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]; input.value = ''
  if (!file) return
  await action(async () => { const uid = auth.uid!; const photos = await readPhotoArchive(file, uid); for (const photo of photos) await importLocalPhoto(photo, photo.blob, uid); void runPhotoBackup() })
}
async function editSelection(link: boolean): Promise<void> {
  await action(async () => {
    const item = props.itinerary?.find((item) => item.id === linkId.value)
    for (const photo of selectedPhotos.value) {
      const patch = { date: link ? photo.date : editDate.value, itineraryId: link ? item?.id ?? '' : photo.itineraryId, itineraryTitle: link ? item?.title ?? '' : photo.itineraryTitle }
      if (props.group) await editSharedPhoto(photo as SharedPhoto, patch)
      else await editLocalPhoto(auth.uid!, photo.id, patch)
    }
    await refreshShared(); void runPhotoBackup()
  })
}
async function removeSelection(): Promise<void> {
  if (!manageable.value || !await confirm({ title: t('photos.deleteTitle'), message: t(props.group ? 'photos.deleteSharedHint' : removeBackup.value ? 'photos.deleteBothHint' : 'photos.deleteLocalHint'), confirmLabel: t('common.delete'), tone: 'danger' })) return
  await action(async () => {
    for (const photo of selectedPhotos.value) {
      if (props.group) await deleteSharedPhoto(photo as SharedPhoto)
      else {
        const local = photo as LocalPhoto
        if (removeBackup.value && local.backupId) await removeDriveFile(local.backupId)
        await deleteLocalPhoto(auth.uid!, photo.id)
      }
    }
    selected.value = []; await refreshShared()
  })
}
async function openPreview(photo: PhotoInfo): Promise<void> {
  await action(async () => {
    const [local] = await localCopies([photo])
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = URL.createObjectURL(local!.blob); preview.value = photo
  })
}
async function readBackups(append = false): Promise<void> {
  await action(async () => { const page = await driveFiles('backup', append ? backupCursor.value : ''); backups.value = append ? [...backups.value, ...page.files] : page.files; backupCursor.value = page.nextPageToken ?? '' })
}
async function restoreBackups(): Promise<void> {
  await action(async () => {
    const uid = auth.uid!
    for (const [index, id] of backupSelection.value.entries()) {
      progress.value = `${index + 1} / ${backupSelection.value.length}`
      for (const photo of await restoreDriveBackup(id, uid)) {
        if (!await getLocalPhoto(uid, photo.id)) await saveLocalPhoto({ ...photo, backupRevision: photoRevision(photo), backupState: 'done' })
      }
    }
    backupSelection.value = []
  })
}
</script>

<template>
  <div class="space-y-4 px-4 py-5">
    <section class="space-y-3 rounded-card border border-border bg-surface p-4">
      <h2 class="text-sm font-semibold">{{ t(group ? 'photos.sharing' : 'photos.localTitle') }}</h2>
      <p class="text-xs leading-relaxed text-muted">{{ t(group ? 'photos.sharingHint' : 'photos.localHint') }}</p>
      <p class="text-xs leading-relaxed text-muted">{{ t('photos.driveHint') }}</p>
      <div class="flex flex-wrap gap-2">
        <AppButton v-if="!driveConnected" variant="secondary" :disabled="busy" @click="connect">{{ t('photos.connect') }}</AppButton>
        <template v-else><AppButton variant="secondary" :disabled="busy || photoBackupBusy" @click="runPhotoBackup(true)">{{ t('photos.retryBackup') }}</AppButton><AppButton variant="ghost" :disabled="busy || photoBackupBusy" @click="disconnectDrive">{{ t('photos.disconnect') }}</AppButton></template>
        <RouterLink v-if="group" :to="{ name: 'photos', query: { group: group.id } }" class="self-center text-xs text-accent">{{ t('photos.mine') }}</RouterLink>
      </div>
      <p v-if="photoBackupBusy" role="status" class="text-xs text-accent">{{ t('photos.backingUp') }}</p>
      <p v-if="photoBackupError" role="alert" class="text-xs text-negative">{{ message(new Error(photoBackupError)) }}</p>
      <p v-if="!group" class="tabular text-xs text-muted">{{ t('photos.storage', { used: (storage.used / 1048576).toFixed(1), quota: (storage.quota / 1048576).toFixed(0) }) }} · {{ t(storage.persistent ? 'photos.persistent' : 'photos.notPersistent') }}</p>
      <div class="flex flex-wrap items-center gap-2">
        <label class="text-xs text-muted">{{ t('photos.quality') }} <select v-model="quality" class="rounded-lg border border-border bg-surface p-2 text-fg"><option value="standard">{{ t('photos.standard') }}</option><option value="original">{{ t('photos.original') }}</option></select></label>
        <AppButton :disabled="busy || (group && !driveConnected)" @click="uploadInput?.click()">{{ t(group ? 'photos.upload' : 'photos.addLocal') }}</AppButton>
      </div>
      <p class="text-xs text-muted">{{ t('photos.limits') }}</p>
      <input ref="uploadInput" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif" multiple class="hidden" @change="upload" />
      <template v-if="!group">
        <input ref="importInput" type="file" accept="application/zip,.zip" class="hidden" @change="importArchive" />
        <div class="flex flex-wrap gap-2"><AppButton variant="secondary" :disabled="busy" @click="importInput?.click()">{{ t('photos.import') }}</AppButton><AppButton v-if="driveConnected" variant="secondary" :disabled="busy" @click="readBackups()">{{ t('photos.driveRestore') }}</AppButton></div>
      </template>
    </section>
    <section v-if="backups.length" class="space-y-2 rounded-xl border border-border p-3">
      <h3 class="text-sm font-medium">{{ t('photos.driveRestore') }}</h3>
      <button type="button" class="text-xs text-accent" @click="backupSelection = backupSelection.length === backups.length ? [] : backups.map(file => file.id)">{{ t(backupSelection.length === backups.length ? 'photos.clearSelection' : 'photos.selectAll') }}</button>
      <label v-for="file in backups" :key="file.id" class="flex items-center gap-2 text-xs"><input v-model="backupSelection" type="checkbox" :value="file.id" class="accent-accent" /><span class="truncate">{{ file.name }}</span></label>
      <AppButton :disabled="busy || !backupSelection.length" @click="restoreBackups">{{ t('photos.restoreSelected') }}</AppButton>
      <AppButton v-if="backupCursor" variant="secondary" :disabled="busy" @click="readBackups(true)">{{ t('photos.more') }}</AppButton>
    </section>
    <div class="flex flex-wrap items-center gap-3 text-xs">
      <select v-if="!group" v-model="groupFilter" :aria-label="t('photos.groupFilter')" class="max-w-full rounded-lg border border-border bg-surface p-2"><option value="">{{ t('photos.allGroups') }}</option><option v-for="[id, name] in albumGroups" :key="id" :value="id">{{ name }}</option></select>
      <label>{{ t('photos.date') }} <input v-model="dateFilter" type="date" class="rounded-lg border border-border bg-surface p-2" /></label>
      <button v-if="dateFilter" type="button" class="text-accent" @click="dateFilter = ''">{{ t('photos.clearDate') }}</button>
      <label v-if="group" class="flex items-center gap-2"><input v-model="onlyMissing" type="checkbox" class="accent-accent" />{{ t('photos.onlyMissing') }}</label>
      <button type="button" :disabled="busy" class="font-medium text-accent" @click="toggleAll">{{ t(selectedPhotos.length === visible.length && visible.length ? 'photos.clearSelection' : 'photos.selectAll') }}</button>
      <button type="button" :disabled="busy" class="text-accent" @click="reload">{{ t('photos.refresh') }}</button>
      <AppButton v-if="group && driveConnected" variant="ghost" :disabled="busy" @click="action(async () => { await authorizeSharedPhotos() })">{{ t('photos.authorize') }}</AppButton>
    </div>
    <section v-if="selectedPhotos.length" class="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
      <p class="text-xs font-medium">{{ t('photos.selected', { count: selectedPhotos.length }) }}</p>
      <div class="flex flex-wrap gap-2">
        <AppButton v-if="group" :disabled="busy" @click="saveSelection">{{ t('photos.saveLocal') }}</AppButton>
        <AppButton variant="secondary" :disabled="busy" @click="downloadSelection">{{ t('photos.download') }}</AppButton>
        <AppButton v-if="!group" variant="secondary" :disabled="busy" @click="exportSelection">{{ t('photos.export') }}</AppButton>
      </div>
      <template v-if="manageable">
        <div class="flex flex-wrap items-center gap-2 text-xs"><input v-model="editDate" type="date" :aria-label="t('photos.date')" class="rounded-lg border border-border bg-surface p-2" /><AppButton variant="secondary" :disabled="busy || !validPhotoDate(editDate)" @click="editSelection(false)">{{ t('photos.correctDate') }}</AppButton></div>
        <div v-if="group && itinerary" class="flex flex-wrap gap-2"><select v-model="linkId" :aria-label="t('photos.link')" class="min-w-0 max-w-full rounded-lg border border-border bg-surface p-2 text-xs"><option value="">{{ t('photos.noItinerary') }}</option><option v-for="item in itinerary" :key="item.id" :value="item.id">{{ item.date }} · {{ item.title }}</option></select><AppButton variant="secondary" :disabled="busy" @click="editSelection(true)">{{ t('photos.link') }}</AppButton></div>
        <label v-if="!group" class="flex items-center gap-2 text-xs"><input v-model="removeBackup" type="checkbox" class="accent-accent" />{{ t('photos.removeBackup') }}</label>
        <AppButton variant="danger" :disabled="busy || photoBackupBusy || (!group && removeBackup && !driveConnected)" @click="removeSelection">{{ t('common.delete') }}</AppButton>
      </template>
      <p v-else class="text-xs text-muted">{{ t('photos.ownerOnly') }}</p>
    </section>
    <p v-if="busy || loading" role="status" class="text-sm text-muted">{{ t('common.loading') }} {{ progress }}</p>
    <p v-if="error" role="alert" class="whitespace-pre-wrap text-xs text-negative">{{ error }}</p>
    <p v-if="!loading && !visible.length" class="py-8 text-center text-sm text-muted">{{ t('photos.empty') }}</p>
    <section v-for="section in sections" :key="section.key" class="space-y-2">
      <h3 class="text-sm font-semibold">{{ !group ? `${section.name} · ` : '' }}{{ section.day ? `${t('photos.day', { day: section.day })} · ` : '' }}{{ section.date }}</h3>
      <div class="grid grid-cols-2 gap-3">
        <PhotoTile v-for="photo in section.photos" :key="photo.id" :photo="photo" :saved-blob="savedBlobs.get(photo.id)" :thumbnail-id="(photo as SharedPhoto).thumbnailId" :selected="selected.includes(photo.id)" :saved="saved.has(photo.id)" :saved-label="t('photos.savedLocal')" :missing-label="t('photos.notSaved')" @select="toggle(photo.id)" @preview="openPreview(photo)">
          <div class="space-y-1 px-2 pb-2 text-[11px] text-muted">
            <p>{{ t(`photos.${photo.quality}`) }} · {{ (photo.size / 1048576).toFixed(1) }} MB</p>
            <p v-if="photo.itineraryTitle" class="truncate">{{ photo.itineraryTitle }}</p>
            <p v-if="group" :class="daysUntilExpiry((photo as SharedPhoto).expiresAt, clock) <= 7 ? 'text-negative' : ''">{{ t('photos.expiry', { days: daysUntilExpiry((photo as SharedPhoto).expiresAt, clock) }) }}</p>
            <p v-else>{{ t(`photos.backup.${(photo as LocalPhoto).backupState}`) }}</p>
            <p v-if="externalDownloads.includes(photo.id)">{{ t('photos.downloadRequested') }}</p>
          </div>
        </PhotoTile>
      </div>
    </section>
    <AppButton v-if="more" variant="secondary" block :disabled="busy || loading" @click="action(async () => { await refreshShared(true) })">{{ t('photos.more') }}</AppButton>
    <AppSheet :open="!!preview" :title="preview?.name" @close="preview = null"><img v-if="preview" :src="previewUrl" :alt="preview.name" class="max-h-[65vh] w-full rounded-xl object-contain" /><p class="mt-2 text-xs text-muted">{{ t('photos.previewHint') }}</p></AppSheet>
  </div>
</template>
