suite('menus and save', t => {
  t.test('loadout: every gun and attachment can be picked', () => {
    newCampaign(); hideModal(); showScreen('map');
    for (const k of WKEYS) {
      document.querySelector(`.wp[data-w="${k}"]`).click();
      assert.eq(meta.loadout, k, 'picked ' + k);
      for (const a of [...document.querySelectorAll('#kitatt .att')]) a.click();
    }
    assert.eq(screen, 'map', 'the kit never leaves the start menu');
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
