# Afterlife v1.1 — Living Diorama & Teaching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shipped game feel alive (living plants, satisfying feedback, atmosphere, celebration) and self-explanatory (a guided Bus Stop tutorial and a How to Play screen), without changing rules, levels, audio or saves beyond one new field.

**Architecture:**
- The Phaser scene moves from "redraw everything on every change" to **persistent per-tile views updated by a pure `diffTiles`**, with the hover preview on its own layer.
- Plants become **cached textures drawn once** per type, stage, bloom, height and variant, shown as base-anchored images that sway and grow.
- All new decision logic is pure and unit-tested: diffing, keys, LRU, timings, sky colours, island geometry, the tutorial step machine and its tile plan.
- Phaser effects and atmosphere are checked in the browser.

**Tech Stack:** The existing Phaser 4.2.1, TypeScript 7, Vite 8, Vitest 5 and happy-dom. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-03-afterlife-v1.1-design.md`, which builds on `2026-10-03-afterlife-design.md`. v1 is live at https://afterlife-one.vercel.app and auto-deploys from `main`.

## Global Constraints

- `src/engine/` is unchanged. The level files and solutions are unchanged. All existing tests must keep passing (167 at the start), except the save tests this plan explicitly updates.
- Animations must always finish. Hover or preview changes must never touch the world layer. Rapid moves, undo and restart leave every plant at scale 1 with the correct texture.
- Timings (spec §4):

  | Animation | Timing |
  |---|---|
  | Grow | scaleY 0.2 → 1, 500 ms, `Back.Out` |
  | Sprout | scale 0 → 1, 450 ms, +150 ms after the parent |
  | Bloom open | 600 ms |
  | Seed pop | 0.6 → 1, 250 ms |
  | Scrap drop | from 40 px, 350 ms bounce |
  | Ripple | 400 ms |
  | Harvest fly | 600 ms |
  | Shake | ±4 px, 200 ms |
  | Meter glow | 600 ms when progress rises by 5% or more |
  | Wash | 40 ms per tile step |
  | Screen fade | 250 ms |

- Sway amplitudes: moss 1.5°, vine 3°, flower 4°, bamboo 5°. Period 2.4–3.6 s, with phase seeded by position.
- Sky: from `#2b3036` → `#3d3a33` at progress 0 to `#3b4a3e` → `#7a6a45` at progress 1. Island depth 22 px; shadow alpha 0.35. Particles: 12–20 motes, dust below progress 0.5 and pollen above it.
- Reduce motion: no sway, particles, drops, flights, wash, fades or grow tweens; state appears instantly.
- Tutorial texts are exactly spec §5.1. `save.tutorialDone` defaults to false. Undo never moves a tutorial step backwards.
- Plant texture cache ≤ 200 entries, LRU, never evicting a texture in use.
- Performance: ≥ 45 fps with a 390×844 viewport, CPU throttled ×4, and Playground fully grown. Initial download < 3 MB gz.
- Phaser may be imported only in `src/render/scene/*.ts` (except `sceneMath.ts`), `src/render/objects/objectArt.ts`, `src/render/objects/spriteArt.ts`, `src/render/plants/plantArt.ts`, `src/render/plants/plantTextures.ts` and `src/main.ts`. Pure modules must import none of these, so the Node tests can load them.
- Shipping v1.1 to the live site (merging to `main`) is approved as part of this plan.

## Review Focus

1. **Rapid moves during animations** (several placements in a row, undo mid-grow, restart): the final picture matches the state, with no half-scaled or stale plants. Pinned in Task 4 Step 8 (browser: `rapid moves settle`) and Task 2 (`diffTiles reports undo as changed or removed`).
2. **Rotating mid-animation or mid-celebration**: no duplicate or orphaned sprites. Pinned in Task 4 Step 8 (browser: world child count equals expected after rotations).
3. **A tutorial player going off-script** (scrap first, undo, restart, leaving the level): the tutorial stays sensible and never blocks play. Pinned in Task 5 (`placing scrap first jumps to step 6`, `undo never moves back`) and Task 7 (`leaving and returning restarts the tutorial from step 1 until done`).
4. **Long sessions with many textures**: memory stays bounded, and textures on screen are never removed. Pinned in Task 2 (`TextureLru never evicts keys in use`).
5. **Reduce motion**: nothing animates and nothing waits on an animation. Pinned in Task 8 Step 3 (browser: zero tweens and zero emitters after a move with Reduce motion).

---

## File Structure

| File | Responsibility | Phaser? |
|---|---|---|
| `src/save/save.ts` (modify) | `tutorialDone` field | no |
| `src/render/scene/sceneMath.ts` | `diffTiles`, texture keys, `TextureLru`, ripple, wash and sway timing, sky colours, island corners | no |
| `src/render/plants/plantShapes.ts` (modify) | Richer plant primitives; `primBounds`, `offsetPrims`, `scalePrims` | no |
| `src/render/plants/plantTextures.ts` | Draw prims once into a cached texture | yes |
| `src/render/scene/atmosphere.ts` | Sky CSS variables, island drawing, ambient particles, particle textures | yes |
| `src/render/scene/effects.ts` | Pop, burst, drop, ripple, shake, harvest flight, shimmer wash, fireflies and petals | yes |
| `src/render/scene/DioramaScene.ts` (rewrite) | Persistent layers, diff updates, sway, highlight, celebration orchestration | yes |
| `src/game/tutorial.ts` | Tutorial plan (suggested tiles) and step machine | no |
| `src/ui/icons.ts` | Inline SVG icons for plants, scrap and help | no |
| `src/ui/hud.ts` (modify) | Icons, meter glow, seed bump, `?` button, coach bubble | no |
| `src/app/app.ts` (modify) | Tutorial flow, How to Play screen and overlay, reduce-motion class, tray target | no |
| `src/styles.css` (modify) | Sky background, fades, coach, icons, glow and bump animations | no |
| `src/main.ts` (modify) | Transparent canvas; stage `highlight` | yes |

---

### Task 1: Save `tutorialDone`

**Files:**
- Modify: `src/save/save.ts`, `tests/save/save.test.ts`

**Interfaces:**
- Produces: `SaveData.tutorialDone: boolean` (default `false`)

- [ ] **Step 1: Write the failing tests**

Append to `tests/save/save.test.ts`:

```ts
describe('tutorialDone', () => {
  it('defaults to false and round-trips', () => {
    expect(defaultSave().tutorialDone).toBe(false);
    const store = memoryStore();
    writeSave(store, { ...defaultSave(), tutorialDone: true });
    expect(loadSave(store).tutorialDone).toBe(true);
  });
  it('reads false from an old save without the field', () => {
    const old = JSON.stringify({ version: 1, completed: ['bus-stop'], settings: { reducedMotion: false, muted: false, volume: 0.8 } });
    expect(loadSave(memoryStore({ [SAVE_KEY]: old })).tutorialDone).toBe(false);
  });
});
```

In the existing test `drops invalid fields but keeps valid ones`, add `tutorialDone: false,` to the expected object, after `completed: ['bus-stop'],`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/save`
Expected: the new tests fail because `tutorialDone` is undefined. The edited test fails too, because the loaded object lacks the field.

- [ ] **Step 3: Implement**

In `src/save/save.ts`:
1. Add `tutorialDone: boolean;` to `SaveData`.
2. Add `tutorialDone: false,` to `defaultSave()`.
3. In `loadSave`'s returned object, add `tutorialDone: d.tutorialDone === true,` after `completed`.

- [ ] **Step 4: Run all tests**

Run: `npm test && npm run typecheck`
Expected: all pass. If an App test compares whole save objects, add `tutorialDone` there and note it.

- [ ] **Step 5: Commit**

```bash
git add src/save/save.ts tests/save/save.test.ts
git commit -m "feat(save): tutorialDone flag"
```

---

### Task 2: Pure scene maths

**Files:**
- Create: `src/render/scene/sceneMath.ts`
- Test: `tests/render/sceneMath.test.ts`

**Interfaces:**
- Consumes: engine `GameState`, `PlantCell`, `PlantType`, `Pos`; `IsoView`, `viewSize` (projection); `lerpColor` (palette)
- Produces:
  - `type Change = 'added' | 'removed' | 'changed' | null`
  - `type PlantChange = Change | 'grew' | 'bloomed' | 'unbloomed'`
  - `interface TileChange { pos: Pos; object: Change; plant: PlantChange }`
  - `diffTiles(prev: GameState | null, next: GameState): TileChange[]`
  - `plantVariant(cell, x, y): number` (0–3)
  - `plantTextureKey(cell, x, y, objectHeight): string`
  - `class TextureLru { constructor(max: number); touch(key: string, inUse: Set<string>): string[]; readonly size: number }`
  - `rippleDelay(center: Pos, tile: Pos, radius: number, totalMs?: number): number`
  - `washDelays(state, origin: Pos, stepMs?: number): { pos: Pos; delay: number }[]`
  - `swayFor(type, x, y): { amplitude: number; period: number; phase: number }` (amplitude in radians)
  - `skyColors(progress): { top: string; bottom: string }`
  - `islandCorners(v: IsoView): { top: XY; right: XY; bottom: XY; left: XY }`

- [ ] **Step 1: Write the failing test** at `tests/render/sceneMath.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { diffTiles, islandCorners, plantTextureKey, plantVariant, rippleDelay, skyColors, swayFor, TextureLru, washDelays } from '../../src/render/scene/sceneMath';
import { makeState, putObject, putPlant } from '../engine/helpers';

describe('diffTiles', () => {
  it('reports every occupied tile as added when there is no previous state', () => {
    const s = putPlant(putObject(makeState(), 1, 1, 'tyre', 'small'), 2, 2, 'moss', 0);
    expect(diffTiles(null, s)).toEqual([
      { pos: { x: 1, y: 1 }, object: 'added', plant: null },
      { pos: { x: 2, y: 2 }, object: null, plant: 'added' },
    ]);
  });
  it('detects grew, bloomed, unbloomed and object removal', () => {
    const a = putObject(makeState(), 0, 0, 'tyre', 'small');
    putPlant(a, 1, 0, 'moss', 1);
    putPlant(a, 2, 0, 'flower', 3);
    const b = structuredClone(a);
    b.tiles[0]!.object = null;
    b.tiles[1]!.plant!.stage = 2;
    b.tiles[2]!.plant!.bloom = true;
    expect(diffTiles(a, b)).toEqual([
      { pos: { x: 0, y: 0 }, object: 'removed', plant: null },
      { pos: { x: 1, y: 0 }, object: null, plant: 'grew' },
      { pos: { x: 2, y: 0 }, object: null, plant: 'bloomed' },
    ]);
    expect(diffTiles(b, a).map((c) => c.plant)).toEqual([null, 'changed', 'unbloomed']);
  });
  it('diffTiles reports undo as changed or removed', () => {
    const a = makeState();
    const b = putPlant(structuredClone(a), 3, 3, 'moss', 1);
    expect(diffTiles(b, a)).toEqual([{ pos: { x: 3, y: 3 }, object: null, plant: 'removed' }]);
  });
  it('returns nothing for identical states', () => {
    const s = putPlant(makeState(), 1, 1, 'vine', 2);
    expect(diffTiles(s, structuredClone(s))).toEqual([]);
  });
});

describe('texture keys and cache', () => {
  it('builds stable keys from type, stage, bloom, height and a 0-3 variant', () => {
    const cell = { plantId: 5, type: 'moss' as const, stage: 2, bloom: false };
    const v = plantVariant(cell, 1, 2);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(4);
    expect(plantTextureKey(cell, 1, 2, 0)).toBe(`plant-moss-2-0-0-${v}`);
    expect(plantTextureKey({ ...cell, bloom: true }, 1, 2, 9)).toBe(`plant-moss-2-1-9-${v}`);
  });
  it('TextureLru evicts least-recently-used keys beyond the limit', () => {
    const lru = new TextureLru(2);
    expect(lru.touch('a', new Set())).toEqual([]);
    expect(lru.touch('b', new Set())).toEqual([]);
    lru.touch('a', new Set());
    expect(lru.touch('c', new Set())).toEqual(['b']);
    expect(lru.size).toBe(2);
  });
  it('TextureLru never evicts keys in use', () => {
    const lru = new TextureLru(1);
    lru.touch('a', new Set());
    expect(lru.touch('b', new Set(['a', 'b']))).toEqual([]);
    expect(lru.size).toBe(2);
    expect(lru.touch('c', new Set(['c']))).toEqual(['a', 'b']);
  });
});

