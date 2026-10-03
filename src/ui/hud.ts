import { PLANT_TYPES, RADIUS, SCRAP, type PlantType } from '../engine';
import { MAX_HINTS } from '../game/scoring';
import type { Selection, View } from '../game/controller';
import type { CoachStep } from '../game/tutorial';
import type { PipMood, PipSay } from '../game/pip';
import { ICONS } from './icons';
import { pipSvg } from './pip';

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
  hint(): void;
  shareBadge(): void;
}

export interface HudMeta {
  name: string;
  hint: string;
  hasNext: boolean;
  muted: boolean;
  tutorial?: CoachStep | null;
  stars?: 1 | 2 | 3 | null;
  /** Hints left in this place (undefined hides the Hint button). */
  hintsLeft?: number;
  /** False during the tutorial or while a panel is open. */
  hintAvailable?: boolean;
  /** Idle nudge: the bulb pulses. */
  nudge?: boolean;
  /** Hints used, shown on the win panel. */
  hintsUsed?: number;
  /** The earned badge (SVG markup), shown on the win panel. */
  badge?: string;
}

const LABEL: Record<PlantType, string> = { moss: 'Moss', vine: 'Vine', flower: 'Flower', bamboo: 'Bamboo' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const PIP_LINE_MS = 2500;

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
  private readonly pipEl: HTMLElement;
  private pipRest: PipMood = 'idle';
  private pipTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    root: HTMLElement,
    private readonly handlers: HudHandlers,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.onClick(e));
    // Pip lives beside the HUD markup, so HUD redraws never restart its animation or wipe its line.
    this.pipEl = document.createElement('div');
    this.pipEl.className = 'pip mood-idle';
    this.pipEl.innerHTML = `${pipSvg()}<p class="pip-line" aria-hidden="true" hidden></p><p class="pip-sr" aria-live="polite"></p>`;
    root.appendChild(this.pipEl);
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
    // Rebuilding replaces the buttons; put keyboard focus back on the same control.
    const active = document.activeElement as HTMLElement | null;
    const focusKey = active && this.el.contains(active) && active.dataset.action ? `[data-action="${active.dataset.action}"]${active.dataset.slot ? `[data-slot="${active.dataset.slot}"]` : ''}${active.dataset.plant ? `[data-plant="${active.dataset.plant}"]` : ''}` : null;
    this.el.innerHTML = html;
    if (focusKey) this.el.querySelector<HTMLElement>(focusKey)?.focus();
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
      // Patch the DOM in place (no innerHTML rebuild), so a tap landing right now is not lost.
      const now = this.now();
      if (this.toastUntil <= now) {
        this.el.querySelector('.toast')?.remove();
        this.el.querySelector('.tray')?.classList.remove('sparkle');
      }
      if (this.glowUntil <= now) this.el.querySelector('.meter')?.classList.remove('glow');
      if (this.last) this.lastHtml = this.html(this.last.view, this.last.meta);
      this.scheduleExpiry(now);
    }, next - t + 20);
  }

  showError(): void {
    this.error = true;
    if (this.last) this.render(this.last.view, this.last.meta);
  }

  /** A line shows its mood for PIP_LINE_MS, then Pip returns to its resting mood. A silent say only changes the rest. */
  setPip(say: PipSay): void {
    if (say.line === null) {
      this.pipRest = say.mood;
      if (!this.pipTimer) this.pipEl.className = `pip mood-${say.mood}`;
      return;
    }
    this.pipEl.className = `pip mood-${say.mood}`;
    // Flip the say counter so CSS can replay the mood's animation for a back-to-back line.
    this.pipEl.dataset.say = this.pipEl.dataset.say === '1' ? '0' : '1';
    const line = this.pipEl.querySelector<HTMLElement>('.pip-line')!;
    const sr = this.pipEl.querySelector<HTMLElement>('.pip-sr')!;
    line.textContent = say.line;
    line.hidden = false;
    // The live region stays in place; only its text changes, so screen readers reliably announce it.
    sr.textContent = say.line;
    if (this.pipTimer) clearTimeout(this.pipTimer);
    this.pipTimer = setTimeout(() => {
      this.pipTimer = null;
      line.hidden = true;
      sr.textContent = '';
      this.pipEl.className = `pip mood-${this.pipRest}`;
    }, PIP_LINE_MS);
  }

  destroy(): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    if (this.pipTimer) clearTimeout(this.pipTimer);
    this.pipTimer = null;
    this.pipEl.remove();
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
      case 'hint':
        return h.hint();
      case 'share-badge':
        return h.shareBadge();
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
        return `<button data-action="scrap" data-slot="${i}" class="${cls}" aria-pressed="${on}">${ICONS[k] ?? ''}<span class="label">${cap(k)}</span> <span class="reach" title="Reaches ${reach} tile${reach === 1 ? '' : 's'}" aria-label="reaches ${reach} tile${reach === 1 ? '' : 's'}">${ICONS.ring}<span class="n">${reach}</span></span></button>`;
      })
      .join('');
    const upcoming = s.batches[0] ?? [];
    const next = upcoming.length ? `<div class="next-chip" role="note" aria-label="Next: ${upcoming.join(', ')}"><span class="group-label">Next</span>${upcoming.map((k) => ICONS[k] ?? '').join('')}</div>` : '';
    return `
<header class="hud-top">
  <button data-action="menu" aria-label="Back to places">${ICONS.menu}</button>
  <div class="level-name">${esc(m.name)}</div>
  <div class="meter ${this.glowUntil > now ? 'glow' : ''} ${coach?.target === 'meter' ? 'coach-target' : ''}" role="progressbar" aria-label="Greenery" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><div class="meter-fill" style="width:${pct}%"></div><i class="tick" style="left:25%"></i><i class="tick" style="left:50%"></i><i class="tick" style="left:75%"></i></div>
  <span class="meter-pct" aria-hidden="true">${pct}%</span>
  <div class="batches" title="Scrap batches left" aria-label="${s.batches.length} batches left">${ICONS.crate}<span class="n">${s.batches.length}</span></div>
</header>
${coach ? `<div class="coach" role="status"><span class="coach-step">Step ${coach.step} of ${coach.total}</span><p>${esc(coach.text)}</p><button data-action="skip-tutorial">Skip tutorial</button></div>` : `<p class="hint">${esc(m.hint)}</p>`}
<div class="hud-tools" role="group" aria-label="Tools">
  <button data-action="help" aria-label="How to play">${ICONS.help}</button>
  ${m.hintsLeft === undefined ? '' : `<button data-action="hint" class="${m.nudge && m.hintsLeft > 0 && m.hintAvailable ? 'nudge' : ''}" aria-label="${m.hintsLeft > 0 ? `Hint, ${m.hintsLeft} left` : 'No hints left'}" ${m.hintsLeft > 0 && m.hintAvailable ? '' : 'disabled'}>${ICONS.bulb}<span class="hint-count" aria-hidden="true">${m.hintsLeft}</span></button>`}
  <span class="sep"></span>
  <button data-action="undo" aria-label="Undo" ${v.canUndo ? '' : 'disabled'}>${ICONS.undo}</button>
  <button data-action="restart" aria-label="Restart level">${ICONS.restart}</button>
  <span class="sep"></span>
  <button data-action="rotate-left" aria-label="Turn left">${ICONS['rotate-left']}</button>
  <button data-action="rotate-right" aria-label="Turn right">${ICONS['rotate-right']}</button>
  <span class="sep"></span>
  <button data-action="mute" aria-label="Mute" aria-pressed="${m.muted}">${m.muted ? ICONS['sound-off'] : ICONS['sound-on']}</button>
</div>
<footer class="tray ${this.toastUntil > now ? 'sparkle' : ''}">${seeds ? `<span class="group-label">Seeds</span>${seeds}` : ''}${scrap ? `<span class="group-label">Scrap</span>${scrap}` : ''}</footer>
${next}
${this.toastUntil > now ? '<div class="toast" role="status">Bonus pack: +2 moss, +1 tyre</div>' : ''}
${this.overlay(v, m)}`;
  }

  private overlay(v: View, m: HudMeta): string {
    if (this.error) {
      return `<div class="overlay" role="dialog" aria-label="Error"><div class="panel"><h2>Something went wrong</h2><div class="actions"><button data-action="restart" class="primary">Restart level</button><button data-action="menu">Back to places</button></div></div></div>`;
    }
    if (v.overlay === 'restored') {
      const primary = m.hasNext ? '<button data-action="next" class="primary">Next place</button>' : '<button data-action="menu" class="primary">Back to places</button>';
      return `<div class="overlay" role="dialog" aria-label="Scene restored"><div class="panel"><h2>Scene restored</h2>${m.stars ? `<div class="stars" aria-label="${m.stars} of 3 stars">${[1, 2, 3].map((i) => `<span class="star ${i <= m.stars! ? 'on' : ''}" style="animation-delay:${(i - 1) * 150}ms">★</span>`).join('')}</div>` : ''}<p>Nature has taken ${esc(m.name)} back.</p>${m.hintsUsed ? `<p class="hints-used">Hints used: ${m.hintsUsed} of ${MAX_HINTS}</p>` : ''}${m.badge ? `<div class="badge-earned"><p>You earned the ${esc(m.name)} badge</p>${m.badge}</div>` : ''}<div class="actions">${primary}${m.badge ? '<button data-action="share-badge">Share badge</button>' : ''}<button data-action="keep">Keep decorating</button></div></div></div>`;
    }
    if (v.overlay === 'rests') {
      return `<div class="overlay" role="dialog" aria-label="The garden rests"><div class="panel"><h2>The garden rests…</h2><p>Nothing more can grow here. Undo a few moves, or restart.</p><div class="actions"><button data-action="undo" class="primary">Undo</button><button data-action="restart">Restart</button></div></div></div>`;
    }
    return '';
  }
}
