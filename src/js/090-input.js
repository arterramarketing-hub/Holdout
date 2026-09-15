// ============================================================ INPUT
const keys = {};
window.addEventListener('keydown', e => {
  if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.code === 'KeyM' && meta) meta.muted = !meta.muted;
  if (screen === 'battle') {
    if (e.code === 'KeyR') heroReload();
    if (e.code === 'KeyO') showSettings();
    if (e.code === 'KeyV') { meta.opts.fpv = !meta.opts.fpv; applyOpts(); saveMeta(); }
    if (e.code === 'Tab') { e.preventDefault(); if (!manualAim()) lockPress(); }
    if (e.code === 'Escape') lockRelease();
    if (e.code === 'KeyQ' || e.code === 'KeyE') { cam.nudge = (e.code === 'KeyQ' ? -1 : 1) * 25 * Math.PI / 180; cam.nudgeT = 2; }
    if (e.code === 'Digit1') useSupport('napalm');
    if (e.code === 'Digit2') useSupport('artillery');
    if (e.code === 'Digit3') useSupport('supply');
  }
  audio(); startAmbience();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('pointerdown', () => { audio(); startAmbience(); });

const joy = { active: false, id: -1, bx: 0, by: 0, x: 0, y: 0, dx: 0, dy: 0 };
const isTouch = 'ontouchstart' in window;
let isPortrait = false;
function checkOrient() {   // a phone held upright has no room for this fight; ask for landscape and wait
  const p = isTouch && innerHeight > innerWidth;
  if (p === isPortrait) return;                      // called every frame: only touch the DOM when it actually flips
  isPortrait = p;
  document.body.classList.toggle('portrait', isPortrait);
}
addEventListener('resize', checkOrient);
addEventListener('orientationchange', checkOrient);
const tap = { id: -1, x: 0, y: 0, t: 0 };   // right-side taps lock onto the enemy under the finger
cv.addEventListener('touchstart', e => {
  e.preventDefault(); audio(); startAmbience();
  const alive = id => { for (const t of e.touches) if (t.identifier === id) return true; return false; };
  if (joy.active && !alive(joy.id)) { joy.active = false; joy.id = -1; joy.dx = joy.dy = 0; }   // a finger whose end we never heard about
  if (look.id >= 0 && !alive(look.id)) look.id = -1;
  for (const t of e.changedTouches) {
    if (t.clientX < innerWidth * 0.55) {
      if (!joy.active) { joy.active = true; joy.id = t.identifier; joy.bx = joy.x = t.clientX; joy.by = joy.y = t.clientY; joy.dx = joy.dy = 0; }
    } else if (manualAim()) { if (look.id < 0) { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; } }
    else if (tap.id < 0) { tap.id = t.identifier; tap.x = t.clientX; tap.y = t.clientY; tap.t = performance.now(); }
  }
}, { passive: false });
cv.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === tap.id && Math.hypot(t.clientX - tap.x, t.clientY - tap.y) > 12) tap.id = -1;
    if (t.identifier === look.id) { addLook(t.clientX - look.x, t.clientY - look.y, 0.006); look.x = t.clientX; look.y = t.clientY; continue; }
    if (t.identifier !== joy.id) continue;
    joy.x = t.clientX; joy.y = t.clientY;
    let dx = joy.x - joy.bx, dy = joy.y - joy.by;
    const d = Math.hypot(dx, dy), R = 52;
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    joy.dx = dx / R; joy.dy = dy / R;
  }
}, { passive: false });
function endTouch(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === joy.id) { joy.active = false; joy.id = -1; joy.dx = joy.dy = 0; }
    if (t.identifier === tap.id) { if (performance.now() - tap.t < 250) tapLock(t.clientX, t.clientY); tap.id = -1; }
    if (t.identifier === look.id) look.id = -1;
  }
}
cv.addEventListener('contextmenu', e => { e.preventDefault(); if (screen === 'battle' && !manualAim()) lockPress(); });
cv.addEventListener('touchend', endTouch); cv.addEventListener('touchcancel', endTouch);
function moveVector() {
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my -= 1;
  if (keys.KeyS || keys.ArrowDown) my += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (mx || my) { const d = Math.hypot(mx, my); mx /= d; my /= d; }
  else if (joy.active && (joy.dx || joy.dy)) { mx = joy.dx; my = joy.dy; }
  else return { x: 0, y: 0 };
  const c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);   // camera-relative: "up" walks where the camera looks
  return { x: mx * c - my * s, y: mx * s + my * c };
}