describe('timings', () => {
  it('ripple delay grows with distance up to the full duration', () => {
    const c = { x: 2, y: 2 };
    expect(rippleDelay(c, c, 2)).toBe(0);
    expect(rippleDelay(c, { x: 3, y: 2 }, 2)).toBe(200);
    expect(rippleDelay(c, { x: 4, y: 2 }, 2)).toBe(400);
    expect(rippleDelay(c, { x: 4, y: 4 }, 2)).toBe(400);
    expect(rippleDelay(c, { x: 3, y: 2 }, 0)).toBe(0);
  });
  it('wash delays step 40 ms per tile from the origin and skip blocked tiles', () => {
    const s = makeState({ width: 3, height: 1, ground: ['.X.'] });
    expect(washDelays(s, { x: 0, y: 0 })).toEqual([
      { pos: { x: 0, y: 0 }, delay: 0 },
      { pos: { x: 2, y: 0 }, delay: 80 },
    ]);
  });
  it('sway amplitude rises from moss to bamboo, with a period of 2.4-3.6 s', () => {
    const deg = (t: 'moss' | 'vine' | 'flower' | 'bamboo') => (swayFor(t, 1, 1).amplitude * 180) / Math.PI;
    expect(deg('moss')).toBeCloseTo(1.5);
    expect(deg('vine')).toBeCloseTo(3);
    expect(deg('flower')).toBeCloseTo(4);
    expect(deg('bamboo')).toBeCloseTo(5);
    for (let x = 0; x < 8; x++) {
      const s = swayFor('moss', x, 7 - x);
      expect(s.period).toBeGreaterThanOrEqual(2400);
      expect(s.period).toBeLessThanOrEqual(3600);
    }
    expect(swayFor('moss', 1, 2).phase).not.toBe(swayFor('moss', 2, 1).phase);
  });
});

