// ============================================================ RAGDOLLS — rigid limbs on real joints (cannon-es)
// Every death opens with one of the three canned falls (poseDeath): the jolt, then the knees going — back when the hit
// came from the front, forward when it came from behind, twisting when a blast took them. Partway in, the ragdoll takes
// the body over from that exact pose and that motion — RAG.handoff of the way through a fall, RAG.handoffBlast into a
// blast — adds the kill's shove (along the round, harder for heavier guns; out and up from a blast) and lets the physics
// world finish it: the ground, cover and what is left of it, walls, roofs, the rubble already lying in the street.
// Still for RAG.settle s (or after RAG.maxT), its pose is baked into the corpse layer like any corpse, and the blood
// pool goes where it came to rest.
// The body is eleven rigid limbs — pelvis, torso, head, upper and lower arms and legs — sized off the rig and scaled
// with it, on cone-twist joints whose cones are set off-centre where a real joint bends one way: knees back, elbows and
// hips forward. Limbs collide with each other as well as the world, so an arm cannot pass through the chest. Each joint's
// world matrix is written from its limb, and placed where the parent limb holds it, so a joint the solver has let
// stretch never shows a gap: every model, uniform and size draws unchanged.
// It only looks: it never writes to anything the fight reads, and it rolls fxRand, never the simulation's dice. At most
// RAG.max run at once (fewer at lower quality: Q.ragdolls); past that, without the engine, or for a body that starts
// inside a building's box — the marksman in the belfry — the canned fall plays out to the end, as it always did.
const RAG = { max: 8, handoff: 0.5, handoffBlast: 0.04,   // half way through a fall it has buckled and begun to tip its own way; a blast throws at once
  settle: 0.4, maxT: 4, restV: 0.3, cap: 12 };               // still: every limb under restV m/s for settle s; never started faster than cap m/s
const RP = { pelvis: 0, hipL: 1, hipR: 2, kneeL: 3, kneeR: 4, footL: 5, footR: 6, neck: 7, shL: 8, shR: 9,
  elL: 10, elR: 11, handL: 12, handR: 13, top: 14, chest: 15 };
const RAG_N = 16;   // landmark points, read off the pose: what the camera, the blood pool and the tests look at
const RAG_ON = [   // where each point sits on the rig: joint, and joint-local position before the body's scale
  [HJ.pelvis, 0, 0, 0], [HJ.thighL, 0, 0, 0], [HJ.thighR, 0, 0, 0], [HJ.shinL, 0, 0, 0], [HJ.shinR, 0, 0, 0],
  [HJ.shinL, 0, -0.4, 0], [HJ.shinR, 0, -0.4, 0], [HJ.head, 0, 0, 0], [HJ.uArmL, 0, 0, 0], [HJ.uArmR, 0, 0, 0],
  [HJ.fArmL, 0, 0, 0], [HJ.fArmR, 0, 0, 0], [HJ.fArmL, 0, -0.3, 0], [HJ.fArmR, 0, -0.3, 0], [HJ.head, 0, 0.3, 0],
  [HJ.torso, 0, 0.3, -0.17]];
