import { describe, expect, it } from 'vitest';
import { applyMove, harvest, placeScrap, placeSeed } from '../../src/engine/actions';
import { makeState, play, putObject, putPlant } from './helpers';

const at = (x: number, y: number) => ({ x, y });

describe('placeSeed', () => {
  it('plants a stage-0 cell, spends a seed and does not mutate the input', () => {
    const s = makeState();
    const before = structuredClone(s);
    const r = placeSeed(s, 'moss', at(1, 1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.tiles[6]!.plant).toEqual({ plantId: 1, type: 'moss', stage: 0, bloom: false });
    expect(r.state.seeds.moss).toBe(4);
    expect(r.events).toEqual([{ type: 'placedSeed', pos: at(1, 1), plant: 'moss' }]);
    expect(s).toEqual(before);
  });

  it('rejects out-of-bounds and blocked tiles without throwing', () => {
    const s = makeState({ ground: ['X....', '.....', '.....', '.....', '.....'] });
    expect(placeSeed(s, 'moss', at(-1, 0))).toEqual({ ok: false, reason: 'out of bounds' });
    expect(placeSeed(s, 'moss', at(5, 5))).toEqual({ ok: false, reason: 'out of bounds' });
    expect(placeSeed(s, 'moss', at(0.5, 0))).toEqual({ ok: false, reason: 'out of bounds' });
    expect(placeSeed(s, 'moss', at(0, 0))).toEqual({ ok: false, reason: 'tile is blocked' });
    expect(placeScrap(s, 0, at(0, 0))).toEqual({ ok: false, reason: 'tile is blocked' });
    expect(harvest(s, at(9, 9))).toEqual({ ok: false, reason: 'out of bounds' });
  });

  it('rejects planted tiles and objects the plant cannot grow on', () => {
    const s = makeState();
    putPlant(s, 0, 0, 'moss', 0);
    putObject(s, 1, 0, 'crate', 'medium');
    expect(placeSeed(s, 'vine', at(0, 0)).ok).toBe(false);
    expect(placeSeed(s, 'flower', at(1, 0)).ok).toBe(false);
    expect(placeSeed(s, 'moss', at(1, 0)).ok).toBe(false);
    expect(placeSeed(s, 'vine', at(1, 0)).ok).toBe(true);
  });

  it('rejects when no seeds left', () => {
    const s = makeState({ seeds: { moss: 1 } });
    const { state } = play(s, { type: 'seed', plant: 'moss', x: 0, y: 0 });
    expect(placeSeed(state, 'moss', at(1, 1))).toEqual({ ok: false, reason: 'no moss seeds left' });
    expect(placeSeed(state, 'vine', at(1, 1))).toEqual({ ok: false, reason: 'no vine seeds left' });
  });
});

describe('placeScrap', () => {
  it('places scrap, removes it from the tray and grows plants in range', () => {
    const s = makeState({ batches: [['tyre', 'crate']] });
    const { state, events } = play(s, { type: 'seed', plant: 'moss', x: 2, y: 2 }, { type: 'scrap', slot: 0, x: 2, y: 3 });
    expect(state.tiles[17]!.object).toEqual({ kind: 'scrap', name: 'tyre', size: 'small' });
    expect(state.tray).toEqual(['crate']);
    expect(state.tiles[12]!.plant!.stage).toBe(1);
    expect(events.slice(1)).toEqual([
      { type: 'placedScrap', pos: at(2, 3), scrap: 'tyre' },
      { type: 'grew', pos: at(2, 2), stage: 1 },
    ]);
  });

  it('placing a seed causes no growth', () => {
    const s = makeState();
    putPlant(s, 0, 0, 'moss', 0);
    const { state } = play(s, { type: 'seed', plant: 'moss', x: 0, y: 1 });
    expect(state.tiles[0]!.plant!.stage).toBe(0);
  });

  it('rejects tiles with an object or plant, and invalid slots', () => {
    const s = makeState({ ruins: [{ x: 0, y: 0, name: 'bench', size: 'small' }] });
    putPlant(s, 1, 1, 'moss', 0);
    expect(placeScrap(s, 0, at(0, 0))).toEqual({ ok: false, reason: 'tile already has an object' });
    expect(placeScrap(s, 0, at(1, 1))).toEqual({ ok: false, reason: 'tile has a plant' });
    expect(placeScrap(s, 9, at(2, 2))).toEqual({ ok: false, reason: 'no scrap in slot 9' });
  });

  it('loads the next batch when the tray empties', () => {
    const s = makeState({ batches: [['tyre'], ['can', 'cone']] });
    const { state, events } = play(s, { type: 'scrap', slot: 0, x: 0, y: 0 });
    expect(state.tray).toEqual(['can', 'cone']);
    expect(state.batches).toEqual([]);
    expect(events).toContainEqual({ type: 'newBatch', tray: ['can', 'cone'] });
  });

  it('emits stuck when the last scrap is used without reaching the target, then rejects further scrap', () => {
    const s = makeState({ batches: [['tyre']] });
    const { state, events } = play(s, { type: 'scrap', slot: 0, x: 0, y: 0 });
    expect(events.at(-1)).toEqual({ type: 'stuck' });
    expect(placeScrap(state, 0, at(1, 1))).toEqual({ ok: false, reason: 'no scrap in slot 0' });
  });
});

describe('winning', () => {
  it('emits won once when coverage first reaches the target, and stays won', () => {
    const s = makeState({ width: 3, height: 1, ground: ['...'], target: 0.3, batches: [['tyre', 'tyre']] });
    const first = play(s, { type: 'seed', plant: 'moss', x: 0, y: 0 }, { type: 'scrap', slot: 0, x: 1, y: 0 });
    expect(first.events.filter((e) => e.type === 'won')).toHaveLength(1);
    expect(first.state.won).toBe(true);
    const second = play(first.state, { type: 'seed', plant: 'flower', x: 2, y: 0 });
    expect(second.events.some((e) => e.type === 'won')).toBe(false);
    expect(second.state.won).toBe(true);
  });
});

describe('harvest', () => {
  it('removes the bloom and gives a seed of the flower\'s own type by default', () => {
    const s = makeState();
    putPlant(s, 2, 2, 'flower', 3);
    s.tiles[12]!.plant!.bloom = true;
    const r = harvest(s, at(2, 2));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.tiles[12]!.plant!.bloom).toBe(false);
    expect(r.state.seeds.flower).toBe(6);
    expect(r.events).toEqual([{ type: 'harvested', pos: at(2, 2), seed: 'flower' }]);
  });

  it('gives the level\'s harvestYield type when set', () => {
    const s = makeState({ harvestYield: 'moss' });
    putPlant(s, 2, 2, 'flower', 3);
    s.tiles[12]!.plant!.bloom = true;
    const r = harvest(s, at(2, 2));
    expect(r.ok && r.state.seeds.moss).toBe(6);
  });

  it('rejects harvest without a bloom', () => {
    const s = makeState();
    putPlant(s, 2, 2, 'flower', 3);
    expect(harvest(s, at(2, 2))).toEqual({ ok: false, reason: 'nothing to harvest' });
    expect(harvest(s, at(0, 0))).toEqual({ ok: false, reason: 'nothing to harvest' });
  });
});

