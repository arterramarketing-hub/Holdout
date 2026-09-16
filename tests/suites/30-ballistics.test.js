suite('ballistics', t => {
  function range(weapon = 'ar') {   // the hero on Main Street, nothing in the way, one rifleman standing 15 m north
    newCampaign(); seed(11);
    const h = battle({ weapon, clear: true });
    h.x = 48 * PX; h.y = 40 * PX; clearArea(h.x, h.y - 300, 700);
    benchSquad();
    const e = G.spawn('grunt', h.x, h.y - 15 * PX); e.sp = 0; e.ranged = 0; e.hp = 1e6; e.maxHp = 1e6;
    return { h, e };
  }
  t.test('down the sights, rounds aimed at the head take the head', () => {
    const { h, e } = range();
    frames(1);
    let heads0 = state.heads, shots = 0;
    for (let k = 0; k < 20; k++) {
      aimAt(h, e.x, e.y, bodyTop(e) * 0.9); aim.ads = true; FPV.adsK = 1;
      h.fireCd = 0; h.mag = 30; aim.fire = true; tick(1 / 60); aim.fire = false; shots++;
      ticks(20);
    }
    const heads = state.heads - heads0;
    assert.range(heads, 17, 20, 'headshots out of 20');
    return { heads };
  });
  t.test('rounds aimed at the body land on the body, not the head', () => {
    const { h, e } = range();
    const heads0 = state.heads, hits0 = state.hits;
    for (let k = 0; k < 12; k++) { aimAt(h, e.x, e.y, bodyTop(e) * 0.45); aim.ads = true; h.fireCd = 0; h.mag = 30; aim.fire = true; tick(1 / 60); aim.fire = false; ticks(20); }
    assert.range(state.hits - hits0, 10, 12, 'hits');
    assert.eq(state.heads - heads0, 0, 'headshots');
  });
  t.test('a round aimed low into sandbags stops; aimed over them, it hits', () => {
    const { h, e } = range();
    addCover('sandbags', 48, 30.5);   // 9.5 m out, between the hero and the rifleman
    NAV.dirty = true;
    const hits0 = state.hits;
    for (let k = 0; k < 6; k++) { aimAt(h, 48 * PX, 30.5 * PX, 0.4 * PX); aim.ads = true; h.fireCd = 0; h.mag = 30; aim.fire = true; tick(1 / 60); aim.fire = false; ticks(20); }
    assert.eq(state.hits - hits0, 0, 'hits through the sandbags');
    for (let k = 0; k < 6; k++) { aimAt(h, e.x, e.y, bodyTop(e) * 0.6); aim.ads = true; h.fireCd = 0; h.mag = 30; aim.fire = true; tick(1 / 60); aim.fire = false; ticks(20); }
    assert.range(state.hits - hits0, 5, 6, 'hits over the sandbags');
  });
  t.test('buildings stop rounds', () => {
    newCampaign(); seed(5);
    const h = battle({ clear: true });
    benchSquad();
    const house = buildings.find(b => b.style === 'house1' && Math.abs(b.x - 7 * PX) < 1);   // the house at 2..12 m, 20..26 m
    assert.ok(house, 'found the house');
    h.x = 7 * PX; h.y = 29 * PX;                                   // on the cross street, south of it
    const e = G.spawn('grunt', 7 * PX, 17 * PX); e.sp = 0; e.ranged = 0;   // behind it, by the tracks
    const hits0 = state.hits;
    for (let k = 0; k < 8; k++) { aimAt(h, e.x, e.y, bodyTop(e) * 0.5); h.fireCd = 0; h.mag = 30; aim.fire = true; tick(1 / 60); aim.fire = false; ticks(15); }
    assert.eq(state.hits - hits0, 0, 'hits through the church');
  });
  // ---------- distance: a round has to arrive, and it has to go where the crosshair was ----------
  function lane(weapon, dm) {   // a clear firing lane the length of the town, one rifleman standing dm metres up it
    newCampaign(); seed(11);
    const h = battle({ weapon, clear: true });
    benchSquad(); setupObjectives([]);
    buildings.length = 0; obstacles.length = 0; mines = []; NAV.dirty = true; propsDirty = true;
    h.x = 48 * PX; h.y = 70 * PX; h.mag = 9999; h.reserve = 9999;
    const e = G.spawn('grunt', h.x, h.y - dm * PX);
    e.sp = 0; e.ranged = 0; e.dmg = 0; e.hp = e.maxHp = 1e6; e.stillT = 9;
    return { h, e };
  }
  function flight(h) {   // one round, then how far it got before it left the world
    bullets.length = 0;
    h.fireCd = 0; if (!h.pistol) h.mag = 9999;
    aim.fire = true; tick(1 / 60); aim.fire = false;
    const x0 = h.x, y0 = h.y;
    let far = 0;
    for (let k = 0; k < 600 && bullets.length; k++) { const b = bullets[0]; far = Math.hypot(b.x - x0, b.y - y0); tick(1 / 60); }
    return far / PX;
  }
  function volley(h, e, n) {   // n aimed rounds at the chest, each one fired from a settled crosshair
    const hits0 = state.hits, ex = e.x, ey = e.y;
    aim.ads = true;
    for (let k = 0; k < n; k++) {
      aimAt(h, ex, ey, bodyTop(e) * 0.62);
      h.fireCd = 0; h.mag = 9999; aim.fire = true; tick(1 / 60); aim.fire = false;
      ticks(60, 0, () => { e.x = ex; e.y = ey; e.stillT = 9; });   // let it fly the whole way
    }
    aim.ads = false;
    return state.hits - hits0;
  }
  t.test('your rounds fly the length of the town, whatever gun is in your hands', () => {
    const got = {};                                  // nothing in the lane and the crosshair a hair up, so this is the round's own flight
    for (const w of ['smg', 'ar', 'lmg', 'sniper', 'pistol']) {
      const { h } = lane(w === 'pistol' ? 'ar' : w, 60);   // the sidearm is what you are left holding, never a loadout
      enemies.length = 0;
      if (w === 'pistol') { h.pistol = true; h.reserve = 0; }
      aim.yaw = 0; aim.pitch = 0.02; aim.ads = true;
      got[w] = +flight(h).toFixed(1);
      aim.ads = false;
      assert.range(got[w], 110, 125, `${w}: metres flown (the town's diagonal is ${AIM_REACH / PX} m)`);
    }
    return got;
  });
  t.test('a rifleman 55 m down the street takes the rounds you put on him', () => {
    const got = {};
    for (const [w, least] of [['ar', 8], ['lmg', 6], ['sniper', 9], ['smg', 3]]) {
      const { h, e } = lane(w, 55);
      got[w] = volley(h, e, 10);
      assert.ok(got[w] >= least, `${w} at 55 m: ${got[w]} of 10 rounds registered`);
    }
    return got;
  });
  t.test('the round you fire goes where the crosshair was; the climb lands on the next one', () => {
    const { h, e } = lane('ar', 35);
    const d = Math.hypot(e.x - h.x, e.y - h.y), tz = bodyTop(e) * 0.62;
    let sum = 0;
    for (let k = 0; k < 24; k++) {
      aim.ads = true; aimAt(h, e.x, e.y, tz);
      const want = (tz - eyeZ()) / d;
      bullets.length = 0; h.fireCd = 0; h.mag = 9999; aim.fire = true; tick(1 / 60); aim.fire = false;
      sum += (bullets[0].vz / Math.hypot(bullets[0].vx, bullets[0].vy) - want) * d;
    }
    const off = sum / 24 / PX;
    assert.ok(Math.abs(off) < 0.1, `the round leaves ${(off * 100).toFixed(0)} cm off the crosshair at 35 m`);
    const p0 = aim.pitch;
    h.fireCd = 0; aim.fire = true; tick(1 / 60); aim.fire = false;
    assert.ok(aim.pitch > p0, 'the weapon still climbs, after the round has gone');
    return { off: +(off * 100).toFixed(1) };
  });
  t.test('the crosshair goes hot on a man 60 m away, and only when it is on him', () => {
    const { h, e } = lane('ar', 60);
    aimAt(h, e.x, e.y, bodyTop(e) * 0.62);
    h.tgtT = 0; tick(1 / 60);
    assert.eq(state.crossTarget, e, 'hot at 60 m');
    aim.yaw += 0.12; h.tgtT = 0; tick(1 / 60);   // 7 m to the side of him
    assert.eq(state.crossTarget, null, 'still hot with the crosshair off him');
    aimAt(h, e.x, e.y, bodyTop(e) * 0.62);
    addCover('hesco', 48, 40); NAV.dirty = true;   // a wall between the two of you
    h.tgtT = 0; tick(1 / 60);
    assert.eq(state.crossTarget, null, 'hot through a wall');
  });
  t.test('a rocket flies its own burn and goes off at the end of it', () => {
    const { h } = lane('rocket', 60);
    enemies.length = 0;
    aim.yaw = 0; aim.pitch = 0.02; aim.ads = true;
    assert.range(flight(h), 55, 65, 'metres before the warhead went off');
  });
});
