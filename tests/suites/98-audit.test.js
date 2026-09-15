// Regressions found in the v6 audit, each kept so it cannot come back.
suite('audit regressions', t => {
  t.test('a frag killing seven at 86% cannot win the front before the Warlord has come', () => {
    newCampaign(); seed(5);
    const h = battle({ clear: true });
    benchSquad(); setupObjectives([]);
    h.x = 48 * PX; h.y = 44 * PX; clearArea(h.x, h.y - 500, 900);
    state.enemyDown = state.enemyTotal - 7; state.progress = state.enemyDown / state.enemyTotal * 100;
    for (let i = 0; i < 7; i++) { const e = G.spawn('grunt', h.x + (i - 3) * 30, h.y - 12 * PX); e.sp = 0; e.ranged = 0; }
    grenades.push({ x: h.x, y: h.y - 12 * PX, z: 0, vx: 0, vy: 0, vz: 0, fuse: 0.01, spin: 0, owner: h.slot, rest: true, tinkT: 0 });
    tick(1 / 60);
    assert.eq(enemies.length, 0, 'all seven down');
    assert.eq(state.mode, 'play', 'the front goes on');
    tick(1 / 60);
    assert.ok(state.bossSpawned && state.bossRef, 'the Warlord arrives');
  });
  t.test('a frag thrown with your face against a wall leaves from your own spot, not from inside the house', () => {
    newCampaign(); seed(5);
    const h = battle({ clear: true });
    benchSquad();
    const house = buildings.find(b => b.style === 'house1' && Math.abs(b.x - 7 * PX) < 1);
    h.x = 7 * PX; h.y = house.y + house.hd + h.r * 0.8 + 3; aim.yaw = 0; aim.pitch = 0; cam.yaw = 0;   // nose to the south wall, looking into it
    assert.ok(throwGrenade(h));
    const g = grenades[grenades.length - 1];
    assert.ok(!insideShape(house, g.x, g.y), 'not spawned inside the house');
    let inside = 0;
    while (grenades.includes(g)) { if (insideShape(house, g.x, g.y) && g.z < house.top) inside++; tick(1 / 60); }
    assert.eq(inside, 0, 'never inside the house');
  });
  t.test('a host that refuses the Gamepad API does not stop the game', () => {
    newCampaign(); battle({ clear: true });
    Object.defineProperty(navigator, 'getGamepads', { value: () => { throw new DOMException('Access to the feature "gamepad" is disallowed by permissions policy.', 'SecurityError'); }, configurable: true });
    const t0 = state.frontTime;
    ticks(30);
    assert.ok(state.frontTime > t0 + 0.4, 'the simulation kept running');
    buzz(60);
    Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true });
  });
  t.test('a controller can confirm the after-action card with nothing focused', () => {
    newCampaign(); battle({ clear: true });
    const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
    GPAD.prev = [];
    frontCleared();
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    pad.buttons[GPB.A] = { pressed: true, value: 1 }; tick(1 / 60); pad.buttons[GPB.A] = { pressed: false, value: 0 }; tick(1 / 60);
    assert.eq(screen, 'map', 'A took the card\'s main action');
    showScreen('team'); document.activeElement && document.activeElement.blur && document.activeElement.blur();
    pad.buttons[GPB.A] = { pressed: true, value: 1 }; tick(1 / 60); pad.buttons[GPB.A] = { pressed: false, value: 0 }; tick(1 / 60);
    assert.ok($('teamscr').contains(document.activeElement), 'on the loadout, A wakes the focus ring instead of leaving');
    Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true });
  });
  t.test('the range button before the 3D engine is ready opens the range once it is, not a real front', async () => {
    newCampaign(); hideModal(); showScreen('map');
    const realReady = threeReady;
    let release;
    VIEW.ready = false;
    threeReady = new Promise(r => { release = r; });
    enterTraining();
    assert.eq(screen, 'map', 'waiting on the map');
    assert.ok(/loading/i.test(el.modalbox.innerText), 'a loading card');
    VIEW.ready = true; release();
    await new Promise(r => setTimeout(r, 30));
    threeReady = realReady;
    assert.ok(state.training && screen === 'battle', 'the range opened');
    exitTraining();
  });
  t.test('your trigger is live the moment you deploy', () => {
    for (let i = 0; i < 6; i++) {
      newCampaign(); battle({ clear: true });
      assert.eq(hero().fireCd, 0, 'no leftover cooldown on your own rifle');
      aim.fire = true; tick(1 / 60); aim.fire = false;
      assert.eq(state.shots, 1, 'the first tick fires');
    }
  });
  t.test('Auto quality starts at High on every device', () => {
    meta.opts.quality = 'auto'; Q.opt = null; applyOpts();
    assert.eq(Q.level, 'high');
  });
});
