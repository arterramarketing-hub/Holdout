// ---------- footsteps, enemy barks, squad callouts ----------
// FOOTSTEPS: everyone who walks leaves a footfall every stride (0.78 m; 1.05 m sprinting, 0.95 m for a runner), and the
// sound is the ground under them (hard for asphalt, paving, concrete and cobbles; gravel; soft for dirt and grass).
// Yours are quiet and centred; squadmates quieter; enemies are placed in stereo and fade out by 25 m, runners and
// breachers louder. No more than six footfalls in any quarter second.
// BARKS: enemies shout — not words — when they spot one of yours, start a flank, change magazines or charge; placed where
// they stand, pitched per voice, never within 1.2 s of another bark or 6 s of that enemy's last (a frag's shout skips the 6 s).
// CALLOUTS: the squad used to call enemies you could not see (FLANK · LEFT, BEHIND). That read the fight for you, so it is
// gone: reading it is the game. What is still shouted is danger, not intel — a frag landing near you — and the marksman's
// perch the first time its scope flashes, which you could have seen for yourself.
const STEP_SURF = { asphalt: 'hard', paving: 'hard', concrete: 'hard', cobble: 'hard', gravel: 'gravel', dirt: 'soft', grass: 'soft' };
const STEP_GAIN = { runner: 1.25, brute: 1.5, boss: 1.9 };
const VOICE = { steps: 0, barkT: -99, callCd: 0, barks: [] };
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
  const key = `step:${surfaceAt(u.x, u.y)}:${aRandi(0, 3)}`, rate = aRand(0.92, 1.08);
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
  if (e.voice == null) e.voice = aRand(0.86, 1.14) * (e.type === 'brute' || e.boss ? 0.82 : 1);
  VOICE.barks.push({ t: now, e, kind });
  if (VOICE.barks.length > 60) VOICE.barks.shift();
  const m = distMul(e.x, e.y);
  playBuf('bark:' + (kind === 'reload' || kind === 'flank' ? aRandi(3, 5) : aRandi(0, 2)), { gain: 0.2 * m, rate: e.voice, x: e.x, y: e.y, lp: 1800 + 9000 * m, verb: 0.12 });
  return true;
}
function updateVoices(dt) {   // the squad no longer calls where enemies are (it took the reading of the fight away from you); only a frag landing near you, and the marksman's perch, are still shouted
  VOICE.steps = Math.max(0, VOICE.steps - dt * 24);
  if (state.callout && (state.callout.t -= dt) <= 0) state.callout = null;
  VOICE.callCd -= dt;
}
