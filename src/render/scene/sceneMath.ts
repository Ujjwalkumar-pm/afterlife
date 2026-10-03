import type { GameState, PlantCell, PlantType, Pos } from '../../engine';
import { viewSize, type IsoView } from '../iso/projection';
import { lerpColor } from '../palette';

export type Change = 'added' | 'removed' | 'changed' | null;
export type PlantChange = Change | 'grew' | 'bloomed' | 'unbloomed';
export interface TileChange {
  pos: Pos;
  object: Change;
  plant: PlantChange;
}
type XY = { x: number; y: number };

/** What changed per tile between two states (prev null = everything present is new). */
export function diffTiles(prev: GameState | null, next: GameState): TileChange[] {
  const out: TileChange[] = [];
  next.tiles.forEach((b, i) => {
    const a = prev?.tiles[i];
    const pos = { x: i % next.width, y: Math.floor(i / next.width) };
    let object: Change = null;
    if (!a?.object && b.object) object = 'added';
    else if (a?.object && !b.object) object = 'removed';
    else if (a?.object && b.object && a.object.name !== b.object.name) object = 'changed';
    let plant: PlantChange = null;
    const ap = a?.plant ?? null;
    const bp = b.plant;
    if (!ap && bp) plant = 'added';
    else if (ap && !bp) plant = 'removed';
    else if (ap && bp) {
      if (ap.type !== bp.type || bp.stage < ap.stage) plant = 'changed';
      else if (bp.stage > ap.stage) plant = 'grew';
      else if (!ap.bloom && bp.bloom) plant = 'bloomed';
      else if (ap.bloom && !bp.bloom) plant = 'unbloomed';
    }
    if (object || plant) out.push({ pos, object, plant });
  });
  return out;
}

/** Four look-variants per plant type keep the texture cache small while gardens still vary. */
export const plantVariant = (cell: PlantCell, x: number, y: number): number => (cell.plantId * 7 + x * 3 + y * 5) % 4;

export const plantTextureKey = (cell: PlantCell, x: number, y: number, objectHeight: number): string =>
  `plant-${cell.type}-${cell.stage}-${cell.bloom ? 1 : 0}-${objectHeight}-${plantVariant(cell, x, y)}`;

/** Least-recently-used key tracker; returns keys to evict, never ones currently in use. */
export class TextureLru {
  private order = new Map<string, true>();

  constructor(private readonly max: number) {}

  get size(): number {
    return this.order.size;
  }

  touch(key: string, inUse: Set<string>): string[] {
    this.order.delete(key);
    this.order.set(key, true);
    const evicted: string[] = [];
    for (const k of [...this.order.keys()]) {
      if (this.order.size <= this.max) break;
      if (k === key || inUse.has(k)) continue;
      this.order.delete(k);
      evicted.push(k);
    }
    return evicted;
  }
}

const manhattan = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** When the growth ripple from `center` reaches `tile` (ms). */
export function rippleDelay(center: Pos, tile: Pos, radius: number, totalMs = 400): number {
  if (radius <= 0) return 0;
  return Math.round(Math.min(1, manhattan(center, tile) / radius) * totalMs);
}

export function washDelays(state: GameState, origin: Pos, stepMs = 40): { pos: Pos; delay: number }[] {
  const out: { pos: Pos; delay: number }[] = [];
  state.tiles.forEach((t, i) => {
    if (t.ground === 'blocked') return;
    const pos = { x: i % state.width, y: Math.floor(i / state.width) };
    out.push({ pos, delay: manhattan(origin, pos) * stepMs });
  });
  return out.sort((a, b) => a.delay - b.delay);
}

const SWAY_DEG: Record<PlantType, number> = { moss: 1.5, vine: 3, flower: 4, bamboo: 5 };

export function swayFor(type: PlantType, x: number, y: number): { amplitude: number; period: number; phase: number } {
  return {
    amplitude: (SWAY_DEG[type] * Math.PI) / 180,
    period: 2400 + ((x * 37 + y * 61) % 13) * 100,
    phase: (((x * 13 + y * 29) % 100) / 100) * Math.PI * 2,
  };
}

const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

export function skyColors(progress: number): { top: string; bottom: string } {
  return { top: hex(lerpColor(0x2c3540, 0x4f7262, progress)), bottom: hex(lerpColor(0x4a4336, 0xd2a85e, progress)) };
}

/** Outer corners of the board's diamond in world pixels (before island depth). */
export function islandCorners(v: IsoView): { top: XY; right: XY; bottom: XY; left: XY } {
  const { width: w, height: h } = viewSize(v);
  const hw = v.tileW / 2;
  const hh = v.tileH / 2;
  return {
    top: { x: 0, y: -hh },
    right: { x: (w - 1) * hw + hw, y: (w - 1) * hh },
    bottom: { x: (w - 1 - (h - 1)) * hw, y: (w - 1 + h - 1) * hh + hh },
    left: { x: -(h - 1) * hw - hw, y: (h - 1) * hh },
  };
}
