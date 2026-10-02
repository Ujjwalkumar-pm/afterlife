import type { Pos } from '../../engine';

export type Rotation = 0 | 1 | 2 | 3;

export interface IsoView {
  width: number;
  height: number;
  rotation: Rotation;
  tileW: number;
  tileH: number;
}

/** Grid dimensions as seen after rotation. */
export function viewSize(v: IsoView): { width: number; height: number } {
  return v.rotation % 2 === 0 ? { width: v.width, height: v.height } : { width: v.height, height: v.width };
}

/** Grid position → rotated view position. Each quarter turn maps (x, y) to (h-1-y, x). */
export function toView(v: IsoView, p: Pos): Pos {
  let q = p;
  let h = v.height;
  let w = v.width;
  for (let i = 0; i < v.rotation; i++) {
    q = { x: h - 1 - q.y, y: q.x };
    [w, h] = [h, w];
  }
  return q;
}

/** Rotated view position → grid position. */
export function fromView(v: IsoView, q: Pos): Pos {
  let p = q;
  let { width: w, height: h } = viewSize(v);
  for (let i = 0; i < v.rotation; i++) {
    p = { x: p.y, y: w - 1 - p.x };
    [w, h] = [h, w];
  }
  return p;
}

/** Centre of the tile's diamond in world (pre-camera) pixels. */
export function toScreen(v: IsoView, p: Pos): { x: number; y: number } {
  const q = toView(v, p);
  return { x: (q.x - q.y) * (v.tileW / 2), y: (q.x + q.y) * (v.tileH / 2) };
}

/** World pixels → grid position of the diamond containing that point, or null. */
export function toGrid(v: IsoView, sx: number, sy: number): Pos | null {
  const a = sx / (v.tileW / 2);
  const b = sy / (v.tileH / 2);
  // `+ 0` turns Math.round's -0 into 0 so positions compare cleanly.
  const q = { x: Math.round((a + b) / 2) + 0, y: Math.round((b - a) / 2) + 0 };
  const { width, height } = viewSize(v);
  if (q.x < 0 || q.y < 0 || q.x >= width || q.y >= height) return null;
  return fromView(v, q);
}

/** Painter's order: larger is nearer the viewer. */
export function depth(v: IsoView, p: Pos): number {
  const q = toView(v, p);
  return q.x + q.y;
}

const HEADROOM = 60;

export function sceneBounds(v: IsoView): { width: number; height: number; centerX: number; centerY: number } {
  const { width: w, height: h } = viewSize(v);
  const hw = v.tileW / 2;
  const hh = v.tileH / 2;
  const minX = -(h - 1) * hw - hw;
  const maxX = (w - 1) * hw + hw;
  const minY = -hh - HEADROOM;
  const maxY = (w - 1 + h - 1) * hh + hh + 8;
  return { width: maxX - minX, height: maxY - minY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}
