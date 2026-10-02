# Cloud Gardens — Research Report for GameX

*Prepared 3 October 2026 · Reference game study for GameX (isometric web game)*

## 1. Summary

Cloud Gardens is a calm puzzle and sandbox game in which the player overgrows abandoned urban scenes with plants. Its one core rule is **"objects make plants grow"**: you plant seeds, then drop human-made scrap (cones, tyres, cars, signs) near them, and every piece of scrap makes nearby plants grow a little. A level is finished when the scene, including the scrap you placed, is covered in enough foliage. Players praise its atmosphere and calm. Reviews most often criticise repetition across 100+ levels and growth rules that are hard to read.

For GameX, the lesson is to keep the core rule, make the rules visible, and keep the game short and varied.

## 2. Fact sheet

| Item | Detail |
|---|---|
| Developer | Noio (Thomas van den Berg, Netherlands), who also made *Kingdom* |
| Publisher | Steam lists Noio as publisher; Wikipedia credits Coatsink (console versions) |
| Early access | 9 September 2020 (PC) |
| Full release | 1 September 2021 (Windows, macOS, Xbox One, Xbox Series X/S) |
| Nintendo Switch | 16 June 2022 |
| Engine | Unity; the plant simulation was later open-sourced as a Unity package (MIT licence) |
| Genre | Puzzle / simulation / sandbox, part of the "cozy" or "chill" genre |
| Price | ₹499 on Steam India; $17.49 on itch.io |
| Steam reviews | Overwhelmingly Positive, 95% of about 1,340 reviews |
| Critic example | Nintendo World Report 7.5/10; Metacritic "generally favourable" (Switch) |
| Size | About 300 MB, runs on very modest hardware |
| Team | 4 freelancers: van den Berg (code, art, design), Amos Roddy (music and sound), Elijah Cauley (level design), Tom Kitchen (3D art) |
| Dev time | About 2 years; the plant simulation itself took about 2 weeks |

## 3. Origin story

Cloud Gardens grew out of a cancelled prototype called *Garbage Country*, a multiplayer game in which people built vertical homes out of trash and grew gardens on them. Van den Berg realised he couldn't build that alone, but the plant simulation in it was fun, so he removed the characters and built a game purely around the plants. The simulation code stayed almost unchanged; nearly all of the two years went into turning a toy into a game (goals, levels, progression, polish, release).

> **Lesson for GameX:** the growth "toy" is the quick part. Levels, feel, feedback and polish are where the time goes, so we should plan for that.

## 4. How the game plays

### 4.1 Core loop

1. **Plant a seed.** Seeds can be placed on the ground, on walls, or on objects.
2. **Place scrap nearby.** Each piece of scrap has a **radius of effect**, a dome around it, and bigger objects make bigger domes. Plants inside the dome grow one step.
3. **Harvest.** Mature plants produce **flowers and fruit**. Clicking enough of them gives you a **new seed**.
4. **Cover the scene.** A meter in the corner rises as foliage covers the scene. At 100% the level is complete, and you can keep decorating afterwards.

### 4.2 The constraint that makes it a puzzle

- **Items arrive in limited batches.** White dots on screen show how many batches are left. The developer said it was deliberate: *"The goal is to be able to overgrow stages using the limited set of items… every stage can't be beat just by playing on autopilot."*
- **Scrap also has to be covered.** Every piece of scrap you add is something you also need to cover with plants, so each one is both fuel and a liability. This "balance between nature and the manufactured" is the main tension in the game.
- **Space is limited.** Some scrap has physics and can fall, block space or crush growth, and placing it badly can damage the garden.
- **Removal tool.** A chainsaw removes plants so you can rearrange without restarting the level.

### 4.3 Plants (examples)

| Plant | Character |
|---|---|
| Wisteria | The first plant. Small, with pink flower vines hanging into open space |
| Moss (Bryophyta) | Yellow-green ground cover |
| Pothos | Climbing vines |
| Ferns | Cover surfaces but are slow to produce seeds |
| Monstera | Giant flowers |
| Opuntia | Cactus |
| Bamboo | Grows straight up and uses little floor space, so it's efficient |
| Willow, pine, palm, broadleaf tree | Big and slow, with lots of fruit |

Each plant differs in **shape** (spread, climb, hang, tower), **speed** and **seed output**. That variety makes the puzzles interesting without adding new rules.

### 4.4 Structure and modes

- **Campaign:** 6 chapters with over 100 small diorama levels in sequence: playgrounds, parking lots, rooftops, railway stations and abandoned vehicles. Every level starts **barren** (only dirt and ruins), so all the greenery comes from the player, which gives a strong sense of ownership.
- **Sandbox:** no goals. You build the diorama yourself from a catalogue of plants and objects unlocked in the campaign.
- **Photo mode:** 16 lighting presets.
- **Shareable videos:** export a looping video of your diorama.
- **Camera:** rotatable diorama view.

### 4.5 Art and audio

- **Visuals:** low-poly 3D models with **pixel-art textures**, muted colours and changing lighting. The developer chose this low detail on purpose: it captures "the essence" of things, feels "inherently cute", and hides imperfect collisions when objects are stacked.
- **Mood:** urban-exploration photography of abandoned places, with nature taking those spaces back rather than "restoring" them.
- **Audio:** a **generative ambient soundscape** by Amos Roddy that responds to play. Reviewers name the music as a major reason the game feels calm.

