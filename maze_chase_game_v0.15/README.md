# Maze Hunt v0.2 — Animated Player

A browser maze-chase game prototype designed for desktop and mobile. Version 0.2 adds a real animated player sprite with four movement directions.

## Run it

The simplest option is to double-click `index.html`.

If your browser blocks local scripts, run a tiny local server instead:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Controls

- Desktop: WASD or Arrow Keys
- Mobile: on-screen directional pad
- Restart: ↻ button

## Rules

- Reach the glowing EXIT.
- The enemy patrols the maze.
- If it sees you along a corridor or hears you from very close range, it switches to CHASE.
- Break line-of-sight and it switches to SEARCH.
- If the enemy touches you, the level restarts after the game-over screen.

## Add more levels

Edit `js/levels.js`.

Each level uses:

- `#` wall
- `.` walkable floor
- `P` player spawn
- `E` enemy spawn
- `X` exit

Every row in a level map must have the same width.

You can also tune:

- `enemySpeed`
- `playerSpeed`
- `visionTiles`
- `searchSeconds`

## Files

- `index.html` - page and HUD
- `css/style.css` - responsive desktop/mobile layout
- `js/levels.js` - level data
- `js/maze.js` - collision and maze helpers
- `js/player.js` - player movement
- `js/pathfinding.js` - BFS pathfinding
- `js/enemy.js` - PATROL / CHASE / SEARCH AI
- `js/controls.js` - keyboard and mobile controls
- `js/game.js` - main loop, camera, rendering, win/lose logic


## Version 0.2 changes

- Replaced the placeholder player circle with the explorer character.
- Added 4-frame walking animation.
- Added Down / Up / Left / Right facing directions.
- Character automatically returns to an idle frame when movement stops.
- Works with keyboard and the existing mobile D-pad.
- Added `assets/player/player_sprites.png`.


## v0.3 changes

- Added a real enemy character sprite instead of the red circle.
- Added four-direction enemy animation: down, up, left and right.
- Enemy animation speeds up while chasing.
- Enemy shows `!` while chasing and `?` while searching.
- Enemy art lives in `assets/enemy/enemy_sprites.png`.


## v0.4 changes — Multiple Hunters

- Level 1 now has 2 enemies.
- Level 2 now has 3 enemies.
- Level 3 now has 4 enemies.
- Every enemy patrols, chases and searches independently.
- The HUD tells you how many enemies are currently chasing/searching.
- Any enemy can catch the player.
- Enemy spawns are spread through the maze instead of being clustered together.
- The level format now supports multiple `E` markers, so future levels can contain any number of enemies.


## v0.5 changes — Directional Vision & Stealth

- Enemies now see only in the direction they are facing.
- Each hunter has a visible vision cone.
- Vision cones stop at maze walls instead of passing through them.
- Real ray-based line-of-sight supports diagonal sight, not only straight corridors.
- You can sneak behind an enemy without being seen.
- Moving makes noise at close range; standing still is quieter.
- When sight is lost, the hunter goes to the last known position and searches.
- Level 1/2/3 use gradually wider vision and slightly stronger hearing.


## v0.6 changes — Sound

- Added player footsteps.
- Added enemy footsteps that become louder as a hunter gets closer.
- Enemy steps are stereo-panned left/right relative to the player when supported.
- Added a low horror ambience.
- Added dynamic chase audio when one or more enemies detect the player.
- Added a detection sting when a chase begins.
- Added caught/game-over sound.
- Added level-complete chime.
- Added a sound mute/unmute button in the HUD.
- Sound is generated with the browser Web Audio API, so this version does not need external `.mp3` or `.wav` files.
- Audio starts after the player presses Start, which keeps it compatible with desktop and mobile browser autoplay rules.


## v0.7 changes — Horror Visual Pass + Louder Ambience

- Replaced the bright placeholder maze walls with darker stone blocks.
- Added bevels, mortar, cracks, chips and grime variation to wall tiles.
- Added subtle floor stains and cracks.
- Added a warmer flashlight center with darker edges.
- Increased the overall audio output.
- Horror ambience is substantially louder.
- Added a filtered windy/industrial room-noise layer so ambience is audible on phone/laptop speakers.
- Chase audio is slightly stronger.


## v0.8 changes — Main Menu + Level Select

- Added a proper title/main menu.
- Added Play, Level Select and Sound controls.
- Added a responsive level-select screen for desktop and mobile.
- Levels unlock one-by-one as you complete them.
- Cleared levels are marked with `CLEARED ✓`.
- Locked levels show a lock icon and cannot be selected.
- Progress is saved locally in the browser using `localStorage`.
- The Play button continues from the next uncleared unlocked level.
- Sound can be toggled from both the main menu and the in-game HUD.


