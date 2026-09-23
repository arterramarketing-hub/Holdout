suite('physics: the world', t => {
  function street() {   // Main Street cleared, the hero out of the way
    newCampaign(); seed(11);
    const h = battle({ weapon: 'ar', clear: true });
    h.x = 20 * PX; h.y = 66 * PX;
    clearArea(48 * PX, 40 * PX, 900);
    benchSquad(); setupObjectives([]);
    state.slow = 0;
    frames(1);
    return h;
  }
  const settle = (sec = 3) => frames(Math.round(sec * 20), 1 / 20);
  const inBox = (p, b) => Math.abs(p.x - b.x * XS) < b.hw * XS - 0.05 && Math.abs(p.z - b.y * XS) < b.hd * XS - 0.05 && p.y < b.top * XS - 0.05;

  t.test('the world is built with the battle: ground, every building, every standing column of cover', () => {
    street();
    assert.ok(physOn(), 'a world');
    const ob = addCover('sandbags', 48, 40);
    frames(1);
    const rec = PHYS.cover.get(ob.id);
    assert.eq(rec && rec.bodies.length, 4, 'four columns of sandbags');
    damageCover(ob, 20, null, 46.95 * PX, 40 * PX, 0, -1);
    frames(1);
    assert.eq(PHYS.cover.get(ob.id).bodies.length, 2, 'two left once the west half is gone');
    const statics = PHYS.world.bodies.filter(b => b.mass === 0).length;
    assert.range(statics, buildings.length + 2, 2000, 'ground, buildings and cover');
    return { bodies: PHYS.world.bodies.length, statics };
  });

  t.test('a piece dropped on sandbags rests on them; one dropped over the gap falls through to the street', () => {
    street();
    const ob = addCover('sandbags', 48, 40);
    damageCover(ob, 20, null, 46.95 * PX, 40 * PX, 0, -1);   // west half gone
    frames(1);
    for (const p of PIECES.slice()) physDropPiece(p);
    const on = physPiece(49.05, 1.6, 40, 0.3, 0.2, 0.3, '#888888', 'stone');
    const gap = physPiece(46.95, 1.6, 40, 0.3, 0.2, 0.3, '#888888', 'stone');
    settle(2);
    assert.near(on.body.position.y, 0.72 + 0.1, 0.06, 'on top of the bags');
    assert.near(gap.body.position.y, 0.1, 0.06, 'in the street, through the gap');
    return { on: +on.body.position.y.toFixed(3), gap: +gap.body.position.y.toFixed(3) };
  });

  t.test('pieces thrown hard at a building stop against it, never inside it', () => {
    street();
    const b = buildings.find(bd => bd.hw > 60 && bd.top > 100);
    assert.ok(b, 'a building');
    const x = b.x * XS, z = (b.y + b.hd) * XS + 1.2;   // 1.2 m off its south face
    for (let k = 0; k < 12; k++) physThrow(physPiece(x + (k - 6) * 0.3, 1.2, z, 0.25, 0.2, 0.25, '#888888', 'stone'), 0, 2, -14, 6);
    settle(3);
    const inside = PIECES.filter(p => inBox(p.body.position, b)).length;
    assert.eq(inside, 0, 'pieces inside the building');
    const bounced = PIECES.filter(p => p.body.position.z > (b.y + b.hd) * XS).length;
    assert.eq(bounced, 12, 'all of them on the street side of the wall');
  });

  t.test('slow motion slows the world, and nothing moves while the battle is paused', () => {
    street();
    const a = physPiece(40, 3, 40, 0.3, 0.3, 0.3, '#888888', 'stone');
    for (let k = 0; k < 15; k++) physStep(1 / 60);
    const fell = 3 - a.body.position.y;
    const b = physPiece(44, 3, 40, 0.3, 0.3, 0.3, '#888888', 'stone');
    for (let k = 0; k < 15; k++) physStep(0.3 / 60);   // the wave-wipe slow motion: the world at 30%
    assert.ok(3 - b.body.position.y < fell * 0.3, 'less than a third as far in slow motion');
    const y = b.body.position.y;
    physStep(0);
    assert.eq(b.body.position.y, y, 'no time, no motion');
  });

  t.test('a world full of tumbling pieces draws nothing from the fight\'s dice', () => {
    street();
    for (let k = 0; k < 40; k++) debrisBurst(40 + (k % 8) * 0.6, 1, 40 + ((k / 8) | 0) * 0.6, '#b4a67a', 'dirt', 1, 0);
    seed(123);
    const a0 = Math.random();
    seed(123);
    for (let k = 0; k < 30; k++) { physStep(1 / 30); drawPieces(1 / 30); }
    assert.eq(Math.random(), a0, 'dice drawn');
  });

  t.test('without the engine, cover still loses its pieces and nothing breaks', () => {
    street();
    const W = PHYS.world;
    PHYS.world = null;
    try {
      const ob = addCover('sandbags', 48, 40);
      damageCover(ob, 20, null, 46.95 * PX, 40 * PX, 0, -1);
      frames(3);
      assert.eq(coverTopAt(ob, 46.95 * PX, 40 * PX), 0, 'the hole is there');
      assert.eq(PIECES.length, 0, 'nothing thrown');
    } finally { PHYS.world = W; }
  });

  // ---------- phase 2: the pieces themselves ----------
  const loose = k => PIECES.filter(p => p.batch === k);
  const drawnWhole = kind => {   // how many pieces of each model the whole thing is drawn with
    const ob = makeCover(kind, 0, 0), n = {};
    coverPieces(ob, ob.chunks, (k, lx, y, lz, sx, sy, sz, col, dyaw, c, r) => { if (pieceStands(ob, ob.chunks, c, r)) n[k] = (n[k] || 0) + 1; });
    return n;
  };

  t.test('a sandbag knocked off a wall is a sandbag: the bag that stood there, thrown the way the round went', () => {
    street();
    const ob = addCover('sandbags', 48, 40);
    frames(1);
    damageCover(ob, 20, null, 46.95 * PX, 40 * PX, 0, -1);   // the west half, pushed north
    frames(1);
    const bags = loose('bags');
    assert.range(bags.length, 7, 11, 'bags thrown');
    for (const b of bags) { assert.near(b.sx, 0.5, 1e-6, 'a bag wide'); assert.near(b.sy, 0.24, 1e-6, 'a bag tall'); }
    settle(4);
    const moving = bags.filter(b => b.body.velocity.length() > 0.15 || b.body.angularVelocity.length() > 0.5);
    assert.eq(moving.length, 0, 'bags still moving: ' + moving.map(b => [b.body.velocity.length().toFixed(2), b.body.angularVelocity.length().toFixed(2), b.body.position.y.toFixed(2), b.body.sleepState].join('/')).join(' '));
    assert.eq(bags.filter(b => b.body.position.z < 40).length >= bags.length * 0.7, true, 'most went north, the way they were pushed');
    const standing = coverPieces.length && (() => { let n = 0; coverPieces(ob, ob.chunks, (k, lx, y, lz, sx, sy, sz, col, dyaw, c, r) => { if (pieceStands(ob, ob.chunks, c, r)) n++; }); return n; })();
    assert.eq(standing + bags.length, drawnWhole('sandbags').bags, 'every bag is either standing or lying in the street');
    return { thrown: bags.length, standing };
  });

  t.test('a wall block comes out as a block, with its coping; a jersey segment topples rather than flies', () => {
    street();
    const wl = addCover('wall', 44, 40), jb = addCover('barrier', 52, 40);
    frames(1);
    damageCover(wl, 16, null, 42.4 * PX, 40 * PX, 0, -1);   // two blocks off the west end: the top one and its coping first
    damageCover(jb, 45, null, 50.5 * PX, 40 * PX, 0, -1);  // one segment gone
    frames(1);
    const blocks = loose('walls');
    assert.ok(blocks.some(p => Math.abs(p.sy - 0.1) < 1e-6), 'a coping stone among them');
    assert.ok(blocks.some(p => p.sy > 0.4), 'and a block');
    const seg = loose('barriers');
    assert.eq(seg.length, 1, 'one jersey segment');
    const x0 = seg[0].body.position.x, z0 = seg[0].body.position.z;
    settle(3);
    const moved = Math.hypot(seg[0].body.position.x - x0, seg[0].body.position.z - z0);
    assert.range(moved, 0, 1.6, 'the segment stays close to where it stood');
    const q = seg[0].body.quaternion, up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
    const tilt = Math.acos(clamp(up.y, -1, 1)) * 180 / Math.PI;
    assert.range(tilt, 45, 180, 'tipped over (degrees off upright)');
    return { blocks: blocks.length, moved: +moved.toFixed(2), tilt: Math.round(tilt) };
  });

  t.test('cover destroyed outright throws everything still standing on it', () => {
    street();
    const cr = addCover('crates', 48, 40);
    frames(1);
    damageCover(cr, cr.maxHp + 1, null, 48 * PX, 40 * PX, 1, 0);
    frames(1);
    assert.eq(obstacles.includes(cr), false, 'destroyed');
    assert.eq(loose('crates').length, drawnWhole('crates').crates, 'every crate it was drawn with');
    settle(3);
    assert.eq(loose('crates').every(p => p.body.position.y < 1.2), true, 'down in the street');
  });

  t.test('a barrel goes up with its drum, and the drum comes down', () => {
    street();
    const br = addCover('barrel', 48, 40);
    frames(1);
    damageCover(br, 99, null, 48 * PX, 40 * PX, 0, -1);
    frames(1);
    const drum = loose('drums')[0];
    assert.ok(drum, 'a drum in the air');
    let top = 0;
    for (let k = 0; k < 30; k++) { frames(1, 1 / 30); top = Math.max(top, drum.body.position.y); }
    assert.range(top, 2, 6, 'how high it went');
    settle(4);
    assert.range(drum.body.position.y, 0.2, 0.55, 'lying in the street');
    return { top: +top.toFixed(2) };
  });

  t.test('for every kind that comes apart, the pieces thrown are the pieces it was drawn with', () => {
    street();
    for (const kind in COVER_CHUNKS) {
      for (const p of PIECES.slice()) physDropPiece(p);
      const ob = addCover(kind, 48, 40);
      frames(1);
      const n = throwPieces(ob, ob.chunks, 0, { x: 0, y: 0 }, true);
      const want = Object.values(drawnWhole(kind)).reduce((a, b) => a + b, 0);
      assert.eq(n, Math.min(want, Q.debris), kind + ': pieces thrown');
      obstacles.splice(obstacles.indexOf(ob), 1);
    }
  });

  // ---------- phase 3: bodies, and what blasts do to them ----------
  const bake = (c, max = 300) => { for (let n = 0; n < max && !c._cache; n++) { state.slow = 0; frames(1, 1 / 30); } return !!c._cache; };
  function deadAt(h, dx, dy) {   // an enemy killed where it stands, by a round from the south
    const e = G.spawn('grunt', h.x + dx * PX, h.y + dy * PX);
    e.sp = 0; e.ranged = 0; e.dmg = 0; e.aim = Math.PI / 2;
    frames(1);
    hurtEnemy(enemies.indexOf(e), 999, { player: true, wkey: 'ar', slot: state.controlled }, { x: 0, y: -1, z: 50 });
    return corpses[corpses.length - 1];
  }

  t.test('a blast shoves what lies in the street away from it, and never into a wall', () => {
    const h = street();
    h.x = 48 * PX; h.y = 48 * PX;
    const ps = [];
    for (let k = 0; k < 8; k++) ps.push(physPiece(46 + (k % 4), 0.12, 40 + ((k / 4) | 0), 0.3, 0.24, 0.5, '#b4a67a', 'dirt'));
    settle(2);
    const before = ps.map(p => Math.hypot(p.body.position.x - 47.5, p.body.position.z - 40.5));
    explode(47.5 * PX, 40.5 * PX, 120, 0, 0, { player: false, wkey: null });
    settle(3);
    const after = ps.map(p => Math.hypot(p.body.position.x - 47.5, p.body.position.z - 40.5));
    const out = after.filter((a, i) => a > before[i] + 0.3).length;
    assert.ok(out >= 6, 'pieces thrown outward: ' + out + ' of 8');
    for (const b of buildings) for (const p of ps) assert.ok(!(Math.abs(p.body.position.x - b.x * XS) < b.hw * XS - 0.05 && Math.abs(p.body.position.z - b.y * XS) < b.hd * XS - 0.05 && p.body.position.y < b.top * XS - 0.05), 'a piece inside a building');
    return { out, moved: +(after.reduce((a, b) => a + b, 0) / 8 - before.reduce((a, b) => a + b, 0) / 8).toFixed(2) };
  });

  t.test('a blast beside a body that has settled throws it again; it settles again, and its blood stays where it fell', () => {
    const h = street();
    h.x = 48 * PX; h.y = 48 * PX; aim.yaw = 0; cam.yaw = 0;
    const c = deadAt(h, 0, -6);
    assert.ok(bake(c), 'settled and baked');
    const pool = [c._restX, c._restY], x0 = c._restX;
    explode(c._restX + 60, c._restY, 120, 0, 0, { player: false, wkey: null });   // 1.5 m east of it
    frames(1);
    assert.eq(c._cache, null, 'picked up out of the corpse layer');
    const r = views.get(c);
    assert.ok(r && r.rag, 'a live ragdoll again');
    frames(10, 1 / 30);
    assert.ok(r.rag.p[0] / XS < x0 - 10, 'thrown west, away from the blast');
    assert.ok(bake(c), 'settled again');
    assert.eq(c._restX, pool[0], 'its blood stays where it first fell');
    assert.ok(c._J, 'the pose it rests in is kept');
  });

  t.test('a body that fell canned (past the cap) is thrown from its canned pose; blasts wake only what is in reach', () => {
    const h = street();
    h.x = 48 * PX; h.y = 48 * PX; aim.yaw = 0; cam.yaw = 0;
    const qd = Q.ragdolls; Q.ragdolls = 0;   // every death canned
    let a, b;
    try {
      a = deadAt(h, -1, -6); b = deadAt(h, 4, -6);
      assert.ok(bake(a) && bake(b), 'both baked, canned');
      assert.eq(a._J, undefined, 'no ragdoll pose kept');
    } finally { Q.ragdolls = qd; }
    explode(a.x - 40, a.y, 90, 0, 0, { player: false, wkey: null });   // 1 m west of a; b is 5 m off
    frames(1);
    assert.eq(a._cache, null, 'the near one is thrown');
    assert.ok(b._cache, 'the far one stays where it lies');
    assert.ok(bake(a), 'and settles again');
  });

  // ---------- phase 4: what it costs ----------
  function busyStreet(level) {   // the rubble cap's worth of pieces settled in the street, the ragdoll cap's worth of the dead falling at once, and a blast through the lot
    applyQuality(level);
    const h = street();
    h.x = 48 * PX; h.y = 60 * PX; aim.yaw = 0; cam.yaw = 0;
    for (let k = 0; k < Q.debris; k++) physPiece(42 + (k % 12) * 0.9, 0.3 + ((k / 36) | 0) * 0.3, 42 + ((k / 12) | 0) % 3 * 0.9, 0.3, 0.24, 0.5, '#b4a67a', 'dirt');
    settle(2);
    const es = [];
    for (let k = 0; k < Q.ragdolls; k++) {
      const e = G.spawn('grunt', (42 + k * 1.6) * PX, 50 * PX);
      e.sp = 0; e.ranged = 0; e.dmg = 0; e.aim = Math.PI / 2; es.push(e);
    }
    frames(1);
    for (const e of es) hurtEnemy(enemies.indexOf(e), 999, { player: true, wkey: 'ar', slot: state.controlled }, { x: 0, y: -1, z: 50 });
    let sum = 0, worst = 0, n = 0, live = 0;
    for (let k = 0; k < 150; k++) {   // two and a half seconds of the worst of it
      if (k === 40) explode(47 * PX, 45 * PX, 150, 0, 0, { player: false, wkey: null });
      state.slow = 0;
      frames(1, 1 / 60);
      if (PHYS.last != null) { sum += PHYS.last; worst = Math.max(worst, PHYS.last); n++; }
      live = Math.max(live, RAG_LIVE.size);
    }
    const out = { level, avg: +(sum / n).toFixed(2), worst: +worst.toFixed(2), bodies: PHYS.world.bodies.length, ragdolls: live, pieces: PIECES.length };
    applyQuality('high');
    return out;
  }
  t.test('the cost of a full street, on High and on Low: the ragdoll cap falling, the rubble cap lying about, a blast through it all', () => {
    const hi = busyStreet('high'), lo = busyStreet('low');
    assert.eq(hi.ragdolls, QUALITY.high.ragdolls, 'every ragdoll slot in use on High');
    assert.range(hi.avg, 0, 6, 'ms of physics a frame on High, on average');
    assert.range(lo.avg, 0, hi.avg + 0.5, 'Low costs no more than High');
    return { high: hi, low: lo };
  }, { timeout: 180000 });
});