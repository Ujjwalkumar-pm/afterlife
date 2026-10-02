import { describe, expect, it } from 'vitest';
import { LevelError, validateLevel } from '../../src/engine/level';
import { makeLevel, makeState } from './helpers';

const base = () => JSON.parse(JSON.stringify(makeLevel())) as Record<string, unknown>;

describe('createInitialState', () => {
  it('builds tiles, ruins, seeds and tray from the level', () => {
    const s = makeState({
      ground: ['..#..', '.....', '..X..', '.....', '.....'],
      ruins: [{ x: 0, y: 0, name: 'bench', size: 'small' }],
      seeds: { moss: 2 },
      batches: [['tyre', 'can'], ['crate']],
    });
    expect(s.tiles).toHaveLength(25);
    expect(s.tiles[2]!.ground).toBe('concrete');
    expect(s.tiles[12]!.ground).toBe('blocked');
    expect(s.tiles[0]!.object).toEqual({ kind: 'ruin', name: 'bench', size: 'small' });
    expect(s.seeds).toEqual({ moss: 2, vine: 0, flower: 0, bamboo: 0 });
    expect(s.tray).toEqual(['tyre', 'can']);
    expect(s.batches).toEqual([['crate']]);
    expect(s.won).toBe(false);
    expect(s.harvestYield).toBeNull();
  });
});

describe('validateLevel', () => {
  const bad = (patch: Record<string, unknown>) => () => validateLevel({ ...base(), ...patch });

  it('accepts a valid level', () => {
    expect(() => validateLevel(base())).not.toThrow();
  });
  it('rejects a row with the wrong length', () => {
    expect(bad({ ground: ['....', '.....', '.....', '.....', '.....'] })).toThrow(/row 0/);
  });
  it('rejects an unknown ground character', () => {
    expect(bad({ ground: ['....?', '.....', '.....', '.....', '.....'] })).toThrow(LevelError);
  });
  it('rejects a ruin on a blocked tile', () => {
    expect(bad({ ground: ['X....', '.....', '.....', '.....', '.....'], ruins: [{ x: 0, y: 0, name: 'b', size: 'small' }] })).toThrow(/blocked/);
  });
  it('rejects two ruins on one tile', () => {
    const r = { x: 1, y: 1, name: 'b', size: 'small' };
    expect(bad({ ruins: [r, r] })).toThrow(/already/);
  });
  it('rejects a target outside (0, 1]', () => {
    expect(bad({ target: 0 })).toThrow(/target/);
    expect(bad({ target: 1.2 })).toThrow(/target/);
  });
  it('rejects unknown scrap and empty batches', () => {
    expect(bad({ batches: [['piano']] })).toThrow(/piano/);
    expect(bad({ batches: [] })).toThrow(/batches/);
    expect(bad({ batches: [[]] })).toThrow(/batch 0/);
  });
  it('rejects unknown seed types and negative counts', () => {
    expect(bad({ seeds: { cactus: 1 } })).toThrow(/cactus/);
    expect(bad({ seeds: { moss: -1 } })).toThrow(/moss/);
  });
});
