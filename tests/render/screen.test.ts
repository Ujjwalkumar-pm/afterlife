import { describe, expect, it } from 'vitest';
import { renderScale, swipeTurn } from '../../src/render/scene/screen';

describe('renderScale', () => {
  it('follows the device pixel ratio, at least 1 and capped at 2', () => {
    expect(renderScale(1)).toBe(1);
    expect(renderScale(1.5)).toBe(1.5);
    expect(renderScale(2)).toBe(2);
    expect(renderScale(3)).toBe(2);
    expect(renderScale(0)).toBe(1);
    expect(renderScale(Number.NaN)).toBe(1);
  });
});

describe('swipeTurn', () => {
  it('turns a quarter for a mostly horizontal drag of at least 48 CSS px', () => {
    expect(swipeTurn(60, 5)).toBe(-1);
    expect(swipeTurn(-60, 5)).toBe(1);
  });
  it('ignores short, vertical or diagonal drags and taps', () => {
    expect(swipeTurn(40, 0)).toBe(0);
    expect(swipeTurn(10, 80)).toBe(0);
    expect(swipeTurn(60, 50)).toBe(0);
    expect(swipeTurn(0, 0)).toBe(0);
  });
});
