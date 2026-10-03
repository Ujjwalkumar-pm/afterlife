import type { GameEvent, GameState, LevelData } from '../engine';

export type ComboLabel = 'Nice!' | 'Lush!' | 'Wild!';

export function comboFor(events: GameEvent[]): { size: number; label: ComboLabel } | null {
  if (!events.some((e) => e.type === 'placedScrap')) return null;
  const size = events.filter((e) => e.type === 'grew' || e.type === 'spread').length;
  if (size < 4) return null;
  return { size, label: size >= 11 ? 'Wild!' : size >= 7 ? 'Lush!' : 'Nice!' };
}

export const MAX_HINTS = 3;

/** Stars for a win. Hints cap the result: 1 hint → at most 2★, 2 or more → 1★. */
export function starsFor(level: LevelData, s: GameState, hintsUsed = 0): 1 | 2 | 3 {
  const cap = hintsUsed >= 2 ? 1 : hintsUsed === 1 ? 2 : 3;
  if (s.bonusUsed > 0) return 1;
  const total = level.batches.reduce((n, b) => n + b.length, 0);
  const left = s.tray.length + s.batches.reduce((n, b) => n + b.length, 0);
  const base = total > 0 && left / total >= 0.25 ? 3 : 2;
  return Math.min(base, cap) as 1 | 2 | 3;
}

export function milestonesCrossed(prev: number, next: number): (25 | 50 | 75)[] {
  return ([25, 50, 75] as const).filter((t) => prev < t / 100 && next >= t / 100);
}
