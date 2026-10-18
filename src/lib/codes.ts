/**
 * Short, shout-across-the-table codes like "K7P2Q".
 * Leaves out look-alike characters (0/O, 1/I/L) so nobody mistypes them.
 */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const CODE_LENGTH = 5

export function generateCode(length = CODE_LENGTH): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}

/** Uppercases and drops anything that can't appear in a code. */
export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .split('')
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, CODE_LENGTH)
}

export function isValidCode(code: string): boolean {
  return code.length === CODE_LENGTH && normalizeCode(code) === code
}
