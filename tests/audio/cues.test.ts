import { describe, expect, it } from 'vitest';
import { ambientParams, cuesFor, volumeToDb } from '../../src/audio/cues';
import { silentSound } from '../../src/audio/sound';
import type { GameEvent } from '../../src/engine';

const p = { x: 0, y: 0 };

describe('cuesFor', () => {
  it('maps placements and harvests to one cue each', () => {
    const events: GameEvent[] = [
      { type: 'placedSeed', pos: p, plant: 'moss' },
      { type: 'placedScrap', pos: p, scrap: 'tyre' },
      { type: 'harvested', pos: p, seed: 'moss' },
      { type: 'newBatch', tray: ['can'] },
    ];
    expect(cuesFor(events)).toEqual(['seed', 'scrap', 'harvest', 'newBatch']);
  });
  it('plays at most 3 grow notes and one spread and one bloom per move', () => {
    const many: GameEvent[] = [
      ...Array.from({ length: 6 }, () => ({ type: 'grew', pos: p, stage: 1 }) as GameEvent),
      { type: 'spread', from: p, to: p, plant: 'moss' },
      { type: 'spread', from: p, to: p, plant: 'moss' },
      { type: 'bloomed', pos: p },
      { type: 'bloomed', pos: p },
    ];
    expect(cuesFor(many)).toEqual(['grow', 'grow', 'grow', 'spread', 'bloom']);
  });
  it('ignores blocked, won and stuck (won and rests come from overlay changes)', () => {
    expect(cuesFor([{ type: 'blocked', pos: p }, { type: 'won' }, { type: 'stuck' }])).toEqual([]);
  });
});

describe('ambientParams', () => {
  it('opens the filter, raises the pad and quietens the wind as the garden grows', () => {
    const bare = ambientParams(0);
    const lush = ambientParams(1);
    expect(lush.cutoff).toBeGreaterThan(bare.cutoff);
    expect(lush.padDb).toBeGreaterThan(bare.padDb);
    expect(lush.windDb).toBeLessThan(bare.windDb);
    expect(bare.bells).toBe(false);
    expect(lush.bells).toBe(true);
  });
  it('clamps progress outside 0..1', () => {
    expect(ambientParams(-1)).toEqual(ambientParams(0));
    expect(ambientParams(5)).toEqual(ambientParams(1));
  });
});

describe('volumeToDb', () => {
  it('maps 1 to 0 dB, 0.5 to about -6 dB and 0 to -Infinity', () => {
    expect(volumeToDb(1)).toBe(0);
    expect(volumeToDb(0.5)).toBeCloseTo(-6.02, 1);
    expect(volumeToDb(0)).toBe(-Infinity);
  });
});

describe('silentSound', () => {
  it('accepts every call without doing anything', () => {
    expect(() => {
      silentSound.unlock();
      silentSound.setMuted(true);
      silentSound.setVolume(0.2);
      silentSound.setAmbient(true);
      silentSound.setProgress(0.5);
      silentSound.play(['seed']);
    }).not.toThrow();
  });
});
