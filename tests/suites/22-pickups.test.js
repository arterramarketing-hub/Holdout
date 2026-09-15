// Enemy guns you can pick up, and the second gun: drops, taking, swapping, ammo, the models' sights, and every input.
const killOne = (type, x, y) => { const e = G.spawn(type, x, y); e.sp = 0; hurtEnemy(enemies.indexOf(e), 99, { player: true, wkey: 'ar', slot: 0 }, null); return e; };
const holdTake = (sec) => { aim.take = true; ticks(Math.round(sec * 60)); aim.take = false; };
function pickupScene() {
  newCampaign(); seed(9);
  const h = battle({ clear: true });
  benchSquad(); setupObjectives([]);
  h.x = 48 * PX; h.y = 44 * PX; clearArea(h.x, h.y, 400); weaponDrops.length = 0;
  return h;
}
suite('enemy guns and the second gun', t => {
  t.test('riflemen drop an AK-47 and gunners a PKM, with a partial magazine and a spare; runners drop nothing', () => {
    const h = pickupScene();
    killOne('grunt', h.x + 200, h.y);
    assert.eq(weaponDrops.length, 1, 'one drop');
    const ak = weaponDrops[0];
    assert.eq(ak.key, 'ak'); assert.range(ak.mag, 10, 30, 'rounds left'); assert.eq(ak.reserve, 30, 'a spare magazine');
    assert.ok(corpses[corpses.length - 1].noGun, 'the corpse no longer draws that gun');
    killOne('gunner', h.x - 200, h.y);
    const pkm = weaponDrops[1];
    assert.eq(pkm.key, 'pkm'); assert.range(pkm.mag, 40, 100); assert.eq(pkm.reserve, 100);
    killOne('runner', h.x, h.y - 200);
    assert.eq(weaponDrops.length, 2, 'a runner carries no gun to drop');
    assert.ok(!WKEYS.includes('ak') && !WKEYS.includes('pkm'), 'never offered in BATTLE PREP');
  });
  t.test('holding F by a gun takes it after 0.35 s, and your own goes on your back with its rounds', () => {
    const h = pickupScene();
    h.mag = 17; h.reserve = 60;
    const d = dropGun('ak', h.x + 50, h.y, 22, 30);
    tick(1 / 60);
    assert.eq(state.pickDrop, d, 'offered');
    holdTake(0.2);
    assert.eq(h.weapon, 'ar', 'not yet at 0.2 s');
    holdTake(0.4);
    assert.eq(h.weapon, 'ak', 'taken');
    assert.eq(h.mag, 22); assert.eq(h.reserve, 30);
    assert.ok(h.alt && h.alt.weapon === 'ar' && h.alt.mag === 17 && h.alt.reserve === 60, 'the M4 holstered as it was');
    assert.eq(weaponDrops.length, 0, 'the drop is gone');
  });
  t.test('with both slots full, the gun in your hands goes down where you stand', () => {
    const h = pickupScene();
    takeGun(h, dropGun('ak', h.x, h.y, 25, 30));
    h.swapT = 0;
    const pk = dropGun('pkm', h.x + 50, h.y, 80, 100);
    tick(1 / 60); holdTake(0.45);
    assert.eq(h.weapon, 'pkm'); assert.eq(h.alt.weapon, 'ar', 'the second slot still holds the M4');
    const ak = weaponDrops.find(d => d.key === 'ak');
    assert.ok(ak && Math.hypot(ak.x - h.x, ak.y - h.y) < 40, 'the AK lies at your feet');
    assert.eq(ak.mag + ak.reserve, 55, 'with its rounds');
    assert.ok(!weaponDrops.includes(pk));
  });
  t.test('a swap takes 0.45 s: no firing, a reload cancelled, each gun keeps its ammo', () => {
    const h = pickupScene();
    takeGun(h, dropGun('ak', h.x, h.y, 12, 30)); h.swapT = 0;
    startReload(h);
    assert.ok(h.reloadT > 0, 'reloading the AK');
    assert.ok(swapWeapon(h), 'Q swaps');
    assert.eq(h.reloadT, 0, 'the reload is cancelled');
    const shots = state.shots;
    aim.fire = true; ticks(15); aim.fire = false;
    assert.eq(state.shots, shots, 'nothing fired while changing guns');
    assert.eq(h.weapon, 'ar', 'the guns traded places halfway');
    ticks(15);
    assert.eq(h.swapT, 0);
    assert.ok(h.alt.weapon === 'ak' && h.alt.mag === 12 && h.alt.reserve === 30, 'the AK kept its rounds');
    aim.fire = true; tick(1 / 60); aim.fire = false;
    assert.eq(state.shots, shots + 1, 'and the M4 fires once it is up');
    assert.ok(!swapWeapon(Object.assign({}, h, { alt: null })), 'nothing to swap to without a second gun');
  });
  t.test('walking over a kind you carry takes its rounds; on the pistol with a free slot, over any gun takes it', () => {
    const h = pickupScene();
    takeGun(h, dropGun('ak', h.x, h.y, 30, 0)); h.swapT = 0;
    dropGun('ak', h.x + 20, h.y, 20, 30);
    tick(1 / 60);
    assert.eq(h.reserve, 50, 'all fifty rounds fit');
    h.alt.reserve = 60;
    dropGun('ar', h.x - 20, h.y, 30, 0);
    const before = h.alt.reserve; tick(1 / 60);
    assert.ok(h.alt.reserve > before, 'the holstered M4 takes an M4');
    const h2 = pickupScene();
    h2.mag = 0; h2.reserve = 0; h2.pistol = true;
    dropGun('pkm', h2.x + 20, h2.y, 70, 100);
    tick(1 / 60);
    assert.eq(h2.weapon, 'pkm', 'taken the moment you step on it');
    assert.ok(!h2.pistol && h2.alt.weapon === 'ar');
  });
  t.test('a gun run dry swaps to a loaded second gun before the pistol, and GRAB A RIFLE when guns are near', () => {
    const h = pickupScene();
    takeGun(h, dropGun('ak', h.x, h.y, 1, 0)); h.swapT = 0;
    aim.fire = true; ticks(8); aim.fire = false;
    assert.ok(h.swapT > 0 || h.weapon === 'ar', 'swapping to the M4');
    assert.ok(!h.pistol, 'no pistol while the M4 has rounds');
    ticks(30);
    h.mag = 0; h.reserve = 0; h.alt.mag = 0; h.alt.reserve = 0;
    dropGun('pkm', h.x + 300, h.y, 50, 0);
    bannerQueue.length = 0;
    aim.fire = true; tick(1 / 60); aim.fire = false;
    assert.ok(h.pistol, 'both dry: the pistol');
    assert.ok(bannerQueue.includes('OUT OF AMMO — GRAB A RIFLE') || el.banner.textContent === 'OUT OF AMMO — GRAB A RIFLE', 'banner: ' + el.banner.textContent);
  });
  t.test('drops lie for 45 s; a reinforcement comes back with the loadout gun only', () => {
    const h = pickupScene();
    dropGun('ak', h.x + 900, h.y, 20, 30);
    ticks(44 * 60);
    assert.eq(weaponDrops.length, 1, 'still there at 44 s');
    ticks(90);
    assert.eq(weaponDrops.length, 0, 'gone by 45 s');
    takeGun(h, dropGun('pkm', h.x, h.y, 90, 100));
    respawnSoldier(h);
    assert.eq(h.weapon, 'ar'); assert.eq(h.alt, null); assert.eq(h.mag, magCap(h));
  });
  t.test('damage feel: three AK rounds drop a rifleman at 10 and 18 m, a fourth is needed at 25 m', () => {
    const three = m => 3 * squadDmg('ak') * falloffMul('ak', m * PX) >= ETYPES.grunt.hp - 1e-9;
    assert.ok(three(10) && three(18) && three(21), 'three hits to 21 m');
    assert.ok(!three(25), 'four at 25 m');
    assert.ok(3 * squadDmg('pkm') * falloffMul('pkm', 12 * PX) >= 3, 'the PKM drops one in three at 12 m');
  });
  t.test('the AK and PKM sights sit on the ADS line, and nothing on the gun blocks it', () => {
    for (const key of ['ak', 'pkm']) {
      const ads = adsInfo(key, NO_ATT), parts = gunParts(key, NO_ATT);
      const box = p => { const e = p.m.elements; return { x: e[12], y: e[13], z: e[14], hx: (Math.abs(e[0]) + Math.abs(e[4]) + Math.abs(e[8])) / 2, hy: (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9])) / 2, hz: (Math.abs(e[2]) + Math.abs(e[6]) + Math.abs(e[10])) / 2 }; };
      const tip = parts.map(box).find((b, i) => parts[i].col === 'sightw');
      assert.ok(tip, key + ' has a post tip');
      assert.near(tip.y + tip.hy, ads.y + 0.001, 0.0025, key + ' post tip on the line');
      const notch = parts.map(box).filter(b => Math.abs(b.z - ads.z) < 0.004 && Math.abs(b.x) > 0.004 && Math.abs(b.x) < 0.012 && b.hx < 0.006);
      assert.eq(notch.length, 2, key + ' notch uprights at the ADS point');
      for (const n of notch) assert.near(n.y + n.hy, ads.y + 0.002, 0.0025, key + ' notch top');
      for (const b of parts.map(box)) {
        const between = b.z + b.hz > tip.z && b.z - b.hz < ads.z, onLine = Math.abs(b.x) - b.hx < 0.003;
        if (between && onLine && b !== tip && Math.abs(b.z - tip.z) > 0.01) assert.ok(b.y + b.hy < ads.y - 0.003, `${key}: a part at z ${b.z.toFixed(3)} rises to ${(b.y + b.hy).toFixed(3)} across the sight line`);
      }
    }
  });
  t.test('the HUD names the second gun, and the prompt says what to hold', () => {
    const h = pickupScene();
    takeGun(h, dropGun('ak', h.x, h.y, 20, 30)); h.swapT = 0;
    dropGun('pkm', h.x + 50, h.y, 60, 100);
    tick(1 / 60); G.frame(1 / 60);
    assert.eq($('amalt').textContent, `⇄ M4A1 · ${h.alt.mag + h.alt.reserve}`);
    assert.ok($('pickbtn').classList.contains('on'), 'prompt shows');
    assert.eq($('pickkey').textContent, 'Hold F'); assert.eq($('pickname').textContent, 'PKM');
    weaponDrops.length = 0; tick(1 / 60); G.frame(1 / 60);
    assert.ok(!$('pickbtn').classList.contains('on'), 'and goes with the gun');
  });
  t.test('controller: Y swaps, D-pad down switches view, X taps reload and X held by a gun takes it', () => {
    const h = pickupScene();
    const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
    const press = (b, frames = 1) => { pad.buttons[b] = { pressed: true, value: 1 }; ticks(frames); pad.buttons[b] = { pressed: false, value: 0 }; tick(1 / 60); };
    try {
      GPAD.prev = [];
      takeGun(h, dropGun('ak', h.x, h.y, 20, 30)); h.swapT = 0;
      press(GPB.Y);
      assert.ok(h.swapT > 0, 'Y swaps');
      ticks(30);
      const fpv = meta.opts.fpv;
      press(GPB.DOWN);
      assert.eq(meta.opts.fpv, !fpv, 'D-pad down switches view');
      meta.opts.fpv = fpv; applyOpts();
      h.mag = 5; h.reserve = 60;
      press(GPB.X);
      assert.ok(h.reloadT > 0, 'a tap on X reloads');
      h.reloadT = 0; h.mag = 5;
      dropGun('pkm', h.x + 50, h.y, 60, 100); tick(1 / 60);
      press(GPB.X, 30);
      assert.eq(h.weapon, 'pkm', 'held by a gun, X takes it');
      assert.eq(h.reloadT, 0, 'and does not also reload');
    } finally { Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true }); tick(1 / 60); }
  });
});
suite('touch: second gun and pickup buttons', t => {
  t.test('the swap pill and the pickup button show when they should, and overlap nothing', () => {
    const h = pickupScene();
    frames(1);
    const shown = id => getComputedStyle($(id)).display !== 'none';
    assert.ok(!shown('swapbtn') && !shown('pickbtn'), 'hidden with one gun and none on the ground');
    takeGun(h, dropGun('ak', h.x, h.y, 20, 30)); h.swapT = 0;
    dropGun('pkm', h.x + 50, h.y, 60, 100);
    tick(1 / 60); frames(1);
    assert.ok(shown('swapbtn') && shown('pickbtn'), 'both show');
    const r = id => $(id).getBoundingClientRect();
    const hit = (a, b, pad = 2) => a.left < b.right - pad && b.left < a.right - pad && a.top < b.bottom - pad && b.top < a.bottom - pad;
    const others = ['firebtn', 'firebtn2', 'adsbtn', 'reloadbtn', 'nadebtn', 'ammo', 'supports', 'topbar', 'tickets', 'minimap'].filter(id => shown(id) && r(id).width);
    for (const id of ['swapbtn', 'pickbtn']) {
      const a = r(id);
      assert.ok(a.left >= 0 && a.right <= innerWidth && a.bottom <= innerHeight, id + ' on screen');
      for (const o of others) assert.ok(!hit(a, r(o)), `${id} overlaps ${o}`);
    }
    assert.ok(!hit(r('swapbtn'), r('pickbtn')), 'swap and pickup apart');
    tapEl($('swapbtn'), 'pointerdown', r('swapbtn').x + 5, r('swapbtn').y + 5);
    assert.ok(h.swapT > 0, 'tapping the pill swaps');
    ticks(30);
    const pb = $('pickbtn'), pr = pb.getBoundingClientRect();
    tapEl(pb, 'pointerdown', pr.x + 5, pr.y + 5);
    assert.ok(aim.take, 'holding the button');
    ticks(30);
    tapEl(pb, 'pointerup', pr.x + 5, pr.y + 5);
    assert.eq(h.weapon, 'pkm', 'held long enough, the PKM is taken');
  });
}, { pass: ['touch', 'small'] });
