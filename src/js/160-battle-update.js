// ============================================================ BATTLE UPDATE
function collideObstacles(o) {   // push out of buildings and cover
  const r = o.r * 0.8 + 2;
  for (const b of buildings) { coverPoint(b, o.x, o.y, CP); if (CP.d < r) { o.x += CP.nx * (r - CP.d); o.y += CP.ny * (r - CP.d); } }
  for (const ob of obstacles) { coverPoint(ob, o.x, o.y, CP); if (CP.d < r) { o.x += CP.nx * (r - CP.d); o.y += CP.ny * (r - CP.d); } }
}
// ---------- ammunition: magazines, reloads, the sidearm, pickups ----------
function startReload(s) {
  const w = WEAPONS[s.weapon];
  if (!s.alive || s.reloadT > 0 || s.pistol || s.mag >= magCap(s)) return;
  if (s.reserve <= 0) {   // nothing left for this gun: the second gun if it has rounds, then the pistol
    if (s.mag <= 0) {
      if (s.alt && s.alt.mag + s.alt.reserve > 0 && swapWeapon(s)) return;
      s.pistol = true;
      if (s.slot === state.controlled) showBanner(weaponDrops.some(d => dist2(d.x, d.y, s.x, s.y) < 600 * 600) ? 'OUT OF AMMO — GRAB A RIFLE' : 'OUT OF AMMO — SIDEARM');
    }
    return;
  }
  s.reloadT = s.reloadDur = w.reload * (s.ext ? EXT_RELOAD : 1);   // the empty magazine is dropped by the view, from the hand
  sfxReload(s);
}
function finishReload(s) {
  const w = WEAPONS[s.weapon], take = Math.min(magCap(s) - s.mag, s.reserve);
  s.mag += take; s.reserve -= take; s.reloadT = 0;
}
function heroReload() {   // R / tap the ammo counter
  const s = soldiers[state.controlled];
  if (screen === 'battle' && state.mode === 'play' && s && s.alive && !(s.swapT > 0)) startReload(s);
}
function sfxReload(s) {   // mag out, fresh mag seated, charging handle racked
  const ctl = s.slot === state.controlled, m = ctl ? 1 : distMul(s.x, s.y);
  if (!ctl && m < 0.45) return;
  const d = s.reloadDur, at = (g, t) => ctl ? { gain: g, delay: d * t } : { gain: g * 0.4 * m, delay: d * t, x: s.x, y: s.y };
  playBuf('rl:out', at(0.45, 0.14));
  playBuf('rl:in', at(0.55, 0.62));
  playBuf('rl:rack', at(0.5, 0.8));
}
function updatePickups(dt) {   // magazines dropped by the dead: walk over one to take it
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.t -= dt;
    let taken = p.t <= 0;
    if (!taken) for (const s of soldiers) {
      if (!s.alive || dist2(s.x, s.y, p.x, p.y) > 36 * 36) continue;
      const w = WEAPONS[s.weapon], cap = magCap(s) * (w.spare + 1);
      if (!s.pistol && s.reserve >= cap) continue;
      s.reserve = Math.min(cap, s.reserve + magCap(s));
      if (s.pistol) { s.pistol = false; s.mag = 0; startReload(s); }
      if (s.slot === state.controlled) {
        floaters.push({ x: p.x, y: p.y, z: 30, txt: '+' + w.mag + ' ' + w.name, life: 1 });
        playBuf('pick', { gain: 0.45, force: true });
      }
      taken = true; break;
    }
    if (taken) pickups.splice(i, 1);
  }
}

