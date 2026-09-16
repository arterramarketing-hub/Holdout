suite('weapons', t => {
  for (const w of ['ar', 'smg', 'lmg', 'sniper', 'rocket']) t.test(`${w}: fires, reloads, falls back to the pistol`, () => {
    newCampaign(); seed(3);
    const h = battle({ weapon: w, clear: true });
    const shots0 = state.shots;
    for (let k = 0; k < 6; k++) { aim.ads = k % 2 === 1; aim.pitch = 0.01 * k; h.fireCd = 0; aim.fire = true; ticks(2, 2); aim.fire = false; ticks(8, 8); }
    assert.ok(state.shots > shots0, 'rounds went downrange');
    h.mag = 1; h.reserve = 60; startReload(h);
    ticks(Math.ceil((h.reloadDur || 3) * 60) + 10, 20);
    assert.eq(h.mag, Math.min(magCap(h), 61), 'magazine refilled');
    h.mag = 0; h.reserve = 0; startReload(h); h.fireCd = 0; aim.fire = true; ticks(20, 10); aim.fire = false;
    assert.ok(h.pistol, 'sidearm drawn when dry');
    return { brass: BRASS.length, drops: DROPS.length };
  });
  t.test('the 6x scope: a duplex laid from the exact middle, no ring in it, and no flash floating in the glass', () => {
    newCampaign(); seed(3);
    const h = battle({ weapon: 'sniper', clear: true });
    benchSquad();
    aim.ads = true; frames(2, 0.5);
    const so = $('sight'), ret = $('sg-ret').getBoundingClientRect();
    assert.eq(so.className, 'scope');
    assert.near(ret.left + ret.width / 2, innerWidth / 2, 0.51, 'centred across');
    assert.near(ret.top + ret.height / 2, innerHeight / 2, 0.51, 'centred down');
    for (const pseudo of ['::before', '::after']) {
      const cs = getComputedStyle($('sg-ret'), pseudo);
      assert.ok(!parseFloat(cs.borderTopWidth) && cs.borderTopLeftRadius === '0px', pseudo + ' is not a ring');
      assert.eq(cs.boxSizing, 'border-box', pseudo + ' is sized from its own edges');
    }
    const post = getComputedStyle($('sg-ret'), '::before');
    assert.near(parseFloat(post.top) + parseFloat(post.height) / 2, ret.height / 2, 0.01, 'the posts sit on the centre line');
    let blooms = 0;
    const realBloom = bloomAt;
    bloomAt = (...a) => { blooms++; return realBloom(...a); };
    try {
      h.fireCd = 0; h.mag = 5; aim.fire = true; tick(1 / 60); aim.fire = false;
      frames(1, 1 / 600);
      assert.eq(blooms, 0, 'no muzzle glow in the glass');
      const toMuz = new THREE.Vector3().subVectors(FPV.muz, VIEW.camera.position).normalize();
      assert.ok(toMuz.dot(VIEW.camera.getWorldDirection(new THREE.Vector3())) > 0.9999, 'the round leaves from the middle of the glass, not the barrel below it');
      aim.ads = false; ticks(90); frames(2, 0.5);   // from the hip the flash is back where the barrel is (the bolt worked, the recoil settled)
      h.fireCd = 0; h.mag = 5; aim.fire = true; tick(1 / 60); aim.fire = false;
      blooms = 0; frames(1, 1 / 600);
      assert.ok(blooms > 0, 'from the hip the muzzle still flashes');
    } finally { bloomAt = realBloom; aim.ads = false; }
  });
});
