// ============================================================ BOOT
loadMeta();
el.hint.textContent = isTouch ? 'LEFT THUMB MOVE · TAP AMMO TO RELOAD' : 'WASD MOVE · R RELOAD · V VIEW';
setTimeout(() => { el.hint.style.opacity = 0; }, 8000);
showScreen('map');
if (isTouch) document.body.classList.add('touch');
checkOrient();
applyOpts();
const glStatus = () => VIEW.ready ? 'Waking the 3D engine (three.js r186) . . . ready'
  : VIEW.failed ? 'Waking the 3D engine . . . <span class="lost">offline — check your connection</span>'
  : 'Waking the 3D engine (three.js r186) . . .';
loadThree().then(() => { const g = document.getElementById('bootgl'); if (g) g.innerHTML = glStatus(); });
// title screen with loading lines (click/key to skip)
(function bootSequence() {
  const bootEl = $('boot'), linesEl = $('bootlines');
  if (isTouch) bootEl.querySelector('.boot-press').textContent = 'Tap to start';
  const lines = [
    'Reading the war journal . . .',
    loadedFromSave
      ? `Save found — Theater ${ROMAN[meta.theater] || meta.theater + 1}`
      : 'No save found — a new campaign begins',
    () => '<span id="bootgl">' + glStatus() + '</span>',
    'Unfolding the operations map',
    '<span class="ok">Ready.</span>',
  ];
  let i = 0, finished = false;
  const iv = setInterval(() => {
    if (i < lines.length) { const ln = lines[i]; linesEl.innerHTML += (typeof ln === 'function' ? ln() : ln) + '\n'; i++; }
    else finish();
  }, 420);
  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(iv);
    bootEl.classList.add('off');
    setTimeout(() => bootEl.remove(), 600);
    if (!loadedFromSave) setTimeout(offerTraining, 700);   // a new campaign: offer the firing range first
  }
  bootEl.addEventListener('click', finish);
  window.addEventListener('keydown', finish, { once: true });
})();
saveMeta();

window.G = { state, meta, cam, CFG, WEAPONS, TERRITORIES,
  get soldiers() { return soldiers; }, get enemies() { return enemies; },
  get mines() { return mines; }, get fires() { return fires; }, get shells() { return shells; },
  get bullets() { return bullets; }, get corpses() { return corpses; }, get obstacles() { return obstacles; },
  keys, joy, enterBattle, exitBattle, useSupport, damageSoldier, saveMeta, showScreen, renderTeam, renderMap,
  VIEW, stats: viewStats, frame(dt = 1 / 60) { renderView(dt); updateBattleHud(); },
  spawn(type, x, y) { spawnEnemy(type); const e = enemies[enemies.length - 1]; if (x != null) { e.x = x; e.y = y; } return e; },
  spawnMany(type, n) { for (let i = 0; i < n; i++) spawnEnemy(type); },
  spawnBoss, visMul, rollSky, SFX, playBuf, heroReload, startReload, destroyCover, navPath, TOWN,
  get pickups() { return pickups; },
  aim, applyOpts, showSettings, fpvActive, crosshairTarget, FPV, adsInfo, heroSight, attFor,
  get buildings() { return buildings; }, get rubble() { return rubble; },
  step(sec) { for (let t = 0; t < sec; t += 1 / 60) tick(1 / 60); } }; // debug fast-forward
requestAnimationFrame(frame);
