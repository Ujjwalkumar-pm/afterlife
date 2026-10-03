// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
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
