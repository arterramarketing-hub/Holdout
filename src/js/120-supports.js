// ============================================================ SUPPORT STRIKES
function enemyCluster() {
  if (!enemies.length) { const p = camTarget(); return { x: p ? p.x : CFG.arenaW / 2, y: (p ? p.y : CFG.lineY) - 380 }; }
  let best = enemies[0], bn = -1;
  for (const e of enemies) {
    let n = 0;
    for (const o of enemies) if (dist2(e.x, e.y, o.x, o.y) < 150 * 150) n++;
    if (n > bn) { bn = n; best = e; }
  }
  return { x: best.x, y: best.y };
}
function useSupport(k) {
  if (screen !== 'battle' || state.mode !== 'play' || !state.earned[k]) return;
  state.earned[k]--;
  const c = enemyCluster();
  if (k === 'uav') {   // a drone overhead: every enemy on your minimap until it leaves
    showBanner('UAV ONLINE');
    state.uavT = CFG.uavTime;
    playBuf('radio', { gain: 0.32, force: true });
  } else if (k === 'napalm') {
    showBanner('NAPALM STRIKE INBOUND'); sfxJet();
    state.flyby = { x: c.x, y: c.y, t0: state.frontTime };
    for (let i = 0; i < 12; i++)
      shells.push({ kind: 'fire', x: c.x - 330 + i * 60, y: c.y + rand(-35, 35), t: 0.5 + i * 0.07 });
  } else if (k === 'airstrike') {   // the jet crosses the enemy's thickest ground west to east and lays a stick of bombs along its path
    showBanner('AIRSTRIKE INBOUND'); sfxJet();
    state.flyby = { x: c.x, y: c.y, t0: state.frontTime };
    const speed = 100 * PX / 1.8;   // the jet covers 100 m in 1.8 s (drawPlane) and is over the middle at 0.9 s
    for (let i = 0; i < AIRSTRIKE.bombs; i++) {
      const off = (i - (AIRSTRIKE.bombs - 1) / 2) * AIRSTRIKE.spacing;
      shells.push({ kind: 'bomb', x: clamp(c.x + off, 40, CFG.arenaW - 40), y: clamp(c.y + rand(-25, 25), 40, CFG.arenaH - 40), t: 0.9 + off / speed + AIRSTRIKE.fall });
    }
  }
  supportsDirty = true;
}
const AIRSTRIKE = { bombs: 7, spacing: 85, fall: 0.45, r: 95, eDmg: 4, sDmg: 2 };   // px apart along the path; a bomb's blast is bigger than a shell's
function updateShells(dt) {
  if (state.uavT > 0 && (state.uavT -= dt) <= 0) { state.uavT = 0; supportsDirty = true; showBanner('UAV OFFLINE'); }
  for (let i = shells.length - 1; i >= 0; i--) {
    const sh = shells[i];
    sh.t -= dt;
    if (sh.t > 0) continue;
    if (sh.kind === 'bomb') explode(sh.x, sh.y, AIRSTRIKE.r, AIRSTRIKE.eDmg, AIRSTRIKE.sDmg, { player: true, wkey: null, slot: state.controlled });
    else if (sh.kind === 'fire') { fires.push({ x: sh.x, y: sh.y, r: 30, t: 8 }); burst(sh.x, sh.y, '#e8843a', 8, 6); }
    shells.splice(i, 1);
  }
}
function updateFires(dt) {
  for (let i = fires.length - 1; i >= 0; i--) {
    const f = fires[i];
    f.t -= dt;
    if (Math.random() < dt * 14)
      particles.push({ x: f.x + rand(-f.r, f.r), y: f.y + rand(-f.r, f.r) * 0.6, z: 2, vx: rand(-8, 8), vy: 0, vz: rand(35, 80),
        life: rand(0.3, 0.65), max: 0.65, col: Math.random() < 0.4 ? '#e8843a' : '#c9531f', r: rand(2, 4.5) });
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (dist2(f.x, f.y, e.x, e.y) < (f.r + e.r) * (f.r + e.r)) hurtEnemy(j, 1.6 * dt, { player: true, wkey: null });
    }
    for (const s of soldiers)
      if (s.alive && dist2(f.x, f.y, s.x, s.y) < (f.r + s.r) * (f.r + s.r)) damageSoldier(s, 0.8 * dt, true);
    if (f.t <= 0) fires.splice(i, 1);
  }
}
const MINE_HIT = { r: 13, top: 0.25 * PX };   // px: the plate (0.34 m across) with a little grace, and how low a round must be to strike it
function shootMine(b) {   // one of your rounds on a mine sets it off where it lies, and what it kills is yours — so is what it does to you
  for (let i = 0; i < mines.length; i++) {
    const m = mines[i];
    if (dist2(b.x, b.y, m.x, m.y) > MINE_HIT.r * MINE_HIT.r) continue;
    mines.splice(i, 1);
    explode(m.x, m.y, CFG.mineR, CFG.mineDmg, CFG.mineDmg, { player: true, wkey: null, slot: b.slot });
    return true;
  }
  return false;
}
function updateMines() {
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    let hit = enemies.some(e => dist2(m.x, m.y, e.x, e.y) < (24 + e.r) * (24 + e.r));
    if (!hit) hit = soldiers.some(s => s.alive && dist2(m.x, m.y, s.x, s.y) < (24 + s.r) * (24 + s.r));
    if (hit) { mines.splice(i, 1); explode(m.x, m.y, CFG.mineR, CFG.mineDmg, CFG.mineDmg, { player: false, wkey: null }); }
  }
}

