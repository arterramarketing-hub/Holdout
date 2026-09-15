// ---------- footsteps, enemy barks, squad callouts ----------
// FOOTSTEPS: everyone who walks leaves a footfall every stride (0.78 m; 1.05 m sprinting, 0.95 m for a runner), and the
// sound is the ground under them (hard for asphalt, paving, concrete and cobbles; gravel; soft for dirt and grass).
// Yours are quiet and centred; squadmates quieter; enemies are placed in stereo and fade out by 25 m, runners and
// breachers louder. No more than six footfalls in any quarter second.
// BARKS: enemies shout — not words — when they spot one of yours, start a flank, change magazines or charge; placed where
// they stand, pitched per voice, never within 1.2 s of another bark or 6 s of that enemy's last (a frag's shout skips the 6 s).
// CALLOUTS: when an enemy within 25 m is outside your view (more than 60° off your aim) and a squadmate can see it, the
// squad net chirps and a tag says where: FLANK · LEFT, FLANK · RIGHT or BEHIND. One every 4 s, each enemy called once in
// 8 s. The Callouts setting turns them off.
const STEP_SURF = { asphalt: 'hard', paving: 'hard', concrete: 'hard', cobble: 'hard', gravel: 'gravel', dirt: 'soft', grass: 'soft' };
const STEP_GAIN = { runner: 1.25, brute: 1.5, boss: 1.9 };
const VOICE = { steps: 0, barkT: -99, callCd: 0, scanT: 0, barks: [] };
function surfaceAt(x, y) {   // the ground under a sim point: the last rectangle laid over it wins
  const xm = x / PX, ym = y / PX, G = TOWN.ground;
  for (let i = G.length - 1; i >= 0; i--) { const g = G[i]; if (xm >= g[0] && xm < g[2] && ym >= g[1] && ym < g[3]) return STEP_SURF[g[4]] || 'soft'; }
  return 'soft';
}
function stepSound(u, moved, who) {
  if (!moved) return;
  u.stepD = (u.stepD || 0) + moved;
  const stride = (u.sprinting ? 1.05 : u.type === 'runner' ? 0.95 : 0.78) * PX;
  if (u.stepD < stride) return;
  u.stepD %= stride;
  u.steps = (u.steps || 0) + 1;
  if (!AC || VOICE.steps >= 6 || screen !== 'battle') return;
  const key = `step:${surfaceAt(u.x, u.y)}:${randi(0, 3)}`, rate = rand(0.92, 1.08);
  if (who === 'hero') { if (playBuf(key, { gain: u.sprinting ? 0.1 : 0.065, rate })) VOICE.steps++; return; }
  const me = camTarget();
  if (!me) return;
  const d = Math.hypot(u.x - me.x, u.y - me.y);
  if (d > 1000) return;
  const k = 1 - d / 1000, base = who === 'mate' ? 0.05 : 0.12 * (STEP_GAIN[u.type] || 1);   // an enemy footfall at 10 m sits ~30 dB under your own gunshot
  if (playBuf(key, { gain: base * k * k, rate: rate * (u.boss ? 0.7 : 1), x: u.x, y: u.y, lp: 1400 + 9000 * k })) VOICE.steps++;
}
function bark(e, kind, force) {   // 'spot' | 'flank' | 'reload' | 'charge' | 'throw' (forced past its own 6 s: a frag is shouted unless another shout just went)
  if (!e || screen !== 'battle' || state.mode === 'failed') return false;
  const now = state.frontTime;
  if (now - VOICE.barkT < 1.2 || (!force && now - (e.barkT == null ? -99 : e.barkT) < 6)) return false;
  const me = camTarget();
  if (!me || Math.hypot(e.x - me.x, e.y - me.y) > 1400) return false;
  VOICE.barkT = now; e.barkT = now;
  if (e.voice == null) e.voice = rand(0.86, 1.14) * (e.type === 'brute' || e.boss ? 0.82 : 1);
  VOICE.barks.push({ t: now, e, kind });
  if (VOICE.barks.length > 60) VOICE.barks.shift();
  const m = distMul(e.x, e.y);
  playBuf('bark:' + (kind === 'reload' || kind === 'flank' ? randi(3, 5) : randi(0, 2)), { gain: 0.2 * m, rate: e.voice, x: e.x, y: e.y, lp: 1800 + 9000 * m, verb: 0.12 });
  return true;
}
function updateVoices(dt) {
  VOICE.steps = Math.max(0, VOICE.steps - dt * 24);
  if (state.callout && (state.callout.t -= dt) <= 0) state.callout = null;
  VOICE.callCd -= dt; VOICE.scanT -= dt;
  if (VOICE.scanT > 0) return;
  VOICE.scanT = 0.25;
  const h = soldiers[state.controlled];
  if (!meta.opts.callouts || state.mode !== 'play' || VOICE.callCd > 0 || !h || !h.alive) return;
  const fx = Math.sin(aim.yaw), fy = -Math.cos(aim.yaw), cone = Math.cos(Math.PI / 3);
  let best = null, bd = 1000 * 1000;
  for (const e of enemies) {
    const dx = e.x - h.x, dy = e.y - h.y, d2 = dx * dx + dy * dy;
    if (d2 >= bd || state.frontTime - (e.calledT == null ? -99 : e.calledT) < 8) continue;
    if ((dx * fx + dy * fy) / (Math.sqrt(d2) || 1) > cone) continue;   // you can see this one yourself
    if (!soldiers.some(s => s.alive && s !== h && dist2(s.x, s.y, e.x, e.y) < 1300 * 1300 && losClear(s.x, s.y, e.x, e.y))) continue;
    bd = d2; best = e;
  }
  if (!best) return;
  const rel = angWrap(Math.atan2(best.x - h.x, -(best.y - h.y)) - aim.yaw);
  best.calledT = state.frontTime; VOICE.callCd = 4;
  state.callout = { side: Math.abs(rel) > 2.36 ? 'behind' : rel < 0 ? 'left' : 'right', dist: Math.round(Math.sqrt(bd) / PX), t: 1.5 };
  playBuf('radio', { gain: 0.28, force: true });
}
