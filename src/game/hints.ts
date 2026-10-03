import { placeScrap, placeSeed, RADIUS, SCRAP, type GameState, type Pos } from '../engine';
import type { Selection } from './controller';

const covered = (s: GameState) => s.tiles.filter((t) => t.ground !== 'blocked' && t.plant !== null && t.plant.stage >= 1).length;
const manhattan = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** The tile where the selected item helps most; only ever a tile where the move is valid. */
export function bestTile(s: GameState, sel: Selection): Pos | null {
  // Harvesting a bloom gives a free seed: always the best first suggestion.
  const bloom = s.tiles.findIndex((t) => t.plant?.bloom);
  if (bloom >= 0) return { x: bloom % s.width, y: Math.floor(bloom / s.width) };
  if (!sel) return null;
  const plants: Pos[] = [];
  s.tiles.forEach((t, i) => t.plant && plants.push({ x: i % s.width, y: Math.floor(i / s.width) }));
  const centre = { x: (s.width - 1) / 2, y: (s.height - 1) / 2 };
  const base = covered(s);
  let best: Pos | null = null;
  let bestScore: [number, number] = [-Infinity, -Infinity];
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const p = { x, y };
      let score: [number, number];
      if (sel.kind === 'scrap') {
        const kind = s.tray[sel.slot];
        if (kind === undefined) return null;
        const r = placeScrap(s, sel.slot, p);
        if (!r.ok) continue;
        const radius = RADIUS[SCRAP[kind].size];
        score = [covered(r.state) - base, plants.filter((q) => manhattan(p, q) <= radius).length];
      } else {
        if (!placeSeed(s, sel.plant, p).ok) continue;
        score = [plants.filter((q) => manhattan(p, q) <= 2).length, -manhattan(p, centre)];
      }
      if (score[0] > bestScore[0] || (score[0] === bestScore[0] && score[1] > bestScore[1])) {
        best = p;
        bestScore = score;
      }
    }
  }
  return best;
}

export interface Suggestion {
  selection: Selection;
  tile: Pos;
}

const SEED_ORDER = ['moss', 'vine', 'flower', 'bamboo'] as const;

/**
 * The idle hint: the most useful item and tile, in this order —
 * harvest a bloom; scrap that adds new cover; a seed while scrap remains to feed it;
 * scrap that feeds any plant; any seed; any scrap.
 */
export function suggestMove(s: GameState, current: Selection): Suggestion | null {
  const bloom = s.tiles.findIndex((t) => t.plant?.bloom);
  if (bloom >= 0) return { selection: current, tile: { x: bloom % s.width, y: Math.floor(bloom / s.width) } };

  const base = covered(s);
  let scrap: { slot: number; tile: Pos; gain: number; near: number } | null = null;
  const seen = new Set<string>();
  s.tray.forEach((kind, slot) => {
    if (seen.has(kind)) return;
    seen.add(kind);
    const tile = bestTile(s, { kind: 'scrap', slot });
    if (!tile) return;
    const r = placeScrap(s, slot, tile);
    if (!r.ok) return;
    const radius = RADIUS[SCRAP[kind].size];
    const near = s.tiles.filter((t, i) => t.plant && manhattan(tile, { x: i % s.width, y: Math.floor(i / s.width) }) <= radius).length;
    const cand = { slot, tile, gain: covered(r.state) - base, near };
    if (!scrap || cand.gain > scrap.gain || (cand.gain === scrap.gain && cand.near > scrap.near)) scrap = cand;
  });

  const seedTypes = [...(current?.kind === 'seed' ? [current.plant] : []), ...SEED_ORDER].filter((p, i, a) => a.indexOf(p) === i && s.seeds[p] > 0);
  let seed: Suggestion | null = null;
  for (const plant of seedTypes) {
    const tile = bestTile(s, { kind: 'seed', plant });
    if (tile) {
      seed = { selection: { kind: 'seed', plant }, tile };
      break;
    }
  }
  const scrapMove = (c: { slot: number; tile: Pos }): Suggestion => ({ selection: { kind: 'scrap', slot: c.slot }, tile: c.tile });
  const best = scrap as { slot: number; tile: Pos; gain: number; near: number } | null;
  const scrapLeft = s.tray.length > 0 || s.batches.length > 0;
  if (best && best.gain >= 1) return scrapMove(best);
  if (seed && scrapLeft) return seed;
  if (best && best.near >= 1) return scrapMove(best);
  if (seed) return seed;
  if (best) return scrapMove(best);
  return null;
}
