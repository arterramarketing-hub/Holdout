// ---------- offline synthesis: plain Float32Array DSP at SR_SYN ----------
function synRng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2147483648) - 1; }
function lp1(a, f, sr) { const k = 1 - Math.exp(-TAU * f / sr); let y = 0; for (let i = 0; i < a.length; i++) { y += (a[i] - y) * k; a[i] = y; } return a; }
function hp1(a, f, sr) { const k = 1 - Math.exp(-TAU * f / sr); let y = 0; for (let i = 0; i < a.length; i++) { y += (a[i] - y) * k; a[i] -= y; } return a; }
function biquad(a, type, f, q, sr, f2) {   // RBJ low/high/band-pass; f2 sweeps the corner exponentially across the buffer
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  const coef = fc => {
    const w = TAU * Math.min(fc, sr * 0.45) / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * q), n = 1 + al;
    if (type === 'lp') { b1 = (1 - cw) / n; b0 = b2 = b1 / 2; }
    else if (type === 'hp') { b1 = -(1 + cw) / n; b0 = b2 = -b1 / 2; }
    else { b0 = al / n; b1 = 0; b2 = -al / n; }
    a1 = -2 * cw / n; a2 = (1 - al) / n;
  };
  coef(f);
  for (let i = 0; i < a.length; i++) {
    if (f2 && (i & 63) === 0) coef(f * Math.pow(f2 / f, i / a.length));
    const x = a[i], y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y; a[i] = y;
  }
  return a;
}
function wobble(n, hz, depth, rnd, sr) {   // slow random swell, 1 ± depth
  const a = new Float32Array(n), step = Math.max(1, Math.floor(sr / hz));
  let v0 = rnd(), v1 = rnd();
  for (let i = 0; i < n; i++) {
    if (i % step === 0) { v0 = v1; v1 = rnd(); }
    const t = (i % step) / step;
    a[i] = 1 + depth * (v0 + (v1 - v0) * t * t * (3 - 2 * t));
  }
  return a;
}
function normalise(chs, peak) {
  let m = 1e-6;
  for (const c of chs) for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > m) m = v; }
  const k = peak / m;
  for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= k;
  return chs;
}
function addClick(L, R, t0, g, hz, rnd, sr) {   // metal on metal: a tick and a short inharmonic ring
  const o = Math.floor(t0 * sr), m = Math.floor(0.05 * sr), a = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    const t = i / sr;
    a[i] = rnd() * Math.exp(-t / 0.002) + (Math.sin(TAU * hz * t) + 0.6 * Math.sin(TAU * hz * 1.47 * t)) * Math.exp(-t / 0.012) * 0.5;
  }
  biquad(a, 'hp', hz * 0.5, 0.7, sr);
  for (let i = 0; i < m && o + i < L.length; i++) { L[o + i] += a[i] * g; R[o + i] += a[i] * g * 0.8; }
}
function addBed(ch, seed, n, sr, tau, lpHz, lpEnd, gain, att, swell) {   // decaying noise bed: outdoor tails and rumble
  const r = synRng(seed), bed = new Float32Array(n), am = wobble(n, swell, 0.55, r, sr);
  for (let i = 0; i < n; i++) { const t = i / sr; bed[i] = r() * Math.min(1, t / att) * Math.exp(-t / tau) * am[i]; }
  biquad(bed, 'lp', lpHz, 0.6, sr, lpEnd);
  hp1(bed, 45, sr);
  for (let i = 0; i < n; i++) ch[i] += bed[i] * gain;
}
function renderShot(p, seed, far) {   // one stereo gunshot
  const sr = SR_SYN, rnd = synRng(seed), n = Math.ceil(p.len * sr), L = new Float32Array(n), R = new Float32Array(n);
  const vary = 1 + rnd() * 0.06, nb = Math.min(n, Math.ceil(0.35 * sr));
  const blast = new Float32Array(nb), crack = new Float32Array(nb);
  for (let i = 0; i < nb; i++) {
    const t = i / sr, att = Math.min(1, t / 0.0004);
    blast[i] = rnd() * att * (0.62 * Math.exp(-t / p.snap) + 0.38 * Math.exp(-t / p.decay));
    crack[i] = rnd() * att * Math.exp(-t / 0.0016);
  }
  biquad(blast, 'lp', (far ? p.body * 0.3 : p.body) * vary, 0.7, sr);
  hp1(blast, 60, sr);
  biquad(crack, 'hp', 1800, 0.7, sr);
  const dn = Math.tanh(p.drive);
  let ph = 0;
  for (let i = 0; i < nb; i++) {   // blast + supersonic snap + a falling pressure thump, into saturation
    const t = i / sr, f = p.thump * vary * (1 - 0.45 * Math.min(1, t / (p.thumpDecay * 3)));
    ph += TAU * f / sr;
    const thump = Math.sin(ph) * Math.exp(-t / p.thumpDecay) * Math.min(1, t / 0.0008);
    const y = Math.tanh((blast[i] * 1.6 + crack[i] * (far ? 0.05 : p.crack) + thump * (far ? 0.35 : 0.9)) * p.drive) / dn;
    L[i] += y; R[i] += y;
  }
  const echo = blast.slice();   // early reflections, darker and offset on each side
  biquad(echo, 'lp', 1400, 0.7, sr);
  for (const [dl, dr, g] of p.refl) {
    const oL = Math.floor(dl * sr * vary), oR = Math.floor(dr * sr * vary), gg = g * (far ? 1.5 : 1);
    for (let i = 0; i < nb; i++) { if (oL + i < n) L[oL + i] += echo[i] * gg; if (oR + i < n) R[oR + i] += echo[i] * gg * 0.9; }
  }
  const tg = p.tail * (far ? 2.2 : 1), tlp = p.tailLP * (far ? 0.6 : 1);
  addBed(L, seed * 7 + 11, n, sr, p.tailTau, tlp, tlp * 0.6, tg, 0.03, 9);
  addBed(R, seed * 7 + 29, n, sr, p.tailTau, tlp, tlp * 0.6, tg, 0.03, 9);
  if (!far && p.mech) for (const [t0, g, hz] of p.mech) addClick(L, R, t0, g, hz, rnd, sr);
  if (p.motor) {   // rocket motor tearing away downrange
    const m = p.motor, o = Math.floor(m.start * sr), k = Math.min(n - o, Math.floor(m.dur * sr)), a = new Float32Array(k), am = wobble(k, 28, 0.35, rnd, sr);
    for (let i = 0; i < k; i++) { const t = i / sr; a[i] = rnd() * Math.min(1, t / 0.02) * Math.exp(-t / (m.dur * 0.45)) * am[i]; }
    biquad(a, 'bp', m.hi, 0.9, sr, m.lo);
    const g = m.gain * (far ? 0.5 : 1);
    for (let i = 0; i < k; i++) { L[o + i] += a[i] * g; R[o + i] += a[i] * g * 0.92; }
  }
  return normalise([L, R], far ? 0.8 : 0.95);
}
const GUN_SYN = {   // snap/decay: blast envelope s · body: blast low-pass Hz · thump Hz + decay · crack: supersonic snap · tail gain/decay/low-pass · refl [L s, R s, gain] · mech [t, gain, Hz]
  smg:    { len: 0.8, snap: 0.004, decay: 0.022, body: 5200, thump: 120, thumpDecay: 0.016, crack: 0.55, drive: 2.2, tail: 0.45, tailTau: 0.18, tailLP: 900,
            refl: [[0.07, 0.09, 0.22], [0.16, 0.13, 0.12]], mech: [[0.018, 0.14, 2600], [0.05, 0.1, 1900]] },
  ar:     { len: 1.1, snap: 0.005, decay: 0.034, body: 4300, thump: 92, thumpDecay: 0.024, crack: 0.7, drive: 2.6, tail: 0.6, tailTau: 0.28, tailLP: 760,
            refl: [[0.085, 0.11, 0.26], [0.21, 0.17, 0.14]], mech: [[0.016, 0.1, 2300], [0.06, 0.07, 1700]] },
  lmg:    { len: 1.2, snap: 0.006, decay: 0.042, body: 3700, thump: 80, thumpDecay: 0.03, crack: 0.75, drive: 2.8, tail: 0.68, tailTau: 0.32, tailLP: 700,
            refl: [[0.09, 0.12, 0.28], [0.22, 0.19, 0.15]], mech: [[0.02, 0.08, 2000], [0.034, 0.05, 3100]] },
  sniper: { len: 1.9, snap: 0.008, decay: 0.075, body: 3000, thump: 56, thumpDecay: 0.05, crack: 1.0, drive: 3.2, tail: 0.85, tailTau: 0.6, tailLP: 620,
            refl: [[0.12, 0.16, 0.34], [0.31, 0.26, 0.22], [0.55, 0.62, 0.12]], mech: [[0.62, 0.3, 1500], [0.72, 0.22, 2400], [0.9, 0.24, 2100], [1.0, 0.32, 1400]] },
  rocket: { len: 1.6, snap: 0.01, decay: 0.06, body: 1800, thump: 60, thumpDecay: 0.06, crack: 0.2, drive: 2.0, tail: 0.6, tailTau: 0.4, tailLP: 520,
            refl: [[0.12, 0.15, 0.25], [0.3, 0.26, 0.15]], motor: { start: 0.02, dur: 1.1, hi: 1300, lo: 420, gain: 3.2 } },
  ak:     { len: 1.1, snap: 0.005, decay: 0.04, body: 3200, thump: 74, thumpDecay: 0.03, crack: 0.8, drive: 3.0, tail: 0.62, tailTau: 0.3, tailLP: 680,
            refl: [[0.1, 0.08, 0.26], [0.24, 0.2, 0.14]], mech: [[0.02, 0.1, 1800]] },
  pkm:    { len: 1.2, snap: 0.006, decay: 0.05, body: 2800, thump: 64, thumpDecay: 0.035, crack: 0.8, drive: 3.1, tail: 0.7, tailTau: 0.34, tailLP: 640,
            refl: [[0.1, 0.13, 0.28], [0.25, 0.21, 0.15]] },
  pistol: { len: 0.7, snap: 0.003, decay: 0.018, body: 5600, thump: 140, thumpDecay: 0.012, crack: 0.5, drive: 2.0, tail: 0.4, tailTau: 0.16, tailLP: 950,
            refl: [[0.07, 0.09, 0.2], [0.15, 0.12, 0.1]], mech: [[0.02, 0.12, 2900]] },
};
const GUN_VARS = { smg: 3, ar: 3, lmg: 3, sniper: 2, rocket: 2, ak: 2, pkm: 1, pistol: 2 };
const SUPPRESSED_VARS = { smg: 2, ar: 2, lmg: 2, sniper: 1 };
const suppressedSyn = p => Object.assign({}, p, {   // the same gun through a can: no crack, a short dull blast, a faint room, the action loud by comparison
  snap: p.snap * 0.8, decay: p.decay * 0.55, body: p.body * 0.32, thump: p.thump * 1.35, thumpDecay: p.thumpDecay * 0.7, crack: p.crack * 0.1,
  drive: p.drive * 0.55, tail: p.tail * 0.22, tailTau: p.tailTau * 0.5, tailLP: p.tailLP * 0.7,
  refl: p.refl.map(([l, r, g]) => [l, r, g * 0.3]), mech: (p.mech || []).map(([t, g, hz]) => [t, g * 2.6, hz]) });
