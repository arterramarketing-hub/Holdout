// ---------- geometry kit: tapered, faceted unit primitives with atlas UVs and baked shading ----------
function toCell(geo, cellOf) {
  const uv = geo.attributes.uv, inner = (CELL - 2 * PAD) / ATLAS;
  for (let i = 0; i < uv.count; i++) {
    const c = cellOf(i);
    const u0 = ((c % COLS) * CELL + PAD) / ATLAS, v0 = (((c / COLS) | 0) * CELL + PAD) / ATLAS;
    uv.setXY(i, u0 + uv.getX(i) * inner, 1 - (v0 + (1 - uv.getY(i)) * inner));
  }
  return geo;
}
function shadeGeo(geo, lo) {   // baked N64-style shading: every piece darkens toward its base
  const p = geo.attributes.position, box = new THREE.Box3().setFromBufferAttribute(p), h = box.max.y - box.min.y || 1;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = lerp(lo, 1, (p.getY(i) - box.min.y) / h);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function lathe(points, seg) {   // [radius, y] pairs bottom → top, radius ≤ 0.5, y in −0.5..0.5
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(Math.max(0.001, r), y)), seg);
}
function latheLimb(top, bottom, seg) {   // capsule-like limb: rounded ends, gentle taper, no hard joints
  const pts = [], cap = 0.18, n = 3;
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; pts.push([Math.sin(a) * bottom, -0.5 + cap * (1 - Math.cos(a))]); }
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; pts.push([Math.cos(a) * top, 0.5 - cap * (1 - Math.sin(a))]); }
  return lathe(pts, seg);
}
function superBall(p, w = 10, h = 7) {   // rounded box: a sphere pushed out toward a cube (p = squareness)
  const g = new THREE.SphereGeometry(0.5, w, h), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), len = Math.hypot(x, y, z) || 1;
    const dx = x / len, dy = y / len, dz = z / len;
    const t = 0.5 / Math.pow(Math.abs(dx) ** p + Math.abs(dy) ** p + Math.abs(dz) ** p, 1 / p);
    pos.setXYZ(i, dx * t, dy * t, dz * t);
  }
  g.computeVertexNormals();
  return g;
}
function bootShape() {   // rounded boot with a flat sole
  const g = superBall(3, 10, 7), pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, Math.max(pos.getY(i), -0.35) - 0.15);
  g.computeVertexNormals();
  return g;
}
function buildKit() {
  const C = CELLS;
  // BoxGeometry face order: +x, −x, +y, −y, +z, −z (models face −Z, so −z is the front)
  const cell = (geo, c) => toCell(geo, typeof c === 'number' ? () => c : i => c[(i / 4) | 0]);
  const box = c => cell(new THREE.BoxGeometry(1, 1, 1), c);
  const tube = (rt, rb, seg, c) => cell(new THREE.CylinderGeometry(rt, rb, 1, seg), c);
  const ball = (w, h, c) => cell(new THREE.SphereGeometry(0.5, w, h), c);
  const kit = {
    cloth: box(C.coat), skin: box(C.skin), metal: box(C.metal), wood: box(C.wood), burlap: box(C.burlap),
    leather: box(C.leather), hide: box(C.hide), stone: box(C.stone), white: box(C.white), webbing: box(C.webbing), crate: box(C.crate),
    hood: cell(superBall(3), C.hood), cape: cell(superBall(4), C.cape),
    head: ball(14, 10, C.face), mask: ball(14, 10, C.mask), hand: ball(8, 6, C.skin), joint: ball(8, 6, C.coat),
    helm: cell(new THREE.SphereGeometry(0.5, 16, 6, 0, TAU, 0, Math.PI / 2), C.helm),
    disc: tube(0.5, 0.5, 18, C.helm), band: tube(0.5, 0.5, 16, C.coat), cyl: tube(0.5, 0.5, 10, C.metal),
    cone: cell(new THREE.ConeGeometry(0.5, 1, 10), C.white),
    limb: cell(latheLimb(0.5, 0.4, 8), C.coat), legp: cell(latheLimb(0.5, 0.42, 8), C.pants), puttee: cell(latheLimb(0.46, 0.36, 8), C.puttee),
    torso: cell(lathe([[0, -0.5], [0.42, -0.5], [0.44, -0.3], [0.48, -0.05], [0.5, 0.15], [0.48, 0.3], [0.4, 0.42], [0.22, 0.49], [0, 0.5]], 10), C.coatFront),
    skirt: cell(lathe([[0, -0.5], [0.5, -0.5], [0.48, -0.2], [0.43, 0.2], [0.38, 0.5], [0, 0.5]], 12), C.coat),
    boot: cell(bootShape(), C.leather), taper: cell(superBall(3.2), C.coat),
    hidebody: cell(lathe([[0, -0.5], [0.3, -0.48], [0.45, -0.3], [0.5, 0], [0.46, 0.3], [0.34, 0.46], [0, 0.5]], 10), C.hide),
    hidelimb: cell(latheLimb(0.5, 0.32, 7), C.hide),
  };
  kit.palm = cell(superBall(3, 8, 6), C.leather);           // glove pieces: plain leather, not the camo cell
  kit.fing = cell(latheLimb(0.5, 0.42, 6), C.leather);
  for (const k in kit) shadeGeo(kit[k], k === 'head' || k === 'mask' || k === 'hand' || k === 'palm' || k === 'fing' ? 0.84 : 0.68);
  return kit;
}
const PART_KEYS = ['cloth', 'skin', 'metal', 'wood', 'burlap', 'leather', 'hide', 'stone', 'white', 'hood', 'cape', 'webbing',
  'crate', 'head', 'mask', 'hand', 'joint', 'helm', 'disc', 'band', 'cyl', 'cone', 'limb', 'legp', 'puttee', 'torso', 'skirt', 'boot',
  'taper', 'hidebody', 'hidelimb', 'palm', 'fing'];

