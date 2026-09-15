// ============================================================ MAIN LOOP
function tick(dt) {
  if (isPortrait) return;                    // held upright: everything waits for the rotate prompt
  pollPad(dt);
  updateAudio(dt);
  if (state.streakT > 0) { state.streakT -= dt; if (state.streakT <= 0) state.streakN = 0; }
  if (screen === 'battle') battleUpdate(dt);
  state.saveT += dt;
  if (state.saveT >= CFG.saveEvery) { state.saveT = 0; saveMeta(); }
}
let last = performance.now();
function frame(now) {
  if (!frameGate(now, powerCap())) { requestAnimationFrame(frame); return; }   // a frame-rate cap: let this display frame pass
  POWER.frames++;
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw);
  last = now;
  if (isTouch) checkOrient();   // resize/orientationchange can report stale metrics, so confirm every frame
  tick(dt);
  autoQuality(raw);   // the real frame time: a throttled or hidden page is not a slow device
  if (screen === 'battle' && !isPortrait) { renderView(dt); updateBattleHud(); }   // nothing to draw behind the rotate prompt
  requestAnimationFrame(frame);
}

