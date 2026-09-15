// ---------- graphics quality: three presets, and Auto that steps down when frames run long ----------
// LINES is the height of the N64 render (the look and most of the cost); DPR caps the output canvas's pixel ratio;
// the caps thin out what is drawn (particles, loose brass, rain) and kept (enemy corpses); GLOW draws the tracer glow
// and other soldiers' muzzle blooms (your own flash always blooms). Auto starts at High everywhere (the game's own look,
// which phones ran before presets existed), drops a step after 3 s of frames averaging over 24 ms, and climbs back after
// 10 s under 17.5 ms — never above High, not within 30 s of a drop, and never to a level that has run slow twice (a
// phone that cannot hold High settles instead of changing resolution every half minute). Under a frame-rate cap those
// thresholds stretch to the cap's own frame (a 30 cap is slow past 45 ms, smooth under 35), so a cap never reads as a
// slow device. The battery saver (see POWER) holds the Saver preset and pauses Auto.
const QUALITY = {
  low:    { lines: 270, dpr: 1,   particles: 220, brass: 40,  corpses: 50,  rain: 0.35, glow: false },
  medium: { lines: 360, dpr: 1.5, particles: 500, brass: 100, corpses: 90,  rain: 0.7,  glow: true },
  high:   { lines: 480, dpr: 2,   particles: 900, brass: 160, corpses: 120, rain: 1,    glow: true },   // the N64 hi-res mode: the game's own look
  saver:  { lines: 240, dpr: 1,   particles: 160, brass: 24,  corpses: 40,  rain: 0.25, glow: false },  // the battery saver's: never chosen by Auto
};
const QLEVELS = ['low', 'medium', 'high'];
const Q = Object.assign({ level: 'high', auto: true, start: 'high', emaMs: 16.7, slowT: 0, fastT: 0, holdT: 0, changes: 0, fails: {} }, QUALITY.high);
function applyQuality(level) {
  if (!QUALITY[level]) level = 'high';
  const changed = Q.level !== level;
  Q.level = level;
  Object.assign(Q, QUALITY[level]);
  N64.lines = Q.lines;
  if (changed) Q.changes++;
  if (VIEW.ready) resizeView();
}
function setQualityOption(opt) {   // 'auto' | 'low' | 'medium' | 'high', from settings or a save
  if (POWER.saver) { Q.auto = false; applyQuality('saver'); return; }   // the saver holds its own preset until it lets go
  Q.auto = !QUALITY[opt] || opt === 'saver';
  Q.start = 'high';
  Q.slowT = Q.fastT = Q.holdT = 0; Q.emaMs = 16.7; Q.fails = {};
  applyQuality(Q.auto ? Q.start : opt);
}
function autoQuality(dt) {   // once a frame, with the real frame time
  if (!Q.auto || screen !== 'battle' || document.hidden || dt <= 0 || dt > 0.2) return;   // over 0.2 s is a stall or a throttled page, not frame rate
  const ms = dt * 1000, cap = powerCap(), budget = cap ? 1000 / cap : 0;
  Q.emaMs += (ms - Q.emaMs) * 0.05;
  Q.holdT = Math.max(0, Q.holdT - dt);
  if (Q.emaMs > Math.max(24, budget * 1.35)) { Q.slowT += dt; Q.fastT = 0; }
  else if (Q.emaMs < Math.max(17.5, budget * 1.05)) { Q.fastT += dt; Q.slowT = 0; }
  else { Q.slowT = 0; Q.fastT = 0; }
  const i = QLEVELS.indexOf(Q.level);
  if (Q.slowT > 3 && i > 0) { Q.fails[Q.level] = (Q.fails[Q.level] || 0) + 1; applyQuality(QLEVELS[i - 1]); Q.slowT = 0; Q.fastT = 0; Q.holdT = 30; Q.emaMs = 16.7; }
  else if (Q.fastT > 10 && Q.holdT <= 0 && i < QLEVELS.indexOf(Q.start) && (Q.fails[QLEVELS[i + 1]] || 0) < 2) { applyQuality(QLEVELS[i + 1]); Q.fastT = 0; Q.holdT = 10; }
}
