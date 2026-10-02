# Afterlife — Plan 1: Engine & Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Afterlife's complete game-rules engine in pure TypeScript, plus the 5 level files, with automated proof that every level can be solved. There are no graphics yet.

**Architecture:** `src/engine/` is a pure, framework-free rules library. Every action (`placeSeed`, `placeScrap`, `harvest`) takes a `GameState` and returns a **new** state plus a list of events; it never mutates its input. A `Session` wraps this with undo and restart. Levels are JSON data files validated by a loader. A beam-search solver tool writes each level's reference solution, and a test replays it.

**Tech Stack:** TypeScript 7.0.2, Vitest 5.0.3 (with Vite 8 as its peer), tsx 4 for running tools, Node 26.

**Spec:** `docs/superpowers/specs/2026-10-03-afterlife-design.md`. This is Plan 1 of 3. Plan 2 (the playable Phaser game) and Plan 3 (audio, landing page, launch) are written after this plan ships.

## Global Constraints

- The engine (`src/engine/`) never imports Phaser and never touches the DOM or `localStorage`.
- Distance is **Manhattan** (|dx| + |dy|). Scrap growth radius: small = 1, medium = 2, large = 3.
- Scrap catalogue: tyre, can, cone = small; crate, barrel, sign = medium; car = large.
- Plants: moss (max stage 2, grows on ground or small objects, spreads 1); vine (max 3, ground or any object, spreads 1 preferring object tiles); flower (max 3, ground only, grows 1 bloom); bamboo (max 5, ground only, no spread).
- "Neighbour" means the 4 orthogonal tiles. A tile is eligible when its ground isn't `blocked`, it has no plant cell, and the plant can grow on its object.
- Placing a seed causes **no** growth. Growth happens only when scrap is placed.
- Coverage = tiles with a plant cell at **stage ≥ 1** ÷ all non-blocked tiles.
- Won is **sticky**: once reached, `state.won` stays true and `won` is emitted only on the first transition.
- Stuck: not won, the tray is empty and no batches remain.
- Randomness comes only from the seeded RNG stored in `state.rng`: the same moves always produce the same state.
- Level files live at `src/levels/NN-name.json`; there are exactly 5.
- No names, art, levels or audio from Cloud Gardens.
- Code licence MIT; the GitHub repo is **public**.

## Review Focus

