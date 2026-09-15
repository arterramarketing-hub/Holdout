// ============================================================ COMBAT CORE
const HITFX = { hit: 0, kill: 0, head: 0 };   // hitmarker flashes on the crosshair
// Damage drop-off. A round does full damage out to `near`, then falls in a straight line to `min` by
// the time it has flown the weapon's whole reach. Distances in px (40 px = 1 m). Sniper and rocket are
// absent on purpose: a .50 does not care how far it went, and a blast is handled by its own radius.
const FALLOFF = {
  smg:    { near: 400, min: 0.60 },   // full to 10 m, 60% by 22 m: 4 rounds on a rifleman up close, 5 at 15 m
  ar:     { near: 800, min: 0.60 },   // full to 20 m, 60% by 37 m: 3 rounds on a rifleman anywhere in the square
  lmg:    { near: 640, min: 0.55 },   // full to 16 m, 55% by 35 m
  pistol: { near: 320, min: 0.50 },
};
function falloffMul(key, travelled) {
  const f = FALLOFF[key];
  if (!f || travelled <= f.near) return 1;
  const w = key === 'pistol' ? SIDEARM : WEAPONS[key];
  const far = w ? (w.reach || w.range) : f.near;
  if (far <= f.near) return f.min;
  return lerp(1, f.min, clamp((travelled - f.near) / (far - f.near), 0, 1));
}
// Head half-widths in px (40 px = 1 m), so roughly a real head across for a person-sized target.
const HEAD_W = { grunt: 4, runner: 4, gunner: 4, spotter: 4, rider: 4.5, brute: 6, boss: 9 };
function headShot(e, b) {   // did this round's line pass through the centre column of the target?
  const bl = Math.hypot(b.vx, b.vy);
  if (!bl) return false;
  const perp = Math.abs((e.x - b.x) * (b.vy / bl) - (e.y - b.y) * (b.vx / bl));
  // Being in the column is necessary but not sufficient. There is no elevation in the simulation, so
  // where the round struck up the body is rolled: aim decides whether you CAN take the head, the roll
  // decides whether you did. Without this, a close-range burst down the sights is a headshot every time.
  return perp <= (HEAD_W[e.type] || 4) && Math.random() < CFG.headshotChance;
}
// ---------- your rounds go where the crosshair is: a 3D line through the town ----------
// Sim px everywhere (40 px = 1 m), z up. Buildings and cover have tops; enemies are upright cylinders.
const PX = 40;
const COVER_TOP = { crates: 1.42, sandbags: 0.72, barrel: 1.0, propane: 0.9, car: 1.6, van: 1.9, wreck: 1.2, vanwreck: 1.5, stall: 0.95,
  wall: 1.1, barrier: 0.9, fountain: 0.68, fence: 1.0, dumpster: 1.32, woodpile: 0.9, planter: 0.72,
  platform: 0.9, pillar: 6.6, hesco: 1.6, tree: 7, statue: 2.6, tent: 2.2, truck: 3.0, bus: 3.0, mound: 1.3, grave: 0.9, hedge: 1.3,
  pump: 1.7, tanker: 3.0, tankwreck: 2.2, logs: 1.2, mixer: 1.6, toilet: 2.3, bench: 0.5, table: 0.75 };   // metres, as the view draws them
