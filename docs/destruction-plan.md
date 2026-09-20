# Destruction: cover built of pieces, and the gaps you shoot in it

The ask (Sep 19, 2026): "do the destruction plan with chunked cover and debris." Read as: cover is made of pieces
that come off where you hit it, the game tracks the shape that is left, and a gap you blow through a sandbag wall
is a real firing lane — not a wall that quietly loses height everywhere at once, which is what it does today.

## Today

A piece of cover is one box with one height and one hp bar. At half health it swaps to a shorter, battered look
(`COVER_HURT`: crates 0.5, sandbags 0.67, wall 0.55, woodpile 0.66) and the whole top drops, wherever you shot it.
At zero it turns into a rubble pile.

## The chunk grid

Six kinds are already drawn as separate pieces, so they get a grid whose cells line up with those pieces:

| kind | grid (along × up) | the pieces it already draws |
|---|---|---|
| crates | 2 × 2 | four boxes on the ground, one on top |
| sandbags | 4 × 3 | three layers of bags |
| wall | 4 × 2 | one box and a coping — **redrawn as eight blocks** so the gaps read |
| barrier | 3 × 1 | three jersey segments |
| woodpile | 3 × 3 | three rows of three logs |
| fence | 4 × 1 | palings and two rails |

A piece carries `chunks`, a bitmask (bit `r * cols + c`), all ones when it is built. Columns run along the piece's
long axis in the same local frame the view draws in, so cell and model always agree, rotated or not.

Cars, vans, dumpsters, barrels, propane, pumps and tankers are not chunked: they already deform into wrecks or go up.

## Losing pieces

`damageCover(ob, dmg, credit, hx, hy)` now knows where it was hit. After the hp drops, the number of chunks left is
`ceil(hp / maxHp × total)`, never below one, and the ones that go are chosen **nearest the hit column first, top
down inside that column**. So sustained fire on one spot drills a hole through a wall instead of sanding the whole
thing down; a blast takes its chunks from where it went off. No dice are rolled — same fight, same seed, same holes.

At zero hp the piece is destroyed exactly as now: rubble, dust, its wreck if it has one, its blast if it has one.

## The shape the fight reads

- `coverTopAt(ob, x, y)` — how high the cover stands at that point, **0 where a column is gone**. Rounds use it, so
  a round through the gap carries on; every kind that is not chunked answers with its one height as before.
- `coverRayT(ob, …)` — a ray against what is left: one test on the whole footprint first, and only if that hits does
  it test each standing column. Line of sight (`los3`) and your crosshair both go through it, so a gap you blew is a
  lane you can see, aim and be shot through, and the AI sees through it too.
- `coverTop(ob)` stays "the highest point of what is left" for grenade arcs, AI peeking and ragdoll collision.
- **Movement does not change.** The footprint still blocks and the nav grid is untouched: bags knocked off a wall
  are still knee-deep rubble on the ground, and nothing re-routes mid-fight.

`COVER_HURT` goes away — the chunk grid covers all four kinds that used it.

## Debris

The view diffs each piece's mask against what it last drew. Every chunk that went spawns two or three tumbling
pieces in the cover's own material, thrown out of the hole, with gravity, a bounce, friction and a settle, then
they fade. Capped by the quality preset (90 High / 60 Medium / 30 Low / 14 Saver), oldest first. View only: no
dice from the simulation, nothing the fight reads. A chunk coming off also cracks — quieter than a piece collapsing.

## Tests

Fire at one end of a sandbag wall: the chunks go there, that column's top drops to nothing, the far column stands
full height. A round through the gap reaches an enemy behind that the full wall stopped; line of sight opens through
the same gap; the crosshair reads the enemy through it. Half health leaves half the chunks. The last chunk holds
until hp runs out, then the piece is destroyed as before. A blast takes chunks from where it went off. Same seed,
same masks. Debris appears when chunks go, stays under the cap, and never touches the simulation.

## Status

Built: `COVER_CHUNKS`, `chipCover`, `chunkCol`/`chunkStack`/`chunkBox` and a hit point on `damageCover` (050-town);
`coverFull`/`coverTop`/`coverTopAt`/`coverRayT` (110-combat); rounds, sight lines, the crosshair, grenade arcs and
bounces all read the standing shape; the six kinds draw piece by piece and throw debris (270-view-environment).

What changed from the plan while building it, and why:
- **Cover gets a notch before it gets a hole.** A column's top drops as its pieces come off, so rounds start going
  over the damaged column while its bottom layer still stands — about seven M4 rounds into one spot on sandbags.
  That is the firing lane in practice; a full-height gap wants a blast, or fire that follows the top down.
- **A stone wall is drawn as eight blocks and a coping over each column**, because one box with a coping had no way
  to show a hole. Sandbags, crates, the jersey barrier, the woodpile and the fence were already drawn piece by piece.
- **`coverTop` is cached on the piece** (`_top`, cleared when pieces come off). Sight lines ask for it constantly.
- **Ragdolls collide with the standing columns**, not the whole footprint, so a body falls through a blown gap.
- **Debris is flat lit colour** (like the flags), not the atlas material: a plain box in the atlas material samples
  the whole texture and comes out black.
- **Found and fixed an old bug while looking at this**: the cover batches kept the bounding sphere they were first
  culled against, so cover rebuilt somewhere else in the arena could be dropped from the frame entirely. Each rebuild
  now clears it.

Measured: twenty M4 rounds into one end of a sandbag wall take it from 40 to 29.5 health and thirteen of them reach
the man behind it; the far end still stops everything. Tests: tests/suites/61-destruction.test.js (10).
