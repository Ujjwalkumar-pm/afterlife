import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine';
import { pipFor, type PipContext } from '../../src/game/pip';

const base: PipContext = { newOverlay: 'none', tutorial: false, events: [], milestone: false, hint: false };
const p = { x: 1, y: 1 };
const scrapWith = (growths: number): GameEvent[] => [{ type: 'placedScrap', pos: p, scrap: 'tyre' }, ...Array.from({ length: growths }, (): GameEvent => ({ type: 'grew', pos: p, stage: 1 }))];

describe('pipFor', () => {
  it('rests idle and silent when nothing happens', () => {
    expect(pipFor(base)).toEqual({ mood: 'idle', line: null });
  });
  it('waves when the place is restored, above everything else', () => {
    expect(pipFor({ ...base, newOverlay: 'restored', tutorial: true, events: [{ type: 'bonus' }], milestone: true, hint: true })).toEqual({ mood: 'wave', line: 'We did it! Look at it bloom.' });
  });
  it('comforts when the garden rests', () => {
    expect(pipFor({ ...base, newOverlay: 'rests', tutorial: true })).toEqual({ mood: 'idle', line: "Let's undo a little and try again." });
  });
  it('points without a line during the tutorial (the coach box speaks)', () => {
    expect(pipFor({ ...base, tutorial: true, events: [{ type: 'bonus' }], hint: true })).toEqual({ mood: 'point', line: null });
  });
  it('cheers a bonus pack before a combo', () => {
    expect(pipFor({ ...base, events: [...scrapWith(12), { type: 'bonus' }] })).toEqual({ mood: 'cheer', line: 'Here — more seeds and a tyre!' });
  });
  it('cheers a combo with its label, before a milestone', () => {
    expect(pipFor({ ...base, events: scrapWith(7), milestone: true })).toEqual({ mood: 'cheer', line: 'Lush!' });
  });
  it('cheers a milestone before a hint', () => {
    expect(pipFor({ ...base, events: scrapWith(1), milestone: true, hint: true })).toEqual({ mood: 'cheer', line: 'The place is waking up!' });
  });
  it('points at the idle hint', () => {
    expect(pipFor({ ...base, hint: true })).toEqual({ mood: 'point', line: 'Try the glowing spot!' });
  });
});