describe('atmosphere maths', () => {
  it('sky goes from dusty to golden and clamps', () => {
    expect(skyColors(0)).toEqual({ top: '#2b3036', bottom: '#3d3a33' });
    expect(skyColors(1)).toEqual({ top: '#3b4a3e', bottom: '#7a6a45' });
    expect(skyColors(5)).toEqual(skyColors(1));
  });
  it('island corners wrap the whole board', () => {
    expect(islandCorners({ width: 6, height: 6, rotation: 0, tileW: 64, tileH: 32 })).toEqual({
      top: { x: 0, y: -16 },
      right: { x: 192, y: 80 },
      bottom: { x: 0, y: 176 },
      left: { x: -192, y: 80 },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/render/sceneMath.test.ts`
Expected: FAIL, with a module-not-found error for `sceneMath`.

- [ ] **Step 3: Create `src/render/scene/sceneMath.ts`**

```ts
import type { GameState, PlantCell, PlantType, Pos } from '../../engine';
import { viewSize, type IsoView } from '../iso/projection';
import { lerpColor } from '../palette';

export type Change = 'added' | 'removed' | 'changed' | null;
export type PlantChange = Change | 'grew' | 'bloomed' | 'unbloomed';
export interface TileChange {
  pos: Pos;
  object: Change;
  plant: PlantChange;
}
type XY = { x: number; y: number };

/** What changed per tile between two states (prev null = everything present is new). */
export function diffTiles(prev: GameState | null, next: GameState): TileChange[] {
  const out: TileChange[] = [];
  next.tiles.forEach((b, i) => {
    const a = prev?.tiles[i];
    const pos = { x: i % next.width, y: Math.floor(i / next.width) };
    let object: Change = null;
    if (!a?.object && b.object) object = 'added';
    else if (a?.object && !b.object) object = 'removed';
    else if (a?.object && b.object && a.object.name !== b.object.name) object = 'changed';
    let plant: PlantChange = null;
    const ap = a?.plant ?? null;
    const bp = b.plant;
    if (!ap && bp) plant = 'added';
    else if (ap && !bp) plant = 'removed';
    else if (ap && bp) {
      if (ap.type !== bp.type || bp.stage < ap.stage) plant = 'changed';
      else if (bp.stage > ap.stage) plant = 'grew';
      else if (!ap.bloom && bp.bloom) plant = 'bloomed';
      else if (ap.bloom && !bp.bloom) plant = 'unbloomed';
    }
    if (object || plant) out.push({ pos, object, plant });
  });
  return out;
}

/** Four look-variants per plant type keep the texture cache small while gardens still vary. */
export const plantVariant = (cell: PlantCell, x: number, y: number): number => (cell.plantId * 7 + x * 3 + y * 5) % 4;

export const plantTextureKey = (cell: PlantCell, x: number, y: number, objectHeight: number): string =>
  `plant-${cell.type}-${cell.stage}-${cell.bloom ? 1 : 0}-${objectHeight}-${plantVariant(cell, x, y)}`;

/** Least-recently-used key tracker; returns keys to evict, never ones currently in use. */
export class TextureLru {
  private order = new Map<string, true>();

  constructor(private readonly max: number) {}

  get size(): number {
    return this.order.size;
  }

  touch(key: string, inUse: Set<string>): string[] {
    this.order.delete(key);
    this.order.set(key, true);
    const evicted: string[] = [];
    for (const k of [...this.order.keys()]) {
      if (this.order.size <= this.max) break;
      if (k === key || inUse.has(k)) continue;
      this.order.delete(k);
      evicted.push(k);
    }
    return evicted;
  }
}

const manhattan = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** When the growth ripple from `center` reaches `tile` (ms). */
export function rippleDelay(center: Pos, tile: Pos, radius: number, totalMs = 400): number {
  if (radius <= 0) return 0;
  return Math.round(Math.min(1, manhattan(center, tile) / radius) * totalMs);
}

export function washDelays(state: GameState, origin: Pos, stepMs = 40): { pos: Pos; delay: number }[] {
  const out: { pos: Pos; delay: number }[] = [];
  state.tiles.forEach((t, i) => {
    if (t.ground === 'blocked') return;
    const pos = { x: i % state.width, y: Math.floor(i / state.width) };
    out.push({ pos, delay: manhattan(origin, pos) * stepMs });
  });
  return out.sort((a, b) => a.delay - b.delay);
}

const SWAY_DEG: Record<PlantType, number> = { moss: 1.5, vine: 3, flower: 4, bamboo: 5 };

export function swayFor(type: PlantType, x: number, y: number): { amplitude: number; period: number; phase: number } {
  return {
    amplitude: (SWAY_DEG[type] * Math.PI) / 180,
    period: 2400 + ((x * 37 + y * 61) % 13) * 100,
    phase: (((x * 13 + y * 29) % 100) / 100) * Math.PI * 2,
  };
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function skyColors(progress: number): { top: string; bottom: string } {
  return { top: hex(lerpColor(0x2b3036, 0x3b4a3e, progress)), bottom: hex(lerpColor(0x3d3a33, 0x7a6a45, progress)) };
}

/** Outer corners of the board's diamond in world pixels (before island depth). */
export function islandCorners(v: IsoView): { top: XY; right: XY; bottom: XY; left: XY } {
  const { width: w, height: h } = viewSize(v);
  const hw = v.tileW / 2;
  const hh = v.tileH / 2;
  return {
    top: { x: 0, y: -hh },
    right: { x: (w - 1) * hw + hw, y: (w - 1) * hh },
    bottom: { x: (w - 1 - (h - 1)) * hw, y: (w - 1 + h - 1) * hh + hh },
    left: { x: -(h - 1) * hw - hw, y: (h - 1) * hh },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/render/sceneMath.test.ts && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/scene/sceneMath.ts tests/render/sceneMath.test.ts
git commit -m "feat(render): pure scene maths (diff, texture keys, LRU, timings, sky, island)"
```

---

### Task 3: Richer plant shapes

**Files:**
- Modify: `src/render/plants/plantShapes.ts`, `src/render/palette.ts`
- Test: `tests/render/shapes.test.ts` (append)

**Interfaces:**
- Produces: the upgraded `plantPrims` (same signature), plus `primBounds(prims): { minX; minY; maxX; maxY }`, `offsetPrims(prims, dx, dy): Prim[]` and `scalePrims(prims, k): Prim[]`

- [ ] **Step 1: Write the failing tests** (append to `tests/render/shapes.test.ts`, adding `primBounds, offsetPrims, scalePrims` to the plantShapes import)

```ts
describe('richer plants', () => {
  it('moss clumps have shadow, body and highlight tones', () => {
    const colors = new Set(plantPrims(input({ stage: 2 })).map((p) => p.color));
    expect(colors.size).toBeGreaterThanOrEqual(5);
  });
  it('vine leaves carry vein lines', () => {
    const prims = plantPrims(input({ type: 'vine', stage: 3 }));
    const stems = 4;
    expect(prims.filter((p) => p.kind === 'line').length).toBeGreaterThan(stems);
  });
  it('bamboo has leaf tufts on every pole', () => {
    const prims = plantPrims(input({ type: 'bamboo', stage: 5 }));
    expect(prims.filter((p) => p.kind === 'ellipse').length).toBeGreaterThanOrEqual(9);
  });
});

describe('prim geometry', () => {
  const prims: Prim[] = [
    { kind: 'ellipse', x: 0, y: 0, w: 10, h: 4, color: 1 },
    { kind: 'circle', x: 20, y: -10, r: 3, color: 1 },
    { kind: 'line', points: [-8, 5, -8, 12], width: 2, color: 1 },
  ];
  it('primBounds covers every primitive', () => {
    expect(primBounds(prims)).toEqual({ minX: -9, minY: -13, maxX: 23, maxY: 13 });
  });
  it('offsetPrims and scalePrims transform every coordinate', () => {
    expect(primBounds(offsetPrims(prims, 9, 13))).toEqual({ minX: 0, minY: 0, maxX: 32, maxY: 26 });
    expect(primBounds(scalePrims(prims, 2))).toEqual({ minX: -18, minY: -26, maxX: 46, maxY: 26 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/render/shapes.test.ts`
Expected: the new tests fail (fewer colours and lines; `primBounds` is not exported).

- [ ] **Step 3: Implement**

In `src/render/palette.ts`, add to `PALETTE`:

```ts
  dust: 0xb9b2a4,
  pollen: 0xf3e6a0,
  firefly: 0xfff3b0,
  vein: 0x2f5a2c,
```

In `src/render/plants/plantShapes.ts`:
1. Import `{ darken, lighten, PALETTE }` from `'../palette'`.
2. Replace `moss`, `vine`, `flower` and `bamboo` with:

```ts
function moss(p: PlantDrawInput, r: Rand, base: number): Prim[] {
  const out: Prim[] = [];
  const n = 3 + p.stage * 3;
  for (let i = 0; i < n; i++) {
    const q = inDiamond(r, p.objectHeight > 0 ? 0.45 : 0.85);
    const w = 7 + r() * 8;
    const c = pick(r, PALETTE.moss);
    out.push({ kind: 'ellipse', x: q.x, y: base + q.y + 1.5, w: w * 1.05, h: w * 0.5, color: darken(c, 0.3) });
    out.push({ kind: 'ellipse', x: q.x, y: base + q.y, w, h: w * 0.55, color: c });
    out.push({ kind: 'ellipse', x: q.x - w * 0.18, y: base + q.y - w * 0.12, w: w * 0.35, h: w * 0.18, color: lighten(c, 0.35) });
  }
  return out;
}

function leaf(x: number, y: number, c: number): Prim[] {
  return [
    { kind: 'ellipse', x, y, w: 8, h: 4.5, color: c },
    { kind: 'line', points: [x - 3, y + 0.5, x + 3, y - 0.5], width: 0.8, color: PALETTE.vein },
  ];
}

function vine(p: PlantDrawInput, r: Rand): Prim[] {
  const out: Prim[] = [];
  const climbing = p.objectHeight > 0;
  const climb = climbing ? p.objectHeight * Math.min(1, p.stage / 3) : 0;
  const len = 10 + p.stage * 6;
  for (let i = 0; i <= p.stage; i++) {
    const start = inDiamond(r, 0.7);
    const drift = { x: (r() - 0.5) * len, y: (r() - 0.5) * len * 0.5 };
    const points: number[] = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      points.push(start.x + Math.sin(t * 3 + i) * 4 + (climbing ? 0 : drift.x * t), start.y - climb * t + (climbing ? 0 : drift.y * t));
    }
    out.push({ kind: 'line', points, width: 2, color: PALETTE.stem });
    for (let k = 1; k <= 5; k += 2) out.push(...leaf(points[k * 2]!, points[k * 2 + 1]!, pick(r, PALETTE.vine)));
  }
  return out;
}

function flower(p: PlantDrawInput, r: Rand, base: number): Prim[] {
  const h = 6 + p.stage * 5;
  const x = (r() - 0.5) * 8;
  const head = { x: x + 1, y: base - h };
  const out: Prim[] = [
    { kind: 'line', points: [x, base, head.x, head.y], width: 2, color: PALETTE.stem },
    { kind: 'ellipse', x: x - 4, y: base - h * 0.4, w: 8, h: 4, color: PALETTE.leaf },
    { kind: 'ellipse', x: x - 5, y: base - h * 0.4 - 1, w: 3, h: 1.4, color: lighten(PALETTE.leaf, 0.4) },
    { kind: 'ellipse', x: x + 4, y: base - h * 0.6, w: 8, h: 4, color: PALETTE.leaf },
    { kind: 'ellipse', x: x + 3, y: base - h * 0.6 - 1, w: 3, h: 1.4, color: lighten(PALETTE.leaf, 0.4) },
  ];
  if (p.bloom) {
    const petal = pick(r, PALETTE.petal);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      out.push({ kind: 'circle', x: head.x + Math.cos(a) * 5, y: head.y + Math.sin(a) * 4, r: 3.5, color: petal });
    }
    out.push({ kind: 'circle', x: head.x, y: head.y, r: 2.5, color: PALETTE.flowerCentre });
  } else if (p.stage >= 2) {
    out.push({ kind: 'circle', x: head.x, y: head.y, r: 3, color: PALETTE.bud });
  }
  return out;
}

function bamboo(p: PlantDrawInput, r: Rand, base: number): Prim[] {
  const out: Prim[] = [];
  const poles = Math.min(3, 1 + Math.floor(p.stage / 2));
  const h = 8 + p.stage * 9;
  for (let i = 0; i < poles; i++) {
    const x = (i - (poles - 1) / 2) * 6 + (r() - 0.5) * 2;
    const ph = h * (0.8 + r() * 0.2);
    out.push({ kind: 'line', points: [x, base, x, base - ph], width: 3, color: pick(r, PALETTE.bamboo) });
    for (let s = 8; s < ph; s += 8) out.push({ kind: 'line', points: [x - 2, base - s, x + 2, base - s], width: 1, color: PALETTE.bambooNode });
    out.push({ kind: 'ellipse', x: x + 4, y: base - ph, w: 9, h: 3, color: PALETTE.leaf });
    out.push({ kind: 'ellipse', x: x - 3, y: base - ph - 2, w: 8, h: 2.6, color: lighten(PALETTE.leaf, 0.15) });
    out.push({ kind: 'ellipse', x: x + 1, y: base - ph - 4, w: 6, h: 2.2, color: darken(PALETTE.leaf, 0.1) });
  }
  return out;
}
```

3. Append the geometry helpers:

```ts
export function primBounds(prims: Prim[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x: number, y: number, rx: number, ry: number) => {
    minX = Math.min(minX, x - rx);
    maxX = Math.max(maxX, x + rx);
    minY = Math.min(minY, y - ry);
    maxY = Math.max(maxY, y + ry);
  };
  for (const p of prims) {
    if (p.kind === 'ellipse') add(p.x, p.y, p.w / 2, p.h / 2);
    else if (p.kind === 'circle') add(p.x, p.y, p.r, p.r);
    else for (let i = 0; i < p.points.length; i += 2) add(p.points[i]!, p.points[i + 1]!, p.width / 2, p.width / 2);
  }
  return { minX, minY, maxX, maxY };
}

export function offsetPrims(prims: Prim[], dx: number, dy: number): Prim[] {
  return prims.map((p) =>
    p.kind === 'line' ? { ...p, points: p.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) } : { ...p, x: p.x + dx, y: p.y + dy },
  );
}

export function scalePrims(prims: Prim[], k: number): Prim[] {
  return prims.map((p) => {
    if (p.kind === 'ellipse') return { ...p, x: p.x * k, y: p.y * k, w: p.w * k, h: p.h * k };
    if (p.kind === 'circle') return { ...p, x: p.x * k, y: p.y * k, r: p.r * k };
    return { ...p, points: p.points.map((v) => v * k), width: p.width * k };
  });
}
```

- [ ] **Step 4: Run all tests**

Run: `npm test && npm run typecheck`
Expected: all pass, including the 7 existing plant-shape tests.

- [ ] **Step 5: Commit**

```bash
git add src/render tests/render/shapes.test.ts
git commit -m "feat(render): richer plant shapes and prim geometry helpers"
```

---

### Task 4: The living diorama scene

**Files:**
- Create: `src/render/plants/plantTextures.ts`, `src/render/scene/atmosphere.ts`, `src/render/scene/effects.ts`
- Rewrite: `src/render/scene/DioramaScene.ts`
- Modify: `src/main.ts`, `src/styles.css`, `src/app/app.ts` (`Stage` gains optional `highlight`; pass `trayTarget`)

**Interfaces:**
- Consumes: Task 2 (`sceneMath`), Task 3 (`plantPrims`, `primBounds`, `offsetPrims`, `scalePrims`), the existing `ObjectArt`, `Celebration`, `TapGate`, projection and engine `RADIUS`/`SCRAP`
- Produces:
  - `AttachOptions { reducedMotion; interactive; trayTarget?: (plant: PlantType) => { x: number; y: number } | null }`
  - `DioramaScene.setHighlight(tile: Pos | null): void`
  - `Stage.highlight?(tile: Pos | null): void`

Phaser code has no unit tests. Step 8 is the browser gate.

- [ ] **Step 1: Check the Phaser 4 particle API**

Run: `grep -nE "particles\(x\?|particles\(x: number|explode\(count|maxAliveParticles|killTweensOf|addCounter|chain\(config|sort\(property" node_modules/phaser/types/phaser.d.ts | head -14`
Expected: `add.particles(x, y, texture, config)`, `ParticleEmitter.explode(count, x, y)`, `maxAliveParticles`, `tweens.killTweensOf`, `tweens.addCounter` and `tweens.chain` and `Container.sort(property)` all exist. If any name differs, use the d.ts name and record a ruling.

- [ ] **Step 2: Create `src/render/plants/plantTextures.ts`**

```ts
import type Phaser from 'phaser';
import { drawPrims } from './plantArt';
import { offsetPrims, plantPrims, primBounds, scalePrims, type PlantDrawInput } from './plantShapes';

/** Plant textures are drawn at 2× and shown at 0.5 so they stay crisp when the camera zooms in. */
export const PLANT_RES = 2;
const PAD = 2;

export interface PlantTexture {
  key: string;
  /** Where the tile's ground centre sits inside the texture, as origin fractions. */
  originX: number;
  originY: number;
}

export function ensurePlantTexture(scene: Phaser.Scene, key: string, input: PlantDrawInput): PlantTexture {
  const scaled = scalePrims(plantPrims(input), PLANT_RES);
  const b = primBounds(scaled);
  const dx = -b.minX + PAD;
  const dy = -b.minY + PAD;
  const w = Math.ceil(b.maxX - b.minX + PAD * 2);
  const h = Math.ceil(b.maxY - b.minY + PAD * 2);
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({}, false);
    drawPrims(g, offsetPrims(scaled, dx, dy));
    g.generateTexture(key, w, h);
    g.destroy();
  }
  return { key, originX: dx / w, originY: dy / h };
}
```

- [ ] **Step 3: Create `src/render/scene/atmosphere.ts`**

```ts
import Phaser from 'phaser';
import type { IsoView } from '../iso/projection';
import { darken, PALETTE } from '../palette';
import { islandCorners, skyColors } from './sceneMath';

const DEPTH = 22;
const BANDS = [0x5a4a3a, 0x4a3d30, 0x3a3027];
const v2 = (pts: { x: number; y: number }[]) => pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));

/** The sky is a CSS gradient behind a transparent canvas; this just updates its colours. */
export function applySky(progress: number): void {
  const { top, bottom } = skyColors(progress);
  const s = document.documentElement.style;
  s.setProperty('--sky-top', top);
  s.setProperty('--sky-bottom', bottom);
}

export function drawIsland(g: Phaser.GameObjects.Graphics, v: IsoView): void {
  g.clear();
  const { top, right, bottom, left } = islandCorners(v);
  g.fillStyle(0x000000, 0.35).fillEllipse((left.x + right.x) / 2, (top.y + bottom.y) / 2 + DEPTH + 14, (right.x - left.x) * 1.04, (bottom.y - top.y) * 1.04);
  const band = DEPTH / BANDS.length;
  BANDS.forEach((c, i) => {
    const y0 = i * band;
    const y1 = (i + 1) * band;
    g.fillStyle(c, 1).fillPoints(v2([{ x: left.x, y: left.y + y0 }, { x: bottom.x, y: bottom.y + y0 }, { x: bottom.x, y: bottom.y + y1 }, { x: left.x, y: left.y + y1 }]), true);
    g.fillStyle(darken(c, 0.18), 1).fillPoints(v2([{ x: bottom.x, y: bottom.y + y0 }, { x: right.x, y: right.y + y0 }, { x: right.x, y: right.y + y1 }, { x: bottom.x, y: bottom.y + y1 }]), true);
  });
}

export function makeParticleTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('mote')) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture('mote', 8, 8);
    g.destroy();
  }
  if (!scene.textures.exists('petal')) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillEllipse(5, 3, 10, 6);
    g.generateTexture('petal', 10, 6);
    g.destroy();
  }
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Drifting dust over a bare scene that turns into pollen as it recovers. */
export class Ambient {
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly pollen: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, area: Rect, layer: Phaser.GameObjects.Container) {
    const base = {
      x: { min: area.x, max: area.x + area.w },
      y: { min: area.y, max: area.y + area.h },
      lifespan: 7000,
      speedX: { min: -8, max: 8 },
      frequency: 420,
      maxAliveParticles: 18,
      scale: { start: 0.55, end: 0.2 },
      alpha: { start: 0.55, end: 0 },
    };
    this.dust = scene.add.particles(0, 0, 'mote', { ...base, speedY: { min: -6, max: 3 }, tint: PALETTE.dust });
    this.pollen = scene.add.particles(0, 0, 'mote', { ...base, speedY: { min: -12, max: -3 }, tint: [PALETTE.pollen, 0xfff8d8], emitting: false });
    layer.add([this.dust, this.pollen]);
  }

  setProgress(progress: number): void {
    const lush = progress >= 0.5;
    if (lush && !this.pollen.emitting) {
      this.dust.stop();
      this.pollen.start();
    } else if (!lush && !this.dust.emitting) {
      this.pollen.stop();
      this.dust.start();
    }
  }

  destroy(): void {
    this.dust.destroy();
    this.pollen.destroy();
  }
}
```

- [ ] **Step 4: Create `src/render/scene/effects.ts`**

```ts
import Phaser from 'phaser';
import { PALETTE } from '../palette';
import type { Rect } from './atmosphere';

type Movable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;
const HW = 32;
const HH = 16;
const v2 = (pts: { x: number; y: number }[]) => pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
const diamond = (x: number, y: number) => v2([{ x, y: y - HH }, { x: x + HW, y }, { x, y: y + HH }, { x: x - HW, y }]);

/** One-shot feedback effects. Callers skip them entirely under Reduce motion. */
export class Effects {
  constructor(private readonly scene: Phaser.Scene, private readonly layer: Phaser.GameObjects.Container) {}

  burst(x: number, y: number, color: number, count: number, speed = 40): void {
    const em = this.scene.add.particles(x, y, 'mote', {
      speed: { min: speed * 0.5, max: speed },
      lifespan: 450,
      scale: { start: 0.45, end: 0 },
      gravityY: 90,
      tint: color,
      emitting: false,
    });
    this.layer.add(em);
    em.explode(count);
    this.scene.time.delayedCall(700, () => em.destroy());
  }

  pop(target: Movable, from = 0.6, ms = 250, baseScale = 1): void {
    this.scene.tweens.killTweensOf(target);
    target.setScale(from * baseScale);
    this.scene.tweens.add({ targets: target, scale: baseScale, duration: ms, ease: 'Back.Out' });
  }

  drop(target: Movable, onLand: () => void): void {
    this.scene.tweens.killTweensOf(target);
    const y = target.y;
    target.y = y - 40;
    this.scene.tweens.add({ targets: target, y, duration: 350, ease: 'Bounce.Out', onComplete: onLand });
  }

  /** A Manhattan ring of radius r on an isometric grid is an axis-aligned rectangle on screen. */
  ripple(x: number, y: number, radius: number): void {
    const g = this.scene.add.graphics();
    this.layer.add(g);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 400,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const r = t * (radius + 0.5);
        g.clear().lineStyle(2, PALETTE.ring, 0.8 * (1 - t)).strokeRect(x - r * HW, y - r * HH, 2 * r * HW, 2 * r * HH);
      },
      onComplete: () => g.destroy(),
    });
  }

  shake(target: Movable): void {
    const x = target.x;
    this.scene.tweens.add({ targets: target, x: x + 4, duration: 50, yoyo: true, repeat: 1, onComplete: () => (target.x = x) });
  }

  /** Petals burst from (x, y), then fly to the tray target, both in world coordinates. */
  flyTo(x: number, y: number, tx: number, ty: number, color: number, count = 6): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const p = this.scene.add.image(x, y, 'petal').setTint(color).setScale(0.8);
      this.layer.add(p);
      this.scene.tweens.chain({
        targets: p,
        tweens: [
          { x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 12, duration: 150, ease: 'Quad.Out' },
          { x: tx, y: ty, scale: 0.35, angle: 180, duration: 450, ease: 'Quad.In' },
        ],
        onComplete: () => p.destroy(),
      });
    }
  }

  shimmer(tiles: { x: number; y: number; delay: number }[]): void {
    for (const t of tiles) {
      const g = this.scene.add.graphics().setAlpha(0);
      g.fillStyle(0xfff6d8, 1).fillPoints(diamond(t.x, t.y), true);
      this.layer.add(g);
      this.scene.tweens.add({ targets: g, alpha: 0.45, delay: t.delay, duration: 220, yoyo: true, onComplete: () => g.destroy() });
    }
  }

  fireflies(area: Rect): void {
    const zone = new Phaser.Geom.Rectangle(area.x, area.y, area.w, area.h);
    const flies = this.scene.add.particles(0, 0, 'mote', {
      emitZone: { type: 'random', source: zone },
      lifespan: 4000,
      speed: { min: 4, max: 14 },
      scale: { start: 0.45, end: 0.2 },
      alpha: { start: 1, end: 0 },
      tint: PALETTE.firefly,
      blendMode: 'ADD',
      emitting: false,
    });
    const petals = this.scene.add.particles(0, 0, 'petal', {
      x: { min: area.x, max: area.x + area.w },
      y: area.y,
      lifespan: 4000,
      speedY: { min: 10, max: 26 },
      speedX: { min: -10, max: 10 },
      rotate: { min: 0, max: 360 },
      alpha: { start: 0.9, end: 0 },
      tint: [...PALETTE.petal],
      emitting: false,
    });
    this.layer.add([flies, petals]);
    flies.explode(14);
    petals.explode(18);
    this.scene.time.delayedCall(4500, () => {
      flies.destroy();
      petals.destroy();
    });
  }
}
```

- [ ] **Step 5: Rewrite `src/render/scene/DioramaScene.ts`**

```ts
import Phaser from 'phaser';
import { cellStatus, RADIUS, SCRAP, type GameEvent, type GameState, type PlantType, type Pos } from '../../engine';
import type { PlayController, View } from '../../game/controller';
import { depth, sceneBounds, toGrid, toScreen, type IsoView, type Rotation } from '../iso/projection';
import { drawBlock, type ObjectArt } from '../objects/objectArt';
import manifest from '../objects/sprites.json';
import { makeSpriteObjectArt, spriteAssets, type SpriteManifest } from '../objects/spriteArt';
import { darken, lerpColor, PALETTE } from '../palette';
import { ensurePlantTexture, PLANT_RES } from '../plants/plantTextures';
import { Ambient, applySky, drawIsland, makeParticleTextures, type Rect } from './atmosphere';
import { Celebration } from './celebration';
import { Effects } from './effects';
import { diffTiles, plantTextureKey, plantVariant, rippleDelay, swayFor, TextureLru, washDelays } from './sceneMath';
import { TapGate } from './tapGate';

