import { nextRandom, type PlantType } from '../../engine';
import { darken, lighten, PALETTE } from '../palette';

export type Prim =
  | { kind: 'ellipse'; x: number; y: number; w: number; h: number; color: number }
  | { kind: 'circle'; x: number; y: number; r: number; color: number }
  | { kind: 'line'; points: number[]; width: number; color: number };

export interface PlantDrawInput {
  type: PlantType;
  stage: number;
  bloom: boolean;
  plantId: number;
  x: number;
  y: number;
  /** Height in px of the object this cell sits on (0 on bare ground). */
  objectHeight: number;
}

const HW = 32;
const HH = 16;
type Rand = () => number;

function rand(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    const [v, next] = nextRandom(s);
    s = next;
    return v;
  };
}
const pick = <T>(r: Rand, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;

/** A random point inside the tile diamond, scaled toward the centre by `scale`. */
function inDiamond(r: Rand, scale: number): { x: number; y: number } {
  const u = r() * 2 - 1;
  const v = (r() * 2 - 1) * (1 - Math.abs(u));
  return { x: u * HW * scale, y: v * HH * scale };
}

function moss(p: PlantDrawInput, r: Rand, base: number): Prim[] {
  const out: Prim[] = [];
  const n = 3 + p.stage * 3;
  for (let i = 0; i < n; i++) {
    const q = inDiamond(r, p.objectHeight > 0 ? 0.45 : 0.85);
    const w = 7 + r() * 8;
    const c = pick(r, PALETTE.moss);
    out.push({ kind: 'ellipse', x: q.x, y: base + q.y + 1.5, w: w * 1.05, h: w * 0.5, color: darken(c, 0.3) });
    out.push({ kind: 'ellipse', x: q.x, y: base + q.y, w, h: w * 0.55, color: c });
    out.push({ kind: 'ellipse', x: q.x - w * 0.18, y: base + q.y - w * 0.12, w: w * 0.35, h: w * 0.18, color: lighten(c, 0.35) });
  }
  return out;
}

function leaf(x: number, y: number, c: number): Prim[] {
  return [
    { kind: 'ellipse', x, y, w: 8, h: 4.5, color: c },
    { kind: 'line', points: [x - 3, y + 0.5, x + 3, y - 0.5], width: 0.8, color: PALETTE.vein },
  ];
}

function vine(p: PlantDrawInput, r: Rand): Prim[] {
  const out: Prim[] = [];
  const climbing = p.objectHeight > 0;
  const climb = climbing ? p.objectHeight * Math.min(1, p.stage / 3) : 0;
  const len = 10 + p.stage * 6;
  for (let i = 0; i <= p.stage; i++) {
    const start = inDiamond(r, 0.7);
    const drift = { x: (r() - 0.5) * len, y: (r() - 0.5) * len * 0.5 };
    const points: number[] = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      points.push(start.x + Math.sin(t * 3 + i) * 4 + (climbing ? 0 : drift.x * t), start.y - climb * t + (climbing ? 0 : drift.y * t));
    }
    out.push({ kind: 'line', points, width: 2, color: PALETTE.stem });
    for (let k = 1; k <= 5; k += 2) out.push(...leaf(points[k * 2]!, points[k * 2 + 1]!, pick(r, PALETTE.vine)));
  }
  return out;
}

function flower(p: PlantDrawInput, r: Rand, base: number): Prim[] {
  const h = 6 + p.stage * 5;
  const x = (r() - 0.5) * 8;
  const head = { x: x + 1, y: base - h };
  const out: Prim[] = [
    { kind: 'line', points: [x, base, head.x, head.y], width: 2, color: PALETTE.stem },
    { kind: 'ellipse', x: x - 4, y: base - h * 0.4, w: 8, h: 4, color: PALETTE.leaf },
    { kind: 'ellipse', x: x - 5, y: base - h * 0.4 - 1, w: 3, h: 1.4, color: lighten(PALETTE.leaf, 0.4) },
    { kind: 'ellipse', x: x + 4, y: base - h * 0.6, w: 8, h: 4, color: PALETTE.leaf },
    { kind: 'ellipse', x: x + 3, y: base - h * 0.6 - 1, w: 3, h: 1.4, color: lighten(PALETTE.leaf, 0.4) },
  ];
  if (p.bloom) {
    const petal = pick(r, PALETTE.petal);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      out.push({ kind: 'circle', x: head.x + Math.cos(a) * 5, y: head.y + Math.sin(a) * 4, r: 3.5, color: petal });
    }
    out.push({ kind: 'circle', x: head.x, y: head.y, r: 2.5, color: PALETTE.flowerCentre });
  } else if (p.stage >= 2) {
    out.push({ kind: 'circle', x: head.x, y: head.y, r: 3, color: PALETTE.bud });
  }
  return out;
}

