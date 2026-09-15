// ---------- TEAM / ARMORY SCREEN ----------
const WCLASS = { smg: 'Submachine gun', ar: 'Assault rifle', lmg: 'Light machine gun', sniper: 'Sniper rifle', rocket: 'Launcher' };
function renderTeam() {   // the rail picks the gun; the panel lays out the one you carry
  if (!meta.attach) meta.attach = freshAttach();
  const cur = WEAPONS[meta.loadout] ? meta.loadout : 'ar';
  const list = $('wlist');
  list.innerHTML = '';
  for (const k of WKEYS) {
    const b = document.createElement('button');
    b.className = 'wrow' + (k === cur ? ' on' : '');
    b.innerHTML = `<span class="wr-n">${WEAPONS[k].name}</span><span class="wr-d">${hitsToDrop(k)} ${hitsToDrop(k) === 1 ? 'HIT' : 'HITS'}</span><span class="wr-c">${WCLASS[k] || ''}</span>`;
    b.onclick = () => { meta.loadout = k; saveMeta(); renderTeam(); };
    list.appendChild(b);
  }
  const k = cur, w = WEAPONS[k], att = attFor(k), opts = SIGHT_OPTS[k] || [];
  const mag = att.ext && w.ext ? w.ext : w.mag, reach = (w.reach || w.range) / 40;
  const top = f => Math.max(...WKEYS.map(f));
  const stat = (label, val, frac) =>
    `<div class="lstat"><span class="k">${label}</span><span class="v">${val}</span><span class="bar"><i style="width:${Math.round(clamp(frac, 0.04, 1) * 100)}%"></i></span></div>`;
  const f = FALLOFF[k];
  const note = (opts.length ? SIGHTS[att.sight].note + ' ' : '')
    + (f ? `Full damage to ${Math.round(f.near / 40)} m, ${Math.round(f.min * 100)}% by ${Math.round(reach)} m.` : 'No damage drop-off.')
    + (w.pierce ? ` Pierces ${w.pierce} targets.` : '') + (w.aoe ? ` ${(w.aoe / 40).toFixed(1)} m blast.` : '')
    + (att.ext ? ` The extended magazine reloads ${Math.round((EXT_RELOAD - 1) * 100)}% slower.` : '');
  const box = $('loadout');
  box.innerHTML = `
    <div class="lo-head"><div><div class="lo-cls">${WCLASS[k] || ''}</div><h2 class="xl lo-name">${w.name}</h2></div><span class="lo-tag">Equipped</span></div>
    <div class="lo-stats">
      ${stat('Damage', squadDmg(k).toFixed(2), squadDmg(k) / top(squadDmg))}
      ${stat('To drop', `${hitsToDrop(k)} <small>${hitsToDrop(k) === 1 ? 'hit' : 'hits'}</small>`, 1 / hitsToDrop(k))}
      ${stat('Fire rate', (1 / w.cd).toFixed(1) + '/s', (1 / w.cd) / top(q => 1 / WEAPONS[q].cd))}
      ${stat('Range', Math.round(reach) + ' m', (w.reach || w.range) / top(q => WEAPONS[q].reach || WEAPONS[q].range))}
      ${stat('Magazine', `${mag} <small>×${w.spare}</small>`, Math.sqrt(mag / top(q => WEAPONS[q].ext || WEAPONS[q].mag)))}
      ${stat('Mobility', Math.round((w.moveMul || 1) * 100) + '%', ((w.moveMul || 1) - 0.6) / 0.4)}
      ${stat('Reload', (w.reload * (att.ext ? EXT_RELOAD : 1)).toFixed(1) + ' s', 1 - (w.reload - 1.2) / 3.4)}
    </div>
    ${opts.length ? `<div class="attrow"><span>Sight</span>${opts.map(sk => `<button class="att${att.sight === sk ? ' on' : ''}" data-sight="${sk}">${SIGHTS[sk].name}</button>`).join('')}</div>` : ''}
    ${w.ext ? `<div class="attrow"><span>Mag</span><button class="att${att.ext ? '' : ' on'}" data-ext="0">STANDARD ${w.mag}</button><button class="att${att.ext ? ' on' : ''}" data-ext="1">EXTENDED ${w.ext}</button></div>` : ''}
    <p class="lo-note">${note}</p>
    <div class="lo-actions"><button class="cta" id="lodone">Done</button></div>`;
  box.querySelectorAll('.att').forEach(b => b.onclick = () => {
    const a = meta.attach[k] || (meta.attach[k] = { sight: opts[0], ext: false });
    if (b.dataset.sight) a.sight = b.dataset.sight; else a.ext = b.dataset.ext === '1';
    saveMeta(); renderTeam();
  });
  $('lodone').onclick = () => showScreen('map');
}

// nav buttons
$('toteam').onclick = () => showScreen('team');
$('backmap').onclick = () => showScreen('map');
{   // mobile lock button: tap to lock or cycle, hold to release
  const lb = $('lockbtn');
  let holdT = null, held = false;
  lb.addEventListener('pointerdown', e => { e.preventDefault(); held = false; holdT = setTimeout(() => { held = true; lockRelease(); }, 500); });
  lb.addEventListener('pointerup', () => { clearTimeout(holdT); if (!held) lockPress(); });
  lb.addEventListener('pointerleave', () => clearTimeout(holdT));
}
$('ammo').addEventListener('pointerdown', e => { e.preventDefault(); heroReload(); });
bindHoldButton('firebtn', () => { aim.fire = true; }, () => { aim.fire = false; });
(function leftTrigger(id) {   // the left-thumb trigger only fires; looking stays with the right thumb
  const b = $(id); if (!b) return;
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); aim.fire = true;
    try { b.setPointerCapture(e.pointerId); } catch (err) {}
  });
  const end = e => { try { if (b.hasPointerCapture(e.pointerId)) b.releasePointerCapture(e.pointerId); } catch (err) {} aim.fire = false; };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
  b.addEventListener('lostpointercapture', () => { aim.fire = false; });
})('firebtn2');
$('adsbtn').addEventListener('pointerdown', e => { e.preventDefault(); aim.ads = !aim.ads; $('adsbtn').classList.toggle('on', aim.ads); });
$('reloadbtn').addEventListener('pointerdown', e => { e.preventDefault(); heroReload(); });
$('tosettings').onclick = showSettings;
$('tocfg').onclick = showSettings;
$('tomap').onclick = () => { if (state.mode === 'play' || state.mode === 'failed') { hideModal(); exitBattle(); } };

