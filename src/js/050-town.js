// ============================================================ TOWN — Valmont, fought place by place
// Metres (the sim multiplies by 40): 96 x 72 m inside a perimeter that stands exactly on its edge.
// North is the pass road and the enemy; south is the FOB. Buildings are solid blocks (movement, bullets,
// sight) with real heights; FIXED cover is always there; SLOTS roll fresh cover each battle.
const TOWN = {
  w: 96, h: 72,
  pois: [   // name, x0, y0, x1, y1 — for the docs and the minimap
    ['Rail yard', 0, 0, 40, 19.8], ['Mill yard', 55, 0, 96, 27], ['Church square', 29, 27, 65, 49], ['Market', 0, 30, 30, 48],
    ['Gas station', 65, 30, 96, 48], ['Cemetery', 0, 51, 25, 72], ['Building site', 25, 51, 41, 72], ['FOB', 41, 60, 70, 72], ['Motor pool', 70, 60, 96, 72],
  ],
  buildings: [   // x0, y0, x1, y1, height m, style
    // the rail yard and the mill, north of the tracks
    [5, 2.5, 22, 9, 6.4, 'station'], [33, 2, 41, 8.5, 6.4, 'house1'], [55.5, 2, 60.5, 8, 6.4, 'house0'], [63, 2, 90, 10, 7.5, 'warehouse'],
    // freight wagons on the two tracks (the level crossing on Main Street is left open)
    [4, 12.1, 16, 14.9, 3.4, 'wagon'], [60, 12.1, 72, 14.9, 3.4, 'wagon'], [21, 15.6, 33, 18.4, 3.4, 'wagon'], [76, 15.6, 88, 18.4, 3.4, 'wagon'],
    // shipping containers in the mill yard
    [64, 21, 70, 23.4, 2.6, 'container'], [74, 20.5, 76.4, 26.5, 2.6, 'container'], [84, 20.8, 90, 23.2, 2.6, 'container'], [84, 23.4, 90, 25.8, 2.6, 'container'],
    // houses between the tracks and the cross street
    [2, 20, 12, 26, 6.4, 'house1'], [15, 20, 26, 26, 9.6, 'house0'], [30, 20.5, 40, 26, 6.4, 'house2'], [55.5, 20, 61.5, 26, 6.4, 'house0'],
    // the church square: the church, its bell tower on the cross street, the café
    [31, 32.5, 41, 46, 8.5, 'church'], [33.5, 28.8, 38.5, 33.2, 19, 'belltower'], [57.5, 45, 64, 49, 6.4, 'house2'],
    // the market, framed by houses
    [1.5, 31, 9, 38.5, 6.4, 'house2'], [1.5, 40.5, 9, 47, 9.6, 'house1'], [21, 31, 28, 37, 6.4, 'house0'],
    // the gas station's shop and the house behind the forecourt
    [84, 40, 94.5, 47.5, 3.8, 'shop'], [86, 30.5, 94.5, 36, 6.4, 'house1'],
    // south of the road: the cemetery chapel and a row of houses
    [3, 53, 10, 59, 4.6, 'chapel'], [54.5, 53, 62, 59, 6.4, 'house1'], [66, 52.5, 74, 59.5, 9.6, 'house2'], [78, 53, 90, 59, 6.4, 'house0'],
  ],
  fixed: [   // kind, x, y, turned 90°
    ['barrier', 46, 1.2], ['barrier', 50, 1.2],   // the closed gate on the pass road
    ['platform', 13.5, 10.3], ['logs', 79.5, 22.3], ['logs', 79.5, 25.2], ['bus', 47, 23],
    ['stall', 12, 34.5], ['stall', 17, 34.5], ['stall', 12, 39], ['stall', 17, 39], ['stall', 24, 40], ['stall', 12, 43.5], ['stall', 17, 43.5], ['stall', 24, 44], ['van', 27.5, 46.6, 1],
    ['fountain', 58, 38.5], ['statue', 60.5, 32.8], ['table', 55.5, 43.2], ['table', 58.5, 43.2], ['table', 61.5, 43.2], ['planter', 55, 34.5, 1], ['planter', 63.5, 38.5, 1], ['bench', 64, 34, 1],
    ['pillar', 70.8, 34.6], ['pillar', 81.2, 34.6], ['pillar', 70.8, 39.4], ['pillar', 81.2, 39.4],
    ['pump', 74, 36], ['pump', 74, 38.4], ['pump', 78, 36], ['pump', 78, 38.4], ['tanker', 78, 44.3, 1],
    ...[56, 59, 62, 65].flatMap(y => [13, 15.5, 18, 20.5, 23].map(x => ['grave', x, y])),
    ['hedge', 13, 51.4], ['hedge', 17.2, 51.4], ['hedge', 23.2, 51.4], ['hedge', 25.3, 55.5, 1], ['hedge', 25.3, 59.7, 1], ['hedge', 25.3, 67, 1],
    ['tree', 6.5, 62.5], ['tree', 4.5, 69], ['tree', 11, 69.5], ['tree', 19.5, 69.5], ['tree', 11.5, 53.8], ['bench', 8.5, 66, 1],
    ...[55, 59, 63].flatMap(y => [28, 32, 36].map(x => ['pillar', x, y])),
    ['mixer', 31, 67.5], ['mound', 27.5, 69], ['mound', 38.2, 69.4], ['toilet', 39.2, 53], ['toilet', 39.2, 54.2],
    ['fence', 27, 51.6], ['fence', 30.2, 51.6], ['fence', 36.8, 51.6], ['fence', 39.9, 51.6], ['fence', 40.7, 54.4, 1], ['fence', 40.7, 57.6, 1],
    ['hesco', 42.5, 60.8], ['hesco', 53.5, 60.8], ['hesco', 56.5, 60.8], ['hesco', 59.5, 60.8], ['hesco', 62.5, 60.8], ['hesco', 65.5, 60.8], ['hesco', 68.5, 60.8],
    ['hesco', 41.4, 62.4, 1], ['hesco', 41.4, 68.8, 1], ['hesco', 69.8, 62.4, 1], ['hesco', 69.8, 65.4, 1], ['hesco', 69.8, 68.4, 1],
    ['sandbags', 60, 64.6], ['sandbags', 60, 68.2], ['sandbags', 56.8, 66.4, 1], ['sandbags', 63.2, 66.4, 1],   // open corners: walk in, path in
    ['tent', 51, 70.5, 1], ['tent', 64.5, 70.6, 1], ['truck', 78, 66.5], ['truck', 85.5, 66.5],
  ],
  slots: [   // x, y, cover kinds to pick from, turned 90° — rolled fresh each battle
    [47, 7, 'barrier|sandbags'], [50.5, 13, 'car|van'], [51, 27.5, 'crates|sandbags'], [44.5, 35.5, 'car'], [52, 43, 'car|van'], [45, 49.5, 'barrier|sandbags', 1], [50.5, 55, 'car|van'],
    [5.5, 28.8, 'car', 1], [19.5, 29, 'car|van', 1], [28.5, 28.5, 'crates|barrel'], [43.5, 29.5, 'barrier', 1], [58, 29, 'car', 1], [71, 28.7, 'crates|dumpster'], [84.5, 29, 'car|van', 1],
    [13, 49.8, 'car', 1], [28, 50, 'crates|barrel'], [37, 49.7, 'car|van', 1], [60, 50, 'car', 1], [70.5, 49.8, 'dumpster|crates'], [88, 50, 'car|van', 1],
    [25, 13.3, 'crates|woodpile'], [39.5, 14.5, 'barrel|crates'], [56.5, 16.5, 'crates|woodpile'], [74.5, 13.2, 'barrel|propane'], [92.5, 16, 'crates'],
    [27, 5.5, 'car|van'], [61.8, 5, 'dumpster|crates'], [93, 5.5, 'barrel|crates'],
    [67, 25.8, 'crates|barrel'], [71.5, 22, 'woodpile'], [93, 22.5, 'crates|propane'],
    [10.5, 36.5, 'crates|woodpile'], [15, 47, 'crates|barrel'], [20.5, 41.5, 'crates'], [27.5, 41, 'barrel|propane'],
    [43.5, 41, 'car'], [53, 38.5, 'crates|propane'], [62.5, 30.5, 'crates|propane'],
    [68, 32, 'car', 1], [76, 41.5, 'car', 1], [91.5, 38.5, 'barrel|propane'], [69, 46.5, 'crates|barrel'], [93, 49, 'dumpster'],
    [64, 55.5, 'crates|woodpile'], [76, 56, 'car'], [92.5, 55.5, 'barrel'],
    [11, 61, 'woodpile'], [4.5, 66, 'crates'], [38.5, 66, 'woodpile|crates'], [33.5, 57, 'crates|woodpile'],
    [76, 62.8, 'crates|barrel'], [92, 64, 'van|car'], [80, 70.8, 'crates|barrel'], [56, 63.2, 'crates|sandbags'], [66, 66, 'crates'],
  ],
  ground: [   // x0, y0, x1, y1, surface — later entries are laid over earlier ones
    [0, 0, 96, 10, 'dirt'], [0, 10, 96, 19.8, 'gravel'], [42, 0, 54, 31, 'asphalt'], [62, 19.8, 96, 27, 'gravel'], [0, 27, 96, 31, 'asphalt'],
    [9, 31, 30, 48, 'cobble'], [41, 31, 65, 48, 'paving'], [65, 31, 96, 48, 'asphalt'], [0, 48, 96, 52, 'asphalt'], [42, 52, 54, 61, 'asphalt'],
    [0, 52, 25, 72, 'grass'], [25, 51.2, 41, 72, 'gravel'], [41, 61, 70, 72, 'concrete'], [70, 60, 96, 72, 'gravel'], [54, 52, 96, 60, 'dirt'],
  ],
};
const COVER_KINDS = {   // half-size px, visual height m, hp, chance to stop a round, material, blast radius — everything breaks
  crates:   { shape: 'r', hw: 34, hd: 30, hgt: 1.1, hp: 16, block: 0.8,  mat: 'wood' },
  sandbags: { shape: 'r', hw: 56, hd: 16, hgt: 0.9, hp: 40, block: 0.85, mat: 'dirt' },
  barrel:   { shape: 'c', r: 14, hgt: 1.0, hp: 5, block: 0.6, mat: 'metal', boom: 70 },
  propane:  { shape: 'c', r: 12, hgt: 0.9, hp: 4, block: 0.4, mat: 'metal', boom: 95 },
  car:      { shape: 'r', hw: 36, hd: 76, hgt: 1.4, hp: 45, block: 0.9, mat: 'metal', boom: 85, wreck: 'wreck' },
  van:      { shape: 'r', hw: 40, hd: 92, hgt: 2.0, hp: 70, block: 0.95, mat: 'metal', boom: 100, wreck: 'vanwreck' },
  wreck:    { shape: 'r', hw: 36, hd: 76, hgt: 1.0, hp: 80, block: 0.8, mat: 'metal' },
  vanwreck: { shape: 'r', hw: 40, hd: 92, hgt: 1.4, hp: 110, block: 0.85, mat: 'metal' },
  stall:    { shape: 'r', hw: 50, hd: 26, hgt: 1.0, hp: 12, block: 0.55, mat: 'wood' },
  wall:     { shape: 'r', hw: 70, hd: 12, hgt: 1.0, hp: 60, block: 0.9, mat: 'stone' },
  barrier:  { shape: 'r', hw: 60, hd: 14, hgt: 0.9, hp: 120, block: 0.95, mat: 'concrete' },
  fountain: { shape: 'c', r: 70, hgt: 0.9, hp: 260, block: 0.85, mat: 'stone' },
  fence:    { shape: 'r', hw: 60, hd: 6, hgt: 1.0, hp: 8, block: 0.35, mat: 'wood' },
  dumpster: { shape: 'r', hw: 40, hd: 26, hgt: 1.3, hp: 90, block: 0.95, mat: 'metal' },
  woodpile: { shape: 'r', hw: 44, hd: 22, hgt: 1.0, hp: 24, block: 0.8, mat: 'wood' },
  planter:  { shape: 'r', hw: 40, hd: 20, hgt: 0.7, hp: 50, block: 0.75, mat: 'stone' },
  // the new town's pieces. hp 0 = can't be destroyed (drawn once with the town, not with the movable cover)
  platform: { shape: 'r', hw: 340, hd: 26, hgt: 0.9, hp: 0, block: 1, mat: 'concrete' },
  pillar:   { shape: 'r', hw: 12, hd: 12, hgt: 6.6, hp: 0, block: 1, mat: 'concrete' },
  hesco:    { shape: 'r', hw: 60, hd: 24, hgt: 1.6, hp: 0, block: 1, mat: 'dirt' },
  tree:     { shape: 'c', r: 14, hgt: 7, hp: 0, block: 0.9, mat: 'wood' },
  statue:   { shape: 'r', hw: 32, hd: 32, hgt: 2.6, hp: 0, block: 1, mat: 'stone' },
  tent:     { shape: 'r', hw: 48, hd: 110, hgt: 2.2, hp: 0, block: 0.25, mat: 'wood' },
  truck:    { shape: 'r', hw: 52, hd: 144, hgt: 3.0, hp: 0, block: 1, mat: 'metal' },
  bus:      { shape: 'r', hw: 50, hd: 216, hgt: 3.0, hp: 0, block: 1, mat: 'metal' },
  mound:    { shape: 'c', r: 50, hgt: 1.3, hp: 0, block: 1, mat: 'dirt' },
  grave:    { shape: 'r', hw: 16, hd: 8, hgt: 0.9, hp: 0, block: 0.95, mat: 'stone' },
  hedge:    { shape: 'r', hw: 80, hd: 16, hgt: 1.3, hp: 0, block: 0.35, mat: 'leaf' },
  pump:     { shape: 'r', hw: 16, hd: 24, hgt: 1.7, hp: 24, block: 0.85, mat: 'metal', boom: 80 },
  tanker:   { shape: 'r', hw: 46, hd: 150, hgt: 3.0, hp: 150, block: 1, mat: 'metal', boom: 180, wreck: 'tankwreck' },
  tankwreck:{ shape: 'r', hw: 46, hd: 150, hgt: 2.2, hp: 0, block: 0.9, mat: 'metal' },
  logs:     { shape: 'r', hw: 70, hd: 32, hgt: 1.2, hp: 90, block: 0.95, mat: 'wood' },
  mixer:    { shape: 'c', r: 26, hgt: 1.6, hp: 70, block: 0.9, mat: 'metal' },
  toilet:   { shape: 'r', hw: 22, hd: 22, hgt: 2.3, hp: 30, block: 0.6, mat: 'wood' },
  bench:    { shape: 'r', hw: 34, hd: 10, hgt: 0.5, hp: 14, block: 0.3, mat: 'wood' },
  table:    { shape: 'c', r: 16, hgt: 0.75, hp: 10, block: 0.3, mat: 'wood' },
};
const STATIC_COVER = new Set(['platform', 'pillar', 'hesco', 'tree', 'statue', 'tent', 'truck', 'bus', 'mound', 'grave', 'hedge']);   // drawn once with the town
const MAT_COL = { wood: '#b8894e', dirt: '#b4a67a', metal: '#6a6a66', stone: '#a8a498', concrete: '#b8b6b0', leaf: '#4e6a34' };
let buildings = [], rubble = [], propsDirty = true, coverSeq = 1;
const CP = { px: 0, py: 0, nx: 0, ny: 0, d: 0 };
const SPOT = { x: 0, y: 0 };
function makeCover(kind, x, y, rot90) {
  const K = COVER_KINDS[kind];
  const o = { kind, x, y, shape: K.shape, hgt: K.hgt, hp: K.hp, maxHp: K.hp, block: K.block, rot90: !!rot90, id: coverSeq++, claims: 0 };
  if (K.shape === 'c') o.r = K.r;
  else { o.hw = rot90 ? K.hd : K.hw; o.hd = rot90 ? K.hw : K.hd; }
  return o;
}
function coverPoint(ob, x, y, out) {   // nearest point on the outline, outward normal, distance from the surface (negative inside)
  if (ob.shape === 'c') {
    const dx = x - ob.x, dy = y - ob.y, d = Math.hypot(dx, dy) || 1;
    out.nx = dx / d; out.ny = dy / d; out.px = ob.x + out.nx * ob.r; out.py = ob.y + out.ny * ob.r; out.d = d - ob.r;
    return out;
  }
  const dx = x - ob.x, dy = y - ob.y, qx = Math.abs(dx) - ob.hw, qy = Math.abs(dy) - ob.hd;
  if (qx > 0 || qy > 0) {
    const cx = clamp(dx, -ob.hw, ob.hw), cy = clamp(dy, -ob.hd, ob.hd), ex = dx - cx, ey = dy - cy, d = Math.hypot(ex, ey) || 1;
    out.px = ob.x + cx; out.py = ob.y + cy; out.nx = ex / d; out.ny = ey / d; out.d = Math.hypot(ex, ey);
  } else if (qx > qy) { out.nx = Math.sign(dx) || 1; out.ny = 0; out.px = ob.x + out.nx * ob.hw; out.py = y; out.d = qx; }
  else { out.nx = 0; out.ny = Math.sign(dy) || 1; out.px = x; out.py = ob.y + out.ny * ob.hd; out.d = qy; }
  return out;
}
const insideShape = (ob, x, y) => ob.shape === 'c' ? dist2(x, y, ob.x, ob.y) < ob.r * ob.r : Math.abs(x - ob.x) < ob.hw && Math.abs(y - ob.y) < ob.hd;
function segEnter(ob, ax, ay, bx, by, pad = 0) {   // where segment a→b first enters the shape grown by pad (0..1), or 2 if it never does
  const dx = bx - ax, dy = by - ay;
  if (ob.shape === 'c') {
    const R = ob.r + pad, fx = ax - ob.x, fy = ay - ob.y, A = dx * dx + dy * dy || 1e-9, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - R * R;
    if (C < 0) return 0;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return 2;
    const t = (-B - Math.sqrt(disc)) / (2 * A);
    return t >= 0 && t <= 1 ? t : 2;
  }
  const hw = ob.hw + pad, hd = ob.hd + pad;
  let t0 = 0, t1 = 1;
  if (Math.abs(dx) < 1e-9) { if (ax < ob.x - hw || ax > ob.x + hw) return 2; }
  else { let u0 = (ob.x - hw - ax) / dx, u1 = (ob.x + hw - ax) / dx; if (u0 > u1) { const s = u0; u0 = u1; u1 = s; } if (u0 > t0) t0 = u0; if (u1 < t1) t1 = u1; if (t0 > t1) return 2; }
  if (Math.abs(dy) < 1e-9) { if (ay < ob.y - hd || ay > ob.y + hd) return 2; }
  else { let u0 = (ob.y - hd - ay) / dy, u1 = (ob.y + hd - ay) / dy; if (u0 > u1) { const s = u0; u0 = u1; u1 = s; } if (u0 > t0) t0 = u0; if (u1 < t1) t1 = u1; if (t0 > t1) return 2; }
  return t0;
}
function losClear(ax, ay, bx, by) {   // only buildings block sight; low cover can be seen and shot over
  for (const b of buildings) if (segEnter(b, ax, ay, bx, by) <= 1) return false;
  return true;
}
function clearRun(ax, ay, bx, by, pad) {   // a straight walk that touches neither buildings nor cover
  for (const b of buildings) if (segEnter(b, ax, ay, bx, by, pad) <= 1) return false;
  for (const o of obstacles) if (segEnter(o, ax, ay, bx, by, pad - 2) <= 1) return false;
  return true;
}
function coverNear(o, reach) {   // nearest cover or building wall within reach of the unit's edge
  let best = null, bd = reach;
  for (const b of buildings) { coverPoint(b, o.x, o.y, CP); if (CP.d - o.r < bd) { bd = CP.d - o.r; best = b; } }
  for (const ob of obstacles) { coverPoint(ob, o.x, o.y, CP); if (CP.d - o.r < bd) { bd = CP.d - o.r; best = ob; } }
  return best;
}
function spotBlocked(x, y, r) {
  for (const b of buildings) if (coverPoint(b, x, y, CP).d < r) return true;
  for (const o of obstacles) if (coverPoint(o, x, y, CP).d < r - 2) return true;
  return false;
}
function openSpot(x0, x1, y0, y1) {   // a random point in the open
  for (let k = 0; k < 40; k++) { const x = rand(x0, x1), y = rand(y0, y1); if (!spotBlocked(x, y, 32)) return { x, y }; }
  return { x: CFG.arenaW / 2, y: y1 };
}

