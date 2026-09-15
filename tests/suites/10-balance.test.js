suite('balance', t => {
  const hitsAt = (k, m) => Math.ceil(ETYPES.grunt.hp / (squadDmg(k) * falloffMul(k, m * PX)) - 1e-9);
  t.test('an M4 drops a rifleman in 3 anywhere in the town square', () => {
    assert.eq(hitsToDrop('ar'), 3, 'full damage');
    assert.eq(hitsAt('ar', 10), 3, 'at 10 m');
    assert.eq(hitsAt('ar', 20), 3, 'at 20 m');
  });
  t.test('the UMP45 takes 4 up close and 5 at 15 m', () => {
    assert.eq(hitsAt('smg', 6), 4, 'at 6 m');
    assert.eq(hitsAt('smg', 15), 5, 'at 15 m');
  });
  t.test('the SAW takes 3, the Intervention 1', () => {
    assert.eq(hitsToDrop('lmg'), 3); assert.eq(hitsToDrop('sniper'), 1);
  });
  t.test('holding territory changes nothing', () => {
    newCampaign();
    const before = [squadDmg('ar'), CFG.baseHp];
    for (const tt of TERRITORIES) meta.terr[tt.id].owner = 'p';
    const h = battle({ clear: true });
    assert.deepEq([squadDmg('ar'), h.maxHp], before);
    newCampaign();
  });
  t.test('enemy health does not scale with tier', () => {
    newCampaign();
    battle({ tid: 1, clear: true });
    const e1 = G.spawn('grunt', 1000, 1000).hp;
    meta.theater = 3;
    battle({ tid: 12, clear: true });
    const e2 = G.spawn('grunt', 1000, 1000);
    assert.eq(e2.hp, e1, 'grunt hp');
    assert.ok(e2.dmg > ETYPES.grunt.dmg, 'damage does scale');
    newCampaign();
  });
});
