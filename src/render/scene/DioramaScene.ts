import Phaser from 'phaser';
import { cellStatus, RADIUS, SCRAP, type GameEvent, type GameState, type PlantType, type Pos } from '../../engine';
import type { PlayController, View } from '../../game/controller';
import { depth, sceneBounds, toGrid, toScreen, type IsoView, type Rotation } from '../iso/projection';
import { drawBlock, type ObjectArt } from '../objects/objectArt';
import manifest from '../objects/sprites.json';
import { makeSpriteObjectArt, spriteAssets, type SpriteManifest } from '../objects/spriteArt';
import { darken, lerpColor, PALETTE } from '../palette';
import { ensurePlantTexture, PLANT_RES } from '../plants/plantTextures';
import { isDrag, swipeTurn } from './screen';
import { Ambient, applySky, drawIsland, makeParticleTextures, type Rect } from './atmosphere';
import { Celebration } from './celebration';
import { Effects } from './effects';
import { diffTiles, plantTextureKey, plantVariant, rippleDelay, swayFor, TextureLru, washDelays } from './sceneMath';
import { TapGate } from './tapGate';
import { TIMING } from './timing';
import { comboFor, milestonesCrossed } from '../../game/scoring';

export const TILE_W = 64;
export const TILE_H = 32;
const HW = TILE_W / 2;
const HH = TILE_H / 2;
const SLAB = 6;
const HUD_SPACE = 180;
const BASE = 1 / PLANT_RES;
const STATUS_GLYPH = { growing: '↑', grown: '✿', blocked: '×' } as const;

export interface AttachOptions {
  reducedMotion: boolean;
  interactive: boolean;
  /** Screen (CSS px) position of the tray button a harvested seed flies to. */
  trayTarget?: (plant: PlantType) => { x: number; y: number } | null;
}

type Shape = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Depth;
interface TileView {
  pos: Pos;
  ground: Phaser.GameObjects.Graphics;
  wall: Phaser.GameObjects.Graphics | null;
  object: Shape | null;
  objectName: string | null;
  objectHeight: number;
  plant: Phaser.GameObjects.Image | null;
  plantKey: string | null;
  sway: { amplitude: number; period: number; phase: number } | null;
}

const key = (p: Pos) => `${p.x},${p.y}`;
const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const v2 = (pts: { x: number; y: number }[]) => pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
const DIAMOND = v2([{ x: 0, y: -HH }, { x: HW, y: 0 }, { x: 0, y: HH }, { x: -HW, y: 0 }]);
const diamondAt = (x: number, y: number) => v2([{ x, y: y - HH }, { x: x + HW, y }, { x, y: y + HH }, { x: x - HW, y }]);

function drawGround(g: Phaser.GameObjects.Graphics, ground: 'soil' | 'concrete', progress: number): void {
  const top = ground === 'soil' ? lerpColor(PALETTE.soilDry, PALETTE.soilLush, progress) : lerpColor(PALETTE.concreteDry, PALETTE.concreteLush, progress);
  g.clear();
  g.fillStyle(darken(top, 0.25), 1).fillPoints(v2([{ x: -HW, y: 0 }, { x: 0, y: HH }, { x: 0, y: HH + SLAB }, { x: -HW, y: SLAB }]), true);
  g.fillStyle(darken(top, 0.4), 1).fillPoints(v2([{ x: 0, y: HH }, { x: HW, y: 0 }, { x: HW, y: SLAB }, { x: 0, y: HH + SLAB }]), true);
  g.fillStyle(top, 1).fillPoints(DIAMOND, true);
  g.lineStyle(1, darken(top, 0.15), 0.6).strokePoints(DIAMOND, true);
}

