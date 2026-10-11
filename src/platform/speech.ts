/**
 * Spoken cues via the Web Speech API. Android Chrome supports it, but it
 * depends on a TTS engine on the device, voices load asynchronously, and
 * output typically starts 100–500 ms after `speak()`. The visual arrow is
 * therefore the timing reference; speech is a convenience on top.
 */
export class Speaker {
  private voice: SpeechSynthesisVoice | null = null;
  private failed = false;

  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  }

  /** True if support exists and no utterance has failed so far. */
  get available(): boolean {
    return Speaker.isSupported() && !this.failed;
  }

  constructor() {
    if (!Speaker.isSupported()) return;
    this.pickVoice();
    speechSynthesis.addEventListener('voiceschanged', () => this.pickVoice());
  }

  /**
   * Call from a user gesture (the Start button). Speaks a silent utterance so
   * the engine is loaded before the first real cue, and resolves to whether
   * speech appears to work.
   */
  warmUp(): Promise<boolean> {
    if (!Speaker.isSupported()) return Promise.resolve(false);
    return new Promise((resolve) => {
      const u = this.utterance(' ');
      u.volume = 0;
      // Some engines never fire `end` for blank text; don't block on it.
      const timer = setTimeout(() => resolve(this.available), 1500);
      u.onend = () => {
        clearTimeout(timer);
        resolve(this.available);
      };
      u.onerror = (e) => {
        clearTimeout(timer);
        // "interrupted"/"canceled" just mean another utterance replaced this one.
        if (e.error !== 'interrupted' && e.error !== 'canceled') this.failed = true;
        resolve(this.available);
      };
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    });
  }

  /** Speaks immediately, cutting off anything still being said. */
  say(text: string, onFail?: () => void): void {
    if (!this.available) {
      onFail?.();
      return;
    }
    const u = this.utterance(text);
    u.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      this.failed = true;
      onFail?.();
    };
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  cancel(): void {
    if (Speaker.isSupported()) speechSynthesis.cancel();
  }

  private utterance(text: string): SpeechSynthesisUtterance {
    const u = new SpeechSynthesisUtterance(text);
    if (this.voice) u.voice = this.voice;
    u.lang = this.voice?.lang ?? 'en-US';
    u.rate = 1.3;
    u.volume = 1;
    return u;
  }

  private pickVoice(): void {
    const voices = speechSynthesis.getVoices();
    const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    // Prefer an on-device voice: network voices add latency and fail offline.
    this.voice = english.find((v) => v.localService) ?? english[0] ?? voices[0] ?? null;
  }
}
