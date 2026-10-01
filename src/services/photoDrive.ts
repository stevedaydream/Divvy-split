import { ref } from 'vue'
import { GoogleAuthProvider, onAuthStateChanged, reauthenticateWithPopup, reauthenticateWithRedirect, type UserCredential } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { isStandalone } from '@/lib/browserEnv'
import type { LocalPhoto } from '@/types/photos'
import { photoArchive, readPhotoArchive } from '@/services/photoFiles'

export const driveConnected = ref(false)
let token = ''
let tokenUid = ''
let validUntil = 0
let folderId = ''
onAuthStateChanged(auth, (user) => { if (user?.uid !== tokenUid) disconnectDrive() })

export function disconnectDrive(): void { token = ''; tokenUid = ''; validUntil = 0; folderId = ''; driveConnected.value = false }
function acceptDriveCredential(result: UserCredential): void {
  const credential = GoogleAuthProvider.credentialFromResult(result)
  if (!credential?.accessToken || result.user.uid !== auth.currentUser?.uid) throw new Error('drive-connect')
  token = credential.accessToken; tokenUid = result.user.uid; validUntil = Date.now() + 45 * 60000; driveConnected.value = true
}
export function acceptDriveRedirect(result: UserCredential | null): void {
  const uid = sessionStorage.getItem('divvy-drive-connect')
  sessionStorage.removeItem('divvy-drive-connect')
  if (result && result.operationType === 'reauthenticate' && result.user.uid === uid) acceptDriveCredential(result)
}
export async function connectDrive(): Promise<void> {
  if (!auth.currentUser) throw new Error('drive-connect')
  const provider = new GoogleAuthProvider()
  provider.addScope('https://www.googleapis.com/auth/drive.file')
  if (isStandalone()) {
    sessionStorage.setItem('divvy-drive-connect', auth.currentUser.uid)
    await reauthenticateWithRedirect(auth.currentUser, provider)
    return
  }
  acceptDriveCredential(await reauthenticateWithPopup(auth.currentUser, provider))
}

function driveToken(): string {
  if (!token || auth.currentUser?.uid !== tokenUid || Date.now() >= validUntil) { disconnectDrive(); throw new Error('drive-connect') }
  return token
}
function fileId(id: string): string { if (!/^[a-zA-Z0-9_-]{1,200}$/.test(id)) throw new Error('drive-file'); return encodeURIComponent(id) }

export async function driveRequest(path: string, init: RequestInit = {}, upload = false): Promise<Response> {
  const currentUid = auth.currentUser?.uid
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${driveToken()}`)
  const response = await fetch(`https://www.googleapis.com/${upload ? 'upload/' : ''}drive/v3/${path}`, { ...init, headers })
  if (auth.currentUser?.uid !== currentUid) throw new Error('drive-connect')
  if (!response.ok) {
    if (response.status === 401) { disconnectDrive(); throw new Error('drive-connect') }
    const data = await response.json().catch(() => ({}))
    const reason = data?.error?.errors?.[0]?.reason
    if (reason === 'storageQuotaExceeded') throw new Error('drive-full')
    if (response.status === 404) throw new Error('drive-file')
    if (response.status === 403) throw new Error('drive-access')
    throw new Error('drive-failed')
  }
  return response
}

export async function driveFiles(kind: 'backup' | 'shared', pageToken = ''): Promise<{ files: { id: string; name: string; appProperties?: Record<string, string> }[]; nextPageToken?: string }> {
  const q = `trashed=false and 'me' in owners and appProperties has { key='divvyKind' and value='${kind}' }`
  return (await driveRequest(`files?${new URLSearchParams({ q, fields: 'nextPageToken,files(id,name,appProperties)', pageSize: '50', ...(pageToken ? { pageToken } : {}) })}`)).json()
}

async function backupFolder(): Promise<string> {
  if (folderId) return folderId
  const q = "trashed=false and 'me' in owners and mimeType='application/vnd.google-apps.folder' and appProperties has { key='divvyKind' and value='albumFolder' }"
  const data = await (await driveRequest(`files?${new URLSearchParams({ q, fields: 'files(id)', pageSize: '1' })}`)).json()
  const candidate = data.files?.[0]?.id
  if (candidate) {
    const permissions = await (await driveRequest(`files/${fileId(candidate)}/permissions?fields=permissions(role)&pageSize=100`)).json()
    if (permissions.permissions?.length === 1 && permissions.permissions[0].role === 'owner') folderId = candidate
  }
  if (!folderId) folderId = (await (await driveRequest('files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Divvy 相簿', mimeType: 'application/vnd.google-apps.folder', appProperties: { divvyKind: 'albumFolder' } }) })).json()).id
  return folderId
}

