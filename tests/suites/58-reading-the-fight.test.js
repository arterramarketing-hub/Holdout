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
