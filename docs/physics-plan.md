# A real physics engine, in the view

The ask (Sep 22, 2026): "do the real physics engine", after the write-up that ended the destruction work. That
write-up's recommendation stands and is the shape of this: **the engine runs in the view only.** The fight keeps its
own deterministic rules — rounds, cover health, what stands and what has been shot away, movement, sight — because
the tests and the seeded replays depend on them. Physics owns what the fight does not read: the pieces that come off
cover, the bodies that fall, and everything a blast throws.

## The engine

**cannon-es 0.20.0**, `https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js`, loaded with a dynamic import
beside three.js and cached by the service worker the same way.

Not Rapier, though Rapier is faster: Rapier is WebAssembly, and the Artifact page this game is played on may refuse
to compile WebAssembly at all. cannon-es is plain JavaScript from the same CDN three.js already comes from, so it
runs wherever the game runs — 346 KB, no `Math.random` anywhere in it, rigid bodies, cone-twist and hinge joints,
sleeping, sweep-and-prune broadphase, raycasts. If it fails to load, every death plays its canned fall and cover
loses its pieces without throwing them: the game is whole without it.

## The world

One `CANNON.World` built with the battle and kept in step with it:

- **Ground**, a static plane; **buildings**, static boxes to their real tops; **cover**, a static box per standing
  chunk column (or per piece for the kinds that do not come apart), rebuilt whenever the cover changes — the same
  moment the view rebuilds its props.
- Stepped at a fixed 1/120 s from an accumulator on **world time**, so slow motion slows the physics too, at most
  four steps a frame. Solver iterations follow the quality preset (10 High / 8 Medium / 6 Low / 4 Saver).
- Sleeping on, so a street full of rubble costs almost nothing once it has settled.

## What physics takes over

1. **The pieces are the pieces.** A chunk knocked off cover no longer puffs into generic chunks: the model that was
   standing there — a sandbag, a crate, a wall block and its coping, a jersey segment, a log, a fence paling — becomes
   a rigid body thrown from where it stood, along the round or out of the blast, and it tumbles, hits the ground,
   the wall it came from and the other pieces, and comes to rest lying in the street. A little dust goes with it.
2. **Destroyed cover bursts.** When a piece of cover is destroyed outright, everything still standing on it is thrown
   at once. A barrel or a propane tank goes up with its drum.
3. **Bodies.** The three canned falls still open every death, and at the same moments as now the body becomes a
   ragdoll — but a real one: eleven rigid limbs on cone-twist and hinge joints, with limits, mass and friction,
   colliding with the ground, cover, buildings and the rubble that is already lying there. It sleeps, and is baked
   into the corpse layer exactly as now.
4. **Blasts move the world.** An explosion pushes every loose piece and every live body in its radius, with falloff.
   A blast beside a corpse that has already settled wakes it and throws it again, if a ragdoll slot is free.

## What physics does not touch

Rounds, line of sight, the crosshair, movement, navigation and cover health stay exactly as they are. Fallen pieces
are scenery: rounds pass through them, the AI does not see them. Nothing in the fight ever reads a physics result,
and a test holds that line by counting the fight's dice while the world is full of tumbling debris.

## Phases

1. **The world.** Engine loaded, world built and kept, static colliders, fixed step on world time, quality settings,
   the existing debris moved onto rigid bodies, the fallback when the engine is missing. Tests.
2. **The pieces themselves.** Real models thrown off cover, drawn through dynamic batches that share the props'
   geometry and materials; destroyed cover bursting; barrels flying. Tests.
3. **Bodies.** Rigid-body ragdolls with real joints replacing the Verlet solver, the same hand-off and the same
   resting-and-baking; blast impulses; corpses thrown again by a later blast. Tests, including the nine claims the
   Verlet ragdolls already had to meet.
4. **Polish and ship.** Measure the cost on a full street, tune iterations, sleep and the caps per quality preset,
   audit, the whole suite and the soak, docs, publish.

## Status

