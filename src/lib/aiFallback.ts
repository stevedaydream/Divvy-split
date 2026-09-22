import { app } from '@/lib/firebase'
import { GEMINI_MODEL, type AiImage } from '@/lib/gemini'

/**
 * Divvy's own Gemini access through Firebase AI Logic, used only as a
 * stand-in: when a user's key runs out of quota mid-request, this finishes
 * that one request and then steps aside until the user's quota resets (D18).
 *
 * Firebase AI Logic enforces App Check, so the fallback exists only when a
 * reCAPTCHA Enterprise site key is configured. Both SDKs load on first use.
 */

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY ?? ''

export function isFallbackConfigured(): boolean {
  return SITE_KEY.length > 0
}

let modelPromise: Promise<import('firebase/ai').GenerativeModel> | null = null

async function loadModel() {
  const [{ initializeAppCheck, ReCaptchaEnterpriseProvider }, { getAI, getGenerativeModel, GoogleAIBackend }] =
    await Promise.all([import('firebase/app-check'), import('firebase/ai')])

  // Local development has no reCAPTCHA-verified origin; the SDK then prints a
  // debug token to register in the Firebase console.
  if (import.meta.env.DEV) {
    ;(self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(SITE_KEY), isTokenAutoRefreshEnabled: true })

  const ai = getAI(app, { backend: new GoogleAIBackend() })
  return getGenerativeModel(ai, {
    model: GEMINI_MODEL,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
  })
}

/** Runs one prompt on Divvy's quota. Throws if unconfigured or it fails too. */
export async function askFallback(prompt: string, images: AiImage[] = []): Promise<string> {
  if (!isFallbackConfigured()) throw new Error('fallback-unconfigured')
  modelPromise ??= loadModel().catch((cause) => {
    modelPromise = null
    throw cause
  })
  const model = await modelPromise
  const result = await model.generateContent([
    prompt,
    ...images.map((image) => ({ inlineData: { mimeType: image.mimeType, data: image.data } })),
  ])
  const text = result.response.text()
  if (!text) throw new Error('fallback-empty')
  return text
}
