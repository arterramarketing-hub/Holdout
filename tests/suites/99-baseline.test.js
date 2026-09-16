// Numbers later phases are held to (written to tests/baseline.json by `python3 tools/test.py --baseline`).
// Only dpm.open is asserted against anywhere (32-enemy-fire, to within 15%), and it has held since v6. The cover
// rows in the recorded file are older than 3D enemy fire — rounds come over sandbags now, so a soldier standing
// behind them takes about as much as one in the open (21 against 25), not the quarter the file still remembers.
suite('baseline', t => {
  function standoff(coverKind, seedN) {   // you stand still on Main Street; three riflemen 7.5 m north shoot at you for a minute
    newCampaign(); seed(seedN);
    const h = battle({ clear: true, invuln: false });
    benchSquad();
    state.noEnemyFrags = true;   // rounds alone, like the check in 32-enemy-fire: a thrown frag is not a measure of cover
    h.x = 48 * PX; h.y = 40 * PX; clearArea(h.x, h.y - 150, 520);
    if (coverKind === 'car') addCover('car', 48, 38.9, 1);   // broadside, its back 0.2 m in front of you
    if (coverKind === 'sandbags') addCover('sandbags', 48, 39.4);
    h.hp = 1000; h.maxHp = 1000;
    for (const dx of [-1.5, 0, 1.5]) { const e = G.spawn('grunt', h.x + dx * PX, h.y - 7.5 * PX); e.sp = 0; e.hp = 1e6; }
    aimAt(h, h.x, h.y - 300, 60);
    ticks(60 * 60, 0, () => { aim.fire = false; h.fireCd = 999; });
    return 1000 - h.hp;
  }
  t.test('damage per minute: standing in the open, behind a car, behind sandbags', () => {
    const out = {};
    for (const c of ['open', 'car', 'sandbags']) {
      const runs = Array.from({ length: 24 }, (_, i) => standoff(c, i + 1));   // 24 seeds: 3 swung the average by 20%, and 12 still left ~18% between two runs of the dice
      out[c] = +(runs.reduce((a, b) => a + b, 0) / runs.length).toFixed(2);
    }
    HT.baseline.dpm = out;
    return out;
  }, { timeout: 180000 });
  t.test('front clear time with the bot', () => {
    const secs = [];
    for (const n of [1, 2, 3]) { newCampaign(); seed(n); battle(); const r = botFront(600, { renderEvery: 600 }); secs.push(r.mode === 'cleared' ? r.seconds : -1); }
    HT.baseline.frontSeconds = secs;
    return secs;
  }, { timeout: 600000 });
}, { pass: 'baseline' });
