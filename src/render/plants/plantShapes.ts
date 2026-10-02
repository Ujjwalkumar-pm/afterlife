import { nextRandom, type PlantType } from '../../engine';
import { PALETTE } from '../palette';

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
  const n = 3 + p.stage * 4;
  for (let i = 0; i < n; i++) {
    const q = inDiamond(r, p.objectHeight > 0 ? 0.45 : 0.85);
    const w = 6 + r() * 8;
    out.push({ kind: 'ellipse', x: q.x, y: base + q.y, w, h: w * 0.55, color: pick(r, PALETTE.moss) });
  }
  return out;
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
    for (let k = 1; k <= 5; k += 2) out.push({ kind: 'ellipse', x: points[k * 2]!, y: points[k * 2 + 1]!, w: 7, h: 4, color: pick(r, PALETTE.vine) });
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
    { kind: 'ellipse', x: x + 4, y: base - h * 0.6, w: 8, h: 4, color: PALETTE.leaf },
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
