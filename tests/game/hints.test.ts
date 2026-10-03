import { describe, expect, it } from 'vitest';
import { placeScrap, placeSeed } from '../../src/engine';
import { bestTile } from '../../src/game/hints';
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
