// ============================================================ FRONT LIFECYCLE
function enterBattle(tid) {
  if (!VIEW.ready) {   // three.js is still arriving (or failed): hold the deploy
    if (VIEW.failed) {
      showModal(`<div class="eyebrow">Engine offline</div><h2>No signal</h2><p class="lede">The 3D renderer couldn't load. Check your connection, then reload.</p><button class="cta" id="mbtn">Reload</button>`);
      $('mbtn').onclick = () => location.reload();
    } else {
      showModal(`<div class="eyebrow">Stand by</div><h2>Loading</h2><p class="note">Deploying as soon as the battlefield is ready.</p>`);
      threeReady.then(() => { hideModal(); enterBattle(tid); });
    }
    return;
  }
  state.tid = tid;
  const t = TERRITORIES[tid];
  state.tier = effTier(t);
  state.progress = meta.terr[tid].progress;
  state.mode = 'play';
  state.wave = 1; state.waveT = 0; state.spawnT = 1.5;
  state.enemyTotal = CFG.enemyTickets + CFG.enemyTicketsPerTier * state.tier;
  state.enemyDown = Math.min(state.enemyTotal - 1, Math.round(state.progress / 100 * state.enemyTotal));   // a front you left half-won resumes there
  state.shots = 0; state.hits = 0; state.heads = 0; state.longest = 0; state.lastContact = null;
  state.frontTime = 0; state.frontDeaths = 0;
  state.bossSpawned = false; state.bossRef = null; state.spotterSeen = false;
  state.slow = 0; state.slowCd = 0;
  state.flyby = null; state.crossTarget = null;
  rollSky(tid);
  enemies = []; bullets = []; markers = []; floaters = []; bodies = []; particles = []; pickups = [];
  genTerrain();
  setupObjectives(objectiveSites(tid)); state.squadObj = null;
  soldiers = meta.squad.map((m, i) => buildSoldier(i));
  const first = soldiers.findIndex(s => s.alive);
  state.controlled = first < 0 ? 0 : first;
  if (first >= 0) soldiers[state.controlled].invuln = CFG.spawnInvuln;
  const opening = Math.min(CFG.enemyCap, state.enemyTotal - state.enemyDown);   // their first four, somewhere far from the FOB
  for (let i = 0; i < opening; i++) spawnEnemy(pickType());
  aim.yaw = 0; aim.pitch = 0; aim.fire = false; aim.ads = false; aim.lookDx = 0; aim.settle = 0; aim.settleY = 0;
  releaseInputs();   // every front opens facing the line, not wherever you last looked
  viewEnterBattle();
  supportsDirty = true;
  state.streakN = 0; state.streakT = 0;
  state.kills = 0; state.ks = 0; state.tickets = CFG.tickets;
  state.earned = { napalm: 0, artillery: 0, supply: 0 };
  showScreen('battle');
  if (first < 0) showFailModal();
}
function exitBattle() {
  meta.terr[state.tid].progress = state.progress;
  saveMeta();
  showScreen('map');
}
function frontCleared() {
  if (state.mode === 'cleared') return;
  state.mode = 'cleared';
  sfxClear(); musStinger('win');
  const t = TERRITORIES[state.tid];
  meta.terr[state.tid] = { owner: 'p', progress: 0 };
  let wrenJoins = false;
  if (state.tid === 7 && meta.theater === 0 && meta.story.wren === 'none') {
    let slot = -1;
    for (let i = meta.squad.length - 1; i > 0; i--) if (!meta.squad[i].wren) { slot = i; break; }   // never your own slot
    if (slot > 0) { makeWren(meta.squad[slot]); wrenJoins = true; }
  }
  const allOwned = TERRITORIES.every(tt => terrOwned(tt));
  const acc = state.shots ? Math.round(state.hits / state.shots * 100) : 0;
  showModal(`
    <div class="eyebrow">Front secured</div>
    <h2>${t.name}</h2>
    <p class="lede">The line held. ${t.name} is yours${allOwned ? ', and with it the whole theater' : ''}.${wrenJoins ? ' And at the pass you found CPL Dana Wren, sole survivor of the Third. She joins the squad.' : ''}</p>
    <div class="stats">
      <div class="stat wide"><div class="k">Kills</div><div class="v hot">${state.kills}</div></div>
      <div class="stat"><div class="k">Accuracy</div><div class="v">${acc}<small>%</small></div></div>
      <div class="stat"><div class="k">Headshots</div><div class="v">${state.heads}</div></div>
      <div class="stat"><div class="k">Longest kill</div><div class="v">${Math.round(state.longest / 40)}<small>M</small></div></div>
      <div class="stat"><div class="k">Reinforcements spent</div><div class="v">${state.frontDeaths}</div></div>
      <div class="stat wide"><div class="k">Time on the front</div><div class="v">${fmtTime(state.frontTime)}</div></div>
    </div>
    <button class="cta" id="mbtn">${allOwned ? 'Next theater' : 'Return to map'}</button>
    <p class="note">${TERRITORIES.filter(terrOwned).length} of ${TERRITORIES.length} territories held.</p>`);
  document.getElementById('mbtn').onclick = () => {
    hideModal();
    if (allOwned) advanceTheater();
    else exitBattle();
  };
  saveMeta();
}
function advanceTheater() {
  meta.theater++;
  for (const t of TERRITORIES) meta.terr[t.id] = { owner: t.tier === 0 ? 'p' : 'e', progress: 0 };
  meta.activeTid = 1;
  showModal(`
    <div class="eyebrow">Theater secured</div>
    <h2>Redeploy</h2>
    <p class="lede">Every territory is ours. The squad moves on to a harder theater, and the map starts over with only HQ held.</p>
    <div class="stats">
      <div class="stat wide"><div class="k">Theater</div><div class="v hot">${ROMAN[meta.theater] || meta.theater + 1}</div></div>
      <div class="stat wide"><div class="k">Enemy strength</div><div class="v">+2<small>TIERS</small></div></div>
    </div>
    <button class="cta" id="mbtn">To the map</button>`);
  document.getElementById('mbtn').onclick = () => { hideModal(); exitBattle(); };
  saveMeta();
}
function showFailModal() {
  if (state.mode !== 'failed') musStinger('lose');
  state.mode = 'failed';
  const t = TERRITORIES[state.tid], acc = state.shots ? Math.round(state.hits / state.shots * 100) : 0;
  showModal(`
    <div class="eyebrow">Front lost</div>
    <h2>Overrun</h2>
    <p class="lede">Your reinforcements ran out before theirs did. ${t.name} stays in enemy hands.</p>
    <div class="stats">
      <div class="stat wide"><div class="k">Kills</div><div class="v hot">${state.kills}</div></div>
      <div class="stat"><div class="k">Enemy left</div><div class="v">${Math.max(0, state.enemyTotal - state.enemyDown)}</div></div>
      <div class="stat"><div class="k">Accuracy</div><div class="v">${acc}<small>%</small></div></div>
      <div class="stat"><div class="k">Headshots</div><div class="v">${state.heads}</div></div>
      <div class="stat"><div class="k">Longest kill</div><div class="v">${Math.round(state.longest / 40)}<small>M</small></div></div>
      <div class="stat wide"><div class="k">Time on the front</div><div class="v">${fmtTime(state.frontTime)}</div></div>
    </div>
    <button class="cta" id="mbtn">Deploy again</button>
    <button class="btn" id="mretreat">Retreat to map</button>
    <p class="note">Either way the front starts again from nothing.</p>`);
  $('mbtn').onclick = () => { meta.terr[state.tid].progress = 0; hideModal(); enterBattle(state.tid); };
  $('mretreat').onclick = () => { meta.terr[state.tid].progress = 0; hideModal(); exitBattle(); };
}

