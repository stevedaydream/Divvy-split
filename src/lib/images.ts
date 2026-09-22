import type { AiImage } from '@/lib/gemini'

/**
 * Prepares a photo or screenshot for the AI: scaled to at most `maxSide`
 * pixels and re-encoded as JPEG, which keeps printed text legible while
 * cutting a phone screenshot from megabytes to a couple of hundred KB.
 */
export async function toAiImage(file: File, maxSide = 1600): Promise<AiImage> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas-unavailable')
  // JPEG has no alpha; paint white first so transparent PNGs stay readable.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return { mimeType: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1) }
}
