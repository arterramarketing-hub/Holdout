# Holdout v6 — plan

This covers everything requested on Sep 15, 2026:
- **The start-menu redesign.**
- **Items from the improvement list:**
  - 1 — objectives at the landmarks
  - 2 — enemy rounds in 3D only
  - 3 — remove auto-fire
  - 4 — grenades with their own button only
  - 5 — sprint
  - 8 — footsteps and callouts
  - 9 — graphics quality and controller support, no gyro
  - 10 — a firing-range tutorial
  - 12 — source split into files, with automated tests

Work runs in eight phases. Every phase ends with the audit gate below, one commit, and a republish to the same Artifact URL.

## Why this order

1. **The source split and tests come first (12).** Every later phase then lands in small files and is checked by the automated suite, not by hand.
2. **Auto-fire goes early (3).** That deletes code every later feature would otherwise have to support: lock-on, the threat-lean camera and level player rounds. The start menu is rebuilt in the same phase, because both rewrite the menu and settings UI.
3. **Combat feel is one phase (2, 4, 5).** Enemy rounds, grenades and sprint all touch firing, input and balance, so they share one balance audit.
4. **Objectives come after combat (1).** AI movement under 3D fire is settled first, so objective tuning happens once.
5. **Audio follows objectives (8).** Footsteps and callouts should describe the final AI: flanks and pushes onto points.
6. **Controller and quality settings follow gameplay (9).** The controller maps the final action set, and the presets cover every new effect.
7. **The firing range is last (10).** It teaches the final controls on all three input types.

## Audit gate (every phase)

1. `python3 tools/build.py --check` confirms index.html was built from the current source.
2. `python3 tools/test.py` runs the whole suite in headless Chrome: 0 failures and 0 console errors.
3. The phase's own tests are added, and they pass.
4. Screenshots of every screen the phase touched, at 844×390 (phone) and 1280×760 (desktop).
5. Performance: no more than the phase's draw-call budget, and no new per-frame allocations in hot paths.
6. The header notes in `src/header.txt` are updated for the phase.
7. One commit per phase, then republish https://claude.ai/code/artifact/4c81933f-9a8e-40af-93af-8c2430cccdd3 and share the link.

---

## Phase 1 — Source files, build, automated tests (item 12)

**Source layout.** The game stays one classic script, so concatenation keeps today's behaviour exactly.
- `src/header.txt` holds the design notes comment.
- `src/shell.html` is the document skeleton with include markers.
- `src/css/NN-*.css` splits the stylesheet at its existing section banners.
- `src/markup.html` holds the body markup.
- `src/js/NN-*.js` has one file per script section: CONFIG, UTILS, DISPLAY, META, BATTLE STATE, TOWN, CAMERA INTENT, AUDIO, INPUT, ENEMIES, COMBAT, SUPPORTS, SKY, FRONT, SAVE, BATTLE UPDATE, the HUD and screens, the main loop and boot.
- The 3,000-line view layer splits at its sub-banners into about nine files: core and textures, geometry and batches, guns, rigs and poses, first person, characters and effects, the N64 output and ground textures, environment, and camera, overlays and engine.

**Build and tests.**
- `tools/build.py` concatenates the sources in filename order into `index.html`. `--check` fails if `index.html` is stale.
- `tools/test.py` works in four steps:
  1. Generate `tests/run.html`: the game, an in-memory localStorage shim so tests never touch a real save, the harness, and every `tests/*.test.js`.
  2. Serve the repo from a throwaway local server.
  3. Run the page in headless Chrome, with SwiftShader standing in for WebGL.
  4. Collect results posted back to the server, print a pass/fail table, and exit non-zero on failure.

  The same page also runs by hand in any browser.

**First suites.** These are the checks that have been run by hand so far.
- **Boot:** the 3D engine becomes ready.
- **Balance:**
  - The M4 drops a rifleman in 3 rounds.
  - The UMP needs 4 rounds up close and 5 at 15 m.
  - The SAW needs 3.
  - A headshot doubles a round.
- **Weapons:** fire, reload and the pistol fallback work for all five guns.
- **Ballistics:**
  - A headshot down the sights lands on the crosshair ray.
  - Buildings stop rounds.
  - Rounds aimed high pass over low cover.
- **Navigation:** no isolated cells, and the walls are reachable.
- **Enemies:**
  - Every type fights and dies.
  - Warlord summons stay within the cap.
  - Killing the Warlord secures the front.
- **Lifecycle:**
  - Death leads to respawn.
  - An empty ticket pool fails the front, and retry works.
  - A lost front saves as 0%.
