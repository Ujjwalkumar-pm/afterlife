import { describe, expect, it } from 'vitest';
import { PlayController } from '../../src/game/controller';
import type { GameEvent } from '../../src/engine';
import { makeLevel } from '../engine/helpers';

const at = (x: number, y: number) => ({ x, y });

describe('selection', () => {
  it('selects, toggles off on a second select, and ignores empty items', () => {
    const c = new PlayController(makeLevel({ seeds: { moss: 1 } }));
    c.select({ kind: 'seed', plant: 'moss' });
    expect(c.view.selection).toEqual({ kind: 'seed', plant: 'moss' });
    c.select({ kind: 'seed', plant: 'moss' });
    expect(c.view.selection).toBeNull();
    c.select({ kind: 'seed', plant: 'vine' });
    expect(c.view.selection).toBeNull();
    c.select({ kind: 'scrap', slot: 99 });
    expect(c.view.selection).toBeNull();
  });
});

describe('preview', () => {
  it('is null with no selection and marks valid/invalid seed tiles', () => {
    const c = new PlayController(makeLevel({ ground: ['X....', '.....', '.....', '.....', '.....'] }));
    c.hover(at(1, 1));
    expect(c.view.preview).toBeNull();
    c.select({ kind: 'seed', plant: 'moss' });
    c.hover(at(1, 1));
    expect(c.view.preview).toMatchObject({ tile: at(1, 1), valid: true, ring: [], glowing: [] });
    c.hover(at(0, 0));
    expect(c.view.preview?.valid).toBe(false);
  });

  it('shows the scrap ring and glows only reachable plants when placement is valid', () => {
    const c = new PlayController(makeLevel({ batches: [['tyre', 'tyre']] }));
    c.select({ kind: 'seed', plant: 'moss' });
    c.tap(at(2, 2), 'mouse');
    c.select({ kind: 'scrap', slot: 0 });
    c.hover(at(2, 3));
    expect(c.view.preview?.valid).toBe(true);
    expect(c.view.preview?.ring).toHaveLength(5);
    expect(c.view.preview?.glowing).toEqual([at(2, 2)]);
    c.hover(at(2, 2));
    expect(c.view.preview?.valid).toBe(false);
    expect(c.view.preview?.glowing).toEqual([]);
  });

  it('hover outside the grid clears the preview', () => {
    const c = new PlayController(makeLevel());
    c.select({ kind: 'seed', plant: 'moss' });
    c.hover(at(1, 1));
    c.hover(null);
    expect(c.view.preview).toBeNull();
  });
});

describe('tapping', () => {
  it('mouse tap places immediately', () => {
    const c = new PlayController(makeLevel());
    c.select({ kind: 'seed', plant: 'moss' });
    const events = c.tap(at(1, 1), 'mouse');
    expect(events[0]).toEqual({ type: 'placedSeed', pos: at(1, 1), plant: 'moss' });
  });

  it('touch needs a preview tap then a confirming tap on the same tile', () => {
    const c = new PlayController(makeLevel());
    c.select({ kind: 'seed', plant: 'moss' });
    expect(c.tap(at(1, 1), 'touch')).toEqual([]);
    expect(c.view.preview?.tile).toEqual(at(1, 1));
    expect(c.tap(at(2, 2), 'touch')).toEqual([]);
    expect(c.view.preview?.tile).toEqual(at(2, 2));
    expect(c.tap(at(2, 2), 'touch')).toHaveLength(1);
  });

  it('harvests a bloom with or without a selection', () => {
    const level = makeLevel({ batches: [['car', 'car', 'car', 'car', 'car']] });
    const c = new PlayController(level);
    c.play({ type: 'seed', plant: 'flower', x: 2, y: 2 });
    for (const p of [at(0, 2), at(4, 2), at(2, 0), at(2, 4)]) c.play({ type: 'scrap', slot: 0, ...p });
    expect(c.view.state.tiles[12]!.plant!.bloom).toBe(true);
    const events = c.tap(at(2, 2), 'mouse');
    expect(events).toEqual([{ type: 'harvested', pos: at(2, 2), seed: 'flower' }]);
  });

  it('does nothing for a tap outside the grid or with no selection', () => {
    const c = new PlayController(makeLevel());
    expect(c.tap(at(-1, 0), 'mouse')).toEqual([]);
    expect(c.tap(at(1, 1), 'mouse')).toEqual([]);
  });

  it('clears seed selection when seeds run out', () => {
    const c = new PlayController(makeLevel({ seeds: { moss: 2 } }));
    c.select({ kind: 'seed', plant: 'moss' });
    c.tap(at(0, 0), 'mouse');
    expect(c.view.selection).toEqual({ kind: 'seed', plant: 'moss' });
    c.tap(at(1, 0), 'mouse');
    expect(c.view.selection).toBeNull();
  });

  it('clamps or clears scrap selection as the tray changes', () => {
    const c = new PlayController(makeLevel({ batches: [['tyre', 'can'], ['cone']] }));
    c.select({ kind: 'scrap', slot: 1 });
    c.tap(at(0, 0), 'mouse');
    expect(c.view.selection).toEqual({ kind: 'scrap', slot: 0 });
    c.tap(at(1, 0), 'mouse');
    expect(c.view.state.tray).toEqual(['cone']);
    expect(c.view.selection).toEqual({ kind: 'scrap', slot: 0 });
    c.tap(at(2, 0), 'mouse');
    expect(c.view.selection).toBeNull();
  });
});