function bamboo(p: PlantDrawInput, r: Rand, base: number): Prim[] {
  const out: Prim[] = [];
  const poles = Math.min(3, 1 + Math.floor(p.stage / 2));
  const h = 8 + p.stage * 9;
  for (let i = 0; i < poles; i++) {
    const x = (i - (poles - 1) / 2) * 6 + (r() - 0.5) * 2;
    const ph = h * (0.8 + r() * 0.2);
    out.push({ kind: 'line', points: [x, base, x, base - ph], width: 3, color: pick(r, PALETTE.bamboo) });
    for (let s = 8; s < ph; s += 8) out.push({ kind: 'line', points: [x - 2, base - s, x + 2, base - s], width: 1, color: PALETTE.bambooNode });
    out.push({ kind: 'ellipse', x: x + 4, y: base - ph, w: 9, h: 3, color: PALETTE.leaf });
    out.push({ kind: 'ellipse', x: x - 3, y: base - ph - 2, w: 8, h: 2.6, color: lighten(PALETTE.leaf, 0.15) });
    out.push({ kind: 'ellipse', x: x + 1, y: base - ph - 4, w: 6, h: 2.2, color: darken(PALETTE.leaf, 0.1) });
  }
  return out;
}

/** Drawing primitives for one plant cell, in px relative to the tile's diamond centre at ground level. */
export function plantPrims(p: PlantDrawInput): Prim[] {
  const r = rand(p.plantId * 7919 + p.x * 131 + p.y * 17 + 1);
  const base = -p.objectHeight;
  if (p.stage === 0) return [{ kind: 'ellipse', x: 0, y: base, w: 10, h: 5, color: PALETTE.seed }];
  switch (p.type) {
    case 'moss':
      return moss(p, r, base);
    case 'vine':
      return vine(p, r);
    case 'flower':
      return flower(p, r, base);
    case 'bamboo':
      return bamboo(p, r, base);
  }
}

export function primBounds(prims: Prim[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x: number, y: number, rx: number, ry: number) => {
    minX = Math.min(minX, x - rx);
    maxX = Math.max(maxX, x + rx);
    minY = Math.min(minY, y - ry);
    maxY = Math.max(maxY, y + ry);
  };
  for (const p of prims) {
    if (p.kind === 'ellipse') add(p.x, p.y, p.w / 2, p.h / 2);
    else if (p.kind === 'circle') add(p.x, p.y, p.r, p.r);
    else for (let i = 0; i < p.points.length; i += 2) add(p.points[i]!, p.points[i + 1]!, p.width / 2, p.width / 2);
  }
  return { minX, minY, maxX, maxY };
}

export function offsetPrims(prims: Prim[], dx: number, dy: number): Prim[] {
  return prims.map((p) =>
    p.kind === 'line' ? { ...p, points: p.points.map((v, i) => v + (i % 2 === 0 ? dx : dy)) } : { ...p, x: p.x + dx, y: p.y + dy },
  );
}

export function scalePrims(prims: Prim[], k: number): Prim[] {
  return prims.map((p) => {
    if (p.kind === 'ellipse') return { ...p, x: p.x * k, y: p.y * k, w: p.w * k, h: p.h * k };
    if (p.kind === 'circle') return { ...p, x: p.x * k, y: p.y * k, r: p.r * k };
    return { ...p, points: p.points.map((v) => v * k), width: p.width * k };
  });
}
