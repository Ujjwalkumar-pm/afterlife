# Afterlife v1.2 — Easy & Exciting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Afterlife instantly playable and more rewarding:
- one-tap placement, a preselected seed and auto-switching;
- a 3 s best-tile hint glow;
- a bonus crate instead of dead ends;
- gentler first levels;
- combo bursts, stars and milestones;
- animations about 30% faster.

**Architecture:**
- **Engine:** one new rule, the `bonus` move with `canBonus`/`hasFreeTile`; `isStuck` now means "no free tile".
- **Pure, unit-tested helpers:** `bestTile` (hints), `comboFor`, `starsFor` and `milestonesCrossed` (scoring), save `stars`, and sound cues.
- **`PlayController`:**
  - always places on one tap and auto-grants a bonus crate when scrap runs out;
  - an `assist` option preselects seeds and auto-switches the selection;
  - undo removes the scrap move and its bonus together.
- **Scene and HUD:** read central timings from `timing.ts` and add the celebrations. The App wires the hint timer, stars and milestone cue.

**Tech Stack:** The existing Phaser 4.2.1, TypeScript 7, Vite 8, Vitest 5, happy-dom and Tone.js. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-03-afterlife-v1.2-design.md`. It builds on the v1 and v1.1 specs. Live at https://afterlife-one.vercel.app and auto-deploys from `main`.

## Global Constraints

- **Bonus:** allowed only when not won, the tray and batches are empty, and a free tile exists. It sets `tray = ['crate']`, increments `bonusUsed` and emits `{ type: 'bonus' }`. `isStuck` = not won and no free tile. The controller applies the bonus automatically, and one undo reverts the move and its bonus together.
- **Hint:** after 3000 ms without a controller change. The tutorial highlight takes priority.
- **Combo:** size = `grew` + `spread` events of one move that contains `placedScrap`. 4–6 "Nice!", 7–10 "Lush!", 11+ "Wild!".
- **Stars:**
  - 1★ if `bonusUsed > 0`;
  - 3★ if leftover scrap ÷ the level's total scrap ≥ 0.25;
  - 2★ otherwise.

  The best is kept in `save.stars[levelId]`.
- **Milestones:** every upward crossing of progress 0.25, 0.50 and 0.75.
- **Timings (ms):**

  | Animation | Timing |
  |---|---|
  | Grow | 350 |
  | Sprout | 320, +100 delay |
  | Bloom | 420 |
  | Seed pop | 180 |
  | Drop | 250 |
  | Ripple | 280 |
  | Grow lag | 250 |
  | Harvest | 110 + 310 |
  | Wash step | 28 |
  | Turn step | 350 |
  | Combo rise | 900 |
  | Milestone ring | 500 |
  | Birds | 2000 |

- **Gentler levels:** Bus Stop and Rooftop `target` 0.5, `seeds.moss` +2. Re-solve both with `npm run solve`.
- **Teaching text:**
  - Tutorial step 2 is "Tap a glowing tile to plant." The tutorial opens on step 2 when Moss is preselected.
  - How to Play card 1 is "Tap a tile to plant. Your seed is already picked."
  - Card 5 adds "Stuck? Wait a moment — the best tile glows."
- **Reduce motion:** no birds, rings or flying text; combo text shows and hides without moving; stars fill instantly.
- **Compatibility:** all existing tests pass, except those this plan explicitly rewrites because the behaviour changed by spec (each is listed in its task). Pure modules stay Phaser-free.
- Shipping to `main` is approved as part of this plan. The whole-branch review runs before shipping.

## Review Focus

1. **Undo right after a bonus crate:** returns to before the player's scrap move, never to an empty-tray limbo. Pinned in Task 5 (`undo after an automatic bonus reverts the move and the bonus together`).
2. **A board full with scrap left, or out of scrap with no free tile:** "The garden rests…" still appears, and no bonus loops forever. Pinned in Task 1 (`canBonus is false without a free tile`) and Task 5 (`full board with scrap left still rests`).
3. **The hint pointing at an illegal tile** after the state changed. Pinned in Task 3 (`bestTile only returns tiles where the move is valid`) and Task 7 (`hint is cleared on any change and recomputed`).
4. **Stars computed once per win**, never lowered by replaying worse, and correct when the level is completed with Keep decorating. Pinned in Task 4 (`recordStars keeps the best`) and Task 7 (`saves stars on the win`).
5. **Rapid one-tap placements on touch** (double taps), so no accidental double placement on the same tile. Pinned in Task 5 (`a second tap on the same tile does not place again`).

---

### Task 1: Engine bonus crate

**Files:**
- Modify: `src/engine/types.ts`, `src/engine/level.ts`, `src/engine/queries.ts`, `src/engine/actions.ts`, `src/engine/index.ts`
- Test: `tests/engine/queries.test.ts`, `tests/engine/actions.test.ts`

**Interfaces:**
- Produces:
  - `GameState.bonusUsed: number`
  - `Move | { type: 'bonus' }` and `GameEvent | { type: 'bonus' }`
  - `hasFreeTile(s): boolean`, `canBonus(s): boolean`, `grantBonus(s): ActionResult`
  - `isStuck(s) = !s.won && !hasFreeTile(s)`

- [ ] **Step 1: Rewrite and add the tests**

In `tests/engine/queries.test.ts`:
1. Change the import to `import { canBonus, cellStatus, coverage, hasFreeTile, isStuck, previewScrap } from '../../src/engine/queries';`.
2. Replace the whole `describe('isStuck', …)` block (spec change) with:

```ts
describe('isStuck / canBonus', () => {
  it('is not stuck when scrap simply ran out (a bonus is available instead)', () => {
    const s = makeState();
    s.tray = [];
    expect(isStuck(s)).toBe(false);
    expect(canBonus(s)).toBe(true);
  });
  it('is stuck only when no tile is free', () => {
    const s = makeState({ width: 2, height: 1, ground: ['..'] });
    putPlant(s, 0, 0, 'moss', 0);
    putPlant(s, 1, 0, 'moss', 0);
    expect(hasFreeTile(s)).toBe(false);
    expect(isStuck(s)).toBe(true);
    s.won = true;
    expect(isStuck(s)).toBe(false);
  });
  it('canBonus is false without a free tile, while scrap remains, or after winning', () => {
    const full = makeState({ width: 1, height: 1, ground: ['.'] });
    putPlant(full, 0, 0, 'moss', 0);
    full.tray = [];
    expect(canBonus(full)).toBe(false);
    expect(canBonus(makeState())).toBe(false);
    const won = makeState();
    won.tray = [];
    won.won = true;
    expect(canBonus(won)).toBe(false);
  });
});
```

Keep the existing `describe('isStuck with no free tile', …)` test; it still holds.

In `tests/engine/actions.test.ts`, replace the test `emits stuck when the last scrap is used without reaching the target, then rejects further scrap` (spec change) with:

```ts
  it('when the last scrap is used without winning, a bonus crate becomes available', () => {
    const s = makeState({ batches: [['tyre']] });
    const { state, events } = play(s, { type: 'scrap', slot: 0, x: 0, y: 0 });
    expect(events.some((e) => e.type === 'stuck')).toBe(false);
    expect(placeScrap(state, 0, at(1, 1))).toEqual({ ok: false, reason: 'no scrap in slot 0' });
    const b = applyMove(state, { type: 'bonus' });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.state.tray).toEqual(['crate']);
    expect(b.state.bonusUsed).toBe(1);
    expect(b.events).toEqual([{ type: 'bonus' }]);
    expect(applyMove(b.state, { type: 'bonus' })).toEqual({ ok: false, reason: 'bonus not available' });
  });
