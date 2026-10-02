# Afterlife — Plan 2: Playable Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the finished rules engine into a game you can play in the browser: an isometric diorama drawn by Phaser, code-drawn ground, ruins, scrap and plants, an HTML interface (tray, meter, buttons, overlays), title, level select and settings screens, saved progress, and mouse and touch controls.

**Architecture:** Every piece of logic lives in pure, unit-tested TypeScript: iso projection, plant and object shape generators, save data, level unlocking, and a `PlayController` that turns taps into engine moves and decides what to preview and which overlay to show. Phaser (`DioramaScene`) only *draws* the controller's `View` and forwards pointer input. The interface is an HTML/CSS layer (`Hud`, `App`) over the canvas. Object drawing sits behind an `ObjectArt` interface so Plan 3 can swap in rendered Kenney sprites.

**Tech Stack:** Phaser 4.2.1, Vite 8, TypeScript 7, Vitest 5 with happy-dom 20 (DOM tests), @fontsource/nunito 5.

**Spec:** `docs/superpowers/specs/2026-10-03-afterlife-design.md` (§3.5–3.8, §5, §6 art, §7.1, §7.3, §8). Plan 1, the engine in `src/engine/`, is done and merged. Plan 3 covers audio, the landing page, Kenney 3D sprites and the Vercel launch.

## Global Constraints

- The engine (`src/engine/`) stays framework-free. Only `src/render/scene/` and `src/render/objects/objectArt.ts` and `src/render/plants/plantArt.ts` and `src/main.ts` may import Phaser.
- Phaser **4.2.1**. v4 API notes: `setTintFill` no longer exists (use `setTint(...).setTintMode(Phaser.TintModes.FILL)`); FX and masks are filters; for Vite 8 use `build.rolldownOptions` (not `rollupOptions`).
- Grid distance is Manhattan. Tiles are 2:1 diamonds: `TILE_W = 64`, `TILE_H = 32`.
- The camera rotates in 90° steps (4 rotations); zoom is clamped to 0.5–3.
- localStorage key `afterlife.save.v1`. Every storage access is wrapped in try/catch, and the game plays without storage.
- Controls: mouse means click a tray item, hover to preview, click to place, right-click or Esc to deselect, wheel to zoom, Q/E to rotate. Touch means tap a tray item, tap a tile to preview, tap the same tile again to place, pinch to zoom.
- Rule visibility (§3.8): scrap preview shows the radius diamond and makes the plant cells it would feed glow; plant states show **icons**, not only colour; an invalid tile shows a soft red "no".
- Reduced motion: if `prefers-reduced-motion` is set or the in-game setting is on, there are no growth tweens and no camera turn.
- Unexpected runtime errors show "Something went wrong — Restart level", never a frozen screen.
- Buttons are at least 44 px tall; layout works from 360 px wide with no horizontal page scroll.
- No names, art, levels or audio from Cloud Gardens. Credits name "Ujjwal Kumar".
- Plan 1 deferred minors that this plan must honour: the engine emits `stuck` repeatedly, so show the "rests" overlay only on the transition; `previewScrap` ignores placement validity, so only glow cells when the placement is valid; `Session` states are deep-frozen, so renderers must never write to state.

## Review Focus

1. **Tapping after rotating the view** must hit the tile under the pointer in every rotation. Pinned in Task 2 (`toGrid inverts toScreen for every tile in every rotation`, including off-centre points).
2. **Blocked, full or corrupt localStorage** (private mode, quota, hand-edited JSON) must still start the game with default progress. Pinned in Task 3 (`loadSave survives corrupt JSON and throwing storage`, `writeSave returns false when storage throws`).
3. **Fast double taps or taps while an overlay is open** must not place extra items or act behind the "Scene restored" or "rests" panel. Pinned in Task 4 (`ignores taps while an overlay is open`).
4. **Using the last seed or the last tray item while it is selected** must clear or clamp the selection, never leave a stale selection that silently fails. Pinned in Task 4 (`clears seed selection when seeds run out`, `clamps or clears scrap selection as the tray changes`).
5. **Resizing the window or rotating a phone mid-level** must re-fit the diorama and keep picking accurate. Pinned in Task 9 (Chrome check, step 4).

---

## File Structure

| File | Responsibility | Phaser? |
|---|---|---|
| `index.html` | Temporary root page that redirects to `play/` (Plan 3 replaces it with the landing page) | no |
| `play/index.html` | Game page: `#stage` (canvas) and `#ui` (HTML layer) | no |
| `vite.config.ts` | Two-page build | no |
| `src/vite-env.d.ts` | Vite client types | no |
| `src/styles.css` | All interface styles | no |
| `src/render/iso/projection.ts` | Grid ↔ view rotation ↔ screen, depth, bounds | no |
| `src/render/palette.ts` | Colours, `lerpColor`, `lighten`, `darken` | no |
| `src/render/objects/objectShapes.ts` | Object name → low-poly blocks; rotation; top height | no |
| `src/render/objects/objectArt.ts` | `ObjectArt` interface + code-drawn implementation | yes |
| `src/render/plants/plantShapes.ts` | Plant cell → drawing primitives (seeded) | no |
| `src/render/plants/plantArt.ts` | Draws primitives into a Phaser Graphics | yes |
| `src/render/scene/DioramaScene.ts` | Draws the `View`, forwards input, camera fit, animations | yes |
| `src/game/controller.ts` | `PlayController`: selection, preview, taps → moves, overlays, rotation | no |
| `src/save/save.ts` | Load and write `SaveData` safely | no |
| `src/app/progress.ts` | Level unlock statuses | no |
| `src/ui/hud.ts` | In-level HTML interface | no |
| `src/app/app.ts` | Screens (title, select, settings, credits, play) and flow | no |
| `src/main.ts` | Wires Phaser, App, storage and error handlers | yes |

---

### Task 1: Vite app scaffold with Phaser

**Files:**
- Create: `vite.config.ts`, `index.html`, `play/index.html`, `src/vite-env.d.ts`, `src/styles.css`, `src/main.ts`
- Modify: `package.json` (scripts and dependencies), `tsconfig.json` (`include`)

**Interfaces:**
- Produces: `npm run dev` (dev server), `npm run build` (typecheck + production build into `dist/`), and the DOM mount points `#stage` and `#ui` used by Task 8.

This task is configuration and a smoke page, with no unit-testable logic (a TDD exception for config). Its test is the build plus a browser check.

- [ ] **Step 1: Install dependencies**

Run: `cd ~/Desktop/Afterlife && npm install phaser@4.2.1 @fontsource/nunito@5 && npm install -D happy-dom@20`
Expected: no errors. `npm ls phaser` shows `phaser@4.2.1`.

- [ ] **Step 2: Add scripts to `package.json`**

Add these keys to the existing `"scripts"` object, keeping `test`, `test:watch`, `typecheck` and `solve`:

```json
"dev": "vite",
"build": "tsc --noEmit && vite build",
"preview": "vite preview"
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        play: resolve(import.meta.dirname, 'play/index.html'),
      },
    },
  },
});
```

- [ ] **Step 4: Update `tsconfig.json` `include`**

Replace the `include` line with:

```json
"include": ["src", "tests", "tools", "vitest.config.ts", "vite.config.ts"]
```

- [ ] **Step 5: Create `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 6: Create `index.html`** (temporary; Plan 3 replaces it with the landing page)

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=play/" />
    <title>Afterlife</title>
  </head>
  <body>
    <a href="play/">Play Afterlife</a>
  </body>
</html>
```

