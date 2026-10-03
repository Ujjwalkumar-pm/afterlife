# Afterlife v1.4: Sharp board, easy turning, earned hints, clear scrap

*3 October 2026 · Owner: Ujjwal (director) · Builder: Claude · From Ujjwal's screenshots: "Fix these UI issues: blurriness, easy to rotate, hint feature while playing, lock it for 3; as you use it, it impacts overall stars; scrap must be represented in the UI; text alignment and design"*

## 1. Sharp board (blurriness)
- **Cause:** the game canvas is drawn at 1 pixel per CSS pixel, so on Retina and phone screens (2×–3×) the browser stretches it and softens it. Plant textures are cached at 2×, and on-board text is rasterised at 1×, then zoomed by the camera.
- **Fix:**
  - The canvas renders at the device pixel ratio, capped at 2 (`renderScale`), and is displayed at CSS size. The camera zoom, layout margins and the fly-to-tray mapping account for that ratio.
  - Plant textures are cached at 3×.
  - On-board text (status marks, combo text) renders at 3× resolution.

## 2. Easy to rotate
- **Swipe the board sideways to turn it** (a quarter turn per swipe), with mouse drag or one finger. A swipe needs ≥ 48 CSS px of horizontal travel and must be mostly horizontal (|dx| > 1.5·|dy|). It never counts as a tap, so it never places anything.
- The rotate buttons use curved-arrow icons (turn left, turn right) instead of chevrons, which looked like "back/next".
- Q/E keys still work. How to Play card 5 mentions swiping.

## 3. Hints: on demand, 3 per place, they cost stars
- **A Hint button** (light-bulb icon, labelled "Hint, N left") in the tool dock. Each press:
  - shows the best move: it switches the tray to the right item and the tile glows;
  - makes Pip say "Try the glowing spot!";
  - uses one of **3 hints per place**.
- At 0 hints the button is disabled ("No hints left"). Hints reset when the place is restarted or started again. Undo doesn't give hints back.
- **The automatic idle hint is removed** (outside the tutorial). Instead, after 8 s without a move, Pip says "Stuck? Tap the bulb for a hint." and the bulb pulses. This reveals nothing and costs nothing.
- **Stars:**
  - The v1.2 rules still give the base result: 3★ for no bonus and ≥ 25% scrap left; 2★ for no bonus; 1★ when a bonus was used.
  - Hints then cap it: with 1 hint used the most is 2★, with 2 or more hints the most is 1★.
  - The win panel shows "Hints used: N of 3" whenever N > 0.
- The tutorial (Bus Stop, first time) keeps its free guided highlights and does not count as hints.
- The hint logic (`suggestMove`) is unchanged. Its regression test now states what it proves: following the suggestions always leads to a win.

## 4. Scrap is clearly shown
- Each scrap chip shows its icon, its name and a **reach badge**: a ring icon plus "1", "2" or "3", with the tooltip and accessible text "reaches N tiles".
- After the scrap chips, a faded **"Next"** group shows the icons of the next batch, so the player can plan ahead. It is hidden on phones narrower than 600 px.

## 5. Text alignment and design
- **Tray chips:** icons, names, counts and badges are vertically centred on one baseline, with a consistent 6 px gap. Seed counts and reach badges use the same pill style.
- **Hint, coach, toast and panel text:** centred, with balanced line breaks (`text-wrap: balance`).
- **Top bar:** the name, meter, percentage and batch chip are vertically centred, with the name truncating rather than wrapping.

## 6. Testing
- **Unit:** `renderScale`; `swipeTurn`; `starsFor` with hints; HUD hint button (count, disabled state, label); reach badge; Next preview; App hint use (cap of 3, reset on restart and on a new level, not refunded by undo, Pip line, star cap saved, win-panel line); the idle nudge (no reveal, no cost); the tutorial unaffected.
- **Browser:** desktop and phone screenshots of the board (sharpness), a swipe-rotate run, the hint flow to the win panel with capped stars, and the tray with the Next preview. No console errors.

## 7. Change log (v1.4.1, 3 Oct 2026)
- **Hints are no longer refunded by restarting.** Ujjwal approved closing the ★★★ shortcut (use hints, restart, replay the moves).
- Hints used on a place are saved per place (`save.hintsUsed`) and stay used through restarts, leaving the place and page reloads.
- When the place is restored, its count is cleared, so the next attempt starts with 3 fresh hints and can earn full stars without them.
