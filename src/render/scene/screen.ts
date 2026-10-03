/** Canvas pixels per CSS pixel: the device ratio, at least 1, capped at 2 (sharp, but kind to phone GPUs). */
export function renderScale(dpr: number): number {
  return Number.isFinite(dpr) && dpr > 1 ? Math.min(2, dpr) : 1;
}

/** A sideways drag on the board (CSS px) turns it a quarter: drag right turns left (-1), drag left turns right (+1). */
export function swipeTurn(dx: number, dy: number, min = 48): -1 | 0 | 1 {
  if (Math.abs(dx) < min || Math.abs(dx) <= 1.5 * Math.abs(dy)) return 0;
  return dx > 0 ? -1 : 1;
}
