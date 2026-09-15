// ---------- first person: the weapon carried by the camera ----------
const FPV = { bobP: 0, eyeY: null, kick: 0, kickV: 0, adsK: 0, lastRecoil: 0, flashT: 0, px: null, py: null, sway: 0,
  vx: 0, vz: 0, lastRl: -1, flashRot: 0, flashSc: 1, ejectT: 0 };
const VM_S = 0.78;      // the viewmodel's scale in the camera's frame
const VM_FLASH = 0.06;  // seconds a muzzle bloom lasts in your hands
const VM_MAG = [P(HJ.gun, 'metal', 0.05, 0.18, 0.1, -0.11, -0.26, 0.02, 'gunm')];   // kept for debug tools; the real magazines are MAG() parts now
const gunParts = (key, att) => partsFor('G' + key + attSig(key, att), () => gunRows(key, att));
const partsCached = (id, fn) => { let p = partCache.get(id); if (!p) { p = fn(); partCache.set(id, p); } return p; };

// ---------- gloved hands, finger by finger ----------
// Built in code as compiled parts (a matrix per piece), so a finger can run between two knuckle points at any angle.
function partSeg(key, tip, base, r, col, extra = r * 1.4) {   // a tapered capsule: thick at the base, thin at the tip
  const A = new THREE.Vector3(tip[0], tip[1], tip[2]), Bp = new THREE.Vector3(base[0], base[1], base[2]);
  const d = new THREE.Vector3().subVectors(Bp, A), len = d.length() || 1e-4;
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.divideScalar(len));
  return { j: HJ.gun, key, col, m: new THREE.Matrix4().compose(A.add(Bp).multiplyScalar(0.5), q, new THREE.Vector3(r * 2, len + extra, r * 2)) };
}
function partBox(key, c, size, rot, col) {
  return { j: HJ.gun, key, col, m: new THREE.Matrix4().compose(new THREE.Vector3(c[0], c[1], c[2]),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])), new THREE.Vector3(size[0], size[1], size[2])) };
}
const xfParts = (parts, M) => parts.map(p => ({ j: p.j, key: p.key, col: p.col, m: new THREE.Matrix4().multiplyMatrices(M, p.m) }));
function gripHand(sx) {   // round a pistol grip centred on the origin (grip along Y): palm behind, fingers round the front, index to the trigger, thumb high on the far side; sx -1 mirrors it for a left hand
  const X = x => x * sx, R = r => [r[0], r[1] * sx, r[2] * sx];
  const out = [
    partBox('palm', [X(0.018), -0.006, 0.02], [0.03, 0.09, 0.062], R([0, -0.5, 0]), 'glove'),
    partBox('palm', [X(0.031), -0.006, 0.016], [0.007, 0.07, 0.044], R([0, -0.5, 0]), 'knuck'),   // knuckle guard on the back of the hand
    partBox('hand', [X(0.004), 0.044, 0.026], [0.04, 0.026, 0.046], [0, 0, 0], 'glove'),          // the web of the hand, high on the grip
  ];
  [[0.018, 0.0112], [-0.006, 0.0108], [-0.03, 0.0096]].forEach(([y, r]) => {   // middle, ring, little finger
    out.push(partBox('hand', [X(0.02), y, -0.027], [r * 2.3, r * 2.3, r * 2.3], [0, 0, 0], 'glove'));
    out.push(partSeg('fing', [X(0.001), y - 0.004, -0.037], [X(0.02), y, -0.027], r, 'glove'));
    out.push(partSeg('fing', [X(-0.02), y - 0.006, -0.015], [X(0.001), y - 0.004, -0.037], r * 0.92, 'glove'));
  });
  out.push(partSeg('fing', [X(0.004), 0.034, -0.046], [X(0.017), 0.041, -0.024], 0.0108, 'glove'));   // index finger, out to the trigger
  out.push(partSeg('fing', [X(-0.001), 0.022, -0.05], [X(0.004), 0.034, -0.046], 0.0098, 'glove'));
  out.push(partSeg('fing', [X(-0.021), 0.05, -0.016], [X(-0.013), 0.038, 0.022], 0.0122, 'glove'));   // thumb
  out.push(partSeg('fing', [X(-0.019), 0.057, -0.044], [X(-0.021), 0.05, -0.016], 0.011, 'glove'));
  return out;
}
function guardHand(w, h) {   // on the near side of a handguard centred on the origin (barrel along -Z): back of the hand toward you, fingers over the top, thumb underneath
  const out = [
    partBox('palm', [-w - 0.018, -0.006, 0.002], [0.032, 0.09, 0.104], [0, 0, -0.18], 'glove'),   // back of the hand, leaning in over the top edge
    partBox('palm', [-w - 0.035, -0.002, 0], [0.009, 0.056, 0.08], [0, 0, -0.18], 'knuck'),        // hard knuckle guard
    partBox('hand', [-w - 0.012, -h - 0.006, 0.038], [0.04, 0.036, 0.05], [0, 0, 0], 'glove'),     // heel of the thumb, under the near edge
  ];
  [[-0.038, 0.0122], [-0.013, 0.0128], [0.012, 0.0124], [0.036, 0.011]].forEach(([z, r]) => {   // index finger at the front
    const kx = -w - 0.008, ky = h + 0.004;   // knuckles along the top of the near edge
    out.push(partBox('hand', [kx, ky, z], [r * 2.4, r * 2.4, r * 2.4], [0, 0, 0], 'glove'));
    out.push(partSeg('fing', [-0.002, h + r + 0.003, z], [kx, ky, z], r, 'glove'));                          // across the top
    out.push(partSeg('fing', [w + r * 0.35, h - 0.012, z + 0.002], [-0.002, h + r + 0.003, z], r * 0.9, 'glove'));   // curled down the far side
  });
  out.push(partSeg('fing', [-w + 0.008, -h - 0.014, -0.024], [-w - 0.012, -h - 0.006, 0.032], 0.013, 'glove'));   // thumb underneath, pointing forward
  out.push(partSeg('fing', [-w + 0.02, -h - 0.016, -0.062], [-w + 0.008, -h - 0.014, -0.024], 0.0115, 'glove'));
  return out;
}
const VM_ELBOW = { r: [0.34, -0.58, -0.18], l: [-0.26, -0.6, -0.26] };   // in the camera's frame: just below the corners of the view
function drawArm(W, E, pal, set) {   // glove cuff, camo sleeve and rolled cuff from a wrist (world) to an elbow out of frame, at viewmodel scale
  const d = LT.va2.subVectors(E, W), len = d.length(), s = VM_S;
  if (len < 1e-3) return;
  d.divideScalar(len);
  LT.qa.setFromUnitVectors(TMP.up, d);
  const seg = (k0, k1, r, key, col, extra) => {
    LT.vm.copy(W).addScaledVector(d, (k0 + k1) / 2);
    LT.ma.compose(LT.vm, LT.qa, LT.vs.set(r * 2, k1 - k0 + extra, r * 2));
    set[key].push(LT.ma, pal[col] || WHITE);
  };
  seg(-0.004 * s, 0.036 * s, 0.031 * s, 'band', 'webbing', 0);
  const mid = Math.min(len, 0.3 * s);   // a forearm thickens toward the elbow; a uniform rod from the hand to the corner of the view reads as a pole
  seg(0.05 * s, mid, 0.05 * s, 'limb', 'coat', 0.02 * s);
  if (len > mid) seg(mid, len, 0.068 * s, 'limb', 'coat', 0.05 * s);
  seg(0.048 * s, 0.082 * s, 0.055 * s, 'band', 'carrier', 0);
}
const VM_HOLD = {   // where the hands hold each gun: the grip [x, y, z, rake] and the support hand's handguard [half-width, half-height] or second grip
  smg:    { grip: [0, -0.1, 0.05, 0.3],  sup: [0, 0.02, -0.26, 0],       guard: [0.026, 0.03] },
  ar:     { grip: [0, -0.1, 0.06, 0.35], sup: [0, 0.03, -0.31, 0],       guard: [0.028, 0.029] },
  lmg:    { grip: [0, -0.1, 0.09, 0.35], sup: [0, 0.015, -0.3, 0],       guard: [0.031, 0.035] },
  sniper: { grip: [0, -0.1, 0.07, 0.3],  sup: [0, 0.02, -0.34, 0],       guard: [0.0275, 0.03] },
  pistol: { grip: [0, -0.06, 0.02, 0.3], sup: [-0.024, -0.086, 0.016, 0.3], guard: null },
  rocket: { grip: [0, -0.04, -0.05, 0],  sup: [0, -0.04, -0.28, 0],      guard: null },
  ak:     { grip: [0, -0.085, 0.1, 0.32], sup: [0, 0.012, -0.27, 0],     guard: [0.027, 0.024] },
  pkm:    { grip: [0, -0.09, 0.12, 0.32], sup: [0, 0.018, -0.17, 0],     guard: [0.029, 0.04] },
};
const VM_WRIST = {};   // wrist points found while the hands are built: 'g' + gun in the gun's frame, 's' + gun in the support hand's frame
function vmGripParts(key) {   // the trigger hand and its arm, in the gun's frame: it never lets go
  return partsCached('VG' + key, () => {
    const g = (VM_HOLD[key] || VM_HOLD.ar).grip;
    const M = new THREE.Matrix4().compose(new THREE.Vector3(g[0], g[1], g[2]), new THREE.Quaternion().setFromEuler(new THREE.Euler(g[3], 0, 0)), new THREE.Vector3(1, 1, 1));
    VM_WRIST['g' + key] = new THREE.Vector3(0.02, -0.05, 0.045).applyMatrix4(M).toArray();   // where its forearm starts, in the gun's frame
    return xfParts(gripHand(1), M);
  });
}
function vmSupportParts(key) {   // the other hand and its arm, in the hand's own frame (origin on whatever it holds), so a reload can move it
  return partsCached('VS' + key, () => {
    const H = VM_HOLD[key] || VM_HOLD.ar;
    if (H.guard) { VM_WRIST['s' + key] = [-H.guard[0] - 0.03, -0.05, 0.045]; return guardHand(H.guard[0], H.guard[1]); }
    const M = new THREE.Matrix4().makeRotationX(H.sup[3]);
    VM_WRIST['s' + key] = new THREE.Vector3(-0.02, -0.05, 0.045).applyMatrix4(M).toArray();
    return xfParts(gripHand(-1), M);
  });
}
const magSplit = new Map();
function splitMag(parts) {   // a gun's parts without its magazine, the magazine on its own, where a hand grips it (under its floor) and its size
  let s = magSplit.get(parts);
  if (!s) {
    const mag = parts.filter(p => p.mag);
    let bot = 0, cx = 0, cz = 0, size = [0.04, 0.17, 0.07];
    if (mag.length) {
      bot = Infinity;
      for (const p of mag) {
        const e = p.m.elements;
        bot = Math.min(bot, e[13] - Math.hypot(e[4], e[5], e[6]) / 2);
        cx += e[12] / mag.length; cz += e[14] / mag.length;
      }
      const e = mag[0].m.elements;
      size = [Math.hypot(e[0], e[1], e[2]), Math.hypot(e[4], e[5], e[6]), Math.hypot(e[8], e[9], e[10])];
    }
    s = { body: parts.filter(p => !p.mag), mag, grip: [cx, bot, cz], size };
    magSplit.set(parts, s);
  }
  return s;
}

