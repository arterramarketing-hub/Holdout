suite('enemies', t => {
  t.test('every enemy type fights and dies', () => {
    newCampaign(); seed(21);
    const h = battle({ clear: true });   // the simulation alone: headless software WebGL makes every rendered frame expensive
    setupObjectives([]);                 // count kills only: no objective captures spending reserves
    const d0 = state.enemyDown;
    ['grunt', 'runner', 'brute', 'rider', 'gunner', 'spotter'].forEach((ty, i) => G.spawn(ty, h.x + (i - 2.5) * 120, h.y - 380));
    ticks(60 * 20, 0, () => { h.invuln = 1e9; botTick(h); });
    assert.eq(enemies.length, 0, 'left standing: ' + enemies.map(e => e.type).join(','));
    assert.eq(state.enemyDown - d0, 6, 'counted down');
  }, { timeout: 120000 });
  t.test('the Warlord\'s summons keep to eight on the field', () => {
    newCampaign(); seed(4);
    battle({ clear: true });
    spawnBoss(); const boss = state.bossRef; boss.x = 1920; boss.y = 800; boss.sp = 0;
    let max = 0;
    ticks(60 * 45, 0, () => { boss.hp = boss.maxHp * 0.5; for (const so of soldiers) { so.invuln = 1e9; so.fireCd = 999; } max = Math.max(max, enemies.length - 1); });
    assert.ok(enemies.includes(boss), 'the Warlord still stands');
    assert.eq(max, CFG.enemyCap, 'most on the field besides the Warlord');
  });
  t.test('the Warlord\'s hero shot is a cutscene: no gun, crosshair, scope or HUD on it, and your trigger waits', () => {
    newCampaign(); seed(6);
    const h = battle({ weapon: 'sniper', clear: true });
    benchSquad(); setupObjectives([]);
    aim.ads = true; frames(2, 0.5);   // settled behind the 6x scope, as you would be
    assert.ok($('sight').style.display === 'block', 'behind the scope before it starts');
    let vm = 0;
    const realVm = drawViewmodel;
    drawViewmodel = (...a) => { vm++; return realVm(...a); };
    try {
      spawnBoss();
      frames(1, 1 / 60);   // the camera picks the Warlord up on its next frame
      assert.ok(bossCine(), 'the hero shot is playing');
      vm = 0; frames(2, 1 / 60);
      assert.eq(vm, 0, 'no gun drawn over it');
      assert.ok(document.body.classList.contains('boss-cine'));
      for (const id of ['bhud', 'reticle', 'sight']) assert.eq(getComputedStyle($(id)).visibility, 'hidden', id + ' is hidden');
      assert.ok(VIEW.camera.fov > 40, `the scope does not zoom a cutscene (fov ${VIEW.camera.fov.toFixed(1)})`);
      const shots = state.shots;
      h.fireCd = 0; aim.fire = true; tick(1 / 60); aim.fire = false;
      assert.eq(state.shots, shots, 'no round while the camera is away');
      assert.ok(!throwGrenade(h), 'and no frag');
      frames(3, 1);   // it plays out
      assert.ok(!bossCine(), 'over');
      assert.eq(getComputedStyle($('bhud')).visibility, 'visible', 'the HUD is back');
      vm = 0; frames(1, 1 / 60);
      assert.eq(vm, 1, 'and so is your gun');
      h.fireCd = 0; aim.fire = true; tick(1 / 60); aim.fire = false;
      assert.eq(state.shots, shots + 1, 'and your trigger');
    } finally { drawViewmodel = realVm; aim.ads = false; }
  });
  t.test('killing the Warlord secures the front', () => {
    newCampaign(); seed(9);
    battle({ weapon: 'sniper' });
    state.enemyDown = state.enemyTotal - 6; state.progress = 91;
    ticks(60, 30);
    const boss = state.bossRef;
    assert.ok(boss, 'a Warlord arrived at 90%');
    ticks(180, 30);
    boss.hp = 0.5; enemies.length = 0; enemies.push(boss);
    hurtEnemy(0, 5, { player: true, wkey: 'sniper' }, { x: 0, y: -1 });
    ticks(10);
    assert.eq(state.mode, 'cleared');
    assert.ok(/front secured/i.test(el.modalbox.innerText), 'after-action card');
    $('mbtn').click();
    assert.eq(screen, 'map');
    assert.eq(meta.terr[1].owner, 'p', 'sector taken');
  });
});
