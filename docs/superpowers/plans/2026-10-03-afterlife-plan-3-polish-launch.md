# Afterlife — Plan 3: Sound, Kenney Props, Landing Page & Launch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Afterlife v1:
- fix the playtest and review leftovers;
- add a generative soundtrack and sound effects with mute and volume;
- swap 11 ruins and scrap objects for sprites rendered from Kenney CC0 3D models;
- build a landing page with an icon and a share image;
- launch publicly on Vercel.

**Architecture:** Each part splits into pure, unit-tested logic plus a thin layer that touches a browser API:
- **Sound:** `cuesFor(events)` and `ambientParams(progress)` are pure. `ToneSound` loads Tone.js lazily on the first tap, behind a `Sound` interface that tests replace with a fake.
- **Props:** a build-time tool renders Kenney GLB models with three.js in headless Chrome into 4-facing PNGs plus a JSON manifest. A sprite `ObjectArt` uses them and falls back to code-drawn shapes.
- **Landing page:** static HTML/CSS at `/`. The game stays at `/play/`.

**Tech Stack:** Tone.js 15.1.22 (runtime, lazy chunk); three 0.186 and playwright-core (dev-only tools); the existing Phaser 4.2.1, Vite 8, Vitest 5 and happy-dom stack; Vercel hosting.

**Spec:** `docs/superpowers/specs/2026-10-03-afterlife-design.md` (§1 success criteria 2–4, §5 Mute button, §6 audio and art, §7.2 hosting, §7.3 audio failure, §9 scope). Plans 1 and 2 are done and merged.

## Global Constraints

- Sound starts only after the first click or tap. Mute and volume are saved under `afterlife.save.v1` (`settings.muted`, `settings.volume` 0–1). If audio fails or is blocked, the game plays silently with no error panel (§7.3).
- All audio is synthesized at runtime (no audio files). Ambient gets fuller as coverage rises (§6).
- Kenney assets are CC0. Keep their licence file in `assets/LICENSES/`. Use only the 11 models listed in Task 4. Objects without a model stay code-drawn.
- Sprites match the grid: a 1×1 tile is a 64×32 px diamond (2:1, camera elevation 30°). Rotation k maps grid offset (x, y) → (−y, x), which is a model rotation of −k·90° about the vertical axis.
- Initial game page load stays under 3 MB compressed. Tone.js is a separate chunk loaded on the first tap.
- Engine (`src/engine/`) untouched. Phaser is imported only in `src/render/scene/`, `src/render/objects/objectArt.ts`, `src/render/objects/spriteArt.ts`, `src/render/plants/plantArt.ts` and `src/main.ts`.
- `/` is the landing page and `/play/` is the game. Asset URLs use `import.meta.env.BASE_URL`.
- No Cloud Gardens names, art, levels or audio. Credits: "Ujjwal Kumar"; Kenney (CC0); "inspired by the mechanics of *Cloud Gardens* by Noio".
- Deploying to Vercel publishes the game publicly. Ujjwal approved the public launch by approving this plan.

## Review Focus

1. **Audio blocked or failing to load** (old Safari, autoplay policy, a failed chunk) must leave the game fully playable and silent, with no error panel. Pinned in Task 3 (`keeps working when sound unlock throws`).
2. **Muted, then reloaded:** the game must stay silent from the first tap, including the ambient. Pinned in Task 3 (`applies saved mute and volume at start`).
3. **A sprite missing for some object or rotation** must fall back to the code-drawn shape, never an empty or black box. Pinned in Task 5 (`falls back for unknown names` and `every manifest sprite has 4 PNGs on disk`).
4. **Full or read-only localStorage** must still show saved progress. Pinned in Task 1 (`probeStorage returns a read-only store when writes fail`).
5. **Subpath and production URLs:** the live site must load sprites, fonts and the Tone.js chunk without 404s. Pinned in Task 5 (`builds sprite URLs from the base path`) and Task 7 (live check, no failed requests).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/game/controller.ts` (modify) | `rotate` clears a stale preview |
| `src/save/save.ts` (modify) | `probeStorage` returns a read-only store when writes fail |
| `src/ui/hud.ts` (modify) | Mute button, error overlay Menu, focus moves into overlays |
| `src/render/scene/DioramaScene.ts` (modify) | Press must start on the canvas; keep the player's zoom; phone fit; sprite preload |
| `src/audio/cues.ts` | Pure: events → sound cues; progress → ambient params; volume → dB |
| `src/audio/sound.ts` | `Sound` interface + `silentSound` |
| `src/audio/toneSound.ts` | Tone.js implementation (lazy-loaded) |
| `src/app/app.ts` (modify) | Sound wiring, settings for sound and volume, mute from HUD, Kenney credit |
| `assets/kenney/…`, `assets/LICENSES/kenney-cc0.txt` | The 11 GLB models, their colour maps, and the licence |
| `tools/sprites/sprites.config.ts`, `tools/sprites/render.html`, `tools/sprites/render.ts`, `tools/sprites/run.ts` | Sprite render tool |
| `public/sprites/*.png`, `src/render/objects/sprites.json` | Generated sprites and their manifest (committed) |
| `src/render/objects/spriteArt.ts` | Sprite `ObjectArt` with code-drawn fallback |
| `index.html`, `src/landing.css`, `public/favicon.svg`, `public/hero.png`, `public/og.png`, `tools/capture-hero.ts` | Landing page and images |
| `vercel.json`, `README.md` | Deploy config and the public README |

---

### Task 1: Playtest and review leftovers

**Files:**
- Modify: `src/game/controller.ts`, `src/save/save.ts`, `src/ui/hud.ts`, `src/render/scene/DioramaScene.ts`, `src/main.ts`
- Test: `tests/game/controller.test.ts`, `tests/save/save.test.ts`, `tests/ui/hud.test.ts`

**Interfaces:**
- Produces: `probeStorage(s: Storage): Store | null` (exported from `src/save/save.ts`; `safeStorage()` now uses it). `Hud` focuses the overlay's `.primary` button when an overlay first appears. The error overlay also offers `data-action="menu"`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/game/controller.test.ts`:

```ts
describe('rotation and preview', () => {
  it('rotate clears the hover preview so it never points at the old tile', () => {
    const c = new PlayController(makeLevel());
    c.select({ kind: 'seed', plant: 'moss' });
    c.hover(at(1, 1));
    expect(c.view.preview).not.toBeNull();
    c.rotate(1);
    expect(c.view.preview).toBeNull();
  });
});
```

Append to `tests/save/save.test.ts` (and add `probeStorage` to the import from `../../src/save/save`):

```ts
describe('probeStorage', () => {
  const fake = (opts: { writes: boolean; reads: boolean; data?: Record<string, string> }) => {
    const data = { ...(opts.data ?? {}) };
    return {
      getItem: (k: string) => {
        if (!opts.reads) throw new Error('SecurityError');
        return data[k] ?? null;
      },
      setItem: (k: string, v: string) => {
        if (!opts.writes) throw new Error('QuotaExceededError');
        data[k] = v;
      },
      removeItem: (k: string) => void delete data[k],
    } as unknown as Storage;
  };

  it('returns the storage itself when reads and writes work', () => {
    const s = fake({ writes: true, reads: true });
    expect(probeStorage(s)).toBe(s);
  });
  it('returns a read-only store when writes fail but reads work', () => {
    const saved = JSON.stringify({ version: 1, completed: ['bus-stop'], settings: {} });
    const store = probeStorage(fake({ writes: false, reads: true, data: { [SAVE_KEY]: saved } }));
    expect(store).not.toBeNull();
    expect(loadSave(store).completed).toEqual(['bus-stop']);
    expect(writeSave(store, defaultSave())).toBe(false);
  });
  it('returns null when nothing works', () => {
    expect(probeStorage(fake({ writes: false, reads: false }))).toBeNull();
  });
});
```

Append to `tests/ui/hud.test.ts`:

```ts
describe('Hud overlays: focus and escape routes', () => {
  it('moves focus to the primary button when an overlay appears', () => {
    const c = new PlayController(makeLevel({ width: 3, height: 1, ground: ['...'], target: 0.3, batches: [['tyre', 'tyre']] }));
    const hud = new Hud(root, handlers());
    hud.render(c.view, meta);
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'scrap', slot: 0, x: 1, y: 0 });
    hud.render(c.view, meta);
    expect(document.activeElement).toBe(root.querySelector('.overlay .primary'));
  });

  it('offers Back to places on the error overlay', () => {
    const c = new PlayController(makeLevel());
    const h = handlers();
    const hud = new Hud(root, h);
    hud.render(c.view, meta);
    hud.showError();
    click(root.querySelector('.overlay [data-action="menu"]'));
    expect(h.menu).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/game tests/save tests/ui`
Expected: 4 failures. `rotate clears…` fails because the preview is not null. The `probeStorage` tests fail because `probeStorage` is not exported (a TypeError). The focus test fails because the active element is `body`. The error menu test fails because it can't click null.

- [ ] **Step 3: Implement**

In `src/game/controller.ts`, replace `rotate`:

```ts
  rotate(dir: 1 | -1): void {
    this.rotation = ((this.rotation + dir + 4) % 4) as Rotation;
    this.preview = null;
    this.emit([]);
  }
```

In `src/save/save.ts`, replace `safeStorage` with:

```ts
/**
 * The given storage if it can be written; a read-only view if only reads work (full quota
 * shouldn't hide saved progress); otherwise null.
 */