1. **Tapping outside the grid or on a blocked tile** must reject the move with a reason and never throw. Pinned in Task 6 (`rejects out-of-bounds and blocked tiles without throwing`).
2. **Using the last scrap without reaching the target** must emit `stuck`, and further scrap moves must be rejected cleanly. Pinned in Task 6 (`emits stuck…`).
3. **Undo after winning, then winning again** must emit `won` again, so the game can replay the celebration. Pinned in Task 7 (`undo after win…`).
4. **Undo then redo the same move** must give an identical garden, because the RNG state is part of the undone state. Pinned in Task 7 (`undo restores RNG…`).
5. **Running out of seeds or harvesting an empty flower** must reject the move with a reason, never go negative and never give a free seed. Pinned in Task 6 (`rejects when no seeds left`, `rejects harvest without a bloom`).

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vitest.config.ts` | Tooling |
| `src/engine/types.ts` | All shared types |
| `src/engine/catalog.ts` | Scrap sizes, radii, plant rules |
| `src/engine/rng.ts` | Seeded random numbers (mulberry32) |
| `src/engine/grid.ts` | Tile lookup, bounds, distance, neighbours, cloning |
| `src/engine/level.ts` | Level validation and initial state |
| `src/engine/growth.ts` | Growth ticks, spreading, blooming (mutates a working copy) |
| `src/engine/queries.ts` | Coverage, cell status, stuck, scrap preview |
| `src/engine/actions.ts` | `placeSeed`, `placeScrap`, `harvest`, `applyMove` |
| `src/engine/session.ts` | Undo and restart history |
| `src/engine/index.ts` | Public exports |
| `src/levels/*.json`, `src/levels/index.ts` | The 5 levels |
| `tools/solve.ts` | Beam-search solver that writes reference solutions |
| `tests/engine/*.test.ts`, `tests/levels/*.test.ts` | Tests |

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `tests/sanity.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm test`, `npm run typecheck` and `npm run solve` scripts used by every later task.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "afterlife",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "description": "A calm isometric web game about nature reclaiming abandoned places.",
  "license": "MIT",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "solve": "tsx tools/solve.ts"
  }
}
```

- [ ] **Step 2: Install dev dependencies**

Run: `cd ~/Desktop/Afterlife && npm install -D typescript@7.0.2 vitest@5.0.3 vite@8 tsx@4 @types/node@26`
Expected: `added N packages`, no errors. If `@types/node@26` doesn't exist, use `@types/node@latest`.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2023", "DOM"],
    "strict": true,
    "noEmit": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["node"]
  },
  "include": ["src", "tests", "tools", "vitest.config.ts"]
}
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 5: Create `tests/sanity.test.ts`**

```ts
import { expect, it } from 'vitest';

it('runs tests', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: `1 passed`; typecheck prints nothing and exits 0.

- [ ] **Step 7: Commit**

`.gitignore` already contains `node_modules/`, `dist/`, `.DS_Store`, `.vercel`, `*.html`. Remove the `*.html` line, because Plan 2 needs `index.html`.

```bash
sed -i '' '/^\*\.html$/d' .gitignore
git add package.json package-lock.json tsconfig.json vitest.config.ts tests/sanity.test.ts .gitignore
git commit -m "chore: scaffold TypeScript + Vitest project"
```

---

### Task 2: Types, catalogue, RNG and grid helpers

**Files:**
- Create: `src/engine/types.ts`, `src/engine/catalog.ts`, `src/engine/rng.ts`, `src/engine/grid.ts`
- Test: `tests/engine/basics.test.ts`

**Interfaces:**
- Produces (used everywhere later):
  - Types: `Ground`, `Size`, `PlantType`, `ScrapKind`, `Pos`, `WorldObject`, `PlantCell`, `Tile`, `SeedCounts`, `GameState`, `Move`, `GameEvent`, `ActionResult`, `RuinSpec`, `LevelData`
  - `RADIUS: Record<Size, number>`, `SCRAP: Record<ScrapKind, { size: Size }>`, `PLANTS: Record<PlantType, PlantRule>`, `PLANT_TYPES: PlantType[]`, `SCRAP_KINDS: ScrapKind[]`
  - `nextRandom(seed: number): [value: number, nextSeed: number]`, `pickIndex(seed: number, length: number): [index: number, nextSeed: number]`
  - `idx(s, p): number`, `inBounds(s, p): boolean`, `tileAt(s, p): Tile | null`, `posOf(s, i): Pos`, `manhattan(a, b): number`, `neighbours(s, p): Pos[]`, `cloneState(s): GameState`

- [ ] **Step 1: Write the failing test** at `tests/engine/basics.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { PLANTS, RADIUS, SCRAP } from '../../src/engine/catalog';
import { manhattan, neighbours } from '../../src/engine/grid';
import { nextRandom, pickIndex } from '../../src/engine/rng';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    expect(nextRandom(42)).toEqual(nextRandom(42));
  });
  it('returns values in [0, 1) and advances the seed', () => {
    let seed = 7;
    const values = new Set<number>();
    for (let i = 0; i < 100; i++) {
      const [v, next] = nextRandom(seed);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      values.add(v);
      seed = next;
    }
    expect(values.size).toBeGreaterThan(90);
  });
  it('pickIndex stays within range', () => {
    let seed = 1;
    for (let i = 0; i < 50; i++) {
      const [index, next] = pickIndex(seed, 3);
      expect([0, 1, 2]).toContain(index);
      seed = next;
    }
  });
});

describe('catalog', () => {
  it('maps sizes to radii', () => {
    expect(RADIUS).toEqual({ small: 1, medium: 2, large: 3 });
    expect(SCRAP.tyre.size).toBe('small');
    expect(SCRAP.crate.size).toBe('medium');
    expect(SCRAP.car.size).toBe('large');
  });
  it('knows where each plant can grow', () => {
    const small = { kind: 'scrap' as const, name: 'tyre', size: 'small' as const };
    const medium = { kind: 'ruin' as const, name: 'tank', size: 'medium' as const };
    expect(PLANTS.moss.growsOn(null)).toBe(true);
    expect(PLANTS.moss.growsOn(small)).toBe(true);
    expect(PLANTS.moss.growsOn(medium)).toBe(false);
    expect(PLANTS.vine.growsOn(medium)).toBe(true);
    expect(PLANTS.flower.growsOn(small)).toBe(false);
    expect(PLANTS.bamboo.growsOn(null)).toBe(true);
    expect([PLANTS.moss.maxStage, PLANTS.vine.maxStage, PLANTS.flower.maxStage, PLANTS.bamboo.maxStage]).toEqual([2, 3, 3, 5]);
  });
});

describe('grid', () => {
  const s = { width: 3, height: 3 };
  it('measures manhattan distance', () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 2, y: 1 })).toBe(3);
  });
  it('lists in-bounds orthogonal neighbours', () => {
    expect(neighbours(s, { x: 0, y: 0 })).toEqual([{ x: 1, y: 0 }, { x: 0, y: 1 }]);
    expect(neighbours(s, { x: 1, y: 1 })).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine/basics.test.ts`
Expected: FAIL, with "Failed to load url ../../src/engine/catalog" or a similar module-not-found error.

- [ ] **Step 3: Create `src/engine/types.ts`**

```ts
export type Ground = 'soil' | 'concrete' | 'blocked';
export type Size = 'small' | 'medium' | 'large';
export type PlantType = 'moss' | 'vine' | 'flower' | 'bamboo';
export type ScrapKind = 'tyre' | 'can' | 'cone' | 'crate' | 'barrel' | 'sign' | 'car';

export interface Pos {
  x: number;
  y: number;
}

export interface WorldObject {
  kind: 'ruin' | 'scrap';
  name: string;
  size: Size;
}

export interface PlantCell {
  plantId: number;
  type: PlantType;
  stage: number;
  bloom: boolean;
}

export interface Tile {
  ground: Ground;
  object: WorldObject | null;
  plant: PlantCell | null;
}

export type SeedCounts = Record<PlantType, number>;

export interface GameState {
  width: number;
  height: number;
  /** Row-major: index = y * width + x */
  tiles: Tile[];
  seeds: SeedCounts;
  /** The scrap batch currently offered to the player. */
  tray: ScrapKind[];
  /** Batches still to come, in order. */
  batches: ScrapKind[][];
  target: number;
  /** Seed type given by harvesting; null means the flower's own type. */
  harvestYield: PlantType | null;
  rng: number;
  nextPlantId: number;
  won: boolean;
}

export type Move =
  | { type: 'seed'; plant: PlantType; x: number; y: number }
  | { type: 'scrap'; slot: number; x: number; y: number }
  | { type: 'harvest'; x: number; y: number };

export type GameEvent =
  | { type: 'placedSeed'; pos: Pos; plant: PlantType }
  | { type: 'placedScrap'; pos: Pos; scrap: ScrapKind }
  | { type: 'grew'; pos: Pos; stage: number }
  | { type: 'spread'; from: Pos; to: Pos; plant: PlantType }
  | { type: 'bloomed'; pos: Pos }
  | { type: 'blocked'; pos: Pos }
  | { type: 'harvested'; pos: Pos; seed: PlantType }
  | { type: 'newBatch'; tray: ScrapKind[] }
  | { type: 'won' }
  | { type: 'stuck' };

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; reason: string };

export interface RuinSpec {
  x: number;
  y: number;
  name: string;
  size: Size;
}

export interface LevelData {
  id: string;
  name: string;
  hint: string;
  width: number;
  height: number;
  /** One string per row: '.' soil, '#' concrete, 'X' blocked */
  ground: string[];
  ruins: RuinSpec[];
  seeds: Partial<SeedCounts>;
  batches: ScrapKind[][];
  target: number;
  rngSeed: number;
  harvestYield?: PlantType;
  solution: Move[];
}
```

- [ ] **Step 4: Create `src/engine/catalog.ts`**

```ts
import type { PlantType, ScrapKind, Size, WorldObject } from './types';

export const RADIUS: Record<Size, number> = { small: 1, medium: 2, large: 3 };

export const SCRAP: Record<ScrapKind, { size: Size }> = {
  tyre: { size: 'small' },
  can: { size: 'small' },
  cone: { size: 'small' },
  crate: { size: 'medium' },
  barrel: { size: 'medium' },
  sign: { size: 'medium' },
  car: { size: 'large' },
};

export type GrownAction = 'spread' | 'spreadPreferObjects' | 'bloom' | 'none';

export interface PlantRule {
  maxStage: number;
  growsOn: (object: WorldObject | null) => boolean;
  onGrown: GrownAction;
}

