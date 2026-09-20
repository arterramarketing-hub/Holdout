// ---------- characters ----------
function drawSoldier(s, wdt, set) {
  const r = recFor(s), J = r.J, key = s.pistol ? 'pistol' : s.weapon;
  if (!r.pal) r.pal = soldierPalette(s.slot, s.color, s.helm);
  const X = s.x * XS, Z = s.y * XS, aimYaw = simYaw(s.aim);
  trackMotion(r, s.x, s.y, wdt, s.horse ? 3.4 : 2.3);
  let rootT = aimYaw;   // legs follow the movement, the upper body follows the aim
  r.dir = 1;
  if (!s.horse && r.moveW > 0.15 && r.moveYaw != null) {
    const back = Math.abs(angWrap(r.moveYaw - aimYaw)) > 1.9;
    r.dir = back ? -1 : 1;
    rootT = aimYaw + clamp(angWrap((back ? r.moveYaw + Math.PI : r.moveYaw) - aimYaw), -1.0, 1.0);
  }
  r.yaw = r.yaw == null ? rootT : approachAng(r.yaw, rootT, 10, wdt);
  const twist = s.horse ? 0 : clamp(angWrap(aimYaw - r.yaw), -1.2, 1.2);
  const fired = s.recoil > r.lastRecoil + 0.02;
  if (fired) r.kickV += RECOIL_KICK[key] * 22;
  r.lastRecoil = s.recoil;
  if (s.hp < r.lastHp - 0.4) r.flinV += 9;
  r.lastHp = s.hp;
  springStep(r, 'kick', 'kickV', wdt, 300, 20);
  springStep(r, 'flin', 'flinV', wdt, 180, 16);
  resetPose(J);
  if (s.horse) poseRide(J); else poseRun(J, r.phase, r.moveW, false);
  poseIdle(J, performance.now() / 1000 + r.seed, 1 - r.moveW);
  J[HJ.torso].rotation.x -= 0.04;
  J[HJ.torso].rotation.y += twist * 0.75;
  J[HJ.head].rotation.y += twist * 0.25;
  poseAim(J, Math.sin(r.phase * 2) * 0.05 * r.moveW);
  const settled = s.slot === state.controlled || !s.path || !s.path.length;
  if (!s.horse && s.coverRef && settled && s.peekT <= 0 && r.moveW < 0.5) poseCrouch(J);   // pops up only to shoot
  if (s.reloadT > 0) poseReload(J, 1 - s.reloadT / s.reloadDur);
  smoothPose(r, J, wdt, 22);
  J[HJ.uArmR].rotation.x += r.kick; J[HJ.uArmL].rotation.x += r.kick * 0.6;
  J[HJ.torso].rotation.x += r.flin * 0.5 - r.kick * 0.25;
  J[HJ.head].rotation.x += r.flin * 0.4;
  if (s.horse) mountRider(r, X, Z, wdt, r.moveW, r.phase);
  else placeRoot(J, X, Z, r.yaw, 0, 1, 1, 1, 0);
  const blink = s.invuln > 0 && Math.floor(s.invuln * 12) % 2 === 0;
  const rt = s.reloadT > 0 && s.reloadDur > 0 ? 1 - s.reloadT / s.reloadDur : -1, own = s.slot === state.controlled;
  if (!blink) {
    const parts = soldierParts(key, true, isWrenCol(s.color), s);
    const magOut = (rt >= 0.14 && rt < 0.62) || (key === 'rocket' && s.mag <= 0 && rt < 0);   // the magazine is out of the gun, or the tube is empty
    emitParts(J, magOut ? splitMag(parts).body : parts, r.pal, set);
    if ((rt >= 0.14 && rt < 0.24 && key !== 'rocket') || (rt >= 0.44 && rt < 0.62)) emitParts(J, magHandParts(), r.pal, set);
    if (s.horse) emitParts(r.H, horseParts(), r.pal, set);
  }
  gunLife(r, J, key, rt, fired, own, wdt, !s.pistol && !!s.suppressor);
  decal(VIEW.fx.shadow, X, Z, s.horse ? 1.9 : 0.95, 0, WHITE, 0.02);
  if (s.slot !== state.controlled && s.hp < s.maxHp - 0.05) hpBar(X, Z, s.horse ? 2.45 : 2.05, s.hp / s.maxHp, '#9ed34a');
}
function gunLife(r, J, kind, rt, fired, own, wdt, quiet) {   // muzzle bloom, brass and the dropped magazine for a character's drawn gun
  const gunM = J[HJ.gun].matrixWorld;
  if (fired) { r.flashT = quiet ? 0 : 0.07; r.flashRot = rand(0, TAU); if (EJECT[kind]) r.ejectT = kind === 'sniper' ? 0.45 : 1e-4; }
  const muz = GUN_MUZ[kind] || ENEMY_MUZ[kind];
  if (muz && Q.glow) muzzleBloom(r, gunM, muz.y, muz.z, kind, wdt);
  if (r.ejectT > 0) { r.ejectT -= wdt; if (r.ejectT <= 0) throwBrass(gunM, kind, 1, own, 0, 0); }
  if (kind !== 'rocket' && rt >= 0.24 && r.lastRt < 0.24) {   // let go of the empty magazine on the way down to the pouch
    LT.vl.set(0, -0.36, -0.03).applyMatrix4(J[HJ.fArmL].matrixWorld);
    J[HJ.fArmL].matrixWorld.decompose(LT.vb, LT.ql, LT.vb2);
    dropLoose(LT.vl, LT.ql, 0.045 * LT.vb2.x, 0.17 * LT.vb2.x, 0.09 * LT.vb2.x, r.pal.gunm || WHITE, own, LT.vh.set(rand(-0.4, 0.4), -0.5, rand(-0.4, 0.4)));
  }
  r.lastRt = rt;
}
const ENEMY_MUZ = { ak: { y: 0.04, z: -0.63 }, pkm: { y: 0.03, z: -0.67 } };
let dropPal = null;   // guns lying on the ground are drawn in the squad's own gun colours
const GLINT = {};     // a marksman's scope flash: colours made once the engine is up
function drawTarget(e, set) {   // a steel plate on a stand, hinged at its foot, folding back when it rings
  const X = e.x * XS, Z = e.y * XS, cp = VIEW.camera.position, yaw = Math.atan2(cp.x - X, cp.z - Z);
  TMP.q.setFromEuler(TMP.e.set(0, yaw, 0, 'YXZ'));
  TMP.m.compose(TMP.v.set(X, 0.14, Z), TMP.q, TMP.s.set(0.7, 0.28, 0.4)); set.metal.push(TMP.m, colorOf('#3f423e'));
  TMP.q.setFromEuler(TMP.e.set(-e.fold * 1.4, yaw, 0, 'YXZ'));
  const plate = e.down ? colorOf('#5e615b') : colorOf('#eef0e8');
  TMP.v2.set(0, 0.5, 0).applyQuaternion(TMP.q);
  TMP.m.compose(TMP.v.set(X + TMP.v2.x, 0.28 + TMP.v2.y, Z + TMP.v2.z), TMP.q, TMP.s.set(0.6, 0.86, 0.05)); VIEW.fx.flag.push(TMP.m, plate);
  TMP.v2.set(0, 1.1, 0).applyQuaternion(TMP.q);
  TMP.m.compose(TMP.v.set(X + TMP.v2.x, 0.28 + TMP.v2.y, Z + TMP.v2.z), TMP.q, TMP.s.set(0.32, 0.3, 0.05)); VIEW.fx.flag.push(TMP.m, plate);
  TMP.v2.set(0, 0.56, 0.035).applyQuaternion(TMP.q);
  TMP.m.compose(TMP.v.set(X + TMP.v2.x, 0.28 + TMP.v2.y, Z + TMP.v2.z), TMP.q, TMP.s.set(0.24, 0.24, 0.02)); VIEW.fx.flag.push(TMP.m, e.down ? colorOf('#7a4a30') : colorOf('#ff6b2c'));
  TMP.q.identity();
  decal(VIEW.fx.shadow, X, Z, 0.8, 0, WHITE, 0.02);
}
function drawEnemy(e, wdt, set) {
  if (e.target) { drawTarget(e, set); return; }
  const r = recFor(e), J = r.J;
  if (!r.pal) r.pal = enemyPalette(e.col, !!e.boss);
  const look = ENEMY_LOOK[e.type] || ENEMY_LOOK.grunt, now = performance.now();
  const X = e.x * XS, Z = e.y * XS, lift = (e.z || 0) * XS;
  trackMotion(r, e.x, e.y, wdt, (e.horse ? 3.4 : 2.2) * look[1]);
  const aimYaw = simYaw(e.aim != null ? e.aim : (e.face > 0 ? 0 : Math.PI));
  let rootT = aimYaw;
  r.dir = 1;
  if (!e.horse && r.moveW > 0.2 && r.moveYaw != null) {
    const back = Math.abs(angWrap(r.moveYaw - aimYaw)) > 1.9;   // spotters and gunners back away while facing you
    r.dir = back ? -1 : 1;
    rootT = back ? aimYaw : r.moveYaw;
  }
  r.yaw = r.yaw == null ? rootT : approachAng(r.yaw, rootT, e.boss ? 5 : 9, wdt);
  const twist = clamp(angWrap(aimYaw - r.yaw), -1, 1);
  if (e.flash > r.lastFlash + 0.01) r.flinV += 8;
  r.lastFlash = e.flash;
  const fired = e.ranged && e.atk > r.lastAtk + 0.05;
  if (fired) r.kickV += 5;
  r.lastAtk = e.atk;
  springStep(r, 'kick', 'kickV', wdt, 300, 20);
  springStep(r, 'flin', 'flinV', wdt, 180, 16);
  const still = r.moveW < 0.3;
  resetPose(J);
  if (e.horse) poseRide(J);
  else if (e.ranged && still) poseKneel(J);
  else poseRun(J, r.phase, r.moveW, !e.ranged && !(e.spotter && still));
  poseIdle(J, now / 1000 + r.seed, 1 - r.moveW);
  J[HJ.torso].rotation.x += e.boss ? -0.16 : e.type === 'brute' ? -0.3 : e.type === 'runner' ? -0.3 * r.moveW
    : e.spotter || e.ranged ? -0.04 : -0.2;
  J[HJ.torso].rotation.y += twist * 0.7;
  J[HJ.head].rotation.y += twist * 0.3;
  J[HJ.head].rotation.x += e.boss || e.type === 'brute' ? 0.2 : 0.1;
  if (e.ranged) { poseAim(J); if (e.relT > 0) poseReload(J, 1 - e.relT / 1.6); if (e.throwT > 0) poseSwing(J, 1 - e.throwT / 0.5); }   // an overhand lob
  else if (e.spotter && still) poseBinoculars(J);
  else if (e.atk > 0) poseSwing(J, 1 - e.atk / (e.boss ? 0.3 : 0.25));
  else {
    const t = nearestSoldier(e.x, e.y);
    const near = t && dist2(e.x, e.y, t.x, t.y) < (e.r + t.r + 40) ** 2;
    poseWindup(J, near ? clamp(1 - e.cd / 0.45, 0, 1) : 0);
  }
  if (e.boss) {   // the Warlord glows hotter as it breaks
    const heat = e.phase === 3 ? 0.45 + 0.35 * Math.sin(now / 110) : e.phase === 2 ? 0.18 : 0;
    r.pal.coat.copy(colorOf(e.col)).lerp(colorOf('#ff2a14'), heat);
  }
  smoothPose(r, J, wdt, e.boss ? 14 : 18);
  J[HJ.uArmR].rotation.x += r.kick; J[HJ.uArmL].rotation.x += r.kick * 0.6;
  J[HJ.torso].rotation.x += r.flin * 0.5 - r.kick * 0.2;
  J[HJ.head].rotation.x += r.flin * 0.4;
  if (e.horse) mountRider(r, X, Z, wdt, Math.max(r.moveW, 0.6), r.phase);
  else placeRoot(J, X, Z, r.yaw, 0, look[0], look[1], look[2], lift - (e.duckT > 0 ? 0.5 : 0));   // a marksman sinks behind its cover to duck
  const ert = e.ranged && e.relT > 0 ? 1 - e.relT / 1.6 : -1, ekind = e.type === 'gunner' ? 'pkm' : e.type === 'grunt' ? 'ak' : e.sniper ? 'sniper' : null;
  emitParts(J, ert >= 0.14 && ert < 0.62 ? splitMag(enemyParts(e.type)).body : enemyParts(e.type), r.pal, set, e.flash > 0);
  if ((ert >= 0.14 && ert < 0.24) || (ert >= 0.44 && ert < 0.62)) emitParts(J, magHandParts(), r.pal, set, e.flash > 0);
  if (ekind) gunLife(r, J, ekind, ert, fired, false, wdt);
  if (e.horse) emitParts(r.H, horseParts(true), r.pal, set, e.flash > 0);
  if (e.spotter && Math.sin(now / 180) > 0) {
    TMP.m.multiplyMatrices(J[HJ.torso].matrixWorld, TMP.m2.makeTranslation(0.1, 1.16, 0.26));
    TMP.m.scale(TMP.s.set(0.07, 0.07, 0.07));
    set.glow.push(TMP.m, colorOf('#ff3a2a'));
  }
  if (e.boss) {
    for (const ex of [-0.1, 0.1]) {
      TMP.m.multiplyMatrices(J[HJ.head].matrixWorld, TMP.m2.makeTranslation(ex, 0.14, -0.262));
      TMP.m.scale(TMP.s.set(0.08, 0.035, 0.02));
      set.glow.push(TMP.m, colorOf(e.phase === 3 ? '#ffe070' : '#ff3a1e'));
    }
  }
  if (e.sniper && e.glint > 0) {   // the scope catching the light while it lines up a shot: brightest when it's lined up on you
    const vg = LT.vg || (LT.vg = new THREE.Vector3());
    vg.set(0, 0.1, -0.22).applyMatrix4(J[HJ.gun].matrixWorld);
    const px = vg.distanceTo(VIEW.camera.position) * linePix(), you = e.tgt === soldiers[state.controlled], k = e.glint * (0.75 + 0.25 * Math.sin(now / 55));
    bloomAt(vg, Math.max(0.3, px * (you ? 28 : 16)) * (0.55 + 0.45 * e.glint), GLINT.wide || (GLINT.wide = colorOf('#bfe3ff')), (you ? 1.7 : 1.1) * k, now / 400);
    bloomAt(vg, Math.max(0.12, px * (you ? 10 : 6)), GLINT.core || (GLINT.core = colorOf('#ffffff')), 1.4 * k, 0.7);
  }
  decal(VIEW.fx.shadow, X, Z, (e.horse ? 1.9 : 0.95) * look[0], 0, WHITE, 0.02 + lift);
  if (!e.boss && e.maxHp >= 3 && e.hp < e.maxHp)
    hpBar(X, Z, 2.1 * look[1] + (e.horse ? 0.45 : 0) + lift, e.hp / e.maxHp, '#e0583c');
}
function drawBody(b, wdt, set) {   // a soldier's fall: the canned fall from the exact pose they died in, then the ragdoll
  const r = recFor(b), slot = b.slot || 0, J = r.J;
  if (!r.pal) r.pal = soldierPalette(slot, b.color, helmFor(slot, b.color));
  const parts = soldierParts(b.weapon || 'ar', true, isWrenCol(b.color), b);
  if (r.rag) {
    ragStep(r.rag, wdt);
    emitParts(r.rag.J, noGun(parts), r.pal, set);
    emitGround(gunOnly(parts), r.pal, b.gunX, b.gunY, b.gunYaw, 1, set);
    return;
  }
  if (!r.init) {
    const src = views.get(soldiers[slot]);
    if (src && src.init) { r.pose.set(src.pose); r.yaw = src.yaw; r.init = true; }
  }
  if (r.yaw == null) r.yaw = simYaw(b.aim != null ? b.aim : -Math.PI / 2);
  const t = clamp(1 - b.t / CFG.fallDur, 0, 1);
  resetPose(J);
  const pitch = poseDeath(J, t, b.style);
  smoothPose(r, J, wdt, 20);
  placeRoot(J, b.x * XS, b.y * XS, r.yaw, pitch, 1, 1, 1);
  if (ragHandoff(r, J, t, b, RAG_ONE, wdt)) { emitParts(r.rag.J, noGun(parts), r.pal, set); emitGround(gunOnly(parts), r.pal, b.gunX, b.gunY, b.gunYaw, 1, set); return; }
  const dropped = t > 0.42;
  emitParts(J, dropped ? noGun(parts) : parts, r.pal, set);
  if (dropped) emitGround(gunOnly(parts), r.pal, b.gunX, b.gunY, b.gunYaw, 1, set);
}
const RAG_ONE = [1, 1, 1];
function ragHandoff(r, J, t, d, sc, wdt) {   // at its moment in the canned fall, hand the body to a ragdoll; until then remember this frame's points for the motion
  if (!r.ragTried && t >= (d.blast ? RAG.handoffBlast : RAG.handoff)) {
    r.ragTried = true;   // one chance: with every slot busy, this death stays canned to the end
    r.rag = ragStart(J, r.ragPrev && r.ragPrevDt > 0 ? r.ragPrev : null, r.ragPrevDt, { hit: d.hit, kick: d.kick || 1.8, blast: !!d.blast, sc });
    if (r.rag) return true;
  }
  if (!r.ragTried) { ragSample(J, r.ragPrev || (r.ragPrev = new Float32Array(RAG_N * 3))); r.ragPrevDt = wdt; }
  return false;
}

