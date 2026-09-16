suite('graphics quality', t => {
  const short = () => Math.min(N64.target.width, N64.target.height);
  t.test('each preset renders at its own line count and caps what is drawn', () => {
    newCampaign(); battle({ clear: true });
    const out = {};
    for (const lv of ['low', 'medium', 'high']) {
      meta.opts.quality = lv; applyOpts(); frames(2);
      out[lv] = { lines: short(), calls: G.stats().calls, brass: Q.brass, corpses: Q.corpses };
      assert.eq(Q.level, lv); assert.ok(!Q.auto, 'a fixed preset');
    }
    assert.ok(out.low.lines <= out.medium.lines && out.medium.lines <= out.high.lines, 'never more lines on a lower preset');
    assert.ok(out.low.lines < out.high.lines, 'Low renders fewer lines than High');
    assert.ok(out.low.brass < out.high.brass && out.low.corpses < out.high.corpses);
    meta.opts.quality = 'auto'; applyOpts();
    return out;
  });
  t.test('loose brass never outnumbers the preset\'s cap', () => {
    newCampaign(); const h = battle({ weapon: 'lmg', clear: true });
    meta.opts.quality = 'low'; applyOpts();
    h.mag = 100; aim.fire = true;
    ticks(300, 2, () => { h.mag = 100; h.reserve = 999; });
    aim.fire = false;
    assert.ok(BRASS.length <= Q.brass, `${BRASS.length} casings on the ground, cap ${Q.brass}`);
    meta.opts.quality = 'auto'; applyOpts();
  }, { timeout: 120000 });
  t.test('Auto steps down after three slow seconds, holds, and climbs back no higher than it started', () => {
    newCampaign(); battle({ clear: true });
    meta.opts.quality = 'auto'; Q.opt = null; applyOpts();
    const start = Q.level;
    assert.eq(start, 'high', 'a desktop starts high');
    for (let i = 0; i < 125; i++) autoQuality(0.04);   // 5 s of 25 fps
    assert.eq(Q.level, 'medium', 'one step down after 3 s');
    for (let i = 0; i < 175; i++) autoQuality(0.04);   // still slow: another step
    assert.eq(Q.level, 'low', 'and another while it stays slow');
    for (let i = 0; i < 60 * 18; i++) autoQuality(1 / 60);   // smooth, but inside the 30 s hold that began at the last drop
    assert.eq(Q.level, 'low', 'no climb inside the hold');
    for (let i = 0; i < 60 * 12; i++) autoQuality(1 / 60);
    assert.eq(Q.level, 'medium', 'one step back up once smooth for long enough');
    for (let i = 0; i < 60 * 30; i++) autoQuality(1 / 60);
    assert.eq(Q.level, 'high', 'and back to where it started');
    for (let i = 0; i < 60 * 30; i++) autoQuality(1 / 90);
    assert.eq(Q.level, 'high', 'never above where it started');
    for (let i = 0; i < 125; i++) autoQuality(0.04);
    assert.eq(Q.level, 'medium', 'High ran slow a second time');
    for (let i = 0; i < 60 * 120; i++) autoQuality(1 / 60);
    assert.eq(Q.level, 'medium', 'a level that has run slow twice is not tried again');
    meta.opts.quality = 'low'; applyOpts(); meta.opts.quality = 'auto'; applyOpts();
    assert.eq(Q.level, 'high', 'choosing Auto again starts fresh');
  });
  t.test('the Graphics setting switches between Auto and a fixed preset', () => {
    newCampaign(); showSettings();
    const sel = $('o_q');
    assert.ok(sel, 'Graphics row');
    sel.value = 'low'; sel.dispatchEvent(new Event('change'));
    assert.eq(meta.opts.quality, 'low'); assert.eq(Q.level, 'low'); assert.ok(!Q.auto);
    showSettings(); const sel2 = $('o_q'); sel2.value = 'auto'; sel2.dispatchEvent(new Event('change'));
    assert.ok(Q.auto, 'Auto again');
    hideModal();
  });
});
suite('controller', t => {
  let pad = null;
  function plug() {   // a standard-mapping gamepad the tests can press
    pad = { id: 'test pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      vibrationActuator: { effects: [], playEffect(type, o) { this.effects.push([type, o]); return Promise.resolve('complete'); } } };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
    GPAD.prev = [];
    return pad;
  }
  function unplug() { Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true }); tick(1 / 60); }
  const press = (i, on = true) => { pad.buttons[i] = { pressed: on, value: on ? 1 : 0 }; };
  const tap = i => { press(i); tick(1 / 60); press(i, false); tick(1 / 60); };
  t.test('left stick walks, right stick looks, triggers fire and aim', () => {
    newCampaign(); seed(3);
    const h = battle({ clear: true });
    benchSquad();
    h.x = 48 * PX; h.y = 50 * PX; clearArea(h.x, h.y, 900);
    aim.yaw = 0; cam.yaw = 0;
    plug();
    pad.axes[1] = -1;
    const y0 = h.y;
    ticks(60, 0, () => { cam.yaw = aim.yaw; });
    assert.ok(y0 - h.y > 3 * PX, 'walked forward');
    pad.axes[1] = 0; pad.axes[2] = 1;
    const yaw0 = aim.yaw; ticks(30); pad.axes[2] = 0; ticks(2);
    assert.ok(aim.yaw - yaw0 > 0.8, 'looked right');
    const shots0 = state.shots;
    press(GPB.RT); ticks(30); press(GPB.RT, false); ticks(2);
    assert.ok(state.shots > shots0, 'RT fires');
    assert.ok(!aim.fire, 'releasing RT stops');
    press(GPB.LT); ticks(2);
    assert.ok(aim.ads, 'LT aims'); press(GPB.LT, false); ticks(2);
    assert.ok(!aim.ads, 'let go');
    unplug();
  });
  t.test('RB throws, X reloads, D-pad down switches view, L3 sprints, the D-pad calls killstreaks', () => {
    newCampaign(); seed(3);
    const h = battle({ clear: true });
    benchSquad();
    h.x = 48 * PX; h.y = 50 * PX; clearArea(h.x, h.y, 900);
    aim.yaw = 0; cam.yaw = 0;
    plug();
    tap(GPB.RB); assert.eq(h.frags, 1, 'grenade');
    ticks(50);
    h.mag = 3; tap(GPB.X); assert.ok(h.reloadT > 0, 'reloading');
    const fpv0 = meta.opts.fpv; tap(GPB.Y); assert.eq(meta.opts.fpv, fpv0, 'Y no longer switches view (it swaps guns)');
    tap(GPB.DOWN); assert.eq(meta.opts.fpv, !fpv0, 'view switched'); tap(GPB.DOWN);
    ticks(200);
    pad.axes[1] = -1; tap(GPB.L3); ticks(10, 0, () => { cam.yaw = aim.yaw; });
    assert.ok(h.sprinting, 'sprinting');
    pad.axes[1] = 0; ticks(5);
    assert.ok(!h.sprinting && !aim.sprintPad, 'the sprint ends when the stick comes back');
    state.earned.airstrike = 1; tap(GPB.RIGHT);
    assert.eq(state.earned.airstrike, 0, 'D-pad right calls the airstrike');
    unplug();
  });
  t.test('rumble follows the Vibration setting', () => {
    newCampaign(); battle({ clear: true });
    plug(); tick(1 / 60);
    buzz(60);
    assert.ok(pad.vibrationActuator.effects.length >= 1, 'rumbled');
    meta.opts.vibe = false; const n = pad.vibrationActuator.effects.length; buzz(60);
    assert.eq(pad.vibrationActuator.effects.length, n, 'no rumble with Vibration off');
    meta.opts.vibe = true; unplug();
  });
  t.test('the prompts switch to controller buttons when the controller is used', () => {
    newCampaign(); battle({ clear: true });
    GPAD.lastInput = 'kbm'; plug();
    tap(GPB.X);
    assert.eq(GPAD.lastInput, 'pad');
    assert.ok(/RT FIRE/.test(el.hint.textContent), 'controller hint');
    assert.ok(document.body.classList.contains('pad'));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));
    assert.eq(GPAD.lastInput, 'kbm', 'a key hands the prompts back');
    unplug();
  });
  t.test('menus: RB picks the next sector, A deploys; START opens settings, B closes them', () => {
    newCampaign(); hideModal(); showScreen('map');
    document.getElementById('boot') && document.getElementById('boot').remove();
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    plug();
    const s0 = selectedTid;
    tap(GPB.RB);
    assert.ok(selectedTid !== s0 && terrAttackable(TERRITORIES[selectedTid]), 'next attackable sector');
    tap(GPB.START);
    assert.eq(el.modal.style.display, 'flex', 'settings open');
    tap(GPB.DOWN);
    assert.ok($('modalbox').contains(document.activeElement), 'focus moves into the settings');
    tap(GPB.B);
    assert.ok(el.modal.style.display !== 'flex', 'B closes them');
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    const pick = selectedTid;
    tap(GPB.A);
    assert.eq(screen, 'battle', 'A deploys');
    assert.eq(state.tid, pick);
    unplug();
  });
  t.test('the kit takes a controller: A picks the focused gun, Y cycles them', () => {
    newCampaign(); hideModal(); showScreen('map');
    plug();
    document.querySelector(`.wp[data-w="${WKEYS[1]}"]`).focus();
    tap(GPB.A);
    assert.eq(meta.loadout, WKEYS[1], 'A picked the focused gun');
    assert.eq(screen, 'map', 'and stayed on the start menu');
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
    tap(GPB.Y);
    assert.eq(meta.loadout, WKEYS[2], 'Y walks on to the next');
    assert.eq($('kitname').textContent, WEAPONS[WKEYS[2]].name, 'and the column follows');
    unplug();
  });
});
