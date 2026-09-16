// The firing range, completed the way a player would on each input.
const course = {
  step: () => state.training && TRAIN_STEPS[state.training.step] ? TRAIN_STEPS[state.training.step].id : null,
  until(id, maxSec, each) { let n = 0; while (course.step() === id && n < maxSec * 60) { if (each) each(); tick(1 / 60); n++; } return course.step() !== id; },
  yawTo: (h, x, y) => Math.atan2(x - h.x, -(y - h.y)),
  fragPitch(h, dist) {   // the crosshair pitch that lands a frag about dist px out on flat ground
    let best = 0, be = Infinity;
    for (let p = -0.6; p <= 0.4; p += 0.005) {
      const el = Math.atan(p) + CFG.fragLoft, v = CFG.fragSpeed;
      let x = 0, z = eyeZ() - 0.12 * PX, vx = Math.cos(el) * v, vz = Math.sin(el) * v;
      for (let i = 0; i < 600 && z > 0; i++) { vz -= FRAG_G / 120; x += vx / 120; z += vz / 120; }
      if (Math.abs(x - dist * 0.9) < be) { be = Math.abs(x - dist * 0.9); best = p; }
    }
    return best;
  },
};
function playCourse(input) {   // input: { move(h, x, y, sprint), fire(on), ads(on), reload(), grenade() }
  assert.ok(state.training && course.step() === 'move', 'the course is running: ' + course.step());
  el.modalbox.innerHTML = '';
  const h = soldiers[0], seen = [];
  const log = s => seen.push(s + '@' + Math.round(state.frontTime));
  const go = (p, sprint, id) => course.until(id, 25, () => { aim.yaw = course.yawTo(h, p[0] * PX, p[1] * PX); cam.yaw = aim.yaw; input.move(h, true, sprint); });
  assert.ok(go(RANGE.move, false, 'move'), 'reached the marker'); input.move(h, false); log('move');
  course.until('move', 2);
  let sign = 0;
  assert.ok(course.until('look', 20, () => { const p = RANGE.signs[Math.min(2, sign)]; aim.yaw = course.yawTo(h, p[0] * PX, p[1] * PX); if (state.training.seen[Math.min(2, sign)]) sign++; }), 'looked at the signs'); log('look');
  course.until('look', 2);
  const shootAll = (id, useAds) => course.until(id, 40, () => {
    const e = enemies.find(t => !t.down);
    if (!e) { input.fire(false); return; }
    aimAt(h, e.x, e.y, 0.95 * PX); input.ads(useAds);
    input.fire(h.fireCd <= 0 && state.frontTime % 0.3 < 0.1);
  });
  assert.ok(shootAll('shoot', false), 'knocked down the near targets'); input.fire(false); log('shoot');
  course.until('shoot', 2);
  assert.ok(shootAll('ads', true), 'knocked down the far targets down the sights'); input.fire(false); input.ads(false); log('ads');
  course.until('ads', 2);
  let pressed = false;
  assert.ok(course.until('reload', 10, () => { if (!pressed) { input.reload(); pressed = true; } }), 'reloaded'); log('reload');
  course.until('reload', 3);
  ticks(Math.ceil(((h.reloadT || 0) + 0.1) * 60));
  assert.ok(go(RANGE.sprint, true, 'sprint'), 'sprinted to the square'); input.move(h, false); log('sprint');
  course.until('sprint', 2);
  let thrownAt = -9;
  assert.ok(course.until('grenade', 30, () => {
    const cx = RANGE.frag.reduce((a, p) => a + p[0], 0) / 3 * PX, cy = RANGE.frag.reduce((a, p) => a + p[1], 0) / 3 * PX;
    aim.yaw = course.yawTo(h, cx, cy); cam.yaw = aim.yaw; aim.pitch = course.fragPitch(h, Math.hypot(cx - h.x, cy - h.y));
    if (state.frontTime - thrownAt > 3 && h.frags > 0 && !grenades.length) { input.grenade(); thrownAt = state.frontTime; }
  }), 'fragged the cluster'); log('grenade');
  course.until('grenade', 2);
  assert.ok(course.until('capture', 25, () => {
    const d = Math.hypot(RANGE.flag[0] * PX - h.x, RANGE.flag[1] * PX - h.y);
    aim.yaw = course.yawTo(h, RANGE.flag[0] * PX, RANGE.flag[1] * PX); cam.yaw = aim.yaw; input.move(h, d > 1.5 * PX, false);
  }), 'took the flag'); input.move(h, false); log('capture');
  ticks(60);
  return seen;
}
suite('firing range', t => {
  t.test('a new campaign is offered training on first launch; a skip is remembered', () => {
    newCampaign(); loadedFromSave = false; hideModal(); showScreen('map');
    offerTraining();
    assert.eq(el.modal.style.display, 'flex');
    assert.ok(/first time/i.test(el.modalbox.innerText));
    $('mskip').click();
    assert.ok(meta.trained, 'skip marks it done');
    offerTraining();
    assert.ok(el.modal.style.display !== 'flex', 'not offered again');
  });
  t.test('an old save is never offered training', () => {
    newCampaign();
    const old = JSON.parse(JSON.stringify(meta)); delete old.trained;
    localStorage.setItem(CFG.saveKey, JSON.stringify(old));
    loadMeta();
    assert.eq(meta.trained, true);
  });
  t.test('the start menu\'s range button opens training; the map button leaves it', () => {
    newCampaign(); hideModal(); showScreen('map');
    $('torange').click();
    assert.ok(state.training && screen === 'battle', 'in training');
    assert.ok(document.body.classList.contains('training'));
    assert.eq(enemies.length, 0, 'no enemy waves');
    ticks(300);
    assert.eq(enemies.length, 0, 'still none after 5 s');
    assert.eq(soldiers.length, 1, 'just you');
    $('tomap').click();
    assert.eq(screen, 'map'); assert.eq(state.training, null);
    assert.ok(!document.body.classList.contains('training'));
    assert.eq(meta.terr[1].progress, 0, 'nothing saved to a sector');
  });
  t.test('the two far targets fold to the UMP45 you start with, from the marker', () => {
    newCampaign(); seed(3); hideModal();
    meta.loadout = 'smg'; applyOpts();               // the gun a new player is holding, and the shortest reach in the game
    enterTraining();
    const h = soldiers[0];
    assert.eq(h.weapon, 'smg', 'the UMP45');
    state.training.step = TRAIN_STEPS.findIndex(x => x.id === 'ads');
    trainingStepBegin();
    h.x = RANGE.move[0] * PX; h.y = RANGE.move[1] * PX;   // standing on the marker the course walked you to
    assert.eq(enemies.length, 2, 'the two far targets');
    const out = [];
    for (const e of enemies.slice()) {
      const d = Math.hypot(e.x - h.x, e.y - h.y) / PX;
      out.push(+d.toFixed(1));
      assert.ok(d > WEAPONS.smg.reach / PX, `the target stands ${d.toFixed(1)} m out, inside the old ${WEAPONS.smg.reach / PX} m reach — this no longer tests anything`);
      for (let k = 0; k < 20 && !e.down; k++) {
        aim.ads = true; aimAt(h, e.x, e.y, 0.95 * PX);
        h.fireCd = 0; h.mag = 32; aim.fire = true; tick(1 / 60); aim.fire = false;
        ticks(30);
      }
      aim.fire = false; aim.ads = false;
      assert.ok(e.down, `the target ${d.toFixed(1)} m out never took a round`);
    }
    assert.ok(state.training.adsDowns >= 2, 'the step counts them and moves on');
    exitTraining();
    return { metres: out };
  }, { timeout: 120000 });
  t.test('keyboard and mouse: the whole course, then Deploy', () => {
    newCampaign(); seed(3); hideModal();
    enterTraining();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));   // the player's hands are on the keyboard
    frames(1);
    assert.ok(/W A S D/.test($('tbHint').textContent), 'keyboard prompt: ' + $('tbHint').textContent);
    const input = {
      move: (h, on, sprint) => { keys.KeyW = !!on; keys.ShiftLeft = !!(on && sprint); },
      fire: on => { aim.fire = !!on; },
      ads: on => { aim.ads = !!on; },
      reload: () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })),
      grenade: () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyG' })),
    };
    document.getElementById('boot') && document.getElementById('boot').remove();
    const seen = playCourse(input);
    assert.ok(/ready/i.test(el.modalbox.innerText), 'training complete card');
    assert.ok(meta.trained, 'remembered');
    $('mbtn').click();
    assert.eq(screen, 'battle'); assert.eq(state.training, null, 'a real front');
    assert.ok(enemies.length > 0, 'with enemies in it');
    return seen;
  }, { timeout: 240000 });
});
suite('firing range on a phone', t => {
  t.test('touch: prompts speak touch, and the buttons finish the course', () => {
    newCampaign(); seed(3); hideModal();
    enterTraining(); frames(1);
    assert.ok(/left thumb/i.test($('tbHint').textContent), 'touch prompt');
    const btn = id => { const b = $(id), r = b.getBoundingClientRect(); return [b, r.x + r.width / 2, r.y + r.height / 2]; };
    const input = {
      move: (h, on, sprint) => { joy.active = !!on; joy.id = on ? 1 : -1; joy.dx = 0; joy.dy = on ? (sprint ? -1 : -0.7) : 0; },
      fire: on => { const [b, x, y] = btn('firebtn'); if (on && !aim.fire) tapEl(b, 'pointerdown', x, y); else if (!on && aim.fire) tapEl(b, 'pointerup', x, y); },
      ads: on => { const [b, x, y] = btn('adsbtn'); if (!!on !== aim.ads) tapEl(b, 'pointerdown', x, y); },
      reload: () => { const [b, x, y] = btn('reloadbtn'); tapEl(b, 'pointerdown', x, y); },
      grenade: () => { const [b, x, y] = btn('nadebtn'); tapEl(b, 'pointerdown', x, y); },
    };
    playCourse(input);
    assert.ok(/ready/i.test(el.modalbox.innerText), 'training complete');
    $('mback').click();
    assert.eq(screen, 'map');
  }, { timeout: 240000 });
}, { pass: 'touch' });
suite('firing range with a controller', t => {
  t.test('controller: prompts speak buttons, and the pad finishes the course', () => {
    newCampaign(); seed(3); hideModal();
    const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
    const set = (i, on) => { pad.buttons[i] = { pressed: !!on, value: on ? 1 : 0 }; };
    const tapBtn = i => { set(i, true); tick(1 / 60); set(i, false); tick(1 / 60); };
    enterTraining();
    tapBtn(GPB.X);   // touch the pad so the prompts switch
    frames(1);
    assert.ok(/left stick/i.test($('tbHint').textContent), 'controller prompt');
    let sprintOn = false;
    const input = {
      move: (h, on, sprint) => { pad.axes[1] = on ? -1 : 0; if (on && sprint && !aim.sprintPad) tapBtn(GPB.L3); },
      fire: on => set(GPB.RT, on),
      ads: on => set(GPB.LT, on),
      reload: () => tapBtn(GPB.X),
      grenade: () => tapBtn(GPB.RB),
    };
    const seen = playCourse(input);
    Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true });
    assert.ok(/ready/i.test(el.modalbox.innerText), 'training complete');
    assert.ok(state.frontTime > 10, `the course took game time (${state.frontTime.toFixed(1)} s)`);
    $('mback').click();
    return seen;
  }, { timeout: 240000 });
});