// ---------- navigation: a 1 m grid, A* with string pulling ----------
const NAV = { cell: 40, x0: -40, y0: -40, cols: 0, rows: 0, block: null, dirty: true };
const PATH = { g: null, f: null, came: null, stamp: null, heap: null, id: 0 };
function navCell(c, r) {
  const x = NAV.x0 + (c + 0.5) * NAV.cell, y = NAV.y0 + (r + 0.5) * NAV.cell;
  if (x < 20 || x > CFG.arenaW - 20 || y < 20 || y > CFG.arenaH - 20) return 1;
  for (let i = 0; i < buildings.length; i++) { const b = buildings[i]; if (Math.abs(x - b.x) < b.hw + 14 && Math.abs(y - b.y) < b.hd + 14) return 1; }
  for (let i = 0; i < obstacles.length; i++) if (coverPoint(obstacles[i], x, y, CP).d < 12) return 1;
  return 0;
}
function buildNav() {
  NAV.cols = Math.ceil((CFG.arenaW + 80) / NAV.cell); NAV.rows = Math.ceil((CFG.arenaH + 80) / NAV.cell);
  NAV.block = new Uint8Array(NAV.cols * NAV.rows);
  for (let r = 0; r < NAV.rows; r++) for (let c = 0; c < NAV.cols; c++) NAV.block[r * NAV.cols + c] = navCell(c, r);
  NAV.dirty = false;
}
function navPatch(ob) {   // re-check only the cells around a piece of cover that just changed
  if (NAV.dirty || !NAV.block) return;
  const ext = (ob.shape === 'c' ? ob.r : Math.max(ob.hw, ob.hd)) + 60;
  const c0 = Math.max(0, Math.floor((ob.x - ext - NAV.x0) / NAV.cell)), c1 = Math.min(NAV.cols - 1, Math.floor((ob.x + ext - NAV.x0) / NAV.cell));
  const r0 = Math.max(0, Math.floor((ob.y - ext - NAV.y0) / NAV.cell)), r1 = Math.min(NAV.rows - 1, Math.floor((ob.y + ext - NAV.y0) / NAV.cell));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) NAV.block[r * NAV.cols + c] = navCell(c, r);
}
function nearestOpen(i) {
  const C = NAV.cols, R = NAV.rows, cx = i % C, cy = (i / C) | 0;
  for (let rad = 1; rad < 8; rad++)
    for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && y >= 0 && x < C && y < R && !NAV.block[y * C + x]) return y * C + x;
    }
  return i;
}
function navPath(sx, sy, tx, ty, pad) {   // waypoints from (sx, sy) to (tx, ty); the last one is the target itself
  if (NAV.dirty || !NAV.block) buildNav();
  if (clearRun(sx, sy, tx, ty, pad)) return [{ x: tx, y: ty }];
  const C = NAV.cols, R = NAV.rows, N = C * R;
  if (!PATH.g || PATH.g.length !== N) {
    PATH.g = new Float32Array(N); PATH.f = new Float32Array(N); PATH.came = new Int32Array(N);
    PATH.stamp = new Uint32Array(N); PATH.heap = new Int32Array(N * 8);
  }
  const cellOf = (x, y) => clamp(Math.floor((y - NAV.y0) / NAV.cell), 0, R - 1) * C + clamp(Math.floor((x - NAV.x0) / NAV.cell), 0, C - 1);
  const s = cellOf(sx, sy);
  let t = cellOf(tx, ty);
  if (NAV.block[t]) t = nearestOpen(t);
  const id = ++PATH.id, g = PATH.g, f = PATH.f, came = PATH.came, st = PATH.stamp, heap = PATH.heap, blk = NAV.block;
  const tcx = t % C, tcy = (t / C) | 0;
  const h = i => { const dx = Math.abs(i % C - tcx), dy = Math.abs(((i / C) | 0) - tcy); return dx + dy - 0.586 * Math.min(dx, dy); };
  let hn = 0;
  const push = i => {
    let k = hn++; heap[k] = i;
    while (k > 0) { const p = (k - 1) >> 1; if (f[heap[p]] <= f[i]) break; heap[k] = heap[p]; heap[p] = i; k = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap[--hn];
    let k = 0; heap[0] = last;
    for (;;) {
      const l = 2 * k + 1, r = l + 1; let m = k;
      if (l < hn && f[heap[l]] < f[heap[m]]) m = l;
      if (r < hn && f[heap[r]] < f[heap[m]]) m = r;
      if (m === k) break;
      heap[k] = heap[m]; heap[m] = last; k = m;
    }
    return top;
  };
  st[s] = id; g[s] = 0; f[s] = h(s); came[s] = -1; push(s);
  let found = false, iters = 0;
  while (hn && iters++ < 9000) {
    const cur = pop();
    if (cur === t) { found = true; break; }
    const cx = cur % C, cy = (cur / C) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= C || ny >= R) continue;
      const ni = ny * C + nx;
      if (blk[ni] && ni !== t) continue;
      if (dx && dy && (blk[cy * C + nx] || blk[ny * C + cx])) continue;
      const ng = g[cur] + (dx && dy ? 1.414 : 1);
      if (st[ni] === id && ng >= g[ni]) continue;
      st[ni] = id; g[ni] = ng; f[ni] = ng + h(ni); came[ni] = cur;
      if (hn < heap.length) push(ni);
    }
  }
  if (!found) return [{ x: tx, y: ty }];
  const pts = [];
  for (let i = t; i !== -1 && i !== s; i = came[i]) pts.push({ x: NAV.x0 + (i % C + 0.5) * NAV.cell, y: NAV.y0 + (((i / C) | 0) + 0.5) * NAV.cell });
  pts.reverse();
  pts.push({ x: tx, y: ty });
  const out = [];
  let ax = sx, ay = sy;
  for (let i = 0; i < pts.length; i++) {
    const nxt = pts[i + 1];
    if (nxt && clearRun(ax, ay, nxt.x, nxt.y, pad)) continue;
    out.push(pts[i]); ax = pts[i].x; ay = pts[i].y;
  }
  return out;
}
function goTo(u, x, y) { u.path = navPath(u.x, u.y, x, y, u.r * 0.8 + 2); u.gx = x; u.gy = y; }
function followPath(u, spd, dt) {   // true once the last waypoint is reached
  if (!u.path || !u.path.length) return true;
  const p = u.path[0], dx = p.x - u.x, dy = p.y - u.y, d = Math.hypot(dx, dy), step = spd * dt;
  if (d <= Math.max(step, 4)) { u.x = p.x; u.y = p.y; u.path.shift(); return !u.path.length; }
  u.x += dx / d * step; u.y += dy / d * step;
  return false;
}

