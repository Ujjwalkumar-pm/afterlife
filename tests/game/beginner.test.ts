import { describe, expect, it } from 'vitest';
import { PlayController } from '../../src/game/controller';
import { suggestMove } from '../../src/game/hints';
import { LEVELS } from '../../src/levels';

/** A beginner who only ever follows the idle hint (with assist) must be able to finish every level. */
function followHints(levelIndex: number): { overlay: string; bonusUsed: number; moves: number } {
  const c = new PlayController(LEVELS[levelIndex]!, { assist: true });
  let moves = 0;
  for (let i = 0; i < 400 && c.view.overlay === 'none'; i++) {
    // Exactly what the game shows after 3 s idle: it switches to the suggested item and a tile glows.
    const m = suggestMove(c.view.state, c.view.selection);
    if (!m) break;
    if (JSON.stringify(m.selection) !== JSON.stringify(c.view.selection) && m.selection) c.select(m.selection);
    if (c.tap(m.tile, 'touch').length > 0) moves++;
  }
  return { overlay: c.view.overlay, bonusUsed: c.view.state.bonusUsed, moves };
}

describe('following the hint suggestions always leads to a win', () => {
  it.each(LEVELS.map((l, i) => [l.id, i] as const))('finishes %s', (_id, i) => {
    const r = followHints(i);
    expect(r.overlay, JSON.stringify(r)).toBe('restored');
    expect(r.bonusUsed, JSON.stringify(r)).toBeLessThanOrEqual(8);
  });
});