// ---------- the reload, in your hands ----------
// Fractions of the reload, synced to its sounds (mag out 0.14, mag in 0.62, rack 0.8).
function track(keys, t) {   // keys [[t, ...values]], eased between neighbours; returns a shared array
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1][0]) i++;
  const A = keys[i], B = keys[i + 1], k = smooth(A[0], B[0], t), out = track.out || (track.out = []);
  for (let j = 1; j < A.length; j++) out[j - 1] = lerp(A[j], B[j], k);
  return out;
}
const VM_CHG = {   // where the support hand works the action once the fresh magazine is in, and the tug it gives
  smg: { at: [-0.05, 0.035, -0.2], rot: [0, 0, -0.25], tug: [0, 0, 0.06] },   // the UMP's handle, forward on the left
  ar:  { at: [-0.06, 0.004, -0.03], rot: [0, 0, 0.35], tug: [0.024, 0, 0] },   // a palm slap on the M4's bolt catch, left of the receiver
  lmg: { at: [-0.065, 0.1, -0.08], rot: [0, 0, -0.5], tug: [0.012, -0.034, 0] }, // the SAW's top cover, pushed shut from its left edge
  ak:  { at: [0.02, 0.05, 0.1], rot: [0, 0, -0.5], tug: [0, 0, 0.06] },          // over the top to the AK's handle on the right, and back
  pkm: { at: [0.035, 0.04, -0.02], rot: [0, 0, -0.5], tug: [0, 0, 0.07] },
};
const VM_POUCH = [-0.2, -0.46, 0.14, -0.8, 0.3, 0.5];
const reloadKeyCache = new Map();
function reloadKeys(key, sup, g) {   // support-hand keyframes [t, x, y, z, rx, ry, rz] for this gun; g = the magazine's grip point
  const id = key + ':' + g.map(v => v.toFixed(3)).join(',');
  let K = reloadKeyCache.get(id);
  if (K) return K;
  const G = [sup[0], sup[1], sup[2], 0, 0, 0], off = (a, dx, dy, dz, r) => [a[0] + dx, a[1] + dy, a[2] + dz, ...(r || a.slice(3))];
  if (key === 'rocket') {   // hand under a fresh warhead, fed into the front of the tube
    const W = [g[0], g[1] - 0.05, g[2], 0, 0, 0];
    K = [[0, ...G], [0.16, ...off(G, -0.03, -0.1, 0.08)], [0.32, ...VM_POUCH], [0.5, ...off(W, 0, -0.02, -0.3)], [0.6, ...off(W, 0, 0, -0.1)],
      [0.68, ...W], [0.72, ...W], [0.86, ...G], [1.01, ...G]];
  } else {
    const M = [g[0], g[1] + 0.02, g[2], 0.12, 0, 0.2], c = VM_CHG[key], C = c ? [...c.at, ...c.rot] : null;
    K = [[0, ...G], [0.11, ...M], [0.15, ...M], [0.26, ...off(M, 0, -0.2, 0)], [0.31, ...off(M, -0.05, -0.3, 0.05, [-0.3, 0.2, 0.4])],
      [0.42, ...VM_POUCH], [0.53, ...off(M, 0, -0.15, 0.01)], [0.62, ...M], [0.67, ...M]];
    if (C) K.push([0.75, ...C], [0.8, ...off(C, c.tug[0], c.tug[1], c.tug[2])], [0.85, ...C], [0.95, ...G], [1.01, ...G]);
    else K.push([0.8, ...G], [1.01, ...G]);
  }
  reloadKeyCache.set(id, K);
  return K;
}
const VMR = { gx: 0, gy: 0, gz: 0, rx: 0, ry: 0, rz: 0, hx: 0, hy: 0, hz: 0, hrx: 0, hry: 0, hrz: 0, mag: 'seat', mx: 0, my: 0, mz: 0 };
function vmReload(key, t, sp, sup) {   // the gun's extra offset, the support hand's frame and where the magazine is, t in 0..1
  const O = VMR, rocket = key === 'rocket';
  const c = smooth(0, rocket ? 0.16 : 0.13, t) * (1 - smooth(rocket ? 0.8 : 0.82, 1, t));
  const seat = rocket ? 0.68 : 0.62, bump = t > seat - 0.02 && t < seat + 0.1 ? Math.sin((t - seat + 0.02) / 0.12 * Math.PI) : 0;
  const tug = VM_CHG[key] && t > 0.76 && t < 0.86 ? Math.sin((t - 0.76) / 0.1 * Math.PI) : 0;
  if (rocket) { O.gx = -0.06 * c; O.gy = -0.03 * c; O.gz = 0.14 * c - 0.015 * bump; O.rx = 0.4 * c; O.ry = 0.45 * c; O.rz = 0.15 * c; }
  else {   // cant it toward the support hand, bump as the magazine seats, jolt with the charging handle
    O.gx = -0.07 * c; O.gy = 0.035 * c + 0.012 * bump; O.gz = 0.03 * c + 0.012 * tug;
    O.rx = 0.16 * c + 0.07 * bump; O.ry = 0.34 * c; O.rz = -0.5 * c;
  }
  const h = track(reloadKeys(key, sup, sp.grip), t);
  O.hx = h[0]; O.hy = h[1]; O.hz = h[2]; O.hrx = h[3]; O.hry = h[4]; O.hrz = h[5];
  if (rocket) {
    O.mag = t < 0.4 ? null : t < seat ? 'hand' : 'seat';
    O.mx = O.hx - sp.grip[0]; O.my = O.hy - (sp.grip[1] - 0.05); O.mz = O.hz - sp.grip[2];
  } else {
    O.mag = t < 0.15 || t >= seat ? 'seat' : t < 0.27 ? 'out' : t < 0.44 ? null : 'hand';
    O.mx = O.hx - sp.grip[0]; O.my = O.hy - (sp.grip[1] + 0.02); O.mz = O.hz - sp.grip[2];
  }
  return O;
}
function emitXf(M, parts, pal, set) {   // parts through one extra frame: a hand, a sliding magazine
  for (const p of parts) { TMP.m.multiplyMatrices(M, p.m); set[p.key].push(TMP.m, pal[p.col] || WHITE); }
}

