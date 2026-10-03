import Phaser from 'phaser';
import { PALETTE } from '../palette';
import type { Rect } from './atmosphere';

type Movable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;
const HW = 32;
const HH = 16;
const v2 = (pts: { x: number; y: number }[]) => pts.map((p) => new Phaser.Math.Vector2(p.x, p.y));
const diamond = (x: number, y: number) => v2([{ x, y: y - HH }, { x: x + HW, y }, { x, y: y + HH }, { x: x - HW, y }]);

/** One-shot feedback effects. Callers skip them entirely under Reduce motion. */
export class Effects {
  constructor(private readonly scene: Phaser.Scene, private readonly layer: Phaser.GameObjects.Container) {}

  burst(x: number, y: number, color: number, count: number, speed = 40): void {
    const em = this.scene.add.particles(x, y, 'mote', {
      speed: { min: speed * 0.5, max: speed },
      lifespan: 450,
      scale: { start: 0.45, end: 0 },
      gravityY: 90,
      tint: color,
      emitting: false,
    });
    this.layer.add(em);
    em.explode(count);
    this.scene.time.delayedCall(700, () => em.destroy());
  }

  pop(target: Movable, from = 0.6, ms = 250, baseScale = 1): void {
    this.scene.tweens.killTweensOf(target);
    target.setScale(from * baseScale);
    this.scene.tweens.add({ targets: target, scale: baseScale, duration: ms, ease: 'Back.Out' });
  }

  drop(target: Movable, onLand: () => void): void {
    this.scene.tweens.killTweensOf(target);
    const y = target.y;
    target.y = y - 40;
    this.scene.tweens.add({ targets: target, y, duration: 350, ease: 'Bounce.Out', onComplete: onLand });
  }

  /** A Manhattan ring of radius r on an isometric grid is an axis-aligned rectangle on screen. */
  ripple(x: number, y: number, radius: number): void {
    const g = this.scene.add.graphics();
    this.layer.add(g);
    this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 400,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const r = t * (radius + 0.5);
        g.clear().lineStyle(2, PALETTE.ring, 0.8 * (1 - t)).strokeRect(x - r * HW, y - r * HH, 2 * r * HW, 2 * r * HH);
      },
      onComplete: () => g.destroy(),
    });
  }

  shake(target: Movable): void {
    const x = target.x;
    this.scene.tweens.add({ targets: target, x: x + 4, duration: 50, yoyo: true, repeat: 1, onComplete: () => (target.x = x) });
  }

  /** Petals burst from (x, y), then fly to the tray target, both in world coordinates. */
  flyTo(x: number, y: number, tx: number, ty: number, color: number, count = 6): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const p = this.scene.add.image(x, y, 'petal').setTint(color).setScale(0.8);
      this.layer.add(p);
      this.scene.tweens.chain({
        targets: p,
        tweens: [
          { x: x + Math.cos(a) * 18, y: y + Math.sin(a) * 12, duration: 150, ease: 'Quad.Out' },
          { x: tx, y: ty, scale: 0.35, angle: 180, duration: 450, ease: 'Quad.In' },
        ],
        onComplete: () => p.destroy(),
      });
    }
  }

  shimmer(tiles: { x: number; y: number; delay: number }[]): void {
    for (const t of tiles) {
      const g = this.scene.add.graphics().setAlpha(0);
      g.fillStyle(0xfff6d8, 1).fillPoints(diamond(t.x, t.y), true);
      this.layer.add(g);
      this.scene.tweens.add({ targets: g, alpha: 0.45, delay: t.delay, duration: 220, yoyo: true, onComplete: () => g.destroy() });
    }
  }

  fireflies(area: Rect): void {
    const zone = {
      getRandomPoint: (pt: Phaser.Types.Math.Vector2Like) => {
        pt.x = area.x + Math.random() * area.w;
        pt.y = area.y + Math.random() * area.h;
      },
    };
    const flies = this.scene.add.particles(0, 0, 'mote', {
      emitZone: { type: 'random' as const, source: zone },
      lifespan: 4000,
      speed: { min: 4, max: 14 },
      scale: { start: 0.45, end: 0.2 },
      alpha: { start: 1, end: 0 },
      tint: PALETTE.firefly,
      blendMode: 'ADD',
      emitting: false,
    });
    const petals = this.scene.add.particles(0, 0, 'petal', {
      x: { min: area.x, max: area.x + area.w },
      y: area.y,
      lifespan: 4000,
      speedY: { min: 10, max: 26 },
      speedX: { min: -10, max: 10 },
      rotate: { min: 0, max: 360 },
      alpha: { start: 0.9, end: 0 },
      tint: [...PALETTE.petal],
      emitting: false,
    });
    this.layer.add([flies, petals]);
    flies.explode(14);
    petals.explode(18);
    this.scene.time.delayedCall(4500, () => {
      flies.destroy();
      petals.destroy();
    });
  }
}
