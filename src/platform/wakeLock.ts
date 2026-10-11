export type WakeLockStatus = 'unsupported' | 'off' | 'on' | 'failed';

/**
 * Keeps the screen on during a session. The browser releases the lock when
 * the page is hidden (screen off, app switch), so it is requested again when
 * the page becomes visible while still wanted.
 */
export class WakeLockManager {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;
  private status: WakeLockStatus = WakeLockManager.isSupported() ? 'off' : 'unsupported';

  constructor(private readonly onStatus: (s: WakeLockStatus) => void = () => {}) {
    document.addEventListener('visibilitychange', () => {
      if (this.wanted && document.visibilityState === 'visible') void this.request();
    });
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  getStatus(): WakeLockStatus {
    return this.status;
  }

  async acquire(): Promise<void> {
    this.wanted = true;
    await this.request();
  }

  async release(): Promise<void> {
    this.wanted = false;
    const s = this.sentinel;
    this.sentinel = null;
    if (s && !s.released) await s.release().catch(() => {});
    if (this.status !== 'unsupported') this.setStatus('off');
  }

  private async request(): Promise<void> {
    if (!WakeLockManager.isSupported() || (this.sentinel && !this.sentinel.released)) return;
    try {
      const s = await navigator.wakeLock.request('screen');
      if (!this.wanted) {
        await s.release();
        return;
      }
      this.sentinel = s;
      s.addEventListener('release', () => {
        if (this.sentinel === s) this.sentinel = null;
        if (this.wanted) this.setStatus('off');
      });
      this.setStatus('on');
    } catch {
      // Denied, e.g. battery saver or the page is not visible.
      this.setStatus('failed');
    }
  }

  private setStatus(s: WakeLockStatus): void {
    this.status = s;
    this.onStatus(s);
  }
}
