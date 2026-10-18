import { describe, expect, it } from 'vitest'
import { CODE_ALPHABET, generateCode, isValidCode, normalizeCode } from './codes'

describe('room codes', () => {
  it('generates 5-character codes from the safe alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode()
      expect(code).toHaveLength(5)
      expect([...code].every((c) => CODE_ALPHABET.includes(c))).toBe(true)
    }
  })

  it('normalizes messy input', () => {
    expect(normalizeCode(' k7-p2q ')).toBe('K7P2Q')
    expect(normalizeCode('k7p2qzzz')).toBe('K7P2Q')
  })

  it('rejects look-alike characters', () => {
    expect(isValidCode('K7P2Q')).toBe(true)
    expect(isValidCode('K0P2Q')).toBe(false) // zero isn't in the alphabet
    expect(isValidCode('K7P2')).toBe(false)
  })
})
