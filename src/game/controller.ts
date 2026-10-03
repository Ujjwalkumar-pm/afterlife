import {
  canBonus,
  coverage,
  isStuck,
  PLANT_TYPES,
  placeScrap,
  placeSeed,
  previewScrap,
  RADIUS,
  SCRAP,
  Session,
  type GameEvent,
  type GameState,
  type LevelData,
  type Move,
  type PlantType,
  type Pos,
} from '../engine';
import type { Rotation } from '../render/iso/projection';

export type Selection = { kind: 'seed'; plant: PlantType } | { kind: 'scrap'; slot: number } | null;
export interface Preview {
  tile: Pos;
  valid: boolean;
  ring: Pos[];
  glowing: Pos[];
}
export type Overlay = 'none' | 'restored' | 'rests';
export type InputKind = 'mouse' | 'touch';
export interface View {
  state: GameState;
  selection: Selection;
  preview: Preview | null;
  rotation: Rotation;
  overlay: Overlay;
  canUndo: boolean;
  coverage: number;
  progress: number;
}
type Listener = (view: View, events: GameEvent[]) => void;
export interface ControllerOptions {
  /** Preselect the first available item and switch automatically when it runs out (v1.2). */
  assist?: boolean;
}

const samePos = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
const inGrid = (s: GameState, p: Pos) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < s.width && p.y < s.height;

/** Turns player input into engine moves and decides what the screen should show. No rendering here. */
export class PlayController {
  private readonly session: Session;
  private selection: Selection = null;
  private preview: Preview | null = null;
  private rotation: Rotation = 0;
  private overlay: Overlay = 'none';
  private listeners: Listener[] = [];

  private readonly assist: boolean;

  constructor(readonly level: LevelData, opts: ControllerOptions = {}) {
    this.session = new Session(level);
    this.assist = opts.assist ?? false;
    if (this.assist) this.selection = this.firstAvailable();
  }

  private firstAvailable(): Selection {
    const s = this.session.state;
    const plant = PLANT_TYPES.find((t) => s.seeds[t] > 0);
    if (plant) return { kind: 'seed', plant };
    return s.tray.length > 0 ? { kind: 'scrap', slot: 0 } : null;
  }

  get view(): View {
    const state = this.session.state;
    const c = coverage(state);
    return {
      state,
      selection: this.selection,
      preview: this.preview,
      rotation: this.rotation,
      overlay: this.overlay,
      canUndo: this.session.canUndo,
      coverage: c,
      progress: Math.min(1, c / state.target),
    };
  }

  onChange(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  select(sel: Selection): void {
    const s = this.session.state;
    if (sel?.kind === 'seed' && !(s.seeds[sel.plant] > 0)) return;
    if (sel?.kind === 'scrap' && s.tray[sel.slot] === undefined) return;
    const same = sel !== null && JSON.stringify(sel) === JSON.stringify(this.selection);
    this.selection = same ? null : sel;
    this.refreshPreview();
    this.emit([]);
  }

  hover(tile: Pos | null): void {
    const next = tile ? this.computePreview(tile) : null;
    if (JSON.stringify(next) === JSON.stringify(this.preview)) return;
    this.preview = next;
    this.emit([]);
  }

  tap(tile: Pos, _input: InputKind): GameEvent[] {
    if (this.overlay !== 'none') return [];
    const s = this.session.state;
    if (!inGrid(s, tile)) return [];
    if (s.tiles[tile.y * s.width + tile.x]!.plant?.bloom) return this.play({ type: 'harvest', ...tile });
    const sel = this.selection;
    if (!sel) return [];
    return this.play(sel.kind === 'seed' ? { type: 'seed', plant: sel.plant, ...tile } : { type: 'scrap', slot: sel.slot, ...tile });
  }

  /** Applies a move directly (taps, the title-screen demo and solution replays use this). */
  play(move: Move): GameEvent[] {
    const wasStuck = isStuck(this.session.state);
    const result = this.session.apply(move);
    if (!result.ok) return [];
    const events = [...result.events];
    if (canBonus(this.session.state)) {
      const bonus = this.session.apply({ type: 'bonus' });
      if (bonus.ok) events.push(...bonus.events);
    }
    this.settleSelection();
    if (events.some((e) => e.type === 'won')) this.overlay = 'restored';
    else if (!wasStuck && isStuck(this.session.state)) this.overlay = 'rests';
    this.refreshPreview();
    this.emit(events);
    return events;
  }

  undo(): void {
    if (!this.session.undo()) return;
    // A bonus is granted automatically after a move, so undo the move that triggered it too.
    if (canBonus(this.session.state)) this.session.undo();
    this.overlay = 'none';
    this.settleSelection();
    this.refreshPreview();
    this.emit([]);
  }

  restart(): void {
    this.session.restart();
    this.selection = this.assist ? this.firstAvailable() : null;
    this.preview = null;
    this.overlay = 'none';
    this.emit([]);
  }

  rotate(dir: 1 | -1): void {
    this.rotation = ((this.rotation + dir + 4) % 4) as Rotation;
    this.preview = null;
    this.emit([]);
  }

  keepDecorating(): void {
    if (this.overlay !== 'restored') return;
    this.overlay = 'none';
    this.emit([]);
  }

  private settleSelection(): void {
    const s = this.session.state;
    const sel = this.selection;
    if (sel?.kind === 'seed' && !(s.seeds[sel.plant] > 0)) this.selection = this.assist ? this.firstAvailable() : null;
    if (sel?.kind === 'scrap') {
      if (s.tray.length > 0) this.selection = { kind: 'scrap', slot: Math.min(sel.slot, s.tray.length - 1) };
      else this.selection = this.assist ? this.firstAvailable() : null;
    }
  }

  private refreshPreview(): void {
    this.preview = this.preview ? this.computePreview(this.preview.tile) : null;
  }

  private computePreview(tile: Pos): Preview | null {
    const s = this.session.state;
    const sel = this.selection;
    if (!sel || !inGrid(s, tile)) return null;
    if (sel.kind === 'seed') return { tile, valid: placeSeed(s, sel.plant, tile).ok, ring: [], glowing: [] };
    const kind = s.tray[sel.slot];
    if (kind === undefined) return null;
    const radius = RADIUS[SCRAP[kind].size];
    const ring: Pos[] = [];
    for (let y = 0; y < s.height; y++) {
      for (let x = 0; x < s.width; x++) {
        if (Math.abs(x - tile.x) + Math.abs(y - tile.y) <= radius && s.tiles[y * s.width + x]!.ground !== 'blocked') ring.push({ x, y });
      }
    }
    const valid = placeScrap(s, sel.slot, tile).ok;
    return { tile, valid, ring, glowing: valid ? previewScrap(s, sel.slot, tile) : [] };
  }

  private emit(events: GameEvent[]): void {
    const view = this.view;
    for (const l of this.listeners) l(view, events);
  }
}
