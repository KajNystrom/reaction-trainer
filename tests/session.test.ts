import { describe, expect, it } from 'vitest';
import { FakeClock } from '../src/core/clock';
import type { Direction } from '../src/core/directions';
import { seededRandom } from '../src/core/random';
import { type Phase, Session, type SessionEvent } from '../src/core/session';
import { cloneDefaults, type Settings } from '../src/core/settings';

function setup(overrides: Partial<Settings> = {}, seed = 1) {
  const clock = new FakeClock(1000);
  const settings = { ...cloneDefaults(), ...overrides };
  const session = new Session(settings, { clock, rng: seededRandom(seed) });
  const events: SessionEvent[] = [];
  session.subscribe((e) => events.push(e));
  const phases = () => events.filter((e) => e.type === 'phase').map((e) => e.state.phase);
  /** Jump to the next deadline and tick, like the real driver does. */
  const step = () => {
    const d = session.nextDeadline();
    if (d === null) throw new Error('No pending deadline');
    clock.set(d);
    session.tick();
  };
  const runToEnd = () => {
    for (let i = 0; i < 10_000 && session.nextDeadline() !== null; i++) step();
  };
  return { clock, settings, session, events, phases, step, runToEnd };
}

const SHORT: Partial<Settings> = {
  sets: 2,
  repsPerSet: 3,
  startCountdownMs: 5000,
  delayMode: 'fixed',
  delayFixedMs: 2000,
  cueDisplayMs: 1000,
  restBetweenRepsMs: 10_000,
  restBetweenSetsMs: 30_000,
};

describe('Session phases', () => {
  it('starts idle and does nothing until started', () => {
    const { session } = setup();
    expect(session.getState().phase).toBe('idle');
    expect(session.nextDeadline()).toBeNull();
  });

  it('runs countdown → (getReady → cue → rest)* → done in order', () => {
    const { session, phases, runToEnd } = setup(SHORT);
    session.start();
    runToEnd();
    const rep = ['getReady', 'cue'];
    expect(phases()).toEqual<Phase[]>([
      'countdown',
      ...rep, 'rest', ...rep, 'rest', ...rep, // set 1
      'rest', // between sets
      ...rep, 'rest', ...rep, 'rest', ...rep, // set 2
      'done',
    ] as Phase[]);
  });

  it('uses the configured durations for each phase', () => {
    const { session, events, runToEnd } = setup(SHORT);
    session.start();
    runToEnd();
    const durations = events
      .filter((e) => e.type === 'phase' && e.state.phase !== 'done')
      .map((e) => [e.state.phase, e.state.restKind, e.state.phaseEndsAt - e.state.phaseStartedAt]);
    expect(durations[0]).toEqual(['countdown', null, 5000]);
    expect(durations[1]).toEqual(['getReady', null, 2000]);
    expect(durations[2]).toEqual(['cue', null, 1000]);
    expect(durations[3]).toEqual(['rest', 'rep', 10_000]);
    expect(durations).toContainEqual(['rest', 'set', 30_000]);
  });

  it('has the expected total session length', () => {
    const { session, clock, runToEnd } = setup(SHORT);
    session.start();
    const t0 = clock.now();
    runToEnd();
    // 5 s countdown + 6 × (2 s + 1 s) + 4 rep rests × 10 s + 1 set rest × 30 s
    expect(clock.now() - t0).toBe(5000 + 6 * 3000 + 4 * 10_000 + 30_000);
  });

  it('shows the planned direction for each cue, matching the generated sequence', () => {
    const { session, events, runToEnd } = setup(SHORT);
    session.start();
    runToEnd();
    const cued = events.filter((e) => e.type === 'phase' && e.state.phase === 'cue').map((e) => e.state.direction);
    expect(cued).toEqual(session.getSequences().flat());
    expect(cued.every((d) => d !== null)).toBe(true);
  });

  it('reports set and rep indexes; during rest they point at the upcoming rep', () => {
    const { session, events, runToEnd } = setup(SHORT);
    session.start();
    runToEnd();
    const cues = events.filter((e) => e.type === 'phase' && e.state.phase === 'cue').map((e) => [e.state.setIndex, e.state.repIndex]);
    expect(cues).toEqual([[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]]);
    const setRest = events.find((e) => e.type === 'phase' && e.state.restKind === 'set')!;
    expect([setRest.state.setIndex, setRest.state.repIndex]).toEqual([1, 0]);
  });

  it('obeys the repeat limit and even distribution in every set', () => {
    for (let seed = 0; seed < 50; seed++) {
      const { session } = setup({ sets: 3, repsPerSet: 6, maxRepeat: 2 }, seed);
      session.start();
      for (const seq of session.getSequences()) {
        const counts = new Map<Direction, number>();
        seq.forEach((d, i) => {
          counts.set(d, (counts.get(d) ?? 0) + 1);
          if (i >= 2) expect(seq[i] === seq[i - 1] && seq[i] === seq[i - 2]).toBe(false);
        });
        expect([...counts.values()].sort()).toEqual([2, 2, 2]);
      }
    }
  });

  it('draws random pre-cue delays within the configured range', () => {
    const { session, events, runToEnd } = setup({ ...SHORT, delayMode: 'random', delayMinMs: 1500, delayMaxMs: 4000 });
    session.start();
    runToEnd();
    const delays = events
      .filter((e) => e.type === 'phase' && e.state.phase === 'getReady')
      .map((e) => e.state.phaseEndsAt - e.state.phaseStartedAt);
    expect(delays).toHaveLength(6);
    for (const d of delays) {
      expect(d).toBeGreaterThanOrEqual(1500);
      expect(d).toBeLessThanOrEqual(4000);
    }
    expect(new Set(delays).size).toBeGreaterThan(1);
  });

  it('skips zero-length phases without stalling', () => {
    const { session, phases, runToEnd } = setup({ ...SHORT, startCountdownMs: 0, restBetweenRepsMs: 0, restBetweenSetsMs: 0 });
    session.start();
    expect(session.getState().phase).toBe('getReady');
    runToEnd();
    expect(session.getState().phase).toBe('done');
    expect(phases().filter((p) => p === 'cue')).toHaveLength(6);
  });

  it('does not advance before the deadline', () => {
    const { session, clock } = setup(SHORT);
    session.start();
    clock.advance(4999);
    session.tick();
    expect(session.getState().phase).toBe('countdown');
    expect(session.getState().remainingMs).toBe(1);
  });

  it('starts the next phase when the tick arrives, so a late tick never bursts cues', () => {
    const { session, clock, phases } = setup(SHORT);
    session.start();
    clock.advance(60_000); // far past several scheduled phases
    session.tick();
    expect(phases()).toEqual(['countdown', 'getReady']);
    expect(session.getState().phaseStartedAt).toBe(clock.now());
  });

  it('can be restarted after finishing', () => {
    const { session, runToEnd } = setup(SHORT);
    session.start();
    runToEnd();
    session.start();
    expect(session.getState().phase).toBe('countdown');
    expect(session.getState().setIndex).toBe(0);
  });

  it('rejects invalid settings', () => {
    expect(() => setup({ directions: ['front'], repsPerSet: 6, maxRepeat: 2 })).toThrow(/Invalid settings/);
  });
});

