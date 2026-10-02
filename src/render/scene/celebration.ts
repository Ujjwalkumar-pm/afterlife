/** Runs `fn` after `ms`; returns a function that cancels it. */
export type Schedule = (ms: number, fn: () => void) => () => void;

interface Rotatable {
  rotate(dir: 1 | -1): void;
}

/**
 * The win "camera turn": four quarter-turns of one controller. Cancellable, so leaving the
 * level (Next, Menu, title demo) never spins whatever is shown next.
 */
export class Celebration {
  private cancels: (() => void)[] = [];

  constructor(private readonly schedule: Schedule) {}

  get running(): boolean {
    return this.cancels.length > 0;
  }

  start(ctrl: Rotatable, stepMs: number): void {
    this.cancel();
    for (let i = 1; i <= 4; i++) {
      const cancel = this.schedule(stepMs * i, () => {
        ctrl.rotate(1);
        if (i === 4) this.cancels = [];
      });
      this.cancels.push(cancel);
    }
  }

  cancel(): void {
    for (const c of this.cancels) c();
    this.cancels = [];
  }
}
