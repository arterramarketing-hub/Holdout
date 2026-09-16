// ---------- SCREEN NAV AND THE TOUCH BUTTONS ----------
// The kit used to live on a screen of its own (BATTLE PREP). It is in the briefing column now: renderKit, in 310.
// nav buttons
$('deploybtn').onclick = deploySelected;
$('ammo').addEventListener('pointerdown', e => { e.preventDefault(); heroReload(); });
$('nadebtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); throwGrenade(soldiers[state.controlled]); });
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
$('swapbtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); swapWeapon(soldiers[state.controlled]); });
(function holdToTake(b) {   // on a phone, hold the button over a dropped gun
  b.addEventListener('pointerdown', e => { e.preventDefault(); aim.take = true; try { b.setPointerCapture(e.pointerId); } catch (err) {} });
  const end = e => { try { if (b.hasPointerCapture(e.pointerId)) b.releasePointerCapture(e.pointerId); } catch (err) {} aim.take = false; };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
  b.addEventListener('lostpointercapture', () => { aim.take = false; });
})($('pickbtn'));
$('tosettings').onclick = showSettings;
$('tocfg').onclick = showSettings;
$('tomap').onclick = () => { if (state.training) { exitTraining(); return; } if (state.mode === 'play' || state.mode === 'failed') { hideModal(); exitBattle(); } };
$('torange').onclick = () => enterTraining();
$('tbSkip').onclick = () => { meta.trained = true; saveMeta(); exitTraining(); };

