// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayController } from '../../src/game/controller';
import { Hud, PIP_LINE_MS, type HudHandlers } from '../../src/ui/hud';
import { ICONS } from '../../src/ui/icons';
import { makeLevel } from '../engine/helpers';

const handlers = (): HudHandlers & Record<string, ReturnType<typeof vi.fn>> => ({
  select: vi.fn(), undo: vi.fn(), restart: vi.fn(), rotate: vi.fn(), menu: vi.fn(), next: vi.fn(), keepDecorating: vi.fn(), toggleMute: vi.fn(), help: vi.fn(), skipTutorial: vi.fn(),
});
const meta = { name: 'Bus <Stop>', hint: 'Place scrap near a seed.', hasNext: true, muted: false };
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
    expect(root.querySelector('.batches .n')!.textContent).toBe('2');
    expect(root.querySelector('.batches')!.getAttribute('aria-label')).toBe('2 batches left');
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
    const c = new PlayController(makeLevel({ width: 2, height: 1, ground: ['..'], seeds: { moss: 2 }, batches: [['tyre']] }));
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'seed', plant: 'moss', x: 1, y: 0 });
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

describe('Hud re-render stability', () => {
  it('keeps the same DOM nodes when the markup is unchanged (e.g. a camera rotation), so taps and focus survive', () => {
    const c = new PlayController(makeLevel({ width: 3, height: 1, ground: ['...'], target: 0.3, batches: [['tyre', 'tyre']] }));
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'scrap', slot: 0, x: 1, y: 0 });
    const hud = new Hud(root, handlers());
    hud.render(c.view, meta);
    const keep = root.querySelector('[data-action="keep"]');
    c.rotate(1);
    hud.render(c.view, meta);
    expect(root.querySelector('[data-action="keep"]')).toBe(keep);
  });
});

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
  it('toasts the bonus pack when bonusUsed rises', () => {
    let t = 0;
    const c = new PlayController(makeLevel({ batches: [['tyre']] }));
    const hud = new Hud(root, handlers(), () => t);
    hud.render(c.view, meta);
    c.play({ type: 'scrap', slot: 0, x: 0, y: 0 });
    hud.render(c.view, meta);
    expect(root.querySelector('.toast')!.textContent).toBe('Bonus pack: +2 moss, +1 tyre');
    t = 2000;
    hud.render(c.view, meta);
    expect(root.querySelector('.toast')).toBeNull();
  });
});

describe('Hud timed effects expire on their own', () => {
  it('hides the bonus toast and the meter glow without another render', () => {
    vi.useFakeTimers();
    const c = new PlayController(makeLevel({ width: 4, height: 1, ground: ['....'], target: 1, seeds: { moss: 1 }, batches: [['tyre']] }));
    const hud = new Hud(root, handlers());
    hud.render(c.view, meta);
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'scrap', slot: 0, x: 1, y: 0 });
    hud.render(c.view, meta);
    expect(root.querySelector('.toast')).not.toBeNull();
    expect(root.querySelector('.meter')!.classList.contains('glow')).toBe(true);
    vi.advanceTimersByTime(1600);
    expect(root.querySelector('.toast')).toBeNull();
    expect(root.querySelector('.meter')!.classList.contains('glow')).toBe(false);
    vi.useRealTimers();
  });
});

describe('rests copy', () => {
  it('explains what to do', () => {
    const c = new PlayController(makeLevel({ width: 2, height: 1, ground: ['..'], seeds: { moss: 2 }, batches: [['tyre']] }));
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'seed', plant: 'moss', x: 1, y: 0 });
    new Hud(root, handlers()).render(c.view, meta);
    expect(root.querySelector('.overlay p')!.textContent).toBe('Nothing more can grow here. Undo a few moves, or restart.');
  });
});

describe('v1.2.1 polish', () => {
  const bonusLevel = () => makeLevel({ width: 4, height: 1, ground: ['....'], target: 1, seeds: { moss: 1 }, batches: [['tyre']] });
  it('sparkles the tray while the bonus toast shows', () => {
    const c = new PlayController(bonusLevel());
    const hud = new Hud(root, handlers());
    hud.render(c.view, meta);
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'scrap', slot: 0, x: 1, y: 0 });
    hud.render(c.view, meta);
    expect(root.querySelector('.tray')!.classList.contains('sparkle')).toBe(true);
  });
  it('expiry keeps the same buttons, so a tap at that moment is not lost', () => {
    vi.useFakeTimers();
    const c = new PlayController(bonusLevel());
    const hud = new Hud(root, handlers());
    hud.render(c.view, meta);
    c.play({ type: 'seed', plant: 'moss', x: 0, y: 0 });
    c.play({ type: 'scrap', slot: 0, x: 1, y: 0 });
    hud.render(c.view, meta);
    const undo = root.querySelector('[data-action="undo"]');
    vi.advanceTimersByTime(1600);
    expect(root.querySelector('.toast')).toBeNull();
    expect(root.querySelector('.tray')!.classList.contains('sparkle')).toBe(false);
    expect(root.querySelector('[data-action="undo"]')).toBe(undo);
    vi.useRealTimers();
  });
});

