suite('footsteps, barks and callouts', t => {
  const rms = b => { const d = b.getChannelData(0); let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i]; return Math.sqrt(s / d.length); };
  const loud = b => {   // loudest 50 ms of a sound: how loud it seems, whatever its length
    const d = b.getChannelData(0), w = Math.floor(b.sampleRate * 0.05);
    let s = 0, best = 0;
    for (let i = 0; i < d.length; i++) { s += d[i] * d[i]; if (i >= w) s -= d[i - w] * d[i - w]; if (i >= w - 1) best = Math.max(best, s); }
    return Math.sqrt(best / w);
  };
  const db = r => 20 * Math.log10(r);
  async function audioReady() {
    document.getElementById('boot') && document.getElementById('boot').remove();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));   // any key starts the audio
    await waitFor(() => SFX.buf['radio'] && SFX.buf['bark:5'] && SFX.buf['step:soft:3'], 90000, 'the sounds to render');
  }
  function listen() {   // record what gets played
    const real = playBuf, log = [];
    playBuf = (k, o) => { log.push({ k, o: Object.assign({}, o) }); return real(k, o); };
    return { log, stop: () => { playBuf = real; } };
  }
  t.test('footfalls on three grounds, six barks and the squad net chirp are synthesised', async () => {
    await audioReady();
    const keys = [...['hard', 'gravel', 'soft'].flatMap(s => [0, 1, 2, 3].map(i => `step:${s}:${i}`)), ...[0, 1, 2, 3, 4, 5].map(i => `bark:${i}`), 'radio'];
    for (const k of keys) { assert.ok(SFX.buf[k], k); assert.ok(rms(SFX.buf[k]) > 0.02, `${k} is not silent`); }
  }, { timeout: 120000 });
  t.test('the ground decides the footfall', () => {
    assert.eq(surfaceAt(49 * PX, 38 * PX), 'hard', 'the paved square');
    assert.eq(surfaceAt(20 * PX, 40 * PX), 'hard', 'the cobbled market');
    assert.eq(surfaceAt(33 * PX, 60 * PX), 'gravel', 'the building site');
    assert.eq(surfaceAt(12 * PX, 62 * PX), 'soft', 'the cemetery grass');
  });
  t.test('a footfall every stride: 0.78 m walking, 1.05 m sprinting', async () => {
    await audioReady();
    newCampaign(); seed(2);
    const h = battle({ clear: true });
    benchSquad();
    h.x = 48 * PX; h.y = 46 * PX; clearArea(h.x, h.y - 400, 700);
    aim.yaw = 0; cam.yaw = 0;
    const ear = listen();
    let x0 = h.x, y0 = h.y, n0 = h.steps || 0;
    keys.KeyW = true; ticks(120, 0, () => { cam.yaw = aim.yaw; });
    const walked = Math.hypot(h.x - x0, h.y - y0), walkSteps = (h.steps || 0) - n0;
    assert.near(walkSteps, walked / (0.78 * PX), 1.01, 'walking footfalls');
    h.x = 48 * PX; h.y = 46 * PX; h.stepD = 0; x0 = h.x; y0 = h.y; n0 = h.steps;
    keys.ShiftLeft = true; ticks(120, 0, () => { cam.yaw = aim.yaw; });
    keys.KeyW = keys.ShiftLeft = false;
    const ran = Math.hypot(h.x - x0, h.y - y0), runSteps = h.steps - n0;
    ear.stop();
    assert.near(runSteps, ran / (1.05 * PX), 1.01, 'sprinting footfalls');
    assert.ok(ear.log.some(l => l.k.startsWith('step:hard:')), 'paving sounds hard');
    return { walkSteps, runSteps };
  }, { timeout: 120000 });
  t.test('enemy footfalls come from where the enemy is and fade out by 25 m', async () => {
    await audioReady();
    newCampaign(); seed(3);
    const h = battle({ clear: true });
    benchSquad();
    h.x = 48 * PX; h.y = 44 * PX; clearArea(h.x, h.y, 1200);
    aim.yaw = 0; cam.yaw = 0; frames(1);
    const ear = listen();
    const near = G.spawn('runner', h.x - 8 * PX, h.y); near.sp = 0;
    for (let i = 0; i < 12; i++) { near.x = h.x - 8 * PX; near.y = h.y + (i % 2 ? 1 : -1) * 20; stepSound(near, 0.9 * PX, 'enemy'); }
    const far = G.spawn('grunt', h.x + 30 * PX, h.y); far.sp = 0;
    const before = ear.log.length;
    for (let i = 0; i < 12; i++) stepSound(far, 0.9 * PX, 'enemy');
    ear.stop();
    const nearSteps = ear.log.slice(0, before).filter(l => l.k.startsWith('step:'));
    assert.ok(nearSteps.length >= 3, 'near footfalls heard');
    assert.ok(nearSteps.every(l => panOf(l.o.x, l.o.y) < -0.3), 'on the left');
    assert.eq(ear.log.slice(before).filter(l => l.k.startsWith('step:')).length, 0, 'nothing from 30 m');
  }, { timeout: 120000 });
  t.test('the squad never calls where an enemy is: nothing for one on your flank or behind you, and no setting for it', () => {
    newCampaign(); seed(4);
    const h = battle({ clear: true });
    h.x = 48 * PX; h.y = 50 * PX; clearArea(h.x, h.y, 1200);
    aim.yaw = 0; cam.yaw = 0;
    const mate = soldiers.find(s => s !== h);
    for (const s of soldiers) if (s !== h && s !== mate) { s.alive = false; s.respawnT = 1e9; s.x = -999; }
    const pin = () => { h.invuln = 1e9; mate.invuln = 1e9; mate.fireCd = 999; mate.x = h.x; mate.y = h.y + 1.5 * PX; mate.path = null; };
    const left = G.spawn('grunt', h.x - 14 * PX, h.y + 0.5 * PX), behind = G.spawn('grunt', h.x + 1 * PX, h.y + 12 * PX);
    for (const e of [left, behind]) { e.sp = 0; e.ranged = 0; e.hp = 1e6; }
    ticks(120, 0, () => { pin(); left.x = h.x - 14 * PX; left.y = h.y + 0.5 * PX; behind.x = h.x + PX; behind.y = h.y + 12 * PX; });
    assert.eq(state.callout, null, 'nothing called: ' + JSON.stringify(state.callout));
    assert.ok(!('callouts' in freshMeta().opts), 'no Callouts option in a new campaign');
    showSettings();
    assert.ok(!/callouts/i.test(el.modalbox.innerText), 'and no row for it in Settings');
    hideModal();
  });
  t.test('barks keep their spacing over a whole front: 1.2 s apart, 6 s per enemy', async () => {
    await audioReady();
    newCampaign(); seed(1);
    battle();
    const r = botFront(600, { renderEvery: 600 });
    const barks = VOICE.barks.slice();
    assert.ok(barks.length >= 5, `enemies barked (${barks.length})`);
    for (let i = 1; i < barks.length; i++) assert.ok(barks[i].t - barks[i - 1].t >= 1.2 - 1e-6, 'global spacing');
    const byEnemy = new Map();
    for (const b of barks) { const last = byEnemy.get(b.e); if (last != null && b.kind !== 'throw') assert.ok(b.t - last >= 6 - 1e-6, 'per-enemy spacing'); byEnemy.set(b.e, b.t); }   // a frag's shout is allowed inside the 6 s
    return { barks: barks.length, kinds: [...new Set(barks.map(b => b.kind))].join(','), front: r.mode };
  }, { timeout: 300000 });
  t.test('the mix: a footfall at 10 m and a bark at 15 m sit under your own gunshot', async () => {
    await audioReady();
    newCampaign(); battle({ clear: true });
    const gun = loud(SFX.buf['gun:ar:0']) * 0.6;
    const k10 = 1 - 400 / 1000, step = loud(SFX.buf['step:hard:0']) * 0.12 * k10 * k10;
    const h = hero(), bk = loud(SFX.buf['bark:0']) * 0.2 * distMul(h.x + 600, h.y);
    const out = { stepDb: +db(step / gun).toFixed(1), barkDb: +db(bk / gun).toFixed(1) };
    assert.range(out.stepDb, -36, -24, 'footfall vs gunshot (dB)');
    assert.range(out.barkDb, -26, -14, 'bark vs gunshot (dB)');
    return out;
  }, { timeout: 120000 });
  t.test('muted means silent', async () => {
    await audioReady();
    meta.muted = true;
    assert.eq(playBuf('step:hard:0', { gain: 1 }), false);
    meta.muted = false;
  }, { timeout: 120000 });
});
