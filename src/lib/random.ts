const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * A short, unguessable invite code. Ambiguous glyphs (I/L/O/0/1) are left out
 * so a code stays readable when someone reads it aloud or retypes it.
 */
export function inviteCode(length = 10): string {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length]
  return out
}
