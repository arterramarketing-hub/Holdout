// ---------- rigs ----------
function compileParts(rows) {
  return rows.map(r => {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(r[5], r[6], r[7]),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(r[9], r[10], r[11])),
      new THREE.Vector3(r[2], r[3], r[4]));
    return { j: r[0], key: r[1], m, col: r[8], mag: !!r.mag };
  });
}
const partCache = new Map();
function partsFor(id, rowsFn) {
  let p = partCache.get(id);
  if (!p) { p = compileParts(rowsFn()); partCache.set(id, p); }
  return p;
}
function makeSkeleton(def) {
  const joints = def.map(([parent, x, y, z]) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    o.userData.rest = new THREE.Vector3(x, y, z);
    return o;
  });
  def.forEach(([parent], i) => { if (parent >= 0) joints[parent].add(joints[i]); });
  joints[0].matrixAutoUpdate = false;
  return joints;
}
function resetPose(joints) {
  for (let i = 1; i < joints.length; i++) {
    joints[i].rotation.set(0, 0, 0);
    joints[i].position.copy(joints[i].userData.rest);
  }
}
const _m4 = () => new THREE.Matrix4();
const TMP = {};   // preallocated scratch objects — nothing allocates per frame
let dropRig = null;   // a stand-in skeleton for weapons lying on the ground
let vmRig = null;     // and one for the weapon in your own hands
function initTmp() {
  TMP.m = _m4(); TMP.m2 = _m4(); TMP.m3 = _m4(); TMP.md = _m4();
  TMP.q = new THREE.Quaternion(); TMP.qd = new THREE.Quaternion();
  TMP.v = new THREE.Vector3(); TMP.v2 = new THREE.Vector3(); TMP.vd = new THREE.Vector3();
  TMP.s = new THREE.Vector3(); TMP.sd = new THREE.Vector3();
  TMP.e = new THREE.Euler(); TMP.up = new THREE.Vector3(0, 1, 0);
  dropRig = Array.from({ length: HUMANOID.length }, () => ({ matrixWorld: new THREE.Matrix4() }));
  vmRig = Array.from({ length: HUMANOID.length }, () => ({ matrixWorld: new THREE.Matrix4() }));
  WHITE = new THREE.Color(1, 1, 1);
  for (const k of ['vb', 'vb2', 'vh', 'vl', 'vl2', 'zb', 'va', 'va2', 'vc', 'vm', 'vs']) LT[k] = new THREE.Vector3();
  LT.qa = new THREE.Quaternion(); LT.ma = _m4();
  LT.zb.set(0, 0, 1); LT.one = new THREE.Vector3(1, 1, 1);
  for (const k of ['qb', 'qh', 'ql']) LT[k] = new THREE.Quaternion();
  for (const k of ['mb', 'mh', 'mx']) LT[k] = _m4();
  LT.eh = new THREE.Euler(); LT.eb = new THREE.Euler(); LT.cb = new THREE.Color();
  BLOOM.wide = colorOf('#ff8a3c'); BLOOM.core = colorOf('#fff1c8'); BLOOM.brass = colorOf('#e2b04e');
}
const LT = {}, BLOOM = {};   // scratch for hands, loose brass and muzzle blooms
// place a skeleton's root: ground position (metres), yaw, pitch about the feet, scale
function placeRoot(joints, x, z, yaw, pitch, sx, sy, sz, lift = 0) {
  TMP.e.set(pitch, yaw, 0, 'YXZ');
  TMP.q.setFromEuler(TMP.e);
  joints[0].matrix.compose(TMP.v.set(x, lift, z), TMP.q, TMP.s.set(sx, sy, sz));
  joints[0].updateMatrixWorld(true);
}
// emit every part of a posed skeleton into a batch set (or a cache array for corpses)
function emitParts(joints, parts, pal, set, flash, cache) {
  for (const p of parts) {
    TMP.m.multiplyMatrices(joints[p.j].matrixWorld, p.m);
    const c = flash ? WHITE : (pal[p.col] || WHITE);
    if (cache) cache.push(p.key, TMP.m.clone(), c);
    else set[p.key].push(TMP.m, c);
  }
}

