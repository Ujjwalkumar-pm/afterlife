export type Ground = 'soil' | 'concrete' | 'blocked';
export type Size = 'small' | 'medium' | 'large';
export type PlantType = 'moss' | 'vine' | 'flower' | 'bamboo';
export type ScrapKind = 'tyre' | 'can' | 'cone' | 'crate' | 'barrel' | 'sign' | 'car';

export interface Pos {
  x: number;
  y: number;
}

export interface WorldObject {
  kind: 'ruin' | 'scrap';
  name: string;
  size: Size;
}

export interface PlantCell {
  plantId: number;
  type: PlantType;
  stage: number;
  bloom: boolean;
}

export interface Tile {
  ground: Ground;
  object: WorldObject | null;
  plant: PlantCell | null;
}

export type SeedCounts = Record<PlantType, number>;

export interface GameState {
  width: number;
  height: number;
  /** Row-major: index = y * width + x */
  tiles: Tile[];
  seeds: SeedCounts;
  /** The scrap batch currently offered to the player. */
  tray: ScrapKind[];
  /** Batches still to come, in order. */
  batches: ScrapKind[][];
  target: number;
  /** Seed type given by harvesting; null means the flower's own type. */
  harvestYield: PlantType | null;
  rng: number;
  nextPlantId: number;
  won: boolean;
}

export type Move =
  | { type: 'seed'; plant: PlantType; x: number; y: number }
  | { type: 'scrap'; slot: number; x: number; y: number }
  | { type: 'harvest'; x: number; y: number };

export type GameEvent =
  | { type: 'placedSeed'; pos: Pos; plant: PlantType }
  | { type: 'placedScrap'; pos: Pos; scrap: ScrapKind }
  | { type: 'grew'; pos: Pos; stage: number }
  | { type: 'spread'; from: Pos; to: Pos; plant: PlantType }
  | { type: 'bloomed'; pos: Pos }
  | { type: 'blocked'; pos: Pos }
  | { type: 'harvested'; pos: Pos; seed: PlantType }
  | { type: 'newBatch'; tray: ScrapKind[] }
  | { type: 'won' }
  | { type: 'stuck' };

export type ActionResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; reason: string };

export interface RuinSpec {
  x: number;
  y: number;
  name: string;
  size: Size;
}

export interface LevelData {
  id: string;
  name: string;
  hint: string;
  width: number;
  height: number;
  /** One string per row: '.' soil, '#' concrete, 'X' blocked */
  ground: string[];
  ruins: RuinSpec[];
  seeds: Partial<SeedCounts>;
  batches: ScrapKind[][];
  target: number;
  rngSeed: number;
  harvestYield?: PlantType;
  solution: Move[];
}
