// ============================================================ BATTLE STATE
const state = {   // per-battle / session
  mode: 'play', tid: 1, tier: 1,
  kills: 0, tickets: 0, ks: 0, earned: { napalm: 0, artillery: 0, supply: 0 },
  enemyTotal: 26, enemyDown: 0, shots: 0, hits: 0, heads: 0, longest: 0, lastContact: null,
  progress: 0, controlled: 0, spectateT: 0, dyingT: 0,
  wave: 1, waveT: 0, spawnT: 0,
  frontTime: 0, frontDeaths: 0, saveT: 0,
  slow: 0, slowCd: 0,   // wave-clear slow-mo beat
  bossSpawned: false, bossRef: null, spotterSeen: false,
  streakN: 0, streakT: 0,
  crossTarget: null, flyby: null,
  objs: [], squadObj: null, objMsg: null, callout: null, training: null, objDrainT: 0, squadDrainT: 0, noDrain: false,
  tod: 1, weather: 'clear',
};
let screen = 'map'; // map | team | battle
let soldiers = [], enemies = [], bullets = [], particles = [], floaters = [], bodies = [];
let mines = [], shells = [], fires = [], craters = [], splats = [], obstacles = [], corpses = [], pickups = [], grenades = [];
const CORPSE_CAP = 120; // enemy corpses beyond this fade oldest-first; squad corpses never removed
const AI_SLOTS = [0, -140, 140, 280];   // where each of the four starts inside the FOB, just south of its gate

function buildSoldier(i) {
  const m = meta.squad[i];
  const maxHp = CFG.baseHp;
  const weapon = i === 0 ? (meta.loadout || 'ar') : m.weapon;
  const att = i === 0 ? attFor(weapon) : normAtt(weapon, null);   // only your own rifle carries what you picked in BATTLE PREP
  const cap = att.ext ? WEAPONS[weapon].ext : WEAPONS[weapon].mag;
  return {
    slot: i, name: m.name,
    color: m.wren ? '#d9dbe4' : slotColor(i), helm: m.wren ? '#7a7d8c' : slotDark(i),
    weapon, horse: false, sight: att.sight, ext: att.ext, suppressor: att.suppressor,
    x: CFG.arenaW / 2 + AI_SLOTS[i] + rand(-20, 20), y: CFG.lineY + rand(-30, 50),
    hp: maxHp, maxHp, alive: true, respawnT: 0,
    fireCd: rand(0, 0.4) * (i ? 1 : 0), regenCd: 0, invuln: 0, aim: -Math.PI / 2, r: 13,   // the squad's first shots are staggered; your own trigger is live the moment you deploy (the roll stays, so a seed replays the same front)
    walk: rand(0, TAU), moving: false, recoil: 0,
    mag: cap, reserve: cap * WEAPONS[weapon].spare, reloadT: 0, reloadDur: 1, pistol: false,
    frags: CFG.frags, throwT: 0, sprinting: false, sprintOutT: 0,
    kit: { weapon, sight: att.sight, ext: att.ext, suppressor: att.suppressor }, alt: null, swapT: 0, pickT: 0, bornT: 0,   // the loadout a reinforcement comes back with, and the second gun
  };
}
function genTerrain() {   // the same town every front; its movable cover is rolled fresh each battle
  obstacles = []; craters = []; splats = []; mines = []; fires = []; shells = []; corpses = []; rubble = []; grenades = []; weaponDrops = [];
  const k = PX, W = TOWN.w * k, H = TOWN.h * k, T = 24;
  buildings = TOWN.buildings.map(([x0, y0, x1, y1, h, style]) =>
    ({ shape: 'r', x: (x0 + x1) / 2 * k, y: (y0 + y1) / 2 * k, hw: (x1 - x0) / 2 * k, hd: (y1 - y0) / 2 * k, top: h * k, style, building: true, claims: 0 }));
  for (const [x, y, hw, hd] of [[-T / 2, H / 2, T / 2, H / 2 + T], [W + T / 2, H / 2, T / 2, H / 2 + T], [W / 2, -T / 2, W / 2 + T, T / 2], [W / 2, H + T / 2, W / 2 + T, T / 2]])
    buildings.push({ shape: 'r', x, y, hw, hd, top: 2.4 * k, style: 'perimeter', building: true, claims: 0 });   // standing exactly on the edge: walk up and touch it
  for (const [kind, x, y, rot] of TOWN.fixed) obstacles.push(makeCover(kind, x * k, y * k, rot));
  for (const [x, y, kinds, rot] of TOWN.slots) {
    if (Math.random() > 0.85) continue;
    obstacles.push(makeCover(pickL(kinds.split('|')), x * k + rand(-10, 10), y * k + rand(-8, 8), rot));
  }
  for (let i = 0; i < 40; i++) craters.push({ x: rand(80, CFG.arenaW - 80), y: rand(80, CFG.arenaH - 80), r: rand(24, 60) });
  for (let i = 0; i < CFG.mineCount; i++) { const p = openSpot(220, CFG.arenaW - 220, 120, CFG.lineY - 180); mines.push({ x: p.x, y: p.y, blink: rand(0, TAU) }); }
  NAV.dirty = true; propsDirty = true;
}

