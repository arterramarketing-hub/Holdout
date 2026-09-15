// ---------- the guns: parts on the gun joint; the barrel runs along −Z, +Y is up, +X is the shooter's right ----------
// B = a box, C = a cylinder lying along the barrel (r = radius), ring = n boxes around a circle in the XY plane —
// a sight aperture, a hood, or a hollow scope tube you can actually look down.
const B = (sx, sy, sz, x, y, z, col, rx = 0, ry = 0, rz = 0) => P(HJ.gun, 'metal', sx, sy, sz, x, y, z, col, rx, ry, rz);
const C = (r, len, x, y, z, col) => P(HJ.gun, 'cyl', r * 2, len, r * 2, x, y, z, col, Math.PI / 2);
function ring(r, t, d, x, y, z, col, n = 8) {
  const rows = [], w = 2 * r * Math.tan(Math.PI / n) + t * 0.7;
  for (let i = 0; i < n; i++) { const a = i * TAU / n; rows.push(B(w, t, d, x + Math.cos(a) * r, y + Math.sin(a) * r, z, col, 0, 0, a + Math.PI / 2)); }
  return rows;
}
// Optics mount on a rail: railY = the rail's top face, z = where the optic sits along the gun. Each returns its rows.
// The eyepiece / window ring is what the ADS camera looks through; its geometry is what adsInfo reports.
const OPTIC = {
  rds: { dy: 0.045, dz: 0, relief: 0.2, r: 0.0265 },     // window centre above the rail, eye relief, inner radius of the window
  acog: { dy: 0.05, dz: 0.085, relief: 0.13, r: 0.0175 },  // eyepiece rear face sits dz ahead of the mount point
};
function opticRows(sight, railY, z) {
  if (sight === 'rds') {   // a big-window reflex sight on a low mount: base, emitter, the housing ring, a top cap
    const y = railY + OPTIC.rds.dy;
    return [B(0.03, 0.018, 0.05, 0, railY + 0.009, z, 'gunm'), B(0.014, 0.012, 0.024, 0, railY + 0.024, z, 'poly'),
      ...ring(0.03, 0.007, 0.03, 0, y, z, 'gunm', 10), B(0.022, 0.008, 0.03, 0, y + 0.034, z, 'gunm')];
  }
  if (sight === 'acog') {   // a 4x prism scope: mount with thumb screws, hollow body, objective bell, eyepiece, the fibre strip on top
    const y = railY + OPTIC.acog.dy, ze = z + OPTIC.acog.dz;
    return [B(0.034, 0.02, 0.07, 0, railY + 0.01, z, 'gunm'), B(0.046, 0.012, 0.012, 0, railY + 0.012, z - 0.022, 'rail'), B(0.046, 0.012, 0.012, 0, railY + 0.012, z + 0.022, 'rail'),
      ...ring(0.018, 0.006, 0.1, 0, y, z, 'gunm', 10), ...ring(0.024, 0.006, 0.035, 0, y, z - 0.065, 'gunm', 10),
      ...ring(0.02, 0.005, 0.04, 0, y, ze - 0.02, 'gunm', 10), B(0.006, 0.006, 0.07, 0, y + 0.021, z - 0.01, 'reddot')];
  }
  return [];
}
// Where the ADS camera sits for each gun and sight: y/z = the sight line in the gun's frame (rear aperture, window or eyepiece),
// relief = eye distance to it in metres, r = the window's inner radius (only optics with a mask need it).
const GUN_ADS = {
  smg:    { rail: 0.079, iron: { y: 0.115, z: 0.06, relief: 0.18 } },
  ar:     { rail: 0.085, iron: { y: 0.125, z: 0.08, relief: 0.18 } },
  lmg:    { rail: 0.109, iron: { y: 0.14, z: 0.1, relief: 0.18 } },
  sniper: { rail: 0.082, scope: { y: 0.135, z: 0.17, relief: 0.13, r: 0.021 } },
  pistol: { iron: { y: 0.076, z: 0.03, relief: 0.42 } },
  ak:     { iron: { y: 0.106, z: -0.08, relief: 0.3 } },     // taken off the dead: a U-notch well forward, so the eye sits farther back
  pkm:    { iron: { y: 0.112, z: -0.11, relief: 0.26 } },
  rocket: { iron: { y: 0.16, z: -0.2, relief: 0.3 } },
};
const OPTIC_Z = { smg: 0.0, ar: 0.0, lmg: -0.02, sniper: -0.02 };   // where an optic sits along each rail
function adsInfo(key, s) {
  const G = GUN_ADS[key] || GUN_ADS.ar, att = normAtt(key, s), o = OPTIC[att.sight];
  if (o && G.rail != null) return { y: G.rail + o.dy, z: (OPTIC_Z[key] || 0) + o.dz, relief: o.relief, r: o.r };
  return G[att.sight] || G.iron || G.scope;
}
const GUN_MUZ = {   // the barrel tip in the gun's frame: where the flash and the tracers start
  smg: { y: 0.035, z: -0.46 }, ar: { y: 0.03, z: -0.7 }, lmg: { y: 0.035, z: -0.73 }, sniper: { y: 0.035, z: -0.96 },
  pistol: { y: 0.02, z: -0.17 }, rocket: { y: 0.08, z: -1.0 }, ak: { y: 0.018, z: -0.64 }, pkm: { y: 0.028, z: -0.71 },
};
const GUN_BUILD = {
  smg: a => [   // UMP45: boxy polymer receiver, top rail, straight .45 mag ahead of the trigger, short barrel, hooded post, side-folding stock
    B(0.056, 0.074, 0.3, 0, 0.03, -0.07, 'poly'), B(0.034, 0.012, 0.3, 0, 0.073, -0.07, 'rail'),
    B(0.05, 0.05, 0.11, 0, -0.03, -0.1, 'poly'), MAG(B(0.034, a.ext ? 0.22 : 0.15, 0.06, 0, a.ext ? -0.165 : -0.13, -0.1, 'gunm')),
    B(0.036, 0.095, 0.05, 0, -0.1, 0.05, 'poly', 0.3), B(0.012, 0.02, 0.07, 0, -0.065, 0.0, 'poly'), B(0.006, 0.02, 0.006, 0, -0.058, 0.0, 'rail'),
    B(0.008, 0.026, 0.05, 0.03, 0.04, -0.09, 'gunm'), B(0.024, 0.016, 0.03, -0.035, 0.05, -0.22, 'poly'),
    B(0.052, 0.06, 0.1, 0, 0.02, -0.27, 'poly'), B(0.012, 0.012, 0.09, 0, -0.012, -0.27, 'rail'),
    C(0.011, 0.11, 0, 0.035, -0.375, 'gunm'), C(0.015, 0.03, 0, 0.035, -0.44, 'gunm'),
    B(0.02, 0.02, 0.2, 0, 0.045, 0.21, 'poly'), B(0.016, 0.016, 0.18, 0, -0.03, 0.2, 'poly', -0.15), B(0.045, 0.09, 0.03, 0, 0.01, 0.32, 'poly'), B(0.04, 0.03, 0.04, 0, 0.03, 0.09, 'poly'),
    ...(a.sight === 'iron' ? [   // hooded front post, flip-up rear aperture — the post tip and the aperture centre share the sight line (y 0.115)
      B(0.02, 0.014, 0.02, 0, 0.083, -0.3, 'poly'), B(0.006, 0.03, 0.006, 0, 0.1, -0.3, 'gunm'), B(0.007, 0.01, 0.007, 0, 0.11, -0.3, 'sightw'),
      ...ring(0.016, 0.005, 0.02, 0, 0.115, -0.3, 'poly', 8),
      B(0.03, 0.012, 0.03, 0, 0.085, 0.06, 'poly'), ...ring(0.018, 0.005, 0.008, 0, 0.115, 0.06, 'poly', 8),
    ] : opticRows(a.sight, 0.079, OPTIC_Z.smg))],
  ar: a => [   // M4A1: flat-top upper, lower with magwell, quad-rail handguard, A2 front sight base, birdcage, collapsible stock
    B(0.06, 0.07, 0.26, 0, 0.035, -0.02, 'gunm'), B(0.052, 0.055, 0.2, 0, -0.025, 0.0, 'gunm'), B(0.038, 0.014, 0.25, 0, 0.078, -0.02, 'rail'),
    B(0.03, 0.014, 0.04, 0, 0.062, 0.115, 'gunm'), B(0.008, 0.028, 0.045, 0.03, 0.045, -0.02, 'rail'),
    B(0.045, 0.07, 0.07, 0, -0.085, -0.055, 'gunm'), MAG(B(0.034, a.ext ? 0.25 : 0.165, 0.062, 0, a.ext ? -0.24 : -0.2, -0.065, 'poly', 0.16)),
    B(0.012, 0.02, 0.07, 0, -0.07, 0.03, 'gunm'), B(0.006, 0.02, 0.006, 0, -0.06, 0.02, 'rail'), B(0.036, 0.1, 0.048, 0, -0.1, 0.06, 'poly', 0.35),
    C(0.016, 0.2, 0, 0.02, 0.2, 'gunm'), B(0.05, 0.09, 0.12, 0, -0.005, 0.29, 'poly'), B(0.05, 0.03, 0.05, 0, 0.04, 0.24, 'poly'),
    B(0.056, 0.058, 0.2, 0, 0.03, -0.33, 'poly'),
    B(0.014, 0.012, 0.18, 0, 0.064, -0.33, 'rail'), B(0.014, 0.012, 0.18, 0, -0.004, -0.33, 'rail'),
    B(0.012, 0.014, 0.18, 0.033, 0.03, -0.33, 'rail'), B(0.012, 0.014, 0.18, -0.033, 0.03, -0.33, 'rail'),
    C(0.02, 0.03, 0, 0.03, -0.215, 'gunm'), B(0.03, 0.045, 0.035, 0, 0.055, -0.46, 'gunm'),
    C(0.011, 0.22, 0, 0.03, -0.55, 'gunm'), C(0.015, 0.05, 0, 0.03, -0.67, 'gunm'),
    ...(a.sight === 'iron' ? [   // A2 post between its ears, flip-up rear aperture: sight line y 0.125
      B(0.007, 0.05, 0.007, 0, 0.1, -0.46, 'gunm'), B(0.008, 0.012, 0.008, 0, 0.119, -0.46, 'sightw'),
      B(0.008, 0.06, 0.012, 0.017, 0.098, -0.46, 'gunm', 0, 0, -0.18), B(0.008, 0.06, 0.012, -0.017, 0.098, -0.46, 'gunm', 0, 0, 0.18),
      B(0.036, 0.012, 0.03, 0, 0.09, 0.08, 'gunm'), ...ring(0.018, 0.005, 0.008, 0, 0.125, 0.08, 'gunm', 8),
    ] : opticRows(a.sight, 0.085, OPTIC_Z.ar))],
  lmg: a => [   // M249 SAW: deep receiver, feed-tray cover with a rail, side-folded carry handle, soft ammo pouch, heat shield, gas tube, bipod, skeleton stock
    B(0.07, 0.095, 0.34, 0, 0.02, -0.02, 'gunm'), B(0.074, 0.028, 0.22, 0, 0.083, -0.07, 'gunm'), B(0.038, 0.012, 0.2, 0, 0.103, -0.07, 'rail'),
    B(0.02, 0.022, 0.12, -0.047, 0.085, -0.24, 'poly'), B(0.012, 0.03, 0.012, -0.047, 0.06, -0.19, 'poly'), B(0.012, 0.03, 0.012, -0.047, 0.06, -0.29, 'poly'),
    MAG(B(a.ext ? 0.11 : 0.09, a.ext ? 0.14 : 0.11, a.ext ? 0.16 : 0.13, -0.015, a.ext ? -0.12 : -0.105, -0.06, 'tan')), B(0.03, 0.02, 0.06, -0.015, -0.045, -0.06, 'gunm'),
    B(0.036, 0.1, 0.05, 0, -0.1, 0.09, 'poly', 0.35), B(0.012, 0.02, 0.07, 0, -0.07, 0.06, 'gunm'),
    B(0.062, 0.07, 0.16, 0, 0.015, -0.3, 'poly'), C(0.012, 0.28, 0, -0.012, -0.44, 'gunm'),
    C(0.014, 0.34, 0, 0.035, -0.52, 'gunm'), C(0.018, 0.05, 0, 0.035, -0.71, 'gunm'), B(0.03, 0.03, 0.03, 0, 0.04, -0.55, 'gunm'),
    B(0.012, 0.012, 0.26, 0.032, -0.03, -0.5, 'gunm'), B(0.012, 0.012, 0.26, -0.032, -0.03, -0.5, 'gunm'),
    B(0.048, 0.1, 0.18, 0, 0, 0.27, 'poly'), B(0.05, 0.12, 0.03, 0, -0.01, 0.37, 'poly'), B(0.03, 0.02, 0.1, 0, 0.06, 0.28, 'poly'),
    ...(a.sight === 'iron' ? [   // hooded post on the gas block, peep on the cover: sight line y 0.14
      B(0.007, 0.06, 0.007, 0, 0.085, -0.55, 'gunm'), B(0.008, 0.012, 0.008, 0, 0.134, -0.55, 'sightw'), ...ring(0.016, 0.005, 0.02, 0, 0.14, -0.55, 'gunm', 8),
      B(0.03, 0.014, 0.03, 0, 0.116, 0.1, 'gunm'), ...ring(0.018, 0.005, 0.008, 0, 0.14, 0.1, 'gunm', 8),
    ] : opticRows(a.sight, 0.109, OPTIC_Z.lmg))],
  sniper: a => [   // Intervention: long chassis and rail, barrel shroud, box mag ahead of the grip, bolt, fluted barrel, big brake, folded bipod, skeleton stock
    B(0.06, 0.085, 0.36, 0, 0.025, -0.04, 'gunm'), B(0.036, 0.014, 0.44, 0, 0.075, -0.06, 'rail'),
    B(0.055, 0.06, 0.24, 0, 0.02, -0.34, 'poly'), B(0.012, 0.012, 0.22, 0, -0.016, -0.34, 'rail'),
    MAG(B(0.04, a.ext ? 0.15 : 0.11, 0.07, 0, a.ext ? -0.135 : -0.115, -0.12, 'gunm')),
    B(0.036, 0.1, 0.05, 0, -0.1, 0.07, 'poly', 0.3), B(0.012, 0.02, 0.07, 0, -0.07, 0.03, 'gunm'),
    P(HJ.gun, 'cyl', 0.016, 0.06, 0.016, 0.05, 0.045, 0.1, 'rail', 0, 0, Math.PI / 2), P(HJ.gun, 'cyl', 0.024, 0.024, 0.024, 0.08, 0.045, 0.1, 'gunm', 0, 0, Math.PI / 2),
    C(0.017, 0.5, 0, 0.035, -0.62, 'gunm'), B(0.046, 0.046, 0.1, 0, 0.035, -0.9, 'gunm'), B(0.06, 0.01, 0.06, 0, 0.035, -0.88, 'rail'), B(0.06, 0.01, 0.06, 0, 0.035, -0.92, 'rail'),
    B(0.014, 0.014, 0.26, 0.036, -0.035, -0.42, 'gunm'), B(0.014, 0.014, 0.26, -0.036, -0.035, -0.42, 'gunm'), B(0.05, 0.03, 0.04, 0, -0.035, -0.3, 'gunm'),
    B(0.03, 0.03, 0.24, 0, 0.055, 0.3, 'gunm'), B(0.024, 0.024, 0.22, 0, -0.03, 0.3, 'gunm', 0.12), B(0.04, 0.03, 0.12, 0, 0.085, 0.28, 'poly'),
    B(0.045, 0.13, 0.03, 0, 0.01, 0.43, 'poly'), B(0.03, 0.06, 0.02, 0, -0.06, 0.4, 'gunm'),
    ...(a.sight === 'scope' ? [   // its own 6x: mount, two rings, a hollow tube, objective bell, eyepiece, turrets — sight line y 0.135
      B(0.03, 0.02, 0.22, 0, 0.092, -0.02, 'gunm'), ...ring(0.026, 0.008, 0.016, 0, 0.135, -0.1, 'rail', 10), ...ring(0.026, 0.008, 0.016, 0, 0.135, 0.06, 'rail', 10),
      ...ring(0.02, 0.006, 0.3, 0, 0.135, -0.02, 'gunm', 10), ...ring(0.03, 0.006, 0.08, 0, 0.135, -0.2, 'gunm', 10), ...ring(0.024, 0.006, 0.06, 0, 0.135, 0.14, 'gunm', 10),
      B(0.02, 0.03, 0.02, 0, 0.162, -0.02, 'gunm'), B(0.03, 0.02, 0.02, 0.035, 0.135, -0.02, 'gunm'),
    ] : opticRows(a.sight, 0.082, OPTIC_Z.sniper))],
  ak: () => [   // AK-47: stamped receiver and dust cover, wood furniture, curved magazine, gas tube, slant brake; a tangent leaf with a U-notch and a post between open ears — notch top y 0.108, post tip 0.107
    B(0.05, 0.07, 0.3, 0, 0.022, 0.02, 'gunm'), B(0.044, 0.018, 0.25, 0, 0.064, 0.045, 'gunm'),
    B(0.03, 0.03, 0.05, 0, 0.07, -0.115, 'gunm'), B(0.024, 0.006, 0.055, 0, 0.088, -0.1, 'gunm'),
    B(0.007, 0.017, 0.006, 0.0075, 0.0995, -0.08, 'gunm'), B(0.007, 0.017, 0.006, -0.0075, 0.0995, -0.08, 'gunm'),
    B(0.004, 0.012, 0.1, 0.027, 0.03, 0.04, 'gunm'), B(0.02, 0.012, 0.016, 0.036, 0.048, 0.12, 'gunm'),
    B(0.036, 0.024, 0.19, 0, 0.058, -0.27, 'wood'), B(0.054, 0.048, 0.19, 0, 0.012, -0.27, 'wood'),
    C(0.009, 0.12, 0, 0.055, -0.42, 'gunm'), B(0.026, 0.028, 0.03, 0, 0.042, -0.49, 'gunm'), C(0.011, 0.27, 0, 0.018, -0.45, 'gunm'),
    B(0.024, 0.03, 0.035, 0, 0.044, -0.55, 'gunm'),
    B(0.005, 0.048, 0.005, 0, 0.083, -0.55, 'gunm'), B(0.006, 0.007, 0.006, 0, 0.1035, -0.55, 'sightw'),
    B(0.005, 0.044, 0.01, 0.014, 0.078, -0.55, 'gunm'), B(0.005, 0.044, 0.01, -0.014, 0.078, -0.55, 'gunm'),
    C(0.014, 0.05, 0, 0.018, -0.61, 'gunm'),
    MAG(B(0.032, 0.1, 0.068, 0, -0.06, -0.065, 'gunm', 0.18)), MAG(B(0.031, 0.1, 0.064, 0, -0.15, -0.09, 'gunm', 0.5)),
    B(0.012, 0.012, 0.075, 0, -0.022, 0.035, 'gunm'), B(0.034, 0.095, 0.045, 0, -0.085, 0.1, 'wood', 0.32),
    B(0.042, 0.07, 0.26, 0, 0.0, 0.29, 'wood', 0.1), B(0.044, 0.11, 0.02, 0, -0.03, 0.42, 'gunm', 0.1)],
  pkm: () => [   // PKM: long receiver and top cover, skeleton stock, 100-round box hung on the right with its belt, heavy barrel with a carry handle off to the side, folded bipod, flash hider; notch top y 0.114, post tip 0.113
    B(0.056, 0.08, 0.38, 0, 0.018, 0, 'gunm'), B(0.058, 0.022, 0.28, 0, 0.069, -0.01, 'gunm'),
    B(0.03, 0.016, 0.05, 0, 0.088, -0.13, 'gunm'),
    B(0.009, 0.018, 0.006, 0.0085, 0.105, -0.11, 'gunm'), B(0.009, 0.018, 0.006, -0.0085, 0.105, -0.11, 'gunm'),
    B(0.024, 0.02, 0.03, 0.04, 0.03, -0.02, 'gunm'),
    MAG(B(0.085, 0.1, 0.13, 0.05, -0.08, -0.06, 'tube')), MAG(B(0.06, 0.02, 0.1, 0.05, -0.02, -0.06, 'tan')),
    B(0.012, 0.012, 0.075, 0, -0.035, 0.07, 'gunm'), B(0.034, 0.095, 0.045, 0, -0.09, 0.12, 'wood', 0.32),
    B(0.03, 0.028, 0.26, 0, 0.03, 0.33, 'wood'), B(0.028, 0.026, 0.24, 0, -0.06, 0.33, 'wood', -0.18), B(0.04, 0.13, 0.03, 0, -0.012, 0.46, 'gunm'),
    C(0.014, 0.44, 0, 0.028, -0.41, 'gunm'), C(0.009, 0.36, 0, -0.004, -0.39, 'gunm'),
    B(0.012, 0.045, 0.012, 0.028, 0.055, -0.3, 'gunm'), B(0.012, 0.012, 0.12, 0.028, 0.078, -0.3, 'wood'),
    B(0.03, 0.036, 0.035, 0, 0.046, -0.6, 'gunm'),
    B(0.005, 0.05, 0.005, 0, 0.088, -0.6, 'gunm'), B(0.006, 0.006, 0.006, 0, 0.11, -0.6, 'sightw'),
    B(0.005, 0.046, 0.01, 0.014, 0.085, -0.6, 'gunm'), B(0.005, 0.046, 0.01, -0.014, 0.085, -0.6, 'gunm'),
    C(0.018, 0.075, 0, 0.028, -0.67, 'gunm'),
    B(0.01, 0.01, 0.26, 0.016, -0.02, -0.46, 'gunm'), B(0.01, 0.01, 0.26, -0.016, -0.02, -0.46, 'gunm')],
};
const GUN_STATIC = {
  pistol: [   // sidearm, drawn when the primary runs dry: slide, frame, mag, a white post and a notch — sight line y 0.072
    B(0.035, 0.08, 0.2, 0, 0.02, -0.06, 'gunm'), B(0.03, 0.1, 0.05, 0, -0.06, 0.02, 'gunm', 0.3), B(0.02, 0.03, 0.05, 0, 0.06, -0.13, 'gunm'),
    B(0.007, 0.018, 0.007, 0, 0.067, -0.15, 'sightw'), B(0.007, 0.018, 0.01, 0.011, 0.067, 0.03, 'sightw'), B(0.007, 0.018, 0.01, -0.011, 0.067, 0.03, 'sightw')],
  rocket: [   // RPG on the shoulder: tube, warhead, grips, blast cone
    P(HJ.gun, 'cyl', 0.1, 0.9, 0.1, 0, 0.08, -0.12, 'tube', Math.PI / 2), MAG(P(HJ.gun, 'cyl', 0.17, 0.2, 0.17, 0, 0.08, -0.66, 'tube', Math.PI / 2)),
    MAG(P(HJ.gun, 'cone', 0.17, 0.26, 0.17, 0, 0.08, -0.89, 'accent', -Math.PI / 2)), P(HJ.gun, 'cone', 0.16, 0.18, 0.16, 0, 0.08, 0.38, 'gunm', -Math.PI / 2),
    P(HJ.gun, 'metal', 0.04, 0.12, 0.05, 0, -0.04, -0.05, 'gunm'), P(HJ.gun, 'metal', 0.04, 0.12, 0.05, 0, -0.04, -0.28, 'gunm'),
    P(HJ.gun, 'metal', 0.03, 0.06, 0.08, -0.07, 0.14, -0.2, 'gunm')],
};
const SUPPRESSOR_CAN = { smg: [0.021, 0.15], ar: [0.022, 0.17], lmg: [0.025, 0.18], sniper: [0.027, 0.22] };   // radius and length, m: a can threaded over the muzzle device
for (const k of Object.keys(SUPPRESSOR_CAN)) {
  const build = GUN_BUILD[k];
  GUN_BUILD[k] = a => {
    const rows = build(a);
    if (!a.suppressor) return rows;
    const [r, len] = SUPPRESSOR_CAN[k], m = GUN_MUZ[k];
    return [...rows, C(r, len, 0, m.y, m.z - len / 2 + 0.01, 'poly'), C(r * 0.72, 0.012, 0, m.y, m.z - len + 0.012, 'gunm')];
  };
}
const muzOf = (key, s) => {   // the barrel tip actually drawn: the far end of a suppressor when one is fitted
  const m = GUN_MUZ[key] || GUN_MUZ.ar, can = s && !s.pistol && s.suppressor && SUPPRESSOR_CAN[key];
  return can ? { y: m.y, z: m.z - can[1] + 0.01 } : m;
};
const attSig = (key, att) => { const a = normAtt(key, att); return SIGHT_OPTS[key] ? ':' + a.sight + (a.ext ? 'X' : '') + (a.suppressor ? 'S' : '') : ''; };
const gunRows = (key, att) => GUN_BUILD[key] ? GUN_BUILD[key](normAtt(key, att)) : GUN_STATIC[key];
const ENEMY_LEGS = [   // work trousers bloused into boots, gloves
  ...ARMS('coat', 'glove'),
  P(HJ.thighL, 'legp', 0.17, 0.4, 0.18, 0, -0.19, 0, 'pants'), P(HJ.thighR, 'legp', 0.17, 0.4, 0.18, 0, -0.19, 0, 'pants'),
  P(HJ.shinL, 'puttee', 0.16, 0.32, 0.17, 0, -0.15, 0, 'pants'), P(HJ.shinR, 'puttee', 0.16, 0.32, 0.17, 0, -0.15, 0, 'pants'),
  P(HJ.shinL, 'boot', 0.17, 0.12, 0.27, 0, -0.34, -0.045, 'boots'), P(HJ.shinR, 'boot', 0.17, 0.12, 0.27, 0, -0.34, -0.045, 'boots'),
];
const ENEMY_BASE = headRows => [   // paramilitary fighter: drab jacket, chest rig, balaclava and goggles
  P(HJ.pelvis, 'legp', 0.38, 0.25, 0.28, 0, 0.02, 0, 'pants'),
  P(HJ.pelvis, 'band', 0.42, 0.08, 0.31, 0, 0.1, 0, 'leather'),
  P(HJ.torso, 'torso', 0.48, 0.52, 0.34, 0, 0.26, 0, 'coat'),
  P(HJ.torso, 'webbing', 0.42, 0.26, 0.07, 0, 0.24, -0.17, 'webbing'),
  ...[-0.12, 0, 0.12].map(x => P(HJ.torso, 'webbing', 0.1, 0.15, 0.06, x, 0.2, -0.22, 'pouch')),
  P(HJ.head, 'mask', 0.33, 0.36, 0.34, 0, 0.14, 0, 'mask'),
  ...headRows,
  ...ENEMY_LEGS,
];
const MODERN_HELM = [P(HJ.head, 'helm', 0.42, 0.32, 0.46, 0, 0.19, 0, 'helm'), P(HJ.head, 'band', 0.43, 0.03, 0.47, 0, 0.2, 0, 'leather')];
const PATROL_CAP = [P(HJ.head, 'band', 0.36, 0.1, 0.38, 0, 0.26, 0, 'helm'), P(HJ.head, 'disc', 0.34, 0.03, 0.36, 0, 0.31, 0, 'helm'),
  P(HJ.head, 'disc', 0.28, 0.02, 0.18, 0, 0.23, -0.18, 'helm')];
