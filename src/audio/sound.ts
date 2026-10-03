import type { Cue } from './cues';

/** Everything the game needs from audio. Tests and audio-less browsers use `silentSound`. */
export interface Sound {
  /** Call from a user gesture; loads and starts audio. Must never throw. */
  unlock(): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  setAmbient(on: boolean): void;
  setProgress(progress: number): void;
  play(cues: Cue[]): void;
}

export const silentSound: Sound = {
  unlock() {},
  setMuted() {},
  setVolume() {},
  setAmbient() {},
  setProgress() {},
  play() {},
};
