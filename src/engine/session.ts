import { applyMove } from './actions';
import { createInitialState } from './level';
import type { ActionResult, GameState, LevelData, Move } from './types';

/** Holds the current state plus undo history. States are never mutated, so they can be shared safely. */
export class Session {
  state: GameState;
  private readonly initial: GameState;
  private history: GameState[] = [];

  constructor(level: LevelData) {
    this.initial = createInitialState(level);
    this.state = this.initial;
  }

  get canUndo(): boolean {
    return this.history.length > 0;
  }

  apply(move: Move): ActionResult {
    const result = applyMove(this.state, move);
    if (result.ok) {
      this.history.push(this.state);
      this.state = result.state;
    }
    return result;
  }

  undo(): boolean {
    const previous = this.history.pop();
    if (!previous) return false;
    this.state = previous;
    return true;
  }

  restart(): void {
    this.history = [];
    this.state = this.initial;
  }
}