// ---------- muzzle bloom and loose brass ----------
const linePix = () => 2 * Math.tan(VIEW.camera.fov * Math.PI / 360) / ((N64.target && N64.target.height) || N64.lines);   // metres per render line, per metre away
function bloomAt(pos, size, col, k, roll) {   // a soft additive glow that always faces the camera; k scales its brightness
  if (k <= 0.01) return;
  LT.qb.setFromAxisAngle(LT.zb, roll).premultiply(VIEW.camera.quaternion);
  LT.mb.compose(pos, LT.qb, LT.vb2.set(size, size, 1));
  VIEW.fx.bloom.push(LT.mb, LT.cb.copy(col).multiplyScalar(k));
}
const FLASH_SIZE = { smg: 0.9, ar: 1, lmg: 1.12, sniper: 1.35, rocket: 1.9, pistol: 0.75, ak: 1, pkm: 1.15, boss: 1.5 };
function muzzleBloom(r, gunM, my, mz, kind, wdt) {   // everyone else's flash: a glow at the drawn muzzle, gone in a few frames
  if (!(r.flashT > 0)) return;
  LT.vb.set(0, my, mz).applyMatrix4(gunM);
  const k = clamp(r.flashT / 0.07, 0, 1), px = LT.vb.distanceTo(VIEW.camera.position) * linePix(), big = FLASH_SIZE[kind] || 1;
  bloomAt(LT.vb, Math.max(0.95 * big, px * 14), BLOOM.wide, 0.55 * k, r.flashRot);
  bloomAt(LT.vb, Math.max(0.3 * big, px * 5), BLOOM.core, 0.95 * k, r.flashRot + 0.8);
  r.flashT -= wdt;
}
// Brass and empty magazines live only in the view: thrown from the gun that is drawn, bouncing where they land.
const BRASS = [], DROPS = [];
const CASING = { smg: [0.012, 0.023], ar: [0.0095, 0.045], lmg: [0.0095, 0.045], sniper: [0.016, 0.077], pistol: [0.0098, 0.019], ak: [0.0112, 0.039], pkm: [0.012, 0.054] };   // diameter, length in metres
const EJECT = { smg: [0.034, 0.045, -0.09], ar: [0.036, 0.045, -0.02], lmg: [0.038, -0.02, -0.04], sniper: [0.034, 0.05, 0], pistol: [0.02, 0.05, -0.05],
  ak: [0.034, 0.04, -0.06], pkm: [0.04, -0.03, -0.03] };   // ejection ports, in each gun's frame
