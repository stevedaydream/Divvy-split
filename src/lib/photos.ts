import type { LocalPhoto, PhotoInfo } from '@/types/photos'

export const PHOTO_LIFETIME = 30 * 86400000
export const MAX_PHOTO_BYTES = 25 * 1024 * 1024
export const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024
export const MAX_PHOTO_BATCH = 50
export const MAX_SHARED_PHOTOS = 500

export function validPhotoDate(date: unknown): date is string {
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
    && !Number.isNaN(Date.parse(date)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
}

export function photoInfo(photo: PhotoInfo): PhotoInfo {
  const { id, groupId, groupName, tripStart, name, mimeType, size, date, itineraryId, itineraryTitle, quality, uploaderId, uploaderName, createdAt } = photo
  return { id, groupId, groupName, tripStart, name, mimeType, size, date, itineraryId, itineraryTitle, quality, uploaderId, uploaderName, createdAt }
}

export function photoRevision(photo: PhotoInfo): string {
  return JSON.stringify(photoInfo(photo))
}

export function daysUntilExpiry(expiresAt: number, now = Date.now()): number {
  return Math.max(0, Math.ceil((expiresAt - now) / 86400000))
}

export function tripPhotoDay(start: string, date: string): number | null {
  if (!validPhotoDate(start) || !validPhotoDate(date)) return null
  const day = Math.round((Date.parse(date) - Date.parse(start)) / 86400000) + 1
  return day > 0 ? day : null
}

export function photoSections<T extends PhotoInfo>(photos: T[]): { key: string; groupId: string; name: string; date: string; day: number | null; photos: T[] }[] {
  const sections = new Map<string, ReturnType<typeof photoSections<T>>[number]>()
  for (const photo of [...photos].sort((a, b) => a.groupName.localeCompare(b.groupName) || a.date.localeCompare(b.date) || a.createdAt - b.createdAt)) {
    const key = `${photo.groupId}/${photo.date}`
    if (!sections.has(key)) sections.set(key, { key, groupId: photo.groupId, name: photo.groupName, date: photo.date, day: tripPhotoDay(photo.tripStart, photo.date), photos: [] })
    sections.get(key)!.photos.push(photo)
  }
  return [...sections.values()]
}

export function safePhotoPath(photo: PhotoInfo): string {
  const clean = (value: string) => value.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '_').slice(0, 90) || '_'
  return `${clean(photo.groupName)}_${clean(photo.groupId)}/${photo.date}/${clean(photo.id)}_${clean(photo.name)}`
}

export function validatePhotoInfo(value: unknown): value is PhotoInfo {
  if (!value || typeof value !== 'object') return false
  const p = value as PhotoInfo
  return ['id', 'groupId', 'groupName', 'tripStart', 'name', 'mimeType', 'date', 'itineraryId', 'itineraryTitle', 'uploaderId', 'uploaderName'].every((key) => typeof (p as unknown as Record<string, unknown>)[key] === 'string' && String((p as unknown as Record<string, unknown>)[key]).length <= 200)
    && /^[a-zA-Z0-9_-]{1,100}$/.test(p.id) && !!p.groupId && !!p.groupName && !!p.name
    && ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif'].includes(p.mimeType)
    && validPhotoDate(p.date) && (p.tripStart === '' || validPhotoDate(p.tripStart))
    && ['standard', 'original'].includes(p.quality) && Number.isSafeInteger(p.size) && p.size > 0 && p.size <= MAX_PHOTO_BYTES
    && Number.isSafeInteger(p.createdAt) && p.createdAt > 0
}

export function restorePhoto(info: PhotoInfo, blob: Blob, uid: string): LocalPhoto {
  if (!validatePhotoInfo(info) || blob.size !== info.size) throw new Error('invalid-archive')
  return { ...photoInfo(info), uid, blob, backupId: '', backupRevision: '', sharedFileId: '', sharedUntil: 0, sharedGroupId: '', backupState: 'pending' }
}
