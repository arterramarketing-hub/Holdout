suite('grenades', t => {
  function yard() {   // you on Main Street facing north, nothing around for 20 m
    newCampaign(); seed(5);
    const h = battle({ clear: true });
    benchSquad();
    h.x = 48 * PX; h.y = 44 * PX; clearArea(h.x, h.y - 500, 900);
    aim.yaw = 0; aim.pitch = 0; cam.yaw = 0;
    return h;
  }
  const flight = (g, maxTicks = 400) => { let n = 0; while (grenades.includes(g) && n < maxTicks) { tick(1 / 60); n++; } return n / 60; };
  t.test('a frag thrown level lands 10-25 m out and bursts 2.2 s after it leaves the hand', () => {
    const h = yard();
    const t0 = state.frontTime;
    assert.ok(throwGrenade(h), 'thrown');
    const g = grenades[grenades.length - 1];
    let far = 0, lastX = 0, lastY = 0;
    const n = (() => { let k = 0; while (grenades.includes(g) && k < 400) { far = Math.max(far, Math.hypot(g.x - h.x, g.y - h.y)); lastX = g.x; lastY = g.y; tick(1 / 60); k++; } return k; })();
    assert.range(n / 60, CFG.fragFuse - 0.05, CFG.fragFuse + 0.05, 'fuse seconds');
    assert.range(Math.hypot(lastX - h.x, lastY - h.y) / PX, 10, 25, 'where it burst (m)');
    return { burstAt: +(Math.hypot(lastX - h.x, lastY - h.y) / PX).toFixed(1), fuse: +(n / 60).toFixed(2) };
  });
  t.test('a frag thrown at a wall bounces back your way', () => {
    newCampaign(); seed(5);
    const h = battle({ clear: true });
    benchSquad();
    const house = buildings.find(b => b.style === 'house1' && Math.abs(b.x - 7 * PX) < 1);   // the house at 2..12 m, 20..26 m
    h.x = 7 * PX; h.y = 29 * PX; clearArea(h.x, h.y, 200);
    aim.yaw = 0; aim.pitch = -0.1; cam.yaw = 0;
    throwGrenade(h);
    const g = grenades[grenades.length - 1];
    let minY = Infinity;
    while (grenades.includes(g)) { minY = Math.min(minY, g.y); tick(1 / 60); }
    assert.ok(minY >= house.y + house.hd - 2, 'never went inside the house');
    assert.ok(g.y > house.y + house.hd, 'came to rest on your side of the wall');
  });
  t.test('the blast kills a rifleman at 2 m and leaves one at 6 m untouched', () => {
    const h = yard();
    const near = G.spawn('grunt', h.x - 2 * PX, h.y - 12 * PX), far = G.spawn('grunt', h.x + 6 * PX, h.y - 12 * PX);
    near.sp = far.sp = 0; near.ranged = far.ranged = 0;
    grenades.push({ x: h.x, y: h.y - 12 * PX, z: 0, vx: 0, vy: 0, vz: 0, fuse: 0.01, spin: 0, owner: h.slot, rest: true, tinkT: 0 });
    const kills0 = state.kills;
    tick(1 / 60);
    assert.ok(!enemies.includes(near), 'the rifleman 2 m out is down');
    assert.ok(enemies.includes(far) && far.hp === far.maxHp, 'the one 6 m out is untouched');
    assert.eq(state.kills - kills0, 1, 'your kill');
  });
  t.test('a breacher\'s shield does not stop a frag, and a house wall does', () => {
    const h = yard();
    const b = G.spawn('brute', h.x, h.y - 12 * PX); b.sp = 0; b.aim = Math.PI / 2;   // facing the blast
    grenades.push({ x: h.x, y: h.y - 11 * PX, z: 0, vx: 0, vy: 0, vz: 0, fuse: 0.01, spin: 0, owner: h.slot, rest: true, tinkT: 0 });
    tick(1 / 60);
    assert.ok(b.hp <= ETYPES.brute.hp - CFG.fragDmg * 0.7, `breacher took the full blast (hp ${b.hp.toFixed(2)})`);
    const house = buildings.find(bb => bb.style === 'house1' && Math.abs(bb.x - 7 * PX) < 1);
    const behind = G.spawn('grunt', 7 * PX, house.y - house.hd - 1.2 * PX); behind.sp = 0;
    grenades.push({ x: 7 * PX, y: house.y + house.hd + 1.2 * PX, z: 0, vx: 0, vy: 0, vz: 0, fuse: 0.01, spin: 0, owner: h.slot, rest: true, tinkT: 0 });
    tick(1 / 60);
    assert.eq(behind.hp, behind.maxHp, 'the wall shielded the rifleman');
  });
  t.test('your own frag hurts you at half strength, never kills you from full health, and never touches your squad', () => {
    newCampaign(); seed(5);
    const h = battle({ clear: true, invuln: false });
    h.x = 48 * PX; h.y = 44 * PX; clearArea(h.x, h.y, 700);
    const mate = soldiers.find(s => s.slot !== state.controlled); mate.x = h.x + 1 * PX; mate.y = h.y; mate.invuln = 0;
    grenades.push({ x: h.x, y: h.y, z: 0, vx: 0, vy: 0, vz: 0, fuse: 0.01, spin: 0, owner: h.slot, rest: true, tinkT: 0 });
    tick(1 / 60);
    assert.ok(h.alive, 'alive');
    assert.range(h.hp, 0.4, h.maxHp - 1, 'hurt, but standing');
    assert.eq(mate.hp, mate.maxHp, 'squadmate untouched');
    h.hp = 1; h.regenCd = 99;
    grenades.push({ x: h.x, y: h.y, z: 0, vx: 0, vy: 0, vz: 0, fuse: 0.01, spin: 0, owner: h.slot, rest: true, tinkT: 0 });
    tick(1 / 60);
    assert.ok(!h.alive, 'already hurt, it can finish you');
  });
  t.test('two frags a life; a care package tops them up', () => {
    const h = yard();
    assert.eq(h.frags, 2);
    assert.ok(throwGrenade(h)); ticks(50);
    assert.ok(throwGrenade(h)); ticks(50);
    assert.ok(!throwGrenade(h), 'out of frags');
    assert.eq(h.frags, 0);
    state.earned.supply = 1; useSupport('supply'); ticks(90);
    assert.eq(h.frags, 2, 'resupplied');
    h.frags = 0; respawnSoldier(h);
    assert.eq(h.frags, 2, 'a fresh life carries two');
  });
  t.test('G throws', () => {
    const h = yard();
    document.getElementById('boot') && document.getElementById('boot').remove();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG' }));
    assert.eq(h.frags, 1);
    assert.eq(grenades.length, 1);
  });
});
suite('grenade button', t => {
  t.test('the grenade button throws and shows what is left', () => {
    newCampaign();
    const h = battle({ clear: true });
    const b = $('nadebtn'), r = b.getBoundingClientRect();
    assert.ok(r.width > 30 && getComputedStyle(b).display !== 'none', 'on screen');
    frames(1);
    assert.eq($('nadecnt').textContent, '2');
    tapEl(b, 'pointerdown', r.x + r.width / 2, r.y + r.height / 2);
    assert.eq(h.frags, 1, 'thrown');
    frames(1);
    assert.eq($('nadecnt').textContent, '1');
    ticks(50); tapEl(b, 'pointerdown', r.x + r.width / 2, r.y + r.height / 2); frames(1);
    assert.ok(b.classList.contains('empty'), 'empty look at 0');
  });
}, { pass: 'touch' });
