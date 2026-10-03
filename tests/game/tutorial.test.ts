import { describe, expect, it } from 'vitest';
import { applyMove, createInitialState } from '../../src/engine';
import { PlayController } from '../../src/game/controller';
import { planTutorial, Tutorial, TUTORIAL_STEPS } from '../../src/game/tutorial';
import { LEVELS } from '../../src/levels';

const busStop = LEVELS[0]!;

describe('planTutorial', () => {
  it('picks two diagonal seed tiles and a scrap tile next to both, all legal in order', () => {
    const { seed1, seed2, scrap } = planTutorial(busStop);
    expect(Math.abs(seed1.x - seed2.x)).toBe(1);
    expect(Math.abs(seed1.y - seed2.y)).toBe(1);
    const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    expect(d(scrap, seed1)).toBe(1);
    expect(d(scrap, seed2)).toBe(1);
    let s = createInitialState(busStop);
    for (const m of [
      { type: 'seed' as const, plant: 'moss' as const, ...seed1 },
      { type: 'seed' as const, plant: 'moss' as const, ...seed2 },
      { type: 'scrap' as const, slot: 0, ...scrap },
    ]) {
      const r = applyMove(s, m);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.state;
    }
  });
});

describe('Tutorial', () => {
  const setup = () => {
    const plan = planTutorial(busStop);
    const c = new PlayController(busStop);
    const t = new Tutorial(plan);
    const act = (fn: () => void) => {
      let events: Parameters<Tutorial['update']>[1] = [];
      const off = c.onChange((_v, e) => (events = e.length ? e : events));
      fn();
      off();
      t.update(c.view, events);
    };
    return { plan, c, t, act };
  };

  it('walks through the six steps in order, with the spec texts', () => {
    const { plan, c, t, act } = setup();
    expect(t.current).toEqual({ step: 1, total: 6, ...TUTORIAL_STEPS[0] });
    expect(t.current!.text).toBe('Tap Moss in your tray.');
    act(() => c.select({ kind: 'seed', plant: 'moss' }));
    expect(t.step).toBe(2);
    expect(t.highlight).toEqual(plan.seed1);
    act(() => c.tap(plan.seed1, 'mouse'));
    expect(t.step).toBe(3);
    expect(t.highlight).toEqual(plan.seed2);
    act(() => c.tap(plan.seed2, 'mouse'));
    expect(t.step).toBe(4);
    expect(t.current!.target).toBe('scrap');
    act(() => c.select({ kind: 'scrap', slot: 0 }));
    expect(t.step).toBe(5);
    expect(t.highlight).toEqual(plan.scrap);
    act(() => c.tap(plan.scrap, 'mouse'));
    expect(t.step).toBe(6);
    expect(t.current!.target).toBe('meter');
    expect(t.done).toBe(false);
    act(() => c.select({ kind: 'seed', plant: 'moss' }));
    act(() => c.tap({ x: 0, y: 2 }, 'mouse'));
    expect(t.done).toBe(true);
    expect(t.current).toBeNull();
  });

  it('touch advances in one tap', () => {
    const { plan, c, t, act } = setup();
    act(() => c.select({ kind: 'seed', plant: 'moss' }));
    act(() => c.tap(plan.seed1, 'touch'));
    expect(t.step).toBe(3);
  });

  it('undo never moves back', () => {
    const { plan, c, t, act } = setup();
    act(() => c.select({ kind: 'seed', plant: 'moss' }));
    act(() => c.tap(plan.seed1, 'mouse'));
    act(() => c.undo());
    expect(t.step).toBe(3);
  });

  it('placing scrap first jumps to step 6', () => {
    const { c, t, act } = setup();
    act(() => c.select({ kind: 'scrap', slot: 0 }));
    act(() => c.tap({ x: 4, y: 1 }, 'mouse'));
    expect(t.step).toBe(6);
  });

  it('finish ends it immediately', () => {
    const { t } = setup();
    t.finish();
    expect(t.done).toBe(true);
    expect(t.highlight).toBeNull();
  });
});
