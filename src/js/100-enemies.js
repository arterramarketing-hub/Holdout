// ============================================================ ENEMIES / WAVES
const ETYPES = {
  grunt:   { r: 14, hp: 3, sp: 80,  dmg: 0.5, col: '#c25b4a', ranged: 330 },   // rifleman: bounds cover to cover; 3 M4 rounds
  runner:  { r: 11, hp: 2, sp: 135, dmg: 1, col: '#d18a3f' },
  brute:   { r: 22, hp: 9, sp: 48,  dmg: 2, col: '#8e3b52' },
  rider:   { r: 16, hp: 4, sp: 185, dmg: 2, col: '#a04938', horse: true },
  gunner:  { r: 13, hp: 3, sp: 60,  dmg: 1, col: '#c2a23a', ranged: 380 },   // stops and shoots back
  spotter: { r: 12, hp: 3, sp: 85,  dmg: 0, col: '#d8d2b8', spotter: true }, // no longer spawned
};
// Dedicated spawn zones, in the open ground of the town's streets and alleys. There is no front: whenever
// someone comes onto the field — an enemy walking on, or one of yours coming back as a reinforcement — the
// zone is chosen for that moment. Enemies take one far from your squad and out of its sight; your own
// come back somewhere far from the enemy, near a teammate if possible. The FOB is yours alone.
const SPAWN_ZONES = [   // [name, x0, x1, y0, y1] in metres; scaled to px below
  ['north gate', 42, 54, 2.5, 4.5], ['station yard', 23, 32, 2, 9], ['mill east', 91, 95, 2, 10], ['crossing', 42, 54, 11, 18.5],
  ['rail west', 1, 3.5, 11, 18.5], ['rail east', 89, 95, 11, 19], ['cross west', 1, 14, 27.5, 30.5], ['cross east', 63, 95, 27.5, 30.5],
  ['market', 10, 20, 46, 48.5], ['forecourt', 66, 70, 41, 48], ['south road west', 1, 22, 48.5, 51.5], ['south road east', 75, 95, 48.5, 51.5],
  ['motor pool', 72, 95, 61, 71], ['cemetery', 3, 23, 69, 71.5], ['fob', 43, 68, 62, 69],
].map(([name, x0, x1, y0, y1]) => ({ name, x0: x0 * 40, x1: x1 * 40, y0: y0 * 40, y1: y1 * 40, cx: (x0 + x1) * 20, cy: (y0 + y1) * 20, used: -99 }));
function pickSpawn(side) {   // 'e' for the enemy, 'p' for your squad
  const foes = side === 'e' ? soldiers.filter(s => s.alive) : enemies;
  const mates = side === 'e' ? enemies : soldiers.filter(s => s.alive);
  let best = null, bestScore = -1e9;
  for (const z of SPAWN_ZONES) {
    if (side === 'e' && z.name === 'fob') continue;
    let near = 1e9, seen = false;
    for (const f of foes) {
      const d = Math.hypot(f.x - z.cx, f.y - z.cy);
      if (d < near) near = d;
      if (!seen && d < 1500 && losClear(f.x, f.y, z.cx, z.cy)) seen = true;
    }
    let score = Math.min(near, 1800) - (seen ? 900 : 0) + rand(0, 240);
    if (near < 650) score -= 2000;                                        // never on top of the other side
    if (state.frontTime - z.used < 6) score -= 700;                       // spread arrivals across zones
    if (side === 'e') for (const o of state.objs || []) {   // they reinforce near objectives they hold, never into one being taken
      const od = Math.hypot(o.x - z.cx, o.y - z.cy);
      if (o.owner === 'e' && od < 1000) score += 300;
      if (o.inP > 0 && od < 520) score -= 2000;
    }
    if (side === 'p') {
      if (z.name === 'fob') score += 150;
      if (mates.some(m => Math.hypot(m.x - z.cx, m.y - z.cy) < 900)) score += 300;
    }
    if (score > bestScore) { bestScore = score; best = z; }
  }
  best.used = state.frontTime;
  const p = openSpot(best.x0, best.x1, best.y0, best.y1);
  return { x: p.x, y: p.y };
}
function spawnPoint() { return pickSpawn('e'); }
function spawnEnemy(type) {
  const t = ETYPES[type], dmgMul = 1 + 0.12 * (state.tier - 1);   // harder sectors hit harder; health stays put so an M4 still drops a rifleman in three
  enemies.push({ type, r: t.r, col: t.col, dmg: t.dmg * dmgMul, horse: !!t.horse,
    ranged: t.ranged || 0, spotter: !!t.spotter, spotCd: rand(3, 5), fireT: rand(0.5, 1.5), objRole: !!t.ranged && Math.random() < 0.45,
    hp: t.hp, maxHp: t.hp,
    sp: t.sp * (1 + 0.04 * (state.tier - 1)) * rand(0.92, 1.08),
    ...spawnPoint(),
    cd: rand(0, 0.5), flash: 0, wob: rand(0, TAU), walk: rand(0, TAU), atk: 0, face: 1,
    tac: 'hold', tacT: rand(0.2, 1.2), burst: 0, supp: 0, flankSide: Math.random() < 0.5 ? -1 : 1, path: null, pathT: 0, coverRef: null });
  if (t.spotter && !state.spotterSeen) {
    state.spotterSeen = true;
    showBanner('ENEMY SPOTTER — PRIORITY TARGET');
  }
}
function spawnBoss() {
  const mult = 1 + 0.35 * (state.tier - 1);
  const name = 'WARLORD ' + makeName([]).toUpperCase();
  const e = { type: 'boss', boss: true, name, r: 34, col: '#6e2438', dmg: 3, horse: false,
    ranged: 0, spotter: false, spotCd: 0, fireT: 0, phase: 1, summonT: 5, radT: 4,
    hp: Math.round(60 * mult), maxHp: Math.round(60 * mult), sp: 40,
    ...pickSpawn('e'),
    cd: 0, flash: 0, wob: 0, walk: 0, atk: 0, face: 1 };
  enemies.push(e);
  state.bossRef = e;
  e.epithet = pickL(WARLORD_EPITHETS);
  state.slow = CFG.bossIntro;   // the world crawls while the title card plays
  noise({ freq: 70, dur: 1.4, gain: 0.2, type: 'lowpass', q: 0.5, attack: 0.1 });
  musStinger('boss');
}
function pickType() {
  const r = Math.random();
  if ((state.tier >= 2 || state.wave >= 2) && r < 0.22) return 'gunner';
  if ((state.tier >= 2 || state.wave >= 5) && r < 0.32) return 'rider';
  if (state.wave >= 3 && r > 0.90) return 'brute';
  if (state.wave >= 2 && r < 0.55) return 'runner';
  return 'grunt';
}
function updateWaves(dt) {   // four a side: whenever the enemy is short-handed and has tickets left, someone walks on
  if (state.training) return;   // the firing range has no enemy
  state.wave = 1 + Math.floor(state.progress / 12);   // the enemy's mix toughens as its tickets run down
  const onField = enemies.reduce((n, e) => n + (e.boss ? 0 : 1), 0);
  const unspent = state.enemyTotal - state.enemyDown - onField - (state.bossRef ? 1 : 0);   // the Warlord's ticket is its own, not a spare
  if (enemies.length < CFG.enemyCap && unspent > 0) {
    state.spawnT -= dt;
    if (state.spawnT <= 0) { spawnEnemy(pickType()); state.spawnT = rand(1.2, 2.2); }
  } else state.spawnT = Math.max(state.spawnT, 1.2);
}

