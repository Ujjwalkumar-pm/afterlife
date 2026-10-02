import Phaser from 'phaser';
import type { Rotation } from '../iso/projection';
import { darken, lighten } from '../palette';
import { objectBlocks, objectTopHeight, type Block } from './objectShapes';

/** How ruins and scrap are drawn. Plan 3 swaps in a sprite-based implementation. */
export interface ObjectArt {
  create(scene: Phaser.Scene, x: number, y: number, name: string, rotation: Rotation): Phaser.GameObjects.GameObject;
  topHeight(name: string): number;
}

const HW = 32;
const HH = 16;
const iso = (gx: number, gy: number, z: number) => new Phaser.Math.Vector2((gx - gy) * HW, (gx + gy) * HH - z);

export function drawBlock(g: Phaser.GameObjects.Graphics, b: Block): void {
  if (b.shape === 'box') {
    const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, y0 = b.y - b.d / 2, y1 = b.y + b.d / 2;
    const top = b.z + b.h;
    g.fillStyle(b.color, 1).fillPoints([iso(x0, y1, b.z), iso(x1, y1, b.z), iso(x1, y1, top), iso(x0, y1, top)], true);
    g.fillStyle(darken(b.color, 0.22), 1).fillPoints([iso(x1, y0, b.z), iso(x1, y1, b.z), iso(x1, y1, top), iso(x1, y0, top)], true);
    g.fillStyle(lighten(b.color, 0.15), 1).fillPoints([iso(x0, y0, top), iso(x1, y0, top), iso(x1, y1, top), iso(x0, y1, top)], true);
    return;
  }
  const c = iso(b.x, b.y, 0);
  const rx = b.r * HW * Math.SQRT2;
  const ry = b.r * HH * Math.SQRT2;
  if (b.shape === 'cylinder') {
    g.fillStyle(darken(b.color, 0.15), 1).fillEllipse(c.x, c.y - b.z, rx * 2, ry * 2);
    g.fillStyle(b.color, 1).fillRect(c.x - rx, c.y - b.z - b.h, rx * 2, b.h);
    g.fillStyle(lighten(b.color, 0.15), 1).fillEllipse(c.x, c.y - b.z - b.h, rx * 2, ry * 2);
    return;
  }
  g.fillStyle(darken(b.color, 0.15), 1).fillEllipse(c.x, c.y - b.z, rx * 2, ry * 2);
  g.fillStyle(b.color, 1).fillTriangle(c.x - rx, c.y - b.z, c.x + rx, c.y - b.z, c.x, c.y - b.z - b.h);
}

export const codeObjectArt: ObjectArt = {
  create(scene, x, y, name, rotation) {
    const g = scene.add.graphics({ x, y });
    const blocks = objectBlocks(name, rotation).sort((a, b) => a.x + a.y - (b.x + b.y) || a.z - b.z);
    for (const b of blocks) drawBlock(g, b);
    return g;
  },
  topHeight: objectTopHeight,
};
