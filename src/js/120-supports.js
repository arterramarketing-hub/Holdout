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
  if (k === 'napalm') {
    showBanner('INCENDIARY STRIKE INBOUND'); sfxJet();
    state.flyby = { x: c.x, y: c.y, t0: state.frontTime };
    for (let i = 0; i < 12; i++)
      shells.push({ kind: 'fire', x: c.x - 330 + i * 60, y: c.y + rand(-35, 35), t: 0.5 + i * 0.07 });
  } else if (k === 'artillery') {
    showBanner('ARTILLERY — DANGER CLOSE'); sfxOutgoing();
    for (let i = 0; i < 6; i++)
      shells.push({ kind: 'he', x: c.x + rand(-130, 130), y: c.y + rand(-90, 90), t: 0.7 + i * 0.4 });
  } else if (k === 'supply') {
    showBanner('CARE PACKAGE INBOUND');
    const p = camTarget();
    shells.push({ kind: 'crate', x: p ? p.x : CFG.arenaW / 2, y: p ? p.y : CFG.lineY, t: 1.0 });
  }
  supportsDirty = true;
}
function updateShells(dt) {
  for (let i = shells.length - 1; i >= 0; i--) {
    const sh = shells[i];
    sh.t -= dt;
    if (sh.t > 0) continue;
    if (sh.kind === 'he') explode(sh.x, sh.y, 60, 3, 1.5, { player: true, wkey: null });
    else if (sh.kind === 'fire') { fires.push({ x: sh.x, y: sh.y, r: 30, t: 8 }); burst(sh.x, sh.y, '#e8843a', 8, 6); }
    else if (sh.kind === 'crate') {
      burst(sh.x, sh.y, '#b7d34a', 14, 10); sfxBuy();
      for (const s of soldiers) if (s.alive) { const w = WEAPONS[s.weapon]; s.hp = s.maxHp; s.mag = magCap(s); s.reserve = magCap(s) * w.spare; s.pistol = false; s.reloadT = 0; s.frags = Math.max(s.frags || 0, CFG.frags); }
      floaters.push({ x: sh.x, y: sh.y, z: 34, txt: 'HEALED & RESUPPLIED', life: 1.4 });
    }
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
function updateMines() {
  for (let i = mines.length - 1; i >= 0; i--) {
    const m = mines[i];
    let hit = enemies.some(e => dist2(m.x, m.y, e.x, e.y) < (24 + e.r) * (24 + e.r));
    if (!hit) hit = soldiers.some(s => s.alive && dist2(m.x, m.y, s.x, s.y) < (24 + s.r) * (24 + s.r));
    if (hit) { mines.splice(i, 1); explode(m.x, m.y, CFG.mineR, CFG.mineDmg, CFG.mineDmg, { player: false, wkey: null }); }
  }
}

