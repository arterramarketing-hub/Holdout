suite('boot', t => {
  t.test('the page loads with no errors and the 3D engine ready', () => {
    assert.eq(window.__bootErrors.length, 0, 'errors while loading');
    assert.ok(VIEW.ready, 'three.js started');
    assert.eq(screen, 'map', 'opens on the start menu');
  });
  t.test('the start menu opens with an attackable sector selected', () => {
    newCampaign(); showScreen('map');
    const sel = TERRITORIES[selectedTid];
    assert.ok(sel && terrAttackable(sel), 'selected sector is attackable');
  });
});
