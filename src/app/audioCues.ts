import { SPOKEN_LABEL } from '../core/directions';
import type { SessionEvent } from '../core/session';
import type { Settings } from '../core/settings';
import { BeepPlayer } from '../platform/beeps';
import { Speaker } from '../platform/speech';

export interface AudioStatus {
  beeps: boolean;
  speech: boolean;
}

/** Turns session events into sounds according to the audio settings. */
export class AudioCues {
  private readonly beeps = new BeepPlayer();
  private readonly speaker = new Speaker();

  constructor(private readonly onSpeechFailed: () => void = () => {}) {}

  /** Must run inside the Start button's click handler. */
  async unlock(settings: Settings): Promise<AudioStatus> {
    const beepsOk = this.beeps.unlock();
    const speechOk = settings.audioMode === 'speech' ? this.speaker.warmUp() : Promise.resolve(this.speaker.available);
    const [beeps, speech] = await Promise.all([beepsOk, speechOk]);
    return { beeps, speech };
  }

  handle(event: SessionEvent, settings: Settings): void {
    if (event.type === 'paused') {
      this.speaker.cancel();
      return;
    }
    if (event.type !== 'phase') return;
    // `readyBeep` is its own toggle; `audioMode` controls the cue and end sounds.
    const { phase, direction } = event.state;
    switch (phase) {
      case 'getReady':
        if (settings.readyBeep) this.beeps.readyBeep();
        break;
      case 'cue':
        if (!direction || settings.audioMode === 'off') break;
        if (settings.audioMode === 'speech') {
          this.speaker.say(SPOKEN_LABEL[direction], () => {
            this.beeps.cue(direction);
            this.onSpeechFailed();
          });
        } else {
          this.beeps.cue(direction);
        }
        break;
      case 'done':
        if (settings.audioMode !== 'off') this.beeps.done();
        break;
      case 'idle':
        this.speaker.cancel();
        break;
      default:
        break;
    }
  }

  static support(): AudioStatus {
    return { beeps: BeepPlayer.isSupported(), speech: Speaker.isSupported() };
  }
}
