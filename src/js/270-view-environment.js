// ---------- environment: a mountain town ----------
const ENV_PRESETS = [   // dawn, day, dusk, night: keyframes the battle sky blends between
  { horizon: '#f0c8a4', zenith: '#6a82c2', sun: '#ffcf9a', sunI: 1.5, dir: [0.9, 0.22, -0.4], hemiSky: '#ffd8b8', hemiGround: '#5a553a', hemiI: 1.0,
    fogNear: 26, fogFar: 110, cloud: '#ffd9c2', mount: '#b0a8bc', stars: 0, disc: '#ffd6a0', discSize: 90 },
  { horizon: '#a8c8f0', zenith: '#2f58d0', sun: '#fff1d0', sunI: 2.4, dir: [-0.5, 1, 0.35], hemiSky: '#c8dcff', hemiGround: '#6a7a3a', hemiI: 1.35,
    fogNear: 30, fogFar: 125, cloud: '#ffffff', mount: '#ffffff', stars: 0, disc: '#fff6c8', discSize: 70 },
  { horizon: '#eea070', zenith: '#584a88', sun: '#ff985a', sunI: 1.45, dir: [-0.9, 0.18, 0.3], hemiSky: '#ffb48e', hemiGround: '#4a3a34', hemiI: 0.9,
    fogNear: 24, fogFar: 100, cloud: '#ffae8e', mount: '#a08aa8', stars: 0.15, disc: '#ff8a4a', discSize: 110 },
  { horizon: '#22335a', zenith: '#070c20', sun: '#a8bcff', sunI: 0.75, dir: [0.3, 0.8, -0.5], hemiSky: '#5a6ea8', hemiGround: '#1e2232', hemiI: 0.8,
    fogNear: 18, fogFar: 80, cloud: '#5a6c94', mount: '#3e4a70', stars: 1, disc: '#eef2ff', discSize: 34 },
];
const WEATHER_LOOK = {   // multipliers layered on top of the time-of-day preset
  clear:    { grey: 0,    fogNear: 1,   fogFar: 1,    sunI: 1,    hemiI: 1,    cloudA: 0.9,  rain: 0 },
  overcast: { grey: 0.45, fogNear: 0.9, fogFar: 0.85, sunI: 0.55, hemiI: 0.95, cloudA: 1,    rain: 0 },
  fog:      { grey: 0.6,  fogNear: 0.3, fogFar: 0.42, sunI: 0.5,  hemiI: 0.95, cloudA: 0.15, rain: 0 },
  rain:     { grey: 0.55, fogNear: 0.6, fogFar: 0.6,  sunI: 0.35, hemiI: 0.8,  cloudA: 1,    rain: 1 },
};
const ARENA = { cx: CFG.arenaW / 2 * XS, cz: CFG.arenaH / 2 * XS, hw: CFG.arenaW / 2 * XS, hd: CFG.arenaH / 2 * XS };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function staticMatrices(geo, mat, list) {   // list of [Matrix4, colour]: for props whose parts lean together about a shared foot
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach(([m, c], i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, colorOf(c)); });
  mesh.count = list.length;
  VIEW.scene.add(mesh);
  return mesh;
}
// A headstone in the churchyard, facing the town (+z). One of four shapes by a hash of where it stands — round-topped,
// gabled, a stone cross on a stepped base, or a tablet under a coping stone — on a plinth, in one of five weathered
// stones, with a darker panel where the inscription is and a raised turf plot in front. Three in ten lean with age,
// the stone pivoting on its plinth. Kept under the 0.9 m the simulation stops rounds at (COVER_TOP.grave).
const TOMB_STONE = ['#bdb9af', '#aaa598', '#a0a4a6', '#8f8d86', '#c7c2b6'];
function tombstone(x, z, T) {
  const h1 = hash2(x, z), h2 = hash2(z, x), h3 = hash2(x * 1.7 + 3, z * 0.6 - 1);
  const col = TOMB_STONE[Math.floor(h1 * TOMB_STONE.length) % TOMB_STONE.length], dark = '#6e6b64', turf = '#4c5a34';
  const yaw = (h3 - 0.5) * 0.1, lean = h2 < 0.3 ? (h2 - 0.15) * 0.55 : 0;
  const M = (px, py, pz, rx, ry, rz) => new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
  const ground = M(x, 0, z, 0, yaw, 0);
  const put = (list, parent, px, py, pz, sx, sy, sz, c) => list.push([new THREE.Matrix4().multiplyMatrices(parent, new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz))), c]);
  put(T.box, ground, 0, 0.03, 0.9, 0.64, 0.06, 1.3, turf);             // the plot
  put(T.box, ground, 0, 0.06, 0, 0.84, 0.12, 0.4, dark);               // the plinth
  const shape = Math.floor(h3 * 4) % 4;
  const foot = new THREE.Matrix4().multiplyMatrices(ground, M(0, 0.12, 0, lean, 0, 0));   // the stone, pivoting on the plinth's top
  const panel = (y, w, h) => put(T.box, foot, 0, y, 0.071, w, h, 0.012, dark);
  if (shape === 0) {        // round-topped
    put(T.box, foot, 0, 0.25, 0, 0.6, 0.5, 0.13, col);
    put(T.dome, foot, 0, 0.5, 0, 0.6, 0.3 / 0.5, 0.13, col);
    panel(0.3, 0.36, 0.24);
  } else if (shape === 1) { // gabled
    put(T.box, foot, 0, 0.27, 0, 0.58, 0.54, 0.13, col);
    put(T.gable, foot, 0, 0.54, 0, 0.66, 0.24, 0.15, col);
    panel(0.3, 0.34, 0.26);
  } else if (shape === 2) { // a stone cross on a stepped base
    put(T.box, foot, 0, 0.05, 0, 0.44, 0.1, 0.3, col);
    put(T.box, foot, 0, 0.44, 0, 0.12, 0.68, 0.12, col);
    put(T.box, foot, 0, 0.58, 0, 0.44, 0.11, 0.12, col);
  } else {                  // a tablet under a coping stone
    put(T.box, foot, 0, 0.31, 0, 0.7, 0.62, 0.15, col);
    put(T.box, foot, 0, 0.65, 0, 0.78, 0.06, 0.2, col);
    panel(0.36, 0.44, 0.28);
  }
}
function staticInstances(geo, mat, list) {   // list of [x, y, z, sx, sy, sz, yaw, colour]
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  list.forEach((p, i) => {
    TMP.q.setFromAxisAngle(TMP.up, p[6] || 0);
    TMP.m.compose(TMP.v.set(p[0], p[1], p[2]), TMP.q, TMP.s.set(p[3], p[4], p[5]));
    mesh.setMatrixAt(i, TMP.m);
    mesh.setColorAt(i, colorOf(p[7]));
  });
  mesh.count = list.length;
  VIEW.scene.add(mesh);
  return mesh;
}
function groundHeight(x, z) {   // the valley floor under the town; steep meadows and scree climb away on every side
  const dx = Math.max(0, Math.abs(x - ARENA.cx) - (ARENA.hw + 8));
  const dz = Math.max(0, Math.abs(z - ARENA.cz) - (ARENA.hd + 8));
  const d = Math.hypot(dx, dz);
  return smooth(0, 60, d) * (26 + 12 * Math.sin(x * 0.045) * Math.cos(z * 0.04))
    + Math.sin(x * 0.13 + z * 0.07) * 1.6 * smooth(0, 22, d);
}
// ---------- merged house geometry: plaster walls tiled per 3.2 m bay, gable roofs, one draw call each ----------
const geoArrays = () => ({ pos: [], nor: [], uv: [], col: [] });
function pushQuad(A, p0, p1, p2, p3, n, uw, vh, col) {   // p0→p1→p2→p3 counter-clockwise seen from outside
  const v = [p0, p1, p2, p0, p2, p3], uv = [0, 0, uw, 0, uw, vh, 0, 0, uw, vh, 0, vh];
  for (let k = 0; k < 6; k++) { A.pos.push(v[k][0], v[k][1], v[k][2]); A.nor.push(n[0], n[1], n[2]); A.uv.push(uv[k * 2], uv[k * 2 + 1]); A.col.push(col.r, col.g, col.b); }
}
function pushTri(A, p0, p1, p2, n, uw, vh, col) {
  const v = [p0, p1, p2], uv = [0, 0, uw, 0, uw / 2, vh];
  for (let k = 0; k < 3; k++) { A.pos.push(v[k][0], v[k][1], v[k][2]); A.nor.push(n[0], n[1], n[2]); A.uv.push(uv[k * 2], uv[k * 2 + 1]); A.col.push(col.r, col.g, col.b); }
}
function pushWalls(A, cx, y0, cz, w, h, d, col, tile) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y1 = y0 + h, v = h / tile;
  pushQuad(A, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], w / tile, v, col);
  pushQuad(A, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], w / tile, v, col);
  pushQuad(A, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], d / tile, v, col);
  pushQuad(A, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], d / tile, v, col);
}
function pushRoof(A, cx, y0, cz, w, d, h, col, tile) {   // gable roof with eaves; the ridge runs along the longer side
  const along = w >= d, L = (along ? w : d) + 0.7, a = ((along ? d : w) + 0.7) / 2, y1 = y0 + h;
  const P = (u, y, v) => along ? [cx + u, y, cz + v] : [cx - v, y, cz + u];
  const N = (nu, ny, nv) => along ? [nu, ny, nv] : [-nv, ny, nu];
  const nl = Math.hypot(a, h), u0 = -L / 2, u1 = L / 2;
  pushQuad(A, P(u0, y0, a), P(u1, y0, a), P(u1, y1, 0), P(u0, y1, 0), N(0, a / nl, h / nl), L / tile, nl / tile, col);
  pushQuad(A, P(u1, y0, -a), P(u0, y0, -a), P(u0, y1, 0), P(u1, y1, 0), N(0, a / nl, -h / nl), L / tile, nl / tile, col);
  pushTri(A, P(u1, y0, a), P(u1, y0, -a), P(u1, y1, 0), N(1, 0, 0), a * 2 / tile, h / tile, col);
  pushTri(A, P(u0, y0, -a), P(u0, y0, a), P(u0, y1, 0), N(-1, 0, 0), a * 2 / tile, h / tile, col);
}
function meshFrom(A, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(A.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(A.col, 3));
  const m = new THREE.Mesh(g, mat);
  VIEW.scene.add(m);
  return m;
}
function buildEnvironment() {
  const S = VIEW.scene, rnd = makeRng(1234), K = VIEW.kit, lit = VIEW.mats.lit, E = VIEW.envTex = paintEnvTextures();
  S.background = new THREE.Color(0xa8c8f0);
  S.fog = new THREE.Fog(0xa8c8f0, 30, 125);
  VIEW.hemi = new THREE.HemisphereLight(0xc8dcff, 0x6a7a3a, 1.35);
  S.add(VIEW.hemi);
  const sun = VIEW.sunLight = new THREE.DirectionalLight(0xfff1d0, 2.4);
  sun.position.set(-0.5, 1, 0.35);
  S.add(sun);
  const c = new THREE.Color();
  const paintGround = (geo, dip) => {
    const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = groundHeight(x, z);
      pos.setY(i, h > 0.002 || !dip ? h : -0.06);
      groundColor(x, z, h, c);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
  };
  const groundMesh = (geo, repX, repZ, tex = E.ground) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(repX, repZ);
    S.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: t, vertexColors: true })));
  };
  const outer = new THREE.PlaneGeometry(340, 340, 68, 68);   // rolling hills; dips under the field mesh inside it
  outer.rotateX(-Math.PI / 2); outer.translate(ARENA.cx, 0, ARENA.cz);
  paintGround(outer, true);
  groundMesh(outer, 340 / 3.2, 340 / 3.2);
  const FW = ARENA.hw * 2 + 16, FD = ARENA.hd * 2 + 16;     // the battlefield itself, fine enough to paint a road
  const field = new THREE.PlaneGeometry(FW, FD, Math.round(FW * 2), Math.round(FD * 2));
  field.rotateX(-Math.PI / 2); field.translate(ARENA.cx, 0, ARENA.cz);
  paintGround(field, false);
  groundMesh(field, FW / 3.2, FD / 3.2, E.ground);
  buildGroundZones(E);

  const sky = new THREE.SphereGeometry(480, 16, 12);        // sky dome, recoloured each frame by applyEnv
  const sp = sky.attributes.position, sc = new Float32Array(sp.count * 3);
  sky.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  VIEW.skyGeo = sky;
  VIEW.skyT = Float32Array.from({ length: sp.count }, (_, k) => smooth(0.02, 0.6, sp.getY(k) / 480));
  VIEW.sky = new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  VIEW.sky.renderOrder = -10;
  S.add(VIEW.sky);
  const puff = new THREE.PlaneGeometry(1, 1);
  const cloudMat = VIEW.cloudMat = new THREE.MeshBasicMaterial({ map: E.cloud, transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
  VIEW.clouds = new THREE.Group();
  for (let i = 0; i < 22; i++) {
    const a = rnd() * TAU, d = 190 + rnd() * 150, m = new THREE.Mesh(puff, cloudMat);
    m.position.set(Math.cos(a) * d, 80 + rnd() * 80, Math.sin(a) * d);
    m.scale.set(120 + rnd() * 110, 50 + rnd() * 30, 1);
    VIEW.clouds.add(m);
  }
  S.add(VIEW.clouds);
  VIEW.sun = new THREE.Mesh(puff, new THREE.MeshBasicMaterial({ map: VIEW.tex.glow, transparent: true, depthWrite: false, fog: false, color: 0xfff6c8 }));
  VIEW.sun.scale.set(70, 70, 1);
  S.add(VIEW.sun);

  const N = 56, R = 215, mp = [], mc = [], hi = colorOf('#e8ecf4'), lo = colorOf('#56606e');   // snow-capped ranges
  const peaks = Array.from({ length: N }, () => 60 + rnd() * 70);
  peaks.push(peaks[0]);
  for (let i = 0; i < N; i++) {
    const a0 = i / N * TAU, a1 = (i + 1) / N * TAU;
    for (const [a, y, col] of [[a0, -4, lo], [a1, -4, lo], [a1, peaks[i + 1], hi], [a0, -4, lo], [a1, peaks[i + 1], hi], [a0, peaks[i], hi]]) {
      mp.push(ARENA.cx + Math.cos(a) * R, y, ARENA.cz + Math.sin(a) * R);
      mc.push(col.r, col.g, col.b);
    }
  }
  const mg = new THREE.BufferGeometry();
  mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
  mg.setAttribute('color', new THREE.Float32BufferAttribute(mc, 3));
  VIEW.mountMat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
  S.add(new THREE.Mesh(mg, VIEW.mountMat));

  // set dressing that never enters the walkable field
  const barkMat = new THREE.MeshLambertMaterial({ map: E.bark });
  const cardMat = new THREE.MeshLambertMaterial({ map: E.foliage, alphaTest: 0.45, side: THREE.DoubleSide });
  const bushMat = new THREE.MeshLambertMaterial({ map: E.bush, alphaTest: 0.45, side: THREE.DoubleSide });
  const rockMat = new THREE.MeshLambertMaterial({ map: E.rock });
  const stoneMat = new THREE.MeshLambertMaterial({ map: E.stone });
  const concreteMat = new THREE.MeshLambertMaterial({ map: E.concrete });
  const hescoMat = new THREE.MeshLambertMaterial({ map: E.hesco });
  const houseMat = new THREE.MeshLambertMaterial({ map: E.house, vertexColors: true });
  const roofMat = new THREE.MeshLambertMaterial({ map: E.roof, vertexColors: true, side: THREE.DoubleSide });
  E.bark.repeat.set(1, 3);
  const jersey = new THREE.BoxGeometry(1, 1, 1);   // concrete barrier: the top pinched in across its width
  { const p = jersey.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, p.getX(i) * 0.38); jersey.computeVertexNormals(); }
  const trunks = [], boughs = [], bushes = [], rocks = [[], [], []], bastion = [], poles = [], hulls = [], tents = [];
  const stones = [], balconies = [], spires = [], placed = [], detail = [], sleepers = [], tanks = [], hedges = [], mounds = [], tombs = { box: [], dome: [], gable: [] };
  const W = geoArrays(), RF = geoArrays(), ST = geoArrays(), MT = geoArrays(), CN = geoArrays();
  const stoneWallMat = new THREE.MeshLambertMaterial({ map: E.stone, vertexColors: true });
  const metalMat = new THREE.MeshLambertMaterial({ map: E.metalWall, vertexColors: true, side: THREE.DoubleSide });
  const concreteWallMat = new THREE.MeshLambertMaterial({ map: E.concrete, vertexColors: true });
  const PLASTER = ['#efe6d6', '#e8d2a8', '#d8c0b0', '#c8d4d8', '#f2ece2'], ROOFS = ['#5a5e66', '#8a5238', '#6a5a4a', '#4e525a'];
  const box = (x, y, z, sx, sy, sz, col, yaw = 0) => detail.push([x, y, z, sx, sy, sz, yaw, col]);   // a small painted box
  const house = (x, z, w, d, storeys, style, ground) => {
    const h = storeys * 3.2, pick = Math.abs(Math.round(x * 7 + z * 3));
    pushWalls(W, x, ground, z, w, h, d, colorOf(PLASTER[pick % PLASTER.length]), 3.2);
    pushRoof(RF, x, ground + h, z, w, d, Math.min(w, d) * 0.42, colorOf(ROOFS[(pick >> 2) % ROOFS.length]), 1.6);
    if (style === 0) stones.push([x, ground + 0.6, z, w + 0.14, 1.2, d + 0.14, 0, '#ffffff']);
    stones.push([x + w * 0.22, ground + h + Math.min(w, d) * 0.3, z - d * 0.12, 0.7, 1.8, 0.7, 0, '#d8d0c4']);
    if (style === 2) balconies.push([x, ground + 3.3, z + d / 2 + 0.5, w * 0.7, 0.14, 1.0, 0, '#7a5a3a'], [x, ground + 3.8, z + d / 2 + 0.95, w * 0.7, 0.9, 0.08, 0, '#6a4a2c']);
    placed.push([x, z, Math.max(w, d) * 0.75]);
  };
  const Wm = TOWN.w, Hm = TOWN.h;
  for (const [x0, y0, x1, y1, h, style] of TOWN.buildings) {   // the town, place by place
    const cx = (x0 + x1) / 2, cz = (y0 + y1) / 2, w = x1 - x0, d = y1 - y0, pick = Math.abs(Math.round(cx * 7 + cz * 3));
    if (style.startsWith('house')) { house(cx, cz, w, d, Math.max(1, Math.round(h / 3.2)), +style.slice(5), 0); continue; }
    placed.push([cx, cz, Math.max(w, d) * 0.6]);
    if (style === 'station') {
      pushWalls(W, cx, 0, cz, w, h, d, colorOf('#c98a66'), 3.2);
      pushRoof(RF, cx, h, cz, w, d, Math.min(w, d) * 0.3, colorOf('#4e525a'), 1.6);
      for (let x = x0 + 1.2; x <= x1 - 1; x += 3.9) box(x, 1.75, y1 + 1.9, 0.14, 3.5, 0.14, '#43474b');   // the platform canopy on its posts
      box(cx, 3.55, y1 + 1.25, w - 0.4, 0.14, 2.9, '#5a5e64');
      box(cx, h * 0.62, y1 + 0.08, 1.2, 1.2, 0.1, '#f2eee2'); box(cx, h * 0.62, y1 + 0.15, 0.08, 0.42, 0.04, '#1a1a1a');   // the station clock
    } else if (style === 'warehouse') {
      pushWalls(MT, cx, 0, cz, w, h, d, colorOf('#a4a9ad'), 3);
      pushRoof(MT, cx, h, cz, w, d, Math.min(w, d) * 0.16, colorOf('#8a7a66'), 3);
      for (let q = 0; q < 3; q++) box(x0 + w * (0.2 + q * 0.3), 2.2, y1 + 0.07, 4.2, 4.4, 0.12, '#3c4044');   // roller doors onto the tracks
      box(x0 + 2, h + 1.6, cz, 0.9, 3.2, 0.9, '#6a6a66');   // a flue
    } else if (style === 'wagon') {
      const col = colorOf(['#8a3a2a', '#5a5a4e', '#2e5a5a', '#7a5a2a'][pick % 4]);
      pushWalls(MT, cx, 1.0, cz, w, h - 1.0, d, col, 2.4); pushTop(MT, cx, h, cz, w + 0.2, d + 0.2, col, 2.4);
      box(cx, 0.75, cz, w - 0.6, 0.35, d - 0.8, '#1c1c1c');   // underframe
      for (const bx of [x0 + 2.2, x1 - 2.2]) box(bx, 0.45, cz, 2.4, 0.7, d - 0.4, '#2a2a28');   // bogies
      box(cx, 2.3, y1 + 0.06, 2.4, 2.2, 0.08, '#3a2a22');   // the sliding door
    } else if (style === 'container') {
      const col = colorOf(['#2e5a8a', '#a83a2a', '#3a6a3a', '#c86a2a', '#6a6a70'][pick % 5]), endX = w > d;
      pushWalls(MT, cx, 0, cz, w, h, d, col, 2.4); pushTop(MT, cx, h, cz, w, d, col, 2.4);
      box(endX ? x1 + 0.04 : cx, h / 2, endX ? cz : y1 + 0.04, endX ? 0.06 : 0.1, h - 0.3, endX ? 0.1 : 0.06, '#1e1e1e');   // the door seam on a short end
    } else if (style === 'church') {
      pushWalls(ST, cx, 0, cz, w, h, d, colorOf('#e6e0d2'), 3);
      pushRoof(RF, cx, h, cz, w, d, Math.min(w, d) * 0.62, colorOf('#4a4e56'), 1.6);
      box(x1 + 0.08, 1.7, cz, 0.12, 3.4, 2.2, '#3a2a1e');   // doors onto the square
      box(x1 + 0.1, 5.9, cz, 0.1, 1.8, 1.8, '#2a3a5a');     // a rose window above them
      for (let z = y0 + 2.5; z < y1 - 1; z += 3.2) for (const x of [x0 - 0.06, x1 + 0.06]) if (Math.abs(z - cz) > 2) box(x, 4.4, z, 0.1, 3.2, 0.9, '#2a3a5a');
    } else if (style === 'belltower') {
      pushWalls(ST, cx, 0, cz, w, h, d, colorOf('#ebe5d8'), 3);
      spires.push([cx, h + 3.6, cz, w * 1.1, 7.2, d * 1.1, Math.PI / 4, '#4a4e56']);
      for (const [dx, dz] of [[w / 2 + 0.05, 0], [-w / 2 - 0.05, 0], [0, d / 2 + 0.05], [0, -d / 2 - 0.05]]) {
        const onX = dx !== 0;
        box(cx + dx, h - 2.2, cz + dz, onX ? 0.1 : 1.5, 2.4, onX ? 1.5 : 0.1, '#141414');   // belfry openings
        box(cx + dx * 1.01, h - 5.8, cz + dz * 1.01, onX ? 0.1 : 1.4, 1.4, onX ? 1.4 : 0.1, '#f0ece0');   // clock faces
      }
    } else if (style === 'shop') {
      pushWalls(CN, cx, 0, cz, w, h, d, colorOf('#ecebe6'), 3.2); pushTop(CN, cx, h, cz, w, d, colorOf('#bdbcb6'), 3.2);
      box(x0 - 0.06, 1.5, cz, 0.1, 2.4, d - 1.6, '#1e3450');   // the glass front, onto the pumps
      box(x0 - 0.1, h - 0.45, cz, 0.16, 0.7, d + 0.2, '#e8742c');   // the sign band
    } else if (style === 'chapel') {
      const rh = Math.min(w, d) * 0.55;
      pushWalls(ST, cx, 0, cz, w, h, d, colorOf('#d6cebd'), 3);
      pushRoof(RF, cx, h, cz, w, d, rh, colorOf('#565a62'), 1.6);
      box(cx, h + rh + 0.6, y0 + 0.9, 0.14, 1.4, 0.14, '#3a3a3a'); box(cx, h + rh + 0.9, y0 + 0.9, 0.7, 0.14, 0.14, '#3a3a3a');   // the cross
      box(cx, 1.4, y1 + 0.07, 1.4, 2.8, 0.1, '#3a2a1e');
    }
  }
  for (const p of PERCHES) {   // where a marksman can set up: a stone sill under the belfry opening, sandbags on a roof edge
    if (p.nest === 'sill') { box(p.x - 0.05, p.z - 0.1, p.y, 0.75, 0.2, 1.7, '#d8d0c0'); continue; }
    const along = Math.abs(Math.cos(p.face)) > 0.5, fx = p.x + Math.cos(p.face) * 0.62, fy = p.y + Math.sin(p.face) * 0.62;
    for (const k of [-0.5, 0, 0.5]) box(fx + (along ? 0 : k), p.z + 0.28, fy + (along ? k : 0), along ? 0.34 : 0.52, 0.28, along ? 0.52 : 0.34, '#8f8260');
    for (const k of [-0.25, 0.25]) box(fx + (along ? 0 : k), p.z + 0.54, fy + (along ? k : 0), along ? 0.32 : 0.5, 0.25, along ? 0.5 : 0.32, '#7f7454');
  }
  // the perimeter, standing exactly on the edge of play
  for (const x of [-0.3, Wm + 0.3]) { pushWalls(ST, x, 0, Hm / 2, 0.6, 2.4, Hm + 1.2, colorOf('#d2ccbe'), 2.4); pushTop(ST, x, 2.4, Hm / 2, 0.8, Hm + 1.2, colorOf('#b8b2a4'), 2.4); }
  for (let x = -0.6; x <= Wm + 0.6; x += 1.1) bastion.push([x, 1.1, Hm + 0.55, 1.05, 2.2, 1.05, 0, rnd() < 0.5 ? '#ffffff' : '#e8e0d0']);
  for (let x = 0; x <= Wm; x += 3) box(x, 1.2, -0.12, 0.1, 2.4, 0.1, '#5a5e62');
  box(Wm / 2, 2.35, -0.12, Wm, 0.06, 0.06, '#6a6e72'); box(Wm / 2, 0.15, -0.12, Wm, 0.06, 0.06, '#6a6e72');
  {
    const t = E.chain.clone();
    t.needsUpdate = true; t.repeat.set(Wm / 1.2, 2.3 / 1.2);
    const fence = new THREE.Mesh(new THREE.PlaneGeometry(Wm, 2.3), new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide }));
    fence.position.set(Wm / 2, 1.2, -0.12);
    S.add(fence);
  }
  box(48, 1.05, -0.5, 7.6, 0.12, 0.12, '#d23a2a');   // the gate's striped boom
  for (let q = 0; q < 4; q++) box(45 + q * 1.9, 1.05, -0.5, 0.95, 0.13, 0.13, '#f2eee2');
  // the rail yard: two tracks, the water tower
  for (const tz of [13.5, 17]) {
    for (const off of [-0.72, 0.72]) box(Wm / 2, 0.14, tz + off, Wm, 0.12, 0.1, '#7a7a74');
    for (let x = 0.4; x < Wm; x += 0.72) sleepers.push([x, 0.05, tz, 0.26, 0.1, 2.4, 0, rnd() < 0.5 ? '#ffffff' : '#d8ccc0']);
  }
  for (const [dx, dz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) box(27.5 + dx, 4.2, 5.5 + dz, 0.22, 8.4, 0.22, '#5a4a3a');
  tanks.push([27.5, 9.9, 5.5, 3.4, 3, 3.4, 0, '#8a7a62']);
  spires.push([27.5, 12.3, 5.5, 3.8, 1.8, 3.8, 0, '#5a5e66']);
  // the building site: floor slabs on the frame, scaffolding, the crane with a beam on its hook
  pushSlab(CN, 32, 3.3, 59, 9.6, 0.3, 9.6, colorOf('#c4c2bb'), 3.2);
  pushSlab(CN, 29.6, 6.6, 59, 5.2, 0.3, 9.6, colorOf('#bcbab2'), 3.2);
  for (let z = 54.8; z <= 63.4; z += 1.2) box(32.3, 7.2, z, 0.05, 1.2, 0.05, '#5a3a2a');   // rebar where the next floor would go
  for (let z = 54.6; z <= 63.6; z += 2.2) for (const x of [37.2, 38.1]) box(x, 3.6, z, 0.07, 7.2, 0.07, '#8a8e92');
  for (const y of [3.3, 6.6]) box(37.65, y, 59, 1.0, 0.06, 9.2, '#9a7a50');
  box(26.8, 12, 53.2, 1.3, 24, 1.3, '#d8a82a'); box(34.8, 23.6, 53.2, 18, 0.9, 1.0, '#d8a82a'); box(23.3, 23.6, 53.2, 6, 0.8, 1.0, '#d8a82a');
  box(21.2, 22.8, 53.2, 1.6, 1.2, 1.2, '#6a6a66'); box(27.6, 22.2, 53.2, 1.4, 1.6, 1.5, '#e8e4d8');
  box(38.5, 16, 53.2, 0.05, 15, 0.05, '#1a1a1a'); box(38.5, 8.3, 53.2, 0.5, 0.6, 0.5, '#d8a82a'); box(38.5, 7.7, 53.2, 3.6, 0.3, 0.3, '#5a5e62');
  // the gas station: canopy over the pumps, price sign; the café awning
  box(76, 4.5, 37, 12, 0.5, 6.4, '#e8742c'); box(76, 4.8, 37, 11.8, 0.15, 6.2, '#ecebe6'); box(76, 4.22, 37, 10, 0.05, 4.4, '#fff6d8');
  box(65.6, 3.1, 32.6, 0.25, 6.2, 0.25, '#4a4e52'); box(65.6, 5.4, 32.6, 0.25, 1.8, 2.6, '#e8742c'); box(65.45, 5.2, 32.6, 0.05, 0.9, 2.2, '#1a1a1a');
  box(60.75, 2.7, 44.4, 6.2, 0.1, 1.3, '#b8382a');
  for (let q = 0; q < 4; q++) box(58.4 + q * 1.55, 2.72, 44.4, 0.5, 0.1, 1.32, '#f2eee2');
  // streetlights, dashed lines and crossings on the streets
  for (const [x, z, s] of [[42.35, 5, 1], [53.65, 12, -1], [42.35, 24, 1], [53.65, 33, -1], [42.35, 43, 1], [53.65, 52, -1], [42.35, 58, 1]]) {
    box(x, 2.6, z, 0.14, 5.2, 0.14, '#3a3e42'); box(x + s * 0.55, 5.15, z, 1.1, 0.08, 0.08, '#3a3e42'); box(x + s * 1.05, 5.02, z, 0.42, 0.14, 0.26, '#fff2c0');
  }
  const dash = (x, z, alongZ) => box(x, 0.03, z, alongZ ? 0.14 : 1.6, 0.02, alongZ ? 1.6 : 0.14, '#e4e2d4');
  for (let z = 2; z < 26; z += 3.2) dash(48, z, true);
  for (let z = 54; z < 60; z += 3.2) dash(48, z, true);
  for (let x = 1.5; x < 95; x += 3.2) if (x < 41.5 || x > 54.5) { dash(x, 29, false); dash(x, 50, false); }
  for (let x = 42.6; x < 53.6; x += 0.9) { box(x, 0.03, 26.1, 0.45, 0.02, 1.7, '#e4e2d4'); box(x, 0.03, 52.9, 0.45, 0.02, 1.7, '#e4e2d4'); }
  box(55.5, 4.5, 62.5, 0.1, 9, 0.1, '#8a8e92'); box(56.2, 8.5, 62.5, 1.3, 0.8, 0.04, '#3a5a8a');   // the FOB flag
  // the fixed cover that can't be destroyed is drawn once, here, with the town
  const treeAt = (x, z, H) => {
    trunks.push([x, H * 0.5, z, 0.5, H, 0.5, rnd() * TAU, rnd() < 0.5 ? '#ffffff' : '#e4dccf']);
    [[0.3, 5.0, 1.9], [0.5, 4.1, 1.7], [0.68, 3.1, 1.5], [0.84, 2.0, 1.3], [0.96, 0.9, 1.0]].forEach(([f, w, h]) =>
      boughs.push([x, H * f, z, w * (0.85 + rnd() * 0.3), h, w, rnd() * TAU, rnd() < 0.5 ? '#ffffff' : '#dfe8cc']));
  };
  for (const [kind, fx, fz, rot] of TOWN.fixed) {
    if (!STATIC_COVER.has(kind)) continue;
    const Kc = COVER_KINDS[kind], hw = (rot ? Kc.hd : Kc.hw) / 40 || 0, hd = (rot ? Kc.hw : Kc.hd) / 40 || 0, yaw = rot ? Math.PI / 2 : 0;
    if (kind === 'platform') { pushSlab(CN, fx, 0, fz, hw * 2, 0.9, hd * 2, colorOf('#bfbdb6'), 3.2); box(fx, 0.91, fz + hd - 0.12, hw * 2, 0.02, 0.18, '#e8c42a'); }
    else if (kind === 'pillar') pushWalls(CN, fx, 0, fz, hw * 2, 6.6, hd * 2, colorOf('#c4c2bb'), 3.2);
    else if (kind === 'hesco') bastion.push([fx, 0.8, fz, hw * 2, 1.6, hd * 2, 0, '#ffffff']);
    else if (kind === 'tree') treeAt(fx, fz, 7 + hash2(fx, fz) * 3);
    else if (kind === 'tent') tents.push([fx, 0, fz, 1.2, 2.2, 5.5, yaw, '#b8ae8a']);
    else if (kind === 'mound') mounds.push([fx, 0.25, fz, 2.7, 1.45, 2.7, hash2(fx, fz) * TAU, '#e0d4b8']);
    else if (kind === 'hedge') hedges.push([fx, 0.65, fz, hw * 2, 1.3, hd * 2, 0, '#ffffff']);
    else if (kind === 'grave') tombstone(fx, fz, tombs);
    else if (kind === 'statue') {   // the war memorial: a soldier on a plinth, rifle raised
      box(fx, 0.12, fz, 2.1, 0.24, 2.1, '#b8b2a4'); box(fx, 0.72, fz, 1.6, 1.0, 1.6, '#c8c2b4');
      box(fx, 1.67, fz, 0.34, 0.9, 0.22, '#6a5a3a'); box(fx, 2.42, fz, 0.46, 0.62, 0.28, '#6a5a3a'); box(fx, 2.88, fz, 0.24, 0.26, 0.24, '#6a5a3a');
      box(fx + 0.3, 2.78, fz, 0.12, 0.7, 0.12, '#6a5a3a'); box(fx + 0.42, 3.15, fz, 0.08, 0.95, 0.08, '#5a4a2e');
    } else if (kind === 'truck') {   // a covered army truck
      box(fx, 0.95, fz, 2.3, 0.5, 7, '#2a2a28'); box(fx, 2.25, fz + 0.9, 2.5, 2.1, 5.0, '#6a6c50'); box(fx, 1.85, fz - 2.7, 2.4, 1.8, 1.6, '#5e6048');
      box(fx, 2.3, fz - 3.52, 2.0, 0.6, 0.05, '#1e2a34');
      for (const [a, b] of [[-1, -2.6], [1, -2.6], [-1, 1.2], [1, 1.2], [-1, 2.6], [1, 2.6]]) box(fx + a * 1.1, 0.5, fz + b, 0.35, 1.0, 1.0, '#141414');
    } else if (kind === 'bus') {   // a burnt-out bus
      box(fx, 1.55, fz, 2.4, 2.3, 10.6, '#3a3632'); box(fx, 2.75, fz, 2.2, 0.12, 10.2, '#2a2622');
      for (const a of [-1, 1]) { box(fx + a * 1.21, 2.0, fz, 0.04, 0.8, 9.6, '#141414'); for (const b of [-3.6, 3.4]) box(fx + a * 1.05, 0.45, fz + b, 0.3, 0.9, 1.0, '#1a1a1a'); }
    }
  }
  // the slopes around the town: chalets, forest, scrub and scree
  const free = (x, z, r) => placed.every(([px, pz, pr]) => Math.hypot(x - px, z - pz) > r + pr);
  for (let i = 0, tries = 0; i < 34 && tries < 320; tries++) {
    const side = tries % 3;
    const x = side === 0 ? -34 + rnd() * (Wm + 68) : side === 1 ? -14 - rnd() * 30 : Wm + 14 + rnd() * 30;
    const z = side === 0 ? -16 - rnd() * 44 : -8 + rnd() * (Hm + 10), w = 6 + rnd() * 3, d = 6 + rnd() * 3;
    if (side === 0 && Math.abs(x - Wm / 2) < 7) continue;   // keep the pass road clear
    if (!free(x, z, Math.max(w, d) * 0.75)) continue;
    house(x, z, w, d, 2, (rnd() * 3) | 0, groundHeight(x, z) - 0.8);
    i++;
  }
  const tree = (x, z, H) => {
    if (!free(x, z, 2)) return;
    const y = groundHeight(x, z);
    trunks.push([x, y + H * 0.5, z, 0.5, H, 0.5, rnd() * TAU, rnd() < 0.5 ? '#ffffff' : '#e4dccf']);
    [[0.3, 5.0, 1.9], [0.5, 4.1, 1.7], [0.68, 3.1, 1.5], [0.84, 2.0, 1.3], [0.96, 0.9, 1.0]].forEach(([f, w, h]) =>
      boughs.push([x, y + H * f, z, w * (0.85 + rnd() * 0.3), h, w, rnd() * TAU, rnd() < 0.5 ? '#ffffff' : '#dfe8cc']));
  };
  for (let i = 0; i < 140; i++) tree(-50 + rnd() * (Wm + 100), -12 - rnd() * 70, 6 + rnd() * 5);
  for (let i = 0; i < 90; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    tree(side < 0 ? -12 - rnd() * 60 : Wm + 12 + rnd() * 60, -30 + rnd() * (Hm + 70), 6 + rnd() * 5);
  }
  for (let i = 0; i < 60; i++) tree(-40 + rnd() * (Wm + 80), Hm + 10 + rnd() * 50, 6 + rnd() * 5);
  for (let i = 0; i < 90; i++) {   // scrub just outside the walls
    const edge = rnd();
    const x = edge < 0.35 ? -2.2 - rnd() * 3 : edge < 0.7 ? Wm + 2.2 + rnd() * 3 : rnd() * Wm;
    const z = edge < 0.7 ? -4 + rnd() * (Hm + 4) : -2.5 - rnd() * 4;
    const w = 1.3 + rnd() * 1.1;
    bushes.push([x, groundHeight(x, z), z, w, w * 0.62, w, rnd() * TAU, rnd() < 0.5 ? '#ffffff' : '#e2ecd0']);
  }
  for (let i = 0; i < 90; i++) {   // scree and boulders on the slopes
    const a = rnd() * TAU, d = 55 + rnd() * 80, x = ARENA.cx + Math.cos(a) * d, z = ARENA.cz + Math.sin(a) * d;
    if (x > -6 && x < Wm + 6 && z > -6 && z < Hm + 6) continue;
    const s = 0.6 + rnd() * 2.2;
    rocks[i % 3].push([x, groundHeight(x, z) + s * 0.25, z, s, s, s, rnd() * TAU, rnd() < 0.5 ? '#ffffff' : '#d8d2c8']);
  }
  for (let i = 0; i < 6; i++) {   // burnt-out cars on the road down from the pass
    const x = ARENA.cx + (rnd() - 0.5) * 14, z = -8 - rnd() * 14, yaw = rnd() * TAU;
    hulls.push([x, 0.55, z, 1.9, 0.8, 4.2, yaw, '#3a3632'], [x, 1.18, z, 1.6, 0.55, 2.2, yaw, '#2e2a26']);
  }
  for (let z = -64; z <= Hm + 50; z += 12) {   // power line down the valley road
    if (z > -12 && z < Hm + 5) continue;
    const x = ARENA.cx + Math.sin(z * 0.11) * 6 + Math.sin(z * 0.043 + 1) * 4 + 3.6;
    poles.push([x, groundHeight(x, z) + 4, z, 0.22, 8, 0.22, 0, '#6a5a48']);
    hulls.push([x, groundHeight(x, z) + 7.4, z, 1.6, 0.12, 0.12, 0, '#4a3a2c']);
  }
  meshFrom(W, houseMat); meshFrom(RF, roofMat); meshFrom(ST, stoneWallMat); meshFrom(MT, metalMat); meshFrom(CN, concreteWallMat);
  staticInstances(new THREE.CylinderGeometry(0.44, 0.62, 1, 6), barkMat, trunks);
  staticInstances(crossCards(3), cardMat, boughs);
  staticInstances(crossCards(3), bushMat, bushes);
  rocks.forEach((list, q) => staticInstances(rockGeometry(7 + q * 13), rockMat, list));
  staticInstances(rockGeometry(31), rockMat, mounds);
  staticInstances(new THREE.BoxGeometry(1, 1, 1), hescoMat, bastion);
  staticInstances(new THREE.BoxGeometry(1, 1, 1), stoneMat, stones);
  const tombMat = new THREE.MeshLambertMaterial();   // smooth dressed stone: the town's brick texture is what made the old ones read as blocks
  staticMatrices(new THREE.BoxGeometry(1, 1, 1), tombMat, tombs.box);
  staticMatrices(new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), tombMat, tombs.dome);   // a half drum, round side up, axis through the stone
  staticMatrices(new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]), { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5), tombMat, tombs.gable);
  staticInstances(toCell(new THREE.BoxGeometry(1, 1, 1), () => CELLS.leaf), lit, hedges);
  staticInstances(K.wood, lit, balconies);
  staticInstances(K.wood, lit, sleepers);
  staticInstances(toCell(new THREE.ConeGeometry(0.72, 1, 4), () => CELLS.white), lit, spires);
  staticInstances(toCell(new THREE.CylinderGeometry(0.5, 0.5, 1, 6), () => CELLS.wood), lit, poles);
  staticInstances(toCell(new THREE.CylinderGeometry(0.5, 0.5, 1, 12), () => CELLS.wood), lit, tanks);
  staticInstances(K.metal, lit, hulls);
  staticInstances(K.metal, lit, detail);
  staticInstances(toCell(new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2), () => CELLS.cloth), lit, tents);

  // night sky, rain, and the sun/moon direction the presets drive
  const starPos = new Float32Array(420 * 3);
  for (let k = 0; k < 420; k++) {
    const a = rnd() * TAU, el = 0.08 + rnd() * 1.4;
    starPos.set([Math.cos(a) * Math.cos(el) * 420, Math.sin(el) * 420, Math.sin(a) * Math.cos(el) * 420], k * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  VIEW.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  S.add(VIEW.stars);
  VIEW.dropCount = Math.min(innerWidth, innerHeight) < 700 ? 320 : 720;
  VIEW.drops = new Float32Array(VIEW.dropCount * 3);
  for (let k = 0; k < VIEW.dropCount; k++) VIEW.drops.set([(rnd() - 0.5) * 44, rnd() * 23, (rnd() - 0.5) * 44], k * 3);
  VIEW.rain = new Batch(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xc8d6e6, transparent: true, opacity: 0.32, depthWrite: false }), VIEW.dropCount, 8);
  VIEW.sunDir = new THREE.Vector3(-0.5, 1, 0.35).normalize();

  const coverMesh = (geo, mat, cap) => {   // cover, rebuilt per battle
    const m = new THREE.InstancedMesh(geo, mat, cap);
    m.setColorAt(0, new THREE.Color(1, 1, 1));
    m.count = 0;
    S.add(m);
    return m;
  };
  VIEW.props = {
    bags: coverMesh(K.burlap, lit, 600), crates: coverMesh(K.crate, lit, 260),
    drums: coverMesh(toCell(new THREE.CylinderGeometry(0.5, 0.5, 1, 10), () => CELLS.metal), lit, 200),
    cars: coverMesh(K.metal, lit, 640), wood: coverMesh(K.wood, lit, 620), cloth: coverMesh(K.white, lit, 120),
    walls: coverMesh(new THREE.BoxGeometry(1, 1, 1), stoneMat, 420), barriers: coverMesh(jersey, concreteMat, 120),
    basin: coverMesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 18), stoneMat, 8),
    rubble: coverMesh(new THREE.DodecahedronGeometry(0.5, 0), rockMat, 700),
  };
}
const ENVC = {};   // scratch colours for the sky blend
function applyEnv(dt) {
  if (!ENVC.h) for (const k of ['h', 'z', 'grey', 'a']) ENVC[k] = new THREE.Color();
  const t = ((state.tod % 4) + 4) % 4, i = Math.floor(t), f = smooth(0, 1, t - i);
  const A = ENV_PRESETS[i], B = ENV_PRESETS[(i + 1) % 4], W = WEATHER_LOOK[state.weather] || WEATHER_LOOK.clear;
  const num = key => lerp(A[key], B[key], f);
  const mix = (key, out) => out.copy(colorOf(A[key])).lerp(colorOf(B[key]), f);
  if (W.rain && screen === 'battle' && Math.random() < dt * 0.05) {   // lightning, thunder a beat later
    VIEW.flashT = 0.14;
    setTimeout(() => noise({ freq: 70, dur: 1.6, gain: 0.2, type: 'lowpass', q: 0.4, attack: 0.05 }), 400 + Math.random() * 900);
  }
  VIEW.flashT = Math.max(0, (VIEW.flashT || 0) - dt);
  const flash = VIEW.flashT > 0;
  ENVC.grey.copy(colorOf('#8e979e')).multiplyScalar(Math.min(1, num('hemiI') / 1.35));
  mix('horizon', ENVC.h).lerp(ENVC.grey, W.grey);
  mix('zenith', ENVC.z).lerp(ENVC.grey, W.grey * 0.8);
  if (flash) { ENVC.h.lerp(colorOf('#e6ecff'), 0.55); ENVC.z.lerp(colorOf('#c8d2f0'), 0.4); }
  const S = VIEW.scene;
  S.fog.color.copy(ENVC.h);
  S.fog.near = num('fogNear') * W.fogNear;
  S.fog.far = num('fogFar') * W.fogFar;
  S.background.copy(ENVC.h);
  mix('sun', VIEW.sunLight.color);
  VIEW.sunLight.intensity = num('sunI') * W.sunI;
  VIEW.sunDir.set(lerp(A.dir[0], B.dir[0], f), lerp(A.dir[1], B.dir[1], f), lerp(A.dir[2], B.dir[2], f)).normalize();
  VIEW.sunLight.position.copy(VIEW.sunDir);
  mix('hemiSky', VIEW.hemi.color);
  mix('hemiGround', VIEW.hemi.groundColor);
  VIEW.hemi.intensity = num('hemiI') * W.hemiI * (flash ? 2.6 : 1);
  mix('cloud', VIEW.cloudMat.color).lerp(ENVC.grey, W.grey * 0.7);
  VIEW.cloudMat.opacity = W.cloudA;
  mix('mount', VIEW.mountMat.color).lerp(ENVC.h, W.fogFar < 0.5 ? 0.88 : 0.3 + W.grey * 0.4);   // haze always softens the far ranges
  mix('disc', VIEW.sun.material.color);
  const ds = num('discSize');
  VIEW.sun.scale.set(ds, ds, 1);
  VIEW.sun.material.opacity = 1 - W.grey;
  VIEW.stars.material.opacity = num('stars') * (1 - W.grey);
  const col = VIEW.skyGeo.attributes.color, T = VIEW.skyT;
  for (let k = 0; k < T.length; k++) {
    ENVC.a.copy(ENVC.h).lerp(ENVC.z, T[k]);
    col.setXYZ(k, ENVC.a.r, ENVC.a.g, ENVC.a.b);
  }
  col.needsUpdate = true;
  const R = VIEW.rain;   // rain streaks ride along with the camera
  R.begin();
  if (W.rain && screen === 'battle') {
    const cp = VIEW.camera.position, D = VIEW.drops;
    TMP.q.setFromEuler(TMP.e.set(0.18, 0, 0, 'YXZ'));
    for (let k = 0, kn = Math.floor(VIEW.dropCount * Q.rain); k < kn; k++) {
      let y = D[k * 3 + 1] - dt * 19;
      if (y < -1) y += 23;
      D[k * 3 + 1] = y;
      TMP.m.compose(TMP.v2.set(cp.x + D[k * 3], cp.y - 6 + y, cp.z + D[k * 3 + 2]), TMP.q, TMP.s.set(0.02, 0.7, 0.02));
      R.push(TMP.m, WHITE);
    }
    TMP.q.identity();
  }
  R.end();
}
const DEBRIS = [];   // view only: the pieces thrown off cover as it comes apart. No dice from the fight, nothing the fight reads
const DEB = { g: 12, life: 7.5, fade: 0.9, bounce: 0.32, drag: 0.56 };
function debrisBurst(x, y, z, col, heavy) {   // two or three pieces out of the hole, in the cover's own material
  for (let k = 0, n = heavy ? 3 : 2; k < n; k++) {
    const a = fxRand(0, TAU), v = fxRand(0.9, 2.9), s = fxRand(0.09, 0.19);
    DEBRIS.push({ x, y, z, vx: Math.cos(a) * v, vy: fxRand(1.3, 3.3), vz: Math.sin(a) * v,
      sx: s * fxRand(0.7, 1.6), sy: s * fxRand(0.5, 1.1), sz: s * fxRand(0.7, 1.4),
      rx: fxRand(0, TAU), ry: fxRand(0, TAU), rz: fxRand(0, TAU),
      wx: fxRand(-7, 7), wy: fxRand(-5, 5), wz: fxRand(-7, 7), col, t: 0, rest: false });
  }
  const cap = Q.debris || 30;
  while (DEBRIS.length > cap) DEBRIS.shift();
}
function drawDebris(dt) {   // gravity, a bounce, friction, then it settles and shrinks away
  const B = VIEW.fx.debris;
  for (let i = DEBRIS.length - 1; i >= 0; i--) {
    const d = DEBRIS[i];
    d.t += dt;
    if (d.t > DEB.life) { DEBRIS.splice(i, 1); continue; }
    if (!d.rest && dt > 0) {
      d.vy -= DEB.g * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.rx += d.wx * dt; d.ry += d.wy * dt; d.rz += d.wz * dt;
      const floor = d.sy * 0.5;
      if (d.y <= floor) {
        d.y = floor;
        if (d.vy < -1.2) { d.vy = -d.vy * DEB.bounce; d.vx *= DEB.drag; d.vz *= DEB.drag; d.wx *= 0.5; d.wy *= 0.5; d.wz *= 0.5; }
        else {
          const k = Math.exp(-7 * dt);
          d.vy = 0; d.vx *= k; d.vz *= k; d.wx *= k; d.wy *= k; d.wz *= k;
          if (Math.abs(d.vx) + Math.abs(d.vz) < 0.12) { d.rest = true; d.wx = d.wy = d.wz = 0; }
        }
      }
    }
    const f = d.t > DEB.life - DEB.fade ? (DEB.life - d.t) / DEB.fade : 1;
    TMP.e.set(d.rx, d.ry, d.rz, 'XYZ'); TMP.q.setFromEuler(TMP.e);
    TMP.m.compose(TMP.v.set(d.x, d.y, d.z), TMP.q, TMP.s.set(d.sx * f, d.sy * f, d.sz * f));
    B.push(TMP.m, colorOf(d.col));
  }
  TMP.q.identity();
}
function buildProps() {   // every cover piece, drawn battered below half health, plus rubble where cover was destroyed
  propsDirty = false;
  const P = VIEW.props, n = {};
  for (const k in P) n[k] = 0;
  const put = (k, x, y, z, sx, sy, sz, yaw, col) => {
    const mesh = P[k];
    if (n[k] >= mesh.instanceMatrix.count) return;
    TMP.q.setFromAxisAngle(TMP.up, yaw);
    TMP.m.compose(TMP.v.set(x, y, z), TMP.q, TMP.s.set(sx, sy, sz));
    mesh.setMatrixAt(n[k], TMP.m);
    mesh.setColorAt(n[k], colorOf(col));
    n[k]++;
  };
  const putE = (k, x, y, z, sx, sy, sz, yaw, ex, ez, col) => {   // like put, with a tilt: cylinders lying down
    const mesh = P[k];
    if (n[k] >= mesh.instanceMatrix.count) return;
    TMP.e.set(ex, yaw, ez, 'YXZ'); TMP.q.setFromEuler(TMP.e);
    TMP.m.compose(TMP.v.set(x, y, z), TMP.q, TMP.s.set(sx, sy, sz));
    mesh.setMatrixAt(n[k], TMP.m); mesh.setColorAt(n[k], colorOf(col));
    n[k]++;
  };
  for (const ob of obstacles) {
    if (STATIC_COVER.has(ob.kind)) continue;   // drawn once with the town
    const K = COVER_KINDS[ob.kind], X = ob.x * XS, Z = ob.y * XS, yaw = ob.rot90 ? Math.PI / 2 : 0;
    const hurt = ob.maxHp > 0 && ob.hp / ob.maxHp <= 0.5, h = hash2(ob.x, ob.y), HW = (K.hw || 0) * XS, HD = (K.hd || 0) * XS;
    const g = coverGrid(ob), gc = g ? g[0] : 0, gr = g ? g[1] : 0;
    const on = (c, r) => !g || (ob.chunks & (1 << (r * gc + c))) !== 0;   // is that piece of it still standing
    const colOf = lx => clamp(Math.floor((lx / (HW || 1) + 1) / 2 * gc), 0, gc - 1);
    const whole = !g || ob.chunks === (1 << (gc * gr)) - 1;
    if (g && ob._shown !== ob.chunks) {   // pieces that went since this was last drawn throw their debris
      const gone = ob._shown == null ? 0 : ob._shown & ~ob.chunks;
      for (let i = 0; i < gc * gr; i++) if (gone & (1 << i)) {
        const c = i % gc, r = (i / gc) | 0, lx = -HW + (c + 0.5) * (HW * 2 / gc), hy = coverFull(ob) * XS * (r + 0.5) / gr;
        debrisBurst(ob.rot90 ? X : X + lx, hy, ob.rot90 ? Z - lx : Z, MAT_COL[K.mat] || '#999999', K.mat === 'dirt' || K.mat === 'stone');
      }
      ob._shown = ob.chunks;
    }
    const at = (k, lx, y, lz, sx, sy, sz, col, dyaw = 0) =>   // local offsets turn with the piece
      put(k, ob.rot90 ? X + lz : X + lx, y, ob.rot90 ? Z - lx : Z + lz, sx, sy, sz, yaw + dyaw, col);
    const atE = (k, lx, y, lz, sx, sy, sz, col, ex, ez) => putE(k, ob.rot90 ? X + lz : X + lx, y, ob.rot90 ? Z - lx : Z + lz, sx, sy, sz, yaw, ex, ez, col);
    switch (ob.kind) {
      case 'crates': {
        const c = Math.min(HW, HD) * 0.95, cols = ['#8a7a56', '#6e7250', '#7a6a4a'];
        [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].forEach(([a, b], i) => {
          if (on(a < 0 ? 0 : 1, 0)) at('crates', a * c * 1.05, c * 0.5, b * c * 1.05, c, c, c, cols[i % 3], (hash2(i, ob.x) - 0.5) * 0.3);
        });
        const t0 = on(0, 1), t1 = on(1, 1);
        if (t0 || t1) at('crates', (t0 && t1 ? 0 : t0 ? -0.5 : 0.5) * c * 1.05, c * 1.5, 0, c, c, c, '#8a7a56', h);   // the top one shifts onto whatever still holds it
        break;
      }
      case 'sandbags': {
        const per = Math.max(4, Math.round(HW * 2 / 0.46));
        for (let l = 0; l < 3; l++) for (let i = 0; i < per; i++) {
          const lx = -HW + (i + 0.5 + (l % 2) * 0.5) * (HW * 2 / per);
          if (lx < HW && on(colOf(lx), l)) at('bags', lx, 0.12 + l * 0.24, 0, 0.5, 0.24, HD * 2.2, hash2(i, l + ob.x) < 0.5 ? '#c8bc94' : '#b4a87e');
        }
        break;
      }
      case 'barrel': at('drums', 0, 0.5, 0, 0.62, 1.0, 0.62, h < 0.5 ? '#3e5a8a' : '#8a3a2e'); break;
      case 'propane': {
        at('drums', 0, 0.42, 0, 0.5, 0.84, 0.5, '#e2ded2');
        at('cars', 0, 0.9, 0, 0.14, 0.12, 0.14, '#b89a3a');
        break;
      }
      case 'car': case 'van': case 'wreck': case 'vanwreck': {
        const wreck = ob.kind === 'wreck' || ob.kind === 'vanwreck', big = ob.kind === 'van' || ob.kind === 'vanwreck';
        const skew = wreck ? 0.12 : hurt ? 0.05 : 0, hgt = big ? 1.0 : 0.7;
        const body = wreck ? '#2e2a26' : big ? ['#d8d4c8', '#6a7a8a', '#8a6a3a'][(h * 3) | 0] : ['#8a2a22', '#3a5a7a', '#c8c0b0', '#4a5a3a', '#b89a3a'][(h * 5) | 0];
        at('cars', 0, (wreck ? 0.46 : 0.56) + hgt * 0.2, 0, HW * 2, hgt, HD * 2, body, skew);
        at('cars', 0, (wreck ? 1.0 : 1.16) + hgt * 0.25, big ? HD * 0.22 : HD * 0.1, HW * 1.85, big ? 0.9 : 0.55, big ? HD * 1.3 : HD * 1.05, wreck ? '#1e1c1a' : body, skew);
        if (!wreck) at('cars', 0, (big ? 1.5 : 1.22), big ? -HD * 0.5 : HD * 0.1, HW * 1.88, 0.34, big ? HD * 0.4 : HD * 0.95, hurt ? '#3a3e42' : '#1a1e22');
        for (const [a, b] of [[-1, -0.62], [1, -0.62], [-1, 0.62], [1, 0.62]]) at('cars', a * HW * 0.92, 0.3, b * HD, 0.28, 0.6, 0.62, '#151515');
        if (!wreck) { at('cars', -HW * 0.6, 0.72, -HD, 0.3, 0.14, 0.04, '#fff4c8'); at('cars', HW * 0.6, 0.72, -HD, 0.3, 0.14, 0.04, '#fff4c8'); }
        break;
      }
      case 'stall': {
        for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) at('wood', a * (HW - 0.06), 1.05, b * (HD - 0.06), 0.08, 2.1, 0.08, '#6a4e32');
        at('wood', 0, 0.85, 0, HW * 1.9, 0.1, HD * 1.8, '#8a6a44');
        at('crates', -HW * 0.4, 1.1, 0, 0.4, 0.4, 0.4, '#8a7a56'); at('crates', HW * 0.35, 1.05, 0.1, 0.3, 0.3, 0.3, '#6e7250');
        if (!hurt) {
          at('cloth', 0, 2.15, -HD * 0.5, HW * 2.2, 0.06, HD * 1.1, ['#b83a2a', '#2a6a8a', '#c89a2a'][(h * 3) | 0]);
          at('cloth', 0, 2.1, HD * 0.5, HW * 2.2, 0.06, HD * 1.1, '#e8e0d0');
        }
        break;
      }
      case 'wall': {
        const bw = HW * 2 / gc, bh = 1.04 / gr;
        for (let c = 0; c < gc; c++) {
          const cx = -HW + (c + 0.5) * bw;
          for (let r = 0; r < gr; r++)
            if (on(c, r)) at('walls', cx, (r + 0.5) * bh, 0, bw - 0.03, bh - 0.02, HD * 2, hash2(c, r + ob.x) < 0.4 ? '#efe9dd' : '#ffffff');
          if (on(c, gr - 1)) at('walls', cx, 1.07, 0, bw + 0.02, 0.1, HD * 2 + 0.12, '#d8d2c4');
        }
        break;
      }
      case 'barrier':
        for (let j = 0; j < gc; j++) {
          if (!on(j, 0)) continue;
          const askew = (j > 0 && !on(j - 1, 0)) || (j < gc - 1 && !on(j + 1, 0)) ? 0.22 : 0;   // shoved out of line where the next one went
          at('barriers', (j - 1) * HW * 0.67, 0.45, 0, 0.62, 0.9, HW * 0.66, '#ffffff', Math.PI / 2 + askew);
        }
        break;
      case 'fence': {
        const per = Math.max(2, Math.round(HW * 2 / 0.6));
        for (let i = 0; i <= per; i++) {
          const lx = -HW + i * (HW * 2 / per);
          if (on(colOf(lx), 0)) at('wood', lx, 0.5, 0, 0.08, 1.0, 0.08, '#8a6a44', whole ? 0 : (hash2(i, ob.x) - 0.5) * 0.5);
        }
        for (let c = 0; c < gc; c++) if (on(c, 0)) {   // the rails run only where the palings still stand
          const cw = HW * 2 / gc, cx = -HW + (c + 0.5) * cw;
          at('wood', cx, 0.78, 0, cw, 0.08, 0.05, '#9a7a50'); at('wood', cx, 0.36, 0, cw, 0.08, 0.05, '#9a7a50');
        }
        break;
      }
      case 'dumpster': {
        at('cars', 0, 0.62, 0, HW * 2, 1.24, HD * 2, '#3a5a3a');
        at('cars', 0, 1.28, hurt ? -HD * 0.3 : 0, HW * 2.05, 0.08, HD * 2.1, '#2e4a30', hurt ? 0.25 : 0);
        for (const a of [-1, 1]) at('cars', a * HW * 0.8, 0.1, HD * 0.7, 0.16, 0.2, 0.16, '#1a1a18');
        break;
      }
      case 'woodpile': {
        for (let l = 0; l < gr; l++) for (let i = 0; i < gc; i++)
          if (on(i, l)) at('wood', -HW + (i + 0.5) * (HW * 2 / gc), 0.16 + l * 0.3, (l % 2) * 0.06, HW * 0.6, 0.28, HD * 2, hash2(i, l + ob.y) < 0.5 ? '#9a7448' : '#7a5a38');
        break;
      }
      case 'planter': {
        at('walls', 0, 0.3, 0, HW * 2, 0.6, HD * 2, '#ffffff');
        if (!hurt) {
          at('cloth', 0, 0.72, 0, HW * 1.8, 0.24, HD * 1.7, '#5a8a3a');
          at('cloth', -HW * 0.4, 0.86, 0, 0.16, 0.12, 0.16, '#c84a5a'); at('cloth', HW * 0.45, 0.86, HD * 0.3, 0.16, 0.12, 0.16, '#d8c43a');
        }
        break;
      }
      case 'pump': {   // a fuel pump on its island: curb, body, display, hose
        at('walls', 0, 0.1, 0, HW * 2.6, 0.2, HD * 2.6, '#d8d4c8');
        at('cars', 0, 0.95, 0, HW * 1.6, 1.5, HD * 1.4, hurt ? '#6a3a2a' : '#d8342a');
        at('cars', 0, 1.35, -HD * 0.72, HW * 1.3, 0.4, 0.04, '#10161c');
        at('cars', 0, 1.8, 0, HW * 1.7, 0.18, HD * 1.5, '#f2eee6');
        at('cars', HW * 0.85, 0.9, 0, 0.05, 0.9, 0.05, '#1a1a1a');
        break;
      }
      case 'tanker': case 'tankwreck': {   // a fuel tanker: chassis, cab, the tank lying along it
        const wreck = ob.kind === 'tankwreck';
        at('cars', 0, 0.7, 0, HW * 1.9, 0.4, HD * 2, '#1e1e1e');
        at('cars', 0, 1.6, -HD * 0.78, HW * 2, 1.7, HD * 0.42, wreck ? '#2a2622' : '#e8e4dc');
        if (!wreck) at('cars', 0, 1.95, -HD * 0.99, HW * 1.7, 0.6, 0.05, '#1e2a34');
        atE('drums', 0, 1.9, HD * 0.2, HW * 1.95, HD * 1.5, HW * 1.95, wreck ? '#2e2a26' : '#c8ccd0', Math.PI / 2, 0);
        for (const [a, b] of [[-1, -0.7], [1, -0.7], [-1, 0.25], [1, 0.25], [-1, 0.75], [1, 0.75]]) at('cars', a * HW * 0.95, 0.45, b * HD, 0.35, 0.9, 0.9, '#141414');
        break;
      }
      case 'logs': {   // a log pile: rows of trunks lying along it
        for (let l = 0; l < (hurt ? 2 : 3); l++) for (let i = 0; i < 3 - l; i++)
          atE('drums', 0, 0.22 + l * 0.38, (i - (2 - l) / 2) * 0.42, 0.44, HW * 2, 0.44, hash2(i, l + ob.x) < 0.5 ? '#8a6038' : '#7a5230', 0, Math.PI / 2);
        break;
      }
      case 'mixer': {   // a cement mixer: frame and a tilted orange drum
        at('cars', 0, 0.5, 0, 1.0, 0.18, 1.6, '#3a3a38');
        atE('drums', 0, 1.1, 0.1, 1.1, 1.2, 1.1, hurt ? '#6a4a2a' : '#e07a28', 0.6, 0);
        at('cars', 0, 0.3, -0.6, 0.12, 0.6, 0.12, '#2a2a28');
        break;
      }
      case 'toilet':
        at('cars', 0, 1.1, 0, HW * 2, 2.2, HD * 2, hurt ? '#2a3a4a' : '#2a6aa8');
        at('cars', 0, 2.28, 0, HW * 2.1, 0.12, HD * 2.1, '#e8e4dc');
        at('cars', 0, 1.1, -HD - 0.02, HW * 1.4, 1.9, 0.04, '#1e4a7a');
        break;
      case 'bench':
        at('wood', 0, 0.45, 0, HW * 2, 0.08, 0.42, '#8a6a44');
        at('wood', 0, 0.8, 0.18, HW * 2, 0.4, 0.06, '#7a5a38');
        for (const a of [-0.8, 0.8]) at('cars', a * HW, 0.22, 0, 0.08, 0.44, 0.4, '#2a2a28');
        break;
      case 'table':
        at('wood', 0, 0.74, 0, 0.8, 0.05, 0.8, '#e8e2d0');
        at('cars', 0, 0.37, 0, 0.06, 0.74, 0.06, '#3a3a38');
        if (!hurt) { at('cars', 0, 1.3, 0, 0.05, 1.2, 0.05, '#3a3a38'); at('cloth', 0, 2.0, 0, 2.2, 0.1, 2.2, h < 0.5 ? '#c8382a' : '#2a6a8a'); }
        break;
      case 'fountain': {
        const R = ob.r * XS;
        at('basin', 0, 0.3, 0, R * 2, 0.6, R * 2, '#ffffff');
        at('basin', 0, 0.62, 0, R * 1.8, 0.06, R * 1.8, hurt ? '#6a6a60' : '#5a8aa0');
        if (!hurt) { at('basin', 0, 1.0, 0, 0.4, 1.4, 0.4, '#e8e2d6'); at('basin', 0, 1.7, 0, 1.1, 0.2, 1.1, '#e8e2d6'); }
        break;
      }
    }
  }
  for (const rb of rubble) {   // what's left where cover used to be
    const col = MAT_COL[rb.mat] || '#999999', HW = rb.hw * XS, HD = rb.hd * XS;
    for (let i = 0; i < 7; i++) {
      const a = hash2(rb.seed, i), b = hash2(i, rb.seed), s = 0.18 + hash2(rb.seed + i, 3) * 0.3;
      put('rubble', rb.x * XS + (a - 0.5) * HW * 2, s * 0.25, rb.y * XS + (b - 0.5) * HD * 2, s * 1.4, s * 0.7, s, a * TAU, i % 3 ? col : '#5a5048');
    }
  }
  for (const k in P) {
    P[k].count = n[k];
    P[k].instanceMatrix.needsUpdate = true;
    P[k].boundingSphere = null;   // the pieces moved: work out again what this batch covers, or the culling drops it from a whole angle
    if (P[k].instanceColor) P[k].instanceColor.needsUpdate = true;
  }
}
function updateSky(dt) {
  const cp = VIEW.camera.position;
  VIEW.sky.position.copy(cp);
  VIEW.stars.position.copy(cp);
  VIEW.clouds.position.set(cp.x, 0, cp.z);
  VIEW.clouds.rotation.y += dt * 0.004;
  TMP.q.copy(VIEW.clouds.quaternion).invert().multiply(VIEW.camera.quaternion);
  for (const m of VIEW.clouds.children) m.quaternion.copy(TMP.q);
  VIEW.sun.position.copy(cp).addScaledVector(VIEW.sunDir, 390);
  VIEW.sun.quaternion.copy(VIEW.camera.quaternion);
  TMP.q.identity();
}

