// ---------- camera: intimate chase cam, death camera, fail orbit ----------
const CAM3 = {
  land: { dist: 4.2, height: 2.0, side: 0.55, fov: 55, ahead: 5, lookH: 1.1 },
  port: { dist: 5.6, height: 2.6, side: 0, fov: 72, ahead: 5, lookH: 1.1 },
};
const camView = { eye: null, look: null, oEye: null, oLook: null, cEye: null, cLook: null, have: false, orbit: 0, orbitBase: 0, bossSeen: null, bossT: 0, dieFrom: null, dieLook: null };
// The Warlord's hero shot is a cutscene: while it plays the camera is not your eyes, so nothing of yours is drawn over it —
// no gun, no crosshair or scope, no HUD — the sights do not zoom it, and your trigger waits (you cannot see what it would hit).
const bossCine = () => camView.bossT > 0;
function chasePose(sx, sy, yaw, pr, eye, look, dist = pr.dist) {
  const X = sx * XS, Z = sy * XS, fx = Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = Math.sin(yaw);
  eye.set(X - fx * dist + rx * pr.side, pr.height + (dist - pr.dist) * 0.3, Z - fz * dist + rz * pr.side);
  look.set(X + fx * pr.ahead, pr.lookH, Z + fz * pr.ahead);
}
function camAvoid(f, eye) {   // pull the chase camera in front of walls instead of through them; lift it over cover
  const ex = eye.x / XS, ey = eye.z / XS;
  let t = 1;
  for (const b of buildings) { const e = segEnter(b, f.x, f.y, ex, ey, 12); if (e < t) t = e; }
  if (t < 1) {
    const k = Math.max(0.02, t - 0.04);   // no room behind: hover just in front of the wall, high over the shoulder
    eye.x = (f.x + (ex - f.x) * k) * XS; eye.z = (f.y + (ey - f.y) * k) * XS; eye.y += (1 - k) * 2.2;
  }
  for (const ob of obstacles) if (coverPoint(ob, eye.x / XS, eye.z / XS, CP).d < 24) { eye.y += 0.9; break; }
}
function updateCamera3(dt) {
  const C = camView, pr = innerWidth < innerHeight ? CAM3.port : CAM3.land, cam3 = VIEW.camera;
  cam.shake = Math.max(0, cam.shake - dt * 26);
  cam.punch = Math.max(0, cam.punch - dt * 0.35);
  const reloading = soldiers[state.controlled] && soldiers[state.controlled].reloadT > 0;   // the sights come down while you reload, and back up after
  FPV.adsK = approach(FPV.adsK, aim.ads && !reloading ? 1 : 0, adsRate(), dt);   // sights come up at the optic's own pace, in both views
  const hs = soldiers[state.controlled];
  FPV.sprintK = approach(FPV.sprintK || 0, hs && hs.alive && hs.sprinting && state.mode === 'play' ? 1 : 0, 6, dt);   // sprinting: the view widens, the gun drops
  steerFromCursor(dt);
  aim.lookDx *= Math.exp(-dt * 8);   // the viewmodel's sway settles back to centre once you stop turning
  {   // recoil recovery: the muzzle drifts back to where you were pointing once you stop firing
    const rate = dt * (aim.fire ? 0.35 : 1.8);
    if (aim.settle > 0) { const d = Math.min(aim.settle, rate); aim.pitch -= d; aim.settle -= d; }
    if (aim.settleY) {   // without this the horizontal kick is a one-way walk off the target
      const sgn = Math.sign(aim.settleY), d = Math.min(Math.abs(aim.settleY), rate * 0.5);
      aim.yaw = angWrap(aim.yaw - sgn * d); aim.settleY -= sgn * d;
    }
  }
  const boss = state.bossRef;
  if (boss && boss !== C.bossSeen && state.mode === 'play') {   // waits out a death camera
    C.bossSeen = boss; C.bossT = CFG.bossIntro; showTitleCard(boss);
    aim.fire = false; aim.take = false;   // a thumb resting on a button that is about to vanish must not come back firing
  }
  const ctl = soldiers[state.controlled];
  if (state.mode === 'dying' && ctl) {   // watch them go down: ease around and low over the body
    if (C.bossT > 0) { C.bossT = 0; hideTitleCard(); }
    if (!C.dieFrom) { C.dieFrom = C.eye.clone(); C.dieLook = C.look.clone(); }
    const t = clamp(state.dyingT / CFG.deathCam, 0, 1), bx = ctl.x * XS, bz = ctl.y * XS, oa = C.orbitBase + 0.35;
    C.oEye.set(bx - Math.sin(oa) * 3.2, 0.95, bz + Math.cos(oa) * 3.2);
    C.oLook.set(bx, 0.45, bz);
    C.eye.lerpVectors(C.dieFrom, C.oEye, smooth(0, 1, t));
    C.eye.y += Math.sin(Math.PI * t) * 0.5;
    C.look.lerpVectors(C.dieLook, C.oLook, smooth(0, 0.45, t));
    camAvoid(ctl, C.eye);   // never watch the death through a wall
    C.have = true;
  } else if (state.mode === 'spectate' && ctl) {
    C.orbit += dt * 0.45;
    const bx = ctl.x * XS, bz = ctl.y * XS, R = 4.6;
    C.eye.set(bx - Math.sin(C.orbit) * R, 1.1 + state.spectateT * 1.6, bz + Math.cos(C.orbit) * R);
    C.look.set(bx, 0.4, bz);
    C.have = true;
  } else if (C.bossT > 0 && boss && state.mode === 'play') {
    // hero shot: low and in front of the Warlord while its title card plays
    C.bossT -= dt;
    const t = 1 - C.bossT / CFG.bossIntro, bx = boss.x * XS, bz = boss.y * XS;
    C.cEye.set(bx + Math.sin(t * 0.8) * 1.6, 0.9 + t * 0.4, bz + 7.2 - t * 1.4);
    C.cLook.set(bx, 2.7, bz);
    const k = 1 - Math.exp(-9 * dt);
    C.eye.lerp(C.cEye, k);
    C.look.lerp(C.cLook, k);
    C.have = true;
    if (C.bossT <= 0) hideTitleCard();
  } else if (fpvActive()) {   // first person: the camera is the soldier's eyes
    if (C.bossT > 0) { C.bossT = 0; hideTitleCard(); }
    C.dieFrom = null;
    const s = soldiers[state.controlled];
    cam.yaw = aim.yaw;
    const want = 1.62;   // standing eye height
    FPV.eyeY = FPV.eyeY == null ? want : approach(FPV.eyeY, want, 12, dt);
    const ey = FPV.eyeY + Math.sin(FPV.bobP) * 0.018;
    const fx = Math.sin(aim.yaw), fz = -Math.cos(aim.yaw);
    C.eye.set(s.x * XS, ey, s.y * XS);
    C.look.set(s.x * XS + fx * 10, ey + aim.pitch * 10, s.y * XS + fz * 10);
    C.have = true;
  } else {
    if (C.bossT > 0) { C.bossT = 0; hideTitleCard(); }
    C.dieFrom = null;
    const follow = camTarget();
    if (follow) {
      cam.yaw = aim.yaw;   // you steer the camera yourself
      chasePose(follow.x, follow.y, cam.yaw, pr, C.cEye, C.cLook);
      C.cLook.y += aim.pitch * 4.5;
      camAvoid(follow, C.cEye);
      if (!C.have || cam.snap) { C.eye.copy(C.cEye); C.look.copy(C.cLook); C.have = true; cam.snap = false; }
      else { C.eye.lerp(C.cEye, 1 - Math.exp(-7 * dt)); C.look.lerp(C.cLook, 1 - Math.exp(-9 * dt)); }
    }
    C.orbitBase = cam.yaw;
  }
  cam3.position.copy(C.eye);
  if (cam.shake > 0) cam3.position.add(TMP.v.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(cam.shake * 0.012));
  cam3.lookAt(C.look);
  if (cam.shake > 0) cam3.rotateZ(rand(-1, 1) * cam.shake * 0.0025);
  const base = (fpvActive() && !bossCine() ? 68 : pr.fov) + (meta.opts.fovAdd || 0) + 8 * FPV.sprintK;
  const adsFov = 2 * Math.atan(Math.tan(base * Math.PI / 360) / heroZoom()) * 180 / Math.PI;   // a 4x shows a quarter of the view
  const fov = lerp(base, adsFov, bossCine() ? 0 : FPV.adsK) * (1 - cam.punch * 1.5) * (state.mode === 'dying' ? 0.88 : 1);
  if (Math.abs(cam3.fov - fov) > 0.01) { cam3.fov = fov; cam3.updateProjectionMatrix(); }
  document.body.classList.toggle('cine', state.mode === 'dying' || state.mode === 'spectate' || C.bossT > 0);
  document.body.classList.toggle('boss-cine', C.bossT > 0);
  document.body.classList.toggle('dying', state.mode === 'dying');
}

