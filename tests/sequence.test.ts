import { describe, expect, it } from 'vitest';
import { ALL_DIRECTIONS, type Direction } from '../src/core/directions';
import { seededRandom } from '../src/core/random';
import { generateSequence, isFeasible, isSequenceFeasible } from '../src/core/sequence';

function longestRun(seq: readonly Direction[]): number {
  let best = 0;
  let run = 0;
  seq.forEach((d, i) => {
    run = i > 0 && seq[i - 1] === d ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

function countsOf(seq: readonly Direction[]): Map<Direction, number> {
  const m = new Map<Direction, number>();
  for (const d of seq) m.set(d, (m.get(d) ?? 0) + 1);
  return m;
}

const THREE: Direction[] = ['left', 'right', 'front'];

describe('generateSequence', () => {
  it('returns the requested number of cues using only the given directions', () => {
    const seq = generateSequence({ directions: THREE, count: 6, maxRepeat: 2, rng: seededRandom(1) });
    expect(seq).toHaveLength(6);
    for (const d of seq) expect(THREE).toContain(d);
  });

  it('is deterministic for a given seed', () => {
    const a = generateSequence({ directions: THREE, count: 12, maxRepeat: 2, rng: seededRandom(42) });
    const b = generateSequence({ directions: THREE, count: 12, maxRepeat: 2, rng: seededRandom(42) });
    expect(a).toEqual(b);
  });

  it('never exceeds maxRepeat identical directions in a row (many seeds and settings)', () => {
    for (let seed = 0; seed < 500; seed++) {
      for (const maxRepeat of [1, 2, 3]) {
        for (const dirs of [THREE, ['left', 'right'] as Direction[], [...ALL_DIRECTIONS]]) {
          const count = 3 + (seed % 20);
          if (!isSequenceFeasible(dirs.length, count, maxRepeat)) continue;
          const seq = generateSequence({ directions: dirs, count, maxRepeat, rng: seededRandom(seed) });
          expect(longestRun(seq)).toBeLessThanOrEqual(maxRepeat);
        }
      }
    }
  });

  it('distributes directions evenly: counts differ by at most one', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const [dirs, count] of [
        [THREE, 6],
        [THREE, 7],
        [[...ALL_DIRECTIONS], 6],
        [['left', 'right', 'front', 'back', 'front-left'] as Direction[], 13],
      ] as const) {
        const seq = generateSequence({ directions: dirs, count, maxRepeat: 2, rng: seededRandom(seed) });
        const counts = dirs.map((d) => countsOf(seq).get(d) ?? 0);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
        expect(counts.reduce((a, b) => a + b, 0)).toBe(count);
      }
    }
  });

  it('gives each of 3 directions exactly 2 cues in the default 6-rep set', () => {
    for (let seed = 0; seed < 100; seed++) {
      const seq = generateSequence({ directions: THREE, count: 6, maxRepeat: 2, rng: seededRandom(seed) });
      expect([...countsOf(seq).values()]).toEqual([2, 2, 2]);
    }
  });

  it('spreads the extra cue across directions when count is not divisible', () => {
    const extras = new Map<Direction, number>();
    for (let seed = 0; seed < 600; seed++) {
      const seq = generateSequence({ directions: THREE, count: 7, maxRepeat: 2, rng: seededRandom(seed) });
      for (const [d, n] of countsOf(seq)) if (n === 3) extras.set(d, (extras.get(d) ?? 0) + 1);
    }
    for (const d of THREE) expect(extras.get(d) ?? 0).toBeGreaterThan(150);
  });

  it('varies the order between seeds', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      seen.add(generateSequence({ directions: THREE, count: 6, maxRepeat: 2, rng: seededRandom(seed) }).join());
    }
    expect(seen.size).toBeGreaterThan(30);
  });

  it('handles strict alternation (maxRepeat 1, two directions)', () => {
    const seq = generateSequence({ directions: ['left', 'right'], count: 10, maxRepeat: 1, rng: seededRandom(7) });
    expect(longestRun(seq)).toBe(1);
  });

  it('handles long sequences quickly', () => {
    const start = performance.now();
    const seq = generateSequence({ directions: ['left', 'right'], count: 500, maxRepeat: 1, rng: seededRandom(3) });
    expect(longestRun(seq)).toBe(1);
    expect(performance.now() - start).toBeLessThan(500);
  });

  it('allows a single direction when maxRepeat covers the whole set', () => {
    expect(generateSequence({ directions: ['front'], count: 3, maxRepeat: 3, rng: seededRandom(1) })).toEqual([
      'front',
      'front',
      'front',
    ]);
  });

  it('throws for impossible constraints', () => {
    expect(() =>
      generateSequence({ directions: ['front'], count: 3, maxRepeat: 2, rng: seededRandom(1) }),
    ).toThrow();
    expect(() => generateSequence({ directions: [], count: 3, maxRepeat: 2, rng: seededRandom(1) })).toThrow();
    expect(() => generateSequence({ directions: THREE, count: 3, maxRepeat: 0, rng: seededRandom(1) })).toThrow();
  });
});

describe('feasibility', () => {
  it('matches the run-length bound', () => {
    expect(isFeasible([3, 1], 1)).toBe(false);
    expect(isFeasible([2, 1], 1)).toBe(true);
    expect(isFeasible([4, 1], 2)).toBe(true);
    expect(isFeasible([5, 1], 2)).toBe(false);
  });

  it('checks settings-level feasibility', () => {
    expect(isSequenceFeasible(3, 6, 2)).toBe(true);
    expect(isSequenceFeasible(1, 6, 2)).toBe(false);
    expect(isSequenceFeasible(1, 2, 2)).toBe(true);
    expect(isSequenceFeasible(2, 7, 1)).toBe(true); // L R L R L R L
    expect(isSequenceFeasible(1, 2, 1)).toBe(false);
  });
});
