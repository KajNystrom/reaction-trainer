import type { Clock } from '../core/clock';
import type { Session } from '../core/session';

/**
 * Drives a Session in the browser: a timeout aimed at the next phase deadline
 * for accurate transitions, plus a slower interval so countdown numbers on
 * screen stay current.
 */
export class SessionDriver {
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly session: Session,
    private readonly clock: Clock,
    private readonly onFrame: () => void,
  ) {
    session.subscribe(() => this.schedule());
  }

  start(): void {
    this.interval ??= setInterval(() => {
      this.session.tick();
      this.onFrame();
    }, 100);
    this.schedule();
  }

  dispose(): void {
    if (this.timeout !== null) clearTimeout(this.timeout);
    if (this.interval !== null) clearInterval(this.interval);
    this.timeout = null;
    this.interval = null;
  }

  private schedule(): void {
    if (this.timeout !== null) clearTimeout(this.timeout);
    this.timeout = null;
    const deadline = this.session.nextDeadline();
    if (deadline === null || !Number.isFinite(deadline)) return;
    const delay = Math.max(0, deadline - this.clock.now());
    this.timeout = setTimeout(() => {
      this.timeout = null;
      this.session.tick();
      this.onFrame();
      // tick() emits on phase change, which reschedules; cover the no-change case.
      if (this.timeout === null) this.schedule();
    }, delay);
  }
}
