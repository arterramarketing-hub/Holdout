// v8: telling friend from foe, information you earn, the new killstreaks, blood, the cemetery.
const lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
function squadScene() {   // you on Main Street facing north, your three teammates spread out ahead
  newCampaign(); seed(8);
  const h = battle({ clear: true });
  setupObjectives([]);
  h.x = 48 * PX; h.y = 48 * PX; aim.yaw = 0; aim.pitch = 0; cam.yaw = 0;
  soldiers.filter(s => s.slot !== state.controlled).forEach((m, i) => { m.alive = true; m.invuln = 1e9; m.fireCd = 999; m.x = h.x + (i - 1) * 3 * PX; m.y = h.y - (8 + i * 6) * PX; });
  return h;
}
suite('friend or foe', t => {
  t.test('a green triangle and a name over every living teammate in view, never over you', () => {
    const h = squadScene();
    frames(2);
    const mates = soldiers.filter(s => s.slot !== state.controlled);
    for (const m of mates) {
      const tag = $('mate' + m.slot);
      assert.eq(tag.style.display, 'flex', 'a tag over ' + meta.squad[m.slot].name);
      assert.ok(tag.textContent.toUpperCase().includes(meta.squad[m.slot].name.toUpperCase()), 'named: ' + tag.textContent);
      assert.eq(getComputedStyle(tag, '::after').borderTopColor.replace(/\s/g, ''), 'rgb(95,220,74)', 'the triangle is green');
    }
    assert.eq($('mate' + state.controlled).style.display, 'none', 'nothing over your own head');
    const r = $('mate' + mates[0].slot).getBoundingClientRect();
    toScreen(mates[0].x, mates[0].y, (soldierTop(mates[0]) / PX + 0.3) / ZS);
    assert.near(r.left + r.width / 2, SCR.x, 1.5, 'centred over them');
    assert.near(r.bottom, SCR.y, 1.5, 'the point of the triangle just above the head');
    mates[0].alive = false; frames(1);
    assert.eq($('mate' + mates[0].slot).style.display, 'none', 'gone when they fall');
    mates[2].y = h.y - 40 * PX; frames(1);
    assert.ok($('mate' + mates[2].slot).classList.contains('far'), 'past 35 m: the triangle alone');
    aim.yaw = Math.PI; cam.yaw = Math.PI; frames(2);
    assert.ok(mates.every(m => $('mate' + m.slot).style.display === 'none'), 'nothing for teammates behind you');
  });
  t.test('the enemy is dark with a red armband; your squad is light', () => {
    const us = soldierPalette(1, slotColor(1), slotDark(1)), them = enemyPalette(ETYPES.grunt.col);
    assert.ok(lum(them.coat) < lum(us.coat) * 0.5, `their jackets are less than half as light as ours (${lum(them.coat).toFixed(3)} vs ${lum(us.coat).toFixed(3)})`);
    assert.ok(lum(them.pants) < lum(us.pants) * 0.5, 'and their trousers');
    assert.ok(them.armband.r > 0.4 && them.armband.g < 0.15 && them.armband.b < 0.15, 'the armband is red');
    const rows = ENEMY_ROWS.grunt();
    assert.eq(rows.filter(p => p[8] === 'armband').length, 2, 'an armband on each arm');
    for (const type of Object.keys(ENEMY_ROWS)) assert.ok(ENEMY_ROWS[type]().some(p => p[8] === 'armband'), type + ' wears it too');
  });
});

suite('information you earn', t => {
  const mapPixel = (dxm, dym) => {   // the minimap's colour a given number of metres right/up of centre, as drawn
    drawMinimap();
    const c = $('minimap'), g = c.getContext('2d'), sc = c.width / 1600;
    const d = g.getImageData(Math.round(c.width / 2 + dxm * PX * sc), Math.round(c.height / 2 - dym * PX * sc), 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  };
  const red = p => p.r > 150 && p.g < 110 && p.b < 110;
  t.test('the minimap turns with you: what is ahead of you is up, whichever way you face', () => {
    const h = squadScene();
    for (const s of soldiers) if (s.slot !== state.controlled) { s.alive = false; s.x = -999; }
    const e = G.spawn('grunt', h.x + 10 * PX, h.y); e.sp = 0; e.ranged = 0; e.firedT = state.frontTime;   // 10 m east of you, and it has just fired
    aim.yaw = Math.PI / 2; cam.yaw = Math.PI / 2;   // facing east
    assert.ok(red(mapPixel(0, 10)), 'facing east, the enemy to the east is straight up the map');
    aim.yaw = 0; cam.yaw = 0;   // facing north
    assert.ok(red(mapPixel(10, 0)), 'facing north, it is off to the right');
    assert.ok(!red(mapPixel(0, 10)), 'and no longer up');
  });
  t.test('an enemy shows on the minimap only for a moment after it fires, or while a UAV is up', () => {
    const h = squadScene();
    for (const s of soldiers) if (s.slot !== state.controlled) { s.alive = false; s.x = -999; }
    aim.yaw = 0; cam.yaw = 0;
    const e = G.spawn('grunt', h.x, h.y - 8 * PX); e.sp = 0; e.ranged = 0;   // 8 m ahead: close, but quiet
    e.firedT = null;
    assert.ok(!red(mapPixel(0, 8)), 'close and quiet: not shown');
    e.firedT = state.frontTime;
    assert.ok(red(mapPixel(0, 8)), 'just fired: shown');
    state.frontTime += MINIMAP_FIRED + 0.1;
    assert.ok(!red(mapPixel(0, 8)), 'gone again a moment later');
    state.uavT = 10;
    assert.ok(red(mapPixel(0, 8)), 'under a UAV: shown, fired or not');
    state.uavT = 0;
  });
});
