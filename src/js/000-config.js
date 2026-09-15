'use strict';
// ============================================================ CONFIG
const CFG = {
  bossIntro: 1.9,         // seconds of Warlord hero shot + title card (world runs at 30%)
  deathCam: 1.9,          // seconds watching your soldier fall before control moves on
  fallDur: 1.6, enemyFallDur: 1.1,   // how long a body takes to hit the ground
  todSpeed: 1 / 150,      // time-of-day steps (dawn→day→dusk→night) per second of battle
  tickets: 20, respawn: 3.0,          // reinforcements the squad shares, and how long you wait to come back
  rosterSize: 4, baseHp: 4, regenDelay: 4.0, regenRate: 2.0,   // out of fire for 4s, then back to full in ~2s
  playerSpeed: 225, aiSpeed: 195, horseSpeedMul: 1.45,
  spawnInvuln: 1.0,
  enemyCap: 8, enemyTickets: 44, enemyTicketsPerTier: 8,   // eight on the field at once; the enemy's reinforcement pool
  arenaW: 3840, arenaH: 2880, lineY: 2560,
  saveKey: 'holdout.v2', saveEvery: 5,
  aiCdMul: 2.6,
  mineCount: 8, mineDmg: 2, mineR: 55,
  headshotMul: 2,         // damage multiplier for a round that goes through the head column
  headshotChance: 0.35,   // ...and happened to be at head height (the sim has no elevation, so it is rolled)
  frags: 2,               // grenades each life; a care package tops them up
  fragSpeed: 600, fragLoft: 0.21, fragFuse: 2.2,   // thrown at 15 m/s, 12° above the crosshair, bursting 2.2 s after it leaves the hand
  fragR: 200, fragDmg: 6, fragSelf: 0.5,           // 5 m blast, 6 at the centre falling to nothing at the edge; half of that to you, never to your squad
  sprintMul: 1.45, sprintOut: 0.18,                // sprint speed, and the moment it takes to get the gun up after one
  swapTime: 0.45, pickHold: 0.35, dropLife: 45,    // changing guns; holding to take one off the ground; how long a dropped gun lies there
};
const TAU = Math.PI * 2;

const WEAPONS = {
  // `range` is how far the AI will engage from; `reach` is how far the round actually flies. They are
  // separate because you can see clear across an 80 m town in first person, and a round that quietly
  // expires at 10 m reads as the gun simply not registering.
  smg:    { name:'UMP45',        cd:0.09, dmg:0.85, range:300, reach:900,  spread:0.09,  speed:4200, len:13, mag:32,  ext:48,  reload:1.7, spare:5 },
  ar:     { name:'M4A1',         cd:0.16, dmg:1.05, range:430, reach:1500, spread:0.04,  speed:5100, len:19, mag:30,  ext:45,  reload:2.1, spare:5 },
  lmg:    { name:'M249 SAW',     cd:0.11, dmg:1, range:400, reach:1400, spread:0.07,  speed:4800, len:23, mag:100, ext:200, reload:4.2, spare:2, moveMul:0.85 },
  sniper: { name:'INTERVENTION', cd:1.05, dmg:4, range:720, reach:2600, spread:0.005, speed:8400, len:29, mag:5,   ext:8,   reload:2.9, spare:6, pierce:2 },
  rocket: { name:'ROCKET',   cd:1.50, dmg:3, range:520, reach:1000, spread:0.02,  speed:900,  len:21, mag:1,   reload:2.6, spare:6, aoe:70 },
  // taken off the dead (see ENEMY GUNS): never in BATTLE PREP
  ak:     { name:'AK-47',        cd:0.10, dmg:1.1, range:420, reach:1400, spread:0.05,  speed:4700, len:19, mag:30,  reload:2.3, spare:2, pickup:true },
  pkm:    { name:'PKM',          cd:0.092, dmg:1.1, range:400, reach:1400, spread:0.085, speed:4700, len:24, mag:100, reload:5.2, spare:1, moveMul:0.82, pickup:true },
};
const WKEYS = Object.keys(WEAPONS).filter(k => !WEAPONS[k].pickup);   // what BATTLE PREP offers
// ---------- attachments: what you look through, and how many rounds you carry in the gun ----------
// zoom is tan-based (a 4x shows a quarter of the view); rate = how fast the sights come up; spread = ADS spread multiplier;
// over = the DOM overlay drawn once you are settled behind the optic (null = the real iron sights, nothing drawn)
const SIGHTS = {
  iron:  { name:'IRON SIGHTS',  zoom:1.45, rate:12,  spread:0.5,  over:null,    note:'Iron sights: quick to the shoulder, a touch of zoom, nothing between you and the street.' },
  rds:   { name:'RED DOT 1.2x', zoom:1.2,  rate:14,  spread:0.5,  over:'dot',   note:'Red dot: the fastest to the eye, 1.2x, a clean window with one dot in it.' },
  acog:  { name:'ACOG 4x',      zoom:4,    rate:8.5, spread:0.4,  over:'acog',  note:'ACOG: 4x for the long streets, a red chevron, slower to shoulder and heavy on the look speed.' },
  scope: { name:'SCOPE 6x',     zoom:6,    rate:7.5, spread:0.35, over:'scope', note:'6x scope: the far end of the street, fully blacked out around the glass; slow to shoulder.' },
};
const SIGHT_OPTS = { smg: ['iron', 'rds', 'acog'], ar: ['iron', 'rds', 'acog'], lmg: ['iron', 'rds', 'acog'], sniper: ['scope', 'acog'] };
const NO_ATT = { sight: 'iron', ext: false };
const EXT_RELOAD = 1.1;   // an extended magazine is heavier and slower to seat
const freshAttach = () => ({ smg: { sight: 'iron', ext: false }, ar: { sight: 'iron', ext: false }, lmg: { sight: 'iron', ext: false }, sniper: { sight: 'scope', ext: false } });
function normAtt(key, att) {   // an attachment record a gun can actually mount: an unknown sight falls back to the gun's first option
  const opts = SIGHT_OPTS[key];
  if (!opts) return NO_ATT;
  return { sight: att && opts.includes(att.sight) ? att.sight : opts[0], ext: !!(att && att.ext && WEAPONS[key].ext) };
}
const attFor = key => normAtt(key, meta && meta.attach && meta.attach[key]);   // what BATTLE PREP has on this gun
const magCap = s => { const w = WEAPONS[s.weapon]; return s.ext && w.ext ? w.ext : w.mag; };
const heroSight = () => { const s = soldiers[state.controlled]; return s && !s.pistol && SIGHTS[s.sight] ? SIGHTS[s.sight] : SIGHTS.iron; };
const heroZoom = () => fpvActive() ? heroSight().zoom : Math.min(heroSight().zoom, 1.45);   // over the shoulder a 4x would be absurd
const adsSens = () => clamp(0.8 / heroZoom(), 0.13, 0.66);   // look speed comes down with the magnification (0.55 on irons)
const SIDEARM = { name:'PISTOL', cd:0.3, dmg:0.7, range:280, reach:800, spread:0.05, speed:3900, len:8 };   // bottomless, for when the rifle runs dry

