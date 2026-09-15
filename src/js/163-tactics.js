// ---------- tactics: shared cover picking ----------
const coverCap = ob => ob.shape === 'c' ? (ob.r > 40 ? 3 : 1) : Math.max(1, Math.round(Math.max(ob.hw, ob.hd) / 28));
function coverSpot(ob, tx, ty, ur, out) {   // where to crouch so the cover sits between you and (tx, ty)
  if (ob.shape === 'c') {
    const dx = ob.x - tx, dy = ob.y - ty, d = Math.hypot(dx, dy) || 1, k = ob.r + ur + 3;
    out.x = ob.x + dx / d * k; out.y = ob.y + dy / d * k;
    return out;
  }
  const dx = ob.x - tx, dy = ob.y - ty;
  if (Math.abs(dx) / ob.hw > Math.abs(dy) / ob.hd) {
    out.x = ob.x + (Math.sign(dx) || 1) * (ob.hw + ur + 3);
    out.y = clamp(ty + (out.x - tx) * dy / (dx || 1), ob.y - Math.max(0, ob.hd - ur), ob.y + Math.max(0, ob.hd - ur));
  } else {
    out.y = ob.y + (Math.sign(dy) || 1) * (ob.hd + ur + 3);
    out.x = clamp(tx + (out.y - ty) * dx / (dy || 1), ob.x - Math.max(0, ob.hw - ur), ob.x + Math.max(0, ob.hw - ur));
  }
  return out;
}
function pickCover(u, threat, goalX, goalY, maxR, ideal) {   // best free cover near the goal, at a useful range, ideally with a line on the threat; spot left in SPOT
  let best = null, bs = Infinity;
  const ur = u.r * 0.8 + 3;
  for (const ob of obstacles) {
    const taken = (u.slot == null ? ob.claimsE : ob.claims) - (u.coverRef === ob ? 1 : 0);
    if (taken >= coverCap(ob)) continue;
    coverSpot(ob, threat.x, threat.y, ur, SPOT);
    const dU = Math.hypot(SPOT.x - u.x, SPOT.y - u.y);
    if (dU > maxR || SPOT.x < 30 || SPOT.x > CFG.arenaW - 30 || SPOT.y > CFG.arenaH - 30) continue;
    let score = Math.hypot(SPOT.x - goalX, SPOT.y - goalY) + dU * 0.35
      + Math.abs(Math.hypot(SPOT.x - threat.x, SPOT.y - threat.y) - ideal) * 0.6 + taken * 120;
    if (score >= bs) continue;
    if (!losClear(SPOT.x, SPOT.y, threat.x, threat.y)) score += 320;
    if (score < bs && !spotBlocked(SPOT.x, SPOT.y, ur)) { bs = score; best = ob; }
  }
  if (best) coverSpot(best, threat.x, threat.y, ur, SPOT);
  return best;
}
function nearestVisibleEnemy(x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const e of enemies) { const d = dist2(x, y, e.x, e.y); if (d < bd && losClear(x, y, e.x, e.y)) { bd = d; best = e; } }
  return best;
}

// ---------- the hero ----------
function sprintWanted(s, dt) {   // Shift on a keyboard; on a phone, the stick pushed out to its rim and forward for a beat
  let want = !!(keys.ShiftLeft || keys.ShiftRight || aim.sprintPad);
  if (joy.active) {
    const m = Math.hypot(joy.dx, joy.dy), ang = Math.abs(Math.atan2(joy.dx, -joy.dy));
    const onRim = joy.dy < 0 && m >= (s.sprinting ? 0.8 : 0.95) && ang < (s.sprinting ? 0.87 : 0.61);   // ±35° to start, ±50° to keep going
    joy.rimT = onRim ? (joy.rimT || 0) + dt : 0;
    if (joy.rimT >= 0.15) want = true;
  } else joy.rimT = 0;
  return want;
}
function updateSprint(s, dt) {   // forward only, never with the trigger or the sights; the gun takes a moment to come up after
  s.throwT = Math.max(0, (s.throwT || 0) - dt);
  s.sprintOutT = Math.max(0, (s.sprintOutT || 0) - dt);
  const mv = moveVector(), ml = Math.hypot(mv.x, mv.y);
  const forward = ml > 0.3 && (mv.x * Math.sin(aim.yaw) - mv.y * Math.cos(aim.yaw)) / ml >= Math.cos(50 * Math.PI / 180);
  const want = sprintWanted(s, dt), blocked = aim.fire || aim.ads || s.throwT > 0.45 || s.horse;
  if (s.sprinting && (blocked || !want || !forward)) { s.sprinting = false; s.sprintOutT = CFG.sprintOut; }
  else if (!s.sprinting && want && forward && !blocked) s.sprinting = true;
}
function heroControl(s, spd, dt) {   // you move yourself: nothing latches, nothing crouches for you
  const mv = moveVector();
  s.coverRef = null;
  if (mv.x || mv.y) { s.x += mv.x * spd * dt; s.y += mv.y * spd * dt; s.idleT = 0; }
  else s.idleT = (s.idleT || 0) + dt;
}

