// v8: telling friend from foe, information you earn, the new killstreaks, blood, the cemetery.
const lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
function squadScene() {   // you on Main Street facing north, your three teammates spread out ahead
  newCampaign(); seed(8);
  const h = battle({ clear: true });
  setupObjectives([]);
  h.x = 48 * PX; h.y = 48 * PX; aim.yaw = 0; aim.pitch = 0; cam.yaw = 0;
  soldiers.filter(s => s.slot !== state.controlled).forEach((m, i) => { m.alive = true; m.invuln = 1e9; m.fireCd = 999; m.x = h.x + (i - 1) * 3 * PX; m.y = h.y - (8 + i * 6) * PX; });
  return h;
}
suite('friend or foe', t => {
  t.test('a green triangle and a name over every living teammate in view, never over you', () => {
    const h = squadScene();
    frames(2);
    const mates = soldiers.filter(s => s.slot !== state.controlled);
    for (const m of mates) {
      const tag = $('mate' + m.slot);
      assert.eq(tag.style.display, 'flex', 'a tag over ' + meta.squad[m.slot].name);
      assert.ok(tag.textContent.toUpperCase().includes(meta.squad[m.slot].name.toUpperCase()), 'named: ' + tag.textContent);
      assert.eq(getComputedStyle(tag, '::after').borderTopColor.replace(/\s/g, ''), 'rgb(95,220,74)', 'the triangle is green');
    }
    assert.eq($('mate' + state.controlled).style.display, 'none', 'nothing over your own head');
    const r = $('mate' + mates[0].slot).getBoundingClientRect();
    toScreen(mates[0].x, mates[0].y, (soldierTop(mates[0]) / PX + 0.3) / ZS);
    assert.near(r.left + r.width / 2, SCR.x, 1.5, 'centred over them');
    assert.near(r.bottom, SCR.y, 1.5, 'the point of the triangle just above the head');
    mates[0].alive = false; frames(1);
    assert.eq($('mate' + mates[0].slot).style.display, 'none', 'gone when they fall');
    mates[2].y = h.y - 40 * PX; frames(1);
    assert.ok($('mate' + mates[2].slot).classList.contains('far'), 'past 35 m: the triangle alone');
    aim.yaw = Math.PI; cam.yaw = Math.PI; frames(2);
    assert.ok(mates.every(m => $('mate' + m.slot).style.display === 'none'), 'nothing for teammates behind you');
    aim.yaw = 0; cam.yaw = 0; mates[1].alive = true; mates[1].x = h.x + 8 * PX; mates[1].y = h.y - 10 * PX;   // well off to the right
    frames(2);
    assert.eq($('mate' + mates[1].slot).style.display, 'flex', 'seen from the hip');
    h.weapon = 'sniper'; h.sight = 'scope'; aim.ads = true; frames(2, 0.5);
    assert.eq($('sight').style.display, 'block', 'behind the 6x scope');
    assert.eq($('mate' + mates[1].slot).style.display, 'none', 'no name floating on the blackout outside the glass');
    aim.ads = false;
  });
  t.test('the enemy is dark with a red armband; your squad is light', () => {
    const us = soldierPalette(1, slotColor(1), slotDark(1)), them = enemyPalette(ETYPES.grunt.col);
    assert.ok(lum(them.coat) < lum(us.coat) * 0.5, `their jackets are less than half as light as ours (${lum(them.coat).toFixed(3)} vs ${lum(us.coat).toFixed(3)})`);
    assert.ok(lum(them.pants) < lum(us.pants) * 0.5, 'and their trousers');
    assert.ok(them.armband.r > 0.4 && them.armband.g < 0.15 && them.armband.b < 0.15, 'the armband is red');
    const rows = ENEMY_ROWS.grunt();
    assert.eq(rows.filter(p => p[8] === 'armband').length, 2, 'an armband on each arm');
    for (const type of Object.keys(ENEMY_ROWS)) assert.ok(ENEMY_ROWS[type]().some(p => p[8] === 'armband'), type + ' wears it too');
  });
});