export function probeStorage(s: Storage): Store | null {
  try {
    s.setItem('__afterlife_probe', '1');
    s.removeItem('__afterlife_probe');
    return s;
  } catch {
    try {
      s.getItem(SAVE_KEY);
      return {
        getItem: (k) => s.getItem(k),
        setItem: () => {
          throw new Error('storage is read-only');
        },
      };
    } catch {
      return null;
    }
  }
}

/** The browser's localStorage, read-only, or null (private mode, blocked cookies). */
export function safeStorage(): Store | null {
  try {
    return probeStorage(window.localStorage);
  } catch {
    return null;
  }
}
```

In `src/ui/hud.ts`:
1. Add the field `private lastOverlay = '';`.
2. In `render`, after `this.el.innerHTML = html;`, add:

```ts
    const overlay = this.error ? 'error' : view.overlay;
    if (overlay !== this.lastOverlay) {
      this.lastOverlay = overlay;
      if (overlay !== 'none') this.el.querySelector<HTMLElement>('.overlay .primary')?.focus();
    }
```

3. Replace the error overlay string with:

```ts
      return `<div class="overlay" role="dialog" aria-label="Error"><h2>Something went wrong</h2><div class="actions"><button data-action="restart" class="primary">Restart level</button><button data-action="menu">Back to places</button></div></div>`;
```

In `src/render/scene/DioramaScene.ts`:
1. Add the fields `private pressedOnCanvas = false;`, `private baseZoom = 1;` and `private userZoom = 1;`.
2. In `create()`, add `this.input.on('pointerdown', () => (this.pressedOnCanvas = true));`.
3. At the top of `onUp`, after the `!this.ctrl` guard, add:

```ts
    if (!this.pressedOnCanvas) return; // press started on the HTML layer (e.g. dragged off a tray button)
    this.pressedOnCanvas = false;
```

4. In `attach()`, after `this.opts = opts;`, add `this.userZoom = 1;`.
5. Replace `fit()` and `zoomBy()` with:

```ts
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
```

6. In `handlePinch`, replace the zoom line with:

```ts
      else {
        this.userZoom = clamp((this.pinch.zoom * d) / this.pinch.dist / this.baseZoom, 0.5, 3);
        this.cameras.main.setZoom(clamp(this.baseZoom * this.userZoom, 0.5, 3));
      }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 5: Browser check** (dev server; headless Chrome via playwright-core as in Plan 2, harness `/tmp/pw`)

At 1280×800:
1. Zoom in with the wheel, then press E. The zoom is kept after rotating, and hovering right after the rotation shows no stale preview.
2. Select Moss, mouse down on a tray button, drag onto a canvas tile and release: nothing is placed.

At 390×844, the Bus Stop board is at least 60% of the screen width. Screenshot.

- [ ] **Step 6: Commit**

```bash
git add src tests
git commit -m "fix: playtest and review leftovers (stale preview, read-only save, overlay focus, drag-through, zoom, phone fit)"
```

---

### Task 2: Sound cues and ambient parameters (pure)

**Files:**
- Create: `src/audio/cues.ts`, `src/audio/sound.ts`
- Test: `tests/audio/cues.test.ts`

**Interfaces:**
- Produces:
  - `type Cue = 'seed' | 'scrap' | 'grow' | 'spread' | 'bloom' | 'harvest' | 'newBatch' | 'won' | 'rests'`
  - `cuesFor(events: GameEvent[]): Cue[]`. This covers placement and growth only; `won` and `rests` come from overlay changes in Task 3.
  - `interface AmbientParams { cutoff: number; padDb: number; windDb: number; bells: boolean }` and `ambientParams(progress: number): AmbientParams`
  - `volumeToDb(v: number): number`
  - `interface Sound { unlock(): void; setMuted(m: boolean): void; setVolume(v: number): void; setAmbient(on: boolean): void; setProgress(p: number): void; play(cues: Cue[]): void }` and `silentSound: Sound`

- [ ] **Step 1: Write the failing test** at `tests/audio/cues.test.ts`

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/audio`
Expected: FAIL, with a module-not-found error for `src/audio/cues`.

- [ ] **Step 3: Create `src/audio/cues.ts`**

```ts
import type { GameEvent } from '../engine';

export type Cue = 'seed' | 'scrap' | 'grow' | 'spread' | 'bloom' | 'harvest' | 'newBatch' | 'won' | 'rests';

const MAX_GROW_NOTES = 3;

/** Sounds for one move's events. Growth is thinned so a big move sounds like a flourish, not noise. */
export function cuesFor(events: GameEvent[]): Cue[] {
  const out: Cue[] = [];
  let grows = 0;
  const once = (c: Cue) => {
    if (!out.includes(c)) out.push(c);
  };
  for (const e of events) {
    switch (e.type) {
      case 'placedSeed':
        out.push('seed');
        break;
      case 'placedScrap':
        out.push('scrap');
        break;
      case 'grew':
        if (grows++ < MAX_GROW_NOTES) out.push('grow');
        break;
      case 'spread':
        once('spread');
        break;
      case 'bloomed':
        once('bloom');
        break;
      case 'harvested':
        out.push('harvest');
        break;
      case 'newBatch':
        out.push('newBatch');
        break;
      default:
        break;
    }
  }
  return out;
}

export interface AmbientParams {
  /** Low-pass cutoff on the pad, Hz. */
  cutoff: number;
  padDb: number;
  windDb: number;
  /** Whether the soft bell layer plays. */
  bells: boolean;
}

/** The soundtrack blooms with the garden: brighter, fuller pad, less wind, bells past halfway. */
export function ambientParams(progress: number): AmbientParams {
  const p = Math.max(0, Math.min(1, progress));
  return {
    cutoff: Math.round(400 + p * 2600),
    padDb: -30 + p * 12,
    windDb: -24 - p * 10,
    bells: p >= 0.5,
  };
}

export function volumeToDb(v: number): number {
  return v <= 0 ? -Infinity : 20 * Math.log10(v);
}
```

- [ ] **Step 4: Create `src/audio/sound.ts`**

```ts
import type { Cue } from './cues';