- [ ] **Step 7: Create `play/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#23251f" />
    <meta name="description" content="Afterlife: a calm isometric game about nature reclaiming abandoned places." />
    <title>Afterlife</title>
  </head>
  <body>
    <div id="stage"></div>
    <div id="ui"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 8: Create `src/styles.css`**

```css
:root {
  --bg: #23251f;
  --panel: rgba(35, 37, 31, 0.84);
  --ink: #f1ede2;
  --muted: #b9b4a5;
  --accent: #9cc25a;
  --accent-ink: #1d2416;
  --radius: 14px;
  font-family: 'Nunito', system-ui, sans-serif;
  color: var(--ink);
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); overflow: hidden; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; }
#stage { position: fixed; inset: 0; }
#ui { position: fixed; inset: 0; pointer-events: none; }
#ui .screen, #ui .hud-top, #ui .tray, #ui .hud-tools, #ui .overlay { pointer-events: auto; }
button {
  font: inherit; color: inherit; background: var(--panel);
  border: 1px solid rgba(241, 237, 226, 0.18); border-radius: 999px;
  min-height: 44px; min-width: 44px; padding: 0 18px; cursor: pointer;
}
button:disabled { opacity: 0.4; cursor: default; }
button.primary, button.selected { background: var(--accent); color: var(--accent-ink); border-color: transparent; }
button:focus-visible, input:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
.screen { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 24px 16px; text-align: center; overflow-y: auto; }
.title-screen { background: linear-gradient(to bottom, rgba(35, 37, 31, 0.1), rgba(35, 37, 31, 0.8)); }
.select-screen, .settings-screen, .credits-screen { background: var(--bg); }
.logo { font-size: clamp(48px, 12vw, 96px); font-weight: 700; letter-spacing: 0.04em; margin: 0; }
.tagline { color: var(--muted); margin: 0; }
.menu { display: flex; flex-direction: column; gap: 12px; min-width: 220px; }
.level-grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; width: min(820px, 100%); }
.level-card { width: 100%; min-height: 120px; border-radius: var(--radius); display: flex; flex-direction: column; align-items: flex-start; justify-content: flex-end; gap: 2px; padding: 14px; background: #3a3a34; text-align: left; }
.level-card.completed { background: #46612f; }
.level-card .num { font-size: 28px; font-weight: 700; }
.level-card .status { color: var(--muted); font-size: 14px; }
.hud-top { position: absolute; top: max(12px, env(safe-area-inset-top)); left: 12px; right: 12px; display: flex; align-items: center; gap: 12px; }
.level-name { font-weight: 700; white-space: nowrap; }
.meter { flex: 1; height: 12px; min-width: 60px; background: rgba(241, 237, 226, 0.15); border-radius: 999px; overflow: hidden; }
.meter-fill { height: 100%; background: var(--accent); transition: width 0.4s ease; }
.batches { display: flex; gap: 4px; }
.batches i { display: block; width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
.hint { position: absolute; top: calc(max(12px, env(safe-area-inset-top)) + 58px); left: 0; right: 0; margin: 0 auto; width: fit-content; max-width: calc(100% - 32px); padding: 8px 14px; background: var(--panel); border-radius: 999px; font-size: 15px; }
.hud-tools { position: absolute; right: 12px; top: calc(max(12px, env(safe-area-inset-top)) + 110px); display: flex; flex-direction: column; gap: 8px; }
.hud-tools button { padding: 0; }
.tray { position: absolute; left: 0; right: 0; bottom: 0; display: flex; gap: 8px; overflow-x: auto; padding: 12px 12px max(12px, env(safe-area-inset-bottom)); background: linear-gradient(to top, rgba(35, 37, 31, 0.92), transparent); }
.tray .group-label { flex: none; align-self: center; color: var(--muted); font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; }
.tray button { flex: none; display: flex; align-items: center; gap: 8px; }
.swatch { display: inline-block; width: 14px; height: 14px; border-radius: 50%; }
.count { font-weight: 700; }
.overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 24px 16px; background: rgba(35, 37, 31, 0.62); text-align: center; }
.overlay h2 { font-size: 32px; margin: 0; }
.overlay .actions { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.toggle { display: flex; gap: 10px; align-items: center; font-size: 18px; }
.toggle input { width: 22px; height: 22px; }
@media (prefers-reduced-motion: reduce) { .meter-fill { transition: none; } }
```

- [ ] **Step 9: Create the smoke `src/main.ts`** (Task 8 replaces it)

```ts
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import './styles.css';
import Phaser from 'phaser';

class Smoke extends Phaser.Scene {
  create(): void {
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'Afterlife', { fontFamily: 'Nunito', fontSize: '48px', color: '#f1ede2' }).setOrigin(0.5);
  }
}

new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'stage',
  backgroundColor: '#23251f',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [Smoke],
});
```

- [ ] **Step 10: Build**

Run: `npm run build 2>&1 | tail -15`
Expected: typecheck passes and Vite writes `dist/index.html`, `dist/play/index.html` and `dist/assets/*.js`. A chunk-size warning for Phaser is acceptable.

- [ ] **Step 11: Browser check**

Run `npm run dev` in the background, open `http://localhost:5173/play/` in Chrome (claude-in-chrome), and take a screenshot.
Expected: a dark full-window canvas with "Afterlife" centred, and no console errors (`read_console_messages` with pattern `error|Error`). Also open `http://localhost:5173/`, which must redirect to `/play/`. Stop the dev server afterwards.

- [ ] **Step 12: Run tests and commit**

Run: `npm test && npm run typecheck`
Expected: all 69 existing tests pass.

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html play src/vite-env.d.ts src/styles.css src/main.ts
git commit -m "chore: Vite + Phaser 4 app scaffold with game page"
```

---

### Task 2: Isometric projection

**Files:**
- Create: `src/render/iso/projection.ts`
- Test: `tests/render/projection.test.ts`

**Interfaces:**
- Consumes: `Pos` from `src/engine`
- Produces: `type Rotation = 0 | 1 | 2 | 3`; `interface IsoView { width; height; rotation: Rotation; tileW; tileH }`; `viewSize(v): { width; height }`; `toView(v, p): Pos`; `fromView(v, q): Pos`; `toScreen(v, p): { x; y }` (diamond centre); `toGrid(v, sx, sy): Pos | null`; `depth(v, p): number`; `sceneBounds(v): { width; height; centerX; centerY }`

- [ ] **Step 1: Write the failing test** at `tests/render/projection.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { depth, fromView, sceneBounds, toGrid, toScreen, toView, viewSize, type IsoView, type Rotation } from '../../src/render/iso/projection';

const ROTATIONS: Rotation[] = [0, 1, 2, 3];
const view = (rotation: Rotation, width = 3, height = 5): IsoView => ({ width, height, rotation, tileW: 64, tileH: 32 });
const allTiles = (w: number, h: number) => Array.from({ length: w * h }, (_, i) => ({ x: i % w, y: Math.floor(i / w) }));

describe('rotation', () => {
  it('rotation 0 is the identity', () => {
    expect(toView(view(0), { x: 2, y: 4 })).toEqual({ x: 2, y: 4 });
  });
  it('rotation 1 turns (x, y) into (height-1-y, x) and swaps dimensions', () => {
    expect(toView(view(1), { x: 0, y: 0 })).toEqual({ x: 4, y: 0 });
    expect(viewSize(view(1))).toEqual({ width: 5, height: 3 });
  });
  it('rotation 2 maps the first tile to the far corner', () => {
    expect(toView(view(2), { x: 0, y: 0 })).toEqual({ x: 2, y: 4 });
  });
  it('fromView inverts toView for every tile in every rotation', () => {
    for (const r of ROTATIONS) for (const p of allTiles(3, 5)) expect(fromView(view(r), toView(view(r), p))).toEqual(p);
  });
  it('maps tiles into the view rectangle without collisions', () => {
    for (const r of ROTATIONS) {
      const { width, height } = viewSize(view(r));
      const seen = new Set<string>();
      for (const p of allTiles(3, 5)) {
        const q = toView(view(r), p);
        expect(q.x >= 0 && q.x < width && q.y >= 0 && q.y < height).toBe(true);
        seen.add(`${q.x},${q.y}`);
      }
      expect(seen.size).toBe(15);
    }
  });
});

describe('screen', () => {
  it('places view (0,0) at the origin and steps by half a tile', () => {
    expect(toScreen(view(0), { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(toScreen(view(0), { x: 1, y: 0 })).toEqual({ x: 32, y: 16 });
    expect(toScreen(view(0), { x: 0, y: 1 })).toEqual({ x: -32, y: 16 });
  });
  it('toGrid inverts toScreen for every tile in every rotation, including off-centre points', () => {
    for (const r of ROTATIONS) {
      for (const p of allTiles(3, 5)) {
        const c = toScreen(view(r), p);
        expect(toGrid(view(r), c.x, c.y)).toEqual(p);
        expect(toGrid(view(r), c.x + 12, c.y + 4)).toEqual(p);
        expect(toGrid(view(r), c.x - 10, c.y - 5)).toEqual(p);
      }
    }
  });
  it('returns null outside the grid', () => {
    expect(toGrid(view(0), -500, -500)).toBeNull();
    expect(toGrid(view(0), 0, -40)).toBeNull();
  });
  it('depth grows toward the viewer', () => {
    expect(depth(view(0), { x: 1, y: 1 })).toBeGreaterThan(depth(view(0), { x: 0, y: 0 }));
  });
  it('sceneBounds spans every tile with room above for tall objects', () => {
    for (const r of ROTATIONS) {
      const b = sceneBounds(view(r));
      const left = b.centerX - b.width / 2;
      const top = b.centerY - b.height / 2;
      for (const p of allTiles(3, 5)) {
        const c = toScreen(view(r), p);
        expect(c.x - 32).toBeGreaterThanOrEqual(left - 0.001);
        expect(c.x + 32).toBeLessThanOrEqual(left + b.width + 0.001);
        expect(c.y - 16 - 60).toBeGreaterThanOrEqual(top - 0.001);
      }
    }
    expect(sceneBounds(view(0, 3, 2)).width).toBe(160);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/render/projection.test.ts`
Expected: FAIL, with a module-not-found error for `src/render/iso/projection`.

- [ ] **Step 3: Create `src/render/iso/projection.ts`**

```ts
import type { Pos } from '../../engine';

export type Rotation = 0 | 1 | 2 | 3;

export interface IsoView {
  width: number;
  height: number;
  rotation: Rotation;
  tileW: number;
  tileH: number;
}

/** Grid dimensions as seen after rotation. */
export function viewSize(v: IsoView): { width: number; height: number } {
  return v.rotation % 2 === 0 ? { width: v.width, height: v.height } : { width: v.height, height: v.width };
}

/** Grid position → rotated view position. Each quarter turn maps (x, y) to (h-1-y, x). */
export function toView(v: IsoView, p: Pos): Pos {
  let q = p;
  let h = v.height;
  let w = v.width;
  for (let i = 0; i < v.rotation; i++) {
    q = { x: h - 1 - q.y, y: q.x };
    [w, h] = [h, w];
  }
  return q;
}

/** Rotated view position → grid position. */
export function fromView(v: IsoView, q: Pos): Pos {
  let p = q;
  let { width: w, height: h } = viewSize(v);
  for (let i = 0; i < v.rotation; i++) {
    p = { x: p.y, y: w - 1 - p.x };
    [w, h] = [h, w];
  }
  return p;
}

/** Centre of the tile's diamond in world (pre-camera) pixels. */
export function toScreen(v: IsoView, p: Pos): { x: number; y: number } {
  const q = toView(v, p);
  return { x: (q.x - q.y) * (v.tileW / 2), y: (q.x + q.y) * (v.tileH / 2) };
}