function looseObj(list, cap) {
  const o = list.length >= cap ? list.shift() : { p: new THREE.Vector3(), v: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3() };
  list.push(o);
  o.t = 0; o.rest = false; o.hits = 0;
  return o;
}
function throwBrass(gunM, kind, scale, own, vx, vz) {   // out of the port to the right and up (belt-feds throw it down), spinning
  const port = EJECT[kind], c = CASING[kind];
  if (!port || !c) return;
  const b = looseObj(BRASS, Q.brass), down = kind === 'lmg' || kind === 'pkm';
  b.p.set(port[0], port[1], port[2]).applyMatrix4(gunM);
  b.v.set(rand(0.75, 1), down ? rand(-0.8, -0.4) : rand(0.35, 0.75), rand(0.1, 0.45)).transformDirection(gunM)
    .multiplyScalar(kind === 'sniper' ? rand(1.4, 2) : rand(2.2, 3.3));
  b.v.x += vx || 0; b.v.z += vz || 0;   // it leaves at the speed you are moving, plus its own
  b.q.setFromEuler(LT.eb.set(rand(0, TAU), rand(0, TAU), rand(0, TAU)));
  b.w.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(16, 32));
  b.life = rand(2.4, 3.4); b.own = own; b.d = c[0] * scale; b.l = c[1] * scale;
}
function dropLoose(pos, quat, sx, sy, sz, col, own, vel) {   // an empty magazine let go of
  const m = looseObj(DROPS, 12);
  m.p.copy(pos); m.q.copy(quat); m.v.copy(vel);
  m.w.set(rand(-1, 1), rand(-0.3, 0.3), rand(-1, 1)).normalize().multiplyScalar(rand(3, 7));
  m.life = 15; m.own = own; m.sx = sx; m.sy = sy; m.sz = sz; m.col = col;
}
function stepLoose(o, dt, rest, bounce) {   // gravity, spin, bounce, then settle on its side; true on the step it strikes the ground
  if (o.rest || dt <= 0) return false;
  o.v.y -= 9.8 * dt;
  o.p.addScaledVector(o.v, dt);
  if (o.p.y < rest) {
    o.p.y = rest; o.hits++;
    o.v.y *= -bounce; o.v.x *= 0.5; o.v.z *= 0.5; o.w.multiplyScalar(0.55);
    if (o.v.y < 0.4) {
      o.rest = true; o.v.set(0, 0, 0);
      LT.vl2.set(0, 1, 0).applyQuaternion(o.q); LT.vl2.y = 0;
      if (LT.vl2.lengthSq() < 1e-6) LT.vl2.set(1, 0, 0);
      o.q.setFromUnitVectors(TMP.up, LT.vl2.normalize());
    }
    return true;
  }
  const wl = o.w.length();
  if (wl > 1e-3) { LT.qh.setFromAxisAngle(LT.vl2.copy(o.w).divideScalar(wl), wl * dt); o.q.premultiply(LT.qh); }
  return false;
}
function drawLoose(wdt) {
  const F = VIEW.fx, D = VIEW.dyn, cp = VIEW.camera.position, pix = linePix();
  for (let i = BRASS.length - 1; i >= 0; i--) {
    const b = BRASS[i];
    b.t += wdt;
    if (b.t >= b.life) { BRASS.splice(i, 1); continue; }
    if (stepLoose(b, wdt, b.d / 2, 0.4) && b.hits === 1 && b.own && Math.random() < 0.65)
      playBuf('tink:' + randi(0, 2), { gain: 0.05, rate: rand(0.92, 1.15) });
    const px = b.p.distanceTo(cp) * pix, d = Math.max(b.d, px * 1.1);   // never thinner than a render line, or the dither eats it
    LT.mb.compose(b.p, b.q, LT.vb2.set(d, Math.max(b.l, px * 2.2), d));
    F.brass.push(LT.mb, BLOOM.brass);
  }
  for (let i = DROPS.length - 1; i >= 0; i--) {
    const m = DROPS[i];
    m.t += wdt;
    if (m.t >= m.life) { DROPS.splice(i, 1); continue; }
    if (stepLoose(m, wdt, Math.min(m.sx, m.sz) / 2, 0.22) && m.hits === 1 && m.own) playBuf('fall:0', { gain: 0.14, rate: rand(2.1, 2.5) });
    LT.mb.compose(m.p, m.q, LT.vb2.set(m.sx, m.sy, m.sz));
    D.metal.push(LT.mb, m.col);
  }
}

