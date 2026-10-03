import type { LevelData, Pos } from '../engine';
import { PlayController } from '../game/controller';
import type { AttachOptions } from '../render/scene/DioramaScene';
import { loadSave, markCompleted, recordStars, writeSave, type SaveData, type Store } from '../save/save';
import { Hud } from '../ui/hud';
import { cuesFor } from '../audio/cues';
import { planTutorial, Tutorial } from '../game/tutorial';
import { suggestMove } from '../game/hints';
import { MAX_HINTS, milestonesCrossed, starsFor } from '../game/scoring';
import { ICONS } from '../ui/icons';
import { silentSound, type Sound } from '../audio/sound';
import { levelStatuses, type LevelStatus } from './progress';
import { pipFor } from '../game/pip';
import { STORY_BEATS, StoryPlayer } from '../ui/story';

export interface Stage {
  show(ctrl: PlayController | null, opts: AttachOptions): void;
  highlight?(tile: Pos | null): void;
  /** Pause/resume board input (pointer and keys), e.g. while a dialog is open. */
  setInput?(on: boolean): void;
}
export interface AppOptions {
  /** Milliseconds between title-screen demo moves; null disables the demo (tests). */
  demoIntervalMs: number | null;
  prefersReducedMotion: boolean;
}
export type Screen = 'title' | 'select' | 'settings' | 'credits' | 'howto' | 'play' | 'story';
type MenuScreen = Exclude<Screen, 'play' | 'story'>;