export class DioramaScene extends Phaser.Scene {
  private ctrl: PlayController | null = null;
  private opts: AttachOptions = { reducedMotion: false, interactive: true };
  private unsubscribe: (() => void) | null = null;
  private ready = false;
  private pending: { ctrl: PlayController | null; opts: AttachOptions } | null = null;
  private pinch: { dist: number; zoom: number } | null = null;
  private pressAt: { x: number; y: number } | null = null;
  private celebration = new Celebration((ms, fn) => {
    const t = this.time.delayedCall(ms, fn);
    return () => t.remove(false);
  });
  private pendingTurn: Phaser.Time.TimerEvent | null = null;
  private lastRotation: Rotation = 0;
  private readonly gate = new TapGate();
  private baseZoom = 1;
  private userZoom = 1;
  private readonly art: ObjectArt = makeSpriteObjectArt(manifest as SpriteManifest, import.meta.env.BASE_URL);
  private readonly lru = new TextureLru(200);
  private island!: Phaser.GameObjects.Graphics;
  private groundLayer!: Phaser.GameObjects.Container;
  private preview!: Phaser.GameObjects.Graphics;
  private highlightG!: Phaser.GameObjects.Graphics;
  private world!: Phaser.GameObjects.Container;
  private fxLayer!: Phaser.GameObjects.Container;
  private labels!: Phaser.GameObjects.Container;
  private effects!: Effects;
  private ambient: Ambient | null = null;
  private views: TileView[] = [];
  private prevState: GameState | null = null;
  private progressDrawn = -1;
  private highlight: Pos | null = null;
  private highlightPulse: Phaser.Tweens.Tween | null = null;
  private lastProgress = 0;
  private inputEnabled = true;

  constructor() {
    super('diorama');
  }

  preload(): void {
    for (const { key: k, url } of spriteAssets(manifest as SpriteManifest, import.meta.env.BASE_URL)) this.load.image(k, url);
    this.load.on('loaderror', (file: { key: string }) => console.warn('[Afterlife] sprite failed to load, using drawn shape:', file.key));
  }

