import { describe, expect, it } from 'vitest';
import { placeScrap, placeSeed } from '../../src/engine';
import { bestTile, suggestMove } from '../../src/game/hints';
import { makeState, putObject, putPlant } from '../engine/helpers';

describe('bestTile', () => {
  it('returns null with no selection', () => {
    expect(bestTile(makeState(), null)).toBeNull();
  });
  it('for scrap picks the tile that grows the most new cover', () => {
    const s = makeState({ batches: [['tyre']] });
    putPlant(s, 1, 1, 'moss', 0);
    putPlant(s, 3, 1, 'moss', 0);
    expect(bestTile(s, { kind: 'scrap', slot: 0 })).toEqual({ x: 2, y: 1 });
  });
  it('for seeds prefers tiles near existing plants', () => {
    const s = makeState();
    putPlant(s, 4, 4, 'moss', 1);
    const t = bestTile(s, { kind: 'seed', plant: 'moss' })!;
    expect(Math.abs(t.x - 4) + Math.abs(t.y - 4)).toBeLessThanOrEqual(2);
  });
  it('bestTile only returns tiles where the move is valid', () => {
    const s = makeState({ ground: ['XXXXX', 'X...X', 'X...X', 'X...X', 'XXXXX'], batches: [['crate']] });
    putObject(s, 2, 2, 'bin', 'small', 'ruin');
    putPlant(s, 1, 1, 'moss', 1);
    const scrap = bestTile(s, { kind: 'scrap', slot: 0 })!;
    expect(placeScrap(s, 0, scrap).ok).toBe(true);
    const seed = bestTile(s, { kind: 'seed', plant: 'flower' })!;
    expect(placeSeed(s, 'flower', seed).ok).toBe(true);
  });
  it('returns null when nothing is valid', () => {
    const s = makeState({ width: 1, height: 1, ground: ['.'] });
    putPlant(s, 0, 0, 'moss', 0);
    expect(bestTile(s, { kind: 'scrap', slot: 0 })).toBeNull();
    expect(bestTile(s, { kind: 'scrap', slot: 9 })).toBeNull();
  });
});

describe('bestTile points at blooms first', () => {
  it('suggests harvesting a bloom whatever is selected', () => {
    const s = makeState();
    putPlant(s, 3, 3, 'flower', 3);
    s.tiles[3 * 5 + 3]!.plant!.bloom = true;
    expect(bestTile(s, { kind: 'seed', plant: 'moss' })).toEqual({ x: 3, y: 3 });
    expect(bestTile(s, null)).toEqual({ x: 3, y: 3 });
  });
});

describe('suggestMove (the idle hint picks the most useful item and tile)', () => {
  it('switches from useless scrap to a seed when scrap cannot grow anything', () => {
    const s = makeState({ batches: [['tyre']], seeds: { moss: 2 } });
    const m = suggestMove(s, { kind: 'scrap', slot: 0 })!;
    expect(m.selection).toEqual({ kind: 'seed', plant: 'moss' });
  });
  it('prefers scrap that adds new cover', () => {
    const s = makeState({ batches: [['tyre']], seeds: { moss: 2 } });
    putPlant(s, 2, 2, 'moss', 0);
    const m = suggestMove(s, { kind: 'seed', plant: 'moss' })!;
    expect(m.selection).toEqual({ kind: 'scrap', slot: 0 });
    expect(Math.abs(m.tile.x - 2) + Math.abs(m.tile.y - 2)).toBe(1);
  });
  it('suggests harvesting a bloom and keeps the selection', () => {
    const s = makeState();
    putPlant(s, 1, 1, 'flower', 3);
    s.tiles[6]!.plant!.bloom = true;
    expect(suggestMove(s, { kind: 'seed', plant: 'moss' })).toEqual({ selection: { kind: 'seed', plant: 'moss' }, tile: { x: 1, y: 1 } });
  });
  it('returns null when nothing can be placed', () => {
    const s = makeState({ width: 1, height: 1, ground: ['.'], seeds: {}, batches: [['tyre']] });
    putPlant(s, 0, 0, 'moss', 0);
    expect(suggestMove(s, null)).toBeNull();
  });
});
