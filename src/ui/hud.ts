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
  toggleMute(): void;
}

export interface HudMeta {
  name: string;
  hint: string;
  hasNext: boolean;
  muted: boolean;
}

const SWATCH: Record<PlantType, string> = { moss: '#89a94a', vine: '#58934a', flower: '#e89ab0', bamboo: '#9fb85a' };
const LABEL: Record<PlantType, string> = { moss: 'Moss', vine: 'Vine', flower: 'Flower', bamboo: 'Bamboo' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export class Hud {
  readonly el: HTMLElement;
  private error = false;
  private last: { view: View; meta: HudMeta } | null = null;
  private lastHtml = '';
  private lastOverlay = '';

  constructor(root: HTMLElement, private readonly handlers: HudHandlers) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.onClick(e));
  }

  render(view: View, meta: HudMeta): void {
    this.last = { view, meta };
    const html = this.html(view, meta);
    // Unchanged markup (e.g. a camera rotation) keeps the same nodes, so a press in progress
    // still completes as a click and keyboard focus is not lost.
    if (html === this.lastHtml) return;
    this.lastHtml = html;
    this.el.innerHTML = html;
    const overlay = this.error ? 'error' : view.overlay;
    if (overlay !== this.lastOverlay) {
      this.lastOverlay = overlay;
      if (overlay !== 'none') this.el.querySelector<HTMLElement>('.overlay .primary')?.focus();
    }
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
      case 'mute':
        return h.toggleMute();
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
  <button data-action="mute" aria-label="Sound" aria-pressed="${m.muted}">${m.muted ? '🔇' : '🔊'}</button>
</div>
<footer class="tray">${seeds ? `<span class="group-label">Seeds</span>${seeds}` : ''}${scrap ? `<span class="group-label">Scrap</span>${scrap}` : ''}</footer>
${this.overlay(v, m)}`;
  }

  private overlay(v: View, m: HudMeta): string {
    if (this.error) {
      return `<div class="overlay" role="dialog" aria-label="Error"><h2>Something went wrong</h2><div class="actions"><button data-action="restart" class="primary">Restart level</button><button data-action="menu">Back to places</button></div></div>`;
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