// ---------- cover lifecycle ----------
function damageCover(ob, dmg) {
  if (!ob.hp || ob.hp <= 0) return;
  const was = ob.hp / ob.maxHp;
  ob.hp -= dmg;
  if (ob.hp <= 0) destroyCover(ob);
  else if (was > 0.5 && ob.hp / ob.maxHp <= 0.5) propsDirty = true;   // shows its damaged state
}
function destroyCover(ob) {
  const i = obstacles.indexOf(ob);
  if (i < 0) return;
  obstacles.splice(i, 1);
  const K = COVER_KINDS[ob.kind], col = MAT_COL[K.mat] || '#999999';
  rubble.push({ x: ob.x, y: ob.y, hw: ob.shape === 'c' ? ob.r : ob.hw, hd: ob.shape === 'c' ? ob.r : ob.hd, mat: K.mat, seed: ob.id });
  if (rubble.length > 60) rubble.shift();
  for (let k = 0; k < 16; k++) {
    const a = rand(0, TAU), v = rand(40, 170);
    particles.push({ x: ob.x + rand(-10, 10), y: ob.y + rand(-10, 10), z: rand(6, 20), vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(60, 160),
      life: rand(0.5, 0.9), max: 0.9, col: Math.random() < 0.3 ? '#5a5048' : col, r: rand(1.5, 3.2) });
  }
  if (K.wreck) obstacles.push(makeCover(K.wreck, ob.x, ob.y, ob.rot90));
  navPatch(ob); propsDirty = true;
  for (const u of soldiers) if (u.coverRef === ob) { u.coverRef = null; u.tacT = 0; }
  for (const u of enemies) if (u.coverRef === ob) { u.coverRef = null; u.tacT = 0; }
  if (K.boom) explode(ob.x, ob.y, K.boom, 3, 2, { player: false, wkey: null });
  else sfxBreak(ob.x, ob.y, K.mat);
}
function tallyClaims() {   // each side counts only its own people on a piece of cover — they use opposite faces
  for (const o of obstacles) { o.claims = 0; o.claimsE = 0; }
  for (const u of soldiers) if (u.alive && u.coverRef) u.coverRef.claims++;
  for (const u of enemies) if (u.coverRef) u.coverRef.claimsE = (u.coverRef.claimsE || 0) + 1;
}

