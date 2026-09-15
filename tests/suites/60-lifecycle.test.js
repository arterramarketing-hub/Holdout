suite('lifecycle', t => {
  t.test('death, a reinforcement back on the line, running out, the defeat card, retry', () => {
    newCampaign(); seed(2);
    const h = battle({ invuln: false });
    damageSoldier(h, 99);
    assert.eq(state.mode, 'dying');
    ticks(60 * 3, 4);
    assert.eq(state.mode, 'play', 'back in play');
    assert.ok(hero().alive, 'alive again');
    assert.eq(state.tickets, CFG.tickets - 1, 'one reinforcement spent');
    state.tickets = 0;
    for (const s of soldiers) { s.invuln = 0; if (s.alive) damageSoldier(s, 99); }
    ticks(60 * 4, 4);
    assert.ok(/front lost/i.test(el.modalbox.innerText), 'defeat card');
    $('mbtn').click();
    assert.eq(state.mode, 'play', 'retry deploys again');
  });
  t.test('a lost front saves as 0%, even with the defeat card still up', () => {
    newCampaign(); seed(6);
    battle();
    state.enemyDown = 20; state.progress = 20 / state.enemyTotal * 100;
    saveMeta();
    assert.ok(JSON.parse(localStorage.getItem(CFG.saveKey)).terr[1].progress > 30, 'progress saved mid-front');
    state.tickets = 0;
    for (const s of soldiers) { s.invuln = 0; if (s.alive) damageSoldier(s, 99); }
    G.step(4); saveMeta();
    assert.eq(state.mode, 'failed');
    assert.eq(JSON.parse(localStorage.getItem(CFG.saveKey)).terr[1].progress, 0);
  });
  t.test('a front you walk away from resumes where you left it', () => {
    newCampaign();
    battle();
    state.enemyDown = 13; state.progress = 13 / state.enemyTotal * 100;
    exitBattle();
    battle();
    assert.eq(state.enemyDown, 13);
  });
});
