import { PLANTS, RADIUS, SCRAP } from './catalog';
import { cloneState, tileAt } from './grid';
import { growAround } from './growth';
import { coverage, isStuck } from './queries';
import type { ActionResult, GameEvent, GameState, Move, PlantType, Pos, Tile } from './types';

const fail = (reason: string): ActionResult => ({ ok: false, reason });

function openTile(s: GameState, p: Pos): Tile | string {
  const tile = tileAt(s, p);
  if (!tile) return 'out of bounds';
  if (tile.ground === 'blocked') return 'tile is blocked';
  return tile;
}

function finish(prev: GameState, next: GameState, events: GameEvent[]): ActionResult {
  const reached = coverage(next) >= next.target;
  if (reached && !prev.won) events.push({ type: 'won' });
  next.won = prev.won || reached;
  if (isStuck(next)) events.push({ type: 'stuck' });
  return { ok: true, state: next, events };
}

export function placeSeed(s: GameState, plant: PlantType, p: Pos): ActionResult {
  const tile = openTile(s, p);
  if (typeof tile === 'string') return fail(tile);
  if (tile.plant) return fail('tile already has a plant');
  if (!PLANTS[plant].growsOn(tile.object)) return fail(`${plant} cannot grow here`);
  if (s.seeds[plant] <= 0) return fail(`no ${plant} seeds left`);

  const next = cloneState(s);
  next.seeds[plant] -= 1;
  tileAt(next, p)!.plant = { plantId: next.nextPlantId++, type: plant, stage: 0, bloom: false };
  return finish(s, next, [{ type: 'placedSeed', pos: p, plant }]);
}

export function placeScrap(s: GameState, slot: number, p: Pos): ActionResult {
  const tile = openTile(s, p);
  if (typeof tile === 'string') return fail(tile);
  if (tile.object) return fail('tile already has an object');
  if (tile.plant) return fail('tile has a plant');
  if (!Number.isInteger(slot) || s.tray[slot] === undefined) return fail(`no scrap in slot ${slot}`);

  const next = cloneState(s);
  const [kind] = next.tray.splice(slot, 1);
  const size = SCRAP[kind!].size;
  tileAt(next, p)!.object = { kind: 'scrap', name: kind!, size };
  const events: GameEvent[] = [{ type: 'placedScrap', pos: p, scrap: kind! }];
  growAround(next, p, RADIUS[size], events);
  if (next.tray.length === 0 && next.batches.length > 0) {
    next.tray = next.batches.shift()!;
    events.push({ type: 'newBatch', tray: [...next.tray] });
  }
  return finish(s, next, events);
}

export function harvest(s: GameState, p: Pos): ActionResult {
  const tile = tileAt(s, p);
  if (!tile) return fail('out of bounds');
  if (!tile.plant?.bloom) return fail('nothing to harvest');

  const next = cloneState(s);
  const cell = tileAt(next, p)!.plant!;
  cell.bloom = false;
  const seed = next.harvestYield ?? cell.type;
  next.seeds[seed] += 1;
  return finish(s, next, [{ type: 'harvested', pos: p, seed }]);
}

export function applyMove(s: GameState, move: Move): ActionResult {
  const p = { x: move.x, y: move.y };
  switch (move.type) {
    case 'seed':
      return placeSeed(s, move.plant, p);
    case 'scrap':
      return placeScrap(s, move.slot, p);
    case 'harvest':
      return harvest(s, p);
  }
}
