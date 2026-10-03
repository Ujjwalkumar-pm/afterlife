import type { GameEvent } from '../engine';
import type { Overlay } from './controller';
import { comboFor } from './scoring';

export type PipMood = 'idle' | 'point' | 'cheer' | 'wave' | 'sleep';
export interface PipSay {
  mood: PipMood;
  line: string | null;
}
export interface PipContext {
  /** The overlay that appeared with this change, or 'none'. */
  newOverlay: Overlay;
  tutorial: boolean;
  events: GameEvent[];
  milestone: boolean;
  hint: boolean;
}

/** What Pip does and says about a change. The first matching rule wins. */
export function pipFor(c: PipContext): PipSay {
  if (c.newOverlay === 'restored') return { mood: 'wave', line: 'We did it! Look at it bloom.' };
  if (c.newOverlay === 'rests') return { mood: 'idle', line: "Let's undo a little and try again." };
  if (c.tutorial) return { mood: 'point', line: null };
  if (c.events.some((e) => e.type === 'bonus')) return { mood: 'cheer', line: 'Here — more seeds and a tyre!' };
  const combo = comboFor(c.events);
  if (combo) return { mood: 'cheer', line: combo.label };
  if (c.milestone) return { mood: 'cheer', line: 'The place is waking up!' };
  if (c.hint) return { mood: 'point', line: 'Try the glowing spot!' };
  return { mood: 'idle', line: null };
}
