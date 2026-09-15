suite('manual aim only', t => {
  t.test('auto-fire and lock-on are gone', () => {
    assert.eq(typeof manualAim, 'undefined', 'manualAim');
    assert.eq(typeof lockPress, 'undefined', 'lock-on');
    assert.eq(typeof pickTarget, 'undefined', 'auto target picking');
    assert.eq(document.getElementById('lockbtn'), null, 'lock button');
    newCampaign(); showSettings();
    assert.eq(document.querySelectorAll('input[name=sch]').length, 0, 'the Controls row');
    hideModal();
    battle({ clear: true });
    const yaw = aim.yaw;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
    ticks(10);
    assert.eq(aim.yaw, yaw, 'Tab and Q leave the aim alone');
  });
  t.test('a save that used auto-fire loads aiming by hand, in the view it had', () => {
    newCampaign();
    const old = JSON.parse(JSON.stringify(meta));
    old.opts = Object.assign({}, old.opts, { v: 2, scheme: 'auto', fpv: false });
    localStorage.setItem(CFG.saveKey, JSON.stringify(old));
    loadMeta(); applyOpts();
    assert.eq(meta.opts.scheme, undefined, 'scheme dropped');
    assert.eq(meta.opts.fpv, false, 'third person kept');
    hideModal(); enterBattle(1); frames(3);
    const h = hero(); h.invuln = 1e9; h.fireCd = 0;
    aim.fire = true; tick(1 / 60); aim.fire = false;
    const mine = bullets.filter(b => b.fromPlayer);
    assert.ok(mine.length > 0 && mine.every(b => b.ballistic), 'your rounds fly in 3D');
  });
  t.test('in third person, rounds still land where the crosshair is', () => {
    newCampaign(); seed(8);
    const h = battle({ fpv: false, clear: true });
    benchSquad();
    h.x = 48 * PX; h.y = 40 * PX; clearArea(h.x, h.y - 300, 700);
    aim.yaw = 0; aim.pitch = -0.02; frames(4);
    const R = crosshairRay(h), k = 12 * PX;
    const e = G.spawn('grunt', R.ox + R.dx * k, R.oy + R.dy * k); e.sp = 0; e.ranged = 0; e.hp = 1e6;
    const zAt = R.oz + R.dz * k;
    aim.pitch += ((bodyTop(e) * 0.55) - zAt) / k;   // lift or drop the crosshair onto the chest at that distance
    frames(2);
    const hits0 = state.hits;
    for (let i = 0; i < 10; i++) { h.fireCd = 0; h.mag = 30; aim.ads = true; aim.fire = true; tick(1 / 60); aim.fire = false; frames(1); ticks(14); aim.pitch = aim.pitch; }
    assert.range(state.hits - hits0, 7, 10, 'hits out of 10');
  });
});
