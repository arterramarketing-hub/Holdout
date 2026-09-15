suite('objectives', t => {
  function field(tid = 1) {   // a front with its objectives, nobody on the field but whom the test puts there
    newCampaign(); seed(9);
    const h = battle({ clear: true, tid });
    for (const s of soldiers) { s.alive = false; s.respawnT = 1e9; s.x = -999; s.y = -999; }
    h.alive = true; h.respawnT = 0; h.invuln = 1e9; h.x = 60 * PX; h.y = 66 * PX;   // you, waiting at the FOB
    return h;
  }
  const put = (u, o, dx = 0) => { u.x = o.x + dx; u.y = o.y; };
  const until = (cond, maxSec, each) => { let n = 0; while (!cond() && n < maxSec * 60) { if (each) each(); tick(1 / 60); n++; } return n / 60; };
  t.test('each sector has three objectives, lettered north to south, all starting in enemy hands', () => {
    for (let tid = 1; tid < TERRITORIES.length; tid++) {
      const sites = objectiveSites(tid);
      assert.eq(sites.length, 3, `sector ${tid}`);
      assert.eq(new Set(sites.map(s => s.name)).size, 3, `sector ${tid} distinct`);
      for (let i = 1; i < 3; i++) assert.ok(sites[i].y >= sites[i - 1].y, `sector ${tid} ordered`);
    }
    field(2);
    assert.deepEq(state.objs.map(o => o.letter + ':' + o.owner), ['A:e', 'B:e', 'C:e']);
  });
  t.test('every flag stands on open ground you can walk to', () => {
    field(1); buildNav();
    for (const site of OBJ_SITES) {
      const x = site.x * PX, y = site.y * PX;
      assert.ok(!spotBlocked(x, y, 20), `${site.name} is not inside a building or cover`);
      const p = navPath(60 * PX, 66 * PX, x, y, 12);
      assert.ok(p && p.length, `${site.name} has a path from the FOB`);
    }
  });
  t.test('one soldier takes an objective in 12 s, two in 9 s, three in 7 s — through neutral', () => {
    const out = {};
    for (const n of [1, 2, 3]) {
      const h = field(1), o = state.objs[0];
      const crew = [h, ...soldiers.filter(s => s !== h).slice(0, n - 1)];
      crew.forEach((s, i) => { s.alive = true; s.respawnT = 0; s.invuln = 1e9; put(s, o, i * 30); });
      let neutralAt = null;
      const secs = until(() => o.owner === 'p', 30, () => { crew.forEach((s, i) => put(s, o, i * 30)); if (neutralAt == null && o.owner === null) neutralAt = state.frontTime; });
      out[n] = +secs.toFixed(2);
      assert.near(secs, OBJ.flip[n], 0.1, `${n} soldier(s)`);
      assert.ok(neutralAt != null, 'passed through neutral');
    }
    return out;
  });
  t.test('both sides in the ring freeze it', () => {
    const h = field(1), o = state.objs[0];
    put(h, o);
    until(() => o.cap > -0.5, 10, () => put(h, o));
    const e = G.spawn('grunt', o.x + 40, o.y); e.sp = 0; e.ranged = 0; e.hp = 1e6;
    const cap0 = o.cap;
    until(() => false, 3, () => { put(h, o); e.x = o.x + 40; e.y = o.y; });
    assert.ok(o.contested, 'contested');
    assert.eq(o.cap, cap0, 'frozen');
  });
  t.test('taking one costs the enemy two reserves at once', () => {
    const h = field(1), o = state.objs[0];
    const d0 = state.enemyDown;
    put(h, o); until(() => o.owner === 'p', 20, () => put(h, o));
    assert.eq(state.enemyDown - d0, OBJ.capSpend);
  });
  t.test('holding more drains their reserves: one every 4 s, every 2 s with all three', () => {
    field(1);
    const gaps = () => { const at = []; let last = state.enemyDown; until(() => at.length >= 5, 30, () => { if (state.enemyDown !== last) { at.push(state.frontTime); last = state.enemyDown; } }); return at.slice(1).map((v, i) => +(v - at[i]).toFixed(2)); };
    state.objs[0].owner = 'p'; state.objs[0].cap = 1; state.objs[1].owner = 'p'; state.objs[1].cap = 1;
    const two = gaps();
    two.forEach(g => assert.near(g, OBJ.drainHold, 0.05, 'two of three'));
    state.objs[2].owner = 'p'; state.objs[2].cap = 1;
    gaps();   // the first gap after the switch is whatever was left on the old timer
    const all = gaps();
    all.forEach(g => assert.near(g, OBJ.drainAll, 0.05, 'all three'));
    return { twoOfThree: two, allThree: all };
  });
  t.test('the drain never finishes a front: it stops short of the enemies standing and the Warlord', () => {
    field(1);
    for (const o of state.objs) { o.owner = 'p'; o.cap = 1; }
    for (let i = 0; i < 3; i++) { const e = G.spawn('grunt', 10 * PX + i * 60, 5 * PX); e.sp = 0; e.ranged = 0; }
    until(() => false, 300);
    assert.eq(state.enemyDown, state.enemyTotal - 3 - 1, 'three standing and the Warlord\'s ticket left');
    assert.ok(state.mode === 'play', 'still fighting');
    assert.ok(state.bossSpawned, 'the Warlord came at 90%');
  }, { timeout: 120000 });
  t.test('when they hold more, your squad bleeds a reinforcement every 20 s after the first 45 s', () => {
    field(1);
    state.frontTime = 0;
    const t0 = state.tickets;
    until(() => false, 44);
    assert.eq(state.tickets, t0, 'no bleed in the grace period');
    until(() => false, 41);
    assert.eq(state.tickets, t0 - 2, 'two reinforcements by 85 s');
  }, { timeout: 120000 });
  t.test('enemies working objectives go to them', () => {
    const h = field(1);
    h.x = 60 * PX; h.y = 69 * PX;
    state.spawnT = 0;   // let the waves walk on
    let inRing = 0;
    until(() => false, 60, () => { h.invuln = 1e9; for (const o of state.objs) inRing = Math.max(inRing, o.inE); });
    assert.ok(enemies.some(e => e.objRole), 'some enemies have the job');
    assert.ok(inRing >= 1, 'an enemy stood in an objective ring');
    return { mostInARing: inRing };
  }, { timeout: 120000 });
  t.test('your AI squad takes objectives on its own', () => {
    newCampaign(); seed(4);
    const h = battle({ tid: 1 });
    h.x = 60 * PX; h.y = 69 * PX;
    let taken = 0;
    until(() => taken > 0, 200, () => { h.invuln = 1e9; h.x = 60 * PX; h.y = 69 * PX; aim.fire = false; taken = objHeld('p'); for (const s of soldiers) if (s !== h) s.invuln = 1e9; });
    assert.ok(taken >= 1, 'the squad took an objective');
    return { seconds: Math.round(state.frontTime), taken };
  }, { timeout: 180000 });
  t.test('the HUD shows each objective\'s owner and a capture in progress', () => {
    const h = field(1), o = state.objs[1];
    frames(1);
    assert.eq($('obj1').className.split(' ').includes('e'), true, 'B enemy');
    put(h, o); until(() => o.cap > -0.4, 10, () => put(h, o));
    frames(1);
    assert.ok(+$('obj1').dataset.p < 0.5 && $('obj1').dataset.c === 'var(--foe)', 'B bar shrinking');
    until(() => o.owner === 'p', 20, () => put(h, o));
    frames(1);
    assert.ok($('obj1').className.split(' ').includes('p'), 'B yours');
    assert.ok($('objmsg').classList.contains('on') && /taken/i.test($('objmsg').textContent), 'message');
  });
  t.test('the briefing names the sector\'s objectives', () => {
    newCampaign(); hideModal(); showScreen('map'); selectSector(1);
    for (const site of objectiveSites(1)) assert.ok($('brLine').textContent.includes(site.name), site.name);
  });
  t.test('a whole front with objectives still ends in FRONT SECURED', () => {
    newCampaign(); seed(1);
    battle();
    const r = botFront(600);
    assert.eq(r.mode, 'cleared', `ended ${r.mode} after ${r.seconds} s`);
    assert.range(r.seconds, 60, 300, 'front length (s)');
    return r;
  }, { timeout: 300000 });
});
