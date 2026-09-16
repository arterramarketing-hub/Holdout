// ============================================================ THE ROOFTOP SNIPER
// From 25% into a front (from the start at tier 3 and up) the enemy can put one marksman at a time on a perch
// (PERCHES: metres, floor height, the sill or sandbags in front of it, the way it faces). Each new enemy that walks on
// has a 35% chance of being it while the slot is free, and not within 40 s of the last one falling. It never moves.
// It picks someone it can see in 3D (los3 from its eye; you before a squadmate at the same range), never anyone in
// the FOB and never anyone so far below that they couldn't look up at it (a slope over SNIPER.steep: your view stops
// at 35° up), and lines up for SNIPER.aim seconds with its scope glinting — brighter when it is you — then fires one heavy
// round (SNIPER.dmg, 2.5 at tier 1 and never enough to drop a full-health soldier in one) and works the bolt for
// SNIPER.chamber. Losing sight of its target starts the aim over. Rounds cracking past it within 2 m send it below its
// cover for SNIPER.duck seconds. It is exposed from its cover's top (e.lip) up and takes a rifleman's hits (three M4
// rounds inside 20 m, four from the square below the bell tower); blasts more than 2.5 m below it don't reach it. Your squad calls it by its perch the first time it glints. On the minimap it shows only while glinting.
const PERCHES = [
  { name: 'Bell tower', x: 38.8, y: 31, z: 15.6, lip: 0.35, face: 0, nest: 'sill' },          // the belfry's east opening, over the church square
  { name: 'Gas station roof', x: 84.7, y: 43.7, z: 3.8, lip: 0.55, face: Math.PI, nest: 'bags' },
  { name: 'Freight wagon', x: 27, y: 17, z: 3.4, lip: 0.55, face: Math.PI / 2, nest: 'bags' },
  { name: 'Mill containers', x: 85, y: 22, z: 2.6, lip: 0.55, face: Math.PI, nest: 'bags' },
  { name: 'Warehouse roof', x: 76, y: 9.6, z: 7.6, lip: 0.4, face: Math.PI / 2, nest: 'bags' },
];
const SNIPER = { aim: 1.4, chamber: 1.6, duck: 2, dmg: 2.5, maxDmg: 3.6, eye: 1.05 * 40, speed: 3200, spread: 0.012, from: 25, gap: 40, chance: 0.35, steep: 0.62 };
function freePerches() {   // perches with nobody on them, far enough from your squad
  const taken = new Set(enemies.filter(e => e.perch).map(e => e.perch));
  return PERCHES.filter(p => !taken.has(p) && soldiers.every(s => !s.alive || Math.hypot(s.x - p.x * PX, s.y - p.y * PX) > 25 * PX));
}
function sniperWanted() {
  if (state.training || !(state.progress >= SNIPER.from || state.tier >= 3)) return false;
  if (enemies.some(e => e.sniper) || state.frontTime - (state.sniperDownAt == null ? -99 : state.sniperDownAt) < SNIPER.gap) return false;
  return freePerches().length > 0 && Math.random() < SNIPER.chance;
}
function perchSniper(e) {   // a new enemy spawned as the marksman: up onto a free perch
  const free = freePerches();
  if (!free.length) return false;
  const p = free[randi(0, free.length - 1)];
  const T = ETYPES.sniper;
  Object.assign(e, { type: 'sniper', r: T.r, col: T.col, ranged: T.ranged, hp: T.hp, maxHp: T.hp,
    x: p.x * PX, y: p.y * PX, z: p.z * PX, lip: p.lip * PX, perch: p, sniper: true, sp: 0, objRole: false, frags: 0,
    aim: p.face, aimT: 0, glint: 0, chamberT: 0, duckT: 0, scanT: 0, tgt: null, called: false, stillT: 1 });   // kneeling from the start
  e.dmg = Math.min(SNIPER.maxDmg, SNIPER.dmg * (1 + 0.12 * (state.tier - 1)));
  return true;
}
function sniperAI(e, dt, vis) {
  e.chamberT = Math.max(0, e.chamberT - dt);
  if (e.duckT > 0) { e.duckT -= dt; e.aimT = 0; e.glint = 0; return; }   // below the cover
  if (e.supp > 0.9) { e.duckT = SNIPER.duck; e.supp = 0; e.aimT = 0; e.glint = 0; return; }
  e.scanT -= dt;
  if (e.scanT <= 0) {   // who it can see from up there
    e.scanT = 0.3;
    let best = null, bs = Infinity;
    for (const s of soldiers) {
      if (!s.alive || inFob(s.x, s.y)) continue;
      const d = Math.hypot(s.x - e.x, s.y - e.y);
      if (d > e.ranged * vis || (e.z + SNIPER.eye - soldierTop(s) * 0.62) / d > SNIPER.steep || !los3(e.x, e.y, e.z + SNIPER.eye, s.x, s.y, soldierTop(s) * 0.62)) continue;
      const score = d * (s.slot === state.controlled ? 0.6 : 1);
      if (score < bs) { bs = score; best = s; }
    }
    if (best !== e.tgt) { e.tgt = best; e.aimT = 0; }
  }
  const t = e.tgt;
  if (!t || !t.alive) { e.tgt = null; e.aimT = 0; e.glint = 0; return; }
  e.aim = Math.atan2(t.y - e.y, t.x - e.x);
  if (e.chamberT > 0) { e.glint = 0; return; }
  e.aimT += dt;
  e.glint = Math.min(1, e.aimT / SNIPER.aim);
  if (!e.called) sniperCallout(e);
  if (e.aimT >= SNIPER.aim) { sniperShot(e, t); e.aimT = 0; e.glint = 0; e.chamberT = SNIPER.chamber; }
}
function sniperShot(e, t) {   // one heavy round in 3D, from the scope's eye line to the chest
  const mz = e.z + SNIPER.eye, tz = soldierTop(t) * 0.62, dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy) || 1;
  const spread = SNIPER.spread * (t.sprinting ? 1.6 : 1) * (t.moving ? 1.3 : 1);
  const a = Math.atan2(dy, dx) + rand(-1, 1) * spread, el = Math.atan2(tz - mz, d) + rand(-1, 1) * spread * 0.6, h = Math.cos(el);
  bullets.push({ x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20, z: mz, ballistic: true,
    vx: Math.cos(a) * h * SNIPER.speed, vy: Math.sin(a) * h * SNIPER.speed, vz: Math.sin(el) * SNIPER.speed, life: e.ranged * 1.2 / SNIPER.speed, tracer: true,
    hostile: true, dmg: e.dmg, wkey: null, slot: null, hits: 0, maxHits: 1, aoe: 0, skip: null, srcType: 'sniper' });
  e.atk = 0.2; e.shots = (e.shots || 0) + 1; e.firedT = state.frontTime;
  const far = distMul(e.x, e.y);
  playBuf(far < 0.5 && SFX.buf['gunf:sniper'] ? 'gunf:sniper' : 'gun:sniper:0', { gain: 0.5 * Math.max(far, 0.3), rate: rand(0.95, 1.02), x: e.x, y: e.y, lp: 1600 + 16000 * far * far, force: true });
  state.lastContact = { x: e.x, y: e.y };
}
function sniperCallout(e) {   // the squad names the perch the first time the scope flashes, if you are in the fight
  const me = soldiers[state.controlled];
  if (!me || !me.alive || dist2(me.x, me.y, e.x, e.y) > 2600 * 2600) return;
  e.called = true;
  state.callout = { side: 'sniper', name: e.perch.name, dist: Math.round(Math.hypot(me.x - e.x, me.y - e.y) / PX), t: 2.2 };
  VOICE.callCd = Math.max(VOICE.callCd, 2.2);
  playBuf('radio', { gain: 0.28, force: true });
}