// ---------- poses (written straight into joint rotations) ----------
const RECOIL_KICK = { smg: 0.12, ar: 0.2, lmg: 0.22, sniper: 0.45, rocket: 0.55, pistol: 0.1 };
function poseAim(J, bob = 0) {
  J[HJ.uArmR].rotation.set(1.22 + bob, 0, 0.12);
  J[HJ.fArmR].rotation.set(0.32, 0, 0);
  J[HJ.uArmL].rotation.set(1.3 + bob * 0.8, 0, 0.5);
  J[HJ.fArmL].rotation.set(0.42, 0, 0);
  J[HJ.gun].rotation.set(-Math.PI / 2 - 0.2, 0, 0);
}
function poseRide(J) {
  J[HJ.thighL].rotation.set(1.35, 0, -0.32);
  J[HJ.thighR].rotation.set(1.35, 0, 0.32);
  J[HJ.shinL].rotation.set(-1.3, 0, 0);
  J[HJ.shinR].rotation.set(-1.3, 0, 0);
}
function poseSwing(J, t) {   // strike fast, then recover: t runs 0 → 1 across the attack
  const strike = t < 0.3 ? 1 - Math.pow(1 - t / 0.3, 3) : 1;
  const recover = t < 0.3 ? 0 : smooth(0.3, 1, t);
  J[HJ.uArmR].rotation.set(lerp(lerp(2.5, -0.25, strike), 0.4, recover), 0, 0.2);
  J[HJ.fArmR].rotation.set(lerp(0.9, 0.1, strike) + recover * 0.3, 0, 0);
  J[HJ.torso].rotation.x -= 0.35 * strike * (1 - recover);
  J[HJ.torso].rotation.y += lerp(-0.4, 0.35, strike) * (1 - recover * 0.7);
  J[HJ.gun].rotation.set(lerp(0.3, -1.4, strike) + recover * 0.5, 0, 0);
}
function poseDeath(J, t, style = 0) {   // the hit jolts them, knees go, then gravity; returns root pitch (+ backward, − forward)
  const jolt = smooth(0, 0.1, t) * (1 - smooth(0.1, 0.32, t));
  const buckle = smooth(0.06, 0.42, t);
  const fall = t < 0.38 ? 0 : Math.min(1, ((t - 0.38) / 0.47) ** 2);
  const settle = t > 0.85 ? Math.sin((t - 0.85) / 0.15 * Math.PI) * 0.05 : 0;
  const fwd = style === 1, kneel = buckle * (1 - fall);
  J[HJ.pelvis].position.y = 0.8 - 0.32 * kneel - 0.05 * fall;
  J[HJ.torso].rotation.x = (fwd ? 0.45 : -0.4) * jolt + (fwd ? 0.5 : 0.2) * kneel - 0.1 * fall;
  J[HJ.torso].rotation.z = (style === 2 ? 0.5 : 0.12) * buckle;
  J[HJ.thighL].rotation.x = 1.25 * kneel + (fwd ? 0.1 : -0.15) * fall;
  J[HJ.thighR].rotation.x = 1.0 * kneel + 0.3 * fall;
  J[HJ.shinL].rotation.x = -1.7 * kneel - 0.3 * fall;
  J[HJ.shinR].rotation.x = -1.45 * kneel - 0.6 * fall;
  J[HJ.uArmL].rotation.set(0.5 * kneel + (fwd ? 2.2 : -0.4) * fall, 0, -0.5 * buckle - (fwd ? 0.2 : 1.1) * fall);
  J[HJ.uArmR].rotation.set(0.7 * kneel + (fwd ? 2.0 : -0.2) * fall, 0, 0.4 * buckle + (fwd ? 0.25 : 1.0) * fall);
  J[HJ.fArmL].rotation.x = 0.6 * buckle; J[HJ.fArmR].rotation.x = 0.8 * buckle;
  J[HJ.head].rotation.set((fwd ? 0.35 : -0.5) * jolt + 0.4 * kneel + (fwd ? -0.6 : 0.5) * fall, 0.35 * fall, 0);
  J[HJ.gun].rotation.set(-Math.PI / 2, 0, 0.9 * buckle);
  return (fwd ? -1 : 1) * (fall * 1.45 - settle);
}
function poseKneel(J) {   // gunner braced on one knee
  J[HJ.pelvis].position.y = 0.46;
  J[HJ.thighL].rotation.set(0.12, 0, -0.08);
  J[HJ.shinL].rotation.x = -1.55;
  J[HJ.thighR].rotation.set(1.45, 0, 0.1);
  J[HJ.shinR].rotation.x = -1.42;
}
function poseBinoculars(J) {   // spotter glassing the squad
  J[HJ.uArmL].rotation.set(2.25, 0, 0.5); J[HJ.fArmL].rotation.set(1.45, 0, 0);
  J[HJ.uArmR].rotation.set(2.25, 0, -0.5); J[HJ.fArmR].rotation.set(1.45, 0, 0);
  J[HJ.head].rotation.x = -0.08;
}
const RELOAD_KEYS = [   // t, left upper arm raise, left arm out, left forearm bend, weapon roll, weapon pitch, right arm drop
  [0.00, 1.30, 0.50, 0.42, 0.00, 0.00, 0.00],
  [0.14, 1.00, 0.30, 1.20, 0.70, 0.35, 0.30],
  [0.26, 0.25, 0.20, 0.90, 0.70, 0.35, 0.30],
  [0.45, 0.30, 0.20, 1.00, 0.70, 0.35, 0.30],
  [0.62, 1.00, 0.30, 1.20, 0.60, 0.30, 0.30],
  [0.80, 1.45, 0.10, 1.60, 0.30, 0.15, 0.20],
  [0.92, 1.30, 0.50, 0.42, 0.00, 0.00, 0.00],
  [1.01, 1.30, 0.50, 0.42, 0.00, 0.00, 0.00],
];
const MAG_HAND = [P(HJ.fArmL, 'metal', 0.045, 0.17, 0.09, 0, -0.36, -0.03, 'gunm')];   // the fresh magazine, while it's in the hand
const magHandParts = () => partsFor('MAGH', () => MAG_HAND);
function poseReload(J, t) {   // weapon tilts in, hand goes to the well, down to the pouch, back up, then racks it
  let i = 0;
  while (i < RELOAD_KEYS.length - 2 && t > RELOAD_KEYS[i + 1][0]) i++;
  const A = RELOAD_KEYS[i], B = RELOAD_KEYS[i + 1], k = smooth(A[0], B[0], t), m = j => lerp(A[j], B[j], k);
  J[HJ.uArmL].rotation.set(m(1), 0, m(2));
  J[HJ.fArmL].rotation.set(m(3), 0, 0);
  J[HJ.uArmR].rotation.x -= m(6);
  J[HJ.gun].rotation.z = m(4);
  J[HJ.gun].rotation.x += m(5);
  J[HJ.head].rotation.x += 0.3 * m(4);   // eyes down on the weapon
}
function poseCrouch(J, k = 1) {   // behind cover: down on one knee, shoulders hunched
  J[HJ.pelvis].position.y = lerp(J[HJ.pelvis].position.y, 0.48, k);
  J[HJ.thighL].rotation.set(lerp(J[HJ.thighL].rotation.x, 0.15, k), 0, -0.08 * k);
  J[HJ.shinL].rotation.x = lerp(J[HJ.shinL].rotation.x, -1.55, k);
  J[HJ.thighR].rotation.set(lerp(J[HJ.thighR].rotation.x, 1.45, k), 0, 0.1 * k);
  J[HJ.shinR].rotation.x = lerp(J[HJ.shinR].rotation.x, -1.42, k);
  J[HJ.torso].rotation.x += 0.26 * k;
  J[HJ.head].rotation.x -= 0.14 * k;
}
// ---------- animation helpers ----------
function smoothJoints(P, J, k) {   // ease every joint (and the pelvis height) toward the pose just written
  for (let i = 1; i < J.length; i++) {
    const o = J[i].rotation, b = i * 3;
    P[b] += (o.x - P[b]) * k; P[b + 1] += (o.y - P[b + 1]) * k; P[b + 2] += (o.z - P[b + 2]) * k;
    o.set(P[b], P[b + 1], P[b + 2]);
  }
  const last = P.length - 1;
  P[last] += (J[1].position.y - P[last]) * k;
  J[1].position.y = P[last];
}
function smoothPose(r, J, wdt, rate) {   // layer changes (aim, kneel, swing, fall) blend instead of popping
  if (!r.init) { for (let i = 1; i < J.length; i++) { const o = J[i].rotation; r.pose.set([o.x, o.y, o.z], i * 3); } r.pose[r.pose.length - 1] = J[1].position.y; r.init = true; }
  smoothJoints(r.pose, J, 1 - Math.exp(-rate * Math.max(wdt, 0)));
}
function springStep(r, x, v, dt, k, c) {   // damped spring back to rest: recoil kick, hit flinch
  if (dt <= 0) return;
  const h = Math.min(dt, 1 / 30);
  r[v] += (-k * r[x] - c * r[v]) * h;
  r[x] += r[v] * h;
}
function trackMotion(r, x, y, wdt, stride) {   // stride phase and speed from real displacement: feet never slide
  const dx = (x - r.px) * XS, dz = (y - r.py) * XS, d = Math.hypot(dx, dz);
  r.px = x; r.py = y;
  if (wdt <= 0) return;
  if (d > 3) { r.moveW = 0; return; }   // teleported (spawn, reset)
  r.moveW = approach(r.moveW, clamp(d / wdt / 3.2, 0, 1), 9, wdt);
  if (d > 1e-4) r.moveYaw = simYaw(Math.atan2(dz, dx));
  r.phase += d / stride * TAU * r.dir;
}
function poseRun(J, phase, amp, armsSwing) {   // run cycle: stride, knee lift on the recovery, hip swivel, bob
  if (amp < 0.001) return;
  const s = Math.sin(phase), c = Math.cos(phase);
  J[HJ.thighL].rotation.x = s * 0.82 * amp;
  J[HJ.thighR].rotation.x = -s * 0.82 * amp;
  J[HJ.shinL].rotation.x = -(0.18 + Math.max(0, Math.cos(phase + 0.35)) * 1.25) * amp;
  J[HJ.shinR].rotation.x = -(0.18 + Math.max(0, -Math.cos(phase + 0.35)) * 1.25) * amp;
  J[HJ.pelvis].position.y = 0.8 - 0.05 * amp + Math.abs(c) * 0.07 * amp;
  J[HJ.pelvis].rotation.y = s * 0.14 * amp;
  J[HJ.pelvis].rotation.z = c * 0.05 * amp;
  J[HJ.torso].rotation.y -= s * 0.2 * amp;
  J[HJ.torso].rotation.x += 0.12 * amp;
  if (armsSwing) {
    J[HJ.uArmL].rotation.x = -s * 0.75 * amp; J[HJ.uArmR].rotation.x = s * 0.75 * amp;
    J[HJ.fArmL].rotation.x = 0.75 * amp; J[HJ.fArmR].rotation.x = 0.75 * amp;
  }
}
function poseIdle(J, t, w) {   // breathing, weight on the legs, glancing around
  if (w < 0.01) return;
  const b = Math.sin(t * 2.2);
  J[HJ.torso].rotation.x += b * 0.025 * w;
  J[HJ.head].rotation.x -= b * 0.02 * w;
  J[HJ.head].rotation.y += Math.sin(t * 0.7) * 0.14 * w;
  J[HJ.pelvis].position.y += b * 0.006 * w;
  J[HJ.thighL].rotation.z -= 0.05 * w; J[HJ.thighR].rotation.z += 0.05 * w;
}
function poseWindup(J, k) {   // weapon comes up as the next melee strike comes due
  if (k <= 0) { J[HJ.gun].rotation.x = -0.9; return; }
  J[HJ.uArmR].rotation.set(lerp(J[HJ.uArmR].rotation.x, 2.5, k), 0, 0.25 * k);
  J[HJ.fArmR].rotation.x = lerp(J[HJ.fArmR].rotation.x, 0.9, k);
  J[HJ.torso].rotation.y += -0.4 * k;
  J[HJ.gun].rotation.x = lerp(-0.9, 0.3, k);
}
function poseQuad(J, phase, amp) {   // wheels roll with the distance travelled; suspension chatters over rough ground
  const spin = -phase * 1.64, idle = Math.sin(performance.now() / 25) * 0.004;
  for (const j of [HOJ.legFL, HOJ.legFR, HOJ.legBL, HOJ.legBR]) J[j].rotation.x = spin;
  J[HOJ.body].position.y = 0.62 + (Math.sin(phase * 3.1) * 0.018 + Math.sin(phase * 5.3) * 0.01) * amp + idle;
  J[HOJ.body].rotation.x = Math.sin(phase * 2.2) * 0.025 * amp;
  J[HOJ.body].rotation.z = Math.sin(phase * 1.7) * 0.02 * amp;
  J[HOJ.neck].rotation.y = Math.sin(phase * 0.9) * 0.08 * amp;
}
const angWrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const approachAng = (cur, target, rate, dt) => cur + angWrap(target - cur) * (1 - Math.exp(-rate * dt));

