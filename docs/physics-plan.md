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