describe('applyMove', () => {
  it('dispatches each move type', () => {
    const s = makeState();
    expect(applyMove(s, { type: 'seed', plant: 'moss', x: 0, y: 0 }).ok).toBe(true);
    expect(applyMove(s, { type: 'scrap', slot: 0, x: 0, y: 0 }).ok).toBe(true);
    expect(applyMove(s, { type: 'harvest', x: 0, y: 0 }).ok).toBe(false);
  });
});

describe('malformed moves from JSON or UI', () => {
  it('rejects an unknown plant type without throwing', () => {
    const s = makeState();
    expect(placeSeed(s, 'cactus' as never, at(0, 0))).toEqual({ ok: false, reason: 'unknown plant' });
    expect(placeSeed(s, 'toString' as never, at(0, 0))).toEqual({ ok: false, reason: 'unknown plant' });
  });
  it('rejects an unknown or missing move without throwing', () => {
    const s = makeState();
    expect(applyMove(s, { type: 'water', x: 0, y: 0 } as never)).toEqual({ ok: false, reason: 'unknown move' });
    expect(applyMove(s, null as never)).toEqual({ ok: false, reason: 'unknown move' });
  });
});

describe('stuck when scrap has nowhere to go', () => {
  it('emits stuck when scrap remains but no tile can take it', () => {
    const s = makeState({ width: 2, height: 1, ground: ['..'], seeds: { moss: 2 }, batches: [['tyre']] });
    const { events } = play(s, { type: 'seed', plant: 'moss', x: 0, y: 0 }, { type: 'seed', plant: 'moss', x: 1, y: 0 });
    expect(events.at(-1)).toEqual({ type: 'stuck' });
  });
});