const SUPPORTS = {
  napalm:    { name:'INCENDIARY', cost:120, desc:'Strike jet lays white phosphorus across the enemy push. Burns both sides.', key:'1' },
  artillery: { name:'ARTILLERY', cost:90,  desc:'6-shell barrage on the thickest cluster. Danger close.', key:'2' },
  supply:    { name:'SUPPLY DROP', cost:60, desc:'Care package of trauma kits — squad heals to full.', key:'3' },
};
const INVESTMENTS = {
  armor:    { name:'BODY ARMOR', max:3, cost: l => 150 * Math.pow(2, l), desc:'+1 HP for every soldier, per level.' },
  training: { name:'LIVE-FIRE TRAINING', max:5, cost: l => 150 * Math.pow(2, l), desc:'+8% squad damage per level.' },
  horses:   { name:'STRIKE ATV', max:8, cost: () => 100, desc:'Light quad bike: +45% speed, +1 HP for the driver. Assign in Roster.' },
};
// Risk-style theater graph. tier drives battle difficulty; inc = REQ/hr when owned.
const TERRITORIES = [
  { id:0,  name:'Bastion HQ',     tier:0, inc:10, x:12, y:48, adj:[1,2] },
  { id:1,  name:'Miller Fields',  tier:1, inc:6,  x:26, y:54, adj:[0,3] },
  { id:2,  name:'Ashford Road',   tier:1, inc:6,  x:20, y:36, adj:[0,3,4] },
  { id:3,  name:'Saint Rennes',   tier:2, inc:8,  x:37, y:44, adj:[1,2,5,6] },
  { id:4,  name:'Korvan Ridge',   tier:2, inc:8,  x:13, y:22, adj:[2,7] },
  { id:5,  name:'Dunmoor Marsh',  tier:3, inc:10, x:53, y:53, adj:[3,8] },
  { id:6,  name:'Velen Crossing', tier:3, inc:10, x:47, y:33, adj:[3,7,8,9] },
  { id:7,  name:'Highwater Pass', tier:3, inc:10, x:28, y:17, adj:[4,6,9] },
  { id:8,  name:'Carrow Depot',   tier:4, inc:14, x:66, y:41, adj:[5,6,10] },
  { id:9,  name:'Redmarsh Line',  tier:4, inc:14, x:44, y:15, adj:[6,7,10,11] },
  { id:10, name:'Voss Junction',  tier:5, inc:18, x:68, y:25, adj:[8,9,12] },
  { id:11, name:'Kessel Heights', tier:5, inc:18, x:57, y:7,  adj:[9,12] },
  { id:12, name:'Enemy Capital',  tier:6, inc:30, x:76, y:11, adj:[10,11] },
];