function renderBlast(seed, far) {   // shell, mine or rocket impact: crack, roar, pressure thump, reflections, rumble, falling debris
  const sr = SR_SYN, rnd = synRng(seed), n = Math.floor(2.4 * sr), L = new Float32Array(n), R = new Float32Array(n);
  const nb = Math.floor(0.9 * sr), roar = new Float32Array(nb);
  for (let i = 0; i < nb; i++) { const t = i / sr; roar[i] = rnd() * Math.min(1, t / 0.0006) * (0.55 * Math.exp(-t / 0.012) + 0.45 * Math.exp(-t / 0.18)); }
  biquad(roar, 'lp', far ? 1300 : 5200, 0.7, sr, far ? 240 : 380);
  const dn = Math.tanh(2.4);
  let ph = 0;
  for (let i = 0; i < nb; i++) {
    const t = i / sr;
    ph += TAU * (48 - 22 * Math.min(1, t / 0.3)) / sr;
    const y = Math.tanh((roar[i] * 1.8 + Math.sin(ph) * Math.exp(-t / 0.16) * (far ? 0.6 : 1.2)) * 2.4) / dn;
    L[i] += y; R[i] += y;
  }
  const echo = roar.slice();
  biquad(echo, 'lp', 900, 0.7, sr);
  for (const [dl, dr, g] of [[0.14, 0.19, 0.35], [0.38, 0.33, 0.22], [0.72, 0.8, 0.12]])
    for (let i = 0; i < nb; i++) { const a = Math.floor(dl * sr) + i, b = Math.floor(dr * sr) + i; if (a < n) L[a] += echo[i] * g; if (b < n) R[b] += echo[i] * g; }
  addBed(L, seed * 5 + 3, n, sr, 0.85, 320, 110, far ? 2.0 : 1.3, 0.02, 5);
  addBed(R, seed * 5 + 17, n, sr, 0.85, 320, 110, far ? 2.0 : 1.3, 0.02, 5);
  if (!far) for (let k = 0; k < 90; k++) {
    const t0 = 0.08 + Math.pow((rnd() + 1) / 2, 1.8) * 1.4, g = 0.05 * Math.exp(-t0 / 0.6) * (0.4 + (rnd() + 1) / 2);
    addClick(L, R, t0, g, 1800 + (rnd() + 1) * 1600, rnd, sr);
  }
  return normalise([L, R], 0.95);
}
function renderSnap(seed) {   // a supersonic round passing within a metre: N-wave crack and torn-air hiss
  const sr = SR_SYN, rnd = synRng(seed), n = Math.floor(0.3 * sr), L = new Float32Array(n), R = new Float32Array(n), hiss = new Float32Array(n);
  const w = Math.max(2, Math.floor(0.0007 * sr));
  for (let i = 0; i < n; i++) { const t = i / sr; hiss[i] = rnd() * Math.min(1, t / 0.003) * Math.exp(-t / 0.05); }
  biquad(hiss, 'bp', 6500, 1.2, sr, 1600);
  for (let i = 0; i < n; i++) {
    const y = (i < 2 * w ? 1 - i / w : 0) + hiss[i] * 2.2;
    L[i] = y; R[i] = y * 0.8 + (i >= 6 ? L[i - 6] * 0.2 : 0);
  }
  return normalise([L, R], 0.9);
}
function renderRicochet(seed) {
  const sr = SR_SYN, rnd = synRng(seed), n = Math.floor(0.6 * sr), a = new Float32Array(n), nz = new Float32Array(n);
  const f0 = 3600 + rnd() * 900, f1 = 700 + rnd() * 300;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += TAU * f0 * Math.pow(f1 / f0, Math.min(1, t / 0.45)) / sr;
    a[i] = Math.sin(ph) * Math.min(1, t / 0.004) * Math.exp(-t / 0.16) * (1 + 0.25 * Math.sin(t * 90));
    nz[i] = rnd() * Math.exp(-t / 0.004);
  }
  biquad(nz, 'hp', 1500, 0.7, sr);
  for (let i = 0; i < n; i++) a[i] = a[i] * 0.6 + nz[i];
  const r = a.slice();
  lp1(r, 5000, sr);
  return normalise([a, r], 0.85);
}
function renderTink(seed) {   // a spent casing bouncing on hard ground
  const sr = SR_SYN, rnd = synRng(seed), n = Math.floor(0.35 * sr), a = new Float32Array(n);
  const f = [3900, 6100, 8700].map(x => x * (1 + rnd() * 0.08));
  for (const [t0, g] of [[0, 1], [0.07 + (rnd() + 1) * 0.015, 0.45], [0.15 + (rnd() + 1) * 0.02, 0.18]]) {
    const o = Math.floor(t0 * sr);
    for (let i = 0; o + i < n; i++) {
      const t = i / sr;
      a[o + i] += g * (Math.sin(TAU * f[0] * t) * Math.exp(-t / 0.05) + 0.6 * Math.sin(TAU * f[1] * t) * Math.exp(-t / 0.03) + 0.4 * Math.sin(TAU * f[2] * t) * Math.exp(-t / 0.02));
    }
  }
  return normalise([a], 0.9);
}
function renderFall(seed) {   // a body and its kit hitting the dirt
  const sr = SR_SYN, rnd = synRng(seed), n = Math.floor(0.5 * sr), a = new Float32Array(n);
  for (const [t0, g] of [[0, 1], [0.11 + (rnd() + 1) * 0.015, 0.55]]) {
    const o = Math.floor(t0 * sr);
    for (let i = 0; o + i < n; i++) { const t = i / sr; a[o + i] += rnd() * g * Math.min(1, t / 0.002) * Math.exp(-t / 0.045); }
  }
  lp1(a, 260, sr); lp1(a, 400, sr);
  normalise([a], 1);
  const r = a.slice();
  for (let k = 0; k < 4; k++) addClick(a, r, 0.12 + (rnd() + 1) * 0.05, 0.08, 1700 + (rnd() + 1) * 900, rnd, sr);
  return normalise([a, r], 0.9);
}
function renderJet() {   // strike jet passing low, left to right
  const sr = SR_SYN, rnd = synRng(505), n = Math.floor(3.2 * sr), L = new Float32Array(n), R = new Float32Array(n), roar = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, x = (t - 1.25) / 0.55, env = Math.exp(-x * x) * 0.85 + 0.15 * Math.exp(-Math.abs(t - 1.5) / 0.9);
    ph += TAU * (t < 1.25 ? 3400 : 3400 * Math.pow(0.55, Math.min(1, (t - 1.25) / 0.5))) / sr;
    roar[i] = rnd() * env + Math.sin(ph) * env * 0.05;
  }
  biquad(roar, 'lp', 3000, 0.6, sr, 500);
  for (let i = 0; i < n; i++) {
    const p = clamp((i / sr - 0.4) / 1.8, 0, 1);
    L[i] = roar[i] * Math.cos(p * Math.PI / 2); R[i] = roar[i] * Math.sin(p * Math.PI / 2);
  }
  return normalise([L, R], 0.9);
}
function renderMagOut(seed) {   // release click, the magazine sliding out of the well
  const sr = SR_SYN, rnd = synRng(seed), n = Math.floor(0.35 * sr), L = new Float32Array(n), R = new Float32Array(n), sl = new Float32Array(n);
  addClick(L, R, 0, 0.5, 2600, rnd, sr);
  for (let i = 0; i < n; i++) { const t = i / sr - 0.03; sl[i] = t > 0 ? rnd() * Math.exp(-t / 0.06) * Math.min(1, t / 0.02) : 0; }
  biquad(sl, 'bp', 1800, 1.5, sr, 900);
  for (let i = 0; i < n; i++) { L[i] += sl[i] * 1.2; R[i] += sl[i] * 1.1; }
  return normalise([L, R], 0.8);
}
function renderMagIn(seed) {   // a fresh magazine slapped home
  const sr = SR_SYN, rnd = synRng(seed), n = Math.floor(0.3 * sr), L = new Float32Array(n), R = new Float32Array(n), th = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / sr - 0.02; th[i] = t > 0 ? rnd() * Math.exp(-t / 0.018) : 0; }
  lp1(th, 500, sr);
  normalise([th], 0.6);
  for (let i = 0; i < n; i++) { L[i] += th[i]; R[i] += th[i]; }
  addClick(L, R, 0.02, 1, 1500, rnd, sr); addClick(L, R, 0.034, 0.6, 3100, rnd, sr);
  return normalise([L, R], 0.85);
}
function renderRack(seed) {   // charging handle back, then slammed forward
  const sr = SR_SYN, rnd = synRng(seed), n = Math.floor(0.4 * sr), L = new Float32Array(n), R = new Float32Array(n), sl = new Float32Array(n);
  addClick(L, R, 0, 0.7, 2200, rnd, sr);
  for (let i = 0; i < n; i++) { const t = i / sr - 0.012; sl[i] = t > 0 && t < 0.08 ? rnd() * Math.sin(t / 0.08 * Math.PI) : 0; }
  biquad(sl, 'bp', 2500, 1.2, sr);
  for (let i = 0; i < n; i++) { L[i] += sl[i] * 0.8; R[i] += sl[i] * 0.7; }
  addClick(L, R, 0.11, 1, 1700, rnd, sr); addClick(L, R, 0.125, 0.5, 3400, rnd, sr);
  return normalise([L, R], 0.85);
}
function renderPickup(seed) {   // grabbing a magazine off the ground
  const sr = SR_SYN, rnd = synRng(seed), n = Math.floor(0.25 * sr), L = new Float32Array(n), R = new Float32Array(n);
  addClick(L, R, 0, 0.6, 2000, rnd, sr); addClick(L, R, 0.06, 0.4, 2800, rnd, sr);
  return normalise([L, R], 0.8);
}
const seedOf = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
function renderStep(surface, seed) {   // one footfall, heel then the ball of the foot, shaped by what is underfoot
  const sr = SR_SYN, rnd = synRng(seed), n = Math.floor(0.2 * sr), click = new Float32Array(n), body = new Float32Array(n);
  const second = 0.05 + (rnd() + 1) * 0.012;
  for (const [t0, g] of [[0, 1], [second, 0.55]]) {
    const o = Math.floor(t0 * sr);
    for (let i = 0; o + i < n; i++) {
      const t = i / sr;
      if (surface === 'gravel') click[o + i] += g * rnd() * Math.exp(-t / 0.045) * (rnd() > 0.55 ? 1 : 0.25);   // grit: a crunch of little stones
      else click[o + i] += g * rnd() * Math.exp(-t / (surface === 'hard' ? 0.005 : 0.012));
      body[o + i] += g * Math.sin(TAU * (surface === 'hard' ? 150 : 85) * t) * Math.exp(-t / (surface === 'hard' ? 0.018 : 0.03));
    }
  }
  if (surface === 'hard') { biquad(click, 'bp', 2600, 0.8, sr); lp1(body, 400, sr); }
  else if (surface === 'gravel') { biquad(click, 'bp', 3200, 0.6, sr); lp1(body, 300, sr); }
  else { lp1(click, 900, sr); lp1(click, 1200, sr); lp1(body, 250, sr); }
  const out = new Float32Array(n), kc = surface === 'soft' ? 0.5 : 1, kb = surface === 'gravel' ? 0.35 : 0.8;
  for (let i = 0; i < n; i++) out[i] = click[i] * kc + body[i] * kb;
  return normalise([out], 0.9);
}
const VOWELS = [[730, 1090, 2440], [530, 1840, 2480], [570, 840, 2410], [660, 1700, 2400], [440, 1020, 2240], [600, 1200, 2500]];
function renderBark(seed, syllables) {   // a shout, not a word: a rough voice through vowel formants, rising and breaking off
  const sr = SR_SYN, rnd = synRng(seed), dur = 0.24 * syllables + 0.08, n = Math.floor(dur * sr), src = new Float32Array(n);
  const f0 = 118 + (rnd() + 1) * 14, vowel = VOWELS[seed % VOWELS.length];
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, syl = Math.min(syllables - 1, Math.floor(t / 0.26)), ts = t - syl * 0.26, p = clamp(ts / 0.24, 0, 1);
    const pitch = f0 * (1 + 0.3 * Math.sin(Math.PI * Math.min(1, p * 1.3)) - 0.12 * syl) * (1 + 0.015 * rnd());
    ph += pitch / sr; if (ph >= 1) ph -= 1;
    const glott = (ph < 0.42 ? Math.sin(Math.PI * ph / 0.42) : 0) * 2 - 0.7;
    const env = ts > 0.24 ? 0 : Math.min(1, ts / 0.018) * Math.pow(1 - p, 0.8);
    src[i] = (glott + rnd() * 0.3) * env;
  }
  const out = new Float32Array(n);
  vowel.forEach((f, k) => { const b = src.slice(); biquad(b, 'bp', f, 5 + k * 2, sr); biquad(b, 'bp', f, 4, sr); for (let i = 0; i < n; i++) out[i] += b[i] * [1, 0.7, 0.3][k]; });
  for (let i = 0; i < n; i++) out[i] = Math.tanh(out[i] * 3.2);   // a strained, shouted edge
  lp1(out, 5200, sr); hp1(out, 110, sr);
  return normalise([out], 0.85);
}
function renderRadio() {   // squad net: a squelch break and a two-tone chirp
  const sr = SR_SYN, rnd = synRng(91), n = Math.floor(0.26 * sr), a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    a[i] = rnd() * (t < 0.06 ? Math.exp(-t / 0.03) : 0) * 0.7
      + (t > 0.07 && t < 0.13 ? Math.sin(TAU * 1250 * t) * 0.5 : 0) + (t > 0.15 && t < 0.22 ? Math.sin(TAU * 1680 * t) * 0.5 : 0);
  }
  biquad(a, 'bp', 1500, 0.9, sr);
  return normalise([a], 0.8);
}
function sfxJobs() {   // render order = how soon each sound is needed
  const J = [];
  const gun = (w, i) => { const k = `gun:${w}:${i}`; J.push([k, () => renderShot(GUN_SYN[w], seedOf(k), false)]); };
  const far = w => { const k = `gunf:${w}`; J.push([k, () => renderShot(GUN_SYN[w], seedOf(k), true)]); };
  gun('ar', 0); gun('ak', 0);
  J.push(['snap:0', () => renderSnap(3)], ['blast:0', () => renderBlast(11, false)], ['fall:0', () => renderFall(5)]);
  gun('ar', 1); gun('ar', 2); gun('ak', 1); far('ar'); far('ak');
  J.push(['blastf', () => renderBlast(23, true)], ['snap:1', () => renderSnap(8)]);
  J.push(['rl:out', () => renderMagOut(1)], ['rl:in', () => renderMagIn(2)], ['rl:rack', () => renderRack(3)], ['pick', () => renderPickup(4)]);
  for (let i = 0; i < 3; i++) J.push([`tink:${i}`, () => renderTink(40 + i)], [`ric:${i}`, () => renderRicochet(60 + i)]);
  for (const w of ['smg', 'lmg', 'sniper', 'rocket', 'pkm', 'pistol']) for (let i = 0; i < GUN_VARS[w]; i++) gun(w, i);
  for (const w of ['smg', 'lmg', 'sniper', 'rocket', 'pkm', 'pistol']) far(w);
  J.push(['fall:1', () => renderFall(9)], ['blast:1', () => renderBlast(31, false)], ['jet', renderJet]);
  for (const surf of ['hard', 'gravel', 'soft']) for (let i = 0; i < 4; i++) J.push([`step:${surf}:${i}`, () => renderStep(surf, 200 + i * 7 + surf.length)]);
  for (let i = 0; i < 6; i++) J.push([`bark:${i}`, () => renderBark(i, i < 3 ? 1 : 2)]);
  J.push(['radio', renderRadio]);
  for (const w of ['ar', 'smg', 'lmg', 'sniper']) for (let i = 0; i < SUPPRESSED_VARS[w]; i++) { const k = `gunS:${w}:${i}`; J.push([k, () => renderShot(suppressedSyn(GUN_SYN[w]), seedOf(k), false)]); }
  return J;
}
function pumpSfx() {   // render in ~10 ms slices so the page never hitches
  const t0 = performance.now();
  while (SFX.queue.length && performance.now() - t0 < 10) {
    const [key, fn] = SFX.queue.shift();
    try {
      const chs = fn(), b = AC.createBuffer(chs.length, chs[0].length, SR_SYN);
      chs.forEach((c, i) => b.getChannelData(i).set(c));
      SFX.buf[key] = b;
    } catch (e) { console.warn('Holdout: sound render failed', key, e); }
  }
  if (SFX.queue.length) setTimeout(pumpSfx, 20); else SFX.ready = true;
}
function playBuf(key, o) {   // {gain, rate, delay, x, y (stereo placement), lp (distance low-pass Hz), verb, force}
  if (!AC || !master || (meta && meta.muted)) return false;
  const b = SFX.buf[key];
  if (!b || (SFX.voices > 48 && !o.force)) return false;
  const src = AC.createBufferSource();
  src.buffer = b; src.playbackRate.value = o.rate || 1;
  let node = src;
  if (o.lp && o.lp < 16000) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; f.Q.value = 0.5; node.connect(f); node = f; }
  const g = AC.createGain();
  g.gain.value = o.gain == null ? 1 : o.gain;
  node.connect(g); node = g;
  if (o.x != null && AC.createStereoPanner) { const p = AC.createStereoPanner(); p.pan.value = panOf(o.x, o.y); node.connect(p); node = p; }
  node.connect(master);
  if (o.verb) { const s = AC.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(verbIn); }
  SFX.voices++;
  src.onended = () => { SFX.voices--; };
  src.start(AC.currentTime + (o.delay || 0));
  return true;
}
function pickVar(base, n) {   // a random rendered variant, so repeated shots never sound identical
  const s = aRandi(0, n - 1);
  for (let k = 0; k < n; k++) { const key = base + ((s + k) % n); if (SFX.buf[key]) return key; }
  return base + '0';
}
function sfxGun(w, x, y, isCtl, quiet) {
  const n = GUN_VARS[w] || 1, rate = aRand(0.97, 1.03);
  if (quiet) {   // suppressed: a dull thump and the action working; until those are rendered, the shot itself, far down and muffled
    const g = isCtl ? 1 : 0.4 * distMul(x, y);
    if (!playBuf(pickVar(`gunS:${w}:`, SUPPRESSED_VARS[w] || 1), { gain: 0.3 * g, rate, force: isCtl, x: isCtl ? null : x, y }))
      playBuf(pickVar(`gun:${w}:`, n), { gain: 0.14 * g, rate, lp: 900, force: isCtl, x: isCtl ? null : x, y });
    return;
  }
  if (isCtl) {
    playBuf(pickVar(`gun:${w}:`, n), { gain: 0.6, rate, force: true });   // your brass tinks when it actually lands (drawLoose)
    return;
  }
  if (Math.random() < 0.45) return;   // thin the squad's fire so the mix stays readable
  const far = distMul(x, y), key = far < 0.55 && SFX.buf['gunf:' + w] ? 'gunf:' + w : pickVar(`gun:${w}:`, n);
  playBuf(key, { gain: 0.32 * far, rate, x, y, lp: 1200 + 18000 * far * far });
}
function sfxEnemyShot(x, y, mul = 1) {   // their AKs: lower, chunkier 7.62
  const far = distMul(x, y), key = far < 0.5 && SFX.buf['gunf:ak'] ? 'gunf:ak' : pickVar('gun:ak:', GUN_VARS.ak);
  playBuf(key, { gain: 0.42 * far * mul, rate: aRand(0.95, 1.04), x, y, lp: 1500 + 18000 * far * far });
}
function sfxBossBurst(x, y) {   // the Warlord's machine gun ripping a full circle
  const far = distMul(x, y), key = far < 0.5 && SFX.buf['gunf:pkm'] ? 'gunf:pkm' : 'gun:pkm:0';
  for (let k = 0; k < 7; k++) playBuf(key, { gain: 0.5 * far, rate: aRand(0.96, 1.03), delay: k * 0.07, x, y, lp: 1500 + 18000 * far * far, force: k === 0 });
}
function sfxWhiz(x, y) { MUS.heat = performance.now(); playBuf('snap:' + aRandi(0, 1), { gain: 0.5, rate: aRand(0.9, 1.12), x, y, force: true }); }
function sfxRicochet(x, y) { playBuf('ric:' + aRandi(0, 2), { gain: 0.2 * distMul(x, y), rate: aRand(0.85, 1.15), x, y }); }
function sfxExplosion(x, y, big) {
  const m = distMul(x, y);
  const ok = playBuf(m > 0.4 ? 'blast:' + aRandi(0, 1) : 'blastf', { gain: (big ? 0.95 : 0.7) * Math.max(m, 0.25),
    rate: big ? aRand(0.88, 0.98) : aRand(1.02, 1.14), x, y, lp: 2000 + 18000 * m * m, force: true });
  if (!ok && !playBuf('blast:0', { gain: 0.7 * m, x, y, force: true })) noise({ freq: 700, type: 'lowpass', dur: 0.9, gain: 0.5 * m, drive: true, slide: -560 });
}
function sfxJet() { if (!playBuf('jet', { gain: 0.75, force: true })) noise({ freq: 600, type: 'lowpass', dur: 2, gain: 0.2, attack: 0.6 }); }
function sfxOutgoing() {   // the battery firing from miles back
  for (let k = 0; k < 3; k++) playBuf('blastf', { gain: 0.3, lp: 650, rate: aRand(0.78, 0.92), delay: k * 0.45 + aRand(0, 0.15), force: true });
}
const sfxKill  = (x, y) => { playBuf('fall:' + aRandi(0, 1), { gain: 0.32 * distMul(x, y), rate: aRand(0.9, 1.1), delay: 0.1, x, y }); };
const sfxHurt  = () => { playBuf('fall:0', { gain: 0.55, rate: 1.5, force: true }); noise({ freq: 300, type: 'lowpass', dur: 0.12, gain: 0.22 }); beep(3900, 0.8, 'sine', 0.01); };
const sfxKia   = () => { playBuf('fall:1', { gain: 0.6, force: true }); beep(62, 0.9, 'sine', 0.16, -30, 0, 0.4); };
const sfxClear = () => { beep(440, 0.15, 'square', 0.05); beep(660, 0.25, 'square', 0.05, 0, 0.14); };
const sfxBuy   = () => beep(660, 0.08, 'square', 0.04, 200);
function startAmbience() {
  const ac = audio(); if (!ac || amb.started) return;
  amb.started = true;
  const loop = (type, hz, q, rate) => {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = hz; f.Q.value = q;
    const g = ac.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(master); s.start();
    return [f, g];
  };
  [amb.windFilt, amb.windGain] = loop('lowpass', 320, 0.4, 1);
  amb.droneGain = loop('lowpass', 85, 0.3, 0.5)[1];   // the whole front grumbling beyond the hills
  amb.rainGain = loop('highpass', 1800, 0.7, 1)[1];
}
function updateAudio(dt) {
  if (!AC || !master) return;
  master.gain.value = meta && meta.muted ? 0 : 0.8;
  updateMusic(dt);
  if (!amb.started) return;
  const inB = screen === 'battle' && (state.mode === 'play' || state.mode === 'dying' || state.mode === 'spectate');
  if (SFX.muffle) {   // everything goes underwater while you watch yourself die
    const want = state.mode === 'dying' && screen === 'battle' ? 620 : 20000;
    SFX.muffle.frequency.value += (want - SFX.muffle.frequency.value) * Math.min(1, dt * 5);
  }
  amb.windFilt.frequency.value = 300 + Math.sin(performance.now() / 2400) * 130;
  amb.windGain.gain.value += ((inB ? 0.02 : 0.006) - amb.windGain.gain.value) * Math.min(1, dt * 2);
  const dT = inB ? Math.min(0.3, enemies.length / 34 * 0.22 + state.wave * 0.006) : 0;
  amb.droneGain.gain.value += (dT - amb.droneGain.gain.value) * Math.min(1, dt * 1.5);
  amb.rainGain.gain.value += ((inB && state.weather === 'rain' ? 0.05 : 0) - amb.rainGain.gain.value) * Math.min(1, dt * 1.2);
  if (!inB) return;
  const c = camTarget(), side = () => (aRnd() < 0.5 ? -1 : 1) * 2400;
  amb.burstT -= dt;
  if (amb.burstT <= 0 && c) {   // a firefight further down the line
    amb.burstT = aRand(5, 13);
    const key = aRnd() < 0.5 ? 'gunf:lmg' : 'gunf:ak', n = aRandi(4, 9), gap = aRand(0.07, 0.11), g = aRand(0.04, 0.09), px = c.x + side();
    for (let k = 0; k < n; k++) playBuf(key, { gain: g, lp: 1300, rate: aRand(0.95, 1.05), delay: k * gap, x: px, y: c.y - 1200 });
  }
  amb.chatterT -= dt;
  if (amb.chatterT <= 0) {
    amb.chatterT = aRand(6, 14);
    noise({ freq: 1500, dur: 0.05, gain: 0.03, q: 2 });
    noise({ freq: 1300, dur: aRand(0.1, 0.25), gain: 0.025, q: 1.5, delay: 0.09 });
  }
}

