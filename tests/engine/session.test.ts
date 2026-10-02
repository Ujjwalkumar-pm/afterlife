import { describe, expect, it } from 'vitest';
import { Session } from '../../src/engine/session';
import { makeLevel } from './helpers';

describe('Session', () => {
  it('starts with nothing to undo', () => {
    const session = new Session(makeLevel());
    expect(session.canUndo).toBe(false);
    expect(session.undo()).toBe(false);
  });

  it('undo returns to the previous state; failed moves add no history', () => {
    const session = new Session(makeLevel());
    const start = structuredClone(session.state);
    expect(session.apply({ type: 'seed', plant: 'moss', x: 0, y: 0 }).ok).toBe(true);
    expect(session.apply({ type: 'seed', plant: 'moss', x: 0, y: 0 }).ok).toBe(false);
    expect(session.undo()).toBe(true);
    expect(session.state).toEqual(start);
    expect(session.canUndo).toBe(false);
  });

  it('restart resets to the initial state and clears history', () => {
    const session = new Session(makeLevel());
    const start = structuredClone(session.state);
    session.apply({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    session.apply({ type: 'scrap', slot: 0, x: 0, y: 1 });
    session.restart();
    expect(session.state).toEqual(start);
    expect(session.canUndo).toBe(false);
  });

  it('undo after win, then winning again, emits won again', () => {
    const session = new Session(makeLevel({ width: 3, height: 1, ground: ['...'], target: 0.3, batches: [['tyre', 'tyre']] }));
    session.apply({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    const win = session.apply({ type: 'scrap', slot: 0, x: 1, y: 0 });
    expect(win.ok && win.events.some((e) => e.type === 'won')).toBe(true);
    session.undo();
    expect(session.state.won).toBe(false);
    const again = session.apply({ type: 'scrap', slot: 0, x: 1, y: 0 });
    expect(again.ok && again.events.some((e) => e.type === 'won')).toBe(true);
  });

  it('undo restores RNG so redoing the same move gives an identical garden', () => {
    const session = new Session(makeLevel({ batches: [['car', 'car', 'car', 'car']] }));
    session.apply({ type: 'seed', plant: 'moss', x: 2, y: 2 });
    session.apply({ type: 'scrap', slot: 0, x: 0, y: 2 }); // moss -> stage 1
    session.apply({ type: 'scrap', slot: 0, x: 4, y: 2 }); // moss -> stage 2 (grown)
    const spreadMove = { type: 'scrap' as const, slot: 0, x: 2, y: 0 };
    const r = session.apply(spreadMove); // grown moss spreads to a random neighbour
    expect(r.ok && r.events.some((e) => e.type === 'spread')).toBe(true);
    const first = structuredClone(session.state);
    session.undo();
    session.apply(spreadMove);
    expect(session.state).toEqual(first);
  });
});
