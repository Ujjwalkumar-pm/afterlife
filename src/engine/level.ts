import { PLANT_TYPES, SCRAP_KINDS } from './catalog';
import { idx } from './grid';
import type { GameState, Ground, LevelData, PlantType, ScrapKind, SeedCounts, Size, Tile } from './types';

export class LevelError extends Error {}

const GROUND_CHARS: Record<string, Ground> = { '.': 'soil', '#': 'concrete', X: 'blocked' };
const SIZES: Size[] = ['small', 'medium', 'large'];

function fail(id: unknown, message: string): never {
  throw new LevelError(`Level ${String(id ?? '?')}: ${message}`);
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function validateLevel(raw: unknown): LevelData {
  if (typeof raw !== 'object' || raw === null) fail('?', 'not an object');
  const l = raw as Record<string, unknown>;
  const id = l.id;
  if (typeof id !== 'string' || id === '') fail(id, 'id must be a non-empty string');
  if (typeof l.name !== 'string') fail(id, 'name must be a string');
  if (typeof l.hint !== 'string') fail(id, 'hint must be a string');
  const { width, height } = l;
  if (!isInt(width) || width < 1 || !isInt(height) || height < 1) fail(id, 'width and height must be positive integers');

  if (!Array.isArray(l.ground) || l.ground.length !== height) fail(id, `ground must have ${height} rows`);
  const ground = l.ground as unknown[];
  ground.forEach((row, y) => {
    if (typeof row !== 'string' || row.length !== width) fail(id, `ground row ${y} must be ${width} characters`);
    for (const ch of row) if (!(ch in GROUND_CHARS)) fail(id, `ground row ${y} has unknown character "${ch}"`);
  });

  if (!Array.isArray(l.ruins)) fail(id, 'ruins must be an array');
  const taken = new Set<number>();
  for (const r of l.ruins as Record<string, unknown>[]) {
    const { x, y } = r;
    if (!isInt(x) || !isInt(y) || x < 0 || y < 0 || x >= width || y >= height) fail(id, `ruin ${String(r.name)} is out of bounds`);
    if (typeof r.name !== 'string') fail(id, 'ruin name must be a string');
    if (!SIZES.includes(r.size as Size)) fail(id, `ruin ${r.name} has invalid size`);
    if ((ground[y] as string)[x] === 'X') fail(id, `ruin ${r.name} is on a blocked tile`);
    const key = y * width + x;
    if (taken.has(key)) fail(id, `tile (${x},${y}) already has a ruin`);
    taken.add(key);
  }

  if (typeof l.seeds !== 'object' || l.seeds === null) fail(id, 'seeds must be an object');
  for (const [type, count] of Object.entries(l.seeds as Record<string, unknown>)) {
    if (!PLANT_TYPES.includes(type as PlantType)) fail(id, `unknown seed type "${type}"`);
    if (!isInt(count) || count < 0) fail(id, `seed count for ${type} must be a non-negative integer`);
  }

  if (!Array.isArray(l.batches) || l.batches.length === 0) fail(id, 'batches must be a non-empty array');
  (l.batches as unknown[]).forEach((batch, i) => {
    if (!Array.isArray(batch) || batch.length === 0) fail(id, `batch ${i} must be a non-empty array`);
    for (const kind of batch) if (!SCRAP_KINDS.includes(kind as ScrapKind)) fail(id, `batch ${i} has unknown scrap "${String(kind)}"`);
  });

  if (typeof l.target !== 'number' || !(l.target > 0 && l.target <= 1)) fail(id, 'target must be in (0, 1]');
  if (!isInt(l.rngSeed)) fail(id, 'rngSeed must be an integer');
  if (l.harvestYield !== undefined && !PLANT_TYPES.includes(l.harvestYield as PlantType)) fail(id, 'harvestYield is not a plant type');
  if (!Array.isArray(l.solution)) fail(id, 'solution must be an array');

  return raw as LevelData;
}

export function createInitialState(level: LevelData): GameState {
  const tiles: Tile[] = [];
  for (const row of level.ground) for (const ch of row) tiles.push({ ground: GROUND_CHARS[ch]!, object: null, plant: null });
  for (const r of level.ruins) tiles[idx(level, r)]!.object = { kind: 'ruin', name: r.name, size: r.size };

  const seeds = Object.fromEntries(PLANT_TYPES.map((t) => [t, level.seeds[t] ?? 0])) as SeedCounts;
  const [first, ...rest] = structuredClone(level.batches);

  return {
    width: level.width,
    height: level.height,
    tiles,
    seeds,
    tray: first!,
    batches: rest,
    target: level.target,
    harvestYield: level.harvestYield ?? null,
    rng: level.rngSeed >>> 0,
    nextPlantId: 1,
    won: false,
    bonusUsed: 0,
  };
}
