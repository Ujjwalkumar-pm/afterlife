import { describe, expect, it } from 'vitest';
import { canBonus, cellStatus, coverage, hasFreeTile, isStuck, previewScrap } from '../../src/engine/queries';
import { makeState, putObject, putPlant } from './helpers';

describe('coverage', () => {
  it('is 0 for an empty level', () => {
    expect(coverage(makeState())).toBe(0);
  });
  it('counts stage >= 1 cells over non-blocked tiles only', () => {
    const s = makeState({ ground: ['XXXXX', '.....', '.....', '.....', '.....'] });
    putPlant(s, 0, 1, 'moss', 1);
    putPlant(s, 1, 1, 'moss', 2);
    putPlant(s, 2, 1, 'moss', 0);
    expect(coverage(s)).toBeCloseTo(2 / 20);
  });
});

describe('cellStatus', () => {
  it('reports each state', () => {
    const s = makeState({ ground: ['.X...', 'X....', '.....', '.....', '.....'] });
    putPlant(s, 4, 4, 'moss', 0);
    putPlant(s, 3, 3, 'vine', 2);
    putPlant(s, 2, 2, 'flower', 3);
    putPlant(s, 0, 0, 'moss', 2);
    expect(cellStatus(s, { x: 1, y: 2 })).toBeNull();
    expect(cellStatus(s, { x: 4, y: 4 })).toBe('seed');
    expect(cellStatus(s, { x: 3, y: 3 })).toBe('growing');
    expect(cellStatus(s, { x: 2, y: 2 })).toBe('grown');
    expect(cellStatus(s, { x: 0, y: 0 })).toBe('blocked');
  });
});

describe('isStuck / canBonus', () => {
  it('is not stuck when scrap simply ran out (a bonus is available instead)', () => {
    const s = makeState();
    s.tray = [];
    expect(isStuck(s)).toBe(false);
    expect(canBonus(s)).toBe(true);
  });
  it('is stuck only when no tile is free', () => {
    const s = makeState({ width: 2, height: 1, ground: ['..'] });
    putPlant(s, 0, 0, 'moss', 0);
    putPlant(s, 1, 0, 'moss', 0);
    expect(hasFreeTile(s)).toBe(false);
    expect(isStuck(s)).toBe(true);
    s.won = true;
    expect(isStuck(s)).toBe(false);
  });
  it('canBonus needs room for both the seed and the scrap (2 free tiles)', () => {
    const s = makeState({ width: 2, height: 1, ground: ['..'] });
    s.tray = [];
    expect(canBonus(s)).toBe(true);
    putPlant(s, 0, 0, 'moss', 1);
    expect(canBonus(s)).toBe(false);
  });
  it('canBonus is false without a free tile, while scrap remains, or after winning', () => {
    const full = makeState({ width: 1, height: 1, ground: ['.'] });
    putPlant(full, 0, 0, 'moss', 0);
    full.tray = [];
    expect(canBonus(full)).toBe(false);
    expect(canBonus(makeState())).toBe(false);
    const won = makeState();
    won.tray = [];
    won.won = true;
    expect(canBonus(won)).toBe(false);
  });
});


describe('previewScrap', () => {
  it('lists plant cells within the radius of the slot\'s scrap', () => {
    const s = makeState({ batches: [['tyre', 'car']] });
    putPlant(s, 2, 2, 'moss', 0);
    putPlant(s, 0, 0, 'moss', 0);
    expect(previewScrap(s, 0, { x: 2, y: 3 })).toEqual([{ x: 2, y: 2 }]);
    expect(previewScrap(s, 1, { x: 2, y: 3 })).toEqual([{ x: 2, y: 2 }]);
    expect(previewScrap(s, 1, { x: 1, y: 1 })).toEqual([{ x: 0, y: 0 }, { x: 2, y: 2 }]);
  });
  it('returns [] for an invalid slot or position', () => {
    const s = makeState();
    expect(previewScrap(s, 99, { x: 0, y: 0 })).toEqual([]);
    expect(previewScrap(s, 0, { x: -1, y: 0 })).toEqual([]);
  });
});

describe('isStuck with no free tile', () => {
  it('is true when scrap remains but every tile is blocked, planted or occupied', () => {
    const s = makeState({ width: 3, height: 1, ground: ['X..'], seeds: {}, batches: [['tyre']] });
    putPlant(s, 1, 0, 'moss', 0);
    putObject(s, 2, 0, 'bin', 'small', 'ruin');
    expect(isStuck(s)).toBe(true);
  });
});

describe('isStuck: no possible move and no bonus', () => {
  it('is stuck with one free tile, no seeds, no scrap and no room for a bonus pack', () => {
    const s = makeState({ width: 2, height: 1, ground: ['..'], seeds: {} });
    putPlant(s, 0, 0, 'moss', 1);
    s.tray = [];
    expect(hasFreeTile(s)).toBe(true);
    expect(canBonus(s)).toBe(false);
    expect(isStuck(s)).toBe(true);
  });
  it('is not stuck while a seed can still be planted, or a bloom harvested', () => {
    const s = makeState({ width: 2, height: 1, ground: ['..'], seeds: { moss: 1 } });
    putPlant(s, 0, 0, 'moss', 1);
    s.tray = [];
    expect(isStuck(s)).toBe(false);
    const b = makeState({ width: 1, height: 1, ground: ['.'], seeds: {} });
    putPlant(b, 0, 0, 'flower', 3);
    b.tiles[0]!.plant!.bloom = true;
    expect(isStuck(b)).toBe(false);
  });
});
