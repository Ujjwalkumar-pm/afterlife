import { applyMove } from '../../src/engine/actions';
import { createInitialState, validateLevel } from '../../src/engine/level';
import type { GameEvent, GameState, LevelData, Move, PlantType, Size } from '../../src/engine/types';

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

export function play(state: GameState, ...moves: Move[]): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];
  for (const m of moves) {
    const r = applyMove(s, m);
    if (!r.ok) throw new Error(`move ${JSON.stringify(m)} rejected: ${r.reason}`);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}
