/** Returns a float in [0, 1). Injected so session logic is deterministic in tests. */
export type RandomSource = () => number;

export const mathRandom: RandomSource = () => Math.random();

/** Small seeded PRNG (mulberry32) for tests and reproducible sessions. */
export function seededRandom(seed: number): RandomSource {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [0, n). */
export function randomInt(rng: RandomSource, n: number): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** Float in [min, max]. */
export function randomBetween(rng: RandomSource, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Fisher–Yates shuffle into a new array. */
export function shuffled<T>(items: readonly T[], rng: RandomSource): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