const COVER_HURT = { crates: 0.5, sandbags: 0.67, wall: 0.55, woodpile: 0.66 };   // what's left of them below half health
function coverTop(ob) {   // px: how high this piece of cover stands right now
  const h = COVER_TOP[ob.kind] != null ? COVER_TOP[ob.kind] : (COVER_KINDS[ob.kind].hgt || 1);
  return h * PX * (ob.maxHp > 0 && ob.hp / ob.maxHp <= 0.5 ? (COVER_HURT[ob.kind] || 1) : 1);
}
function bodyTop(e) {   // px: the top of an enemy's head right now — riflemen kneel while they hold still
  if (e.target) return (e.down ? 0.1 : 1.3) * PX;   // a range target: a plate on a post, flat once it folds
  const look = ENEMY_LOOK[e.type] || ENEMY_LOOK.grunt;
  return ((e.ranged && e.stillT > 0.3 ? 1.3 : 1.8) + (e.horse ? 0.35 : 0)) * look[1] * PX;
}
function rayBoxT(ox, oy, oz, dx, dy, dz, x0, x1, y0, y1, z1) {   // entry distance along a ray into a box standing on the ground; Infinity if it misses
  let t0 = 0, t1 = Infinity, u, v, s;
  if (Math.abs(dx) < 1e-9) { if (ox < x0 || ox > x1) return Infinity; }
  else { u = (x0 - ox) / dx; v = (x1 - ox) / dx; if (u > v) { s = u; u = v; v = s; } if (u > t0) t0 = u; if (v < t1) t1 = v; if (t0 > t1) return Infinity; }
  if (Math.abs(dy) < 1e-9) { if (oy < y0 || oy > y1) return Infinity; }
  else { u = (y0 - oy) / dy; v = (y1 - oy) / dy; if (u > v) { s = u; u = v; v = s; } if (u > t0) t0 = u; if (v < t1) t1 = v; if (t0 > t1) return Infinity; }
  if (Math.abs(dz) < 1e-9) { if (oz < 0 || oz > z1) return Infinity; }
  else { u = (0 - oz) / dz; v = (z1 - oz) / dz; if (u > v) { s = u; u = v; v = s; } if (u > t0) t0 = u; if (v < t1) t1 = v; if (t0 > t1) return Infinity; }
  return t0;
}
function rayCylT(ox, oy, oz, dx, dy, dz, cx, cy, r, z1) {   // into an upright cylinder standing on the ground
  const fx = ox - cx, fy = oy - cy, A = dx * dx + dy * dy, C = fx * fx + fy * fy - r * r;
  let t = 0;
  if (C > 0) {
    if (A < 1e-9) return Infinity;
    const B = 2 * (fx * dx + fy * dy), disc = B * B - 4 * A * C;
    if (disc < 0) return Infinity;
    t = (-B - Math.sqrt(disc)) / (2 * A);
    if (t < 0) return Infinity;
  }
  const z = oz + dz * t;
  return z >= 0 && z <= z1 ? t : Infinity;
}
const SHOT = { ox: 0, oy: 0, oz: 0, dx: 0, dy: 0, dz: 0 }, AIMP = { x: 0, y: 0, z: 0 };
function crosshairRay(s) {   // where your crosshair's ray starts and which way it points
  if (fpvActive() || !VIEW.ready || !VIEW.camera) {   // first person: from the eyes, along the view
    const L = Math.hypot(1, aim.pitch);
    SHOT.ox = s.x; SHOT.oy = s.y; SHOT.oz = (FPV.eyeY == null ? 1.62 : FPV.eyeY) * PX;
    SHOT.dx = Math.sin(aim.yaw) / L; SHOT.dy = -Math.cos(aim.yaw) / L; SHOT.dz = aim.pitch / L;
  } else {   // over the shoulder: from the camera through the crosshair, drawn 46% of the way down the screen
    const c3 = VIEW.camera, v = crosshairRay.v || (crosshairRay.v = new THREE.Vector3());
    v.set(0, 1 - 2 * 0.46, 0.5).unproject(c3).sub(c3.position).normalize();
    SHOT.ox = c3.position.x * PX; SHOT.oy = c3.position.z * PX; SHOT.oz = c3.position.y * PX;
    SHOT.dx = v.x; SHOT.dy = v.z; SHOT.dz = v.y;
  }
  return SHOT;
}
function crosshairPoint(R, maxT, out) {   // the first thing along the ray: an enemy, a building, cover or the ground
  const { ox, oy, oz, dx, dy, dz } = R;
  let t = maxT;
  if (dz < -1e-6) t = Math.min(t, -oz / dz);
  for (const b of buildings) t = Math.min(t, rayBoxT(ox, oy, oz, dx, dy, dz, b.x - b.hw, b.x + b.hw, b.y - b.hd, b.y + b.hd, b.top));
  for (const ob of obstacles) {
    if (COVER_KINDS[ob.kind].block < 0.5) continue;   // you aim through a fence, a hedge, a tent
    const top = coverTop(ob);
    t = Math.min(t, ob.shape === 'c' ? rayCylT(ox, oy, oz, dx, dy, dz, ob.x, ob.y, ob.r, top)
      : rayBoxT(ox, oy, oz, dx, dy, dz, ob.x - ob.hw, ob.x + ob.hw, ob.y - ob.hd, ob.y + ob.hd, top));
  }
  for (const e of enemies) t = Math.min(t, rayCylT(ox, oy, oz, dx, dy, dz, e.x, e.y, e.r, bodyTop(e)));
  out.x = ox + dx * t; out.y = oy + dy * t; out.z = oz + dz * t;
  return t;
}
function headHit(e, b) {   // a round that strikes the top of the body, near its middle
  if (b.z < bodyTop(e) * 0.8) return false;
  const bl = Math.hypot(b.vx, b.vy) || 1;
  return Math.abs((e.x - b.x) * (b.vy / bl) - (e.y - b.y) * (b.vx / bl)) <= (HEAD_W[e.type] || 4) * 2.4;
}
const FEED = [], DMGDIR = [];   // kill feed rows and the arcs that show where fire came from
let gestured = false;   // vibrate() is refused (and logs an error) until the page itself has been touched
addEventListener('pointerdown', () => { gestured = true; }, true);
addEventListener('keydown', () => { gestured = true; }, true);
const buzz = ms => { if (GPAD.active) padRumble(ms * 2, ms >= 50); if (gestured && meta && meta.opts.vibe && navigator.vibrate) navigator.vibrate(ms); };
function nearestEnemy(x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const e of enemies) { const d = dist2(x, y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
  return best;
}
function nearestSoldier(x, y) {
  let best = null, bd = Infinity;
  for (const s of soldiers) { if (!s.alive) continue; const d = dist2(x, y, s.x, s.y); if (d < bd) { bd = d; best = s; } }
  return best;
}
const hitsToDrop = k => Math.ceil(ETYPES.grunt.hp / squadDmg(k) - 1e-9);   // body hits on a rifleman at full damage
const GUN_KICK = { smg: 0.6, ar: 1.0, lmg: 1.4, sniper: 2.6, rocket: 3.2, pistol: 0.4 };
function fire(s, target, fromPlayer, angle) {   // angle set = fired where the player is aiming, not at a target
  const key = s.pistol ? 'pistol' : s.weapon, w = s.pistol ? SIDEARM : WEAPONS[s.weapon];
  const dx = target ? target.x - s.x : 0, dy = target ? target.y - s.y : 0;
  const jit = fromPlayer ? 0 : rand(-1, 1) * (w.spread + 0.03), a = (angle != null ? angle : Math.atan2(dy, dx)) + jit;   // your own spread is the 3D cone below
  s.aim = a; s.recoil = 0.09;
  if (fromPlayer) {   // the weapon climbs: your next round goes where the recoil left the muzzle
    const rk = RECOIL_KICK[key] || 0.2, steady = aim.ads ? 0.6 : 1;
    const kx = rand(-1, 1) * rk * 0.022 * steady;
    aim.pitch = clamp(aim.pitch + rk * 0.055 * steady, -0.7, 0.7);
    aim.yaw = angWrap(aim.yaw + kx);
    aim.settle = (aim.settle || 0) + rk * 0.055 * steady;    // the whole climb comes back down
    aim.settleY = (aim.settleY || 0) + kx;                   // and the sideways walk comes back too between bursts
  }
  if (!s.pistol) s.mag--;
  s.shotN = (s.shotN || 0) + 1;
  if (fromPlayer) { state.shots++; MUS.heat = performance.now(); }
  const mz = (s.pistol ? SIDEARM.len : w.len) + 6;   // the barrel tip: where the round actually leaves the weapon
  let bx = s.x + Math.cos(a) * mz, by = s.y + Math.sin(a) * mz, bz = 0, ux = Math.cos(a), uy = Math.sin(a), uz = 0, ballistic = false;
  if (fromPlayer) {   // your round flies in 3D to whatever is under the crosshair, spread around that line
    const R = crosshairRay(s);
    crosshairPoint(R, (w.reach || w.range) + 400, AIMP);
    if (fpvActive()) { bx = R.ox + R.dx * 18; by = R.oy + R.dy * 18; bz = R.oz + R.dz * 18; }   // from just ahead of the eyes; the tracer is drawn from the barrel you see
    else bz = 1.35 * PX;
    let ex = AIMP.x - bx, ey = AIMP.y - by, ez = AIMP.z - bz;
    const L = Math.hypot(ex, ey, ez);
    if (L < 30) { ex = R.dx; ey = R.dy; ez = R.dz; } else { ex /= L; ey /= L; ez /= L; }
    const cone = w.spread * (aim.ads ? heroSight().spread * 0.3 : 0.6), rr = cone * Math.sqrt(Math.random()), ra = rand(0, TAU);   // inside a disc: most rounds near the middle
    const yaw = Math.atan2(ey, ex) + rr * Math.cos(ra), el = Math.asin(clamp(ez, -1, 1)) + rr * Math.sin(ra);
    ux = Math.cos(el) * Math.cos(yaw); uy = Math.cos(el) * Math.sin(yaw); uz = Math.sin(el); ballistic = true;
  }
  bullets.push({ x: bx, y: by, z: bz, vz: uz * w.speed, ballistic,
    vx: ux * w.speed, vy: uy * w.speed,
    tracer: key === 'rocket' || key === 'sniper' || s.shotN % 3 === 0,   // every third round is loaded as a tracer; the .50 and the rocket always burn
    life: (w.reach || w.range) / w.speed, age: 0, fromPlayer, wkey: key, slot: s.slot,
    dmg: s.pistol ? SIDEARM.dmg : squadDmg(s.weapon), hits: 0, maxHits: w.pierce || 1, aoe: w.aoe || 0, skip: coverNear(s, 34) });
  const mx = s.x + Math.cos(a) * mz, my = s.y + Math.sin(a) * mz;   // the flash and the brass are drawn by the view, at the gun it draws
  particles.push({ x: mx, y: my, z: 16, vx: Math.cos(a) * 20 + rand(-8, 8), vy: Math.sin(a) * 20 + rand(-8, 8),
    vz: rand(14, 32), life: rand(0.3, 0.55), max: 0.55, col: '#8a8a80', r: rand(1.5, 2.8) });   // muzzle smoke
  if (fromPlayer) cam.shake = Math.max(cam.shake, GUN_KICK[key]);                                // per-weapon kick
  sfxGun(key, s.x, s.y, fromPlayer);
}
function burst(x, y, col, n, z = 10) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = rand(40, 190);
    particles.push({ x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(30, 130),
      life: rand(0.25, 0.5), max: 0.5, col: Math.random() < 0.3 ? '#fff3d6' : col, r: rand(1.5, 3.5) });
  }
}
// credit: {player:bool, wkey:string|null}
function killEnemy(idx, credit) {
  const e = enemies[idx];
  enemies[idx] = enemies[enemies.length - 1]; enemies.pop();      // remove FIRST — death effects must not re-hit e
  burst(e.x, e.y, e.col, e.type === 'brute' || e.boss ? 18 : 10);
  const hd = e.lastHit, ga = (e.aim || 0) + rand(0.6, 1.5) * (Math.random() < 0.5 ? 1 : -1);
  addCorpse({ kind: 'enemy', x: e.x + rand(-4, 4), y: e.y + rand(-3, 3), col: e.col,
    face: e.face, sc: e.r / 14, horse: e.horse, type: e.type, aim: e.aim, src: e,
    style: !credit.wkey || credit.wkey === 'rocket' || credit.wkey === 'frag' ? 2 : hd && e.aim != null && Math.cos(e.aim) * hd.x + Math.sin(e.aim) * hd.y > 0 ? 1 : 0,
    gunX: e.x + Math.cos(ga) * rand(14, 28), gunY: e.y + Math.sin(ga) * rand(14, 28), gunYaw: rand(0, TAU) });
  sfxKill(e.x, e.y);
  if (!e.boss && Math.random() < 0.35) pickups.push({ x: e.x + rand(-10, 10), y: e.y + rand(-10, 10), t: 30 });
  if (e.boss) state.enemyDown = state.enemyTotal;   // the Warlord falls and the rest of them break
  else state.enemyDown = Math.min(state.enemyTotal - (state.bossRef ? 1 : 0), state.enemyDown + 1);   // while the Warlord stands, its ticket stays on the board
  const cap = (state.bossSpawned && state.bossRef && !e.boss) ? 99 : 100;  // boss gates the last 1%
  state.progress = Math.min(cap, state.enemyDown / state.enemyTotal * 100);
  const pct = +(100 / state.enemyTotal).toFixed(1);
  if (credit.player) { const me = soldiers[state.controlled]; if (me) state.longest = Math.max(state.longest, Math.hypot(e.x - me.x, e.y - me.y)); }
  if (credit.slot != null && meta.squad[credit.slot]) {
    meta.squad[credit.slot].kills = (meta.squad[credit.slot].kills || 0) + 1;
    feedPush(meta.squad[credit.slot].name.toUpperCase(), labelOf(e.type), false, !!credit.head);
  }
  if (credit.player) {
    floaters.push({ x: e.x, y: e.y, z: 34, txt: credit.head ? `HEADSHOT +${pct}%` : `+${pct}%`, life: 0.9 });
    state.kills++;
    awardStreak();
    state.streakN = (state.streakT > 0 ? state.streakN : 0) + 1;   // kill streak chatter
    state.streakT = 3.5;
  }
  if (e.boss) {
    state.bossRef = null;
    showBanner(e.name + ' DOWN');
    explode(e.x, e.y, 90, 0, 0, credit);
    state.progress = 100;
  }
  // wave wiped out — a short slow-motion beat to savor it
  if (!enemies.length && state.slowCd <= 0 && state.wave >= 2 && state.mode === 'play') {
    state.slow = 0.5; state.slowCd = 10; cam.punch = 0.12;
  }
  if (state.progress >= 100) frontCleared();
}
function hurtEnemy(idx, dmg, credit, dir) {
  const e = enemies[idx];
  if (e.hp <= 0) return false;                                    // already dead this frame
  if (e.target) { targetHit(e, credit); return false; }           // a range target folds; it never dies
  if (e.type === 'brute' && dir && e.aim != null && Math.cos(e.aim) * dir.x + Math.sin(e.aim) * dir.y < -0.35) {   // riot shield soaks frontal fire
    dmg *= 0.3;
    particles.push({ x: e.x, y: e.y, z: 16, vx: rand(-50, 50), vy: rand(-50, 50), vz: rand(40, 90), life: 0.15, max: 0.15, col: '#fff4c0', r: 1.4 });
  }
  e.hp -= dmg; e.flash = 0.1; e.lastHit = dir;
  for (let i = 0; i < (credit.head ? 5 : 3); i++)                 // blood spurt, biased along the hit direction
    particles.push({ x: e.x, y: e.y, z: credit.head ? 22 : 12,
      vx: (dir ? dir.x * rand(30, 130) : 0) + rand(-45, 45), vy: (dir ? dir.y * rand(30, 130) : 0) + rand(-45, 45),
      vz: rand(20, 85), life: rand(0.25, 0.4), max: 0.4,
      col: Math.random() < 0.5 ? '#7a1f16' : '#a03028', r: rand(1, 2.2) });
  if (credit.player) {
    if (HITFX.hit <= 0) { beep(credit.head ? 3500 : 2600, credit.head ? 0.045 : 0.03, 'square', credit.head ? 0.042 : 0.03); buzz(credit.head ? 16 : 8); }
    HITFX.hit = 0.14;
    if (credit.head) HITFX.head = 0.2;
  }
  if (e.hp <= 0) { if (credit.player) HITFX.kill = 0.32; killEnemy(idx, credit); return true; }
  return false;
}
function addCorpse(c) {
  c.rot = rand(-0.35, 0.35);
  corpses.push(c);
  if (corpses.length > Math.min(CORPSE_CAP, Q.corpses)) {
    const i = corpses.findIndex(o => o.kind === 'enemy'); // squad corpses are permanent
    if (i >= 0) corpses.splice(i, 1); else corpses.shift();
  }
}
function damageSoldier(s, dmg, quiet) {
  if (!s.alive || s.invuln > 0) return;
  s.hp -= dmg; s.regenCd = CFG.regenDelay;
  if (!quiet) {
    burst(s.x, s.y, '#a03028', 5, 14);
    if (s.slot === state.controlled) {
      cam.shake = 9; sfxHurt(); buzz(26); MUS.heat = performance.now();
      OV.hurt = Math.min(1, (OV.hurt || 0) + 0.42);   // the glass takes a hit
      if (meta.opts.dmgDir && s.lastHit) DMGDIR.push({ x: -s.lastHit.x, y: -s.lastHit.y, t: 1.3 });
      if (DMGDIR.length > 3) DMGDIR.shift();
    }
  }
  if (s.hp <= 0) killSoldier(s);
}
function killSoldier(s) {
  s.alive = false; s.hp = 0;
  state.frontDeaths++;
  markers.push({ x: s.x, y: s.y });
  const hd = s.lastHit, front = hd ? Math.cos(s.aim) * hd.x + Math.sin(s.aim) * hd.y < 0 : Math.random() < 0.6;
  const ga = s.aim + rand(0.5, 1.4) * (Math.random() < 0.5 ? 1 : -1);
  bodies.push({ x: s.x, y: s.y, color: s.color, t: CFG.fallDur, face: Math.cos(s.aim) >= 0 ? 1 : -1, horse: s.horse,
    aim: s.aim, slot: s.slot, weapon: s.pistol ? 'pistol' : s.weapon, sight: s.sight, ext: s.ext, style: front ? 0 : 1,
    gunX: s.x + Math.cos(ga) * rand(16, 30), gunY: s.y + Math.sin(ga) * rand(16, 30), gunYaw: rand(0, TAU) });
  burst(s.x, s.y, s.color, 16, 12);
  feedPush(labelOf(s.lastSrc), s.name.toUpperCase(), true);
  sfxKia();
  s.coverRef = null; s.path = null; s.tgt = null;
  if (state.tickets > 0) { state.tickets--; s.respawnT = CFG.respawn; }   // a reinforcement takes their place
  if (s.slot === state.controlled) {
    state.ks = 0;                                                // your streak dies with you
    buzz(60);
    if (state.mode === 'play') beginDeathCam();
    return;
  }
  if (!soldiers.some(a => a.alive || a.respawnT > 0)) beginFail();
}
function beginDeathCam() {   // hold on your soldier as they go down, before a reinforcement brings you back
  state.mode = 'dying'; state.dyingT = 0;
  state.slow = Math.max(state.slow, CFG.deathCam * 0.75);
  sfxHeartbeat();
}
function beginFail() {
  state.mode = 'spectate'; state.spectateT = 0;
}
// area damage. eDmg to enemies, sDmg to soldiers (friendly fire), env credit
function explode(x, y, r, eDmg, sDmg, credit) {
  sfxExplosion(x, y, r >= 60);
  burst(x, y, '#e8a75a', 22, 8);
  particles.push({ x, y, z: 4, vx: 0, vy: 0, vz: 0, life: 0.22, max: 0.22, col: 'rgba(255,220,140,0.9)', r });
  craters.push({ x, y, r: r * 0.5 }); if (craters.length > 44) craters.shift();
  for (const ob of obstacles.slice()) {   // blasts chew through cover
    if (!ob.hp) continue;
    const d = coverPoint(ob, x, y, CP).d;
    if (d < r) damageCover(ob, 30 * (1 - Math.max(0, d) / r) + 10);
  }
  const p = camTarget(); if (p && dist2(x, y, p.x, p.y) < 500 * 500) cam.shake = Math.max(cam.shake, 7);
  for (let j = enemies.length - 1; j >= 0; j--) {
    const e = enemies[j];
    if (dist2(x, y, e.x, e.y) < (r + e.r) * (r + e.r)) {
      const d = Math.hypot(e.x - x, e.y - y) || 1;
      hurtEnemy(j, eDmg, credit, { x: (e.x - x) / d, y: (e.y - y) / d });
    }
  }
  if (sDmg > 0) for (const s of soldiers)
    if (s.alive && dist2(x, y, s.x, s.y) < (r + s.r) * (r + s.r)) { s.lastHit = { x: s.x - x, y: s.y - y }; s.lastSrc = 'blast'; damageSoldier(s, sDmg); }
}