const AK = [P(HJ.gun, 'wood', 0.06, 0.1, 0.2, 0, -0.01, 0.2, 'wood'), P(HJ.gun, 'metal', 0.06, 0.09, 0.32, 0, 0.02, -0.06, 'gunm'),
  P(HJ.gun, 'wood', 0.065, 0.07, 0.2, 0, 0.02, -0.32, 'wood'), P(HJ.gun, 'cyl', 0.025, 0.2, 0.025, 0, 0.04, -0.52, 'gunm', Math.PI / 2),
  MAG(P(HJ.gun, 'metal', 0.035, 0.18, 0.06, 0, -0.12, -0.14, 'gunm', 0.35))];
const PKM = [P(HJ.gun, 'metal', 0.07, 0.11, 0.42, 0, 0.02, -0.06, 'gunm'), P(HJ.gun, 'wood', 0.06, 0.12, 0.22, 0, -0.01, 0.25, 'wood'),
  P(HJ.gun, 'cyl', 0.035, 0.4, 0.035, 0, 0.03, -0.46, 'gunm', Math.PI / 2), MAG(P(HJ.gun, 'metal', 0.1, 0.12, 0.12, -0.03, -0.1, -0.05, 'metal')),
  P(HJ.gun, 'metal', 0.02, 0.02, 0.28, -0.03, -0.05, -0.45, 'gunm'), P(HJ.gun, 'metal', 0.02, 0.02, 0.28, 0.03, -0.05, -0.45, 'gunm')];
