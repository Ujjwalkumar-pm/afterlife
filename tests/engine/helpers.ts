import { createInitialState, validateLevel } from '../../src/engine/level';
import type { GameState, LevelData, PlantType, Size } from '../../src/engine/types';

export function makeLevel(overrides: Partial<LevelData> = {}): LevelData {
  return validateLevel({
    id: 'test',
    name: 'Test',
    hint: '',
    width: 5,
    height: 5,
    ground: ['.....', '.....', '.....', '.....', '.....'],
    ruins: [],
    seeds: { moss: 5, vine: 5, flower: 5, bamboo: 5 },
    batches: [['tyre', 'tyre', 'tyre', 'crate', 'car']],
    target: 1,
    rngSeed: 42,
    solution: [],
    ...overrides,
  });
}

export function makeState(overrides: Partial<LevelData> = {}): GameState {
  return createInitialState(makeLevel(overrides));
}

/** Test-only: mutates s directly. */
export function putPlant(s: GameState, x: number, y: number, type: PlantType, stage: number, plantId = 99): GameState {
  s.tiles[y * s.width + x]!.plant = { plantId, type, stage, bloom: false };
  return s;
}

/** Test-only: mutates s directly. */
export function putObject(s: GameState, x: number, y: number, name: string, size: Size, kind: 'ruin' | 'scrap' = 'scrap'): GameState {
  s.tiles[y * s.width + x]!.object = { kind, name, size };
  return s;
}
