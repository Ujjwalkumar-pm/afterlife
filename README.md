# Afterlife

A calm isometric web game about nature reclaiming abandoned places. Plant seeds among the ruins, drop scrap to feed them, and watch moss, vines, flowers and bamboo take the scene back.

> Play it: **[afterlife-one.vercel.app](https://afterlife-one.vercel.app)** · v1.4: 8 places, a short story intro, Pip the mossy robot, generative soundtrack, Kenney props.

![Afterlife](public/hero.png)

## How it plays

- Placing scrap makes every plant within its ring grow one step. Small scrap reaches 1 tile, medium 2 and large 3.
- Grown moss and vines spread, flowers bloom (tap a bloom for a seed), and bamboo grows tall.
- Fill the meter by covering the scene, including the scrap you've placed. There's no timer and no losing, and you can always undo.
- Swipe the board sideways to turn it (or use the turn buttons, Q/E). Pinch or scroll to zoom.
- Stuck? Tap the 💡 bulb: it shows the best move. You get 3 hints per place, and they count against your stars (1 hint: at most 2★; 2 or more: 1★). Hints stay used until you restore the place.

## What's in it

- **8 places:** Bus Stop, Rooftop, Petrol Station, Railway Platform, Playground, Laundromat, Bus Depot, Rooftop Garden. Every one is proven solvable by a solver and by a test player who only follows the hints.
- **A 25-second story** before your first game (skippable, replayable from the title).
- **Pip**, a mossy robot who points out hints, cheers big moves and celebrates each restored place.
- **Stars, combos and milestones**, a guided first level, and How to Play.
- **Accessibility:** works on phones, tablets and desktops, with keyboard and screen-reader support and a Reduce motion setting.

## Development

    npm install
    npm run dev         # play locally at http://localhost:5173/play/
    npm test            # 340 tests: rules engine, levels, game logic, UI
    npm run typecheck
    npm run solve -- src/levels/01-bus-stop.json   # regenerate a level's reference solution
    npm run sprites     # re-render Kenney props (needs npm run dev running)
    npm run hero        # re-capture the landing hero and share images (needs npm run dev)

The rules live in `src/engine/`, pure TypeScript with no framework. Levels are JSON files in `src/levels/`. Design specs and build plans for every version are in `docs/superpowers/`.

## Credits

- Design and direction: Ujjwal Kumar
- Inspired by the mechanics of *Cloud Gardens* by Noio. Afterlife uses no names, art, levels or audio from it.
- Props rendered from [Kenney](https://kenney.nl) CC0 3D models (licence in assets/LICENSES/); plants and ground are drawn in code.
- Soundtrack generated live with Tone.js.

## Licence

Code: MIT (see `LICENSE`). Third-party art keeps its own licence.
