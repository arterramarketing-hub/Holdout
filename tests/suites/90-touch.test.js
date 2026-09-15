suite('touch', t => {
  t.test('fire, ADS and the left trigger', () => {
    newCampaign();
    battle({ clear: true });
    const fire = $('firebtn'), r = fire.getBoundingClientRect();
    assert.ok(r.width > 40, 'fire button is showing');
    tapEl(fire, 'pointerdown', r.x + r.width / 2, r.y + r.height / 2);
    assert.ok(aim.fire, 'holding fire');
    ticks(20, 2);
    tapEl(fire, 'pointerup', r.x + r.width / 2, r.y + r.height / 2);
    assert.ok(!aim.fire, 'released');
    assert.ok(state.shots > 0, 'fired');
    const ads = $('adsbtn'), ra = ads.getBoundingClientRect();
    tapEl(ads, 'pointerdown', ra.x + 5, ra.y + 5); assert.ok(aim.ads, 'ADS on');
    tapEl(ads, 'pointerdown', ra.x + 5, ra.y + 5); assert.ok(!aim.ads, 'ADS off');
    const f2 = $('firebtn2'), r2 = f2.getBoundingClientRect();
    tapEl(f2, 'pointerdown', r2.x + 10, r2.y + 10, 9); assert.ok(aim.fire, 'left trigger');
    tapEl(f2, 'pointerup', r2.x + 10, r2.y + 10, 9); assert.ok(!aim.fire, 'left trigger released');
  });
  t.test('the left thumb moves, the right thumb looks, and nothing drifts afterwards', () => {
    newCampaign();
    battle({ clear: true });
    const cv = document.getElementById('game');
    const touch = (id, x, y) => new Touch({ identifier: id, target: cv, clientX: x, clientY: y });
    const W = innerWidth, Hh = innerHeight, y0 = aim.yaw;
    cv.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touch(1, W * 0.15, Hh * 0.7), touch(2, W * 0.7, Hh * 0.5)], changedTouches: [touch(1, W * 0.15, Hh * 0.7), touch(2, W * 0.7, Hh * 0.5)] }));
    cv.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: [touch(1, W * 0.15, Hh * 0.55), touch(2, W * 0.78, Hh * 0.5)], changedTouches: [touch(1, W * 0.15, Hh * 0.55), touch(2, W * 0.78, Hh * 0.5)] }));
    assert.ok(joy.active && joy.dy < -0.5, 'stick pushed forward');
    assert.ok(aim.yaw - y0 > 0.1, 'view turned right');
    cv.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: [touch(1, W * 0.15, Hh * 0.55), touch(2, W * 0.78, Hh * 0.5)] }));
    assert.ok(!joy.active, 'stick released');
    const y1 = aim.yaw;
    $('tocfg').dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: W - 20, clientY: 20 }));
    hideModal();
    frames(60);
    assert.eq(aim.yaw, y1, 'no drift after a HUD tap');
  });
  t.test('losing focus lets go of everything held', () => {
    newCampaign(); battle({ clear: true });
    aim.fire = true; joy.active = true; joy.dx = 0.5;
    window.dispatchEvent(new Event('blur'));
    assert.ok(!aim.fire && !joy.active && joy.dx === 0);
  });
}, { pass: 'touch' });
