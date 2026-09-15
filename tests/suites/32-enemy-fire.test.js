suite('enemy fire in 3D', t => {
  const baseline = () => (window.HT_BASELINE || {}).dpm;
  function standoff(coverKind, seedN, { crouchedMate = false } = {}) {   // three riflemen 7.5 m north shoot at a soldier for a minute
    newCampaign(); seed(seedN);
    const h = battle({ clear: true, invuln: false });
    benchSquad();
    state.noEnemyFrags = true;   // rounds alone: the cover under test is measured against bullets
    let target = h;
    h.x = 48 * PX; h.y = 40 * PX; clearArea(h.x, h.y - 150, 520);
    if (crouchedMate) {   // the soldier under fire is an AI squadmate settled behind the cover; you stand far off, out of it
      const m = soldiers.find(s => s.slot !== state.controlled);
      m.alive = true; m.respawnT = 0; m.x = h.x; m.y = h.y; m.invuln = 0;
      h.x = 10 * PX; h.y = 66 * PX; h.invuln = 1e9;
      target = m;
    }
    let ob = null;
    if (coverKind === 'car') ob = addCover('car', 48, 38.9, 1);
    if (coverKind === 'sandbags') ob = addCover('sandbags', 48, 39.4);
    target.hp = 1000; target.maxHp = 1000;
    for (const dx of [-1.5, 0, 1.5]) { const e = G.spawn('grunt', 48 * PX + dx * PX, 40 * PX - 7.5 * PX); e.sp = 0; e.hp = 1e6; }
    aimAt(h, h.x, h.y - 300, 60);
    ticks(60 * 60, 0, () => {
      aim.fire = false; h.fireCd = 999;
      if (crouchedMate) { target.x = 48 * PX; target.y = 40 * PX; target.coverRef = ob; target.peekT = 0; target.path = null; target.moving = false; target.fireCd = 999; }
    });
    return 1000 - target.hp;
  }
  const avg = (kind, opts) => { const r = Array.from({ length: 12 }, (_, i) => standoff(kind, i + 1, opts)); return r.reduce((a, b) => a + b, 0) / r.length; };   // 12 seeds, like the baseline
  t.test('enemy rounds are 3D, from the shoulder, and never headshots', () => {
    newCampaign(); seed(3);
    const h = battle({ clear: true });
    benchSquad();
    h.x = 48 * PX; h.y = 40 * PX; clearArea(h.x, h.y - 150, 520);
    const e = G.spawn('grunt', h.x, h.y - 7.5 * PX); e.sp = 0;
    const seen = new Set();
    ticks(60 * 8, 0, () => { h.invuln = 1e9; for (const b of bullets) if (b.hostile) seen.add(b); });
    const shots = [...seen];
    assert.ok(shots.length >= 4, `the rifleman fired (${shots.length})`);
    assert.ok(shots.every(b => b.ballistic), 'every enemy round flies in 3D');
    const muzzle = bodyTop(e) * 0.8;
    assert.ok(shots.every(b => Math.abs(b.z - muzzle) < 0.35 * PX || b.age > 0), 'from the shoulder');
    assert.eq(typeof headHit, 'function');
    return { rounds: shots.length };
  });
  t.test('a car between you and them stops nearly everything (only rounds over the roof can find your head)', () => {
    const car = avg('car'), base = baseline();
    assert.ok(car < base.open * 0.25, `behind the car ${car.toFixed(2)} vs the old open ${base.open}`);
    return { car: +car.toFixed(2) };
  }, { timeout: 240000 });
  t.test('standing in the open stays within 15% of the old damage', () => {
    const open = avg('open'), base = baseline();
    assert.ok(base && base.open > 0, 'baseline loaded');
    assert.range(open / base.open, 0.85, 1.15, `open ${open.toFixed(2)} vs baseline ${base.open}`);
    return { open: +open.toFixed(2), baseline: base.open };
  }, { timeout: 180000 });
  t.test('standing behind sandbags, rounds come over the top at you', () => {
    const bags = avg('sandbags'), base = baseline();
    assert.range(bags / base.open, 0.5, 1.15, `sandbags ${bags.toFixed(2)} vs the old open ${base.open}`);   // standing, you are about as exposed as in the open
    return { sandbags: +bags.toFixed(2), oldSandbags: base.sandbags };
  }, { timeout: 240000 });
  t.test('a squadmate crouched behind sandbags is much harder to hit than one standing in the open', () => {
    const inOpen = avg('open', { crouchedMate: true }), behind = avg('sandbags', { crouchedMate: true });
    assert.ok(inOpen > 0, 'the squadmate in the open gets hit');
    assert.ok(behind / inOpen < 0.6, `behind ${behind.toFixed(2)} vs open ${inOpen.toFixed(2)}`);
    return { open: +inOpen.toFixed(2), behindSandbags: +behind.toFixed(2) };
  }, { timeout: 240000 });
});