suite('information you earn', t => {
  const mapPixel = (dxm, dym) => {   // the minimap's colour a given number of metres right/up of centre, as drawn
    drawMinimap();
    const c = $('minimap'), g = c.getContext('2d'), sc = c.width / 1600;
    const d = g.getImageData(Math.round(c.width / 2 + dxm * PX * sc), Math.round(c.height / 2 - dym * PX * sc), 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  };
  const red = p => p.r > 150 && p.g < 110 && p.b < 110;
  t.test('the minimap turns with you: what is ahead of you is up, whichever way you face', () => {
    const h = squadScene();
    for (const s of soldiers) if (s.slot !== state.controlled) { s.alive = false; s.x = -999; }
    const e = G.spawn('grunt', h.x + 10 * PX, h.y); e.sp = 0; e.ranged = 0; e.firedT = state.frontTime;   // 10 m east of you, and it has just fired
    aim.yaw = Math.PI / 2; cam.yaw = Math.PI / 2;   // facing east
    assert.ok(red(mapPixel(0, 10)), 'facing east, the enemy to the east is straight up the map');
    aim.yaw = 0; cam.yaw = 0;   // facing north
    assert.ok(red(mapPixel(10, 0)), 'facing north, it is off to the right');
    assert.ok(!red(mapPixel(0, 10)), 'and no longer up');
  });
  t.test('an enemy shows on the minimap only for a moment after it fires, or while a UAV is up', () => {
    const h = squadScene();
    for (const s of soldiers) if (s.slot !== state.controlled) { s.alive = false; s.x = -999; }
    aim.yaw = 0; cam.yaw = 0;
    const e = G.spawn('grunt', h.x, h.y - 8 * PX); e.sp = 0; e.ranged = 0;   // 8 m ahead: close, but quiet
    e.firedT = null;
    assert.ok(!red(mapPixel(0, 8)), 'close and quiet: not shown');
    e.firedT = state.frontTime;
    assert.ok(red(mapPixel(0, 8)), 'just fired: shown');
    state.frontTime += MINIMAP_FIRED + 0.1;
    assert.ok(!red(mapPixel(0, 8)), 'gone again a moment later');
    state.uavT = 10;
    assert.ok(red(mapPixel(0, 8)), 'under a UAV: shown, fired or not');
    state.uavT = 0;
  });
});

suite('killstreaks', t => {
  const streakScene = () => {
    newCampaign(); seed(14);
    const h = battle({ clear: true });
    benchSquad(); setupObjectives([]);
    return h;
  };
  const kill = () => { const e = G.spawn('grunt', 20 * PX, 20 * PX); hurtEnemy(enemies.indexOf(e), 99, { player: true, wkey: 'ar', slot: state.controlled }, null); };
  t.test('UAV at two kills, napalm at four, airstrike at six, each in the HUD by name', () => {
    streakScene();
    assert.eq(KILLSTREAKS.map(k => k.at + ' ' + k.key).join(', '), '2 uav, 4 napalm, 6 airstrike');
    const earned = () => ['uav', 'napalm', 'airstrike'].map(k => state.earned[k]).join('');
    kill(); assert.eq(earned(), '000', 'one kill: nothing yet');
    kill(); assert.eq(earned(), '100', 'two: the UAV');
    kill(); kill(); assert.eq(earned(), '110', 'four: napalm');
    kill(); kill(); assert.eq(earned(), '111', 'six: the airstrike');
    rebuildSupports();
    assert.eq([...el.supports.querySelectorAll('.ks-name')].map(n => n.textContent).join(' / '), 'UAV / NAPALM / AIRSTRIKE');
    assert.eq(typeof SUPPORTS.artillery, 'undefined', 'no artillery');
    assert.eq(typeof SUPPORTS.supply, 'undefined', 'no supply drop');
  });
  t.test('the UAV puts every enemy on your minimap for 30 s, and says so', () => {
    const h = streakScene();
    state.earned.uav = 1;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
    assert.eq(state.earned.uav, 0, '1 calls it');
    assert.near(state.uavT, CFG.uavTime, 0.01, 'up for 30 s');
    rebuildSupports();
    assert.ok(/ONLINE/.test(el.supports.children[0].textContent), 'the chip says ONLINE');
    ticks(60 * 31);
    assert.eq(state.uavT, 0, 'and it leaves');
  });
  t.test('the airstrike lays a line of bombs across the enemy push, and the kills are yours', () => {
    const h = streakScene();
    h.x = 48 * PX; h.y = 66 * PX;
    const line = [-3, -1.5, 0, 1.5, 3].map(dx => { const e = G.spawn('grunt', (48 + dx) * PX, 30 * PX); e.sp = 0; e.ranged = 0; e.dmg = 0; return e; });
    const kills = state.kills;
    h.invuln = 0;   // so the last check means something
    state.earned.airstrike = 1; useSupport('airstrike');
    assert.ok(state.flyby, 'the jet comes over');
    const bombs = shells.filter(sh => sh.kind === 'bomb');
    assert.eq(bombs.length, AIRSTRIKE.bombs, 'a stick of bombs');
    const xs = bombs.map(b => b.x), ts = bombs.map(b => b.t);
    assert.ok(Math.max(...xs) - Math.min(...xs) > 400, 'spread along the jet\'s path');
    assert.ok(ts.every((t, i) => i === 0 || t >= ts[i - 1]), 'falling in order along it');
    ticks(120);
    assert.eq(shells.length, 0, 'all down');
    assert.ok(line.every(e => !enemies.includes(e)), 'the line of riflemen under it is gone: ' + line.filter(e => enemies.includes(e)).length + ' left');
    assert.eq(state.kills - kills, line.length, 'every kill yours');
    assert.ok(h.alive && h.hp === h.maxHp, 'you, 36 m back, untouched');
  });
});

suite('blood', t => {
  const range8 = () => {
    newCampaign(); seed(21);
    const h = battle({ weapon: 'ar', clear: true });
    benchSquad(); setupObjectives([]);
    h.x = 48 * PX; h.y = 48 * PX; clearArea(h.x, h.y - 200, 500);
    const e = G.spawn('grunt', h.x, h.y - 8 * PX); e.sp = 0; e.ranged = 0; e.dmg = 0; e.hp = e.maxHp = 1e6;
    splats.length = 0; particles.length = 0;
    return { h, e };
  };
  t.test('a hit throws a mist where the round went in, droplets along its path, and a splat on the ground behind', () => {
    const { h, e } = range8();
    const tz = bodyTop(e) * 0.62;
    aimAt(h, e.x, e.y, tz); aim.ads = true;
    h.fireCd = 0; aim.fire = true; tick(1 / 60); aim.fire = false;
    let seenZ = null;
    for (let k = 0; k < 30 && !particles.some(p => p.kind === 'mist'); k++) { const b = bullets.find(q => q.fromPlayer); if (b) seenZ = b.z; tick(1 / 60); }
    aim.ads = false;
    const mist = particles.find(p => p.kind === 'mist');
    assert.ok(mist, 'a mist');
    assert.near(mist.z * ZS, tz / PX, 0.25, 'at the height the round struck (m)');
    assert.ok(particles.filter(p => !p.kind && /^#[69]/.test(p.col)).length >= 6, 'droplets');
    assert.eq(splats.length, 1, 'one splat');
    const sp = splats[0];
    assert.ok(sp.y < e.y && e.y - sp.y < 1.3 * PX, 'on the ground behind him, along the shot: ' + ((e.y - sp.y) / PX).toFixed(2) + ' m');
  });
  t.test('a round into a breacher\'s riot shield sparks and does not bleed; one in his back does', () => {
    const { e } = range8();
    const brute = G.spawn('brute', e.x + 3 * PX, e.y); brute.sp = 0; brute.hp = brute.maxHp = 1e6; brute.aim = Math.PI / 2;   // facing south, toward you
    particles.length = 0; splats.length = 0;
    hurtEnemy(enemies.indexOf(brute), 1, { player: true, wkey: 'ar' }, { x: 0, y: -1 });   // a round travelling north: into his face and shield
    assert.eq(splats.length, 0, 'no splat off the shield');
    assert.ok(!particles.some(p => p.kind === 'mist'), 'no mist');
    hurtEnemy(enemies.indexOf(brute), 1, { player: true, wkey: 'ar' }, { x: 0, y: 1 });    // travelling south: into his back
    assert.eq(splats.length, 1, 'a hit from behind bleeds');
  });
  t.test('a fire does not bleed its victims every frame, and the ground keeps at most 64 splats', () => {
    const { e } = range8();
    fires.push({ x: e.x, y: e.y, r: 30, t: 3 });
    ticks(120);
    assert.eq(splats.length, 0, 'burning leaves no splats');
    assert.ok(particles.filter(p => p.kind === 'mist').length === 0, 'and no mist');
    fires.length = 0;
    for (let i = 0; i < 90; i++) hurtEnemy(enemies.indexOf(e), 1, { player: true, wkey: 'ar' }, { x: 0, y: -1 });
    assert.eq(splats.length, SPLAT_CAP, 'capped');
  });
  t.test('blood rolls its own dice: bleeding draws nothing from the fight\'s', () => {
    const { e } = range8();
    let draws = 0;
    const fightDice = Math.random;
    Math.random = () => { draws++; return fightDice(); };
    try { for (let i = 0; i < 25; i++) bleed(e, 1.05, i % 3 === 0, i % 2 ? { x: 0, y: -1, z: 50 } : null); }
    finally { Math.random = fightDice; }
    assert.eq(draws, 0, 'draws from the simulation\'s random numbers');
    assert.ok(splats.length > 0 && particles.some(p => p.kind === 'mist'), 'and it still bled');
  });
});

suite('the cemetery and the fallen', t => {
  t.test('nothing is planted where a soldier falls', () => {
    newCampaign(); seed(3);
    const h = battle({ clear: true, invuln: false });
    assert.eq(typeof markers, 'undefined', 'no battlefield crosses kept');
    h.hp = 0.1; damageSoldier(h, 5);
    assert.ok(!h.alive, 'down');
    frames(2);   // and the view draws the fall without one
  });
  t.test('every grave is a headstone: four shapes, dressed stone, under the height rounds are stopped at', () => {
    const graves = TOWN.fixed.filter(f => f[0] === 'grave');
    assert.eq(graves.length, 20, 'the churchyard\'s twenty');
    const Y = { box: [-0.5, 0.5], dome: [0, 0.5], gable: [0, 1] }, shapes = new Set();   // each unit shape's height range
    let leaning = 0;
    for (const [, gx, gz] of graves) {
      const T = { box: [], dome: [], gable: [] };
      tombstone(gx, gz, T);
      shapes.add([T.box.length, T.dome.length, T.gable.length].join(','));
      let highest = 0;
      for (const k of Object.keys(T)) for (const [m] of T[k]) for (const cx of [-0.5, 0.5]) for (const cz of [-0.5, 0.5]) for (const cy of Y[k])
        highest = Math.max(highest, new THREE.Vector3(cx, cy, cz).applyMatrix4(m).y);
      assert.ok(highest <= 0.97, `the stone at ${gx}, ${gz} stands ${highest.toFixed(2)} m, over the 0.9 m rounds stop at`);
      assert.ok(highest >= 0.7, `and it is a headstone, not a kerb (${highest.toFixed(2)} m)`);
      const stone = T.box[2][0], up = new THREE.Vector3(0, 1, 0).transformDirection(stone);
      if (up.y < 0.9995) leaning++;
    }
    assert.ok(shapes.size >= 3, 'at least three of the four shapes in the rows: ' + [...shapes].join(' | '));
    assert.range(leaning, 1, 12, 'a few lean with age');
    const tombMesh = VIEW.scene.children.find(c => c.isInstancedMesh && c.geometry.type === 'ExtrudeGeometry');
    assert.ok(tombMesh && !tombMesh.material.map, 'dressed stone, not the town\'s brick texture');
  });
});
