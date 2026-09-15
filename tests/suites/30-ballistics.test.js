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
});
