import { isCategory } from '@/data/categories'
import { isIsoDate } from '@/lib/dates'
import { hasTripDates } from '@/lib/itinerary'
import { toMajor, toMinor } from '@/lib/money'
import type { ItineraryDraft } from '@/services/itinerary'
import type { ItineraryItem, ItineraryKind } from '@/types/models'

/**
 * Prompts for the AI trip guide and strict validation of what comes back.
 * The model's JSON is untrusted input: every field is checked and clamped
 * before it can become an itinerary item, and anything malformed is dropped.
 */

export type AiStyle = 'packed' | 'balanced' | 'relaxed'

export interface TripContext {
  /** Human-readable destination, e.g. "石垣島, 日本". */
  destination: string
  startDate: string
  endDate: string
  /** Group currency; estimates are asked for in it. */
  currency: string
  /** UI language for the generated titles and notes. */
  language: string
}

const ITEM_SHAPE = `{"kind":"spot|flight|lodging","date":"YYYY-MM-DD","time":"HH:MM or empty","endDate":"YYYY-MM-DD for lodging check-out, else empty","title":"short name","place":"searchable place name for Google Maps","note":"one short practical tip","estimate":number,"category":"food|transport|lodging|shopping|fun|other"}`

function tripLines(trip: TripContext): string {
  return [
    `Destination: ${trip.destination || 'not specified'}`,
    hasTripDates(trip.startDate, trip.endDate)
      ? `Trip dates: ${trip.startDate} to ${trip.endDate} (inclusive)`
      : 'Trip dates: not set',
    `Currency for estimates: ${trip.currency} (per group total, a plain number, 0 if unknown)`,
    `Write titles and notes in: ${trip.language}`,
  ].join('\n')
}

export function planPrompt(trip: TripContext, style: AiStyle, themes: string[], extra: string): string {
  return `You are a travel planner. Build a day-by-day itinerary.
${tripLines(trip)}
Pace: ${style} (packed = many stops, relaxed = few).
Interests: ${themes.length ? themes.join(', ') : 'general sightseeing'}
Extra requests: ${extra.trim() || 'none'}

Only use dates inside the trip. Include meals. Do not invent flight numbers or hotel bookings.
Reply with JSON only: {"items":[${ITEM_SHAPE}]}`
}

export function adjustPrompt(trip: TripContext, items: ItineraryItem[], instruction: string): string {
  const current = items.map((i) => ({
    id: i.id, kind: i.kind, date: i.date, time: i.time, title: i.title, estimate: toMajor(i.estimateMinor, trip.currency),
  }))
  return `You are a travel planner editing an existing itinerary.
${tripLines(trip)}
Current items: ${JSON.stringify(current)}
Request: ${instruction.trim()}

Change only what the request needs. To change an item, remove it by id and add the new version.
Reply with JSON only: {"summary":"one sentence","remove":["id"],"add":[${ITEM_SHAPE}]}`
}

export function parsePrompt(trip: TripContext, text: string): string {
  return `Extract flights and accommodation from this booking text.
${tripLines(trip)}
Booking text:
"""
${text.slice(0, 8000)}
"""
Use kind "flight" for any transport booking and "lodging" for stays (date = check-in, endDate = check-out).
Put flight numbers, times and confirmation codes in title/note. Use the total price as estimate if shown.
Reply with JSON only: {"items":[${ITEM_SHAPE}]}`
}

const KINDS: ItineraryKind[] = ['spot', 'flight', 'lodging']
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/** Turns one model-suggested item into a draft, or null if it is unusable. */
export function toDraft(raw: unknown, trip: Pick<TripContext, 'currency' | 'startDate' | 'endDate'>): ItineraryDraft | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const title = text(r.title, 120)
  const date = text(r.date, 10)
  if (!title || !isIsoDate(date)) return null
  // With trip dates set, suggestions outside them are dropped rather than
  // silently landing in the "outside the trip" list.
  if (hasTripDates(trip.startDate, trip.endDate) && (date < trip.startDate || date > trip.endDate)) return null

  const kind = KINDS.includes(r.kind as ItineraryKind) ? (r.kind as ItineraryKind) : 'spot'
  const time = text(r.time, 5)
  const endDate = text(r.endDate, 10)
  const estimate = typeof r.estimate === 'number' && Number.isFinite(r.estimate) && r.estimate > 0 ? r.estimate : 0

  return {
    kind,
    date,
    time: TIME.test(time) ? time : '',
    endDate: kind === 'lodging' && isIsoDate(endDate) && endDate > date ? endDate : '',
    title,
    place: text(r.place, 200),
    note: text(r.note, 500),
    estimateMinor: toMinor(estimate, trip.currency),
    category: isCategory(r.category) ? r.category : kind === 'flight' ? 'transport' : kind === 'lodging' ? 'lodging' : 'other',
  }
}

