// ============================================================ PERSISTENT META
let meta = null;
// ---------- player options (saved with the campaign) ----------
const OPT_DEFAULTS = { v: 2, fpv: true, aimAssist: true, sens: 1, fovAdd: 0, minimap: true, dmgDir: true, killfeed: true, vibe: true, music: 0.6, callouts: true, quality: 'auto', padSens: 1, fps: 'max', saver: 'off' };
const freshOpts = () => Object.assign({}, OPT_DEFAULTS);
function freshMeta() {
  const taken = [];
  const squad = [];
  for (let i = 0; i < CFG.rosterSize; i++) {
    const n = makeName(taken); taken.push(n);
    squad.push({ name: n, weapon: 'ar', horse: false, alive: true, kills: 0,
      arch: ['vet','rook','joker','zealot','cynic','stoic','hen','wild'][i] });   // one of each to start
  }
  return {
    v: 2, theater: 0, muted: false,
    loadout: 'ar',
    attach: freshAttach(),
    opts: freshOpts(),
    story: { wren: 'none', wrenPending: false, seen: {}, seenTheater: -1 },
    trained: false,
    squad,
    terr: TERRITORIES.map(t => ({ owner: t.tier === 0 ? 'p' : 'e', progress: 0 })),
    activeTid: 1,
  };
}
const terrOwned = t => meta.terr[t.id].owner === 'p';
const terrAttackable = t => !terrOwned(t) && t.adj.some(a => meta.terr[a].owner === 'p');
const effTier = t => Math.max(1, t.tier) + meta.theater * 2;
function squadDmg(key) {   // a weapon is what it is: holding ground grants nothing but the ground
  return WEAPONS[key].dmg;
}
function makeWren(s) {
  s.name = 'Wren'; s.arch = 'legacy'; s.wren = true;
  s.weapon = 'ar'; s.horse = false; s.alive = true; s.kills = 0;
  meta.story.wren = 'joined'; meta.story.wrenPending = false;
}

const KILLSTREAKS = [   // supports are earned on the field now, not bought
  { at: 4,  key: 'napalm' },
  { at: 7,  key: 'artillery' },
  { at: 10, key: 'supply' },
];
function awardStreak() {
  state.ks++;
  for (const k of KILLSTREAKS) if (k.at === state.ks) {
    state.earned[k.key]++;
    supportsDirty = true;
    showBanner(SUPPORTS[k.key].name + ' READY');
    beep(1500, 0.09, 'square', 0.05);
  }
}
function respawnSoldier(s) {   // a fresh body off the reinforcement line: same name, same loadout
  if (s.kit) { s.weapon = s.kit.weapon; s.sight = s.kit.sight; s.ext = s.kit.ext; s.suppressor = s.kit.suppressor; }
  s.alt = null; s.swapT = 0; s.pickT = 0;
  const w = WEAPONS[s.weapon];
  s.alive = true; s.hp = s.maxHp; s.pistol = false;
  s.mag = magCap(s); s.reserve = magCap(s) * w.spare; s.reloadT = 0; s.fireCd = 0;
  const p = pickSpawn('p'); s.x = p.x; s.y = p.y;
  s.aim = -Math.PI / 2; s.invuln = CFG.spawnInvuln; s.respawnT = 0; s.bornT = state.frontTime;
  s.coverRef = null; s.path = null; s.tgt = null; s.supp = 0; s.recoil = 0;
  s.frags = CFG.frags; s.throwT = 0; s.sprinting = false; s.sprintOutT = 0;
}

