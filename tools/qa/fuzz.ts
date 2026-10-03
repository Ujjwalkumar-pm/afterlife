import { writeFileSync } from 'node:fs';
import { applyMove, coverage, isStuck, PLANT_TYPES, type GameState, type Move } from '../../src/engine';
import { PlayController } from '../../src/game/controller';
import { suggestMove } from '../../src/game/hints';
import { LEVELS } from '../../src/levels';

let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
function legal(s: GameState): Move[] {
  const out: Move[] = [];
  const slots = [...new Set(s.tray)].map((k) => s.tray.indexOf(k));
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) {
    for (const plant of PLANT_TYPES) if (s.seeds[plant] > 0) out.push({ type: 'seed', plant, x, y });
    for (const slot of slots) out.push({ type: 'scrap', slot, x, y });
    out.push({ type: 'harvest', x, y });
  }
  return out.filter((m) => applyMove(s, m).ok);
}
const violations: string[] = [];
const check = (cond: boolean, msg: string) => { if (!cond && violations.length < 50) violations.push(msg); };
const per: Record<string, unknown>[] = [];
let totalGames = 0, totalMoves = 0;
for (const level of LEVELS) {
  const N = 250;
  let wins = 0, rests = 0, movesSum = 0, undos = 0;
  for (let g = 0; g < N; g++) {
    const c = new PlayController(level, { assist: true });
    const log: Move[] = [];
    let wonOnce = false;
    for (let step = 0; step < 400 && c.view.overlay === 'none'; step++) {
      const s = c.view.state;
      if (log.length && rnd() < 0.06) { c.undo(); log.pop(); undos++; continue; }
      const ms = legal(s);
      if (!ms.length) break;
      const m = ms[Math.floor(rnd() * ms.length)]!;
      try { c.play(m); } catch (e) { check(false, `${level.id}: play threw ${String(e)}`); break; }
      log.push(m); totalMoves++;
      const v = c.view, ns = v.state;
      check(v.coverage >= 0 && v.coverage <= 1, `${level.id}: coverage ${v.coverage}`);
      check(v.progress >= 0 && v.progress <= 1, `${level.id}: progress ${v.progress}`);
      check(Object.values(ns.seeds).every((n) => Number.isInteger(n) && n >= 0), `${level.id}: bad seed count`);
      check(Math.abs(coverage(ns) - v.coverage) < 1e-9, `${level.id}: view/engine coverage mismatch`);
      if (wonOnce) check(ns.won, `${level.id}: won flag lost`);
      if (ns.won) wonOnce = true;
      check((v.overlay === 'rests') === (isStuck(ns) && !ns.won), `${level.id}: rests overlay ${v.overlay} vs isStuck ${isStuck(ns)}`);
    }
    // determinism: replay the same moves on a fresh controller
    const r = new PlayController(level, { assist: true });
    for (const m of log) r.play(m);
    check(JSON.stringify(r.view.state) === JSON.stringify(c.view.state), `${level.id}: replay not deterministic`);
    // restart returns to the start state
    c.restart();
    check(JSON.stringify(c.view.state) === JSON.stringify(new PlayController(level, { assist: true }).view.state), `${level.id}: restart not clean`);
    if (r.view.overlay === 'restored') wins++;
    if (r.view.overlay === 'rests') rests++;
    movesSum += log.length; totalGames++;
  }
  // personas
  const hint = new PlayController(level, { assist: true }); let hm = 0;
  for (let i = 0; i < 400 && hint.view.overlay === 'none'; i++) { const m = suggestMove(hint.view.state, hint.view.selection); if (!m) break; if (m.selection && JSON.stringify(m.selection) !== JSON.stringify(hint.view.selection)) hint.select(m.selection); if (hint.tap(m.tile, 'touch').length) hm++; }
  const greedy = new PlayController(level, { assist: true }); let gm = 0;
  for (let i = 0; i < 400 && greedy.view.overlay === 'none'; i++) { const ms = legal(greedy.view.state); if (!ms.length) break; let best = ms[0]!, bv = -1; for (const m of ms) { const rr = applyMove(greedy.view.state, m); if (rr.ok) { const v = coverage(rr.state); if (v > bv) { bv = v; best = m; } } } greedy.play(best); gm++; }
  per.push({ id: level.id, name: level.name, games: N, randomWinPct: Math.round((100 * wins) / N), randomRestsPct: Math.round((100 * rests) / N), avgMoves: Math.round(movesSum / N), undos, hint: { result: hint.view.overlay, moves: hm, bonus: hint.view.state.bonusUsed }, greedy: { result: greedy.view.overlay, moves: gm, bonus: greedy.view.state.bonusUsed }, solution: level.solution.length });
}
const out = { totalGames, totalMoves, violations, per };
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log(`games ${totalGames}, moves ${totalMoves}, invariant violations ${violations.length}`);
for (const p of per) console.log(JSON.stringify(p));
if (violations.length) console.log(violations.slice(0, 10).join('\n'));
