import { describe, expect, it } from 'vitest'
import { placeLabel } from '@/data/countries'

describe('placeLabel', () => {
  it('joins city and localised country', () => {
    expect(placeLabel('Tokyo', 'JP', 'en')).toBe('Tokyo · Japan')
    expect(placeLabel('東京', 'JP', 'zh-TW')).toBe('東京 · 日本')
  })

  it('shows whichever part exists', () => {
    expect(placeLabel('', 'JP', 'zh-TW')).toBe('日本')
    expect(placeLabel('  Osaka ', '', 'en')).toBe('Osaka')
    expect(placeLabel('', '', 'en')).toBe('')
  })
})