const ENEMY_ROWS = {   // one silhouette per enemy type
  grunt: () => [...ENEMY_BASE(MODERN_HELM), ...AK],
  runner: () => [...ENEMY_BASE([P(HJ.head, 'hood', 0.34, 0.2, 0.36, 0, 0.27, 0.01, 'hood')]),
    P(HJ.gun, 'metal', 0.03, 0.05, 0.34, 0, 0, -0.17, 'metal'), P(HJ.gun, 'leather', 0.05, 0.07, 0.1, 0, 0, 0, 'leather')],
  brute: () => [   // breacher: heavy plates, visored helmet, riot shield and sledgehammer
    P(HJ.pelvis, 'legp', 0.44, 0.28, 0.32, 0, 0.02, 0, 'pants'),
    P(HJ.torso, 'torso', 0.62, 0.56, 0.44, 0, 0.27, 0, 'coat'),
    P(HJ.torso, 'webbing', 0.56, 0.42, 0.1, 0, 0.26, -0.22, 'armor'), P(HJ.torso, 'webbing', 0.56, 0.42, 0.1, 0, 0.26, 0.22, 'armor'),
    P(HJ.torso, 'band', 0.66, 0.14, 0.48, 0, 0.12, 0, 'armor'),
    P(HJ.head, 'mask', 0.32, 0.34, 0.33, 0, 0.12, -0.02, 'mask'),
    P(HJ.head, 'helm', 0.44, 0.34, 0.48, 0, 0.18, 0, 'armor'), P(HJ.head, 'cloth', 0.32, 0.12, 0.03, 0, 0.14, -0.2, 'lens'),
    P(HJ.uArmL, 'cape', 0.26, 0.18, 0.3, -0.02, 0.02, 0, 'armor', 0, 0, 0.3), P(HJ.uArmR, 'cape', 0.26, 0.18, 0.3, 0.02, 0.02, 0, 'armor', 0, 0, -0.3),
    ...ENEMY_LEGS,
    P(HJ.fArmL, 'limb', 0.19, 0.28, 0.19, 0, -0.14, 0, 'coat'), P(HJ.fArmR, 'limb', 0.19, 0.28, 0.19, 0, -0.14, 0, 'coat'),
    P(HJ.fArmL, 'metal', 0.46, 0.7, 0.04, 0, -0.18, -0.16, 'shield'), P(HJ.fArmL, 'cloth', 0.22, 0.08, 0.05, 0, 0.04, -0.17, 'lens'),
    P(HJ.gun, 'metal', 0.05, 0.05, 0.8, 0, 0, -0.25, 'gunm'), P(HJ.gun, 'metal', 0.14, 0.14, 0.26, 0, 0, -0.66, 'metal')],
  gunner: () => [...ENEMY_BASE(PATROL_CAP), ...PKM],
  spotter: () => [...ENEMY_BASE([...PATROL_CAP,
      P(HJ.head, 'cyl', 0.1, 0.06, 0.12, -0.17, 0.12, 0, 'gunm', 0, 0, Math.PI / 2), P(HJ.head, 'metal', 0.02, 0.02, 0.14, -0.15, 0.05, -0.1, 'gunm')]),
    P(HJ.torso, 'taper', 0.3, 0.34, 0.16, 0, 0.28, 0.23, 'pack'), P(HJ.torso, 'metal', 0.02, 0.7, 0.02, 0.1, 0.8, 0.26, 'metal'),
    P(HJ.fArmR, 'cyl', 0.07, 0.16, 0.07, -0.05, -0.3, -0.06, 'gunm', Math.PI / 2), P(HJ.fArmR, 'cyl', 0.07, 0.16, 0.07, 0.04, -0.3, -0.06, 'gunm', Math.PI / 2)],
  rider: () => [...ENEMY_BASE(MODERN_HELM),
    P(HJ.gun, 'metal', 0.025, 0.07, 0.5, 0, 0, -0.28, 'metal'), P(HJ.gun, 'leather', 0.04, 0.05, 0.12, 0, 0, 0.02, 'leather')],
  boss: () => [   // juggernaut: bomb-suit armour, full helmet with a visor plate, minigun and ammo box
    P(HJ.pelvis, 'legp', 0.46, 0.3, 0.34, 0, 0.02, 0, 'coat'),
    P(HJ.pelvis, 'cape', 0.5, 0.3, 0.4, 0, -0.12, 0, 'coat'),
    P(HJ.torso, 'torso', 0.6, 0.58, 0.46, 0, 0.26, 0, 'coat'),
    P(HJ.torso, 'cape', 0.56, 0.46, 0.14, 0, 0.28, -0.22, 'coat'), P(HJ.torso, 'cape', 0.54, 0.44, 0.14, 0, 0.28, 0.22, 'coat'),
    P(HJ.torso, 'band', 0.5, 0.16, 0.46, 0, 0.56, 0, 'armor'),
    P(HJ.head, 'mask', 0.34, 0.37, 0.35, 0, 0.14, 0, 'mask'),
    P(HJ.head, 'helm', 0.48, 0.5, 0.5, 0, 0.06, 0, 'armor'),
    P(HJ.head, 'metal', 0.3, 0.16, 0.05, 0, 0.14, -0.23, 'lens'),
    P(HJ.uArmL, 'cape', 0.3, 0.24, 0.34, -0.03, 0, 0, 'coat', 0, 0, 0.3), P(HJ.uArmR, 'cape', 0.3, 0.24, 0.34, 0.03, 0, 0, 'coat', 0, 0, -0.3),
    ...ENEMY_LEGS,
    P(HJ.shinL, 'cape', 0.2, 0.3, 0.2, 0, -0.14, -0.02, 'coat'), P(HJ.shinR, 'cape', 0.2, 0.3, 0.2, 0, -0.14, -0.02, 'coat'),
    P(HJ.gun, 'metal', 0.16, 0.16, 0.34, 0, 0, 0.02, 'gunm'),
    ...[[0.04, 0.04], [-0.04, 0.04], [0.04, -0.04], [-0.04, -0.04]].map(([x, y]) => P(HJ.gun, 'cyl', 0.03, 0.56, 0.03, x, y, -0.44, 'gunm', Math.PI / 2)),
    P(HJ.gun, 'disc', 0.16, 0.03, 0.16, 0, 0, -0.5, 'metal', Math.PI / 2),
    P(HJ.gun, 'metal', 0.16, 0.2, 0.2, 0.14, -0.12, 0.08, 'pack')],
};
const HORSE_BODY = [   // light strike quad on the mount skeleton: legs are the wheels, neck the handlebar, tail the rear rack
  P(HOJ.body, 'hide', 0.72, 0.22, 1.25, 0, 0, 0, 'hide'),
  P(HOJ.body, 'hide', 0.92, 0.1, 0.5, 0, 0.13, -0.45, 'hide'), P(HOJ.body, 'hide', 0.92, 0.1, 0.5, 0, 0.13, 0.42, 'hide'),
  P(HOJ.body, 'hide', 0.4, 0.2, 0.35, 0, 0.2, -0.2, 'hide'),
  P(HOJ.body, 'leather', 0.3, 0.1, 0.55, 0, 0.2, 0.12, 'blanket'),
  P(HOJ.body, 'metal', 0.4, 0.22, 0.45, 0, -0.18, 0, 'metal'),
  P(HOJ.body, 'metal', 0.7, 0.03, 0.3, 0, 0.22, -0.62, 'metal'),
  P(HOJ.neck, 'cyl', 0.03, 0.75, 0.03, 0, 0, 0, 'gunm', 0, 0, Math.PI / 2), P(HOJ.neck, 'cyl', 0.04, 0.3, 0.04, 0, -0.15, 0, 'gunm'),
  P(HOJ.head, 'cyl', 0.1, 0.05, 0.1, 0, 0, 0, 'lamp', Math.PI / 2),
  P(HOJ.tail, 'metal', 0.75, 0.03, 0.35, 0, 0, 0, 'metal'), P(HOJ.tail, 'cyl', 0.06, 0.3, 0.06, 0.25, -0.15, 0, 'gunm', Math.PI / 2),
  P(HOJ.tail, 'metal', 0.14, 0.24, 0.2, -0.15, 0.13, 0, 'tube'),
  ...[HOJ.legFL, HOJ.legFR, HOJ.legBL, HOJ.legBR].flatMap(j => [
    P(j, 'disc', 0.62, 0.3, 0.62, 0, 0, 0, 'mane', 0, 0, Math.PI / 2), P(j, 'cyl', 0.26, 0.32, 0.26, 0, 0, 0, 'metal', 0, 0, Math.PI / 2)]),
];
const HORSE_BARDING = [   // raider quad: bull bar and a spare tyre on the rack
  P(HOJ.body, 'metal', 0.8, 0.2, 0.04, 0, 0.1, -0.72, 'metal'),
  P(HOJ.tail, 'disc', 0.5, 0.16, 0.5, 0.1, 0.12, 0, 'mane'),
];