describe('Hud Pip', () => {
  const pip = () => root.querySelector('.pip')!;
  const line = () => root.querySelector<HTMLElement>('.pip-line')!;

  it('shows Pip idle and silent, outside the HUD markup', () => {
    const hud = new Hud(root, handlers());
    hud.render(new PlayController(makeLevel({})).view, meta);
    expect(pip().className).toBe('pip mood-idle');
    expect(line().hidden).toBe(true);
    expect(root.querySelector('.pip-sr')!.getAttribute('aria-live')).toBe('polite');
    expect(line().getAttribute('aria-hidden')).toBe('true');
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

describe('Hud look and feel', () => {
  it('uses SVG icons only in the tools (no emoji or text glyphs) grouped in a labelled group', () => {
    const hud = new Hud(root, handlers());
    hud.render(new PlayController(makeLevel({})).view, meta);
    const tools = root.querySelector('.hud-tools')!;
    expect(tools.getAttribute('role')).toBe('group');
    expect(tools.getAttribute('aria-label')).toBe('Tools');
    expect(tools.querySelectorAll('.sep')).toHaveLength(3);
    for (const b of root.querySelectorAll('.hud-tools button, [data-action="menu"]')) {
      expect(b.querySelector('svg'), b.getAttribute('aria-label')!).not.toBeNull();
      expect(b.textContent!.trim()).toBe('');
    }
  });
  it('switches the sound icon with mute and shows the meter percentage', () => {
    const hud = new Hud(root, handlers());
    const v = new PlayController(makeLevel({})).view;
    hud.render(v, { ...meta, muted: true });
    // Compare the icon's drawing, not raw markup (the DOM re-serialises <path/> as <path></path>).
    const paths = (html: string) => [...html.matchAll(/ d="([^"]+)"/g)].map((x) => x[1]);
    expect(paths(root.querySelector('[data-action="mute"]')!.innerHTML)).toEqual(paths(ICONS['sound-off']!));
    hud.render(v, { ...meta, muted: false });
    expect(paths(root.querySelector('[data-action="mute"]')!.innerHTML)).toEqual(paths(ICONS['sound-on']!));
    expect(root.querySelector('.meter-pct')!.textContent).toBe('0%');
  });
  it('puts overlays in a panel card', () => {
    const c = new PlayController(makeLevel({}));
    const hud = new Hud(root, handlers());
    hud.render(c.view, meta);
    hud.showError();
    expect(root.querySelector('.overlay > .panel h2')!.textContent).toBe('Something went wrong');
  });
});

describe('Hud v1.3.1 polish', () => {
  it('announces Pip through a live region that is always present and only changes its text', () => {
    vi.useFakeTimers();
    const hud = new Hud(root, handlers());
    const sr = root.querySelector<HTMLElement>('.pip-sr')!;
    expect(sr.hidden).toBe(false);
    expect(sr.textContent).toBe('');
    hud.setPip({ mood: 'cheer', line: 'Lush!' });
    expect(root.querySelector('.pip-sr')).toBe(sr);
    expect(sr.textContent).toBe('Lush!');
    vi.advanceTimersByTime(PIP_LINE_MS);
    expect(sr.textContent).toBe('');
    vi.useRealTimers();
  });
  it('a second line in the same mood replays its animation (the say counter flips)', () => {
    const hud = new Hud(root, handlers());
    const pipEl = root.querySelector<HTMLElement>('.pip')!;
    hud.setPip({ mood: 'cheer', line: 'Nice!' });
    const first = pipEl.dataset.say;
    hud.setPip({ mood: 'cheer', line: 'Lush!' });
    expect(pipEl.dataset.say).not.toBe(first);
  });
  it('the mute button is labelled Mute and pressed only while muted', () => {
    const hud = new Hud(root, handlers());
    const v = new PlayController(makeLevel({})).view;
    hud.render(v, { ...meta, muted: true });
    const b = root.querySelector('[data-action="mute"]')!;
    expect(b.getAttribute('aria-label')).toBe('Mute');
    expect(b.getAttribute('aria-pressed')).toBe('true');
  });
});
