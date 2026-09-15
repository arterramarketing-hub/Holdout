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
