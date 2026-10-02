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
