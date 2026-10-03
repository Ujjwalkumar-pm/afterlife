# Afterlife v1.6: Celebrate every restored place

*3 October 2026 · Owner: Ujjwal (director) · Builder: Claude · Request: "After completing each level, vibrate the device, pop confetti over the whole screen, and give the user a well-designed unique badge which they can share."*

## 1. Vibration
- On a win, call `navigator.vibrate([60, 40, 60, 40, 140])` when it is supported. This works on Android browsers; iOS Safari has no vibration API, so nothing happens there and nothing breaks.
- Settings gains **Vibration** (on by default), saved as `settings.vibration`. Reset game restores it to on.

## 2. Confetti
- A full-screen canvas overlay above everything:
  - 140 pieces in the game's palette (moss green, petal pink, pollen yellow, sky gold);
  - pieces burst from the left and right edges, then flutter down;
  - it lasts 3 s, then removes itself;
  - `pointer-events: none`, so it never blocks the win panel.
- **Reduce motion:** no confetti. The win panel and the badge still show.
- The pure helper `makeConfetti(n, w, h, rng)` builds the pieces and is unit-tested.

## 3. Badges: one per place, unique to the player
- **8 designs** (`BADGES`), each with its own shape, two-colour gradient and emblem:

| Place | Shape | Emblem | Colours |
|---|---|---|---|
| Bus Stop | circle | bench under a stop sign | moss → teal |
| Rooftop | hexagon | water tank | sky blue → slate |
| Petrol Station | shield | fuel pump | amber → rust |
| Railway Platform | rounded square | station sign over rails | indigo → plum |
| Playground | scalloped circle | swing | coral → rose |
| Laundromat | hexagon | washing machine with a round door | aqua → steel |
| Bus Depot | shield | bus | mustard → olive |
| Rooftop Garden | scalloped circle | planter with a flower | gold → green (the finale) |

- **Every badge also carries:**
  - an "AFTERLIFE" arc at the top;
  - a ribbon with the place name;
  - the stars earned (filled or empty);
  - the date it was first earned, written as "Restored 3 Oct 2026".
- **Unique:** a ring of leaves around the emblem is "grown" from a seed made of the place id and the earned date, so two players' badges (or the same place on different days) differ.
- **Saving:** `save.badges: Record<levelId, { date: string }>` keeps the first restore date (ISO `YYYY-MM-DD`). Stars come from `save.stars` (the best result). Reset game clears both.

## 4. Where badges appear and how they're shared
- **Win panel:**
  - "You earned the {Place} badge" above the badge drawing (about 150 px);
  - a **Share badge** button, alongside Next place and Keep decorating;
  - the stars row stays.
- **Badges screen** (a new title button, "Badges"):
  - a grid of all 8;
  - earned ones show the player's badge, and tapping one opens a share/download dialog;
  - locked ones show a grey silhouette with "Restore {Place} to earn".
- **Sharing:**
  - The badge is rendered to a 1080×1080 PNG: the badge centred on a soft backdrop, with "afterlifeme.vercel.app" at the bottom.
  - If the browser can share files (`navigator.canShare({ files })`), the native share sheet opens with the image and the text "I restored the {Place} in Afterlife ★★☆ — afterlifeme.vercel.app".
  - Otherwise the PNG downloads as `afterlife-{id}-badge.png`. The game says "Badge saved as an image" or "Shared!".
  - If the player cancels the share sheet, nothing is shown.
- **Testable seams:** the App takes optional `haptics(pattern)` and `shareBadge(payload)` functions (real ones by default), so tests check behaviour without a device.

## 5. Testing
- **Unit:**
  - `makeConfetti`;
  - `BADGES` covers all 8 levels, with unique shape and emblem pairs and unique colours;
  - `badgeSvg` contents: name, stars, date, a label, a leaf pattern that varies with the date and is the same for the same input;
  - save `badges` and `settings.vibration` (defaults, round-trip, first date kept).
- **App:**
  - a win vibrates, but not when switched off;
  - confetti on a win, but not with Reduce motion;
  - the win panel shows the badge and a share button that calls `shareBadge` with the PNG name and text;
  - the Badges screen shows 8 entries with earned and locked states;
  - Reset game clears badges.
- **Browser:** screenshots of the confetti, the win panel badge, the Badges screen (desktop and phone) and all 8 badges in a sheet; the PNG export; no console errors.

## 6. Change log (3 Oct 2026, after release checks)
- **Computers download the badge image; phones and tablets get the share sheet.** The test is `(pointer: coarse)`.
- **Why:** desktop Chrome on a Mac also reports that it can share files, but its system share menu is not what someone clicking "Share badge" on a computer expects.
