import { describe, expect, it } from 'vitest'
import { bugReportUrl, REPO_URL } from '../appInfo'

describe('bugReportUrl', () => {
  it('opens a new issue with the build and page filled in', () => {
    const url = new URL(bugReportUrl('/groups/abc', 'TestAgent/1.0'))
    expect(`${url.origin}${url.pathname}`).toBe(`${REPO_URL}/issues/new`)
    expect(url.searchParams.get('labels')).toBe('bug')
    const body = url.searchParams.get('body')!
    expect(body).toContain('Page: /groups/abc')
    expect(body).toContain('Device: TestAgent/1.0')
    expect(body).toMatch(/Version: \d+\.\d+\.\d+ \(/)
  })
})