- **Sky:** all six music moods are reachable.
- **Menus and save:** settings and loadout work, and saves round-trip.
- **Input:**
  - Touch fire and ADS buttons work, and drag-to-look turns the view.
  - A HUD tap causes no drift.
  - Losing window focus releases held inputs.
- **Full front:** a fresh save clears with no errors, within the draw-call budget.
- **Baselines for Phase 3** are recorded to `tests/baseline.json`:
  - damage per minute taken while standing in the open
  - the same, standing behind a car and behind sandbags
  - average front clear time with only the AI playing

**Audit.**
- The first build must be byte-identical to commit 829f609's `index.html`, checked with a sha256 match.
- The suite passes headless.
- No republish: nothing a player sees changes, and the host refuses identical content.

## Phase 2 — Manual aim only (item 3) and the new start menu

**Removing auto-fire**
- **Settings:** the Controls row (auto-fire/manual) goes. Saves with `scheme: 'auto'` load as manual, and third person stays if it was chosen.
- **Lock-on:** Z-targeting goes: `lock` and its press/release, `updateLock`, `pickTarget`, the target arrow, `#lockbtn`, tap-to-lock, and Tab/right-click lock.
- **Camera:** the north-facing threat lean and the Q/E nudge go, because the camera always follows your aim now.
- **Rounds:** the level-round path for your own shots goes, so every round you fire travels in 3D. Squadmates keep level rounds and the headshot dice.
- **Kept:** aim assist stays, still third person only.
- **HUD:** hints and touch classes are simplified, and the touch layout without the lock button becomes the only layout.

**The new start menu: a theater map beside a mission briefing**

*Direction.* A field operations table in the brand's navy and orange: topographic, precise, military.

*The map*
- **Sectors:** each sector is a region, split by distance to each sector and given hand-drawn borders.
- **Ownership:** held ground has a blue wash and hatching, enemy ground a faint red wash.
- **Front line:** an orange line glows along every border between the two sides and marches slowly. When you win a sector, the region flashes and the line redraws in its new place.
- **Terrain:**
  - contour lines rising to the northern ranges
  - a river cutting past Velen Crossing into Dunmoor Marsh, with marsh symbols
  - a lettered map grid with grid references
- **Markers:** NATO-style. A blue square for held, an orange diamond with a pulse for attackable, a dim red diamond for enemy, and a double diamond for the capital. A progress arc shows a partly taken sector.
- **Routes:** blue between held sectors, orange arrows along the axes of advance, faint dashes elsewhere.
- **Selection:** a reticle frames the selected sector. Tapping anywhere inside a region selects it, which gives big targets on a phone.
- **Keyboard:** ←/→ cycles the attackable sectors and Enter deploys.

*The briefing column*
- **Header:** theater progress as 13 segments with "N / 13 held", and the settings cog.
- **Sector:** a status chip (Attackable / N% taken / Held / Enemy), the sector number and grid reference, and the name.
- **Stats strip:**
  - threat tier with pips
  - enemy reserves and "8 at once"
  - the forecast: time of day and weather, rolled once and actually used when you deploy
- **Progress:** a bar and remaining reserves for a partly taken sector.
- **Objective line:** facts only — reserves to break and the Warlord at 90%. Phase 4 adds the sector's objectives here.
- **Deploy:** the orange call to action carries the sector name. For held or out-of-reach sectors it says why and names the sectors to take first.
- **Kit and squad:** the kit card (gun, sight, magazine, Change) and the squad of four with roles (Lead, Point, Flank, Overwatch), names and guns.
- **Placeholder:** a footer slot for the firing range, filled in Phase 7.

*Behaviour*
- **Entrance animation:** each time the map opens, the terrain fades in, the sectors wash in, the front line draws, markers pop in outward from HQ, and the briefing slides in. Off under reduced motion.
- **Auto-select:** after a win, the next attackable sector is selected, preferring one next to the sector just taken.

**Tests**
- No lock-on elements remain, the Controls row is gone, and Tab does nothing in battle.
- An old save with auto-fire loads as manual.
- Menu:
  - selection rules
  - region hit-testing
  - keyboard cycling and deploy
  - the forecast matches the battle's sky
  - no scrolling at 844×390, 740×360, 1280×760, 1920×1080 or in a portrait window
  - the after-win auto-select

## Phase 3 — Enemy rounds in 3D (2), grenades (4), sprint (5)

