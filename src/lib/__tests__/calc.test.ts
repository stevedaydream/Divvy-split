import { describe, expect, it } from 'vitest'
import { evaluate } from '../calc'

describe('evaluate', () => {
  it('respects operator precedence', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14)
    expect(evaluate('10 - 2 - 3')).toBe(5)
    expect(evaluate('100 / 4 / 5')).toBe(5)
  })

  it('handles decimals', () => {
    expect(evaluate('1.5 * 2')).toBe(3)
  })

  it('rejects malformed input instead of throwing', () => {
    for (const input of ['', '+', '2 +', '2 + + 3', '2 3', 'abc', '1/0']) {
      expect(evaluate(input)).toBeNull()
    }
  })

  it('never evaluates the input as code', () => {
    expect(evaluate('alert(1)')).toBeNull()
    expect(evaluate('globalThis')).toBeNull()
  })
})
