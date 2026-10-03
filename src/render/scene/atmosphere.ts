import Phaser from 'phaser';
import type { IsoView } from '../iso/projection';
import { darken, PALETTE } from '../palette';
import { islandCorners, skyColors } from './sceneMath';

const DEPTH = 22;
const BANDS = [0x5a4a3a, 0x4a3d30, 0x3a3027];
const v2 = (pts: { x: number; y: number }[]) => pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));

/** The sky is a CSS gradient behind a transparent canvas; this just updates its colours. */
export function applySky(progress: number): void {
  const { top, bottom } = skyColors(progress);
  const s = document.documentElement.style;
  s.setProperty('--sky-top', top);
  s.setProperty('--sky-bottom', bottom);
}

export function drawIsland(g: Phaser.GameObjects.Graphics, v: IsoView): void {
  g.clear();
  const { top, right, bottom, left } = islandCorners(v);
  // Soft shadow: the board's own outline, dropped below the island and stacked at growing
  // sizes so it reads as a blur and fits any board shape (square or long and thin).
  const cx = (left.x + right.x) / 2;
  const cy = (top.y + bottom.y) / 2;
  for (const k of [1.1, 1.05, 1]) {
    const pt = (p: { x: number; y: number }) => ({ x: cx + (p.x - cx) * k, y: cy + (p.y - cy) * k + DEPTH + 12 });
    g.fillStyle(0x000000, 0.12).fillPoints(v2([pt(top), pt(right), pt(bottom), pt(left)]), true);
  }
  const band = DEPTH / BANDS.length;
  BANDS.forEach((c, i) => {
    const y0 = i * band;
    const y1 = (i + 1) * band;
    g.fillStyle(c, 1).fillPoints(v2([{ x: left.x, y: left.y + y0 }, { x: bottom.x, y: bottom.y + y0 }, { x: bottom.x, y: bottom.y + y1 }, { x: left.x, y: left.y + y1 }]), true);
    g.fillStyle(darken(c, 0.18), 1).fillPoints(v2([{ x: bottom.x, y: bottom.y + y0 }, { x: right.x, y: right.y + y0 }, { x: right.x, y: right.y + y1 }, { x: bottom.x, y: bottom.y + y1 }]), true);
  });
}

export function makeParticleTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('bird')) {
    const g = scene.make.graphics({}, false);
    g.lineStyle(2.2, 0xffffff, 1).beginPath();
    g.moveTo(1, 6);
    g.lineTo(7, 2);
    g.lineTo(13, 6);
    g.strokePath();
    g.generateTexture('bird', 14, 8);
    g.destroy();
  }
  if (!scene.textures.exists('mote')) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillCircle(4, 4, 4);
    g.generateTexture('mote', 8, 8);
    g.destroy();
  }
  if (!scene.textures.exists('petal')) {
    const g = scene.make.graphics({}, false);
    g.fillStyle(0xffffff, 1).fillEllipse(5, 3, 10, 6);
    g.generateTexture('petal', 10, 6);
    g.destroy();
  }
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Drifting dust over a bare scene that turns into pollen as it recovers. */
export class Ambient {
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly pollen: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene, area: Rect, layer: Phaser.GameObjects.Container) {
    const base = {
      x: { min: area.x, max: area.x + area.w },
      y: { min: area.y, max: area.y + area.h },
      lifespan: 7000,
      speedX: { min: -8, max: 8 },
      frequency: 420,
      maxAliveParticles: 18,
      scale: { start: 0.55, end: 0.2 },
      alpha: { start: 0.55, end: 0 },
    };
    this.dust = scene.add.particles(0, 0, 'mote', { ...base, speedY: { min: -6, max: 3 }, tint: PALETTE.dust });
    this.pollen = scene.add.particles(0, 0, 'mote', { ...base, speedY: { min: -12, max: -3 }, tint: [PALETTE.pollen, 0xfff8d8], emitting: false });
    layer.add([this.dust, this.pollen]);
  }

  setProgress(progress: number): void {
    const lush = progress >= 0.5;
    if (lush && !this.pollen.emitting) {
      this.dust.stop();
      this.pollen.start();
    } else if (!lush && !this.dust.emitting) {
      this.pollen.stop();
      this.dust.start();
    }
  }

  destroy(): void {
    this.dust.destroy();
    this.pollen.destroy();
  }
}
