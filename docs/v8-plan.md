# Holdout v8 — reading the fight

The ask (Sep 16, 2026): green triangles with names over teammates; enemy uniforms more unlike ours; no "enemy flank"
toasts, because they take the skill out of it; a minimap that turns with you; killstreaks at 2 (UAV, revealing
enemies on the map), 4 (napalm) and 6 (airstrike); blood when enemies are hit; graves that look like tombstones, not
bricks; no helmet on a stake where soldiers fall. Then check the work, and say whether the physics can do better
destruction and ragdolls.

Work happens on branch `v7` in `.claude/worktrees/v7` and is fast-forwarded into `main` only after a phase passes,
so a GitHub Desktop commit can never catch a half-finished build.

## Phases

1. **Friend or foe.** A green triangle and the soldier's name over each living teammate, projected from the head each
   frame like the objective letters; the name only inside 35 m so a far squad stays uncluttered. Enemies change from
   olive-grey to dark charcoal with a red armband — value contrast survives fog, dusk and the N64 dither where hue
   does not. The minimap draws teammates in the same green.
2. **Information you earn.** The squad's "Flank · left · 12 m" / "Behind" toasts go, with the Callouts setting that
   only governed them (the grenade warning stays: it is a danger cue, not intel). The minimap turns with you — heading
   up, your arrow fixed pointing forward, letters kept upright. Enemies show on it only while firing, not merely for
   being within 24 m, so the UAV is worth having.
3. **Killstreaks.** UAV at 2 kills: every enemy on the minimap for 30 s, a sweep on the map while it flies. Napalm at
   4: the existing strike, named NAPALM. Airstrike at 6: a jet crossing the enemy cluster laying a stick of bombs
   along its path. Artillery and the supply drop are removed, code and all.
4. **Blood.** A hit throws a short dark-red mist and droplets from the height the round actually struck, sprayed
   along its path; the ground behind takes a splat; the fallen leave a pool. Splats are capped and fade.
5. **The cemetery and the fallen.** Headstones in four shapes (round-topped, cross, pointed, low slab) on plinths, in
   weathered stone of slightly different tones, a few leaning. The battlefield cross — rifle, helmet, boots — that
   was left where a soldier fell is removed.
6. **Audit.** The full suite on five window sizes and the soak; every diff read again; the findings fixed with tests.
7. **Physics.** A written answer on destruction and ragdolls: what the engine does now, what a physics library would
   cost on a phone, and what can be had without one.

## Status

_Filled in as each phase lands._