const STATUS_TEXT: Record<LevelStatus, string> = { locked: 'Locked', open: 'Ready', completed: 'Restored' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export class App {
  screen: Screen = 'title';
  controller: PlayController | null = null;
  private save: SaveData;
  private levelIndex = 0;
  private hud: Hud | null = null;
  private unsubscribe: (() => void) | null = null;
  private demoTimer: ReturnType<typeof setInterval> | null = null;
  private renderHud: (() => void) | null = null;
  private tutorial: Tutorial | null = null;
  private tutorialTimer: ReturnType<typeof setTimeout> | null = null;
  private howto: HTMLElement | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private hintShown = false;
  /** True while the hint itself switches the tray item, so that change doesn't restart the idle timer. */
  private hintSelecting = false;
  private hintsUsed = 0;
  private nudge = false;
  private lastStars: 1 | 2 | 3 | null = null;
  private story: StoryPlayer | null = null;
  private readonly onHowtoKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.closeHowTo();
  };

  constructor(
    private readonly root: HTMLElement,
    private readonly stage: Stage,
    private readonly store: Store | null,
    private readonly levels: LevelData[],
    private readonly options: AppOptions,
    private readonly sound: Sound = silentSound,
  ) {
    this.save = loadSave(store);
    this.sound.setMuted(this.save.settings.muted);
    this.sound.setVolume(this.save.settings.volume);
    this.sound.setAmbient(true);
    // Keep trying on every gesture until audio actually runs (iOS may refuse the first resume).
    const unlock = () => {
      if (this.sound.ready) return;
      try {
        this.sound.unlock();
      } catch (err) {
        console.warn('[Afterlife] audio unlock failed', err);
      }
    };
    root.addEventListener('pointerdown', unlock, true);
    root.addEventListener('click', unlock, true);
    this.sound.onChange(() => this.renderHud?.());
    this.applyMotionClass();
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('change', (e) => this.onInput(e));
    this.show('title');
  }

  get reducedMotion(): boolean {
    return this.options.prefersReducedMotion || this.save.settings.reducedMotion;
  }

  show(screen: MenuScreen): void {
    this.teardown();
    this.screen = screen;
    this.sound.setProgress(0);
    this.root.innerHTML = this.template(screen);
    if (screen === 'title') this.startDemo();
    else this.stage.show(null, { reducedMotion: this.reducedMotion, interactive: false });
  }

  startLevel(index: number, opts: { tutorial?: boolean } = {}): void {
    const level = this.levels[index];
    if (!level) return this.show('select');
    this.teardown();
    this.screen = 'play';
    this.levelIndex = index;
    this.root.innerHTML = '';
    const ctrl = new PlayController(level, { assist: true });
    this.controller = ctrl;
    this.tutorial = index === 0 && (opts.tutorial || !this.save.tutorialDone) ? new Tutorial(planTutorial(level)) : null;
    this.tutorial?.update(ctrl.view, []);
    const hud = new Hud(this.root, {
      select: (sel) => ctrl.select(sel),
      undo: () => ctrl.undo(),
      restart: () => {
        this.hintsUsed = 0;
        ctrl.restart();
        // Restarting an untouched board changes nothing, so clear a shown hint explicitly.
        this.scheduleHint();
        this.renderHud?.();
      },
      rotate: (dir) => ctrl.rotate(dir),
      menu: () => this.show('select'),
      next: () => this.startLevel(this.levelIndex + 1),
      keepDecorating: () => ctrl.keepDecorating(),
      toggleMute: () => this.toggleMute(),
      help: () => this.openHowTo(),
      skipTutorial: () => this.finishTutorial(),
      hint: () => this.useHint(),
    });
    this.hud = hud;
    const meta = () => ({ name: level.name, hint: level.hint, hasNext: index + 1 < this.levels.length, muted: this.save.settings.muted || !this.sound.available, tutorial: this.tutorial?.current ?? null, stars: ctrl.view.overlay === 'restored' ? this.lastStars : null, hintsLeft: MAX_HINTS - this.hintsUsed, hintAvailable: !this.tutorial && ctrl.view.overlay === 'none', nudge: this.nudge, hintsUsed: this.hintsUsed });
    let lastOverlay = ctrl.view.overlay;
    let lastProgress = ctrl.view.progress;
    let hintState = ctrl.view.state;
    let hintSel = JSON.stringify(ctrl.view.selection);
    let hintOverlay = ctrl.view.overlay;
    this.unsubscribe = ctrl.onChange((view, events) => {
      if (events.some((e) => e.type === 'won')) {
        this.save = markCompleted(this.save, level.id);
        this.lastStars = starsFor(level, view.state, this.hintsUsed);
        this.save = recordStars(this.save, level.id, this.lastStars);
        writeSave(this.store, this.save);
      }
      const cues = cuesFor(events);
      const milestone = milestonesCrossed(lastProgress, view.progress).length > 0;
      if (milestone) cues.push('milestone');
      lastProgress = view.progress;
      const newOverlay = view.overlay !== lastOverlay ? view.overlay : 'none';
      if (view.overlay !== lastOverlay && view.overlay === 'restored') cues.push('won');
      if (view.overlay !== lastOverlay && view.overlay === 'rests') cues.push('rests');
      lastOverlay = view.overlay;
      try {
        this.sound.play(cues);
        this.sound.setProgress(view.progress);
      } catch (err) {
        console.warn('[Afterlife] sound cue failed', err);
      }
      if (this.tutorial) {
        this.tutorial.update(view, events);
        if (this.tutorial.done) this.finishTutorial();
        else {
          this.stage.highlight?.(this.tutorial.highlight);
          if (this.tutorial.step === 6 && !this.tutorialTimer) this.tutorialTimer = setTimeout(() => this.finishTutorial(), 4000);
        }
      }
      hud.render(view, meta());
      hud.setPip(pipFor({ newOverlay, tutorial: !!this.tutorial, events, milestone, hint: false }));
      // Hover-only changes (a new preview) must not cancel a shown hint; real changes do.
      const selKey = JSON.stringify(view.selection);
      if (view.state !== hintState || selKey !== hintSel || view.overlay !== hintOverlay) {
        hintState = view.state;
        hintSel = selKey;
        hintOverlay = view.overlay;
        if (!this.hintSelecting) this.scheduleHint();
      }
    });
    this.renderHud = () => hud.render(ctrl.view, meta());
    hud.render(ctrl.view, meta());
    hud.setPip(pipFor({ newOverlay: 'none', tutorial: !!this.tutorial, events: [], milestone: false, hint: false }));
    this.scheduleHint();
    this.stage.show(ctrl, {
      reducedMotion: this.reducedMotion,
      interactive: true,
      trayTarget: (plant) => {
        const el = this.root.querySelector<HTMLElement>(`[data-action="seed"][data-plant="${plant}"]`) ?? this.root.querySelector<HTMLElement>('.tray');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      },
    });
    this.stage.highlight?.(this.tutorial?.highlight ?? null);
  }

  showError(): void {
    this.hud?.showError();
  }

  private teardown(): void {
    this.story?.destroy();
    this.story = null;
    if (this.demoTimer) clearInterval(this.demoTimer);
    this.demoTimer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.hud?.destroy();
    this.hud = null;
    this.renderHud = null;
    if (this.tutorialTimer) clearTimeout(this.tutorialTimer);
    this.tutorialTimer = null;
    this.tutorial = null;
    if (this.howto) this.closeHowTo(false);
    if (this.hintTimer) clearTimeout(this.hintTimer);
    this.hintTimer = null;
    this.hintShown = false;
    this.hintsUsed = 0;
    this.nudge = false;
    this.lastStars = null;
    this.stage.highlight?.(null);
    this.controller = null;
  }

  /** Title background: level 1's reference solution plays itself, slowly, on a loop. */
  private startDemo(): void {
    const level = this.levels[0];
    if (this.options.demoIntervalMs === null || !level) {
      this.stage.show(null, { reducedMotion: this.reducedMotion, interactive: false });
      return;
    }
    let demo = new PlayController(level);
    let step = 0;
    this.stage.show(demo, { reducedMotion: this.reducedMotion, interactive: false });
    this.demoTimer = setInterval(() => {
      const move = level.solution[step++];
      if (move) {
        demo.play(move);
        return;
      }
      if (step > level.solution.length + 4) {
        demo = new PlayController(level);
        step = 0;
        this.stage.show(demo, { reducedMotion: this.reducedMotion, interactive: false });
      }
    }, this.options.demoIntervalMs);
  }

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
        // The dialog's buttons are gone; give focus a home on the new screen.
        this.root.querySelector<HTMLElement>('.level-card:not([disabled]), .menu .primary, .screen button')?.focus();
      },
    });
  }

  private onClick(e: Event): void {
    const el = e.target as HTMLElement;
    if (el.closest('[data-close-howto]')) return this.closeHowTo();
    if (el.closest('[data-replay-tutorial]')) return this.startLevel(0, { tutorial: true });
    const nav = el.closest<HTMLElement>('[data-nav]');
    if (nav) {
      const to = nav.dataset.nav as MenuScreen | 'story';
      if (to === 'story') return this.playStory('title');
      if (to === 'select' && this.screen === 'title' && !this.save.storySeen) return this.playStory('select');
      return this.show(to);
    }
    const card = el.closest<HTMLButtonElement>('[data-level]');
    if (card && !card.disabled) this.startLevel(Number(card.dataset.level));
  }

  /** Any real change hides a shown hint and the nudge, then re-arms the idle nudge (8 s). */
  private scheduleHint(): void {
    if (this.hintTimer) clearTimeout(this.hintTimer);
    if (this.hintShown) {
      this.hintShown = false;
      this.stage.highlight?.(this.tutorial?.highlight ?? null);
    }
    if (this.nudge) {
      this.nudge = false;
      this.renderHud?.();
    }
    const ctrl = this.controller;
    if (!ctrl) return;
    this.hintTimer = setTimeout(() => {
      this.hintTimer = null;
      // A nudge only points at the bulb: it reveals nothing and costs nothing.
      if (this.controller !== ctrl || this.tutorial || this.howto || ctrl.view.overlay !== 'none' || this.hintsUsed >= MAX_HINTS) return;
      this.nudge = true;
      this.renderHud?.();
      this.hud?.setPip({ mood: 'point', line: 'Stuck? Tap the bulb for a hint.' });
    }, 8000);
  }

  /** The Hint button: shows the best move. 3 per place; each one lowers the most stars you can get. */
  private useHint(): void {
    const ctrl = this.controller;
    if (!ctrl || this.tutorial || this.howto || ctrl.view.overlay !== 'none' || this.hintsUsed >= MAX_HINTS) return;
    const say = pipFor({ newOverlay: 'none', tutorial: false, events: [], milestone: false, hint: true });
    if (this.hintShown) {
      this.hud?.setPip(say); // the same hint is still on screen: no charge
      return;
    }
    const move = suggestMove(ctrl.view.state, ctrl.view.selection);
    if (!move) return;
    this.hintsUsed += 1;
    this.nudge = false;
    if (move.selection && JSON.stringify(move.selection) !== JSON.stringify(ctrl.view.selection)) {
      this.hintSelecting = true;
      try {
        ctrl.select(move.selection);
      } finally {
        this.hintSelecting = false;
      }
    }
    this.hintShown = true;
    this.stage.highlight?.(move.tile);
    this.renderHud?.();
    this.hud?.setPip(say);
  }

  private applyMotionClass(): void {
    document.documentElement.classList.toggle('reduce-motion', this.reducedMotion);
  }

  private finishTutorial(): void {
    if (this.tutorialTimer) clearTimeout(this.tutorialTimer);
    this.tutorialTimer = null;
    this.tutorial = null;
    this.stage.highlight?.(null);
    if (!this.save.tutorialDone) {
      this.save = { ...this.save, tutorialDone: true };
      writeSave(this.store, this.save);
    }
    this.hud?.setPip({ mood: 'idle', line: null });
    this.renderHud?.();
  }

  openHowTo(): void {
    if (this.howto) return;
    const el = document.createElement('div');
    el.className = 'howto-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'How to play');
    el.innerHTML = this.howtoHtml(true);
    this.root.appendChild(el);
    this.howto = el;
    if (this.hud) this.hud.el.inert = true;
    this.stage.setInput?.(false);
    document.addEventListener('keydown', this.onHowtoKey);
    el.querySelector<HTMLElement>('[data-close-howto]')?.focus();
  }

  private closeHowTo(restoreFocus = true): void {
    if (!this.howto) return;
    this.howto.remove();
    this.howto = null;
    document.removeEventListener('keydown', this.onHowtoKey);
    if (this.hud) this.hud.el.inert = false;
    this.stage.setInput?.(true);
    if (restoreFocus) this.hud?.el.querySelector<HTMLElement>('[data-action="help"]')?.focus();
  }

  private howtoHtml(inLevel: boolean): string {
    const cards: [string, string, string][] = [
      [ICONS.moss!, 'Plant', 'Tap a tile to plant. Your seed is already picked.'],
      [ICONS.tyre!, 'Feed', 'Scrap makes every plant inside its ring grow one step. Small scrap reaches 1 tile, medium 2, large 3.'],
      [ICONS.flower!, 'Grow', 'Grown moss and vines spread to new tiles. Flowers bloom — tap a bloom for a free seed. Bamboo grows tall.'],
      [ICONS.crate!, 'Restore', 'Cover the scene — the scrap too — to fill the meter.'],
      [ICONS.bamboo!, 'Relax', 'No timer, no losing. Undo any time. Swipe the board sideways to turn it (or use the turn buttons, Q/E), and pinch or scroll to zoom. Stuck? Tap the bulb for a hint.'],
    ];
    const list = cards.map(([icon, title, text]) => `<li class="howto-card">${icon}<h3>${title}</h3><p>${text}</p></li>`).join('');
    const back = inLevel ? '<button data-close-howto class="primary">Back to the level</button>' : '<button data-nav="title" class="primary">Back</button>';
    return `<main class="screen howto-screen"><h2>How to play</h2><ol class="howto-list">${list}</ol><div class="actions">${back}<button data-replay-tutorial>Replay tutorial</button></div></main>`;
  }

  private updateSettings(patch: Partial<SaveData['settings']>): void {
    this.save = { ...this.save, settings: { ...this.save.settings, ...patch } };
    writeSave(this.store, this.save);
    this.sound.setMuted(this.save.settings.muted);
    this.sound.setVolume(this.save.settings.volume);
    this.applyMotionClass();
  }

  private toggleMute(): void {
    this.updateSettings({ muted: !this.save.settings.muted });
    this.renderHud?.();
  }

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

  private template(screen: MenuScreen): string {
    const back = '<button data-nav="title">Back</button>';
    switch (screen) {
      case 'title':
        return `<main class="screen title-screen"><h1 class="logo">Afterlife</h1><p class="tagline">Nature takes back what we left behind.</p><nav class="menu glass"><button data-nav="select" class="primary">Play</button><button data-nav="howto">How to Play</button><button data-nav="story">Story</button><button data-nav="settings">Settings</button><button data-nav="credits">Credits</button></nav></main>`;
      case 'select': {
        const statuses = levelStatuses(this.levels.map((l) => l.id), this.save.completed);
        const cards = this.levels
          .map((l, i) => {
            const st = statuses[i]!;
            return `<li><button class="level-card ${st}" data-level="${i}" ${st === 'locked' ? 'disabled' : ''} aria-label="${esc(l.name)}, ${STATUS_TEXT[st]}${this.save.stars[l.id] ? `, ${this.save.stars[l.id]} of 3 stars` : ''}"><span class="num">${i + 1}</span><span class="name">${esc(l.name)}</span><span class="status">${STATUS_TEXT[st]}</span>${this.save.stars[l.id] ? `<span class="stars-mini" aria-hidden="true">${'★'.repeat(this.save.stars[l.id]!)}${'☆'.repeat(3 - this.save.stars[l.id]!)}</span>` : ''}${st === 'locked' ? `<span class="card-icon" aria-hidden="true">${ICONS.lock}</span>` : st === 'completed' ? `<span class="card-icon" aria-hidden="true">${ICONS.leaf}</span>` : ''}</button></li>`;
          })
          .join('');
        const done = statuses.filter((x) => x === 'completed').length;
        return `<main class="screen select-screen"><h2>Choose a place</h2><p class="progress-note">${done} of ${this.levels.length} restored</p><ol class="level-grid">${cards}</ol>${back}</main>`;
      }
      case 'settings':
        return `<main class="screen settings-screen"><h2>Settings</h2><label class="toggle"><input type="checkbox" data-setting="sound" ${this.save.settings.muted ? '' : 'checked'}> Sound</label><label class="toggle">Volume <input type="range" min="0" max="100" step="5" data-setting="volume" value="${Math.round(this.save.settings.volume * 100)}" aria-label="Volume"></label><label class="toggle"><input type="checkbox" data-setting="reducedMotion" ${this.save.settings.reducedMotion ? 'checked' : ''}> Reduce motion</label><button data-nav="howto">How to play</button>${back}</main>`;
      case 'howto':
        return this.howtoHtml(false);
      case 'credits':
        return `<main class="screen credits-screen"><h2>Credits</h2><p>Design and direction: Ujjwal Kumar</p><p>Built with Phaser, Tone.js and TypeScript. Plants and soundtrack are generated in code.</p><p>Props rendered from 3D models by <a href="https://kenney.nl" target="_blank" rel="noopener">Kenney</a> (CC0).</p><p>Inspired by the mechanics of <em>Cloud Gardens</em> by Noio.</p>${back}</main>`;
    }
  }
}