### 4.6 How the plant simulation works

From the open-sourced package (`games.noio.planter`):

- A plant is a tree of **branches**. Each branch is a small piece of the plant, defined as a **branch template**.
- Each template has **sockets**, the points where child branches can attach.
- Each socket lists **which branch types may grow there, each with a probability**. So a vine socket might grow "70% more vine, 20% leaf, 10% flower".
- Growth is brute force: try to add a branch, check that it fits, keep it if it does. The player can't control the exact shape. That was deliberate, so players can *"relax and watch the plants grow"* instead of micromanaging.
- An early version grew plants automatically once a seed was placed. It was changed to growth only when scrap is placed, so the player feels in control.

## 5. What reviewers praised

- A calm, zen-like mood with no timer, no enemies and no losing.
- Beautiful, readable little scenes, with lighting and pixel texture that give them charm.
- Ownership: every leaf in the finished scene exists because of you.
- The bittersweet theme of nature reclaiming human ruins, which is thoughtful without preaching.
- Sandbox and photo modes give creative players a lot of replay value.

## 6. What reviewers criticised (our chances to do better)

| Criticism | What GameX can do about it |
|---|---|
| **Repetitive** over 100+ levels with the same objective | Ship 5 levels, each with a new twist (a new plant, object or rule) |
| **Growth rules are opaque**: players can't tell what will grow | Show the growth radius before placing, and highlight which plants will grow |
| **Plants stop growing** with no explanation | Show plant state clearly: "fully grown", "blocked", "needs space" |
| **Subtle level-complete signal** | A clear but calm "scene restored" moment |
| **Fiddly controls** on Switch, and a camera that can't be fully adjusted | Tile-based isometric placement: snap to grid, no physics fiddling |
| **Running out of items** with no way forward | Undo button and a "restart level" that keeps it painless |

## 7. Similar games (positioning)

| Game | How it relates |
|---|---|
| **Terra Nil** | Restoring ecosystems, more strategic and "gamey" |
| **Townscaper** | Click-to-build toy with no goals; GameX borrows its isometric charm |
| **Tiny Glade** | A relaxing diorama builder |
| **Viridi** | A pot-plant care game in real time |

Cloud Gardens sits between a **toy** (Townscaper) and a **puzzle** (Terra Nil). GameX should aim for the same spot.

## 8. Design implications for GameX

**Keep:**

1. The core rule "placing scrap makes nearby plants grow", with no real-time growth.
2. Limited items per level, which keeps it a light puzzle.
3. Scrap must also be covered with plants: the nature-versus-scrap balance.
4. Harvesting flowers for new seeds.
5. Barren start, then a lush finish, with no fail state.
6. A calm ambient soundscape and soft, changing light.

**Change for our format (isometric 2.5D, web):**

1. **Grid-based world.** Each tile can hold ground, an object and plant cover. This is far simpler and clearer than 3D physics, and it fits isometric naturally.
2. **Visible rules.** Radius preview, growth highlights and clear plant states fix the top criticism.
3. **Simplified "sockets" growth.** Plants spread tile to tile using per-plant probability rules, inspired by Noio's branch and socket idea but in 2D.
4. **Small, varied campaign:** 5 levels, each adding exactly one new idea.
5. **Undo** in place of the chainsaw.

**Later, if v1 lands well:** a sandbox mode and a photo or share mode. Both make great portfolio features.

**Originality:** GameX uses its own name, art, levels and plant designs. We study the mechanics; we copy no assets, names or levels.

## 9. Sources

- Steam store page: https://store.steampowered.com/app/1372320/Cloud_Gardens/
- Wikipedia, *Cloud Gardens (video game)*: https://en.wikipedia.org/wiki/Cloud_Gardens_(video_game)
- Game Developer, "Getting tangled up in the beautiful landscapes of Cloud Gardens": https://www.gamedeveloper.com/design/Getting-tangled-up-in-the-beautiful-landscapes-of-Cloud-Gardens
- Codecks Game Production Podcast ep. 5, "From Kingdom to Cloud Gardens": https://www.codecks.io/blog/2021/game-production-podcast-ep5-noio/
- Noio, `games.noio.planter` (GitHub, MIT): https://github.com/noio/games.noio.planter
- itch.io store page: https://noio.itch.io/cloud-gardens
- Steam discussion, "No progression near end of some levels" (developer reply): https://steamcommunity.com/app/1372320/discussions/0/2949250944136960316/
- Nintendo World Report review (7.5/10): http://www.nintendoworldreport.com/review/61019/cloud-gardens-switch-review
- These Heterogenous Tasks, "Cloud Gardens": https://heterogenoustasks.wordpress.com/2021/09/08/cloud-gardens/
- Nintendo Life review: https://www.nintendolife.com/reviews/switch-eshop/cloud-gardens
- GameRant, "Best Sandbox Games Like Cloud Gardens": https://gamerant.com/best-sandbox-games-like-cloud-gardens/
