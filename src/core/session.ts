import type { Clock } from './clock';
import type { Direction } from './directions';
import { type RandomSource, randomBetween } from './random';
import { generateSequence } from './sequence';
import { type Settings, validateSettings } from './settings';

/**
 * idle      not started, or stopped
 * countdown initial countdown before the first rep
 * getReady  random (or fixed) wait before a cue; the "ready" beep plays on entry
 * cue       the direction is shown and spoken
 * rest      rest between reps or between sets
 * done      all sets finished
 */
export type Phase = 'idle' | 'countdown' | 'getReady' | 'cue' | 'rest' | 'done';
export type RestKind = 'rep' | 'set';

export interface SessionState {
  phase: Phase;
  paused: boolean;
  /** 0-based. During rest this points at the upcoming rep. */
  setIndex: number;
  /** 0-based within the set. During rest this points at the upcoming rep. */
  repIndex: number;
  totalSets: number;
  repsPerSet: number;
  /** Set during `cue`, otherwise null. */
  direction: Direction | null;
  /** Set during `rest`, otherwise null. */
  restKind: RestKind | null;
  /** Clock time when the current phase started (for a cue: when it was due). */
  phaseStartedAt: number;
  /** Clock time when the current phase ends; Infinity for idle/done. */
  phaseEndsAt: number;
  /** Time left in the current phase, frozen while paused. */
  remainingMs: number;
}

export type SessionEvent =
  /** A phase was entered. Re-entering getReady after a pause also emits this. */
  | { type: 'phase'; state: SessionState }
  | { type: 'paused'; state: SessionState }
  | { type: 'resumed'; state: SessionState };

export type SessionListener = (event: SessionEvent) => void;

export interface SessionDeps {
  clock: Clock;
  rng: RandomSource;
}

/**
 * Session timing logic, free of DOM and audio. A driver calls `tick()` at or
 * after `nextDeadline()`; listeners turn events into screen and sound.
 *
 * A new phase starts when the previous one is observed to end (not at its
 * scheduled end), so a late tick delays the session slightly instead of
 * firing several cues in a burst.
 */
export class Session {
  private readonly settings: Settings;
  private readonly clock: Clock;
  private readonly rng: RandomSource;
  private readonly listeners = new Set<SessionListener>();

  private phase: Phase = 'idle';
  private paused = false;
  private setIndex = 0;
  private repIndex = 0;
  private restKind: RestKind | null = null;
  private phaseStartedAt = 0;
  private phaseEndsAt = Number.POSITIVE_INFINITY;
  private pausedRemainingMs = 0;
  private sequences: Direction[][] = [];

  constructor(settings: Settings, deps: SessionDeps) {
    const errors = validateSettings(settings);
    if (errors.length > 0) throw new Error(`Invalid settings: ${errors.join('; ')}`);
    this.settings = { ...settings, directions: [...settings.directions] };
    this.clock = deps.clock;
    this.rng = deps.rng;
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** The planned cue order, one array per set. Empty until started. */
  getSequences(): readonly (readonly Direction[])[] {
    return this.sequences;
  }

  getState(): SessionState {
    const now = this.clock.now();
    const ended = this.phase === 'idle' || this.phase === 'done';
    return {
      phase: this.phase,
      paused: this.paused,
      setIndex: this.setIndex,
      repIndex: this.repIndex,
      totalSets: this.settings.sets,
      repsPerSet: this.settings.repsPerSet,
      direction: this.phase === 'cue' ? this.currentDirection() : null,
      restKind: this.phase === 'rest' ? this.restKind : null,
      phaseStartedAt: this.phaseStartedAt,
      phaseEndsAt: this.phaseEndsAt,
      remainingMs: ended ? 0 : this.paused ? this.pausedRemainingMs : Math.max(0, this.phaseEndsAt - now),
    };
  }

  /** When `tick()` should next be called, or null if nothing is pending. */
  nextDeadline(): number | null {
    if (this.paused || this.phase === 'idle' || this.phase === 'done') return null;
    return this.phaseEndsAt;
  }

  start(): void {
    if (this.phase !== 'idle' && this.phase !== 'done') return;
    const { sets, repsPerSet, directions, maxRepeat } = this.settings;
    this.sequences = Array.from({ length: sets }, () =>
      generateSequence({ directions, count: repsPerSet, maxRepeat, rng: this.rng }),
    );
    this.setIndex = 0;
    this.repIndex = 0;
    this.paused = false;
    this.enter('countdown', this.settings.startCountdownMs, this.clock.now());
    this.tick();
  }

  /** Advances through every phase that has ended by now. */
  tick(): void {
    if (this.paused) return;
    const now = this.clock.now();
    // Bounded loop: only zero-length phases can chain within one tick.
    for (let guard = 0; guard < 10_000 && this.phaseEndsAt <= now; guard++) {
      this.advance(now);
    }
  }

  pause(): void {
    if (this.paused || this.phase === 'idle' || this.phase === 'done') return;
    this.pausedRemainingMs = Math.max(0, this.phaseEndsAt - this.clock.now());
    this.paused = true;
    this.emit('paused');
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    const now = this.clock.now();
    if (this.phase === 'getReady') {
      // Don't let a pause reveal when the cue comes: start the wait over.
      this.enter('getReady', this.drawDelay(), now);
    } else {
      const duration = this.phaseEndsAt - this.phaseStartedAt;
      this.phaseEndsAt = now + this.pausedRemainingMs;
      this.phaseStartedAt = this.phaseEndsAt - duration;
      this.emit('resumed');
    }
    this.tick();
  }

  stop(): void {
    if (this.phase === 'idle') return;
    this.paused = false;
    this.enter('idle', Number.POSITIVE_INFINITY, this.clock.now());
  }

  private advance(now: number): void {
    const { sets, repsPerSet } = this.settings;
    switch (this.phase) {
      case 'countdown':
        this.enter('getReady', this.drawDelay(), now);
        break;
      case 'getReady':
        this.enter('cue', this.settings.cueDisplayMs, now);
        break;
      case 'cue': {
        const lastRepOfSet = this.repIndex === repsPerSet - 1;
        if (lastRepOfSet && this.setIndex === sets - 1) {
          this.enter('done', Number.POSITIVE_INFINITY, now);
        } else if (lastRepOfSet) {
          this.setIndex++;
          this.repIndex = 0;
          this.restKind = 'set';
          this.enter('rest', this.settings.restBetweenSetsMs, now);
        } else {
          this.repIndex++;
          this.restKind = 'rep';
          this.enter('rest', this.settings.restBetweenRepsMs, now);
        }
        break;
      }
      case 'rest':
        this.enter('getReady', this.drawDelay(), now);
        break;
      case 'idle':
      case 'done':
        break;
    }
  }

  private enter(phase: Phase, durationMs: number, now: number): void {
    this.phase = phase;
    this.phaseStartedAt = now;
    this.phaseEndsAt = now + durationMs;
    this.emit('phase');
  }

  private drawDelay(): number {
    const { delayMode, delayMinMs, delayMaxMs, delayFixedMs } = this.settings;
    return delayMode === 'fixed' ? delayFixedMs : randomBetween(this.rng, delayMinMs, delayMaxMs);
  }

  private currentDirection(): Direction | null {
    return this.sequences[this.setIndex]?.[this.repIndex] ?? null;
  }

  private emit(type: SessionEvent['type']): void {
    const state = this.getState();
    for (const l of this.listeners) l({ type, state });
  }
}
