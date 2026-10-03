// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayController } from '../../src/game/controller';
import { Hud, type HudHandlers } from '../../src/ui/hud';
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