## v0.9 changes — Horror Environment Pass

- Added deterministic blood stains and blood drops to some floor tiles.
- Added torn notes/papers, rubble and old footprints.
- Added wall damp stains and scratch marks.
- Added flickering wall lamps placed beside corridors.
- Lamps create warm glows that remain visible beyond the player's flashlight.
- Decorations are deterministic, so they do not flicker/change position every frame.
- Added rare distant metallic/structural ambience sounds.
- All props are procedural and lightweight, so there are no extra image downloads and mobile performance remains good.


## v0.10 fix — Visibility Mask

- Fixed wall tiles being faintly visible outside the player's light circle.
- The darkness mask now reaches full black at the edge.
- Fixed wall lamps revealing parts of the maze outside the visibility area.
- Lamp glows are now drawn before the darkness mask, so they only affect what the player can actually see.


## v0.11 changes — Keys & Locked Exit

- Level 1 has 1 key.
- Level 2 has 2 keys.
- Level 3 has 3 keys.
- The exit starts locked and only opens after all keys are collected.
- Keys glow and rotate so they are easy to spot inside the flashlight area.
- The HUD shows collected keys / total keys.
- The locked exit is orange; the unlocked exit turns green.
- Added key pickup and exit-unlock sounds.
- Level maps now support `K` markers for key placement.


## v0.12 changes — Hiding Spots

- Added 2 hiding spots to Level 1, 3 to Level 2 and 4 to Level 3.
- Hiding spots appear as old metal lockers/cabinets.
- Desktop: stand near one and press `E` to hide or leave.
- Mobile: a `HIDE` / `LEAVE` button appears when interaction is possible.
- The player cannot move while hidden.
- Hidden players cannot be seen or heard by hunters.
- Hiding is not automatically safe if a hunter watched you enter: a hunter that reaches the exact last-seen hiding tile can discover you.
- Patrolling hunters can walk past a hiding spot without automatically catching a hidden player.
- Player visibility becomes smaller/darker while inside a hiding place.
- Added hide-in and hide-out sound effects.
- Level maps now support `H` markers for hiding spots.


## v0.13 changes — Enemy Types

There are now four different enemy types:

- `Hunter` — balanced standard enemy.
- `Scout` — faster, sees farther, reacts quickly, but hears less.
- `Brute` — slower and larger, sees less, but hears movement from much farther away.
- `Stalker` — slower while patrolling, but becomes very fast during a chase and searches for longer.

Level mixes:

- Level 1: 2 Hunters.
- Level 2: Hunter + Scout + Brute.
- Level 3: Hunter + Scout + Brute + Stalker.

Other changes:

- Each type has different movement, chase, hearing, vision and search values.
- Brutes render larger.
- Each enemy gets a type label and identification ring.
- Level Select now shows which enemy types appear in a level.
- Enemy vision cones have slightly different visual intensity by type.


## v0.14 changes — Ad Placeholder + Monetization Logic

The game now contains a complete ad placement layer without requiring real ad unit IDs yet.

### Included placements

- Menu banner placeholder.
- Level-select/menu banner placeholder.
- Interstitial logic at natural breaks only.
- Interstitial frequency defaults to once every 2 completed levels.
- Rewarded revive button appears after getting caught.
- A rewarded revive can be used only once per level run.
- Rewarded revive keeps collected keys but returns the player to the level start and resets enemy pursuit.

### Important

Real ads are currently disabled in `js/ads.js`:

```js
enabled: false,
placeholderMode: true
```

The placeholder UI lets you test the complete game flow without generating fake ad impressions.

When real ad units are ready, edit `js/ads.js`:

- Website banner/interstitial/rewarded IDs go under `web`.
- Android/Capacitor AdMob IDs go under `android`.
- Set `enabled: true`.
- Connect your chosen web ad provider and Capacitor mobile ads plugin inside the marked `REAL ADS LATER` methods.

The rest of the game does not need to know which ad provider is being used because all monetization calls go through `AdManager`.


## v0.15 changes — 8 Levels + Wider Corridors

### New levels

The game now has 8 levels total:

- Level 1 — First Hunt
- Level 2 — Tight Corners
- Level 3 — Long Search
- Level 4 — Echo Halls
- Level 5 — The Furnace
- Level 6 — Broken Ward
- Level 7 — Black Corridors
- Level 8 — No Way Back

Later levels are larger, have more loops, more keys, more hiding spots, and increasingly dangerous enemy mixes.

### Wider paths

- Corridor space is roughly 10% wider.
- Wall collision now uses the same inset geometry as the visuals.
- Connected wall sections stay connected; only wall faces bordering walkable floor pull back.
- Player/enemy sprite rendering was reduced slightly so narrow turns feel less cramped.
