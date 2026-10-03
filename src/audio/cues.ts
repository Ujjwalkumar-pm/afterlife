import type { GameEvent } from '../engine';

export type Cue = 'seed' | 'scrap' | 'grow' | 'spread' | 'bloom' | 'harvest' | 'newBatch' | 'won' | 'rests';

const MAX_GROW_NOTES = 3;

/** Sounds for one move's events. Growth is thinned so a big move sounds like a flourish, not noise. */
export function cuesFor(events: GameEvent[]): Cue[] {
  const out: Cue[] = [];
  let grows = 0;
  const once = (c: Cue) => {
    if (!out.includes(c)) out.push(c);
  };
  for (const e of events) {
    switch (e.type) {
      case 'placedSeed':
        out.push('seed');
        break;
      case 'placedScrap':
        out.push('scrap');
        break;
      case 'grew':
        if (grows++ < MAX_GROW_NOTES) out.push('grow');
        break;
      case 'spread':
        once('spread');
        break;
      case 'bloomed':
        once('bloom');
        break;
      case 'harvested':
        out.push('harvest');
        break;
      case 'newBatch':
        out.push('newBatch');
        break;
      default:
        break;
    }
  }
  return out;
}

export interface AmbientParams {
  /** Low-pass cutoff on the pad, Hz. */
  cutoff: number;
  padDb: number;
  windDb: number;
  /** Whether the soft bell layer plays. */
  bells: boolean;
}

/** The soundtrack blooms with the garden: brighter, fuller pad, less wind, bells past halfway. */
export function ambientParams(progress: number): AmbientParams {
  const p = Math.max(0, Math.min(1, progress));
  return {
    cutoff: Math.round(400 + p * 2600),
    padDb: -30 + p * 12,
    windDb: -24 - p * 10,
    bells: p >= 0.5,
  };
}

export function volumeToDb(v: number): number {
  return v <= 0 ? -Infinity : 20 * Math.log10(v);
}
