import type { Cue } from './cues';

/** Everything the game needs from audio. Tests and audio-less browsers use `silentSound`. */
export interface Sound {
  /** True once audio is running; until then the app keeps calling unlock() on gestures. */
  readonly ready: boolean;
  /** False when audio failed to load or start; the UI then shows sound as off. */
  readonly available: boolean;
  /** Called when ready/available change. */
  onChange(listener: () => void): void;
  /** Call from a user gesture; loads and starts audio. Must never throw. */
  unlock(): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  setAmbient(on: boolean): void;
  setProgress(progress: number): void;
  play(cues: Cue[]): void;
}

export const silentSound: Sound = {
  ready: true,
  available: true,
  onChange() {},
  unlock() {},
  setMuted() {},
  setVolume() {},
  setAmbient() {},
  setProgress() {},
  play() {},
};
