// ============================================================ RAGDOLLS
// Every death opens with one of the three canned falls (poseDeath): the jolt, then the knees going — back when the hit
// came from the front, forward when it came from behind, twisting when a blast took them. Partway in, the ragdoll takes
// the body over from that exact pose and that motion — RAG.handoff of the way through a fall, RAG.handoffBlast into a
// blast — adds the kill's shove (along the round, harder for heavier guns; out and up from a blast) and lets gravity,
// the ground, cover, walls and roofs finish it. Still for RAG.settle s (or after RAG.maxT), its pose is baked into the
// corpse layer like any corpse, and the blood pool goes where it came to rest.
// The body is 16 points — pelvis, hips, knees, feet, neck, shoulders, elbows, hands, the crown of the head and one on the
// front of the chest — with rigid bones, a rigid torso block (the chest point gives it depth, so it cannot turn inside
// out), knees that bend forward only, and ranges that stop an arm, a leg or the neck folding flat. Verlet at RAG.step,
// RAG.iters solver passes a step. The rig's parts are driven by writing each joint's world matrix from the points, as the
// dropped-gun and first-person rigs already do, so every model, uniform and size renders unchanged.
// It only looks: it reads the town's boxes and never writes to anything the fight reads, and it rolls fxRand, never the
// simulation's dice. At most RAG.max run at once (fewer at lower quality: Q.ragdolls); past that — or for a body that starts inside a building's box, like
// the marksman in the belfry — the canned fall plays out to the end, as it always did.
const RAG = { max: 8, step: 1 / 120, maxSteps: 6, iters: 6, g: 9.8, damp: 0.999, restV: 0.22, settle: 0.4, maxT: 4,
  handoff: 0.5, handoffBlast: 0.04, friction: 0.45, reach: 3,   // half way through a fall it has buckled and begun to tip its own way; a blast throws at once
  rest: 0.9, window: 0.25, drift: 0.03 };   // down on the ground: motion kept each step; and still if pelvis and neck together moved under drift m in two windows running
const RP = { pelvis: 0, hipL: 1, hipR: 2, kneeL: 3, kneeR: 4, footL: 5, footR: 6, neck: 7, shL: 8, shR: 9,
  elL: 10, elR: 11, handL: 12, handR: 13, top: 14, chest: 15 };
const RAG_N = 16;
const RAG_ON = [   // where each point sits on the rig: joint, and joint-local position before the body's scale
  [HJ.pelvis, 0, 0, 0], [HJ.thighL, 0, 0, 0], [HJ.thighR, 0, 0, 0], [HJ.shinL, 0, 0, 0], [HJ.shinR, 0, 0, 0],
  [HJ.shinL, 0, -0.4, 0], [HJ.shinR, 0, -0.4, 0], [HJ.head, 0, 0, 0], [HJ.uArmL, 0, 0, 0], [HJ.uArmR, 0, 0, 0],
  [HJ.fArmL, 0, 0, 0], [HJ.fArmR, 0, 0, 0], [HJ.fArmL, 0, -0.3, 0], [HJ.fArmR, 0, -0.3, 0], [HJ.head, 0, 0.3, 0],
  [HJ.torso, 0, 0.3, -0.17]];
const RAG_REST = [   // the same points standing, root at the feet, scale 1 (HUMANOID's offsets): what the ranges are measured against
  [0, 0.8, 0], [-0.12, 0.8, 0], [0.12, 0.8, 0], [-0.12, 0.4, 0], [0.12, 0.4, 0], [-0.12, 0, 0], [0.12, 0, 0],
  [0, 1.4, 0], [-0.27, 1.32, 0], [0.27, 1.32, 0], [-0.27, 1.02, 0], [0.27, 1.02, 0], [-0.27, 0.72, 0], [0.27, 0.72, 0],
  [0, 1.7, 0], [0, 1.16, -0.17]];
const RAG_RAD = [0.15, 0.1, 0.1, 0.08, 0.08, 0.07, 0.07, 0.14, 0.12, 0.12, 0.07, 0.07, 0.06, 0.06, 0.1, 0.03];   // metres kept off what it lies on: the back is thick, the chest point is the front surface
const RAG_BLOCK = [RP.pelvis, RP.hipL, RP.hipR, RP.neck, RP.shL, RP.shR, RP.chest];
const RAG_BONES = [[RP.neck, RP.top], [RP.shL, RP.elL], [RP.elL, RP.handL], [RP.shR, RP.elR], [RP.elR, RP.handR],
  [RP.hipL, RP.kneeL], [RP.kneeL, RP.footL], [RP.hipR, RP.kneeR], [RP.kneeR, RP.footR]];
