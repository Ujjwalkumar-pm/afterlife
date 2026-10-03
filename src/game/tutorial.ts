import { createInitialState, placeScrap, placeSeed, type GameEvent, type LevelData, type Pos } from '../engine';
import type { View } from './controller';

export type CoachTarget = 'seed-moss' | 'scrap' | 'tile' | 'meter';
export interface CoachStep {
  step: number;
  total: number;
  text: string;
  target: CoachTarget;
}
export interface TutorialPlan {
  seed1: Pos;
  seed2: Pos;
  scrap: Pos;
}

export const TUTORIAL_STEPS: { text: string; target: CoachTarget }[] = [
  { text: 'Tap Moss in your tray.', target: 'seed-moss' },
  { text: 'Tap a soil tile to plant it.', target: 'tile' },
  { text: 'Plant one more next to it.', target: 'tile' },
  { text: 'Now pick a Tyre.', target: 'scrap' },
  { text: 'Drop it beside your seeds — everything inside the ring grows.', target: 'tile' },
  { text: 'Keep going! Fill the meter to restore the bus stop.', target: 'meter' },
];

/** Suggested tiles near the centre: two diagonal seeds and a scrap tile touching both. */
export function planTutorial(level: LevelData): TutorialPlan {
  const s = createInitialState(level);
  const cx = (s.width - 1) / 2;
  const cy = (s.height - 1) / 2;
  const tiles: Pos[] = [];
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) tiles.push({ x, y });
  tiles.sort((a, b) => Math.abs(a.x - cx) + Math.abs(a.y - cy) - (Math.abs(b.x - cx) + Math.abs(b.y - cy)) || a.y - b.y || a.x - b.x);
  const bare = (st: typeof s, p: Pos) => st.tiles[p.y * st.width + p.x]?.object === null;
  for (const a of tiles) {
    const r1 = placeSeed(s, 'moss', a);
    if (!r1.ok || !bare(s, a)) continue;
    for (const b of [{ x: a.x + 1, y: a.y + 1 }, { x: a.x - 1, y: a.y + 1 }, { x: a.x + 1, y: a.y - 1 }, { x: a.x - 1, y: a.y - 1 }]) {
      const r2 = placeSeed(r1.state, 'moss', b);
      if (!r2.ok || !bare(s, b)) continue;
      for (const c of [{ x: b.x, y: a.y }, { x: a.x, y: b.y }]) {
        if (placeScrap(r2.state, 0, c).ok) return { seed1: a, seed2: b, scrap: c };
      }
    }
  }
  throw new Error(`no tutorial layout for ${level.id}`);
}

/** Step machine built on facts that only ever accumulate, so undo can't move it backwards. */
export class Tutorial {
  private mossSelected = false;
  private seeds = 0;
  private scrapSelected = false;
  private scrapPlaced = false;
  private ended = false;

  constructor(readonly plan: TutorialPlan) {}

  get step(): number {
    if (this.scrapPlaced) return 6;
    if (this.seeds >= 2) return this.scrapSelected ? 5 : 4;
    if (this.seeds === 1) return 3;
    return this.mossSelected ? 2 : 1;
  }

  get done(): boolean {
    return this.ended;
  }

  get current(): CoachStep | null {
    if (this.ended) return null;
    const step = this.step;
    return { step, total: TUTORIAL_STEPS.length, ...TUTORIAL_STEPS[step - 1]! };
  }

  get highlight(): Pos | null {
    if (this.ended) return null;
    switch (this.step) {
      case 2:
        return this.plan.seed1;
      case 3:
        return this.plan.seed2;
      case 5:
        return this.plan.scrap;
      default:
        return null;
    }
  }

  update(view: View, events: GameEvent[]): void {
    if (this.ended) return;
    const before = this.step;
    if (view.selection?.kind === 'seed' && view.selection.plant === 'moss') this.mossSelected = true;
    if (view.selection?.kind === 'scrap') this.scrapSelected = true;
    for (const e of events) {
      if (e.type === 'placedSeed') this.seeds += 1;
      if (e.type === 'placedScrap') this.scrapPlaced = true;
    }
    const moved = events.some((e) => e.type === 'placedSeed' || e.type === 'placedScrap' || e.type === 'harvested');
    if (before === 6 && moved) this.ended = true;
  }

  finish(): void {
    this.ended = true;
  }
}