const RAG_UPPER = new Set([RP.neck, RP.shL, RP.shR, RP.top, RP.chest]);   // where a round's shove lands hardest
const RB = { pelvis: 0, torso: 1, head: 2, uArmL: 3, fArmL: 4, uArmR: 5, fArmR: 6, thighL: 7, shinL: 8, thighR: 9, shinR: 10 };
const RAG_BODIES = [   // the joint each limb hangs from, its centre in that joint's frame, its half-size, mass kg, and the two points its motion is read from
  [HJ.pelvis, 0, 0.02, 0, 0.17, 0.1, 0.12, 12, RP.pelvis, RP.pelvis],
  [HJ.torso, 0, 0.27, 0, 0.2, 0.26, 0.13, 20, RP.neck, RP.chest],
  [HJ.head, 0, 0.15, 0, 0.12, 0.15, 0.12, 5, RP.neck, RP.top],
  [HJ.uArmL, 0, -0.15, 0, 0.06, 0.15, 0.06, 3, RP.shL, RP.elL],
  [HJ.fArmL, 0, -0.15, 0, 0.05, 0.15, 0.05, 2, RP.elL, RP.handL],
  [HJ.uArmR, 0, -0.15, 0, 0.06, 0.15, 0.06, 3, RP.shR, RP.elR],
  [HJ.fArmR, 0, -0.15, 0, 0.05, 0.15, 0.05, 2, RP.elR, RP.handR],
  [HJ.thighL, 0, -0.2, 0, 0.08, 0.2, 0.08, 8, RP.hipL, RP.kneeL],
  [HJ.shinL, 0, -0.2, 0, 0.07, 0.2, 0.07, 5, RP.kneeL, RP.footL],
  [HJ.thighR, 0, -0.2, 0, 0.08, 0.2, 0.08, 8, RP.hipR, RP.kneeR],
  [HJ.shinR, 0, -0.2, 0, 0.07, 0.2, 0.07, 5, RP.kneeR, RP.footR],
];
const RAG_JOINTS = [   // parent limb, child limb, the middle of the cone in the parent's frame, its half-angle, the twist allowed
  [RB.pelvis, RB.torso, [0, 1, 0], 0.45, 0.35],
  [RB.torso, RB.head, [0, 1, 0], 0.55, 0.6],
  [RB.torso, RB.uArmL, [0, -1, 0], 1.4, 0.8],
  [RB.uArmL, RB.fArmL, [0, -0.342, -0.94], 1.2, 0.3],   // an elbow bends forward: its cone leans 70° to the front
  [RB.torso, RB.uArmR, [0, -1, 0], 1.4, 0.8],
  [RB.uArmR, RB.fArmR, [0, -0.342, -0.94], 1.2, 0.3],
  [RB.pelvis, RB.thighL, [0, -0.866, -0.5], 0.9, 0.3],  // a hip swings further forward than back
  [RB.thighL, RB.shinL, [0, -0.5, 0.866], 1.0, 0.2],    // a knee bends back only: its cone leans 60° behind
  [RB.pelvis, RB.thighR, [0, -0.866, -0.5], 0.9, 0.3],
  [RB.thighR, RB.shinR, [0, -0.5, 0.866], 1.0, 0.2],
];
const RAG_LIVE = new Set();
const ragCap = () => Math.min(RAG.max, Q.ragdolls != null ? Q.ragdolls : RAG.max);   // the quality preset's share: 8 on High, fewer on a phone that is struggling
const RV = {};   // scratch, made on first use (the engine is up by then)
function ragSample(J, out) {   // the 16 landmark points of a posed rig, in world metres
  const v = RV.o || (RV.o = new THREE.Vector3());
  for (let i = 0; i < RAG_N; i++) {
    const [j, x, y, z] = RAG_ON[i];
    v.set(x, y, z).applyMatrix4(J[j].matrixWorld);
    out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z;
  }
}
const insideBox = (b, x, y, z) => x > (b.x - b.hw) * XS && x < (b.x + b.hw) * XS && z > (b.y - b.hd) * XS && z < (b.y + b.hd) * XS && y < b.top * XS;
function ragBuild(J, sc) {   // eleven limbs where the rig's joints are now, jointed as a body is
  const W = PHYS.world, pos = RV.p || (RV.p = new THREE.Vector3()), quat = RV.q || (RV.q = new THREE.Quaternion()), scl = RV.s || (RV.s = new THREE.Vector3());
  const rag = { world: W, bodies: [], joints: [], J: Array.from({ length: HUMANOID.length }, () => ({ matrixWorld: new THREE.Matrix4() })),
    p: new Float32Array(RAG_N * 3), sc: [sc[0], sc[1], sc[2]], pivots: [], t: 0, still: 0, done: false, floor: 0 };
  const vol = sc[0] * sc[1] * sc[2];
  for (const [j, cx, cy, cz, hx, hy, hz, m] of RAG_BODIES) {
    J[j].matrixWorld.decompose(pos, quat, scl);
    const c = new THREE.Vector3(cx * sc[0], cy * sc[1], cz * sc[2]).applyQuaternion(quat).add(pos);
    const b = new CANNON.Body({ mass: m * vol, shape: new CANNON.Box(new CANNON.Vec3(hx * sc[0], hy * sc[1], hz * sc[2])),
      position: new CANNON.Vec3(c.x, c.y, c.z), quaternion: new CANNON.Quaternion(quat.x, quat.y, quat.z, quat.w),
      material: new CANNON.Material({ friction: 0.7, restitution: 0.02 }), linearDamping: 0.05, angularDamping: 0.45,
      allowSleep: true, sleepSpeedLimit: 0.15, sleepTimeLimit: 0.4,
      collisionFilterGroup: PHYS_LIMB, collisionFilterMask: ~PHYS_LIMB });   // limbs meet the world and what lies in it, not each other: a canned pose was never drawn to keep them apart
    W.addBody(b);
    rag.bodies.push(b);
  }
  for (const [a, bIdx, axis, angle, twist] of RAG_JOINTS) {
    const ja = RAG_BODIES[a], jb = RAG_BODIES[bIdx], off = HUMANOID[jb[0]];   // the child's joint, as the rig lays it out in its parent's frame
    const pivotA = new CANNON.Vec3((off[1] - ja[1]) * sc[0], (off[2] - ja[2]) * sc[1], (off[3] - ja[3]) * sc[2]);
    const pivotB = new CANNON.Vec3(-jb[1] * sc[0], -jb[2] * sc[1], -jb[3] * sc[2]);
    const down = bIdx === RB.torso || bIdx === RB.head ? 1 : -1;
    const c = new CANNON.ConeTwistConstraint(rag.bodies[a], rag.bodies[bIdx], {
      pivotA, pivotB, axisA: new CANNON.Vec3(axis[0], axis[1], axis[2]), axisB: new CANNON.Vec3(0, down, 0),
      angle, twistAngle: twist, collideConnected: false, maxForce: 1e6 });
    c.update();   // a canned pose past a joint's range: widen that joint for this body, or the solver snaps it the wrong way at once
    const cone = Math.acos(clamp(c.coneEquation.axisA.dot(c.coneEquation.axisB), -1, 1));
    if (cone > c.angle) c.angle = Math.min(Math.PI * 0.95, cone + 0.05);
    const tw = Math.acos(clamp(c.twistEquation.axisA.dot(c.twistEquation.axisB), -1, 1));
    if (tw > c.twistAngle) c.twistAngle = Math.min(Math.PI * 0.95, tw + 0.05);
    W.addConstraint(c);
    rag.joints.push(c);
    rag.pivots[bIdx] = [a, pivotA];
  }
  return rag;
}
// Take a body over from its canned fall. J is the rig as drawn this frame; prev is the same 16 points one frame earlier
// (prevDt seconds ago), or null. o: { hit: unit {x, y} the killing hit travelled, kick: m/s, blast, sc: [x, y, z] }.
function ragStart(J, prev, prevDt, o) {
  if (!physOn() || RAG_LIVE.size >= ragCap()) return null;   // the quality preset's share: 8 on High, fewer on a phone that is struggling
  const P = RV.pts || (RV.pts = new Float32Array(RAG_N * 3));
  ragSample(J, P);
  for (const b of buildings) if (insideBox(b, P[0], P[1], P[2])) return null;   // in a belfry, not on a roof: the canned fall. A head already in a wall is cleared out of it below   // in a belfry, not on a roof: the canned fall
  const rag = ragBuild(J, o.sc);
  let bx = o.hit ? o.hit.x : 0, bz = o.hit ? o.hit.y : 0;
  if (o.blast && !o.hit) { const a = fxRand(0, TAU); bx = Math.cos(a); bz = Math.sin(a); }   // a blast we have no bearing for: one way, the whole body
  const heavy = 1 / Math.max(1, rag.sc[1]);
  RAG_BODIES.forEach(([, , , , , , , , pa, pb], i) => {   // this frame's motion from the canned fall, plus the kill's shove
    let vx = 0, vy = 0, vz = 0;
    if (prev && prevDt > 0) for (const q of [pa, pb]) {
      vx += (P[q * 3] - prev[q * 3]) / prevDt / 2; vy += (P[q * 3 + 1] - prev[q * 3 + 1]) / prevDt / 2; vz += (P[q * 3 + 2] - prev[q * 3 + 2]) / prevDt / 2;
    }
    if (o.blast) {   // thrown: out along the blast, and up
      const w = fxRand(0.85, 1.15);
      vx += bx * o.kick * w * heavy; vz += bz * o.kick * w * heavy; vy += fxRand(2.4, 3.4) * heavy;
    } else {   // shoved along the round, hardest where it went in
      const w = (RAG_UPPER.has(pa) || RAG_UPPER.has(pb) ? 1 : i === RB.pelvis ? 0.45 : 0.3) * o.kick * heavy;
      vx += bx * w; vz += bz * w;
    }
    const sp = Math.hypot(vx, vy, vz); if (sp > RAG.cap) { vx *= RAG.cap / sp; vy *= RAG.cap / sp; vz *= RAG.cap / sp; }   // a canned frame can jump
    rag.bodies[i].velocity.set(vx, vy, vz);
  });
  ragClear(rag);
  RAG_LIVE.add(rag);
  ragPose(rag);
  return rag;
}
function ragClear(rag) {   // a body that starts partly inside cover or a wall is moved out of it whole — up onto it, or out of its nearest side.
  // Moved limb by limb, the joints would be stretched and the solver would snap the body back the wrong way at once.
  const pel = rag.bodies[RB.pelvis].position, near = [], d = RV.cd || (RV.cd = [0, 0, 0]);
  for (const b of rag.world.bodies) {   // the static boxes around it (the ground is a plane: no half-extents)
    const sh = b.mass === 0 && b.shapes[0], he = sh && sh.halfExtents;
    if (!he || Math.abs(b.position.x - pel.x) > he.x + 3 || Math.abs(b.position.z - pel.z) > he.z + 3) continue;
    near.push(b);
  }
  for (let pass = 0; pass < 3; pass++) {
    let worst = 0;
    for (const L of rag.bodies) {
      L.aabbNeedsUpdate = true; L.updateAABB();
      const lo = L.aabb.lowerBound, hi = L.aabb.upperBound, p = L.position;
      for (const b of near) {   // the limb's box, turned as it is, against the static box, square to the world
        const he = b.shapes[0].halfExtents, c = b.position;
        const ox = Math.min(hi.x - (c.x - he.x), c.x + he.x - lo.x), oz = Math.min(hi.z - (c.z - he.z), c.z + he.z - lo.z);
        const up = c.y + he.y - lo.y, under = hi.y - (c.y - he.y);
        if (ox <= 0 || oz <= 0 || up <= 0 || under <= 0) continue;   // not in this one
        const lift = up <= 0.45 || up <= Math.min(ox, oz), m = lift ? up : Math.min(ox, oz);   // low cover: up onto it, the way a body falls across sandbags
        if (m <= worst) continue;
        worst = m;
        if (lift) { d[0] = 0; d[1] = up + 0.005; d[2] = 0; }                                    // up onto it
        else if (ox <= oz) { d[0] = Math.sign(p.x - c.x || 1) * (ox + 0.005); d[1] = 0; d[2] = 0; }   // a wall: out of its nearest side
        else { d[0] = 0; d[1] = 0; d[2] = Math.sign(p.z - c.z || 1) * (oz + 0.005); }
      }
    }
    if (!worst) break;
    for (const L of rag.bodies) { L.position.x += d[0]; L.position.y += d[1]; L.position.z += d[2]; }
  }
}
function ragRelease(rag) {   // out of the world: its pose is in the corpse layer now
  if (!rag || !rag.bodies) return;
  RAG_LIVE.delete(rag);
  for (const c of rag.joints) rag.world.removeConstraint(c);
  for (const b of rag.bodies) rag.world.removeBody(b);
  rag.joints.length = 0; rag.bodies.length = 0;
}
function ragStep(rag, dt) {   // the world has already stepped this frame: read the pose, and judge whether it has come to rest
  if (rag.done || !rag.bodies.length) return;
  ragPose(rag);
  if (!(dt > 0)) return;
  rag.t += dt;
  let v = 0;
  for (const b of rag.bodies) v = Math.max(v, b.velocity.length());
  rag.still = v < RAG.restV ? rag.still + dt : 0;
  if (rag.still >= RAG.settle || rag.t >= RAG.maxT || rag.world !== PHYS.world) rag.done = true;
}
function ragPose(rag) {   // every joint's world matrix from its limb (nothing allocated: this runs every frame)
  const J = rag.J, sc = rag.sc, pos = RV.jp || (RV.jp = new THREE.Vector3()), q = RV.jq || (RV.jq = new THREE.Quaternion());
  const pq = RV.pq || (RV.pq = new THREE.Quaternion()), s = RV.js || (RV.js = new THREE.Vector3());
  s.set(sc[0], sc[1], sc[2]);
  for (let i = 0; i < RAG_BODIES.length; i++) {
    const [j, cx, cy, cz] = RAG_BODIES[i], b = rag.bodies[i];
    q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    const piv = rag.pivots[i];
    if (piv) {   // where the parent limb holds this joint: a joint the solver let stretch never shows a gap
      const pb = rag.bodies[piv[0]];
      pq.set(pb.quaternion.x, pb.quaternion.y, pb.quaternion.z, pb.quaternion.w);
      pos.set(piv[1].x, piv[1].y, piv[1].z).applyQuaternion(pq).add(TMP.v.set(pb.position.x, pb.position.y, pb.position.z));
    } else pos.set(-cx * sc[0], -cy * sc[1], -cz * sc[2]).applyQuaternion(q).add(TMP.v.set(b.position.x, b.position.y, b.position.z));
    J[j].matrixWorld.compose(pos, q, s);
  }
  const pl = J[HJ.pelvis].matrixWorld;   // the root sits below the pelvis, as the rig lays it out; the gun is never drawn: it has left the hand
  J[HJ.root].matrixWorld.copy(pl).multiply(TMP.m.makeTranslation(0, -0.8, 0));
  J[HJ.gun].matrixWorld.copy(J[HJ.fArmR].matrixWorld);
  ragSample(J, rag.p);
  const pel = rag.bodies[RB.pelvis];
  rag.floor = Math.max(0, pel.position.y - 0.13 * sc[1]);   // the surface it lies on: the street, a roof, a sandbag wall
}
function ragForward(rag) {   // the way the chest faces: the torso's front, which on the rig is its −Z
  const f = RV.fw || (RV.fw = new THREE.Vector3()), b = rag.bodies[RB.torso];
  if (!b) return f.set(0, 0, -1);
  return f.set(0, 0, -1).applyQuaternion(TMP.q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w));
}
