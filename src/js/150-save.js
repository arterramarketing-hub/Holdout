// ============================================================ SAVE / LOAD
function saveMeta() {
  try {
    if (screen === 'battle' && !state.training) meta.terr[state.tid].progress = state.mode === 'cleared' ? meta.terr[state.tid].progress
      : state.mode === 'failed' || state.mode === 'spectate' ? 0   // a lost front starts again from nothing, even if the page closes on the defeat screen
      : state.progress;
    localStorage.setItem(CFG.saveKey, JSON.stringify(meta));
  } catch (e) {}
}
function loadMeta() {
  let save = null;
  try { save = JSON.parse(localStorage.getItem(CFG.saveKey)); } catch (e) {}
  if (location.search.includes('reset')) { try { localStorage.removeItem(CFG.saveKey); } catch (e) {} save = null; }
  if (save && save.v === 2 && Array.isArray(save.squad) && save.squad.length >= CFG.rosterSize) {
    loadedFromSave = true;
    meta = Object.assign(freshMeta(), save);
    meta.story = Object.assign({ wren: 'none', wrenPending: false, seen: {}, seenTheater: -1 }, save.story || {});
    if (meta.squad.length > CFG.rosterSize) {   // four to a side now: keep the first four, and Wren if she had joined
      const wi = meta.squad.findIndex(m => m.wren), keep = meta.squad.slice(0, CFG.rosterSize);
      if (wi >= CFG.rosterSize) keep[CFG.rosterSize - 1] = meta.squad[wi];
      meta.squad = keep;
    }
    const optsV = save.opts && save.opts.v;   // read the SAVED version: Object.assign fills v from the defaults
    meta.opts = Object.assign(freshOpts(), save.opts || {});
    if (!optsV) { meta.opts.v = 2; meta.opts.fpv = true; }   // first person is the default now
    delete meta.opts.scheme;
    if (save.trained == null) meta.trained = true;   // a campaign from before the firing range existed: no first-run offer   // auto-fire is gone: a save that used it aims by hand now, in the view it had
    meta.attach = freshAttach();   // per-gun, so a save from before attachments (or with a gun missing) still gets every default
    for (const k in meta.attach) Object.assign(meta.attach[k], (save.attach || {})[k] || {});
    return;
  }
  meta = freshMeta();
}
let loadedFromSave = false;
window.addEventListener('beforeunload', saveMeta);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveMeta(); });

