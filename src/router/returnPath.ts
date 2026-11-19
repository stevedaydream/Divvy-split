import type { Router } from 'vue-router'

export function returnPath(value: unknown, fallback = '/groups'): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\')
    ? value
    : fallback
}

export function returnsToInvite(router: Router, value: unknown): boolean {
  const { name, query } = router.resolve(returnPath(value))
  return name === 'join' && typeof query.g === 'string' && !!query.g && typeof query.c === 'string' && !!query.c
}
