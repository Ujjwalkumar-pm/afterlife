import { describe, expect, it } from 'vitest';
import { diffTiles, islandCorners, plantTextureKey, plantVariant, rippleDelay, skyColors, swayFor, TextureLru, washDelays } from '../../src/render/scene/sceneMath';
import { makeState, putObject, putPlant } from '../engine/helpers';

describe('diffTiles', () => {
  it('reports every occupied tile as added when there is no previous state', () => {
    const s = putPlant(putObject(makeState(), 1, 1, 'tyre', 'small'), 2, 2, 'moss', 0);
    expect(diffTiles(null, s)).toEqual([
      { pos: { x: 1, y: 1 }, object: 'added', plant: null },
      { pos: { x: 2, y: 2 }, object: null, plant: 'added' },
    ]);
  });
  it('detects grew, bloomed, unbloomed and object removal', () => {
    const a = putObject(makeState(), 0, 0, 'tyre', 'small');
    putPlant(a, 1, 0, 'moss', 1);
    putPlant(a, 2, 0, 'flower', 3);
    const b = structuredClone(a);
    b.tiles[0]!.object = null;
    b.tiles[1]!.plant!.stage = 2;
    b.tiles[2]!.plant!.bloom = true;
    expect(diffTiles(a, b)).toEqual([
      { pos: { x: 0, y: 0 }, object: 'removed', plant: null },
      { pos: { x: 1, y: 0 }, object: null, plant: 'grew' },
      { pos: { x: 2, y: 0 }, object: null, plant: 'bloomed' },
    ]);
    expect(diffTiles(b, a).map((c) => c.plant)).toEqual([null, 'changed', 'unbloomed']);
  });
  it('diffTiles reports undo as changed or removed', () => {
    const a = makeState();
    const b = putPlant(structuredClone(a), 3, 3, 'moss', 1);
    expect(diffTiles(b, a)).toEqual([{ pos: { x: 3, y: 3 }, object: null, plant: 'removed' }]);
  });
  it('returns nothing for identical states', () => {
    const s = putPlant(makeState(), 1, 1, 'vine', 2);
    expect(diffTiles(s, structuredClone(s))).toEqual([]);
  });
});

describe('texture keys and cache', () => {
  it('builds stable keys from type, stage, bloom, height and a 0-3 variant', () => {
    const cell = { plantId: 5, type: 'moss' as const, stage: 2, bloom: false };
    const v = plantVariant(cell, 1, 2);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(4);
    expect(plantTextureKey(cell, 1, 2, 0)).toBe(`plant-moss-2-0-0-${v}`);
    expect(plantTextureKey({ ...cell, bloom: true }, 1, 2, 9)).toBe(`plant-moss-2-1-9-${v}`);
  });
  it('TextureLru evicts least-recently-used keys beyond the limit', () => {
    const lru = new TextureLru(2);
    expect(lru.touch('a', new Set())).toEqual([]);
    expect(lru.touch('b', new Set())).toEqual([]);
    lru.touch('a', new Set());
    expect(lru.touch('c', new Set())).toEqual(['b']);
    expect(lru.size).toBe(2);
  });
  it('TextureLru never evicts keys in use', () => {
    const lru = new TextureLru(1);
    lru.touch('a', new Set());
    expect(lru.touch('b', new Set(['a', 'b']))).toEqual([]);
    expect(lru.size).toBe(2);
    expect(lru.touch('c', new Set(['c']))).toEqual(['a', 'b']);
  });
});

describe('timings', () => {
  it('ripple delay grows with distance up to the full duration', () => {
    const c = { x: 2, y: 2 };
    expect(rippleDelay(c, c, 2)).toBe(0);
    expect(rippleDelay(c, { x: 3, y: 2 }, 2)).toBe(200);
    expect(rippleDelay(c, { x: 4, y: 2 }, 2)).toBe(400);
    expect(rippleDelay(c, { x: 4, y: 4 }, 2)).toBe(400);
    expect(rippleDelay(c, { x: 3, y: 2 }, 0)).toBe(0);
  });
  it('wash delays step 40 ms per tile from the origin and skip blocked tiles', () => {
    const s = makeState({ width: 3, height: 1, ground: ['.X.'] });
    expect(washDelays(s, { x: 0, y: 0 })).toEqual([
      { pos: { x: 0, y: 0 }, delay: 0 },
      { pos: { x: 2, y: 0 }, delay: 80 },
    ]);
  });
  it('sway amplitude rises from moss to bamboo, with a period of 2.4-3.6 s', () => {
    const deg = (t: 'moss' | 'vine' | 'flower' | 'bamboo') => (swayFor(t, 1, 1).amplitude * 180) / Math.PI;
    expect(deg('moss')).toBeCloseTo(1.5);
    expect(deg('vine')).toBeCloseTo(3);
    expect(deg('flower')).toBeCloseTo(4);
    expect(deg('bamboo')).toBeCloseTo(5);
    for (let x = 0; x < 8; x++) {
      const s = swayFor('moss', x, 7 - x);
      expect(s.period).toBeGreaterThanOrEqual(2400);
      expect(s.period).toBeLessThanOrEqual(3600);
    }
    expect(swayFor('moss', 1, 2).phase).not.toBe(swayFor('moss', 2, 1).phase);
  });
});

describe('atmosphere maths', () => {
  it('sky goes from dusty to golden and clamps', () => {
    expect(skyColors(0)).toEqual({ top: '#2c3540', bottom: '#4a4336' });
    expect(skyColors(1)).toEqual({ top: '#4f7262', bottom: '#d2a85e' });
    expect(skyColors(5)).toEqual(skyColors(1));
  });
  it('island corners wrap the whole board', () => {
    expect(islandCorners({ width: 6, height: 6, rotation: 0, tileW: 64, tileH: 32 })).toEqual({
      top: { x: 0, y: -16 },
      right: { x: 192, y: 80 },
      bottom: { x: 0, y: 176 },
      left: { x: -192, y: 80 },
    });
  });
});
