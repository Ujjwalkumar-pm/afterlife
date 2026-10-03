import type * as ToneNS from 'tone';
import { ambientParams, volumeToDb, type Cue } from './cues';
import type { Sound } from './sound';

type Tone = typeof ToneNS;
interface Nodes {
  pad: ToneNS.PolySynth;
  padFilter: ToneNS.Filter;
  wind: ToneNS.Noise;
  bell: ToneNS.PolySynth;
  pluck: ToneNS.PolySynth;
  thud: ToneNS.MembraneSynth;
  rustle: ToneNS.NoiseSynth;
  loop: ToneNS.Loop;
}

const CHORDS = [
  ['C3', 'G3', 'E4', 'B4'],
  ['A2', 'E3', 'C4', 'G4'],
  ['F2', 'C3', 'A3', 'E4'],
  ['G2', 'D3', 'B3', 'D5'],
];
const BELLS = ['E5', 'G5', 'B5', 'D6', 'C6'];
const GROW = ['C5', 'E5', 'G5', 'A5'];

/** Generative soundtrack and effects, synthesized with Tone.js. Loaded on the first user gesture. */
export class ToneSound implements Sound {
  private tone: Tone | null = null;
  private nodes: Nodes | null = null;
  private loading = false;
  private muted = false;
  private volume = 0.8;
  private progress = 0;
  private ambientOn = false;
  private playing = false;
  private failed = false;
  private lastStart = 0;
  private listeners: (() => void)[] = [];

  get contextState(): string {
    return this.tone ? this.tone.getContext().state : 'locked';
  }

  get ready(): boolean {
    return this.contextState === 'running';
  }

  get available(): boolean {
    return !this.failed;
  }

  onChange(listener: () => void): void {
    this.listeners.push(listener);
  }

  /** Safe to call on every gesture: loads Tone once, retries after a failure, resumes a suspended context. */
  unlock(): void {
    const T = this.tone;
    if (T) {
      if (T.getContext().state !== 'running') T.start().then(() => this.notify(), () => undefined);
      return;
    }
    if (this.loading) return;
    this.loading = true;
    import('tone')
      .then(async (Tone) => {
        this.tone = Tone;
        this.nodes = this.build(Tone);
        this.failed = false;
        this.applyVolume();
        this.applyProgress();
        this.applyAmbient();
        await Tone.start();
        this.notify();
      })
      .catch((err: unknown) => {
        this.loading = false;
        this.failed = true;
        console.warn('[Afterlife] audio unavailable', err);
        this.notify();
      });
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
    this.applyAmbient();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.applyVolume();
  }

  setAmbient(on: boolean): void {
    this.ambientOn = on;
    this.applyAmbient();
  }

  setProgress(progress: number): void {
    this.progress = progress;
    this.applyProgress();
  }

  play(cues: Cue[]): void {
    const T = this.tone;
    const n = this.nodes;
    if (!T || !n || this.muted) return;
    // Tone throws if a monophonic synth is retriggered at the same instant (fast moves),
    // so every cue starts strictly after the previous one.
    const now = Math.max(T.now(), this.lastStart + 0.03);
    if (now - T.now() > 1.5) return; // a burst of moves: drop cues rather than queue sound far ahead
    this.lastStart = now + 0.5;
    let grow = 0;
    for (const cue of cues) {
      switch (cue) {
        case 'seed':
          n.pluck.triggerAttackRelease('G4', '16n', now);
          break;
        case 'scrap':
          n.thud.triggerAttackRelease('C2', '8n', now);
          n.rustle.triggerAttackRelease('16n', now + 0.02);
          break;
        case 'grow':
          n.pluck.triggerAttackRelease(GROW[grow % GROW.length]!, '32n', now + 0.08 + grow * 0.07);
          grow += 1;
          break;
        case 'spread':
          n.rustle.triggerAttackRelease('8n', now + 0.1);
          break;
        case 'bloom':
          n.bell.triggerAttackRelease('E6', '16n', now + 0.15);
          break;
        case 'harvest':
          n.bell.triggerAttackRelease(['G5', 'C6'], '8n', now);
          break;
        case 'newBatch':
          n.pluck.triggerAttackRelease(['C4', 'G4'], '16n', now);
          break;
        case 'won':
          n.pad.triggerAttackRelease(['C3', 'G3', 'E4', 'G4', 'C5'], '2m', now);
          n.bell.triggerAttackRelease(['E5', 'G5', 'C6'], '4n', now + 0.4);
          break;
        case 'rests':
          n.pad.triggerAttackRelease(['A2', 'E3', 'C4'], '1m', now);
          break;
      }
    }
  }

  private build(T: Tone): Nodes {
    const reverb = new T.Reverb({ decay: 6, wet: 0.45 }).toDestination();
    const padFilter = new T.Filter(800, 'lowpass').connect(reverb);
    const pad = new T.PolySynth(T.AMSynth, { volume: -24, envelope: { attack: 3, release: 6 } }).connect(padFilter);
    const windFilter = new T.AutoFilter({ frequency: 0.07, baseFrequency: 300, octaves: 3 }).connect(reverb).start();
    const wind = new T.Noise('pink').connect(windFilter);
    wind.volume.value = -26;
    const bell = new T.PolySynth(T.FMSynth, { volume: -22, envelope: { attack: 0.01, decay: 1.5, sustain: 0, release: 2 } }).connect(reverb);
    const pluck = new T.PolySynth(T.Synth, {
      volume: -14,
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.4 },
    }).connect(reverb);
    const thud = new T.MembraneSynth({ volume: -12, pitchDecay: 0.05, octaves: 3, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } }).toDestination();
    const rustle = new T.NoiseSynth({ volume: -24, noise: { type: 'brown' }, envelope: { attack: 0.01, decay: 0.25, sustain: 0 } }).connect(reverb);
    let bar = 0;
    const loop = new T.Loop((time) => {
      pad.triggerAttackRelease(CHORDS[bar % CHORDS.length]!, '1m', time);
      if (ambientParams(this.progress).bells) bell.triggerAttackRelease(BELLS[bar % BELLS.length]!, '8n', time + T.Time('2n').toSeconds());
      bar += 1;
    }, '2m');
    T.getTransport().bpm.value = 60;
    return { pad, padFilter, wind, bell, pluck, thud, rustle, loop };
  }

  private applyVolume(): void {
    if (!this.tone) return;
    const dest = this.tone.getDestination();
    // Tone mutes by setting the volume to -Infinity, so writing the volume afterwards would unmute.
    if (this.muted || this.volume <= 0) {
      dest.mute = true;
      return;
    }
    dest.mute = false;
    dest.volume.value = volumeToDb(this.volume);
  }

  private applyProgress(): void {
    const n = this.nodes;
    if (!n) return;
    const a = ambientParams(this.progress);
    n.padFilter.frequency.rampTo(a.cutoff, 2);
    n.pad.volume.rampTo(a.padDb, 2);
    n.wind.volume.rampTo(a.windDb, 2);
  }

  private applyAmbient(): void {
    const T = this.tone;
    const n = this.nodes;
    if (!T || !n) return;
    const want = this.ambientOn && !this.muted;
    if (want === this.playing) return;
    this.playing = want;
    if (want) {
      n.wind.start();
      n.loop.start(0);
      T.getTransport().start();
    } else {
      n.wind.stop();
      n.loop.stop();
      T.getTransport().stop();
    }
  }
}
