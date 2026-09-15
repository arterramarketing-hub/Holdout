// Several whole fronts back to back with everything switched on: grenades, sprinting, a controller plugged and pulled,
// quality presets flipping, settings opened mid-fight, the firing range in between. Watches for errors, runaway arrays
// and positions that stop being numbers.
suite('soak', t => {
  t.test('three fronts, the range, and every system at once', async () => {
    newCampaign(); seed(12);
    document.getElementById('boot') && document.getElementById('boot').remove();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ' }));   // audio on
    await waitFor(() => SFX.buf['radio'], 90000, 'sounds');
    const peak = {}, track = (k, v) => { peak[k] = Math.max(peak[k] || 0, v); };
    const bad = [];
    const pad = { connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), vibrationActuator: { playEffect: () => Promise.reject(new Error('NotAllowedError')) } };
    let plugged = false;
    const setPlug = on => { plugged = on; Object.defineProperty(navigator, 'getGamepads', { value: () => (on ? [pad] : []), configurable: true }); };
    const fronts = [];
    for (let f = 0; f < 3; f++) {
      if (f === 1) {   // the firing range between fronts, abandoned half way
        hideModal(); showScreen('map'); enterTraining();
        ticks(60 * 5, 30, () => { keys.KeyW = true; aim.yaw = 0; cam.yaw = 0; });
        keys.KeyW = false;
        $('tomap').click();
        if (state.training) bad.push('training not left');
      }
      hideModal(); showScreen('map');
      const tid = selectedTid;
      if (!terrAttackable(TERRITORIES[tid])) { bad.push('no attackable sector selected'); break; }
      deploySelected();
      let sec = 0;
      const r = botFront(700, { renderEvery: 45, onSecond: s => {
        sec = s;
        const h = hero();
        if (h && h.alive) {
          const e = nearestEnemy(h.x, h.y, 900);
          if (e && Math.random() < 0.08 && h.frags > 0) { aim.yaw = Math.atan2(e.x - h.x, -(e.y - h.y)); aim.pitch = course.fragPitch(h, Math.hypot(e.x - h.x, e.y - h.y)); throwGrenade(h); }
          keys.ShiftLeft = Math.random() < 0.3;
        }
        if (Math.random() < 0.05) setPlug(!plugged);
        if (plugged && Math.random() < 0.3) { pad.buttons[GPB.RT] = { pressed: true, value: 1 }; } else pad.buttons[GPB.RT] = { pressed: false, value: 0 };
        if (Math.random() < 0.03) { meta.opts.quality = ['auto', 'low', 'medium', 'high'][randi(0, 3)]; applyOpts(); }
        if (Math.random() < 0.02) { showSettings(); hideModal(); }
        for (const list of [soldiers, enemies, grenades]) for (const u of list) if (!Number.isFinite(u.x) || !Number.isFinite(u.y)) bad.push(`NaN position at ${s}s (${u.type || 'soldier'})`);
        for (const b of bullets) if (!Number.isFinite(b.x) || !Number.isFinite(b.z == null ? 0 : b.z)) { bad.push(`NaN round at ${s}s`); break; }
        track('particles', particles.length); track('bullets', bullets.length); track('grenades', grenades.length); track('corpses', corpses.length);
        track('brass', BRASS.length); track('drops', DROPS.length); track('barks', VOICE.barks.length); track('craters', craters.length); track('feed', FEED.length);
        if (!Number.isFinite(state.enemyDown) || state.enemyDown < 0 || state.enemyDown > state.enemyTotal) bad.push(`enemyDown ${state.enemyDown}/${state.enemyTotal} at ${s}s`);
        if (state.tickets < 0) bad.push('negative tickets');
      } });
      keys.ShiftLeft = false; setPlug(false);
      fronts.push({ tid, mode: r.mode, seconds: r.seconds, kills: r.kills, calls: r.maxCalls });
      if (r.mode === 'cleared') { const b = $('mbtn'); if (b) b.click(); }
      else { bad.push(`front ${tid} ended ${r.mode} after ${r.seconds}s`); const b = $('mretreat'); if (b) b.click(); }
      frames(2);
    }
    assert.eq(bad.length, 0, bad.slice(0, 6).join(' | '));
    assert.ok(peak.particles < 3000 && peak.bullets < 400 && peak.brass <= QUALITY.high.brass && peak.barks <= 60 && peak.craters <= 44, 'arrays stay bounded: ' + JSON.stringify(peak));
    return { fronts, peak };
  }, { timeout: 1400000 });
}, { pass: 'soak' });
