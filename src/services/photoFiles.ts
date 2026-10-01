import { parse } from 'exifr'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { MAX_ARCHIVE_BYTES, MAX_PHOTO_BATCH, MAX_PHOTO_BYTES, photoInfo, restorePhoto, safePhotoPath, validatePhotoInfo, validPhotoDate } from '@/lib/photos'
import { todayIso } from '@/lib/dates'
import type { Group } from '@/types/models'
import type { LocalPhoto, PhotoInfo, PhotoQuality } from '@/types/photos'

export async function preparePhoto(file: File, group: Pick<Group, 'id' | 'name' | 'startDate'>, uid: string, nickname: string, quality: PhotoQuality): Promise<LocalPhoto> {
  if (!file.size || file.size > MAX_PHOTO_BYTES) throw new Error('photo-too-large')
  const mime = file.type || (/\.hei[cf]$/i.test(file.name) ? 'image/heic' : '')
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif'].includes(mime)) throw new Error('photo-format')
  let date = todayIso()
  try {
    const tags = await parse(file, { pick: ['DateTimeOriginal', 'CreateDate'], reviveValues: false })
    const raw = tags?.DateTimeOriginal ?? tags?.CreateDate
    if (typeof raw === 'string' && /^\d{4}:\d{2}:\d{2}/.test(raw)) date = raw.slice(0, 10).replace(/:/g, '-')
    else if (raw instanceof Date && !Number.isNaN(raw.getTime())) date = `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`
    if (!validPhotoDate(date)) date = todayIso()
  } catch { /* 缺少拍攝資訊時使用上傳日期。 */ }
  let blob: Blob = file
  let name = file.name.slice(0, 200)
  if (quality === 'standard') {
    let bitmap: ImageBitmap
    try { bitmap = await createImageBitmap(file) } catch { throw new Error('photo-format') }
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close(); throw new Error('canvas-unavailable') }
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close()
    blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((data) => data ? resolve(data) : reject(new Error('photo-format')), 'image/jpeg', 0.85))
    name = file.name.replace(/\.[^.]+$/, '').slice(0, 195) + '.jpg'
  }
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  const id = Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('')
  const scopedHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${uid}/${group.id}/${id}/${quality}`))
  const scopedId = Array.from(new Uint8Array(scopedHash), (b) => b.toString(16).padStart(2, '0')).join('')
  return restorePhoto({ id: scopedId, groupId: group.id, groupName: group.name, tripStart: group.startDate, name, mimeType: quality === 'standard' ? 'image/jpeg' : mime,
    size: blob.size, date, itineraryId: '', itineraryTitle: '', quality, uploaderId: uid, uploaderName: nickname, createdAt: Date.now() }, blob, uid)
}

export async function photoArchive(photos: LocalPhoto[]): Promise<Blob> {
  if (!photos.length || photos.length > MAX_PHOTO_BATCH || photos.reduce((sum, photo) => sum + photo.size, 0) > MAX_ARCHIVE_BYTES) throw new Error('archive-limit')
  const files: Record<string, Uint8Array> = {}
  const manifest = []
  for (const photo of photos) {
    const path = safePhotoPath(photo)
    files[path] = new Uint8Array(await photo.blob.arrayBuffer())
    manifest.push({ photo: photoInfo(photo), path })
  }
  files['divvy-album.json'] = strToU8(JSON.stringify({ version: 1, photos: manifest }))
  return new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
}

export async function photoThumbnail(blob: Blob): Promise<Blob | null> {
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(blob) } catch { return null }
  const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) { bitmap.close(); return null }
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close()
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.75))
}

export async function readPhotoArchive(blob: Blob, uid: string): Promise<LocalPhoto[]> {
  if (blob.size > MAX_ARCHIVE_BYTES + 1024 * 1024) throw new Error('archive-limit')
  let size = 0
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()), { filter: (file) => {
    size += file.originalSize
    if (size > MAX_ARCHIVE_BYTES + 1024 * 1024 || file.originalSize > MAX_PHOTO_BYTES + 1024 * 1024) throw new Error('archive-limit')
    return true
  } })
  const manifest = files['divvy-album.json']
  if (!manifest || manifest.length > 1024 * 1024) throw new Error('invalid-archive')
  const data = JSON.parse(strFromU8(manifest)) as { version: number; photos: { photo: PhotoInfo; path: string }[] }
  if (data.version !== 1 || !Array.isArray(data.photos) || data.photos.length > MAX_PHOTO_BATCH) throw new Error('invalid-archive')
  const ids = new Set<string>()
  return data.photos.map(({ photo, path }) => {
    if (!validatePhotoInfo(photo) || path !== safePhotoPath(photo) || !files[path] || ids.has(photo.id)) throw new Error('invalid-archive')
    ids.add(photo.id)
    return restorePhoto(photo, new Blob([files[path] as Uint8Array<ArrayBuffer>], { type: photo.mimeType }), uid)
  })
}

export function downloadPhotoBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
