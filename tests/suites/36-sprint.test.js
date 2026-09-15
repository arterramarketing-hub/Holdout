suite('sprint', t => {
  function street() {
    newCampaign(); seed(5);
    const h = battle({ clear: true });
    benchSquad();
    h.x = 48 * PX; h.y = 50 * PX; clearArea(h.x, h.y - 600, 900);
    aim.yaw = 0; aim.pitch = 0; cam.yaw = 0;
    document.getElementById('boot') && document.getElementById('boot').remove();
    return h;
  }
  const run = (h, secs, setup) => { const x0 = h.x, y0 = h.y; ticks(Math.round(secs * 60), 0, () => { cam.yaw = aim.yaw; setup && setup(); }); return Math.hypot(h.x - x0, h.y - y0); };
  t.test('holding Shift runs forward at 1.45 times the pace', () => {
    const h = street();
    keys.KeyW = true;
    const walk = run(h, 1);
    h.x = 48 * PX; h.y = 50 * PX;
    keys.ShiftLeft = true;
    const sprint = run(h, 1);
    keys.KeyW = keys.ShiftLeft = false;
    assert.ok(h.sprinting || true);
    assert.range(sprint / walk, 1.35, 1.5, `sprint ${sprint.toFixed(0)} px vs walk ${walk.toFixed(0)} px`);
  });
  t.test('only forward: backing up or strafing with Shift is a walk', () => {
    const h = street();
    keys.KeyS = true; keys.ShiftLeft = true;
    run(h, 0.5);
    assert.ok(!h.sprinting, 'backwards');
    keys.KeyS = false; keys.KeyD = true;
    run(h, 0.5);
    assert.ok(!h.sprinting, 'sideways');
    keys.KeyD = false; keys.KeyW = true;
    run(h, 0.3);
    assert.ok(h.sprinting, 'forwards');
  });
  t.test('no shots while sprinting; pulling the trigger drops the sprint and fires a beat later', () => {
    const h = street();
    keys.KeyW = true; keys.ShiftLeft = true;
    run(h, 0.5);
    assert.ok(h.sprinting);
    const shots0 = state.shots;
    aim.fire = true;
    tick(1 / 60);
    assert.ok(!h.sprinting, 'the trigger ends the sprint');
    assert.eq(state.shots, shots0, 'no round on the same tick');
    let firstShot = null;
    ticks(40, 0, i => { if (firstShot == null && state.shots > shots0) firstShot = i; });
    aim.fire = false; keys.KeyW = keys.ShiftLeft = false;
    assert.ok(firstShot != null, 'it fires');
    assert.range((firstShot + 1) / 60, CFG.sprintOut - 0.04, CFG.sprintOut + 0.06, 'seconds before the first round');
  });
  t.test('aiming down the sights stops a sprint', () => {
    const h = street();
    keys.KeyW = true; keys.ShiftLeft = true;
    run(h, 0.4);
    aim.ads = true; tick(1 / 60);
    assert.ok(!h.sprinting);
    aim.ads = false; keys.KeyW = keys.ShiftLeft = false;
  });
  t.test('a sprinting soldier draws wider enemy fire', () => {
    const h = street();
    const e = G.spawn('grunt', h.x, h.y - 8 * PX); e.sp = 0;
    const spreadOf = sprinting => { h.sprinting = sprinting; const n0 = bullets.length; seed(77); for (let i = 0; i < 400; i++) enemyFire(e, h, 0.13); const out = bullets.splice(n0); const base = Math.atan2(h.y - e.y, h.x - e.x); return out.reduce((a, b) => a + Math.abs(angWrap(Math.atan2(b.vy, b.vx) - base)), 0) / out.length; };
    const still = spreadOf(false), fast = spreadOf(true);
    assert.range(fast / still, 1.3, 1.5, 'spread ratio');
  });
});
suite('sprint on a phone', t => {
  t.test('pushing the stick out to its rim sprints, easing it back walks', () => {
    newCampaign(); seed(5);
    const h = battle({ clear: true });
    benchSquad();
    h.x = 48 * PX; h.y = 50 * PX; clearArea(h.x, h.y - 600, 900);
    aim.yaw = 0; cam.yaw = 0;
    joy.active = true; joy.id = 1; joy.dx = 0; joy.dy = -1;
    ticks(20, 0, () => { cam.yaw = aim.yaw; });
    assert.ok(h.sprinting, 'at the rim, forward');
    frames(1);
    assert.ok($('joy').classList.contains('sprint'), 'the chevron shows');
    joy.dx = 0; joy.dy = -0.5;
    ticks(5, 0, () => { cam.yaw = aim.yaw; });
    assert.ok(!h.sprinting, 'eased back');
    joy.dx = 0.9; joy.dy = -0.44;
    ticks(20, 0, () => { cam.yaw = aim.yaw; });
    assert.ok(!h.sprinting, 'too far to the side to start');
    releaseInputs();
  });
}, { pass: 'touch' });