// ---------- instance batches ----------
class Batch {
  constructor(geo, mat, cap, order) {
    this.cap = cap; this.n = 0; this.warned = false;
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    if (order) this.mesh.renderOrder = order;
    VIEW.scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  push(m, c) {
    if (this.n >= this.cap) {
      if (!this.warned) { this.warned = true; console.warn('Holdout: instance batch full', this.cap); }
      return;
    }
    this.mesh.setMatrixAt(this.n, m);
    this.mesh.setColorAt(this.n, c);
    this.n++;
  }
  end() {
    const im = this.mesh.instanceMatrix, ic = this.mesh.instanceColor;
    this.mesh.count = this.n;
    im.clearUpdateRanges(); im.addUpdateRange(0, this.n * 16); im.needsUpdate = true;
    ic.clearUpdateRanges(); ic.addUpdateRange(0, this.n * 3); ic.needsUpdate = true;
  }
}
function makePartBatches(capCloth, capOther) {
  const set = {};
  for (const k of PART_KEYS) set[k] = new Batch(VIEW.kit[k], VIEW.mats.shaded, k === 'limb' || k === 'band' || k === 'metal' ? capCloth : capOther);
  set.glow = new Batch(new THREE.BoxGeometry(1, 1, 1), VIEW.mats.unlit, capOther);
  return set;
}
const batchesDo = (set, fn) => { for (const k in set) fn(set[k]); };

// ---------- colour parsing (rgba() strings would warn inside THREE.Color) ----------
const colorCache = new Map();
function colorOf(str) {
  let c = colorCache.get(str);
  if (c) return c;
  c = new THREE.Color();
  const m = /^rgba?\(([^)]+)\)$/.exec(str);
  if (m) {
    const p = m[1].split(',').map(Number);
    c.setRGB(p[0] / 255, p[1] / 255, p[2] / 255, THREE.SRGBColorSpace);
  } else c.setStyle(str);
  colorCache.set(str, c);
  return c;
}

// ---------- skeletons ----------
// Humanoid, ~1.8 m tall, facing −Z. Joint rest offsets are relative to the parent.
const HJ = { root: 0, pelvis: 1, torso: 2, head: 3, uArmL: 4, fArmL: 5, uArmR: 6, fArmR: 7,
  thighL: 8, shinL: 9, thighR: 10, shinR: 11, gun: 12 };
