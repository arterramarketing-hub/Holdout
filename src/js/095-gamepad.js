// ---------- controller: the standard Gamepad mapping, in battle and in the menus ----------
// Battle: left stick moves (radial deadzone 0.15), right stick looks (deadzone 0.12, response curve ^1.8, its own
// sensitivity), RT fires, LT aims down the sights, RB throws a grenade, X reloads, Y switches view, L3 sprints (until
// the stick comes back), D-pad ← ↑ → calls killstreaks 1-3, START opens settings, VIEW goes back to the map.
// Menus: the stick or D-pad moves focus (a visible ring), A presses, B backs out; on the start menu LB/RB cycle sectors
// and Y opens the loadout. Rumble follows the Vibration setting. Whatever was touched last decides the prompts.
const GPAD = { seen: false, active: false, lastInput: 'kbm', prev: [], lx: 0, ly: 0, fire: false, ads: false, navT: 0, rumbleIdx: -1 };
const GPB = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, START: 9, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
function currentPad() {
  let pads = [];
  try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { return null; }   // a host frame can refuse the Gamepad API: a throw here would stop the game loop
  for (const p of pads || []) if (p && p.connected !== false && p.buttons && p.buttons.length >= 16) return p;
  return null;
}
const padCurve = v => Math.sign(v) * Math.pow(Math.abs(v), 1.8);
function pollPad(dt) {
  const p = currentPad();
  if (!p) {
    if (GPAD.active) { GPAD.active = false; GPAD.lx = GPAD.ly = 0; if (GPAD.fire) aim.fire = false; if (GPAD.ads) aim.ads = false; GPAD.fire = GPAD.ads = false; aim.sprintPad = false; }
    return;
  }
  const val = i => (p.buttons[i] ? (typeof p.buttons[i] === 'object' ? (p.buttons[i].pressed ? Math.max(1, p.buttons[i].value || 0) : p.buttons[i].value || 0) : p.buttons[i]) : 0);
  const held = i => val(i) > 0.35, hit = i => held(i) && !GPAD.prev[i];
  let lx = p.axes[0] || 0, ly = p.axes[1] || 0;
  const lm = Math.hypot(lx, ly);
  if (lm < 0.15) lx = ly = 0; else { const k = Math.min(1, (lm - 0.15) / 0.85) / lm; lx *= k; ly *= k; }
  let rx = p.axes[2] || 0, ry = p.axes[3] || 0;
  rx = Math.abs(rx) < 0.12 ? 0 : Math.sign(rx) * (Math.abs(rx) - 0.12) / 0.88;
  ry = Math.abs(ry) < 0.12 ? 0 : Math.sign(ry) * (Math.abs(ry) - 0.12) / 0.88;
  const touched = lm > 0.3 || Math.abs(rx) > 0.25 || Math.abs(ry) > 0.25 || p.buttons.some((b, i) => held(i));
  GPAD.seen = true; GPAD.active = true;
  if (touched && GPAD.lastInput !== 'pad') { GPAD.lastInput = 'pad'; document.body.classList.add('pad'); if (screen === 'battle') applyOpts(); }
  const modalOpen = el.modal.style.display === 'flex';
  if (modalOpen) padMenu(p, hit, lx, ly, dt, $('modalbox'));
  else if (screen === 'battle' && state.mode === 'play') {
    GPAD.lx = lx; GPAD.ly = ly;
    if (rx || ry) {
      const k = (meta.opts.padSens || 1) * (aim.ads ? adsSens() : 1) * (aim.sticky ? 0.65 : 1);
      const yawRate = padCurve(rx) * 3.4 * k, pitchRate = padCurve(ry) * 2.3 * k;
      aim.yaw = angWrap(aim.yaw + yawRate * dt);
      aim.pitch = clamp(aim.pitch - pitchRate * dt, -0.7, 0.7);
      aim.lookDx = aim.lookDx * 0.6 + yawRate * dt * 0.4;
    }
    const rt = held(GPB.RT), lt = held(GPB.LT);
    if (rt !== GPAD.fire) { GPAD.fire = rt; aim.fire = rt; }
    if (lt !== GPAD.ads) { GPAD.ads = lt; aim.ads = lt; const ab = $('adsbtn'); if (ab) ab.classList.toggle('on', lt); }
    if (hit(GPB.RB)) throwGrenade(soldiers[state.controlled]);
    if (hit(GPB.X)) heroReload();
    if (hit(GPB.Y)) { meta.opts.fpv = !meta.opts.fpv; applyOpts(); saveMeta(); }
    if (hit(GPB.L3)) aim.sprintPad = !aim.sprintPad;
    if (aim.sprintPad && ly > -0.3) aim.sprintPad = false;   // the sprint ends when the stick comes back
    if (hit(GPB.LEFT)) useSupport('napalm');
    if (hit(GPB.UP)) useSupport('artillery');
    if (hit(GPB.RIGHT)) useSupport('supply');
    if (hit(GPB.START)) showSettings();
    if (hit(GPB.VIEW)) $('tomap').click();
  } else if (screen === 'battle') {
    GPAD.lx = GPAD.ly = 0;
    if (GPAD.fire) { GPAD.fire = false; aim.fire = false; }
  } else if (screen === 'map') {
    GPAD.lx = GPAD.ly = 0;
    if (!document.getElementById('boot')) {
      if (hit(GPB.LB) || hit(GPB.LEFT)) cycleSector(-1);
      if (hit(GPB.RB) || hit(GPB.RIGHT)) cycleSector(1);
      if (hit(GPB.Y)) showScreen('team');
      if (hit(GPB.START)) showSettings();
      const focus = document.activeElement;
      if (hit(GPB.A)) { if (focus && focus !== document.body && focus.closest('.brief')) focus.click(); else deploySelected(); }
      padMenu(p, hit, 0, ly, dt, document.querySelector('.brief'), true);
    }
  } else if (screen === 'team') {
    GPAD.lx = GPAD.ly = 0;
    padMenu(p, hit, lx, ly, dt, $('teamscr'));
    if (hit(GPB.B)) showScreen('map');
  }
  GPAD.prev = p.buttons.map((b, i) => held(i));
}
function padMenu(p, hit, lx, ly, dt, root, verticalOnly) {   // spatial focus: the nearest control in the direction pushed
  if (!root) return;
  GPAD.navT -= dt;
  let dx = hit(GPB.RIGHT) ? 1 : hit(GPB.LEFT) ? -1 : 0, dy = hit(GPB.DOWN) ? 1 : hit(GPB.UP) ? -1 : 0;
  if (!dx && !dy && GPAD.navT <= 0 && Math.hypot(lx, ly) > 0.6) { dx = Math.abs(lx) > Math.abs(ly) ? Math.sign(lx) : 0; dy = dx ? 0 : Math.sign(ly); GPAD.navT = 0.22; }
  if (verticalOnly) dx = 0;
  const focus = document.activeElement && root.contains(document.activeElement) ? document.activeElement : null;
  if (focus && focus.type === 'range' && dx) { focus.value = +focus.value + dx * (+focus.step || 0.05) * 2; focus.dispatchEvent(new Event('input', { bubbles: true })); dx = 0; }
  if (dx || dy) {
    const els = [...root.querySelectorAll('button, input, select, [tabindex]')].filter(e => !e.disabled && e.offsetParent !== null);
    if (!els.length) return;
    if (!focus) { els[0].focus(); return; }
    const a = focus.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bs = Infinity;
    for (const e of els) {
      if (e === focus) continue;
      const b = e.getBoundingClientRect(), vx = b.left + b.width / 2 - ax, vy = b.top + b.height / 2 - ay;
      const along = vx * dx + vy * dy, across = Math.abs(vx * dy) + Math.abs(vy * dx);
      if (along <= 4) continue;
      const score = along + across * 2.5;
      if (score < bs) { bs = score; best = e; }
    }
    if (best) best.focus();
  }
  if (hit(GPB.A) && !focus && root !== document.querySelector('.brief')) {   // nothing focused yet: A takes a card's main action, and wakes the focus ring elsewhere
    const main = root.id === 'modalbox' ? root.querySelector('.cta:not([disabled])') : null;
    if (main) main.click();
    else { const first = root.querySelector('.wrow.on, button, input, select, [tabindex]'); if (first) first.focus(); }
    return;
  }
  if (hit(GPB.A) && focus && root !== document.querySelector('.brief')) {
    if (focus.type === 'checkbox' || focus.type === 'radio') { focus.checked = focus.type === 'radio' ? true : !focus.checked; focus.dispatchEvent(new Event('change', { bubbles: true })); focus.dispatchEvent(new Event('input', { bubbles: true })); }
    else if (focus.tagName === 'SELECT') { focus.selectedIndex = (focus.selectedIndex + 1) % focus.options.length; focus.dispatchEvent(new Event('change', { bubbles: true })); }
    else focus.click();
  }
  if (hit(GPB.B) && root.id === 'modalbox') { const done = $('mbtn'); if (done && /done/i.test(done.textContent)) done.click(); }
}
function padRumble(ms, strong) {
  const p = currentPad();
  if (!p || !meta || !meta.opts.vibe || !p.vibrationActuator || !p.vibrationActuator.playEffect) return;
  try {
    const r = p.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong ? 0.8 : 0.35, weakMagnitude: strong ? 0.5 : 0.6 });
    if (r && r.catch) r.catch(() => {});   // a refused rumble is not an error worth logging
  } catch (e) {}
}
