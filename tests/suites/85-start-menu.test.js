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
  t.test('the briefing carries the kit: the picker changes the gun, and each gun keeps its own attachments', () => {
    newCampaign(); open();
    assert.eq(document.getElementById('teamscr'), null, 'no separate loadout screen to walk to');
    assert.eq(document.querySelector('.squad'), null, 'no roster of teammate names');
    assert.eq(document.getElementById('brSegs'), null, 'no strip of 13 segments: the map says that');
    const chips = [...document.querySelectorAll('.wp')];
    assert.eq(chips.length, WKEYS.length, 'one chip per gun you can carry');
    assert.eq(chips.filter(c => c.classList.contains('on')).length, 1, 'the one you carry is marked');
    document.querySelector('.wp[data-w="sniper"]').click();
    assert.eq(meta.loadout, 'sniper', 'picked from the column');
    assert.eq($('kitname').textContent, WEAPONS.sniper.name);
    [...document.querySelectorAll('#kitatt .att')].find(b => b.dataset.sight === 'acog').click();
    assert.eq(meta.attach.sniper.sight, 'acog', 'the sight sticks');
    assert.ok(/ACOG/i.test($('kitsub').textContent), 'and the line under the name says so: ' + $('kitsub').textContent);
    document.querySelector('.wp[data-w="ar"]').click();
    assert.eq($('kitname').textContent, WEAPONS.ar.name, 'back to the rifle');
    assert.eq(attFor('sniper').sight, 'acog', 'the sniper kept its ACOG');
    saveMeta(); loadMeta();
    assert.eq(meta.attach.sniper.sight, 'acog', 'and the save carries it');
    assert.eq(meta.loadout, 'ar');
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
suite('touch layout', t => {
  t.test('no two touch buttons overlap, and none sits on the HUD panels', () => {
    newCampaign(); battle({ clear: true }); frames(2);
    const rect = id => { const e = $(id); const r = e.getBoundingClientRect(); return getComputedStyle(e).display === 'none' ? null : r; };
    const btns = ['firebtn', 'firebtn2', 'adsbtn', 'reloadbtn', 'nadebtn'].map(id => [id, rect(id)]).filter(x => x[1]);
    assert.eq(btns.length, 5, 'all five buttons on screen');
    const panels = ['ammo', 'supports', 'topbar', 'tickets', 'minimap'].map(id => [id, rect(id)]).filter(x => x[1] && x[1].width);
    const hit = (a, b, pad = 2) => a.left < b.right - pad && b.left < a.right - pad && a.top < b.bottom - pad && b.top < a.bottom - pad;
    for (let i = 0; i < btns.length; i++) {
      const [ia, ra] = btns[i];
      assert.ok(ra.left >= 0 && ra.right <= innerWidth && ra.top >= 0 && ra.bottom <= innerHeight, `${ia} inside the screen`);
      for (let j = i + 1; j < btns.length; j++) assert.ok(!hit(ra, btns[j][1]), `${ia} overlaps ${btns[j][0]}`);
      for (const [ip, rp] of panels) assert.ok(!hit(ra, rp), `${ia} overlaps ${ip}`);
    }
  });
}, { pass: ['touch', 'small'] });
suite('start menu layout', t => {
  t.test('everything fits on screen with nothing to scroll', () => {
    newCampaign();
    for (const id of [1, 2]) meta.terr[id] = { owner: 'p', progress: 0 };
    meta.terr[3].progress = 42;
    hideModal(); showScreen('map');
    const scr = $('mapscr'), brief = document.querySelector('.brief');
    scr.classList.remove('enter'); void scr.offsetWidth;   // measure the settled layout, not the entrance slide
    assert.ok(scr.scrollHeight <= innerHeight + 1, `screen scrolls: ${scr.scrollHeight} > ${innerHeight}`);
    assert.ok(brief.scrollHeight <= brief.clientHeight + 1, `briefing scrolls: ${brief.scrollHeight} > ${brief.clientHeight}`);
    const cta = $('deploybtn').getBoundingClientRect();
    assert.ok(cta.bottom <= innerHeight + 0.5, `deploy button cut off: bottom ${cta.bottom} of ${innerHeight}`);
    assert.ok(cta.height >= 44, `deploy button ${cta.height.toFixed(1)} px tall, under a 44 px thumb`);
    const svg = $('mapsvg').getBoundingClientRect();
    assert.ok(svg.width > 200 && svg.height > 150, 'the map has room');
    for (const id of ['brName', 'dbSub', 'kitname']) { const q = $(id).getBoundingClientRect(); assert.ok(q.right <= innerWidth + 1, `${id} runs off the screen: right ${q.right.toFixed(1)} of ${innerWidth} (brief ${brief.getBoundingClientRect().left.toFixed(0)}-${brief.getBoundingClientRect().right.toFixed(0)}, doc ${document.documentElement.clientWidth})`); }
    return { size: [innerWidth, innerHeight], brief: [brief.clientWidth, brief.clientHeight], map: [Math.round(svg.width), Math.round(svg.height)] };
  });
}, { pass: ['desktop', 'touch', 'small', 'wide', 'tall'] });
