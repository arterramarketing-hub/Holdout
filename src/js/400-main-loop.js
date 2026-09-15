// ============================================================ MAIN LOOP
function tick(dt) {
  if (isPortrait) return;                    // held upright: everything waits for the rotate prompt
  updateAudio(dt);
  if (state.streakT > 0) { state.streakT -= dt; if (state.streakT <= 0) state.streakN = 0; }
  if (screen === 'battle') battleUpdate(dt);
  state.saveT += dt;
  if (state.saveT >= CFG.saveEvery) { state.saveT = 0; saveMeta(); }
}
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (isTouch) checkOrient();   // resize/orientationchange can report stale metrics, so confirm every frame
  tick(dt);
  if (screen === 'battle' && !isPortrait) { renderView(dt); updateBattleHud(); }   // nothing to draw behind the rotate prompt
  else {
  }
  requestAnimationFrame(frame);
}