  create(): void {
    makeParticleTextures(this);
    this.island = this.add.graphics().setDepth(-50);
    this.groundLayer = this.add.container(0, 0).setDepth(0);
    this.preview = this.add.graphics().setDepth(10);
    this.highlightG = this.add.graphics().setDepth(11);
    this.world = this.add.container(0, 0).setDepth(20);
    this.fxLayer = this.add.container(0, 0).setDepth(30);
    this.labels = this.add.container(0, 0).setDepth(40);
    this.effects = new Effects(this, this.fxLayer);
    this.input.mouse?.disableContextMenu();
    this.input.addPointer(1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // A second finger makes it a pinch from the start, even before anything moves.
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        this.gate.pinch();
        this.pressAt = null;
        return;
      }
      this.gate.down();
      this.pressAt = { x: p.x, y: p.y };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.zoomBy(dy > 0 ? 0.9 : 1.1));
    this.input.keyboard?.on('keydown-Q', () => this.inputEnabled && this.opts.interactive && this.ctrl?.rotate(-1));
    this.input.keyboard?.on('keydown-E', () => this.inputEnabled && this.opts.interactive && this.ctrl?.rotate(1));
    this.input.keyboard?.on('keydown-ESC', () => this.inputEnabled && this.ctrl?.select(null));
    this.scale.on('resize', () => this.fit());
    this.ready = true;
    if (this.pending) {
      const { ctrl, opts } = this.pending;
      this.pending = null;
      this.attach(ctrl, opts);
    }
  }

  attach(ctrl: PlayController | null, opts: AttachOptions): void {
    if (!this.ready) {
      this.pending = { ctrl, opts };
      return;
    }
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.ctrl = ctrl;
    this.opts = opts;
    this.userZoom = 1;
    this.highlight = null;
    this.inputEnabled = true;
    this.highlightPulse?.remove();
    this.highlightPulse = null;
    this.highlightG.setAlpha(1);
    if (!opts.reducedMotion) this.highlightPulse = this.tweens.add({ targets: this.highlightG, alpha: { from: 0.35, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
    this.celebration.cancel();
    this.pendingTurn?.remove(false);
    this.pendingTurn = null;
    this.clearBoard();
    if (!ctrl) {
      applySky(0);
      return;
    }
    this.lastRotation = ctrl.view.rotation;
    this.lastProgress = ctrl.view.progress;
    this.unsubscribe = ctrl.onChange((view, events) => this.onChange(view, events));
    this.build(ctrl.view);
    this.fit();
  }

  setInput(on: boolean): void {
    this.inputEnabled = on;
    if (!on) this.ctrl?.hover(null);
  }

  setHighlight(tile: Pos | null): void {
    this.highlight = tile;
    this.drawHighlight();
  }

  update(time: number): void {
    if (this.opts.reducedMotion) return;
    for (const tv of this.views) {
      if (tv?.plant && tv.sway) tv.plant.rotation = tv.sway.amplitude * Math.sin((2 * Math.PI * time) / tv.sway.period + tv.sway.phase);
    }
  }

  private isoOf(view: View): IsoView {
    return { width: view.state.width, height: view.state.height, rotation: view.rotation, tileW: TILE_W, tileH: TILE_H };
  }

  private area(view: View): Rect {
    const b = sceneBounds(this.isoOf(view));
    return { x: b.centerX - b.width / 2, y: b.centerY - b.height / 2, w: b.width, h: b.height };
  }

  private clearBoard(keepFx = false): void {
    this.tweens.killTweensOf(keepFx ? [...this.world.list] : [...this.world.list, ...this.fxLayer.list]);
    this.groundLayer.removeAll(true);
    this.world.removeAll(true);
    if (!keepFx) this.fxLayer.removeAll(true);
    this.labels.removeAll(true);
    this.preview.clear();
    this.highlightG.clear();
    this.island.clear();
    if (!keepFx) {
      this.ambient?.destroy();
      this.ambient = null;
    }
    this.views = [];
    this.prevState = null;
    this.progressDrawn = -1;
  }

  /** keepFx: a rotation-only rebuild keeps ambient motes and celebration particles alive. */
  private build(view: View, keepFx = false): void {
    this.clearBoard(keepFx);
    const v = this.isoOf(view);
    const s = view.state;
    drawIsland(this.island, v);
    const order = s.tiles.map((_, i) => i).sort((a, b) => depth(v, { x: a % s.width, y: Math.floor(a / s.width) }) - depth(v, { x: b % s.width, y: Math.floor(b / s.width) }));
    this.views = new Array(s.tiles.length);
    for (const i of order) {
      const pos = { x: i % s.width, y: Math.floor(i / s.width) };
      const c = toScreen(v, pos);
      const ground = this.add.graphics({ x: c.x, y: c.y });
      this.groundLayer.add(ground);
      const tv: TileView = { pos, ground, wall: null, object: null, objectName: null, objectHeight: 0, plant: null, plantKey: null, sway: null };
      this.views[i] = tv;
      if (s.tiles[i]!.ground === 'blocked') {
        tv.wall = this.add.graphics({ x: c.x, y: c.y }).setDepth(depth(v, pos) * 10 + 1);
        drawBlock(tv.wall, { shape: 'box', x: 0, y: 0, w: 1, d: 1, z: 0, h: 18, color: PALETTE.wall });
        this.world.add(tv.wall);
      }
      this.setObject(tv, s, v);
      this.setPlant(tv, s, v);
    }
    this.drawGrounds(view);
    this.world.sort('depth');
    this.prevState = s;
    if (!this.opts.reducedMotion && !this.ambient) {
      this.ambient = new Ambient(this, this.area(view), this.fxLayer);
      this.ambient.setProgress(view.progress);
    }
    this.drawPreview(view);
    this.drawHighlight();
    this.drawLabels(view);
  }

  private drawGrounds(view: View): void {
    const s = view.state;
    for (const tv of this.views) {
      const t = s.tiles[tv.pos.y * s.width + tv.pos.x]!;
      if (t.ground === 'blocked') tv.ground.clear();
      else drawGround(tv.ground, t.ground, view.progress);
    }
    this.progressDrawn = view.progress;
    applySky(view.progress);
    this.ambient?.setProgress(view.progress);
  }

  private setObject(tv: TileView, s: GameState, v: IsoView): void {
    const t = s.tiles[tv.pos.y * s.width + tv.pos.x]!;
    const name = t.object?.name ?? null;
    if (name === tv.objectName && tv.object) return;
    if (tv.object) {
      this.tweens.killTweensOf(tv.object);
      tv.object.destroy();
    }
    tv.object = null;
    tv.objectName = name;
    tv.objectHeight = 0;
    if (!name) return;
    const c = toScreen(v, tv.pos);
    const obj = this.art.create(this, c.x, c.y, name, v.rotation) as Shape;
    obj.setDepth(depth(v, tv.pos) * 10 + 1);
    this.world.add(obj);
    tv.object = obj;
    tv.objectHeight = this.art.topHeight(name);
  }

  private setPlant(tv: TileView, s: GameState, v: IsoView): void {
    const cell = s.tiles[tv.pos.y * s.width + tv.pos.x]!.plant;
    if (!cell) {
      if (tv.plant) {
        this.tweens.killTweensOf(tv.plant);
        tv.plant.destroy();
      }
      tv.plant = null;
      tv.plantKey = null;
      tv.sway = null;
      return;
    }
    const k = plantTextureKey(cell, tv.pos.x, tv.pos.y, tv.objectHeight);
    const tex = ensurePlantTexture(this, k, { ...cell, plantId: plantVariant(cell, tv.pos.x, tv.pos.y), x: 0, y: 0, objectHeight: tv.objectHeight });
    const c = toScreen(v, tv.pos);
    if (!tv.plant) {
      tv.plant = this.add.image(c.x, c.y, k);
      this.world.add(tv.plant);
    } else {
      this.tweens.killTweensOf(tv.plant);
      tv.plant.setTexture(k).setPosition(c.x, c.y);
    }
    tv.plant.setOrigin(tex.originX, tex.originY).setScale(BASE).setDepth(depth(v, tv.pos) * 10 + 2);
    tv.plantKey = k;
    tv.sway = this.opts.reducedMotion ? null : swayFor(cell.type, tv.pos.x, tv.pos.y);
    if (!tv.sway) tv.plant.rotation = 0;
    const inUse = new Set(this.views.map((x) => x?.plantKey).filter((x): x is string => !!x));
    for (const old of this.lru.touch(k, inUse)) if (this.textures.exists(old)) this.textures.remove(old);
  }

  private onChange(view: View, events: GameEvent[]): void {
    if (!this.prevState || view.rotation !== this.lastRotation || view.state.width !== this.prevState.width || view.state.height !== this.prevState.height) {
      const rotationOnly = !!this.prevState && view.state.width === this.prevState.width && view.state.height === this.prevState.height;
      this.lastRotation = view.rotation;
      this.build(view, rotationOnly);
      this.fit();
    } else if (view.state !== this.prevState) {
      this.applyChanges(view, events);
    }
    if (Math.abs(view.progress - this.progressDrawn) > 0.001) this.drawGrounds(view);
    this.drawPreview(view);
    this.drawLabels(view);
    const crossed = milestonesCrossed(this.lastProgress, view.progress);
    this.lastProgress = view.progress;
    if (crossed.length > 0 && this.opts.interactive && !this.opts.reducedMotion) this.effects.milestone(this.area(view));
    if (events.some((e) => e.type === 'won') && this.opts.interactive && !this.opts.reducedMotion) this.celebrate(view, events);
  }

  private applyChanges(view: View, events: GameEvent[]): void {
    const s = view.state;
    const v = this.isoOf(view);
    const changes = diffTiles(this.prevState, s);
    this.prevState = s;
    const motion = !this.opts.reducedMotion;
    const scrapEv = events.find((e) => e.type === 'placedScrap');
    const radius = scrapEv && scrapEv.type === 'placedScrap' ? RADIUS[SCRAP[scrapEv.scrap].size] : 0;
    const growLag = scrapEv ? TIMING.growLag : 0;
    const spreadTo = new Set(events.flatMap((e) => (e.type === 'spread' ? [key(e.to)] : [])));
    const harvest = events.find((e) => e.type === 'harvested');
    for (const ch of changes) {
      const tv = this.views[ch.pos.y * s.width + ch.pos.x]!;
      const c = toScreen(v, ch.pos);
      if (ch.object) {
        this.setObject(tv, s, v);
        if (motion && tv.object && ch.object === 'added' && scrapEv && same(scrapEv.pos, ch.pos)) {
          this.effects.drop(tv.object, () => {
            this.effects.burst(c.x, c.y, PALETTE.dust, 8, 50);
            this.effects.ripple(c.x, c.y, radius);
          });
        }
      }
      if (!ch.plant && !ch.object) continue;
      this.setPlant(tv, s, v);
      const plant = tv.plant;
      if (!motion || !plant) continue;
      const delay = (scrapEv ? rippleDelay(scrapEv.pos, ch.pos, radius, TIMING.ripple) : 0) + growLag;
      switch (ch.plant) {
        case 'added':
          if (spreadTo.has(key(ch.pos))) {
            plant.setScale(0);
            this.tweens.add({ targets: plant, scale: BASE, delay: delay + TIMING.sproutDelay, duration: TIMING.sprout, ease: 'Back.Out' });
          } else {
            this.effects.pop(plant, 0.6, TIMING.seedPop, BASE);
            this.effects.burst(c.x, c.y, PALETTE.seed, 5, 30);
          }
          break;
        case 'grew':
          this.tweens.add({ targets: plant, scaleY: { from: 0.2 * BASE, to: BASE }, delay, duration: TIMING.grow, ease: 'Back.Out' });
          break;
        case 'bloomed':
          this.tweens.add({ targets: plant, scale: { from: 0.6 * BASE, to: BASE }, delay, duration: TIMING.bloom, ease: 'Back.Out' });
          break;
        case 'unbloomed':
          if (harvest && harvest.type === 'harvested') this.flyHarvest(c, harvest.seed);
          break;
        default:
          break;
      }
    }
    const combo = comboFor(events);
    if (combo && scrapEv) {
      const c = toScreen(v, scrapEv.pos);
      this.effects.floatText(c.x, c.y, `${combo.label} ×${combo.size}`, combo.label === 'Wild!', !motion);
      if (motion) this.effects.burst(c.x, c.y, PALETTE.pollen, 8 + combo.size, 70);
    }
    this.world.sort('depth');
  }

  private flyHarvest(from: { x: number; y: number }, seed: PlantType): void {
    const target = this.opts.trayTarget?.(seed);
    if (!target) return;
    const w = this.cameras.main.getWorldPoint(target.x * this.px, target.y * this.px);
    this.effects.flyTo(from.x, from.y - 14, w.x, w.y, PALETTE.petal[0]);
  }

  private drawPreview(view: View): void {
    const g = this.preview.clear();
    const p = view.preview;
    if (!p) return;
    const v = this.isoOf(view);
    for (const t of p.ring) {
      const c = toScreen(v, t);
      g.lineStyle(2, PALETTE.ring, 0.55).strokePoints(diamondAt(c.x, c.y), true);
    }
    const c = toScreen(v, p.tile);
    g.fillStyle(p.valid ? PALETTE.ring : PALETTE.invalid, 0.35).fillPoints(diamondAt(c.x, c.y), true);
    for (const t of p.glowing) {
      const gc = toScreen(v, t);
      g.fillStyle(PALETTE.glow, 0.45).fillEllipse(gc.x, gc.y, TILE_W * 0.7, TILE_H * 0.7);
    }
  }

  private drawHighlight(): void {
    if (!this.ready) return; // called before create(): drawn once the scene exists
    const g = this.highlightG.clear();
    if (!this.highlight || !this.ctrl) return;
    const c = toScreen(this.isoOf(this.ctrl.view), this.highlight);
    g.lineStyle(3, PALETTE.firefly, 1).strokePoints(diamondAt(c.x, c.y), true);
    g.fillStyle(PALETTE.firefly, 0.25).fillPoints(diamondAt(c.x, c.y), true);
  }

  private drawLabels(view: View): void {
    this.labels.removeAll(true);
    if (view.selection?.kind !== 'scrap') return;
    const v = this.isoOf(view);
    const s = view.state;
    for (const tv of this.views) {
      if (!tv?.plant) continue;
      const st = cellStatus(s, tv.pos);
      if (!st || st === 'seed') continue;
      const c = toScreen(v, tv.pos);
      this.labels.add(this.add.text(c.x, c.y - tv.objectHeight - 30, STATUS_GLYPH[st], { fontFamily: 'Nunito, sans-serif', fontSize: '15px', color: '#f4f1e4', stroke: '#23251f', strokeThickness: 3, resolution: 3 }).setOrigin(0.5));
    }
  }

  private celebrate(view: View, events: GameEvent[]): void {
    const ctrl = this.ctrl;
    if (!ctrl) return;
    const v = this.isoOf(view);
    const last = [...events].reverse().find((e): e is Extract<GameEvent, { pos: Pos }> => 'pos' in e);
    const origin = last?.pos ?? { x: Math.floor(view.state.width / 2), y: Math.floor(view.state.height / 2) };
    const wash = washDelays(view.state, origin, TIMING.washStep);
    this.cameras.main.flash(600, 255, 248, 225);
    this.effects.shimmer(wash.map((w) => ({ ...toScreen(v, w.pos), delay: w.delay })));
    this.effects.fireflies(this.area(view));
    const lastDelay = wash.at(-1)?.delay ?? 0;
    this.pendingTurn = this.time.delayedCall(lastDelay + 300, () => {
      this.pendingTurn = null;
      if (this.ctrl === ctrl) this.celebration.start(ctrl, TIMING.turnStep);
    });
  }

  /** Canvas pixels per CSS pixel (the canvas is drawn at screen density and shown at CSS size). */
  private get px(): number {
    return 1 / (this.scale.zoom || 1);
  }

  private setCamZoom(z: number): void {
    this.cameras.main.setZoom(clamp(z, 0.5 * this.px, 3 * this.px));
  }

  fit(): void {
    if (!this.ctrl) return;
    const b = sceneBounds(this.isoOf(this.ctrl.view));
    const k = this.px;
    const narrow = this.scale.width / k < 600;
    const side = (narrow ? 16 : 96) * k;
    const hud = (narrow ? 150 : HUD_SPACE) * k;
    this.baseZoom = clamp(Math.min(this.scale.width / (b.width + side), (this.scale.height - hud) / (b.height + 40)), 0.5 * k, 3 * k);
    const cam = this.cameras.main;
    this.setCamZoom(this.baseZoom * this.userZoom);
    cam.centerOn(b.centerX, b.centerY - 10 / cam.zoom);
  }

  private zoomBy(f: number): void {
    this.userZoom = clamp(this.userZoom * f, 0.5, 3);
    this.setCamZoom(this.baseZoom * this.userZoom);
  }

  private pick(p: Phaser.Input.Pointer): Pos | null {
    if (!this.ctrl) return null;
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    return toGrid(this.isoOf(this.ctrl.view), wp.x, wp.y);
  }

  private handlePinch(): boolean {
    const a = this.input.pointer1;
    const b = this.input.pointer2;
    if (a.isDown && b.isDown) {
      this.gate.pinch();
      const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      if (!this.pinch) this.pinch = { dist: d, zoom: this.cameras.main.zoom };
      else {
        this.userZoom = clamp((this.pinch.zoom * d) / this.pinch.dist / this.baseZoom, 0.5, 3);
        this.setCamZoom(this.baseZoom * this.userZoom);
      }
      return true;
    }
    return false;
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.ctrl || !this.opts.interactive || !this.inputEnabled) return;
    if (this.handlePinch()) return;
    if (!p.wasTouch) this.ctrl.hover(this.pick(p));
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const anyDown = this.input.pointer1.isDown || this.input.pointer2.isDown;
    const wasPinching = this.gate.pinching;
    const isTap = this.gate.up(anyDown);
    if (!anyDown) this.pinch = null;
    // A sideways drag turns the board a quarter (never a tap, so it never places anything).
    const start = this.pressAt;
    this.pressAt = null;
    if (isTap && !wasPinching && start && (p.wasTouch || p.leftButtonReleased())) {
      const dx = (p.x - start.x) / this.px;
      const dy = (p.y - start.y) / this.px;
      const turn = swipeTurn(dx, dy);
      if (turn !== 0 && this.ctrl && this.opts.interactive && this.inputEnabled && !this.celebration.running) {
        this.ctrl.rotate(turn);
        return;
      }
      if (isDrag(dx, dy)) return; // a drag that isn't a clean sideways swipe does nothing
    }
    if (!isTap || !this.ctrl || !this.opts.interactive || !this.inputEnabled || this.celebration.running) return;
    if (p.rightButtonReleased()) {
      this.ctrl.select(null);
      return;
    }
    const tile = this.pick(p);
    if (!tile) return;
    const events = this.ctrl.tap(tile, p.wasTouch ? 'touch' : 'mouse');
    const pv = this.ctrl.view.preview;
    if (events.length === 0 && pv && !pv.valid && same(pv.tile, tile) && !this.opts.reducedMotion) {
      const tv = this.views[tile.y * this.ctrl.view.state.width + tile.x];
      if (tv) this.effects.shake(tv.ground);
    }
  }
}
