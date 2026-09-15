# Holdout v7 — plan

Requested on Sep 15, 2026, from the improvement list:
- **3 — smarter enemies:** enemies who throw grenades to force you out of cover, a rooftop sniper whose scope glints,
  and counterattacks on objectives you hold.
- **7 — weapon pickups:** grab an enemy's rifle when you run dry, carry a second gun, and a suppressor.
- **8 — install it like an app:** a home-screen icon, full screen in landscape with no browser bars, playable offline.
- **10 — battery options:** a 30 or 60 fps cap and a battery-saver mode.
- **11 — automatic tests on GitHub:** run the tests on every push and only update the site if they pass.

Work runs in nine phases. Each ends with the audit gate below, one commit merged into `main`, and (when the game
changed) a republish to the same Artifact URL. Work happens in a git worktree on branch `v7`, so a commit made from
GitHub Desktop mid-phase can never pick up half-finished work.

## Why this order

1. **Tests on GitHub come first (11).** Every later push is protected from then on. The same phase adds the
   `build.py --site` step that the app phase extends.
2. **Battery options next (10).** A frame-rate cap changes what "a slow frame" means to Auto graphics quality, so it
   is settled before heavier features land, and later phases are measured at 30 fps too.
3. **Install as an app (8).** Independent of gameplay; it needs the site step from Phase 1.
4. **Enemy guns and a second gun (7).** New player weapons and the pickup and swap system.
5. **The suppressor (7).** It rides on the attachment and swap code from Phase 4, and adds enemy hearing.
6. **Enemy grenades (3).** Reuses the grenade physics; it must land before counterattacks, which use it.
7. **The rooftop sniper (3).** Needs raised enemies, 3D sight lines and a glint.
8. **Counterattacks (3).** Last of the AI, so it directs grenades, snipers and the rest as they finally behave.
9. **Final audit.** Balance measured with everything on, docs, release.

## Audit gate (every phase)

1. `python3 tools/build.py --check` confirms index.html (and, from Phase 3, `sw.js`) was built from the current source.
2. `python3 tools/test.py` runs every suite in headless Chrome on five window sizes: 0 failures, 0 console errors.
3. The phase's own tests are added and pass; a soak run (`--soak`) at the phases that change enemy behaviour.
4. A look at every screen the phase touched, at 844×390 (phone) and 1280×720 (desktop).
5. No new per-frame allocations in hot paths; draw calls within ~10 of the v6 figure.
6. `src/header.txt` and the README are updated for the phase.
7. One commit, merged into `main`; the Artifact is republished and the link shared.

---

## Phase 1 — Tests on every push, deploy only what passes (item 11)

**What you get**
- Every push to `main` runs the full test suite on GitHub (Ubuntu, headless Chrome).
- The site is published from a `gh-pages` branch that only a passing run updates. A failing run leaves the site on
  the last good build, and GitHub shows a red ✗ on the commit.
- One setting to change once, after the first green run: **Settings → Pages → Branch: `gh-pages` / root**.
  Until then the site keeps updating straight from `main`, as today.

