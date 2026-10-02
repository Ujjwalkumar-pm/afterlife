import { applyMove } from './actions';
import { createInitialState } from './level';
import type { ActionResult, GameState, LevelData, Move } from './types';

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * Holds the current state plus undo history. Every stored state is deep-frozen, so a stray
 * write (e.g. from rendering code) throws instead of silently corrupting undo or restart.
 */
export class Session {
  private current: GameState;
  private readonly initial: GameState;
  private history: GameState[] = [];

  constructor(level: LevelData) {
    this.initial = deepFreeze(createInitialState(level));
    this.current = this.initial;
  }

  get state(): GameState {
    return this.current;
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  apply(move: Move): ActionResult {
    const result = applyMove(this.state, move);
    if (result.ok) {
      this.history.push(this.current);
      this.current = deepFreeze(result.state);
    }
    return result;
  }

  undo(): boolean {
    const previous = this.history.pop();
    if (!previous) return false;
    this.current = previous;
    return true;
  }

  restart(): void {
    this.history = [];
    this.current = this.initial;
  }
}
