// ---------- the squad pushes into the fight, cover to cover ----------
// Each of your three plays a role and fights its own nearest enemy. POINT closes to fighting range,
// FLANK swings wide and comes in from the side, OVERWATCH hangs back at the edge of its range with a line
// on the fight. Nobody positions off you, and nobody takes a spot within ~8 m of a teammate or of you.
const SQUAD_ROLE = [null, 'point', 'flank', 'overwatch'];
function squadAI(s, spd, dt, lead, front, wrange) {
  s.tacT = (s.tacT || 0) - dt; s.planT = (s.planT || 0) - dt;
  if ((s.pistol || s.reserve < WEAPONS[s.weapon].mag) && pickups.length && s.planT <= 0) {   // low on ammo: grab a dropped magazine nearby
    let best = null, bd = 340 * 340;
    for (const p of pickups) { const d = dist2(s.x, s.y, p.x, p.y); if (d < bd) { bd = d; best = p; } }
    if (best) { s.planT = 2; s.tacT = 2; s.coverRef = null; s.goalX = best.x; s.goalY = best.y; goTo(s, best.x, best.y); }
  }
  if (s.coverRef && !obstacles.includes(s.coverRef)) { s.coverRef = null; s.tacT = 0; }
  const role = SQUAD_ROLE[s.slot] || 'point';
  const foe = nearestEnemy(s.x, s.y, 1e6);
  const moved = foe && s.foeX != null && dist2(foe.x, foe.y, s.foeX, s.foeY) > 320 * 320;
  if (s.planT <= 0 && (s.tacT <= 0 || s.goalX == null || moved)) {
    s.tacT = rand(2.6, 4.2); s.planT = 0.8;
    let gx, gy, threat, onObj = false;
    const obj = role !== 'flank' ? squadObjective(s) : null, pressed = foe && dist2(foe.x, foe.y, s.x, s.y) < (wrange * 0.6) ** 2;
    if (obj && !pressed && role === 'point') {   // Point goes and takes the objective
      gx = obj.x; gy = obj.y; threat = foe || obj; onObj = true;
      if (foe) { s.foeX = foe.x; s.foeY = foe.y; }
    } else if (obj && !pressed && role === 'overwatch' && obj.inP > 0) {   // Overwatch covers it from the near edge of its range
      const dx = s.x - obj.x, dy = s.y - obj.y, dd = Math.hypot(dx, dy) || 1, want = Math.min(wrange * 0.8, dd);
      gx = obj.x + dx / dd * want; gy = obj.y + dy / dd * want; threat = foe || obj;
      if (foe) { s.foeX = foe.x; s.foeY = foe.y; }
    } else if (foe) {
      const dx = foe.x - s.x, dy = foe.y - s.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      // a triangle around the enemy: point straight in, flank out to the left, overwatch back and to the right
      if (role === 'flank') {
        const want = wrange * 0.72;
        gx = foe.x - ux * want * 0.35 + uy * want; gy = foe.y - uy * want * 0.35 - ux * want;
      } else if (role === 'overwatch') {
        const want = wrange * 0.95;
        gx = foe.x - ux * want * 0.85 - uy * want * 0.55; gy = foe.y - uy * want * 0.85 + ux * want * 0.55;
      } else {
        const want = wrange * 0.6;
        gx = foe.x - ux * want; gy = foe.y - uy * want;
      }
      threat = foe; s.foeX = foe.x; s.foeY = foe.y;
    } else {   // nobody on the field: sweep toward where they were last heard, or the middle of town
      const at = state.lastContact || { x: CFG.arenaW / 2, y: CFG.arenaH * 0.45 };
      const ang = s.slot * 2.1 + state.frontTime * 0.05, off = role === 'overwatch' ? 0 : role === 'flank' ? 520 : 260;
      gx = at.x + Math.cos(ang) * off; gy = at.y + Math.sin(ang) * off;
      threat = at; s.foeX = null;
    }
    for (let k = 0; k < 3 && !onObj; k++) {   // spread out: shove the spot away from teammates' spots, and from you (not off an objective)
      let bumped = false;
      for (const o of soldiers) {
        if (o === s || !o.alive) continue;
        const useGoal = o.slot !== state.controlled && o.goalX != null;
        const ox = useGoal ? o.goalX : o.x, oy = useGoal ? o.goalY : o.y;
        const ddx = gx - ox, ddy = gy - oy, dd = Math.hypot(ddx, ddy);
        if (dd < 320) {
          const push = 360 - dd, nx = dd > 1 ? ddx / dd : Math.cos(s.slot * 2.4), ny = dd > 1 ? ddy / dd : Math.sin(s.slot * 2.4);
          gx += nx * push; gy += ny * push; bumped = true;
        }
      }
      if (!bumped) break;
    }
    gx = clamp(gx, 40, CFG.arenaW - 40); gy = clamp(gy, 40, CFG.arenaH - 40);
    s.goalX = gx; s.goalY = gy;
    const ob = pickCover(s, threat, gx, gy, onObj ? obj.r * 0.7 : 420, wrange * (role === 'overwatch' ? 0.9 : 0.62));
    if (ob && dist2(SPOT.x, SPOT.y, gx, gy) < (onObj ? obj.r * 0.7 : 260) ** 2) { s.coverRef = ob; goTo(s, SPOT.x, SPOT.y); }
    else { s.coverRef = null; goTo(s, gx, gy); }
  }
  const far = s.gx != null && dist2(s.x, s.y, s.gx, s.gy) > 300 * 300;
  followPath(s, spd * (far ? 1.15 : 1), dt);
}
function updateSoldiers(dt) {
  const vis = visMul(), lead = camTarget();
  tallyClaims();
  const front = lead ? nearestEnemy(lead.x, lead.y, 1e6) : null;
  for (const s of soldiers) {
    if (!s.alive) continue;
    s.invuln = Math.max(0, s.invuln - dt);
    s.peekT = Math.max(0, (s.peekT || 0) - dt);
    s.fireCd -= dt; s.recoil = Math.max(0, s.recoil - dt);
    if (s.regenCd > 0) s.regenCd -= dt;
    else if (s.hp < s.maxHp) s.hp = Math.min(s.maxHp, s.hp + CFG.regenRate * dt);
    const w = WEAPONS[s.weapon];
    const wrange = (s.pistol ? SIDEARM.range : w.range) * vis;
    const isCtl = s.slot === state.controlled && state.mode === 'play';
    if (isCtl) { updateSprint(s, dt); updateSwap(s, dt); } else s.sprinting = false;
    const spd = (isCtl ? CFG.playerSpeed : CFG.aiSpeed) * (w.moveMul || 1) * (s.horse ? CFG.horseSpeedMul : 1)
      * (s.reloadT > 0 ? 0.85 : 1) * (isCtl && aim.ads ? 0.7 : 1) * (s.sprinting ? CFG.sprintMul : 1);
    const x0 = s.x, y0 = s.y;
    if (isCtl) heroControl(s, spd, dt);
    else squadAI(s, spd, dt, lead, front, wrange);
    s.moving = Math.hypot(s.x - x0, s.y - y0) > spd * dt * 0.25;
    stepSound(s, Math.hypot(s.x - x0, s.y - y0), isCtl ? 'hero' : 'mate');
    if (s.moving) s.walk += dt * (s.horse ? 13 : 10);
    s.x = clamp(s.x, 12, CFG.arenaW - 12); s.y = clamp(s.y, 12, CFG.arenaH - 12);   // the perimeter stands on the edge: walk up to it
    collideObstacles(s);
    s.tgtT = (s.tgtT || 0) - dt;
    if (s.tgtT <= 0 || (s.tgt && (s.tgt.hp <= 0 || !enemies.includes(s.tgt)))) {
      s.tgtT = 0.2;
      s.tgt = isCtl ? crosshairTarget(s, 0.2) : nearestVisibleEnemy(s.x, s.y, wrange);
    }
    if (s.reloadT > 0) { s.reloadT -= dt; if (s.reloadT <= 0) finishReload(s); }
    const t = s.tgt;
    if (isCtl) state.crossTarget = t;   // the enemy under your crosshair turns it red
    if (isCtl) {   // you aim it and you pull the trigger
      aimAssist(s, dt);
      s.aim = aim.yaw - Math.PI / 2;
      s.quietT = aim.fire ? 0 : (s.quietT || 0) + dt;
      if (aim.fire && s.fireCd <= 0 && s.reloadT <= 0 && !s.sprinting && s.sprintOutT <= 0 && s.throwT <= 0.35 && !(s.swapT > 0)) {
        if (s.pistol || s.mag > 0) {
          s.fireCd = s.pistol ? SIDEARM.cd : w.cd;
          fire(s, null, true, s.aim);
          s.peekT = 0.5;
        }
        if (!s.pistol && s.mag <= 0) startReload(s);
      } else if (!s.pistol && s.reloadT <= 0 && s.quietT > 1.5 && s.mag < magCap(s) * 0.5 && s.reserve > 0) startReload(s);
    } else if (t) {
      s.aim = Math.atan2(t.y - s.y, t.x - s.x);
      s.quietT = 0;
      if (s.fireCd <= 0 && s.reloadT <= 0) {
        if (s.pistol || s.mag > 0) {
          s.fireCd = (s.pistol ? SIDEARM.cd : w.cd) * CFG.aiCdMul;
          fire(s, t, false);
          s.peekT = 0.5;   // pop up over cover to shoot
        }
        if (!s.pistol && s.mag <= 0) startReload(s);
      }
    } else {
      if (s.moving) s.aim = Math.atan2(s.y - y0, s.x - x0);
      s.quietT = (s.quietT || 0) + dt;   // a lull in the shooting: top the magazine off
      if (s.quietT > 1.5 && !s.pistol && s.reloadT <= 0 && s.mag < magCap(s) * 0.5 && s.reserve > 0) startReload(s);
    }
  }
  for (let i = 0; i < soldiers.length; i++)
    for (let j = i + 1; j < soldiers.length; j++) {
      const a = soldiers[i], b = soldiers[j];
      if (!a.alive || !b.alive) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
      if (d2 < 900 && d2 > 0.01) { const d = Math.sqrt(d2), push = (30 - d) / 2 / d; a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push; }
    }
}
function soldierTop(s) {   // px: the top of a soldier right now — an AI squadmate settled behind cover is crouched
  const crouched = s.slot !== state.controlled && s.coverRef && (s.peekT || 0) <= 0 && !s.moving && (!s.path || !s.path.length);
  return (s.horse ? 2.15 : crouched ? 1.1 : 1.8) * PX;
}
function enemyFire(e, t, spread) {   // a real line in 3D: from the shoulder to the chest, so cover stops what its height stops
  if (t.sprinting) spread *= 1.4;   // a sprinting soldier is a harder shot
  const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy) || 1;
  const a = Math.atan2(dy, dx) + rand(-1, 1) * spread;
  const mz = bodyTop(e) * 0.8, tz = soldierTop(t) * 0.62;
  const el = Math.atan2(tz - mz, d) + rand(-1, 1) * spread * 0.5;
  const sp = 1500, h = Math.cos(el);
  bullets.push({ x: e.x + Math.cos(a) * 16, y: e.y + Math.sin(a) * 16, z: mz, ballistic: true,
    vx: Math.cos(a) * h * sp, vy: Math.sin(a) * h * sp, vz: Math.sin(el) * sp, life: (e.ranged || 400) * 1.5 / 1500, tracer: Math.random() < 0.5,
    hostile: true, dmg: e.dmg, wkey: null, slot: null, hits: 0, maxHits: 1, aoe: 0, skip: coverNear(e, 34), srcType: e.type });
  sfxEnemyShot(e.x, e.y, e.type === 'gunner' ? 1.1 : 0.85);
  state.lastContact = { x: e.x, y: e.y };   // gunfire gives a position away
}
function bossLogic(e, t, dt, d, dx, dy) {
  const frac = e.hp / e.maxHp;
  e.phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
  const sp = e.sp * (e.phase === 3 ? 1.45 : 1);
  const reach = e.r + t.r + 8;
  if (d > reach) {
    if (d < 240 && clearRun(e.x, e.y, t.x, t.y, e.r)) { e.x += dx / d * sp * dt; e.y += dy / d * sp * dt; }
    else {
      e.pathT = (e.pathT || 0) - dt;
      if (e.pathT <= 0 || !e.path || !e.path.length) { e.pathT = 1.5; goTo(e, t.x, t.y); }
      followPath(e, sp, dt);
    }
  }
  else if (e.cd <= 0) { e.cd = 1.1; e.atk = 0.3; t.lastHit = { x: t.x - e.x, y: t.y - e.y }; t.lastSrc = e.type; damageSoldier(t, e.dmg); burst(t.x, t.y, '#e8b8a0', 5, 16); }
  if (e.phase >= 2) {                                             // phase 2: summons adds
    e.summonT -= dt;
    if (e.summonT <= 0) {
      e.summonT = 8;
      const room = Math.min(3, CFG.enemyCap + 1 - enemies.length);   // up to eight on the field besides the Warlord, like everyone else
      for (let i = 0; i < room; i++) {
        spawnEnemy('grunt');
        const g = enemies[enemies.length - 1];
        g.x = clamp(e.x + rand(-90, 90), 30, CFG.arenaW - 30); g.y = clamp(e.y + rand(-40, 40), 30, CFG.arenaH - 30);
      }
      if (room > 0) floaters.push({ x: e.x, y: e.y, z: 44, txt: 'REINFORCEMENTS', life: 1 });
    }
  }
  if (e.phase === 3) {                                            // phase 3: enraged radial bursts
    e.radT -= dt;
    if (e.radT <= 0) {
      e.radT = 5;
      for (let k = 0; k < 10; k++) {
        const a = k / 10 * TAU;
        bullets.push({ x: e.x, y: e.y, z: 1.2 * PX, vz: 0, ballistic: true, vx: Math.cos(a) * 650, vy: Math.sin(a) * 650, life: 0.65, tracer: true,
          hostile: true, dmg: 1, wkey: null, slot: null, hits: 0, maxHits: 1, aoe: 0, srcType: 'boss' });
      }
      sfxBossBurst(e.x, e.y);
    }
  }
}
function updateEnemies(dt) {
  const vis = visMul();
  tallyClaims();
  for (const e of enemies) {
    e.flash = Math.max(0, e.flash - dt);
    if (e.target) continue;   // a range target stands where it was put
    e.cd -= dt; e.wob += dt * 6; e.atk = Math.max(0, e.atk - dt);
    e.supp = Math.max(0, (e.supp || 0) - dt * 0.6);
    if (e.relT > 0) e.relT -= dt;
    const t = nearestSoldier(e.x, e.y);
    if (!t) continue;
    const dx = t.x - e.x, dy = t.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.face = dx >= 0 ? 1 : -1;
    e.aim = Math.atan2(dy, dx);
    const sp0 = e.sp, ex0 = e.x, ey0 = e.y;
    if (d > 900 && !e.boss) e.sp *= 1.8;   // far from the fight: hurry up the streets
    if (e.boss) bossLogic(e, t, dt, d, dx, dy);
    else if (e.spotter) spotterAI(e, t, dt, d);
    else if (e.ranged) riflemanAI(e, t, dt, d, vis);
    else meleeAI(e, t, dt, d);
    e.sp = sp0;
    e.x = clamp(e.x, 16, CFG.arenaW - 16); e.y = clamp(e.y, 16, CFG.arenaH - 16);
    collideObstacles(e);
    e.stillT = Math.hypot(e.x - ex0, e.y - ey0) < sp0 * dt * 0.25 ? (e.stillT || 0) + dt : 0;
    if (!e.horse) stepSound(e, Math.hypot(e.x - ex0, e.y - ey0), 'enemy');
    e.chkT = (e.chkT || 0) - dt;
    if (e.chkT <= 0) {   // wedged on a corner: plan again
      e.chkT = 0.8;
      if (e.path && e.path.length && e.lx != null && dist2(e.x, e.y, e.lx, e.ly) < 64) { e.path = null; e.pathT = 0; if (e.tac === 'move') e.tacT = 0; }
      e.lx = e.x; e.ly = e.y;
    }
  }
  for (let i = 0; i < enemies.length; i++)
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j];
      const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, d2 = dx * dx + dy * dy;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2), push = (min - d) / 2 / d;
        a.x -= dx * push; a.y -= dy * push; b.x += dx * push; b.y += dy * push;
      }
    }
}
function riflemanAI(e, t, dt, d, vis) {   // bound to cover, hold and fire in bursts, get pinned, fall back when hurt
  const range = e.ranged * vis, sees = d < range && losClear(e.x, e.y, t.x, t.y);
  if (sees && !e.saw) bark(e, 'spot');
  e.saw = sees;
  e.tacT -= dt;
  if (e.coverRef && !obstacles.includes(e.coverRef)) { e.coverRef = null; e.tacT = Math.min(e.tacT, 0.3); }
  if (e.tac === 'move') {
    const arrived = followPath(e, e.sp * (e.supp > 1.2 ? 0.65 : 1), dt);
    if (sees) fireLogic(e, t, dt, true);
    if (arrived || e.tacT <= 0) {
      if (e.coverRef && coverPoint(e.coverRef, e.x, e.y, CP).d > 40) e.coverRef = null;   // never made it: holding in the open
      e.tac = 'hold'; e.tacT = (e.coverRef ? rand(2.6, 5) : rand(0.8, 1.6)) + e.supp; e.path = null;
    }
    return;
  }
  if (sees) fireLogic(e, t, dt, false);
  if (e.tacT > 0) return;
  if (e.supp > 1.6 && e.coverRef) { e.tacT = rand(1, 1.8); return; }   // pinned down
  if (e.objRole && !(sees && d < range * 0.55)) {   // this one works an objective: take it, or hold it, from cover
    const o = enemyObjective(e);
    if (o) {
      if (dist2(e.x, e.y, o.x, o.y) > (o.r * 0.75) ** 2) {
        const ob = pickCover(e, t, o.x, o.y, o.r * 0.75, range * 0.7);
        if (ob) { e.coverRef = ob; goTo(e, SPOT.x, SPOT.y); }
        else { e.coverRef = null; goTo(e, o.x + rand(-0.4, 0.4) * o.r, o.y + rand(-0.4, 0.4) * o.r); }
        e.tac = 'move'; e.tacT = 8;
      } else { e.tac = 'hold'; e.tacT = rand(2, 3.5); }
      return;
    }
  }
  const hurt = e.hp < e.maxHp * 0.45 && Math.random() < 0.5;
  const ideal = range * (hurt ? 0.95 : e.type === 'gunner' ? 0.85 : 0.7);
  const ux = (e.x - t.x) / d, uy = (e.y - t.y) / d, lat = e.flankSide * (e.type === 'gunner' ? 60 : 170);
  const gx = clamp(t.x + ux * ideal - uy * lat, 40, CFG.arenaW - 40), gy = clamp(t.y + uy * ideal + ux * lat, -200, CFG.arenaH - 40);
  const ob = pickCover(e, t, gx, gy, hurt ? 360 : 680, ideal);
  if (ob) { e.coverRef = ob; goTo(e, SPOT.x, SPOT.y); }
  else { e.coverRef = null; goTo(e, gx, gy); }
  e.tac = 'move'; e.tacT = 7;
  if (Math.abs(lat) > 100 && Math.random() < 0.35) bark(e, 'flank');
}
function fireLogic(e, t, dt, moving) {
  e.fireT -= dt;
  if (e.fireT > 0) return;
  const mg = e.type === 'gunner';
  if (e.burst <= 0) e.burst = mg ? randi(4, 7) : randi(2, 3);
  e.atk = 0.2;
  enemyFire(e, t, (mg ? 0.1 : 0.13) + (moving ? 0.07 : 0) + Math.min(0.12, e.supp * 0.05));
  e.burst--;
  e.fireT = e.burst > 0 ? (mg ? 0.1 : 0.16) : (mg ? 2.6 : 3.2) * rand(0.8, 1.25) * (1 + e.supp * 0.3);
  if (e.burst <= 0 && Math.random() < 0.4) { e.relT = 1.6; bark(e, 'reload'); }   // swaps a magazine during the pause
}
function meleeAI(e, t, dt, d) {   // runners flank down side streets, breachers and raiders come straight up the road
  const reach = e.r + t.r + 6;
  if (d <= reach) {
    if (e.cd <= 0) { e.cd = 0.9; e.atk = 0.25; t.lastHit = { x: t.x - e.x, y: t.y - e.y }; t.lastSrc = e.type; damageSoldier(t, e.dmg); burst(t.x, t.y, '#e8b8a0', 3, 16); }
    return;
  }
  e.pathT = (e.pathT || 0) - dt;
  if (d < 260 && clearRun(e.x, e.y, t.x, t.y, e.r * 0.8)) {
    bark(e, 'charge');
    e.path = null;
    const s = e.sp * dt;
    e.x += (t.x - e.x) / d * s; e.y += (t.y - e.y) / d * s;
    return;
  }
  if (e.pathT <= 0 || !e.path || !e.path.length) {
    e.pathT = rand(1.2, 2);
    if (e.type === 'runner' && d > 420) goTo(e, clamp(t.x + e.flankSide * 520, 60, CFG.arenaW - 60), t.y - 120);
    else goTo(e, t.x, t.y);
  }
  followPath(e, e.sp * (e.type === 'runner' && e.supp > 1.2 ? 0.7 : 1), dt);
}
function spotterAI(e, t, dt, d) {   // hides well back behind cover and glasses the squad (no longer spawned: it only ever called mortars)
  e.pathT = (e.pathT || 0) - dt;
  if ((!e.path || !e.path.length) && e.pathT <= 0) {
    e.pathT = rand(4, 7);
    const gx = clamp(t.x + (e.x - t.x) * 600 / d, 40, CFG.arenaW - 40), gy = clamp(t.y + (e.y - t.y) * 600 / d, -200, CFG.arenaH - 40);
    const ob = pickCover(e, t, gx, gy, 600, 600);
    if (ob) { e.coverRef = ob; goTo(e, SPOT.x, SPOT.y); } else { e.coverRef = null; goTo(e, gx, gy); }
  }
  followPath(e, e.sp, dt);
}
function inCover(o) { return !!coverNear(o, 18); }   // hugging cover or a wall: ranged damage reduction
function updateBullets(dt) {   // sub-steps of ≤10 px; buildings stop every round, cover stops most and takes the damage
  const ctl = soldiers[state.controlled];
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (b.wkey === 'rocket' && Math.random() < dt * 30)
      particles.push({ x: b.x, y: b.y, z: 15, vx: rand(-15, 15), vy: rand(-15, 15), vz: rand(5, 25), life: 0.35, max: 0.35, col: '#8a8a80', r: 2.5 });
    const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy, b.vz || 0) * dt / 10)), sdt = dt / steps;
    let dead = false;
    for (let k = 0; k < steps && !dead; k++) {
      b.x += b.vx * sdt; b.y += b.vy * sdt; b.life -= sdt; b.age = (b.age || 0) + sdt;
      if (b.ballistic) {
        b.z += b.vz * sdt;
        if (b.z <= 0) { b.z = 0; impact(b, '#8a7a5a', false); dead = true; break; }   // into the ground where you aimed low
      }
      if (b.life <= 0) {
        if (b.aoe) explode(b.x, b.y, b.aoe, b.dmg, 0, { player: b.fromPlayer, wkey: b.wkey });
        dead = true; break;
      }
      for (const bd of buildings) if (insideShape(bd, b.x, b.y) && (!b.ballistic || b.z < bd.top)) { impact(b, '#c8c0b0', true); dead = true; break; }
      if (dead) break;
      for (const ob of obstacles) {
        if (ob === b.skip || ob === b.over || !insideShape(ob, b.x, b.y)) continue;
        if (b.ballistic && COVER_KINDS[ob.kind].block >= 0.5) { if (b.z >= coverTop(ob)) continue; }   // a real line: over the top of it, or into it
        else if (!b.aoe && Math.random() > ob.block) { b.over = ob; continue; }   // this one flies over the top
        impact(b, MAT_COL[COVER_KINDS[ob.kind].mat] || '#999999', false);
        if (!b.aoe) damageCover(ob, b.dmg);
        dead = true; break;
      }
      if (dead) break;
      if (b.hostile) {                                               // enemy fire vs soldiers
        if (!b.whizzed && ctl && ctl.alive && dist2(b.x, b.y, ctl.x, ctl.y) < 70 * 70) { b.whizzed = true; sfxWhiz(b.x, b.y); }
        for (const s of soldiers) {
          if (!s.alive || dist2(b.x, b.y, s.x, s.y) >= (s.r + 5) * (s.r + 5)) continue;
          if (b.ballistic && b.z > soldierTop(s)) continue;   // over their head
          let dmg = b.ballistic ? b.dmg : inCover(s) ? b.dmg * 0.5 : b.dmg;   // a 3D round has already met the cover as geometry
          if (s.slot !== state.controlled) dmg *= 0.7;   // AI squadmates can't dodge — soften ranged fire on them
          s.lastHit = { x: b.vx, y: b.vy }; s.lastSrc = b.srcType;
          damageSoldier(s, dmg);
          dead = true; break;
        }
      } else {
        for (let j = 0; j < enemies.length; j++) {
          const e = enemies[j], d2 = dist2(b.x, b.y, e.x, e.y);
          if (d2 < 60 * 60 && b.suppd !== e) { b.suppd = e; e.supp = Math.min(4, (e.supp || 0) + (b.wkey === 'lmg' ? 0.5 : 0.3)); }   // rounds cracking past keep heads down
          if (b.hitList && b.hitList.includes(e)) continue;
          if (d2 >= (e.r + (b.ballistic ? 3 : 5)) ** 2) continue;
          if (b.ballistic && b.z > bodyTop(e)) continue;   // over their head
          if (b.aoe) { explode(b.x, b.y, b.aoe, b.dmg, 0, { player: b.fromPlayer, wkey: b.wkey }); dead = true; break; }
          const bl = Math.hypot(b.vx, b.vy) || 1;
          const head = b.ballistic ? headHit(e, b) : headShot(e, b);
          if (b.fromPlayer) { state.hits++; if (head) state.heads++; }
          const cdmg = (b.ballistic || !inCover(e) ? b.dmg : b.dmg * 0.65) * (head ? CFG.headshotMul : 1)   // your rounds meet cover as geometry, not a discount
            * falloffMul(b.wkey, b.age * Math.hypot(b.vx, b.vy, b.vz || 0));   // how far this round had flown by the time it arrived
          particles.push({ x: e.x, y: e.y, z: head ? 22 : 14, vx: rand(-40, 40), vy: rand(-40, 40), vz: rand(30, 90), life: 0.08, max: 0.08, col: '#fff0b0', r: 1.4 });
          const died = hurtEnemy(j, cdmg, { player: b.fromPlayer, wkey: b.wkey, slot: b.slot, head }, { x: b.vx / bl, y: b.vy / bl });
          b.hits++;
          (b.hitList || (b.hitList = [])).push(e);
          if (died) j--;
          if (b.hits >= b.maxHits) { dead = true; break; }
        }
      }
    }
    if (dead) { bullets[i] = bullets[bullets.length - 1]; bullets.pop(); }
  }
}
function impact(b, col, wall) {   // a round striking a wall or cover: rockets detonate, everything else throws chips
  if (b.aoe) { explode(b.x, b.y, b.aoe, b.dmg, 0, { player: b.fromPlayer, wkey: b.wkey }); return; }
  for (let k = 0; k < 3; k++)
    particles.push({ x: b.x, y: b.y, z: b.ballistic ? b.z / (PX * ZS) : rand(10, 18), vx: rand(-60, 60), vy: rand(-60, 60), vz: rand(30, 100), life: 0.25, max: 0.25, col: k ? col : '#ffe8a0', r: k ? 1.8 : 1.2 });
  if (Math.random() < (wall ? 0.12 : 0.22)) sfxRicochet(b.x, b.y);
}
function updateFx(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vz -= 340 * dt;
    if (p.z < 0) { p.z = 0; p.vz *= -0.4; }
    p.life -= dt;
    if (p.life <= 0) { particles[i] = particles[particles.length - 1]; particles.pop(); }
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    const f = floaters[i]; f.z += 55 * dt; f.life -= dt;
    if (f.life <= 0) { floaters[i] = floaters[floaters.length - 1]; floaters.pop(); }
  }
  for (let i = bodies.length - 1; i >= 0; i--) {
    bodies[i].t -= dt;
    if (bodies[i].t <= 0) { // fall animation over -> permanent corpse on the field
      const b = bodies[i];
      addCorpse({ kind: 'soldier', x: b.x, y: b.y, col: b.color, face: b.face, sc: 1, horse: b.horse,
        aim: b.aim, slot: b.slot, weapon: b.weapon, sight: b.sight, ext: b.ext, src: b,
        style: b.style, gunX: b.gunX, gunY: b.gunY, gunYaw: b.gunYaw });
      bodies.splice(i, 1);
    }
  }
}
function battleUpdate(dt) {
  state.slow = Math.max(0, state.slow - dt);
  state.slowCd = Math.max(0, state.slowCd - dt);
  const wdt = dt * (state.slow > 0 ? 0.3 : 1);          // slow-mo scales the world, not the camera
  const worldActive = state.mode === 'play' || state.mode === 'dying' || state.mode === 'spectate';
  if (worldActive) {
    state.frontTime += wdt;
    state.tod = (state.tod + wdt * CFG.todSpeed) % 4;
    if (!state.bossSpawned && state.progress >= 90) { state.bossSpawned = true; spawnBoss(); }
    updateWaves(wdt);
    updateSoldiers(wdt);
    for (const s of soldiers)   // squadmates walk back on once their reinforcement clock runs out
      if (!s.alive && s.respawnT > 0 && s.slot !== state.controlled) {
        s.respawnT -= wdt;
        if (s.respawnT <= 0) respawnSoldier(s);
      }
    updateEnemies(wdt);
    updateObjectives(wdt);
    if (state.training) updateTraining(wdt);
    updateBullets(wdt);
    updateShells(wdt);
    updateGrenades(wdt);
    updateFires(wdt);
    updateMines();
    updatePickups(wdt);
    updateWeaponDrops(wdt);
  }
  updateFx(wdt);
  const me = soldiers[state.controlled];   // your own pulse, once you are nearly out of it
  if (state.mode === 'play' && me && me.alive && me.hp / me.maxHp <= 0.35) {
    state.beatT = (state.beatT || 0) - dt;
    if (state.beatT <= 0) { state.beatT = 0.95; beep(58, 0.15, 'sine', 0.32, -18); beep(52, 0.19, 'sine', 0.24, -14, 0.19); }
  } else state.beatT = 0;
  if (state.mode === 'dying') {   // watch yourself go down, then a reinforcement puts you back on the line
    state.dyingT += dt;
    if (state.dyingT >= CFG.deathCam) {
      const me = soldiers[state.controlled];
      if (me && me.respawnT > 0) {
        respawnSoldier(me);
        state.mode = 'play';
        cam.snap = true;
      } else beginFail();
    }
  }
  if (state.mode === 'spectate') {
    state.spectateT += dt;
    if (state.spectateT > CFG.deathCam + 0.3) showFailModal();
  }
  updateVoices(dt);
  updateBanner(dt);
}

