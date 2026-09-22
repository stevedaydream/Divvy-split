import { describe, expect, it, vi } from 'vitest'
import { GeminiRequestError, nextPacificMidnight, quotaResetAt, withQuotaFallback } from '../gemini'

const at = (iso: string) => Date.parse(iso)

describe('nextPacificMidnight', () => {
  it('uses PDT in summer', () => {
    // 05:00 PDT on 9/22 -> midnight PDT starting 9/23 = 07:00 UTC.
    expect(nextPacificMidnight(at('2026-09-22T12:00:00Z'))).toBe(at('2026-09-23T07:00:00Z'))
  })

  it('uses PST in winter', () => {
    expect(nextPacificMidnight(at('2026-12-01T12:00:00Z'))).toBe(at('2026-12-02T08:00:00Z'))
  })

  it('rolls to the next day just after midnight', () => {
    // 00:30 PDT on 9/22 -> next reset is 9/23, not a moment ago.
    expect(nextPacificMidnight(at('2026-09-22T07:30:00Z'))).toBe(at('2026-09-23T07:00:00Z'))
  })

  it('handles the night clocks fall back', () => {
    // 2026-11-01 02:00 PDT becomes 01:00 PST; midnight 11/2 is PST.
    expect(nextPacificMidnight(at('2026-11-01T12:00:00Z'))).toBe(at('2026-11-02T08:00:00Z'))
  })
})

describe('quotaResetAt', () => {
  const now = at('2026-09-22T12:00:00Z')

  it('waits for Pacific midnight on a daily quota', () => {
    const body = {
      error: {
        details: [
          { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] },
          { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '12s' },
        ],
      },
    }
    expect(quotaResetAt(body, now)).toBe(at('2026-09-23T07:00:00Z'))
  })

  it('uses retryDelay for per-minute limits', () => {
    const body = {
      error: {
        details: [
          { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel' }] },
          { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '37.2s' },
        ],
      },
    }
    expect(quotaResetAt(body, now)).toBe(now + 38_000)
  })

  it('falls back to a minute when the body says nothing useful', () => {
    expect(quotaResetAt(null, now)).toBe(now + 60_000)
    expect(quotaResetAt({ error: { details: [{ retryDelay: '1s' }] } }, now)).toBe(now + 10_000)
  })
})

describe('withQuotaFallback', () => {
  const quota = () => Promise.reject(new GeminiRequestError('quota', 123))

  it('uses the primary when it works and never touches the fallback', async () => {
    const fallback = vi.fn(() => Promise.resolve('backup'))
    await expect(withQuotaFallback(() => Promise.resolve('mine'), fallback)).resolves.toEqual({
      reply: 'mine', usedFallback: false, resetAt: 0,
    })
    expect(fallback).not.toHaveBeenCalled()
  })

  it('lets the fallback finish a request that ran out of quota, once', async () => {
    const fallback = vi.fn(() => Promise.resolve('backup'))
    await expect(withQuotaFallback(quota, fallback)).resolves.toEqual({
      reply: 'backup', usedFallback: true, resetAt: 123,
    })
    expect(fallback).toHaveBeenCalledTimes(1)
  })

  it('surfaces the quota error with its reset time when the fallback fails too', async () => {
    const error = await withQuotaFallback(quota, () => Promise.reject(new Error('down'))).catch((e) => e)
    expect(error).toBeInstanceOf(GeminiRequestError)
    expect(error).toMatchObject({ reason: 'quota', resetAt: 123 })
  })

  it('does not fall back for other errors or when no fallback exists', async () => {
    const fallback = vi.fn(() => Promise.resolve('backup'))
    await expect(withQuotaFallback(() => Promise.reject(new GeminiRequestError('invalid-key')), fallback))
      .rejects.toMatchObject({ reason: 'invalid-key' })
    expect(fallback).not.toHaveBeenCalled()
    await expect(withQuotaFallback(quota, null)).rejects.toMatchObject({ reason: 'quota', resetAt: 123 })
  })
})