export const TILE_W = 64;
export const TILE_H = 32;
const HW = TILE_W / 2;
const HH = TILE_H / 2;
const SLAB = 6;
const HUD_SPACE = 180;
const BASE = 1 / PLANT_RES;
const STATUS_GLYPH = { growing: '↑', grown: '✿', blocked: '×' } as const;

export interface AttachOptions {
  reducedMotion: boolean;
  interactive: boolean;
  /** Screen (CSS px) position of the tray button a harvested seed flies to. */
  trayTarget?: (plant: PlantType) => { x: number; y: number } | null;
}

type Shape = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Depth;
interface TileView {
  pos: Pos;
  ground: Phaser.GameObjects.Graphics;
  wall: Phaser.GameObjects.Graphics | null;
  object: Shape | null;
  objectName: string | null;
  objectHeight: number;
  plant: Phaser.GameObjects.Image | null;
  plantKey: string | null;
  sway: { amplitude: number; period: number; phase: number } | null;
}

const key = (p: Pos) => `${p.x},${p.y}`;
const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const v2 = (pts: { x: number; y: number }[]) => pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
const DIAMOND = v2([{ x: 0, y: -HH }, { x: HW, y: 0 }, { x: 0, y: HH }, { x: -HW, y: 0 }]);
const diamondAt = (x: number, y: number) => v2([{ x, y: y - HH }, { x: x + HW, y }, { x, y: y + HH }, { x: x - HW, y }]);

function drawGround(g: Phaser.GameObjects.Graphics, ground: 'soil' | 'concrete', progress: number): void {
  const top = ground === 'soil' ? lerpColor(PALETTE.soilDry, PALETTE.soilLush, progress) : lerpColor(PALETTE.concreteDry, PALETTE.concreteLush, progress);
  g.clear();
  g.fillStyle(darken(top, 0.25), 1).fillPoints(v2([{ x: -HW, y: 0 }, { x: 0, y: HH }, { x: 0, y: HH + SLAB }, { x: -HW, y: SLAB }]), true);
  g.fillStyle(darken(top, 0.4), 1).fillPoints(v2([{ x: 0, y: HH }, { x: HW, y: 0 }, { x: HW, y: SLAB }, { x: 0, y: HH + SLAB }]), true);
  g.fillStyle(top, 1).fillPoints(DIAMOND, true);
  g.lineStyle(1, darken(top, 0.15), 0.6).strokePoints(DIAMOND, true);
}

export class DioramaScene extends Phaser.Scene {
  private ctrl: PlayController | null = null;
  private opts: AttachOptions = { reducedMotion: false, interactive: true };
  private unsubscribe: (() => void) | null = null;
  private ready = false;
  private pending: { ctrl: PlayController | null; opts: AttachOptions } | null = null;
  private pinch: { dist: number; zoom: number } | null = null;
  private celebration = new Celebration((ms, fn) => {
    const t = this.time.delayedCall(ms, fn);
    return () => t.remove(false);
  });
  private pendingTurn: Phaser.Time.TimerEvent | null = null;
  private lastRotation: Rotation = 0;
  private readonly gate = new TapGate();
  private baseZoom = 1;
  private userZoom = 1;
  private readonly art: ObjectArt = makeSpriteObjectArt(manifest as SpriteManifest, import.meta.env.BASE_URL);
  private readonly lru = new TextureLru(200);
  private island!: Phaser.GameObjects.Graphics;
  private groundLayer!: Phaser.GameObjects.Container;
  private preview!: Phaser.GameObjects.Graphics;
  private highlightG!: Phaser.GameObjects.Graphics;
  private world!: Phaser.GameObjects.Container;
  private fxLayer!: Phaser.GameObjects.Container;
  private labels!: Phaser.GameObjects.Container;
  private effects!: Effects;
  private ambient: Ambient | null = null;
  private views: TileView[] = [];
  private prevState: GameState | null = null;
  private progressDrawn = -1;
  private highlight: Pos | null = null;

  constructor() {
    super('diorama');
  }

  preload(): void {
    for (const { key: k, url } of spriteAssets(manifest as SpriteManifest, import.meta.env.BASE_URL)) this.load.image(k, url);
    this.load.on('loaderror', (file: { key: string }) => console.warn('[Afterlife] sprite failed to load, using drawn shape:', file.key));
  }

