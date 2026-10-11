import type { Direction } from './directions';
import { type RandomSource, randomInt, shuffled } from './random';

export interface SequenceOptions {
  directions: readonly Direction[];
  count: number;
  /** Maximum number of identical directions in a row (>= 1). */
  maxRepeat: number;
  rng: RandomSource;
}

/**
 * How many times each direction appears in a set of `count` cues: every
 * direction gets floor(count / k), and `count % k` of them get one more.
 * Which ones get the extra is decided by `rng`.
 */
export function distributeCounts(
  directions: readonly Direction[],
  count: number,
  rng: RandomSource,
): Map<Direction, number> {
  const k = directions.length;
  const base = Math.floor(count / k);
  const extra = count % k;
  const counts = new Map<Direction, number>();
  shuffled(directions, rng).forEach((d, i) => counts.set(d, base + (i < extra ? 1 : 0)));
  return counts;
}

/**
 * A sequence with these counts and no run longer than `maxRepeat` exists iff the
 * most frequent direction fits: its runs of up to `maxRepeat` must be separated
 * by at least one other cue, so cMax <= maxRepeat * (others + 1).
 */
export function isFeasible(counts: Iterable<number>, maxRepeat: number): boolean {
  const list = [...counts];
  const total = list.reduce((a, b) => a + b, 0);
  const max = Math.max(0, ...list);
  return max <= maxRepeat * (total - max + 1);
}

/** Checks feasibility for the worst case of `distributeCounts`. */
export function isSequenceFeasible(directionCount: number, count: number, maxRepeat: number): boolean {
  if (directionCount < 1 || count < 0 || maxRepeat < 1) return false;
  const base = Math.floor(count / directionCount);
  const extra = count % directionCount;
  const counts = Array.from({ length: directionCount }, (_, i) => base + (i < extra ? 1 : 0));
  return isFeasible(counts, maxRepeat);
}

/**
 * Builds a random cue sequence where each direction appears evenly
 * (counts differ by at most one) and no direction repeats more than
 * `maxRepeat` times in a row.
 *
 * Picks each next cue at random, weighted by how many of that direction are
 * left, and backtracks on a dead end. Throws if the constraints can't be met.
 */
export function generateSequence({ directions, count, maxRepeat, rng }: SequenceOptions): Direction[] {
  if (directions.length === 0) throw new Error('At least one direction is required');
  if (!Number.isInteger(maxRepeat) || maxRepeat < 1) throw new Error('maxRepeat must be an integer >= 1');
  if (!Number.isInteger(count) || count < 0) throw new Error('count must be a non-negative integer');

  const unique = [...new Set(directions)];
  const remaining = distributeCounts(unique, count, rng);
  if (!isFeasible(remaining.values(), maxRepeat)) {
    throw new Error(
      `Can't place ${count} cues over ${unique.length} direction(s) with at most ${maxRepeat} in a row`,
    );
  }

  const out: Direction[] = [];

  const runLength = (d: Direction): number => {
    let n = 0;
    for (let i = out.length - 1; i >= 0 && out[i] === d; i--) n++;
    return n;
  };

  const place = (): boolean => {
    if (out.length === count) return true;
    const candidates = unique.filter((d) => remaining.get(d)! > 0 && runLength(d) < maxRepeat);
    // Weighted random order without replacement.
    while (candidates.length > 0) {
      const total = candidates.reduce((s, d) => s + remaining.get(d)!, 0);
      let pick = randomInt(rng, total);
      let idx = 0;
      while (pick >= remaining.get(candidates[idx]!)!) {
        pick -= remaining.get(candidates[idx]!)!;
        idx++;
      }
      const d = candidates.splice(idx, 1)[0]!;
      remaining.set(d, remaining.get(d)! - 1);
      out.push(d);
      // Prune branches whose remainder is clearly impossible; backtracking
      // handles the rest (this check ignores the run we are currently in).
      if (isFeasible(remaining.values(), maxRepeat) && place()) return true;
      out.pop();
      remaining.set(d, remaining.get(d)! + 1);
    }
    return false;
  };

  if (!place()) {
    throw new Error('Could not generate a cue sequence with the given constraints');
  }
  return out;
}
