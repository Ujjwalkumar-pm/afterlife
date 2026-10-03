import type { LevelData } from '../engine';
import { PlayController } from '../game/controller';
import type { AttachOptions } from '../render/scene/DioramaScene';
import { loadSave, markCompleted, writeSave, type SaveData, type Store } from '../save/save';
import { Hud } from '../ui/hud';
import { cuesFor } from '../audio/cues';
import { silentSound, type Sound } from '../audio/sound';
import { levelStatuses, type LevelStatus } from './progress';

export interface Stage {
  show(ctrl: PlayController | null, opts: AttachOptions): void;
}
export interface AppOptions {
  /** Milliseconds between title-screen demo moves; null disables the demo (tests). */
  demoIntervalMs: number | null;
  prefersReducedMotion: boolean;
}
export type Screen = 'title' | 'select' | 'settings' | 'credits' | 'play';

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
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('change', (e) => this.onInput(e));
    this.show('title');
  }

  get reducedMotion(): boolean {
    return this.options.prefersReducedMotion || this.save.settings.reducedMotion;
  }

  show(screen: Exclude<Screen, 'play'>): void {
    this.teardown();
    this.screen = screen;
    this.sound.setProgress(0);
    this.root.innerHTML = this.template(screen);
    if (screen === 'title') this.startDemo();
    else this.stage.show(null, { reducedMotion: this.reducedMotion, interactive: false });
  }

  startLevel(index: number): void {
    const level = this.levels[index];
    if (!level) return this.show('select');
    this.teardown();
    this.screen = 'play';
    this.levelIndex = index;
    this.root.innerHTML = '';
    const ctrl = new PlayController(level);
    this.controller = ctrl;
    const hud = new Hud(this.root, {
      select: (sel) => ctrl.select(sel),
      undo: () => ctrl.undo(),
      restart: () => ctrl.restart(),
      rotate: (dir) => ctrl.rotate(dir),
      menu: () => this.show('select'),
      next: () => this.startLevel(this.levelIndex + 1),
      keepDecorating: () => ctrl.keepDecorating(),
      toggleMute: () => this.toggleMute(),
    });
    this.hud = hud;
    const meta = () => ({ name: level.name, hint: level.hint, hasNext: index + 1 < this.levels.length, muted: this.save.settings.muted || !this.sound.available });
    let lastOverlay = ctrl.view.overlay;
    this.unsubscribe = ctrl.onChange((view, events) => {
      if (events.some((e) => e.type === 'won')) {
        this.save = markCompleted(this.save, level.id);
        writeSave(this.store, this.save);
      }
      const cues = cuesFor(events);
      if (view.overlay !== lastOverlay && view.overlay === 'restored') cues.push('won');
      if (view.overlay !== lastOverlay && view.overlay === 'rests') cues.push('rests');
      lastOverlay = view.overlay;
      this.sound.play(cues);
      this.sound.setProgress(view.progress);
      hud.render(view, meta());
    });
    this.renderHud = () => hud.render(ctrl.view, meta());
    hud.render(ctrl.view, meta());
    this.stage.show(ctrl, { reducedMotion: this.reducedMotion, interactive: true });
  }

  showError(): void {
    this.hud?.showError();
  }

  private teardown(): void {
    if (this.demoTimer) clearInterval(this.demoTimer);
    this.demoTimer = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.hud?.destroy();
    this.hud = null;
    this.renderHud = null;
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

  private onClick(e: Event): void {
    const el = e.target as HTMLElement;
    const nav = el.closest<HTMLElement>('[data-nav]');
    if (nav) return this.show(nav.dataset.nav as Exclude<Screen, 'play'>);
    const card = el.closest<HTMLButtonElement>('[data-level]');
    if (card && !card.disabled) this.startLevel(Number(card.dataset.level));
  }

  private updateSettings(patch: Partial<SaveData['settings']>): void {
    this.save = { ...this.save, settings: { ...this.save.settings, ...patch } };
    writeSave(this.store, this.save);
    this.sound.setMuted(this.save.settings.muted);
    this.sound.setVolume(this.save.settings.volume);
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

  private template(screen: Exclude<Screen, 'play'>): string {
    const back = '<button data-nav="title">Back</button>';
    switch (screen) {
      case 'title':
        return `<main class="screen title-screen"><h1 class="logo">Afterlife</h1><p class="tagline">Nature takes back what we left behind.</p><nav class="menu"><button data-nav="select" class="primary">Play</button><button data-nav="settings">Settings</button><button data-nav="credits">Credits</button></nav></main>`;
      case 'select': {
        const statuses = levelStatuses(this.levels.map((l) => l.id), this.save.completed);
        const cards = this.levels
          .map((l, i) => {
            const st = statuses[i]!;
            return `<li><button class="level-card ${st}" data-level="${i}" ${st === 'locked' ? 'disabled' : ''} aria-label="${esc(l.name)}, ${STATUS_TEXT[st]}"><span class="num">${i + 1}</span><span class="name">${esc(l.name)}</span><span class="status">${STATUS_TEXT[st]}</span></button></li>`;
          })
          .join('');
        return `<main class="screen select-screen"><h2>Choose a place</h2><ol class="level-grid">${cards}</ol>${back}</main>`;
      }
      case 'settings':
        return `<main class="screen settings-screen"><h2>Settings</h2><label class="toggle"><input type="checkbox" data-setting="sound" ${this.save.settings.muted ? '' : 'checked'}> Sound</label><label class="toggle">Volume <input type="range" min="0" max="100" step="5" data-setting="volume" value="${Math.round(this.save.settings.volume * 100)}" aria-label="Volume"></label><label class="toggle"><input type="checkbox" data-setting="reducedMotion" ${this.save.settings.reducedMotion ? 'checked' : ''}> Reduce motion</label>${back}</main>`;
      case 'credits':
        return `<main class="screen credits-screen"><h2>Credits</h2><p>Design and direction: Ujjwal Kumar</p><p>Built with Phaser, Tone.js and TypeScript. Plants and soundtrack are generated in code.</p><p>Props rendered from 3D models by <a href="https://kenney.nl" target="_blank" rel="noopener">Kenney</a> (CC0).</p><p>Inspired by the mechanics of <em>Cloud Gardens</em> by Noio.</p>${back}</main>`;
    }
  }
}
