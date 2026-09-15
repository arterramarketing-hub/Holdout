// Battery options: the frame-rate cap, the menus' own cap, the battery saver and its Auto mode.
suite('power', t => {
  const runGate = (hz, cap, seconds = 2) => {   // synthetic display frames through the gate: updates a second
    POWER.prevNow = null; POWER.gateT = 0;
    let ran = 0;
    const n = Math.round(hz * seconds);
    for (let i = 0; i <= n; i++) if (frameGate(1000 + i * 1000 / hz + (i % 3 - 1) * 0.35, cap)) ran++;   // a little vsync jitter
    return (ran - 1) / seconds;
  };
  t.test('the gate holds 30 on 60 Hz, 60 on 90 and 120 Hz, and Max runs every frame', () => {
    assert.near(runGate(60, 30), 30, 1, '30 cap on a 60 Hz screen');
    assert.near(runGate(60, 60), 60, 1, '60 cap on a 60 Hz screen');
    assert.near(runGate(90, 60), 60, 1.5, '60 cap on a 90 Hz screen');
    assert.near(runGate(120, 60), 60, 1, '60 cap on a 120 Hz screen');
    assert.near(runGate(120, 30), 30, 1, '30 cap on a 120 Hz screen');
    assert.near(runGate(120, 0), 120, 1, 'Max');
  });
  t.test('the cap follows the setting in battle, and the menus run at 30 whatever it says', () => {
    newCampaign(); battle({ clear: true });
    for (const [fps, want] of [['max', 0], ['60', 60], ['30', 30]]) { meta.opts.fps = fps; applyOpts(); assert.eq(powerCap(), want, 'battle at ' + fps); }
    showScreen('map');
    for (const fps of ['max', '60', '30']) { meta.opts.fps = fps; applyOpts(); assert.eq(powerCap(), 30, 'menu at ' + fps); }
    meta.opts.fps = 'max'; applyOpts();
    const f0 = POWER.frames; POWER.prevNow = null;
    for (let i = 0; i <= 60; i++) frame(50000 + i * 1000 / 60);
    assert.near(POWER.frames - f0, 31, 2, 'one second of 60 Hz on the map runs the game about 30 times');
  });
  t.test('the battery saver caps battle at 30, holds the Saver preset, and gives back what was set before', () => {
    newCampaign(); battle({ clear: true });
    meta.opts.quality = 'medium'; meta.opts.saver = 'off'; applyOpts();
    assert.eq(Q.level, 'medium');
    meta.opts.saver = 'on'; applyOpts();
    assert.ok(POWER.saver && document.body.classList.contains('saver'), 'saver on');
    assert.eq(Q.level, 'saver'); assert.eq(N64.lines, 240); assert.ok(!Q.glow && !Q.auto);
    assert.eq(powerCap(), 30, 'battle capped at 30');
    assert.ok($('savermark').offsetWidth > 0, 'the battery mark shows');
    meta.opts.quality = 'high'; applyOpts();
    assert.eq(Q.level, 'saver', 'changing graphics while the saver is on keeps the saver');
    meta.opts.saver = 'off'; applyOpts();
    assert.ok(!POWER.saver && !document.body.classList.contains('saver'));
    assert.eq(Q.level, 'high', 'back to the graphics setting');
    meta.opts.quality = 'auto'; applyOpts();
    assert.eq(Q.level, 'high'); assert.ok(Q.auto);
  });
  t.test('Auto turns the saver on at 20% unplugged, with a banner, and off on the charger', async () => {
    newCampaign(); battle({ clear: true });
    const bat = new EventTarget(); bat.level = 0.15; bat.charging = false;
    const had = Object.getOwnPropertyDescriptor(navigator, 'getBattery');
    Object.defineProperty(navigator, 'getBattery', { value: () => Promise.resolve(bat), configurable: true });
    POWER.watching = false; POWER.level = null; bannerQueue.length = 0;
    meta.opts.saver = 'auto'; applyOpts();
    await new Promise(r => setTimeout(r, 20));
    assert.ok(POWER.saver, 'on at 15%');
    assert.ok(bannerQueue.some(b => /BATTERY SAVER ON · 15%/.test(b)), 'with a banner');
    bat.level = 0.25; bat.dispatchEvent(new Event('levelchange'));
    assert.ok(POWER.saver, 'still on at 25%: it lets go past 30');
    bat.charging = true; bat.dispatchEvent(new Event('chargingchange'));
    assert.ok(!POWER.saver, 'off on the charger');
    bat.charging = false; bat.level = 0.5; bat.dispatchEvent(new Event('chargingchange'));
    assert.ok(!POWER.saver, 'stays off at 50%');
    meta.opts.saver = 'off'; applyOpts();
    if (had) Object.defineProperty(navigator, 'getBattery', had); else delete navigator.getBattery;
    POWER.watching = false; POWER.level = null;
  });
  t.test('Auto graphics under a 30 cap: steady 33 ms frames stay High, 50 ms frames step down', () => {
    newCampaign(); battle({ clear: true });
    meta.opts.quality = 'auto'; meta.opts.fps = '30'; Q.opt = null; applyOpts();
    assert.eq(Q.level, 'high');
    for (let i = 0; i < 30 * 20; i++) autoQuality(1 / 30);
    assert.eq(Q.level, 'high', '20 s of a capped 30 fps is not slow');
    for (let i = 0; i < 20 * 5; i++) autoQuality(0.05);
    assert.eq(Q.level, 'medium', 'but 20 fps under a 30 cap is');
    meta.opts.fps = 'max'; meta.opts.quality = 'low'; applyOpts(); meta.opts.quality = 'auto'; applyOpts();
  });
  t.test('settings show both rows, and they save and apply', () => {
    newCampaign(); showSettings();
    const fps = $('o_fps'), sv = $('o_saver');
    assert.ok(fps && sv, 'Frame rate and Battery saver rows');
    fps.value = '60'; fps.dispatchEvent(new Event('change'));
    assert.eq(meta.opts.fps, '60');
    sv.value = 'on'; sv.dispatchEvent(new Event('change'));
    assert.ok(POWER.saver);
    showSettings();
    assert.ok(/on now/.test($('o_saver').selectedOptions[0].textContent), 'the row says it is on');
    $('o_saver').value = 'off'; $('o_saver').dispatchEvent(new Event('change'));
    $('o_fps').value = 'max'; $('o_fps').dispatchEvent(new Event('change'));
    assert.ok(!POWER.saver && meta.opts.fps === 'max');
    hideModal();
  });
  t.test('the saver skips the start menu entrance; a save without the new options loads them off', () => {
    newCampaign();
    meta.opts.saver = 'on'; applyOpts();
    showScreen('map');
    assert.ok(!el.mapscr.classList.contains('enter'), 'no entrance animation');
    meta.opts.saver = 'off'; applyOpts();
    const o = Object.assign(freshOpts(), { v: 2, fpv: true });
    assert.eq(o.fps, 'max'); assert.eq(o.saver, 'off');
  });
});
