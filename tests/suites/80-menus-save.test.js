suite('menus and save', t => {
  t.test('loadout: every gun and attachment can be picked', () => {
    newCampaign(); showScreen('team');
    for (const b of [...document.querySelectorAll('.wrow')]) { b.click(); for (const a of [...document.querySelectorAll('.att')]) a.click(); }
    assert.eq(meta.loadout, 'rocket', 'last gun in the rail');
    $('lodone').click();
    assert.eq(screen, 'map');
  });
  t.test('settings: music level and view apply', () => {
    newCampaign(); showSettings();
    const mus = $('o_mus'); mus.value = '0.2'; mus.dispatchEvent(new Event('input'));
    const vw = document.querySelector('input[name=vw][value=tps]'); vw.checked = true; vw.dispatchEvent(new Event('change'));
    assert.eq(meta.opts.music, 0.2); assert.eq(meta.opts.fpv, false);
    $('mbtn').click();
  });
  t.test('a save round-trips', () => {
    newCampaign(); meta.loadout = 'lmg'; meta.terr[2] = { owner: 'p', progress: 0 }; meta.terr[3].progress = 40;
    saveMeta(); const before = JSON.stringify(meta);
    loadMeta();
    assert.eq(JSON.stringify(meta), before);
  });
});