// ---------- screen overlays: floating text, joystick, threat arrows ----------
function updateSightOverlay() {   // what you see through an optic once you are settled in behind it
  const so = OV.sight || (OV.sight = $('sight'));
  if (!so) return;
  const hero = soldiers[state.controlled], sg = heroSight();
  const on = fpvActive() && !bossCine() && hero && hero.alive && !hero.pistol && sg.over && FPV.adsK > 0.7 && state.mode === 'play';
  if (!on) { if (so.style.display !== 'none') so.style.display = 'none'; return; }
  const ads = adsInfo(hero.weapon, hero);
  let r = innerHeight * 0.46;
  if (ads.r) {   // the window's radius on screen: the eyepiece ring's inner radius, seen from its eye relief through the current FOV
    const px = (ads.r * VM_S / ads.relief) / Math.tan(VIEW.camera.fov * Math.PI / 360) * innerHeight / 2;
    r = Math.min(px * 0.95, r);
  }
  so.style.display = 'block';
  so.style.opacity = smooth(0.7, sg.over === 'dot' ? 0.97 : 0.85, FPV.adsK).toFixed(2);   // a scope's blackout is solid by the time the tube would show
  if (so.className !== sg.over) so.className = sg.over;
  so.style.setProperty('--cx', (innerWidth / 2).toFixed(1) + 'px');    // the exact middle, where the view's own axis is: rounding an odd size puts the cross half a pixel off it
  so.style.setProperty('--cy', (innerHeight / 2).toFixed(1) + 'px');
  so.style.setProperty('--r', r.toFixed(0) + 'px');
}
const OV = { floaters: [], threats: [], fpsOn: false, fpsT: 0, frames: 0, reticle: null, rtOn: false, rtX: 0, rtY: 0, gap: 0, dmg: [], mapT: 0, hurt: 0 };
const SCR = { x: 0, y: 0 };
function buildOverlays() {
  const fl = document.getElementById('floaters'), th = document.getElementById('threats');
  for (let i = 0; i < 16; i++) { const d = document.createElement('div'); d.className = 'floater'; fl.appendChild(d); OV.floaters.push(d); }
  for (let i = 0; i < 4; i++) { const d = document.createElement('div'); d.className = 'threat'; th.appendChild(d); OV.threats.push(d); }
  OV.reticle = document.getElementById('reticle');
  OV.dmg = [...document.querySelectorAll('#dmgdir i')];
  OV.fpsOn = /[?&]fps=1/.test(location.search);
}
function toScreen(x, y, z) {   // sim coords → CSS pixels; false when behind the camera
  TMP.v2.set(x * XS, z * ZS, y * XS).project(VIEW.camera);
  if (TMP.v2.z > 1) return false;
  SCR.x = (TMP.v2.x + 1) / 2 * innerWidth;
  SCR.y = (1 - TMP.v2.y) / 2 * innerHeight;
  return true;
}
const hideEl = d => { if (d.style.display !== 'none') d.style.display = 'none'; };
function updateOverlays(dt) {
  for (let i = 0; i < OV.floaters.length; i++) {
    const d = OV.floaters[i], f = floaters[i];
    if (!f || !toScreen(f.x, f.y, f.z)) { hideEl(d); continue; }
    d.style.display = 'block';
    if (d.textContent !== f.txt) d.textContent = f.txt;
    d.style.transform = `translate3d(${SCR.x.toFixed(1)}px,${SCR.y.toFixed(1)}px,0) translate(-50%,-50%)`;
    d.style.opacity = clamp(f.life / 0.9, 0, 1);
  }
  for (let i = DMGDIR.length - 1; i >= 0; i--) { DMGDIR[i].t -= dt; if (DMGDIR[i].t <= 0) DMGDIR.splice(i, 1); }
  OV.dmg.forEach((d, i) => {   // arcs pointing back at whoever hit you
    const m = DMGDIR[i];
    if (!m) { hideEl(d); return; }
    d.style.display = 'block';
    d.style.transform = `rotate(${(Math.atan2(m.x, -m.y) - cam.yaw).toFixed(3)}rad)`;
    d.style.opacity = (clamp(m.t / 1.3, 0, 1) * 0.9).toFixed(2);
  });
  const rt = OV.reticle, hero = soldiers[state.controlled];
  const aimAt = hero && hero.alive && state.mode === 'play' ? state.crossTarget : null;
  if (rt) {
    let shown = false;
    if (hero && hero.alive && state.mode === 'play' && !bossCine()) {   // you aim it: the crosshair sits in the middle
      const cx = innerWidth / 2, cy = innerHeight * (fpvActive() ? 0.5 : 0.46);
      OV.rtX = cx; OV.rtY = cy;
      rt.style.display = 'block';
      rt.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
      const bloom = Math.max(0, (hero.moving ? 4 : 0) + (hero.recoil > 0 ? 6 : 0) + (hero.reloadT > 0 ? 8 : 0) - (aim.ads ? 3 : 0));
      OV.gap += (bloom - OV.gap) * Math.min(1, dt * 12);
      rt.style.setProperty('--g', OV.gap.toFixed(1) + 'px');
      rt.classList.toggle('hot', !!aimAt && enemies.includes(aimAt));
      shown = true;
    }
    if (!shown) hideEl(rt);
    OV.rtOn = shown;
    HITFX.hit = Math.max(0, HITFX.hit - dt);
    HITFX.kill = Math.max(0, HITFX.kill - dt);
    HITFX.head = Math.max(0, HITFX.head - dt);
    rt.classList.toggle('hit', HITFX.hit > 0 || HITFX.kill > 0);
    rt.classList.toggle('kill', HITFX.kill > 0);
    rt.classList.toggle('head', HITFX.head > 0);
    rt.classList.toggle('ads', fpvActive() && FPV.adsK > 0.6);   // down the sights the real sights do the aiming
  }
  updateSightOverlay();
  const jb = document.getElementById('joy');
  if (joy.active) {
    jb.style.display = 'block';
    jb.style.left = joy.bx + 'px'; jb.style.top = joy.by + 'px';
    document.getElementById('joyknob').style.transform = `translate(${joy.dx * 32}px,${joy.dy * 32}px)`;
    const sp = !!(soldiers[state.controlled] && soldiers[state.controlled].sprinting);
    if (sp !== OV.joySprint) { OV.joySprint = sp; jb.classList.toggle('sprint', sp); }
  } else hideEl(jb);
  {   // objective letters over each flag, through fog and walls
    const T = state.training, signs = T && TRAIN_STEPS[T.step] && TRAIN_STEPS[T.step].id === 'look';
    const objs = signs ? RANGE.signs.map((p, i) => ({ x: p[0] * PX, y: p[1] * PX, letter: String(i + 1), owner: T.seen[i] ? 'p' : null })) : (state.objs || []);
    for (let i = 0; i < 3; i++) {
      const tag = (OV.otag || (OV.otag = []))[i] || (OV.otag[i] = document.getElementById('otag' + i)), o = objs[i];
      if (o && state.mode !== 'failed' && toScreen(o.x, o.y, (signs ? 2.7 : 4.3) / ZS) && SCR.x > -20 && SCR.x < innerWidth + 20 && SCR.y > (innerHeight < 520 ? 70 : 96) && SCR.y < innerHeight + 20) {   // never over the ticket bar and the objective chips
        if (tag.style.display !== 'grid') tag.style.display = 'grid';
        if (tag.textContent !== o.letter) tag.textContent = o.letter;
        tag.style.transform = `translate3d(${SCR.x.toFixed(1)}px,${SCR.y.toFixed(1)}px,0)`;
        const c = o.owner === 'p' ? 'var(--friend)' : o.owner === 'e' ? 'var(--foe)' : '#c9d1dc';
        if (tag.dataset.c !== c) { tag.dataset.c = c; tag.style.setProperty('--c', c); }
      } else hideEl(tag);
    }
  }
  {   // a live frag near you (yours within 6 m, theirs within 10 m): a red grenade on a ring around the crosshair, pointing at it
    const me = soldiers[state.controlled], nw = OV.nade || (OV.nade = document.getElementById('nadewarn'));
    let near = null, nd = Infinity;
    if (me && me.alive && state.mode === 'play') for (const g of grenades) { const d = dist2(g.x, g.y, me.x, me.y); if (d < (g.hostile ? 400 * 400 : 240 * 240) && d < nd) { nd = d; near = g; } }
    if (near) {
      const a = Math.atan2(near.x - me.x, -(near.y - me.y)) - cam.yaw, rad = Math.min(innerWidth, innerHeight) * 0.2;
      nw.style.display = 'block';
      nw.style.transform = `translate3d(${(innerWidth / 2 + Math.sin(a) * rad).toFixed(1)}px,${(innerHeight / 2 - Math.cos(a) * rad).toFixed(1)}px,0)`;
      nw.firstElementChild.nextElementSibling.style.transform = `rotate(${a.toFixed(3)}rad)`;
      nw.style.opacity = (0.65 + 0.35 * Math.sin(performance.now() / (25 + 45 * clamp(near.fuse / 2.5, 0, 1)))).toFixed(2);   // quicker as the fuse burns down
    } else if (nw.style.display !== 'none') nw.style.display = 'none';
  }
  const s = soldiers[state.controlled], list = [];
  if (s && s.alive && state.mode === 'play') {   // close enemies beside or behind the camera
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
    for (const e of enemies) {
      const dx = e.x - s.x, dy = e.y - s.y, d2 = dx * dx + dy * dy;
      if (d2 > 340 * 340) continue;
      const fwd = dx * sy - dy * cy;
      if (fwd > 60) continue;
      list.push([d2, Math.atan2(dx * cy + dy * sy, fwd)]);
    }
    list.sort((a, b) => a[0] - b[0]);
  }
  const R = Math.min(innerWidth, innerHeight) * 0.36, cxs = innerWidth / 2, cys = innerHeight * 0.55;
  OV.threats.forEach((d, i) => {
    const t = list[i];
    if (!t) { hideEl(d); return; }
    d.style.display = 'block';
    d.style.transform = `translate(${(cxs + Math.sin(t[1]) * R).toFixed(1)}px,${(cys - Math.cos(t[1]) * R).toFixed(1)}px) translate(-50%,-50%) rotate(${t[1].toFixed(3)}rad)`;
    d.style.opacity = (0.2 + 0.8 * (1 - Math.sqrt(t[0]) / 340)).toFixed(2);
  });
  if (OV.fpsOn) {
    OV.frames++; OV.fpsT += dt;
    if (OV.fpsT >= 0.5) {
      const info = VIEW.renderer.info.render, box = document.getElementById('fpsbox');
      box.style.display = 'block';
      box.textContent = `${Math.round(OV.frames / OV.fpsT)} fps · ${info.calls} calls · ${(info.triangles / 1000).toFixed(1)}k tris · ${views.size} rigs · pr ${VIEW.pr.toFixed(2)}`;
      OV.frames = 0; OV.fpsT = 0;
    }
  }
}

