import { placeScrap, placeSeed, RADIUS, SCRAP, type GameState, type Pos } from '../engine';
import type { Selection } from './controller';

const covered = (s: GameState) => s.tiles.filter((t) => t.ground !== 'blocked' && t.plant !== null && t.plant.stage >= 1).length;
const manhattan = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** The tile where the selected item helps most; only ever a tile where the move is valid. */
export function bestTile(s: GameState, sel: Selection): Pos | null {
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
