import type { GameState, Pos, Tile } from './types';

interface Dims {
  width: number;
  height: number;
}

export const idx = (s: Dims, p: Pos): number => p.y * s.width + p.x;

export const inBounds = (s: Dims, p: Pos): boolean =>
  Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height;

export const tileAt = (s: GameState, p: Pos): Tile | null => (inBounds(s, p) ? s.tiles[idx(s, p)]! : null);

export const posOf = (s: Dims, i: number): Pos => ({ x: i % s.width, y: Math.floor(i / s.width) });

export const manhattan = (a: Pos, b: Pos): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export const neighbours = (s: Dims, p: Pos): Pos[] =>
  [
    { x: p.x, y: p.y - 1 },
    { x: p.x + 1, y: p.y },
    { x: p.x, y: p.y + 1 },
    { x: p.x - 1, y: p.y },
  ].filter((q) => inBounds(s, q));

export const cloneState = (s: GameState): GameState => structuredClone(s);
