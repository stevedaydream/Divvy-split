/**
 * Minimal Gemini client for the AI trip guide.
 *
 * Each person brings their own API key, kept on this device only (D16):
 * there is no server to hide a shared key behind without leaving the free
 * Firebase plan, and a key in the bundle or in Firestore would be public.
 */

/** Stable Flash model; see https://ai.google.dev/gemini-api/docs/models */
export const GEMINI_MODEL = 'gemini-3.6-flash'

const KEY_STORAGE = 'divvy:gemini-key'

export function readGeminiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function writeGeminiKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim())
    else localStorage.removeItem(KEY_STORAGE)
  } catch { /* the key then lasts for this session only */ }
}

export type GeminiError = 'invalid-key' | 'quota' | 'blocked' | 'failed'

export class GeminiRequestError extends Error {
  constructor(readonly reason: GeminiError) {
    super(reason)
  }
}

/** Sends one prompt and returns the model's text, which should be JSON. */
export async function askGemini(apiKey: string, prompt: string, signal?: AbortSignal): Promise<string> {
  let response: Response
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        // The key goes in a header, not the URL, so it stays out of logs.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
        }),
        signal,
      },
    )
  } catch (cause) {
    if ((cause as Error).name === 'AbortError') throw cause
    throw new GeminiRequestError('failed')
  }

  if (response.status === 400 || response.status === 401 || response.status === 403) {
    throw new GeminiRequestError('invalid-key')
  }
  if (response.status === 429) throw new GeminiRequestError('quota')
  if (!response.ok) throw new GeminiRequestError('failed')

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
    promptFeedback?: { blockReason?: string }
  }
  if (data.promptFeedback?.blockReason) throw new GeminiRequestError('blocked')
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  if (!text) throw new GeminiRequestError('failed')
  return text
}
