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

export function hasFreeTile(s: GameState): boolean {
  return s.tiles.some((t) => t.ground !== 'blocked' && t.object === null && t.plant === null);
}

/** Nothing can be placed any more: no free tile. (Running out of scrap is solved by a bonus crate.) */
export function isStuck(s: GameState): boolean {
  return !s.won && !hasFreeTile(s);
}

/** Out of scrap before winning, with room to use more: a bonus crate may be granted. */
export function canBonus(s: GameState): boolean {
  return !s.won && s.tray.length === 0 && s.batches.length === 0 && hasFreeTile(s);
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
