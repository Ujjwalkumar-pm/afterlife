/**
 * Decides whether a pointer release on the canvas counts as a tap. A tap needs its press on the
 * canvas (not dragged in from the HTML layer) and is never part of a two-finger pinch; the pinch
 * only ends once every finger is up, so the next single tap works normally.
 */
export class TapGate {
  private pressed = false;
  pinching = false;

  down(): void {
    this.pressed = true;
  }

  pinch(): void {
    this.pinching = true;
  }

  /** `anyDown`: whether any pointer is still pressed after this release. */
  up(anyDown: boolean): boolean {
    if (this.pinching) {
      if (!anyDown) {
        this.pinching = false;
        this.pressed = false;
      }
      return false;
    }
    const tap = this.pressed;
    this.pressed = false;
    return tap;
  }
}
