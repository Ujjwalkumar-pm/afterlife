import type Phaser from 'phaser';
import type { Prim } from './plantShapes';

export function drawPrims(g: Phaser.GameObjects.Graphics, prims: Prim[]): void {
  for (const p of prims) {
    if (p.kind === 'ellipse') {
      g.fillStyle(p.color, 1).fillEllipse(p.x, p.y, p.w, p.h);
    } else if (p.kind === 'circle') {
      g.fillStyle(p.color, 1).fillCircle(p.x, p.y, p.r);
    } else {
      g.lineStyle(p.width, p.color, 1).beginPath();
      g.moveTo(p.points[0]!, p.points[1]!);
      for (let i = 2; i < p.points.length; i += 2) g.lineTo(p.points[i]!, p.points[i + 1]!);
      g.strokePath();
    }
  }
}
