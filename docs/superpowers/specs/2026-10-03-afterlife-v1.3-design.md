# Afterlife v1.3 — Story, Pip & Three New Places

*3 October 2026 · Status: awaiting review · Owner: Ujjwal (director) · Builder: Claude · Builds on v1–v1.2 (live at https://afterlife-one.vercel.app)*

## 1. Goals and success criteria

1. **Story intro:** a short animated story (under 30 s) plays before a player's first game. It can be skipped at any time and replayed from the title.
2. **Pip:** a mossy little robot, introduced in the story, becomes the player's on-screen companion. Pip guides the tutorial, points at hints, cheers big moves, brings bonus packs and celebrates wins.
3. **Three new places:** Laundromat, Bus Depot and Rooftop Garden (levels 6–8), each with a twist built from existing rules.
4. **Unchanged:** the rules engine. All existing tests pass. Every new level is solver-proven and finishable by a hint-only beginner (≤ 8 bonus packs). The initial download stays under 3 MB gz, and Reduce motion is respected throughout.

## 2. Story intro

| Beat | Duration | Caption | Visual (inline SVG + CSS animation) |
|---|---|---|---|
| 1 | 5 s | "The city went quiet." | Grey skyline, slow diagonal rain |
| 2 | 5 s | "People left. The machines fell asleep." | Pip slumped among crates and tyres; eyes dim |
| 3 | 5 s | "Years later, the wind carried a seed." | A glowing seed drifts in on a curve and lands by Pip |
| 4 | 5 s | "Something woke up… and remembered how to grow." | Pip's eyes light, a sprout rises in Pip's hands |
| 5 | 5 s | "Bring life back, one place at a time." | "Afterlife" title fades in, then a "Tap to begin" button |

- **Length:** 25 s in total. The sky warms from beat 3 onwards, and a soft swell plays at beat 5 (the existing `milestone` cue).
- **When it plays:**
  - Pressing **Play** on the title shows it the first time (when `save.storySeen` is false), then goes on to level select.
  - **Skip** (always visible) and **Tap to begin** both set `storySeen = true`.
  - A **Story** button on the title replays it and returns to the title afterwards.
- **Beat 5 waits:** the story stays on beat 5 until the player taps **Tap to begin** or **Skip**. **Esc** also skips.
- **Reduce motion:** beats switch instantly and nothing moves (no rain, no seed flight, no fades), and timings stay the same.
- **Built as an HTML/SVG overlay** (no Phaser, no assets): the caption is an `aria-live` region and Skip is a real button.

## 3. Pip, the companion

- **Look:** an inline SVG (64×64): a rounded grey-green body with moss patches, a round head with two glowing eyes, an antenna ending in a sprout leaf, and stubby arms.
- **Placement:** in the game Pip sits at the bottom-left above the tray, with a speech bubble.
- **Moods:** `idle` (gentle bob and blink), `point`, `cheer` (hop), `wave` (arm wave) and `sleep` (dim eyes, used only in the story).
- **`pipFor(events, view, ctx)`** (pure) picks the mood and line. The first matching rule wins:
  1. Overlay `restored` → wave, "We did it! Look at it bloom."
  2. Overlay `rests` → idle, "Let's undo a little and try again."
  3. Tutorial active → point, with no bubble line (the tutorial coach box already says the step, so Pip doesn't repeat it)
  4. A `bonus` event → cheer, "Here — more seeds and a tyre!"
  5. A combo → cheer, with the combo label ("Lush!", …)
  6. A milestone crossed → cheer, "The place is waking up!"
  7. Hint shown → point, "Try the glowing spot!"
  8. Otherwise → idle, no line
- **Line timing:** lines stay for 2.5 s, then Pip returns to its resting mood (`point` during the tutorial, otherwise `idle`). A rule with no line only changes the resting mood and never cuts a shown line short.
- **Built as its own element** next to the HUD, not inside the HUD markup, so HUD redraws don't restart Pip's animation. It never takes taps (`pointer-events: none`), and the bubble is a polite live region.
- **Reduce motion:** no bob, hop or wave animation; Pip and the lines still show.

## 4. New places

| # | Place | Size | Twist | Seeds | Target |
|---|---|---|---|---|---|
| 6 | **Laundromat** | 7×7 tiled floor, soil centre | Flower power: no moss. Blooms harvest into **vine** seeds | flower 5, vine 5 | 0.5 |
| 7 | **Bus Depot** | 9×6 with 6 blocked bays | Two old buses in narrow lanes; bamboo for tight spots | bamboo 4, moss 5, vine 3 | 0.5 |
| 8 | **Rooftop Garden** (finale) | 8×8 with a 2×2 skylight hole | All four plants, six ruins. Blooms harvest into **moss** | moss 4, vine 3, flower 2, bamboo 2 | 0.6 |

- **New ruins:** `washer` and `dryer` (Kenney furniture-kit sprites, with code-drawn fallbacks), plus code-drawn `laundry-cart`, `old-bus`, `planter` and `chimney`. Rooftop Garden also reuses `water-tank` and `ac-unit`.
- **Tuning:** if a level fails the solver or the hint-only beginner test, its numbers are tuned (more seeds or batches, or the target lowered in 0.05 steps, never below 0.45) and recorded.
- **Unlocking:** levels unlock in order after Playground, which now leads to "Next place".
- **Landing page:** now says "Eight quiet places" and lists the new names.

## 5. Save

`afterlife.save.v1` gains `storySeen: boolean`, default false. Old saves load as false, so returning players see the story once.

## 6. Testing

- **Pure, unit-tested:** story beats (5 beats, total < 30 s, captions as listed), `pipFor` rules and priority, and save `storySeen`.
- **DOM tests:**
  - **Story:** advance and skip with fake timers; first Play shows the story, a second Play doesn't; the title Story button replays it.
  - **HUD:** Pip renders with its mood class and line, and lines expire in place.
- **Level tests:** 8 level ids in order, solvability, the hint-only beginner test (automatic for all levels) and sprite-manifest coverage (13 objects).
- **Browser:**
  - **Story:** desktop and phone screenshots of every beat, plus Skip.
  - **Pip:** tutorial, combo, bonus and win moments.
  - **Levels:** each new level at start and when finished.
  - **Reduce motion,** with no console errors.

## 7. Out of scope

Voice narration, multiple characters, a story between levels, and new plant types or rules.

## 8. Tuning record (3 Oct 2026, measured before the plan)

| Place | First draft | Problem | Final |
|---|---|---|---|
| Laundromat | flower 4, vine 3 | Hint-only beginner needed 12 bonus packs (limit 8) | flower 5, vine 5: 6 packs, solver 24 moves |
| Bus Depot | 8 single-tile bays, moss 4, vine 2 | Beginner reached "The garden rests" at 87% | 6 bays, moss 5, vine 3: 2 packs, solver 21 moves |
| Rooftop Garden | as listed | Solver needs beam 150 (beam 40 tops out at 52%) | unchanged: 6 packs, solver 27 moves at beam 150 |