// ---------- view records: one per sim object, released when the object leaves its list ----------
const views = new Map();
let viewGen = 0, vidSeq = 1;
const rigPool = { humanoid: [], horse: [] };
const takeSkeleton = kind => rigPool[kind].pop() || makeSkeleton(kind === 'horse' ? HORSE : HUMANOID);
function recFor(obj) {
  let r = views.get(obj);
  if (!r) {
    r = { J: takeSkeleton('humanoid'), H: null, pal: null, yaw: null, hyaw: null, moveW: 0, moveYaw: null, dir: 1,
      phase: Math.random() * TAU, px: obj.x, py: obj.y, pose: new Float32Array(HUMANOID.length * 3 + 1), init: false,
      hpose: null, hinit: false, kick: 0, kickV: 0, flin: 0, flinV: 0, lastRecoil: 0, lastHp: obj.hp, lastFlash: 0, lastAtk: 0,
      seed: Math.random() * 100 };
    views.set(obj, r);
  }
  r.gen = viewGen;
  return r;
}
function sweepViews(all) {
  for (const [obj, r] of views) {
    if (!all && r.gen === viewGen) continue;
    rigPool.humanoid.push(r.J);
    if (r.H) rigPool.horse.push(r.H);
    views.delete(obj);
  }
}
const partSplit = new Map();   // a rig's parts minus its weapon, and the weapon on its own — for dropped guns
function splitGun(parts) {
  let s = partSplit.get(parts);
  if (!s) { s = { body: parts.filter(p => p.j !== HJ.gun), gun: parts.filter(p => p.j === HJ.gun) }; partSplit.set(parts, s); }
  return s;
}
const noGun = parts => splitGun(parts).body;
const gunOnly = parts => splitGun(parts).gun;
function emitGround(parts, pal, x, y, yaw, sc, set, cache) {   // a weapon lying on its side where its owner dropped it
  if (!parts.length || x == null) return;
  TMP.e.set(0, yaw, Math.PI / 2, 'YXZ');
  TMP.q.setFromEuler(TMP.e);
  dropRig[HJ.gun].matrixWorld.compose(TMP.v.set(x * XS, 0.07, y * XS), TMP.q, TMP.s.set(sc, sc, sc));
  emitParts(dropRig, parts, pal, set, false, cache);
  TMP.q.identity();
}
const soldierParts = (weapon, armor, wren, att) => partsFor(`S${weapon}${armor ? 'A' : ''}${wren ? 'W' : ''}${attSig(weapon, att)}`,
  () => [...SOLDIER_BODY, ...(armor ? SOLDIER_ARMOR : []), ...(wren ? WREN_SCARF : []), ...gunRows(weapon, att)]);