**Work**
- `tools/test.py` runs anywhere:
  - finds Chrome from `$CHROME`, the macOS app, or `google-chrome` / `chromium` on the PATH;
  - on Linux adds `--no-sandbox` (Ubuntu 24.04 blocks Chrome's sandbox for unprivileged users);
  - measures the browser's own frame once per run instead of assuming 87 px, so every pass gets its exact inner size;
  - in CI: longer timeouts, `::error` annotations for failures, a results table in the run summary.
- `tools/build.py --site DIR` assembles only what is published (no tests, tools, docs or src).
- `.github/workflows/ci.yml`: a `test` job on every push and pull request; a `deploy` job after it, on pushes to
  `main` only, that force-pushes the assembled site as a single commit to `gh-pages` (with `.nojekyll`).
- README: a status badge and the one-time Pages switch.

**Checks**
- The whole suite, locally, with the new window measurement.
- `CI=1` locally: the summary table and annotations come out right.
- `--site` output: `index.html` present, nothing else that should not be published.
- After the first push: the run's result read back from the public GitHub API; `gh-pages` contents checked before
  you switch the setting.

## Phase 2 — Battery options (item 10)

**What you get**
- **SETTINGS › Frame rate:** Max (default), 60 or 30.
- **SETTINGS › Battery saver:** Off (default), On, or Auto (only where the browser reports the battery: on at 20% or
  below while unplugged, off again when charging or above 30%).
- **Battery saver on:** a 30 fps cap, a new Saver graphics preset (240 lines, pixel ratio 1, fewer particles, brass,
  corpses and rain, no glow), no menu entrance animation, and a small battery mark in the HUD. When Auto turns it on,
  a banner says so once, with the level.
- **Menus** run at 30 fps whatever the setting, since nothing 3D draws there.
- **Auto graphics** judges frame time against the cap's own frame budget, so a 30 fps cap never reads as a slow device.

**Work**
- `400-main-loop.js`: a frame gate with an accumulator, so 60 on a 90 Hz or 120 Hz display still averages 60.
- `285-view-quality.js`: the `saver` preset; slow and fast thresholds relative to the frame budget.
- New `287-power.js`: the cap, saver state, and the Battery Status API with its listeners.
- `300-hud.js`: two settings rows; `OPT_DEFAULTS` gains `fps: 'max'` and `saver: 'off'`.

**Tests** (`57-power.test.js`)
- Synthetic frame timestamps at 60 Hz with a 30 cap run ~30 updates a second; at 120 Hz with a 60 cap, ~60; Max runs
  every frame.
- The saver switches the preset and restores the previous one when turned off.
- A fake battery at 15% and unplugged turns Auto on with the banner; plugging in turns it off.
- Auto graphics fed 20 s of steady 33 ms frames under a 30 cap stays on High.
- Settings rows exist, save and apply.

## Phase 3 — Install as an app (item 8)

**What you get** (on the GitHub Pages site; the Artifact page is unchanged)
- **Android (Chrome):** SETTINGS › Install app, and a one-time "Install Holdout" chip on the start menu on phones.
- **iPhone (Safari):** the same entries show how: Share, then Add to Home Screen. iOS has no install prompt.
- **Installed:** its own icon and name, full screen (on iPhone, standalone with the status bar over the page), locked
  to landscape on Android.
- **Offline:** after one launch online, the game starts with no connection: the page, three.js, fonts and icons are
  cached. Online, it always loads the newest build first.
- **In a browser tab:** SETTINGS › Full screen where the browser allows it (Android Chrome, desktop), which also locks
  landscape on phones.

**Work**
- `src/pwa/manifest.webmanifest`: name, `display: fullscreen`, `orientation: landscape`, navy theme, icons (any and
  maskable).
- `src/pwa/sw.js`, built to `sw.js` with the build hash in its cache name.
  - Pages: network first with a 4 s fallback to the cache.
  - three.js and font files: cache first (versioned URLs).
  - Font stylesheet: stale-while-revalidate.
  - Old caches deleted on activate.
- `tools/icons.py`: draws the icons (192, 512, maskable 512, Apple 180, favicon 32) with a small pure-Python PNG
  writer, no dependencies; the PNGs are committed.
- `shell.html`: manifest, icons, theme colour and Apple web-app tags, each marked `data-pwa` so `build_artifact.py`
  strips them.
- New `415-app.js`: registers the worker only when the page has a manifest link, is not in a frame, and is https or
  localhost. Handles the install prompt, the "installed" event, standalone and iOS detection, and full screen.
- `build.py`: writes `sw.js` and `manifest.webmanifest` at the root (so today's branch deploy works too); `--site`
  copies them and the icons; `--check` covers them.

**Tests** (`75-app.test.js`)
- The manifest parses, has every required field, and each icon URL returns a PNG of its stated size.
- The page has the manifest link and Apple tags; with the link removed (the Artifact form) registration does nothing.
- The worker registers on the test server, and its cache holds `index.html` and both three.js files. It is removed
  afterwards.
- A synthetic `beforeinstallprompt` shows the Install row, and pressing it calls `prompt()`.
- A faked iPhone user agent shows the Add to Home Screen steps; standalone mode hides both.

## Phase 4 — Enemy guns you can pick up, and a second gun (item 7)

**What you get**
- **Drops:** riflemen drop their AK-47 and gunners their PKM where they fall, with what was left in the magazine
  (10–30 rounds, 40–100 in a PKM) and one spare. Runners, breachers, raiders and the Warlord drop no gun. A dropped gun
  lasts 45 s.
- **Taking a gun:** near one, a prompt names it — "HOLD F · AK-47", "HOLD X" on a controller, and a button with the
  gun's name on a phone. Hold for 0.35 s. On the pistol with a free slot, walking over a gun takes it at once.
- **Two guns:** your loadout gun and one more. With a free slot, a taken gun goes into your hands. With both full,
  the gun in your hands drops where you stand, so you can take it back.
- **Swap:** Q or the mouse wheel; Y on a controller; on a phone, tap the second-gun button by the ammo counter. A swap
  takes 0.45 s, you can't fire during it, and it cancels a reload.
- **Ammo:** walking over a dropped gun of the kind in your hands takes its ammo, no hold. With both guns dry and a gun
  on the ground within 15 m, the banner says "OUT OF AMMO — GRAB A RIFLE" and dropped guns blink on the minimap.
- **On death:** you come back with your loadout gun only.
- **HUD:** the ammo block shows the gun in your hands, with a line under it for the other gun and its ammo.
- **Controller:** Y now swaps weapons; switching view moves to D-pad ↓. Tapping X still reloads.
- **AK-47:** 600 rpm, 1.1 damage (three hits drop a rifleman out to about 18 m), more kick than the M4, 30 rounds,
  2.3 s reload, iron sights.
- **PKM:** 650 rpm, 1.1 damage, 100-round box, 5.2 s reload, heavy spread from the hip, 82% move speed.
- **Squadmates** don't pick up guns.

**Work**
- `WEAPONS.ak` and `WEAPONS.pkm` marked `pickup`, left out of BATTLE PREP. Their `FALLOFF`, recoil and kick entries.
- Soldier record: `alt` (the other gun: weapon, mag, reserve, attachments) and `swapT`. The gun in your hands keeps
  living in the existing `weapon` / `mag` / `reserve` fields, so every current reader stays correct.
- `weaponDrops`: made in `killEnemy`, replacing the decorative gun baked into that corpse. Updated with timers and the
  hold-to-take progress, drawn in the dynamic layer, shown on the minimap.
- First-person models `GUN_BUILD.ak` and `GUN_BUILD.pkm` with aligned irons, hand holds, magazine or box for the
  reload, muzzle points and ADS lines. The third-person rig uses the same rows.
- Swap animation in `drawViewmodel`: the gun dips out of view and the other comes up.
- Input: Q, the wheel, and hold F; controller Y, D-pad ↓, and X tap versus hold; touch swap and pickup buttons.
  HUD prompt and second-gun line.

**Tests** (`22-pickups.test.js`)
- A rifleman's death leaves an AK drop with a partial magazine; a gunner leaves a PKM; a runner leaves nothing.
- Holding F takes a gun; the M4 is holstered with its ammo intact. With both slots full, the AK drops and the PKM is
  in hand.
- A swap takes 0.45 s, blocks firing, cancels a reload and keeps each gun's ammo.
- Walking over a same-kind gun tops up ammo; on the pistol, walking over a gun takes it. Drops expire at 45 s.
- Death empties the second slot.
- Three AK hits drop a rifleman at 10 m and at 18 m.
- The AK's and PKM's sights sit on the ADS line.
- Controller: Y swaps, D-pad ↓ switches view, a tap on X reloads and a hold picks up.
- Touch: the new buttons appear and go when they should and overlap nothing at 844×390 and 740×360.

## Phase 5 — The suppressor (item 7)

**What you get**
- **BATTLE PREP:** a Muzzle row for the UMP45, M4A1, M249 and Intervention: None or Suppressor.
- **Suppressed:**
  - a dull, quiet shot with no crack, no muzzle flash, and no tracers;
  - enemies only hear you within 10 m (35 m without);
  - aiming down the sights is 12% slower. Damage is untouched, so the M4 still drops a rifleman in three.
- **Enemy hearing:** an enemy who hears a shot knows where the shooter is for 5 s. It turns on them over a nearer
  soldier (up to 1.5× the distance), barks, and takes cover facing them. Squadmates' fire is always loud.
- **Model:** a suppressor can on the barrel; the flash point moves to its end.
- **Picked-up guns** have no suppressor.

**Work**
- `normAtt` gains `supp` for the four guns; old saves load with it off.
- `fire()`: no flash, no tracer, a suppressed sound, and a hearing radius, all driven by `s.supp`. The sight rate
  drops 12%.
- `updateEnemies`: the `heard` record steers target choice and rifleman orders.
- `075-audio-synth.js`: suppressed shot variants for each gun.
- `220-view-guns.js`: the suppressor rows and muzzle offsets; `attSig` includes it so model caches split.
- `320-menu-loadout.js`: the Muzzle row.

**Tests** (`24-suppressor.test.js`)
- The attachment saves and loads, and is dropped for the rocket and picked-up guns.
- A suppressed round has no tracer and no flash, and uses the suppressed sound.
- A rifleman 20 m away behind a building hears an unsuppressed shot and turns on you over a squadmate at 15 m. It
  doesn't hear a suppressed one; it does at 8 m.
- Three suppressed M4 hits still drop a rifleman at 20 m. ADS takes 12% longer.

## Phase 6 — Enemy grenades (item 3)

**What you get**
- **Who throws:** riflemen carry one frag each; gunners carry none.
- **When:** a rifleman throws when a soldier they are fighting has stayed behind cover their rounds can't get through
  for 3 s, 8–22 m away, and nothing solid is in the arc.
- **Limits:**
  - one enemy frag in the air at a time;
  - no more than one every 14 s in the first sector, down to one every 8 s in the hardest;
  - none in the first 25 s of a front, at anyone who respawned in the last 4 s, or into the FOB.
- **The throw:** the thrower shouts. The frag lands within 1–2.5 m of the target and bursts 1.8 s after it lands.
- **Warning:** a red grenade marker shows any live enemy frag within 10 m of you — over the grenade on screen, or
  at the edge of the screen toward it — pulsing faster as the fuse runs down. A squadmate calls "GRENADE".
- **Blast:** 5 m radius, 5 damage at the centre falling to nothing at the edge; you have 4, so within about a metre is
  lethal and 3 m takes about 2. Building walls shield it; it hurts your squad, never enemies, and chews cover.
- **Squadmates** run 7 m clear of a frag that lands near them.

**Work**
- Grenades gain `hostile`; `fragBlast` handles both sides.
- `enemyGrenadeLogic` in the rifleman AI: tracks how long its target has stayed covered and solves a lob from the
  thrower to the target.
- A throttle on `state`; `#nademark` HUD markers; squad evasion in `squadAI`; a `GRENADE` callout tag.
- The cover-balance tests that measure rounds alone switch enemy grenades off.

**Tests** (`52-enemy-grenades.test.js`)
- A hero behind a car for 3 s at 15 m draws a throw that lands within 2.5 m and bursts at least 1.5 s after landing.
- No throw at a hero in the open, beyond 22 m, inside 8 m, in the first 25 s, during the cooldown, with one already
  in the air, or with a building in the arc.
- Damage: at 1 m it kills; at 3 m it does about 2; behind a building wall, nothing. Enemies in the blast are untouched.
- The marker shows for a live frag within 10 m and sits at the screen edge when the frag is behind you.
- A squadmate 3 m from a landed frag is at least 5 m away when it bursts.
- A bot-played front still ends in FRONT SECURED.

## Phase 7 — The rooftop sniper (item 3)

**What you get**
- **When:** from 25% into a front (from the start at tier 3 and up), one enemy marksman at a time takes a perch.
- **Perches:** the bell tower's belfry, the gas station roof, the rail yard's freight wagons, or the mill yard's
  containers. The final list is checked for sight lines.
- **The glint:** a bright star at their scope, visible across the town, for 1.4 s while they line up on someone they
  can see, and brighter when it's you.
- **The shot:** one heavy round for 2.5 damage (two in a row kill), never a headshot. Then they chamber and aim again.
- **Line of sight:** they only shoot what they can see in 3D. Walls, cars and the eaves keep you safe, and they never
  shoot into the FOB.
- **Callout:** your squad calls it: "SNIPER · BELL TOWER".
- **Killing it:** three hits kill it like a rifleman; it is exposed from the chest up above its parapet. Blasts at
  street level don't reach a tower. It ducks for 2 s when rounds crack past.
- **Minimap:** it shows only while glinting.
- **Numbers:** it is one of the eight and costs a ticket.

**Work**
- Raised enemies:
  - `e.z` lifts the rig through `placeRoot`'s `lift`;
  - body and head hit tests, `rayCylT` and the crosshair ray take a base height;
  - blasts ignore targets more than 2.5 m above or below them;
  - no nav or collision on a perch;
  - the corpse stays up there.
- `los3()`: a 3D sight line against buildings and solid cover.
- `ETYPES.sniper`, a `PERCHES` table (floor height, parapet, facing), `sniperAI`, and the spawn rules.
- The glint billboard sized for the screen, the callout, and a minimap rule.
- A sill under the belfry opening, and a sandbag nest on flat roofs.

**Tests** (`54-sniper.test.js`)
- Spawn rules: never before 25% at tier 1, never two at once, always on a free perch.
- Glints for at least 1.4 s before every shot. No shot at a target hidden in 3D; a shot at a target in the open.
- 2.5 damage, never a headshot; two shots kill a full-health hero.
- Three chest hits kill it; a round into the parapet doesn't; a frag at the tower's foot doesn't; it ducks when
  rounds crack past.
- Never shoots anyone inside the FOB. The callout names the perch.
- A bot-played front still ends in FRONT SECURED.

## Phase 8 — Counterattacks (item 3)

**What you get**
- **Trigger:** once you've held an objective for 40 s, the enemy can counterattack it. A banner reads
  "COUNTERATTACK · B", the radio chirps and B's chip pulses red.
- **The attack:** up to four enemies go for it together — those near it, and the next ones to walk on, who arrive at
  spawn zones close to it. They gather out of sight for up to 6 s, then push: riflemen move cover to cover, runners
  charge, and a frag goes in if defenders are dug in (Phase 6 rules).
- **It ends when:**
  - they take B (neutral counts);
  - every attacker is down: "COUNTERATTACK REPELLED", and the enemy loses two extra reserves;
  - 60 s pass.
- **Limits:** one at a time, and 60 s between them. None in the first 60 s of a front, while the Warlord is up, or
  when the enemy has fewer than 4 reserves.

**Work**
- A counterattack director in `135-objectives.js`: timers, target choice and the attacker roster.
- Spawn zones weighted toward the target; attacker orders in the rifleman and melee AI.
- HUD: a `.counter` state on the chip, banner and chirp. Reserve accounting uses `drainEnemy`, so the Warlord's
  ticket stays protected.

**Tests** (`46-counterattacks.test.js`)
- Holding B for 40 s with reserves starts one on B. None before 60 s of front time, with fewer than 4 reserves, or
  while the Warlord is up.
- Up to four attackers are marked; new arrivals spawn within about 30 m of B; the attackers close on B.
- Repelled: "COUNTERATTACK REPELLED", two reserves gone, a 60 s cooldown. Lost: it ends with B lost. Timed out: no
  reward.
- The chip pulses and the banner reads right.
- A whole front with objectives still ends in FRONT SECURED in the expected time.

## Phase 9 — Final audit and release

- The full suite, a soak, and the enemy-fire baseline comparison.
- Measured on a bot-played front with everything on: front length, damage per minute from rounds, and enemy frags,
  sniper shots and counterattacks per front.
- A review of every v7 file: dead code, top-level name clashes, save migration, arrays that must stay bounded, and
  draw calls with drops and glints.
- Docs: header notes for every new system, the README (install, CI), and this plan's status.
- Release: memory updated, a final republish with a changelog, and the first CI run checked.

## Default decisions (changeable)

1. **Deploys:** the tested build goes to `gh-pages`. You switch the site to it once; until then, it keeps deploying
   from `main`.
2. **Battery:** Frame rate defaults to Max and Battery saver to Off. Auto battery saver appears only where the
   browser reports battery (Android and desktop Chrome, not iPhone).
3. **Installed app:** opens full screen in landscape. Updates arrive on the next launch, with no prompt.
4. **Suppressor cost:** slower aiming, not damage, so the M4 keeps its three-hit drop.
5. **Enemy frags:** they never hurt other enemies, and there is no throwing a grenade back.
6. **Controller:** Y swaps weapons, D-pad ↓ switches view, X tap reloads and X hold picks up.
7. **Keyboard:** Q or the mouse wheel swaps weapons; hold F to pick up.
8. **Squadmates** don't pick up guns.
9. **The sniper** never shoots into the FOB.
10. **A repelled counterattack** costs the enemy two reserves.

---

## Status

- **Phase 1 — done.** `tools/test.py` finds Chrome anywhere, measures the window frame (+0×+87 px on macOS), adds
  `--no-sandbox` on Linux, and in CI writes annotations and a summary table. `build.py --site` and
  `.github/workflows/ci.yml` are in. The whole suite passes locally (111 tests). The first GitHub run happens on your
  next push.
- **Phase 2 — done.** Frame rate (Max, 60, 30) and Battery saver (Off, On, Auto at 20%) in SETTINGS. The frame gate
  holds 30 on 60 Hz and 60 on 90 and 120 Hz screens. The Saver preset renders 240 lines; the menus run at 30.
  `57-power.test.js` adds 7 tests; 118 tests pass.
