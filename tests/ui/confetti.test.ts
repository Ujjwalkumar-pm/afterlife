// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { CONFETTI_COLORS, launchConfetti, makeConfetti } from '../../src/ui/confetti';

const seq = (vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length]!;
};

describe('makeConfetti', () => {
  it('makes n pieces in the palette, bursting from both side edges upward and inward', () => {
    const pieces = makeConfetti(140, 1000, 600, seq([0.1, 0.5, 0.9, 0.3]));
    expect(pieces).toHaveLength(140);
    for (const [i, p] of pieces.entries()) {
      expect(CONFETTI_COLORS).toContain(p.color);
      expect(p.vy).toBeLessThan(0);
      if (i % 2 === 0) {
        expect(p.x).toBe(0);
        expect(p.vx).toBeGreaterThan(0);
      } else {
        expect(p.x).toBe(1000);
        expect(p.vx).toBeLessThan(0);
      }
      expect(p.y).toBeGreaterThan(300);
      expect(p.size).toBeGreaterThan(0);
    }
  });
});

describe('launchConfetti', () => {
  it('does nothing with reduced motion', () => {
    document.body.innerHTML = '<div id="ui"></div>';
    expect(launchConfetti(document.getElementById('ui')!, { reducedMotion: true })).toBeNull();
    expect(document.querySelector('.confetti')).toBeNull();
  });
});