const HUMANOID = [
  [-1, 0, 0, 0], [0, 0, 0.8, 0], [1, 0, 0.06, 0], [2, 0, 0.54, 0],
  [2, -0.27, 0.46, 0], [4, 0, -0.3, 0], [2, 0.27, 0.46, 0], [6, 0, -0.3, 0],
  [1, -0.12, 0, 0], [8, 0, -0.4, 0], [1, 0.12, 0, 0], [10, 0, -0.4, 0],
  [7, 0, -0.27, -0.02],
];
const HOJ = { root: 0, body: 1, neck: 2, head: 3, legFL: 4, legFR: 5, legBL: 6, legBR: 7, tail: 8, saddle: 9 };
const HORSE = [   // mount skeleton, now a quad bike: body, handlebar, headlight, four wheel hubs, rear rack, seat
  [-1, 0, 0, 0], [0, 0, 0.62, 0], [1, 0, 0.3, -0.52], [2, 0, 0.02, -0.12],
  [1, -0.42, -0.28, -0.56], [1, 0.42, -0.28, -0.56], [1, -0.42, -0.28, 0.5], [1, 0.42, -0.28, 0.5],
  [1, 0, 0.18, 0.62], [1, 0, 0.28, 0.08],
];

// Part rows: [joint, geoKey, sx, sy, sz, ox, oy, oz, colourSlot, rx?, ry?, rz?]
const P = (j, g, sx, sy, sz, ox, oy, oz, col, rx = 0, ry = 0, rz = 0) => [j, g, sx, sy, sz, ox, oy, oz, col, rx, ry, rz];
const MAG = r => { r.mag = true; return r; };   // marks a gun part as the magazine, so a reload can take it out of the gun
const ARMS = (coat, hand) => [
  P(HJ.uArmL, 'joint', 0.18, 0.18, 0.18, 0, -0.01, 0, coat), P(HJ.uArmR, 'joint', 0.18, 0.18, 0.18, 0, -0.01, 0, coat),
  P(HJ.uArmL, 'limb', 0.15, 0.32, 0.15, 0, -0.14, 0, coat), P(HJ.uArmR, 'limb', 0.15, 0.32, 0.15, 0, -0.14, 0, coat),
  P(HJ.fArmL, 'limb', 0.13, 0.28, 0.13, 0, -0.13, 0, coat), P(HJ.fArmR, 'limb', 0.13, 0.28, 0.13, 0, -0.13, 0, coat),
  ...[[HJ.fArmL, 1], [HJ.fArmR, -1]].flatMap(([j, s]) => [   // s: which side the thumb sits on
    P(j, 'band', 0.112, 0.04, 0.112, 0, -0.26, 0, 'webbing'),                        // glove cuff
    P(j, 'palm', 0.098, 0.1, 0.064, 0, -0.314, 0.004, hand),                          // palm and the back of the hand
    P(j, 'palm', 0.092, 0.068, 0.054, 0, -0.374, -0.018, hand, 0.55),                  // fingers, curled forward
    P(j, 'fing', 0.034, 0.072, 0.034, s * 0.047, -0.302, -0.03, hand, 0.55, 0, s * 0.4),   // thumb
  ]),
];
const SOLDIER_BODY = [   // modern infantry: camo uniform, plate carrier, ballistic helmet with NVG mount and ear pro; roster colour on the patches
  P(HJ.pelvis, 'legp', 0.36, 0.24, 0.27, 0, 0.02, 0, 'pants'),
  P(HJ.pelvis, 'band', 0.4, 0.08, 0.3, 0, 0.1, 0, 'carrier'),
  P(HJ.pelvis, 'webbing', 0.12, 0.13, 0.1, 0.12, 0.02, 0.16, 'pouch'),
  P(HJ.torso, 'torso', 0.44, 0.52, 0.31, 0, 0.26, 0, 'coat'),
  P(HJ.torso, 'webbing', 0.4, 0.34, 0.07, 0, 0.3, -0.155, 'carrier'),
  P(HJ.torso, 'webbing', 0.4, 0.36, 0.07, 0, 0.3, 0.155, 'carrier'),
  P(HJ.torso, 'band', 0.47, 0.14, 0.34, 0, 0.16, 0, 'carrier'),
  P(HJ.torso, 'webbing', 0.07, 0.1, 0.3, -0.13, 0.5, 0, 'carrier'), P(HJ.torso, 'webbing', 0.07, 0.1, 0.3, 0.13, 0.5, 0, 'carrier'),
  ...[-0.1, 0, 0.1].map(x => P(HJ.torso, 'webbing', 0.085, 0.13, 0.06, x, 0.24, -0.2, 'pouch')),
  P(HJ.torso, 'taper', 0.28, 0.3, 0.13, 0, 0.3, 0.26, 'pack'),
  P(HJ.torso, 'metal', 0.015, 0.42, 0.015, 0.1, 0.62, 0.26, 'gunm'),
  P(HJ.torso, 'band', 0.2, 0.08, 0.2, 0, 0.53, -0.01, 'gaiter'),
  P(HJ.head, 'head', 0.3, 0.34, 0.31, 0, 0.14, 0, 'skin'),
  P(HJ.head, 'cloth', 0.24, 0.05, 0.04, 0, 0.15, -0.15, 'lens'),
  P(HJ.head, 'helm', 0.4, 0.3, 0.44, 0, 0.2, 0.01, 'helm'),
  P(HJ.head, 'metal', 0.03, 0.05, 0.22, -0.2, 0.22, 0.01, 'gunm'), P(HJ.head, 'metal', 0.03, 0.05, 0.22, 0.2, 0.22, 0.01, 'gunm'),
  P(HJ.head, 'metal', 0.09, 0.07, 0.05, 0, 0.29, -0.19, 'gunm'),
  P(HJ.head, 'cyl', 0.1, 0.06, 0.12, -0.17, 0.12, 0, 'gunm', 0, 0, Math.PI / 2), P(HJ.head, 'cyl', 0.1, 0.06, 0.12, 0.17, 0.12, 0, 'gunm', 0, 0, Math.PI / 2),
  P(HJ.head, 'cloth', 0.07, 0.07, 0.02, 0, 0.27, 0.195, 'scarf'),
  ...ARMS('coat', 'glove'),
  P(HJ.uArmL, 'cloth', 0.02, 0.08, 0.08, -0.08, -0.08, 0, 'scarf'),
  P(HJ.thighL, 'legp', 0.17, 0.4, 0.18, 0, -0.19, 0, 'pants'), P(HJ.thighR, 'legp', 0.17, 0.4, 0.18, 0, -0.19, 0, 'pants'),
  P(HJ.thighR, 'webbing', 0.06, 0.16, 0.12, 0.1, -0.12, 0, 'pouch'),
  P(HJ.shinL, 'puttee', 0.15, 0.32, 0.16, 0, -0.15, 0, 'pants'), P(HJ.shinR, 'puttee', 0.15, 0.32, 0.16, 0, -0.15, 0, 'pants'),
  P(HJ.shinL, 'taper', 0.15, 0.13, 0.07, 0, -0.03, -0.085, 'pad'), P(HJ.shinR, 'taper', 0.15, 0.13, 0.07, 0, -0.03, -0.085, 'pad'),
  P(HJ.shinL, 'boot', 0.16, 0.13, 0.27, 0, -0.335, -0.045, 'boots'), P(HJ.shinR, 'boot', 0.16, 0.13, 0.27, 0, -0.335, -0.045, 'boots'),
];
const SOLDIER_ARMOR = [   // body armour upgrade: deltoid plates and a throat guard
  P(HJ.uArmL, 'cape', 0.2, 0.14, 0.2, -0.02, 0, 0, 'carrier', 0, 0, 0.25), P(HJ.uArmR, 'cape', 0.2, 0.14, 0.2, 0.02, 0, 0, 'carrier', 0, 0, -0.25),
  P(HJ.torso, 'band', 0.24, 0.07, 0.24, 0, 0.47, -0.02, 'carrier'),
];
const WREN_SCARF = [P(HJ.torso, 'cloth', 0.09, 0.3, 0.05, 0.11, 0.34, -0.2, 'gaiter', 0.15)];