/** Parses `{"items":[...]}`; tolerates a markdown code fence around the JSON. */
export function parseItems(reply: string, trip: Pick<TripContext, 'currency' | 'startDate' | 'endDate'>): ItineraryDraft[] {
  const data = parseJson(reply) as { items?: unknown } | null
  if (!data || !Array.isArray(data.items)) return []
  return data.items.map((item) => toDraft(item, trip)).filter((d): d is ItineraryDraft => d !== null).slice(0, 80)
}

export interface Adjustment {
  summary: string
  /** Ids of existing items to delete — only ids that really exist. */
  remove: string[]
  add: ItineraryDraft[]
}

export function parseAdjustment(
  reply: string,
  trip: Pick<TripContext, 'currency' | 'startDate' | 'endDate'>,
  existingIds: Iterable<string>,
): Adjustment {
  const data = parseJson(reply) as { summary?: unknown; remove?: unknown; add?: unknown } | null
  const known = new Set(existingIds)
  if (!data) return { summary: '', remove: [], add: [] }
  return {
    summary: text(data.summary, 300),
    remove: Array.isArray(data.remove) ? [...new Set(data.remove.filter((id): id is string => typeof id === 'string' && known.has(id)))] : [],
    add: Array.isArray(data.add)
      ? data.add.map((item) => toDraft(item, trip)).filter((d): d is ItineraryDraft => d !== null).slice(0, 40)
      : [],
  }
}

function parseJson(reply: string): unknown {
  const trimmed = reply.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

// --- checklist import -----------------------------------------------------------

export type ChecklistTarget = 'packing' | 'todo'

export interface ChecklistSuggestion {
  text: string
  list: ChecklistTarget
}

/**
 * Turns a travel agency's or friend's list — pasted text and/or screenshots —
 * into short checklist lines, split into things to pack and things to do.
 */
export function checklistPrompt(trip: TripContext, text: string, imageCount: number): string {
  return `Turn this pre-trip checklist into short checklist lines.
${tripLines(trip)}
${imageCount ? `The list is in the ${imageCount} attached image(s).` : ''}
${text.trim() ? `Pasted text:\n"""\n${text.slice(0, 8000)}\n"""` : ''}

Rules:
- "packing" = something to bring (passport, adapter, sunscreen).
- "todo" = something to do before or during the trip (exchange money, fill in Visit Japan Web, book a table).
- One item per line, at most 40 characters, no numbering, keep quantities ("T-shirt x3").
- Merge duplicates. Skip headings, greetings, prices and anything that is not an item.
Reply with JSON only: {"items":[{"text":"...","list":"packing|todo"}]}`
}

/** Case- and space-insensitive key, so "Passport" and " passport " match. */
function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '')
}

/**
 * Validates the model's lines and drops anything already on either list,
 * so importing the same list twice adds nothing.
 */
export function parseChecklist(reply: string, existing: Iterable<string>): ChecklistSuggestion[] {
  const data = parseJson(reply) as { items?: unknown } | null
  if (!data || !Array.isArray(data.items)) return []
  const seen = new Set([...existing].map(normalize))
  const result: ChecklistSuggestion[] = []

  for (const raw of data.items) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const line = text(r.text, 120).replace(/^[-*•\d.)\s]+/, '').trim()
    if (!line) continue
    const key = normalize(line)
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ text: line, list: r.list === 'todo' ? 'todo' : 'packing' })
  }

  return result.slice(0, 100)
}