export const PLANTS: Record<PlantType, PlantRule> = {
  moss: { maxStage: 2, growsOn: (o) => o === null || o.size === 'small', onGrown: 'spread' },
  vine: { maxStage: 3, growsOn: () => true, onGrown: 'spreadPreferObjects' },
  flower: { maxStage: 3, growsOn: (o) => o === null, onGrown: 'bloom' },
  bamboo: { maxStage: 5, growsOn: (o) => o === null, onGrown: 'none' },
};

export const PLANT_TYPES = Object.keys(PLANTS) as PlantType[];
export const SCRAP_KINDS = Object.keys(SCRAP) as ScrapKind[];
```

- [ ] **Step 5: Create `src/engine/rng.ts`**

```ts
/** mulberry32: returns a value in [0, 1) and the next seed. */
export function nextRandom(seed: number): [number, number] {
  const next = (seed + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

export function pickIndex(seed: number, length: number): [number, number] {
  const [value, next] = nextRandom(seed);
  return [Math.floor(value * length), next];
}
```

- [ ] **Step 6: Create `src/engine/grid.ts`**

```ts
import type { GameState, Pos, Tile } from './types';

interface Dims {
  width: number;
  height: number;
}

export const idx = (s: Dims, p: Pos): number => p.y * s.width + p.x;

export const inBounds = (s: Dims, p: Pos): boolean =>
  Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height;

export const tileAt = (s: GameState, p: Pos): Tile | null => (inBounds(s, p) ? s.tiles[idx(s, p)]! : null);

export const posOf = (s: Dims, i: number): Pos => ({ x: i % s.width, y: Math.floor(i / s.width) });

export const manhattan = (a: Pos, b: Pos): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export const neighbours = (s: Dims, p: Pos): Pos[] =>
  [
    { x: p.x, y: p.y - 1 },
    { x: p.x + 1, y: p.y },
    { x: p.x, y: p.y + 1 },
    { x: p.x - 1, y: p.y },
  ].filter((q) => inBounds(s, q));

export const cloneState = (s: GameState): GameState => structuredClone(s);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/engine/basics.test.ts && npm run typecheck`
Expected: all tests PASS and typecheck exits 0. Check the neighbour order: for (0,0) only right (1,0) and down (0,1) are in bounds, in that order.

- [ ] **Step 8: Commit**

```bash
git add src/engine tests/engine/basics.test.ts
git commit -m "feat(engine): types, catalogue, seeded RNG and grid helpers"
```

---

### Task 3: Level validation and initial state

**Files:**
- Create: `src/engine/level.ts`, `tests/engine/helpers.ts`
- Test: `tests/engine/level.test.ts`

**Interfaces:**
- Consumes: types, `PLANT_TYPES`, `SCRAP_KINDS`, `idx` (Task 2)
- Produces: `class LevelError extends Error`, `validateLevel(raw: unknown): LevelData`, `createInitialState(level: LevelData): GameState`; the test helpers `makeLevel(overrides?: Partial<LevelData>): LevelData`, `makeState(overrides?: Partial<LevelData>): GameState`, `putPlant(s, x, y, type, stage, plantId?)`, `putObject(s, x, y, name, size, kind?)`

- [ ] **Step 1: Create `tests/engine/helpers.ts`**

```ts
import { createInitialState, validateLevel } from '../../src/engine/level';
import type { GameState, LevelData, PlantType, Size } from '../../src/engine/types';

export function makeLevel(overrides: Partial<LevelData> = {}): LevelData {
  return validateLevel({
    id: 'test',
    name: 'Test',
    hint: '',
    width: 5,
    height: 5,
    ground: ['.....', '.....', '.....', '.....', '.....'],
    ruins: [],
    seeds: { moss: 5, vine: 5, flower: 5, bamboo: 5 },
    batches: [['tyre', 'tyre', 'tyre', 'crate', 'car']],
    target: 1,
    rngSeed: 42,
    solution: [],
    ...overrides,
  });
}

export function makeState(overrides: Partial<LevelData> = {}): GameState {
  return createInitialState(makeLevel(overrides));
}

/** Test-only: mutates s directly. */
export function putPlant(s: GameState, x: number, y: number, type: PlantType, stage: number, plantId = 99): GameState {
  s.tiles[y * s.width + x]!.plant = { plantId, type, stage, bloom: false };
  return s;
}

/** Test-only: mutates s directly. */
export function putObject(s: GameState, x: number, y: number, name: string, size: Size, kind: 'ruin' | 'scrap' = 'scrap'): GameState {
  s.tiles[y * s.width + x]!.object = { kind, name, size };
  return s;
}
```

- [ ] **Step 2: Write the failing test** at `tests/engine/level.test.ts`

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/engine/level.test.ts`
Expected: FAIL, with a module-not-found error for `src/engine/level`.

- [ ] **Step 4: Create `src/engine/level.ts`**

```ts
import { PLANT_TYPES, SCRAP_KINDS } from './catalog';
import { idx } from './grid';
import type { GameState, Ground, LevelData, PlantType, ScrapKind, SeedCounts, Size, Tile } from './types';

export class LevelError extends Error {}

const GROUND_CHARS: Record<string, Ground> = { '.': 'soil', '#': 'concrete', X: 'blocked' };
const SIZES: Size[] = ['small', 'medium', 'large'];

function fail(id: unknown, message: string): never {
  throw new LevelError(`Level ${String(id ?? '?')}: ${message}`);
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function validateLevel(raw: unknown): LevelData {
  if (typeof raw !== 'object' || raw === null) fail('?', 'not an object');
  const l = raw as Record<string, unknown>;
  const id = l.id;
  if (typeof id !== 'string' || id === '') fail(id, 'id must be a non-empty string');
  if (typeof l.name !== 'string') fail(id, 'name must be a string');
  if (typeof l.hint !== 'string') fail(id, 'hint must be a string');
  const { width, height } = l;
  if (!isInt(width) || width < 1 || !isInt(height) || height < 1) fail(id, 'width and height must be positive integers');

  if (!Array.isArray(l.ground) || l.ground.length !== height) fail(id, `ground must have ${height} rows`);
  const ground = l.ground as unknown[];
  ground.forEach((row, y) => {
    if (typeof row !== 'string' || row.length !== width) fail(id, `ground row ${y} must be ${width} characters`);
    for (const ch of row) if (!(ch in GROUND_CHARS)) fail(id, `ground row ${y} has unknown character "${ch}"`);
  });

  if (!Array.isArray(l.ruins)) fail(id, 'ruins must be an array');
  const taken = new Set<number>();
  for (const r of l.ruins as Record<string, unknown>[]) {
    const { x, y } = r;
    if (!isInt(x) || !isInt(y) || x < 0 || y < 0 || x >= width || y >= height) fail(id, `ruin ${String(r.name)} is out of bounds`);
    if (typeof r.name !== 'string') fail(id, 'ruin name must be a string');
    if (!SIZES.includes(r.size as Size)) fail(id, `ruin ${r.name} has invalid size`);
    if ((ground[y] as string)[x] === 'X') fail(id, `ruin ${r.name} is on a blocked tile`);
    const key = y * width + x;
    if (taken.has(key)) fail(id, `tile (${x},${y}) already has a ruin`);
    taken.add(key);
  }

  if (typeof l.seeds !== 'object' || l.seeds === null) fail(id, 'seeds must be an object');
  for (const [type, count] of Object.entries(l.seeds as Record<string, unknown>)) {
    if (!PLANT_TYPES.includes(type as PlantType)) fail(id, `unknown seed type "${type}"`);
    if (!isInt(count) || count < 0) fail(id, `seed count for ${type} must be a non-negative integer`);
  }

  if (!Array.isArray(l.batches) || l.batches.length === 0) fail(id, 'batches must be a non-empty array');
  (l.batches as unknown[]).forEach((batch, i) => {
    if (!Array.isArray(batch) || batch.length === 0) fail(id, `batch ${i} must be a non-empty array`);
    for (const kind of batch) if (!SCRAP_KINDS.includes(kind as ScrapKind)) fail(id, `batch ${i} has unknown scrap "${String(kind)}"`);
  });

  if (typeof l.target !== 'number' || !(l.target > 0 && l.target <= 1)) fail(id, 'target must be in (0, 1]');
  if (!isInt(l.rngSeed)) fail(id, 'rngSeed must be an integer');
  if (l.harvestYield !== undefined && !PLANT_TYPES.includes(l.harvestYield as PlantType)) fail(id, 'harvestYield is not a plant type');
  if (!Array.isArray(l.solution)) fail(id, 'solution must be an array');

  return raw as LevelData;
}

export function createInitialState(level: LevelData): GameState {
  const tiles: Tile[] = [];
  for (const row of level.ground) for (const ch of row) tiles.push({ ground: GROUND_CHARS[ch]!, object: null, plant: null });
  for (const r of level.ruins) tiles[idx(level, r)]!.object = { kind: 'ruin', name: r.name, size: r.size };

  const seeds = Object.fromEntries(PLANT_TYPES.map((t) => [t, level.seeds[t] ?? 0])) as SeedCounts;
  const [first, ...rest] = structuredClone(level.batches);

  return {
    width: level.width,
    height: level.height,
    tiles,
    seeds,
    tray: first!,
    batches: rest,
    target: level.target,
    harvestYield: level.harvestYield ?? null,
    rng: level.rngSeed >>> 0,
    nextPlantId: 1,
    won: false,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/engine && npm run typecheck`
Expected: all PASS; typecheck exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/engine/level.ts tests/engine/helpers.ts tests/engine/level.test.ts
git commit -m "feat(engine): level validation and initial state"
```

---

### Task 4: Growth (ticks, spreading, blooming)

**Files:**
- Create: `src/engine/growth.ts`
- Test: `tests/engine/growth.test.ts`

**Interfaces:**
- Consumes: `PLANTS`, `tileAt`, `posOf`, `manhattan`, `neighbours`, `pickIndex`
- Produces: `eligibleNeighbours(s: GameState, p: Pos, type: PlantType): Pos[]` and `growAround(s: GameState, center: Pos, radius: number, events: GameEvent[]): void`. **`growAround` mutates `s`**, and callers must pass a working copy.

- [ ] **Step 1: Write the failing test** at `tests/engine/growth.test.ts`

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine/growth.test.ts`
Expected: FAIL, with a module-not-found error for `src/engine/growth`.

- [ ] **Step 3: Create `src/engine/growth.ts`**

```ts
import { PLANTS } from './catalog';
import { manhattan, neighbours, posOf, tileAt } from './grid';
import { pickIndex } from './rng';
import type { GameEvent, GameState, PlantCell, PlantType, Pos } from './types';

export function eligibleNeighbours(s: GameState, p: Pos, type: PlantType): Pos[] {
  return neighbours(s, p).filter((q) => {
    const t = tileAt(s, q)!;
    return t.ground !== 'blocked' && t.plant === null && PLANTS[type].growsOn(t.object);
  });
}

function spread(s: GameState, from: Pos, cell: PlantCell, preferObjects: boolean, events: GameEvent[]): void {
  let options = eligibleNeighbours(s, from, cell.type);
  if (options.length === 0) {
    events.push({ type: 'blocked', pos: from });
    return;
  }
  if (preferObjects) {
    const withObject = options.filter((q) => tileAt(s, q)!.object !== null);
    if (withObject.length > 0) options = withObject;
  }
  const [i, nextRng] = pickIndex(s.rng, options.length);
  s.rng = nextRng;
  const to = options[i]!;
  tileAt(s, to)!.plant = { plantId: cell.plantId, type: cell.type, stage: 1, bloom: false };
  events.push({ type: 'spread', from, to, plant: cell.type });
}

function tickCell(s: GameState, p: Pos, events: GameEvent[]): void {
  const cell = tileAt(s, p)!.plant!;
  const rule = PLANTS[cell.type];
  if (cell.stage < rule.maxStage) {
    cell.stage += 1;
    events.push({ type: 'grew', pos: p, stage: cell.stage });
    return;
  }
  switch (rule.onGrown) {
    case 'bloom':
      if (!cell.bloom) {
        cell.bloom = true;
        events.push({ type: 'bloomed', pos: p });
      }
      return;
    case 'none':
      return;
    case 'spread':
    case 'spreadPreferObjects':
      spread(s, p, cell, rule.onGrown === 'spreadPreferObjects', events);
  }
}

/** Gives one growth tick to every plant cell within `radius` of `center`. Mutates `s`. */
export function growAround(s: GameState, center: Pos, radius: number, events: GameEvent[]): void {
  const targets: Pos[] = [];
  s.tiles.forEach((t, i) => {
    const p = posOf(s, i);
    if (t.plant && manhattan(p, center) <= radius) targets.push(p);
  });
  for (const p of targets) tickCell(s, p, events);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/engine/growth.test.ts && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/growth.ts tests/engine/growth.test.ts
git commit -m "feat(engine): growth ticks, spreading and blooming"
```

---

### Task 5: Queries (coverage, cell status, stuck, preview)

**Files:**
- Create: `src/engine/queries.ts`
- Test: `tests/engine/queries.test.ts`

**Interfaces:**
- Consumes: `PLANTS`, `RADIUS`, `SCRAP`, `tileAt`, `posOf`, `manhattan`, `inBounds`, `eligibleNeighbours`
- Produces: `coverage(s): number`, `type CellStatus = 'seed' | 'growing' | 'grown' | 'blocked'`, `cellStatus(s, p): CellStatus | null`, `isStuck(s): boolean`, `previewScrap(s, slot, p): Pos[]`

- [ ] **Step 1: Write the failing test** at `tests/engine/queries.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { cellStatus, coverage, isStuck, previewScrap } from '../../src/engine/queries';
import { makeState, putPlant } from './helpers';

describe('coverage', () => {
  it('is 0 for an empty level', () => {
    expect(coverage(makeState())).toBe(0);
  });
  it('counts stage >= 1 cells over non-blocked tiles only', () => {
    const s = makeState({ ground: ['XXXXX', '.....', '.....', '.....', '.....'] });
    putPlant(s, 0, 1, 'moss', 1);
    putPlant(s, 1, 1, 'moss', 2);
    putPlant(s, 2, 1, 'moss', 0);
    expect(coverage(s)).toBeCloseTo(2 / 20);
  });
});

describe('cellStatus', () => {
  it('reports each state', () => {
    const s = makeState({ ground: ['.X...', 'X....', '.....', '.....', '.....'] });
    putPlant(s, 4, 4, 'moss', 0);
    putPlant(s, 3, 3, 'vine', 2);
    putPlant(s, 2, 2, 'flower', 3);
    putPlant(s, 0, 0, 'moss', 2);
    expect(cellStatus(s, { x: 1, y: 2 })).toBeNull();
    expect(cellStatus(s, { x: 4, y: 4 })).toBe('seed');
    expect(cellStatus(s, { x: 3, y: 3 })).toBe('growing');
    expect(cellStatus(s, { x: 2, y: 2 })).toBe('grown');
    expect(cellStatus(s, { x: 0, y: 0 })).toBe('blocked');
  });
});

describe('isStuck', () => {
  it('is true only when not won and no scrap remains', () => {
    const s = makeState();
    expect(isStuck(s)).toBe(false);
    s.tray = [];
    expect(isStuck(s)).toBe(true);
    s.won = true;
    expect(isStuck(s)).toBe(false);
  });
});

describe('previewScrap', () => {
  it('lists plant cells within the radius of the slot\'s scrap', () => {
    const s = makeState({ batches: [['tyre', 'car']] });
    putPlant(s, 2, 2, 'moss', 0);
    putPlant(s, 0, 0, 'moss', 0);
    expect(previewScrap(s, 0, { x: 2, y: 3 })).toEqual([{ x: 2, y: 2 }]);
    expect(previewScrap(s, 1, { x: 2, y: 3 })).toEqual([{ x: 2, y: 2 }]);
    expect(previewScrap(s, 1, { x: 1, y: 1 })).toEqual([{ x: 0, y: 0 }, { x: 2, y: 2 }]);
  });
  it('returns [] for an invalid slot or position', () => {
    const s = makeState();
    expect(previewScrap(s, 99, { x: 0, y: 0 })).toEqual([]);
    expect(previewScrap(s, 0, { x: -1, y: 0 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine/queries.test.ts`
Expected: FAIL, with a module-not-found error for `src/engine/queries`.

- [ ] **Step 3: Create `src/engine/queries.ts`**

```ts
import { PLANTS, RADIUS, SCRAP } from './catalog';
import { inBounds, manhattan, posOf, tileAt } from './grid';
import { eligibleNeighbours } from './growth';
import type { GameState, Pos } from './types';

export function coverage(s: GameState): number {
  let total = 0;
  let covered = 0;
  for (const t of s.tiles) {
    if (t.ground === 'blocked') continue;
    total += 1;
    if (t.plant && t.plant.stage >= 1) covered += 1;
  }
  return total === 0 ? 0 : covered / total;
}

export type CellStatus = 'seed' | 'growing' | 'grown' | 'blocked';

export function cellStatus(s: GameState, p: Pos): CellStatus | null {
  const cell = tileAt(s, p)?.plant;
  if (!cell) return null;
  if (cell.stage === 0) return 'seed';
  const rule = PLANTS[cell.type];
  if (cell.stage < rule.maxStage) return 'growing';
  const spreads = rule.onGrown === 'spread' || rule.onGrown === 'spreadPreferObjects';
  if (spreads && eligibleNeighbours(s, p, cell.type).length === 0) return 'blocked';
  return 'grown';
}

export function isStuck(s: GameState): boolean {
  return !s.won && s.tray.length === 0 && s.batches.length === 0;
}

/** Plant cells that would get a growth tick if the scrap in `slot` were placed at `p`. */
export function previewScrap(s: GameState, slot: number, p: Pos): Pos[] {
  const kind = s.tray[slot];
  if (kind === undefined || !inBounds(s, p)) return [];
  const radius = RADIUS[SCRAP[kind].size];
  const hits: Pos[] = [];
  s.tiles.forEach((t, i) => {
    const q = posOf(s, i);
    if (t.plant && manhattan(q, p) <= radius) hits.push(q);
  });
  return hits;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/engine && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/queries.ts tests/engine/queries.test.ts
git commit -m "feat(engine): coverage, cell status, stuck and scrap preview queries"
```

---

### Task 6: Actions (place seed, place scrap, harvest)

**Files:**
- Create: `src/engine/actions.ts`
- Modify: `tests/engine/helpers.ts` (add `play`)
- Test: `tests/engine/actions.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–5
- Produces: `placeSeed(s, plant, p): ActionResult`, `placeScrap(s, slot, p): ActionResult`, `harvest(s, p): ActionResult`, `applyMove(s, move): ActionResult`. None of these mutates its input. The test helper `play(s, ...moves): { state, events }` throws on a rejected move.

- [ ] **Step 1: Add `play` to `tests/engine/helpers.ts`**

Add these imports at the top:

```ts
import { applyMove } from '../../src/engine/actions';
import type { GameEvent, Move } from '../../src/engine/types';
```

Add this function at the bottom:

```ts
export function play(state: GameState, ...moves: Move[]): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];
  for (const m of moves) {
    const r = applyMove(s, m);
    if (!r.ok) throw new Error(`move ${JSON.stringify(m)} rejected: ${r.reason}`);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}
```

- [ ] **Step 2: Write the failing test** at `tests/engine/actions.test.ts`

```ts
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/engine/actions.test.ts`
Expected: FAIL, with a module-not-found error for `src/engine/actions`.

- [ ] **Step 4: Create `src/engine/actions.ts`**

```ts
import { PLANTS, RADIUS, SCRAP } from './catalog';
import { cloneState, tileAt } from './grid';
import { growAround } from './growth';
import { coverage, isStuck } from './queries';
import type { ActionResult, GameEvent, GameState, Move, PlantType, Pos, Tile } from './types';

const fail = (reason: string): ActionResult => ({ ok: false, reason });

function openTile(s: GameState, p: Pos): Tile | string {
  const tile = tileAt(s, p);
  if (!tile) return 'out of bounds';
  if (tile.ground === 'blocked') return 'tile is blocked';
  return tile;
}

function finish(prev: GameState, next: GameState, events: GameEvent[]): ActionResult {
  const reached = coverage(next) >= next.target;
  if (reached && !prev.won) events.push({ type: 'won' });
  next.won = prev.won || reached;
  if (isStuck(next)) events.push({ type: 'stuck' });
  return { ok: true, state: next, events };
}

export function placeSeed(s: GameState, plant: PlantType, p: Pos): ActionResult {
  const tile = openTile(s, p);
  if (typeof tile === 'string') return fail(tile);
  if (tile.plant) return fail('tile already has a plant');
  if (!PLANTS[plant].growsOn(tile.object)) return fail(`${plant} cannot grow here`);
  if (s.seeds[plant] <= 0) return fail(`no ${plant} seeds left`);

  const next = cloneState(s);
  next.seeds[plant] -= 1;
  tileAt(next, p)!.plant = { plantId: next.nextPlantId++, type: plant, stage: 0, bloom: false };
  return finish(s, next, [{ type: 'placedSeed', pos: p, plant }]);
}

export function placeScrap(s: GameState, slot: number, p: Pos): ActionResult {
  const tile = openTile(s, p);
  if (typeof tile === 'string') return fail(tile);
  if (tile.object) return fail('tile already has an object');
  if (tile.plant) return fail('tile has a plant');
  if (!Number.isInteger(slot) || s.tray[slot] === undefined) return fail(`no scrap in slot ${slot}`);

  const next = cloneState(s);
  const [kind] = next.tray.splice(slot, 1);
  const size = SCRAP[kind!].size;
  tileAt(next, p)!.object = { kind: 'scrap', name: kind!, size };
  const events: GameEvent[] = [{ type: 'placedScrap', pos: p, scrap: kind! }];
  growAround(next, p, RADIUS[size], events);
  if (next.tray.length === 0 && next.batches.length > 0) {
    next.tray = next.batches.shift()!;
    events.push({ type: 'newBatch', tray: [...next.tray] });
  }
  return finish(s, next, events);
}

export function harvest(s: GameState, p: Pos): ActionResult {
  const tile = tileAt(s, p);
  if (!tile) return fail('out of bounds');
  if (!tile.plant?.bloom) return fail('nothing to harvest');

  const next = cloneState(s);
  const cell = tileAt(next, p)!.plant!;
  cell.bloom = false;
  const seed = next.harvestYield ?? cell.type;
  next.seeds[seed] += 1;
  return finish(s, next, [{ type: 'harvested', pos: p, seed }]);
}

export function applyMove(s: GameState, move: Move): ActionResult {
  const p = { x: move.x, y: move.y };
  switch (move.type) {
    case 'seed':
      return placeSeed(s, move.plant, p);
    case 'scrap':
      return placeScrap(s, move.slot, p);
    case 'harvest':
      return harvest(s, p);
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/engine && npm run typecheck`
Expected: all PASS. If the "stuck" test fails because `won` fired (it can't, since target = 1), check `finish`.

- [ ] **Step 6: Commit**

```bash
git add src/engine/actions.ts tests/engine/helpers.ts tests/engine/actions.test.ts
git commit -m "feat(engine): place seed, place scrap and harvest actions"
```

---

### Task 7: Session (undo and restart) and public exports

**Files:**
- Create: `src/engine/session.ts`, `src/engine/index.ts`
- Test: `tests/engine/session.test.ts`

**Interfaces:**
- Consumes: `applyMove`, `createInitialState`
- Produces: `class Session { constructor(level: LevelData); state: GameState; readonly canUndo: boolean; apply(move: Move): ActionResult; undo(): boolean; restart(): void }`. `src/engine/index.ts` re-exports everything Plan 2 needs.

- [ ] **Step 1: Write the failing test** at `tests/engine/session.test.ts`

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/engine/session.test.ts`
Expected: FAIL, with a module-not-found error for `src/engine/session`.

- [ ] **Step 3: Create `src/engine/session.ts`**

```ts
import { applyMove } from './actions';
import { createInitialState } from './level';
import type { ActionResult, GameState, LevelData, Move } from './types';

/** Holds the current state plus undo history. States are never mutated, so they can be shared safely. */
export class Session {
  state: GameState;
  private readonly initial: GameState;
  private history: GameState[] = [];

  constructor(level: LevelData) {
    this.initial = createInitialState(level);
    this.state = this.initial;
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  apply(move: Move): ActionResult {
    const result = applyMove(this.state, move);
    if (result.ok) {
      this.history.push(this.state);
      this.state = result.state;
    }
    return result;
  }

  undo(): boolean {
    const previous = this.history.pop();
    if (!previous) return false;
    this.state = previous;
    return true;
  }

  restart(): void {
    this.history = [];
    this.state = this.initial;
  }
}
```

- [ ] **Step 4: Create `src/engine/index.ts`**

```ts
export * from './types';
export { PLANTS, PLANT_TYPES, RADIUS, SCRAP, SCRAP_KINDS } from './catalog';
export { LevelError, createInitialState, validateLevel } from './level';
export { applyMove, harvest, placeScrap, placeSeed } from './actions';
export { cellStatus, coverage, isStuck, previewScrap, type CellStatus } from './queries';
export { Session } from './session';
```

- [ ] **Step 5: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/session.ts src/engine/index.ts tests/engine/session.test.ts
git commit -m "feat(engine): session with undo/restart and public exports"
```

---

### Task 8: Solver tool, the five levels and the solvability test

**Files:**
- Create: `tools/solve.ts`, `src/levels/01-bus-stop.json`, `src/levels/02-rooftop.json`, `src/levels/03-petrol-station.json`, `src/levels/04-railway-platform.json`, `src/levels/05-playground.json`, `src/levels/index.ts`
- Test: `tests/levels/levels.test.ts`

**Interfaces:**
- Consumes: `validateLevel`, `createInitialState`, `applyMove`, `coverage`, `PLANT_TYPES`, `Session`
- Produces: `LEVELS: LevelData[]` from `src/levels/index.ts`, in play order. Plan 2's level select uses this.

- [ ] **Step 1: Write the failing test** at `tests/levels/levels.test.ts`

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { coverage, Session, validateLevel } from '../../src/engine';
import { LEVELS } from '../../src/levels';

const dir = new URL('../../src/levels/', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();

it('has exactly 5 level files, all exported in order', () => {
  expect(files).toHaveLength(5);
  expect(LEVELS.map((l) => l.id)).toEqual(['bus-stop', 'rooftop', 'petrol-station', 'railway-platform', 'playground']);
});

describe.each(files)('%s', (file) => {
  const level = validateLevel(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));

  it('has a reference solution', () => {
    expect(level.solution.length).toBeGreaterThan(0);
  });

  it('reference solution reaches the target', () => {
    const session = new Session(level);
    level.solution.forEach((move, i) => {
      const r = session.apply(move);
      expect(r.ok, `move ${i} ${JSON.stringify(move)}: ${r.ok ? '' : r.reason}`).toBe(true);
    });
    expect(coverage(session.state)).toBeGreaterThanOrEqual(level.target);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/levels`
Expected: FAIL, with a module-not-found error for `src/levels`.

- [ ] **Step 3: Create `tools/solve.ts`**

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { applyMove } from '../src/engine/actions';
import { PLANT_TYPES } from '../src/engine/catalog';
import { createInitialState, validateLevel } from '../src/engine/level';
import { coverage } from '../src/engine/queries';
import type { GameState, LevelData, Move } from '../src/engine/types';

interface Node {
  state: GameState;
  moves: Move[];
}

function candidateMoves(s: GameState): Move[] {
  const moves: Move[] = [];
  const slots = [...new Set(s.tray)].map((kind) => s.tray.indexOf(kind));
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      for (const plant of PLANT_TYPES) if (s.seeds[plant] > 0) moves.push({ type: 'seed', plant, x, y });
      for (const slot of slots) moves.push({ type: 'scrap', slot, x, y });
      moves.push({ type: 'harvest', x, y });
    }
  }
  return moves;
}

function score(s: GameState): number {
  let growth = 0;
  for (const t of s.tiles) if (t.plant) growth += t.plant.stage + 1;
  let seeds = 0;
  for (const p of PLANT_TYPES) seeds += s.seeds[p];
  return coverage(s) * 1000 + growth + seeds * 0.5;
}

function key(s: GameState): string {
  const tiles = s.tiles
    .map((t) => `${t.object?.name ?? '-'}${t.plant ? `${t.plant.type[0]}${t.plant.stage}${t.plant.bloom ? '*' : ''}` : '_'}`)
    .join('|');
  return `${tiles}/${JSON.stringify(s.seeds)}/${s.tray.join(',')}/${s.batches.length}`;
}

/** Beam search. Every move spends a seed, a scrap or a bloom, so the search always ends. */
export function solve(level: LevelData, beamWidth: number): Move[] | null {
  let beam: Node[] = [{ state: createInitialState(level), moves: [] }];
  while (beam.length > 0) {
    const next = new Map<string, Node>();
    for (const node of beam) {
      for (const move of candidateMoves(node.state)) {
        const r = applyMove(node.state, move);
        if (!r.ok) continue;
        const child = { state: r.state, moves: [...node.moves, move] };
        if (r.state.won) return child.moves;
        const k = key(r.state);
        if (!next.has(k)) next.set(k, child);
      }
    }
    beam = [...next.values()].sort((a, b) => score(b.state) - score(a.state)).slice(0, beamWidth);
  }
  return null;
}

function main(): void {
  const path = process.argv[2];
  const beamWidth = Number(process.argv[3] ?? 40);
  if (!path) {
    console.error('usage: npm run solve -- <level.json> [beamWidth]');
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const level = validateLevel({ ...raw, solution: [] });
  const moves = solve(level, beamWidth);
  if (!moves) {
    console.error(`No solution for ${level.id} at target ${level.target}. Lower the target by 0.05 or add a batch, then retry.`);
    process.exit(2);
  }
  raw.solution = moves;
  writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(`${level.id}: solved in ${moves.length} moves`);
}

main();
```

- [ ] **Step 4: Create the five level files**

`src/levels/01-bus-stop.json`:

```json
{
  "id": "bus-stop",
  "name": "Bus Stop",
  "hint": "Place scrap near a seed. Everything inside its ring grows.",
  "width": 6,
  "height": 6,
  "ground": ["##....", "##....", "......", "......", "....##", "....##"],
  "ruins": [
    { "x": 2, "y": 2, "name": "bench", "size": "small" },
    { "x": 3, "y": 4, "name": "bin", "size": "small" }
  ],
  "seeds": { "moss": 3 },
  "batches": [["tyre", "tyre", "tyre"], ["tyre", "tyre", "tyre"], ["can", "can", "cone"]],
  "target": 0.6,
  "rngSeed": 101,
  "solution": []
}
```

`src/levels/02-rooftop.json`:

```json
{
  "id": "rooftop",
  "name": "Rooftop",
  "hint": "Vines climb onto objects. Covered scrap counts toward the meter.",
  "width": 7,
  "height": 7,
  "ground": ["#######", "#######", "###X###", "#######", "#######", "#######", "#######"],
  "ruins": [
    { "x": 1, "y": 1, "name": "water-tank", "size": "medium" },
    { "x": 5, "y": 5, "name": "ac-unit", "size": "medium" }
  ],
  "seeds": { "moss": 2, "vine": 2 },
  "batches": [["crate", "tyre", "tyre"], ["crate", "tyre", "can"], ["crate", "crate", "tyre"], ["barrel", "tyre", "can"]],
  "target": 0.6,
  "rngSeed": 202,
  "solution": []
}
```

`src/levels/03-petrol-station.json`:

```json
{
  "id": "petrol-station",
  "name": "Petrol Station",
  "hint": "Grown flowers bloom. Tap a bloom to collect a new seed.",
  "width": 8,
  "height": 8,
  "ground": ["........", "..####..", "..####..", "........", "........", "..####..", "..####..", "........"],
  "ruins": [
    { "x": 2, "y": 1, "name": "pump", "size": "medium" },
    { "x": 5, "y": 1, "name": "pump", "size": "medium" },
    { "x": 3, "y": 5, "name": "old-car", "size": "large" }
  ],
  "seeds": { "moss": 2, "vine": 1, "flower": 2 },
  "harvestYield": "moss",
  "batches": [["tyre", "can", "crate"], ["tyre", "cone", "crate"], ["can", "tyre", "barrel"], ["tyre", "tyre", "sign"], ["can", "cone", "crate"]],
  "target": 0.55,
  "rngSeed": 303,
  "solution": []
}
```

`src/levels/04-railway-platform.json`:

```json
{
  "id": "railway-platform",
  "name": "Railway Platform",
  "hint": "Bamboo grows tall in tight spaces and never spreads.",
  "width": 4,
  "height": 12,
  "ground": ["####", "####", "#X##", "####", "####", "####", "#X##", "####", "####", "####", "#X##", "####"],
  "ruins": [
    { "x": 2, "y": 4, "name": "bench", "size": "small" },
    { "x": 2, "y": 8, "name": "station-sign", "size": "medium" }
  ],
  "seeds": { "bamboo": 3, "moss": 2, "vine": 1 },
  "batches": [["tyre", "crate", "can"], ["crate", "tyre", "tyre"], ["barrel", "can", "tyre"], ["crate", "cone", "tyre"]],
  "target": 0.55,
  "rngSeed": 404,
  "solution": []
}
```

`src/levels/05-playground.json`:

```json
{
  "id": "playground",
  "name": "Playground",
  "hint": "A car shell feeds everything within three steps.",
  "width": 8,
  "height": 8,
  "ground": ["........", "........", "...XX...", "........", "........", "...XX...", "........", "........"],
  "ruins": [
    { "x": 1, "y": 1, "name": "slide", "size": "large" },
    { "x": 6, "y": 1, "name": "swings", "size": "medium" },
    { "x": 1, "y": 6, "name": "roundabout", "size": "medium" },
    { "x": 6, "y": 6, "name": "sandpit", "size": "small" }
  ],
  "seeds": { "moss": 2, "vine": 2, "flower": 1, "bamboo": 1 },
  "harvestYield": "vine",
  "batches": [["tyre", "crate", "can"], ["car", "tyre", "cone"], ["crate", "barrel", "tyre"], ["car", "can", "tyre"], ["sign", "tyre", "crate"]],
  "target": 0.6,
  "rngSeed": 505,
  "solution": []
}
```

- [ ] **Step 5: Create `src/levels/index.ts`**

```ts
import { validateLevel, type LevelData } from '../engine';
import busStop from './01-bus-stop.json';
import rooftop from './02-rooftop.json';
import petrolStation from './03-petrol-station.json';
import railwayPlatform from './04-railway-platform.json';
import playground from './05-playground.json';

export const LEVELS: LevelData[] = [busStop, rooftop, petrolStation, railwayPlatform, playground].map((raw) => validateLevel(raw));
```

- [ ] **Step 6: Run the solver on each level**

Run each, one at a time:

```bash
npm run solve -- src/levels/01-bus-stop.json
npm run solve -- src/levels/02-rooftop.json
npm run solve -- src/levels/03-petrol-station.json
npm run solve -- src/levels/04-railway-platform.json
npm run solve -- src/levels/05-playground.json
```

Expected for each: `<id>: solved in N moves`, and the file's `solution` array is filled in.

**If a level prints `No solution`:** first rerun with a wider beam (`npm run solve -- <file> 120`). If it still fails, lower that file's `target` by 0.05 and rerun, never going below 0.45. If it fails at 0.45, add one batch `["tyre", "crate", "tyre"]` to the end of `batches` and rerun. Write down every tuning change for the final report.

**If a level solves in fewer than 8 moves:** it's too easy for its place in the sequence. Raise `target` by 0.05 and rerun, to at most 0.8.

- [ ] **Step 7: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: all PASS, including 5 × 2 level tests and the order test.

- [ ] **Step 8: Commit**

```bash
git add tools/solve.ts src/levels tests/levels
git commit -m "feat(levels): five levels with solver-generated reference solutions"
```

---

### Task 9: README, licence and public GitHub repo

**Files:**
- Create: `README.md`, `LICENSE`
- Delete: `tests/sanity.test.ts` (replaced by the real suite)

**Interfaces:**
- Produces: the public repo `https://github.com/Ujjwalkumar-pm/afterlife`, used for Vercel in Plan 3.

- [ ] **Step 1: Create `LICENSE`** with the standard MIT text, copyright line `Copyright (c) 2026 Ujjwal Kumar`.

```text
MIT License

Copyright (c) 2026 Ujjwal Kumar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Create `README.md`**

```markdown
# Afterlife

A calm isometric web game about nature reclaiming abandoned places. Plant seeds among the ruins, drop scrap to feed them, and watch moss, vines, flowers and bamboo take the scene back.

> Status: in development. The rules engine and levels are done; the playable game is next.

## How it plays

- Placing scrap makes every plant within its ring grow one step. Small scrap reaches 1 tile, medium 2 and large 3.
- Grown moss and vines spread, flowers bloom (tap a bloom for a seed), and bamboo grows tall.
- Fill the meter by covering the scene, including the scrap you've placed. There's no timer and no losing, and you can always undo.

## Development

    npm install
    npm test            # rules engine + level solvability tests
    npm run typecheck
    npm run solve -- src/levels/01-bus-stop.json   # regenerate a level's reference solution

The rules live in `src/engine/`, pure TypeScript with no framework. Levels are JSON files in `src/levels/`.

## Credits

- Design and direction: Ujjwal Kumar
- Inspired by the mechanics of *Cloud Gardens* by Noio. Afterlife uses no names, art, levels or audio from it.
- Art (coming in v1): Kenney.nl assets, CC0.

## Licence

Code: MIT (see `LICENSE`). Third-party art keeps its own licence.
```

- [ ] **Step 3: Remove the sanity test, run everything and commit**

```bash
git rm -q tests/sanity.test.ts
npm test && npm run typecheck
git add README.md LICENSE
git commit -m "docs: README and MIT licence"
```

Expected: all tests PASS before the commit.

- [ ] **Step 4: Create the public GitHub repo and push**

Run: `gh repo create afterlife --public --source . --remote origin --push --description "A calm isometric web game about nature reclaiming abandoned places."`
Expected: prints `https://github.com/Ujjwalkumar-pm/afterlife` and pushes `main`. If the name is taken, stop and ask Ujjwal for another name. Don't pick one yourself.

- [ ] **Step 5: Verify**

Run: `gh repo view --json visibility,url`
Expected: `"visibility":"PUBLIC"`.
