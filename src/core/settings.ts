import { ALL_DIRECTIONS, DEFAULT_DIRECTIONS, type Direction, isDirection } from './directions';
import { isSequenceFeasible } from './sequence';

export type DelayMode = 'random' | 'fixed';
export type AudioMode = 'speech' | 'beeps' | 'off';

/** All durations are in milliseconds. */
export interface Settings {
  directions: Direction[];
  sets: number;
  repsPerSet: number;
  maxRepeat: number;
  startCountdownMs: number;
  delayMode: DelayMode;
  delayMinMs: number;
  delayMaxMs: number;
  delayFixedMs: number;
  cueDisplayMs: number;
  restBetweenRepsMs: number;
  restBetweenSetsMs: number;
  audioMode: AudioMode;
  readyBeep: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  directions: [...DEFAULT_DIRECTIONS],
  sets: 3,
  repsPerSet: 6,
  maxRepeat: 2,
  startCountdownMs: 5000,
  delayMode: 'random',
  delayMinMs: 1500,
  delayMaxMs: 4000,
  delayFixedMs: 2500,
  cueDisplayMs: 2000,
  restBetweenRepsMs: 25000,
  restBetweenSetsMs: 90000,
  audioMode: 'speech',
  readyBeep: true,
});

type NumericKey = {
  [K in keyof Settings]: Settings[K] extends number ? K : never;
}[keyof Settings];

/** Allowed range per numeric setting. Used for both validation and form inputs. */
export const LIMITS: Record<NumericKey, { min: number; max: number }> = {
  sets: { min: 1, max: 20 },
  repsPerSet: { min: 1, max: 100 },
  maxRepeat: { min: 1, max: 10 },
  startCountdownMs: { min: 0, max: 60_000 },
  delayMinMs: { min: 0, max: 30_000 },
  delayMaxMs: { min: 0, max: 30_000 },
  delayFixedMs: { min: 0, max: 30_000 },
  cueDisplayMs: { min: 200, max: 30_000 },
  restBetweenRepsMs: { min: 0, max: 600_000 },
  restBetweenSetsMs: { min: 0, max: 1_800_000 },
};

const LABELS: Record<NumericKey, string> = {
  sets: 'Sets',
  repsPerSet: 'Reps per set',
  maxRepeat: 'Max same direction in a row',
  startCountdownMs: 'Start countdown',
  delayMinMs: 'Shortest wait',
  delayMaxMs: 'Longest wait',
  delayFixedMs: 'Wait',
  cueDisplayMs: 'Arrow shown for',
  restBetweenRepsMs: 'Rest between reps',
  restBetweenSetsMs: 'Rest between sets',
};

function formatLimit(key: NumericKey, v: number): string {
  return key.endsWith('Ms') ? `${v / 1000} s` : String(v);
}

export function cloneDefaults(): Settings {
  return { ...DEFAULT_SETTINGS, directions: [...DEFAULT_SETTINGS.directions] };
}

/** Returns human-readable problems; an empty list means the settings are usable. */
export function validateSettings(s: Settings): string[] {
  const errors: string[] = [];
  for (const [key, { min, max }] of Object.entries(LIMITS) as [NumericKey, { min: number; max: number }][]) {
    const v = s[key];
    if (!Number.isFinite(v) || v < min || v > max) {
      errors.push(`${LABELS[key]} must be between ${formatLimit(key, min)} and ${formatLimit(key, max)}`);
    }
  }
  for (const key of ['sets', 'repsPerSet', 'maxRepeat'] as const) {
    if (Number.isFinite(s[key]) && !Number.isInteger(s[key])) errors.push(`${LABELS[key]} must be a whole number`);
  }
  if (s.directions.length === 0) errors.push('Pick at least one direction');
  if (s.delayMode === 'random' && s.delayMinMs > s.delayMaxMs) {
    errors.push('Minimum delay must not be longer than maximum delay');
  }
  if (s.directions.length > 0 && !isSequenceFeasible(s.directions.length, s.repsPerSet, s.maxRepeat)) {
    errors.push(
      `${s.repsPerSet} reps over ${s.directions.length} direction(s) can't avoid more than ${s.maxRepeat} in a row. ` +
        'Add directions, raise the repeat limit or lower the reps.',
    );
  }
  return errors;
}

/**
 * Turns untrusted stored data into Settings: unknown keys are dropped and
 * missing or wrongly typed values fall back to defaults.
 */
export function coerceSettings(raw: unknown): Settings {
  const out = cloneDefaults();
  if (typeof raw !== 'object' || raw === null) return out;
  const r = raw as Record<string, unknown>;

  for (const key of Object.keys(LIMITS) as NumericKey[]) {
    const v = r[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
  }
  if (Array.isArray(r.directions)) {
    const dirs = r.directions.filter(isDirection);
    // Keep canonical order and drop duplicates.
    out.directions = ALL_DIRECTIONS.filter((d) => dirs.includes(d));
  }
  if (r.delayMode === 'random' || r.delayMode === 'fixed') out.delayMode = r.delayMode;
  if (r.audioMode === 'speech' || r.audioMode === 'beeps' || r.audioMode === 'off') out.audioMode = r.audioMode;
  if (typeof r.readyBeep === 'boolean') out.readyBeep = r.readyBeep;
  return out;
}