/** Everything the game needs from audio. Tests and audio-less browsers use `silentSound`. */
export interface Sound {
  /** Call from a user gesture; loads and starts audio. Must never throw. */
  unlock(): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  setAmbient(on: boolean): void;
  setProgress(progress: number): void;
  play(cues: Cue[]): void;
}

export const silentSound: Sound = {
  unlock() {},
  setMuted() {},
  setVolume() {},
  setAmbient() {},
  setProgress() {},
  play() {},
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/audio && npm run typecheck`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/audio tests/audio
git commit -m "feat(audio): pure sound cues, ambient parameters and Sound interface"
```

---

### Task 3: Tone.js sound engine and its wiring

**Files:**
- Create: `src/audio/toneSound.ts`
- Modify: `src/app/app.ts`, `src/ui/hud.ts`, `src/main.ts`, `package.json` (tone dependency)
- Test: `tests/app/app.test.ts`, `tests/ui/hud.test.ts`

**Interfaces:**
- Consumes: `Sound`, `silentSound`, `cuesFor`, `ambientParams`, `volumeToDb`, `Cue` (Task 2)
- Produces:
  - `class ToneSound implements Sound` (adds the getter `contextState: string` for dev checks)
  - `App` constructor gains a sixth parameter `sound: Sound = silentSound`
  - `HudHandlers` gains `toggleMute(): void`; `HudMeta` gains `muted: boolean`
  - The settings screen has `input[data-setting="sound"]` (checkbox: on means not muted) and `input[data-setting="volume"]` (range 0–100)

- [ ] **Step 1: Install Tone.js**

Run: `cd ~/Desktop/Afterlife && npm install tone@15.1.22`
Expected: added, no errors.

- [ ] **Step 2: Write the failing tests**

In `tests/ui/hud.test.ts`:
1. Change the `meta` constant to `const meta = { name: 'Bus <Stop>', hint: 'Place scrap near a seed.', hasNext: true, muted: false };`.
2. Add `toggleMute: vi.fn(),` to the object returned by `handlers()`.
3. Append:

```ts
describe('Hud mute button', () => {
  it('shows the sound state and toggles it', () => {
    const c = new PlayController(makeLevel());
    const h = handlers();
    const hud = new Hud(root, h);
    hud.render(c.view, meta);
    const btn = root.querySelector('[data-action="mute"]')!;
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    click(btn);
    expect(h.toggleMute).toHaveBeenCalled();
    hud.render(c.view, { ...meta, muted: true });
    expect(root.querySelector('[data-action="mute"]')!.getAttribute('aria-pressed')).toBe('true');
  });
});
```

Append to `tests/app/app.test.ts`:

```ts
import type { Sound } from '../../src/audio/sound';
import type { Cue } from '../../src/audio/cues';

const fakeSound = () => {
  const calls = { unlock: 0, muted: [] as boolean[], volume: [] as number[], ambient: [] as boolean[], progress: [] as number[], cues: [] as Cue[] };
  const sound: Sound = {
    unlock: () => void calls.unlock++,
    setMuted: (m) => void calls.muted.push(m),
    setVolume: (v) => void calls.volume.push(v),
    setAmbient: (on) => void calls.ambient.push(on),
    setProgress: (p) => void calls.progress.push(p),
    play: (c) => void calls.cues.push(...c),
  };
  return { sound, calls };
};

describe('App sound', () => {
  it('applies saved mute and volume at start and turns the ambient on', () => {
    const saved = JSON.stringify({ version: 1, completed: [], settings: { reducedMotion: false, muted: true, volume: 0.3 } });
    const { sound, calls } = fakeSound();
    new App(root, stage, memoryStore({ [SAVE_KEY]: saved }), LEVELS, opts, sound);
    expect(calls.muted.at(-1)).toBe(true);
    expect(calls.volume.at(-1)).toBe(0.3);
    expect(calls.ambient.at(-1)).toBe(true);
  });

  it('unlocks audio on the first click only', () => {
    const { sound, calls } = fakeSound();
    new App(root, stage, memoryStore(), LEVELS, opts, sound);
    click('[data-nav="select"]');
    click('[data-nav="title"]');
    expect(calls.unlock).toBe(1);
  });

  it('keeps working when sound unlock throws', () => {
    const broken: Sound = { ...fakeSound().sound, unlock: () => { throw new Error('no audio'); } };
    const app = new App(root, stage, memoryStore(), LEVELS, opts, broken);
    click('[data-nav="select"]');
    expect(app.screen).toBe('select');
  });

  it('plays move cues, a won cue on the win, and follows progress', () => {
    const { sound, calls } = fakeSound();
    const app = new App(root, stage, memoryStore(), LEVELS, opts, sound);
    app.startLevel(0);
    for (const m of LEVELS[0]!.solution) app.controller!.play(m);
    expect(calls.cues).toContain('seed');
    expect(calls.cues).toContain('scrap');
    expect(calls.cues.filter((c) => c === 'won')).toHaveLength(1);
    expect(calls.progress.at(-1)).toBe(1);
  });

  it('persists sound settings from the settings screen and the HUD mute button', () => {
    const store = memoryStore();
    const { sound, calls } = fakeSound();
    new App(root, stage, store, LEVELS, opts, sound);
    click('[data-nav="settings"]');
    const toggle = root.querySelector('[data-setting="sound"]') as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    const vol = root.querySelector('[data-setting="volume"]') as HTMLInputElement;
    vol.value = '40';
    vol.dispatchEvent(new Event('change', { bubbles: true }));
    let saved = JSON.parse(store.data[SAVE_KEY]!).settings;
    expect(saved).toMatchObject({ muted: true, volume: 0.4 });
    expect(calls.muted.at(-1)).toBe(true);
    expect(calls.volume.at(-1)).toBe(0.4);
    click('[data-nav="title"]');
    click('[data-nav="select"]');
    click('[data-level="0"]');
    click('[data-action="mute"]');
    saved = JSON.parse(store.data[SAVE_KEY]!).settings;
    expect(saved.muted).toBe(false);
    expect(calls.muted.at(-1)).toBe(false);
  });

  it('credits Kenney', () => {
    new App(root, stage, memoryStore(), LEVELS, opts);
    click('[data-nav="credits"]');
    expect(root.textContent).toContain('Kenney');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/app tests/ui`
Expected: the new tests fail: there is no `[data-action="mute"]`, no `data-setting="sound"`, and no Kenney credit. Typecheck errors about the extra `App` argument are expected until Step 5.

- [ ] **Step 4: Create `src/audio/toneSound.ts`**

```ts
import type * as ToneNS from 'tone';
import { ambientParams, volumeToDb, type Cue } from './cues';
import type { Sound } from './sound';

type Tone = typeof ToneNS;
interface Nodes {
  pad: ToneNS.PolySynth;
  padFilter: ToneNS.Filter;
  wind: ToneNS.Noise;
  bell: ToneNS.PolySynth;
  pluck: ToneNS.PolySynth;
  thud: ToneNS.MembraneSynth;
  rustle: ToneNS.NoiseSynth;
  loop: ToneNS.Loop;
}

const CHORDS = [
  ['C3', 'G3', 'E4', 'B4'],
  ['A2', 'E3', 'C4', 'G4'],
  ['F2', 'C3', 'A3', 'E4'],
  ['G2', 'D3', 'B3', 'D5'],
];
const BELLS = ['E5', 'G5', 'B5', 'D6', 'C6'];
const GROW = ['C5', 'E5', 'G5', 'A5'];

/** Generative soundtrack and effects, synthesized with Tone.js. Loaded on the first user gesture. */
export class ToneSound implements Sound {
  private tone: Tone | null = null;
  private nodes: Nodes | null = null;
  private loading = false;
  private muted = false;
  private volume = 0.8;
  private progress = 0;
  private ambientOn = false;
  private playing = false;

  get contextState(): string {
    return this.tone ? this.tone.getContext().state : 'locked';
  }

  unlock(): void {
    if (this.loading) return;
    this.loading = true;
    import('tone')
      .then(async (Tone) => {
        await Tone.start();
        this.tone = Tone;
        this.nodes = this.build(Tone);
        this.applyVolume();
        this.applyProgress();
        this.applyAmbient();
      })
      .catch((err: unknown) => console.warn('[Afterlife] audio unavailable', err));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
    this.applyAmbient();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.applyVolume();
  }

  setAmbient(on: boolean): void {
    this.ambientOn = on;
    this.applyAmbient();
  }

  setProgress(progress: number): void {
    this.progress = progress;
    this.applyProgress();
  }

  play(cues: Cue[]): void {
    const T = this.tone;
    const n = this.nodes;
    if (!T || !n || this.muted) return;
    const now = T.now();
    let grow = 0;
    for (const cue of cues) {
      switch (cue) {
        case 'seed':
          n.pluck.triggerAttackRelease('G4', '16n', now);
          break;
        case 'scrap':
          n.thud.triggerAttackRelease('C2', '8n', now);
          n.rustle.triggerAttackRelease('16n', now + 0.02);
          break;
        case 'grow':
          n.pluck.triggerAttackRelease(GROW[grow % GROW.length]!, '32n', now + 0.08 + grow * 0.07);
          grow += 1;
          break;
        case 'spread':
          n.rustle.triggerAttackRelease('8n', now + 0.1);
          break;
        case 'bloom':
          n.bell.triggerAttackRelease('E6', '16n', now + 0.15);
          break;
        case 'harvest':
          n.bell.triggerAttackRelease(['G5', 'C6'], '8n', now);
          break;
        case 'newBatch':
          n.pluck.triggerAttackRelease(['C4', 'G4'], '16n', now);
          break;
        case 'won':
          n.pad.triggerAttackRelease(['C3', 'G3', 'E4', 'G4', 'C5'], '2m', now);
          n.bell.triggerAttackRelease(['E5', 'G5', 'C6'], '4n', now + 0.4);
          break;
        case 'rests':
          n.pad.triggerAttackRelease(['A2', 'E3', 'C4'], '1m', now);
          break;
      }
    }
  }

  private build(T: Tone): Nodes {
    const reverb = new T.Reverb({ decay: 6, wet: 0.45 }).toDestination();
    const padFilter = new T.Filter(800, 'lowpass').connect(reverb);
    const pad = new T.PolySynth(T.AMSynth, { volume: -24, envelope: { attack: 3, release: 6 } }).connect(padFilter);
    const windFilter = new T.AutoFilter({ frequency: 0.07, baseFrequency: 300, octaves: 3 }).connect(reverb).start();
    const wind = new T.Noise('pink').connect(windFilter);
    wind.volume.value = -26;
    const bell = new T.PolySynth(T.FMSynth, { volume: -22, envelope: { attack: 0.01, decay: 1.5, sustain: 0, release: 2 } }).connect(reverb);
    const pluck = new T.PolySynth(T.Synth, {
      volume: -14,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.4 },
    }).connect(reverb);
    const thud = new T.MembraneSynth({ volume: -12, pitchDecay: 0.05, octaves: 3, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } }).toDestination();
    const rustle = new T.NoiseSynth({ volume: -24, noise: { type: 'brown' }, envelope: { attack: 0.01, decay: 0.25, sustain: 0 } }).connect(reverb);
    let bar = 0;
    const loop = new T.Loop((time) => {
      pad.triggerAttackRelease(CHORDS[bar % CHORDS.length]!, '1m', time);
      if (ambientParams(this.progress).bells) bell.triggerAttackRelease(BELLS[bar % BELLS.length]!, '8n', time + T.Time('2n').toSeconds());
      bar += 1;
    }, '2m');
    T.getTransport().bpm.value = 60;
    return { pad, padFilter, wind, bell, pluck, thud, rustle, loop };
  }

  private applyVolume(): void {
    if (!this.tone) return;
    const dest = this.tone.getDestination();
    dest.mute = this.muted || this.volume <= 0;
    if (this.volume > 0) dest.volume.value = volumeToDb(this.volume);
  }

  private applyProgress(): void {
    const n = this.nodes;
    if (!n) return;
    const a = ambientParams(this.progress);
    n.padFilter.frequency.rampTo(a.cutoff, 2);
    n.pad.volume.rampTo(a.padDb, 2);
    n.wind.volume.rampTo(a.windDb, 2);
  }

  private applyAmbient(): void {
    const T = this.tone;
    const n = this.nodes;
    if (!T || !n) return;
    const want = this.ambientOn && !this.muted;
    if (want === this.playing) return;
    this.playing = want;
    if (want) {
      n.wind.start();
      n.loop.start(0);
      T.getTransport().start();
    } else {
      n.wind.stop();
      n.loop.stop();
      T.getTransport().stop();
    }
  }
}
```

- [ ] **Step 5: Wire sound into the HUD and the App**

In `src/ui/hud.ts`:
1. Add `toggleMute(): void;` to `HudHandlers` and `muted: boolean;` to `HudMeta`.
2. Add `case 'mute': return h.toggleMute();` to the click switch.
3. In the `hud-tools` block, after the rotate-right button, add:

```ts
  <button data-action="mute" aria-label="Sound" aria-pressed="${m.muted}">${m.muted ? '🔇' : '🔊'}</button>
```

In `src/app/app.ts`:
1. Import `{ silentSound, type Sound } from '../audio/sound'` and `{ cuesFor } from '../audio/cues'`.
2. Add the constructor parameter `private readonly sound: Sound = silentSound` after `options`.
3. In the constructor, after `this.save = loadSave(store);`, add:

```ts
    this.sound.setMuted(this.save.settings.muted);
    this.sound.setVolume(this.save.settings.volume);
    this.sound.setAmbient(true);
    const unlock = () => {
      root.removeEventListener('pointerdown', unlock, true);
      root.removeEventListener('click', unlock, true);
      try {
        this.sound.unlock();
      } catch (err) {
        console.warn('[Afterlife] audio unlock failed', err);
      }
    };
    root.addEventListener('pointerdown', unlock, true);
    root.addEventListener('click', unlock, true);
```

4. In `show()`, after `this.screen = screen;`, add `this.sound.setProgress(0);`.
5. In `startLevel`:
   - add `toggleMute: () => this.toggleMute(),` to the Hud handlers;
   - replace `const meta = {...}` with `const meta = () => ({ name: level.name, hint: level.hint, hasNext: index + 1 < this.levels.length, muted: this.save.settings.muted });`;
   - replace both `hud.render(view, meta)` / `hud.render(ctrl.view, meta)` calls with `hud.render(view, meta())` / `hud.render(ctrl.view, meta())`.

   Replace the `onChange` body with:

```ts
    let lastOverlay = ctrl.view.overlay;
    this.unsubscribe = ctrl.onChange((view, events) => {
      if (events.some((e) => e.type === 'won')) {
        this.save = markCompleted(this.save, level.id);
        writeSave(this.store, this.save);
      }
      const cues = cuesFor(events);
      if (view.overlay !== lastOverlay && view.overlay === 'restored') cues.push('won');
      if (view.overlay !== lastOverlay && view.overlay === 'rests') cues.push('rests');
      lastOverlay = view.overlay;
      this.sound.play(cues);
      this.sound.setProgress(view.progress);
      hud.render(view, meta());
    });
```

   Then add the field `private renderHud: (() => void) | null = null;`, set it in `startLevel` with `this.renderHud = () => hud.render(ctrl.view, meta());`, and clear it in `teardown()`.
6. Add the methods:

```ts
  private updateSettings(patch: Partial<SaveData['settings']>): void {
    this.save = { ...this.save, settings: { ...this.save.settings, ...patch } };
    writeSave(this.store, this.save);
    this.sound.setMuted(this.save.settings.muted);
    this.sound.setVolume(this.save.settings.volume);
  }

  private toggleMute(): void {
    this.updateSettings({ muted: !this.save.settings.muted });
    this.renderHud?.();
  }
```

7. Replace `onInput` with:

```ts
  private onInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    switch (input.dataset.setting) {
      case 'reducedMotion':
        return this.updateSettings({ reducedMotion: input.checked });
      case 'sound':
        return this.updateSettings({ muted: !input.checked });
      case 'volume':
        return this.updateSettings({ volume: Math.max(0, Math.min(1, Number(input.value) / 100)) });
    }
  }
```

8. Replace the settings template with:

```ts
        return `<main class="screen settings-screen"><h2>Settings</h2><label class="toggle"><input type="checkbox" data-setting="sound" ${this.save.settings.muted ? '' : 'checked'}> Sound</label><label class="toggle">Volume <input type="range" min="0" max="100" step="5" data-setting="volume" value="${Math.round(this.save.settings.volume * 100)}" aria-label="Volume"></label><label class="toggle"><input type="checkbox" data-setting="reducedMotion" ${this.save.settings.reducedMotion ? 'checked' : ''}> Reduce motion</label>${back}</main>`;
```

9. Replace the credits template with:

```ts
        return `<main class="screen credits-screen"><h2>Credits</h2><p>Design and direction: Ujjwal Kumar</p><p>Built with Phaser, Tone.js and TypeScript. Plants and soundtrack are generated in code.</p><p>Props rendered from 3D models by <a href="https://kenney.nl" target="_blank" rel="noopener">Kenney</a> (CC0).</p><p>Inspired by the mechanics of <em>Cloud Gardens</em> by Noio.</p>${back}</main>`;
```

In `src/main.ts`:
1. Import `{ ToneSound } from './audio/toneSound'`.
2. Create `const sound = new ToneSound();` and pass it as the sixth `App` argument.
3. Extend the DEV hook: `Object.assign(window as object, { afterlife: app, afterlifeGame: game, afterlifeSound: sound });`.

Add to `src/styles.css`:

```css
.settings-screen input[type='range'] { width: 180px; accent-color: var(--accent); }
.credits-screen a { color: var(--accent); }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run build 2>&1 | tail -6`
Expected: all tests pass. The build shows a separate Tone chunk (a `dist/assets/*.js` file other than `play-*.js`).

- [ ] **Step 7: Browser check** (dev server; launch Chrome with `--autoplay-policy=no-user-gesture-required` off, i.e. default)

1. Load `/play/`: `afterlifeSound.contextState` is `'locked'` and no Tone request has been made yet (no `tone` chunk in network).
2. Click Play: within 2 s, `contextState` is `'running'`.
3. Start Bus Stop and place a seed and a tyre: no console errors.
4. Press the 🔊 button: it becomes 🔇. Reload and click once: `contextState` is running, and the Destination is muted (`afterlifeSound['tone'].getDestination().mute === true`).
5. Settings: the volume slider and sound toggle reflect the saved values.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src tests
git commit -m "feat(audio): generative Tone.js soundtrack and effects with mute and volume"
```

---

### Task 4: Kenney models and the sprite render tool

**Files:**
- Create: `assets/kenney/…` (11 GLBs + colour maps), `assets/LICENSES/kenney-cc0.txt`, `tools/sprites/sprites.config.ts`, `tools/sprites/render.html`, `tools/sprites/render.ts`, `tools/sprites/run.ts`
- Generate (and commit): `public/sprites/<name>-r<0..3>.png`, `src/render/objects/sprites.json`
- Modify: `package.json` (dev deps + `sprites` script)

**Interfaces:**
- Produces:
  - `sprites.json`: `Record<string, { originY: number; topHeight: number; scale: number }>`. `originY` is the anchor as a fraction of image height; `topHeight` is the px above the ground at display scale; `scale` is the display scale (0.5, because images render at 2×).
  - PNG files at `public/sprites/<name>-r<k>.png` for k = 0..3.

- [ ] **Step 1: Install tool dependencies**

Run: `npm install -D three@0.186 @types/three@0.186 playwright-core`
Expected: added, no errors.

- [ ] **Step 2: Fetch the Kenney packs and copy the 11 models**

```bash
mkdir -p /tmp/kenney && cd /tmp/kenney
B=https://kenney.nl/media/pages/assets
curl -sLo car.zip $B/car-kit/1a312ec241-1775131960/kenney_car-kit.zip
curl -sLo roads.zip $B/city-kit-roads/74288c9459-1787042796/kenney_city-kit-roads.zip
curl -sLo industrial.zip $B/city-kit-industrial/0ec35b139d-1788171848/kenney_city-kit-industrial_2.0.zip
curl -sLo survival.zip $B/survival-kit/4065a8185b-1712149243/kenney_survival-kit.zip
curl -sLo furniture.zip $B/furniture-kit/440e0608a4-1677580847/kenney_furniture-kit.zip
for z in car roads industrial survival furniture; do mkdir -p $z && unzip -qo $z.zip -d $z; done
cd ~/Desktop/Afterlife
copy() { mkdir -p "assets/kenney/$1/Textures"; cp "/tmp/kenney/$2/Models/$3/$4" "assets/kenney/$1/"; [ -f "/tmp/kenney/$2/Models/$3/Textures/colormap.png" ] && cp "/tmp/kenney/$2/Models/$3/Textures/colormap.png" "assets/kenney/$1/Textures/"; true; }
copy car-kit car "GLB format" debris-tire.glb; copy car-kit car "GLB format" sedan.glb; copy car-kit car "GLB format" van.glb
copy city-kit-roads roads "GLB format" construction-cone.glb; copy city-kit-roads roads "GLB format" road-sign-warning.glb; copy city-kit-roads roads "GLB format" sign-highway.glb
copy city-kit-industrial industrial "GLB format" detail-tank.glb
copy survival-kit survival "GLB format" box.glb; copy survival-kit survival "GLB format" barrel.glb
copy furniture-kit furniture "GLTF format" bench.glb; copy furniture-kit furniture "GLTF format" trashcan.glb
mkdir -p assets/LICENSES && cp /tmp/kenney/car/License.txt assets/LICENSES/kenney-cc0.txt
find assets -type f | sort && grep -i "CC0\|Creative Commons Zero" assets/LICENSES/kenney-cc0.txt
```

Expected: 11 `.glb` files, 4 `colormap.png` files (none for furniture-kit, which uses material colours), and a licence line mentioning CC0. If a URL 404s, fetch the pack's page at `https://kenney.nl/assets/<pack>`, find the new zip link, and record the change.

- [ ] **Step 3: Create `tools/sprites/sprites.config.ts`**

```ts
export interface SpriteSpec {
  /** Object name used by levels and scrap (must match the engine / OBJECTS keys). */
  name: string;
  /** Path under assets/kenney/. */
  file: string;
  /** Largest horizontal extent, in tiles, after scaling. */
  footprint: number;
  /** Optional height cap in tiles (for tall, thin models like signs). */
  maxHeight?: number;
  /** Extra rotation in quarter turns to make the model face the same way as its code-drawn version. */
  yaw?: number;
}

export const SPRITES: SpriteSpec[] = [
  { name: 'tyre', file: 'car-kit/debris-tire.glb', footprint: 0.5 },
  { name: 'car', file: 'car-kit/sedan.glb', footprint: 0.95 },
  { name: 'old-car', file: 'car-kit/van.glb', footprint: 0.95 },
  { name: 'cone', file: 'city-kit-roads/construction-cone.glb', footprint: 0.4 },
  { name: 'sign', file: 'city-kit-roads/road-sign-warning.glb', footprint: 0.5, maxHeight: 0.9 },
  { name: 'station-sign', file: 'city-kit-roads/sign-highway.glb', footprint: 0.9, maxHeight: 1.0 },
  { name: 'water-tank', file: 'city-kit-industrial/detail-tank.glb', footprint: 0.85 },
  { name: 'crate', file: 'survival-kit/box.glb', footprint: 0.55 },
  { name: 'barrel', file: 'survival-kit/barrel.glb', footprint: 0.45 },
  { name: 'bench', file: 'furniture-kit/bench.glb', footprint: 0.8 },
  { name: 'bin', file: 'furniture-kit/trashcan.glb', footprint: 0.4 },
];
```

- [ ] **Step 4: Create `tools/sprites/render.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Afterlife sprite renderer</title>
  </head>
  <body style="background:#888">
    <p>Sprite renderer: run <code>npm run sprites</code> while <code>npm run dev</code> is running.</p>
    <script type="module" src="./render.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `tools/sprites/render.ts`**

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SPRITES } from './sprites.config';

/** A 1×1 ground tile must project to a 64 px wide diamond. */
const PX_PER_UNIT = 64 / Math.SQRT2;
/** Logical canvas size; rendered at RES× for crisp sprites. */
const SIZE = 160;
const RES = 2;
/** 30° elevation gives 2:1 diamonds. */
const ELEV = Math.PI / 6;
/** Ground origin sits this far down the image. */
const ORIGIN_Y = 0.75;

export interface RenderedSprite {
  name: string;
  rotation: number;
  dataUrl: string;
  originY: number;
  topHeight: number;
  scale: number;
}

async function renderAll(): Promise<RenderedSprite[]> {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(RES);
  renderer.setSize(SIZE, SIZE);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  const half = SIZE / 2 / PX_PER_UNIT;
  const camera = new THREE.OrthographicCamera(-half, half, (SIZE * ORIGIN_Y) / PX_PER_UNIT, (-SIZE * (1 - ORIGIN_Y)) / PX_PER_UNIT, 0.1, 100);
  // Grid +x maps to world +X and grid +y to world +Z when the camera sits on the (+X, +Z) diagonal.
  const d = 20;
  camera.position.set(d * Math.cos(ELEV) * Math.SQRT1_2, d * Math.sin(ELEV), d * Math.cos(ELEV) * Math.SQRT1_2);
  camera.lookAt(0, 0, 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b6458, 1.4));
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.6);
  sun.position.set(4, 10, 2);
  scene.add(sun);

  const loader = new GLTFLoader();
  const out: RenderedSprite[] = [];
  for (const spec of SPRITES) {
    const gltf = await loader.loadAsync(`/assets/kenney/${spec.file}`);
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = Math.min(spec.footprint / Math.max(size.x, size.z), (spec.maxHeight ?? 1.2) / size.y);
    model.scale.setScalar(s);
    const scaled = new THREE.Box3().setFromObject(model);
    const centre = scaled.getCenter(new THREE.Vector3());
    const pivot = new THREE.Group();
    model.position.set(-centre.x, -scaled.min.y, -centre.z);
    pivot.add(model);
    scene.add(pivot);
    const height = scaled.max.y - scaled.min.y;
    for (let k = 0; k < 4; k++) {
      // Grid rotation k maps offset (x, y) -> (-y, x): a turn of -90° about the vertical axis.
      pivot.rotation.y = -((k + (spec.yaw ?? 0)) * Math.PI) / 2;
      renderer.render(scene, camera);
      out.push({
        name: spec.name,
        rotation: k,
        dataUrl: renderer.domElement.toDataURL('image/png'),
        originY: ORIGIN_Y,
        topHeight: Math.round(height * Math.cos(ELEV) * PX_PER_UNIT),
        scale: 1 / RES,
      });
    }
    scene.remove(pivot);
  }
  return out;
}

Object.assign(window, { renderAll });
```

- [ ] **Step 6: Create `tools/sprites/run.ts`**

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.RENDER_URL ?? 'http://localhost:5173/tools/sprites/render.html';

interface Rendered {
  name: string;
  rotation: number;
  dataUrl: string;
  originY: number;
  topHeight: number;
  scale: number;
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[render page]', e.message));
  await page.goto(URL);
  await page.waitForFunction(() => 'renderAll' in window);
  const sprites = (await page.evaluate(() => (window as unknown as { renderAll: () => Promise<unknown> }).renderAll())) as Rendered[];
  mkdirSync('public/sprites', { recursive: true });
  const manifest: Record<string, { originY: number; topHeight: number; scale: number }> = {};
  for (const s of sprites) {
    writeFileSync(`public/sprites/${s.name}-r${s.rotation}.png`, Buffer.from(s.dataUrl.split(',')[1]!, 'base64'));
    manifest[s.name] = { originY: s.originY, topHeight: s.topHeight, scale: s.scale };
  }
  writeFileSync('src/render/objects/sprites.json', `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`rendered ${sprites.length} images for ${Object.keys(manifest).length} objects`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Add to `package.json` scripts: `"sprites": "tsx tools/sprites/run.ts"`.

- [ ] **Step 7: Render**

Run: `npm run dev` (background), then `npm run sprites`.
Expected: `rendered 44 images for 11 objects`. `ls public/sprites | wc -l` is 44, and `src/render/objects/sprites.json` has 11 keys.

- [ ] **Step 8: Visual check of the sprites**

Make a contact sheet: `cd public/sprites && python3 - <<'EOF'` with PIL if available; otherwise screenshot `/tools/sprites/render.html` after `renderAll`. Open 4–6 PNGs with the image viewer (Read tool). Check that:
- each object is whole, not clipped, and stands on the anchor;
- `bench-r0` faces the same way as the code-drawn bench (its back is toward the upper-left in rotation 0).

If a model faces the wrong way, set its `yaw` in the config and re-render. If one is clipped or tiny, adjust its `footprint` or `maxHeight`. Ledger each change.

- [ ] **Step 9: Typecheck and commit**

Run: `npm run typecheck && npm test`
Expected: all pass. The tools typecheck with the three.js types.

```bash
git add package.json package-lock.json assets tools/sprites public/sprites src/render/objects/sprites.json
git commit -m "feat(art): render Kenney CC0 models into 4-facing isometric sprites"
```

---

### Task 5: Sprite object art in the game

**Files:**
- Create: `src/render/objects/spriteArt.ts`
- Modify: `src/render/scene/DioramaScene.ts` (preload sprites and use the sprite art), `src/render/palette.ts` (`spriteTint`)
- Test: `tests/render/spriteArt.test.ts`

**Interfaces:**
- Consumes: `sprites.json` (Task 4); `ObjectArt` and `codeObjectArt` (Plan 2); `objectTopHeight`
- Produces: `type SpriteManifest = Record<string, { originY: number; topHeight: number; scale: number }>`; `spriteFor(manifest, name, rotation, base): { key: string; url: string; originY: number; scale: number } | null`; `spriteAssets(manifest, base): { key: string; url: string }[]`; `makeSpriteObjectArt(manifest, base): ObjectArt`

- [ ] **Step 1: Write the failing test** at `tests/render/spriteArt.test.ts`

```ts
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { spriteAssets, spriteFor, type SpriteManifest } from '../../src/render/objects/spriteArt';
import manifest from '../../src/render/objects/sprites.json';
import { hasObjectShape } from '../../src/render/objects/objectShapes';

const m = manifest as SpriteManifest;

describe('spriteFor', () => {
  it('builds sprite URLs from the base path and rotation', () => {
    const fixture: SpriteManifest = { tyre: { originY: 0.75, topHeight: 12, scale: 0.5 } };
    expect(spriteFor(fixture, 'tyre', 2, '/')).toEqual({ key: 'sprite-tyre-r2', url: '/sprites/tyre-r2.png', originY: 0.75, scale: 0.5 });
    expect(spriteFor(fixture, 'tyre', 0, '/game/')?.url).toBe('/game/sprites/tyre-r0.png');
  });
  it('falls back for unknown names', () => {
    expect(spriteFor(m, 'pump', 0, '/')).toBeNull();
    expect(spriteFor(m, 'piano', 0, '/')).toBeNull();
  });
});

describe('the generated manifest', () => {
  it('covers the 11 Kenney-matched objects, each a known object', () => {
    expect(Object.keys(m).sort()).toEqual(['barrel', 'bench', 'bin', 'car', 'cone', 'crate', 'old-car', 'sign', 'station-sign', 'tyre', 'water-tank']);
    for (const name of Object.keys(m)) expect(hasObjectShape(name), name).toBe(true);
  });
  it('every manifest sprite has 4 PNGs on disk', () => {
    for (const name of Object.keys(m)) for (let r = 0; r < 4; r++) expect(existsSync(`public/sprites/${name}-r${r}.png`), `${name}-r${r}`).toBe(true);
  });
  it('lists one preload asset per object and rotation', () => {
    expect(spriteAssets(m, '/')).toHaveLength(44);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/render/spriteArt.test.ts`
Expected: FAIL, with a module-not-found error for `src/render/objects/spriteArt`.

- [ ] **Step 3: Create `src/render/objects/spriteArt.ts`**

```ts
import type Phaser from 'phaser';
import type { Rotation } from '../iso/projection';
import { PALETTE } from '../palette';
import { codeObjectArt, type ObjectArt } from './objectArt';
import { objectTopHeight } from './objectShapes';

export type SpriteManifest = Record<string, { originY: number; topHeight: number; scale: number }>;

export function spriteFor(manifest: SpriteManifest, name: string, rotation: Rotation | number, base: string): { key: string; url: string; originY: number; scale: number } | null {
  const entry = Object.hasOwn(manifest, name) ? manifest[name] : undefined;
  if (!entry) return null;
  return { key: `sprite-${name}-r${rotation}`, url: `${base}sprites/${name}-r${rotation}.png`, originY: entry.originY, scale: entry.scale };
}

export function spriteAssets(manifest: SpriteManifest, base: string): { key: string; url: string }[] {
  return Object.keys(manifest).flatMap((name) => [0, 1, 2, 3].map((r) => spriteFor(manifest, name, r, base)!)).map(({ key, url }) => ({ key, url }));
}

/** Kenney sprites where we have them, code-drawn shapes otherwise (and if a texture failed to load). */
export function makeSpriteObjectArt(manifest: SpriteManifest, base: string): ObjectArt {
  return {
    create(scene: Phaser.Scene, x: number, y: number, name: string, rotation: Rotation) {
      const s = spriteFor(manifest, name, rotation, base);
      if (!s || !scene.textures.exists(s.key)) return codeObjectArt.create(scene, x, y, name, rotation);
      return scene.add.image(x, y, s.key).setOrigin(0.5, s.originY).setScale(s.scale).setTint(PALETTE.spriteTint);
    },
    topHeight(name: string) {
      return Object.hasOwn(manifest, name) ? manifest[name]!.topHeight : objectTopHeight(name);
    },
  };
}
```

In `src/render/palette.ts`, add `spriteTint: 0xe8e0d2,` to `PALETTE`. This is a warm grey multiply that settles Kenney's bright colours into the dusty palette.

- [ ] **Step 4: Use the sprite art in `DioramaScene`**

1. Add the imports `import manifest from '../objects/sprites.json';` and `import { makeSpriteObjectArt, spriteAssets, type SpriteManifest } from '../objects/spriteArt';`.
2. Replace `private readonly art: ObjectArt = codeObjectArt;` with `private readonly art: ObjectArt = makeSpriteObjectArt(manifest as SpriteManifest, import.meta.env.BASE_URL);`.
3. Remove `codeObjectArt` from the objectArt import if it is now unused (keep `drawBlock`, `ObjectArt`).
4. Add the method:

```ts
  preload(): void {
    for (const { key, url } of spriteAssets(manifest as SpriteManifest, import.meta.env.BASE_URL)) this.load.image(key, url);
    this.load.on('loaderror', (file: { key: string }) => console.warn('[Afterlife] sprite failed to load, using drawn shape:', file.key));
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test && npm run typecheck && npm run build 2>&1 | tail -4`
Expected: all pass. The build copies `public/sprites` into `dist/sprites` (`ls dist/sprites | wc -l` is 44).

- [ ] **Step 6: Browser check**

In the dev server:
1. Screenshot every level at rotation 0, plus Bus Stop at rotations 1–3. Kenney props appear for the 11 objects, the other 7 stay code-drawn, nothing floats or sinks, and plants on top of sprites sit at the sprite top.
2. Rename one PNG temporarily (`mv public/sprites/tyre-r0.png /tmp/`), reload, and place a tyre: the code-drawn tyre appears and the console shows the warning. Restore the file.
3. No console errors.

If tint or scale look wrong next to the code-drawn objects, adjust `spriteTint` or a sprite's `footprint` (then re-run `npm run sprites`) and ledger it.

- [ ] **Step 7: Commit**

```bash
git add src tests
git commit -m "feat(render): use Kenney sprites for matched objects with code-drawn fallback"
```

---

### Task 6: Landing page, icon and share image

**Files:**
- Create: `public/favicon.svg`, `src/landing.css`, `tools/capture-hero.ts`, `public/hero.png`, `public/og.png`
- Modify: `index.html` (replace the redirect), `play/index.html` (icon link), `README.md`, `package.json` (`hero` script)

**Interfaces:**
- Produces: the landing page at `/` linking to `play/`; `favicon.svg` used by both pages; `og.png` (1200×630) for link previews.

- [ ] **Step 1: Create `public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#23251f"/>
  <path d="M14 44 L32 35 L50 44 L32 53 Z" fill="#6b5f52"/>
  <path d="M14 44 L32 53 L32 57 L14 48 Z" fill="#4a4239"/>
  <path d="M50 44 L32 53 L32 57 L50 48 Z" fill="#3b342d"/>
  <path d="M32 44 C31 34 33 26 38 18" stroke="#9cc25a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
  <ellipse cx="41" cy="20" rx="8" ry="4.5" transform="rotate(-35 41 20)" fill="#9cc25a"/>
  <ellipse cx="27" cy="29" rx="7" ry="3.8" transform="rotate(30 27 29)" fill="#89a94a"/>
</svg>
```

- [ ] **Step 2: Create `tools/capture-hero.ts`** (with the dev server running)

```ts
import { chromium } from 'playwright-core';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.BASE_URL_OVERRIDE ?? 'http://localhost:5173';

async function capture(width: number, height: number, out: string): Promise<void> {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${BASE}/play/`);
  await page.waitForFunction(() => 'afterlife' in window);
  await page.evaluate(() => {
    const app = (window as unknown as { afterlife: { startLevel(i: number): void; controller: { level: { solution: unknown[] }; play(m: unknown): void; keepDecorating(): void; rotate(d: number): void } } }).afterlife;
    app.startLevel(4);
    for (const m of app.controller.level.solution) app.controller.play(m);
    app.controller.keepDecorating();
  });
  await page.waitForTimeout(2600);
  await page.addStyleTag({ content: '#ui { display: none !important; }' });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out });
  await browser.close();
}

async function main(): Promise<void> {
  await capture(1600, 900, 'public/hero.png');
  await capture(1200, 630, 'public/og.png');
  console.log('wrote public/hero.png and public/og.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Add to `package.json` scripts: `"hero": "tsx tools/capture-hero.ts"`. Run `npm run hero`.
Expected: both PNGs are written. View `public/hero.png`: it shows a lush, restored Playground with no interface.

- [ ] **Step 3: Replace `index.html` with the landing page**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#23251f" />
    <title>Afterlife — a calm game about nature reclaiming abandoned places</title>
    <meta name="description" content="Plant seeds among the ruins, drop scrap to feed them, and watch moss, vines, flowers and bamboo take the scene back. Free to play in your browser." />
    <meta property="og:title" content="Afterlife" />
    <meta property="og:description" content="A calm isometric game about nature reclaiming abandoned places. Play free in your browser." />
    <meta property="og:image" content="og.png" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/src/landing.css" />
  </head>
  <body>
    <header class="hero">
      <img class="hero-img" src="hero.png" alt="A small isometric playground overgrown with moss, vines and flowers" />
      <div class="hero-text">
        <h1>Afterlife</h1>
        <p class="tagline">Nature takes back what we left behind.</p>
        <a class="play" href="play/">Play in your browser</a>
        <p class="note">Free · No sign-up · Works on phones</p>
      </div>
    </header>
    <main>
      <section class="how">
        <h2>How it plays</h2>
        <ol>
          <li><strong>Plant seeds</strong> among the ruins: moss, vines, flowers and bamboo.</li>
          <li><strong>Drop scrap</strong> nearby. Every plant inside its ring grows a step.</li>
          <li><strong>Cover the scene</strong>, scrap included, until the place is restored. No timer, no losing, always an undo.</li>
        </ol>
      </section>
      <section class="places">
        <h2>Five quiet places</h2>
        <p>Bus Stop · Rooftop · Petrol Station · Railway Platform · Playground</p>
      </section>
      <section class="made">
        <h2>How it's made</h2>
        <p>Built with Phaser 4 and TypeScript. Every plant is drawn in code, so no two gardens look alike, and the soundtrack is generated live with Tone.js and blooms as the garden grows. Props are rendered from <a href="https://kenney.nl">Kenney</a>'s CC0 3D models.</p>
        <p><a href="https://github.com/Ujjwalkumar-pm/afterlife">Source code on GitHub</a></p>
      </section>
    </main>
    <footer>
      <p>Design and direction: Ujjwal Kumar · Inspired by the mechanics of <em>Cloud Gardens</em> by Noio.</p>
    </footer>
  </body>
</html>
```

- [ ] **Step 4: Create `src/landing.css`**

```css
@import '@fontsource/nunito/400.css';
@import '@fontsource/nunito/700.css';
:root { --bg: #23251f; --ink: #f1ede2; --muted: #b9b4a5; --accent: #9cc25a; --accent-ink: #1d2416; font-family: 'Nunito', system-ui, sans-serif; color: var(--ink); }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); line-height: 1.6; }
a { color: var(--accent); }
.hero { position: relative; min-height: 88vh; display: grid; place-items: center; overflow: hidden; }
.hero-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0.55; }
.hero-text { position: relative; text-align: center; padding: 24px 16px; }
.hero h1 { font-size: clamp(56px, 14vw, 120px); margin: 0; letter-spacing: 0.04em; line-height: 1; }
.tagline { font-size: clamp(18px, 3vw, 24px); color: var(--ink); margin: 12px 0 28px; }
.play { display: inline-block; background: var(--accent); color: var(--accent-ink); font-weight: 700; font-size: 20px; padding: 14px 32px; border-radius: 999px; text-decoration: none; }
.play:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
.note { color: var(--muted); margin-top: 14px; font-size: 15px; }
main { max-width: 760px; margin: 0 auto; padding: 24px 16px 8px; }
section { margin: 40px 0; }
h2 { font-size: 26px; margin: 0 0 10px; }
ol { padding-left: 22px; }
li { margin: 8px 0; }
footer { max-width: 760px; margin: 0 auto; padding: 24px 16px 48px; color: var(--muted); font-size: 14px; }
```

- [ ] **Step 5: Point `play/index.html` at the icon**

Replace `<link rel="icon" href="data:," />` with `<link rel="icon" href="../favicon.svg" type="image/svg+xml" />`. In the root `index.html` it is already `favicon.svg`.

- [ ] **Step 6: Update `README.md`**

Replace the status line with `> Play it: **(live link added at launch)** · v1 complete: 5 places, generative soundtrack, Kenney props.`. Add `![Afterlife](public/hero.png)` under the title. Under Credits, change the art line to `- Props rendered from [Kenney](https://kenney.nl) CC0 3D models (licence in assets/LICENSES/); plants and ground are drawn in code.`, and add `- Soundtrack generated live with Tone.js.`. Under Development, add `npm run dev`, `npm run sprites` and `npm run hero` lines with one-line explanations.

- [ ] **Step 7: Build and browser check**

Run: `npm run build 2>&1 | tail -4`. Open `/` (dev or preview) at 1280×800 and 390×844:
- the hero image, title and Play button are visible above the fold;
- there is no horizontal scroll at 390;
- Play opens `/play/`;
- the favicon loads on both pages;
- there are no console errors.

Screenshot both sizes.

- [ ] **Step 8: Commit**

```bash
git add index.html play/index.html src/landing.css public/favicon.svg public/hero.png public/og.png tools/capture-hero.ts package.json README.md
git commit -m "feat(site): landing page, icon and share image"
```

---

### Task 7: Launch on Vercel

**Files:**
- Create: `vercel.json`
- Modify: `README.md` (live link), `docs/superpowers/specs/2026-10-03-afterlife-design.md` (status: v1 shipped)

**Interfaces:**
- Produces: a public production URL (`https://<project>.vercel.app/`), with the game at `/play/`.

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

- [ ] **Step 2: Final suite and production build**

Run: `npm test && npm run build && cat dist/assets/play-*.js dist/assets/play-*.css | gzip -c | wc -c`
Expected: all pass, and the play-page initial JS+CSS is under 3,000,000 bytes compressed (the Tone chunk is lazy and excluded).

- [ ] **Step 3: Commit and push**

```bash
git add vercel.json && git commit -m "chore: Vercel config"
git push
```

- [ ] **Step 4: Deploy**

1. **Preferred:** the Vercel connector. Check auth (`get_auth_user`), find the team (`list_teams`), and create a project from the GitHub repo `Ujjwalkumar-pm/afterlife` with framework Vite and project name `afterlife`. Production then deploys from `main`, and future pushes redeploy automatically.
2. **Fallback**, if the connector isn't authorised: ask Ujjwal to run `! vercel login` once. Then run `vercel link --yes --project afterlife` followed by `vercel deploy --prod --yes`.

Expected either way: a production URL.

- [ ] **Step 5: Live check** (headless Chrome against the production URL)

1. The landing page loads and the hero image shows.
2. Play goes to `/play/`. Click Play, Bus Stop, then a Moss tray button, then a canvas tile near the board centre: a seed is placed (the tray count drops).
3. Listen for failed requests (`response.status() >= 400`): there must be none (sprites, fonts and the Tone chunk after the first click).
4. No console errors.
5. Fetch `/og.png` and `/favicon.svg`: both return 200.

Screenshot the live landing page and game.

- [ ] **Step 6: Record the launch**

1. In `README.md`, replace `(live link added at launch)` with the production URL.
2. Add the URL to the GitHub repo website field: `gh repo edit --homepage <url>`.
3. In the spec header, set the status to `v1 shipped <date> — <url>`.
4. Commit and push:

```bash
git add README.md docs/superpowers/specs/2026-10-03-afterlife-design.md
git commit -m "docs: v1 launched"
git push
```