**Enemy rounds in 3D**
- **Firing:** from the shooter's muzzle height (standing rifleman 1.45 m, kneeling 1.0 m, gunner 1.0 m, Warlord 1.9 m) at the target's centre of mass, with a spread disc. The flight is ballistic, like yours.
- **Buildings and tall cover:** stop rounds by height (COVER_TOP). Low-block cover (fences, hedges, tents) keeps the dice.
- **The flat cover discount goes.** The 50% soldier discount for being in cover is removed, and geometry decides instead. You never crouch, so sandbags stop what is aimed at your knees and tall cover stops everything.
- **Squadmates** crouched in cover get a lower body height (1.1 m against 1.8 m standing), so low cover protects them.
- **No enemy headshots**, as before. The own-cover skip and near-miss snaps stay.
- **Balance guardrail:** damage per minute standing in the open stays within ±15% of the Phase 1 baseline. Enemy spread is tuned to meet it.

**Grenades**
- **Supply:** 2 frags per life, refilled by care packages and on respawn.
- **Controls:** a new touch button with a count badge, in CoD Mobile proportions (.62 of the fire button, above the fire button between reload and ADS). G on the keyboard, RB on a controller (Phase 6).
- **Throw:** from the eye, along the crosshair with 12° of loft, at 15 m/s. It bounces off ground, walls and cover tops with damping. The fuse is 2.2 s from release, with no cooking.
- **Blast:**
  - 5 m radius, 6 damage at the centre with linear falloff.
  - A rifleman dies within about 2.5 m.
  - It chews cover like any other blast.
  - The breacher's shield does not stop it.
  - Squadmates are never hurt.
  - Your own frag hurts you at half strength and can never kill you from full health.
- **Visuals and warning:** a throw animation in first person, a spinning grenade model with a shadow, and a bounce tink. A red on-screen grenade marker appears when a live frag is within 6 m of you.

**Sprint**
- **Controls:** hold Shift on the keyboard. On touch, push the stick past its rim and forward (within ±35°) and a SPRINT chevron appears. L3 on a controller (Phase 6).
- **Rules:**
  - +45% speed, only while moving forward (within ±50° of facing).
  - No firing or ADS while sprinting. Pressing fire or ADS drops the sprint, with 0.18 s before the first shot.
  - Reloads continue.
  - Enemy fire at a sprinting soldier gets +40% spread.
  - No stamina limit.
- **Feel:** FOV +8° eased in, a sprint pose for the weapon, and a faster bob.

**Tests**
- Enemy rounds:
  - A car between shooter and soldier blocks.
  - A standing soldier is hit over sandbags.
  - A crouched squadmate behind sandbags is protected.
  - Damage per minute is within tolerance of the baseline.
- Grenades:
  - range on flat ground
  - a wall bounce
  - fuse timing
  - radius and falloff: dead at 2 m, unhurt at 6 m
  - self-damage rule
  - count and refill
  - the touch button throws
- Sprint:
  - speed ×1.45
  - no fire while sprinting, and firing cancels the sprint
  - the stick-rim sprint engages
- A full front still clears.

## Phase 4 — Objectives at the landmarks (item 1)

**Objective points**
- **Choice per sector:** each sector picks 3 of 6 landmarks as objectives A, B and C: the Rail Yard, Mill Yard, Church Square, Market, Gas Station and Cemetery. The choice is fixed per sector, so each mission has its own shape.
- **Each objective** has a flag at an open spot in the landmark and a 7 m capture ring on the ground. Every objective starts enemy-held.

**Capturing**
- Only one side's living units inside moves the capture. One unit takes 12 s to flip, two take 9 s, three or more take 7 s.
- Both sides inside freezes it.
- Taking an enemy objective means bringing it to neutral first, then capturing.

**Reserves drain** (all numbers are tunables)
- **Against the enemy:**
  - A capture costs the enemy 2 reserves.
  - While you hold more objectives, they lose 1 reserve every 4 s, or every 2 s with all three.
  - The drain never spends reserves still standing on the field.
  - The Warlord still holds progress at 90% until killed.
- **Against you:** while the enemy holds more objectives, your pool loses 1 every 20 s, after a 45 s grace period at the start.

**AI**
- About 45% of enemies take and defend objectives; the rest keep hunting.
- Enemies prefer spawn zones near objectives they hold, never inside one you are capturing.
- Point pushes the nearest objective you don't hold. Overwatch covers it from range. Flank keeps hunting.

**HUD and briefing**
- A, B and C chips under the ticket bar show owner colour, a capture ring, a pulse when contested, and "CAPTURING B" / "LOSING A".
- The minimap draws the objective rings and letters.
- Flags show in the world, and small letters over the objectives stay visible through fog.
- Short stingers play for a capture or a loss.
- The briefing lists the sector's three objectives.

**Tests**
- capture time by head count
- contested freeze
- neutralise-then-capture
- drain rates on both sides
- the drain can't finish a front on its own
- the Warlord gate
- enemies reach objectives
- an AI-only squad takes at least one objective
- a full front clears in 120–240 s
- the HUD states render

## Phase 5 — Footsteps and callouts (item 8)