describe('overlays', () => {
  const winnable = () => makeLevel({ width: 3, height: 1, ground: ['...'], target: 0.3, batches: [['tyre', 'tyre']] });

  it('opens "restored" once on win, and keepDecorating closes it for good', () => {
    const c = new PlayController(winnable());
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'scrap', slot: 0, x: 1, y: 0 });
    expect(c.view.overlay).toBe('restored');
    c.keepDecorating();
    expect(c.view.overlay).toBe('none');
    c.play({ type: 'seed', plant: 'flower', x: 2, y: 0 });
    expect(c.view.overlay).toBe('none');
  });

  it('opens "rests" when stuck, and undo closes it', () => {
    const c = new PlayController(makeLevel({ batches: [['tyre']] }));
    c.play({ type: 'scrap', slot: 0, x: 0, y: 0 });
    expect(c.view.overlay).toBe('rests');
    c.undo();
    expect(c.view.overlay).toBe('none');
  });

  it('ignores taps while an overlay is open', () => {
    const c = new PlayController(makeLevel({ batches: [['tyre']] }));
    c.play({ type: 'scrap', slot: 0, x: 0, y: 0 });
    c.select({ kind: 'seed', plant: 'moss' });
    expect(c.tap(at(3, 3), 'mouse')).toEqual([]);
    expect(c.view.state.tiles[18]!.plant).toBeNull();
  });

  it('restart resets state, selection and overlay', () => {
    const c = new PlayController(makeLevel({ batches: [['tyre']] }));
    c.play({ type: 'scrap', slot: 0, x: 0, y: 0 });
    c.restart();
    expect(c.view.overlay).toBe('none');
    expect(c.view.selection).toBeNull();
    expect(c.view.canUndo).toBe(false);
    expect(c.view.state.tray).toEqual(['tyre']);
  });
});

describe('view', () => {
  it('rotates with wrap-around', () => {
    const c = new PlayController(makeLevel());
    c.rotate(-1);
    expect(c.view.rotation).toBe(3);
    c.rotate(1);
    expect(c.view.rotation).toBe(0);
  });

  it('reports progress as coverage over target, capped at 1', () => {
    const c = new PlayController(makeLevel({ width: 2, height: 1, ground: ['..'], target: 0.5, batches: [['tyre']] }));
    expect(c.view.progress).toBe(0);
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'scrap', slot: 0, x: 1, y: 0 });
    expect(c.view.coverage).toBe(0.5);
    expect(c.view.progress).toBe(1);
  });

  it('notifies listeners with events and supports unsubscribe', () => {
    const c = new PlayController(makeLevel());
    const seen: GameEvent[][] = [];
    const off = c.onChange((_v, events) => seen.push(events));
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    off();
    c.play({ type: 'seed', plant: 'moss', x: 1, y: 0 });
    expect(seen).toHaveLength(1);
    expect(seen[0]![0]!.type).toBe('placedSeed');
  });
});