// ---------- palettes ----------
const SKIN_TONES = ['#ffffff', '#f0d8c0', '#d4ac8c', '#a47c62'];
const ENEMY_LOOK = {   // root scale per enemy type
  grunt: [1, 1, 1], runner: [0.84, 1.02, 0.84], brute: [1.42, 1.4, 1.42], rider: [1, 1, 1],
  gunner: [1, 1, 1], spotter: [0.95, 0.97, 0.95], boss: [2.2, 2.2, 2.2],
};
function soldierPalette(slot, col, helm) {   // multicam uniform; carriers alternate coyote and ranger green; the roster colour marks the patches
  const wren = col === '#d9dbe4';
  return {
    coat: colorOf(wren ? '#7a7e88' : '#a09a7a'), pants: colorOf(wren ? '#6a6e78' : '#948e70'), boots: colorOf(wren ? '#2e2e30' : '#7a6446'),
    carrier: colorOf(wren ? '#2e3036' : slot % 2 ? '#7d6c4c' : '#4f5540'), pouch: colorOf(wren ? '#26282c' : slot % 2 ? '#6e5e42' : '#454a38'),
    helm: colorOf(wren ? '#3a3c44' : slot % 2 ? '#8a7a5a' : '#5a5e4a'), gaiter: colorOf(wren ? '#b8322a' : '#5a5a48'),
    scarf: colorOf(wren ? '#b8322a' : col), skin: colorOf(SKIN_TONES[slot % 4]), glove: colorOf('#8a7654'), knuck: colorOf('#3a3830'), lens: colorOf('#161a1e'),
    pad: colorOf('#34342e'), pack: colorOf(wren ? '#2a2c30' : '#6e6650'), webbing: colorOf('#6a6450'), leather: colorOf('#5c4430'),
    metal: colorOf('#8a8e92'), gunm: colorOf('#34363a'), tan: colorOf('#8c7a58'), wood: colorOf('#7c5432'), tube: colorOf('#58623c'),
    poly: colorOf('#24262a'), rail: colorOf('#5c6066'), sightw: colorOf('#f6f3e4'), reddot: colorOf('#ff3a2e'), glass: colorOf('#1d2c3c'),
    accent: colorOf('#3e4630'), hide: colorOf('#5e6446'), blanket: colorOf('#2a2824'), mane: colorOf('#1c1c1a'), lamp: colorOf('#fff4c8'),
    hair: colorOf(['#3a2a1c', '#6a4a2a', '#2a2420', '#8a6a3a'][slot % 4]),
  };
}
function enemyPalette(col, boss) {   // mixed paramilitary kit, jackets tinted toward each type's colour so silhouettes stay readable
  return {
    coat: new THREE.Color().copy(colorOf('#5a5e50')).lerp(colorOf(col), boss ? 0.45 : 0.16),
    pants: colorOf('#45443c'), boots: colorOf('#2a2622'), glove: colorOf('#262624'), knuck: colorOf('#1c1c1a'), mask: colorOf('#ffffff'),
    helm: colorOf('#6a664e'), brass: colorOf('#c8a040'), metal: colorOf('#8a8a84'), gunm: colorOf('#2e2e2e'),
    wood: colorOf('#7a4e2a'), webbing: colorOf('#5e5a44'), pouch: colorOf('#4e4a3a'), hood: colorOf('#3a3a36'), cape: colorOf('#3a3a36'),
    armor: colorOf('#3c3e38'), shield: colorOf('#2a2c2e'), lens: colorOf('#121418'), pack: colorOf('#4a4a3c'),
    plume: colorOf('#c02e24'), blanket: colorOf('#2a2420'), hide: colorOf('#7a5e40'), mane: colorOf('#1a1816'), lamp: colorOf('#ffe0a0'),
    leather: colorOf('#3a2c22'), tube: colorOf('#4a5230'),
    poly: colorOf('#222426'), rail: colorOf('#5a5c5e'), sightw: colorOf('#f6f3e4'), reddot: colorOf('#ff3a2e'), glass: colorOf('#1d2c3c'),
  };
}
let WHITE = null;   // THREE.Color, created once the engine loads

