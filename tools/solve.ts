import { readFileSync, writeFileSync } from 'node:fs';
import { applyMove } from '../src/engine/actions';
import { PLANT_TYPES } from '../src/engine/catalog';
import { createInitialState, validateLevel } from '../src/engine/level';
import { coverage } from '../src/engine/queries';
import type { GameState, LevelData, Move } from '../src/engine/types';

interface Node {
  state: GameState;
  moves: Move[];
}

function candidateMoves(s: GameState): Move[] {
  const moves: Move[] = [];
  const slots = [...new Set(s.tray)].map((kind) => s.tray.indexOf(kind));
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      for (const plant of PLANT_TYPES) if (s.seeds[plant] > 0) moves.push({ type: 'seed', plant, x, y });
      for (const slot of slots) moves.push({ type: 'scrap', slot, x, y });
      moves.push({ type: 'harvest', x, y });
    }
  }
  return moves;
}

function score(s: GameState): number {
  let growth = 0;
  for (const t of s.tiles) if (t.plant) growth += t.plant.stage + 1;
  let seeds = 0;
  for (const p of PLANT_TYPES) seeds += s.seeds[p];
  return coverage(s) * 1000 + growth + seeds * 0.5;
}

function key(s: GameState): string {
  const tiles = s.tiles
    .map((t) => `${t.object?.name ?? '-'}${t.plant ? `${t.plant.type[0]}${t.plant.stage}${t.plant.bloom ? '*' : ''}` : '_'}`)
    .join('|');
  return `${tiles}/${JSON.stringify(s.seeds)}/${s.tray.join(',')}/${s.batches.length}`;
}

/** Beam search. Every move spends a seed, a scrap or a bloom, so the search always ends. */
export function solve(level: LevelData, beamWidth: number): { moves: Move[] | null; best: number } {
  let beam: Node[] = [{ state: createInitialState(level), moves: [] }];
  let best = 0;
  while (beam.length > 0) {
    const next = new Map<string, Node>();
    for (const node of beam) {
      for (const move of candidateMoves(node.state)) {
        const r = applyMove(node.state, move);
        if (!r.ok) continue;
        const child = { state: r.state, moves: [...node.moves, move] };
        if (r.state.won) return { moves: child.moves, best: coverage(r.state) };
        best = Math.max(best, coverage(r.state));
        const k = key(r.state);
        if (!next.has(k)) next.set(k, child);
      }
    }
    beam = [...next.values()].sort((a, b) => score(b.state) - score(a.state)).slice(0, beamWidth);
  }
  return { moves: null, best };
}

function main(): void {
  const path = process.argv[2];
  const beamWidth = Number(process.argv[3] ?? 40);
  if (!path) {
    console.error('usage: npm run solve -- <level.json> [beamWidth]');
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const level = validateLevel({ ...raw, solution: [] });
  const { moves, best } = solve(level, beamWidth);
  if (!moves) {
    console.error(`No solution for ${level.id} at target ${level.target} (best reached ${best.toFixed(2)}). Lower the target by 0.05 or add a batch, then retry.`);
    process.exit(2);
  }
  raw.solution = moves;
  writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(`${level.id}: solved in ${moves.length} moves`);
}

main();