  create(): void {
    makeParticleTextures(this);
    this.island = this.add.graphics().setDepth(-50);
    this.groundLayer = this.add.container(0, 0).setDepth(0);
    this.preview = this.add.graphics().setDepth(10);
    this.highlightG = this.add.graphics().setDepth(11);
    this.world = this.add.container(0, 0).setDepth(20);
    this.fxLayer = this.add.container(0, 0).setDepth(30);
    this.labels = this.add.container(0, 0).setDepth(40);
    this.effects = new Effects(this, this.fxLayer);
    this.tweens.add({ targets: this.highlightG, alpha: { from: 0.35, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
    this.input.mouse?.disableContextMenu();
    this.input.addPointer(1);
    this.input.on('pointerdown', () => this.gate.down());
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.zoomBy(dy > 0 ? 0.9 : 1.1));
    this.input.keyboard?.on('keydown-Q', () => this.opts.interactive && this.ctrl?.rotate(-1));
    this.input.keyboard?.on('keydown-E', () => this.opts.interactive && this.ctrl?.rotate(1));
    this.input.keyboard?.on('keydown-ESC', () => this.ctrl?.select(null));
    this.scale.on('resize', () => this.fit());
    this.ready = true;
    if (this.pending) {
      const { ctrl, opts } = this.pending;
      this.pending = null;
      this.attach(ctrl, opts);
    }
  }

  attach(ctrl: PlayController | null, opts: AttachOptions): void {
    if (!this.ready) {
      this.pending = { ctrl, opts };
      return;
    }
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.ctrl = ctrl;
    this.opts = opts;
    this.userZoom = 1;
    this.highlight = null;
    this.celebration.cancel();
    this.pendingTurn?.remove(false);
    this.pendingTurn = null;
    this.clearBoard();
    if (!ctrl) {
      applySky(0);
      return;
    }
    this.lastRotation = ctrl.view.rotation;
    this.unsubscribe = ctrl.onChange((view, events) => this.onChange(view, events));
    this.build(ctrl.view);
    this.fit();
  }

  setHighlight(tile: Pos | null): void {
    this.highlight = tile;
    this.drawHighlight();
  }

  update(time: number): void {
    if (this.opts.reducedMotion) return;
    for (const tv of this.views) {
      if (tv?.plant && tv.sway) tv.plant.rotation = tv.sway.amplitude * Math.sin((2 * Math.PI * time) / tv.sway.period + tv.sway.phase);
    }
  }

  private isoOf(view: View): IsoView {
    return { width: view.state.width, height: view.state.height, rotation: view.rotation, tileW: TILE_W, tileH: TILE_H };
  }

  private area(view: View): Rect {
    const b = sceneBounds(this.isoOf(view));
    return { x: b.centerX - b.width / 2, y: b.centerY - b.height / 2, w: b.width, h: b.height };
  }

  private clearBoard(): void {
    this.tweens.killTweensOf([...this.world.list, ...this.fxLayer.list]);
    this.groundLayer.removeAll(true);
    this.world.removeAll(true);
    this.fxLayer.removeAll(true);
    this.labels.removeAll(true);
    this.preview.clear();
    this.highlightG.clear();
    this.island.clear();
    this.ambient?.destroy();
    this.ambient = null;
    this.views = [];
    this.prevState = null;
    this.progressDrawn = -1;
  }

  private build(view: View): void {
    this.clearBoard();
    const v = this.isoOf(view);
    const s = view.state;
    drawIsland(this.island, v);
    const order = s.tiles.map((_, i) => i).sort((a, b) => depth(v, { x: a % s.width, y: Math.floor(a / s.width) }) - depth(v, { x: b % s.width, y: Math.floor(b / s.width) }));
    this.views = new Array(s.tiles.length);
    for (const i of order) {
      const pos = { x: i % s.width, y: Math.floor(i / s.width) };
      const c = toScreen(v, pos);
      const ground = this.add.graphics({ x: c.x, y: c.y });
      this.groundLayer.add(ground);
      const tv: TileView = { pos, ground, wall: null, object: null, objectName: null, objectHeight: 0, plant: null, plantKey: null, sway: null };
      this.views[i] = tv;
      if (s.tiles[i]!.ground === 'blocked') {
        tv.wall = this.add.graphics({ x: c.x, y: c.y }).setDepth(depth(v, pos) * 10 + 1);
        drawBlock(tv.wall, { shape: 'box', x: 0, y: 0, w: 1, d: 1, z: 0, h: 18, color: PALETTE.wall });
        this.world.add(tv.wall);
      }
      this.setObject(tv, s, v);
      this.setPlant(tv, s, v);
    }
    this.drawGrounds(view);
    this.world.sort('depth');
    this.prevState = s;
    if (!this.opts.reducedMotion) {
      this.ambient = new Ambient(this, this.area(view), this.fxLayer);
      this.ambient.setProgress(view.progress);
    }
    this.drawPreview(view);
    this.drawHighlight();
    this.drawLabels(view);
  }

  private drawGrounds(view: View): void {
    const s = view.state;
    for (const tv of this.views) {
      const t = s.tiles[tv.pos.y * s.width + tv.pos.x]!;
      if (t.ground === 'blocked') tv.ground.clear();
      else drawGround(tv.ground, t.ground, view.progress);
    }
    this.progressDrawn = view.progress;
    applySky(view.progress);
    this.ambient?.setProgress(view.progress);
  }

  private setObject(tv: TileView, s: GameState, v: IsoView): void {
    const t = s.tiles[tv.pos.y * s.width + tv.pos.x]!;
    const name = t.object?.name ?? null;
    if (name === tv.objectName && tv.object) return;
    if (tv.object) {
      this.tweens.killTweensOf(tv.object);
      tv.object.destroy();
    }
    tv.object = null;
    tv.objectName = name;
    tv.objectHeight = 0;
    if (!name) return;
    const c = toScreen(v, tv.pos);
    const obj = this.art.create(this, c.x, c.y, name, v.rotation) as Shape;
    obj.setDepth(depth(v, tv.pos) * 10 + 1);
    this.world.add(obj);
    tv.object = obj;
    tv.objectHeight = this.art.topHeight(name);
  }

  private setPlant(tv: TileView, s: GameState, v: IsoView): void {
    const cell = s.tiles[tv.pos.y * s.width + tv.pos.x]!.plant;
    if (!cell) {
      if (tv.plant) {
        this.tweens.killTweensOf(tv.plant);
        tv.plant.destroy();
      }
      tv.plant = null;
      tv.plantKey = null;
      tv.sway = null;
      return;
    }
    const k = plantTextureKey(cell, tv.pos.x, tv.pos.y, tv.objectHeight);
    const tex = ensurePlantTexture(this, k, { ...cell, plantId: plantVariant(cell, tv.pos.x, tv.pos.y), x: 0, y: 0, objectHeight: tv.objectHeight });
    const c = toScreen(v, tv.pos);
    if (!tv.plant) {
      tv.plant = this.add.image(c.x, c.y, k);
      this.world.add(tv.plant);
    } else {
      this.tweens.killTweensOf(tv.plant);
      tv.plant.setTexture(k).setPosition(c.x, c.y);
    }
    tv.plant.setOrigin(tex.originX, tex.originY).setScale(BASE).setDepth(depth(v, tv.pos) * 10 + 2);
    tv.plantKey = k;
    tv.sway = this.opts.reducedMotion ? null : swayFor(cell.type, tv.pos.x, tv.pos.y);
    if (!tv.sway) tv.plant.rotation = 0;
    const inUse = new Set(this.views.map((x) => x?.plantKey).filter((x): x is string => !!x));
    for (const old of this.lru.touch(k, inUse)) if (this.textures.exists(old)) this.textures.remove(old);
  }

  private onChange(view: View, events: GameEvent[]): void {
    if (!this.prevState || view.rotation !== this.lastRotation || view.state.width !== this.prevState.width || view.state.height !== this.prevState.height) {
      this.lastRotation = view.rotation;
      this.build(view);
      this.fit();
    } else if (view.state !== this.prevState) {
      this.applyChanges(view, events);
    }
    if (Math.abs(view.progress - this.progressDrawn) > 0.001) this.drawGrounds(view);
    this.drawPreview(view);
    this.drawLabels(view);
    if (events.some((e) => e.type === 'won') && this.opts.interactive && !this.opts.reducedMotion) this.celebrate(view, events);
  }

  private applyChanges(view: View, events: GameEvent[]): void {
    const s = view.state;
    const v = this.isoOf(view);
    const changes = diffTiles(this.prevState, s);
    this.prevState = s;
    const motion = !this.opts.reducedMotion;
    const scrapEv = events.find((e) => e.type === 'placedScrap');
    const radius = scrapEv && scrapEv.type === 'placedScrap' ? RADIUS[SCRAP[scrapEv.scrap].size] : 0;
    const growLag = scrapEv ? 350 : 0;
    const spreadTo = new Set(events.flatMap((e) => (e.type === 'spread' ? [key(e.to)] : [])));
    const harvest = events.find((e) => e.type === 'harvested');
    for (const ch of changes) {
      const tv = this.views[ch.pos.y * s.width + ch.pos.x]!;
      const c = toScreen(v, ch.pos);
      if (ch.object) {
        this.setObject(tv, s, v);
        if (motion && tv.object && ch.object === 'added' && scrapEv && same(scrapEv.pos, ch.pos)) {
          this.effects.drop(tv.object, () => {
            this.effects.burst(c.x, c.y, PALETTE.dust, 8, 50);
            this.effects.ripple(c.x, c.y, radius);
          });
        }
      }
      if (!ch.plant && !ch.object) continue;
      this.setPlant(tv, s, v);
      const plant = tv.plant;
      if (!motion || !plant) continue;
      const delay = (scrapEv ? rippleDelay(scrapEv.pos, ch.pos, radius) : 0) + growLag;
      switch (ch.plant) {
        case 'added':
          if (spreadTo.has(key(ch.pos))) {
            plant.setScale(0);
            this.tweens.add({ targets: plant, scale: BASE, delay: delay + 150, duration: 450, ease: 'Back.Out' });
          } else {
            this.effects.pop(plant, 0.6, 250, BASE);
            this.effects.burst(c.x, c.y, PALETTE.seed, 5, 30);
          }
          break;
        case 'grew':
          plant.scaleY = 0.2 * BASE;
          this.tweens.add({ targets: plant, scaleY: BASE, delay, duration: 500, ease: 'Back.Out' });
          break;
        case 'bloomed':
          plant.setScale(0.6 * BASE);
          this.tweens.add({ targets: plant, scale: BASE, delay, duration: 600, ease: 'Back.Out' });
          break;
        case 'unbloomed':
          if (harvest && harvest.type === 'harvested') this.flyHarvest(c, harvest.seed);
          break;
        default:
          break;
      }
    }
    this.world.sort('depth');
  }

  private flyHarvest(from: { x: number; y: number }, seed: PlantType): void {
    const target = this.opts.trayTarget?.(seed);
    if (!target) return;
    const w = this.cameras.main.getWorldPoint(target.x, target.y);
    this.effects.flyTo(from.x, from.y - 14, w.x, w.y, PALETTE.petal[0]);
  }

  private drawPreview(view: View): void {
    const g = this.preview.clear();
    const p = view.preview;
    if (!p) return;
    const v = this.isoOf(view);
    for (const t of p.ring) {
      const c = toScreen(v, t);
      g.lineStyle(2, PALETTE.ring, 0.55).strokePoints(diamondAt(c.x, c.y), true);
    }
    const c = toScreen(v, p.tile);
    g.fillStyle(p.valid ? PALETTE.ring : PALETTE.invalid, 0.35).fillPoints(diamondAt(c.x, c.y), true);
    for (const t of p.glowing) {
      const gc = toScreen(v, t);
      g.fillStyle(PALETTE.glow, 0.45).fillEllipse(gc.x, gc.y, TILE_W * 0.7, TILE_H * 0.7);
    }
  }

  private drawHighlight(): void {
    const g = this.highlightG.clear();
    if (!this.highlight || !this.ctrl) return;
    const c = toScreen(this.isoOf(this.ctrl.view), this.highlight);
    g.lineStyle(3, PALETTE.firefly, 1).strokePoints(diamondAt(c.x, c.y), true);
    g.fillStyle(PALETTE.firefly, 0.25).fillPoints(diamondAt(c.x, c.y), true);
  }

  private drawLabels(view: View): void {
    this.labels.removeAll(true);
    if (view.selection?.kind !== 'scrap') return;
    const v = this.isoOf(view);
    const s = view.state;
    for (const tv of this.views) {
      if (!tv?.plant) continue;
      const st = cellStatus(s, tv.pos);
      if (!st || st === 'seed') continue;
      const c = toScreen(v, tv.pos);
      this.labels.add(this.add.text(c.x, c.y - tv.objectHeight - 30, STATUS_GLYPH[st], { fontFamily: 'Nunito, sans-serif', fontSize: '15px', color: '#f4f1e4', stroke: '#23251f', strokeThickness: 3 }).setOrigin(0.5));
    }
  }

  private celebrate(view: View, events: GameEvent[]): void {
    const ctrl = this.ctrl;
    if (!ctrl) return;
    const v = this.isoOf(view);
    const last = [...events].reverse().find((e): e is Extract<GameEvent, { pos: Pos }> => 'pos' in e);
    const origin = last?.pos ?? { x: Math.floor(view.state.width / 2), y: Math.floor(view.state.height / 2) };
    const wash = washDelays(view.state, origin);
    this.cameras.main.flash(600, 255, 248, 225);
    this.effects.shimmer(wash.map((w) => ({ ...toScreen(v, w.pos), delay: w.delay })));
    this.effects.fireflies(this.area(view));
    const lastDelay = wash.at(-1)?.delay ?? 0;
    this.pendingTurn = this.time.delayedCall(lastDelay + 300, () => {
      this.pendingTurn = null;
      if (this.ctrl === ctrl) this.celebration.start(ctrl, 450);
    });
  }

  fit(): void {
    if (!this.ctrl) return;
    const b = sceneBounds(this.isoOf(this.ctrl.view));
    const narrow = this.scale.width < 600;
    const side = narrow ? 16 : 96;
    const hud = narrow ? 150 : HUD_SPACE;
    this.baseZoom = clamp(Math.min(this.scale.width / (b.width + side), (this.scale.height - hud) / (b.height + 40)), 0.5, 3);
    const cam = this.cameras.main;
    cam.setZoom(clamp(this.baseZoom * this.userZoom, 0.5, 3));
    cam.centerOn(b.centerX, b.centerY - 10 / cam.zoom);
  }

  private zoomBy(f: number): void {
    this.userZoom = clamp(this.userZoom * f, 0.5, 3);
    this.cameras.main.setZoom(clamp(this.baseZoom * this.userZoom, 0.5, 3));
  }

  private pick(p: Phaser.Input.Pointer): Pos | null {
    if (!this.ctrl) return null;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    return toGrid(this.isoOf(this.ctrl.view), wp.x, wp.y);
  }

  private handlePinch(): boolean {
    const a = this.input.pointer1;
    const b = this.input.pointer2;
    if (a.isDown && b.isDown) {
      this.gate.pinch();
      const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      if (!this.pinch) this.pinch = { dist: d, zoom: this.cameras.main.zoom };
      else {
        this.userZoom = clamp((this.pinch.zoom * d) / this.pinch.dist / this.baseZoom, 0.5, 3);
        this.cameras.main.setZoom(clamp(this.baseZoom * this.userZoom, 0.5, 3));
      }
      return true;
    }
    return false;
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.ctrl || !this.opts.interactive) return;
    if (this.handlePinch()) return;
    if (!p.wasTouch) this.ctrl.hover(this.pick(p));
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const anyDown = this.input.pointer1.isDown || this.input.pointer2.isDown;
    const isTap = this.gate.up(anyDown);
    if (!anyDown) this.pinch = null;
    if (!isTap || !this.ctrl || !this.opts.interactive || this.celebration.running) return;
    if (p.rightButtonReleased()) {
      this.ctrl.select(null);
      return;
    }
    const tile = this.pick(p);
    if (!tile) return;
    const events = this.ctrl.tap(tile, p.wasTouch ? 'touch' : 'mouse');
    const pv = this.ctrl.view.preview;
    if (events.length === 0 && pv && !pv.valid && same(pv.tile, tile) && !this.opts.reducedMotion) {
      const tv = this.views[tile.y * this.ctrl.view.state.width + tile.x];
      if (tv) this.effects.shake(tv.ground);
    }
  }
}
```

- [ ] **Step 6: Transparent canvas and sky CSS**

In `src/main.ts`:
1. Replace `backgroundColor: '#23251f',` with `transparent: true,` in the Phaser config.
2. Replace the App's stage argument `{ show: (ctrl, opts) => scene.attach(ctrl, opts) }` with `{ show: (ctrl, opts) => scene.attach(ctrl, opts), highlight: (tile) => scene.setHighlight(tile) }`.

In `src/app/app.ts`:
1. Change the `Stage` interface to:

```ts
export interface Stage {
  show(ctrl: PlayController | null, opts: AttachOptions): void;
  highlight?(tile: Pos | null): void;
}
```

   Import `type Pos` from `'../engine'` alongside `LevelData`.
2. In `startLevel`, pass `trayTarget` in the stage options:

```ts
    this.stage.show(ctrl, {
      reducedMotion: this.reducedMotion,
      interactive: true,
      trayTarget: (plant) => {
        const el = this.root.querySelector<HTMLElement>(`[data-action="seed"][data-plant="${plant}"]`) ?? this.root.querySelector<HTMLElement>('.tray');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      },
    });
```

The App test `starts a level with the HUD and an interactive stage` asserts the exact options object. Change its expectation to `expect.objectContaining({ reducedMotion: false, interactive: true })`.

In `src/styles.css`, add at the top (after `:root {…}`):

```css
@property --sky-top { syntax: '<color>'; inherits: true; initial-value: #2b3036; }
@property --sky-bottom { syntax: '<color>'; inherits: true; initial-value: #3d3a33; }
#stage { background: linear-gradient(to bottom, var(--sky-top), var(--sky-bottom)); transition: --sky-top 1.5s ease, --sky-bottom 1.5s ease; }
```

- [ ] **Step 7: Typecheck and test**

Run: `npm run typecheck && npm test`
Expected: all pass. Fix any Phaser typing mismatch with the smallest d.ts-matching change, and record a ruling for each.

- [ ] **Step 8: Browser gate** (dev server and headless Chrome harness, `window.afterlife*` DEV hooks)

Check each of these, with a screenshot where it says so:
1. **Bus Stop:** sky gradient, earth island with a shadow, drifting motes. Screenshot.
2. **A tyre between two seeds:** the tyre drops and bounces, a dust puff and ripple ring follow, then the plants rise from their base. 900 ms after the move, every plant image has `scaleY === 0.5` (= BASE) and the texture key of its new stage.
3. **Rapid moves settle:** apply 6 solution moves with no waits, then undo twice, then wait 1.2 s. Every plant image has scale 0.5, and its texture key equals `plantTextureKey` of the current state (compute this in page JS from `afterlife.controller.view.state`).
4. **Hover does not cut animations:** start a grow, move the mouse across 5 tiles during the 500 ms, and check that the plant still ends at scale 0.5.
5. **Rotation hygiene:** after 4 rotations mid-animation, the number of world children equals walls + objects + plants in the state.
6. **Sway:** two `rotation` samples 400 ms apart differ for a bamboo or flower.
7. **Harvest:** in Petrol Station, play the solution to a bloom and harvest it: petals fly toward the seed tray.
8. **Invalid tap:** with Moss selected, click the bench tile twice: the ground shakes and nothing is placed.
9. **Win:** win any level: shimmer wash, fireflies and petals, then the camera turn and the panel. Screenshot.
10. **Title demo** still plays (non-interactive), with the sky and particles.
11. **No console errors.**

- [ ] **Step 9: Commit**

```bash
git add src tests
git commit -m "feat(render): living diorama with persistent tiles, plant textures, sway, effects, atmosphere and celebration"
```

---

### Task 5: Tutorial logic

**Files:**
- Create: `src/game/tutorial.ts`
- Test: `tests/game/tutorial.test.ts`

**Interfaces:**
- Consumes: engine `createInitialState`, `placeSeed`, `placeScrap`, `LevelData`, `GameEvent`, `Pos`; `View` (controller)
- Produces:
  - `type CoachTarget = 'seed-moss' | 'scrap' | 'tile' | 'meter'`
  - `interface CoachStep { step: number; total: number; text: string; target: CoachTarget }`
  - `TUTORIAL_STEPS`
  - `interface TutorialPlan { seed1: Pos; seed2: Pos; scrap: Pos }`
  - `planTutorial(level): TutorialPlan`
  - `class Tutorial { constructor(plan); update(view, events): void; finish(): void; readonly step: number; readonly done: boolean; readonly current: CoachStep | null; readonly highlight: Pos | null }`

- [ ] **Step 1: Write the failing test** at `tests/game/tutorial.test.ts`

```ts
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

  it('touch: the preview tap does not advance, the confirming tap does', () => {
    const { plan, c, t, act } = setup();
    act(() => c.select({ kind: 'seed', plant: 'moss' }));
    act(() => c.tap(plan.seed1, 'touch'));
    expect(t.step).toBe(2);
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/game/tutorial.test.ts`
Expected: FAIL, with a module-not-found error for `src/game/tutorial`.

- [ ] **Step 3: Create `src/game/tutorial.ts`**

```ts
import { createInitialState, placeScrap, placeSeed, type GameEvent, type LevelData, type Pos } from '../engine';
import type { View } from './controller';

export type CoachTarget = 'seed-moss' | 'scrap' | 'tile' | 'meter';
export interface CoachStep {
  step: number;
  total: number;
  text: string;
  target: CoachTarget;
}
export interface TutorialPlan {
  seed1: Pos;
  seed2: Pos;
  scrap: Pos;
}

export const TUTORIAL_STEPS: { text: string; target: CoachTarget }[] = [
  { text: 'Tap Moss in your tray.', target: 'seed-moss' },
  { text: 'Tap a soil tile to plant it.', target: 'tile' },
  { text: 'Plant one more next to it.', target: 'tile' },
  { text: 'Now pick a Tyre.', target: 'scrap' },
  { text: 'Drop it beside your seeds — everything inside the ring grows.', target: 'tile' },
  { text: 'Keep going! Fill the meter to restore the bus stop.', target: 'meter' },
];

/** Suggested tiles near the centre: two diagonal seeds and a scrap tile touching both. */
export function planTutorial(level: LevelData): TutorialPlan {
  const s = createInitialState(level);
  const cx = (s.width - 1) / 2;
  const cy = (s.height - 1) / 2;
  const tiles: Pos[] = [];
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) tiles.push({ x, y });
  tiles.sort((a, b) => Math.abs(a.x - cx) + Math.abs(a.y - cy) - (Math.abs(b.x - cx) + Math.abs(b.y - cy)) || a.y - b.y || a.x - b.x);
  const bare = (st: typeof s, p: Pos) => st.tiles[p.y * st.width + p.x]?.object === null;
  for (const a of tiles) {
    const r1 = placeSeed(s, 'moss', a);
    if (!r1.ok || !bare(s, a)) continue;
    for (const b of [{ x: a.x + 1, y: a.y + 1 }, { x: a.x - 1, y: a.y + 1 }, { x: a.x + 1, y: a.y - 1 }, { x: a.x - 1, y: a.y - 1 }]) {
      const r2 = placeSeed(r1.state, 'moss', b);
      if (!r2.ok || !bare(s, b)) continue;
      for (const c of [{ x: b.x, y: a.y }, { x: a.x, y: b.y }]) {
        if (placeScrap(r2.state, 0, c).ok) return { seed1: a, seed2: b, scrap: c };
      }
    }
  }
  throw new Error(`no tutorial layout for ${level.id}`);
}

/** Step machine built on facts that only ever accumulate, so undo can't move it backwards. */
export class Tutorial {
  private mossSelected = false;
  private seeds = 0;
  private scrapSelected = false;
  private scrapPlaced = false;
  private ended = false;

  constructor(readonly plan: TutorialPlan) {}

  get step(): number {
    if (this.scrapPlaced) return 6;
    if (this.seeds >= 2) return this.scrapSelected ? 5 : 4;
    if (this.seeds === 1) return 3;
    return this.mossSelected ? 2 : 1;
  }

  get done(): boolean {
    return this.ended;
  }

  get current(): CoachStep | null {
    if (this.ended) return null;
    const step = this.step;
    return { step, total: TUTORIAL_STEPS.length, ...TUTORIAL_STEPS[step - 1]! };
  }

  get highlight(): Pos | null {
    if (this.ended) return null;
    switch (this.step) {
      case 2:
        return this.plan.seed1;
      case 3:
        return this.plan.seed2;
      case 5:
        return this.plan.scrap;
      default:
        return null;
    }
  }

  update(view: View, events: GameEvent[]): void {
    if (this.ended) return;
    const before = this.step;
    if (view.selection?.kind === 'seed' && view.selection.plant === 'moss') this.mossSelected = true;
    if (view.selection?.kind === 'scrap') this.scrapSelected = true;
    for (const e of events) {
      if (e.type === 'placedSeed') this.seeds += 1;
      if (e.type === 'placedScrap') this.scrapPlaced = true;
    }
    const moved = events.some((e) => e.type === 'placedSeed' || e.type === 'placedScrap' || e.type === 'harvested');
    if (before === 6 && moved) this.ended = true;
  }

  finish(): void {
    this.ended = true;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/game && npm run typecheck`
Expected: all PASS. If `planTutorial` picks tiles whose scrap tile is not adjacent to both seeds, the test shows it; fix the search, not the test.

- [ ] **Step 5: Commit**

```bash
git add src/game/tutorial.ts tests/game/tutorial.test.ts
git commit -m "feat(game): guided tutorial plan and step machine"
```

---

### Task 6: HUD polish and coach bubble

**Files:**
- Create: `src/ui/icons.ts`
- Modify: `src/ui/hud.ts`, `src/styles.css`
- Test: `tests/ui/icons.test.ts`, `tests/ui/hud.test.ts` (append)

**Interfaces:**
- Consumes: `CoachStep` (Task 5)
- Produces:
  - `ICONS: Record<string, string>` (inline SVG markup)
  - `HudMeta.tutorial?: CoachStep | null`
  - `HudHandlers.help(): void` and `HudHandlers.skipTutorial(): void`
  - `Hud` constructor gains an optional third parameter `now: () => number = () => Date.now()`

- [ ] **Step 1: Write the failing tests**

`tests/ui/icons.test.ts`:

```ts
import { expect, it } from 'vitest';
import { PLANT_TYPES, SCRAP_KINDS } from '../../src/engine';
import { ICONS } from '../../src/ui/icons';

it('has an inline SVG icon for every plant, every scrap kind and help', () => {
  for (const k of [...PLANT_TYPES, ...SCRAP_KINDS, 'help']) {
    expect(ICONS[k], k).toMatch(/^<svg [^>]*viewBox="0 0 32 32"/);
    expect(ICONS[k]).toContain('aria-hidden="true"');
  }
});
```

Append to `tests/ui/hud.test.ts`. Also add `help: vi.fn(), skipTutorial: vi.fn(),` to `handlers()`.

```ts
describe('Hud v1.1', () => {
  it('shows icons in tray buttons and a help button', () => {
    const c = new PlayController(makeLevel({ batches: [['tyre']] }));
    const h = handlers();
    const hud = new Hud(root, h);
    hud.render(c.view, meta);
    expect(root.querySelector('[data-plant="moss"] svg')).not.toBeNull();
    expect(root.querySelector('[data-action="scrap"] svg')).not.toBeNull();
    click(root.querySelector('[data-action="help"]'));
    expect(h.help).toHaveBeenCalled();
  });

  it('glows the meter for 700 ms when progress jumps by 5% or more', () => {
    let t = 0;
    const c = new PlayController(makeLevel({ width: 3, height: 1, ground: ['...'], target: 1, batches: [['tyre', 'tyre']] }));
    const hud = new Hud(root, handlers(), () => t);
    hud.render(c.view, meta);
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'scrap', slot: 0, x: 1, y: 0 });
    hud.render(c.view, meta);
    expect(root.querySelector('.meter')!.classList.contains('glow')).toBe(true);
    t = 500;
    hud.render(c.view, meta);
    expect(root.querySelector('.meter')!.classList.contains('glow')).toBe(true);
    t = 800;
    hud.render(c.view, meta);
    expect(root.querySelector('.meter')!.classList.contains('glow')).toBe(false);
  });

  it('bumps a seed button when its count rises', () => {
    const t = 0;
    const c = new PlayController(makeLevel());
    const hud = new Hud(root, handlers(), () => t);
    hud.render(c.view, meta);
    const s = structuredClone(c.view);
    s.state = { ...s.state, seeds: { ...s.state.seeds, moss: s.state.seeds.moss + 1 } };
    hud.render(s, meta);
    expect(root.querySelector('[data-plant="moss"]')!.classList.contains('bump')).toBe(true);
  });

  it('renders the coach bubble, marks its target and offers Skip', () => {
    const c = new PlayController(makeLevel({ batches: [['tyre']] }));
    const h = handlers();
    const hud = new Hud(root, h);
    hud.render(c.view, { ...meta, tutorial: { step: 1, total: 6, text: 'Tap Moss in your tray.', target: 'seed-moss' } });
    expect(root.querySelector('.coach')!.textContent).toContain('Step 1 of 6');
    expect(root.querySelector('.coach')!.textContent).toContain('Tap Moss in your tray.');
    expect(root.querySelector('.hint')).toBeNull();
    expect(root.querySelector('[data-plant="moss"]')!.classList.contains('coach-target')).toBe(true);
    hud.render(c.view, { ...meta, tutorial: { step: 4, total: 6, text: 'Now pick a Tyre.', target: 'scrap' } });
    expect(root.querySelector('[data-action="scrap"]')!.classList.contains('coach-target')).toBe(true);
    hud.render(c.view, { ...meta, tutorial: { step: 6, total: 6, text: 'Keep going!', target: 'meter' } });
    expect(root.querySelector('.meter')!.classList.contains('coach-target')).toBe(true);
    click(root.querySelector('[data-action="skip-tutorial"]'));
    expect(h.skipTutorial).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui`
Expected: the new tests fail; `icons.ts` is missing.

- [ ] **Step 3: Create `src/ui/icons.ts`**

```ts
const svg = (body: string) => `<svg class="icon" viewBox="0 0 32 32" width="22" height="22" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS: Record<string, string> = {
  moss: svg('<ellipse cx="11" cy="21" rx="8" ry="5" fill="#5d7a2f"/><ellipse cx="20" cy="19" rx="9" ry="6" fill="#89a94a"/><ellipse cx="17" cy="16" rx="3" ry="1.6" fill="#c5d98f"/>'),
  vine: svg('<path d="M8 27 C10 18 18 18 16 10 S22 4 24 5" stroke="#4a6b2a" stroke-width="2.2" fill="none" stroke-linecap="round"/><ellipse cx="12" cy="19" rx="4.5" ry="2.4" fill="#58934a"/><ellipse cx="19" cy="11" rx="4.5" ry="2.4" fill="#3f7a3a"/>'),
  flower: svg('<path d="M16 28 V14" stroke="#4a6b2a" stroke-width="2.2"/><ellipse cx="12" cy="21" rx="4" ry="2" fill="#4f8a3c"/><g fill="#e89ab0"><circle cx="16" cy="7" r="3.4"/><circle cx="21" cy="10.5" r="3.4"/><circle cx="19" cy="15.5" r="3.4"/><circle cx="13" cy="15.5" r="3.4"/><circle cx="11" cy="10.5" r="3.4"/></g><circle cx="16" cy="11.5" r="2.6" fill="#f6e7a8"/>'),
  bamboo: svg('<g stroke-linecap="round"><path d="M12 29 V6" stroke="#9fb85a" stroke-width="3.2"/><path d="M20 29 V10" stroke="#86a046" stroke-width="3.2"/></g><g stroke="#5f7430" stroke-width="1.2"><path d="M10 14h4M10 21h4M18 17h4M18 24h4"/></g><ellipse cx="16" cy="6" rx="5" ry="1.8" fill="#4f8a3c"/>'),
  tyre: svg('<ellipse cx="16" cy="18" rx="11" ry="8" fill="#2e2c2a"/><ellipse cx="16" cy="15" rx="11" ry="7" fill="#45423e"/><ellipse cx="16" cy="15" rx="4.5" ry="2.8" fill="#1b1a19"/>'),
  can: svg('<rect x="11" y="9" width="10" height="16" rx="2" fill="#8b979c"/><ellipse cx="16" cy="9" rx="5" ry="2" fill="#b7c0c4"/>'),
  cone: svg('<path d="M16 5 L23 25 H9 Z" fill="#d9773a"/><path d="M12.6 15 H19.4 L20.5 18 H11.5 Z" fill="#f1ede2"/><rect x="6" y="25" width="20" height="3" rx="1" fill="#b85f2c"/>'),
  crate: svg('<path d="M16 6 L27 11 L16 16 L5 11 Z" fill="#a47e58"/><path d="M5 11 L16 16 V27 L5 22 Z" fill="#8c6a48"/><path d="M27 11 L16 16 V27 L27 22 Z" fill="#6b4f35"/>'),
  barrel: svg('<rect x="9" y="7" width="14" height="19" rx="3" fill="#9a5b3c"/><rect x="9" y="11" width="14" height="2" fill="#6e3f2a"/><rect x="9" y="19" width="14" height="2" fill="#6e3f2a"/><ellipse cx="16" cy="7" rx="7" ry="2.4" fill="#b8775a"/>'),
  sign: svg('<rect x="15" y="12" width="2" height="16" fill="#5a6468"/><path d="M16 3 L26 13 H6 Z" fill="#b8a24a"/><path d="M15 8h2v3h-2z" fill="#3a3a34"/>'),
  car: svg('<path d="M4 20 L8 13 H22 L28 20 V24 H4 Z" fill="#9a5b3c"/><path d="M10 14 H20 L23 19 H8 Z" fill="#cfcac0"/><circle cx="10" cy="24" r="3" fill="#2e2c2a"/><circle cx="23" cy="24" r="3" fill="#2e2c2a"/>'),
  help: svg('<circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M12.5 12.5a3.6 3.6 0 1 1 5.2 3.2c-1.2.6-1.7 1.3-1.7 2.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="16" cy="22.8" r="1.6" fill="currentColor"/>'),
};
```

- [ ] **Step 4: Update `src/ui/hud.ts`**

1. Import `{ ICONS } from './icons'` and `type { CoachStep } from '../game/tutorial'`.
2. Add `help(): void;` and `skipTutorial(): void;` to `HudHandlers`, and `tutorial?: CoachStep | null;` to `HudMeta`.
3. Constructor: `constructor(root: HTMLElement, private readonly handlers: HudHandlers, private readonly now: () => number = () => Date.now())`.
4. Add the fields `private prevProgress: number | null = null;`, `private glowUntil = 0;`, `private prevSeeds: Record<string, number> | null = null;` and `private bumpUntil: Record<string, number> = {};`.
5. At the start of `render`, before computing html:

```ts
    const t = this.now();
    if (this.prevProgress !== null && view.progress - this.prevProgress >= 0.05) this.glowUntil = t + 700;
    this.prevProgress = view.progress;
    if (this.prevSeeds) for (const [k, n] of Object.entries(view.state.seeds)) if (n > (this.prevSeeds[k] ?? 0)) this.bumpUntil[k] = t + 500;
    this.prevSeeds = { ...view.state.seeds };
```

6. Add click cases: `case 'help': return h.help();` and `case 'skip-tutorial': return h.skipTutorial();`.
7. In `html()`:
   - At the top, add `const now = this.now(); const coach = m.tutorial ?? null;`.
   - In the seed map (`(p) => …`, where `p` is the plant type), set the class to `${on ? 'selected' : ''} ${(this.bumpUntil[p] ?? 0) > now ? 'bump' : ''} ${coach?.target === 'seed-moss' && p === 'moss' ? 'coach-target' : ''}` and replace the swatch span with `${ICONS[p]}`.
   - Scrap button: class `${on ? 'selected' : ''} ${coach?.target === 'scrap' && i === 0 ? 'coach-target' : ''}`, with `${ICONS[k] ?? ''}` before the name.
   - Meter div: `class="meter ${this.glowUntil > now ? 'glow' : ''} ${coach?.target === 'meter' ? 'coach-target' : ''}"`.
   - Replace the hint paragraph with `${coach ? `<div class="coach" role="status"><span class="coach-step">Step ${coach.step} of ${coach.total}</span><p>${esc(coach.text)}</p><button data-action="skip-tutorial">Skip tutorial</button></div>` : `<p class="hint">${esc(m.hint)}</p>`}`.
   - In `hud-tools`, add a first button: `<button data-action="help" aria-label="How to play">${ICONS.help}</button>`.

- [ ] **Step 5: Styles** (append to `src/styles.css`)

```css
.icon { display: block; flex: none; }
.tray button { padding-left: 12px; }
.meter.glow .meter-fill { box-shadow: 0 0 12px 3px rgba(156, 194, 90, 0.75); }
.meter.glow { animation: meter-glow 600ms ease-out; }
@keyframes meter-glow { from { transform: scaleY(1.6); } to { transform: scaleY(1); } }
.bump { animation: bump 450ms ease-out; }
@keyframes bump { 30% { transform: scale(1.14); } 100% { transform: scale(1); } }
.coach { position: absolute; top: calc(max(12px, env(safe-area-inset-top)) + 56px); left: 50%; transform: translateX(-50%); width: min(420px, calc(100% - 32px)); background: #f1ede2; color: #23251f; border-radius: 16px; padding: 12px 16px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35); pointer-events: auto; display: grid; gap: 4px; }
.coach p { margin: 0; font-weight: 700; font-size: 17px; }
.coach-step { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b5f52; }
.coach button { justify-self: end; min-height: 36px; background: transparent; color: #6b5f52; border-color: #c9c2b2; }
.coach-target { outline: 3px solid #f2c14e; outline-offset: 3px; animation: coach-pulse 1.2s ease-in-out infinite; }
@keyframes coach-pulse { 50% { outline-color: rgba(242, 193, 78, 0.25); } }
#ui .coach { pointer-events: auto; }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: all pass. App tests compile because `App` passes handlers; add `help` and `skipTutorial` stubs there now (they are wired for real in Task 7): `help: () => {}, skipTutorial: () => {},`.

- [ ] **Step 7: Commit**

```bash
git add src tests
git commit -m "feat(ui): tray icons, meter glow, seed bump, help button and coach bubble"
```

---

### Task 7: App: tutorial flow, How to Play, transitions

**Files:**
- Modify: `src/app/app.ts`, `src/styles.css`
- Test: `tests/app/app.test.ts` (append)

**Interfaces:**
- Consumes: `Tutorial`, `planTutorial` (Task 5); `ICONS` (Task 6); `Stage.highlight` (Task 4); `SaveData.tutorialDone` (Task 1)
- Produces:
  - `Screen` gains `'howto'`
  - `App.startLevel(index, opts?: { tutorial?: boolean })`
  - `App.openHowTo(): void` (in-level overlay)
  - `<html>` gets the class `reduce-motion` when reduced motion is on

- [ ] **Step 1: Write the failing tests** (append to `tests/app/app.test.ts`)

```ts
describe('App teaching', () => {
  const coach = () => root.querySelector('.coach');

  it('guides the first Bus Stop and highlights suggested tiles', () => {
    const highlight = vi.fn();
    const app = new App(root, { show: vi.fn(), highlight }, memoryStore(), LEVELS, opts);
    app.startLevel(0);
    expect(coach()!.textContent).toContain('Tap Moss in your tray.');
    click('[data-action="seed"][data-plant="moss"]');
    expect(coach()!.textContent).toContain('Tap a soil tile to plant it.');
    expect(highlight).toHaveBeenLastCalledWith(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
  });

  it('skip saves tutorialDone and the coach does not return', () => {
    const store = memoryStore();
    const app = new App(root, stage, store, LEVELS, opts);
    app.startLevel(0);
    click('[data-action="skip-tutorial"]');
    expect(coach()).toBeNull();
    expect(JSON.parse(store.data[SAVE_KEY]!).tutorialDone).toBe(true);
    app.startLevel(0);
    expect(coach()).toBeNull();
  });

  it('leaving and returning restarts the tutorial from step 1 until done', () => {
    const app = new App(root, stage, memoryStore(), LEVELS, opts);
    app.startLevel(0);
    click('[data-action="seed"][data-plant="moss"]');
    click('[data-action="menu"]');
    app.startLevel(0);
    expect(coach()!.textContent).toContain('Step 1 of 6');
  });

  it('does not guide other levels', () => {
    const app = new App(root, stage, memoryStore(), LEVELS, opts);
    app.startLevel(1);
    expect(coach()).toBeNull();
  });

  it('How to Play from the title shows 5 cards and can replay the tutorial', () => {
    const saved = JSON.stringify({ version: 1, completed: [], tutorialDone: true, settings: { reducedMotion: false, muted: false, volume: 0.8 } });
    const app = new App(root, stage, memoryStore({ [SAVE_KEY]: saved }), LEVELS, opts);
    click('[data-nav="howto"]');
    expect(app.screen).toBe('howto');
    expect(root.querySelectorAll('.howto-card')).toHaveLength(5);
    click('[data-replay-tutorial]');
    expect(app.screen).toBe('play');
    expect(app.controller!.level.id).toBe('bus-stop');
    expect(coach()).not.toBeNull();
  });

  it('the in-level ? opens How to Play over the level and Back keeps the level state', () => {
    const app = new App(root, stage, memoryStore({ [SAVE_KEY]: JSON.stringify({ version: 1, completed: [], tutorialDone: true, settings: {} }) }), LEVELS, opts);
    app.startLevel(0);
    const ctrl = app.controller!;
    ctrl.play(LEVELS[0]!.solution[0]!);
    click('[data-action="help"]');
    expect(root.querySelectorAll('.howto-card')).toHaveLength(5);
    click('[data-close-howto]');
    expect(root.querySelector('.howto-card')).toBeNull();
    expect(app.controller).toBe(ctrl);
    expect(ctrl.view.canUndo).toBe(true);
  });

  it('marks the document for reduced motion', () => {
    new App(root, stage, memoryStore(), LEVELS, { ...opts, prefersReducedMotion: true });
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
    new App(root, stage, memoryStore(), LEVELS, opts);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/app`
Expected: the new tests fail (no coach, no howto screen, no class).

- [ ] **Step 3: Implement in `src/app/app.ts`**

1. Imports: `{ planTutorial, Tutorial } from '../game/tutorial'`, `{ ICONS } from '../ui/icons'`.
2. `export type Screen = 'title' | 'select' | 'settings' | 'credits' | 'howto' | 'play';`
3. Fields: `private tutorial: Tutorial | null = null;`, `private tutorialTimer: ReturnType<typeof setTimeout> | null = null;` and `private howto: HTMLElement | null = null;`.
4. In the constructor, after the sound setup: `this.applyMotionClass();`. Add the method:

```ts
  private applyMotionClass(): void {
    document.documentElement.classList.toggle('reduce-motion', this.reducedMotion);
  }
```

   Call it at the end of `updateSettings` too.
5. In `teardown()`, add:

```ts
    if (this.tutorialTimer) clearTimeout(this.tutorialTimer);
    this.tutorialTimer = null;
    this.tutorial = null;
    this.howto?.remove();
    this.howto = null;
    this.stage.highlight?.(null);
```

6. Change the signature to `startLevel(index: number, opts: { tutorial?: boolean } = {}): void`.
   - After `this.controller = ctrl;`, add:

```ts
    this.tutorial = index === 0 && (opts.tutorial || !this.save.tutorialDone) ? new Tutorial(planTutorial(level)) : null;
```

   - In the Hud handlers, add `help: () => this.openHowTo(),` and `skipTutorial: () => this.finishTutorial(),`.
   - Extend `meta()` with `tutorial: this.tutorial?.current ?? null`.
   - In `onChange`, before `hud.render(view, meta())`, add:

```ts
      if (this.tutorial) {
        this.tutorial.update(view, events);
        if (this.tutorial.done) this.finishTutorial();
        else {
          this.stage.highlight?.(this.tutorial.highlight);
          if (this.tutorial.step === 6 && !this.tutorialTimer) this.tutorialTimer = setTimeout(() => this.finishTutorial(), 4000);
        }
      }
```

   - After the stage is shown, add `this.stage.highlight?.(this.tutorial?.highlight ?? null);`.
7. Add the methods:

```ts
  private finishTutorial(): void {
    if (this.tutorialTimer) clearTimeout(this.tutorialTimer);
    this.tutorialTimer = null;
    this.tutorial = null;
    this.stage.highlight?.(null);
    if (!this.save.tutorialDone) {
      this.save = { ...this.save, tutorialDone: true };
      writeSave(this.store, this.save);
    }
    this.renderHud?.();
  }

  openHowTo(): void {
    if (this.howto) return;
    const el = document.createElement('div');
    el.className = 'howto-overlay';
    el.innerHTML = this.howtoHtml(true);
    this.root.appendChild(el);
    this.howto = el;
    el.querySelector<HTMLElement>('[data-close-howto]')?.focus();
  }

  private closeHowTo(): void {
    this.howto?.remove();
    this.howto = null;
  }

  private howtoHtml(inLevel: boolean): string {
    const cards: [string, string, string][] = [
      [ICONS.moss!, 'Plant', 'Pick a seed in the tray, then tap a tile.'],
      [ICONS.tyre!, 'Feed', 'Scrap makes every plant inside its ring grow one step. Small scrap reaches 1 tile, medium 2, large 3.'],
      [ICONS.flower!, 'Grow', 'Grown moss and vines spread to new tiles. Flowers bloom — tap a bloom for a free seed. Bamboo grows tall.'],
      [ICONS.crate!, 'Restore', 'Cover the scene — the scrap too — to fill the meter.'],
      [ICONS.bamboo!, 'Relax', 'No timer, no losing. Undo any time; rotate (◀ ▶ or Q/E) and zoom to look around.'],
    ];
    const list = cards.map(([icon, title, text]) => `<li class="howto-card">${icon}<h3>${title}</h3><p>${text}</p></li>`).join('');
    const back = inLevel ? '<button data-close-howto class="primary">Back to the level</button>' : '<button data-nav="title" class="primary">Back</button>';
    return `<main class="screen howto-screen"><h2>How to play</h2><ol class="howto-list">${list}</ol><div class="actions">${back}<button data-replay-tutorial>Replay tutorial</button></div></main>`;
  }
```

8. In `onClick`, before the `[data-nav]` check, add:

```ts
    if (el.closest('[data-close-howto]')) return this.closeHowTo();
    if (el.closest('[data-replay-tutorial]')) return this.startLevel(0, { tutorial: true });
```

9. In `template()`, add `case 'howto': return this.howtoHtml(false);`. On the title, add `<button data-nav="howto">How to Play</button>` after Play. In settings, add `<button data-nav="howto">How to play</button>` before `${back}`.

- [ ] **Step 4: Styles** (append to `src/styles.css`)

```css
.screen, .hud > * { animation: fade-in 250ms ease-out; }
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
.reduce-motion *, .reduce-motion *::before, .reduce-motion *::after { animation: none !important; transition: none !important; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
.howto-screen { background: var(--bg); }
.howto-overlay { position: absolute; inset: 0; z-index: 5; pointer-events: auto; }
.howto-list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; width: min(900px, 100%); counter-reset: card; }
.howto-card { background: #33342e; border-radius: var(--radius); padding: 16px; text-align: left; counter-increment: card; }
.howto-card .icon { width: 40px; height: 40px; }
.howto-card h3 { margin: 8px 0 4px; }
.howto-card h3::before { content: counter(card) '. '; color: var(--accent); }
.howto-card p { margin: 0; color: var(--muted); }
.actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: all pass. The earlier App tests still pass because `highlight` is optional and tutorials only start on level 0. If an earlier test drives level 0 by clicking tray buttons, the coach doesn't block clicks.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "feat(app): guided Bus Stop tutorial, How to Play screen and overlay, fades and reduce-motion class"
```

---

### Task 8: Verify and ship

**Files:**
- Modify: only what fixes problems found here (logic fixes get a failing test first; visual fixes get a ledger note)

- [ ] **Step 1: Suite, build and size**

Run: `npm test && npm run build && cat dist/assets/play-*.js dist/assets/play-*.css | gzip -c | wc -c`
Expected: all pass, and well under 3,000,000.

- [ ] **Step 2: Tutorial walkthrough in the browser** (dev server; desktop 1280×800 and phone 390×844 with touch)

Use a fresh storage. Play Bus Stop **with real clicks or taps only**:
1. Coach step 1: the Moss button pulses.
2. Tap Moss: step 2, with the suggested tile glowing on the board.
3. Place the seed (touch: two taps): step 3.
4. Then steps 4 and 5, each target pulsing.
5. Drop the tyre: step 6 points at the meter, and the coach hides after about 4 s.

Screenshot each step at both sizes. Reload: the tutorial does not come back. Then title → How to Play: 5 cards, and Replay tutorial works. In-level `?`: the overlay opens, Back returns to the level, and nothing is lost.

- [ ] **Step 3: Reduce motion**

Turn on Settings → Reduce motion, start a level and make a move. Then:
- the scene's active tweens count is 0 (excluding the highlight pulse when it isn't shown);
- there are no particle emitters in the fx layer;
- plant `rotation` stays 0 across two samples;
- screens appear without fades.

- [ ] **Step 4: Performance**

At 390×844, with CPU throttled ×4 through CDP (`Emulation.setCPUThrottlingRate`), open Playground and play the full solution plus Keep decorating. Count `requestAnimationFrame` callbacks over 3 s: at least 135 (45 fps). Note the number. If it's lower, reduce the work (e.g. sway only every other frame, or fewer motes) and re-measure, recording a ruling.

- [ ] **Step 5: All levels look right**

Screenshot each level at start and after its solution, plus Bus Stop at rotations 1–3. Check that:
- plants sit correctly on ground and on objects;
- the island is under the board in every rotation;
- the sky warms as progress rises.

Visual fixes get ledger notes.

- [ ] **Step 6: Ship**

Merge to `main` and push (this deploys automatically). Then run the live check against https://afterlife-one.vercel.app:
- the landing page loads;
- the game starts, and the tutorial step 1 appears with fresh storage;
- a real tap advances it;
- there are no failed requests and no console errors.

```bash
git push
```

Expected: the Vercel production deployment is READY, and the live check passes.
