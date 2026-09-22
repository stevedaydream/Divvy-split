/**
 * Arrival QR codes (e.g. Visit Japan Web immigration and customs).
 *
 * Kept on this device only: they are personal documents, and they must open
 * at the airport where there is often no signal. Stored per group so each
 * trip has its own pair.
 */

export type QrSlot = 'immigration' | 'customs'
export type QrImages = Partial<Record<QrSlot, string>>

const key = (groupId: string) => `divvy:entry-qr:${groupId}`

export function readQrImages(groupId: string): QrImages {
  try {
    const parsed = JSON.parse(localStorage.getItem(key(groupId)) ?? '{}') as QrImages
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

/** Returns false when the device refused to store it (quota, private mode). */
export function writeQrImages(groupId: string, images: QrImages): boolean {
  try {
    if (Object.keys(images).length) localStorage.setItem(key(groupId), JSON.stringify(images))
    else localStorage.removeItem(key(groupId))
    return true
  } catch {
    return false
  }
}

/**
 * Shrinks a screenshot to at most `maxSide` pixels and re-encodes it as PNG.
 * PNG rather than JPEG: compression artefacts can make a QR code unreadable.
 */
export async function shrinkImage(file: File, maxSide = 900): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas-unavailable')
  ctx.imageSmoothingEnabled = scale < 1
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/png')
}
