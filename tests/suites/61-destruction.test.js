suite('destruction: cover that comes apart', t => {
  const COL = [46.95, 47.65, 48.35, 49.05];   // the four columns of a sandbag wall centred on 48 m, west to east
  function wall(kind = 'sandbags') {   // the hero on Main Street, a wall 9.5 m north of him, a rifleman 3.5 m behind it
    newCampaign(); seed(11);
    const h = battle({ weapon: 'ar', clear: true });
    h.x = COL[0] * PX; h.y = 40 * PX; h.mag = 9999; h.reserve = 9999;
    clearArea(48 * PX, 32 * PX, 800);
    benchSquad(); setupObjectives([]);
    const ob = addCover(kind, 48, 30.5);
    const e = G.spawn('grunt', COL[0] * PX, 29 * PX);   // 1.5 m behind it
    e.sp = 0; e.ranged = 0; e.dmg = 0; e.hp = e.maxHp = 1e6; e.stillT = 9;
    frames(1);
    return { h, e, ob };
  }
  const shootLow = (h, e, n) => {   // down the sights at his shins: every round arrives below the top of the wall and above the dirt
    for (let k = 0; k < n; k++) {
      aimAt(h, e.x, e.y, 0.36 * PX); aim.ads = true; FPV.adsK = 1;
      h.fireCd = 0; h.mag = 9999; aim.fire = true; tick(1 / 60); aim.fire = false;
      ticks(14);
    }
    return n;
  };

  t.test('pieces come off where it was hit, not everywhere at once', () => {
    const { ob } = wall();
    assert.eq(ob.chunks, (1 << 12) - 1, 'twelve pieces standing');
    damageCover(ob, 20, null, COL[0] * PX, 30.5 * PX);   // half its health, all of it into the west end
    const full = coverFull(ob);
    assert.eq(coverTopAt(ob, COL[0] * PX, 30.5 * PX), 0, 'west column, where it was hit');
    assert.eq(coverTopAt(ob, COL[1] * PX, 30.5 * PX), 0, 'the next column along');
    assert.eq(coverTopAt(ob, COL[3] * PX, 30.5 * PX), full, 'the east end, untouched');
    assert.eq(coverTop(ob), full, 'still full height where it stands');
    return { left: ob.chunks.toString(2) };
  });

  t.test('rounds into one end of a sandbag wall open a lane through it', () => {
    const { h, e, ob } = wall();
    const hits0 = state.hits;
    shootLow(h, e, 3);
    assert.eq(state.hits - hits0, 0, 'rounds through the wall while it stands whole');
    assert.ok(ob.hp < ob.maxHp, 'the wall is taking them');
    shootLow(h, e, 17);
    const through = state.hits - hits0;
    assert.range(coverTopAt(ob, COL[0] * PX, 30.5 * PX), 0, coverFull(ob) / 3, 'down to its last layer where he fired');
    assert.eq(coverTopAt(ob, COL[3] * PX, 30.5 * PX), coverFull(ob), 'the far end still stands full height');
    assert.range(through, 5, 17, 'rounds that reached him once the bags came off');
    const hits1 = state.hits;   // the same rounds at the standing end: stopped
    h.x = COL[3] * PX; e.x = COL[3] * PX;
    shootLow(h, e, 3);
    assert.eq(state.hits - hits1, 0, 'hits through the standing end');
    return { through, hp: Math.round(ob.hp * 10) / 10, mask: ob.chunks.toString(2) };
  });
  t.test('sight and the crosshair open through the gap too', () => {
    const { h, e, ob } = wall();
    const see = () => los3(h.x, h.y, 0.5 * PX, e.x, e.y, 0.5 * PX, null);
    assert.eq(see(), false, 'sight through the full wall');
    aimAt(h, e.x, e.y, 0.3 * PX); aim.ads = true; FPV.adsK = 1; frames(1);
    assert.eq(crosshairEnemy(h), null, 'crosshair through the full wall');
    damageCover(ob, 20, null, COL[0] * PX, 30.5 * PX);
    assert.eq(see(), true, 'sight through the gap');
    aimAt(h, e.x, e.y, 0.3 * PX); frames(1);
    assert.eq(crosshairEnemy(h), e, 'crosshair through the gap');
  });

  t.test('a blast takes its pieces from where it went off', () => {
    const { ob } = wall();
    explode(COL[0] * PX, 29 * PX, 100, 3, 0, { player: false, wkey: null });
    assert.ok(ob.hp < ob.maxHp, 'the blast hurt it');
    assert.eq(coverTopAt(ob, COL[0] * PX, 30.5 * PX), 0, 'open where the blast was');
    assert.eq(coverTopAt(ob, COL[3] * PX, 30.5 * PX), coverFull(ob), 'the far end stands');
  });

  t.test('the last piece holds until its health runs out', () => {
    const { ob } = wall();
    damageCover(ob, 39, null, COL[0] * PX, 30.5 * PX);
    let live = 0;
    for (let i = 0; i < 12; i++) if (ob.chunks & (1 << i)) live++;
    assert.eq(live, 1, 'pieces left at 1 hp');
    assert.ok(obstacles.includes(ob), 'still cover');
    const rub = rubble.length;
    damageCover(ob, 2, null, COL[0] * PX, 30.5 * PX);
    assert.eq(obstacles.includes(ob), false, 'destroyed');
    assert.eq(rubble.length, rub + 1, 'rubble where it stood');
  });

  t.test('every chunked kind lines its pieces up with its height, and the rest are unchanged', () => {
    newCampaign(); seed(3);
    battle({ clear: true });
    obstacles.length = 0;
    for (const kind in COVER_CHUNKS) {
      const ob = addCover(kind, 40, 40), g = COVER_CHUNKS[kind], full = coverFull(ob);
      assert.eq(coverTop(ob), full, kind + ': full height when built');
      assert.eq(coverTopAt(ob, 40 * PX, 40 * PX), full, kind + ': full height at any point');
      ob.chunks = 0;
      assert.eq(coverTop(ob), 0, kind + ': nothing left');
      ob.chunks = 1 << ((g[1] - 1) * g[0]);   // one piece, top row, first column
      assert.eq(coverTop(ob), full, kind + ': one top piece still reaches the top');
      obstacles.length = 0;
    }
    for (const kind of ['car', 'barrel', 'dumpster', 'pump', 'wreck']) {
      const ob = addCover(kind, 40, 40);
      assert.eq(ob.chunks, undefined, kind + ': one solid piece');
      damageCover(ob, ob.maxHp * 0.6, null, 40 * PX, 40 * PX);
      assert.eq(coverTopAt(ob, 40 * PX, 40 * PX), coverFull(ob), kind + ': keeps its height');
      obstacles.length = 0;
    }
  });

  t.test('a rotated wall loses the pieces nearest the hit, in its own frame', () => {
    newCampaign(); seed(3);
    battle({ clear: true });
    obstacles.length = 0;
    const ob = addCover('sandbags', 40, 40, true);   // turned: its length runs north-south
    assert.near(ob.hd, 56, 0.01, 'long axis along y');
    damageCover(ob, 20, null, 40 * PX, 41.2 * PX);   // hit at its south end
    assert.eq(coverTopAt(ob, 40 * PX, 41.2 * PX), 0, 'open at the south end');
    assert.eq(coverTopAt(ob, 40 * PX, 38.8 * PX), coverFull(ob), 'the north end stands');
  });

  t.test('pieces fly off where the cover lost them and come to rest in the street', () => {
    const { ob } = wall();
    state.slow = 0;
    frames(1);
    assert.eq(PIECES.length, 0, 'nothing loose while it stands whole');
    damageCover(ob, 20, null, COL[0] * PX, 30.5 * PX, 0, -1);   // six pieces off the west end, pushed north
    frames(1);
    const n = PIECES.length, z0 = new Map(PIECES.map(p => [p, p.body.position.z]));
    assert.range(n, 6, Q.debris, 'pieces thrown');
    for (const p of PIECES) assert.range(p.body.position.x, COL[0] - 1.4, COL[0] + 1.4, 'thrown from the hole, not the far end');
    frames(80, 1 / 20);   // four seconds
    const rubble = PIECES.filter(p => p.batch !== 'debris');   // the bags themselves; the grit shrinks away
    const moving = rubble.filter(p => p.body.velocity.length() > 0.15 || p.body.angularVelocity.length() > 0.5).length;
    assert.eq(moving, 0, 'bags still visibly moving');
    frames(60, 1 / 20);   // seven seconds
    assert.eq(PIECES.filter(p => p.batch === 'debris').length, 0, 'the grit has gone');
    assert.eq(PIECES.length, rubble.length, 'the bags stay as rubble');
    assert.ok(rubble.filter(p => p.body.sleepState === 2).length >= rubble.length * 0.8, 'asleep: lying rubble costs nothing');
    assert.eq(PIECES.every(p => p.body.position.y < 0.9), true, 'down in the street, not floating');
    const north = rubble.filter(p => p.body.position.z < z0.get(p)).length;   // north of where each one started
    assert.ok(north >= rubble.length * 0.75, 'the bags went the way they were pushed: ' + north + ' of ' + rubble.length);
    return { pieces: n, bags: rubble.length, north };
  });

  t.test('loose pieces keep to the quality cap and never touch the fight', () => {
    wall();
    state.slow = 0;
    for (let k = 0; k < 120; k++) debrisBurst(20 + (k % 12) * 0.5, 0.6, 20 + ((k / 12) | 0) * 0.5, '#b4a67a', 'dirt', 0, 0);
    frames(30, 1 / 30);
    assert.range(PIECES.length, 1, Q.debris, 'capped by the quality preset');
    seed(77);
    const a0 = Math.random();
    seed(77);
    for (let k = 0; k < 8; k++) debrisBurst(12, 1, 12, '#b4a67a', 'dirt', 1, 0);
    physStep(0.5); drawPieces(1 / 60);
    assert.eq(Math.random(), a0, 'the fight rolled nothing for any of it');
  });

  t.test('the same fire opens the same holes — no dice', () => {
    const run = () => {
      const { ob } = wall();
      damageCover(ob, 7, null, COL[2] * PX, 30.5 * PX);
      damageCover(ob, 9, null, COL[0] * PX, 30.5 * PX);
      explode(COL[3] * PX, 29.4 * PX, 90, 2, 0, { player: false, wkey: null });
      return ob.chunks;
    };
    const a = run();
    for (let i = 0; i < 9; i++) Math.random();
    const b = run();
    assert.eq(b, a, 'same masks, whatever the dice were doing');
    return { mask: a.toString(2) };
  });
});
