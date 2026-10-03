import { describe, expect, it } from 'vitest';
import { SCRAP_KINDS } from '../../src/engine';
import { LEVELS } from '../../src/levels';
import { darken, lerpColor, lighten } from '../../src/render/palette';
import { hasObjectShape, objectBlocks, objectTopHeight, OBJECTS, rotateBlock, type Block } from '../../src/render/objects/objectShapes';
import { plantPrims, primBounds, offsetPrims, scalePrims, type PlantDrawInput, type Prim } from '../../src/render/plants/plantShapes';

describe('palette', () => {
  it('lerps channels and clamps t', () => {
    expect(lerpColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(lerpColor(0x102030, 0xffffff, -1)).toBe(0x102030);
    expect(lerpColor(0x102030, 0xffffff, 2)).toBe(0xffffff);
  });
  it('lightens and darkens', () => {
    expect(lighten(0x808080, 0.5)).toBe(0xc0c0c0);
    expect(darken(0x808080, 0.5)).toBe(0x404040);
  });
});

describe('object shapes', () => {
  it('has a shape for every scrap kind and every ruin used by the levels', () => {
    for (const kind of SCRAP_KINDS) expect(hasObjectShape(kind), kind).toBe(true);
    for (const level of LEVELS) for (const ruin of level.ruins) expect(hasObjectShape(ruin.name), ruin.name).toBe(true);
  });
  it('falls back to a crate for unknown names', () => {
    expect(objectBlocks('piano', 0)).toEqual(OBJECTS.crate);
  });
  it('rotating a quarter turn moves offsets and swaps box footprints; four turns is identity', () => {
    const b = { shape: 'box' as const, x: 0.3, y: 0.1, w: 0.8, d: 0.2, z: 0, h: 5, color: 1 };
    expect(rotateBlock(b, 1)).toEqual({ ...b, x: -0.1, y: 0.3, w: 0.2, d: 0.8 });
    let r: Block = b;
    for (let i = 0; i < 4; i++) r = rotateBlock(r, 1);
    expect(r.x).toBeCloseTo(b.x);
    expect(r.y).toBeCloseTo(b.y);
    expect(r).toMatchObject({ w: b.w, d: b.d });
  });
  it('reports the top height of an object', () => {
    expect(objectTopHeight('crate')).toBeGreaterThan(10);
    expect(objectTopHeight('swings')).toBeGreaterThan(objectTopHeight('tyre'));
  });
});

const input = (over: Partial<PlantDrawInput> = {}): PlantDrawInput => ({ type: 'moss', stage: 1, bloom: false, plantId: 3, x: 2, y: 2, objectHeight: 0, ...over });
const minY = (prims: Prim[]) =>
  Math.min(...prims.map((p) => (p.kind === 'ellipse' ? p.y - p.h / 2 : p.kind === 'circle' ? p.y - p.r : Math.min(...p.points.filter((_, i) => i % 2 === 1)))));

describe('plant shapes', () => {
  it('draws a single seed mound at stage 0', () => {
    expect(plantPrims(input({ stage: 0 }))).toHaveLength(1);
  });
  it('is deterministic per plant and position', () => {
    expect(plantPrims(input({ type: 'vine', stage: 2 }))).toEqual(plantPrims(input({ type: 'vine', stage: 2 })));
    expect(plantPrims(input({ stage: 2, x: 1 }))).not.toEqual(plantPrims(input({ stage: 2, x: 3 })));
  });
  it('grows fuller moss with stage', () => {
    expect(plantPrims(input({ stage: 2 })).length).toBeGreaterThan(plantPrims(input({ stage: 1 })).length);
  });
  it('adds petals when a flower blooms', () => {
    const bud = plantPrims(input({ type: 'flower', stage: 3 }));
    const bloom = plantPrims(input({ type: 'flower', stage: 3, bloom: true }));
    expect(bloom.length).toBeGreaterThanOrEqual(bud.length + 6);
  });
  it('grows taller bamboo with stage', () => {
    expect(minY(plantPrims(input({ type: 'bamboo', stage: 5 })))).toBeLessThan(minY(plantPrims(input({ type: 'bamboo', stage: 1 }))));
  });
  it('vines climb objects they grow on', () => {
    expect(minY(plantPrims(input({ type: 'vine', stage: 3, objectHeight: 24 })))).toBeLessThan(-24 * 0.4);
  });
  it('produces only finite numbers', () => {
    for (const type of ['moss', 'vine', 'flower', 'bamboo'] as const) {
      for (let stage = 0; stage <= 5; stage++) {
        const json = JSON.stringify(plantPrims(input({ type, stage, bloom: stage === 3, objectHeight: stage * 4 })));
        expect(json).not.toMatch(/null|NaN|Infinity/);
      }
    }
  });
});

describe('richer plants', () => {
  it('moss clumps have shadow, body and highlight tones', () => {
    const colors = new Set(plantPrims(input({ stage: 2 })).map((p) => p.color));
    expect(colors.size).toBeGreaterThanOrEqual(5);
  });
  it('vine leaves carry vein lines', () => {
    const prims = plantPrims(input({ type: 'vine', stage: 3 }));
    const stems = 4;
    expect(prims.filter((p) => p.kind === 'line').length).toBeGreaterThan(stems);
  });
  it('bamboo has leaf tufts on every pole', () => {
    const prims = plantPrims(input({ type: 'bamboo', stage: 5 }));
    expect(prims.filter((p) => p.kind === 'ellipse').length).toBeGreaterThanOrEqual(9);
  });
});

describe('prim geometry', () => {
  const prims: Prim[] = [
    { kind: 'ellipse', x: 0, y: 0, w: 10, h: 4, color: 1 },
    { kind: 'circle', x: 20, y: -10, r: 3, color: 1 },
    { kind: 'line', points: [-8, 5, -8, 12], width: 2, color: 1 },
  ];
  it('primBounds covers every primitive', () => {
    expect(primBounds(prims)).toEqual({ minX: -9, minY: -13, maxX: 23, maxY: 13 });
  });
  it('offsetPrims and scalePrims transform every coordinate', () => {
    expect(primBounds(offsetPrims(prims, 9, 13))).toEqual({ minX: 0, minY: 0, maxX: 32, maxY: 26 });
    expect(primBounds(scalePrims(prims, 2))).toEqual({ minX: -18, minY: -26, maxX: 46, maxY: 26 });
  });
});
