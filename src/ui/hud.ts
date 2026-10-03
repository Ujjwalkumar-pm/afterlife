import { PLANT_TYPES, RADIUS, SCRAP, type PlantType } from '../engine';
import type { Selection, View } from '../game/controller';
import type { CoachStep } from '../game/tutorial';
import { ICONS } from './icons';

export interface HudHandlers {
  select(sel: Selection): void;
  undo(): void;
  restart(): void;
  rotate(dir: 1 | -1): void;
  menu(): void;
  next(): void;
  keepDecorating(): void;
  toggleMute(): void;
  help(): void;
  skipTutorial(): void;
}

export interface HudMeta {
  name: string;
  hint: string;
  hasNext: boolean;
  muted: boolean;
  tutorial?: CoachStep | null;
  stars?: 1 | 2 | 3 | null;
}

const LABEL: Record<PlantType, string> = { moss: 'Moss', vine: 'Vine', flower: 'Flower', bamboo: 'Bamboo' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export class Hud {
  readonly el: HTMLElement;
  private error = false;
  private last: { view: View; meta: HudMeta } | null = null;
  private lastHtml = '';
  private lastOverlay = '';
  private prevProgress: number | null = null;
  private glowUntil = 0;
  private prevSeeds: Record<string, number> | null = null;
  private bumpUntil: Record<string, number> = {};
  private prevBonus: number | null = null;
  private toastUntil = 0;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    root: HTMLElement,
    private readonly handlers: HudHandlers,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.onClick(e));
  }

  render(view: View, meta: HudMeta): void {
    this.last = { view, meta };
    const t = this.now();
    if (this.prevProgress !== null && view.progress - this.prevProgress >= 0.05) this.glowUntil = t + 700;
    this.prevProgress = view.progress;
    if (this.prevSeeds) for (const [k, n] of Object.entries(view.state.seeds)) if (n > (this.prevSeeds[k] ?? 0)) this.bumpUntil[k] = t + 500;
    this.prevSeeds = { ...view.state.seeds };
    if (this.prevBonus !== null && view.state.bonusUsed > this.prevBonus) this.toastUntil = t + 1500;
    this.prevBonus = view.state.bonusUsed;
    this.scheduleExpiry(t);
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

  /** Timed effects (toast, meter glow) must disappear on their own, even if nothing else changes. */
  private scheduleExpiry(t: number): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    const next = Math.min(...[this.toastUntil, this.glowUntil].filter((u) => u > t));
    if (!Number.isFinite(next)) return;
    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = null;
      if (this.last) this.render(this.last.view, this.last.meta);
    }, next - t + 20);
  }

  showError(): void {
    this.error = true;
    if (this.last) this.render(this.last.view, this.last.meta);
  }

  destroy(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
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
      case 'help':
        return h.help();
      case 'skip-tutorial':
        return h.skipTutorial();
    }
  }

  private html(v: View, m: HudMeta): string {
    const s = v.state;
    const sel = v.selection;
    const pct = Math.round(v.progress * 100);
    const now = this.now();
    const coach = m.tutorial ?? null;
    const seeds = PLANT_TYPES.filter((p) => s.seeds[p] > 0)
      .map((p) => {
        const on = sel?.kind === 'seed' && sel.plant === p;
        const cls = `${on ? 'selected' : ''} ${(this.bumpUntil[p] ?? 0) > now ? 'bump' : ''} ${coach?.target === 'seed-moss' && p === 'moss' ? 'coach-target' : ''}`.trim();
        return `<button data-action="seed" data-plant="${p}" class="${cls}" aria-pressed="${on}">${ICONS[p]}${LABEL[p]} <span class="count">${s.seeds[p]}</span></button>`;
      })
      .join('');
    const scrap = s.tray
      .map((k, i) => {
        const on = sel?.kind === 'scrap' && sel.slot === i;
        const reach = RADIUS[SCRAP[k].size];
        const cls = `${on ? 'selected' : ''} ${coach?.target === 'scrap' && i === 0 ? 'coach-target' : ''}`.trim();
        return `<button data-action="scrap" data-slot="${i}" class="${cls}" aria-pressed="${on}">${ICONS[k] ?? ''}${cap(k)} <span class="reach" aria-label="reaches ${reach}">◇${reach}</span></button>`;
      })
      .join('');
    return `
<header class="hud-top">
  <button data-action="menu" aria-label="Back to places">☰</button>
  <div class="level-name">${esc(m.name)}</div>
  <div class="meter ${this.glowUntil > now ? 'glow' : ''} ${coach?.target === 'meter' ? 'coach-target' : ''}" role="progressbar" aria-label="Greenery" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="meter-fill" style="width:${pct}%"></div><i class="tick" style="left:25%"></i><i class="tick" style="left:50%"></i><i class="tick" style="left:75%"></i></div>
  <div class="batches" aria-label="${s.batches.length} batches left">${s.batches.map(() => '<i></i>').join('')}</div>
</header>
${coach ? `<div class="coach" role="status"><span class="coach-step">Step ${coach.step} of ${coach.total}</span><p>${esc(coach.text)}</p><button data-action="skip-tutorial">Skip tutorial</button></div>` : `<p class="hint">${esc(m.hint)}</p>`}
<div class="hud-tools">
  <button data-action="help" aria-label="How to play">${ICONS.help}</button>
  <button data-action="undo" aria-label="Undo" ${v.canUndo ? '' : 'disabled'}>↶</button>
  <button data-action="restart" aria-label="Restart level">⟲</button>
  <button data-action="rotate-left" aria-label="Rotate left">◀</button>
  <button data-action="rotate-right" aria-label="Rotate right">▶</button>
  <button data-action="mute" aria-label="Sound" aria-pressed="${m.muted}">${m.muted ? '🔇' : '🔊'}</button>
</div>
<footer class="tray">${seeds ? `<span class="group-label">Seeds</span>${seeds}` : ''}${scrap ? `<span class="group-label">Scrap</span>${scrap}` : ''}</footer>
${this.toastUntil > now ? '<div class="toast" role="status">Bonus pack: +2 moss, +1 tyre</div>' : ''}
${this.overlay(v, m)}`;
  }

  private overlay(v: View, m: HudMeta): string {
    if (this.error) {
      return `<div class="overlay" role="dialog" aria-label="Error"><h2>Something went wrong</h2><div class="actions"><button data-action="restart" class="primary">Restart level</button><button data-action="menu">Back to places</button></div></div>`;
    }
    if (v.overlay === 'restored') {
      const primary = m.hasNext ? '<button data-action="next" class="primary">Next place</button>' : '<button data-action="menu" class="primary">Back to places</button>';
      return `<div class="overlay" role="dialog" aria-label="Scene restored"><h2>Scene restored</h2>${m.stars ? `<div class="stars" aria-label="${m.stars} of 3 stars">${[1, 2, 3].map((i) => `<span class="star ${i <= m.stars! ? 'on' : ''}" style="animation-delay:${(i - 1) * 150}ms">★</span>`).join('')}</div>` : ''}<p>Nature has taken ${esc(m.name)} back.</p><div class="actions">${primary}<button data-action="keep">Keep decorating</button></div></div>`;
    }
    if (v.overlay === 'rests') {
      return `<div class="overlay" role="dialog" aria-label="The garden rests"><h2>The garden rests…</h2><p>Nothing more can grow here. Undo a few moves, or restart.</p><div class="actions"><button data-action="undo" class="primary">Undo</button><button data-action="restart">Restart</button></div></div>`;
    }
    return '';
  }
}