/** World pixels → grid position of the diamond containing that point, or null. */
export function toGrid(v: IsoView, sx: number, sy: number): Pos | null {
  const a = sx / (v.tileW / 2);
  const b = sy / (v.tileH / 2);
  const q = { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
  const { width, height } = viewSize(v);
  if (q.x < 0 || q.y < 0 || q.x >= width || q.y >= height) return null;
  return fromView(v, q);
}

/** Painter's order: larger is nearer the viewer. */
export function depth(v: IsoView, p: Pos): number {
  const q = toView(v, p);
  return q.x + q.y;
}

const HEADROOM = 60;

export function sceneBounds(v: IsoView): { width: number; height: number; centerX: number; centerY: number } {
  const { width: w, height: h } = viewSize(v);
  const hw = v.tileW / 2;
  const hh = v.tileH / 2;
  const minX = -(h - 1) * hw - hw;
  const maxX = (w - 1) * hw + hw;
  const minY = -hh - HEADROOM;
  const maxY = (w - 1 + h - 1) * hh + hh + 8;
  return { width: maxX - minX, height: maxY - minY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/render/projection.test.ts && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/iso/projection.ts tests/render/projection.test.ts
git commit -m "feat(render): isometric projection with 4 rotations and picking"
```

---

### Task 3: Save data and level unlocking

**Files:**
- Create: `src/save/save.ts`, `src/app/progress.ts`
- Test: `tests/save/save.test.ts`, `tests/app/progress.test.ts`

**Interfaces:**
- Produces: `SAVE_KEY = 'afterlife.save.v1'`; `interface Settings { reducedMotion: boolean; muted: boolean; volume: number }`; `interface SaveData { version: 1; completed: string[]; settings: Settings }`; `type Store = Pick<Storage, 'getItem' | 'setItem'>`; `defaultSave(): SaveData`; `loadSave(store: Store | null): SaveData`; `writeSave(store: Store | null, data: SaveData): boolean`; `markCompleted(data, id): SaveData`; `safeStorage(): Store | null`. From progress: `type LevelStatus = 'locked' | 'open' | 'completed'`; `levelStatuses(ids: string[], completed: string[]): LevelStatus[]`.

- [ ] **Step 1: Write the failing tests**

`tests/save/save.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { defaultSave, loadSave, markCompleted, SAVE_KEY, writeSave, type Store } from '../../src/save/save';

const memoryStore = (initial: Record<string, string> = {}): Store & { data: Record<string, string> } => {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};
const throwingStore: Store = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
};

describe('save', () => {
  it('uses the agreed key', () => {
    expect(SAVE_KEY).toBe('afterlife.save.v1');
  });
  it('returns defaults when nothing is stored or storage is missing', () => {
    expect(loadSave(memoryStore())).toEqual(defaultSave());
    expect(loadSave(null)).toEqual(defaultSave());
  });
  it('round-trips through writeSave and loadSave', () => {
    const store = memoryStore();
    const data = { ...defaultSave(), completed: ['bus-stop'], settings: { reducedMotion: true, muted: true, volume: 0.3 } };
    expect(writeSave(store, data)).toBe(true);
    expect(loadSave(store)).toEqual(data);
  });
  it('loadSave survives corrupt JSON and throwing storage', () => {
    expect(loadSave(memoryStore({ [SAVE_KEY]: '{not json' }))).toEqual(defaultSave());
    expect(loadSave(memoryStore({ [SAVE_KEY]: '{"version":2}' }))).toEqual(defaultSave());
    expect(loadSave(throwingStore)).toEqual(defaultSave());
  });
  it('drops invalid fields but keeps valid ones', () => {
    const raw = JSON.stringify({ version: 1, completed: ['bus-stop', 7, null], settings: { reducedMotion: 'yes', muted: true, volume: 9 } });
    expect(loadSave(memoryStore({ [SAVE_KEY]: raw }))).toEqual({
      version: 1,
      completed: ['bus-stop'],
      settings: { reducedMotion: false, muted: true, volume: 0.8 },
    });
  });
  it('writeSave returns false when storage throws or is missing', () => {
    expect(writeSave(throwingStore, defaultSave())).toBe(false);
    expect(writeSave(null, defaultSave())).toBe(false);
  });
  it('markCompleted adds an id once', () => {
    const once = markCompleted(defaultSave(), 'bus-stop');
    expect(once.completed).toEqual(['bus-stop']);
    expect(markCompleted(once, 'bus-stop').completed).toEqual(['bus-stop']);
  });
});
```

`tests/app/progress.test.ts`:

```ts
import { expect, it } from 'vitest';
import { levelStatuses } from '../../src/app/progress';

const ids = ['a', 'b', 'c'];

it('opens only the first level at the start', () => {
  expect(levelStatuses(ids, [])).toEqual(['open', 'locked', 'locked']);
});
it('opens the level after each completed one', () => {
  expect(levelStatuses(ids, ['a'])).toEqual(['completed', 'open', 'locked']);
  expect(levelStatuses(ids, ['a', 'b', 'c'])).toEqual(['completed', 'completed', 'completed']);
});
it('ignores unknown ids', () => {
  expect(levelStatuses(ids, ['zzz'])).toEqual(['open', 'locked', 'locked']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/save tests/app`
Expected: FAIL, with module-not-found errors for `src/save/save` and `src/app/progress`.

- [ ] **Step 3: Create `src/save/save.ts`**

```ts
export const SAVE_KEY = 'afterlife.save.v1';

export interface Settings {
  reducedMotion: boolean;
  muted: boolean;
  volume: number;
}

export interface SaveData {
  version: 1;
  completed: string[];
  settings: Settings;
}

export type Store = Pick<Storage, 'getItem' | 'setItem'>;

export const defaultSave = (): SaveData => ({
  version: 1,
  completed: [],
  settings: { reducedMotion: false, muted: false, volume: 0.8 },
});

export function loadSave(store: Store | null): SaveData {
  const base = defaultSave();
  try {
    const raw = store?.getItem(SAVE_KEY);
    if (!raw) return base;
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (d?.version !== 1) return base;
    const s = (typeof d.settings === 'object' && d.settings !== null ? d.settings : {}) as Record<string, unknown>;
    return {
      version: 1,
      completed: Array.isArray(d.completed) ? d.completed.filter((x): x is string => typeof x === 'string') : [],
      settings: {
        reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : base.settings.reducedMotion,
        muted: typeof s.muted === 'boolean' ? s.muted : base.settings.muted,
        volume: typeof s.volume === 'number' && s.volume >= 0 && s.volume <= 1 ? s.volume : base.settings.volume,
      },
    };
  } catch {
    return base;
  }
}

export function writeSave(store: Store | null, data: SaveData): boolean {
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function markCompleted(data: SaveData, id: string): SaveData {
  return data.completed.includes(id) ? data : { ...data, completed: [...data.completed, id] };
}

/** The browser's localStorage if it is usable, otherwise null (private mode, blocked cookies). */
export function safeStorage(): Store | null {
  try {
    const s = window.localStorage;
    s.setItem('__afterlife_probe', '1');
    s.removeItem('__afterlife_probe');
    return s;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Create `src/app/progress.ts`**

```ts
export type LevelStatus = 'locked' | 'open' | 'completed';

/** Levels unlock in order: a level is open when it is the first or the one before it is completed. */
export function levelStatuses(ids: string[], completed: string[]): LevelStatus[] {
  return ids.map((id, i) => {
    if (completed.includes(id)) return 'completed';
    if (i === 0 || completed.includes(ids[i - 1]!)) return 'open';
    return 'locked';
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/save tests/app && npm run typecheck`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/save src/app/progress.ts tests/save tests/app
git commit -m "feat: safe save data and in-order level unlocking"
```

---

### Task 4: PlayController

**Files:**
- Create: `src/game/controller.ts`
- Test: `tests/game/controller.test.ts`

**Interfaces:**
- Consumes: `Session`, `placeSeed`, `placeScrap`, `previewScrap`, `coverage`, `isStuck`, `RADIUS`, `SCRAP` and types from `src/engine`; `Rotation` from `src/render/iso/projection`
- Produces:
  - `type Selection = { kind: 'seed'; plant: PlantType } | { kind: 'scrap'; slot: number } | null`
  - `interface Preview { tile: Pos; valid: boolean; ring: Pos[]; glowing: Pos[] }`
  - `type Overlay = 'none' | 'restored' | 'rests'`; `type InputKind = 'mouse' | 'touch'`
  - `interface View { state: GameState; selection: Selection; preview: Preview | null; rotation: Rotation; overlay: Overlay; canUndo: boolean; coverage: number; progress: number }`, where `progress` is coverage ÷ target, capped at 1
  - `class PlayController { constructor(level: LevelData); readonly level; view: View; onChange(fn: (view: View, events: GameEvent[]) => void): () => void; select(sel: Selection): void; hover(tile: Pos | null): void; tap(tile: Pos, input: InputKind): GameEvent[]; play(move: Move): GameEvent[]; undo(): void; restart(): void; rotate(dir: 1 | -1): void; keepDecorating(): void }`

- [ ] **Step 1: Write the failing test** at `tests/game/controller.test.ts`

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/game/controller.test.ts`
Expected: FAIL, with a module-not-found error for `src/game/controller`.

- [ ] **Step 3: Create `src/game/controller.ts`**

```ts
import {
  coverage,
  isStuck,
  placeScrap,
  placeSeed,
  previewScrap,
  RADIUS,
  SCRAP,
  Session,
  type GameEvent,
  type GameState,
  type LevelData,
  type Move,
  type PlantType,
  type Pos,
} from '../engine';
import type { Rotation } from '../render/iso/projection';

export type Selection = { kind: 'seed'; plant: PlantType } | { kind: 'scrap'; slot: number } | null;
export interface Preview {
  tile: Pos;
  valid: boolean;
  ring: Pos[];
  glowing: Pos[];
}
export type Overlay = 'none' | 'restored' | 'rests';
export type InputKind = 'mouse' | 'touch';
export interface View {
  state: GameState;
  selection: Selection;
  preview: Preview | null;
  rotation: Rotation;
  overlay: Overlay;
  canUndo: boolean;
  coverage: number;
  progress: number;
}
type Listener = (view: View, events: GameEvent[]) => void;

const samePos = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
const inGrid = (s: GameState, p: Pos) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height;

/** Turns player input into engine moves and decides what the screen should show. No rendering here. */
export class PlayController {
  private readonly session: Session;
  private selection: Selection = null;
  private preview: Preview | null = null;
  private rotation: Rotation = 0;
  private overlay: Overlay = 'none';
  private listeners: Listener[] = [];

  constructor(readonly level: LevelData) {
    this.session = new Session(level);
  }

  get view(): View {
    const state = this.session.state;
    const c = coverage(state);
    return {
      state,
      selection: this.selection,
      preview: this.preview,
      rotation: this.rotation,
      overlay: this.overlay,
      canUndo: this.session.canUndo,
      coverage: c,
      progress: Math.min(1, c / state.target),
    };
  }

  onChange(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  select(sel: Selection): void {
    const s = this.session.state;
    if (sel?.kind === 'seed' && !(s.seeds[sel.plant] > 0)) return;
    if (sel?.kind === 'scrap' && s.tray[sel.slot] === undefined) return;
    const same = sel !== null && JSON.stringify(sel) === JSON.stringify(this.selection);
    this.selection = same ? null : sel;
    this.refreshPreview();
    this.emit([]);
  }

  hover(tile: Pos | null): void {
    const next = tile ? this.computePreview(tile) : null;
    if (JSON.stringify(next) === JSON.stringify(this.preview)) return;
    this.preview = next;
    this.emit([]);
  }

  tap(tile: Pos, input: InputKind): GameEvent[] {
    if (this.overlay !== 'none') return [];
    const s = this.session.state;
    if (!inGrid(s, tile)) return [];
    if (s.tiles[tile.y * s.width + tile.x]!.plant?.bloom) return this.play({ type: 'harvest', ...tile });
    const sel = this.selection;
    if (!sel) return [];
    if (input === 'touch' && !(this.preview && samePos(this.preview.tile, tile))) {
      this.preview = this.computePreview(tile);
      this.emit([]);
      return [];
    }
    return this.play(sel.kind === 'seed' ? { type: 'seed', plant: sel.plant, ...tile } : { type: 'scrap', slot: sel.slot, ...tile });
  }

  /** Applies a move directly (taps, the title-screen demo and solution replays use this). */
  play(move: Move): GameEvent[] {
    const wasStuck = isStuck(this.session.state);
    const result = this.session.apply(move);
    if (!result.ok) return [];
    this.settleSelection();
    if (result.events.some((e) => e.type === 'won')) this.overlay = 'restored';
    else if (!wasStuck && isStuck(this.session.state)) this.overlay = 'rests';
    this.refreshPreview();
    this.emit(result.events);
    return result.events;
  }

  undo(): void {
    if (!this.session.undo()) return;
    this.overlay = 'none';
    this.settleSelection();
    this.refreshPreview();
    this.emit([]);
  }

  restart(): void {
    this.session.restart();
    this.selection = null;
    this.preview = null;
    this.overlay = 'none';
    this.emit([]);
  }

  rotate(dir: 1 | -1): void {
    this.rotation = ((this.rotation + dir + 4) % 4) as Rotation;
    this.emit([]);
  }

  keepDecorating(): void {
    if (this.overlay !== 'restored') return;
    this.overlay = 'none';
    this.emit([]);
  }

  private settleSelection(): void {
    const s = this.session.state;
    const sel = this.selection;
    if (sel?.kind === 'seed' && !(s.seeds[sel.plant] > 0)) this.selection = null;
    if (sel?.kind === 'scrap') this.selection = s.tray.length > 0 ? { kind: 'scrap', slot: Math.min(sel.slot, s.tray.length - 1) } : null;
  }

  private refreshPreview(): void {
    this.preview = this.preview ? this.computePreview(this.preview.tile) : null;
  }

  private computePreview(tile: Pos): Preview | null {
    const s = this.session.state;
    const sel = this.selection;
    if (!sel || !inGrid(s, tile)) return null;
    if (sel.kind === 'seed') return { tile, valid: placeSeed(s, sel.plant, tile).ok, ring: [], glowing: [] };
    const kind = s.tray[sel.slot];
    if (kind === undefined) return null;
    const radius = RADIUS[SCRAP[kind].size];
    const ring: Pos[] = [];
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        if (Math.abs(x - tile.x) + Math.abs(y - tile.y) <= radius && s.tiles[y * s.width + x]!.ground !== 'blocked') ring.push({ x, y });
      }
    }
    const valid = placeScrap(s, sel.slot, tile).ok;
    return { tile, valid, ring, glowing: valid ? previewScrap(s, sel.slot, tile) : [] };
  }

  private emit(events: GameEvent[]): void {
    const view = this.view;
    for (const l of this.listeners) l(view, events);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/game && npm run typecheck`
Expected: all PASS. In the bloom test, the flower at (2,2) gets one tick from each of the 4 cars: stage 1, 2, 3, then a bloom.

- [ ] **Step 5: Commit**

```bash
git add src/game tests/game
git commit -m "feat(game): PlayController for selection, preview, taps and overlays"
```

---

### Task 5: Palette, object shapes and plant shapes

**Files:**
- Create: `src/render/palette.ts`, `src/render/objects/objectShapes.ts`, `src/render/plants/plantShapes.ts`
- Modify: `src/engine/index.ts` (export `nextRandom`)
- Test: `tests/render/shapes.test.ts`

**Interfaces:**
- Consumes: `nextRandom`, `PlantType`, `SCRAP_KINDS` from `src/engine`; `Rotation`; `LEVELS`
- Produces:
  - palette: `PALETTE`, `lerpColor(a, b, t)`, `lighten(c, amount)`, `darken(c, amount)`
  - objects: `type Block` (box | cylinder | cone, positions in tile units, heights in px); `OBJECTS: Record<string, Block[]>`; `hasObjectShape(name): boolean`; `objectBlocks(name, rotation): Block[]` (unknown names fall back to `crate`); `rotateBlock(b, rotation): Block`; `objectTopHeight(name): number`
  - plants: `type Prim = ellipse | circle | line`; `interface PlantDrawInput { type; stage; bloom; plantId; x; y; objectHeight }`; `plantPrims(p): Prim[]`, with coordinates in px relative to the tile's diamond centre at ground level

- [ ] **Step 1: Export `nextRandom` from the engine**

In `src/engine/index.ts`, add the line:

```ts
export { nextRandom } from './rng';
```

- [ ] **Step 2: Write the failing test** at `tests/render/shapes.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { SCRAP_KINDS } from '../../src/engine';
import { LEVELS } from '../../src/levels';
import { darken, lerpColor, lighten } from '../../src/render/palette';
import { hasObjectShape, objectBlocks, objectTopHeight, OBJECTS, rotateBlock } from '../../src/render/objects/objectShapes';
import { plantPrims, type PlantDrawInput, type Prim } from '../../src/render/plants/plantShapes';

describe('palette', () => {
  it('lerps channels and clamps t', () => {
    expect(lerpColor(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(lerpColor(0x102030, 0xffffff, -1)).toBe(0x102030);
    expect(lerpColor(0x102030, 0xffffff, 2)).toBe(0xffffff);
  });
  it('lightens and darkens', () => {
    expect(lighten(0x808080, 0.5)).toBe(0xc0c0c0);
    expect(darken(0x808080, 0.5)).toBe(0x404040);
  });
});

describe('object shapes', () => {
  it('has a shape for every scrap kind and every ruin used by the levels', () => {
    for (const kind of SCRAP_KINDS) expect(hasObjectShape(kind), kind).toBe(true);
    for (const level of LEVELS) for (const ruin of level.ruins) expect(hasObjectShape(ruin.name), ruin.name).toBe(true);
  });
  it('falls back to a crate for unknown names', () => {
    expect(objectBlocks('piano', 0)).toEqual(OBJECTS.crate);
  });
  it('rotating a quarter turn moves offsets and swaps box footprints; four turns is identity', () => {
    const b = { shape: 'box' as const, x: 0.3, y: 0.1, w: 0.8, d: 0.2, z: 0, h: 5, color: 1 };
    expect(rotateBlock(b, 1)).toEqual({ ...b, x: -0.1, y: 0.3, w: 0.2, d: 0.8 });
    let r = b;
    for (let i = 0; i < 4; i++) r = rotateBlock(r, 1);
    expect(r.x).toBeCloseTo(b.x);
    expect(r.y).toBeCloseTo(b.y);
    expect(r).toMatchObject({ w: b.w, d: b.d });
  });
  it('reports the top height of an object', () => {
    expect(objectTopHeight('crate')).toBeGreaterThan(10);
    expect(objectTopHeight('swings')).toBeGreaterThan(objectTopHeight('tyre'));
  });
});

const input = (over: Partial<PlantDrawInput> = {}): PlantDrawInput => ({ type: 'moss', stage: 1, bloom: false, plantId: 3, x: 2, y: 2, objectHeight: 0, ...over });
const minY = (prims: Prim[]) =>
  Math.min(...prims.map((p) => (p.kind === 'ellipse' ? p.y - p.h / 2 : p.kind === 'circle' ? p.y - p.r : Math.min(...p.points.filter((_, i) => i % 2 === 1)))));

describe('plant shapes', () => {
  it('draws a single seed mound at stage 0', () => {
    expect(plantPrims(input({ stage: 0 }))).toHaveLength(1);
  });
  it('is deterministic per plant and position', () => {
    expect(plantPrims(input({ type: 'vine', stage: 2 }))).toEqual(plantPrims(input({ type: 'vine', stage: 2 })));
    expect(plantPrims(input({ stage: 2, x: 1 }))).not.toEqual(plantPrims(input({ stage: 2, x: 3 })));
  });
  it('grows fuller moss with stage', () => {
    expect(plantPrims(input({ stage: 2 })).length).toBeGreaterThan(plantPrims(input({ stage: 1 })).length);
  });
  it('adds petals when a flower blooms', () => {
    const bud = plantPrims(input({ type: 'flower', stage: 3 }));
    const bloom = plantPrims(input({ type: 'flower', stage: 3, bloom: true }));
    expect(bloom.length).toBeGreaterThanOrEqual(bud.length + 6);
  });
  it('grows taller bamboo with stage', () => {
    expect(minY(plantPrims(input({ type: 'bamboo', stage: 5 })))).toBeLessThan(minY(plantPrims(input({ type: 'bamboo', stage: 1 }))));
  });
  it('vines climb objects they grow on', () => {
    expect(minY(plantPrims(input({ type: 'vine', stage: 3, objectHeight: 24 })))).toBeLessThan(-24 * 0.4);
  });
  it('produces only finite numbers', () => {
    for (const type of ['moss', 'vine', 'flower', 'bamboo'] as const) {
      for (let stage = 0; stage <= 5; stage++) {
        const json = JSON.stringify(plantPrims(input({ type, stage, bloom: stage === 3, objectHeight: stage * 4 })));
        expect(json).not.toMatch(/null|NaN|Infinity/);
      }
    }
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/render/shapes.test.ts`
Expected: FAIL, with a module-not-found error for `src/render/palette`.

- [ ] **Step 4: Create `src/render/palette.ts`**

```ts
export const PALETTE = {
  bg: 0x23251f,
  soilDry: 0x6b5f52,
  soilLush: 0x56492f,
  concreteDry: 0x8a8a84,
  concreteLush: 0x7b836c,
  wall: 0x55534c,
  ring: 0xf4f1e4,
  invalid: 0xd9534f,
  glow: 0xfff3b0,
  seed: 0x5b4632,
  stem: 0x4a6b2a,
  leaf: 0x4f8a3c,
  moss: [0x6f8f3a, 0x89a94a, 0x5d7a2f],
  vine: [0x3f7a3a, 0x58934a],
  bamboo: [0x9fb85a, 0x86a046],
  bambooNode: 0x5f7430,
  petal: [0xe89ab0, 0xf2c14e, 0xc7a6e8],
  flowerCentre: 0xf6e7a8,
  bud: 0x7aa04a,
  rubber: 0x2e2c2a,
  rubberDark: 0x1b1a19,
  metal: 0x8b979c,
  metalDark: 0x5a6468,
  rust: 0x9a5b3c,
  rustDark: 0x6e3f2a,
  wood: 0x8c6a48,
  woodDark: 0x6b4f35,
  paint: 0xb8a24a,
  paintBlue: 0x4f6f8f,
  paintRed: 0xa84a3c,
  white: 0xcfcac0,
  orange: 0xd9773a,
  sand: 0xd8c48f,
} as const;

const channels = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255] as const;
const pack = (r: number, g: number, b: number) => (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export function lerpColor(a: number, b: number, t: number): number {
  const k = clamp01(t);
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return pack(ar + (br - ar) * k, ag + (bg - ag) * k, ab + (bb - ab) * k);
}

export const lighten = (c: number, amount: number): number => lerpColor(c, 0xffffff, amount);
export const darken = (c: number, amount: number): number => lerpColor(c, 0x000000, amount);
```

- [ ] **Step 5: Create `src/render/objects/objectShapes.ts`**

```ts
import { PALETTE as C } from '../palette';
import type { Rotation } from '../iso/projection';

/** x, y: offset from the tile centre in tile units (-0.5..0.5). w, d, r: tile units. z, h: pixels. */
export type Block =
  | { shape: 'box'; x: number; y: number; w: number; d: number; z: number; h: number; color: number }
  | { shape: 'cylinder'; x: number; y: number; r: number; z: number; h: number; color: number }
  | { shape: 'cone'; x: number; y: number; r: number; z: number; h: number; color: number };

const box = (x: number, y: number, w: number, d: number, z: number, h: number, color: number): Block => ({ shape: 'box', x, y, w, d, z, h, color });
const cyl = (x: number, y: number, r: number, z: number, h: number, color: number): Block => ({ shape: 'cylinder', x, y, r, z, h, color });
const cone = (x: number, y: number, r: number, z: number, h: number, color: number): Block => ({ shape: 'cone', x, y, r, z, h, color });
const legs = (s: number, h: number) => [box(-s, -s, 0.06, 0.06, 0, h, C.metalDark), box(s, -s, 0.06, 0.06, 0, h, C.metalDark), box(-s, s, 0.06, 0.06, 0, h, C.metalDark), box(s, s, 0.06, 0.06, 0, h, C.metalDark)];

export const OBJECTS: Record<string, Block[]> = {
  // scrap
  tyre: [cyl(0, 0, 0.26, 0, 9, C.rubber), cyl(0, 0, 0.11, 0, 10, C.rubberDark)],
  can: [cyl(0, 0, 0.09, 0, 11, C.metal)],
  cone: [box(0, 0, 0.42, 0.42, 0, 3, C.orange), cone(0, 0, 0.17, 3, 20, C.orange)],
  crate: [box(0, 0, 0.56, 0.56, 0, 18, C.wood), box(0, 0, 0.6, 0.6, 18, 3, C.woodDark)],
  barrel: [cyl(0, 0, 0.22, 0, 26, C.rust), cyl(0, 0, 0.225, 8, 2, C.rustDark), cyl(0, 0, 0.225, 17, 2, C.rustDark)],
  sign: [box(0, 0, 0.06, 0.06, 0, 30, C.metalDark), box(0, 0, 0.5, 0.06, 26, 16, C.paint)],
  car: [box(0, 0, 0.9, 0.5, 2, 12, C.rust), box(-0.08, 0, 0.48, 0.44, 14, 10, C.rustDark), cyl(0.28, 0.24, 0.08, 0, 6, C.rubber), cyl(-0.28, 0.24, 0.08, 0, 6, C.rubber)],
  // ruins
  bench: [box(-0.34, 0, 0.05, 0.22, 0, 8, C.metalDark), box(0.34, 0, 0.05, 0.22, 0, 8, C.metalDark), box(0, 0, 0.8, 0.26, 8, 3, C.wood), box(0, -0.12, 0.8, 0.05, 11, 9, C.wood)],
  bin: [cyl(0, 0, 0.18, 0, 20, C.metalDark), cyl(0, 0, 0.2, 20, 3, C.metal)],
  'water-tank': [...legs(0.25, 12), cyl(0, 0, 0.38, 12, 26, C.metal), cyl(0, 0, 0.3, 38, 3, C.metalDark)],
  'ac-unit': [box(0, 0, 0.7, 0.5, 0, 22, C.white), box(0, 0.26, 0.5, 0.02, 4, 14, C.metalDark)],
  pump: [box(0, 0, 0.4, 0.3, 0, 32, C.paint), box(0, 0.16, 0.2, 0.02, 14, 10, C.white), box(0, 0, 0.46, 0.36, 32, 4, C.rustDark)],
  'old-car': [box(0, 0, 0.95, 0.55, 2, 13, C.rust), box(0.05, 0, 0.5, 0.48, 15, 11, C.rustDark), cyl(0.3, 0.27, 0.09, 0, 7, C.rubber), cyl(-0.3, 0.27, 0.09, 0, 7, C.rubber)],
  'station-sign': [box(-0.35, 0, 0.05, 0.05, 0, 34, C.metalDark), box(0.35, 0, 0.05, 0.05, 0, 34, C.metalDark), box(0, 0, 0.85, 0.05, 26, 12, C.paintBlue)],
  slide: [box(-0.28, 0, 0.3, 0.3, 0, 30, C.paintRed), box(0.18, 0, 0.6, 0.22, 0, 10, C.metal)],
  swings: [box(-0.4, 0, 0.05, 0.05, 0, 36, C.metalDark), box(0.4, 0, 0.05, 0.05, 0, 36, C.metalDark), box(0, 0, 0.85, 0.05, 36, 3, C.metalDark), box(-0.15, 0, 0.14, 0.12, 10, 2, C.wood), box(0.15, 0, 0.14, 0.12, 10, 2, C.wood)],
  roundabout: [cyl(0, 0, 0.42, 0, 5, C.paintRed), cyl(0, 0, 0.05, 5, 12, C.metal)],
  sandpit: [box(0, 0, 0.9, 0.9, 0, 4, C.wood), box(0, 0, 0.78, 0.78, 0, 5, C.sand)],
};

export const hasObjectShape = (name: string): boolean => Object.hasOwn(OBJECTS, name);

/** A quarter turn maps offset (x, y) to (-y, x), matching the grid's view rotation; boxes swap footprint. */
export function rotateBlock(b: Block, rotation: Rotation | number): Block {
  let r = b;
  for (let i = 0; i < rotation; i++) {
    r = r.shape === 'box' ? { ...r, x: -r.y, y: r.x, w: r.d, d: r.w } : { ...r, x: -r.y, y: r.x };
  }
  return r;
}

export function objectBlocks(name: string, rotation: Rotation): Block[] {
  const blocks = hasObjectShape(name) ? OBJECTS[name]! : OBJECTS.crate!;
  return blocks.map((b) => rotateBlock(b, rotation));
}

export function objectTopHeight(name: string): number {
  return Math.max(...(hasObjectShape(name) ? OBJECTS[name]! : OBJECTS.crate!).map((b) => b.z + b.h));
}
```

- [ ] **Step 6: Create `src/render/plants/plantShapes.ts`**

```ts
import { nextRandom, type PlantType } from '../../engine';
import { PALETTE } from '../palette';

export type Prim =
  | { kind: 'ellipse'; x: number; y: number; w: number; h: number; color: number }
  | { kind: 'circle'; x: number; y: number; r: number; color: number }
  | { kind: 'line'; points: number[]; width: number; color: number };

export interface PlantDrawInput {
  type: PlantType;
  stage: number;
  bloom: boolean;
  plantId: number;
  x: number;
  y: number;
  /** Height in px of the object this cell sits on (0 on bare ground). */
  objectHeight: number;
}

const HW = 32;
const HH = 16;
type Rand = () => number;

function rand(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    const [v, next] = nextRandom(s);
    s = next;
    return v;
  };
}
const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

/** A random point inside the tile diamond, scaled toward the centre by `scale`. */
function inDiamond(r: Rand, scale: number): { x: number; y: number } {
  const u = r() * 2 - 1;
  const v = (r() * 2 - 1) * (1 - Math.abs(u));
  return { x: u * HW * scale, y: v * HH * scale };
}

function moss(p: PlantDrawInput, r: Rand, base: number): Prim[] {
  const out: Prim[] = [];
  const n = 3 + p.stage * 4;
  for (let i = 0; i < n; i++) {
    const q = inDiamond(r, p.objectHeight > 0 ? 0.45 : 0.85);
    const w = 6 + r() * 8;
    out.push({ kind: 'ellipse', x: q.x, y: base + q.y, w, h: w * 0.55, color: pick(r, PALETTE.moss) });
  }
  return out;
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
    for (let k = 1; k <= 5; k += 2) out.push({ kind: 'ellipse', x: points[k * 2]!, y: points[k * 2 + 1]!, w: 7, h: 4, color: pick(r, PALETTE.vine) });
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
    { kind: 'ellipse', x: x + 4, y: base - h * 0.6, w: 8, h: 4, color: PALETTE.leaf },
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
  }
  return out;
}

/** Drawing primitives for one plant cell, in px relative to the tile's diamond centre at ground level. */
export function plantPrims(p: PlantDrawInput): Prim[] {
  const r = rand(p.plantId * 7919 + p.x * 131 + p.y * 17 + 1);
  const base = -p.objectHeight;
  if (p.stage === 0) return [{ kind: 'ellipse', x: 0, y: base, w: 10, h: 5, color: PALETTE.seed }];
  switch (p.type) {
    case 'moss':
      return moss(p, r, base);
    case 'vine':
      return vine(p, r);
    case 'flower':
      return flower(p, r, base);
    case 'bamboo':
      return bamboo(p, r, base);
  }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/render && npm run typecheck`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add src/engine/index.ts src/render/palette.ts src/render/objects/objectShapes.ts src/render/plants/plantShapes.ts tests/render/shapes.test.ts
git commit -m "feat(render): palette, low-poly object shapes and seeded plant shapes"
```

---

### Task 6: Diorama scene (Phaser)

**Files:**
- Create: `src/render/objects/objectArt.ts`, `src/render/plants/plantArt.ts`, `src/render/scene/DioramaScene.ts`
- Modify: `src/main.ts` (temporary dev harness; Task 8 replaces it)

**Interfaces:**
- Consumes: `PlayController`, `View` (Task 4); projection (Task 2); shapes and palette (Task 5); `cellStatus` from the engine
- Produces: `interface ObjectArt { create(scene, x, y, name, rotation): Phaser.GameObjects.GameObject; topHeight(name): number }` and `codeObjectArt`; `drawPrims(g, prims)`; `class DioramaScene extends Phaser.Scene` with `attach(ctrl: PlayController | null, opts: AttachOptions): void`, where `interface AttachOptions { reducedMotion: boolean; interactive: boolean }`; and the constants `TILE_W = 64`, `TILE_H = 32`

Phaser drawing has no unit tests; correctness here is checked in the browser in Step 6. The logic it relies on (picking, shapes, controller) is already unit-tested.

- [ ] **Step 1: Create `src/render/plants/plantArt.ts`**

```ts
import type Phaser from 'phaser';
import type { Prim } from './plantShapes';

export function drawPrims(g: Phaser.GameObjects.Graphics, prims: Prim[]): void {
  for (const p of prims) {
    if (p.kind === 'ellipse') {
      g.fillStyle(p.color, 1).fillEllipse(p.x, p.y, p.w, p.h);
    } else if (p.kind === 'circle') {
      g.fillStyle(p.color, 1).fillCircle(p.x, p.y, p.r);
    } else {
      g.lineStyle(p.width, p.color, 1).beginPath();
      g.moveTo(p.points[0]!, p.points[1]!);
      for (let i = 2; i < p.points.length; i += 2) g.lineTo(p.points[i]!, p.points[i + 1]!);
      g.strokePath();
    }
  }
}
```

- [ ] **Step 2: Create `src/render/objects/objectArt.ts`**

```ts
import Phaser from 'phaser';
import type { Rotation } from '../iso/projection';
import { darken, lighten } from '../palette';
import { objectBlocks, objectTopHeight, type Block } from './objectShapes';

/** How ruins and scrap are drawn. Plan 3 swaps in a sprite-based implementation. */
export interface ObjectArt {
  create(scene: Phaser.Scene, x: number, y: number, name: string, rotation: Rotation): Phaser.GameObjects.GameObject;
  topHeight(name: string): number;
}

const HW = 32;
const HH = 16;
const iso = (gx: number, gy: number, z: number) => ({ x: (gx - gy) * HW, y: (gx + gy) * HH - z });

export function drawBlock(g: Phaser.GameObjects.Graphics, b: Block): void {
  if (b.shape === 'box') {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.d / 2, y1 = b.y + b.d / 2;
    const top = b.z + b.h;
    g.fillStyle(b.color, 1).fillPoints([iso(x0, y1, b.z), iso(x1, y1, b.z), iso(x1, y1, top), iso(x0, y1, top)], true);
    g.fillStyle(darken(b.color, 0.22), 1).fillPoints([iso(x1, y0, b.z), iso(x1, y1, b.z), iso(x1, y1, top), iso(x1, y0, top)], true);
    g.fillStyle(lighten(b.color, 0.15), 1).fillPoints([iso(x0, y0, top), iso(x1, y0, top), iso(x1, y1, top), iso(x0, y1, top)], true);
    return;
  }
  const c = iso(b.x, b.y, 0);
  const rx = b.r * HW * Math.SQRT2;
  const ry = b.r * HH * Math.SQRT2;
  if (b.shape === 'cylinder') {
    g.fillStyle(darken(b.color, 0.15), 1).fillEllipse(c.x, c.y - b.z, rx * 2, ry * 2);
    g.fillStyle(b.color, 1).fillRect(c.x - rx, c.y - b.z - b.h, rx * 2, b.h);
    g.fillStyle(lighten(b.color, 0.15), 1).fillEllipse(c.x, c.y - b.z - b.h, rx * 2, ry * 2);
    return;
  }
  g.fillStyle(darken(b.color, 0.15), 1).fillEllipse(c.x, c.y - b.z, rx * 2, ry * 2);
  g.fillStyle(b.color, 1).fillTriangle(c.x - rx, c.y - b.z, c.x + rx, c.y - b.z, c.x, c.y - b.z - b.h);
}

export const codeObjectArt: ObjectArt = {
  create(scene, x, y, name, rotation) {
    const g = scene.add.graphics({ x, y });
    const blocks = objectBlocks(name, rotation).sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z);
    for (const b of blocks) drawBlock(g, b);
    return g;
  },
  topHeight: objectTopHeight,
};
```

- [ ] **Step 3: Create `src/render/scene/DioramaScene.ts`**

```ts
import Phaser from 'phaser';
import { cellStatus, type GameEvent, type Pos } from '../../engine';
import type { PlayController, View } from '../../game/controller';
import { depth, sceneBounds, toGrid, toScreen, type IsoView, type Rotation } from '../iso/projection';
import { codeObjectArt, drawBlock, type ObjectArt } from '../objects/objectArt';
import { darken, lerpColor, PALETTE } from '../palette';
import { drawPrims } from '../plants/plantArt';
import { plantPrims } from '../plants/plantShapes';

export const TILE_W = 64;
export const TILE_H = 32;
const HW = TILE_W / 2;
const HH = TILE_H / 2;
const SLAB = 6;
const HUD_SPACE = 180;
const STATUS_GLYPH = { growing: '↑', grown: '✿', blocked: '×' } as const;

export interface AttachOptions {
  reducedMotion: boolean;
  interactive: boolean;
}

const key = (p: Pos) => `${p.x},${p.y}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const DIAMOND = [{ x: 0, y: -HH }, { x: HW, y: 0 }, { x: 0, y: HH }, { x: -HW, y: 0 }];

function drawGround(g: Phaser.GameObjects.Graphics, ground: 'soil' | 'concrete', progress: number): void {
  const top = ground === 'soil' ? lerpColor(PALETTE.soilDry, PALETTE.soilLush, progress) : lerpColor(PALETTE.concreteDry, PALETTE.concreteLush, progress);
  g.fillStyle(darken(top, 0.25), 1).fillPoints([{ x: -HW, y: 0 }, { x: 0, y: HH }, { x: 0, y: HH + SLAB }, { x: -HW, y: SLAB }], true);
  g.fillStyle(darken(top, 0.4), 1).fillPoints([{ x: 0, y: HH }, { x: HW, y: 0 }, { x: HW, y: SLAB }, { x: 0, y: HH + SLAB }], true);
  g.fillStyle(top, 1).fillPoints(DIAMOND, true);
  g.lineStyle(1, darken(top, 0.15), 0.6).strokePoints(DIAMOND, true);
}

export class DioramaScene extends Phaser.Scene {
  private ctrl: PlayController | null = null;
  private opts: AttachOptions = { reducedMotion: false, interactive: true };
  private unsubscribe: (() => void) | null = null;
  private layer!: Phaser.GameObjects.Container;
  private ready = false;
  private pending: { ctrl: PlayController | null; opts: AttachOptions } | null = null;
  private pinch: { dist: number; zoom: number } | null = null;
  private turning = false;
  private lastRotation: Rotation = 0;
  private readonly art: ObjectArt = codeObjectArt;

  constructor() {
    super('diorama');
  }

  create(): void {
    this.layer = this.add.container(0, 0);
    this.input.mouse?.disableContextMenu();
    this.input.addPointer(1);
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
    this.turning = false;
    this.layer.removeAll(true);
    if (!ctrl) return;
    this.lastRotation = ctrl.view.rotation;
    this.unsubscribe = ctrl.onChange((view, events) => this.onChange(view, events));
    this.redraw(ctrl.view, []);
    this.fit();
  }

  private isoOf(view: View): IsoView {
    return { width: view.state.width, height: view.state.height, rotation: view.rotation, tileW: TILE_W, tileH: TILE_H };
  }

  private onChange(view: View, events: GameEvent[]): void {
    this.redraw(view, events);
    if (view.rotation !== this.lastRotation) {
      this.lastRotation = view.rotation;
      this.fit();
    }
    if (events.some((e) => e.type === 'won') && this.opts.interactive && !this.opts.reducedMotion) this.celebrate();
  }

  private celebrate(): void {
    this.cameras.main.flash(700, 255, 248, 225);
    this.turning = true;
    for (let i = 1; i <= 4; i++) this.time.delayedCall(450 * i, () => this.ctrl?.rotate(1));
    this.time.delayedCall(450 * 4 + 50, () => (this.turning = false));
  }

  fit(): void {
    if (!this.ctrl) return;
    const b = sceneBounds(this.isoOf(this.ctrl.view));
    const cam = this.cameras.main;
    const zoom = clamp(Math.min(this.scale.width / (b.width + 96), (this.scale.height - HUD_SPACE) / (b.height + 40)), 0.5, 2.5);
    cam.setZoom(zoom);
    cam.centerOn(b.centerX, b.centerY - 10 / zoom);
  }

  private zoomBy(f: number): void {
    const cam = this.cameras.main;
    cam.setZoom(clamp(cam.zoom * f, 0.5, 3));
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
      const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      if (!this.pinch) this.pinch = { dist: d, zoom: this.cameras.main.zoom };
      else this.cameras.main.setZoom(clamp((this.pinch.zoom * d) / this.pinch.dist, 0.5, 3));
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
    if (!this.ctrl || !this.opts.interactive || this.turning) return;
    if (this.pinch) {
      if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) this.pinch = null;
      return;
    }
    if (p.rightButtonReleased()) {
      this.ctrl.select(null);
      return;
    }
    const tile = this.pick(p);
    if (tile) this.ctrl.tap(tile, p.wasTouch ? 'touch' : 'mouse');
  }

  private redraw(view: View, events: GameEvent[]): void {
    this.layer.removeAll(true);
    const v = this.isoOf(view);
    const s = view.state;
    const changed = new Set<string>();
    for (const e of events) {
      if ('pos' in e) changed.add(key(e.pos));
      if (e.type === 'spread') changed.add(key(e.to));
    }
    const ring = new Set((view.preview?.ring ?? []).map(key));
    const glow = new Set((view.preview?.glowing ?? []).map(key));
    const showStatus = view.selection?.kind === 'scrap';
    const tiles: Pos[] = [];
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) tiles.push({ x, y });
    tiles.sort((a, b) => depth(v, a) - depth(v, b));

    for (const p of tiles) {
      const t = s.tiles[p.y * s.width + p.x]!;
      const c = toScreen(v, p);
      const g = this.add.graphics({ x: c.x, y: c.y });
      this.layer.add(g);
      if (t.ground === 'blocked') {
        drawBlock(g, { shape: 'box', x: 0, y: 0, w: 1, d: 1, z: 0, h: 18, color: PALETTE.wall });
        continue;
      }
      drawGround(g, t.ground, view.progress);
      if (ring.has(key(p))) g.lineStyle(2, PALETTE.ring, 0.55).strokePoints(DIAMOND, true);
      if (view.preview && view.preview.tile.x === p.x && view.preview.tile.y === p.y) {
        g.fillStyle(view.preview.valid ? PALETTE.ring : PALETTE.invalid, 0.35).fillPoints(DIAMOND, true);
      }
      if (glow.has(key(p))) g.fillStyle(PALETTE.glow, 0.45).fillEllipse(0, 0, TILE_W * 0.7, TILE_H * 0.7);

      let objectHeight = 0;
      const animated: Phaser.GameObjects.GameObject[] = [];
      if (t.object) {
        const obj = this.art.create(this, c.x, c.y, t.object.name, view.rotation);
        this.layer.add(obj);
        animated.push(obj);
        objectHeight = this.art.topHeight(t.object.name);
      }
      if (t.plant) {
        const plantG = this.add.graphics({ x: c.x, y: c.y });
        drawPrims(plantG, plantPrims({ ...t.plant, x: p.x, y: p.y, objectHeight }));
        this.layer.add(plantG);
        animated.push(plantG);
        if (showStatus) {
          const st = cellStatus(s, p);
          if (st && st !== 'seed') {
            const label = this.add.text(c.x, c.y - objectHeight - 30, STATUS_GLYPH[st], { fontFamily: 'Nunito, sans-serif', fontSize: '15px', color: '#f4f1e4', stroke: '#23251f', strokeThickness: 3 }).setOrigin(0.5);
            this.layer.add(label);
          }
        }
      }
      if (changed.has(key(p)) && !this.opts.reducedMotion) {
        this.tweens.add({ targets: animated, scaleY: { from: 0.6, to: 1 }, alpha: { from: 0.4, to: 1 }, duration: 420, ease: 'Back.Out' });
      }
    }
  }
}
```

- [ ] **Step 4: Temporary dev harness in `src/main.ts`** (Task 8 replaces this file)

```ts
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import './styles.css';
import Phaser from 'phaser';
import { PlayController } from './game/controller';
import { LEVELS } from './levels';
import { DioramaScene } from './render/scene/DioramaScene';

const scene = new DioramaScene();
new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'stage',
  backgroundColor: '#23251f',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [scene],
});
const params = new URLSearchParams(location.search);
const ctrl = new PlayController(LEVELS[Number(params.get('level') ?? 0)]!);
scene.attach(ctrl, { reducedMotion: false, interactive: true });
(window as unknown as { ctrl: PlayController }).ctrl = ctrl;
```

- [ ] **Step 5: Typecheck and test**

Run: `npm run typecheck && npm test`
Expected: all pass. If Phaser's types reject a call, fix it with the smallest change that matches `node_modules/phaser/types/phaser.d.ts`, and note it.

- [ ] **Step 6: Browser check** (claude-in-chrome; dev server in the background)

Open `http://localhost:5173/play/?level=0`, then check each of these with a screenshot:
1. Bus Stop draws as a grey isometric diorama: 6×6 tiles with slab edges, the bench and bin as low-poly shapes, nothing clipped, centred.
2. In the console, run `ctrl.select({kind:'seed',plant:'moss'})` and hover a tile: a light diamond appears. Hover the bench tile: the diamond turns red.
3. Click three tiles to plant moss, which shows as seed mounds. Run `ctrl.select({kind:'scrap',slot:0})`, hover next to a seed: the radius diamond outline appears, seeds inside glow, and status arrows show. Click: the tyre appears, and the seeds grow into moss with a short pop.
4. Press E four times: the view rotates, stays centred, and hovering still highlights the tile under the cursor.
5. Use the mouse wheel to zoom in and out.
6. Open `?level=4` (Playground): blocked tiles show as raised wall blocks, and all four ruins draw correctly.
7. `read_console_messages` with pattern `error|Error`: no errors.

Fix any visual problem in the drawing code (not in the tested logic), and keep a short note of each fix.

- [ ] **Step 7: Commit**

```bash
git add src/render src/main.ts
git commit -m "feat(render): Phaser diorama scene with code-drawn ground, objects and plants"
```

---

### Task 7: HUD (in-level HTML interface)

**Files:**
- Create: `src/ui/hud.ts`
- Test: `tests/ui/hud.test.ts`

**Interfaces:**
- Consumes: `View`, `Selection` (Task 4); `PLANT_TYPES`, `RADIUS`, `SCRAP` (engine)
- Produces: `interface HudHandlers { select(sel: Selection): void; undo(): void; restart(): void; rotate(dir: 1 | -1): void; menu(): void; next(): void; keepDecorating(): void }`; `interface HudMeta { name: string; hint: string; hasNext: boolean }`; `class Hud { constructor(root: HTMLElement, handlers: HudHandlers); el: HTMLElement; render(view: View, meta: HudMeta): void; showError(): void; destroy(): void }`

- [ ] **Step 1: Write the failing test** at `tests/ui/hud.test.ts`

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayController } from '../../src/game/controller';
import { Hud, type HudHandlers } from '../../src/ui/hud';
import { makeLevel } from '../engine/helpers';

const handlers = (): HudHandlers & Record<string, ReturnType<typeof vi.fn>> => ({
  select: vi.fn(), undo: vi.fn(), restart: vi.fn(), rotate: vi.fn(), menu: vi.fn(), next: vi.fn(), keepDecorating: vi.fn(),
});
const meta = { name: 'Bus <Stop>', hint: 'Place scrap near a seed.', hasNext: true };
const click = (el: Element | null) => (el as HTMLElement).click();

let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="ui"></div>';
  root = document.getElementById('ui')!;
});

describe('Hud', () => {
  it('renders name (escaped), hint, meter and batch dots', () => {
    const c = new PlayController(makeLevel({ batches: [['tyre'], ['can'], ['cone']] }));
    const hud = new Hud(root, handlers());
    hud.render(c.view, meta);
    expect(root.querySelector('.level-name')!.textContent).toBe('Bus <Stop>');
    expect(root.querySelector('.hint')!.textContent).toBe('Place scrap near a seed.');
    expect((root.querySelector('.meter-fill') as HTMLElement).style.width).toBe('0%');
    expect(root.querySelectorAll('.batches i')).toHaveLength(2);
  });

  it('lists seeds with counts and scrap with reach, and marks the selection', () => {
    const c = new PlayController(makeLevel({ seeds: { moss: 2, flower: 1 }, batches: [['tyre', 'crate']] }));
    c.select({ kind: 'seed', plant: 'moss' });
    const hud = new Hud(root, handlers());
    hud.render(c.view, meta);
    const seeds = root.querySelectorAll('[data-action="seed"]');
    expect(seeds).toHaveLength(2);
    expect(seeds[0]!.textContent).toContain('Moss');
    expect(seeds[0]!.querySelector('.count')!.textContent).toBe('2');
    expect(seeds[0]!.getAttribute('aria-pressed')).toBe('true');
    const scrap = root.querySelectorAll('[data-action="scrap"]');
    expect(scrap).toHaveLength(2);
    expect(scrap[1]!.textContent).toContain('Crate');
    expect(scrap[1]!.textContent).toContain('2');
  });

  it('routes clicks to handlers', () => {
    const c = new PlayController(makeLevel({ batches: [['tyre', 'crate']] }));
    const h = handlers();
    const hud = new Hud(root, h);
    hud.render(c.view, meta);
    click(root.querySelector('[data-plant="vine"]'));
    expect(h.select).toHaveBeenCalledWith({ kind: 'seed', plant: 'vine' });
    click(root.querySelector('[data-slot="1"]'));
    expect(h.select).toHaveBeenCalledWith({ kind: 'scrap', slot: 1 });
    click(root.querySelector('[data-action="rotate-left"]'));
    expect(h.rotate).toHaveBeenCalledWith(-1);
    click(root.querySelector('[data-action="menu"]'));
    expect(h.menu).toHaveBeenCalled();
  });

  it('disables undo until there is something to undo', () => {
    const c = new PlayController(makeLevel());
    const h = handlers();
    const hud = new Hud(root, h);
    hud.render(c.view, meta);
    const undo = root.querySelector('[data-action="undo"]') as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    click(undo);
    expect(h.undo).not.toHaveBeenCalled();
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    hud.render(c.view, meta);
    expect((root.querySelector('[data-action="undo"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows the restored overlay with Next or Back, and Keep decorating', () => {
    const c = new PlayController(makeLevel({ width: 3, height: 1, ground: ['...'], target: 0.3, batches: [['tyre', 'tyre']] }));
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'scrap', slot: 0, x: 1, y: 0 });
    const h = handlers();
    const hud = new Hud(root, h);
    hud.render(c.view, meta);
    expect(root.querySelector('.overlay h2')!.textContent).toBe('Scene restored');
    click(root.querySelector('[data-action="next"]'));
    expect(h.next).toHaveBeenCalled();
    click(root.querySelector('[data-action="keep"]'));
    expect(h.keepDecorating).toHaveBeenCalled();
    hud.render(c.view, { ...meta, hasNext: false });
    expect(root.querySelector('[data-action="next"]')).toBeNull();
    expect(root.querySelector('.overlay [data-action="menu"]')).not.toBeNull();
  });

  it('shows the rests overlay with Undo and Restart', () => {
    const c = new PlayController(makeLevel({ batches: [['tyre']] }));
    c.play({ type: 'scrap', slot: 0, x: 0, y: 0 });
    const hud = new Hud(root, handlers());
    hud.render(c.view, meta);
    expect(root.querySelector('.overlay h2')!.textContent).toBe('The garden rests…');
    expect(root.querySelector('.overlay [data-action="undo"]')).not.toBeNull();
    expect(root.querySelector('.overlay [data-action="restart"]')).not.toBeNull();
  });

  it('shows an error overlay whose Restart clears it', () => {
    const c = new PlayController(makeLevel());
    const h = handlers();
    const hud = new Hud(root, h);
    hud.render(c.view, meta);
    hud.showError();
    expect(root.querySelector('.overlay h2')!.textContent).toBe('Something went wrong');
    click(root.querySelector('.overlay [data-action="restart"]'));
    expect(h.restart).toHaveBeenCalled();
    hud.render(c.view, meta);
    expect(root.querySelector('.overlay')).toBeNull();
  });

  it('destroy removes its element', () => {
    const hud = new Hud(root, handlers());
    hud.destroy();
    expect(root.querySelector('.hud')).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/ui`
Expected: FAIL, with a module-not-found error for `src/ui/hud`.

- [ ] **Step 3: Create `src/ui/hud.ts`**

```ts
import { PLANT_TYPES, RADIUS, SCRAP, type PlantType } from '../engine';
import type { Selection, View } from '../game/controller';

export interface HudHandlers {
  select(sel: Selection): void;
  undo(): void;
  restart(): void;
  rotate(dir: 1 | -1): void;
  menu(): void;
  next(): void;
  keepDecorating(): void;
}

export interface HudMeta {
  name: string;
  hint: string;
  hasNext: boolean;
}

const SWATCH: Record<PlantType, string> = { moss: '#89a94a', vine: '#58934a', flower: '#e89ab0', bamboo: '#9fb85a' };
const LABEL: Record<PlantType, string> = { moss: 'Moss', vine: 'Vine', flower: 'Flower', bamboo: 'Bamboo' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export class Hud {
  readonly el: HTMLElement;
  private error = false;
  private last: { view: View; meta: HudMeta } | null = null;

  constructor(root: HTMLElement, private readonly handlers: HudHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.onClick(e));
  }

  render(view: View, meta: HudMeta): void {
    this.last = { view, meta };
    this.el.innerHTML = this.html(view, meta);
  }

  showError(): void {
    this.error = true;
    if (this.last) this.render(this.last.view, this.last.meta);
  }

  destroy(): void {
    this.el.remove();
  }

  private onClick(e: Event): void {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!b || (b as HTMLButtonElement).disabled) return;
    const h = this.handlers;
    switch (b.dataset.action) {
      case 'seed':
        return h.select({ kind: 'seed', plant: b.dataset.plant as PlantType });
      case 'scrap':
        return h.select({ kind: 'scrap', slot: Number(b.dataset.slot) });
      case 'undo':
        return h.undo();
      case 'restart':
        this.error = false;
        return h.restart();
      case 'rotate-left':
        return h.rotate(-1);
      case 'rotate-right':
        return h.rotate(1);
      case 'menu':
        return h.menu();
      case 'next':
        return h.next();
      case 'keep':
        return h.keepDecorating();
    }
  }

  private html(v: View, m: HudMeta): string {
    const s = v.state;
    const sel = v.selection;
    const pct = Math.round(v.progress * 100);
    const seeds = PLANT_TYPES.filter((t) => s.seeds[t] > 0)
      .map((t) => {
        const on = sel?.kind === 'seed' && sel.plant === t;
        return `<button data-action="seed" data-plant="${t}" class="${on ? 'selected' : ''}" aria-pressed="${on}"><span class="swatch" style="background:${SWATCH[t]}"></span>${LABEL[t]} <span class="count">${s.seeds[t]}</span></button>`;
      })
      .join('');
    const scrap = s.tray
      .map((k, i) => {
        const on = sel?.kind === 'scrap' && sel.slot === i;
        const reach = RADIUS[SCRAP[k].size];
        return `<button data-action="scrap" data-slot="${i}" class="${on ? 'selected' : ''}" aria-pressed="${on}">${cap(k)} <span class="reach" aria-label="reaches ${reach}">◇${reach}</span></button>`;
      })
      .join('');
    return `
<header class="hud-top">
  <button data-action="menu" aria-label="Back to places">☰</button>
  <div class="level-name">${esc(m.name)}</div>
  <div class="meter" role="progressbar" aria-label="Greenery" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="meter-fill" style="width:${pct}%"></div></div>
  <div class="batches" aria-label="${s.batches.length} batches left">${s.batches.map(() => '<i></i>').join('')}</div>
</header>
<p class="hint">${esc(m.hint)}</p>
<div class="hud-tools">
  <button data-action="undo" aria-label="Undo" ${v.canUndo ? '' : 'disabled'}>↶</button>
  <button data-action="restart" aria-label="Restart level">⟲</button>
  <button data-action="rotate-left" aria-label="Rotate left">◀</button>
  <button data-action="rotate-right" aria-label="Rotate right">▶</button>
</div>
<footer class="tray">${seeds ? `<span class="group-label">Seeds</span>${seeds}` : ''}${scrap ? `<span class="group-label">Scrap</span>${scrap}` : ''}</footer>
${this.overlay(v, m)}`;
  }

  private overlay(v: View, m: HudMeta): string {
    if (this.error) {
      return `<div class="overlay" role="dialog" aria-label="Error"><h2>Something went wrong</h2><div class="actions"><button data-action="restart" class="primary">Restart level</button></div></div>`;
    }
    if (v.overlay === 'restored') {
      const primary = m.hasNext ? '<button data-action="next" class="primary">Next place</button>' : '<button data-action="menu" class="primary">Back to places</button>';
      return `<div class="overlay" role="dialog" aria-label="Scene restored"><h2>Scene restored</h2><p>Nature has taken ${esc(m.name)} back.</p><div class="actions">${primary}<button data-action="keep">Keep decorating</button></div></div>`;
    }
    if (v.overlay === 'rests') {
      return `<div class="overlay" role="dialog" aria-label="The garden rests"><h2>The garden rests…</h2><p>There is no more scrap to place.</p><div class="actions"><button data-action="undo" class="primary">Undo</button><button data-action="restart">Restart</button></div></div>`;
    }
    return '';
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/ui && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui tests/ui
git commit -m "feat(ui): in-level HUD with tray, meter, tools and overlays"
```

---

### Task 8: App screens, flow and the real `main.ts`

**Files:**
- Create: `src/app/app.ts`
- Modify: `src/main.ts` (replace the Task 6 harness)
- Test: `tests/app/app.test.ts`

**Interfaces:**
- Consumes: `PlayController` (Task 4), `Hud` (Task 7), `levelStatuses` and save functions (Task 3), `DioramaScene` and `AttachOptions` (Task 6), `LEVELS`
- Produces: `interface Stage { show(ctrl: PlayController | null, opts: AttachOptions): void }`; `interface AppOptions { demoIntervalMs: number | null; prefersReducedMotion: boolean }`; `type Screen = 'title' | 'select' | 'settings' | 'credits' | 'play'`; `class App { constructor(root, stage, store, levels, options); screen: Screen; controller: PlayController | null; reducedMotion: boolean; show(screen): void; startLevel(index: number): void; showError(): void }`

- [ ] **Step 1: Write the failing test** at `tests/app/app.test.ts`

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App, type Stage } from '../../src/app/app';
import { LEVELS } from '../../src/levels';
import { SAVE_KEY, type Store } from '../../src/save/save';

const memoryStore = (initial: Record<string, string> = {}): Store & { data: Record<string, string> } => {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};
const opts = { demoIntervalMs: null, prefersReducedMotion: false };
const click = (sel: string) => (document.querySelector(sel) as HTMLElement).click();

let root: HTMLElement;
let stage: Stage & { show: ReturnType<typeof vi.fn> };
beforeEach(() => {
  document.body.innerHTML = '<div id="ui"></div>';
  root = document.getElementById('ui')!;
  stage = { show: vi.fn() };
});

describe('App', () => {
  it('starts on the title screen', () => {
    const app = new App(root, stage, memoryStore(), LEVELS, opts);
    expect(app.screen).toBe('title');
    expect(root.querySelector('.logo')!.textContent).toBe('Afterlife');
    expect(root.querySelector('[data-nav="select"]')).not.toBeNull();
  });

  it('lists the five places with only the first open', () => {
    new App(root, stage, memoryStore(), LEVELS, opts);
    click('[data-nav="select"]');
    const cards = root.querySelectorAll<HTMLButtonElement>('.level-card');
    expect(cards).toHaveLength(5);
    expect(cards[0]!.disabled).toBe(false);
    expect(cards[1]!.disabled).toBe(true);
    expect(cards[0]!.textContent).toContain('Bus Stop');
  });

  it('starts a level with the HUD and an interactive stage', () => {
    const app = new App(root, stage, memoryStore(), LEVELS, opts);
    click('[data-nav="select"]');
    click('[data-level="0"]');
    expect(app.screen).toBe('play');
    expect(root.querySelector('.hud')).not.toBeNull();
    expect(stage.show).toHaveBeenLastCalledWith(app.controller, { reducedMotion: false, interactive: true });
  });

  it('saves completion, unlocks the next place and offers Next', () => {
    const store = memoryStore();
    const app = new App(root, stage, store, LEVELS, opts);
    app.startLevel(0);
    for (const move of LEVELS[0]!.solution) app.controller!.play(move);
    expect(JSON.parse(store.data[SAVE_KEY]!).completed).toEqual(['bus-stop']);
    expect(root.querySelector('.overlay h2')!.textContent).toBe('Scene restored');
    click('[data-action="next"]');
    expect(app.controller!.level.id).toBe('rooftop');
    click('[data-action="menu"]');
    const cards = root.querySelectorAll<HTMLButtonElement>('.level-card');
    expect(cards[0]!.classList.contains('completed')).toBe(true);
    expect(cards[1]!.disabled).toBe(false);
  });

  it('persists the reduce-motion setting and honours the system preference', () => {
    const store = memoryStore();
    const app = new App(root, stage, store, LEVELS, opts);
    click('[data-nav="settings"]');
    const box = root.querySelector('[data-setting="reducedMotion"]') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    expect(app.reducedMotion).toBe(true);
    expect(JSON.parse(store.data[SAVE_KEY]!).settings.reducedMotion).toBe(true);
    const sys = new App(root, stage, memoryStore(), LEVELS, { ...opts, prefersReducedMotion: true });
    expect(sys.reducedMotion).toBe(true);
  });

  it('starts normally with corrupt saved data or no storage', () => {
    expect(new App(root, stage, memoryStore({ [SAVE_KEY]: '{oops' }), LEVELS, opts).screen).toBe('title');
    expect(new App(root, stage, null, LEVELS, opts).screen).toBe('title');
  });

  it('shows the error overlay during play and restarts from it', () => {
    const app = new App(root, stage, memoryStore(), LEVELS, opts);
    app.startLevel(0);
    app.controller!.play(LEVELS[0]!.solution[0]!);
    app.showError();
    expect(root.querySelector('.overlay h2')!.textContent).toBe('Something went wrong');
    click('.overlay [data-action="restart"]');
    expect(root.querySelector('.overlay')).toBeNull();
    expect(app.controller!.view.canUndo).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/app/app.test.ts`
Expected: FAIL, with a module-not-found error for `src/app/app`.

- [ ] **Step 3: Create `src/app/app.ts`**

```ts
import type { LevelData } from '../engine';
import { PlayController } from '../game/controller';
import type { AttachOptions } from '../render/scene/DioramaScene';
import { loadSave, markCompleted, writeSave, type SaveData, type Store } from '../save/save';
import { Hud } from '../ui/hud';
import { levelStatuses, type LevelStatus } from './progress';

export interface Stage {
  show(ctrl: PlayController | null, opts: AttachOptions): void;
}
export interface AppOptions {
  /** Milliseconds between title-screen demo moves; null disables the demo (tests). */
  demoIntervalMs: number | null;
  prefersReducedMotion: boolean;
}
export type Screen = 'title' | 'select' | 'settings' | 'credits' | 'play';

const STATUS_TEXT: Record<LevelStatus, string> = { locked: 'Locked', open: 'Ready', completed: 'Restored' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export class App {
  screen: Screen = 'title';
  controller: PlayController | null = null;
  private save: SaveData;
  private levelIndex = 0;
  private hud: Hud | null = null;
  private unsubscribe: (() => void) | null = null;
  private demoTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly stage: Stage,
    private readonly store: Store | null,
    private readonly levels: LevelData[],
    private readonly options: AppOptions,
  ) {
    this.save = loadSave(store);
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('change', (e) => this.onInput(e));
    this.show('title');
  }

  get reducedMotion(): boolean {
    return this.options.prefersReducedMotion || this.save.settings.reducedMotion;
  }

  show(screen: Exclude<Screen, 'play'>): void {
    this.teardown();
    this.screen = screen;
    this.root.innerHTML = this.template(screen);
    if (screen === 'title') this.startDemo();
    else this.stage.show(null, { reducedMotion: this.reducedMotion, interactive: false });
  }

  startLevel(index: number): void {
    const level = this.levels[index];
    if (!level) return this.show('select');
    this.teardown();
    this.screen = 'play';
    this.levelIndex = index;
    this.root.innerHTML = '';
    const ctrl = new PlayController(level);
    this.controller = ctrl;
    const hud = new Hud(this.root, {
      select: (sel) => ctrl.select(sel),
      undo: () => ctrl.undo(),
      restart: () => ctrl.restart(),
      rotate: (dir) => ctrl.rotate(dir),
      menu: () => this.show('select'),
      next: () => this.startLevel(this.levelIndex + 1),
      keepDecorating: () => ctrl.keepDecorating(),
    });
    this.hud = hud;
    const meta = { name: level.name, hint: level.hint, hasNext: index + 1 < this.levels.length };
    this.unsubscribe = ctrl.onChange((view, events) => {
      if (events.some((e) => e.type === 'won')) {
        this.save = markCompleted(this.save, level.id);
        writeSave(this.store, this.save);
      }
      hud.render(view, meta);
    });
    hud.render(ctrl.view, meta);
    this.stage.show(ctrl, { reducedMotion: this.reducedMotion, interactive: true });
  }

  showError(): void {
    this.hud?.showError();
  }

  private teardown(): void {
    if (this.demoTimer) clearInterval(this.demoTimer);
    this.demoTimer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.hud?.destroy();
    this.hud = null;
    this.controller = null;
  }

  /** Title background: level 1's reference solution plays itself, slowly, on a loop. */
  private startDemo(): void {
    const level = this.levels[0];
    if (this.options.demoIntervalMs === null || !level) {
      this.stage.show(null, { reducedMotion: this.reducedMotion, interactive: false });
      return;
    }
    let demo = new PlayController(level);
    let step = 0;
    this.stage.show(demo, { reducedMotion: this.reducedMotion, interactive: false });
    this.demoTimer = setInterval(() => {
      const move = level.solution[step++];
      if (move) {
        demo.play(move);
        return;
      }
      if (step > level.solution.length + 4) {
        demo = new PlayController(level);
        step = 0;
        this.stage.show(demo, { reducedMotion: this.reducedMotion, interactive: false });
      }
    }, this.options.demoIntervalMs);
  }

  private onClick(e: Event): void {
    const el = e.target as HTMLElement;
    const nav = el.closest<HTMLElement>('[data-nav]');
    if (nav) return this.show(nav.dataset.nav as Exclude<Screen, 'play'>);
    const card = el.closest<HTMLButtonElement>('[data-level]');
    if (card && !card.disabled) this.startLevel(Number(card.dataset.level));
  }

  private onInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.dataset.setting === 'reducedMotion') {
      this.save = { ...this.save, settings: { ...this.save.settings, reducedMotion: input.checked } };
      writeSave(this.store, this.save);
    }
  }

  private template(screen: Exclude<Screen, 'play'>): string {
    const back = '<button data-nav="title">Back</button>';
    switch (screen) {
      case 'title':
        return `<main class="screen title-screen"><h1 class="logo">Afterlife</h1><p class="tagline">Nature takes back what we left behind.</p><nav class="menu"><button data-nav="select" class="primary">Play</button><button data-nav="settings">Settings</button><button data-nav="credits">Credits</button></nav></main>`;
      case 'select': {
        const statuses = levelStatuses(this.levels.map((l) => l.id), this.save.completed);
        const cards = this.levels
          .map((l, i) => {
            const st = statuses[i]!;
            return `<li><button class="level-card ${st}" data-level="${i}" ${st === 'locked' ? 'disabled' : ''} aria-label="${esc(l.name)}, ${STATUS_TEXT[st]}"><span class="num">${i + 1}</span><span class="name">${esc(l.name)}</span><span class="status">${STATUS_TEXT[st]}</span></button></li>`;
          })
          .join('');
        return `<main class="screen select-screen"><h2>Choose a place</h2><ol class="level-grid">${cards}</ol>${back}</main>`;
      }
      case 'settings':
        return `<main class="screen settings-screen"><h2>Settings</h2><label class="toggle"><input type="checkbox" data-setting="reducedMotion" ${this.save.settings.reducedMotion ? 'checked' : ''}> Reduce motion</label>${back}</main>`;
      case 'credits':
        return `<main class="screen credits-screen"><h2>Credits</h2><p>Design and direction: Ujjwal Kumar</p><p>Built with Phaser and TypeScript.</p><p>Inspired by the mechanics of <em>Cloud Gardens</em> by Noio.</p>${back}</main>`;
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/app && npm run typecheck`
Expected: all PASS.

- [ ] **Step 5: Replace `src/main.ts`**

```ts
import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import './styles.css';
import Phaser from 'phaser';
import { App } from './app/app';
import { LEVELS } from './levels';
import { DioramaScene } from './render/scene/DioramaScene';
import { safeStorage } from './save/save';

const scene = new DioramaScene();
new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'stage',
  backgroundColor: '#23251f',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [scene],
});

const app = new App(document.getElementById('ui')!, { show: (ctrl, opts) => scene.attach(ctrl, opts) }, safeStorage(), LEVELS, {
  demoIntervalMs: 900,
  prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
});

const onError = (err: unknown) => {
  console.error('[Afterlife]', err);
  app.showError();
};
window.addEventListener('error', (e) => onError(e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => onError(e.reason));

if (import.meta.env.DEV) (window as unknown as { afterlife: App }).afterlife = app;
```

- [ ] **Step 6: Typecheck, test and build**

Run: `npm test && npm run build 2>&1 | tail -5`
Expected: all tests pass; the build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/app/app.ts src/main.ts tests/app/app.test.ts
git commit -m "feat(app): title, level select, settings, credits and play flow"
```

---

### Task 9: Real-play verification, performance and ship

**Files:**
- Modify: only what fixes problems found here (each fix gets a ledger note; logic fixes get a failing test first)

**Interfaces:**
- Consumes: the whole game. In dev, `window.afterlife` is the `App`.

- [ ] **Step 1: Full suite and production build**

Run: `npm test && npm run build 2>&1 | tail -8`
Expected: all tests pass and the build succeeds.

- [ ] **Step 2: Bundle budget (spec §7.2: first load under 3 MB compressed)**

Run: `cat dist/assets/*.js dist/assets/*.css | gzip -c | wc -c`
Expected: fewer than 3,000,000 bytes. Write down the number.

- [ ] **Step 3: Desktop playthrough** (claude-in-chrome, `npm run preview` in the background, open `http://localhost:4173/play/`)

1. Title: the "Afterlife" logo is over the Bus Stop demo, which grows itself every ~0.9 s. Screenshot.
2. Click Play: Bus Stop is Ready and the rest are Locked. Open Bus Stop.
3. Play a few moves **with the mouse only**: select Moss in the tray, plant two seeds, select a tyre, hover to see the ring and glow, and click to place. Check that the meter moves, undo works, and the tools rotate the view. Screenshot.
4. In the console, finish the level: `afterlife.controller.restart(); for (const m of afterlife.controller.level.solution) afterlife.controller.play(m)`. Expected: the colour wash and flash, the camera turns once, and the "Scene restored" overlay appears. Screenshot. Click Next place.
5. Repeat step 4 for levels 2–5 using the same console line on each. Each must end in "Scene restored". On Playground the button must read "Back to places".
6. Back on the level select: all five show Restored. Reload the page: progress persists.
7. Settings: turn on Reduce motion and play a move. There is no pop animation, and on a win there is no camera turn.
8. `read_console_messages` with pattern `error|Error`: no errors.

- [ ] **Step 4: Mobile and resize check**

Resize the window to 390×844 (`resize_window`). Then:
1. Title, select, and a level are all usable with no horizontal scroll. The tray scrolls sideways if needed. Buttons are at least 44 px.
2. Resize to 1280×800 mid-level: the diorama re-fits and is centred. Hover picking still highlights the tile under the cursor.
3. Touch flow (emulated taps if available; otherwise in the console call `afterlife.controller.tap({x:1,y:1},'touch')` twice): the first tap previews, the second places.

Screenshot the mobile level view.

- [ ] **Step 5: Commit any fixes and push**

```bash
git status --short
git add -A src tests
git commit -m "fix: issues found in real-play verification"   # only if there were fixes
git push
```

Expected: `main` is pushed to `https://github.com/Ujjwalkumar-pm/afterlife`. (Pushing a feature branch, or merging it first, follows the finishing step the executor uses.)
