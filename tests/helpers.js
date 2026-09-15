// Shared test helpers: seeded randomness, fresh campaigns and battles, stepping the simulation, and a bot that
// plays in first person the way a person does (walks toward the fight, puts the crosshair on what it sees, fires).
// Everything here uses the game's own top-level names, which classic scripts share.
const REAL_RANDOM = Math.random;
function seed(n) {   // mulberry32: the same fight every run
  let a = n >>> 0;
  Math.random = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function unseed() { Math.random = REAL_RANDOM; }

function frames(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) G.frame(dt); }
function ticks(n, renderEvery = 0, each) {   // n simulation ticks of 1/60 s, optionally rendering every few
  for (let i = 0; i < n; i++) {
    if (each && each(i) === false) return i;
    tick(1 / 60);
    if (renderEvery && i % renderEvery === 0) G.frame(renderEvery / 60);
  }
  return n;
}
function hero() { return soldiers[state.controlled]; }
function newCampaign() { meta = freshMeta(); applyOpts(); selectedTid = -1; }
function battle({ weapon = 'ar', fpv = true, tid = 1, clear = false, invuln = true, sky = true } = {}) {
  meta.loadout = weapon; meta.opts.fpv = fpv; if ('scheme' in meta.opts) meta.opts.scheme = 'manual';
  applyOpts(); hideModal();
  enterBattle(tid);
  if (sky) { state.tod = 1; state.weather = 'clear'; }
  frames(2);
  if (clear) { enemies.length = 0; state.spawnT = 1e9; }
  const h = hero();
  h.invuln = invuln ? 1e9 : 0;   // also clears the 1 s spawn protection when a test wants you hittable
  return h;
}
function clearArea(x, y, r) {   // no cover within r px of a spot, so a scenario controls exactly what stands where
  obstacles = obstacles.filter(o => Math.hypot(o.x - x, o.y - y) > r);
  mines = mines.filter(m => Math.hypot(m.x - x, m.y - y) > r);
  NAV.dirty = true; propsDirty = true;
}
function addCover(kind, xm, ym, rot) {   // metres, like TOWN
  const o = makeCover(kind, xm * PX, ym * PX, rot);
  obstacles.push(o); NAV.dirty = true; propsDirty = true;
  return o;
}
function benchSquad() {   // the three AI soldiers leave the scenario: down, and never coming back
  for (const s of soldiers) if (s.slot !== state.controlled) { s.alive = false; s.respawnT = 1e9; s.x = -999; s.y = -999; }
}
function eyeZ() { return (FPV.eyeY == null ? 1.62 : FPV.eyeY) * PX; }
function aimAt(h, tx, ty, tz) {   // first person: put the crosshair on a point (sim px, z up)
  const d = Math.hypot(tx - h.x, ty - h.y) || 1;
  aim.yaw = Math.atan2(tx - h.x, -(ty - h.y)); aim.pitch = (tz - eyeZ()) / d; cam.yaw = aim.yaw;
}
function botTick(h) {   // one tick of a first-person player: shoot what you can see, otherwise walk toward the fight
  if (!h || !h.alive) { aim.fire = false; keys.KeyW = false; return; }
  const chest = e => (e.z || 0) + bodyTop(e) * 0.62;
  const canShoot = e => !e.z || (Math.hypot(e.x - h.x, e.y - h.y) > 1 && (chest(e) - eyeZ()) / Math.hypot(e.x - h.x, e.y - h.y) < 0.6 && los3(h.x, h.y, eyeZ(), e.x, e.y, chest(e)));   // a roof you can see and look up at
  const e = nearestVisibleEnemy(h.x, h.y, 900);
  if (e && canShoot(e)) { aimAt(h, e.x, e.y, chest(e)); aim.fire = true; keys.KeyW = false; return; }
  aim.fire = false;
  const b = h._bot || (h._bot = { t: 0, path: null });
  b.t -= 1 / 60;
  const target = nearestEnemy(h.x, h.y, 1e9);
  if (!target) { keys.KeyW = false; return; }
  if (b.t <= 0 || !b.path || !b.path.length) {
    b.t = 0.5;
    let gx = target.x, gy = target.y;
    if (target.z) {   // a marksman on a roof: stand off where it can be shot at, not under it
      const dx = h.x - target.x, dy = h.y - target.y, d = Math.hypot(dx, dy) || 1, far = 24 * PX;
      const a = Math.atan2(dy, dx) + (d > 20 * PX && d < 30 * PX ? 0.9 : 0);   // already standing off with no line on it: circle round
      gx = clamp(target.x + Math.cos(a) * far, 60, CFG.arenaW - 60); gy = clamp(target.y + Math.sin(a) * far, 60, CFG.arenaH - 60);
    }
    b.path = navPath(h.x, h.y, gx, gy, h.r * 0.8 + 2);
  }
  while (b.path && b.path.length && Math.hypot(b.path[0].x - h.x, b.path[0].y - h.y) < 24) b.path.shift();
  const wp = b.path && b.path[0];
  if (!wp) { keys.KeyW = false; return; }
  aim.yaw = Math.atan2(wp.x - h.x, -(wp.y - h.y)); aim.pitch = 0; cam.yaw = aim.yaw;
  keys.KeyW = true;
}
function botFront(maxSeconds = 600, { renderEvery = 60, onSecond } = {}) {   // play the current front to the end with the bot
  let t = 0, maxCalls = 0, maxOnField = 0;
  while (t < maxSeconds * 60 && state.mode !== 'cleared' && state.mode !== 'failed') {
    const h = hero();
    if (h && h.alive) h.invuln = 1e9;
    botTick(h);
    tick(1 / 60);
    if (t % renderEvery === 0) { G.frame(1 / 60); maxCalls = Math.max(maxCalls, G.stats().calls || 0); }
    maxOnField = Math.max(maxOnField, enemies.filter(e => !e.boss).length);
    if (onSecond && t % 60 === 0) onSecond(t / 60);
    t++;
  }
  keys.KeyW = false; aim.fire = false;
  return { seconds: Math.round(t / 60), mode: state.mode, maxCalls, maxOnField, kills: state.kills, down: state.enemyDown, total: state.enemyTotal };
}
function tapEl(el, type, x, y, id = 7) {   // a touch-style pointer event on an element
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', clientX: x, clientY: y }));
}
window.afterEachTest = () => {
  unseed();
  for (const k in keys) keys[k] = false;
  releaseInputs(); aim.ads = false;
  hideModal();
  if (screen !== 'map' && typeof showScreen === 'function') showScreen('map');
};
