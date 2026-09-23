// The fight's dice belong to the fight. Drawing it — faces, shots, brass, shake, rain, blood, bodies, rubble — rolls the
// view's own dice (fxRand) or the sound's (aRand), never Math.random, so a seeded fight plays out the same whether it is
// drawn or not, and the first battle on a page plays out like every one after it.
suite('fair dice', t => {
  const counting = f => {   // Math.random draws made while f runs
    const real = Math.random;
    let n = 0;
    Math.random = () => { n++; return real(); };
    try { f(); } finally { Math.random = real; }
    return n;
  };
  function fight(render, n = 600) {   // ten seconds of a seeded fight with the bot at the controls: drawn every third tick, or not at all
    newCampaign(); seed(21);
    const h = battle({ weapon: 'ar', invuln: true });
    for (let k = 0; k < n; k++) { botTick(h); tick(1 / 60); if (render && k % 3 === 0) frames(1); }
    aim.fire = false; keys.KeyW = false;
    return JSON.stringify({ down: state.enemyDown, hits: state.hits, shots: state.shots, x: Math.round(h.x), y: Math.round(h.y),
      e: enemies.map(e => [e.type, Math.round(e.x), Math.round(e.y), Math.round(e.hp * 10)]) });
  }

  t.test('the first battle on a page plays out like the ones after it'   /* first in the suite: run alone, this is the page's first battle */, () => {
    const a = fight(true), b = fight(true);
    assert.eq(b, a, 'the same seed, twice');
    const s = JSON.parse(a);
    assert.ok(s.shots > 0 && s.e.length > 0, 'a real fight: rounds fired, enemies about');
    return { down: s.down, shots: s.shots };
  }, { timeout: 180000 });

  t.test('drawing the battle rolls none of the fight\'s dice: shots, brass, magazines, shake, rain and lightning, new faces', () => {
    newCampaign(); seed(3);
    const h = battle({ weapon: 'lmg' });
    state.weather = 'rain';
    let view = 0, brass = 0;
    for (let k = 0; k < 90; k++) {
      if (k % 30 === 0) G.spawnMany('grunt', 2);                            // someone new to draw
      botTick(h); aim.fire = true; cam.shake = 6;
      if (k === 45) { h.mag = 0; startReload(h); }                            // a magazine let go of
      tick(1 / 60);
      view += counting(() => frames(1, k === 60 ? 30 : 1 / 60));             // one long frame: lightning is certain
      brass = Math.max(brass, BRASS.length);
    }
    aim.fire = false;
    assert.ok(state.shots > 5, 'rounds fired: ' + state.shots);
    assert.ok(brass > 0, 'brass in the air');
    assert.eq(view, 0, 'dice drawn by the view');
    return { shots: state.shots, brass };
  });

  t.test('the same seeded fight plays out the same whether it is drawn or not', () => {
    const drawn = fight(true), blind = fight(false);
    assert.eq(drawn, blind, 'the fight with the view on and off');
    return { signature: drawn.length };
  }, { timeout: 180000 });

});
