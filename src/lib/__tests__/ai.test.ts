import { describe, expect, it } from 'vitest'
import { adjustPrompt, parseAdjustment, parseItems, planPrompt, toDraft } from '../ai'

const trip = { currency: 'JPY', startDate: '2026-10-02', endDate: '2026-10-05' }

describe('toDraft', () => {
  it('accepts a well-formed suggestion and converts the estimate', () => {
    expect(
      toDraft(
        { kind: 'spot', date: '2026-10-03', time: '09:30', title: '川平灣', place: 'Kabira Bay', note: '早點去', estimate: 1200.4, category: 'fun' },
        trip,
      ),
    ).toEqual({
      kind: 'spot', date: '2026-10-03', time: '09:30', endDate: '', title: '川平灣',
      place: 'Kabira Bay', note: '早點去', estimateMinor: 1200, category: 'fun',
    })
  })

  it('drops items without a title, with a bad date or outside the trip', () => {
    expect(toDraft({ date: '2026-10-03' }, trip)).toBeNull()
    expect(toDraft({ title: 'x', date: 'tomorrow' }, trip)).toBeNull()
    expect(toDraft({ title: 'x', date: '2026-10-09' }, trip)).toBeNull()
    expect(toDraft('nope', trip)).toBeNull()
  })

  it('cleans up unknown kinds, times, categories and negative estimates', () => {
    const draft = toDraft({ kind: 'rocket', title: 'x', date: '2026-10-02', time: '25:99', category: 'nap', estimate: -5 }, trip)
    expect(draft).toMatchObject({ kind: 'spot', time: '', category: 'other', estimateMinor: 0 })
  })

  it('keeps a check-out date only for lodging and only after check-in', () => {
    expect(toDraft({ kind: 'lodging', title: 'h', date: '2026-10-02', endDate: '2026-10-04' }, trip)?.endDate).toBe('2026-10-04')
    expect(toDraft({ kind: 'lodging', title: 'h', date: '2026-10-02', endDate: '2026-10-01' }, trip)?.endDate).toBe('')
    expect(toDraft({ kind: 'spot', title: 's', date: '2026-10-02', endDate: '2026-10-04' }, trip)?.endDate).toBe('')
  })

  it('defaults categories from the kind', () => {
    expect(toDraft({ kind: 'flight', title: 'f', date: '2026-10-02' }, trip)?.category).toBe('transport')
    expect(toDraft({ kind: 'lodging', title: 'h', date: '2026-10-02' }, trip)?.category).toBe('lodging')
  })

  it('allows any date when the group has no trip dates', () => {
    expect(toDraft({ title: 'x', date: '2027-01-01' }, { currency: 'TWD', startDate: '', endDate: '' })).not.toBeNull()
  })
})

describe('parseItems', () => {
  it('reads fenced JSON and skips bad rows', () => {
    const reply = '```json\n{"items":[{"title":"a","date":"2026-10-02"},{"title":""}]}\n```'
    expect(parseItems(reply, trip).map((d) => d.title)).toEqual(['a'])
  })

  it('returns nothing for non-JSON', () => {
    expect(parseItems('sorry, I cannot', trip)).toEqual([])
    expect(parseItems('{"items":"x"}', trip)).toEqual([])
  })
})

describe('parseAdjustment', () => {
  it('only removes ids that exist', () => {
    const reply = JSON.stringify({
      summary: 'Swapped lunch',
      remove: ['a', 'ghost', 'a'],
      add: [{ title: 'Soba', date: '2026-10-03', category: 'food' }],
    })
    const result = parseAdjustment(reply, trip, ['a', 'b'])
    expect(result.summary).toBe('Swapped lunch')
    expect(result.remove).toEqual(['a'])
    expect(result.add.map((d) => d.title)).toEqual(['Soba'])
  })

  it('is empty for garbage', () => {
    expect(parseAdjustment('???', trip, ['a'])).toEqual({ summary: '', remove: [], add: [] })
  })
})

describe('prompts', () => {
  it('state the trip dates and ask for JSON', () => {
    const prompt = planPrompt(
      { destination: '石垣島, 日本', startDate: '2026-10-02', endDate: '2026-10-05', currency: 'JPY', language: '繁體中文' },
      'relaxed',
      ['beach'],
      '',
    )
    expect(prompt).toContain('2026-10-02 to 2026-10-05')
    expect(prompt).toContain('Reply with JSON only')
  })

  it('send existing estimates in the same unit the reply uses', () => {
    const prompt = adjustPrompt(
      { destination: '', startDate: '', endDate: '', currency: 'TWD', language: 'en' },
      [{ id: 'a', kind: 'spot', date: '2026-10-02', time: '', endDate: '', title: 'x', place: '', note: '',
        estimateMinor: 150000, category: 'food', updatedBy: 'u', updatedAt: null }],
      'cheaper',
    )
    expect(prompt).toContain('"estimate":1500')
  })
})
