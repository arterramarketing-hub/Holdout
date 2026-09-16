// ============================================================ OBJECTIVES
// Every sector is fought over three of the town's landmarks, lettered A-C from north to south. Each has a flag and a
// 7 m ring. Only one side standing in the ring moves it: one soldier takes an objective from the enemy in 12 s, two in
// 9 s, three or more in 7 s (half of that to neutral, half to yours); both sides in the ring freeze it. Taking one
// costs the enemy two reserves at once. Holding more objectives than they do drains a reserve every 4 s (every 2 s
// with all three); they never lose reserves still standing on the field that way, and the Warlord still has to be
// killed. Holding more than you do costs your squad a reinforcement every 20 s, after the first 45 s of the front.
// COUNTERATTACKS: once you have held an objective for COUNTER.held s, the enemy can come back for it (checked every
// COUNTER.check s at COUNTER.chance), on the one you hold with the fewest of your squad near it. A banner and the radio
// say so and its chip pulses red. Up to four attackers — the nearest on the field, then whoever walks on while they
// gather, at spawn zones near it — gather for up to COUNTER.gather s, then push into the ring: riflemen cover to cover
// on short holds, runners and breachers straight at it, a frag for anyone dug in. It ends when they take it (neutral
// counts), when every attacker is down (COUNTERATTACK REPELLED: two more reserves gone), or after COUNTER.max s. One
// at a time, COUNTER.gap s apart; none in a front's first COUNTER.first s, while the Warlord is up, or with fewer than
// COUNTER.reserves reserves left.
const OBJ_SITES = [   // open ground at each landmark, metres
  { name: 'Rail yard', x: 36.5, y: 12.5 },
  { name: 'Market', x: 16, y: 41.5 },
  { name: 'Church square', x: 49, y: 38 },
  { name: 'Gas station', x: 76, y: 40 },
  { name: 'Building site', x: 33, y: 61.5 },
  { name: 'Cemetery', x: 16.5, y: 63.5 },
];
const SECTOR_OBJ = [null, [0, 2, 5], [1, 2, 3], [0, 3, 4], [1, 3, 5], [0, 1, 4], [2, 3, 5], [0, 2, 4], [1, 2, 4], [0, 3, 5], [2, 3, 4], [0, 1, 3], [1, 2, 5]];
const OBJ = { r: 7 * PX, flip: [0, 12, 9, 7], capSpend: 2, drainHold: 4, drainAll: 2, squadDrain: 20, grace: 45 };
const COUNTER = { held: 40, check: 5, chance: 0.35, first: 60, reserves: 4, attackers: 4, gather: 6, max: 60, gap: 60, reward: 2 };
const objectiveSites = tid => (SECTOR_OBJ[tid] || SECTOR_OBJ[1]).map(i => OBJ_SITES[i]).sort((a, b) => a.y - b.y || a.x - b.x);
function setupObjectives(sites, opts = {}) {   // every objective starts in enemy hands (a training flag can start neutral)
  state.objs = sites.map((o, i) => ({ letter: String.fromCharCode(65 + i), name: o.name, x: o.x * PX, y: o.y * PX, r: (o.r || 7) * PX,
    cap: opts.neutral ? 0 : -1, owner: opts.neutral ? null : 'e', inP: 0, inE: 0, contested: false, flashT: 0, speed: opts.speed || 1, heldSince: null }));
  state.objDrainT = OBJ.drainHold; state.squadDrainT = OBJ.squadDrain; state.objMsg = null;
  state.counter = null; state.counterNext = COUNTER.first; state.counterCheckT = COUNTER.check;
  state.noDrain = !!opts.noDrain;
}
const objHeld = side => state.objs.reduce((n, o) => n + (o.owner === side ? 1 : 0), 0);
function updateObjectives(dt) {
  if (!state.objs || !state.objs.length) return;
  for (const o of state.objs) {
    let p = 0, e = 0;
    const r2 = o.r * o.r;
    for (const s of soldiers) if (s.alive && dist2(s.x, s.y, o.x, o.y) < r2) p++;
    for (const en of enemies) if (!en.perch && dist2(en.x, en.y, o.x, o.y) < r2) e++;   // a marksman up on a roof holds nothing
    o.inP = p; o.inE = e; o.contested = p > 0 && e > 0;
    o.flashT = Math.max(0, o.flashT - dt);
    if (state.objMsg && (state.objMsg.t -= dt / state.objs.length) <= 0) state.objMsg = null;
    if (o.contested || (!p && !e)) continue;
    const rate = 2 / OBJ.flip[Math.min(3, p || e)] * o.speed, was = o.owner;
    o.cap = clamp(o.cap + (p ? rate : -rate) * dt, -1, 1);
    if (o.cap >= 1) o.owner = 'p';
    else if (o.cap <= -1) o.owner = 'e';
    else if ((o.owner === 'p' && o.cap <= 0) || (o.owner === 'e' && o.cap >= 0)) o.owner = null;   // neutral once it crosses the middle
    if (o.owner !== was) objectiveChanged(o);
  }
  if (state.noDrain) return;
  updateCounterattack(dt);
  const mine = objHeld('p'), theirs = objHeld('e');
  if (mine > theirs) {
    state.objDrainT -= dt;
    if (state.objDrainT <= 0) { state.objDrainT = mine === state.objs.length ? OBJ.drainAll : OBJ.drainHold; drainEnemy(1); }
  } else state.objDrainT = OBJ.drainHold;
  if (theirs > mine && state.frontTime > OBJ.grace) {
    state.squadDrainT -= dt;
    if (state.squadDrainT <= 0) { state.squadDrainT = OBJ.squadDrain; if (state.tickets > 0) { state.tickets--; OV.ticketHit = 1; } }
  } else state.squadDrainT = OBJ.squadDrain;
}
function objectiveChanged(o) {
  o.flashT = 1.4;
  o.heldSince = o.owner === 'p' ? state.frontTime : null;
  const text = o.owner === 'p' ? `Objective ${o.letter} taken` : o.owner === 'e' ? `Objective ${o.letter} lost` : `Objective ${o.letter} neutral`;
  state.objMsg = { text, good: o.owner === 'p', bad: o.owner === 'e', t: 2.4 };
  if (o.owner === 'p') { drainEnemy(OBJ.capSpend); beep(660, 0.12, 'square', 0.05); beep(990, 0.22, 'square', 0.05, 0, 0.12); buzz(30); }
  else if (o.owner === 'e') { beep(520, 0.14, 'square', 0.05); beep(330, 0.3, 'square', 0.05, 0, 0.14); }
  else beep(760, 0.08, 'square', 0.03);
}
function enemyReservesLeft() { return state.enemyTotal - state.enemyDown - enemies.reduce((k, e) => k + (e.boss ? 0 : 1), 0) - (state.bossRef ? 1 : 0); }
function updateCounterattack(dt) {
  const C = state.counter;
  if (C) {
    C.t += dt;
    C.attackers = C.attackers.filter(e => enemies.includes(e));
    if (C.phase === 'gather' && (C.t >= COUNTER.gather || (C.attackers.length >= 3 && C.attackers.every(e => dist2(e.x, e.y, C.obj.x, C.obj.y) < 1000 * 1000)))) {
      C.phase = 'push';
      for (const e of C.attackers) { e.tacT = Math.min(e.tacT || 0, 0.2); e.pathT = 0; }
    }
    if (C.obj.owner !== 'p') endCounterattack('taken');
    else if (state.bossRef) endCounterattack('warlord');
    else if (C.phase === 'push' && !C.attackers.length) endCounterattack(C.joined ? 'repelled' : 'none');
    else if (C.t >= COUNTER.max) endCounterattack('timeout');
    return;
  }
  state.counterCheckT -= dt;
  if (state.counterCheckT > 0) return;
  state.counterCheckT = COUNTER.check;
  if (state.training || state.frontTime < Math.max(COUNTER.first, state.counterNext) || state.bossRef || enemyReservesLeft() < COUNTER.reserves) return;
  const held = state.objs.filter(o => o.owner === 'p' && o.heldSince != null && state.frontTime - o.heldSince >= COUNTER.held);
  if (!held.length || Math.random() >= COUNTER.chance) return;
  const guard = o => soldiers.reduce((k, s) => k + (s.alive && dist2(s.x, s.y, o.x, o.y) < 600 * 600 ? 1 : 0), 0);
  held.sort((a, b) => guard(a) - guard(b) || a.heldSince - b.heldSince);
  startCounterattack(held[0]);
}
function startCounterattack(o) {
  state.counter = { obj: o, t: 0, phase: 'gather', attackers: [], joined: 0 };
  const near = enemies.filter(e => !e.boss && !e.perch && !e.target).sort((a, b) => dist2(a.x, a.y, o.x, o.y) - dist2(b.x, b.y, o.x, o.y));
  for (const e of near.slice(0, COUNTER.attackers)) joinCounterattack(e);
}
function joinCounterattack(e) {   // this enemy goes for the objective under counterattack
  const C = state.counter;
  if (!C || C.phase !== 'gather' || C.attackers.length >= COUNTER.attackers || e.boss || e.perch || e.target) return false;
  C.attackers.push(e); C.joined++;
  e.counterObj = C.obj; e.tacT = Math.min(e.tacT || 0, 0.3); e.pathT = 0;
  if (C.joined === 1) {   // someone is actually coming: now say so
    showBanner('COUNTERATTACK · ' + C.obj.letter);
    playBuf('radio', { gain: 0.3, force: true });
  }
  return true;
}
function endCounterattack(how) {
  const C = state.counter;
  for (const e of C.attackers) e.counterObj = null;
  state.counter = null;
  state.counterNext = state.frontTime + (how === 'none' ? 0 : COUNTER.gap);   // one nobody ever joined costs nothing
  if (how === 'repelled') {
    drainEnemy(COUNTER.reward);
    showBanner('COUNTERATTACK REPELLED');
    beep(660, 0.12, 'square', 0.05); beep(990, 0.22, 'square', 0.05, 0, 0.12);
  }
  state.counterLast = how;
}
function drainEnemy(n) {   // reserves spent without a kill: never the ones standing on the field, never the Warlord's own ticket
  const onField = enemies.reduce((k, e) => k + (e.boss ? 0 : 1), 0);
  const next = Math.min(state.enemyTotal - onField - 1, state.enemyDown + n);
  if (next <= state.enemyDown) return 0;
  const got = next - state.enemyDown;
  state.enemyDown = next;
  state.progress = Math.min(state.bossRef ? 99 : 100, state.enemyDown / state.enemyTotal * 100);
  return got;
}
function enemyObjective(e) {   // theirs under attack first, then the nearest they don't hold, then the nearest of theirs
  let best = null, bs = Infinity;
  for (const o of state.objs || []) {
    const s = Math.hypot(o.x - e.x, o.y - e.y) + (o.owner === 'e' ? (o.inP > 0 ? -1200 : 700) : 0);
    if (s < bs) { bs = s; best = o; }
  }
  return best;
}
function squadObjective(s) {   // the nearest objective your squad doesn't hold, the one Point is taking if Point has one
  if (!state.objs || !state.objs.length) return null;
  const pointing = state.squadObj && state.squadObj.owner !== 'p' ? state.squadObj : null;
  if (pointing && s.slot !== 1) return pointing;
  let best = null, bd = Infinity;
  for (const o of state.objs) { if (o.owner === 'p' && o.cap >= 1) continue; const d = Math.hypot(o.x - s.x, o.y - s.y) + (o.contested ? -300 : 0); if (d < bd) { bd = d; best = o; } }
  if (s.slot === 1) state.squadObj = best;
  return best;
}
