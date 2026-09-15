// ============================================================ ENEMY GUNS AND THE SECOND GUN
// Riflemen drop their AK-47 and gunners their PKM where they fall (DROP_KIND), with what was left in the magazine and
// one spare, for CFG.dropLife seconds (blinking for the last 5). You carry two guns: the one in your hands keeps the
// soldier's own weapon / mag / reserve / sight / ext / supp fields, so everything that reads them stays right, and the
// other waits in s.alt. Near a dropped gun a prompt names it; hold F (X on a controller, the button on a phone) for
// CFG.pickHold to take it. With a free slot what you had goes on your back; with both full the gun in your hands drops
// where you stand. On the pistol with a free slot, walking over a gun takes it at once; walking over one of a kind you
// carry takes its rounds. Q, the mouse wheel, Y on a controller or the swap button changes guns in CFG.swapTime — they
// trade places halfway, both out of sight — with no firing meanwhile, and it cancels a reload. A gun that runs dry
// swaps itself for a loaded second gun before the pistol comes out. A reinforcement comes back with the loadout gun.
const DROP_KIND = { grunt: 'ak', gunner: 'pkm' };
const PICK_R = 64, AUTO_R = 36;   // px: close enough to be offered a gun; close enough to walk over one
let weaponDrops = [];
const gunName = key => (WEAPONS[key] || SIDEARM).name;
const gunRecord = s => ({ weapon: s.weapon, mag: s.mag, reserve: s.reserve, sight: s.sight, ext: s.ext, supp: s.supp });
const gunCap = g => { const w = WEAPONS[g.weapon]; return (g.ext && w.ext ? w.ext : w.mag) * (w.spare + 1); };   // rounds carried at most, magazine included
function wearGun(s, g) {
  s.weapon = g.weapon; s.mag = g.mag; s.reserve = g.reserve; s.sight = g.sight || 'iron'; s.ext = !!g.ext; s.supp = !!g.supp;
  s.pistol = s.mag <= 0 && s.reserve <= 0;
}
function dropGun(key, x, y, mag, reserve, extra) {
  const d = Object.assign({ key, x: clamp(x, 20, CFG.arenaW - 20), y: clamp(y, 20, CFG.arenaH - 20), yaw: 0, mag, reserve, t: CFG.dropLife,
    sight: 'iron', ext: false, supp: false }, extra);
  weaponDrops.push(d);
  if (weaponDrops.length > 14) weaponDrops.shift();
  return d;
}
function swapWeapon(s) {
  if (!s || !s.alive || !s.alt || screen !== 'battle' || state.mode !== 'play' || s.slot !== state.controlled || s.swapT > 0 || s.throwT > 0.35) return false;
  s.swapT = CFG.swapTime; s.swapped = false; s.reloadT = 0;
  if (aim.ads) { aim.ads = false; const ab = document.getElementById('adsbtn'); if (ab) ab.classList.remove('on'); }
  playBuf('rl:out', { gain: 0.25, rate: 1.35, force: true });   // the sling rattles
  return true;
}
function updateSwap(s, dt) {
  if (!(s.swapT > 0)) return;
  s.swapT -= dt;
  if (!s.swapped && s.swapT <= CFG.swapTime / 2) {   // both guns out of sight: they trade places
    const held = gunRecord(s);
    wearGun(s, s.alt);
    s.alt = held; s.swapped = true;
    playBuf('rl:rack', { gain: 0.3, rate: 1.15, force: true });
  }
  if (s.swapT < 0) s.swapT = 0;
}
function takeGun(s, d) {
  if (!s.alt) s.alt = gunRecord(s);   // a free slot: what you had goes on your back
  else if (!s.pistol && s.mag + s.reserve > 0)
    dropGun(s.weapon, s.x + rand(-14, 14), s.y + rand(-14, 14), s.mag, s.reserve, { yaw: rand(0, TAU), sight: s.sight, ext: s.ext, supp: s.supp });   // both full: this one goes down where you stand
  wearGun(s, { weapon: d.key, mag: d.mag, reserve: d.reserve, sight: d.sight, ext: d.ext, supp: d.supp });
  weaponDrops.splice(weaponDrops.indexOf(d), 1);
  s.reloadT = 0; s.pickT = 0; s.swapT = CFG.swapTime / 2; s.swapped = true;   // it comes up into view
  floaters.push({ x: d.x, y: d.y, z: 30, txt: gunName(d.key), life: 1 });
  playBuf('pick', { gain: 0.5, force: true });
}
function takeAmmo(s, d, into) {   // a dropped gun of a kind you carry: as many of its rounds as fit
  const room = gunCap(into) - into.mag - into.reserve;
  if (room <= 0) return false;
  const got = Math.min(room, d.mag + d.reserve);
  into.reserve += got;
  weaponDrops.splice(weaponDrops.indexOf(d), 1);
  floaters.push({ x: d.x, y: d.y, z: 30, txt: `+${got} ${gunName(d.key)}`, life: 1 });
  playBuf('pick', { gain: 0.45, force: true });
  if (into === s && s.pistol) { s.pistol = false; startReload(s); }
  return true;
}
function updateWeaponDrops(dt) {
  for (let i = weaponDrops.length - 1; i >= 0; i--) if ((weaponDrops[i].t -= dt) <= 0) weaponDrops.splice(i, 1);
  const s = soldiers[state.controlled];
  state.pickDrop = null;
  if (!s || !s.alive || state.mode !== 'play') { if (s) s.pickT = 0; return; }
  let near = null, nd = PICK_R * PICK_R;
  for (const d of weaponDrops) {
    const dd = dist2(s.x, s.y, d.x, d.y);
    if (dd > nd) continue;
    const mine = d.key === s.weapon ? s : s.alt && d.key === s.alt.weapon ? s.alt : null;
    if (mine) { if (dd < AUTO_R * AUTO_R && takeAmmo(s, d, mine)) return; continue; }   // your kind: its rounds, just by walking over it
    if (s.pistol && !s.alt && dd < AUTO_R * AUTO_R) { takeGun(s, d); return; }        // dry with a free slot: no waiting
    nd = dd; near = d;
  }
  state.pickDrop = near;
  if (near && aim.take && !(s.swapT > 0)) {
    s.pickT = (s.pickT || 0) + dt;
    if (s.pickT >= CFG.pickHold) takeGun(s, near);
  } else s.pickT = 0;
}
