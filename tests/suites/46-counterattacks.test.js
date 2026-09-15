// Counterattacks: when one starts and on which objective, who attacks and where they come from, and how it ends.
suite('counterattacks', t => {
  function heldScene({ frontTime = 120, heldFor = 45, seedN = 5 } = {}) {   // B has been yours for a while; the enemy has reserves
    newCampaign(); seed(seedN);
    const h = battle({ clear: true });
    benchSquad();
    setupObjectives(objectiveSites(1));
    const B = state.objs[1];
    B.owner = 'p'; B.cap = 1; B.heldSince = frontTime - heldFor;
    state.frontTime = frontTime; state.counterNext = 0; state.counterCheckT = 0;
    h.x = 48 * PX; h.y = 66 * PX; h.invuln = 1e9;   // back at the FOB, away from every objective
    state.spawnT = 1e9;
    return { h, B };
  }
  const spawnNear = (type, o, dx, dy) => { const e = G.spawn(type, o.x + dx, o.y + dy); e.hp = 3; return e; };
  const waitStart = (sec = 60) => { for (let i = 0; i < sec * 60 && !state.counter; i++) tick(1 / 60); return state.counter; };
  t.test('holding B for 40 s with reserves starts a counterattack on B, with a banner and a pulsing chip', () => {
    const { B } = heldScene();
    const C = waitStart(40);
    assert.ok(C, 'a counterattack started');
    assert.eq(C.obj, B, 'on B');
    assert.ok(bannerQueue.includes('COUNTERATTACK · B') || el.banner.textContent === 'COUNTERATTACK · B', 'banner');
    G.frame(1 / 60);
    assert.ok($('obj1').classList.contains('counter'), 'the chip pulses');
  });
  t.test('none before 60 s of front time, before 40 s held, with fewer than 4 reserves, or while the Warlord is up', () => {
    heldScene({ frontTime: 30, heldFor: 30 });
    assert.ok(!waitStart(25), 'not before 60 s of front time');
    heldScene({ heldFor: 10 });
    assert.ok(!waitStart(25), 'not before 40 s held');
    heldScene();
    state.enemyDown = state.enemyTotal - 3;
    assert.ok(!waitStart(40), 'not with 3 reserves left');
    heldScene();
    spawnBoss(); state.slow = 0;
    assert.ok(!waitStart(40), 'not while the Warlord is up');
  });
  t.test('up to four attackers: the nearest on the field, then arrivals at zones near B; they close on it', () => {
    const { B } = heldScene();
    const far = spawnNear('grunt', B, 1500, 900), mid = [spawnNear('grunt', B, 700, 0), spawnNear('runner', B, -800, 300)];
    const C = waitStart(40);
    assert.ok(C, 'started');
    assert.ok(mid.every(e => C.attackers.includes(e)) && C.attackers.includes(far), 'the three on the field joined');
    state.spawnT = 0; ticks(3 * 60);
    assert.eq(C.attackers.length, 4, 'a fourth walked on and joined');
    const newcomer = C.attackers.find(e => e !== far && !mid.includes(e));
    assert.ok(newcomer && Math.hypot(newcomer.x - B.x, newcomer.y - B.y) < 45 * PX, `the newcomer arrived near B (${(Math.hypot(newcomer.x - B.x, newcomer.y - B.y) / PX).toFixed(0)} m)`);
    state.spawnT = 1e9;
    const avg = () => C.attackers.reduce((k, e) => k + Math.hypot(e.x - B.x, e.y - B.y), 0) / C.attackers.length;
    ticks(4 * 60);
    assert.eq(C.phase, 'push', 'pushing after the gather');
    const d0 = avg(); ticks(10 * 60);
    assert.ok(!state.counter || avg() < d0 - 2 * PX, 'they closed on B');
  });
  t.test('repelled: every attacker down means a banner, two more reserves gone and 60 s before the next', () => {
    const { B } = heldScene();
    spawnNear('grunt', B, 900, 0); spawnNear('grunt', B, -900, 200);
    const C = waitStart(40);
    ticks(7 * 60);
    const down0 = state.enemyDown;
    for (const e of C.attackers.slice()) { const i = enemies.indexOf(e); if (i >= 0) hurtEnemy(i, 99, { player: true, wkey: 'ar' }, null); }
    const afterKills = state.enemyDown;
    bannerQueue.length = 0; tick(1 / 60);
    assert.eq(state.counter, null, 'over');
    assert.eq(state.counterLast, 'repelled');
    assert.eq(state.enemyDown, afterKills + 2, 'two more reserves spent');
    assert.ok(bannerQueue.includes('COUNTERATTACK REPELLED') || el.banner.textContent === 'COUNTERATTACK REPELLED', 'banner');
    assert.ok(state.counterNext >= state.frontTime + 59, 'the next waits 60 s');
    assert.ok(afterKills >= down0 + 2, 'the kills themselves counted');
  });
  t.test('lost: taking B ends it; timed out: after 60 s it just stops, with nothing spent', () => {
    const { B } = heldScene();
    spawnNear('grunt', B, 900, 0);
    waitStart(40);
    B.owner = null; B.cap = 0; tick(1 / 60);
    assert.eq(state.counter, null); assert.eq(state.counterLast, 'taken');
    const s2 = heldScene();
    const e = spawnNear('grunt', s2.B, 1600, 0); e.sp = 0;
    waitStart(40);
    const down0 = state.enemyDown;
    e.sp = 0; e.tac = 'hold'; e.tacT = 1e9;
    ticks(61 * 60, 0, () => { e.x = s2.B.x + 1600; e.y = s2.B.y; e.tacT = 1e9; e.path = null; });
    assert.eq(state.counterLast, 'timeout', 'timed out');
    assert.eq(state.enemyDown, down0, 'nothing spent');
  });
});