```

Append to `tests/engine/actions.test.ts`:

```ts
describe('bonus', () => {
  it('starts at zero and is rejected while scrap remains', () => {
    const s = makeState();
    expect(s.bonusUsed).toBe(0);
    expect(applyMove(s, { type: 'bonus' })).toEqual({ ok: false, reason: 'bonus not available' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/engine`
Expected: the new and rewritten tests fail (`canBonus` and `hasFreeTile` are not exported, `bonusUsed` is undefined).

- [ ] **Step 3: Implement**

`src/engine/types.ts`:
1. In `GameState`, add `bonusUsed: number;` after `won: boolean;`.
2. Add `| { type: 'bonus' }` to `Move`.
3. Add `| { type: 'bonus' }` to `GameEvent`.

`src/engine/level.ts`: in `createInitialState`'s return object, add `bonusUsed: 0,` after `won: false,`.

`src/engine/queries.ts`: replace `isStuck` with:

```ts
export function hasFreeTile(s: GameState): boolean {
  return s.tiles.some((t) => t.ground !== 'blocked' && t.object === null && t.plant === null);
}

/** Nothing can be placed any more: no free tile. (Running out of scrap is solved by a bonus crate.) */
export function isStuck(s: GameState): boolean {
  return !s.won && !hasFreeTile(s);
}

/** Out of scrap before winning, with room to use more: a bonus crate may be granted. */
export function canBonus(s: GameState): boolean {
  return !s.won && s.tray.length === 0 && s.batches.length === 0 && hasFreeTile(s);
}
```

`src/engine/actions.ts`:
1. Import `canBonus` alongside `coverage, isStuck`.
2. Add:

```ts
export function grantBonus(s: GameState): ActionResult {
  if (!canBonus(s)) return fail('bonus not available');
  const next = cloneState(s);
  next.tray = ['crate'];
  next.bonusUsed += 1;
  return finish(s, next, [{ type: 'bonus' }]);
}
```

3. Replace `applyMove` with:

```ts
export function applyMove(s: GameState, move: Move): ActionResult {
  if (typeof move !== 'object' || move === null) return fail('unknown move');
  switch (move.type) {
    case 'seed':
      return placeSeed(s, move.plant, { x: move.x, y: move.y });
    case 'scrap':
      return placeScrap(s, move.slot, { x: move.x, y: move.y });
    case 'harvest':
      return harvest(s, { x: move.x, y: move.y });
    case 'bonus':
      return grantBonus(s);
    default:
      return fail('unknown move');
  }
}
```

`src/engine/index.ts`: export `grantBonus` with the actions, and `canBonus` and `hasFreeTile` with the queries.

- [ ] **Step 4: Run all tests**

Run: `npm test && npm run typecheck`
Expected: engine tests pass, and all 5 level solutions still pass. Controller, HUD and App tests that relied on "stuck when scrap runs out" now fail; Task 5 and Task 7 rewrite them. Record which ones fail (expected: controller `opens "rests" when stuck…`, `ignores taps while an overlay is open`; hud `shows the rests overlay…`). If anything else fails, investigate it before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/engine tests/engine
git commit -m "feat(engine): bonus crate move; stuck now means no free tile"
```

---

### Task 2: Gentler first levels

**Files:**
- Modify: `src/levels/01-bus-stop.json`, `src/levels/02-rooftop.json`

- [ ] **Step 1: Edit and re-solve**

In both files, set `"target": 0.5` and add 2 to `seeds.moss`: Bus Stop goes 6 → 8, Rooftop 4 → 6. Then run:

```bash
npm run solve -- src/levels/01-bus-stop.json && npm run solve -- src/levels/02-rooftop.json
```

Expected: `bus-stop: solved in N moves` and `rooftop: solved in M moves`, each N, M ≥ 8. If one is below 8, ledger it and keep it (the spec's intent is an easy start).

- [ ] **Step 2: Test and commit**

Run: `npx vitest run tests/levels tests/game/tutorial.test.ts`
Expected: PASS, and `planTutorial` still finds a layout.

```bash
git add src/levels
git commit -m "feat(levels): gentler Bus Stop and Rooftop"
```

---

### Task 3: Hints and scoring (pure)

**Files:**
- Create: `src/game/hints.ts`, `src/game/scoring.ts`
- Test: `tests/game/hints.test.ts`, `tests/game/scoring.test.ts`

**Interfaces:**
- Produces:
  - `bestTile(s: GameState, sel: Selection): Pos | null`
  - `type ComboLabel = 'Nice!' | 'Lush!' | 'Wild!'` and `comboFor(events): { size: number; label: ComboLabel } | null`
  - `starsFor(level: LevelData, s: GameState): 1 | 2 | 3`
  - `milestonesCrossed(prev: number, next: number): (25 | 50 | 75)[]`

- [ ] **Step 1: Write the failing tests**

`tests/game/hints.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { placeScrap, placeSeed } from '../../src/engine';
import { bestTile } from '../../src/game/hints';
import { makeState, putObject, putPlant } from '../engine/helpers';

describe('bestTile', () => {
  it('returns null with no selection', () => {
    expect(bestTile(makeState(), null)).toBeNull();
  });
  it('for scrap picks the tile that grows the most new cover', () => {
    const s = makeState({ batches: [['tyre']] });
    putPlant(s, 1, 1, 'moss', 0);
    putPlant(s, 3, 1, 'moss', 0);
    expect(bestTile(s, { kind: 'scrap', slot: 0 })).toEqual({ x: 2, y: 1 });
  });
  it('for seeds prefers tiles near existing plants', () => {
    const s = makeState();
    putPlant(s, 4, 4, 'moss', 1);
    const t = bestTile(s, { kind: 'seed', plant: 'moss' })!;
    expect(Math.abs(t.x - 4) + Math.abs(t.y - 4)).toBeLessThanOrEqual(2);
  });
  it('bestTile only returns tiles where the move is valid', () => {
    const s = makeState({ ground: ['XXXXX', 'X...X', 'X...X', 'X...X', 'XXXXX'], batches: [['crate']] });
    putObject(s, 2, 2, 'bin', 'small', 'ruin');
    putPlant(s, 1, 1, 'moss', 1);
    const scrap = bestTile(s, { kind: 'scrap', slot: 0 })!;
    expect(placeScrap(s, 0, scrap).ok).toBe(true);
    const seed = bestTile(s, { kind: 'seed', plant: 'flower' })!;
    expect(placeSeed(s, 'flower', seed).ok).toBe(true);
  });
  it('returns null when nothing is valid', () => {
    const s = makeState({ width: 1, height: 1, ground: ['.'] });
    putPlant(s, 0, 0, 'moss', 0);
    expect(bestTile(s, { kind: 'scrap', slot: 0 })).toBeNull();
    expect(bestTile(s, { kind: 'scrap', slot: 9 })).toBeNull();
  });
});
```

`tests/game/scoring.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/engine';
import { comboFor, milestonesCrossed, starsFor } from '../../src/game/scoring';
import { makeLevel, makeState } from '../engine/helpers';

const p = { x: 0, y: 0 };
const grows = (n: number): GameEvent[] => Array.from({ length: n }, () => ({ type: 'grew', pos: p, stage: 1 }) as GameEvent);
const scrap: GameEvent = { type: 'placedScrap', pos: p, scrap: 'tyre' };

describe('comboFor', () => {
  it('needs a scrap placement and at least 4 growth events', () => {
    expect(comboFor(grows(6))).toBeNull();
    expect(comboFor([scrap, ...grows(3)])).toBeNull();
  });
  it('labels by size, counting spreads too', () => {
    expect(comboFor([scrap, ...grows(4)])).toEqual({ size: 4, label: 'Nice!' });
    expect(comboFor([scrap, ...grows(5), { type: 'spread', from: p, to: p, plant: 'moss' }, { type: 'spread', from: p, to: p, plant: 'moss' }])).toEqual({ size: 7, label: 'Lush!' });
    expect(comboFor([scrap, ...grows(11)])).toEqual({ size: 11, label: 'Wild!' });
  });
});

describe('starsFor', () => {
  const level = makeLevel({ batches: [['tyre', 'tyre'], ['tyre', 'tyre']] });
  it('gives 1 star when a bonus was used', () => {
    const s = makeState({ batches: level.batches });
    s.bonusUsed = 1;
    expect(starsFor(level, s)).toBe(1);
  });
  it('gives 3 stars with at least a quarter of the scrap left', () => {
    const s = makeState({ batches: level.batches });
    s.tray = ['tyre'];
    s.batches = [];
    expect(starsFor(level, s)).toBe(3);
  });
  it('gives 2 stars otherwise', () => {
    const s = makeState({ batches: level.batches });
    s.tray = [];
    s.batches = [];
    expect(starsFor(level, s)).toBe(2);
  });
});

describe('milestonesCrossed', () => {
  it('reports each threshold crossed upward', () => {
    expect(milestonesCrossed(0.1, 0.3)).toEqual([25]);
    expect(milestonesCrossed(0.2, 0.8)).toEqual([25, 50, 75]);
    expect(milestonesCrossed(0.5, 0.6)).toEqual([]);
    expect(milestonesCrossed(0.49, 0.5)).toEqual([50]);
    expect(milestonesCrossed(0.8, 0.2)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/game/hints.test.ts tests/game/scoring.test.ts`
Expected: FAIL, with module-not-found errors.

- [ ] **Step 3: Create `src/game/hints.ts`**

```ts
import { placeScrap, placeSeed, RADIUS, SCRAP, type GameState, type Pos } from '../engine';
import type { Selection } from './controller';

const covered = (s: GameState) => s.tiles.filter((t) => t.ground !== 'blocked' && t.plant !== null && t.plant.stage >= 1).length;
const manhattan = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** The tile where the selected item helps most; only ever a tile where the move is valid. */
export function bestTile(s: GameState, sel: Selection): Pos | null {
  if (!sel) return null;
  const plants: Pos[] = [];
  s.tiles.forEach((t, i) => t.plant && plants.push({ x: i % s.width, y: Math.floor(i / s.width) }));
  const centre = { x: (s.width - 1) / 2, y: (s.height - 1) / 2 };
  const base = covered(s);
  let best: Pos | null = null;
  let bestScore: [number, number] = [-Infinity, -Infinity];
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const p = { x, y };
      let score: [number, number];
      if (sel.kind === 'scrap') {
        const kind = s.tray[sel.slot];
        if (kind === undefined) return null;
        const r = placeScrap(s, sel.slot, p);
        if (!r.ok) continue;
        const radius = RADIUS[SCRAP[kind].size];
        score = [covered(r.state) - base, plants.filter((q) => manhattan(p, q) <= radius).length];
      } else {
        if (!placeSeed(s, sel.plant, p).ok) continue;
        score = [plants.filter((q) => manhattan(p, q) <= 2).length, -manhattan(p, centre)];
      }
      if (score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1])) {
        best = p;
        bestScore = score;
      }
    }
  }
  return best;
}
```

- [ ] **Step 4: Create `src/game/scoring.ts`**

```ts
import type { GameEvent, GameState, LevelData } from '../engine';

export type ComboLabel = 'Nice!' | 'Lush!' | 'Wild!';

export function comboFor(events: GameEvent[]): { size: number; label: ComboLabel } | null {
  if (!events.some((e) => e.type === 'placedScrap')) return null;
  const size = events.filter((e) => e.type === 'grew' || e.type === 'spread').length;
  if (size < 4) return null;
  return { size, label: size >= 11 ? 'Wild!' : size >= 7 ? 'Lush!' : 'Nice!' };
}

export function starsFor(level: LevelData, s: GameState): 1 | 2 | 3 {
  if (s.bonusUsed > 0) return 1;
  const total = level.batches.reduce((n, b) => n + b.length, 0);
  const left = s.tray.length + s.batches.reduce((n, b) => n + b.length, 0);
  return total > 0 && left / total >= 0.25 ? 3 : 2;
}

export function milestonesCrossed(prev: number, next: number): (25 | 50 | 75)[] {
  return ([25, 50, 75] as const).filter((t) => prev < t / 100 && next >= t / 100);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/game/hints.test.ts tests/game/scoring.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/hints.ts src/game/scoring.ts tests/game/hints.test.ts tests/game/scoring.test.ts
git commit -m "feat(game): best-tile hints, combos, stars and milestones"
```

---

### Task 4: Save stars and sound cues

**Files:**
- Modify: `src/save/save.ts`, `src/audio/cues.ts`, `src/audio/toneSound.ts`
- Test: `tests/save/save.test.ts`, `tests/audio/cues.test.ts`

**Interfaces:**
- Produces:
  - `SaveData.stars: Record<string, 1 | 2 | 3>`
  - `recordStars(data, id, stars): SaveData`
  - `Cue` gains `'combo' | 'milestone' | 'bonus'`; `cuesFor` adds `bonus` (on a bonus event) and `combo` (when `comboFor` is non-null)

- [ ] **Step 1: Write the failing tests**

Append to `tests/save/save.test.ts` (add `recordStars` to the import):

```ts
describe('stars', () => {
  it('defaults to {}, keeps the best, and drops invalid entries', () => {
    expect(defaultSave().stars).toEqual({});
    let d = recordStars(defaultSave(), 'bus-stop', 2);
    d = recordStars(d, 'bus-stop', 1);
    expect(d.stars).toEqual({ 'bus-stop': 2 });
    d = recordStars(d, 'bus-stop', 3);
    expect(d.stars['bus-stop']).toBe(3);
    const raw = JSON.stringify({ version: 1, completed: [], stars: { a: 3, b: 7, c: 'x' }, settings: {} });
    expect(loadSave(memoryStore({ [SAVE_KEY]: raw })).stars).toEqual({ a: 3 });
  });
});
```

In the existing save test `drops invalid fields but keeps valid ones`, add `stars: {},` to the expected object, after `tutorialDone: false,`.

Append to `tests/audio/cues.test.ts`:

```ts
describe('v1.2 cues', () => {
  it('adds bonus and combo cues', () => {
    const g = (n: number): GameEvent[] => Array.from({ length: n }, () => ({ type: 'grew', pos: p, stage: 1 }) as GameEvent);
    expect(cuesFor([{ type: 'bonus' }])).toEqual(['bonus']);
    expect(cuesFor([{ type: 'placedScrap', pos: p, scrap: 'tyre' }, ...g(5)])).toContain('combo');
    expect(cuesFor([{ type: 'placedScrap', pos: p, scrap: 'tyre' }, ...g(2)])).not.toContain('combo');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/save tests/audio`
Expected: the new tests fail.

- [ ] **Step 3: Implement**

`src/save/save.ts`:
1. Add `stars: Record<string, 1 | 2 | 3>;` to `SaveData` after `tutorialDone`.
2. Add `stars: {},` to `defaultSave()`.
3. In `loadSave`'s return object, after `tutorialDone`, add:

```ts
      stars: Object.fromEntries(
        Object.entries(typeof d.stars === 'object' && d.stars !== null ? (d.stars as Record<string, unknown>) : {}).filter(
          (e): e is [string, 1 | 2 | 3] => e[1] === 1 || e[1] === 2 || e[1] === 3,
        ),
      ),
```

4. Add:

```ts
export function recordStars(data: SaveData, id: string, stars: 1 | 2 | 3): SaveData {
  return (data.stars[id] ?? 0) >= stars ? data : { ...data, stars: { ...data.stars, [id]: stars } };
}
```

`src/audio/cues.ts`:
1. Import `{ comboFor } from '../game/scoring'`.
2. Extend `Cue` with `| 'combo' | 'milestone' | 'bonus'`.
3. In the `cuesFor` switch, add `case 'bonus': out.push('bonus'); break;`.
4. Before `return out;`, add `if (comboFor(events)) out.push('combo');`.

`src/audio/toneSound.ts`: in the `switch (cue)` of `play`, add:

```ts
        case 'combo':
          ['C5', 'E5', 'G5', 'C6'].forEach((note, i) => n.bell.triggerAttackRelease(note, '16n', now + 0.12 + i * 0.06));
          break;
        case 'milestone':
          n.pad.triggerAttackRelease(['F3', 'C4', 'A4'], '2n', now);
          n.bell.triggerAttackRelease(['A5', 'C6'], '8n', now + 0.2);
          break;
        case 'bonus':
          n.pluck.triggerAttackRelease(['G5', 'C6'], '16n', now);
          break;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/save tests/audio && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/save src/audio tests/save tests/audio
git commit -m "feat: saved best stars; combo, milestone and bonus sound cues"
```

---

### Task 5: Controller: one tap, assist and auto-bonus

**Files:**
- Modify: `src/game/controller.ts`
- Test: `tests/game/controller.test.ts`, `tests/game/tutorial.test.ts`, `tests/ui/hud.test.ts`

**Interfaces:**
- Consumes: `canBonus`, `isStuck`, `PLANT_TYPES` (engine)
- Produces:
  - `new PlayController(level, opts?: { assist?: boolean })`. Assist preselects the first available item and auto-switches when the selection runs out.
  - `tap` places on the first tap for both input kinds.
  - After any move, the controller auto-applies `bonus` when `canBonus`. `undo()` reverts a bonus together with the move before it.

- [ ] **Step 1: Rewrite and add the tests**

In `tests/game/controller.test.ts`:
1. Replace the test `touch needs a preview tap then a confirming tap on the same tile` (spec change) with:

```ts
  it('touch places in one tap, and a second tap on the same tile does not place again', () => {
    const c = new PlayController(makeLevel());
    c.select({ kind: 'seed', plant: 'moss' });
    expect(c.tap(at(1, 1), 'touch')).toHaveLength(1);
    expect(c.tap(at(1, 1), 'touch')).toEqual([]);
    expect(c.view.state.seeds.moss).toBe(4);
  });
```

2. Replace the scenario in `opens "rests" when stuck, and undo closes it` and in `ignores taps while an overlay is open` (spec change: running out of scrap now grants a bonus) so they use a full board. Both tests then become:

```ts
  it('opens "rests" when no tile is free, and undo closes it', () => {
    const c = new PlayController(makeLevel({ width: 2, height: 1, ground: ['..'], seeds: { moss: 2 }, batches: [['tyre']] }));
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'seed', plant: 'moss', x: 1, y: 0 });
    expect(c.view.overlay).toBe('rests');
    c.undo();
    expect(c.view.overlay).toBe('none');
  });

  it('ignores taps while an overlay is open', () => {
    const c = new PlayController(makeLevel({ width: 2, height: 1, ground: ['..'], seeds: { moss: 2 }, batches: [['tyre']] }));
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'seed', plant: 'moss', x: 1, y: 0 });
    c.select({ kind: 'scrap', slot: 0 });
    expect(c.tap(at(0, 0), 'mouse')).toEqual([]);
  });
```

3. In `clamps or clears scrap selection as the tray changes`, the final assertion (spec change: auto-bonus) becomes:

```ts
    c.tap(at(2, 0), 'mouse');
    expect(c.view.state.tray).toEqual(['crate']);
    expect(c.view.selection).toEqual({ kind: 'scrap', slot: 0 });
```

4. Append:

```ts
describe('v1.2 assist and bonus', () => {
  it('assist preselects the first seed and auto-switches when it runs out', () => {
    const c = new PlayController(makeLevel({ seeds: { moss: 1, vine: 1 }, batches: [['tyre']] }), { assist: true });
    expect(c.view.selection).toEqual({ kind: 'seed', plant: 'moss' });
    c.tap(at(0, 0), 'touch');
    expect(c.view.selection).toEqual({ kind: 'seed', plant: 'vine' });
    c.tap(at(1, 0), 'touch');
    expect(c.view.selection).toEqual({ kind: 'scrap', slot: 0 });
    c.restart();
    expect(c.view.selection).toEqual({ kind: 'seed', plant: 'moss' });
  });

  it('auto-grants a bonus crate when scrap runs out before winning', () => {
    const c = new PlayController(makeLevel({ batches: [['tyre']] }));
    const events = c.play({ type: 'scrap', slot: 0, x: 0, y: 0 });
    expect(events.at(-1)).toEqual({ type: 'bonus' });
    expect(c.view.state.tray).toEqual(['crate']);
    expect(c.view.state.bonusUsed).toBe(1);
    expect(c.view.overlay).toBe('none');
  });

  it('undo after an automatic bonus reverts the move and the bonus together', () => {
    const c = new PlayController(makeLevel({ batches: [['tyre']] }));
    c.play({ type: 'scrap', slot: 0, x: 0, y: 0 });
    c.undo();
    expect(c.view.state.tray).toEqual(['tyre']);
    expect(c.view.state.bonusUsed).toBe(0);
    expect(c.view.canUndo).toBe(false);
  });

  it('full board with scrap left still rests and never loops bonuses', () => {
    const c = new PlayController(makeLevel({ width: 1, height: 1, ground: ['.'], seeds: { moss: 1 }, batches: [['tyre']] }));
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    expect(c.view.overlay).toBe('rests');
    expect(c.view.state.bonusUsed).toBe(0);
  });
});
```

In `tests/game/tutorial.test.ts`, replace the test `touch: the preview tap does not advance, the confirming tap does` (spec change) with:

```ts
  it('touch advances in one tap', () => {
    const { plan, c, t, act } = setup();
    act(() => c.select({ kind: 'seed', plant: 'moss' }));
    act(() => c.tap(plan.seed1, 'touch'));
    expect(t.step).toBe(3);
  });
```

In `tests/ui/hud.test.ts`, change the controller in `shows the rests overlay with Undo and Restart` (spec change) to:

```ts
    const c = new PlayController(makeLevel({ width: 2, height: 1, ground: ['..'], seeds: { moss: 2 }, batches: [['tyre']] }));
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'seed', plant: 'moss', x: 1, y: 0 });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/game tests/ui`
Expected: the new and rewritten tests fail (two-tap behaviour, no assist option, no auto-bonus).

- [ ] **Step 3: Implement in `src/game/controller.ts`**

1. Add `canBonus` and `PLANT_TYPES` to the engine import.
2. Add `export interface ControllerOptions { assist?: boolean }`. Change the constructor to:

```ts
  private readonly assist: boolean;

  constructor(readonly level: LevelData, opts: ControllerOptions = {}) {
    this.session = new Session(level);
    this.assist = opts.assist ?? false;
    if (this.assist) this.selection = this.firstAvailable();
  }

  private firstAvailable(): Selection {
    const s = this.session.state;
    const plant = PLANT_TYPES.find((t) => s.seeds[t] > 0);
    if (plant) return { kind: 'seed', plant };
    return s.tray.length > 0 ? { kind: 'scrap', slot: 0 } : null;
  }
```

3. In `tap`, delete the `if (input === 'touch' && …) { … }` block. Keep the `input` parameter for API stability and rename it `_input` to satisfy lint, if needed.
4. In `play`, after `if (!result.ok) return [];`, add:

```ts
    const events = [...result.events];
    if (canBonus(this.session.state)) {
      const bonus = this.session.apply({ type: 'bonus' });
      if (bonus.ok) events.push(...bonus.events);
    }
```

   Then use `events` instead of `result.events` in the rest of `play` (the won check, `emit` and `return`).
5. Replace `undo` with:

```ts
  undo(): void {
    if (!this.session.undo()) return;
    // A bonus is granted automatically after a move, so undo the move that triggered it too.
    if (canBonus(this.session.state)) this.session.undo();
    this.overlay = 'none';
    this.settleSelection();
    this.refreshPreview();
    this.emit([]);
  }
```

6. In `restart`, replace `this.selection = null;` with `this.selection = this.assist ? this.firstAvailable() : null;`.
7. Replace `settleSelection` with:

```ts
  private settleSelection(): void {
    const s = this.session.state;
    const sel = this.selection;
    if (sel?.kind === 'seed' && !(s.seeds[sel.plant] > 0)) this.selection = this.assist ? this.firstAvailable() : null;
    if (sel?.kind === 'scrap') {
      if (s.tray.length > 0) this.selection = { kind: 'scrap', slot: Math.min(sel.slot, s.tray.length - 1) };
      else this.selection = this.assist ? this.firstAvailable() : null;
    }
  }
```

- [ ] **Step 4: Run all tests**

Run: `npm test && npm run typecheck`
Expected: all pass, except the App tests that Task 7 rewrites (tutorial starting step). Record any failing App test names.

- [ ] **Step 5: Commit**

```bash
git add src/game/controller.ts tests
git commit -m "feat(game): one-tap placement, assist selection and automatic bonus crate"
```

---

### Task 6: Faster timings and scene celebrations

**Files:**
- Create: `src/render/scene/timing.ts`
- Modify: `src/render/scene/DioramaScene.ts`, `src/render/scene/effects.ts`, `src/render/scene/atmosphere.ts`
- Test: browser gate (Step 4)

**Interfaces:**
- Consumes: `comboFor`, `milestonesCrossed` (Task 3); `rippleDelay` and `washDelays` (existing, with timing arguments)
- Produces: `TIMING` constants; `Effects.floatText(x, y, text, big, still)`; `Effects.milestone(area, still)`

- [ ] **Step 1: Create `src/render/scene/timing.ts`**

```ts
/** All animation durations in ms, in one place for tuning (v1.2: ~0.7× of v1.1). */
export const TIMING = {
  grow: 350,
  sprout: 320,
  sproutDelay: 100,
  bloom: 420,
  seedPop: 180,
  drop: 250,
  ripple: 280,
  growLag: 250,
  harvestBurst: 110,
  harvestFly: 310,
  washStep: 28,
  turnStep: 350,
  comboRise: 900,
  milestoneRing: 500,
  birds: 2000,
} as const;
```

- [ ] **Step 2: Use the timings and add the effects**

`src/render/scene/effects.ts`:
1. Import `{ TIMING } from './timing'`.
2. In `drop`, use `duration: TIMING.drop`. In `ripple`, use `duration: TIMING.ripple`. In `flyTo`, use `TIMING.harvestBurst` and `TIMING.harvestFly` for the two chained durations.
3. Add the methods:

```ts
  floatText(x: number, y: number, text: string, big: boolean, still: boolean): void {
    const t = this.scene.add
      .text(x, y - 30, text, { fontFamily: 'Nunito, sans-serif', fontSize: big ? '28px' : '20px', fontStyle: 'bold', color: '#fff6d8', stroke: '#2b3a1f', strokeThickness: 5 })
      .setOrigin(0.5);
    this.layer.add(t);
    if (still) {
      this.scene.time.delayedCall(TIMING.comboRise, () => t.destroy());
      return;
    }
    t.setScale(0.6);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 180, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: t, y: t.y - 40, alpha: 0, delay: 250, duration: TIMING.comboRise - 250, ease: 'Quad.In', onComplete: () => t.destroy() });
  }

  milestone(area: Rect): void {
    const cx = area.x + area.w / 2;
    const cy = area.y + area.h / 2;
    const ring = this.scene.add.graphics();
    this.layer.add(ring);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: TIMING.milestoneRing,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        ring.clear().lineStyle(4, PALETTE.firefly, 0.8 * (1 - t)).strokeEllipse(cx, cy, area.w * t, area.h * 0.6 * t);
      },
      onComplete: () => ring.destroy(),
    });
    for (let i = 0; i < 4; i++) {
      const y = area.y + 20 + i * 14;
      const bird = this.scene.add.image(area.x - 30 - i * 26, y, 'bird').setTint(0x2b2b28).setScale(0.9 - i * 0.1);
      this.layer.add(bird);
      this.scene.tweens.add({ targets: bird, x: area.x + area.w + 40, y: y - 30, duration: TIMING.birds, delay: i * 120, ease: 'Sine.InOut', onComplete: () => bird.destroy() });
    }
  }
```

`src/render/scene/atmosphere.ts`: in `makeParticleTextures`, add:

```ts
  if (!scene.textures.exists('bird')) {
    const g = scene.make.graphics({}, false);
    g.lineStyle(2.2, 0xffffff, 1).beginPath();
    g.moveTo(1, 6);
    g.lineTo(7, 2);
    g.lineTo(13, 6);
    g.strokePath();
    g.generateTexture('bird', 14, 8);
    g.destroy();
  }
```

`src/render/scene/DioramaScene.ts`:
1. Import `{ TIMING } from './timing'` and `{ comboFor, milestonesCrossed } from '../../game/scoring'`.
2. Replace the literal durations:
   - `growLag = scrapEv ? 350 : 0` → `TIMING.growLag`
   - `rippleDelay(scrapEv.pos, ch.pos, radius)` → `rippleDelay(scrapEv.pos, ch.pos, radius, TIMING.ripple)`
   - sprout `delay: delay + 150, duration: 450` → `delay: delay + TIMING.sproutDelay, duration: TIMING.sprout`
   - `this.effects.pop(plant, 0.6, 250, BASE)` → `this.effects.pop(plant, 0.6, TIMING.seedPop, BASE)`
   - grow `duration: 500` → `TIMING.grow`; bloom `duration: 600` → `TIMING.bloom`
   - `washDelays(view.state, origin)` → `washDelays(view.state, origin, TIMING.washStep)`
   - `this.celebration.start(ctrl, 450)` → `this.celebration.start(ctrl, TIMING.turnStep)`
3. Add the field `private lastProgress = 0;`, and set `this.lastProgress = ctrl.view.progress;` in `attach` after `this.lastRotation = …`.
4. At the end of `applyChanges` (before `this.world.sort`), add:

```ts
    const combo = comboFor(events);
    if (combo && scrapEv) {
      const c = toScreen(v, scrapEv.pos);
      this.effects.floatText(c.x, c.y, `${combo.label} ×${combo.size}`, combo.label === 'Wild!', !motion);
      if (motion) this.effects.burst(c.x, c.y, PALETTE.pollen, 8 + combo.size, 70);
    }
```

5. In `onChange`, before the celebrate check, add:

```ts
    const crossed = milestonesCrossed(this.lastProgress, view.progress);
    this.lastProgress = view.progress;
    if (crossed.length > 0 && this.opts.interactive && !this.opts.reducedMotion) this.effects.milestone(this.area(view));
```

- [ ] **Step 3: Typecheck and test**

Run: `npm run typecheck && npm test`
Expected: all pass, except the App tests listed in Task 5.

- [ ] **Step 4: Browser gate** (headless Chrome, dev server, DEV hooks)

1. **Pacing:** after a tyre drop, every plant settles at scale 0.5 within 1000 ms (it was 1250 ms). Re-run the settle probe (`window.__check`) with a 1000 ms wait.
2. **Combo:** on Playground, play the solution step by step until an event batch has ≥ 4 grow/spread events with a scrap. A Text containing "×" appears in `fxLayer` within 100 ms. Screenshot.
3. **Milestone:** crossing 25% puts `bird` images in `fxLayer`. Screenshot.
4. **Reduce motion:** the combo text appears without a tween, and there are no birds.
5. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/render
git commit -m "feat(render): faster central timings, combo bursts and milestone birds"
```

---

### Task 7: HUD and App wiring

**Files:**
- Modify: `src/ui/hud.ts`, `src/app/app.ts`, `src/game/tutorial.ts`, `src/styles.css`
- Test: `tests/ui/hud.test.ts`, `tests/app/app.test.ts`

**Interfaces:**
- Consumes: `bestTile`, `starsFor`, `milestonesCrossed` (Task 3), `recordStars` (Task 4), `ControllerOptions` (Task 5)
- Produces:
  - `HudMeta.stars?: 1 | 2 | 3 | null`
  - the HUD shows meter ticks, stars on the restored panel and a "Bonus crate!" toast
  - the App uses `{ assist: true }`, runs a 3 s hint timer, saves stars and plays the milestone cue
  - the select screen shows stars

- [ ] **Step 1: Write and rewrite the tests**

Append to `tests/ui/hud.test.ts`:

```ts
describe('Hud v1.2', () => {
  it('shows meter ticks at 25/50/75', () => {
    const c = new PlayController(makeLevel());
    new Hud(root, handlers()).render(c.view, meta);
    expect(root.querySelectorAll('.meter .tick')).toHaveLength(3);
  });
  it('shows stars on the restored panel', () => {
    const c = new PlayController(makeLevel({ width: 3, height: 1, ground: ['...'], target: 0.3, batches: [['tyre', 'tyre']] }));
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'scrap', slot: 0, x: 1, y: 0 });
    new Hud(root, handlers()).render(c.view, { ...meta, stars: 2 });
    expect(root.querySelectorAll('.overlay .star.on')).toHaveLength(2);
    expect(root.querySelector('.overlay .stars')!.getAttribute('aria-label')).toBe('2 of 3 stars');
  });
  it('toasts "Bonus crate!" when bonusUsed rises', () => {
    let t = 0;
    const c = new PlayController(makeLevel({ batches: [['tyre']] }));
    const hud = new Hud(root, handlers(), () => t);
    hud.render(c.view, meta);
    c.play({ type: 'scrap', slot: 0, x: 0, y: 0 });
    hud.render(c.view, meta);
    expect(root.querySelector('.toast')!.textContent).toBe('Bonus crate!');
    t = 2000;
    hud.render(c.view, meta);
    expect(root.querySelector('.toast')).toBeNull();
  });
});
```

In `tests/app/app.test.ts`, replace these (spec change: Moss preselected, so the tutorial opens on step 2):
- In `guides the first Bus Stop and highlights suggested tiles`, change the body after `app.startLevel(0);` to:

```ts
    expect(coach()!.textContent).toContain('Tap a glowing tile to plant.');
    expect(highlight).toHaveBeenLastCalledWith(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
```

- In `leaving and returning restarts the tutorial…`, change the final expectation to `expect(coach()!.textContent).toContain('Step 2 of 6');`.

Append to `tests/app/app.test.ts`:

```ts
describe('App v1.2', () => {
  const done = JSON.stringify({ version: 1, completed: [], tutorialDone: true, settings: {} });

  it('starts levels with Moss selected', () => {
    const app = new App(root, stage, memoryStore({ [SAVE_KEY]: done }), LEVELS, opts);
    app.startLevel(0);
    expect(app.controller!.view.selection).toEqual({ kind: 'seed', plant: 'moss' });
  });

  it('hint is cleared on any change and recomputed after 3 s idle', () => {
    vi.useFakeTimers();
    const highlight = vi.fn();
    const app = new App(root, { show: vi.fn(), highlight }, memoryStore({ [SAVE_KEY]: done }), LEVELS, opts);
    app.startLevel(1);
    highlight.mockClear();
    vi.advanceTimersByTime(3000);
    const tile = highlight.mock.calls.at(-1)![0];
    expect(tile).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
    app.controller!.play({ type: 'seed', plant: 'moss', ...tile });
    expect(highlight).toHaveBeenLastCalledWith(null);
    vi.useRealTimers();
  });

  it('saves stars on the win and shows them on the level card', () => {
    const store = memoryStore({ [SAVE_KEY]: done });
    const app = new App(root, stage, store, LEVELS, opts);
    app.startLevel(0);
    for (const m of LEVELS[0]!.solution) app.controller!.play(m);
    const stars = JSON.parse(store.data[SAVE_KEY]!).stars['bus-stop'];
    expect([1, 2, 3]).toContain(stars);
    expect(root.querySelectorAll('.overlay .star.on')).toHaveLength(stars);
    click('[data-action="menu"]');
    expect(root.querySelector('[data-level="0"] .stars-mini')!.textContent).toBe('★'.repeat(stars) + '☆'.repeat(3 - stars));
  });

  it('plays the milestone cue when progress crosses a mark', () => {
    const { sound, calls } = fakeSound();
    const app = new App(root, stage, memoryStore({ [SAVE_KEY]: done }), LEVELS, opts, sound);
    app.startLevel(0);
    for (const m of LEVELS[0]!.solution) app.controller!.play(m);
    expect(calls.cues).toContain('milestone');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/ui tests/app`
Expected: the new and rewritten tests fail.

- [ ] **Step 3: Implement**

`src/game/tutorial.ts`: change step 2's text to `'Tap a glowing tile to plant.'`.

`src/ui/hud.ts`:
1. Add `stars?: 1 | 2 | 3 | null;` to `HudMeta`.
2. Add the fields `private prevBonus: number | null = null;` and `private toastUntil = 0;`.
3. In `render`, after the seeds bump logic, add:

```ts
    if (this.prevBonus !== null && view.state.bonusUsed > this.prevBonus) this.toastUntil = t + 1500;
    this.prevBonus = view.state.bonusUsed;
```

4. In `html()`:
   - Change the meter contents to `<div class="meter-fill" style="width:${pct}%"></div><i class="tick" style="left:25%"></i><i class="tick" style="left:50%"></i><i class="tick" style="left:75%"></i>`.
   - After the `</footer>`, add `${this.toastUntil > now ? '<div class="toast" role="status">Bonus crate!</div>' : ''}`.
5. In `overlay()`, in the restored branch, insert after the `<h2>`:

```ts
${m.stars ? `<div class="stars" aria-label="${m.stars} of 3 stars">${[1, 2, 3].map((i) => `<span class="star ${i <= m.stars! ? 'on' : ''}" style="animation-delay:${(i - 1) * 150}ms">★</span>`).join('')}</div>` : ''}
```

`src/app/app.ts`:
1. Imports: `{ bestTile } from '../game/hints'`, `{ milestonesCrossed, starsFor } from '../game/scoring'`, and add `recordStars` to the save import.
2. Fields: `private hintTimer: ReturnType<typeof setTimeout> | null = null;`, `private hintShown = false;` and `private lastStars: 1 | 2 | 3 | null = null;`.
3. In `teardown()`: `if (this.hintTimer) clearTimeout(this.hintTimer); this.hintTimer = null; this.hintShown = false; this.lastStars = null;`.
4. In `startLevel`:
   - Construct with `new PlayController(level, { assist: true })`.
   - After creating the tutorial, add `this.tutorial?.update(ctrl.view, []);`.
   - Change `meta()` to include `stars: ctrl.view.overlay === 'restored' ? this.lastStars : null`.
   - Add `let lastProgress = ctrl.view.progress;` next to `lastOverlay`.
   - In `onChange`:
     - In the `won` branch, after `markCompleted`, add `this.lastStars = starsFor(level, view.state); this.save = recordStars(this.save, level.id, this.lastStars);`, before the existing `writeSave`.
     - After `const cues = cuesFor(events);`, add `if (milestonesCrossed(lastProgress, view.progress).length > 0) cues.push('milestone'); lastProgress = view.progress;`.
     - At the end of the callback, add `this.scheduleHint();`.
   - After the initial `hud.render(...)`, add `this.scheduleHint();`.
5. Add the method:

```ts
  private scheduleHint(): void {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    if (this.hintShown) {
      this.hintShown = false;
      this.stage.highlight?.(this.tutorial?.highlight ?? null);
    }
    const ctrl = this.controller;
    if (!ctrl) return;
    this.hintTimer = setTimeout(() => {
      this.hintTimer = null;
      if (this.controller !== ctrl || this.tutorial?.highlight || ctrl.view.overlay !== 'none') return;
      const tile = bestTile(ctrl.view.state, ctrl.view.selection);
      if (!tile) return;
      this.hintShown = true;
      this.stage.highlight?.(tile);
    }, 3000);
  }
```

6. In the select template's card, inside the button after the status span, add `${this.save.stars[l.id] ? `<span class="stars-mini" aria-label="${this.save.stars[l.id]} stars">${'★'.repeat(this.save.stars[l.id]!)}${'☆'.repeat(3 - this.save.stars[l.id]!)}</span>` : ''}`.
7. How to Play cards: card 1 text becomes `'Tap a tile to plant. Your seed is already picked.'`; card 5 text becomes `'No timer, no losing. Undo any time; rotate (◀ ▶ or Q/E) and zoom to look around. Stuck? Wait a moment — the best tile glows.'`.

`src/styles.css` (append):

```css
.meter { position: relative; overflow: visible; }
.meter .tick { position: absolute; top: -3px; width: 2px; height: 18px; background: rgba(241, 237, 226, 0.45); border-radius: 1px; }
.stars { display: flex; gap: 8px; font-size: 40px; }
.star { color: rgba(241, 237, 226, 0.25); animation: star-pop 420ms ease-out both; }
.star.on { color: #f2c14e; text-shadow: 0 0 14px rgba(242, 193, 78, 0.7); }
@keyframes star-pop { from { transform: scale(0.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.stars-mini { color: #f2c14e; letter-spacing: 2px; font-size: 15px; }
.toast { position: absolute; left: 50%; bottom: calc(max(12px, env(safe-area-inset-bottom)) + 70px); transform: translateX(-50%); background: #f2c14e; color: #23251f; font-weight: 700; padding: 8px 16px; border-radius: 999px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35); animation: fade-in 200ms ease-out; }
```

- [ ] **Step 4: Run all tests**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src tests
git commit -m "feat: stars, meter ticks, bonus toast, idle hint and milestone cue"
```

---

### Task 8: Verify and ship

- [ ] **Step 1: Suite, build and size**

Run: `npm test && npm run build && cat dist/assets/play-*.js dist/assets/play-*.css | gzip -c | wc -c`
Expected: all pass, and under 3,000,000.

- [ ] **Step 2: Beginner flow in the browser** (fresh storage, 390×844 touch and 1280×800 mouse)

1. Play → Bus Stop: the coach shows "Tap a glowing tile to plant." with a highlight, and **one tap** on the highlighted tile plants. Finish the tutorial with one tap per step.
2. Idle 3 s on Rooftop: a tile glows, and tapping it with the preselected item succeeds.
3. On a level, spend all the scrap far from plants: the "Bonus crate!" toast shows, the tray holds a crate, and no "garden rests" appears.
4. Win Bus Stop: the win panel shows stars, and the level select shows them.
5. During play, the combo text and milestone birds appear. Screenshots.
6. No console errors.

- [ ] **Step 3: Reduce motion and performance**

- Reduce motion: no birds, no tweens on the combo text, instant stars.
- Performance at 390×844 with CPU ×4 on the Playground solution: at least 45 fps.

- [ ] **Step 4: Ship** (after the final review and its fixes)

Merge to `main` and push. Wait for the Vercel deployment to be READY. Live check: the tutorial step-2 text appears with fresh storage, one tap plants, and there are no failed requests or console errors.
