// ============================================================ HUD / SCREENS (DOM)
let supportsDirty = true;
const $ = id => document.getElementById(id);
const el = {
  hurt: $('hurt'), banner: $('banner'),
  modal: $('modal'), modalbox: $('modalbox'), hint: $('hint'),
  bhud: $('bhud'), mapscr: $('mapscr'),
  supports: $('supports'), mapsvg: $('mapsvg'),
};
function showScreen(s) {
  screen = s;
  el.mapscr.classList.toggle('on', s === 'map');
  el.bhud.style.display = s === 'battle' ? 'block' : 'none';
  if (s === 'map') { renderMap(); playMapEntrance(); }
}
let hpRefs = [];
function rebuildSupports() {
  const box = el.supports;
  box.innerHTML = '';
  KILLSTREAKS.forEach((ks, i) => {
    const s = SUPPORTS[ks.key], have = state.earned[ks.key] || 0, need = Math.max(0, ks.at - state.ks);
    const status = have ? `<span class="cnt">READY${have > 1 ? ' ×' + have : ''}</span>`
      : ks.key === 'uav' && state.uavT > 0 ? '<span class="cnt">ONLINE</span>'   // the drone is still up
      : `<span class="need">${need > 0 ? need + (need === 1 ? ' KILL' : ' KILLS') : 'USED'}</span>`;   // used: earned once already this life
    const b = document.createElement('button');
    b.className = 'supbtn' + (have ? '' : ' locked');
    b.disabled = !have;
    b.innerHTML = `<span class="ks-top"><span class="ckey">${i + 1}</span>${status}</span><span class="ks-name">${s.name}</span>`;
    b.onclick = () => useSupport(ks.key);
    box.appendChild(b);
  });
}
function updateBattleHud() {
  const theirs = Math.max(0, state.enemyTotal - state.enemyDown);
  $('killn').textContent = state.kills;
  $('ticketn').textContent = state.tickets;
  $('enemyn').textContent = theirs;
  $('tkus').style.width = clamp(state.tickets / CFG.tickets, 0, 1) * 100 + '%';
  $('tkthem').style.width = clamp(theirs / Math.max(1, state.enemyTotal), 0, 1) * 100 + '%';
  if (supportsDirty) { rebuildSupports(); supportsDirty = false; }
  const c = soldiers[state.controlled];
  if (c) {
    const am = $('ammo');
    $('ammag').textContent = c.pistol ? '∞' : c.mag;
    $('amres').textContent = c.pistol ? 'SIDEARM' : '/ ' + c.reserve;
    $('amname').textContent = c.reloadT > 0 ? 'RELOADING' : (c.pistol ? SIDEARM : WEAPONS[c.weapon]).name;
    am.classList.toggle('low', !c.pistol && c.mag <= magCap(c) * 0.25);
    am.classList.toggle('reloading', c.reloadT > 0);
    $('reloadbtn').classList.toggle('warn', !c.pistol && c.mag <= magCap(c) * 0.25);
    const alt = c.alt, altTxt = alt ? `⇄ ${gunName(alt.weapon)} · ${alt.mag + alt.reserve}` : '';
    if (altTxt !== OV.altTxt) { OV.altTxt = altTxt; $('amalt').textContent = altTxt; $('swapname').textContent = alt ? gunName(alt.weapon) : ''; $('swapbtn').classList.toggle('on', !!alt); }
    const pd = state.pickDrop, pb = $('pickbtn'), how = pd ? (GPAD.lastInput === 'pad' ? 'Hold X' : isTouch ? 'Hold' : 'Hold F') + '|' + gunName(pd.key) : '';
    if (how !== OV.pickHow) { OV.pickHow = how; pb.classList.toggle('on', !!pd); if (pd) { $('pickkey').textContent = how.split('|')[0]; $('pickname').textContent = how.split('|')[1]; } }
    if (pd) pb.style.setProperty('--p', clamp((c.pickT || 0) / CFG.pickHold, 0, 1).toFixed(3));
    const objs = state.objs || [];
    for (let i = 0; i < 3; i++) {
      const o = objs[i], chip = OV.objChip && OV.objChip[i] || ((OV.objChip = OV.objChip || [])[i] = $('obj' + i));
      if (!o) { if (chip.style.display !== 'none') chip.style.display = 'none'; continue; }
      if (chip.style.display === 'none') chip.style.display = '';
      const cls = 'obj ' + (o.owner === 'p' ? 'p' : o.owner === 'e' ? 'e' : 'n') + (o.contested ? ' contest' : '') + (o.flashT > 0 ? ' flash' : '') + (state.counter && state.counter.obj === o ? ' counter' : '');
      if (chip.className !== cls) chip.className = cls;
      const pv = Math.abs(o.cap).toFixed(2), cv = o.cap >= 0 ? 'var(--friend)' : 'var(--foe)';
      if (chip.dataset.p !== pv) { chip.dataset.p = pv; chip.style.setProperty('--p', pv); }
      if (chip.dataset.c !== cv) { chip.dataset.c = cv; chip.style.setProperty('--c', cv); }
    }
    const om = $('objmsg'), msg = state.objMsg;
    const mcls = msg ? 'on' + (msg.good ? ' good' : msg.bad ? ' bad' : '') : '';
    if (om.className !== mcls) { om.className = mcls; if (msg) om.textContent = msg.text; }
    const co = $('callout'), cl = state.callout;
    const ccls = 'hud' + (cl ? ' on ' + cl.side : '');   // keep .hud: it is what pins the tag to the screen
    if (co.className !== ccls) { co.className = ccls; if (cl) co.textContent = cl.side === 'sniper' ? 'Sniper · ' + cl.name : 'Grenade · ' + cl.dist + ' m'; }
    const T = state.training, tb = $('trainbox');
    if (T && (T.dirty || OV.trainKind !== inputKind())) {
      T.dirty = false; OV.trainKind = inputKind();
      const st = TRAIN_STEPS[Math.min(T.step, TRAIN_STEPS.length - 1)];
      $('tbStep').textContent = `Basic training · ${Math.min(T.step + 1, TRAIN_STEPS.length)} / ${TRAIN_STEPS.length}`;
      $('tbTitle').textContent = st.title + (st.id === 'look' ? ` (${T.seen.filter(Boolean).length}/3)` : '');
      $('tbHint').textContent = st.hint[OV.trainKind];
      $('tbDots').innerHTML = TRAIN_STEPS.map((_, i) => `<i class="${i < T.step || (i === T.step && T.wait > 0) ? 'done' : i === T.step ? 'now' : ''}"></i>`).join('');
      tb.classList.toggle('ok', T.wait > 0);
    }
    const fr = c.frags || 0;
    if (fr !== OV.frags) { OV.frags = fr; $('nadecnt').textContent = fr; $('amfragn').textContent = fr; $('nadebtn').classList.toggle('empty', !fr); $('amfrag').classList.toggle('empty', !fr); }
    if (c.reloadT > 0) $('ambar').firstChild.style.width = (1 - c.reloadT / c.reloadDur) * 100 + '%';
    const f = c.alive ? clamp(1 - c.hp / c.maxHp, 0, 1) : 1;
    OV.hurt = Math.max(f, (OV.hurt || 0) - 0.05);          // a hit flashes harder, then falls back to how hurt you are
    el.hurt.style.opacity = Math.pow(OV.hurt, 0.8).toFixed(3);
    el.hurt.classList.toggle('crit', c.alive && c.hp / c.maxHp <= 0.35);
  }
  if (meta.opts.minimap && performance.now() - (OV.mapT || 0) > 100) { OV.mapT = performance.now(); drawMinimap(); }
  if (meta.opts.killfeed) updateFeed();
  const boss = state.bossRef;
  const bb = $('bossbar');
  if (boss && boss.hp > 0) {
    bb.style.display = 'block';
    $('bossname').textContent = boss.name + (boss.phase === 3 ? ' — ENRAGED' : boss.phase === 2 ? ' — SUMMONING' : '');
    $('bosshpfill').style.width = clamp(boss.hp / boss.maxHp, 0, 1) * 100 + '%';
  } else bb.style.display = 'none';
}
// ---------- minimap, kill feed, damage direction, settings ----------
const ENEMY_LABEL = { grunt: 'RIFLEMAN', runner: 'RUNNER', brute: 'BREACHER', gunner: 'GUNNER', spotter: 'SPOTTER', rider: 'RAIDER', boss: 'WARLORD', frag: 'OWN FRAG', blast: 'BLAST' };
const labelOf = type => ENEMY_LABEL[type] || 'ENEMY';
function feedPush(who, whom, bad, head) {
  FEED.push({ who, whom, bad, head, t: performance.now() });
  if (FEED.length > 6) FEED.shift();
  FEED.dirty = true;
}
function drawMinimap() {   // heading up: the map turns with you, your arrow always points forward, and north is marked on the rim
  const c = $('minimap'), s = camTarget();
  if (!c || !s) return;
  const g = c.getContext('2d'), W = c.width, H = c.height, sc = W / 1600, cx = W / 2, cy = H / 2;
  const cosA = Math.cos(-cam.yaw), sinA = Math.sin(-cam.yaw);
  const P = (x, y) => { const dx = (x - s.x) * sc, dy = (y - s.y) * sc; MMP.x = cx + dx * cosA - dy * sinA; MMP.y = cy + dx * sinA + dy * cosA; return MMP; };
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(5,8,15,0.5)'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1d2634';
  for (const b of buildings) {   // a turned rectangle is four corners
    g.beginPath();
    P(b.x - b.hw, b.y - b.hd); g.moveTo(MMP.x, MMP.y); P(b.x + b.hw, b.y - b.hd); g.lineTo(MMP.x, MMP.y);
    P(b.x + b.hw, b.y + b.hd); g.lineTo(MMP.x, MMP.y); P(b.x - b.hw, b.y + b.hd); g.lineTo(MMP.x, MMP.y);
    g.fill();
  }
  const dot = (x, y, w, h) => { P(x, y); g.fillRect(MMP.x - w / 2, MMP.y - h / 2, w, h); };
  g.fillStyle = '#3a4454';
  for (const o of obstacles) dot(o.x, o.y, 3, 3);
  g.fillStyle = '#ff6b2c';
  for (const p of pickups) dot(p.x, p.y, 4, 4);
  const dry = s.pistol, blinkOff = dry && Math.sin(performance.now() / 150) < 0;   // on the pistol, dropped guns blink
  if (!blinkOff) { g.fillStyle = dry ? '#ff6b2c' : '#aeb6c2'; for (const d of weaponDrops) dot(d.x, d.y, 5, 5); }
  g.font = '800 9px "JetBrains Mono", ui-monospace, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const o of state.objs || []) {   // objectives: the ring in the owner's colour, the letter upright in the middle
    const col = o.owner === 'p' ? '#5cb6ff' : o.owner === 'e' ? '#ff4d3d' : '#c9d1dc';
    P(o.x, o.y);
    g.strokeStyle = col; g.lineWidth = 1.5;
    g.beginPath(); g.arc(MMP.x, MMP.y, Math.max(5, o.r * sc), 0, TAU); g.stroke();
    g.fillStyle = col; g.fillText(o.letter, MMP.x, MMP.y + 0.5);
  }
  const uav = state.uavT > 0, now = state.frontTime;
  for (const e of enemies) {   // what you have earned: an enemy that has just fired, the Warlord, and everyone while a UAV is up
    if (e.target) continue;
    if (!uav && !e.boss && !(now - (e.firedT == null ? -99 : e.firedT) < MINIMAP_FIRED) && !(e.sniper && e.glint > 0)) continue;
    P(e.x, e.y);
    g.fillStyle = e.boss ? '#ff8a3d' : e.sniper ? '#dff2ff' : '#ff4d3d';
    g.beginPath(); g.arc(MMP.x, MMP.y, e.boss ? 4 : 2.6, 0, TAU); g.fill();
  }
  g.fillStyle = '#5fdc4a';   // your squad, the same green as over their heads
  for (const m of soldiers) {
    if (!m.alive || m.slot === state.controlled) continue;
    P(m.x, m.y);
    g.beginPath(); g.arc(MMP.x, MMP.y, 2.6, 0, TAU); g.fill();
  }
  if (uav) {   // the UAV's sweep
    const a = now * 2.2 % TAU, R = Math.hypot(W, H) / 2;
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    grad.addColorStop(0, 'rgba(255,77,61,0.0)'); grad.addColorStop(1, 'rgba(255,77,61,0.16)');
    g.fillStyle = grad;
    g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R, a - 0.7, a); g.closePath(); g.fill();
  }
  const na = -cam.yaw - Math.PI / 2, nr = Math.min(W, H) / 2 - 7;   // N on the rim, where north is
  g.fillStyle = '#c9d1dc'; g.fillText('N', cx + Math.cos(na) * nr, cy + Math.sin(na) * nr + 0.5);
  g.fillStyle = '#ffffff';   // you, at the middle, always pointing up
  g.beginPath(); g.moveTo(cx, cy - 7); g.lineTo(cx + 4.5, cy + 4.5); g.lineTo(cx - 4.5, cy + 4.5); g.closePath(); g.fill();
}
const MMP = { x: 0, y: 0 }, MINIMAP_FIRED = 1.5;   // seconds an enemy shows on the minimap after it fires
function updateFeed() {
  const box = $('feed'), now = performance.now();
  if (!box) return;
  while (FEED.length && now - FEED[0].t > 4500) { FEED.shift(); FEED.dirty = true; }
  if (!FEED.dirty) return;
  FEED.dirty = false;
  box.innerHTML = FEED.map(f => `<div class="frow${f.bad ? ' bad' : ''}"><b>${f.who}</b> ▸${f.head ? ' <i>HS</i>' : ''} ${f.whom}</div>`).join('');
}
function applyOpts() {   // the options that change how the game looks and reads
  const o = meta.opts;
  if ((o.quality || 'auto') !== Q.opt) { Q.opt = o.quality || 'auto'; setQualityOption(Q.opt); }
  applyPower();
  document.body.classList.toggle('fpv', !!o.fpv);
  document.body.classList.toggle('nomap', !o.minimap);
  document.body.classList.toggle('nofeed', !o.killfeed);
  const ab = $('adsbtn');
  if (ab) ab.classList.toggle('on', aim.ads);
  el.hint.textContent = GPAD.lastInput === 'pad'
    ? 'LS MOVE · RS LOOK · RT FIRE · LT ADS · RB GRENADE · X RELOAD (HOLD: TAKE A GUN) · Y SWAP GUNS · L3 SPRINT · D-PAD ↓ VIEW · ← ↑ → KILLSTREAKS'
    : isTouch
    ? 'LEFT THUMB MOVES · DRAG RIGHT TO LOOK · FIRE · ADS · TAP AMMO TO RELOAD'
    : 'WASD MOVE · MOUSE AIMS (CLICK TO CAPTURE IT, ESC FREES) · CLICK FIRE · RIGHT-CLICK ADS · SHIFT SPRINT · G GRENADE · R RELOAD · Q SWAP GUNS · HOLD F TAKE A GUN · V VIEW';
  el.hint.style.opacity = 1;
  clearTimeout(applyOpts.t);
  applyOpts.t = setTimeout(() => { el.hint.style.opacity = 0; }, 6000);
}
function showSettings() {
  const o = meta.opts, on = v => v ? ' checked' : '';
  showModal(`
    <div class="eyebrow">Settings</div>
    <h2>Controls</h2>
    <div class="setlist">
    <div class="setrow"><span>View</span><span>
      <label><input type="radio" name="vw" value="tps"${on(!o.fpv)}> Third person</label>
      <label><input type="radio" name="vw" value="fps"${on(o.fpv)}> First person</label></span></div>
    ${o.fpv ? '' : `<div class="setrow"><span>Aim assist</span><input type="checkbox" id="o_aa"${on(o.aimAssist)}></div>`}
    <div class="setrow"><span>Look sensitivity</span><input type="range" id="o_sens" min="0.4" max="2" step="0.05" value="${o.sens}"></div>
    <div class="setrow"><span>Field of view</span><input type="range" id="o_fov" min="-10" max="18" step="1" value="${o.fovAdd}"></div>
    <div class="setrow"><span>Minimap</span><input type="checkbox" id="o_map"${on(o.minimap)}></div>
    <div class="setrow"><span>Damage direction</span><input type="checkbox" id="o_dd"${on(o.dmgDir)}></div>
    <div class="setrow"><span>Kill feed</span><input type="checkbox" id="o_kf"${on(o.killfeed)}></div>
    <div class="setrow"><span>Vibration</span><input type="checkbox" id="o_vb"${on(o.vibe)}${navigator.vibrate ? '' : ' disabled'}></div>
    <div class="setrow"><span>Sound</span><input type="checkbox" id="o_snd"${on(!meta.muted)}></div>
    <div class="setrow"><span>Music</span><input type="range" id="o_mus" min="0" max="1" step="0.05" value="${o.music == null ? 0.6 : o.music}"></div>
    <div class="setrow"><span>Graphics</span><select id="o_q">${['auto', 'low', 'medium', 'high'].map(v => `<option value="${v}"${(o.quality || 'auto') === v ? ' selected' : ''}>${v === 'auto' ? 'Auto (' + Q.level + ')' : v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select></div>
    <div class="setrow"><span>Frame rate</span><select id="o_fps">${[['max', 'Max'], ['60', '60 fps'], ['30', '30 fps']].map(([v, n]) => `<option value="${v}"${(o.fps || 'max') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="setrow"><span>Battery saver</span><select id="o_saver">${[['off', 'Off'], ...(navigator.getBattery ? [['auto', 'Auto (20% battery)']] : []), ['on', 'On']].map(([v, n]) => `<option value="${v}"${(o.saver || 'off') === v ? ' selected' : ''}>${n}${v !== 'off' && (o.saver || 'off') === v && POWER.saver ? ' · on now' : ''}</option>`).join('')}</select></div>
    ${fullscreenAllowed() ? `<div class="setrow"><span>Full screen</span><input type="checkbox" id="o_fs"${on(!!document.fullscreenElement)}></div>` : ''}
    ${appInstallable() ? `<div class="setrow"><span>Install app</span><button class="btn setbtn" id="o_inst">${APP.prompt ? 'Install' : 'How'}</button></div>` : ''}
    ${GPAD.seen ? `<div class="setrow"><span>Controller look</span><input type="range" id="o_pad" min="0.4" max="2" step="0.05" value="${o.padSens || 1}"></div>` : ''}
    </div>
    <button class="cta" id="mbtn">Done</button>
    <p class="note">Hold left mouse to fire, right mouse for sights; click once to capture the mouse, Esc frees it.
      On a phone: drag the right side to look, fire with either trigger, ADS to steady. Aim assist is for third person only.</p>`);
  const bind = (id, key, read) => { const e = $(id); if (e) e.oninput = () => { meta.opts[key] = read(e); applyOpts(); saveMeta(); }; };   // 'input' so the FOV and sensitivity sliders preview as you drag
  document.querySelectorAll('input[name=vw]').forEach(r => { r.onchange = () => { meta.opts.fpv = r.value === 'fps'; applyOpts(); saveMeta(); showSettings(); }; });   // redraw: first person drops the aim-assist row
  bind('o_aa', 'aimAssist', e => e.checked);
  bind('o_sens', 'sens', e => +e.value);
  bind('o_fov', 'fovAdd', e => +e.value);
  bind('o_map', 'minimap', e => e.checked);
  bind('o_dd', 'dmgDir', e => e.checked);
  bind('o_kf', 'killfeed', e => e.checked);
  bind('o_vb', 'vibe', e => e.checked);
  bind('o_mus', 'music', e => +e.value);
  bind('o_pad', 'padSens', e => +e.value);
  const qs = $('o_q');
  if (qs) qs.onchange = () => { meta.opts.quality = qs.value; applyOpts(); saveMeta(); };
  const fs = $('o_fps');
  if (fs) fs.onchange = () => { meta.opts.fps = fs.value; applyOpts(); saveMeta(); };
  const sv = $('o_saver');
  if (sv) sv.onchange = () => { meta.opts.saver = sv.value; applyOpts(); saveMeta(); };
  const fsBox = $('o_fs');
  if (fsBox) fsBox.onchange = () => toggleFullscreen(fsBox.checked);
  const inst = $('o_inst');
  if (inst) inst.onclick = () => { if (appInstall() !== 'ios') showSettings(); };
  const snd = $('o_snd');
  if (snd) snd.onchange = () => { meta.muted = !snd.checked; saveMeta(); };
  $('mbtn').onclick = hideModal;
}
let bannerT = 0, bannerQueue = [];
function showBanner(txt) { bannerQueue.push(txt); }
function updateBanner(dt) {
  if (bannerT <= 0 && bannerQueue.length) { el.banner.textContent = bannerQueue.shift(); bannerT = 1.4; }
  if (bannerT > 0) {
    bannerT -= dt;
    const t = 1.4 - bannerT;
    el.banner.style.opacity = t < 0.2 ? t / 0.2 : bannerT < 0.4 ? bannerT / 0.4 : 1;
    if (bannerT <= 0) el.banner.style.opacity = 0;
  }
}
function showModal(html) { el.modalbox.innerHTML = html; el.modal.style.display = 'flex'; }
function hideModal() { el.modal.style.display = 'none'; }

