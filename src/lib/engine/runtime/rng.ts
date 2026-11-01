/**
 * AII Creative Engine — Seeded PRNG (Mulberry32)
 * Fast, deterministic, good distribution for particle systems and procedural visuals.
 */

// ============================================================
// Mulberry32
// ============================================================

/**
 * Single-shot Mulberry32 PRNG.
 * Returns a float in [0, 1) given a seed.
 */
export function mulberry32(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Create a stateful Mulberry32 generator.
 * Calling the returned function advances the sequence and returns a new float in [0, 1).
 */
export function createRNG(seed: number): () => number {
  let s = seed | 0;
  return function (): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
