import { describe, expect, it } from 'vitest';
import { PLANTS, RADIUS, SCRAP } from '../../src/engine/catalog';
import { manhattan, neighbours } from '../../src/engine/grid';
import { nextRandom, pickIndex } from '../../src/engine/rng';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    expect(nextRandom(42)).toEqual(nextRandom(42));
  });
  it('returns values in [0, 1) and advances the seed', () => {
    let seed = 7;
    const values = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const [v, next] = nextRandom(seed);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      values.add(v);
      seed = next;
    }
    expect(values.size).toBeGreaterThan(90);
  });
  it('pickIndex stays within range', () => {
    let seed = 1;
    for (let i = 0; i < 50; i++) {
      const [index, next] = pickIndex(seed, 3);
      expect([0, 1, 2]).toContain(index);
      seed = next;
    }
  });
});

describe('catalog', () => {
  it('maps sizes to radii', () => {
    expect(RADIUS).toEqual({ small: 1, medium: 2, large: 3 });
    expect(SCRAP.tyre.size).toBe('small');
    expect(SCRAP.crate.size).toBe('medium');
    expect(SCRAP.car.size).toBe('large');
  });
  it('knows where each plant can grow', () => {
    const small = { kind: 'scrap' as const, name: 'tyre', size: 'small' as const };
    const medium = { kind: 'ruin' as const, name: 'tank', size: 'medium' as const };
    expect(PLANTS.moss.growsOn(null)).toBe(true);
    expect(PLANTS.moss.growsOn(small)).toBe(true);
    expect(PLANTS.moss.growsOn(medium)).toBe(false);
    expect(PLANTS.vine.growsOn(medium)).toBe(true);
    expect(PLANTS.flower.growsOn(small)).toBe(false);
    expect(PLANTS.bamboo.growsOn(null)).toBe(true);
    expect([PLANTS.moss.maxStage, PLANTS.vine.maxStage, PLANTS.flower.maxStage, PLANTS.bamboo.maxStage]).toEqual([2, 3, 3, 5]);
  });
});

describe('grid', () => {
  const s = { width: 3, height: 3 };
  it('measures manhattan distance', () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 2, y: 1 })).toBe(3);
  });
  it('lists in-bounds orthogonal neighbours', () => {
    expect(neighbours(s, { x: 0, y: 0 })).toEqual([{ x: 1, y: 0 }, { x: 0, y: 1 }]);
    expect(neighbours(s, { x: 1, y: 1 })).toHaveLength(4);
  });
});
