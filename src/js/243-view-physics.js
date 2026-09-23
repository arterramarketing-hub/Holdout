// ============================================================ PHYSICS — cannon-es, and only ever in the view
// The fight keeps its own rules: what cover is left, where a round goes, what the AI can see, where anyone can walk.
// Physics owns what the fight never reads — the pieces knocked off cover, the bodies that fall, and whatever a blast
// throws — so nothing here can change a seeded fight, and the game is whole without it: if the engine never loads,
// deaths play their canned falls and cover loses its pieces without throwing them.
//
// One world per battle: a ground plane, a static box for every building, and a static box for every piece of cover
// still standing (one per standing column, so a blown gap is a gap here too). Stepped at a fixed 1/120 s from an
// accumulator on world time, so slow motion slows the physics with everything else.
const CANNON_URL = 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.js';
let CANNON = null, physReady = null;
const PHYS = {
  ready: false, failed: false, world: null, acc: 0, ms: 0,
  step: 1 / 60, maxSteps: 4,   // a frame longer than 66 ms loses the rest: slow, never a spiral
  iters: { high: 10, medium: 8, low: 6, saver: 4 },
  cover: new Map(),   // obstacle id → { sig, bodies }: rebuilt only for the pieces that changed
  coverDirty: true,
  ground: null,
};
const PIECES = [];   // what is lying about the street, oldest first
const PHYS_LIMB = 2;   // the collision group ragdoll limbs are in
const PMAT = {       // how each material lands: density kg/m³, friction, bounce
  dirt: { d: 1100, f: 0.78, r: 0.02 }, stone: { d: 1900, f: 0.62, r: 0.09 }, concrete: { d: 2000, f: 0.62, r: 0.09 },
  wood: { d: 620, f: 0.52, r: 0.2 }, metal: { d: 1200, f: 0.42, r: 0.18 }, leaf: { d: 320, f: 0.85, r: 0.04 },
};
const PIECE_FADE = 0.45;   // seconds an evicted piece takes to shrink away
const PIECE_SPIN = 18;     // rad/s: the fastest anything loose may turn
function loadPhysics() {
  physReady = import(CANNON_URL)
    .then(m => { CANNON = m; PHYS.ready = true; if (screen === 'battle') physBuildWorld(); })
    .catch(err => { PHYS.failed = true; console.warn('physics engine offline — canned falls only', err); });
  return physReady;
}
const physOn = () => PHYS.ready && PHYS.world !== null;

// ---------- the world ----------
function physBody(x, y, z, mass, shape, mat) {
  const m = PMAT[mat] || PMAT.stone;
  const b = new CANNON.Body({
    mass, shape, position: new CANNON.Vec3(x, y, z),
    material: new CANNON.Material({ friction: m.f, restitution: m.r }),
    allowSleep: true, sleepSpeedLimit: 0.2, sleepTimeLimit: 0.3,   // a piece that has all but stopped goes to sleep and costs nothing
    linearDamping: 0.04, angularDamping: 0.3,
  });
  PHYS.world.addBody(b);
  return b;
}
const physStatic = (x, y, z, hx, hy, hz, mat) => physBody(x, y, z, 0, new CANNON.Box(new CANNON.Vec3(hx, hy, hz)), mat);
function physColumn(ob) {   // static boxes for one piece of cover: one per standing column, none where it was shot away
  const out = [], mat = COVER_KINDS[ob.kind].mat, top = coverTop(ob) * XS;
  if (top <= 0) return out;
  if (ob.shape === 'c') {
    const r = ob.r * XS;
    out.push(physBody(ob.x * XS, top / 2, ob.y * XS, 0, new CANNON.Cylinder(r, r, top, 10), mat));
    return out;
  }
  const g = coverGrid(ob);
  if (!g) { out.push(physStatic(ob.x * XS, top / 2, ob.y * XS, ob.hw * XS, top / 2, ob.hd * XS, mat)); return out; }
  const full = coverFull(ob) * XS;
  for (let c = 0; c < g[0]; c++) {
    const r = chunkStack(ob, g, c);
    if (r < 0) continue;
    chunkBox(ob, g, c, CHUNKB);
    const h = full * (r + 1) / g[1];
    out.push(physStatic((CHUNKB.x0 + CHUNKB.x1) / 2 * XS, h / 2, (CHUNKB.y0 + CHUNKB.y1) / 2 * XS,
      (CHUNKB.x1 - CHUNKB.x0) / 2 * XS, h / 2, (CHUNKB.y1 - CHUNKB.y0) / 2 * XS, mat));
  }
  return out;
}
const physSig = ob => ob.kind + '|' + (ob.chunks == null ? 'w' : ob.chunks) + '|' + Math.round(ob.x) + ',' + Math.round(ob.y);
function physSyncCover() {   // only the cover that changed is rebuilt
  if (!physOn()) return;
  const seen = new Set();
  for (const ob of obstacles) {
    seen.add(ob.id);
    const sig = physSig(ob), had = PHYS.cover.get(ob.id);
    if (had && had.sig === sig) continue;
    if (had) for (const b of had.bodies) PHYS.world.removeBody(b);
    PHYS.cover.set(ob.id, { sig, bodies: physColumn(ob) });
  }
  for (const [id, rec] of PHYS.cover) {
    if (seen.has(id)) continue;
    for (const b of rec.bodies) PHYS.world.removeBody(b);
    PHYS.cover.delete(id);
  }
}
function physBuildWorld() {   // a fresh world for a fresh town
  if (!PHYS.ready) return;
  PIECES.length = 0;
  PHYS.cover.clear();
  PHYS.acc = 0;
  const W = PHYS.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.81, 0) });
  W.broadphase = new CANNON.SAPBroadphase(W);
  W.allowSleep = true;
  W.defaultContactMaterial.friction = 0.6;
  W.defaultContactMaterial.restitution = 0.06;
  W.solver.iterations = PHYS.iters[Q.level] || 8;
  PHYS.ground = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: new CANNON.Material({ friction: 0.8, restitution: 0.04 }) });
  PHYS.ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  W.addBody(PHYS.ground);
  for (const b of buildings) physStatic(b.x * XS, b.top * XS / 2, b.y * XS, b.hw * XS, b.top * XS / 2, b.hd * XS, 'stone');
  physSyncCover();
}
function physStep(dt) {   // fixed steps on world time; slow motion slows the world with it
  if (!physOn()) return;
  if (PHYS.coverDirty) { PHYS.coverDirty = false; physSyncCover(); }
  const W = PHYS.world, t0 = performance.now();
  W.solver.iterations = PHYS.iters[Q.level] || 8;
  PHYS.acc = Math.min(PHYS.acc + dt, PHYS.step * PHYS.maxSteps);
  while (PHYS.acc >= PHYS.step) { W.step(PHYS.step); PHYS.acc -= PHYS.step; }
  PHYS.last = performance.now() - t0;
  PHYS.ms = PHYS.ms * 0.9 + PHYS.last * 0.1;
}

