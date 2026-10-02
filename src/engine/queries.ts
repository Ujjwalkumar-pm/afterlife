import { PLANTS, RADIUS, SCRAP } from './catalog';
import { inBounds, manhattan, posOf, tileAt } from './grid';
import { eligibleNeighbours } from './growth';
import type { GameState, Pos } from './types';

export function coverage(s: GameState): number {
  let total = 0;
  let covered = 0;
  for (const t of s.tiles) {
    if (t.ground === 'blocked') continue;
    total += 1;
    if (t.plant && t.plant.stage >= 1) covered += 1;
  }
  return total === 0 ? 0 : covered / total;
}

export type CellStatus = 'seed' | 'growing' | 'grown' | 'blocked';

export function cellStatus(s: GameState, p: Pos): CellStatus | null {
  const cell = tileAt(s, p)?.plant;
  if (!cell) return null;
  if (cell.stage === 0) return 'seed';
  const rule = PLANTS[cell.type];
  if (cell.stage < rule.maxStage) return 'growing';
  const spreads = rule.onGrown === 'spread' || rule.onGrown === 'climb';
  if (spreads && eligibleNeighbours(s, p, cell.type).length === 0) return 'blocked';
  return 'grown';
}

/** Not won, and no scrap can be placed: none is left, or no tile is free (unblocked, no object, no plant). */
export function isStuck(s: GameState): boolean {
  if (s.won) return false;
  if (s.tray.length === 0 && s.batches.length === 0) return true;
  return !s.tiles.some((t) => t.ground !== 'blocked' && t.object === null && t.plant === null);
}

/** Plant cells that would get a growth tick if the scrap in `slot` were placed at `p`. */
export function previewScrap(s: GameState, slot: number, p: Pos): Pos[] {
  const kind = s.tray[slot];
  if (kind === undefined || !inBounds(s, p)) return [];
  const radius = RADIUS[SCRAP[kind].size];
  const hits: Pos[] = [];
  s.tiles.forEach((t, i) => {
    const q = posOf(s, i);
    if (t.plant && manhattan(q, p) <= radius) hits.push(q);
  });
  return hits;
}