function drawViewmodel(s, wdt, set) {
  const cam3 = VIEW.camera, key = s.pistol ? 'pistol' : s.weapon;
  if (s.recoil > FPV.lastRecoil + 0.02) {
    FPV.kickV += 10 + RECOIL_KICK[key] * 30; FPV.flashT = VM_FLASH; FPV.flashRot = rand(0, TAU); FPV.flashSc = rand(0.85, 1.15);
    if (EJECT[key]) FPV.ejectT = key === 'sniper' ? 0.45 : 1e-4;   // the bolt gun throws its brass when the bolt is worked
  }
  FPV.lastRecoil = s.recoil;
  springStep(FPV, 'kick', 'kickV', wdt, 240, 18);
  FPV.flashT = Math.max(0, FPV.flashT - wdt);
  const moved = FPV.px == null ? 0 : Math.hypot(s.x - FPV.px, s.y - FPV.py);
  if (FPV.px != null && wdt > 0) { FPV.vx = (s.x - FPV.px) * XS / wdt; FPV.vz = (s.y - FPV.py) * XS / wdt; }
  FPV.px = s.x; FPV.py = s.y;
  const moveW = clamp(moved / Math.max(wdt, 1e-4) / 220, 0, 1);
  FPV.bobP += wdt * 9 * (0.2 + moveW) * (1 + 0.4 * (FPV.sprintK || 0));
  FPV.throwT = Math.max(0, (FPV.throwT || 0) - wdt);
  const thr = FPV.throwT > 0 ? Math.sin(Math.PI * (1 - FPV.throwT / 0.45)) : 0, spk = FPV.sprintK || 0;   // the gun dips out of the way for a throw; sprinting, it swings low and across
  const swp = s.swapT > 0 ? Math.sin(Math.PI * clamp(1 - s.swapT / CFG.swapTime, 0, 1)) : 0;   // changing guns: this one drops out of sight, the other comes up
  FPV.sway = approach(FPV.sway, clamp(-aim.lookDx * 2.2, -0.05, 0.05), 9, wdt);
  const A = FPV.adsK, rel = 1 - A, ads = adsInfo(key, s), muz = GUN_MUZ[key] || GUN_MUZ.ar;
  const wall = clearRun(s.x, s.y, s.x + Math.sin(aim.yaw) * 60, s.y - Math.cos(aim.yaw) * 60, 4) ? 0 : 1;   // muzzle against a wall: bring it in
  const H = VM_HOLD[key] || VM_HOLD.ar, sp = splitMag(gunParts(key, s));
  const rl = s.reloadT > 0 && s.reloadDur > 0 ? clamp(1 - s.reloadT / s.reloadDur, 0, 1) : -1;
  const R = rl >= 0 ? vmReload(key, rl, sp, H.sup) : null;
  const ox = (0.13 + Math.sin(FPV.bobP) * 0.012 * moveW + FPV.sway) * rel + (R ? R.gx : 0) - 0.05 * spk + 0.04 * thr + 0.03 * swp;
  // at full ADS the gun sits so its sight line (rear aperture / eyepiece at ads.y, ads.z) is dead on the camera axis, ads.relief in front of the eye
  const oy = lerp(-0.15, -ads.y * VM_S, A) + Math.abs(Math.cos(FPV.bobP)) * 0.01 * moveW * rel - FPV.kick * 0.028 - wall * 0.05 * rel + (R ? R.gy : 0) - 0.07 * spk - 0.22 * thr - 0.34 * swp;
  const oz = lerp(-0.52, -(ads.relief + ads.z * VM_S), A) + FPV.kick * 0.05 * rel + wall * 0.16 * rel + (R ? R.gz : 0);
  TMP.e.set(FPV.kick * 0.14 + 0.05 * rel + (R ? R.rx : 0) - 0.3 * spk - 0.7 * thr - 0.9 * swp, (0.1 + FPV.sway * 2) * rel + (R ? R.ry : 0) + 0.6 * spk, 0.06 * rel + (R ? R.rz : 0) + 0.3 * spk - 0.25 * thr, 'YXZ');
  TMP.q.setFromEuler(TMP.e);
  TMP.m2.compose(TMP.v.set(ox, oy, oz), TMP.q, TMP.s.set(VM_S, VM_S, VM_S));
  TMP.m.multiplyMatrices(cam3.matrixWorld, TMP.m2);
  const gunM = vmRig[HJ.gun].matrixWorld.copy(TMP.m);
  const rec = views.get(s);
  const pal = rec && rec.pal ? rec.pal : soldierPalette(s.slot, s.color, s.helm);
  const glass = !s.pistol && SIGHTS[s.sight] && SIGHTS[s.sight].over && SIGHTS[s.sight].over !== 'dot';
  // where the magazine is: in the gun, sliding out with the hand, gone, or coming up in the hand; a fired rocket leaves the tube empty
  const magAt = R ? R.mag : key === 'rocket' && s.mag <= 0 ? null : 'seat';
  if (!(glass && A > 0.85)) {   // settled behind a magnified optic, the picture is the optic's window (#sight), not the tube's insides
    emitParts(vmRig, sp.body, pal, set);
    if (sp.mag.length && magAt) {
      if (magAt === 'seat') emitXf(gunM, sp.mag, pal, set);
      else { LT.mx.multiplyMatrices(gunM, LT.mh.makeTranslation(R.mx, R.my, R.mz)); emitXf(LT.mx, sp.mag, pal, set); }
    }
    emitXf(gunM, vmGripParts(key), pal, set);
    const wg = VM_WRIST['g' + key], el = VM_ELBOW;
    drawArm(LT.va.set(wg[0], wg[1], wg[2]).applyMatrix4(gunM), LT.vc.set(el.r[0], el.r[1], el.r[2]).applyMatrix4(cam3.matrixWorld), pal, set);
    if (R) LT.mh.compose(LT.vh.set(R.hx, R.hy, R.hz), LT.qh.setFromEuler(LT.eh.set(R.hrx, R.hry, R.hrz)), LT.one);
    else LT.mh.makeTranslation(H.sup[0], H.sup[1], H.sup[2]);
    LT.mx.multiplyMatrices(gunM, LT.mh);
    emitXf(LT.mx, vmSupportParts(key), pal, set);
    const ws = VM_WRIST['s' + key];
    drawArm(LT.va.set(ws[0], ws[1], ws[2]).applyMatrix4(LT.mx), LT.vc.set(el.l[0], el.l[1], el.l[2]).applyMatrix4(cam3.matrixWorld), pal, set);
  }
  if (R && key !== 'rocket' && sp.mag.length && FPV.lastRl < 0.27 && rl >= 0.27) {   // the empty magazine leaves the hand and falls
    LT.vl.set(sp.grip[0] + R.mx, sp.grip[1] + sp.size[1] / 2 + R.my, sp.grip[2] + R.mz).applyMatrix4(gunM);
    gunM.decompose(LT.vb, LT.ql, LT.vb2);
    LT.vh.set(-0.4, -1, 0.15).transformDirection(gunM).multiplyScalar(1.4);
    LT.vh.x += FPV.vx; LT.vh.z += FPV.vz;
    dropLoose(LT.vl, LT.ql, sp.size[0] * VM_S, sp.size[1] * VM_S, sp.size[2] * VM_S, pal[sp.mag[0].col] || WHITE, true, LT.vh);
  }
  FPV.lastRl = rl;
  if (FPV.ejectT > 0) { FPV.ejectT -= wdt; if (FPV.ejectT <= 0) throwBrass(gunM, key, VM_S, true, FPV.vx, FPV.vz); }
  {   // the muzzle in the world: the model's own barrel tip, turned with the weapon — tracers and the bloom start there, not at the body
    TMP.v.set(0, muz.y * VM_S, muz.z * VM_S).applyQuaternion(TMP.q).add(TMP.v2.set(ox, oy, oz));
    TMP.m2.compose(TMP.v, TMP.q, TMP.s.set(1, 1, 1));
    TMP.m.multiplyMatrices(cam3.matrixWorld, TMP.m2);
    FPV.muz = FPV.muz || TMP.v.clone();
    FPV.muz.setFromMatrixPosition(TMP.m);
    if (FPV.flashT > 0) {   // down the sights the bloom sits in the middle of the picture: keep it from washing the sight out
      const k = FPV.flashT / VM_FLASH, a = 1 - 0.55 * A, big = FLASH_SIZE[key] || 1;
      bloomAt(FPV.muz, 0.3 * FPV.flashSc * big * a, BLOOM.wide, 0.5 * k * a, FPV.flashRot);
      bloomAt(FPV.muz, 0.11 * FPV.flashSc * big, BLOOM.core, 0.9 * k * a, FPV.flashRot + 0.8);
    }
  }
  TMP.q.identity();
}
