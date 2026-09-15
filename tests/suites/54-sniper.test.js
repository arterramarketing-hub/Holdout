// The rooftop sniper: when it comes, the perches, the glint before every shot, what it can and can't see, its round,
// killing it, ducking, the FOB, and the callout.
suite('rooftop sniper', t => {
  function perched(perchName, heroAt) {   // a marksman on a named perch and you at a point (metres)
    newCampaign(); seed(11);
    const h = battle({ clear: true });
    benchSquad(); setupObjectives([]);
    h.x = heroAt[0] * PX; h.y = heroAt[1] * PX; h.hp = 1e6; h.maxHp = 1e6; h.invuln = 0;
    const p = PERCHES.find(q => q.name === perchName);
    const hx = h.x, hy = h.y; h.x = 5 * PX; h.y = 70 * PX;   // out of the way while it takes a perch, then back
    spawnEnemy('sniper');
    const e = enemies[enemies.length - 1];
    enemies.length = 0; enemies.push(e);
    h.x = hx; h.y = hy;
    assert.ok(e.sniper, 'a marksman');
    Object.assign(e, { x: p.x * PX, y: p.y * PX, z: p.z * PX, lip: p.lip * PX, perch: p });
    return { h, e, p };
  }
  const shotsFrom = () => enemies.reduce((n, e) => n + (e.shots || 0), 0);
  t.test('it comes only from 25% at tier 1, one at a time, and not within 40 s of the last', () => {
    newCampaign(); seed(3);
    battle({ clear: true }); benchSquad();
    for (const s of soldiers) if (s.alive) { s.x = 10 * PX; s.y = 66 * PX; }
    const tries = () => { let n = 0; for (let i = 0; i < 200; i++) if (sniperWanted()) n++; return n; };
    state.progress = 10; assert.eq(tries(), 0, 'not at 10%');
    state.progress = 30; assert.range(tries(), 40, 110, 'about a third of arrivals at 30%');
    spawnEnemy('sniper');
    assert.ok(enemies[enemies.length - 1].sniper, 'spawned onto a perch');
    assert.eq(tries(), 0, 'never two at once');
    const i = enemies.findIndex(e => e.sniper); hurtEnemy(i, 99, { player: true, wkey: 'ar' }, null);
    state.progress = 30;
    assert.eq(tries(), 0, 'not straight after one falls');
    state.frontTime += 41;
    assert.ok(tries() > 0, 'again after 40 s');
    state.progress = 0; state.tier = 3;
    assert.ok(tries() > 0, 'from the start at tier 3');
  });
  t.test('every perch is up off the ground, free of buildings, and sees a good part of the town around it', () => {
    newCampaign(); battle({ clear: true });
    for (const p of PERCHES) {
      const x = p.x * PX, y = p.y * PX, z = (p.z + 1.05) * PX;
      assert.ok(p.z >= 2.5, p.name + ' is up high');
      assert.ok(!buildings.some(b => insideShape(b, x, y) && b.top > p.z * PX + 1), p.name + ' is not inside a building');
      let clear = 0, n = 0;
      for (let a = 0; a < TAU; a += TAU / 24) for (const r of [12, 20, 30]) {
        const gx = x + Math.cos(a) * r * PX, gy = y + Math.sin(a) * r * PX;
        if (gx < 40 || gy < 40 || gx > CFG.arenaW - 40 || gy > CFG.arenaH - 40 || buildings.some(b => insideShape(b, gx, gy))) continue;
        n++; if (los3(x, y, z, gx, gy, 1.1 * PX)) clear++;
      }
      assert.ok(clear / n >= 0.2, `${p.name} sees ${clear} of ${n} street points`);
    }
  });
  t.test('the scope glints for 1.4 s before every shot, at a soldier it can see', () => {
    const { h, e } = perched('Bell tower', [62, 44]);
    let glintT = 0, shots = 0;
    const gaps = [];
    for (let i = 0; i < 60 * 12; i++) {
      tick(1 / 60);
      if (e.glint > 0) glintT += 1 / 60;
      const n = shotsFrom();
      if (n > shots) { gaps.push(glintT); glintT = 0; shots = n; }
    }
    assert.ok(gaps.length >= 2, 'fired ' + gaps.length);
    assert.ok(gaps.every(g => g >= SNIPER.aim - 0.05), 'glinting before each: ' + gaps.map(g => g.toFixed(2)).join(', '));
  });
  t.test('no shot at a soldier hidden in 3D, too far below to look up at it, or in the FOB', () => {
    const { h, e } = perched('Bell tower', [30, 37]);   // behind the church
    ticks(60 * 8);
    assert.eq(shotsFrom(), 0, 'the church hides you');
    const u = perched('Bell tower', [44, 36]);   // in the open, right under the belfry
    ticks(60 * 8);
    assert.eq(shotsFrom(), 0, 'too steep below it: you could not look up at it either');
    assert.eq(e.glint, 0);
    const f = perched('Gas station roof', [60, 66]);   // inside the FOB, in the open
    ticks(60 * 8);
    assert.eq(shotsFrom(), 0, 'never into the FOB');
  });
  t.test('its round does 2.5, never a headshot, and two in a row drop a soldier at full health', () => {
    const { h, e } = perched('Bell tower', [62, 44]);
    h.hp = h.maxHp = CFG.baseHp;
    const hp0 = h.hp;
    let first = null;
    for (let i = 0; i < 60 * 12 && h.alive; i++) { tick(1 / 60); if (first == null && h.hp < hp0) first = hp0 - h.hp; if (h.alive) h.regenCd = 99; }
    assert.near(first, 2.5, 0.01, 'one round');
    assert.ok(!h.alive, 'the second drops you');
    assert.ok(e.dmg < CFG.baseHp, 'never a one-shot at tier 1');
    state.tier = 9; const e2 = G.spawn('grunt', 0, 0); perchSniper(e2);
    assert.ok(e2.dmg < CFG.baseHp, 'nor in the hardest sectors: ' + e2.dmg);
  });
  t.test(`it takes a rifleman's hits: three M4 rounds at 15 m, four at the bell tower's 30 m; its sill stops rounds; no blast from the street reaches it`, () => {
    const shootAt = (h, e, z) => { e.supp = -99; e.duckT = 0; aim.ads = true; aimAt(h, e.x, e.y, z); aim.fire = true; h.fireCd = 0; tick(1 / 60); aim.fire = false; aim.ads = false; for (let i = 0; i < 40; i++) tick(1 / 60); };   // down the sights: a tight group
    const hitsToKill = (e, h) => { let n = 0; while (enemies.includes(e) && n < 8) { shootAt(h, e, e.z + bodyTop(e) * 0.62); n++; } return n; };
    const tower = perched('Bell tower', [62, 44]);
    tower.h.invuln = 1e9;
    const hp0 = tower.e.hp;
    fragBlast({ x: tower.e.x + 30, y: tower.e.y, z: 0 }); explode(tower.e.x + 30, tower.e.y, 90, 5, 0, { player: true, wkey: 'rocket' });
    assert.eq(tower.e.hp, hp0, 'no blast from the street reaches it');
    shootAt(tower.h, tower.e, tower.e.z - 0.1 * PX);
    assert.eq(tower.e.hp, hp0, 'into the sill: nothing');
    assert.eq(hitsToKill(tower.e, tower.h), 4, 'four from the square, 30 m off');
    const c = corpses[corpses.length - 1];
    assert.near(c.z, PERCHES[0].z * PX, 1, 'and it lies up there');
    const shop = perched('Gas station roof', [70, 43.7]);
    shop.h.invuln = 1e9;
    const spot = (() => {   // somewhere 13-17 m off with a clear line from the eyes to its chest
      const e = shop.e, tz = e.z + bodyTop(e) * 0.62;
      for (let r = 13; r <= 17; r += 1) for (let a = 0; a < TAU; a += TAU / 48) {
        const x = e.x + Math.cos(a) * r * PX, y = e.y + Math.sin(a) * r * PX;
        if (x < 60 || y < 60 || x > CFG.arenaW - 60 || y > CFG.arenaH - 60 || inFob(x, y) || buildings.some(b => insideShape(b, x, y)) || obstacles.some(o => insideShape(o, x, y))) continue;
        if (los3(x, y, 1.62 * PX, e.x, e.y, tz)) return { x, y };
      }
      return null;
    })();
    assert.ok(spot, 'a clear shot at the roof exists');
    shop.h.x = spot.x; shop.h.y = spot.y;
    assert.eq(hitsToKill(shop.e, shop.h), 3, 'three from 15 m, like any rifleman');
  });
  t.test('rounds cracking past send it down for 2 s, with no glint meanwhile', () => {
    const { h, e } = perched('Bell tower', [62, 44]);
    h.invuln = 1e9;
    ticks(40);
    assert.ok(e.glint > 0, 'lining up');
    for (let k = 0; k < 4; k++) bullets.push({ x: e.x + 30, y: e.y - 40, z: e.z + PX, vx: 0, vy: 3000, vz: 0, ballistic: true, life: 0.05, age: 0, fromPlayer: true, wkey: 'ar', slot: 0, dmg: 0, hits: 0, maxHits: 1, aoe: 0 });   // cracking past, clear of the tower
    tick(1 / 60); tick(1 / 60);
    assert.ok(e.duckT > 0 && e.glint === 0, 'ducked');
    ticks(60);
    assert.ok(e.duckT > 0, 'still down after 1 s');
    ticks(80);
    assert.ok(e.duckT <= 0, 'back up after 2 s');
  });
  t.test('the squad calls it by its perch; the minimap shows it only while it glints', () => {
    const { h, e } = perched('Bell tower', [62, 44]);
    h.invuln = 1e9;
    ticks(30);
    assert.ok(state.callout && state.callout.side === 'sniper' && state.callout.name === 'Bell tower', 'called');
    G.frame(1 / 60);
    assert.eq($('callout').textContent, 'Sniper · Bell tower');
  });
});
