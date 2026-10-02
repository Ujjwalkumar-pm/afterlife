import { PLANTS } from './catalog';
import { manhattan, neighbours, posOf, tileAt } from './grid';
import { pickIndex } from './rng';
import type { GameEvent, GameState, PlantCell, PlantType, Pos } from './types';

export function eligibleNeighbours(s: GameState, p: Pos, type: PlantType): Pos[] {
  return neighbours(s, p).filter((q) => {
    const t = tileAt(s, q)!;
    return t.ground !== 'blocked' && t.plant === null && PLANTS[type].growsOn(t.object);
  });
}

function spread(s: GameState, from: Pos, cell: PlantCell, preferObjects: boolean, events: GameEvent[]): void {
  let options = eligibleNeighbours(s, from, cell.type);
  if (options.length === 0) {
    events.push({ type: 'blocked', pos: from });
    return;
  }
  if (preferObjects) {
    const withObject = options.filter((q) => tileAt(s, q)!.object !== null);
    if (withObject.length > 0) options = withObject;
  }
  const [i, nextRng] = pickIndex(s.rng, options.length);
  s.rng = nextRng;
  const to = options[i]!;
  tileAt(s, to)!.plant = { plantId: cell.plantId, type: cell.type, stage: 1, bloom: false };
  events.push({ type: 'spread', from, to, plant: cell.type });
}

function tickCell(s: GameState, p: Pos, events: GameEvent[]): void {
  const cell = tileAt(s, p)!.plant!;
  const rule = PLANTS[cell.type];
  if (cell.stage < rule.maxStage) {
    cell.stage += 1;
    events.push({ type: 'grew', pos: p, stage: cell.stage });
    return;
  }
  switch (rule.onGrown) {
    case 'bloom':
      if (!cell.bloom) {
        cell.bloom = true;
        events.push({ type: 'bloomed', pos: p });
      }
      return;
    case 'none':
      return;
    case 'spread':
    case 'spreadPreferObjects':
      spread(s, p, cell, rule.onGrown === 'spreadPreferObjects', events);
  }
}

/** Gives one growth tick to every plant cell within `radius` of `center`. Mutates `s`. */
export function growAround(s: GameState, center: Pos, radius: number, events: GameEvent[]): void {
  const targets: Pos[] = [];
  s.tiles.forEach((t, i) => {
    const p = posOf(s, i);
    if (t.plant && manhattan(p, center) <= radius) targets.push(p);
  });
  for (const p of targets) tickCell(s, p, events);
}
