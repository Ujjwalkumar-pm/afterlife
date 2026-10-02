import { describe, expect, it } from 'vitest';
import { eligibleNeighbours, growAround } from '../../src/engine/growth';
import type { GameEvent } from '../../src/engine/types';
import { makeState, putObject, putPlant } from './helpers';

const plantAt = (s: ReturnType<typeof makeState>, x: number, y: number) => s.tiles[y * s.width + x]!.plant;

describe('growAround', () => {
  it('raises the stage of cells within the radius', () => {
    const s = putPlant(makeState(), 2, 2, 'moss', 0);
    const events: GameEvent[] = [];
    growAround(s, { x: 2, y: 3 }, 1, events);
    expect(plantAt(s, 2, 2)!.stage).toBe(1);
    expect(events).toEqual([{ type: 'grew', pos: { x: 2, y: 2 }, stage: 1 }]);
  });

  it('uses a diamond (manhattan) radius', () => {
    const s = putPlant(makeState(), 1, 1, 'moss', 0);
    growAround(s, { x: 2, y: 2 }, 1, []);
    expect(plantAt(s, 1, 1)!.stage).toBe(0);
    growAround(s, { x: 2, y: 2 }, 2, []);
    expect(plantAt(s, 1, 1)!.stage).toBe(1);
  });

  it('spreads grown moss into one neighbour at stage 1 with the same plantId', () => {
    const s = putPlant(makeState(), 2, 2, 'moss', 2, 7);
    const rngBefore = s.rng;
    const events: GameEvent[] = [];
    growAround(s, { x: 2, y: 3 }, 1, events);
    const spread = events.find((e) => e.type === 'spread');
    expect(spread).toBeDefined();
    if (spread?.type !== 'spread') throw new Error('unreachable');
    expect(plantAt(s, spread.to.x, spread.to.y)).toEqual({ plantId: 7, type: 'moss', stage: 1, bloom: false });
    expect(s.rng).not.toBe(rngBefore);
  });

  it('does not tick cells created during the same pass', () => {
    const s = putPlant(makeState(), 2, 2, 'moss', 2);
    const events: GameEvent[] = [];
    growAround(s, { x: 2, y: 2 }, 2, events);
    const spread = events.find((e) => e.type === 'spread');
    if (spread?.type !== 'spread') throw new Error('expected a spread');
    expect(plantAt(s, spread.to.x, spread.to.y)!.stage).toBe(1);
  });

  it('vines prefer neighbours holding an object', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = makeState({ rngSeed: seed });
      putPlant(s, 2, 2, 'vine', 3);
      putObject(s, 2, 1, 'crate', 'medium');
      growAround(s, { x: 0, y: 0 }, 4, []);
      expect(plantAt(s, 2, 1)?.type).toBe('vine');
    }
  });

  it('marks grown moss as blocked when no neighbour is eligible', () => {
    const s = makeState({ ground: ['.X...', 'X....', '.....', '.....', '.....'] });
    putPlant(s, 0, 0, 'moss', 2);
    const events: GameEvent[] = [];
    growAround(s, { x: 0, y: 0 }, 1, events);
    expect(events).toEqual([{ type: 'blocked', pos: { x: 0, y: 0 } }]);
  });

  it('moss cannot spread onto a medium object', () => {
    const s = makeState({ ground: ['..X..', '.X...', '.....', '.....', '.....'] });
    putPlant(s, 0, 0, 'moss', 2);
    putObject(s, 0, 1, 'crate', 'medium');
    const events: GameEvent[] = [];
    growAround(s, { x: 0, y: 0 }, 1, events);
    expect(plantAt(s, 1, 0)?.type).toBe('moss');
    expect(plantAt(s, 0, 1)).toBeNull();
  });

  it('grown flowers bloom once', () => {
    const s = putPlant(makeState(), 2, 2, 'flower', 3);
    const first: GameEvent[] = [];
    growAround(s, { x: 2, y: 2 }, 1, first);
    expect(first).toEqual([{ type: 'bloomed', pos: { x: 2, y: 2 } }]);
    expect(plantAt(s, 2, 2)!.bloom).toBe(true);
    const second: GameEvent[] = [];
    growAround(s, { x: 2, y: 2 }, 1, second);
    expect(second).toEqual([]);
  });

  it('grown bamboo does nothing', () => {
    const s = putPlant(makeState(), 2, 2, 'bamboo', 5);
    const events: GameEvent[] = [];
    growAround(s, { x: 2, y: 2 }, 1, events);
    expect(events).toEqual([]);
    expect(plantAt(s, 2, 2)!.stage).toBe(5);
  });

  it('is deterministic for the same state', () => {
    const a = putPlant(makeState(), 2, 2, 'moss', 2);
    const b = putPlant(makeState(), 2, 2, 'moss', 2);
    growAround(a, { x: 2, y: 2 }, 2, []);
    growAround(b, { x: 2, y: 2 }, 2, []);
    expect(a).toEqual(b);
  });
});

describe('eligibleNeighbours', () => {
  it('excludes blocked tiles, planted tiles and objects the plant cannot grow on', () => {
    const s = makeState({ ground: ['.....', '..X..', '.....', '.....', '.....'] });
    putPlant(s, 1, 2, 'moss', 1);
    putObject(s, 3, 2, 'crate', 'medium');
    expect(eligibleNeighbours(s, { x: 2, y: 2 }, 'moss')).toEqual([{ x: 2, y: 3 }]);
    expect(eligibleNeighbours(s, { x: 2, y: 2 }, 'vine')).toEqual([{ x: 3, y: 2 }, { x: 2, y: 3 }]);
  });
});
