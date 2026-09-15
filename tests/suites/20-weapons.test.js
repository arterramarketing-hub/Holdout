suite('weapons', t => {
  for (const w of ['ar', 'smg', 'lmg', 'sniper', 'rocket']) t.test(`${w}: fires, reloads, falls back to the pistol`, () => {
    newCampaign(); seed(3);
    const h = battle({ weapon: w, clear: true });
    const shots0 = state.shots;
    for (let k = 0; k < 6; k++) { aim.ads = k % 2 === 1; aim.pitch = 0.01 * k; h.fireCd = 0; aim.fire = true; ticks(2, 1); aim.fire = false; ticks(8, 2); }
    assert.ok(state.shots > shots0, 'rounds went downrange');
    h.mag = 1; h.reserve = 60; startReload(h);
    ticks(Math.ceil((h.reloadDur || 3) * 60) + 10, 4);
    assert.eq(h.mag, Math.min(magCap(h), 61), 'magazine refilled');
    h.mag = 0; h.reserve = 0; startReload(h); h.fireCd = 0; aim.fire = true; ticks(20, 2); aim.fire = false;
    assert.ok(h.pistol, 'sidearm drawn when dry');
    return { brass: BRASS.length, drops: DROPS.length };
  });
});