describe('Session pause / resume / stop', () => {
  it('freezes the remaining time while paused', () => {
    const { session, clock } = setup(SHORT);
    session.start();
    clock.advance(2000);
    session.pause();
    expect(session.nextDeadline()).toBeNull();
    clock.advance(60_000);
    session.tick();
    const s = session.getState();
    expect(s.phase).toBe('countdown');
    expect(s.paused).toBe(true);
    expect(s.remainingMs).toBe(3000);
  });

  it('continues countdown, cue and rest with the time that was left', () => {
    const { session, clock, step } = setup(SHORT);
    session.start();
    step(); // → getReady
    step(); // → cue
    step(); // → rest
    expect(session.getState().phase).toBe('rest');
    clock.advance(4000);
    session.pause();
    clock.advance(100_000);
    session.resume();
    expect(session.getState().remainingMs).toBe(6000);
    expect(session.nextDeadline()).toBe(clock.now() + 6000);
  });

  it('restarts the pre-cue wait on resume in fixed mode, re-emitting getReady', () => {
    const { session, clock, step, phases } = setup(SHORT);
    session.start();
    step(); // → getReady (2000 ms fixed)
    clock.advance(1500);
    session.pause();
    clock.advance(10_000);
    session.resume();
    const s = session.getState();
    expect(s.phase).toBe('getReady');
    expect(s.remainingMs).toBe(2000);
    expect(phases()).toEqual(['countdown', 'getReady', 'getReady']);
  });

  it('draws a new random pre-cue wait on resume in random mode', () => {
    const { session, clock, step } = setup({ ...SHORT, delayMode: 'random', delayMinMs: 1500, delayMaxMs: 4000 }, 5);
    session.start();
    step(); // → getReady
    const first = session.getState().phaseEndsAt - session.getState().phaseStartedAt;
    clock.advance(1000);
    session.pause();
    session.resume();
    const s = session.getState();
    const second = s.phaseEndsAt - s.phaseStartedAt;
    expect(second).toBeGreaterThanOrEqual(1500);
    expect(second).toBeLessThanOrEqual(4000);
    expect(second).not.toBe(first);
    expect(s.phaseStartedAt).toBe(clock.now());
  });

  it('emits paused and resumed events', () => {
    const { session, events } = setup(SHORT);
    session.start();
    session.pause();
    session.resume();
    expect(events.map((e) => e.type)).toEqual(['phase', 'paused', 'resumed']);
  });

  it('ignores pause when idle or done, and resume when not paused', () => {
    const { session, events, runToEnd } = setup(SHORT);
    session.pause();
    session.resume();
    expect(events).toHaveLength(0);
    session.start();
    runToEnd();
    const n = events.length;
    session.pause();
    expect(events).toHaveLength(n);
  });

  it('stop returns to idle from any phase, including while paused', () => {
    const { session, step } = setup(SHORT);
    session.start();
    step();
    session.pause();
    session.stop();
    const s = session.getState();
    expect(s.phase).toBe('idle');
    expect(s.paused).toBe(false);
    expect(session.nextDeadline()).toBeNull();
  });
});