const enemyParts = type => partsFor('E' + type, ENEMY_ROWS[type] || ENEMY_ROWS.grunt);
const horseParts = enemy => partsFor(enemy ? 'HE' : 'H', () => enemy ? [...HORSE_BODY, ...HORSE_BARDING] : HORSE_BODY);
const isWrenCol = col => col === '#d9dbe4';
const helmFor = (slot, col) => isWrenCol(col) ? '#7a7d8c' : slotDark(slot);

// rider root = saddle joint × seat offset × yaw relative to the horse
function mountRider(r, x, z, dt, amp, phase) {   // the horse faces where it runs; the rider twists toward the aim
  if (!r.H) { r.H = takeSkeleton('horse'); r.hpose = new Float32Array(HORSE.length * 3 + 1); r.hinit = false; }
  const target = r.moveW > 0.2 && r.moveYaw != null ? r.moveYaw : r.yaw;
  r.hyaw = r.hyaw == null ? target : approachAng(r.hyaw, target, 4, dt);
  resetPose(r.H);
  poseQuad(r.H, phase, amp);
  if (!r.hinit) { for (let i = 1; i < r.H.length; i++) { const o = r.H[i].rotation; r.hpose.set([o.x, o.y, o.z], i * 3); } r.hpose[r.hpose.length - 1] = r.H[1].position.y; r.hinit = true; }
  smoothJoints(r.hpose, r.H, 1 - Math.exp(-16 * Math.max(dt, 0)));
  placeRoot(r.H, x, z, r.hyaw, 0, 1, 1, 1);
  TMP.q.setFromAxisAngle(TMP.up, clamp(angWrap(r.yaw - r.hyaw), -1.6, 1.6));
  TMP.m2.compose(TMP.v.set(0, -0.72, 0), TMP.q, TMP.s.set(1, 1, 1));
  r.J[0].matrix.multiplyMatrices(r.H[HOJ.saddle].matrixWorld, TMP.m2);
  r.J[0].updateMatrixWorld(true);
}

