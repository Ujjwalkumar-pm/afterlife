# Afterlife v1.3 — Story, Pip & Three New Places Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 25-second animated story before the first game, Pip the mossy robot as an on-screen companion, and three new levels (Laundromat, Bus Depot, Rooftop Garden).

**Architecture:**
- **Story:** an HTML/SVG overlay (`StoryPlayer`) owned by `App`, driven by timers and CSS states keyed on `data-beat`. No Phaser and no new assets.
- **Pip:** a pure rule function (`pipFor`) picks a mood and line from each change. The HUD shows Pip in its own persistent element beside the HUD markup.
- **Levels:** JSON files solved by the existing beam solver. New ruins get code-drawn shapes, and the washer and dryer also get Kenney sprites.

**Tech Stack:** TypeScript 7, Vite 8, Vitest 5 with happy-dom, Phaser 4 (unchanged), playwright-core for browser checks.

**Spec:** `docs/superpowers/specs/2026-10-03-afterlife-v1.3-design.md`

## Global Constraints

- The engine rules don't change (`src/engine/**` stays untouched).
- No new runtime dependencies. The initial download stays under 3 MB gz.
- **Story:** 5 beats of 5 s each (25 s in total, under 30 s). The captions are exactly:
  1. "The city went quiet."
  2. "People left. The machines fell asleep."
  3. "Years later, the wind carried a seed."
  4. "Something woke up… and remembered how to grow."
  5. "Bring life back, one place at a time."
- **Pip lines** are exactly:
  - "We did it! Look at it bloom."
  - "Let's undo a little and try again."
  - "Here — more seeds and a tyre!"
  - the combo label
  - "The place is waking up!"
  - "Try the glowing spot!"
- Pip lines last 2.5 s (`PIP_LINE_MS = 2500`).
- Save key stays `afterlife.save.v1`. It gains `storySeen: boolean` (default false).
- **Level order:** bus-stop, rooftop, petrol-station, railway-platform, playground, laundromat, bus-depot, rooftop-garden.
- **Tuning:** each new level must be solver-proven and must pass the hint-only beginner test (≤ 8 bonus packs). If one fails, add seeds or batches, or lower the target in 0.05 steps (never below 0.45), and ledger it.
- **Reduce motion** (setting or system): no story movement and no Pip bob, hop or wave. Captions, Pip and lines still show.
- **Commits** end with:
  ```
  Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01ELR9n5ytx7LUjWV7Bu2vxY
  ```

## Review Focus

1. **Leaving mid-story** (startLevel, or any navigation while beats are pending): no late `onDone` may navigate away from where the player now is. *Task 5 test.*
2. **Storage that cannot be written** (null or read-only store): the story must still end and lead on, and must not loop within the session. *Task 5 test.*
3. **Skip then Begin, or a double tap:** `onDone` fires exactly once. *Task 3 test.*
4. **A HUD redraw while Pip is speaking** must not wipe or restart the line. *Task 4 test.*
5. **Playground → Next:** the old last level must now offer "Next place" and lead to the Laundromat. *Task 7 test.*

---

### Task 1: Save `storySeen`

**Files:**
- Modify: `src/save/save.ts`
- Test: `tests/save/save.test.ts`

**Interfaces:**
- Produces: `SaveData.storySeen: boolean`; `defaultSave().storySeen === false`.

- [ ] **Step 1: Write the failing test.** Append inside `describe('save', …)`:

```ts
  it('storySeen defaults to false, round-trips, and old saves load as false', () => {
    expect(defaultSave().storySeen).toBe(false);
    const store = memoryStore();
    writeSave(store, { ...defaultSave(), storySeen: true });
    expect(loadSave(store).storySeen).toBe(true);
    const old = memoryStore({ [SAVE_KEY]: JSON.stringify({ version: 1, completed: ['bus-stop'], tutorialDone: true, settings: {} }) });
    expect(loadSave(old).storySeen).toBe(false);
    expect(loadSave(memoryStore({ [SAVE_KEY]: JSON.stringify({ version: 1, storySeen: 'yes' }) })).storySeen).toBe(false);
  });
```

- [ ] **Step 2: Run it and watch it fail.**
  - Run: `npx vitest run tests/save/save.test.ts`
  - Expected: FAIL, `expected undefined to be false`.

- [ ] **Step 3: Implement.** In `src/save/save.ts`:
  - Add `storySeen: boolean;` after `tutorialDone: boolean;` in `SaveData`.
  - Add `storySeen: false,` after `tutorialDone: false,` in `defaultSave`.
  - Add `storySeen: d.storySeen === true,` after `tutorialDone: d.tutorialDone === true,` in `loadSave`.

- [ ] **Step 4: Run it and watch it pass.**
  - Run: `npx vitest run tests/save/save.test.ts`
  - Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/save/save.ts tests/save/save.test.ts
git commit -m "feat(save): remember whether the story was seen"
```

---

### Task 2: Pip's rules and drawing

**Files:**
- Create: `src/game/pip.ts`, `src/ui/pip.ts`
- Test: `tests/game/pip.test.ts`, `tests/ui/pip.test.ts`

**Interfaces:**
- Consumes: `comboFor` (`src/game/scoring.ts`); `Overlay` (`src/game/controller.ts`); `GameEvent` (`src/engine`).
- Produces:
  - `type PipMood = 'idle' | 'point' | 'cheer' | 'wave' | 'sleep'`
  - `interface PipSay { mood: PipMood; line: string | null }`
  - `interface PipContext { newOverlay: Overlay; tutorial: boolean; events: GameEvent[]; milestone: boolean; hint: boolean }`
  - `pipFor(c: PipContext): PipSay`
  - In `src/ui/pip.ts`: `PIP_INNER: string` (an SVG `<g>` in a 64×64 box) and `pipSvg(): string`.

- [ ] **Step 1: Write the failing tests.** Create `tests/game/pip.test.ts`:

```ts
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
```

Create `tests/ui/pip.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PIP_INNER, pipSvg } from '../../src/ui/pip';