// ---------- corpses: settled bodies are baked once into the static batch layer ----------
let corpseSig = '', staticDirty = true;
function corpseLook(c) {
  if (c.kind === 'soldier') {
    const slot = c.slot || 0;
    return { parts: soldierParts(c.weapon || 'ar', true, isWrenCol(c.col), c),
      pal: soldierPalette(slot, c.col, helmFor(slot, c.col)), sc: [1, 1, 1] };
  }
  const look = ENEMY_LOOK[c.type] || ENEMY_LOOK.grunt;
  return { parts: enemyParts(c.type || 'grunt'), pal: enemyPalette(c.col), sc: look };
}
function poseCorpse(J, c, t) {
  const lk = corpseLook(c);
  resetPose(J);
  const pitch = poseDeath(J, t, c.style);
  placeRoot(J, c.x * XS, c.y * XS, corpseYaw(c), pitch, lk.sc[0], lk.sc[1], lk.sc[2], (c.z || 0) * XS);
  return lk;
}
function bakeCorpse(c, rag) {   // into the static layer: the pose the ragdoll came to rest in, or the canned fall's last
  const cache = [];
  let lk;
  if (rag) {
    lk = corpseLook(c);
    emitParts(rag.J, noGun(lk.parts), lk.pal, null, false, cache);
    c._restX = rag.p[0] / XS; c._restY = rag.p[2] / XS; c._restZ = rag.floor / XS;   // the blood pool goes where it lies
    ragRelease(rag);
  } else {
    const J = takeSkeleton('humanoid');
    lk = poseCorpse(J, c, 1);
    emitParts(J, noGun(lk.parts), lk.pal, null, false, cache);
    rigPool.humanoid.push(J);
  }
  if (!c.noGun) emitGround(gunOnly(lk.parts), lk.pal, c.gunX, c.gunY, c.gunYaw, lk.sc[0], null, cache, (c.z || 0) * XS);
  return cache;
}
function syncCorpses(wdt, set) {
  const first = corpses[0], lastC = corpses[corpses.length - 1];
  if (first && !first._vid) first._vid = vidSeq++;
  if (lastC && !lastC._vid) lastC._vid = vidSeq++;
  const sig = corpses.length + ':' + (first ? first._vid : 0) + ':' + (lastC ? lastC._vid : 0);
  if (sig !== corpseSig) { corpseSig = sig; staticDirty = true; }
  for (const c of corpses) {
    if (c._cache) continue;
    const src = c.src && views.get(c.src);   // the living view (or the falling body) this corpse continues from
    c.src = null;
    if (c.kind === 'soldier') {
      if (src && src.yaw != null) c.yawBake = src.yaw;
      if (src && src.rag) { recFor(c).rag = src.rag; src.rag = null; }   // still coming to rest: the ragdoll goes on as the corpse
      if (!views.get(c) || !views.get(c).rag) { c._cache = bakeCorpse(c); staticDirty = true; continue; }
    }
    const r = recFor(c), lk = corpseLook(c), lift = (c.z || 0) * XS;
    if (r.rag) {   // a ragdoll: until it lies still, then its pose is the corpse
      ragStep(r.rag, wdt);
      if (r.rag.done) { c._cache = bakeCorpse(c, r.rag); r.rag = null; staticDirty = true; continue; }
      emitParts(r.rag.J, noGun(lk.parts), lk.pal, set);
      if (!c.noGun) emitGround(gunOnly(lk.parts), lk.pal, c.gunX, c.gunY, c.gunYaw, lk.sc[0], set, null, lift);
      continue;
    }
    if (!r.init && src && src.init) { r.pose.set(src.pose); r.init = true; c.yawBake = src.yaw; }
    c._fall = (c._fall || 0) + wdt;
    if (c._fall >= CFG.enemyFallDur) { c._cache = bakeCorpse(c); staticDirty = true; continue; }
    const t = c._fall / CFG.enemyFallDur;
    resetPose(r.J);
    const pitch = poseDeath(r.J, t, c.style);
    smoothPose(r, r.J, wdt, 20);
    placeRoot(r.J, c.x * XS, c.y * XS, corpseYaw(c), pitch, lk.sc[0], lk.sc[1], lk.sc[2], lift);
    if (ragHandoff(r, r.J, t, c, lk.sc, wdt)) {
      emitParts(r.rag.J, noGun(lk.parts), lk.pal, set);
      if (!c.noGun) emitGround(gunOnly(lk.parts), lk.pal, c.gunX, c.gunY, c.gunYaw, lk.sc[0], set, null, lift);
      continue;
    }
    const dropped = t > 0.42;
    emitParts(r.J, dropped ? noGun(lk.parts) : lk.parts, lk.pal, set);
    if (dropped && !c.noGun) emitGround(gunOnly(lk.parts), lk.pal, c.gunX, c.gunY, c.gunYaw, lk.sc[0], set, null, lift);   // a gun that can be taken is drawn as a drop instead
  }
  if (staticDirty) rebuildStatic();
}
const corpseYaw = c => c.yawBake != null ? c.yawBake
  : simYaw(c.aim != null ? c.aim : -Math.PI / 2) + (c.kind === 'soldier' ? 0 : (c.rot || 0));