const RAG_RANGES = [   // [a, b, least, most] as fractions of their standing distance
  [RP.shL, RP.handL, 0.4, 1], [RP.shR, RP.handR, 0.4, 1], [RP.hipL, RP.footL, 0.55, 1], [RP.hipR, RP.footR, 0.55, 1],
  [RP.chest, RP.top, 0.8, 1.2], [RP.shL, RP.top, 0.8, 1.15], [RP.shR, RP.top, 0.8, 1.15]];
const RAG_UPPER = new Set([RP.neck, RP.shL, RP.shR, RP.top, RP.chest]);   // where a round's shove lands hardest
const RAG_LIVE = new Set(), RAG_POOL = [];
const RV = {};   // scratch vectors, made on first use (the engine is up by then)
function ragNew() {
  const cons = [];   // [a, b, length or least, most]: sticks have least === most
  for (let i = 0; i < RAG_BLOCK.length; i++) for (let j = i + 1; j < RAG_BLOCK.length; j++) cons.push([RAG_BLOCK[i], RAG_BLOCK[j], 0, 0]);
  for (const [a, b] of RAG_BONES) cons.push([a, b, 0, 0]);
  for (const [a, b] of RAG_RANGES) cons.push([a, b, 0, 0]);
  return { p: new Float32Array(RAG_N * 3), q: new Float32Array(RAG_N * 3), cons, cols: [], touch: new Uint8Array(RAG_N),
    J: Array.from({ length: HUMANOID.length }, () => ({ matrixWorld: new THREE.Matrix4() })),
    sc: [1, 1, 1], k: 1, t: 0, still: 0, acc: 0, done: false, floor: 0, win: 0, calm: 0, w0: new Float32Array(6) };
}
function ragSample(J, out) {   // the 16 points of a posed rig, in world metres
  const v = RV.o || (RV.o = new THREE.Vector3());
  for (let i = 0; i < RAG_N; i++) {
    const [j, x, y, z] = RAG_ON[i];
    v.set(x, y, z).applyMatrix4(J[j].matrixWorld);
    out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
  }
}
const insideBox = (b, x, y, z) => x > (b.x - b.hw) * XS && x < (b.x + b.hw) * XS && z > (b.y - b.hd) * XS && z < (b.y + b.hd) * XS && y < b.top * XS;
// Take a body over from its canned fall. J is the rig as drawn this frame; prev is the same 16 points one frame earlier
// (prevDt seconds ago), or null. o: { hit: unit {x, y} the killing hit travelled, kick: m/s, blast, sc: [x, y, z] }.
function ragStart(J, prev, prevDt, o) {
  if (RAG_LIVE.size >= Math.min(RAG.max, Q.ragdolls || RAG.max)) return null;   // the quality preset's share: 8 on High, fewer on a phone that is struggling
  const rag = RAG_POOL.pop() || ragNew(), P = rag.p, O = rag.q;   // O: where each point was a step ago (not Q: that is the quality preset)
  ragSample(J, P);
  for (const b of buildings) for (let i = 0; i < RAG_N; i += 7) if (insideBox(b, P[i * 3], P[i * 3 + 1], P[i * 3 + 2])) { RAG_POOL.push(rag); return null; }   // in a belfry, not on a roof: the canned fall
  rag.sc[0] = o.sc[0]; rag.sc[1] = o.sc[1]; rag.sc[2] = o.sc[2];
  const dist = (a, b) => Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
  const rest = (a, b) => Math.hypot(RAG_REST[a][0] - RAG_REST[b][0], RAG_REST[a][1] - RAG_REST[b][1], RAG_REST[a][2] - RAG_REST[b][2]);
  rag.k = dist(RP.hipL, RP.kneeL) / 0.4;   // the body's size, read off a bone that cannot bend
  for (const c of rag.cons) {
    const a = c[0], b = c[1], range = RAG_RANGES.find(r => r[0] === a && r[1] === b);
    if (range) { const L = rest(a, b) * rag.k; c[2] = L * range[2]; c[3] = L * range[3]; }
    else c[2] = c[3] = dist(a, b);   // a bone, or two points of the torso: as they are now, for good
  }
  let bx = o.hit ? o.hit.x : 0, bz = o.hit ? o.hit.y : 0;
  if (o.blast && !o.hit) { const a = fxRand(0, TAU); bx = Math.cos(a); bz = Math.sin(a); }   // a blast we have no bearing for: one way, the whole body
  const h = RAG.step, heavy = 1 / Math.max(1, rag.sc[1]);
  for (let i = 0; i < RAG_N; i++) {   // this frame's motion from the canned fall, plus the kill's shove
    let vx = 0, vy = 0, vz = 0;
    if (prev && prevDt > 0) { vx = (P[i * 3] - prev[i * 3]) / prevDt; vy = (P[i * 3 + 1] - prev[i * 3 + 1]) / prevDt; vz = (P[i * 3 + 2] - prev[i * 3 + 2]) / prevDt; }
    if (o.blast) {   // thrown: out along the blast, and up
      const w = fxRand(0.85, 1.15);
      vx += bx * o.kick * w * heavy; vz += bz * o.kick * w * heavy; vy += fxRand(2.4, 3.4) * heavy;
    } else {   // shoved along the round, hardest where it went in
      const w = (RAG_UPPER.has(i) ? 1 : i === RP.pelvis || i === RP.hipL || i === RP.hipR ? 0.45 : 0.3) * o.kick * heavy;
      vx += bx * w; vz += bz * w;
    }
    const cap = 12;   // a canned frame can jump; never start faster than a body could move
    const sp = Math.hypot(vx, vy, vz); if (sp > cap) { vx *= cap / sp; vy *= cap / sp; vz *= cap / sp; }
    O[i * 3] = P[i * 3] - vx * h; O[i * 3 + 1] = P[i * 3 + 1] - vy * h; O[i * 3 + 2] = P[i * 3 + 2] - vz * h;
  }
  rag.cols.length = 0;   // what it could land on: the buildings and cover within reach of where it starts
  const px = P[0] / XS, pz = P[2] / XS, R = (RAG.reach + 2 * rag.k) / XS;
  for (const b of buildings) if (Math.abs(b.x - px) < b.hw + R && Math.abs(b.y - pz) < b.hd + R)
    rag.cols.push({ cyl: false, x0: (b.x - b.hw) * XS, x1: (b.x + b.hw) * XS, z0: (b.y - b.hd) * XS, z1: (b.y + b.hd) * XS, top: b.top * XS });
  for (const ob of obstacles) {
    const ex = ob.shape === 'c' ? ob.r : ob.hw, ez = ob.shape === 'c' ? ob.r : ob.hd;
    if (Math.abs(ob.x - px) > ex + R || Math.abs(ob.y - pz) > ez + R) continue;
    const g = coverGrid(ob);
    if (g) {   // cover that has come apart: a body falls through the gaps, and drapes over what still stands
      const full = coverFull(ob) * XS;
      for (let c = 0; c < g[0]; c++) {
        const r = chunkStack(ob, g, c);
        if (r < 0) continue;
        chunkBox(ob, g, c, CHUNKB);
        rag.cols.push({ cyl: false, x0: CHUNKB.x0 * XS, x1: CHUNKB.x1 * XS, z0: CHUNKB.y0 * XS, z1: CHUNKB.y1 * XS, top: full * (r + 1) / g[1] });
      }
      continue;
    }
    rag.cols.push(ob.shape === 'c' ? { cyl: true, x: ob.x * XS, z: ob.y * XS, r: ob.r * XS, top: coverTop(ob) * XS }
      : { cyl: false, x0: (ob.x - ob.hw) * XS, x1: (ob.x + ob.hw) * XS, z0: (ob.y - ob.hd) * XS, z1: (ob.y + ob.hd) * XS, top: coverTop(ob) * XS });
  }
  rag.t = 0; rag.still = 0; rag.acc = 0; rag.done = false; rag.floor = 0; rag.win = 0; rag.calm = 0;
  rag.w0[0] = P[0]; rag.w0[1] = P[1]; rag.w0[2] = P[2]; rag.w0[3] = P[21]; rag.w0[4] = P[22]; rag.w0[5] = P[23];   // pelvis and neck
  RAG_LIVE.add(rag);
  ragPose(rag);
  return rag;
}
function ragRelease(rag) { RAG_LIVE.delete(rag); if (!RAG_POOL.includes(rag)) RAG_POOL.push(rag); }
function ragStep(rag, dt) {   // advance by dt of world time (slow-motion slows it too) in fixed steps
  if (rag.done) return;
  rag.acc = Math.min(rag.acc + dt, RAG.step * RAG.maxSteps);
  const P = rag.p, O = rag.q, h = RAG.step, g = RAG.g * h * h;
  while (rag.acc >= h) {
    rag.acc -= h; rag.t += h;
    for (let o = 0; o < RAG_N * 3; o += 3) {
      const vx = (P[o] - O[o]) * RAG.damp, vy = (P[o + 1] - O[o + 1]) * RAG.damp, vz = (P[o + 2] - O[o + 2]) * RAG.damp;
      O[o] = P[o]; O[o + 1] = P[o + 1]; O[o + 2] = P[o + 2];
      P[o] += vx; P[o + 1] += vy - g; P[o + 2] += vz;
    }
    rag.touch.fill(0);
    for (let it = 0; it < RAG.iters; it++) {
      for (const [a, b, lo, hi] of rag.cons) {
        const ia = a * 3, ib = b * 3, dx = P[ib] - P[ia], dy = P[ib + 1] - P[ia + 1], dz = P[ib + 2] - P[ia + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-6, L = d < lo ? lo : d > hi ? hi : d;
        if (L === d) continue;
        const f = (d - L) / d * 0.5;
        P[ia] += dx * f; P[ia + 1] += dy * f; P[ia + 2] += dz * f;
        P[ib] -= dx * f; P[ib + 1] -= dy * f; P[ib + 2] -= dz * f;
      }
      ragKnees(rag);
      for (let i = 0; i < RAG_N; i++) ragCollide(rag, i);
    }
    let touching = 0;
    for (let i = 0; i < RAG_N; i++) if (rag.touch[i]) {   // lying on something: it drags, once a step
      const o = i * 3;
      O[o] = P[o] - (P[o] - O[o]) * (1 - RAG.friction); O[o + 2] = P[o + 2] - (P[o + 2] - O[o + 2]) * (1 - RAG.friction);
      touching++;
    }
    if (touching >= 4) for (let o = 0; o < RAG_N * 3; o++) O[o] = P[o] - (P[o] - O[o]) * RAG.rest;   // down on the ground: what little motion is left dies away
    let v2 = 0;
    for (let o = 0; o < RAG_N * 3; o += 3) v2 = Math.max(v2, (P[o] - O[o]) ** 2 + (P[o + 1] - O[o + 1]) ** 2 + (P[o + 2] - O[o + 2]) ** 2);
    rag.still = v2 < (RAG.restV * h) ** 2 ? rag.still + h : 0;
    rag.win += h;   // a wobble never drops below a speed, but it goes nowhere: still, too, if the body has not moved in a while
    if (rag.win >= RAG.window) {
      const moved = Math.hypot(P[0] - rag.w0[0], P[1] - rag.w0[1], P[2] - rag.w0[2]) + Math.hypot(P[21] - rag.w0[3], P[22] - rag.w0[4], P[23] - rag.w0[5]);
      rag.calm = moved < RAG.drift ? rag.calm + 1 : 0;
      rag.w0[0] = P[0]; rag.w0[1] = P[1]; rag.w0[2] = P[2]; rag.w0[3] = P[21]; rag.w0[4] = P[22]; rag.w0[5] = P[23]; rag.win = 0;
    }
    if (rag.still >= RAG.settle || rag.calm >= 2 || rag.t >= RAG.maxT) { rag.done = true; RAG_LIVE.delete(rag); break; }
  }
  ragPose(rag);
}
function ragKnees(rag) {   // a knee bends forward: if it has swung behind the line from hip to foot, it is set back on it
  const P = rag.p, f = ragForward(rag);
  for (const [hip, knee, foot] of [[RP.hipL, RP.kneeL, RP.footL], [RP.hipR, RP.kneeR, RP.footR]]) {
    const ik = knee * 3, mx = (P[hip * 3] + P[foot * 3]) / 2, my = (P[hip * 3 + 1] + P[foot * 3 + 1]) / 2, mz = (P[hip * 3 + 2] + P[foot * 3 + 2]) / 2;
    const s = (P[ik] - mx) * f.x + (P[ik + 1] - my) * f.y + (P[ik + 2] - mz) * f.z;
    if (s < 0) { P[ik] -= s * f.x; P[ik + 1] -= s * f.y; P[ik + 2] -= s * f.z; }   // onto the line, not past it: a reflection overshoots and pumps energy in
  }
}
function ragForward(rag) {   // the way the chest faces: from the spine out to the chest point
  const P = rag.p, f = RV.fw || (RV.fw = new THREE.Vector3()), up = RV.up || (RV.up = new THREE.Vector3());
  up.set(P[RP.neck * 3] - P[0], P[RP.neck * 3 + 1] - P[1], P[RP.neck * 3 + 2] - P[2]).normalize();
  const s = 0.36 * rag.k;   // the chest point is 0.36 m up the spine from the pelvis, standing
  f.set(P[RP.chest * 3] - P[0] - up.x * s, P[RP.chest * 3 + 1] - P[1] - up.y * s, P[RP.chest * 3 + 2] - P[2] - up.z * s);
  if (f.lengthSq() < 1e-8) f.set(0, 0, -1); else f.normalize();
  return f;
}
// Out of the ground, and out of (or up onto) the boxes and drums near it. A contact is dead: the part of the velocity
// going into what it touched is taken away (the previous position is set from the corrected one), so there is no bounce
// and no launch — plain Verlet reads a push-out as speed, and a foot a few centimetres into the pavement would throw the
// body into the air. Velocity away from the surface, and along it, is kept (friction takes the sliding, once a step).
function ragCollide(rag, i) {
  const P = rag.p, O = rag.q, o = i * 3, r = RAG_RAD[i] * rag.k;
  let x = P[o], y = P[o + 1], z = P[o + 2], on = -1, nx = 0, nz = 0;   // on: the height it lies on; (nx, nz): the wall it was pushed off
  if (y < r) { y = r; on = 0; }
  for (const c of rag.cols) {
    if (y >= c.top + r) continue;
    if (c.cyl) {
      const dx = x - c.x, dz = z - c.z, R = c.r + r, d2 = dx * dx + dz * dz;
      if (d2 >= R * R) continue;
      const d = Math.sqrt(d2) || 1e-6, side = R - d, up = c.top + r - y;
      if (O[o + 1] >= c.top || up <= side) { y = c.top + r; on = c.top; }
      else { nx = dx / d; nz = dz / d; x += nx * side; z += nz * side; }
    } else {
      if (x <= c.x0 - r || x >= c.x1 + r || z <= c.z0 - r || z >= c.z1 + r) continue;
      const up = c.top + r - y, l = x - (c.x0 - r), rt = c.x1 + r - x, n = z - (c.z0 - r), fr = c.z1 + r - z;
      const m = Math.min(up, l, rt, n, fr);
      if (O[o + 1] >= c.top || m === up) { y = c.top + r; on = c.top; }   // it came down from above: it lies on top
      else if (m === l) { x = c.x0 - r; nx = -1; nz = 0; } else if (m === rt) { x = c.x1 + r; nx = 1; nz = 0; }
      else if (m === n) { z = c.z0 - r; nx = 0; nz = -1; } else { z = c.z1 + r; nx = 0; nz = 1; }
    }
  }
  if (on < 0 && !nx && !nz) return;
  let vx = P[o] - O[o], vy = P[o + 1] - O[o + 1], vz = P[o + 2] - O[o + 2];
  if (on >= 0) { if (vy < 0) vy = 0; rag.touch[i] = 1; if (i === RP.pelvis) rag.floor = on; }
  if (nx || nz) { const vn = vx * nx + vz * nz; if (vn < 0) { vx -= vn * nx; vz -= vn * nz; } }
  P[o] = x; P[o + 1] = y; P[o + 2] = z;
  O[o] = x - vx; O[o + 1] = y - vy; O[o + 2] = z - vz;
}
function ragFrame(m, ox, oy, oz, ux, uy, uz, rx, ry, rz, sc) {   // a joint's world matrix: up along (u), right as near (r) as it can be, the body's scale
  const Y = RV.y || (RV.y = new THREE.Vector3()), X = RV.x || (RV.x = new THREE.Vector3()), Z = RV.a || (RV.a = new THREE.Vector3());
  Y.set(ux, uy, uz); if (Y.lengthSq() < 1e-10) Y.set(0, 1, 0); else Y.normalize();
  X.set(rx, ry, rz).addScaledVector(Y, -(rx * Y.x + ry * Y.y + rz * Y.z));
  if (X.lengthSq() < 1e-8) { X.set(Y.y, -Y.x, 0); if (X.lengthSq() < 1e-8) X.set(1, 0, 0); }   // right lies along up: any square to it will do
  X.normalize();
  Z.crossVectors(X, Y).normalize();
  m.makeBasis(X, Y, Z).scale(TMP.s.set(sc[0], sc[1], sc[2]));
  m.setPosition(ox, oy, oz);
}
function ragLimb(rag, j, a, b, rx, ry, rz) {   // a limb joint at a, its bone running down to b
  const P = rag.p;
  ragFrame(rag.J[j].matrixWorld, P[a * 3], P[a * 3 + 1], P[a * 3 + 2], P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2], rx, ry, rz, rag.sc);
}
function ragPose(rag) {   // write every joint's world matrix from the points (nothing allocated: this runs every frame)
  const P = rag.p, J = rag.J, sc = rag.sc, k = rag.k;
  const px = P[0], py = P[1], pz = P[2], nx = P[RP.neck * 3], ny = P[RP.neck * 3 + 1], nz = P[RP.neck * 3 + 2];
  const ux = nx - px, uy = ny - py, uz = nz - pz, ul = Math.hypot(ux, uy, uz) || 1;
  const rx = P[RP.shR * 3] - P[RP.shL * 3], ry = P[RP.shR * 3 + 1] - P[RP.shL * 3 + 1], rz = P[RP.shR * 3 + 2] - P[RP.shL * 3 + 2];
  const hx = P[RP.hipR * 3] - P[RP.hipL * 3], hy = P[RP.hipR * 3 + 1] - P[RP.hipL * 3 + 1], hz = P[RP.hipR * 3 + 2] - P[RP.hipL * 3 + 2];
  ragFrame(J[HJ.pelvis].matrixWorld, px, py, pz, ux, uy, uz, hx, hy, hz, sc);
  ragFrame(J[HJ.torso].matrixWorld, px + ux / ul * 0.06 * k, py + uy / ul * 0.06 * k, pz + uz / ul * 0.06 * k, ux, uy, uz, rx, ry, rz, sc);
  ragFrame(J[HJ.root].matrixWorld, px - ux / ul * 0.8 * k, py - uy / ul * 0.8 * k, pz - uz / ul * 0.8 * k, ux, uy, uz, hx, hy, hz, sc);
  ragFrame(J[HJ.head].matrixWorld, nx, ny, nz, P[RP.top * 3] - nx, P[RP.top * 3 + 1] - ny, P[RP.top * 3 + 2] - nz, rx, ry, rz, sc);
  ragLimb(rag, HJ.uArmL, RP.shL, RP.elL, rx, ry, rz); ragLimb(rag, HJ.fArmL, RP.elL, RP.handL, rx, ry, rz);
  ragLimb(rag, HJ.uArmR, RP.shR, RP.elR, rx, ry, rz); ragLimb(rag, HJ.fArmR, RP.elR, RP.handR, rx, ry, rz);
  ragLimb(rag, HJ.thighL, RP.hipL, RP.kneeL, hx, hy, hz); ragLimb(rag, HJ.shinL, RP.kneeL, RP.footL, hx, hy, hz);
  ragLimb(rag, HJ.thighR, RP.hipR, RP.kneeR, hx, hy, hz); ragLimb(rag, HJ.shinR, RP.kneeR, RP.footR, hx, hy, hz);
  J[HJ.gun].matrixWorld.copy(J[HJ.fArmR].matrixWorld).setPosition(P[RP.handR * 3], P[RP.handR * 3 + 1], P[RP.handR * 3 + 2]);   // never drawn: the gun has left the hand
}
