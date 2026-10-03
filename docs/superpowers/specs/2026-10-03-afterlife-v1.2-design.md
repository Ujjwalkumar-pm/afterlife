# Afterlife v1.2 — Easy & Exciting Spec

*3 October 2026 · Status: awaiting review · Owner: Ujjwal (director) · Builder: Claude · Builds on: v1 (`2026-10-03-afterlife-design.md`) and v1.1 (`2026-10-03-afterlife-v1.1-design.md`), live at https://afterlife-one.vercel.app*

## 1. Purpose and success criteria

A first-time player should start playing within seconds without reading anything, never get stuck or confused, and feel frequent rewarding moments. The calm spirit stays: no timers and no fail screens.

**v1.2 is done when all of these are true:**

1. A new player's first tap on the board plants something (Moss is preselected), on any device.
2. One tap on a tile places the selected item, on touch as well as mouse.
3. After 3 s without a move, the best tile for the selected item glows.
4. Every level can always be finished. Running out of scrap gives a bonus crate instead of a dead end.
5. Big moves celebrate (combo bursts), progress milestones are felt (25/50/75%), and each win awards 1–3 stars, with the best saved.
6. Animations are about 30% faster than v1.1.
7. All existing tests still pass, the new logic has unit tests, and the Bus Stop and Rooftop solutions are re-proven.

## 2. Decisions

| Topic | Decision |
|---|---|
| Placement | One tap places, on mouse and touch. The two-tap touch preview is removed. The desktop hover preview stays |
| Default selection | Moss (or the first plant type with seeds) is selected when a level starts. When the selected item runs out, the selection moves to the next available item: seeds in tray order, then scrap slot 0 |
| Hint | After 3 s idle, `bestTile(state, selection)` glows using the highlight. The tutorial highlight takes priority. Any input resets the timer |
| No dead ends | A new engine move, `bonus`: allowed only when the tray and batches are empty and the level is not won. It puts `['crate']` in the tray and counts `bonusUsed += 1` |
| Gentler start | Bus Stop and Rooftop: target 0.6 → 0.5 and moss +2. Solutions are regenerated with the solver |
| Combo | Size = number of `grew` + `spread` events from one scrap placement. 4–6 "Nice!", 7–10 "Lush!", 11+ "Wild!" |
| Stars | 3★: won, `bonusUsed = 0`, and leftover scrap ≥ 25% of the level's total. 2★: won with `bonusUsed = 0`. 1★: won with a bonus |
| Milestones | Every upward crossing of 25%, 50% or 75% of `progress` triggers a flash ring, birds and a swell. Undoing below a mark and re-crossing it replays the moment, by design |
| Pacing | All animation timings in one `timing.ts` module, at about 0.7× v1.1 |

## 3. Rules detail

### 3.1 Bonus crate (engine)

- `GameState` gains `bonusUsed: number` (0 at start).
- `Move` gains `{ type: 'bonus' }`. `applyMove` rejects it with `'bonus not available'` unless the state is not won, the tray is empty and the batches are empty.
- On success: `tray = ['crate']`, `bonusUsed + 1`, and the event `{ type: 'bonus' }` is emitted.
- **Stuck changes:** `isStuck` is true only when no tile is free (unblocked, with no object and no plant). The old "no scrap left" case becomes "bonus available" (`canBonus(state)`).
- **The controller** applies `bonus` automatically, right after a move leaves the tray and batches empty with the level not won. The HUD shows a short "Bonus crate!" sparkle on the tray.

### 3.2 Best-tile hint (pure)

`bestTile(state, selection): Pos | null`. All candidate tiles are scanned in row-major order and ties are broken by first found.

- **Scrap:** among tiles where `placeScrap` is valid, the one maximising `(new covered tiles after the move, then plant cells within radius)`.
- **Seed:** among tiles where `placeSeed` is valid, the one maximising `(number of plant cells within Manhattan 2, then closeness to the board centre)`.
- **No selection, or no valid tile:** `null`.

### 3.3 Stars (pure)

```
starsFor(level, finalState) -> 1 | 2 | 3
total = number of scrap items across all of the level's batches
left  = tray length + items in the remaining batches
```

- **1★** if `finalState.bonusUsed > 0`.
- **3★** if `left / total ≥ 0.25`.
- **2★** otherwise.

Stars are computed when the `won` event fires. The save gains `stars: Record<levelId, 1 | 2 | 3>` and keeps the maximum.

### 3.4 Combo and milestones (pure)

- `comboFor(events) → { size: number; label: 'Nice!' | 'Lush!' | 'Wild!' } | null`. Only events that contain `placedScrap` count. Size is the number of `grew` + `spread` events. It returns null below 4.
- `milestonesCrossed(prevProgress, nextProgress) → (25 | 50 | 75)[]`: each threshold `t` with `prev < t/100 ≤ next`.

## 4. Presentation

- **Combo:** floating text rises 40 px from the scrap tile and fades over 900 ms (larger for "Wild!"). The particle burst count scales with size (8 + size). The combo sound cue `combo` plays a short arpeggio whose top note rises with the size bucket.
- **Milestone:** a light ring expands from the board centre (500 ms); 3–5 birds (a drawn V shape) fly across the sky in 2 s; a sound cue `milestone` plays. The meter gets tick marks at 25, 50 and 75%.
- **Stars:** on the win panel, three star icons fill in one by one (150 ms apart). The level cards show the best stars (☆/★).
- **Bonus:** a sparkle burst over the tray and a "Bonus crate!" toast for 1.5 s; sound cue `bonus`.
- **Reduce motion:** no floating text motion (the text shows and hides), no birds or rings, and instant star fill.

## 5. Pacing (`src/render/scene/timing.ts`)

| | v1.1 | v1.2 |
|---|---|---|
| Grow | 500 | 350 |
| Sprout (+delay) | 450 (+150) | 320 (+100) |
| Bloom open | 600 | 420 |
| Seed pop | 250 | 180 |
| Scrap drop | 350 | 250 |
| Ripple | 400 | 280 |
| Grow lag after drop | 350 | 250 |
| Harvest flight | 150 + 450 | 110 + 310 |
| Wash step | 40 | 28 |
| Camera turn step | 450 | 350 |

## 6. Teaching updates

- **Tutorial texts** stay as they are, except step 2, which becomes "Tap a glowing tile to plant." Moss is preselected, so the tutorial opens directly on step 2. Step 1 ("Tap Moss in your tray.") only appears if the player deselects Moss before planting.
- **How to Play card 1** becomes "Tap a tile to plant. Your seed is already picked."
- **Card 5** adds "Stuck? Wait a moment — the best tile glows."

## 7. Testing

| What | How |
|---|---|
| Bonus move, `canBonus`, the new `isStuck` | Engine unit tests; all 5 level solutions still pass |
| Gentler levels | Solver regenerates both levels; the solvability tests pass |
| `bestTile`, `comboFor`, `starsFor`, `milestonesCrossed` | Unit tests |
| Controller: one tap, default selection, auto-switch, auto-bonus | Unit tests |
| Save `stars` | Unit tests (default `{}`, max kept, old saves load) |
| HUD stars, ticks, bonus toast; App hint timer and star save | DOM tests |
| Visuals, pacing, phone and reduce motion | Headless Chrome checks; live check after release |

## 8. Out of scope

New levels, leaderboards and accounts, daily challenges, a timer mode, and new plant types.