function rebuildStatic() {
  staticDirty = false;
  const S = VIEW.stat, stain = VIEW.fx.stain;
  batchesDo(S, b => b.begin());
  stain.begin();
  for (const c of corpses) {
    if (!c._cache) continue;
    const k = c._cache;
    for (let i = 0; i < k.length; i += 3) S[k[i]].push(k[i + 1], k[i + 2]);
    decal(stain, (c._restX != null ? c._restX : c.x) * XS, (c._restY != null ? c._restY : c.y) * XS, 1.5 * (c.sc || 1), c.rot || 0, colorOf('#5c1810'), 0.025 + (c._restX != null ? c._restZ : c.z || 0) * XS);
  }
  batchesDo(S, b => b.end());
  stain.end();
}

// ---------- effects ----------
function decal(batch, x, z, size, rot, color, y = 0.03) {   // flat quad on the ground; own quaternion so callers' TMP.q survives
  TMP.e.set(-Math.PI / 2, rot, 0, 'YXZ');
  TMP.qd.setFromEuler(TMP.e);
  TMP.md.compose(TMP.vd.set(x, y, z), TMP.qd, TMP.sd.set(size, size, 1));
  batch.push(TMP.md, color);
}
function buildFxBatches() {
  const T = VIEW.tex, plane = new THREE.PlaneGeometry(1, 1);
  const decalMat = (map, opts = {}) => new THREE.MeshBasicMaterial(Object.assign({
    map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }, opts));
  const add = { blending: THREE.AdditiveBlending };
  const box = new THREE.BoxGeometry(1, 1, 1);
  VIEW.fx = {
    shadow: new Batch(plane, decalMat(T.blob), 256, 2),
    stain: new Batch(plane, decalMat(T.glow, { opacity: 0.7 }), 400, 1),
    crater: new Batch(plane, decalMat(T.crater), 96, 1),
    splat: new Batch(plane, decalMat(T.splat), SPLAT_CAP, 1),
    mist: new Batch(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false }), 48, 5),   // blood mist: ordinary blending, dark on a bright day
    ring: new Batch(plane, decalMat(T.ring, { opacity: 0.75 }), 48, 3),
    fireGlow: new Batch(plane, decalMat(T.glow, add), 64, 3),
    tracer: new Batch(box, new THREE.MeshBasicMaterial(), 400),
    tracerGlow: new Batch(box, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending }), 400, 4),
    spark: new Batch(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshBasicMaterial(), 900),
    flash: new Batch(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }), 220, 5),
    flame: new Batch(VIEW.kit.cone, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }), 240, 5),
    debris: new Batch(box, new THREE.MeshLambertMaterial(), 140),   // pieces knocked off cover, tumbling: flat lit colour, like the flags
    mine: new Batch(VIEW.kit.cyl, VIEW.mats.lit, 32),
    wood: new Batch(VIEW.kit.wood, VIEW.mats.lit, 64),
    hpBack: new Batch(plane, new THREE.MeshBasicMaterial({ fog: false, depthWrite: false }), 64, 6),
    hpFill: new Batch(plane, new THREE.MeshBasicMaterial({ fog: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }), 64, 7),
    arrow: new Batch(new THREE.ConeGeometry(0.5, 1, 3), new THREE.MeshBasicMaterial({ fog: false, depthTest: false }), 4, 11),
    bloom: new Batch(plane, new THREE.MeshBasicMaterial({ map: T.bloom, transparent: true, opacity: 0.62, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }), 96, 6),
    brass: new Batch(VIEW.kit.cyl, VIEW.mats.shaded, 200),
    objRing: new Batch(plane, decalMat(null, { opacity: 0.55 }), 160, 1),
    flag: new Batch(box, new THREE.MeshLambertMaterial(), 40),
  };
}
const FX_FRAME = ['shadow', 'crater', 'splat', 'mist', 'ring', 'fireGlow', 'tracer', 'tracerGlow', 'spark', 'flash', 'flame', 'debris', 'mine', 'wood', 'hpBack', 'hpFill', 'arrow', 'bloom', 'brass', 'objRing', 'flag'];
let TRACER_COLS = null;   // tracer palette, built once the engine is up
let BLOOD_COL = null;
const hash2 = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
function muzzleWorld(s, out) {   // where the drawn weapon's barrel actually ends, this frame
  if (fpvActive() && s.slot === state.controlled && FPV.muz) { out.copy(FPV.muz); return true; }
  const r = views.get(s);
  if (!r || !r.J || !r.J[HJ.gun]) return false;
  const mlen = (s.pistol ? SIDEARM.len : WEAPONS[s.weapon].len) * 0.032;
  out.set(0, 0.02, -mlen * 0.78).applyMatrix4(r.J[HJ.gun].matrixWorld);
  return true;
}
function drawFx() {
  const F = VIEW.fx, now = performance.now();
  if (!TMP.mz) { TMP.mz = TMP.v.clone(); TMP.bp = TMP.v.clone(); TMP.dir = TMP.v.clone(); TMP.zax = TMP.v.clone().set(0, 0, 1); }
  const ctl = soldiers[state.controlled];
  // Rounds. Every round is visible as a short streak with a burning head: long enough to read as a
  // bullet in flight, short enough never to be a laser. Its thickness is measured in lines of the render
  // target (core 1.6, glow 5, head 3.4-5), so it holds the same weight on screen at any distance —
  // anything thinner than a line is simply dropped by the N64 dither. Tracer-loaded rounds (every third
  // squad round, every other enemy round, every .50 and rocket) burn brighter and a little longer.
  // Your own rounds start at the barrel you can see, and a streak never reaches back past the muzzle.
  const TR = TRACER_COLS || (TRACER_COLS = {
    core: colorOf('#fff4d8'), hcore: colorOf('#ffd9c6'), rcore: colorOf('#fff0c0'),
    soft: colorOf('#e6d2ac'), hsoft: colorOf('#e8b29a'),
    glow: colorOf('#ffab40'), hglow: colorOf('#ff5a36'), rglow: colorOf('#ffc070'),
    head: colorOf('#ffd48a'), hhead: colorOf('#ff8a60'), dimhead: colorOf('#b98a4a'), hdimhead: colorOf('#b0604a') });
  const camPos = VIEW.camera.position;
  const lines = (N64.target && N64.target.height) || N64.lines;
  const PIX = 2 * Math.tan(VIEW.camera.fov * Math.PI / 360) / lines;   // metres per render line, per metre of distance
  for (const b of bullets) {
    const sp = Math.hypot(b.vx, b.vy, b.vz || 0) || 1, rocket = b.wkey === 'rocket', sniper = b.wkey === 'sniper';
    const hot = b.tracer || rocket, y = b.ballistic ? b.z * XS : b.hostile ? 1.0 : 1.08;
    TMP.bp.set(b.x * XS, y, b.y * XS);   // the head of the round
    const perFrame = sp * XS / 60;       // metres it covers in one frame
    let tail = rocket ? 0.55 : sniper ? 3.0
      : clamp(perFrame * 1.6, b.hostile ? 1.3 : 1.5, b.hostile ? 2.1 : 2.8) * (hot ? 1.1 : 0.9);
    if (!b.hostile && ctl && ctl.alive && b.slot === state.controlled && b.age < 0.11 && muzzleWorld(ctl, TMP.mz)) {
      TMP.dir.subVectors(TMP.bp, TMP.mz);
      const dl = TMP.dir.length();
      if (dl < 0.03) continue;
      TMP.dir.divideScalar(dl);
      tail = Math.min(tail, dl);
    } else TMP.dir.set(b.vx / sp, (b.vz || 0) / sp, b.vy / sp);
    TMP.q.setFromUnitVectors(TMP.zax, TMP.dir);
    // Sized in render lines, not metres: the same on screen at 1 m or 40 m. A fixed size in metres is a thick
    // bar right in front of your eye and nothing at all down the street.
    const px = Math.min(TMP.bp.distanceTo(camPos), TMP.v.copy(TMP.bp).addScaledVector(TMP.dir, -tail).distanceTo(camPos)) * PIX;   // one render line at the streak's nearer end: the same at range, never a wedge out of your own barrel
    const coreW = px * (rocket ? 3 : sniper ? 2 : 1.6);
    const glowW = px * (rocket ? 7 : 5);
    const core = rocket ? TR.rcore : b.hostile ? (hot ? TR.hcore : TR.hsoft) : (hot ? TR.core : TR.soft);
    const glow = rocket ? TR.rglow : b.hostile ? TR.hglow : TR.glow;
    TMP.v.copy(TMP.bp).addScaledVector(TMP.dir, -tail * 0.275);   // the bright core, right behind the head
    TMP.m.compose(TMP.v, TMP.q, TMP.s.set(coreW, coreW, tail * 0.55)); F.tracer.push(TMP.m, core);
    TMP.v.copy(TMP.bp).addScaledVector(TMP.dir, -tail * 0.5);     // the glow along the whole streak
    if (Q.glow) { TMP.m.compose(TMP.v, TMP.q, TMP.s.set(glowW, glowW, tail)); F.tracerGlow.push(TMP.m, glow); }
    const headW = px * (rocket ? 7 : hot ? 5 : 3.4);   // the head itself burns
    TMP.m.compose(TMP.bp, TMP.q, TMP.s.set(headW, headW, headW));
    F.flash.push(TMP.m, hot ? (b.hostile ? TR.hhead : TR.head) : (b.hostile ? TR.hdimhead : TR.dimhead));
  }
  TMP.q.identity();
  for (let pi = Math.max(0, particles.length - Q.particles); pi < particles.length; pi++) {   // the newest, up to the preset's cap
    const p = particles[pi], fr = clamp(p.life / p.max, 0, 1);
    TMP.v.set(p.x * XS, Math.max(0.02, p.z * ZS), p.y * XS);
    if (p.kind === 'mist') {   // a puff that opens out and is gone
      const sz = p.r * XS * 2 * (0.55 + 0.9 * (1 - fr));
      TMP.m.compose(TMP.v, TMP.q, TMP.s.set(sz, sz * 0.85, sz));
      F.mist.push(TMP.m, colorOf(p.col));
    } else if (p.r >= 20) {
      const sz = p.r * XS * 2 * (1.25 - 0.55 * fr);
      TMP.m.compose(TMP.v, TMP.q, TMP.s.set(sz, sz * 0.7, sz));
      F.flash.push(TMP.m, colorOf(p.col));
    } else {
      const sz = Math.max(0.025, p.r * 0.045 * Math.sqrt(fr));
      TMP.m.compose(TMP.v, TMP.q, TMP.s.set(sz, sz, sz));
      F.spark.push(TMP.m, colorOf(p.col));
    }
  }
  for (const c of craters) decal(F.crater, c.x * XS, c.y * XS, c.r * XS * 2.2, hash2(c.x, c.y) * TAU, WHITE, 0.022);
  for (const sp of splats) decal(F.splat, sp.x * XS, sp.y * XS, sp.s * (0.35 + 0.65 * Math.min(1, sp.t * 4)), sp.rot, BLOOD_COL || (BLOOD_COL = colorOf('#8c1a12')), 0.024);
  for (const sh of shells) drawIncoming(sh, now);
  TMP.q.identity();
  for (const f of fires) {
    const X = f.x * XS, Z = f.y * XS, fl = 0.8 + Math.sin(now / 70 + f.x) * 0.2;
    decal(F.fireGlow, X, Z, f.r * XS * 3 * fl, 0, colorOf('#ff7a2a'), 0.05);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + f.x, rr0 = f.r * XS * 0.45;
      const h = (0.7 + 0.4 * Math.sin(now / 90 + k * 1.7 + f.y)) * Math.min(1, f.t);
      TMP.m.compose(TMP.v.set(X + Math.cos(a) * rr0, h * 0.5, Z + Math.sin(a) * rr0), TMP.q, TMP.s.set(0.45, h, 0.45));
      F.flame.push(TMP.m, colorOf(k === 1 ? '#ffd35a' : '#ff6a1e'));
    }
  }
  for (const g of grenades) {   // a frag in flight or rolling to a stop: olive body, steel spoon, its shadow on the ground
    const X = g.x * XS, Y = g.z * XS, Z = g.y * XS;
    TMP.q.setFromEuler(TMP.e.set(g.spin, g.spin * 0.6, 0.4));
    TMP.m.compose(TMP.v.set(X, Y + 0.06, Z), TMP.q, TMP.s.set(0.1, 0.12, 0.1));
    F.mine.push(TMP.m, colorOf('#4e5636'));
    TMP.v2.set(0, 0.07, 0.035).applyQuaternion(TMP.q);
    TMP.m.compose(TMP.v.set(X + TMP.v2.x, Y + 0.06 + TMP.v2.y, Z + TMP.v2.z), TMP.q, TMP.s.set(0.03, 0.05, 0.02));
    F.mine.push(TMP.m, colorOf('#9a9c96'));
    TMP.q.identity();
    decal(F.shadow, X, Z, 0.24, 0, WHITE, 0.02);
  }
  for (const m of mines) {
    TMP.m.compose(TMP.v.set(m.x * XS, 0.04, m.y * XS), TMP.q, TMP.s.set(0.34, 0.08, 0.34));
    F.mine.push(TMP.m, colorOf('#4a4c44'));
    if (Math.sin(now / 300 + m.blink) > 0.4) {
      TMP.m.compose(TMP.v.set(m.x * XS, 0.1, m.y * XS), TMP.q, TMP.s.set(0.06, 0.06, 0.06));
      F.spark.push(TMP.m, colorOf('#ff3a2a'));
    }
  }
  const D = VIEW.dyn;
  for (const o of state.objs || []) {   // an objective: a pole, a cloth in the owner's colour that climbs as it is taken, its ring on the ground
    const X = o.x * XS, Z = o.y * XS, col = colorOf(o.owner === 'p' ? '#4aa6f0' : o.owner === 'e' ? '#cf3a2b' : '#d9dbe4');
    TMP.q.identity();
    TMP.m.compose(TMP.v.set(X, 1.8, Z), TMP.q, TMP.s.set(0.07, 3.6, 0.07)); D.metal.push(TMP.m, colorOf('#8d8f8b'));
    TMP.m.compose(TMP.v.set(X, 3.62, Z), TMP.q, TMP.s.set(0.14, 0.08, 0.14)); D.metal.push(TMP.m, colorOf('#b8b09a'));
    TMP.q.setFromAxisAngle(TMP.up, Math.sin(now / 520 + o.x) * 0.3 + o.y * 0.001);
    TMP.v2.set(0.5, 0, 0).applyQuaternion(TMP.q);
    const h = 1.1 + 2.2 * Math.abs(o.cap);
    TMP.m.compose(TMP.v.set(X + TMP.v2.x, h, Z + TMP.v2.z), TMP.q, TMP.s.set(0.96, 0.58, 0.03)); F.flag.push(TMP.m, col);
    TMP.q.identity();
    const R = o.r * XS, segs = 40, spin = now / 12000;   // the ring: a dashed line on the ground, slowly turning
    for (let k = 0; k < segs; k += 2) {
      const a = (k + 0.5) / segs * TAU + spin;
      TMP.e.set(-Math.PI / 2, -a - Math.PI / 2, 0, 'YXZ');
      TMP.qd.setFromEuler(TMP.e);
      TMP.md.compose(TMP.vd.set(X + Math.cos(a) * R, 0.04, Z + Math.sin(a) * R), TMP.qd, TMP.sd.set(TAU * R / segs * 0.9, 0.16, 1));
      F.objRing.push(TMP.md, col);
    }
  }
  if (state.training) {   // the range: the marker this step wants you at, and the three signs to look at
    const m = trainingMarker(), now2 = now / 1000;
    if (m) {
      const X = m.x * XS, Z = m.y * XS, R = m.r * XS;
      for (let k = 0; k < 24; k += 2) {
        const a = (k + 0.5) / 24 * TAU + now2 * 0.6;
        TMP.e.set(-Math.PI / 2, -a - Math.PI / 2, 0, 'YXZ'); TMP.qd.setFromEuler(TMP.e);
        TMP.md.compose(TMP.vd.set(X + Math.cos(a) * R, 0.05, Z + Math.sin(a) * R), TMP.qd, TMP.sd.set(TAU * R / 24 * 0.9, 0.14, 1));
        F.objRing.push(TMP.md, colorOf('#ff6b2c'));
      }
      TMP.m.compose(TMP.v.set(X, 1.6 + Math.sin(now2 * 3) * 0.12, Z), TMP.q, TMP.s.set(0.22, 0.22, 0.22)); F.spark.push(TMP.m, colorOf('#ff6b2c'));
    }
    for (const [sx, sy] of RANGE.signs) {
      const X = sx * PX * XS, Z = sy * PX * XS;
      TMP.m.compose(TMP.v.set(X, 0.9, Z), TMP.q, TMP.s.set(0.08, 1.8, 0.08)); D.metal.push(TMP.m, colorOf('#5a5c58'));
      TMP.m.compose(TMP.v.set(X, 1.95, Z), TMP.q, TMP.s.set(0.9, 0.6, 0.06)); F.flag.push(TMP.m, colorOf('#e8e2cf'));
    }
  }
  const me = soldiers[state.controlled], dry = me && me.alive && me.pistol;
  for (const d of weaponDrops) {   // a gun on the ground, blinking as it times out; ringed when it's on offer, or when you're dry
    if (d.t < 5 && Math.sin(now / 90) < 0) continue;
    emitGround(gunParts(d.key, d), dropPal || (dropPal = soldierPalette(0, '#a09a7a', '#5a5e4a')), d.x, d.y, d.yaw, 1, D);
    if (d === state.pickDrop || dry) decal(F.ring, d.x * XS, d.y * XS, 0.8 + Math.sin(now / 240) * 0.07, now / 700, colorOf(d === state.pickDrop ? '#ffffff' : '#ff6b2c'), 0.03);
  }
  for (const p of pickups) {   // a dropped magazine, blinking as it times out
    if (p.t < 5 && Math.sin(now / 90) < 0) continue;
    const X = p.x * XS, Z = p.y * XS, bob = 0.12 + Math.sin(now / 320 + p.x) * 0.03;
    TMP.q.setFromAxisAngle(TMP.up, now / 900 + p.x);
    TMP.m.compose(TMP.v.set(X, bob, Z), TMP.q, TMP.s.set(0.34, 0.2, 0.24));
    D.crate.push(TMP.m, colorOf('#6e7250'));
    TMP.m.compose(TMP.v.set(X, bob + 0.11, Z), TMP.q, TMP.s.set(0.3, 0.04, 0.2));
    D.crate.push(TMP.m, colorOf('#d8c43a'));
    decal(F.ring, X, Z, 0.9 + Math.sin(now / 260) * 0.08, now / 700, colorOf('#e8e04a'), 0.03);
  }
  TMP.q.identity();
  if (state.flyby) {   // strike jet crossing the target line
    const p = (state.frontTime - state.flyby.t0) / 1.8;
    if (p >= 0 && p <= 1) drawPlane(state.flyby.x * XS - 50 + p * 100, 19 - Math.sin(p * Math.PI) * 3, state.flyby.y * XS - 2);
  }
  const boss = state.bossRef;
  if (boss && boss.phase === 3)
    decal(F.ring, boss.x * XS, boss.y * XS, 3.4 + Math.sin(now / 110) * 0.35, now / 700, colorOf('#ff3a1e'), 0.05);
  TMP.q.identity();
}

