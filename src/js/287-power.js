// ---------- power: a frame-rate cap and a battery saver ----------
// SETTINGS › Frame rate caps the game at 60 or 30 updates a second (Max follows the display); the menus always run at
// 30, since nothing 3D draws there. SETTINGS › Battery saver On caps battle at 30 too and switches graphics to the
// Saver preset (QUALITY.saver) with no menu entrance animation; Auto does the same while the browser reports the
// battery at 20% or less and unplugged, and lets go once it charges or passes 30%. Auto only appears where the
// browser reports the battery at all (not on an iPhone).
const POWER = { saver: false, level: null, charging: null, watching: false, frames: 0, gateT: 0, prevNow: null };
function powerCap() {   // updates a second the loop may run right now; 0 = every display frame
  const want = POWER.saver ? 30 : +(meta && meta.opts.fps) || 0;
  return screen === 'battle' ? want : Math.min(want || 30, 30);
}
function frameGate(now, cap) {   // true when this display frame should run the game: an accumulator, so 60 on a 90 Hz screen still averages 60
  const prev = POWER.prevNow;
  POWER.prevNow = now;
  if (!cap || prev == null) { POWER.gateT = 0; return true; }
  const step = 1 / cap;
  POWER.gateT += (now - prev) / 1000;
  if (POWER.gateT < step - 0.004) return false;
  POWER.gateT = clamp(POWER.gateT - step, -0.004, step);
  return true;
}
function watchBattery() {
  if (POWER.watching || !navigator.getBattery) return;
  POWER.watching = true;
  navigator.getBattery().then(b => {
    const read = () => { POWER.level = b.level; POWER.charging = b.charging; applyPower(); };
    b.addEventListener('levelchange', read);
    b.addEventListener('chargingchange', read);
    read();
  }).catch(() => {});
}
function applyPower() {   // from applyOpts and from battery events
  const mode = (meta && meta.opts.saver) || 'off';
  if (mode === 'auto') watchBattery();
  let on = mode === 'on';
  if (mode === 'auto' && POWER.level != null)
    on = POWER.saver ? !(POWER.charging || POWER.level > 0.3) : !POWER.charging && POWER.level <= 0.2;   // on at 20%, off past 30% or on the charger
  if (on === POWER.saver) return;
  POWER.saver = on;
  document.body.classList.toggle('saver', on);
  setQualityOption(Q.opt || 'auto');
  if (on && mode === 'auto') showBanner(`BATTERY SAVER ON · ${Math.round(POWER.level * 100)}%`);
}
