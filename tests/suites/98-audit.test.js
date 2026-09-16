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
  t.test('a blast reaches what is level with it: a rocket into the belfry kills the marksman, one in the street below does not', () => {
    newCampaign(); seed(6);
    const h = battle({ clear: true });
    benchSquad(); setupObjectives([]);
    h.x = 64 * PX; h.y = 40 * PX; h.invuln = 1e9;
    spawnEnemy('sniper');
    const e = enemies[enemies.length - 1], p = PERCHES[0];
    Object.assign(e, { x: p.x * PX, y: p.y * PX, z: p.z * PX, lip: p.lip * PX, perch: p });
    e.hp = e.maxHp = 12;   // it survives the first blast, so the second is measurable
    const hp0 = e.hp;
    explode(e.x + 20, e.y, 90, 3, 0, { player: true, wkey: 'rocket' }, 0);
    assert.eq(e.hp, hp0, 'a rocket into the tower foot does nothing');
    explode(e.x + 20, e.y, 90, 3, 0, { player: true, wkey: 'rocket' }, e.z + PX);
    assert.ok(e.hp < hp0, 'one at its own height hurts it');
    const hp1 = e.hp;
    fragBlast({ x: e.x + 20, y: e.y, z: e.z, hostile: false, owner: 0 });
    assert.ok(e.hp < hp1, 'and so does a frag up there');
  });
  t.test('with a card up, the battle keys and the mouse wheel wait', () => {
    newCampaign(); seed(6);
    const h = battle({ clear: true });
    h.mag = 4; h.reserve = 60;
    takeGun(h, dropGun('ak', h.x, h.y, 20, 30)); h.swapT = 0;
    showSettings();
    const held = h.weapon;
    dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' }));
    dispatchEvent(new WheelEvent('wheel', { deltaY: 120 }));
    dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
    assert.eq(h.reloadT, 0, 'R waits');
    assert.eq(h.weapon, held, 'the wheel and Q wait');
    hideModal();
    dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
    assert.ok(h.swapT > 0, 'and work again once the card is gone');
    ticks(40);
  });
  t.test('a card opening lets go of the controller trigger, sights and pickup', () => {
    newCampaign(); seed(6);
    const h = battle({ clear: true });
    dropGun('ak', h.x + 40, h.y, 20, 30);
    const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
    try {
      GPAD.prev = [];
      pad.buttons[GPB.RT] = { pressed: true, value: 1 };
      pad.buttons[GPB.LT] = { pressed: true, value: 1 };
      ticks(4);
      pad.buttons[GPB.X] = { pressed: true, value: 1 };
      ticks(4);
      assert.ok(aim.fire && aim.ads && aim.take, 'holding trigger, sights and X');
      showSettings();
      ticks(2);
      assert.ok(!aim.fire && !aim.ads && !aim.take, 'the card takes over and everything is let go');
      hideModal();
      pad.buttons[GPB.RT] = { pressed: false, value: 0 }; pad.buttons[GPB.LT] = { pressed: false, value: 0 }; pad.buttons[GPB.X] = { pressed: false, value: 0 };
      ticks(2);
    } finally { Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true }); ticks(2); }
  });
  t.test('taking a gun with the ground already full keeps the one you put down', () => {
    newCampaign(); seed(6);
    const h = battle({ clear: true });
    benchSquad(); setupObjectives([]);
    weaponDrops.length = 0;
    const first = dropGun('pkm', h.x + 30, h.y, 60, 100);
    for (let i = 0; i < 13; i++) dropGun('ak', h.x + 400 + i * 20, h.y + 400, 10, 30);
    assert.eq(weaponDrops.length, 14, 'the ground is full');
    takeGun(h, dropGun('ak', h.x, h.y, 25, 30));   // a free slot first
    h.swapT = 0;
    takeGun(h, first);
    assert.eq(h.weapon, 'pkm', 'the PKM is in your hands');
    assert.ok(!weaponDrops.includes(first), 'the one you took is off the ground');
    assert.ok(weaponDrops.some(d => d.key === 'ak' && Math.hypot(d.x - h.x, d.y - h.y) < 60), 'the AK you put down is still there');
  });
  t.test('a counterattack nobody can join says nothing and costs no cooldown', () => {
    newCampaign(); seed(6);
    battle({ clear: true });
    benchSquad();
    setupObjectives(objectiveSites(1));
    const B = state.objs[1];
    B.owner = 'p'; B.cap = 1; B.heldSince = 0;
    state.frontTime = 120; state.spawnT = 1e9;
    enemies.length = 0;
    bannerQueue.length = 0; el.banner.textContent = '';
    startCounterattack(B);
    assert.eq(bannerQueue.length, 0, 'no banner with nobody coming');
    assert.eq(el.banner.textContent, '');
    ticks(8 * 60);
    assert.eq(state.counter, null, 'it ends');
    assert.eq(state.counterLast, 'none');
    assert.ok(state.counterNext <= state.frontTime + 0.1, 'and the next one need not wait');
  });
  t.test('Auto quality starts at High on every device', () => {
    meta.opts.quality = 'auto'; Q.opt = null; applyOpts();
    assert.eq(Q.level, 'high');
  });
});