export async function uploadDrivePhoto(blob: Blob, name: string, properties: Record<string, string>, existingId = ''): Promise<string> {
  const boundary = `divvy_${crypto.randomUUID()}`
  const metadata = { name, mimeType: blob.type, appProperties: properties, ...(!existingId ? { parents: [await backupFolder()] } : {}) }
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${blob.type}\r\n\r\n`, blob, `\r\n--${boundary}--`])
  const response = await driveRequest(`files${existingId ? `/${fileId(existingId)}` : ''}?uploadType=multipart&fields=id`, { method: existingId ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body }, true)
  return (await response.json()).id
}

export async function readDrivePhoto(id: string, limit = 25 * 1024 * 1024): Promise<Blob> {
  const response = await driveRequest(`files/${fileId(id)}?alt=media`)
  if (Number(response.headers.get('Content-Length')) > limit) { await response.body?.cancel(); throw new Error('archive-limit') }
  if (!response.body) return response.blob()
  const reader = response.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) { await reader.cancel(); throw new Error('archive-limit') }
    chunks.push(new Uint8Array(value))
  }
  return new Blob(chunks, { type: response.headers.get('Content-Type') ?? 'application/octet-stream' })
}
export async function removeDriveFile(id: string): Promise<void> {
  try { await driveRequest(`files/${fileId(id)}`, { method: 'DELETE' }) } catch (error) { if ((error as Error).message !== 'drive-file') throw error }
}

export async function shareDrivePhoto(id: string, email: string, expiresAt: number): Promise<void> {
  const permissions = await (await driveRequest(`files/${fileId(id)}/permissions?fields=permissions(id,emailAddress,role)&pageSize=100`)).json() as { permissions: { id: string; emailAddress?: string; role: string }[] }
  if (permissions.permissions.some((p) => p.emailAddress?.toLowerCase() === email.toLowerCase())) return
  const body = { type: 'user', role: 'reader', emailAddress: email, expirationTime: new Date(expiresAt).toISOString() }
  // 部分個人帳號不支援到期權限；仍保持指定帳號私密分享，由下次連線清理檔案。
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId(id)}/permissions?sendNotificationEmail=false`, { method: 'POST', headers: { Authorization: `Bearer ${driveToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    if (response.status === 400 && /expir/i.test(data.error?.message ?? '')) {
      await driveRequest(`files/${fileId(id)}/permissions?sendNotificationEmail=false`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'user', role: 'reader', emailAddress: email }) })
    } else {
      if (response.status === 401) disconnectDrive()
      throw new Error(response.status === 401 ? 'drive-connect' : 'drive-access')
    }
  }
}

export async function backupPhoto(photo: LocalPhoto): Promise<string> {
  let existing = photo.backupId
  if (!existing) {
    const q = `trashed=false and appProperties has { key='divvyPhoto' and value='${photo.id}' } and appProperties has { key='divvyKind' and value='backup' }`
    existing = (await (await driveRequest(`files?${new URLSearchParams({ q, fields: 'files(id)', pageSize: '1' })}`)).json()).files?.[0]?.id ?? ''
  }
  return uploadDrivePhoto(await photoArchive([photo]), `${photo.groupName.slice(0, 80)}_${photo.id}.zip`, { divvyKind: 'backup', divvyPhoto: photo.id }, existing)
}
export async function restoreDriveBackup(id: string, uid: string): Promise<LocalPhoto[]> {
  const photos = await readPhotoArchive(await readDrivePhoto(id, 101 * 1024 * 1024), uid)
  return photos.map((photo) => ({ ...photo, backupId: id }))
}

interface PickerView { setMimeTypes(value: string): PickerView; setQuery(value: string): PickerView }
interface PickerBuilder { addView(view: PickerView): PickerBuilder; setOAuthToken(token: string): PickerBuilder; setDeveloperKey(key: string): PickerBuilder; setAppId(id: string): PickerBuilder; setOrigin(origin: string): PickerBuilder; enableFeature(feature: string): PickerBuilder; setCallback(callback: (data: { action: string; docs?: { id: string }[] }) => void): PickerBuilder; build(): { setVisible(value: boolean): void } }
interface PickerApi { DocsView: new () => PickerView; PickerBuilder: new () => PickerBuilder; Feature: { MULTISELECT_ENABLED: string } }
let loadingPicker: Promise<PickerApi> | undefined
async function pickerApi(): Promise<PickerApi> {
  loadingPicker ??= new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { loadingPicker = undefined; reject(new Error('drive-picker')) }, 20000)
    const script = document.createElement('script')
    script.src = 'https://apis.google.com/js/api.js'
    script.onerror = () => { clearTimeout(timeout); loadingPicker = undefined; reject(new Error('drive-picker')) }
    script.onload = () => {
      const googleWindow = window as unknown as { gapi: { load(name: string, callback: () => void): void }; google: { picker: PickerApi } }
      googleWindow.gapi.load('picker', () => { clearTimeout(timeout); resolve(googleWindow.google.picker) })
    }
    document.head.append(script)
  })
  return loadingPicker
}
export async function authorizeSharedPhotos(): Promise<string[]> {
  const picker = await pickerApi()
  return new Promise((resolve) => {
    new picker.PickerBuilder().addView(new picker.DocsView().setMimeTypes('image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif'))
      .setOAuthToken(driveToken()).setDeveloperKey(import.meta.env.VITE_FIREBASE_API_KEY).setAppId(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID)
      .setOrigin(location.origin).enableFeature(picker.Feature.MULTISELECT_ENABLED).setCallback((data) => {
        if (data.action === 'picked') { window.dispatchEvent(new Event('divvy:drive-access')); resolve(data.docs?.map((doc) => doc.id) ?? []) }
        if (data.action === 'cancel') resolve([])
      }).build().setVisible(true)
  })
}
