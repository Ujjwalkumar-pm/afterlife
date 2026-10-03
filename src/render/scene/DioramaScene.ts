import Phaser from 'phaser';
import { cellStatus, type GameEvent, type Pos } from '../../engine';
import type { PlayController, View } from '../../game/controller';
import { depth, sceneBounds, toGrid, toScreen, type IsoView, type Rotation } from '../iso/projection';
import { codeObjectArt, drawBlock, type ObjectArt } from '../objects/objectArt';
import { Celebration } from './celebration';
import { darken, lerpColor, PALETTE } from '../palette';
import { drawPrims } from '../plants/plantArt';
import { plantPrims } from '../plants/plantShapes';

export const TILE_W = 64;
export const TILE_H = 32;
const HW = TILE_W / 2;
const HH = TILE_H / 2;
const SLAB = 6;
const HUD_SPACE = 180;
const STATUS_GLYPH = { growing: '↑', grown: '✿', blocked: '×' } as const;

export interface AttachOptions {
  reducedMotion: boolean;
  interactive: boolean;
}

const key = (p: Pos) => `${p.x},${p.y}`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Phaser 4's typings require Vector2 point lists. */
const v2 = (pts: { x: number; y: number }[]) => pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
const DIAMOND = v2([{ x: 0, y: -HH }, { x: HW, y: 0 }, { x: 0, y: HH }, { x: -HW, y: 0 }]);

function drawGround(g: Phaser.GameObjects.Graphics, ground: 'soil' | 'concrete', progress: number): void {
  const top = ground === 'soil' ? lerpColor(PALETTE.soilDry, PALETTE.soilLush, progress) : lerpColor(PALETTE.concreteDry, PALETTE.concreteLush, progress);
  g.fillStyle(darken(top, 0.25), 1).fillPoints(v2([{ x: -HW, y: 0 }, { x: 0, y: HH }, { x: 0, y: HH + SLAB }, { x: -HW, y: SLAB }]), true);
  g.fillStyle(darken(top, 0.4), 1).fillPoints(v2([{ x: 0, y: HH }, { x: HW, y: 0 }, { x: HW, y: SLAB }, { x: 0, y: HH + SLAB }]), true);
  g.fillStyle(top, 1).fillPoints(DIAMOND, true);
  g.lineStyle(1, darken(top, 0.15), 0.6).strokePoints(DIAMOND, true);
}

export class DioramaScene extends Phaser.Scene {
  private ctrl: PlayController | null = null;
  private opts: AttachOptions = { reducedMotion: false, interactive: true };
  private unsubscribe: (() => void) | null = null;
  private layer!: Phaser.GameObjects.Container;
  private ready = false;
  private pending: { ctrl: PlayController | null; opts: AttachOptions } | null = null;
  private pinch: { dist: number; zoom: number } | null = null;
  private celebration = new Celebration((ms, fn) => {
    const t = this.time.delayedCall(ms, fn);
    return () => t.remove(false);
  });
  private lastRotation: Rotation = 0;
  private pressedOnCanvas = false;
  private baseZoom = 1;
  private userZoom = 1;
  private readonly art: ObjectArt = codeObjectArt;

  constructor() {
    super('diorama');
  }

