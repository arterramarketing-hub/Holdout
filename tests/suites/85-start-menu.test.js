suite('start menu', t => {
  const open = () => { hideModal(); showScreen('map'); };
  t.test('opens on a sector you can attack, and after a win moves to the fight next to it', () => {
    newCampaign(); open();
    assert.ok(terrAttackable(TERRITORIES[selectedTid]), 'first selection is attackable');
    meta.terr[1] = { owner: 'p', progress: 0 };
    open();
    assert.eq(selectedTid, 3, 'Saint Rennes, the neighbour Miller Fields opened up');
    assert.ok(document.querySelector('#mapsvg .rg.fresh'), 'the sector just taken flashes');
  });
  t.test('tapping anywhere in a region selects that sector', () => {
    newCampaign(); open();
    MAPV.regions[12].fill.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    assert.eq(selectedTid, 12);
    assert.eq($('brName').textContent, 'Enemy Capital');
    assert.ok($('deploybtn').disabled, 'deploy off for a sector out of reach');
    assert.eq($('dbMain').textContent, 'Out of reach');
    assert.ok(/Out of reach/.test($('brLine').textContent));
    selectSector(0);
    assert.eq($('dbMain').textContent, 'Held');
    assert.ok($('deploybtn').disabled);
  });
  t.test('←/→ cycle the attackable sectors and Enter deploys', () => {
    newCampaign(); open();
    document.getElementById('boot') && document.getElementById('boot').remove();
    const seen = new Set([selectedTid]);
    for (let i = 0; i < 3; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' })); seen.add(selectedTid); }
    assert.ok([...seen].every(id => terrAttackable(TERRITORIES[id])), 'only attackable sectors');
    assert.eq(seen.size, TERRITORIES.filter(terrAttackable).length, 'every attackable sector visited');
    const pick = selectedTid;
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
    assert.eq(screen, 'battle', 'deployed');
    assert.eq(state.tid, pick, 'to the selected sector');
  });
  t.test('the forecast in the briefing is the sky you fight under', () => {
    newCampaign(); meta.story.seen[1] = true; open();
    selectSector(2);
    const f = FORECAST[2];
    assert.ok(f, 'a forecast was rolled');
    assert.eq($('brWx').textContent, WEATHER[f.weather].label, 'weather shown');
    assert.ok($('brSky').textContent.includes(skyName(f.tod)), 'time of day shown');
    deploySelected();
    assert.eq(state.weather, f.weather, 'weather');
    assert.near(state.tod, f.tod, 1e-9, 'time of day');
    assert.eq(FORECAST[2], undefined, 'used up by the fight');
  });
  t.test('the front line runs exactly where held ground meets theirs', () => {
    newCampaign();
    for (const id of [1, 2, 3]) meta.terr[id] = { owner: 'p', progress: 0 };
    open();
    const owned = TERRITORIES.map(terrOwned);
    const expected = MAPV.cells.edges.filter(e => owned[e.a] !== owned[e.b]).length;
    assert.ok(expected > 0, 'there is a front');
    assert.eq(document.querySelectorAll('#mapsvg .front').length, expected, 'front segments');
    assert.eq(document.querySelectorAll('#mapsvg .route.adv').length, TERRITORIES.filter(tt => owned[tt.id]).reduce((n, tt) => n + tt.adj.filter(a => !owned[a]).length, 0), 'axes of advance');
  });
  t.test('a partly taken sector shows how much is left', () => {
    newCampaign(); meta.terr[2].progress = 50; open();
    selectSector(2);
    const tier = effTier(TERRITORIES[2]), total = CFG.enemyTickets + CFG.enemyTicketsPerTier * tier;
    assert.eq($('brChip').textContent, '50% taken');
    assert.eq(+$('brRes').textContent, total - Math.round(total / 2));
    assert.ok(!$('brProg').hidden, 'progress bar');
    assert.eq($('dbMain').textContent, 'Resume');
  });
});
suite('start menu layout', t => {
  t.test('everything fits on screen with nothing to scroll', () => {
    newCampaign();
    for (const id of [1, 2]) meta.terr[id] = { owner: 'p', progress: 0 };
    meta.terr[3].progress = 42;
    hideModal(); showScreen('map');
    const scr = $('mapscr'), brief = document.querySelector('.brief');
    assert.ok(scr.scrollHeight <= innerHeight + 1, `screen scrolls: ${scr.scrollHeight} > ${innerHeight}`);
    assert.ok(brief.scrollHeight <= brief.clientHeight + 1, `briefing scrolls: ${brief.scrollHeight} > ${brief.clientHeight}`);
    const cta = $('deploybtn').getBoundingClientRect();
    assert.ok(cta.bottom <= innerHeight && cta.height >= 40, 'deploy button fully visible and thumb-sized');
    const svg = $('mapsvg').getBoundingClientRect();
    assert.ok(svg.width > 200 && svg.height > 150, 'the map has room');
    for (const id of ['brName', 'dbSub', 'kitname']) { const e = $(id); assert.ok(e.getBoundingClientRect().right <= innerWidth + 1, id + ' inside the screen'); }
    return { size: [innerWidth, innerHeight], brief: [brief.clientWidth, brief.clientHeight], map: [Math.round(svg.width), Math.round(svg.height)] };
  });
}, { pass: ['desktop', 'touch', 'small', 'wide', 'tall'] });
