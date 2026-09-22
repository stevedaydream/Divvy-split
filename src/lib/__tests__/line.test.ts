import { describe, expect, it } from 'vitest'
import { lineProfileUrl } from '../line'

describe('lineProfileUrl', () => {
  it('links a personal LINE ID with the ~ prefix', () => {
    expect(lineProfileUrl('divvy.user')).toBe('https://line.me/ti/p/~divvy.user')
  })

  it('does not double a ~ the user typed', () => {
    expect(lineProfileUrl('~divvy')).toBe('https://line.me/ti/p/~divvy')
  })

  it('links an Official Account ID through /R/ti/p/@', () => {
    expect(lineProfileUrl('@divvy')).toBe('https://line.me/R/ti/p/%40divvy')
  })

  it('trims and encodes', () => {
    expect(lineProfileUrl('  a b ')).toBe('https://line.me/ti/p/~a%20b')
  })
})