// ---------- free aim: the manual scheme and first person ----------
// Auto-fire keeps the old behaviour (the soldier picks targets). Manual hands you the crosshair: the
// camera looks where you look, the trigger is yours, and aim assist only nudges — it never fires.
const aim = { yaw: 0, pitch: 0, fire: false, ads: false, sticky: false, lookDx: 0, settle: 0, settleY: 0 };
const manualAim = () => !!meta && (meta.opts.scheme === 'manual' || meta.opts.fpv);
const fpvActive = () => !!meta && meta.opts.fpv && state.mode === 'play'
  && !!soldiers[state.controlled] && soldiers[state.controlled].alive && !soldiers[state.controlled].horse;
function addLook(dx, dy, scale) {
  const k = meta.opts.sens * scale * (aim.ads ? adsSens() : 1) * (aim.sticky ? 0.65 : 1);
  aim.yaw = angWrap(aim.yaw + dx * k);
  aim.pitch = clamp(aim.pitch - dy * k * 0.8, -0.7, 0.7);
  aim.lookDx = aim.lookDx * 0.6 + dx * k * 0.4;
}
function crosshairTarget(s, cone) {   // the enemy nearest the middle of the screen — for aim assist and the crosshair
  const fx = Math.sin(aim.yaw), fy = -Math.cos(aim.yaw);
  let best = null, bs = cone;
  for (const e of enemies) {
    const dx = e.x - s.x, dy = e.y - s.y, d = Math.hypot(dx, dy) || 1;
    if (d > 950) continue;
    const score = Math.acos(clamp((dx * fx + dy * fy) / d, -1, 1)) + d / 950 * 0.04;
    if (score < bs && losClear(s.x, s.y, e.x, e.y)) { bs = score; best = e; }
  }
  return best;
}
function aimAssist(s, dt) {   // a gentle pull toward a target already under the crosshair, plus stickier look
  const t = (meta.opts.aimAssist && !meta.opts.fpv) ? crosshairTarget(s, 0.2) : null;   // first person is yours to aim
  aim.sticky = !!t;
  if (!t) return;
  const want = Math.atan2(t.x - s.x, -(t.y - s.y));
  aim.yaw = angWrap(aim.yaw + clamp(angWrap(want - aim.yaw), -0.6, 0.6) * Math.min(1, dt * 3.4) * 0.4);
}
function lockPointer() {   // some hosts (an iframe without allow-pointer-lock) refuse: fall back to edge steering
  if (aim.noLock || !cv.requestPointerLock || document.pointerLockElement === cv) return;
  try {
    const p = cv.requestPointerLock();
    if (p && p.catch) p.catch(() => { aim.noLock = true; });
  } catch (e) { aim.noLock = true; }
}
function steerFromCursor(dt) {   // only a real mouse, only where the host refuses pointer lock: the further the cursor sits from the middle, the faster you turn
  if (isTouch || !aim.noLock || aim.cx == null || !manualAim() || screen !== 'battle' || document.pointerLockElement === cv) return;
  const dx = (aim.cx - innerWidth / 2) / (innerWidth / 2), dy = (aim.cy - innerHeight / 2) / (innerHeight / 2), dead = 0.12;
  const ax = Math.abs(dx) < dead ? 0 : (dx - Math.sign(dx) * dead) / (1 - dead);
  const ay = Math.abs(dy) < dead ? 0 : (dy - Math.sign(dy) * dead) / (1 - dead);
  if (ax || ay) addLook(ax * 900 * dt, ay * 520 * dt, 0.0024);
}
cv.addEventListener('mousedown', e => {
  if (screen !== 'battle' || !manualAim()) return;
  if (e.button === 0) { aim.fire = true; lockPointer(); }
  else if (e.button === 2) aim.ads = true;
});
window.addEventListener('mouseup', e => { if (e.button === 0) aim.fire = false; if (e.button === 2) aim.ads = false; });
document.addEventListener('mousemove', e => {
  if (screen !== 'battle' || !manualAim()) return;
  if (document.pointerLockElement === cv) addLook(e.movementX, e.movementY, 0.0024);
  else if (!isTouch && !(e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) && e.target === cv) { aim.cx = e.clientX; aim.cy = e.clientY; }   // a phone's tap makes fake mouse moves: never steer from those
  else aim.cx = null;
});
cv.addEventListener('mouseleave', () => { aim.cx = null; });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== cv) { aim.fire = false; aim.ads = false; aim.cx = null; } });
function releaseInputs() {   // let go of everything held: a trigger, a thumb, a parked cursor
  aim.fire = false; aim.cx = null;
  joy.active = false; joy.id = -1; joy.dx = joy.dy = 0;
  look.id = -1; tap.id = -1;
}
window.addEventListener('blur', releaseInputs);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseInputs(); });
const look = { id: -1, x: 0, y: 0 };   // the thumb that aims
function bindHoldButton(id, down, up) {
  const b = $(id);
  if (!b) return;
  const last = { x: 0, y: 0 };   // this button's own finger: sharing the look thumb's record made the aim jump between the two
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); last.x = e.clientX; last.y = e.clientY; down();   // act first: capture is a nicety
    try { b.setPointerCapture(e.pointerId); } catch (err) {}
  });
  b.addEventListener('pointermove', e => {   // dragging off the button still steers the camera
    if (!b.hasPointerCapture(e.pointerId)) return;
    addLook(e.clientX - last.x, e.clientY - last.y, 0.006);
    last.x = e.clientX; last.y = e.clientY;
  });
  const end = e => { try { if (b.hasPointerCapture(e.pointerId)) b.releasePointerCapture(e.pointerId); } catch (err) {} up(); };
  b.addEventListener('pointerup', end);
  b.addEventListener('pointercancel', end);
  b.addEventListener('lostpointercapture', () => up());   // hidden or cancelled mid-press: never leave the trigger held
}
// ---------- Z-targeting ----------
const lock = { target: null, on: false, retargetT: 0 };
function lockCandidates(s) {   // ahead of the camera and close first; bosses and spotters jump the queue
  const fx = Math.sin(cam.yaw), fy = -Math.cos(cam.yaw), out = [], maxD = 700 * visMul();
  for (const e of enemies) {
    const dx = e.x - s.x, dy = e.y - s.y, d = Math.hypot(dx, dy);
    if (d > maxD) continue;
    const ang = Math.acos(clamp((dx * fx + dy * fy) / (d || 1), -1, 1));
    out.push([ang + d / 700 * 0.6 - (e.boss ? 0.5 : 0) - (e.spotter ? 0.3 : 0), e]);
  }
  return out.sort((a, b) => a[0] - b[0]).map(p => p[1]);
}
function lockAcquire(cycle) {
  const s = soldiers[state.controlled];
  if (screen !== 'battle' || state.mode !== 'play' || !s || !s.alive) return;
  const list = lockCandidates(s);
  if (!list.length) { lockRelease(); return; }
  const i = cycle && lock.target ? list.indexOf(lock.target) : -1;
  lock.target = list[(i + 1) % list.length];
  lock.on = true; lock.retargetT = 0;
  beep(1320, 0.05, 'square', 0.03, -500);
}
function lockRelease() {
  if (lock.on) beep(520, 0.05, 'square', 0.02, -200);
  lock.target = null; lock.on = false;
}
const lockPress = () => lockAcquire(lock.on && !!lock.target);
function updateLock(dt) {   // a locked target that dies hands the lock to the next one after a beat
  if (!lock.on) return;
  if (lock.target && (lock.target.hp <= 0 || !enemies.includes(lock.target))) { lock.target = null; lock.retargetT = 0.25; }
  if (!lock.target && (lock.retargetT -= dt) <= 0) lockAcquire(false);
}
function tapLock(x, y) {
  if (screen !== 'battle' || state.mode !== 'play' || !VIEW.ready) return;
  const e = pickEnemyAtScreen(x, y, 56);
  if (!e) return;
  lock.target = e; lock.on = true; lock.retargetT = 0;
  beep(1320, 0.05, 'square', 0.03, -500);
}

