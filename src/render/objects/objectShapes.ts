import { PALETTE as C } from '../palette';
import type { Rotation } from '../iso/projection';

/** x, y: offset from the tile centre in tile units (-0.5..0.5). w, d, r: tile units. z, h: pixels. */
export type Block =
  | { shape: 'box'; x: number; y: number; w: number; d: number; z: number; h: number; color: number }
  | { shape: 'cylinder'; x: number; y: number; r: number; z: number; h: number; color: number }
  | { shape: 'cone'; x: number; y: number; r: number; z: number; h: number; color: number };

const box = (x: number, y: number, w: number, d: number, z: number, h: number, color: number): Block => ({ shape: 'box', x, y, w, d, z, h, color });
const cyl = (x: number, y: number, r: number, z: number, h: number, color: number): Block => ({ shape: 'cylinder', x, y, r, z, h, color });
const cone = (x: number, y: number, r: number, z: number, h: number, color: number): Block => ({ shape: 'cone', x, y, r, z, h, color });
const legs = (s: number, h: number) => [box(-s, -s, 0.06, 0.06, 0, h, C.metalDark), box(s, -s, 0.06, 0.06, 0, h, C.metalDark), box(-s, s, 0.06, 0.06, 0, h, C.metalDark), box(s, s, 0.06, 0.06, 0, h, C.metalDark)];

export const OBJECTS: Record<string, Block[]> = {
  // scrap
  tyre: [cyl(0, 0, 0.26, 0, 9, C.rubber), cyl(0, 0, 0.11, 0, 10, C.rubberDark)],
  can: [cyl(0, 0, 0.09, 0, 11, C.metal)],
  cone: [box(0, 0, 0.42, 0.42, 0, 3, C.orange), cone(0, 0, 0.17, 3, 20, C.orange)],
  crate: [box(0, 0, 0.56, 0.56, 0, 18, C.wood), box(0, 0, 0.6, 0.6, 18, 3, C.woodDark)],
  barrel: [cyl(0, 0, 0.22, 0, 26, C.rust), cyl(0, 0, 0.225, 8, 2, C.rustDark), cyl(0, 0, 0.225, 17, 2, C.rustDark)],
  sign: [box(0, 0, 0.06, 0.06, 0, 30, C.metalDark), box(0, 0, 0.5, 0.06, 26, 16, C.paint)],
  car: [box(0, 0, 0.9, 0.5, 2, 12, C.rust), box(-0.08, 0, 0.48, 0.44, 14, 10, C.rustDark), cyl(0.28, 0.24, 0.08, 0, 6, C.rubber), cyl(-0.28, 0.24, 0.08, 0, 6, C.rubber)],
  // ruins
  bench: [box(-0.34, 0, 0.05, 0.22, 0, 8, C.metalDark), box(0.34, 0, 0.05, 0.22, 0, 8, C.metalDark), box(0, 0, 0.8, 0.26, 8, 3, C.wood), box(0, -0.12, 0.8, 0.05, 11, 9, C.wood)],
  bin: [cyl(0, 0, 0.18, 0, 20, C.metalDark), cyl(0, 0, 0.2, 20, 3, C.metal)],
  'water-tank': [...legs(0.25, 12), cyl(0, 0, 0.38, 12, 26, C.metal), cyl(0, 0, 0.3, 38, 3, C.metalDark)],
  'ac-unit': [box(0, 0, 0.7, 0.5, 0, 22, C.white), box(0, 0.26, 0.5, 0.02, 4, 14, C.metalDark)],
  pump: [box(0, 0, 0.4, 0.3, 0, 32, C.paint), box(0, 0.16, 0.2, 0.02, 14, 10, C.white), box(0, 0, 0.46, 0.36, 32, 4, C.rustDark)],
  'old-car': [box(0, 0, 0.95, 0.55, 2, 13, C.rust), box(0.05, 0, 0.5, 0.48, 15, 11, C.rustDark), cyl(0.3, 0.27, 0.09, 0, 7, C.rubber), cyl(-0.3, 0.27, 0.09, 0, 7, C.rubber)],
  'station-sign': [box(-0.35, 0, 0.05, 0.05, 0, 34, C.metalDark), box(0.35, 0, 0.05, 0.05, 0, 34, C.metalDark), box(0, 0, 0.85, 0.05, 26, 12, C.paintBlue)],
  slide: [box(-0.28, 0, 0.3, 0.3, 0, 30, C.paintRed), box(0.18, 0, 0.6, 0.22, 0, 10, C.metal)],
  swings: [box(-0.4, 0, 0.05, 0.05, 0, 36, C.metalDark), box(0.4, 0, 0.05, 0.05, 0, 36, C.metalDark), box(0, 0, 0.85, 0.05, 36, 3, C.metalDark), box(-0.15, 0, 0.14, 0.12, 10, 2, C.wood), box(0.15, 0, 0.14, 0.12, 10, 2, C.wood)],
  roundabout: [cyl(0, 0, 0.42, 0, 5, C.paintRed), cyl(0, 0, 0.05, 5, 12, C.metal)],
  sandpit: [box(0, 0, 0.9, 0.9, 0, 4, C.wood), box(0, 0, 0.78, 0.78, 0, 5, C.sand)],
};

export const hasObjectShape = (name: string): boolean => Object.hasOwn(OBJECTS, name);

/** A quarter turn maps offset (x, y) to (-y, x), matching the grid's view rotation; boxes swap footprint. */
export function rotateBlock(b: Block, rotation: Rotation | number): Block {
  let r = b;
  for (let i = 0; i < rotation; i++) {
    r = r.shape === 'box' ? { ...r, x: -r.y, y: r.x, w: r.d, d: r.w } : { ...r, x: -r.y, y: r.x };
  }
  return r;
}

export function objectBlocks(name: string, rotation: Rotation): Block[] {
  const blocks = hasObjectShape(name) ? OBJECTS[name]! : OBJECTS.crate!;
  return blocks.map((b) => rotateBlock(b, rotation));
}

export function objectTopHeight(name: string): number {
  return Math.max(...(hasObjectShape(name) ? OBJECTS[name]! : OBJECTS.crate!).map((b) => b.z + b.h));
}