**Footsteps**
- **Sound:** synthesised in 4 variants for each surface: stone, gravel or dirt, grass, and wood or metal. The surface under the foot comes from the town's ground grid.
- **Timing:** one step per stride, from the walk phase.
- **Levels:**
  - your own steps quiet
  - squadmates quieter still
  - enemies placed in stereo and falling off to about 25 m; runners and sprinters are louder
- **Voice cap:** 6 at once.

**Enemy barks**
- Short synthesised shouts, 6 variants, pitched per enemy, placed where the enemy is.
- They play when an enemy spots you, starts a flank, reloads or charges.
- Rate limits: 1.2 s apart overall, 6 s per enemy.

**Squad callouts** (terse tactical information — no voice lines or personalities)
- **Trigger:** an enemy within 25 m to your side or behind (outside ±60° of your view) that a squadmate can see.
- **What happens:** a radio chirp and a 1.5 s directional HUD tag: "FLANK · LEFT", "FLANK · RIGHT" or "BEHIND". At most one every 4 s.
- **Setting:** a new Callouts setting turns them off.

**Mix:** measured offline against a gunshot. An enemy step at 10 m sits about −30 dB below it, a bark at 15 m about −22 dB.

**Tests**
- the buffers render
- surface lookup
- left/right placement sign
- callouts fire for flankers only
- rate limits hold over a full front
- mute and settings are respected

## Phase 6 — Graphics quality and controller (item 9, no gyro)

**Graphics quality**
- **Setting:** Auto (the default), Low, Medium or High.
- **What the presets change:**
  - render lines: 360 / 480 / 600
  - output pixel-ratio cap
  - grass and decal density
  - caps on particles, brass and corpses
  - rain streaks
  - bloom on or off
  - fog distance
- **Auto:** drops a step when frames average over 22 ms for 3 s, and rises after 8 s under 12 ms.
- **Live:** changes apply without reloading.

**Controller** (Gamepad API standard mapping)

| Input | Action |
|---|---|
| Left stick | Move (deadzone 0.15) |
| Right stick | Look (deadzone 0.12, curve ^1.8, its own sensitivity slider) |
| RT | Fire |
| LT | ADS |
| RB | Grenade |
| X | Reload |
| Y | Switch view |
| L3 | Sprint |
| D-pad ←/↑/→ | Killstreaks 1, 2, 3 |
| Start | Settings |
| View | Map |

- **Menus:** stick or D-pad moves focus with a visible ring, A selects, B goes back, and LB/RB cycle sectors on the map.
- **Rumble:** follows the Vibration setting.
- **Prompts:** switch to controller buttons whenever the controller was the last input.

**Tests**
- A mocked `navigator.getGamepads` covers:
  - move, look, fire, ADS, grenade, sprint, reload and killstreaks
  - menu navigation and deploy
- Every preset changes the render target and the caps.
- Auto reacts to simulated slow frames.
- Draw calls and frame time are recorded for each preset.

## Phase 7 — Firing range (item 10)

**When it runs:** BASIC TRAINING at the FOB runs on a new campaign's first launch. It can be skipped, and it is always available from the start menu.

**Steps.** Each has a prompt for touch, keyboard or controller, and a check mark when done.
1. Move to a marker.
2. Look at three markers.
3. Knock down three pop-up targets at 10 m.
4. Hit two targets at 25 m down the sights.
5. Reload.
6. Sprint to the gate.
7. Grenade a cluster of three targets.
8. Capture a training flag (4 s).
9. Training complete: a card with Deploy.

**How it's built**
- A training variant of a battle: no enemy waves, reserves or Warlord, and no damage to you.
- Squadmates stand at the FOB.
- A new pop-up steel target model that folds when hit and resets.
- Marker rings and a prompt panel in the brand style.
- `meta.trained` records completion.

**Tests**
- the whole course completed by script on keyboard, touch and mocked controller
- skip
- the first-run trigger fires only on a new save
- the start-menu entry

## Phase 8 — Final audit and release

- **Tests:** the full suite, plus a screenshot review of every screen at phone and desktop sizes.
- **Performance:** a pass on the Low and Auto presets.
- **Docs:** the header notes rewritten for everything.
- **Release:** memory updated, then the final republish with a changelog.

## Default decisions (changeable)

- Your own grenade hurts you at half strength but never kills from full health. Squadmates are immune.
- Sprint has no stamina limit.
- Objectives start enemy-held. A modest reserves drain works against you, after a 45 s grace period.
- Callouts are tones and HUD tags, not spoken lines, so the no-dialogue rule holds.
- Aim assist stays third person only on every input, controller included.
- The firing range runs once automatically for new campaigns only; existing saves just see it on the menu.
