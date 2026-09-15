suite('navigation', t => {
  t.test('every open cell can be reached from the FOB', () => {
    newCampaign(); battle({ clear: true });
    buildNav();
    const NC = NAV.cols, NR = NAV.rows, NN = NC * NR, fob = SPAWN_ZONES.find(z => z.name === 'fob');
    const st = Math.floor((fob.cy - NAV.y0) / NAV.cell) * NC + Math.floor((fob.cx - NAV.x0) / NAV.cell), s0 = NAV.block[st] ? nearestOpen(st) : st;
    const seen = new Uint8Array(NN), stack = [s0]; seen[s0] = 1;
    while (stack.length) { const i = stack.pop(), x = i % NC, y = (i / NC) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= NC || ny >= NR) continue; const j = ny * NC + nx; if (!seen[j] && !NAV.block[j]) { seen[j] = 1; stack.push(j); } } }
    let open = 0, isolated = 0; for (let i = 0; i < NN; i++) if (!NAV.block[i]) { open++; if (!seen[i]) isolated++; }
    assert.eq(isolated, 0, 'unreachable open cells');
    return { open };
  });
  t.test('you can walk right up to all four edges of the town', () => {
    newCampaign(); seed(7);
    const h = battle({ clear: true });
    benchSquad();
    const out = {};
    for (const [name, xm, ym, yaw, edge] of [['north', 48, 4, 0, s => s.y], ['south', 13, 70, Math.PI, s => CFG.arenaH - s.y],
      ['west', 3, 15, -Math.PI / 2, s => s.x], ['east', 93, 15, Math.PI / 2, s => CFG.arenaW - s.x]]) {
      h.x = xm * PX; h.y = ym * PX; clearArea(h.x, h.y, 6 * PX);
      aim.yaw = yaw; cam.yaw = yaw; keys.KeyW = true;
      ticks(180);
      keys.KeyW = false;
      out[name] = +(edge(h) / PX).toFixed(2);
      assert.ok(edge(h) <= 14, `${name} edge: stopped ${out[name]} m short`);
    }
    return out;
  });
});
