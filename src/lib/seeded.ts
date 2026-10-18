/**
 * Deterministic "random" numbers from a string seed.
 * The voting tie-break is random, but every phone must agree on the result,
 * so we seed it with the round id: same round → same coin flips everywhere.
 */

/** Small fast PRNG (mulberry32). Returns numbers in [0, 1). */
export function seededRandom(seed: string): () => number {
  // FNV-1a hash of the seed string → 32-bit starting state.
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
