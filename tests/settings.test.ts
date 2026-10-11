import { describe, expect, it } from 'vitest';
import { cloneDefaults, coerceSettings, DEFAULT_SETTINGS, validateSettings } from '../src/core/settings';

describe('settings', () => {
  it('defaults match the brief and are valid', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      directions: ['left', 'right', 'front'],
      sets: 3,
      repsPerSet: 6,
      restBetweenRepsMs: 25_000,
      restBetweenSetsMs: 90_000,
      delayMinMs: 1500,
      delayMaxMs: 4000,
      startCountdownMs: 5000,
      maxRepeat: 2,
    });
    expect(validateSettings(cloneDefaults())).toEqual([]);
  });

  it('cloneDefaults returns an independent copy', () => {
    const a = cloneDefaults();
    a.directions.push('back');
    expect(DEFAULT_SETTINGS.directions).toHaveLength(3);
  });

  it('flags out-of-range numbers, min > max delay and infeasible repeat rules', () => {
    const s = { ...cloneDefaults(), sets: 0, delayMinMs: 5000, delayMaxMs: 1000 };
    const errors = validateSettings(s);
    expect(errors.some((e) => e.startsWith('sets'))).toBe(true);
    expect(errors.some((e) => e.includes('Minimum delay'))).toBe(true);

    expect(validateSettings({ ...cloneDefaults(), directions: ['left'] }).join()).toMatch(/in a row/);
    expect(validateSettings({ ...cloneDefaults(), directions: [] }).join()).toMatch(/at least one/);
  });

  it('ignores min > max delay in fixed mode', () => {
    const s = { ...cloneDefaults(), delayMode: 'fixed' as const, delayMinMs: 5000, delayMaxMs: 1000 };
    expect(validateSettings(s)).toEqual([]);
  });

  it('coerces untrusted stored data', () => {
    expect(coerceSettings(null)).toEqual(cloneDefaults());
    expect(coerceSettings('garbage')).toEqual(cloneDefaults());
    const s = coerceSettings({
      sets: 5,
      repsPerSet: 'x',
      directions: ['back', 'left', 'nope', 'left'],
      delayMode: 'fixed',
      audioMode: 'loud',
      readyBeep: false,
      extra: 1,
    });
    expect(s.sets).toBe(5);
    expect(s.repsPerSet).toBe(6);
    expect(s.directions).toEqual(['left', 'back']);
    expect(s.delayMode).toBe('fixed');
    expect(s.audioMode).toBe('speech');
    expect(s.readyBeep).toBe(false);
    expect('extra' in s).toBe(false);
  });
});