describe('pipSvg', () => {
  it('is a decorative 64×64 drawing with two eyes, a sprout leaf and two arms', () => {
    const svg = pipSvg();
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg.match(/class="pip-eye"/g)).toHaveLength(2);
    expect(svg).toContain('class="pip-leaf"');
    expect(svg).toContain('pip-arm-l');
    expect(svg).toContain('pip-arm-r');
  });
  it('shares one figure between the HUD and the story', () => {
    expect(PIP_INNER.startsWith('<g class="pip-figure">')).toBe(true);
    expect(pipSvg()).toContain(PIP_INNER);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**
  - Run: `npx vitest run tests/game/pip.test.ts tests/ui/pip.test.ts`
  - Expected: FAIL, because the modules `../../src/game/pip` and `../../src/ui/pip` can't be resolved.

- [ ] **Step 3: Implement.** Create `src/game/pip.ts`:

```ts
import type { GameEvent } from '../engine';
import type { Overlay } from './controller';
import { comboFor } from './scoring';

export type PipMood = 'idle' | 'point' | 'cheer' | 'wave' | 'sleep';
export interface PipSay {
  mood: PipMood;
  line: string | null;
}
export interface PipContext {
  /** The overlay that appeared with this change, or 'none'. */
  newOverlay: Overlay;
  tutorial: boolean;
  events: GameEvent[];
  milestone: boolean;
  hint: boolean;
}

/** What Pip does and says about a change. The first matching rule wins. */
export function pipFor(c: PipContext): PipSay {
  if (c.newOverlay === 'restored') return { mood: 'wave', line: 'We did it! Look at it bloom.' };
  if (c.newOverlay === 'rests') return { mood: 'idle', line: "Let's undo a little and try again." };
  if (c.tutorial) return { mood: 'point', line: null };
  if (c.events.some((e) => e.type === 'bonus')) return { mood: 'cheer', line: 'Here — more seeds and a tyre!' };
  const combo = comboFor(c.events);
  if (combo) return { mood: 'cheer', line: combo.label };
  if (c.milestone) return { mood: 'cheer', line: 'The place is waking up!' };
  if (c.hint) return { mood: 'point', line: 'Try the glowing spot!' };
  return { mood: 'idle', line: null };
}
```

Create `src/ui/pip.ts`:

```ts
/** Pip, the mossy robot, in a 64×64 box. Mood classes on a parent animate it (see styles.css). */
export const PIP_INNER = `<g class="pip-figure">
<line x1="32" y1="14" x2="32" y2="6" stroke="#5a6468" stroke-width="2" stroke-linecap="round"/>
<path class="pip-leaf" d="M32 6 C34 0 40 -1 43 2 C39 7 35 7 32 6Z" fill="#7aa04a"/>
<rect x="18" y="13" width="28" height="21" rx="9" fill="#8b979c"/>
<rect x="21" y="18" width="22" height="11" rx="5" fill="#2e2c2a"/>
<circle class="pip-eye" cx="27" cy="23.5" r="3.2" fill="#fff3b0"/>
<circle class="pip-eye" cx="37" cy="23.5" r="3.2" fill="#fff3b0"/>
<path d="M18 22 C17 17 21 13 26 14 C22 16 20 19 18 22Z" fill="#6f8f3a"/>
<rect class="pip-arm pip-arm-l" x="11" y="37" width="9" height="5" rx="2.5" fill="#5a6468"/>
<rect class="pip-arm pip-arm-r" x="44" y="37" width="9" height="5" rx="2.5" fill="#5a6468"/>
<rect x="20" y="34" width="24" height="20" rx="8" fill="#7b836c"/>
<path d="M21 41 C24 36 30 37 32 40 C28 43 24 43 21 41Z" fill="#6f8f3a"/>
<path d="M33 49 C36 46 41 46 43 49 C40 52 36 52 33 49Z" fill="#89a94a"/>
<circle cx="38" cy="40" r="1.6" fill="#89a94a"/>
<rect x="23" y="54" width="6" height="6" rx="2" fill="#5a6468"/>
<rect x="35" y="54" width="6" height="6" rx="2" fill="#5a6468"/>
</g>`;

export const pipSvg = (): string => `<svg class="pip-svg" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true" focusable="false">${PIP_INNER}</svg>`;
```

- [ ] **Step 4: Run them and watch them pass.**
  - Run: `npx vitest run tests/game/pip.test.ts tests/ui/pip.test.ts`
  - Expected: PASS (10 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/game/pip.ts src/ui/pip.ts tests/game/pip.test.ts tests/ui/pip.test.ts
git commit -m "feat(pip): Pip's mood rules and drawing"
```

---

### Task 3: The story player

**Files:**
- Create: `src/ui/story.ts`
- Modify: `src/styles.css` (append the story and Pip styles)
- Test: `tests/ui/story.test.ts`

**Interfaces:**
- Consumes: `PIP_INNER` (Task 2).
- Produces:
  - `STORY_BEATS: { caption: string; ms: number }[]`
  - `storyLength(): number`
  - `storySvg(): string`
  - `class StoryPlayer { constructor(root: HTMLElement, opts: { onDone(): void; onBeat?(beat: number): void }); beat: number; el: HTMLElement; destroy(): void }`
  - **DOM hooks:** `.story[data-beat]`, `.story-caption` (aria-live), `[data-story="skip"]`, `[data-story="begin"]` (hidden until beat 5).

- [ ] **Step 1: Write the failing test.** Create `tests/ui/story.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORY_BEATS, StoryPlayer, storyLength, storySvg } from '../../src/ui/story';

let root: HTMLElement;
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="ui"></div>';
  root = document.getElementById('ui')!;
});
afterEach(() => vi.useRealTimers());
const caption = () => root.querySelector('.story-caption')!.textContent;
const begin = () => root.querySelector<HTMLButtonElement>('[data-story="begin"]')!;

describe('story beats', () => {
  it('has five 5-second beats, under 30 s in total, with the agreed captions', () => {
    expect(STORY_BEATS.map((b) => b.caption)).toEqual([
      'The city went quiet.',
      'People left. The machines fell asleep.',
      'Years later, the wind carried a seed.',
      'Something woke up… and remembered how to grow.',
      'Bring life back, one place at a time.',
    ]);
    expect(STORY_BEATS.every((b) => b.ms === 5000)).toBe(true);
    expect(storyLength()).toBe(25000);
    expect(storyLength()).toBeLessThan(30000);
  });
  it('draws the scene with Pip in it', () => {
    const svg = storySvg();
    expect(svg).toContain('class="story-scene"');
    expect(svg).toContain('class="story-pip"');
    expect(svg).toContain('class="pip-figure"');
    expect(svg).toContain('class="story-seed"');
  });
});

describe('StoryPlayer', () => {
  it('plays beat by beat, then waits on the last beat for Tap to begin', () => {
    const onBeat = vi.fn();
    const p = new StoryPlayer(root, { onDone: vi.fn(), onBeat });
    expect(p.beat).toBe(1);
    expect(root.querySelector('.story')!.getAttribute('data-beat')).toBe('1');
    expect(caption()).toBe('The city went quiet.');
    expect(begin().hidden).toBe(true);
    vi.advanceTimersByTime(5000);
    expect(caption()).toBe('People left. The machines fell asleep.');
    vi.advanceTimersByTime(15000);
    expect(p.beat).toBe(5);
    expect(begin().hidden).toBe(false);
    vi.advanceTimersByTime(60000);
    expect(p.beat).toBe(5);
    expect(onBeat.mock.calls.map((c) => c[0])).toEqual([1, 2, 3, 4, 5]);
  });
  it('is a labelled dialog with Skip focused and the caption in a live region', () => {
    new StoryPlayer(root, { onDone: vi.fn() });
    const el = root.querySelector('.story')!;
    expect(el.getAttribute('role')).toBe('dialog');
    expect(el.getAttribute('aria-label')).toBe('Story');
    expect(root.querySelector('.story-caption')!.getAttribute('aria-live')).toBe('polite');
    expect(document.activeElement).toBe(root.querySelector('[data-story="skip"]'));
  });
  it('Skip ends it at once and removes it; later timers do nothing', () => {
    const onDone = vi.fn();
    new StoryPlayer(root, { onDone });
    (root.querySelector('[data-story="skip"]') as HTMLElement).click();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(root.querySelector('.story')).toBeNull();
    vi.advanceTimersByTime(30000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
  it('Tap to begin ends it once, even when tapped twice or after Esc', () => {
    const onDone = vi.fn();
    new StoryPlayer(root, { onDone });
    vi.advanceTimersByTime(20000);
    const b = begin();
    b.click();
    b.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
  it('Esc skips', () => {
    const onDone = vi.fn();
    new StoryPlayer(root, { onDone });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
  it('destroy stops it without calling onDone', () => {
    const onDone = vi.fn();
    const p = new StoryPlayer(root, { onDone });
    p.destroy();
    vi.advanceTimersByTime(30000);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onDone).not.toHaveBeenCalled();
    expect(root.querySelector('.story')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail.**
  - Run: `npx vitest run tests/ui/story.test.ts`
  - Expected: FAIL, because `../../src/ui/story` can't be resolved.

- [ ] **Step 3: Implement.** Create `src/ui/story.ts`:

```ts
import { PIP_INNER } from './pip';

export interface StoryBeat {
  caption: string;
  ms: number;
}

export const STORY_BEATS: StoryBeat[] = [
  { caption: 'The city went quiet.', ms: 5000 },
  { caption: 'People left. The machines fell asleep.', ms: 5000 },
  { caption: 'Years later, the wind carried a seed.', ms: 5000 },
  { caption: 'Something woke up… and remembered how to grow.', ms: 5000 },
  { caption: 'Bring life back, one place at a time.', ms: 5000 },
];

export const storyLength = (): number => STORY_BEATS.reduce((n, b) => n + b.ms, 0);

/** One scene for all beats; CSS on `.story[data-beat]` decides what shows and moves. */
export function storySvg(): string {
  const rain = Array.from({ length: 28 }, (_, i) => {
    const x = ((i * 37) % 380) - 10;
    const y = (i * 53) % 200;
    return `<line x1="${x}" y1="${y}" x2="${x - 4}" y2="${y + 10}" style="animation-delay:-${(i % 9) / 10}s"/>`;
  }).join('');
  return `<svg class="story-scene" viewBox="0 0 360 240" preserveAspectRatio="xMidYMid meet" role="img" aria-label="A quiet, empty city where a small robot finds a seed">
<rect class="story-sky" width="360" height="240"/>
<g class="story-city" fill="#3a3d3a"><rect x="10" y="90" width="44" height="110"/><rect x="62" y="60" width="36" height="140"/><rect x="106" y="105" width="50" height="95"/><rect x="214" y="70" width="40" height="130"/><rect x="262" y="100" width="56" height="100"/><rect x="322" y="80" width="30" height="120"/></g>
<g class="story-windows" fill="#4a4e48"><rect x="70" y="72" width="8" height="10"/><rect x="84" y="72" width="8" height="10"/><rect x="70" y="92" width="8" height="10"/><rect x="222" y="84" width="8" height="10"/><rect x="238" y="104" width="8" height="10"/><rect x="272" y="112" width="10" height="8"/></g>
<g class="story-rain">${rain}</g>
<rect class="story-ground" y="196" width="360" height="44" fill="#4a4237"/>
<g class="story-moss" fill="#6f8f3a"><ellipse cx="60" cy="200" rx="30" ry="5"/><ellipse cx="250" cy="201" rx="40" ry="6"/><ellipse cx="320" cy="199" rx="22" ry="4"/></g>
<g class="story-junk"><rect x="110" y="178" width="22" height="20" fill="#8c6a48"/><rect x="108" y="175" width="26" height="4" fill="#6b4f35"/><ellipse cx="226" cy="194" rx="14" ry="5" fill="#2e2c2a"/><ellipse cx="226" cy="189" rx="14" ry="5" fill="#2e2c2a"/><ellipse cx="226" cy="189" rx="6" ry="2" fill="#1b1a19"/></g>
<g class="story-pip" transform="translate(148 138)">${PIP_INNER}</g>
<g class="story-sprout" transform="translate(196 174)"><path d="M0 22 C0 14 1 8 0 0" stroke="#4a6b2a" stroke-width="2.5" fill="none"/><path d="M0 8 C-8 2 -12 6 -12 10 C-6 12 -2 10 0 8Z" fill="#4f8a3c"/><path d="M0 4 C8 -2 12 2 12 6 C6 8 2 6 0 4Z" fill="#58934a"/></g>
<circle class="story-seed" cx="196" cy="194" r="4" fill="#f3e6a0"/>
<text class="story-title" x="180" y="48" text-anchor="middle" font-size="34" font-weight="800" fill="#f1ede2">Afterlife</text>
</svg>`;
}

export interface StoryOptions {
  onDone(): void;
  onBeat?(beat: number): void;
}

/** The intro story: five timed beats, then it waits on the last one. Skip, Tap to begin or Esc end it. */
export class StoryPlayer {
  readonly el: HTMLElement;
  beat = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private finished = false;
  private readonly onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.finish();
  };

  constructor(
    root: HTMLElement,
    private readonly opts: StoryOptions,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'story';
    this.el.setAttribute('role', 'dialog');
    this.el.setAttribute('aria-modal', 'true');
    this.el.setAttribute('aria-label', 'Story');
    this.el.innerHTML = `${storySvg()}<p class="story-caption" aria-live="polite"></p><button class="story-skip" data-story="skip">Skip</button><button class="story-begin primary" data-story="begin" hidden>Tap to begin</button>`;
    this.el.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-story]')) this.finish();
    });
    document.addEventListener('keydown', this.onKey);
    root.appendChild(this.el);
    this.go(1);
    this.el.querySelector<HTMLElement>('[data-story="skip"]')?.focus();
  }

  private go(n: number): void {
    this.beat = n;
    this.el.dataset.beat = String(n);
    this.el.querySelector('.story-caption')!.textContent = STORY_BEATS[n - 1]!.caption;
    this.opts.onBeat?.(n);
    if (n === STORY_BEATS.length) {
      const begin = this.el.querySelector<HTMLButtonElement>('[data-story="begin"]')!;
      begin.hidden = false;
      begin.focus();
      return;
    }
    this.timer = setTimeout(() => this.go(n + 1), STORY_BEATS[n - 1]!.ms);
  }

  private finish(): void {
    if (this.finished) return;
    this.destroy();
    this.opts.onDone();
  }

  /** Stops the story without ending it (no onDone), e.g. when the app navigates away. */
  destroy(): void {
    this.finished = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    document.removeEventListener('keydown', this.onKey);
    this.el.remove();
  }
}
```

Append to `src/styles.css`:

```css
/* v1.3 story */
#ui .story { pointer-events: auto; }
.story { position: absolute; inset: 0; background: #1d1f1a; display: grid; place-items: center; animation: fade-in 400ms ease-out; }
.story-scene { width: min(100%, 720px); max-height: 72vh; }
.story-caption { position: absolute; left: 16px; right: 16px; bottom: calc(max(24px, env(safe-area-inset-bottom)) + 72px); margin: 0 auto; max-width: 560px; text-align: center; font-size: clamp(18px, 4.6vw, 24px); font-weight: 700; text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6); }
.story-skip { position: absolute; top: max(12px, env(safe-area-inset-top)); right: 12px; }
.story-begin { position: absolute; left: 50%; bottom: max(24px, env(safe-area-inset-bottom)); transform: translateX(-50%); animation: fade-in 600ms ease-out 1.2s both; }
.story-begin[hidden] { display: none; }
.story-sky { fill: #2b3036; transition: fill 3s ease; }
.story[data-beat="3"] .story-sky, .story[data-beat="4"] .story-sky { fill: #3b4a3e; }
.story[data-beat="5"] .story-sky { fill: #7a6a45; }
.story-rain line { stroke: #8a8a84; stroke-width: 1.5; opacity: 0.5; animation: story-rain 0.9s linear infinite; }
.story[data-beat="3"] .story-rain, .story[data-beat="4"] .story-rain, .story[data-beat="5"] .story-rain { display: none; }
.story-pip { opacity: 0; transition: opacity 1s ease; }
.story:not([data-beat="1"]) .story-pip { opacity: 1; }
.story[data-beat="2"] .pip-eye, .story[data-beat="3"] .pip-eye { fill: #5a6468; animation: none; }
.story-seed, .story-sprout, .story-moss, .story-title { opacity: 0; }
.story[data-beat="3"] .story-seed { opacity: 1; animation: story-seed 3.5s ease-out both; }
.story-sprout { transform-box: fill-box; transform-origin: 50% 100%; }
.story[data-beat="4"] .story-sprout { opacity: 1; animation: story-sprout 2s ease-out both; }
.story[data-beat="5"] .story-sprout { opacity: 1; }
.story-moss, .story-title { transition: opacity 1.5s ease; }
.story[data-beat="5"] .story-moss, .story[data-beat="5"] .story-title { opacity: 1; }
.reduce-motion .story-rain { display: none; }
@media (prefers-reduced-motion: reduce) { .story-rain { display: none; } }
@keyframes story-rain { to { transform: translate(-12px, 24px); } }
@keyframes story-seed { from { transform: translate(-150px, -110px); } 60% { transform: translate(-30px, -40px); } to { transform: translate(0, 0); } }
@keyframes story-sprout { from { transform: scaleY(0); } to { transform: scaleY(1); } }

/* v1.3 Pip */
.pip { position: absolute; left: 12px; bottom: calc(max(12px, env(safe-area-inset-bottom)) + 112px); display: flex; align-items: flex-end; gap: 6px; pointer-events: none; }
.pip-svg { width: 64px; height: 64px; flex: none; overflow: visible; filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.35)); }
.pip-line { margin: 0 0 40px; max-width: 200px; background: #f1ede2; color: #23251f; font-weight: 700; font-size: 15px; padding: 8px 12px; border-radius: 14px 14px 14px 4px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35); animation: fade-in 200ms ease-out; }
.pip-line[hidden] { display: none; }
.pip-figure { transform-box: view-box; transform-origin: 32px 60px; }
.pip.mood-idle .pip-figure { animation: pip-bob 2.4s ease-in-out infinite; }
.pip.mood-cheer .pip-figure { animation: pip-hop 500ms ease-out 2; }
.pip-arm { transform-box: fill-box; }
.pip-arm-r { transform-origin: 0% 50%; }
.pip.mood-wave .pip-arm-r { animation: pip-wave 600ms ease-in-out 3; }
.pip.mood-point .pip-arm-r { transform: rotate(-35deg); }
.pip-eye { transform-box: fill-box; transform-origin: center; animation: pip-blink 4s infinite; }
.pip.mood-sleep .pip-eye { fill: #5a6468; animation: none; }
@keyframes pip-bob { 50% { transform: translateY(-3px); } }
@keyframes pip-hop { 40% { transform: translateY(-10px); } }
@keyframes pip-wave { 50% { transform: rotate(-60deg); } }
@keyframes pip-blink { 0%, 94%, 100% { transform: scaleY(1); } 97% { transform: scaleY(0.1); } }
```

- [ ] **Step 4: Run it and watch it pass.**
  - Run: `npx vitest run tests/ui/story.test.ts`
  - Expected: PASS (8 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/ui/story.ts src/styles.css tests/ui/story.test.ts
git commit -m "feat(story): 25-second animated intro with Skip, Tap to begin and Esc"
```

---

### Task 4: Pip in the HUD

**Files:**
- Modify: `src/ui/hud.ts`
- Test: `tests/ui/hud.test.ts`

**Interfaces:**
- Consumes: `pipSvg` (Task 2), `PipMood`, `PipSay` (Task 2).
- Produces:
  - `export const PIP_LINE_MS = 2500`
  - `Hud.setPip(say: PipSay): void`
  - **DOM:** `.pip.mood-<mood>` (a sibling of `.hud` in the root, not inside the HUD markup) containing `.pip-svg` and `.pip-line` (aria-live polite, `hidden` when silent).
  - `Hud.destroy()` also removes Pip and clears its timer.

- [ ] **Step 1: Write the failing test.** Append to `tests/ui/hud.test.ts`, and add `PIP_LINE_MS` to the existing `../../src/ui/hud` import:

```ts
describe('Hud Pip', () => {
  const pip = () => root.querySelector('.pip')!;
  const line = () => root.querySelector<HTMLElement>('.pip-line')!;

  it('shows Pip idle and silent, outside the HUD markup', () => {
    const hud = new Hud(root, handlers());
    hud.render(new PlayController(makeLevel({})).view, meta);
    expect(pip().className).toBe('pip mood-idle');
    expect(line().hidden).toBe(true);
    expect(line().getAttribute('aria-live')).toBe('polite');
    expect(hud.el.contains(pip())).toBe(false);
  });
  it('says a line with its mood, then rests after 2.5 s', () => {
    vi.useFakeTimers();
    const hud = new Hud(root, handlers());
    hud.setPip({ mood: 'cheer', line: 'Lush!' });
    expect(pip().className).toBe('pip mood-cheer');
    expect(line().hidden).toBe(false);
    expect(line().textContent).toBe('Lush!');
    vi.advanceTimersByTime(PIP_LINE_MS);
    expect(line().hidden).toBe(true);
    expect(pip().className).toBe('pip mood-idle');
    vi.useRealTimers();
  });
  it('a silent rule sets the resting mood but never cuts a line short', () => {
    vi.useFakeTimers();
    const hud = new Hud(root, handlers());
    hud.setPip({ mood: 'cheer', line: 'Nice!' });
    hud.setPip({ mood: 'point', line: null });
    expect(pip().className).toBe('pip mood-cheer');
    expect(line().hidden).toBe(false);
    vi.advanceTimersByTime(PIP_LINE_MS);
    expect(pip().className).toBe('pip mood-point');
    hud.setPip({ mood: 'idle', line: null });
    expect(pip().className).toBe('pip mood-idle');
    vi.useRealTimers();
  });
  it('keeps the line through HUD redraws', () => {
    const c = new PlayController(makeLevel({}));
    const hud = new Hud(root, handlers());
    hud.render(c.view, meta);
    hud.setPip({ mood: 'point', line: 'Try the glowing spot!' });
    hud.render(c.view, { ...meta, name: 'Changed' });
    expect(line().textContent).toBe('Try the glowing spot!');
    expect(line().hidden).toBe(false);
  });
  it('destroy removes Pip and its pending timer', () => {
    vi.useFakeTimers();
    const hud = new Hud(root, handlers());
    hud.setPip({ mood: 'wave', line: 'We did it! Look at it bloom.' });
    hud.destroy();
    expect(root.querySelector('.pip')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run it and watch it fail.**
  - Run: `npx vitest run tests/ui/hud.test.ts`
  - Expected: FAIL. `PIP_LINE_MS` is undefined, `.pip` is null, and `hud.setPip` is not a function.

- [ ] **Step 3: Implement.** In `src/ui/hud.ts`:
  1. Add the imports:

     ```ts
     import type { PipMood, PipSay } from '../game/pip';
     import { pipSvg } from './pip';
     ```

  2. After the `cap` helper, add:

     ```ts
     export const PIP_LINE_MS = 2500;
     ```

  3. Add these fields to `Hud`:

     ```ts
       private readonly pipEl: HTMLElement;
       private pipRest: PipMood = 'idle';
       private pipTimer: ReturnType<typeof setTimeout> | null = null;
     ```

  4. In the constructor, after `this.el.addEventListener('click', …)`, add:

     ```ts
         // Pip lives beside the HUD markup, so HUD redraws never restart its animation or wipe its line.
         this.pipEl = document.createElement('div');
         this.pipEl.className = 'pip mood-idle';
         this.pipEl.innerHTML = `${pipSvg()}<p class="pip-line" aria-live="polite" hidden></p>`;
         root.appendChild(this.pipEl);
     ```

  5. Add these methods after `showError()`:

     ```ts
       /** A line shows its mood for PIP_LINE_MS, then Pip returns to its resting mood. A silent say only changes the rest. */
       setPip(say: PipSay): void {
         if (say.line === null) {
           this.pipRest = say.mood;
           if (!this.pipTimer) this.pipEl.className = `pip mood-${say.mood}`;
           return;
         }
         this.pipEl.className = `pip mood-${say.mood}`;
         const line = this.pipEl.querySelector<HTMLElement>('.pip-line')!;
         line.textContent = say.line;
         line.hidden = false;
         if (this.pipTimer) clearTimeout(this.pipTimer);
         this.pipTimer = setTimeout(() => {
           this.pipTimer = null;
           line.hidden = true;
           this.pipEl.className = `pip mood-${this.pipRest}`;
         }, PIP_LINE_MS);
       }
     ```

  6. Replace `destroy()` with:

     ```ts
       destroy(): void {
         if (this.expiryTimer) clearTimeout(this.expiryTimer);
         if (this.pipTimer) clearTimeout(this.pipTimer);
         this.pipTimer = null;
         this.pipEl.remove();
         this.el.remove();
       }
     ```

- [ ] **Step 4: Run it and watch it pass.**
  - Run: `npx vitest run tests/ui/hud.test.ts`
  - Expected: PASS, with all the earlier HUD tests still green.

- [ ] **Step 5: Commit.**

```bash
git add src/ui/hud.ts tests/ui/hud.test.ts
git commit -m "feat(hud): Pip companion with timed speech lines"
```

---

### Task 5: App wiring — story on first Play, a Story button, and Pip reacting

**Files:**
- Modify: `src/app/app.ts`
- Test: `tests/app/app.test.ts`

**Interfaces:**
- Consumes:
  - `StoryPlayer` and `STORY_BEATS` (Task 3)
  - `pipFor` (Task 2)
  - `Hud.setPip` (Task 4)
  - `SaveData.storySeen` (Task 1)
- Produces:
  - `Screen` gains `'story'`.
  - The title has `<button data-nav="story">Story</button>`.
  - The Play button (`data-nav="select"`) shows the story first while `storySeen` is false.

- [ ] **Step 1: Update the existing tests that press Play, so a seen story keeps them on their path.**
  1. In `tests/app/app.test.ts`, add this below `const opts = …`:

     ```ts
     const seen = JSON.stringify({ version: 1, completed: [], storySeen: true, settings: {} });
     ```

  2. Change `memoryStore()` to `memoryStore({ [SAVE_KEY]: seen })` in these tests, which click `[data-nav="select"]` from the title:
     - 'lists the five places with only the first open'
     - 'starts a level with the HUD and an interactive stage'
     - 'keeps calling unlock on gestures until audio is ready'
     - 'keeps working when sound unlock throws'
     - 'persists sound settings from the settings screen and the HUD mute button'
  3. In 'level cards announce their stars in the button label', add `storySeen: true` to the saved object.
  4. Run `grep -n 'data-nav="select"' tests/app/app.test.ts` and check that no other test clicks Play with an unseen store. The line-28 assertion only checks that the button exists, so it is fine.

- [ ] **Step 2: Write the failing tests.** Append:

```ts
describe('App v1.3 story and Pip', () => {
  const seenDone = JSON.stringify({ version: 1, completed: [], tutorialDone: true, storySeen: true, settings: {} });

  it('the first Play shows the story; Skip saves storySeen and goes to the places', () => {
    const store = memoryStore();
    const app = new App(root, stage, store, LEVELS, opts);
    click('[data-nav="select"]');
    expect(app.screen).toBe('story');
    expect(root.querySelector('.story-caption')!.textContent).toBe('The city went quiet.');
    click('[data-story="skip"]');
    expect(app.screen).toBe('select');
    expect(JSON.parse(store.data[SAVE_KEY]!).storySeen).toBe(true);
    click('[data-nav="title"]');
    click('[data-nav="select"]');
    expect(app.screen).toBe('select');
  });

  it('the title Story button replays it, plays the swell on the last beat and returns to the title', () => {
    vi.useFakeTimers();
    const { sound, calls } = fakeSound();
    const app = new App(root, stage, memoryStore({ [SAVE_KEY]: seen }), LEVELS, opts, sound);
    click('[data-nav="story"]');
    expect(app.screen).toBe('story');
    vi.advanceTimersByTime(20000);
    expect(calls.cues).toContain('milestone');
    click('[data-story="begin"]');
    expect(app.screen).toBe('title');
    vi.useRealTimers();
  });

  it('without storage the story still ends, leads on and does not repeat this session', () => {
    const app = new App(root, stage, null, LEVELS, opts);
    click('[data-nav="select"]');
    click('[data-story="skip"]');
    expect(app.screen).toBe('select');
    click('[data-nav="title"]');
    click('[data-nav="select"]');
    expect(app.screen).toBe('select');
  });

  it('leaving mid-story stops it: no late navigation', () => {
    vi.useFakeTimers();
    const app = new App(root, stage, memoryStore(), LEVELS, opts);
    click('[data-nav="select"]');
    app.startLevel(1);
    vi.advanceTimersByTime(30000);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(app.screen).toBe('play');
    expect(root.querySelector('.story')).toBeNull();
    vi.useRealTimers();
  });

  it('Pip points through the tutorial and rests idle once it is skipped', () => {
    const app = new App(root, stage, memoryStore({ [SAVE_KEY]: seen }), LEVELS, opts);
    app.startLevel(0);
    expect(root.querySelector('.pip')!.className).toBe('pip mood-point');
    click('[data-action="skip-tutorial"]');
    expect(root.querySelector('.pip')!.className).toBe('pip mood-idle');
  });

  it('Pip waves and speaks when a place is restored', () => {
    const app = new App(root, stage, memoryStore({ [SAVE_KEY]: seenDone }), LEVELS, opts);
    app.startLevel(0);
    for (const m of LEVELS[0]!.solution) app.controller!.play(m);
    expect(root.querySelector('.pip')!.className).toBe('pip mood-wave');
    expect(root.querySelector('.pip-line')!.textContent).toBe('We did it! Look at it bloom.');
  });

  it('Pip points at the idle hint', () => {
    vi.useFakeTimers();
    const app = new App(root, { show: vi.fn(), highlight: vi.fn() }, memoryStore({ [SAVE_KEY]: seenDone }), LEVELS, opts);
    app.startLevel(1);
    vi.advanceTimersByTime(3100);
    expect(root.querySelector('.pip-line')!.textContent).toBe('Try the glowing spot!');
    expect(root.querySelector('.pip')!.className).toBe('pip mood-point');
    vi.useRealTimers();
  });

  it('there is one Pip per level, removed when leaving', () => {
    const app = new App(root, stage, memoryStore({ [SAVE_KEY]: seenDone }), LEVELS, opts);
    app.startLevel(0);
    app.startLevel(1);
    expect(root.querySelectorAll('.pip')).toHaveLength(1);
    click('[data-action="menu"]');
    expect(root.querySelector('.pip')).toBeNull();
  });
});
```

- [ ] **Step 3: Run them and watch them fail.**
  - Run: `npx vitest run tests/app/app.test.ts`
  - Expected:
    - The 8 new tests FAIL: the screen is `'select'`, not `'story'`; `[data-nav="story"]` is null; `.pip` is null.
    - Every previously existing test still PASSES.

- [ ] **Step 4: Implement.** In `src/app/app.ts`:
  1. Add the imports:

     ```ts
     import { pipFor } from '../game/pip';
     import { STORY_BEATS, StoryPlayer } from '../ui/story';
     ```

  2. Change the screen types:

     ```ts
     export type Screen = 'title' | 'select' | 'settings' | 'credits' | 'howto' | 'play' | 'story';
     type MenuScreen = Exclude<Screen, 'play' | 'story'>;
     ```

     Replace every `Exclude<Screen, 'play'>` in the file with `MenuScreen` (in `show`, `onClick` and `template`).
  3. Add a field: `private story: StoryPlayer | null = null;`.
  4. In `teardown()`, first line, add:

     ```ts
         this.story?.destroy();
         this.story = null;
     ```

  5. Replace the nav line in `onClick`:

     ```ts
         const nav = el.closest<HTMLElement>('[data-nav]');
         if (nav) {
           const to = nav.dataset.nav as MenuScreen | 'story';
           if (to === 'story') return this.playStory('title');
           if (to === 'select' && this.screen === 'title' && !this.save.storySeen) return this.playStory('select');
           return this.show(to);
         }
     ```

  6. Add the method below `startDemo()`:

     ```ts
       /** The intro story. Seen once on the first Play (saved), replayable from the title. */
       private playStory(then: MenuScreen): void {
         this.teardown();
         this.screen = 'story';
         this.sound.setProgress(0);
         this.root.innerHTML = '';
         this.stage.show(null, { reducedMotion: this.reducedMotion, interactive: false });
         this.story = new StoryPlayer(this.root, {
           onBeat: (n) => {
             if (n !== STORY_BEATS.length) return;
             try {
               this.sound.play(['milestone']);
             } catch (err) {
               console.warn('[Afterlife] sound cue failed', err);
             }
           },
           onDone: () => {
             this.story = null;
             if (!this.save.storySeen) {
               this.save = { ...this.save, storySeen: true };
               writeSave(this.store, this.save);
             }
             this.show(then);
           },
         });
       }
     ```

  7. In the `title` template, add `<button data-nav="story">Story</button>` right after the How to Play button.
  8. Wire Pip in `startLevel`:
     - Before `lastOverlay = view.overlay;` inside `onChange`, compute:

       ```ts
       const newOverlay = view.overlay !== lastOverlay ? view.overlay : 'none';
       ```

     - Replace the milestone line with:

       ```ts
             const milestone = milestonesCrossed(lastProgress, view.progress).length > 0;
             if (milestone) cues.push('milestone');
       ```

     - After `hud.render(view, meta());` inside `onChange`, add:

       ```ts
       hud.setPip(pipFor({ newOverlay, tutorial: !!this.tutorial, events, milestone, hint: false }));
       ```

     - After the first `hud.render(ctrl.view, meta());` (the one outside `onChange`), add:

       ```ts
       hud.setPip(pipFor({ newOverlay: 'none', tutorial: !!this.tutorial, events: [], milestone: false, hint: false }));
       ```

  9. In `scheduleHint`, after `this.stage.highlight?.(move.tile);`, add:

     ```ts
     this.hud?.setPip(pipFor({ newOverlay: 'none', tutorial: false, events: [], milestone: false, hint: true }));
     ```

  10. In `finishTutorial`, before `this.renderHud?.();`, add:

      ```ts
      this.hud?.setPip({ mood: 'idle', line: null });
      ```

- [ ] **Step 5: Run the tests and watch them pass.**
  - Run: `npx vitest run tests/app/app.test.ts`
  - Expected: PASS (all tests, old and new).

- [ ] **Step 6: Run the full suite and the typecheck.**
  - Run: `npm test 2>&1 | grep -E "Test Files|Tests" ; npx tsc --noEmit`
  - Expected: all test files pass and tsc prints nothing.

- [ ] **Step 7: Commit.**

```bash
git add src/app/app.ts tests/app/app.test.ts
git commit -m "feat(app): story before the first game, Story replay on the title, Pip reacts to play"
```

---

### Task 6: New ruins — shapes and the Kenney washer and dryer

**Files:**
- Modify: `src/render/objects/objectShapes.ts`, `tools/sprites/sprites.config.ts`, `src/render/objects/sprites.json` (generated), `tests/render/spriteArt.test.ts`, `tests/render/shapes.test.ts`
- Create: `assets/kenney/furniture-kit/washer.glb`, `assets/kenney/furniture-kit/dryer.glb`, `public/sprites/washer-r{0..3}.png`, `public/sprites/dryer-r{0..3}.png`

**Interfaces:**
- Produces: `hasObjectShape(name)` is true for `washer`, `dryer`, `laundry-cart`, `old-bus`, `planter` and `chimney`. The manifest has 13 keys.

- [ ] **Step 1: Write the failing tests.**
  1. In `tests/render/shapes.test.ts`, add inside the top-level describe that holds 'has a shape for every scrap kind…':

     ```ts
       it('has shapes for the v1.3 ruins', () => {
         for (const name of ['washer', 'dryer', 'laundry-cart', 'old-bus', 'planter', 'chimney']) expect(hasObjectShape(name), name).toBe(true);
         expect(objectTopHeight('chimney')).toBeGreaterThan(objectTopHeight('planter'));
       });
     ```

  2. In `tests/render/spriteArt.test.ts`, change the manifest test:
     - The name becomes `'covers the 13 Kenney-matched objects, each a known object'`.
     - The expected keys become `['barrel', 'bench', 'bin', 'car', 'cone', 'crate', 'dryer', 'old-car', 'sign', 'station-sign', 'tyre', 'washer', 'water-tank']`.
     - `spriteAssets(m, '/')` becomes `toHaveLength(52)`.

- [ ] **Step 2: Run them and watch them fail.**
  - Run: `npx vitest run tests/render`
  - Expected: FAIL, with `washer: expected false to be true` and the manifest keys missing `dryer` and `washer`.

- [ ] **Step 3: Add the shapes.** In `src/render/objects/objectShapes.ts`, append these inside `OBJECTS` after `sandpit`:

```ts
  washer: [box(0, 0, 0.62, 0.62, 0, 24, C.white), box(0, 0.32, 0.3, 0.02, 6, 12, C.metalDark), box(0, 0, 0.64, 0.64, 24, 2, C.metal)],
  dryer: [box(0, 0, 0.62, 0.62, 0, 24, C.white), box(0, 0.32, 0.34, 0.02, 8, 10, C.metal), box(0, 0, 0.64, 0.64, 24, 2, C.metalDark)],
  'laundry-cart': [...legs(0.2, 6), box(0, 0, 0.5, 0.4, 6, 12, C.metal), box(0, 0, 0.46, 0.36, 18, 2, C.white)],
  'old-bus': [box(0, 0, 0.96, 0.6, 3, 24, C.paintBlue), box(0, 0, 0.97, 0.62, 15, 6, C.white), cyl(0.3, 0.3, 0.09, 0, 7, C.rubber), cyl(-0.3, 0.3, 0.09, 0, 7, C.rubber)],
  planter: [box(0, 0, 0.72, 0.72, 0, 10, C.wood), box(0, 0, 0.62, 0.62, 0, 11, C.soilLush)],
  chimney: [box(0, 0, 0.4, 0.4, 0, 34, C.paintRed), box(0, 0, 0.46, 0.46, 34, 4, C.metalDark)],
```

- [ ] **Step 4: Copy the Kenney models and register them.**
  1. Copy the models:

     ```bash
     cp "/tmp/kenney/furniture/Models/GLTF format/washer.glb" "/tmp/kenney/furniture/Models/GLTF format/dryer.glb" assets/kenney/furniture-kit/
     ```

     If `/tmp/kenney` is gone, re-download the Kenney Furniture Kit (CC0) from https://kenney.nl/assets/furniture-kit and take the same two files.
  2. In `tools/sprites/sprites.config.ts`, add these after the `bin` entry:

     ```ts
       { name: 'washer', file: 'furniture-kit/washer.glb', footprint: 0.7 },
       { name: 'dryer', file: 'furniture-kit/dryer.glb', footprint: 0.7 },
     ```

- [ ] **Step 5: Render the sprites.**
  - Start `npm run dev` in the background and wait for `http://localhost:5173`. Then run `npm run sprites`, then stop the dev server.
  - Expected: `rendered 52 images for 13 objects`, and `public/sprites/washer-r0.png … dryer-r3.png` exist.

- [ ] **Step 6: Check that they face the right way.**
  - Open `public/sprites/washer-r0.png` and `dryer-r0.png` with the Read tool. The door should face the viewer at r0, like the code-drawn shape, whose door is at +y.
  - If a model faces away, add `yaw: 2` (or `1`/`3`) to its config entry, re-run Step 5, and ledger a Ruling.

- [ ] **Step 7: Run the tests and watch them pass.**
  - Run: `npx vitest run tests/render`
  - Expected: PASS.

- [ ] **Step 8: Commit.**

```bash
git add src/render/objects/objectShapes.ts tools/sprites/sprites.config.ts src/render/objects/sprites.json assets/kenney/furniture-kit/washer.glb assets/kenney/furniture-kit/dryer.glb public/sprites/washer-r*.png public/sprites/dryer-r*.png tests/render/shapes.test.ts tests/render/spriteArt.test.ts
git commit -m "feat(art): washer and dryer sprites, code-drawn laundry cart, old bus, planter and chimney"
```

---

### Task 7: Levels 6–8

**Files:**
- Create: `src/levels/06-laundromat.json`, `src/levels/07-bus-depot.json`, `src/levels/08-rooftop-garden.json`
- Modify: `src/levels/index.ts`, `tests/levels/levels.test.ts`, `tests/app/app.test.ts`

**Interfaces:**
- Consumes: the ruin shapes from Task 6 (the shapes test checks every level's ruins).
- Produces: `LEVELS` has 8 entries in the order given in Global Constraints.

- [ ] **Step 1: Write the failing tests.**
  1. In `tests/levels/levels.test.ts`, replace the first `it` with:

     ```ts
     it('has exactly 8 level files, all exported in order', () => {
       expect(files).toHaveLength(8);
       expect(LEVELS.map((l) => l.id)).toEqual(['bus-stop', 'rooftop', 'petrol-station', 'railway-platform', 'playground', 'laundromat', 'bus-depot', 'rooftop-garden']);
     });
     ```

  2. In `tests/app/app.test.ts`, rename 'lists the five places with only the first open' to 'lists the eight places with only the first open' and change `toHaveLength(5)` to `toHaveLength(8)`.
  3. Append inside `describe('App v1.3 story and Pip', …)`:

     ```ts
       it('Playground now leads on to the Laundromat', () => {
         const app = new App(root, stage, memoryStore({ [SAVE_KEY]: seenDone }), LEVELS, opts);
         app.startLevel(4);
         for (const m of LEVELS[4]!.solution) app.controller!.play(m);
         click('[data-action="next"]');
         expect(app.controller!.level.id).toBe('laundromat');
       });
     ```

- [ ] **Step 2: Run them and watch them fail.**
  - Run: `npx vitest run tests/levels tests/app`
  - Expected: FAIL, because there are 5 files and not 8, there are 5 cards, and `[data-action="next"]` is null on the Playground.

- [ ] **Step 3: Write the level files.** They are tuned and measured before the plan (see spec §8). Create `src/levels/06-laundromat.json`:

```json
{
  "id": "laundromat",
  "name": "Laundromat",
  "hint": "No moss here. Tap a bloom — it gives you a vine seed.",
  "width": 7,
  "height": 7,
  "ground": ["#######", "#######", "##...##", "##...##", "##...##", "#######", "#######"],
  "ruins": [
    { "x": 1, "y": 1, "name": "washer", "size": "medium" },
    { "x": 3, "y": 1, "name": "washer", "size": "medium" },
    { "x": 5, "y": 1, "name": "dryer", "size": "medium" },
    { "x": 5, "y": 5, "name": "laundry-cart", "size": "small" }
  ],
  "seeds": { "flower": 5, "vine": 5 },
  "harvestYield": "vine",
  "batches": [["tyre", "crate", "can"], ["crate", "tyre", "cone"], ["tyre", "barrel", "can"], ["crate", "tyre", "tyre"], ["can", "crate", "tyre"], ["tyre", "sign", "can"], ["crate", "tyre", "cone"], ["tyre", "can", "crate"]],
  "target": 0.5,
  "rngSeed": 606,
  "solution": []
}
```

Create `src/levels/07-bus-depot.json`:

```json
{
  "id": "bus-depot",
  "name": "Bus Depot",
  "hint": "Narrow lanes: bamboo fits where nothing else can spread.",
  "width": 9,
  "height": 6,
  "ground": ["#########", "#X##X##X#", "#########", "#########", "#X##X##X#", "#########"],
  "ruins": [
    { "x": 2, "y": 2, "name": "old-bus", "size": "large" },
    { "x": 6, "y": 3, "name": "old-bus", "size": "large" },
    { "x": 0, "y": 5, "name": "bench", "size": "small" },
    { "x": 8, "y": 0, "name": "bin", "size": "small" }
  ],
  "seeds": { "bamboo": 4, "moss": 5, "vine": 3 },
  "batches": [["tyre", "crate", "can"], ["car", "tyre", "cone"], ["crate", "tyre", "can"], ["tyre", "barrel", "tyre"], ["can", "car", "tyre"], ["crate", "tyre", "cone"], ["tyre", "can", "crate"], ["sign", "tyre", "can"]],
  "target": 0.5,
  "rngSeed": 707,
  "solution": []
}
```

Create `src/levels/08-rooftop-garden.json`:

```json
{
  "id": "rooftop-garden",
  "name": "Rooftop Garden",
  "hint": "The last place. Every plant has its part to play.",
  "width": 8,
  "height": 8,
  "ground": ["##....##", "#......#", "........", "...XX...", "...XX...", "........", "#......#", "##....##"],
  "ruins": [
    { "x": 1, "y": 1, "name": "chimney", "size": "medium" },
    { "x": 6, "y": 6, "name": "chimney", "size": "medium" },
    { "x": 6, "y": 1, "name": "planter", "size": "small" },
    { "x": 1, "y": 6, "name": "planter", "size": "small" },
    { "x": 4, "y": 0, "name": "water-tank", "size": "medium" },
    { "x": 0, "y": 4, "name": "ac-unit", "size": "medium" }
  ],
  "seeds": { "moss": 4, "vine": 3, "flower": 2, "bamboo": 2 },
  "harvestYield": "moss",
  "batches": [["tyre", "crate", "can"], ["car", "tyre", "cone"], ["crate", "barrel", "tyre"], ["can", "tyre", "crate"], ["tyre", "car", "can"], ["sign", "tyre", "crate"], ["cone", "tyre", "barrel"], ["tyre", "can", "car"], ["crate", "tyre", "can"], ["tyre", "crate", "sign"]],
  "target": 0.6,
  "rngSeed": 808,
  "solution": []
}
```

- [ ] **Step 4: Solve them.**
  - Run: `npm run solve -- src/levels/06-laundromat.json 150 && npm run solve -- src/levels/07-bus-depot.json 150 && npm run solve -- src/levels/08-rooftop-garden.json 150`
  - Expected: `laundromat: solved in 24 moves`, `bus-depot: solved in 21 moves`, `rooftop-garden: solved in 27 moves`.
  - Exact counts may differ only if the solver changed. Any "No solution" means you apply the Tuning constraint and ledger it.

- [ ] **Step 5: Export them.** Replace `src/levels/index.ts` with:

```ts
import { validateLevel, type LevelData } from '../engine';
import busStop from './01-bus-stop.json';
import rooftop from './02-rooftop.json';
import petrolStation from './03-petrol-station.json';
import railwayPlatform from './04-railway-platform.json';
import playground from './05-playground.json';
import laundromat from './06-laundromat.json';
import busDepot from './07-bus-depot.json';
import rooftopGarden from './08-rooftop-garden.json';

export const LEVELS: LevelData[] = [busStop, rooftop, petrolStation, railwayPlatform, playground, laundromat, busDepot, rooftopGarden].map((raw) => validateLevel(raw));
```

- [ ] **Step 6: Run the level, beginner, shapes and app tests.**
  - Run: `npx vitest run tests/levels tests/game/beginner.test.ts tests/render/shapes.test.ts tests/app`
  - Expected: PASS.
    - The beginner test now runs 8 cases. On the measured numbers the new levels need 6, 2 and 6 bonus packs, all within the limit of 8.
    - The shapes test confirms every new ruin has a shape.

- [ ] **Step 7: Run the full suite and the typecheck.**
  - Run: `npm test 2>&1 | grep -E "Test Files|Tests" ; npx tsc --noEmit`
  - Expected: all test files pass and tsc prints nothing.

- [ ] **Step 8: Commit.**

```bash
git add src/levels tests/levels/levels.test.ts tests/app/app.test.ts
git commit -m "feat(levels): Laundromat, Bus Depot and Rooftop Garden"
```

---

### Task 8: Landing page

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Write the failing check.**
  - Run: `grep -c "Eight quiet places" index.html`
  - Expected: `0`. The landing page has no unit tests, so this grep is the check.

- [ ] **Step 2: Update the text.** In `index.html`:
  - Replace `<h2>Five quiet places</h2>` with `<h2>Eight quiet places</h2>`.
  - Replace the list line with `<p>Bus Stop · Rooftop · Petrol Station · Railway Platform · Playground · Laundromat · Bus Depot · Rooftop Garden</p>`.
  - Run `grep -rn -i "five" index.html src/landing.ts`, and also change any other "five places" wording it finds.

- [ ] **Step 3: Run the check again and build.**
  - Run: `grep -c "Eight quiet places" index.html && npm run build 2>&1 | tail -5`
  - Expected: `1`, and the build succeeds.

- [ ] **Step 4: Commit.**

```bash
git add index.html
git commit -m "docs(landing): eight quiet places"
```

---

### Task 9: Verify in the browser, final review, ship

**Files:**
- Throwaway scripts in `$CLAUDE_JOB_DIR/tmp/pw/` (not committed). Use the system Chrome with playwright-core, as before.

- [ ] **Step 1: Full suite, typecheck and build size.**
  - Run: `npm test 2>&1 | grep -E "Test Files|Tests"; npx tsc --noEmit; npm run build 2>&1 | tail -15`
  - Expected:
    - Everything is green.
    - The gzip sum of the initial JS and CSS is under 3 MB. Tone stays a lazy chunk.

- [ ] **Step 2: Story screenshots.**
  - Start `npm run preview`. With a fresh profile (empty localStorage), press Play.
  - Screenshot each beat at 2.5 s into it (2.5, 7.5, 12.5, 17.5 and 22.5 s), on desktop 1280×800 and phone 390×844.
  - Check: the captions are readable; Pip is hidden on beat 1, asleep on beats 2–3, and awake with the sprout on beat 4; the title and Tap to begin show on beat 5; nothing overflows on the phone.
  - Press Tap to begin, and you should land on the places screen. Reload and press Play: there should be no story.
  - On the title, press Story and then Skip, and you should be back on the title.

- [ ] **Step 3: Pip moments.** On the phone viewport:
  - Start Bus Stop on a fresh profile. Pip should be pointing beside the coach.
  - Skip the tutorial and wait 3 s. Pip should say "Try the glowing spot!".
  - Play a combo move and screenshot it.
  - Play into a bonus pack and screenshot it: Pip's bubble must not cover the toast or the tray.
  - Win a level and screenshot Pip waving.

- [ ] **Step 4: New levels.**
  - For each new level, screenshot it at start and after replaying its solution.
  - Check:
    - the washer and dryer sprites face the viewer;
    - the old buses read as buses;
    - the skylight hole and the bays render as blocked;
    - rotating keeps everything consistent.

- [ ] **Step 5: Reduce motion and the console.**
  - With Reduce motion on, play the story. There should be no rain and the seed should sit already landed.
  - Pip should be static.
  - Across all the runs, the page must log no errors (collect `pageerror` and `console.error`).

- [ ] **Step 6: Final whole-branch review.**
  - Run `review-package` from the merge-base to HEAD.
  - Dispatch the code reviewer on **opus** with the spec, the plan, this plan's Review Focus and the ledger rulings.
  - Fix Critical and Important findings test-first in one pass. Ledger the minor ones.

- [ ] **Step 7: Ship.**
  1. Merge into `main` (`--no-ff`), run `npm test` on the merged result, and push.
  2. Wait for the Vercel production deployment to be READY.
  3. Load https://afterlife-one.vercel.app/play/ fresh and confirm that the story plays and 8 places are listed. Confirm the landing page says "Eight quiet places".
  4. Delete this plan's ledger workspace.
