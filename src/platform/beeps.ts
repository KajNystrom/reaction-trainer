import type { Direction } from '../core/directions';

/** Tones per direction: left low, right high, front middle, back lowest; diagonals are two-tone. */
const CUE_TONES: Record<Direction, number[]> = {
  left: [440],
  right: [880],
  front: [660],
  back: [330],
  'front-left': [660, 440],
  'front-right': [660, 880],
  'back-left': [330, 440],
  'back-right': [330, 880],
};

const READY_TONE_HZ = 1200;

/**
 * Web Audio beeps. Chrome starts an AudioContext suspended until a user
 * gesture, so `unlock()` must be called from the Start button handler.
 */
export class BeepPlayer {
  private ctx: AudioContext | null = null;

  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'AudioContext' in window;
  }

  get unlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  async unlock(): Promise<boolean> {
    if (!BeepPlayer.isSupported()) return false;
    this.ctx ??= new AudioContext({ latencyHint: 'interactive' });
    if (this.ctx.state !== 'running') {
      try {
        await this.ctx.resume();
      } catch {
        return false;
      }
    }
    // A silent buffer makes sure the output path is actually open.
    const src = this.ctx.createBufferSource();
    src.buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
    src.connect(this.ctx.destination);
    src.start();
    return this.unlocked;
  }

  /** Short, high "get set" blip. */
  readyBeep(): void {
    this.tone(READY_TONE_HZ, 0, 0.08, 0.5);
  }

  cue(direction: Direction): void {
    CUE_TONES[direction].forEach((hz, i) => this.tone(hz, i * 0.22, 0.2, 0.9));
  }

  /** Low double tone at the end of the session. */
  done(): void {
    this.tone(523, 0, 0.18, 0.7);
    this.tone(784, 0.22, 0.35, 0.7);
  }

  private tone(hz: number, offsetS: number, durationS: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t0 = ctx.currentTime + offsetS;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = hz;
    // Fast attack/release envelope avoids clicks while staying punchy.
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(gain, t0 + 0.005);
    amp.gain.setValueAtTime(gain, t0 + durationS - 0.02);
    amp.gain.linearRampToValueAtTime(0, t0 + durationS);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durationS + 0.01);
  }
}
