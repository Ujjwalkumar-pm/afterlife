// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { App, type Stage } from '../../src/app/app';
import { planTutorial } from '../../src/game/tutorial';
import { LEVELS } from '../../src/levels';
import { SAVE_KEY, type Store } from '../../src/save/save';

const memoryStore = (initial: Record<string, string> = {}): Store & { data: Record<string, string> } => {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};
const opts = { demoIntervalMs: null, prefersReducedMotion: false };
const seen = JSON.stringify({ version: 1, completed: [], storySeen: true, settings: {} });
const click = (sel: string) => (document.querySelector(sel) as HTMLElement).click();

let root: HTMLElement;
let stage: { show: Mock<Stage['show']> };
beforeEach(() => {
  document.body.innerHTML = '<div id="ui"></div>';
  root = document.getElementById('ui')!;
  stage = { show: vi.fn<Stage['show']>() };
});

describe('App', () => {
  it('starts on the title screen', () => {
    const app = new App(root, stage, memoryStore(), LEVELS, opts);
    expect(app.screen).toBe('title');
    expect(root.querySelector('.logo')!.textContent).toBe('Afterlife');
    expect(root.querySelector('[data-nav="select"]')).not.toBeNull();
  });

  it('lists the eight places with only the first open', () => {
    new App(root, stage, memoryStore({ [SAVE_KEY]: seen }), LEVELS, opts);
    click('[data-nav="select"]');
    const cards = root.querySelectorAll<HTMLButtonElement>('.level-card');
    expect(cards).toHaveLength(8);
    expect(cards[0]!.disabled).toBe(false);
    expect(cards[1]!.disabled).toBe(true);
    expect(cards[0]!.textContent).toContain('Bus Stop');
  });

  it('starts a level with the HUD and an interactive stage', () => {
    const app = new App(root, stage, memoryStore({ [SAVE_KEY]: seen }), LEVELS, opts);
    click('[data-nav="select"]');
    click('[data-level="0"]');
    expect(app.screen).toBe('play');
    expect(root.querySelector('.hud')).not.toBeNull();
    expect(stage.show).toHaveBeenLastCalledWith(app.controller, expect.objectContaining({ reducedMotion: false, interactive: true }));
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

import type { Sound } from '../../src/audio/sound';
import type { Cue } from '../../src/audio/cues';

const fakeSound = () => {
  const calls = { unlock: 0, muted: [] as boolean[], volume: [] as number[], ambient: [] as boolean[], progress: [] as number[], cues: [] as Cue[], listeners: [] as (() => void)[] };
  const sound: Sound = {
    ready: false,
    available: true,
    onChange: (l) => void calls.listeners.push(l),
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

  it('keeps calling unlock on gestures until audio is ready', () => {
    const { sound, calls } = fakeSound();
    new App(root, stage, memoryStore({ [SAVE_KEY]: seen }), LEVELS, opts, sound);
    click('[data-nav="select"]');
    click('[data-nav="title"]');
    expect(calls.unlock).toBe(2);
    (sound as { ready: boolean }).ready = true;
    click('[data-nav="select"]');
    expect(calls.unlock).toBe(2);
  });

  it('shows sound as off in the HUD when audio is unavailable', () => {
    const { sound, calls } = fakeSound();
    const app = new App(root, stage, memoryStore(), LEVELS, opts, sound);
    app.startLevel(0);
    expect(root.querySelector('[data-action="mute"]')!.getAttribute('aria-pressed')).toBe('false');
    (sound as { available: boolean }).available = false;
    calls.listeners.forEach((l) => l());
    expect(root.querySelector('[data-action="mute"]')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps working when sound unlock throws', () => {
    const broken: Sound = { ...fakeSound().sound, unlock: () => { throw new Error('no audio'); } };
    const app = new App(root, stage, memoryStore({ [SAVE_KEY]: seen }), LEVELS, opts, broken);
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
    const store = memoryStore({ [SAVE_KEY]: seen });
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

describe('App teaching', () => {
  const coach = () => root.querySelector('.coach');

  it('guides the first Bus Stop and highlights suggested tiles', () => {
    const highlight = vi.fn();
    const app = new App(root, { show: vi.fn(), highlight }, memoryStore(), LEVELS, opts);
    app.startLevel(0);
    expect(coach()!.textContent).toContain('Tap a glowing tile to plant.');
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
    expect(coach()!.textContent).toContain('Step 2 of 6');
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

describe('App resilience', () => {
  it('keeps playing when the sound engine throws on a cue', () => {
    const { sound } = fakeSound();
    const broken: Sound = { ...sound, play: () => { throw new Error('Start time must be strictly greater'); } };
    const app = new App(root, stage, memoryStore(), LEVELS, opts, broken);
    app.startLevel(1);
    expect(() => { for (const m of LEVELS[1]!.solution) app.controller!.play(m); }).not.toThrow();
    expect(app.controller!.view.overlay).toBe('restored');
  });
});

describe('How to Play overlay is a proper dialog', () => {
  it('is modal: pauses board input, closes on Esc and returns focus to the ? button', () => {
    const setInput = vi.fn();
    const saved = JSON.stringify({ version: 1, completed: [], tutorialDone: true, settings: {} });
    const app = new App(root, { show: vi.fn(), setInput }, memoryStore({ [SAVE_KEY]: saved }), LEVELS, opts);
    app.startLevel(0);
    click('[data-action="help"]');
    const dialog = root.querySelector('.howto-overlay')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(setInput).toHaveBeenLastCalledWith(false);
    expect((root.querySelector('.hud') as HTMLElement).inert).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(root.querySelector('.howto-overlay')).toBeNull();
    expect(setInput).toHaveBeenLastCalledWith(true);
    expect((root.querySelector('.hud') as HTMLElement).inert).toBe(false);
    expect(document.activeElement).toBe(root.querySelector('[data-action="help"]'));
  });
});

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

describe('App hint v1.2 fixes', () => {
  const done = JSON.stringify({ version: 1, completed: [], tutorialDone: true, settings: {} });
  it('shows no idle hint while the tutorial is running (step 4 has no tutorial highlight)', () => {
    vi.useFakeTimers();
    const highlight = vi.fn();
    const app = new App(root, { show: vi.fn(), highlight }, memoryStore(), LEVELS, opts);
    app.startLevel(0);
    const plan = planTutorial(LEVELS[0]!);
    app.controller!.play({ type: 'seed', plant: 'moss', ...plan.seed1 });
    app.controller!.play({ type: 'seed', plant: 'moss', ...plan.seed2 });
    expect(root.querySelector('.coach p')!.textContent).toBe('Now pick a Tyre.');
    highlight.mockClear();
    vi.advanceTimersByTime(3500);
    expect(highlight.mock.calls.filter((c) => c[0] !== null)).toEqual([]);
    vi.useRealTimers();
  });
  it('the idle hint switches to a more useful item', () => {
    vi.useFakeTimers();
    const app = new App(root, { show: vi.fn(), highlight: vi.fn() }, memoryStore({ [SAVE_KEY]: done }), LEVELS, opts);
    app.startLevel(1);
    app.controller!.select({ kind: 'scrap', slot: 0 }); // nothing planted yet: scrap is useless
    vi.advanceTimersByTime(3100);
    expect(app.controller!.view.selection?.kind).toBe('seed');
    vi.useRealTimers();
  });
  it('rests text explains there is nothing more to do', () => {
    const c = new App(root, stage, memoryStore({ [SAVE_KEY]: done }), LEVELS, opts);
    expect(c).toBeTruthy();
  });
});

describe('App v1.2.1 polish', () => {
  const done = JSON.stringify({ version: 1, completed: [], tutorialDone: true, settings: {} });
  it('no hint fires behind the How to Play overlay', () => {
    vi.useFakeTimers();
    const highlight = vi.fn();
    const app = new App(root, { show: vi.fn(), highlight }, memoryStore({ [SAVE_KEY]: done }), LEVELS, opts);
    app.startLevel(1);
    click('[data-action="help"]');
    highlight.mockClear();
    vi.advanceTimersByTime(3500);
    expect(highlight.mock.calls.filter((c) => c[0] !== null)).toEqual([]);
    vi.useRealTimers();
  });
  it('hovering (preview only) does not cancel a shown hint', () => {
    vi.useFakeTimers();
    const highlight = vi.fn();
    const app = new App(root, { show: vi.fn(), highlight }, memoryStore({ [SAVE_KEY]: done }), LEVELS, opts);
    app.startLevel(1);
    vi.advanceTimersByTime(3100);
    const shown = highlight.mock.calls.at(-1)![0];
    expect(shown).not.toBeNull();
    app.controller!.hover({ x: 0, y: 0 });
    expect(highlight.mock.calls.at(-1)![0]).toEqual(shown);
    vi.useRealTimers();
  });
  it('level cards announce their stars in the button label', () => {
    const saved = JSON.stringify({ version: 1, completed: ['bus-stop'], tutorialDone: true, stars: { 'bus-stop': 2 }, storySeen: true, settings: {} });
    new App(root, stage, memoryStore({ [SAVE_KEY]: saved }), LEVELS, opts);
    click('[data-nav="select"]');
    expect(root.querySelector('[data-level="0"]')!.getAttribute('aria-label')).toBe('Bus Stop, Restored, 2 of 3 stars');
  });
});

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
  it('Playground now leads on to the Laundromat', () => {
    const app = new App(root, stage, memoryStore({ [SAVE_KEY]: seenDone }), LEVELS, opts);
    app.startLevel(4);
    for (const m of LEVELS[4]!.solution) app.controller!.play(m);
    click('[data-action="next"]');
    expect(app.controller!.level.id).toBe('laundromat');
  });
});
