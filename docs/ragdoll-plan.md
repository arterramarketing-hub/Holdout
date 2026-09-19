# Ragdolls, begun by the three canned falls

The ask (Sep 19, 2026): "execute the ragdoll plan with the 3 canned death falls." Read as: keep the three falls —
back (hit from the front), forward (hit from behind), blast — and let physics finish every one of them.

## How a death plays

1. **The canned fall opens it.** `poseDeath` plays exactly as now: the jolt, the knees starting to go.
2. **The ragdoll takes over** from that pose and that motion at the hand-off: 0.3 of the way through a back or forward
   fall (after the jolt, as the knees buckle), 0.04 through a blast (thrown almost at once). It adds the kill's own push:
   along the round (heavier for heavier guns), or outward and up from a blast.
3. **It comes to rest** — slumped over sandbags, against a car, on a roof or off its edge — and when still for 0.4 s
   (or after 4 s) its final pose is baked into the corpse layer, the same static batches corpses use now.

## The body

15 points: pelvis, hips, knees, feet, neck, shoulders, elbows, hands, the top of the head. Bones are rigid sticks; the
torso and pelvis are one rigid block; knees bend forward only; hip-to-foot, shoulder-to-hand and pelvis-to-head have
ranges so nothing folds flat. Verlet integration at 1/120 s, six solver passes, gravity 9.8 m/s². Collision with the
ground, and with the buildings and cover near where the body starts (boxes and drums, by their real tops), with friction.
The rig's parts are driven from the points by writing each joint's world matrix — the same way the dropped-gun and
first-person rigs already work — so every model, uniform and scale renders unchanged.

## Limits

- At most 8 at once; a ninth death plays its canned fall to the end. So does one that starts inside a building's box
  (the belfry marksman). The canned falls are the fallback, not gone.
- View only: no draws from the simulation's dice, no effect on anything the fight reads. Tests prove both.
- A squad soldier's ragdoll carries across the moment the simulation turns their body into a corpse.
- The blood pool under a corpse moves to where the body actually came to rest.

## Tests

The three falls each hand over at their moment and come to rest lying down; front shots fall back, back shots
forward, blasts throw; a body beside sandbags drapes over them, never through; nothing ends inside a wall; the cap
holds and every body bakes; a squad soldier's ragdoll survives becoming a corpse; no NaNs; no sim dice.

## Status

Built: `src/js/245-view-ragdoll.js`, wired into `drawBody` (squad) and `syncCorpses` / `bakeCorpse` (corpses) in
250-view-characters; the simulation records each death's `hit` (unit), `kick` (m/s) and `blast` (110-combat, 166).

What changed from the plan while building it, and why:
- **Hand-off moved from 0.3 to 0.5 of a fall.** At 0.3 a forward fall has not yet begun to tip — the canned jolt leaves
  the torso leaning back — so physics let those bodies sit down backwards. At 0.5 each fall has committed to its own
  direction, and more of each canned fall shows. Blasts still hand off at 0.04.
- **Contacts are dead, not springy.** A push-out from the ground used to become speed (Verlet reads position change as
  velocity) and threw bodies 0.8 m into the air; a contact now removes only the velocity into the surface.
- **Knees are set back on the hip-foot line, not reflected across it** — the reflection overshot and kept a body rocking.
- **Rest is also judged by drift** (pelvis and neck moving under 3 cm in two 0.25 s windows), and a body with four or more
  points down loses 10% of its motion a step: a small wobble never dropped under a speed threshold.
- **The cap follows the quality preset** (8 High, 5 Medium, 3 Low, 2 Saver): 0.05 ms a ragdoll-frame here is ~0.4 ms for
  eight, perhaps 2–3 ms on a phone for the two seconds after a multi-kill.
- **The ragdoll's previous-positions array is `O`, not `Q`** — `Q` shadowed the quality preset inside `ragStart`.
- **Your death camera follows your ragdoll.** It orbited the spot you died on; a blast now throws a body ~4 m, so it
  would have circled empty ground. It centres on the ragdoll's pelvis while you are down (a test checks it looks at the body).

Measured: shot from the front the head comes to rest 1.0 m past the feet away from the shooter, on the back; from
behind 0.9 m the way they faced, face down; a blast throws the body ~3.8 m along it; all at rest 1.9–2.6 s after the kill.
Tests: tests/suites/59-ragdolls.test.js (9).
