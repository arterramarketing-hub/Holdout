// ---------- frag grenades: thrown along the crosshair, bouncing through the town, bursting on a fuse ----------
// Sim px, z up, like rounds. A frag is thrown from the eyes (first person) or the shoulder (third person) along your aim
// with a little loft, falls under gravity, skips off the ground, walls and the tops of cover, and bursts CFG.fragFuse
// seconds after it leaves the hand. The blast falls off to nothing at CFG.fragR, walls of buildings shield it, it
// hurts every enemy it reaches (a breacher's shield does not help), chews cover, never touches your squad, and hurts
// you at CFG.fragSelf strength — never enough to kill you from full health.
const FRAG_G = 9.8 * PX;   // gravity, px/s²
function throwGrenade(s) {
  if (!s || !s.alive || screen !== 'battle' || state.mode !== 'play' || s.slot !== state.controlled) return false;
  if ((s.frags || 0) <= 0 || s.throwT > 0 || s.swapT > 0) return false;
  s.frags--; s.throwT = 0.7; s.sprinting = false; s.sprintOutT = CFG.sprintOut;
  let ox = s.x, oy = s.y, oz = 1.5 * PX, yaw = aim.yaw, el = Math.atan(aim.pitch);
  if (fpvActive() || !VIEW.ready || !VIEW.camera) { const R = crosshairRay(s); ox = R.ox + R.dx * 20; oy = R.oy + R.dy * 20; oz = R.oz - 0.12 * PX; }
  else { const R = crosshairRay(s); yaw = Math.atan2(R.dx, -R.dy); el = Math.asin(clamp(R.dz, -1, 1)); }
  if (buildings.some(b => insideShape(b, ox, oy))) { ox = s.x; oy = s.y; }   // pressed against a wall: the frag leaves from your own spot, not from inside the house
  el += CFG.fragLoft;
  const h = Math.cos(el) * CFG.fragSpeed;
  const g = { x: ox, y: oy, z: oz, vx: Math.sin(yaw) * h, vy: -Math.cos(yaw) * h, vz: Math.sin(el) * CFG.fragSpeed,
    fuse: CFG.fragFuse, spin: rand(0, TAU), owner: s.slot, rest: false, tinkT: 0 };
  grenades.push(g);
  FPV.throwT = 0.45;
  noise({ freq: 900, type: 'bandpass', q: 0.8, dur: 0.22, gain: 0.08, slide: -500 });   // the arm going over
  beep(2600, 0.04, 'square', 0.02, -900, 0.05);                                        // the spoon flying off
  supportsDirty = true;
  return true;
}
function bounceOff(g, ob, px, py, top, damp) {   // came in from (px, py): land on the top, or glance off the side
  if (top != null && g.pz >= top - 2) { g.z = top; if (g.vz < 0) g.vz = -g.vz * 0.3; g.vx *= 0.7; g.vy *= 0.7; return; }
  coverPoint(ob, px, py, CP);
  const vn = g.vx * CP.nx + g.vy * CP.ny;
  if (vn < 0) { g.vx -= (1 + damp) * vn * CP.nx; g.vy -= (1 + damp) * vn * CP.ny; g.vx *= 0.75; g.vy *= 0.75; }
  g.x = px; g.y = py;
}
function updateGrenades(dt) {
  for (let i = grenades.length - 1; i >= 0; i--) {
    const g = grenades[i];
    g.fuse -= dt; g.tinkT -= dt;
    if (!g.rest) {
      const steps = Math.max(1, Math.ceil(Math.hypot(g.vx, g.vy, g.vz) * dt / 8)), sdt = dt / steps;
      for (let k = 0; k < steps; k++) {
        const px = g.x, py = g.y;
        g.pz = g.z;
        g.vz -= FRAG_G * sdt;
        g.x += g.vx * sdt; g.y += g.vy * sdt; g.z += g.vz * sdt;
        g.spin += sdt * Math.hypot(g.vx, g.vy) * 0.05;
        let hit = false;
        for (const b of buildings) if (insideShape(b, g.x, g.y) && g.z < b.top) { bounceOff(g, b, px, py, null, 0.45); hit = true; break; }
        if (!hit) for (const ob of obstacles) {
          if (!insideShape(ob, g.x, g.y)) continue;
          const top = coverTop(ob);
          if (g.z < top) { bounceOff(g, ob, px, py, top, 0.4); hit = true; break; }
        }
        if (g.z <= 0) {
          g.z = 0;
          if (g.vz < -40) { g.vz = -g.vz * 0.32; g.vx *= 0.62; g.vy *= 0.62; hit = true; }
          else { g.vz = 0; g.vx *= Math.exp(-6 * sdt); g.vy *= Math.exp(-6 * sdt); }
        }
        if (g.x < 12 || g.x > CFG.arenaW - 12) { g.vx = -g.vx * 0.4; g.x = clamp(g.x, 12, CFG.arenaW - 12); }
        if (g.y < 12 || g.y > CFG.arenaH - 12) { g.vy = -g.vy * 0.4; g.y = clamp(g.y, 12, CFG.arenaH - 12); }
        if (hit && g.tinkT <= 0 && Math.hypot(g.vx, g.vy, g.vz) > 60) { g.tinkT = 0.12; playBuf('tink:' + randi(0, 2), { gain: 0.35, rate: 0.55, x: g.x, y: g.y, lp: 3000 }); }
      }
      if (g.z <= 0.5 && Math.hypot(g.vx, g.vy) < 6 && Math.abs(g.vz) < 1) g.rest = true;
    }
    if (g.fuse <= 0) { grenades.splice(i, 1); fragBlast(g); }
  }
}
function fragBlast(g) {
  const R = CFG.fragR, x = g.x, y = g.y;
  sfxExplosion(x, y, true);
  burst(x, y, '#e8a75a', 26, 8);
  particles.push({ x, y, z: 6, vx: 0, vy: 0, vz: 0, life: 0.24, max: 0.24, col: 'rgba(255,220,140,0.9)', r: R * 0.55 });
  for (let k = 0; k < 10; k++) { const a = rand(0, TAU), v = rand(120, 260); particles.push({ x, y, z: 8, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(60, 160), life: rand(0.4, 0.8), max: 0.8, col: '#3a3a34', r: rand(1.5, 2.6) }); }
  craters.push({ x, y, r: R * 0.22 }); if (craters.length > 44) craters.shift();
  for (const ob of obstacles.slice()) {
    if (!ob.hp) continue;
    const d = coverPoint(ob, x, y, CP).d;
    if (d < R) damageCover(ob, 26 * (1 - Math.max(0, d) / R) + 6);
  }
  const p = camTarget(); if (p && dist2(x, y, p.x, p.y) < 700 * 700) cam.shake = Math.max(cam.shake, 8);
  const reach = (tx, ty, tr) => { const d = Math.max(0, Math.hypot(tx - x, ty - y) - tr * 0.5); return d < R && losClear(x, y, tx, ty) ? 1 - d / R : 0; };
  const credit = { player: true, wkey: 'frag', slot: g.owner };
  for (let j = enemies.length - 1; j >= 0; j--) {
    const e = enemies[j], k = reach(e.x, e.y, e.r);
    if (k > 0) { e.lastHit = { x: e.x - x, y: e.y - y }; hurtEnemy(j, CFG.fragDmg * k, credit, null); }
  }
  const me = soldiers[state.controlled];
  if (me && me.alive) {
    const k = reach(me.x, me.y, me.r);
    if (k > 0) {
      const full = me.hp >= me.maxHp - 1e-6;
      let dmg = CFG.fragDmg * CFG.fragSelf * k;
      if (full) dmg = Math.min(dmg, me.maxHp - 0.5);   // your own frag never kills you from full health
      me.lastHit = { x: me.x - x, y: me.y - y }; me.lastSrc = 'frag';
      damageSoldier(me, dmg);
    }
  }
}
