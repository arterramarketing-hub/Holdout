// ============================================================ BASIC TRAINING
// The firing range, run up Main Street from the FOB gate: move to a marker, look at three signs, knock down three
// pop-up steel targets at 10 m, two at 22 m down the sights, reload, sprint to the square, frag a cluster of three, and
// take a training flag. Every prompt speaks the input you last used (keyboard and mouse, touch, or controller). No
// enemy waves, no reserves, no Warlord, and nothing can hurt you; nothing is saved to a sector. A new campaign is
// offered it on first launch, and the start menu's range button opens it any time.
const TRAIN_STEPS = [
  { id: 'move', title: 'Move to the marker', hint: { kbm: 'W A S D to move', touch: 'Drag your left thumb to move', pad: 'Left stick to move' } },
  { id: 'look', title: 'Look at the three signs', hint: { kbm: 'Move the mouse to look — click once to capture it', touch: 'Drag your right thumb to look', pad: 'Right stick to look' } },
  { id: 'shoot', title: 'Knock down the three targets', hint: { kbm: 'Left click fires', touch: 'Press a fire button', pad: 'RT fires' } },
  { id: 'ads', title: 'Down the sights: the two far targets', hint: { kbm: 'Hold right click to aim, then fire', touch: 'Tap ADS, then fire', pad: 'Hold LT to aim, RT to fire' } },
  { id: 'reload', title: 'Reload', hint: { kbm: 'Press R', touch: 'Tap reload, or the ammo count', pad: 'Press X' } },
  { id: 'sprint', title: 'Sprint to the marker in the square', hint: { kbm: 'Hold Shift while moving forward', touch: 'Push the stick all the way forward', pad: 'Click the left stick while moving' } },
  { id: 'grenade', title: 'Frag the three targets', hint: { kbm: 'Press G to throw', touch: 'Tap the grenade button', pad: 'Press RB to throw' } },
  { id: 'capture', title: 'Take the flag', hint: { kbm: 'Stand in its ring until it turns blue', touch: 'Stand in its ring until it turns blue', pad: 'Stand in its ring until it turns blue' } },
];
const RANGE = {   // metres
  start: [48, 58.5], move: [48, 51], signs: [[42.5, 46], [48, 43.5], [53.5, 46]],
  shoot: [[45.5, 41], [48, 41], [50.5, 41]], far: [[44.2, 28.6], [51.2, 28.6]], sprint: [48, 33],
  frag: [[50.8, 21.4], [51.8, 20.6], [52.6, 21.4]], flag: [48, 38.5],
};
const inputKind = () => GPAD.lastInput === 'pad' ? 'pad' : isTouch ? 'touch' : 'kbm';
function enterTraining() {
  if (!VIEW.ready) { enterBattle(1); return; }   // enterBattle shows the loading card; the range opens from the menu again after
  const keep = FORECAST[1];
  enterBattle(1);
  if (keep) FORECAST[1] = keep; else delete FORECAST[1];   // the range must not use up Miller Fields' forecast
  state.training = { step: 0, t: 0, wait: 0, seen: [false, false, false], sprintT: 0, done: false };
  state.tod = 1; state.weather = 'clear';
  enemies.length = 0; state.spawnT = 1e9; state.enemyTotal = 1; state.enemyDown = 0; state.progress = 0;
  mines = [];
  obstacles = obstacles.filter(o => STATIC_COVER.has(o.kind) || !(o.x > 40 * PX && o.x < 56 * PX && o.y > 15 * PX && o.y < 62 * PX));   // nothing rolled onto the course
  NAV.dirty = true; propsDirty = true;
  setupObjectives([]);
  soldiers = [soldiers[state.controlled]];
  soldiers[0].slot = 0; state.controlled = 0;
  const h = soldiers[0];
  h.x = RANGE.start[0] * PX; h.y = RANGE.start[1] * PX; h.invuln = 1e9;
  aim.yaw = 0; aim.pitch = 0; cam.yaw = 0; cam.snap = true;
  document.body.classList.add('training');
  supportsDirty = true;
  if (VIEW.ready) { buildProps(); viewEnterBattle(); }
  trainingStepBegin();
}
function exitTraining(toMap = true) {
  if (!state.training) return;
  state.training = null;
  document.body.classList.remove('training');
  hideModal();
  if (toMap) showScreen('map');
}
function spawnTarget(xm, ym) {
  enemies.push({ type: 'target', target: true, r: 12, col: '#8a8d86', dmg: 0, horse: false, ranged: 0, spotter: false, spotCd: 0, fireT: 0,
    hp: 1, maxHp: 1, sp: 0, x: xm * PX, y: ym * PX, cd: 0, flash: 0, wob: 0, walk: 0, atk: 0, face: 1, aim: Math.PI / 2, down: 0, fold: 0, tac: 'hold', tacT: 1e9 });
  return enemies[enemies.length - 1];
}
function trainingStepBegin() {
  const T = state.training, step = TRAIN_STEPS[T.step], h = soldiers[0];
  T.t = 0; T.sprintT = 0; T.fragDowns = 0; T.adsDowns = 0;
  enemies.length = 0; grenades.length = 0;
  if (step.id === 'shoot') RANGE.shoot.forEach(p => spawnTarget(p[0], p[1]));
  if (step.id === 'ads') RANGE.far.forEach(p => spawnTarget(p[0], p[1]));
  if (step.id === 'reload') { h.mag = Math.floor(magCap(h) / 2); h.reserve = Math.max(h.reserve, magCap(h) * 2); h.pistol = false; }
  if (step.id === 'grenade') { RANGE.frag.forEach(p => spawnTarget(p[0], p[1])); h.frags = CFG.frags; }
  if (step.id === 'capture') setupObjectives([{ name: 'Training flag', x: RANGE.flag[0], y: RANGE.flag[1], r: 4 }], { neutral: true, noDrain: true, speed: 1.5 });
  else setupObjectives([]);
  T.dirty = true;
}
function trainingMarker() {   // where this step wants you, if anywhere (sim px and radius)
  const T = state.training, id = TRAIN_STEPS[T.step] && TRAIN_STEPS[T.step].id;
  if (id === 'move') return { x: RANGE.move[0] * PX, y: RANGE.move[1] * PX, r: 1.6 * PX };
  if (id === 'sprint') return { x: RANGE.sprint[0] * PX, y: RANGE.sprint[1] * PX, r: 1.8 * PX };
  return null;
}
function updateTraining(dt) {
  const T = state.training, h = soldiers[0];
  if (!T || T.done || !h) return;
  h.invuln = 1e9; h.hp = h.maxHp;
  T.t += dt;
  for (const e of enemies) if (e.target) e.fold = approach(e.fold, e.down ? 1 : 0, 5, dt);
  if (T.wait > 0) { T.wait -= dt; if (T.wait <= 0) { T.step++; if (T.step >= TRAIN_STEPS.length) trainingComplete(); else trainingStepBegin(); } return; }
  const id = TRAIN_STEPS[T.step].id;
  let ok = false;
  if (id === 'move' || id === 'sprint') {
    const m = trainingMarker();
    if (id === 'sprint' && h.sprinting) T.sprintT += dt;
    ok = dist2(h.x, h.y, m.x, m.y) < m.r * m.r && (id === 'move' || T.sprintT >= 0.6);
  } else if (id === 'look') {
    RANGE.signs.forEach((p, i) => { const a = Math.atan2(p[0] * PX - h.x, -(p[1] * PX - h.y)); if (Math.abs(angWrap(a - aim.yaw)) < 0.1) { if (!T.seen[i]) { T.seen[i] = true; T.dirty = true; beep(1500, 0.05, 'square', 0.03); } } });
    ok = T.seen.every(Boolean);
  } else if (id === 'shoot') ok = enemies.length > 0 && enemies.every(e => e.down);
  else if (id === 'ads') ok = T.adsDowns >= RANGE.far.length;
  else if (id === 'reload') ok = h.reloadT > 0 || (T.t > 0.1 && h.mag >= magCap(h));
  else if (id === 'grenade') {
    ok = T.fragDowns >= 2;
    if (!ok && h.frags <= 0 && !grenades.length) { T.refillT = (T.refillT || 0) + dt; if (T.refillT > 1) { h.frags = CFG.frags; T.refillT = 0; for (const e of enemies) e.down = 0; T.fragDowns = 0; } }
  } else if (id === 'capture') ok = state.objs[0] && state.objs[0].owner === 'p';
  if (ok) { T.wait = 0.8; T.dirty = true; beep(880, 0.08, 'square', 0.05); beep(1320, 0.14, 'square', 0.05, 0, 0.08); }
}
function targetHit(e, credit) {   // a steel target rings and folds; it does not die
  if (e.down) return;
  e.down = 1;
  HITFX.hit = 0.14; HITFX.kill = 0.12;
  beep(2400, 0.09, 'triangle', 0.05, -200); beep(3100, 0.07, 'sine', 0.03, 0, 0.02);
  const T = state.training;
  if (T) {
    if (credit.wkey === 'frag') T.fragDowns = (T.fragDowns || 0) + 1;
    else if (aim.ads) T.adsDowns = (T.adsDowns || 0) + 1;
    T.dirty = true;
  }
}
function trainingComplete() {
  const T = state.training;
  T.done = true;
  meta.trained = true; saveMeta();
  showModal(`
    <div class="eyebrow">Basic training</div>
    <h2>Ready</h2>
    <p class="lede">You can move, look, shoot, aim, reload, sprint, throw a frag and take an objective. The Ninth Company is waiting.</p>
    <button class="cta" id="mbtn">Deploy</button>
    <button class="btn" id="mback">Back to the map</button>`);
  $('mbtn').onclick = () => { exitTraining(); deploySelected(); };
  $('mback').onclick = () => exitTraining();
}
function offerTraining() {   // a new campaign's first look at the map
  if (meta.trained || state.training || screen !== 'map' || el.modal.style.display === 'flex') return;
  showModal(`
    <div class="eyebrow">Basic training</div>
    <h2>First time?</h2>
    <p class="lede">Two minutes at the firing range: moving, looking, shooting, sights, reloading, sprinting, grenades and objectives.</p>
    <button class="cta" id="mbtn">Start training</button>
    <button class="btn" id="mskip">Skip</button>`);
  $('mbtn').onclick = () => { hideModal(); enterTraining(); };
  $('mskip').onclick = () => { meta.trained = true; saveMeta(); hideModal(); };
}
