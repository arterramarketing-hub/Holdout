// The suppressor: the attachment and its save, a suppressed shot (sound, flash, tracers, damage), enemy hearing, and
// the slower sights.
suite('suppressor', t => {
  const withSuppressor = (on, weapon = 'ar') => {
    newCampaign(); meta.attach[weapon].suppressor = on; seed(4);
    const h = battle({ weapon, clear: true });
    benchSquad(); setupObjectives([]);
    h.x = 48 * PX; h.y = 50 * PX; clearArea(h.x, h.y, 1200); aim.yaw = 0; aim.pitch = 0; cam.yaw = 0;
    return h;
  };
  t.test('the attachment saves, loads into your soldier, and only fits the four guns that take one', () => {
    newCampaign();
    meta.attach.ar.suppressor = true;
    assert.ok(attFor('ar').suppressor, 'kept on the M4');
    assert.ok(!normAtt('rocket', { suppressor: true }).suppressor, 'not on the rocket');
    assert.ok(!normAtt('ak', { suppressor: true }).suppressor, 'not on a gun off the ground');
    assert.ok(!normAtt('smg', { sight: 'rds', ext: true }).suppressor, 'an older save without it loads without it');
    const saved = JSON.parse(JSON.stringify(meta)); meta = saved;
    const h = battle({ clear: true });
    assert.ok(h.suppressor && h.kit.suppressor, 'your soldier carries it');
    h.alive = false; respawnSoldier(h);
    assert.ok(h.suppressor, 'and comes back with it');
  });
  t.test('BATTLE PREP has a Muzzle row on the guns that take one, and the start menu says so', () => {
    newCampaign(); meta.loadout = 'ar'; showScreen('team');
    const btn = [...document.querySelectorAll('#loadout .att')].find(b => b.dataset.supp === '1');
    assert.ok(btn, 'a SUPPRESSOR choice');
    btn.click();
    assert.ok(meta.attach.ar.suppressor, 'chosen');
    assert.ok(/heard only within 10 m/.test($('loadout').textContent), 'the note explains it');
    meta.loadout = 'rocket'; renderTeam();
    assert.ok(![...document.querySelectorAll('#loadout .att')].some(b => b.dataset.supp), 'no Muzzle row on the rocket');
    meta.loadout = 'ar'; showScreen('map');
    assert.ok(/suppressed/.test($('kitsub').textContent), 'kit line: ' + $('kitsub').textContent);
  });
  t.test('a suppressed round: no tracer, no flash, the suppressed sound, and full damage', () => {
    const h = withSuppressor(true);
    const played = [], real = playBuf;
    playBuf = (key, o) => { played.push(key); return real(key, o); };
    try {
      bullets.length = 0;
      for (let i = 0; i < 9; i++) { aim.fire = true; ticks(10); }
      aim.fire = false;
      const mine = bullets.filter(b => b.fromPlayer);
      assert.ok(state.shots >= 6, 'fired ' + state.shots);
      assert.ok(mine.every(b => !b.tracer), 'no tracers');
      assert.ok(mine.every(b => b.dmg === squadDmg('ar')), 'damage untouched');
      assert.ok(played.some(k => /^gunS:ar:|^gun:ar:/.test(k)) && !played.some(k => /^gunf:/.test(k)), 'a shot sound');
      aim.fire = true; tick(1 / 60); aim.fire = false; G.frame(1 / 60);
      assert.eq(FPV.flashT, 0, 'no muzzle flash in your hands');
    } finally { playBuf = real; }
    const loud = withSuppressor(false);
    bullets.length = 0;
    for (let i = 0; i < 9; i++) { aim.fire = true; ticks(10); }
    aim.fire = false;
    assert.ok(bullets.some(b => b.fromPlayer && b.tracer), 'without it, every third round burns');
  });
  t.test('enemies hear a loud shot at 20 m and turn on the shooter; a suppressed one only within 10 m', () => {
    const scene = (on, dist) => {
      const h = withSuppressor(on);
      const m = soldiers[1]; Object.assign(m, { alive: true, hp: m.maxHp, respawnT: 0, x: h.x + 600, y: h.y - dist, invuln: 1e9 });
      const e = G.spawn('grunt', h.x, h.y - dist); e.sp = 0; e.fireT = 1e9; e.objRole = false;
      m.x = e.x + 600; m.y = e.y;   // a squadmate 15 m from it
      h.invuln = 1e9;
      aim.yaw = 0; aim.pitch = 0.6;   // firing into the air, not at it
      aim.fire = true; tick(1 / 60); aim.fire = false; tick(1 / 60);
      const toHero = Math.atan2(h.y - e.y, h.x - e.x);
      return { heard: e.heardT > 0, onHero: Math.abs(angWrap(e.aim - toHero)) < 0.05 };
    };
    const loud = scene(false, 800);
    assert.ok(loud.heard && loud.onHero, 'unsuppressed at 20 m: heard, and it turns on you over the nearer squadmate');
    const quiet = scene(true, 800);
    assert.ok(!quiet.heard && !quiet.onHero, 'suppressed at 20 m: not heard, still on the squadmate');
    const close = scene(true, 320);
    assert.ok(close.heard, 'suppressed at 8 m: heard');
  });
  t.test('the suppressed shot is rendered for all four guns and sits well under the bare shot', async () => {
    document.getElementById('boot') && document.getElementById('boot').remove();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));   // any key starts the audio
    await waitFor(() => SFX.buf['gunS:sniper:0'], 120000, 'the suppressed shots to render');
    const loud = b => {   // loudest 50 ms
      const d = b.getChannelData(0), w = Math.floor(b.sampleRate * 0.05);
      let q = 0, best = 0;
      for (let i = 0; i < d.length; i++) { q += d[i] * d[i]; if (i >= w) q -= d[i - w] * d[i - w]; if (i >= w - 1) best = Math.max(best, q); }
      return Math.sqrt(best / w);
    };
    const out = {};
    for (const w of ['ar', 'smg', 'lmg', 'sniper']) {
      assert.ok(SFX.buf[`gunS:${w}:0`], w + ' rendered');
      out[w] = +(20 * Math.log10(loud(SFX.buf[`gunS:${w}:0`]) * 0.3 / (loud(SFX.buf[`gun:${w}:0`]) * 0.6))).toFixed(1);   // the gains sfxGun plays them at
    }
    for (const w in out) assert.range(out[w], -24, -8, `${w} suppressed vs bare (dB) ${JSON.stringify(out)}`);
    return out;
  }, { timeout: 150000 });
  t.test('the sights come up 12% slower with a suppressor, and the model carries the can past the muzzle', () => {
    const h = withSuppressor(true);
    assert.near(adsRate(), SIGHTS[h.sight].rate * 0.88, 1e-9, 'suppressed');
    h.suppressor = false;
    assert.near(adsRate(), SIGHTS[h.sight].rate, 1e-9, 'bare');
    const bare = gunParts('ar', { sight: 'iron', ext: false, suppressor: false }), can = gunParts('ar', { sight: 'iron', ext: false, suppressor: true });
    assert.eq(can.length, bare.length + 2, 'the can and its end cap');
    assert.near(muzOf('ar', { suppressor: true }).z, GUN_MUZ.ar.z - SUPPRESSOR_CAN.ar[1] + 0.01, 1e-9, 'the muzzle moves to the end of the can');
  });
});
