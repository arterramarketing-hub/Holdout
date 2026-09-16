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

- **Phase 1 — done** (556a180). Tags use the new `--mate` green; enemies `#3a3c41` jackets / `#2d2f33` trousers with a
  `#c4302a` armband part on both upper arms (ENEMY_LEGS, so every type including the breacher and the Warlord).
- **Phase 2 — done** (0737a32). The minimap draws through one rotation (`P()`), not a canvas transform, so letters and
  marks stay upright. Enemies carry `firedT`; the minimap shows them for `MINIMAP_FIRED` (1.5 s) after it.
  *Deviation:* the old rule also showed any enemy inside 24 m; dropped, so the UAV means something (called out to the user).
- **Phase 3 — done** (cd7c8f1). `AIRSTRIKE` = 7 bombs 85 px apart timed to the jet's pass, r 95, 4 to enemies, 2 to you.
  Artillery, the care package, `sfxOutgoing`, `sfxBuy` and the crate drop are deleted. Frags are no longer topped up
  mid-life (the care package was the only way).
- **Phase 4 — done** (d4cc723). `bleed()` rolls `fxRand`, never `Math.random`; a test counts the fight's draws while
  bleeding and requires zero. Found on the way: the first test battle after a page load does not replay like the ones
  after it on the same seed (state that outlives a battle — most likely the sector forecast, cleared only when a fight
  ends). Pre-existing, affects tests only; noted, not changed.
- **Phase 5 — done** (f231925). `tombstone()` in 270-view-environment, instanced through `staticMatrices` so a leaning
  stone's parts pivot together. Every stone checked under 0.97 m against the 0.9 m rounds stop at.
- **Phase 6 — audit, done.** Every diff since b826532 read again. Two findings, both fixed with tests:
  a round into a breacher's riot shield (30% damage, a spark) also bled (`shielded`); and behind a magnified optic, the
  new teammate tags — like the objective letters before them — drew on the scope's blackout outside the glass
  (`outsideGlass`). Looked at in the running game: the tags, the uniforms side by side, blood on a hit and on the ground,
  the headstones, the turning minimap under a UAV, the airstrike's bombs. The full suite (five window sizes) and the soak
  pass on the final code.
- **Phase 7 — physics:** answered in the report to the user; nothing built.
