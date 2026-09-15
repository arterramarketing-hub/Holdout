// Enemy frags: when a rifleman throws and when it doesn't, where it lands and when it bursts, what it hurts, the
// marker and the callout, and squadmates getting clear.
suite('enemy grenades', t => {
  function scene({ dist = 15, cover = 'car', frontTime = 30, heroAt = [48, 40], seedN = 7 } = {}) {   // a rifleman `dist` m north of you
    newCampaign(); seed(seedN);
    const h = battle({ clear: true });
    benchSquad(); setupObjectives([]);
    h.x = heroAt[0] * PX; h.y = heroAt[1] * PX; clearArea(h.x, h.y - dist * PX / 2, dist * PX / 2 + 300);
    h.hp = 1e6; h.maxHp = 1e6; h.invuln = 0; h.bornT = -99;
    if (cover) addCover(cover, heroAt[0], heroAt[1] - 1.1, 1);
    const e = G.spawn('grunt', h.x, h.y - dist * PX); e.sp = 0; e.hp = 1e6; e.objRole = false;
    state.frontTime = frontTime; state.eFragAt = -99;
    return { h, e };
  }
  const hostile = () => grenades.find(g => g.hostile);
  const watch = (seconds, each) => { for (let i = 0; i < seconds * 60; i++) { tick(1 / 60); if (each && each() === false) return i / 60; } return seconds; };
  t.test('a soldier behind a car at 15 m draws a frag after 3 s, aimed 0.5-2 m past them, bursting 1.8 s after it lands', () => {
    const { h, e } = scene();
    let g = null;
    const when = watch(12, () => { g = hostile(); return !g; });
    assert.ok(g, 'a frag was thrown');
    assert.range(when, 2.9, 12, 'after at least 3 s behind the car');
    assert.eq(e.frags, 0, 'the rifleman used its one frag');
    assert.range(Math.hypot(g.aimX - h.x, g.aimY - h.y) / PX, 0.5, 2, 'aimed near you');
    assert.ok((g.aimY - h.y) * (h.y - e.y) >= -1e-6 || Math.abs(g.aimY - h.y) < 0.2 * PX, 'past you, over the car');
    assert.near(g.fuse - (g.landAt - state.frontTime), CFG.eFragAfter, 0.05, 'bursts 1.8 s after landing');
    let last = null;
    watch(7, () => { if (!grenades.includes(g)) return false; last = { x: g.x, y: g.y, z: g.z }; });
    assert.ok(last && !grenades.includes(g), 'it burst');
    assert.ok(Math.hypot(last.x - h.x, last.y - h.y) < 4 * PX, `burst beside you (${(Math.hypot(last.x - h.x, last.y - h.y) / PX).toFixed(1)} m, ${(last.z / PX).toFixed(1)} m up)`);
  });
  t.test('no frag at a soldier in the open, beyond 22 m, inside 8 m, or in the first 25 s', () => {
    for (const [label, opts] of [['in the open', { cover: null }], ['beyond 22 m', { dist: 24 }], ['inside 8 m', { dist: 6.5 }], ['first 25 s', { frontTime: 5 }]]) {
      scene(opts);
      watch(opts.frontTime === 5 ? 15 : 8);
      assert.ok(!hostile() && !state.lastEnemyFragSeen, label);
    }
  });
  t.test('one enemy frag in the air at a time, and one every 14 s at the first tier', () => {
    const { h, e } = scene();
    const e2 = G.spawn('grunt', h.x + 1.2 * PX, h.y - 15 * PX); e2.sp = 0; e2.hp = 1e6; e2.objRole = false;
    let first = null, thrown = 0, lastT = null;
    watch(30, () => {
      const g = hostile();
      if (g && g !== first) { if (first) assert.ok(state.frontTime - lastT >= 14 - 1e-6, 'the gap holds: ' + (state.frontTime - lastT).toFixed(2)); first = g; lastT = state.frontTime; thrown++; }
      assert.ok(grenades.filter(q => q.hostile).length <= 1, 'never two in the air');
    });
    assert.range(thrown, 1, 2, 'two riflemen, at most one frag per gap');
  });
  t.test('no frag with a building in the arc, at someone just back, or into the FOB', () => {
    newCampaign(); seed(2);
    const h = battle({ clear: true });
    benchSquad(); setupObjectives([]);
    h.hp = 1e6; h.maxHp = 1e6; h.bornT = -99; state.frontTime = 30;
    h.x = 58.5 * PX; h.y = 29 * PX;
    const e = G.spawn('grunt', 58.5 * PX, 17 * PX); e.sp = 0; e.hp = 1e6; e.objRole = false;   // a house between you
    watch(8);
    assert.ok(!hostile(), 'nothing thrown over a two-storey house');
    const s2 = scene(); s2.h.bornT = state.frontTime;
    watch(3.8);
    assert.ok(!hostile(), 'not at someone who came back under 4 s ago');
    scene({ heroAt: [55, 66] });
    watch(8);
    assert.ok(!hostile(), 'never into the FOB');
  });
  t.test('the blast: lethal at a metre, about 2 at 3 m, nothing through a wall, never an enemy; squadmates at 70%', () => {
    const { h } = scene({ cover: null });
    const blastAt = (dx, dy) => { const hp0 = h.hp; fragBlast({ x: h.x + dx, y: h.y + dy, z: 0, hostile: true }); return hp0 - h.hp; };
    assert.ok(blastAt(40, 0) >= 4, 'a metre away takes all four');
    assert.range(blastAt(120, 0), 1.6, 2.6, 'three metres away');
    const e = G.spawn('grunt', h.x + 60, h.y); const ehp = e.hp;
    blastAt(80, 0);
    assert.eq(e.hp, ehp, 'the enemy beside it is untouched');
    const house = buildings.find(b => b.style === 'house0' && Math.abs(b.x - 58.5 * PX) < 1);
    h.x = house.x; h.y = house.y + house.hd + 30;
    const hp0 = h.hp; fragBlast({ x: house.x, y: house.y - house.hd - 30, z: 0, hostile: true });
    assert.eq(h.hp, hp0, 'the house takes it');
    const m = soldiers[1]; Object.assign(m, { alive: true, hp: 100, maxHp: 100, respawnT: 0, x: h.x + 120, y: h.y, invuln: 0 });
    h.x -= 2000;
    fragBlast({ x: m.x - 120, y: m.y, z: 0, hostile: true });
    const mateDmg = 100 - m.hp;
    assert.range(mateDmg, 1.1, 1.8, 'a squadmate 3 m off takes 70%');
  });
  t.test('the marker shows a live enemy frag within 10 m and points at it; the callout says GRENADE', () => {
    const { h } = scene({ cover: null });
    aim.yaw = 0; cam.yaw = 0;
    grenades.push({ x: h.x, y: h.y + 8 * PX, z: 0, vx: 0, vy: 0, vz: 0, fuse: 2, spin: 0, hostile: true, rest: true, tinkT: 0 });
    tick(1 / 60); G.frame(1 / 60);
    const nw = $('nadewarn');
    assert.eq(nw.style.display, 'block', 'the marker shows');
    const r = nw.getBoundingClientRect();
    assert.ok(r.top + r.height / 2 > innerHeight / 2 + 20, 'below the crosshair: the frag is behind you');
    assert.ok(state.callout && state.callout.side === 'grenade', 'called');
    G.frame(1 / 60);
    assert.ok(/^Grenade · 8 m$/.test($('callout').textContent), 'callout: ' + $('callout').textContent);
    grenades.length = 0;
    grenades.push({ x: h.x, y: h.y + 8 * PX, z: 0, vx: 0, vy: 0, vz: 0, fuse: 2, spin: 0, owner: 0, rest: true, tinkT: 0 });
    tick(1 / 60); G.frame(1 / 60);
    assert.eq(nw.style.display, 'none', 'your own frag only shows within 6 m');
    grenades.length = 0;
  });
  t.test('a squadmate 3 m from a landed enemy frag is at least 5 m away when it bursts', () => {
    const { h } = scene({ cover: null });
    h.x -= 1500;
    const m = soldiers[1]; Object.assign(m, { alive: true, hp: 1e6, maxHp: 1e6, respawnT: 0, x: 48 * PX, y: 40 * PX, invuln: 0 });
    clearArea(m.x, m.y, 500);
    enemies.length = 0;
    const g = { x: m.x + 3 * PX, y: m.y, z: 0, vx: 0, vy: 0, vz: 0, fuse: CFG.eFragAfter, spin: 0, hostile: true, rest: true, tinkT: 0 };
    grenades.push(g);
    let at = null;
    watch(3, () => { if (!grenades.includes(g)) { at = Math.hypot(m.x - g.x, m.y - g.y) / PX; return false; } });
    assert.ok(at != null && at >= 5, `${at && at.toFixed(1)} m away when it burst`);
  });
});