  create(): void {
    this.layer = this.add.container(0, 0);
    this.input.mouse?.disableContextMenu();
    this.input.addPointer(1);
    this.input.on('pointerdown', () => (this.pressedOnCanvas = true));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.zoomBy(dy > 0 ? 0.9 : 1.1));
    this.input.keyboard?.on('keydown-Q', () => this.opts.interactive && this.ctrl?.rotate(-1));
    this.input.keyboard?.on('keydown-E', () => this.opts.interactive && this.ctrl?.rotate(1));
    this.input.keyboard?.on('keydown-ESC', () => this.ctrl?.select(null));
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
    this.celebration.cancel();
    this.layer.removeAll(true);
    if (!ctrl) return;
    this.lastRotation = ctrl.view.rotation;
    this.unsubscribe = ctrl.onChange((view, events) => this.onChange(view, events));
    this.redraw(ctrl.view, []);
    this.fit();
  }

  private isoOf(view: View): IsoView {
    return { width: view.state.width, height: view.state.height, rotation: view.rotation, tileW: TILE_W, tileH: TILE_H };
  }

  private onChange(view: View, events: GameEvent[]): void {
    this.redraw(view, events);
    if (view.rotation !== this.lastRotation) {
      this.lastRotation = view.rotation;
      this.fit();
    }
    if (events.some((e) => e.type === 'won') && this.opts.interactive && !this.opts.reducedMotion) this.celebrate();
  }

  private celebrate(): void {
    if (!this.ctrl) return;
    this.cameras.main.flash(700, 255, 248, 225);
    this.celebration.start(this.ctrl, 450);
  }

  fit(): void {
    if (!this.ctrl) return;
    const b = sceneBounds(this.isoOf(this.ctrl.view));
    const narrow = this.scale.width < 600;
    const side = narrow ? 16 : 96;
    const hud = narrow ? 150 : HUD_SPACE;
    this.baseZoom = clamp(Math.min(this.scale.width / (b.width + side), (this.scale.height - hud) / (b.height + 40)), 0.5, 3);
    const cam = this.cameras.main;
    cam.setZoom(clamp(this.baseZoom * this.userZoom, 0.5, 3));
    cam.centerOn(b.centerX, b.centerY - 10 / cam.zoom);
  }

  private zoomBy(f: number): void {
    this.userZoom = clamp(this.userZoom * f, 0.5, 3);
    this.cameras.main.setZoom(clamp(this.baseZoom * this.userZoom, 0.5, 3));
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
      const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      if (!this.pinch) this.pinch = { dist: d, zoom: this.cameras.main.zoom };
      else {
        this.userZoom = clamp((this.pinch.zoom * d) / this.pinch.dist / this.baseZoom, 0.5, 3);
        this.cameras.main.setZoom(clamp(this.baseZoom * this.userZoom, 0.5, 3));
      }
      return true;
    }
    return false;
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (!this.ctrl || !this.opts.interactive) return;
    if (this.handlePinch()) return;
    if (!p.wasTouch) this.ctrl.hover(this.pick(p));
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (!this.ctrl || !this.opts.interactive || this.celebration.running) return;
    if (!this.pressedOnCanvas) return; // press started on the HTML layer (e.g. dragged off a tray button)
    this.pressedOnCanvas = false;
    if (this.pinch) {
      if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) this.pinch = null;
      return;
    }
    if (p.rightButtonReleased()) {
      this.ctrl.select(null);
      return;
    }
    const tile = this.pick(p);
    if (tile) this.ctrl.tap(tile, p.wasTouch ? 'touch' : 'mouse');
  }

  private redraw(view: View, events: GameEvent[]): void {
    this.layer.removeAll(true);
    const v = this.isoOf(view);
    const s = view.state;
    const changed = new Set<string>();
    for (const e of events) {
      if ('pos' in e) changed.add(key(e.pos));
      if (e.type === 'spread') changed.add(key(e.to));
    }
    const ring = new Set((view.preview?.ring ?? []).map(key));
    const glow = new Set((view.preview?.glowing ?? []).map(key));
    const showStatus = view.selection?.kind === 'scrap';
    const tiles: Pos[] = [];
    for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) tiles.push({ x, y });
    tiles.sort((a, b) => depth(v, a) - depth(v, b));

    for (const p of tiles) {
      const t = s.tiles[p.y * s.width + p.x]!;
      const c = toScreen(v, p);
      const g = this.add.graphics({ x: c.x, y: c.y });
      this.layer.add(g);
      if (t.ground === 'blocked') {
        drawBlock(g, { shape: 'box', x: 0, y: 0, w: 1, d: 1, z: 0, h: 18, color: PALETTE.wall });
        continue;
      }
      drawGround(g, t.ground, view.progress);
      if (ring.has(key(p))) g.lineStyle(2, PALETTE.ring, 0.55).strokePoints(DIAMOND, true);
      if (view.preview && view.preview.tile.x === p.x && view.preview.tile.y === p.y) {
        g.fillStyle(view.preview.valid ? PALETTE.ring : PALETTE.invalid, 0.35).fillPoints(DIAMOND, true);
      }
      if (glow.has(key(p))) g.fillStyle(PALETTE.glow, 0.45).fillEllipse(0, 0, TILE_W * 0.7, TILE_H * 0.7);

      let objectHeight = 0;
      const animated: Phaser.GameObjects.GameObject[] = [];
      if (t.object) {
        const obj = this.art.create(this, c.x, c.y, t.object.name, view.rotation);
        this.layer.add(obj);
        animated.push(obj);
        objectHeight = this.art.topHeight(t.object.name);
      }
      if (t.plant) {
        const plantG = this.add.graphics({ x: c.x, y: c.y });
        drawPrims(plantG, plantPrims({ ...t.plant, x: p.x, y: p.y, objectHeight }));
        this.layer.add(plantG);
        animated.push(plantG);
        if (showStatus) {
          const st = cellStatus(s, p);
          if (st && st !== 'seed') {
            const label = this.add.text(c.x, c.y - objectHeight - 30, STATUS_GLYPH[st], { fontFamily: 'Nunito, sans-serif', fontSize: '15px', color: '#f4f1e4', stroke: '#23251f', strokeThickness: 3 }).setOrigin(0.5);
            this.layer.add(label);
          }
        }
      }
      if (changed.has(key(p)) && !this.opts.reducedMotion) {
        this.tweens.add({ targets: animated, scaleY: { from: 0.6, to: 1 }, alpha: { from: 0.4, to: 1 }, duration: 420, ease: 'Back.Out' });
      }
    }
  }
}
