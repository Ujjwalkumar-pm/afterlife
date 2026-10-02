import { describe, expect, it } from 'vitest';
import { depth, fromView, sceneBounds, toGrid, toScreen, toView, viewSize, type IsoView, type Rotation } from '../../src/render/iso/projection';

const ROTATIONS: Rotation[] = [0, 1, 2, 3];
const view = (rotation: Rotation, width = 3, height = 5): IsoView => ({ width, height, rotation, tileW: 64, tileH: 32 });
const allTiles = (w: number, h: number) => Array.from({ length: w * h }, (_, i) => ({ x: i % w, y: Math.floor(i / w) }));

describe('rotation', () => {
  it('rotation 0 is the identity', () => {
    expect(toView(view(0), { x: 2, y: 4 })).toEqual({ x: 2, y: 4 });
  });
  it('rotation 1 turns (x, y) into (height-1-y, x) and swaps dimensions', () => {
    expect(toView(view(1), { x: 0, y: 0 })).toEqual({ x: 4, y: 0 });
    expect(viewSize(view(1))).toEqual({ width: 5, height: 3 });
  });
  it('rotation 2 maps the first tile to the far corner', () => {
    expect(toView(view(2), { x: 0, y: 0 })).toEqual({ x: 2, y: 4 });
  });
  it('fromView inverts toView for every tile in every rotation', () => {
    for (const r of ROTATIONS) for (const p of allTiles(3, 5)) expect(fromView(view(r), toView(view(r), p))).toEqual(p);
  });
  it('maps tiles into the view rectangle without collisions', () => {
    for (const r of ROTATIONS) {
      const { width, height } = viewSize(view(r));
      const seen = new Set<string>();
      for (const p of allTiles(3, 5)) {
        const q = toView(view(r), p);
        expect(q.x >= 0 && q.x < width && q.y >= 0 && q.y < height).toBe(true);
        seen.add(`${q.x},${q.y}`);
      }
      expect(seen.size).toBe(15);
    }
  });
});

describe('screen', () => {
  it('places view (0,0) at the origin and steps by half a tile', () => {
    expect(toScreen(view(0), { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(toScreen(view(0), { x: 1, y: 0 })).toEqual({ x: 32, y: 16 });
    expect(toScreen(view(0), { x: 0, y: 1 })).toEqual({ x: -32, y: 16 });
  });
  it('toGrid inverts toScreen for every tile in every rotation, including off-centre points', () => {
    for (const r of ROTATIONS) {
      for (const p of allTiles(3, 5)) {
        const c = toScreen(view(r), p);
        expect(toGrid(view(r), c.x, c.y)).toEqual(p);
        expect(toGrid(view(r), c.x + 12, c.y + 4)).toEqual(p);
        expect(toGrid(view(r), c.x - 10, c.y - 5)).toEqual(p);
      }
    }
  });
  it('returns null outside the grid', () => {
    expect(toGrid(view(0), -500, -500)).toBeNull();
    expect(toGrid(view(0), 0, -40)).toBeNull();
  });
  it('depth grows toward the viewer', () => {
    expect(depth(view(0), { x: 1, y: 1 })).toBeGreaterThan(depth(view(0), { x: 0, y: 0 }));
  });
  it('sceneBounds spans every tile with room above for tall objects', () => {
    for (const r of ROTATIONS) {
      const b = sceneBounds(view(r));
      const left = b.centerX - b.width / 2;
      const top = b.centerY - b.height / 2;
      for (const p of allTiles(3, 5)) {
        const c = toScreen(view(r), p);
        expect(c.x - 32).toBeGreaterThanOrEqual(left - 0.001);
        expect(c.x + 32).toBeLessThanOrEqual(left + b.width + 0.001);
        expect(c.y - 16 - 60).toBeGreaterThanOrEqual(top - 0.001);
      }
    }
    expect(sceneBounds(view(0, 3, 2)).width).toBe(160);
  });
});
