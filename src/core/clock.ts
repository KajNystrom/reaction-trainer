/** Monotonic milliseconds. Injected so session logic can run on a fake clock in tests. */
export interface Clock {
  now(): number;
}

export const performanceClock: Clock = {
  now: () => performance.now(),
};

/** Manually advanced clock for tests. */
export class FakeClock implements Clock {
  constructor(private t = 0) {}
  now(): number {
    return this.t;
  }
  set(t: number): void {
    this.t = t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}