// ---------- incoming rounds, airdrops, air strikes ----------
function drawIncoming(sh, now) {   // warning ring, then the round itself falling for its last 0.35 s
  const F = VIEW.fx, D = VIEW.dyn, X = sh.x * XS, Z = sh.y * XS;
  if (sh.kind === 'crate') { drawCrateDrop(sh, now); return; }
  const pulse = 0.85 + Math.sin(now / 90) * 0.15;
  decal(F.ring, X, Z, (sh.kind === 'fire' ? 1.3 : 2.3) * pulse, 0, colorOf('#ffb040'), 0.04);
  if (sh.t >= 0.35) return;
  const h = sh.t / 0.35 * 22 + 0.2;
  TMP.q.identity();
  TMP.m.compose(TMP.v.set(X, h + 0.45, Z), TMP.q, TMP.s.set(0.16, 0.6, 0.16));
  D.cyl.push(TMP.m, colorOf(sh.kind === 'fire' ? '#7a3420' : '#3f4638'));
  TMP.q.setFromAxisAngle(TMP.v2.set(1, 0, 0), Math.PI);
  TMP.m.compose(TMP.v.set(X, h, Z), TMP.q, TMP.s.set(0.16, 0.3, 0.16));
  D.cone.push(TMP.m, colorOf('#2a2e26'));
  TMP.q.identity();
  TMP.m.compose(TMP.v.set(X, h + 1.1, Z), TMP.q, TMP.s.set(0.12, 0.12, 0.12));
  F.spark.push(TMP.m, colorOf('#d8d4c8'));
}
function drawCrateDrop(sh, now) {   // supply crate under a parachute, drifting onto the squad
  const D = VIEW.dyn, X = sh.x * XS, Z = sh.y * XS, h = Math.max(0, sh.t) * 14;
  const sway = Math.sin(now / 320) * 0.3 * (h / 14);
  decal(VIEW.fx.ring, X, Z, 2.0, now / 500, colorOf('#9fe070'), 0.04);
  TMP.q.setFromAxisAngle(TMP.up, now / 900);
  TMP.m.compose(TMP.v.set(X + sway, h + 0.35, Z), TMP.q, TMP.s.set(0.7, 0.7, 0.7));
  D.wood.push(TMP.m, colorOf('#5e6444'));
  TMP.m.compose(TMP.v.set(X + sway, h + 0.36, Z), TMP.q, TMP.s.set(0.72, 0.12, 0.72));
  D.cloth.push(TMP.m, colorOf('#d23a2a'));
  TMP.q.identity();
  TMP.m.compose(TMP.v.set(X + sway * 1.6, h + 3.1, Z), TMP.q, TMP.s.set(3.0, 0.9, 3.0));
  D.cone.push(TMP.m, colorOf('#a09a78'));
  for (const [ox, oz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    TMP.m.compose(TMP.v.set(X + sway * 1.3 + ox * 0.6, h + 1.7, Z + oz * 0.6), TMP.q, TMP.s.set(0.02, 2.2, 0.02));
    D.white.push(TMP.m, colorOf('#e8e2d0'));
  }
}
function drawPlane(x, y, z) {   // strike jet, nose toward +X
  const D = VIEW.dyn, grey = colorOf('#7a8088'), dark = colorOf('#4a4e54');
  TMP.q.setFromAxisAngle(TMP.up, -Math.PI / 2);
  TMP.m3.compose(TMP.v.set(x, y, z), TMP.q, TMP.s.set(1, 1, 1));
  const part = (ox, oy, oz, sx, sy, sz, col, ry = 0) => {
    TMP.m2.makeRotationY(ry).scale(TMP.s.set(sx, sy, sz)).setPosition(ox, oy, oz);
    TMP.m.multiplyMatrices(TMP.m3, TMP.m2);
    D.metal.push(TMP.m, col);
  };
  part(0, 0, 0, 1.0, 0.9, 7.0, grey);
  part(0, 0.4, -1.9, 0.6, 0.4, 1.6, dark);
  part(0, -0.05, 0.4, 7.6, 0.14, 2.2, grey);
  part(-2.3, -0.05, 0.9, 3.4, 0.12, 1.0, grey, -0.5); part(2.3, -0.05, 0.9, 3.4, 0.12, 1.0, grey, 0.5);
  part(0, 0.1, 3.1, 3.2, 0.1, 0.9, grey);
  part(-0.45, 0.8, 3.0, 0.1, 1.3, 1.0, dark); part(0.45, 0.8, 3.0, 0.1, 1.3, 1.0, dark);
  part(0, 0, 3.6, 0.7, 0.7, 0.3, dark);
  TMP.q.identity();
}
function showTitleCard(boss) {
  const card = document.getElementById('titlecard');
  card.querySelector('.tc-sub').textContent = boss.epithet || 'Carrier of the Other';
  card.querySelector('.tc-name').textContent = boss.name;
  card.classList.remove('show');
  void card.offsetWidth;
  card.classList.add('show');
}
function hideTitleCard() { document.getElementById('titlecard').classList.remove('show'); }

function hpBar(x, z, y, frac, fillCol) {   // camera-facing health bar floating over a head
  const F = VIEW.fx, q = VIEW.camera.quaternion, w = 0.7, h = 0.08;
  TMP.v.set(1, 0, 0).applyQuaternion(q);
  TMP.m.compose(TMP.v2.set(x, y, z), q, TMP.s.set(w + 0.05, h + 0.05, 1));
  F.hpBack.push(TMP.m, colorOf('#1a1410'));
  const fw = Math.max(0.001, w * clamp(frac, 0, 1));
  TMP.v2.addScaledVector(TMP.v, -(w - fw) / 2);
  TMP.m.compose(TMP.v2, q, TMP.s.set(fw, h, 1));
  F.hpFill.push(TMP.m, colorOf(fillCol));
}

// ---------- engine start, resize, adaptive resolution ----------
function initView() {
  initTmp();
  VIEW.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, stencil: false, powerPreference: 'high-performance' });
  initN64();
  VIEW.scene = new THREE.Scene();
  VIEW.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900);
  VIEW.tex = buildTextures();
  VIEW.kit = buildKit();
  VIEW.mats = { lit: new THREE.MeshLambertMaterial({ map: VIEW.tex.atlas }), unlit: new THREE.MeshBasicMaterial(),
    shaded: new THREE.MeshLambertMaterial({ map: VIEW.tex.atlas, vertexColors: true }) };
  VIEW.dyn = makePartBatches(1400, 700);
  VIEW.stat = makePartBatches(2600, 1300);
  buildFxBatches();
  buildEnvironment();
  buildOverlays();
  for (const k of ['eye', 'look', 'oEye', 'oLook', 'cEye', 'cLook']) camView[k] = new THREE.Vector3();
  cv.addEventListener('webglcontextlost', e => e.preventDefault());
  addEventListener('resize', resizeView);
  resizeView();
}
function resizeView() {   // the canvas runs at native resolution; the scene renders at ≥ N64.lines and is blown up by a whole number
  if (!VIEW.renderer) return;
  const w = innerWidth, h = innerHeight, dpr = Math.min(devicePixelRatio || 1, Q.dpr);   // the quality preset caps the pixel ratio
  VIEW.renderer.setPixelRatio(dpr);
  VIEW.renderer.setSize(w, h, false);
  const buf = VIEW.renderer.getDrawingBufferSize(new THREE.Vector2());
  N64.scale = Math.max(1, Math.ceil(Math.min(buf.x, buf.y) / (N64.lines * 1.15)));   // whole-number blow-up, never much past the preset's lines: 720p renders 360, 1080p 540 on High
  VIEW.pr = dpr / N64.scale;
  N64.target.setSize(Math.ceil(buf.x / N64.scale), Math.ceil(buf.y / N64.scale));
  N64.mat.uniforms.uScale.value = N64.scale;
  N64.mat.uniforms.uSize.value.set(N64.target.width, N64.target.height);
  VIEW.camera.aspect = w / h;
  VIEW.camera.updateProjectionMatrix();
}
function viewEnterBattle() {
  if (!VIEW.ready) return;
  sweepViews(true);
  BRASS.length = 0; DROPS.length = 0;
  corpseSig = '';
  buildProps();
  rebuildStatic();
  camView.have = false; camView.bossSeen = null; camView.bossT = 0;
  hideTitleCard();
  Object.assign(cam, { yaw: 0, shake: 0, punch: 0, snap: true });
  Object.assign(aim, { yaw: 0, pitch: 0, fire: false, ads: false, sticky: false, lookDx: 0 });
}
function renderView(dt) {
  if (!VIEW.ready) return;
  const live = state.mode === 'play' || state.mode === 'dying' || state.mode === 'spectate';
  const wdt = live ? dt * (state.slow > 0 ? 0.3 : 1) : 0;
  if (propsDirty) buildProps();
  viewGen++;
  updateCamera3(dt);
  VIEW.camera.updateMatrixWorld(true);
  const D = VIEW.dyn, F = VIEW.fx;
  batchesDo(D, b => b.begin());
  for (const k of FX_FRAME) F[k].begin();
  const fpv = fpvActive() && !bossCine();   // on the hero shot the camera is not your eyes: your body is drawn, your gun is not
  for (const s of soldiers) if (s.alive && !(fpv && s.slot === state.controlled)) drawSoldier(s, wdt, D);
  if (fpv) drawViewmodel(soldiers[state.controlled], wdt, D);
  for (const e of enemies) drawEnemy(e, wdt, D);
  for (const b of bodies) drawBody(b, wdt, D);
  syncCorpses(wdt, D);
  drawLoose(wdt);
  drawFx();
  const ctl = soldiers[state.controlled];
  if (ctl && ctl.alive && state.mode === 'play')
    decal(F.ring, ctl.x * XS, ctl.y * XS, ctl.horse ? 2.2 : 1.35, 0, colorOf(ctl.color), 0.035);
  sweepViews(false);
  batchesDo(D, b => b.end());
  for (const k of FX_FRAME) F[k].end();
  applyEnv(dt);
  updateSky(dt);
  n64Render();
  updateOverlays(dt);
}
function viewStats() {
  const i = VIEW.renderer ? VIEW.renderer.info.render : {};
  return { ready: VIEW.ready, failed: VIEW.failed, calls: i.calls, triangles: i.triangles, rigs: views.size,
    pr: VIEW.pr, corpses: corpses.length, yaw: cam.yaw };
}

