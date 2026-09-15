// ---------- START MENU: the theater map beside the briefing ----------
// A field operations table. The thirteen sectors are regions split by distance with hand-wandered borders; contour
// lines climb to the northern ranges, a river runs past Velen Crossing into Dunmoor Marsh, and wherever your ground
// meets theirs an orange front line burns. The briefing column says what the selected sector is, what holds it, what
// the sky will be when you get there, and deploys. Map units are TERRITORIES' own (x 0..100, y 0..60; 1 unit = 2.5 km).
let selectedTid = -1;
const MAPV = { built: false, owned: null, cells: null, regions: [], nodes: [], layers: {}, enterT: 0 };
const SVGNS = 'http://www.w3.org/2000/svg';
const SQUAD_ROLE_NAMES = ['Lead', 'Point', 'Flank', 'Overwatch'];
function svgEl(tag, attrs, parent) {
  const n = document.createElementNS(SVGNS, tag);
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

// ---- the land: value noise, a river, peaks, contour lines ----
function mapNoise(x, y, seed) {   // smooth value noise in [0, 1): the same hills every visit, whatever Math.random is doing
  const h = (i, j) => { let n = Math.imul(i + seed * 101, 374761393) ^ Math.imul(j - seed * 37, 668265263); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function mapFbm(x, y, seed) { let s = 0, amp = 0.5, f = 1; for (let o = 0; o < 4; o++) { s += amp * mapNoise(x * f, y * f, seed + o); amp *= 0.5; f *= 2.03; } return s; }
const MAP_RIVER = [[35, -14], [38, -3], [41.5, 8], [44.6, 19], [46.6, 27], [47.3, 33], [48.6, 40.5], [51.5, 47.5], [55, 53.5], [60.5, 60], [68, 71]];
const MAP_PEAKS = [[13, 22, 8, 0.32], [23, 7, 9, 0.42], [36, 3, 8, 0.3], [57, 4, 10, 0.46], [79, 3, 10, 0.34], [92, 18, 12, 0.26], [53, 54, 10, -0.28], [9, 50, 13, -0.08]];
function distToPolyline(x, y, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay;
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t));
  }
  return best;
}
function mapHeight(x, y) {   // the ranges rise to the north, the marsh sinks in the south-east, and the river cut its valley
  let h = mapFbm(x * 0.07, y * 0.07, 3) * 0.75 + Math.pow(clamp((52 - y) / 62, 0, 1), 1.35) * 0.95;
  for (const [px, py, r, a] of MAP_PEAKS) h += a * Math.exp(-((x - px) ** 2 + (y - py) ** 2) / (r * r));
  const d = distToPolyline(x, y, MAP_RIVER);
  return h - 0.3 * Math.exp(-(d * d) / 26);
}
function contourLines(x0, y0, x1, y1, step, levels) {   // marching squares, chained into polylines and smoothed once
  const cols = Math.round((x1 - x0) / step), rows = Math.round((y1 - y0) / step), H = new Float32Array((cols + 1) * (rows + 1));
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) H[j * (cols + 1) + i] = mapHeight(x0 + i * step, y0 + j * step);
  return levels.map(lv => {
    const segs = [];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = H[j * (cols + 1) + i], b = H[j * (cols + 1) + i + 1], c = H[(j + 1) * (cols + 1) + i + 1], d = H[(j + 1) * (cols + 1) + i];
      const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (d > lv ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const X = x0 + i * step, Y = y0 + j * step;
      const T = [X + step * (lv - a) / (b - a), Y], R = [X + step, Y + step * (lv - b) / (c - b)];
      const B = [X + step * (lv - d) / (c - d), Y + step], L = [X, Y + step * (lv - a) / (d - a)];
      const centre = (a + b + c + d) / 4 > lv;
      switch (idx) {
        case 1: case 14: segs.push([L, B]); break;
        case 2: case 13: segs.push([B, R]); break;
        case 3: case 12: segs.push([L, R]); break;
        case 4: case 11: segs.push([T, R]); break;
        case 6: case 9: segs.push([T, B]); break;
        case 7: case 8: segs.push([L, T]); break;
        case 5: if (centre) { segs.push([L, T]); segs.push([B, R]); } else { segs.push([T, R]); segs.push([L, B]); } break;
        case 10: if (centre) { segs.push([T, R]); segs.push([L, B]); } else { segs.push([L, T]); segs.push([B, R]); } break;
      }
    }
    return chainSegments(segs).map(smoothLine);
  });
}
function chainSegments(segs) {
  const key = p => Math.round(p[0] * 1000) + ',' + Math.round(p[1] * 1000);
  const ends = new Map();
  segs.forEach((s, i) => { for (const p of s) { const k = key(p), l = ends.get(k); if (l) l.push(i); else ends.set(k, [i]); } });
  const used = new Uint8Array(segs.length), lines = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const line = [segs[i][0], segs[i][1]];
    for (const tail of [true, false]) {
      for (;;) {
        const end = tail ? line[line.length - 1] : line[0], k = key(end), l = ends.get(k);
        const j = l ? l.find(n => !used[n]) : undefined;
        if (j === undefined) break;
        used[j] = 1;
        const other = key(segs[j][0]) === k ? segs[j][1] : segs[j][0];
        if (tail) line.push(other); else line.unshift(other);
      }
    }
    lines.push(line);
  }
  return lines;
}
function smoothLine(pts) {   // one pass of Chaikin: contour steps become a drawn line
  if (pts.length < 4) return pts;
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const pathOf = (lines, close) => lines.map(l => 'M' + l.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + (close ? 'Z' : '')).join('');
function smoothPath(pts) {   // Catmull-Rom through the points, as cubic Béziers
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(2)} ${c1[1].toFixed(2)} ${c2[0].toFixed(2)} ${c2[1].toFixed(2)} ${p2[0]} ${p2[1]}`;
  }
  return d;
}

// ---- the sectors: regions split by distance, borders that wander a little, shared by both sides ----
function clipHalf(poly, nx, ny, c) {   // keep the part of a polygon where nx*x + ny*y <= c
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], dp = nx * p[0] + ny * p[1] - c, dq = nx * q[0] + ny * q[1] - c;
    if (dp <= 0) out.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const t = dp / (dp - dq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}
function sectorCells() {
  const frame = [[-80, -70], [180, -70], [180, 130], [-80, 130]];   // far past any letterbox
  const cells = TERRITORIES.map(t => TERRITORIES.reduce((poly, o) => o === t ? poly
    : clipHalf(poly, o.x - t.x, o.y - t.y, (o.x - t.x) * (t.x + o.x) / 2 + (o.y - t.y) * (t.y + o.y) / 2), frame.map(p => p.slice())));
  const onBisector = (p, i, j) => {
    const a = TERRITORIES[i], b = TERRITORIES[j], nx = b.x - a.x, ny = b.y - a.y;
    return Math.abs(nx * p[0] + ny * p[1] - (nx * (a.x + b.x) + ny * (a.y + b.y)) / 2) / Math.hypot(nx, ny) < 1e-6;
  };
  const wander = (p, q) => {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]), n = Math.max(1, Math.round(L / 1.1)), pts = [p];
    for (let k = 1; k < n; k++) {
      const x = p[0] + (q[0] - p[0]) * k / n, y = p[1] + (q[1] - p[1]) * k / n;
      pts.push([x + (mapNoise(x * 0.38, y * 0.38, 11) - 0.5) * 1.7, y + (mapNoise(x * 0.38, y * 0.38, 29) - 0.5) * 1.7]);
    }
    pts.push(q);
    return pts;
  };
  const edges = new Map(), outlines = cells.map((poly, i) => {
    const out = [];
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k], q = poly[(k + 1) % poly.length];
      const j = TERRITORIES.findIndex((_, m) => m !== i && onBisector(p, i, m) && onBisector(q, i, m));
      if (j < 0) { out.push(p); continue; }
      const id = Math.min(i, j) + '-' + Math.max(i, j);
      if (!edges.has(id)) edges.set(id, { a: Math.min(i, j), b: Math.max(i, j), pts: wander(p, q) });
      const e = edges.get(id), pts = Math.hypot(e.pts[0][0] - p[0], e.pts[0][1] - p[1]) < 1e-4 ? e.pts : e.pts.slice().reverse();
      for (let n = 0; n < pts.length - 1; n++) out.push(pts[n]);
    }
    return out;
  });
  return { outlines, edges: [...edges.values()] };
}
const gridRef = t => 'ABCDEFGHIJ'[clamp(Math.floor(t.x / 10), 0, 9)] + (Math.floor(t.y / 10) + 1);

// ---- icons for the forecast ----
const SKY_ICON = {
  DAWN: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12h12M4.6 12a3.4 3.4 0 0 1 6.8 0M8 3.6v2M3.6 6.6l1.3 1.2M12.4 6.6l-1.3 1.2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  DAY: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.8" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.5"/></svg>',
  DUSK: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12h12M4.6 12a3.4 3.4 0 0 1 6.8 0M8 8.6V3M6.2 4.8 8 3l1.8 1.8" fill="none" stroke="currentColor" stroke-width="1.5" transform="rotate(180 8 7.3)"/></svg>',
  NIGHT: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.8 2.6a5.6 5.6 0 1 0 2.6 8.6 4.6 4.6 0 0 1-2.6-8.6Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
};

// ---- building the map once ----
function buildMapStatic() {
  const svg = el.mapsvg;
  svg.innerHTML = '';
  const defs = svgEl('defs', null, svg);
  const hatch = svgEl('pattern', { id: 'm-hatch', width: 1.4, height: 1.4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  svgEl('rect', { width: 0.32, height: 1.4, class: 'hatch' }, hatch);
  const marsh = svgEl('pattern', { id: 'm-marsh', width: 2.6, height: 2, patternUnits: 'userSpaceOnUse' }, defs);
  svgEl('path', { d: 'M0.3 1.5h1.6M0.7 1.5v-0.55M1.1 1.5v-0.8M1.5 1.5v-0.55', class: 'marsh-tuft' }, marsh);
  const arrow = svgEl('marker', { id: 'm-arrow', viewBox: '0 0 6 6', refX: 5, refY: 3, markerWidth: 3.2, markerHeight: 3.2, orient: 'auto' }, defs);
  svgEl('path', { d: 'M0 0.4 5.6 3 0 5.6Z', class: 'adv-head' }, arrow);

  const L = MAPV.layers;
  L.terrain = svgEl('g', { class: 'g-terrain' }, svg);
  svgEl('rect', { x: -80, y: -70, width: 260, height: 200, class: 't-ground' }, L.terrain);
  const levels = [];
  for (let lv = 0.18; lv < 1.9; lv += 0.085) levels.push(lv);
  const lines = contourLines(-26, -22, 126, 82, 1, levels);
  const minor = [], index = [];
  lines.forEach((ls, k) => (k % 4 === 3 ? index : minor).push(...ls));
  svgEl('path', { d: pathOf(minor), class: 't-contour' }, L.terrain);
  svgEl('path', { d: pathOf(index), class: 't-index' }, L.terrain);
  svgEl('path', { d: 'M46.8 49.8C51 47.4 58.6 48.6 62.2 52.4 65 55.6 62.6 60 57 60.6 51.4 61.2 45.6 58.8 44.8 55 44.2 52.4 45 50.8 46.8 49.8Z', class: 't-marsh' }, L.terrain);
  const river = smoothPath(MAP_RIVER);
  svgEl('path', { d: river, class: 't-river' }, L.terrain);
  svgEl('path', { d: river, class: 't-river-core' }, L.terrain);

  L.grid = svgEl('g', { class: 'g-grid' }, svg);
  let gd = '';
  for (let x = 10; x < 100; x += 10) gd += `M${x} 0V60`;
  for (let y = 10; y < 60; y += 10) gd += `M0 ${y}H100`;
  svgEl('path', { d: gd, class: 't-grid' }, L.grid);
  svgEl('rect', { x: 0, y: 0, width: 100, height: 60, class: 't-frame' }, L.grid);
  for (let i = 0; i < 10; i++) { const tx = svgEl('text', { x: i * 10 + 5, y: -1.6, class: 't-ref', 'text-anchor': 'middle' }, L.grid); tx.textContent = 'ABCDEFGHIJ'[i]; }
  for (let j = 0; j < 6; j++) { const tx = svgEl('text', { x: -1.6, y: j * 10 + 5.6, class: 't-ref', 'text-anchor': 'middle' }, L.grid); tx.textContent = j + 1; }

  L.regions = svgEl('g', { class: 'g-regions' }, svg);
  L.seams = svgEl('path', { class: 'seam' }, svg);
  L.front = svgEl('g', { class: 'g-front' }, svg);
  L.routes = svgEl('g', { class: 'g-routes' }, svg);
  L.nodes = svgEl('g', { class: 'g-nodes' }, svg);
  L.reticle = svgEl('g', { class: 'reticle' }, svg);

  MAPV.cells = sectorCells();
  MAPV.regions = MAPV.cells.outlines.map((pts, i) => {
    const p = svgEl('path', { d: pathOf([pts], true), class: 'rg' }, L.regions);
    const hatchP = svgEl('path', { d: pathOf([pts], true), class: 'rg-hatch' }, L.regions);
    p.addEventListener('click', () => selectSector(i));
    hatchP.addEventListener('click', () => selectSector(i));
    return { fill: p, hatch: hatchP };
  });
  addEventListener('resize', () => { if (screen === 'map') sizeMapText(); });
  MAPV.built = true;
}
function sizeMapText() {   // labels keep a readable size in pixels whatever the map is scaled to
  const svg = el.mapsvg, r = svg.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const vb = svg.viewBox.baseVal, scale = Math.min(r.width / vb.width, r.height / vb.height);
  const px = innerHeight < 520 ? 9.5 : clamp(9 + scale * 0.35, 10.5, 13);
  svg.style.setProperty('--lab', (px / scale).toFixed(3) + 'px');
  svg.style.setProperty('--ref', (Math.max(8, px - 2) / scale).toFixed(3) + 'px');
  const bar = document.getElementById('opsbar');
  if (bar) bar.style.width = Math.round(scale * 4) + 'px';   // 4 units = 10 km
}

// ---- what changes with the campaign ----
function renderMap() {
  if (!MAPV.built) buildMapStatic();
  const L = MAPV.layers, owned = TERRITORIES.map(terrOwned);
  const fresh = MAPV.owned ? TERRITORIES.filter(t => owned[t.id] && !MAPV.owned[t.id]).map(t => t.id) : [];
  MAPV.owned = owned;

  // the selection: keep what you picked unless you can't fight there, then open on the next fight
  const sel = TERRITORIES[selectedTid];
  if (!sel || !terrAttackable(sel)) {
    const atk = TERRITORIES.filter(terrAttackable);
    const next = atk.find(t => fresh.some(f => t.adj.includes(f))) || (TERRITORIES[meta.activeTid] && terrAttackable(TERRITORIES[meta.activeTid]) ? TERRITORIES[meta.activeTid] : null)
      || atk.slice().sort((a, b) => effTier(a) - effTier(b) || a.id - b.id)[0];
    selectedTid = next ? next.id : 0;
  }

  // regions
  MAPV.regions.forEach((r, i) => {
    const t = TERRITORIES[i], cls = owned[i] ? 'held' : terrAttackable(t) ? 'atk' : 'foe';
    r.fill.setAttribute('class', `rg ${cls}${fresh.includes(i) ? ' fresh' : ''}`);
    r.hatch.setAttribute('class', `rg-hatch${owned[i] ? ' on' : ''}`);
  });
  // borders: the front wherever held ground meets theirs, faint seams everywhere else
  let seams = '';
  L.front.innerHTML = '';
  for (const e of MAPV.cells.edges) {
    const d = pathOf([e.pts]);
    if (owned[e.a] !== owned[e.b]) {
      svgEl('path', { d, class: 'front-glow' }, L.front);
      svgEl('path', { d, class: 'front', pathLength: 1 }, L.front);
      svgEl('path', { d, class: 'front-flow' }, L.front);
    } else seams += d;
  }
  L.seams.setAttribute('d', seams);
  // routes between neighbours: supply lines behind the front, axes of advance across it
  L.routes.innerHTML = '';
  for (const t of TERRITORIES) for (const a of t.adj) {
    const o = TERRITORIES[a], adv = owned[t.id] && !owned[o.id];
    if (!adv && (owned[o.id] !== owned[t.id] || a < t.id)) continue;   // an advance is drawn from its held end; every other pair once
    const dx = o.x - t.x, dy = o.y - t.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d, r1 = adv ? 4.2 : 3.4;
    const attrs = { x1: (t.x + ux * 3.4).toFixed(2), y1: (t.y + uy * 3.4).toFixed(2), x2: (o.x - ux * r1).toFixed(2), y2: (o.y - uy * r1).toFixed(2),
      class: adv ? 'route adv' : owned[t.id] ? 'route own' : 'route' };
    if (adv) attrs['marker-end'] = 'url(#m-arrow)';
    svgEl('line', attrs, L.routes);
  }
  // markers, pushed out from HQ in the order they pop in
  L.nodes.innerHTML = '';
  const hq = TERRITORIES[0];
  const order = TERRITORIES.slice().sort((a, b) => Math.hypot(a.x - hq.x, a.y - hq.y) - Math.hypot(b.x - hq.x, b.y - hq.y)).map(t => t.id);
  MAPV.nodes = TERRITORIES.map(t => {
    const own = owned[t.id], atk = terrAttackable(t), prog = meta.terr[t.id].progress, cap = t.tier === 6;
    const g = svgEl('g', { class: `sec ${own ? 'held' : atk ? 'atk' : 'foe'}`, transform: `translate(${t.x} ${t.y})`, tabindex: 0, role: 'button',
      'aria-label': `${t.name}: ${own ? 'held' : atk ? (prog > 0 ? Math.floor(prog) + '% taken' : 'attackable') : 'enemy held'}` }, L.nodes);
    g.style.setProperty('--i', order.indexOf(t.id));
    const inner = svgEl('g', { class: 'sec-in' }, g);
    svgEl('circle', { r: 4.6, class: 'hit' }, inner);
    if (atk) svgEl('circle', { r: 2.7, class: 'pulse' }, inner);
    if (own) {
      svgEl('rect', { x: -1.55, y: -1.55, width: 3.1, height: 3.1, class: 'mk' }, inner);
      if (t.tier === 0) svgEl('path', { d: 'M0-1 .29-.31 1-.31 .43 .12 .63 .82 0 .39-.63 .82-.43 .12-1-.31-.29-.31Z', class: 'hq' }, inner);
    } else {
      const R = cap ? 2.7 : 2.1;
      svgEl('path', { d: `M0 ${-R}L${R} 0 0 ${R}${-R} 0Z`, class: 'mk' }, inner);
      if (cap) svgEl('path', { d: 'M0-1.25 1.25 0 0 1.25-1.25 0Z', class: 'mk2' }, inner);
      if (prog > 0) {
        const r = cap ? 3.7 : 3.2, circ = 2 * Math.PI * r;
        svgEl('circle', { r, class: 'prog-ring' }, inner);
        svgEl('circle', { r, class: 'prog', 'stroke-dasharray': `${(circ * prog / 100).toFixed(2)} ${circ.toFixed(2)}`, transform: 'rotate(-90)' }, inner);
      }
    }
    const lab = svgEl('text', { y: cap ? 6.7 : 6.0, class: 'lab', 'text-anchor': 'middle' }, inner);
    lab.textContent = t.name.toUpperCase();
    if (!own && prog > 0) { const pl = svgEl('text', { y: cap ? 9.0 : 8.3, class: 'lab-sub', 'text-anchor': 'middle' }, inner); pl.textContent = Math.floor(prog) + '% TAKEN'; }
    g.addEventListener('click', e => { e.stopPropagation(); selectSector(t.id); });
    g.addEventListener('keydown', e => { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); if (selectedTid === t.id) deploySelected(); else selectSector(t.id); } });
    return g;
  });
  sizeMapText();
  selectSector(selectedTid, true);
}
function selectSector(id, quiet) {
  const t = TERRITORIES[id];
  if (!t) return;
  const moved = selectedTid !== id;
  selectedTid = id;
  MAPV.regions.forEach((r, i) => r.fill.classList.toggle('sel', i === id));
  MAPV.nodes.forEach((g, i) => g.classList.toggle('sel', i === id));
  const L = MAPV.layers, R = t.tier === 6 ? 4.9 : 4.1;   // reticle corners: re-made so the lock-in plays again
  L.reticle.innerHTML = '';
  L.reticle.setAttribute('transform', `translate(${t.x} ${t.y})`);
  const inner = svgEl('g', { class: 'ret-in' }, L.reticle), c = R * 0.42;
  svgEl('path', { d: `M${-R} ${-R + c}V${-R}H${-R + c}M${R - c} ${-R}H${R}V${-R + c}M${R} ${R - c}V${R}H${R - c}M${-R + c} ${R}H${-R}V${R - c}` }, inner);
  renderBrief();
  if (moved && !quiet) beep(1250, 0.03, 'square', 0.012, -300);
}
function cycleSector(dir) {
  const atk = TERRITORIES.filter(terrAttackable);
  const list = atk.length ? atk : TERRITORIES;
  const i = list.findIndex(t => t.id === selectedTid);
  selectSector(list[(i + dir + list.length) % list.length].id);
}
function deploySelected() {
  const t = TERRITORIES[selectedTid];
  if (!t || !terrAttackable(t)) return;
  meta.activeTid = t.id; saveMeta();
  enterBattle(t.id);
}

// ---- the briefing column ----
function renderBrief() {
  const t = TERRITORIES[selectedTid];
  if (!t) return;
  const heldN = TERRITORIES.filter(terrOwned).length;
  $('brTheater').textContent = `Theater ${ROMAN[meta.theater] || meta.theater + 1}`;
  $('brHeld').textContent = `${heldN} / ${TERRITORIES.length} held`;
  const segs = $('brSegs');
  if (segs.children.length !== TERRITORIES.length) segs.innerHTML = TERRITORIES.map(() => '<i></i>').join('');
  TERRITORIES.forEach((tt, i) => { segs.children[i].className = (terrOwned(tt) ? 'held' : terrAttackable(tt) ? 'atk' : '') + (i === t.id ? ' sel' : ''); });

  const own = terrOwned(t), atk = terrAttackable(t), prog = meta.terr[t.id].progress, tier = effTier(t);
  const chip = $('brChip');
  chip.className = 'chip ' + (own ? 'held' : atk ? 'atk' : 'foe');
  chip.textContent = own ? 'Held' : atk ? (prog > 0 ? `${Math.floor(prog)}% taken` : 'Attackable') : 'Enemy held';
  $('brCode').textContent = `Sector ${String(t.id).padStart(2, '0')} · Grid ${gridRef(t)}`;
  $('brName').textContent = t.name;
  $('brTier').textContent = `Tier ${tier}`;
  $('brPips').innerHTML = Array.from({ length: 6 }, (_, i) => `<i class="${i < Math.min(tier, 6) ? 'on' : ''}"></i>`).join('');
  const reserves = CFG.enemyTickets + CFG.enemyTicketsPerTier * tier, left = reserves - Math.round(prog / 100 * reserves);
  $('brRes').textContent = own ? '0' : left;
  $('brResSub').textContent = own ? 'Cleared' : prog > 0 ? `Of ${reserves}` : `${CFG.enemyCap} at once`;
  const sky = $('brSky'), wx = $('brWx');
  if (atk) {
    const f = forecastFor(t), name = skyName(f.tod);
    sky.innerHTML = SKY_ICON[name] + `<span>${name}</span>`;
    wx.textContent = (WEATHER[f.weather] || WEATHER.clear).label;
  } else { sky.innerHTML = '<span>—</span>'; wx.textContent = own ? 'Secure' : 'No recon'; }
  const bar = $('brProg');
  bar.hidden = own || !(prog > 0);
  $('brProgFill').style.width = prog + '%';
  const line = $('brLine');
  if (own) line.textContent = t.tier === 0 ? 'Headquarters. Every push starts here.' : 'Held by the Ninth Company.';
  else if (atk) line.innerHTML = `Break <b>${left}</b> enemy reserves. A Warlord takes the field at 90%.`;
  else {
    const via = t.adj.map(i => TERRITORIES[i]).filter(terrAttackable).map(x => x.name);
    line.textContent = via.length ? `Out of reach. Take ${via.join(' or ')} first.` : 'Out of reach. Push the front closer.';
  }
  const db = $('deploybtn');
  db.disabled = !atk;
  $('dbMain').textContent = atk ? (prog > 0 ? 'Resume' : 'Deploy') : own ? 'Held' : 'Out of reach';
  $('dbSub').textContent = atk ? t.name : 'Pick an orange sector';

  const lk = WEAPONS[meta.loadout] ? meta.loadout : 'ar', lw = WEAPONS[lk], la = attFor(lk);
  $('kitname').textContent = lw.name;
  $('kitsub').textContent = (SIGHT_OPTS[lk] ? SIGHTS[la.sight].name + ' · ' : '') + `${la.ext && lw.ext ? lw.ext : lw.mag} rds`;
  $('brSquad').innerHTML = meta.squad.slice(0, CFG.rosterSize).map((m, i) => {
    const gun = WEAPONS[i === 0 ? lk : m.weapon] || WEAPONS.ar;
    return `<li style="--c:${m.wren ? '#d9dbe4' : slotColor(i)}"><b>${SQUAD_ROLE_NAMES[i]}</b><span>${m.wren ? 'CPL ' : ''}${m.name}<em>${gun.name}</em></span></li>`;
  }).join('');
}
function playMapEntrance() {   // the map lays itself out: land, sectors, the front line, markers, then the briefing
  const scr = el.mapscr;
  scr.classList.remove('enter');
  void scr.offsetWidth;
  scr.classList.add('enter');
  clearTimeout(MAPV.enterT);
  MAPV.enterT = setTimeout(() => scr.classList.remove('enter'), 2200);
}
