// ---------- MAP SCREEN ----------
let selectedTid = -1;
function renderMap() {
  el.theatertag.textContent = `Theater ${ROMAN[meta.theater] || meta.theater + 1} · Operations`;
  if (!TERRITORIES[selectedTid]) {   // open on something you can fight for, so DEPLOY is one tap away
    const act = TERRITORIES[meta.activeTid];
    const pick = act && terrAttackable(act) ? act : TERRITORIES.find(tt => terrAttackable(tt));
    if (pick) selectedTid = pick.id;
  }
  const NS = 'http://www.w3.org/2000/svg';
  const svg = el.mapsvg;
  svg.innerHTML = '';
  // links
  for (const t of TERRITORIES) for (const a of t.adj) {
    if (a < t.id) continue;
    const o = TERRITORIES[a];
    const ln = document.createElementNS(NS, 'line');
    ln.setAttribute('x1', t.x); ln.setAttribute('y1', t.y);
    ln.setAttribute('x2', o.x); ln.setAttribute('y2', o.y);
    const both = terrOwned(t) && terrOwned(o);
    ln.setAttribute('stroke', both ? '#3b76a6' : '#3a4454');
    ln.setAttribute('stroke-width', both ? '0.4' : '0.3');
    if (!both) ln.setAttribute('stroke-dasharray', '0.9 0.9');
    svg.appendChild(ln);
  }
  for (const t of TERRITORIES) {
    const g = document.createElementNS(NS, 'g');
    g.style.cursor = 'pointer';
    const owned = terrOwned(t), atk = terrAttackable(t);
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', t.x); c.setAttribute('cy', t.y);
    c.setAttribute('r', t.tier === 6 ? 2.6 : 2);
    c.setAttribute('fill', owned ? '#5cb6ff' : atk ? '#070b14' : '#1b2230');   // yours, attackable, out of reach
    c.setAttribute('stroke', owned ? '#05080f' : atk ? '#ff6b2c' : '#3a4454');
    c.setAttribute('stroke-width', atk ? 0.5 : 0.3);
    if (t.id === selectedTid) {   // the selection: a hairline ring outside the node
      const ring = document.createElementNS(NS, 'circle');
      ring.setAttribute('cx', t.x); ring.setAttribute('cy', t.y); ring.setAttribute('r', (t.tier === 6 ? 2.6 : 2) + 1.5);
      ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', '#ff6b2c'); ring.setAttribute('stroke-width', '0.28');
      g.appendChild(ring);
    }
    g.appendChild(c);
    const prog = meta.terr[t.id].progress;
    if (!owned && prog > 0) {
      const arc = document.createElementNS(NS, 'circle');
      arc.setAttribute('cx', t.x); arc.setAttribute('cy', t.y); arc.setAttribute('r', 2.9);
      arc.setAttribute('fill', 'none'); arc.setAttribute('stroke', '#ff6b2c'); arc.setAttribute('stroke-width', '0.45');
      const circ = 2 * Math.PI * 2.9;
      arc.setAttribute('stroke-dasharray', `${circ * prog / 100} ${circ}`);
      arc.setAttribute('transform', `rotate(-90 ${t.x} ${t.y})`);
      g.appendChild(arc);
    }
    const tx = document.createElementNS(NS, 'text');
    tx.setAttribute('x', t.x); tx.setAttribute('y', t.y + 4.9);
    tx.setAttribute('text-anchor', 'middle');
    tx.setAttribute('font-size', '1.75'); tx.setAttribute('fill', owned ? '#9fd2ff' : atk ? '#f1f3f6' : '#7b879a');
    tx.setAttribute('font-family', "'JetBrains Mono', ui-monospace, monospace"); tx.setAttribute('font-weight', '700'); tx.setAttribute('letter-spacing', '0.18');
    tx.textContent = t.name.toUpperCase();
    g.appendChild(tx);
    g.addEventListener('click', () => { selectedTid = t.id; renderMap(); });
    svg.appendChild(g);
  }
  // the command column: the sector, DEPLOY, and the loadout you are carrying
  const t = TERRITORIES[selectedTid] || null;
  const db = $('deploybtn');
  if (!t) {
    $('terrmeta').textContent = 'Select a territory';
    $('terrname').textContent = 'Operations';
    $('terrhint').textContent = 'Pick an orange ring on the map to attack it.';
    db.disabled = true; db.onclick = null;
  } else {
    const owned = terrOwned(t), atk = terrAttackable(t);
    const prog = meta.terr[t.id].progress;
    $('terrmeta').textContent = `Tier ${effTier(t)} · ` + (owned ? 'Held' : atk ? (prog > 0 ? `${Math.floor(prog)}% taken` : 'Attackable') : 'Out of reach');
    $('terrname').textContent = t.name;
    $('terrhint').textContent = owned ? 'Held by your company.'
      : atk ? `Your four against ${CFG.enemyCap} at a time · ${CFG.enemyTickets + CFG.enemyTicketsPerTier * effTier(t)} enemy reinforcements`
      : 'Take a neighbouring sector first.';
    db.disabled = !atk;
    db.onclick = atk ? () => { meta.activeTid = t.id; saveMeta(); enterBattle(t.id); } : null;
  }
  const lk = WEAPONS[meta.loadout] ? meta.loadout : 'ar', lw = WEAPONS[lk], la = attFor(lk);
  $('kitname').textContent = lw.name;
  $('kitsub').textContent = (SIGHT_OPTS[lk] ? SIGHTS[la.sight].name + ' · ' : '') + `${la.ext && lw.ext ? lw.ext : lw.mag} rds`;
}

