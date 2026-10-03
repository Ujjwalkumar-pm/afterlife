# Afterlife v1.1 — Graphics, Animation & Teaching Spec

*3 October 2026 · Status: awaiting review · Owner: Ujjwal (director) · Builder: Claude · Builds on: `2026-10-03-afterlife-design.md` (v1, live at https://afterlife-one.vercel.app)*

## 1. Purpose and success criteria

v1 plays well but looks static: a flat dark background, flat plants that "pop" in, and growth animations cut short by hover redraws. It also teaches only through a one-line hint. v1.1 makes the diorama feel **alive** and makes the game **self-explanatory** for a first-time player. The rules, levels, audio and save format do not change.

**v1.1 is done when all of these are true:**

1. Plants sway gently and grow up from their base. Animations always finish, and hovering never interrupts them.
2. Every player action has clear visual feedback: seed pop, scrap drop with a growth ripple, harvest flight, invalid shake.
3. The scene has atmosphere: a sky gradient that warms with progress, an earth island with a shadow, and drifting particles.
4. Winning has a celebration: a colour wash, fireflies and petals, then the existing camera turn and panel.
5. A first-time player is guided through Bus Stop step by step, and a How to Play screen is reachable from the title and in-game.
6. It is smooth on a mid-range phone, still works with Reduce motion, and the initial download stays under 3 MB compressed.
7. All existing tests still pass, and the new logic has unit tests.

## 2. Decisions made

| Topic | Decision |
|---|---|
| Rendering approach | Persistent per-tile display objects updated by diff (not a full redraw), plus cached plant textures drawn once per plant, stage and bloom |
| Upgrades in scope | Living plants, satisfying feedback, atmosphere, celebration and polish (all four) |
| Teaching | A guided first level on Bus Stop plus a How to Play screen (title button and in-game `?`) |
| Unchanged | Engine rules, the 5 levels, audio, save key and format (one new field), and the Kenney sprites |

## 3. Rendering foundation

**Layers, back to front:**
1. Sky (camera background gradient)
2. Island (the earth slab under the board, with its shadow)
3. Ground tiles
4. Preview (growth-ring outline, placement fill, glow)
5. World: objects and plants sorted by isometric depth
6. Particles
7. Labels (status icons)

**Per-tile view.** Each grid tile owns a persistent view holding its ground, object and plant display objects. On every controller change the scene computes a **diff** between the previous and new state:
- ground tint changed (progress)
- object added or removed
- plant added, removed, changed stage, or bloom changed
- rotation changed, which rebuilds all positions

Only the changed tiles are updated. **The preview layer is redrawn alone on hover**, so it never touches the world layer.

**Plant textures.** A plant cell is drawn once into a texture keyed by `type`, `stage`, `bloom`, `objectHeight` and a variant seed, then shown as an image anchored at its base (origin 0.5, 1), and reused. Plant drawings come from an upgraded `plantShapes`.

**Pure logic, unit-tested:**
- `diffTiles(prev, next) → TileChange[]`
- `plantTextureKey(cell, objectHeight)`
- the animation timing helpers
- the tutorial step machine

**Phaser-specific code** (layers, tweens, particles) is checked in the browser.

## 4. Visual upgrades

### 4.1 Living plants

| Plant | New look |
|---|---|
| Moss | Layered clumps: a darker base ellipse, a mid-tone body and a highlight speck |
| Vine | Curling stems; leaves with a centre vein; on objects, strands wrap up the object |
| Flower | Leaves with a shine; a bud; on bloom, 6 petals open outward over 0.6 s |
| Bamboo | Jointed stems with node bands and leaf tufts at the top |

- **Grow:** a new stage rises from its base, `scaleY` 0.2 → 1 over 500 ms, ease `Back.Out`.
- **Spread:** the sprout unfurls, scale 0 → 1 over 450 ms, starting 150 ms after the parent's grow.
- **Sway:** each plant gets a rotation of ±(1.5° moss, 3° vine, 4° flower, 5° bamboo), a period of 2.4–3.6 s, and a phase seeded from its position. It is driven by one update loop, not one tween per plant.

### 4.2 Feedback

| Action | Animation |
|---|---|
| Place seed | Mound pops (scale 0.6 → 1, 250 ms) plus 4–6 soil specks |
| Place scrap | Drops from 40 px above with a bounce (350 ms), a dust puff, then a ripple ring expands over exactly its growth tiles (400 ms). The rules apply instantly as before; only each plant's grow *animation* is delayed until the ripple reaches its tile |
| Harvest | 6 petals burst out, then fly to the seed tray button (600 ms); the tray count bumps |
| Invalid tap | The red tile shakes horizontally (±4 px, 200 ms) |
| Meter | Fill animates (400 ms) and glows for 600 ms when it rises by 5% or more |

### 4.3 Atmosphere

- **Sky:** a vertical gradient from `#2b3036` (top) to `#3d3a33` (bottom) at 0% progress, lerping to `#3b4a3e` to `#7a6a45` (warm golden) at 100%.
- **Island:** an earth slab 22 px deep under the whole board footprint, with soil layers in three tones, and a soft ellipse shadow (alpha 0.35) underneath.
- **Particles:** 12–20 slow drifting motes. At progress below 0.5 they are grey dust; above it, pollen (pale yellow) and floating seeds.

### 4.4 Celebration and polish

- **Win:** colour wash from the winning move outwards, tile by tile (40 ms per tile step). Fireflies (14, glowing, wandering for 4 s) and drifting petals. Then the existing camera turn and the "Scene restored" panel.
- **Screen transitions:** a 250 ms fade between title, select, settings, credits, How to Play and levels.
- **Tray icons:** 32 px drawn icons (SVG inline in the HUD) for moss, vine, flower, bamboo and each scrap kind, replacing the colour dot.
- **Reduce motion:** sway, particles, drop and bounce, fly-to-tray and the wash are off; state changes appear instantly. Screen fades become instant.

## 5. Teaching

### 5.1 Guided first level (Bus Stop)

It shows when Bus Stop starts and `save.tutorialDone` is false. A hint bubble points at its target and advances only when the player does the action:

| Step | Hint | Target | Advances when |
|---|---|---|---|
| 1 | "Tap **Moss** in your tray." | Moss tray button | Moss is selected |
| 2 | "Tap a soil tile to plant it." | A pulsing suggested tile | A seed is placed |
| 3 | "Plant one more next to it." | A suggested neighbouring tile | A second seed is placed |
| 4 | "Now pick a **Tyre**." | The first tyre tray button | Scrap is selected |
| 5 | "Drop it beside your seeds — everything inside the ring grows." | A suggested tile adjacent to both seeds | Scrap is placed |
| 6 | "Keep going! Fill the meter to restore the bus stop." | The meter | Auto-hides after 4 s or on the next move |

- **Skip tutorial** is always visible. Finishing step 6 or skipping sets `tutorialDone = true` (saved).
- **Touch:** the first tap on a tile only previews it. Steps 2, 3 and 5 advance when the item is actually placed (the second tap).
- **Undo during the tutorial** does not move a step backwards. The hint simply stays on the current step.
- **Suggested tiles** are computed from the level, not hard-coded: the first open soil tile near the centre, a neighbour of it, and a scrap tile adjacent to both.

### 5.2 How to Play screen

- Reachable from a **How to Play** button on the title, the **?** button in the in-game tools, and the Settings screen.
- 5 cards, each with a small inline SVG drawing and one or two sentences:
  1. **Plant:** pick a seed in the tray, then tap a tile.
  2. **Feed:** scrap makes every plant inside its ring grow one step. Small scrap reaches 1 tile, medium 2, large 3.
  3. **Grow:** grown moss and vines spread to new tiles. Flowers bloom, so tap a bloom for a free seed. Bamboo grows tall.
  4. **Restore:** cover the scene, the scrap included, to fill the meter.
  5. **Relax:** no timer and no losing. Undo any time; rotate (◀ ▶ or Q/E) and zoom to look around.
- Buttons: **Replay tutorial** (starts Bus Stop with the tutorial) and **Back**. Opened in-game, Back returns to the level and the level state is kept.

### 5.3 Save format

The existing `afterlife.save.v1` gains `tutorialDone: boolean`, default `false`. Old saves load with `false`.

## 6. Error handling and performance

- **Particles and textures failing** (e.g. a WebGL context loss) must never block play. The world layer still renders, and errors go through the existing error panel only if play is affected.
- **Cache size:** the texture cache holds at most about 200 plant textures. Least-recently-used ones are evicted beyond that.
- **Frame budget:** 60 fps on desktop; at least 45 fps on a mid-range phone viewport with the Playground fully grown. This is checked in headless Chrome with CPU throttling ×4.
- **Download size:** no new runtime dependencies. Icons are inline SVG, particles use Phaser's built-in emitter. The initial download stays under 3 MB compressed.

## 7. Testing

| What | How |
|---|---|
| `diffTiles` | Unit tests for each change kind, plus rotation |
| Plant texture keys and the LRU cache | Unit tests |
| Animation timing helpers (ripple delay per tile, wash order) | Unit tests |
| Tutorial step machine, including skip, undo and the touch preview | Unit tests |
| Suggested tutorial tiles for Bus Stop | Unit test: valid, adjacent, and placeable per the rules |
| Save `tutorialDone` | Unit tests: default, round-trip, old save |
| How to Play and HUD `?` / icons | DOM tests (happy-dom) |
| Visuals, motion, fps, reduce motion, phone | Headless Chrome checks and screenshots of every level and every tutorial step |

## 8. Out of scope

New levels, new plants or mechanics, real-time lighting or shaders beyond Phaser's built-ins, sound changes, and a sandbox or photo mode.
