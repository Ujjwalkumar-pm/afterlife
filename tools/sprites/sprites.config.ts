export interface SpriteSpec {
  /** Object name used by levels and scrap (must match the engine / OBJECTS keys). */
  name: string;
  /** Path under assets/kenney/. */
  file: string;
  /** Largest horizontal extent, in tiles, after scaling. */
  footprint: number;
  /** Optional height cap in tiles (for tall, thin models like signs). */
  maxHeight?: number;
  /** Extra rotation in quarter turns to make the model face the same way as its code-drawn version. */
  yaw?: number;
}

export const SPRITES: SpriteSpec[] = [
  { name: 'tyre', file: 'car-kit/debris-tire.glb', footprint: 0.5 },
  { name: 'car', file: 'car-kit/sedan.glb', footprint: 0.95 },
  { name: 'old-car', file: 'car-kit/van.glb', footprint: 0.95 },
  { name: 'cone', file: 'city-kit-roads/construction-cone.glb', footprint: 0.4 },
  { name: 'sign', file: 'city-kit-roads/road-sign-warning.glb', footprint: 0.5, maxHeight: 0.9 },
  { name: 'station-sign', file: 'city-kit-roads/sign-highway.glb', footprint: 0.9, maxHeight: 1.0 },
  { name: 'water-tank', file: 'city-kit-industrial/detail-tank.glb', footprint: 0.85 },
  { name: 'crate', file: 'survival-kit/box.glb', footprint: 0.55 },
  { name: 'barrel', file: 'survival-kit/barrel.glb', footprint: 0.45 },
  { name: 'bench', file: 'furniture-kit/bench.glb', footprint: 0.8, maxHeight: 0.6 },
  { name: 'bin', file: 'furniture-kit/trashcan.glb', footprint: 0.4 },
];
