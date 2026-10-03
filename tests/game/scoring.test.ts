import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine';
import { comboFor, milestonesCrossed, starsFor } from '../../src/game/scoring';
import { makeLevel, makeState } from '../engine/helpers';

const p = { x: 0, y: 0 };
const grows = (n: number): GameEvent[] => Array.from({ length: n }, () => ({ type: 'grew', pos: p, stage: 1 }) as GameEvent);
const scrap: GameEvent = { type: 'placedScrap', pos: p, scrap: 'tyre' };

describe('comboFor', () => {
  it('needs a scrap placement and at least 4 growth events', () => {
    expect(comboFor(grows(6))).toBeNull();
    expect(comboFor([scrap, ...grows(3)])).toBeNull();
  });
  it('labels by size, counting spreads too', () => {
    expect(comboFor([scrap, ...grows(4)])).toEqual({ size: 4, label: 'Nice!' });
    expect(comboFor([scrap, ...grows(5), { type: 'spread', from: p, to: p, plant: 'moss' }, { type: 'spread', from: p, to: p, plant: 'moss' }])).toEqual({ size: 7, label: 'Lush!' });
    expect(comboFor([scrap, ...grows(11)])).toEqual({ size: 11, label: 'Wild!' });
  });
});

describe('starsFor', () => {
  const level = makeLevel({ batches: [['tyre', 'tyre'], ['tyre', 'tyre']] });
  it('gives 1 star when a bonus was used', () => {
    const s = makeState({ batches: level.batches });
    s.bonusUsed = 1;
    expect(starsFor(level, s)).toBe(1);
  });
  it('gives 3 stars with at least a quarter of the scrap left', () => {
    const s = makeState({ batches: level.batches });
    s.tray = ['tyre'];
    s.batches = [];
    expect(starsFor(level, s)).toBe(3);
  });
  it('gives 2 stars otherwise', () => {
    const s = makeState({ batches: level.batches });
    s.tray = [];
    s.batches = [];
    expect(starsFor(level, s)).toBe(2);
  });
});

describe('milestonesCrossed', () => {
  it('reports each threshold crossed upward', () => {
    expect(milestonesCrossed(0.1, 0.3)).toEqual([25]);
    expect(milestonesCrossed(0.2, 0.8)).toEqual([25, 50, 75]);
    expect(milestonesCrossed(0.5, 0.6)).toEqual([]);
    expect(milestonesCrossed(0.49, 0.5)).toEqual([50]);
    expect(milestonesCrossed(0.8, 0.2)).toEqual([]);
  });
});

describe('starsFor with hints', () => {
  const level = makeLevel({ batches: [['tyre', 'tyre'], ['tyre', 'tyre']] });
  const won = (over: { tray: ('tyre')[]; batches: never[]; bonusUsed?: number }) => {
    const s = makeState({ batches: level.batches });
    s.tray = over.tray;
    s.batches = over.batches;
    s.bonusUsed = over.bonusUsed ?? 0;
    return s;
  };
  it('no hints: unchanged', () => {
    expect(starsFor(level, won({ tray: ['tyre'], batches: [] }), 0)).toBe(3);
  });
  it('one hint caps at 2 stars', () => {
    expect(starsFor(level, won({ tray: ['tyre'], batches: [] }), 1)).toBe(2);
  });
  it('two or three hints cap at 1 star', () => {
    expect(starsFor(level, won({ tray: ['tyre'], batches: [] }), 2)).toBe(1);
    expect(starsFor(level, won({ tray: [], batches: [] }), 3)).toBe(1);
  });
  it('never raises a lower result', () => {
    expect(starsFor(level, won({ tray: [], batches: [], bonusUsed: 1 }), 1)).toBe(1);
  });
});
