import { describe, expect, it } from 'vitest';
import { TapGate } from '../../src/render/scene/tapGate';

describe('TapGate', () => {
  it('treats a press and release on the canvas as a tap', () => {
    const g = new TapGate();
    g.down();
    expect(g.up(false)).toBe(true);
  });
  it('ignores a release whose press started elsewhere (dragged off a tray button)', () => {
    expect(new TapGate().up(false)).toBe(false);
  });
  it('never taps during a pinch, and the next tap after the pinch works', () => {
    const g = new TapGate();
    g.down();
    g.down();
    g.pinch();
    expect(g.up(true)).toBe(false); // first finger lifts, second still down
    expect(g.up(false)).toBe(false); // second finger lifts: pinch over
    expect(g.pinching).toBe(false);
    g.down();
    expect(g.up(false)).toBe(true);
  });
});
