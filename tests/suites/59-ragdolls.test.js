// Ragdolls, begun by the three canned falls: each death opens canned, hands its body to physics at its moment, and comes
// to rest lying down where the hit and the town put it; the cap holds; a squadmate's carries over into their corpse; and
// none of it touches the fight.
function ragScene() {   // you on an open stretch of Main Street, facing north; nobody else about
  newCampaign(); seed(17);
  const h = battle({ clear: true });
  benchSquad(); setupObjectives([]);
  h.x = 48 * PX; h.y = 48 * PX; clearArea(h.x, h.y - 6 * PX, 420);
  aim.yaw = 0; aim.pitch = -0.2; cam.yaw = 0;
  corpses.length = 0; staticDirty = true;
  return h;
}
function killAt(h, dx, dy, facing, dir, wkey, type = 'grunt') {   // an enemy dx, dy metres from you, facing `facing`, killed by a hit travelling `dir`
  const e = G.spawn(type, h.x + dx * PX, h.y + dy * PX);
  e.sp = 0; e.ranged = 0; e.dmg = 0; e.aim = facing;
  frames(1);   // drawn once alive, so its body continues from that pose
  hurtEnemy(enemies.indexOf(e), 999, { player: true, wkey, slot: state.controlled }, dir);
  return { c: corpses[corpses.length - 1], x: e.x, y: e.y };
}
function watch(list, maxFrames = 400) {   // render until every corpse is baked; what each ragdoll did on the way
  const log = new Map(list.map(k => [k.c, { handoff: null, frames: 0, last: null, maxLive: 0 }]));
  let n = 0, maxLive = 0;
  for (; n < maxFrames && list.some(k => !k.c._cache); n++) {
    state.slow = 0;   // the wave-wipe slow motion only wears off in the simulation's tick, which this does not run
    frames(1, 1 / 30);
    maxLive = Math.max(maxLive, RAG_LIVE.size);
    for (const k of list) {
      const r = views.get(k.c), L = log.get(k.c);
      if (r && r.rag) { if (L.handoff == null) L.handoff = n; L.last = Float32Array.from(r.rag.p); L.fwd = ragForward(r.rag).clone(); }
    }
  }
  return { log, frames: n, maxLive };
}
const pt = (P, i) => ({ x: P[i * 3] / XS, y: P[i * 3 + 1], z: P[i * 3 + 2] / XS });   // a point back in sim px across, metres up
suite('ragdolls', t => {
  t.test('each of the three falls opens canned, hands over at its moment, and comes to rest lying down', () => {
    const h = ragScene();
    const cases = [
      ['from the front', killAt(h, -2.5, -6, Math.PI / 2, { x: 0, y: -1, z: 50 }, 'ar'), RAG.handoff],
      ['from behind', killAt(h, 0, -6, Math.PI / 2, { x: 0, y: 1, z: 50 }, 'ar'), RAG.handoff],
      ['a blast', killAt(h, 2.5, -6, Math.PI / 2, { x: 0.7, y: -0.7 }, null), RAG.handoffBlast]];
    assert.eq(cases.map(k => k[1].c.style).join(''), '012', 'the three canned falls');
    const w = watch(cases.map(k => k[1]));
    const out = {};
    for (const [name, k, at] of cases) {
      const L = w.log.get(k.c);
      assert.ok(L.handoff != null, name + ': handed to a ragdoll');
      assert.near((L.handoff + 1) / 30, at * CFG.enemyFallDur, 1.5 / 30, name + ': at its moment in the fall (s)');
      assert.ok(k.c._cache && k.c._restX != null, name + ': baked from where the ragdoll came to rest');
      const top = Math.max(...Array.from({ length: RAG_N }, (_, i) => L.last[i * 3 + 1]));
      assert.ok(top < 0.75, `${name}: lying down (highest point ${top.toFixed(2)} m)`);
      out[name] = +((w.frames) / 30).toFixed(1);
    }
    assert.ok(w.frames / 30 < RAG.handoff * CFG.enemyFallDur + RAG.maxT + 0.2, 'all at rest in time');
    return out;
  }, { timeout: 120000 });
  t.test('shot from the front they go down on their back, away from you; from behind, on their face; a blast throws them', () => {
    const h = ragScene();
    const front = killAt(h, -2.5, -6, Math.PI / 2, { x: 0, y: -1, z: 50 }, 'ar');   // facing you, the round travelling north
    const behind = killAt(h, 0, -6, -Math.PI / 2, { x: 0, y: -1, z: 50 }, 'ar');   // facing away, the round travelling north
    const blast = killAt(h, 2.5, -6, 0, { x: 0.6, y: -0.8 }, null);
    const w = watch([front, behind, blast]);
    const lie = k => { const P = w.log.get(k.c).last, head = pt(P, RP.top), feet = { x: (pt(P, RP.footL).x + pt(P, RP.footR).x) / 2, y: 0, z: (pt(P, RP.footL).z + pt(P, RP.footR).z) / 2 }; return { head, feet, fwd: w.log.get(k.c).fwd }; };
    const F = lie(front), B = lie(behind), X = w.log.get(blast.c).last;
    assert.ok(F.head.z < F.feet.z - 0.4 * PX, `from the front: head beyond the feet, away from you (${((F.feet.z - F.head.z) / PX).toFixed(2)} m)`);
    assert.ok(F.fwd.y > 0.4, `and on the back: the chest faces up (${F.fwd.y.toFixed(2)})`);
    assert.ok(B.head.z < B.feet.z - 0.4 * PX, `from behind: head beyond the feet, the way they faced (${((B.feet.z - B.head.z) / PX).toFixed(2)} m)`);
    assert.ok(B.fwd.y < -0.2, `and on the face: the chest faces down (${B.fwd.y.toFixed(2)})`);
    const thrown = ((pt(X, RP.pelvis).x - blast.x) * 0.6 + (pt(X, RP.pelvis).z - blast.y) * -0.8) / PX;
    assert.ok(thrown > 1.2, `the blast threw them ${thrown.toFixed(2)} m along its path`);
    return { thrown: +thrown.toFixed(2) };
  }, { timeout: 120000 });
  t.test('shot beside sandbags, a body drapes over them; none of it ends up inside', () => {
    const h = ragScene();
    const bags = addCover('sandbags', 48, 41.3);   // just north of where he stands: the round will carry him back onto them
    const k = killAt(h, 0, -6.2, Math.PI / 2, { x: 0, y: -1, z: 50 }, 'sniper');
    const w = watch([k]);
    const P = w.log.get(k.c).last, top = coverTop(bags) * XS;
    let over = 0;
    for (let i = 0; i < RAG_N; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const inside = x > (bags.x - bags.hw) * XS + 0.02 && x < (bags.x + bags.hw) * XS - 0.02 && z > (bags.y - bags.hd) * XS + 0.02 && z < (bags.y + bags.hd) * XS - 0.02;
      assert.ok(!(inside && y < top - 0.02), `point ${i} ended inside the bags (${y.toFixed(2)} m up, their top ${top.toFixed(2)})`);
      if (inside) over++;
    }
    assert.ok(over >= 2, `lying across the top of them (${over} points over the bags)`);
  }, { timeout: 120000 });
  t.test('nothing ends up inside a wall', () => {
    newCampaign(); seed(5);
    const h = battle({ clear: true });
    benchSquad(); setupObjectives([]); corpses.length = 0;
    const house = buildings.find(b => b.style === 'house1' && Math.abs(b.x - 7 * PX) < 1);   // the house on the cross street
    h.x = 7 * PX; h.y = house.y + house.hd + 8 * PX; aim.yaw = 0; cam.yaw = 0;
    const k = killAt(h, 0, -(8 - 0.45), Math.PI / 2, { x: 0, y: -1, z: 50 }, 'sniper');   // 45 cm off the wall, blown back into it
    const w = watch([k]);
    const P = w.log.get(k.c).last;
    assert.ok(P, 'handed to a ragdoll');
    for (const b of buildings) for (let i = 0; i < RAG_N; i++) assert.ok(!insideBox(b, P[i * 3], P[i * 3 + 1], P[i * 3 + 2]), `point ${i} inside a building`);
    assert.ok(Array.from(P).every(Number.isFinite), 'no NaN');
  }, { timeout: 120000 });
  t.test('no more than eight at once: the rest fall canned, and every one of them comes to rest', () => {
    const h = ragScene();
    const list = [];
    for (let i = 0; i < 12; i++) list.push(killAt(h, -6 + (i % 6) * 2.4, -5 - Math.floor(i / 6) * 3, Math.PI / 2, { x: 0, y: -1, z: 50 }, 'ar'));
    const w = watch(list, 600);
    assert.ok(w.maxLive <= RAG.max, `at most ${RAG.max} at once (saw ${w.maxLive})`);
    const ragged = list.filter(k => w.log.get(k.c).handoff != null).length;
    assert.range(ragged, RAG.max, list.length - 1, 'ragdolls, and some canned falls past the cap');
    assert.ok(list.every(k => k.c._cache), 'every body baked');
    assert.ok(list.filter(k => k.c._restX == null).length >= 1, 'and the canned ones where they fell');
    const q = Q.level;
    applyQuality('low');
    const few = [];
    for (let i = 0; i < 6; i++) few.push(killAt(h, -6 + i * 2.4, -12, Math.PI / 2, { x: 0, y: -1, z: 50 }, 'ar'));
    const w2 = watch(few, 600);
    applyQuality(q);
    assert.ok(w2.maxLive <= QUALITY.low.ragdolls, `on Low, at most ${QUALITY.low.ragdolls} (saw ${w2.maxLive})`);
    return { ragdolls: ragged, canned: list.length - ragged, onLow: w2.maxLive };
  }, { timeout: 180000 });
  t.test('a body that starts inside a building (the belfry) keeps its canned fall', () => {
    const h = ragScene();
    const b = buildings.slice().sort((p, q) => q.top - p.top)[0];   // the tallest: the church tower
    const e = G.spawn('grunt', b.x, b.y); e.sp = 0; e.ranged = 0; e.z = b.top * 0.5;   // halfway up inside it
    frames(1);
    hurtEnemy(enemies.indexOf(e), 999, { player: true, wkey: 'ar', slot: 0 }, { x: 0, y: -1, z: e.z + 40 });
    const c = corpses[corpses.length - 1];
    assert.ok(c && !c._cache && c.z > 0, 'a fresh corpse, up inside the tower');
    const w = watch([{ c }]);
    assert.eq(w.log.get(c).handoff, null, 'never a ragdoll');
    assert.ok(c._cache && c._restX == null, 'baked from the canned fall');
    assert.ok(w.frames >= Math.floor(CFG.enemyFallDur * 30) - 1, `after the whole canned fall (${w.frames} frames)`);
    return { frames: w.frames, tower: +(b.top * XS).toFixed(1) };
  }, { timeout: 120000 });
  t.test('a squadmate\'s ragdoll carries on when the simulation turns their body into a corpse', () => {
    const h = ragScene();
    const m = soldiers.find(s => s !== h);
    m.alive = true; m.invuln = 0; m.hp = 1; m.x = h.x + 2 * PX; m.y = h.y - 5 * PX; m.aim = Math.PI / 2; m.respawnT = 1e9;
    frames(1);
    m.lastHit = { x: 0, y: -1 }; m.lastSrc = 'grunt';
    damageSoldier(m, 5);
    const body = bodies[bodies.length - 1];
    let handedOver = false, carried = false;
    for (let n = 0; n < 300 && !(corpses.length && corpses[corpses.length - 1]._cache); n++) {
      state.slow = 0;
      tick(1 / 30); frames(1, 1 / 30);   // the fall runs in the simulation (the body becomes a corpse at CFG.fallDur) and in the view
      const rb = views.get(body);
      if (rb && rb.rag) handedOver = true;
      const c = corpses[corpses.length - 1];
      if (c && views.get(c) && views.get(c).rag) carried = true;
    }
    const c = corpses[corpses.length - 1];
    assert.ok(handedOver, 'the fall went to a ragdoll');
    assert.ok(c && c.kind === 'soldier' && c._cache, 'and became a corpse');
    assert.ok(c._restX != null, 'baked from where the ragdoll came to rest, not from the canned pose');
    assert.ok(carried || c._restX != null, 'the ragdoll lived on in the corpse');
  }, { timeout: 120000 });
  t.test('when a blast kills you, the death camera watches your body where it was thrown, not the spot you stood on', () => {
    const h = ragScene();
    h.invuln = 0; h.hp = 1;
    frames(2);
    explode(h.x - 1.2 * PX, h.y, 90, 3, 5, { player: false, wkey: null });   // a blast just west of you: thrown east
    assert.eq(state.mode, 'dying', 'down');
    const body = bodies.find(b => b.slot === state.controlled);
    assert.ok(body && body.blast, 'a blast death');
    let seen = null;
    for (let n = 0; n < 60 && state.mode === 'dying'; n++) {   // the camera swings round to the body over its first 0.45 of the death cam; judge it after
      state.slow = 0;
      tick(1 / 30); frames(1, 1 / 30);
      const rb = views.get(body), rag = rb && rb.rag;
      if (!rag || state.mode !== 'dying' || state.dyingT < CFG.deathCam * 0.6) continue;
      const look = new THREE.Vector3(0, 0, -1).applyQuaternion(VIEW.camera.quaternion), cam = VIEW.camera.position;
      const at = (x, y, z) => look.dot(new THREE.Vector3(x - cam.x, y - cam.y, z - cam.z).normalize());
      seen = { off: Math.hypot(rag.p[0] - h.x * XS, rag.p[2] - h.y * XS), body: at(rag.p[0], rag.p[1], rag.p[2]), spot: at(h.x * XS, 0.45, h.y * XS) };
    }
    assert.ok(seen, 'watched the fall with the death camera');
    assert.ok(seen.off > 1, `thrown clear of the spot (${seen.off.toFixed(2)} m)`);
    assert.ok(seen.body > 0.93, `the camera looks at the body (${seen.body.toFixed(3)})`);
    assert.ok(seen.body > seen.spot, `rather than at the spot you stood on (${seen.spot.toFixed(3)})`);
    return { thrown: +seen.off.toFixed(2), atBody: +seen.body.toFixed(3), atSpot: +seen.spot.toFixed(3) };
  }, { timeout: 120000 });
  t.test('a ragdoll only looks: it draws nothing from the fight\'s dice, and a violent one stays whole', () => {
    const h = ragScene();
    addCover('car', 48.8, 41.5, 1);
    const list = [killAt(h, 0, -6, Math.PI / 2, { x: 0.3, y: -0.95 }, 'rocket'), killAt(h, 1.2, -6.3, 0, { x: -1, y: 0, z: 40 }, 'sniper')];
    let draws = 0, inRag = false;
    const dice = Math.random, realStep = ragStep, realStart = ragStart;
    Math.random = () => { if (inRag) draws++; return dice(); };
    ragStep = (...a) => { inRag = true; try { return realStep(...a); } finally { inRag = false; } };
    ragStart = (...a) => { inRag = true; try { return realStart(...a); } finally { inRag = false; } };
    let w;
    try { w = watch(list); } finally { Math.random = dice; ragStep = realStep; ragStart = realStart; }
    assert.eq(draws, 0, 'draws from the simulation\'s random numbers inside the ragdolls');
    for (const k of list) {
      assert.ok(w.log.get(k.c).last && Array.from(w.log.get(k.c).last).every(Number.isFinite), 'every point a number');
      assert.ok(k.c._cache.every(x => !(x instanceof THREE.Matrix4) || x.elements.every(Number.isFinite)), 'every baked matrix finite');
    }
  }, { timeout: 120000 });
});