// ---------- blasts ----------
function physBlasts() {   // whatever went off since the last frame pushes the loose world about, and throws the settled dead again
  if (!BLASTS.length) return;
  if (physOn()) for (const bl of BLASTS) { physBlast(bl); wakeCorpses(bl); }
  BLASTS.length = 0;
}
function physBlast(bl) {   // out from the blast and up, with falloff; a jersey segment moves a fifth as much as a sandbag
  const x = bl.x * XS, z = bl.y * XS, y = (bl.z || 0) * XS, R = bl.r * XS * 1.3, P = clamp(bl.r / 16, 4, 11);
  for (const b of PHYS.world.bodies) {
    if (!(b.mass > 0)) continue;
    const dx = b.position.x - x, dy = b.position.y - y, dz = b.position.z - z, d = Math.hypot(dx, dy, dz);
    if (d > R) continue;
    const f = 1 - d / R, k = f * P / Math.sqrt(Math.max(1, b.mass / 40)), n = d || 1;
    b.velocity.x += dx / n * k; b.velocity.y += Math.max(0.35, dy / n + 0.5) * k; b.velocity.z += dz / n * k;
    b.angularVelocity.x += fxRand(-4, 4) * f; b.angularVelocity.y += fxRand(-2, 2) * f; b.angularVelocity.z += fxRand(-4, 4) * f;
    b.wakeUp();
  }
}

// ---------- loose pieces ----------
function physPiece(x, y, z, sx, sy, sz, col, mat, batch, yaw, drum) {   // a piece of cover loose in the world, drawn as the thing it was
  if (!physOn()) return null;
  const m = PMAT[mat] || PMAT.stone;
  const shape = drum ? new CANNON.Cylinder(sx / 2, sx / 2, sy, 10) : new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2));
  const body = physBody(x, y, z, Math.max(0.4, sx * sy * sz * m.d * (drum ? 0.08 : 1)), shape, mat);   // a drum that has gone up is an empty shell
  if (yaw) body.quaternion.setFromEuler(0, yaw, 0);
  const p = { body, col, sx, sy, sz, batch: batch || 'debris', t: 0, fade: 0, life: batch ? 0 : fxRand(4, 6) };   // grit shrinks away; the pieces themselves stay as rubble
  PIECES.push(p);
  const cap = Q.debris || 30;
  for (let i = 0; i < PIECES.length - cap; i++) if (!PIECES[i].fade) PIECES[i].fade = PIECE_FADE;   // the oldest shrink away
  return p;
}
function physThrow(p, vx, vy, vz, spin) {
  if (!p) return p;
  p.body.velocity.set(vx, vy, vz);
  p.body.angularVelocity.set(fxRand(-spin, spin), fxRand(-spin, spin), fxRand(-spin, spin));
  p.body.wakeUp();
  return p;
}
function physDropPiece(p) {
  const i = PIECES.indexOf(p);
  if (i >= 0) PIECES.splice(i, 1);
  if (p && p.body && PHYS.world) PHYS.world.removeBody(p.body);
}
function drawPieces(dt) {   // everything loose, drawn from the body it is
  if (!physOn()) return;
  for (let i = PIECES.length - 1; i >= 0; i--) {
    const p = PIECES[i], b = p.body;
    p.t += dt;
    if (p.t > 3 && b.sleepSpeedLimit < 0.45) b.sleepSpeedLimit = 0.45;   // three seconds on, what is left is wedged jitter: let it sleep (a blast still wakes it)
    if (p.life && p.t > p.life && !p.fade) p.fade = PIECE_FADE;
    const w = b.angularVelocity, ws = w.x * w.x + w.y * w.y + w.z * w.z;
    if (ws > PIECE_SPIN * PIECE_SPIN) w.scale(PIECE_SPIN / Math.sqrt(ws), w);   // a chip caught between two things can spin itself up: never past this
    let k = 1;
    if (p.fade) {
      p.fade -= dt;
      if (p.fade <= 0) { physDropPiece(p); continue; }
      k = p.fade / PIECE_FADE;
    }
    const B = (VIEW.loose && VIEW.loose[p.batch]) || VIEW.fx.debris;
    TMP.q.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    TMP.m.compose(TMP.v.set(b.position.x, b.position.y, b.position.z), TMP.q, TMP.s.set(p.sx * k, p.sy * k, p.sz * k));
    B.push(TMP.m, colorOf(p.col));
  }
  TMP.q.identity();
}