Built: `src/js/243-view-physics.js` (the world, loose pieces, blasts), `src/js/245-view-ragdoll.js` rewritten on rigid
bodies, `coverPieces` / `throwPieces` / `burstBroken` / `throwDrum` in 270-view-environment, `wakeCorpses` in
250-view-characters. The simulation only gained two queues it never reads back — `BROKEN` (cover destroyed) and
`BLASTS` (what went off) — and a push direction on each hit to cover. Tests: tests/suites/62-physics.test.js (15), and
the nine claims in 59-ragdolls hold unchanged on the new ragdolls.

What changed from the plan while building it, and why:
- **One list of pieces per kind (`coverPieces`) draws the standing cover and throws the loose pieces**, so a model
  that stood and the body that falls can never disagree. The six chunked kinds' drawing moved into it.
- **Stepped at 1/60 s, not 1/120.** Half the cost, and the ragdoll and destruction tests hold the same: the worst
  street measured (eight bodies falling, ninety pieces lying about, a blast through them) went from 2.8 ms of physics
  a frame on High to 1.4 ms on the dev Mac; Low is 0.4 ms.
- **A body that starts partly inside cover or a wall is moved out of it whole.** Moved limb by limb, a joint was
  stretched and the solver snapped the body back the wrong way; and low cover lifts the body onto it (up to 45 cm) —
  that is what makes a body shot beside sandbags drape across them instead of sitting against them.
- **Only a pelvis inside a building keeps the canned fall** (the belfry marksman). A head that the canned fall had
  already put into a wall is cleared out of it with the rest of the body.
- **Limbs do not collide with each other.** A canned pose was never drawn to keep them apart; the joint cones keep the
  body from folding through itself.
- **A joint whose canned pose starts past its range gets that much room for that body**, rather than being snapped in.
- **Grit shrinks away after four to six seconds; the pieces themselves stay as rubble**, up to the quality cap. A
  ten-centimetre chip wedged between two bags spun itself up forever; anything loose is also held under 18 rad/s, and
  after three seconds a near-still piece is allowed to sleep.
- **A jersey segment is tipped from its top**, hard enough to go over its edge (the ground takes half the spin at once).
- **A drum that goes up is an empty shell** (so its own blast can throw it), and its own throw is small: the blast does
  the lifting.
- **A zero ragdoll cap now means zero** (`ragCap`), rather than falling back to eight.

Found while building it, fixed afterwards (Sep 23, 2026): the fight's dice (Math.random) were being rolled by things
that are not the fight, so a seeded fight played out differently depending on what was drawn, what sounds had played,
and whether it was the first battle on the page. Every one of them now rolls its own dice:
- **three.js** gives every mesh, material and geometry a random id, and the view makes those lazily — about 580 of the
  fight's dice in a page's first battle. All view work (`renderView`, `viewEnterBattle`, `initView`, the HUD) runs
  inside `viewFenced`, where Math.random is the view's own `fxRand` for the duration.
- **the view's own rolls**: a new character's walk phase and idle variety, muzzle flashes, ejected brass, dropped
  magazines, camera shake (every frame), lightning (every frame in rain) — now `fxRand`; the brass and magazine
  sounds — now the sound's dice (`aRnd`/`aRand`/`aRandi`).
- **sound**: the noise and echo buffers built the first time a sound plays (~247,000 draws, once per page), the looping
  noise start, the music (rolled on its own real-time schedule), the thinning of the squad's gunfire sounds — `aRnd`.
- **the weather forecast**, rolled when a briefing first shows a sector and cached: the first deploy drew no dice and
  every later one drew four. It has its own dice now (`skyRand`).
- **not dice, but the same effect**: recoil recovery ran in the camera update, so a fight that was not drawn never
  recovered its aim — it runs in the tick now (`settleAim`); first-person movement waited for the camera to copy your
  aim — it reads the aim; the eye height a round leaves from read the camera's eased value — it is the constant it always
  settled to (`EYE_Y`); and spawn zones remembered the last battle's arrivals — reset when a battle starts.
Tests: tests/suites/63-fair-dice.test.js — the view rolls none of the fight's dice; a seeded fight plays out the same
drawn or not; the first battle on a page plays out like the ones after it.
