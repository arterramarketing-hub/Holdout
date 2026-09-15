// ============================================================ THE INSTALLED APP (GitHub Pages)
// The page registers its service worker (sw.js: the game starts offline after one launch online) only when it carries
// a manifest link — the Artifact form has none — and runs top-level on https or localhost. Installing: the start
// menu's install button (orange until pressed once on a phone) and SETTINGS › Install app use the browser's own prompt
// (Android and desktop Chrome, Edge); an iPhone has no prompt, so both show the Share › Add to Home Screen steps
// instead. Installed, the manifest opens the game full screen and, on Android, locked to landscape; nothing is offered
// once it runs that way. SETTINGS › Full screen appears where the page may take the whole screen, and on a phone it
// also locks landscape.
const APP = { prompt: null, installed: false, reg: null };
const appStandalone = () => navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches);
const appIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function appHosted() {   // our own top-level page, able to install: not the Artifact frame, not a file on disk
  let top = false;
  try { top = window.top === window; } catch (e) {}
  return top && !!document.querySelector('link[rel="manifest"]') && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname));
}
function appRegister() {
  if (!appHosted() || !('serviceWorker' in navigator)) return false;
  navigator.serviceWorker.register('sw.js').then(r => { APP.reg = r; }).catch(() => {});
  return true;
}
const appInstallable = () => !APP.installed && !appStandalone() && (!!APP.prompt || (appIOS() && appHosted()));
function appInstall() {   // the browser's own dialog, or on an iPhone the steps
  if (meta && !meta.appNudged) { meta.appNudged = true; saveMeta(); }
  if (APP.prompt) {
    const p = APP.prompt;
    APP.prompt = null;
    try { const r = p.prompt(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
    renderAppButton();
    return 'prompt';
  }
  if (appIOS() && appHosted() && !appStandalone()) {
    showModal(`
      <div class="eyebrow">Install</div>
      <h2>Holdout on your home screen</h2>
      <ol class="steps">
        <li>Tap <b>Share</b> <svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5v8.5M5 4.5l3-3 3 3M3.5 7.5v7h9v-7"/></svg> in Safari's toolbar.</li>
        <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
        <li>Open Holdout from its icon: full screen, and it starts without a connection after the first launch.</li>
      </ol>
      <button class="cta" id="mbtn">Done</button>
      <p class="note">A game started from the icon keeps its own save, apart from Safari's.</p>`);
    $('mbtn').onclick = hideModal;
    renderAppButton();
    return 'ios';
  }
  return null;
}
function renderAppButton() {   // the start menu's install button: only while there is something to install
  const b = $('toinstall');
  if (!b) return;
  const show = appInstallable();
  b.hidden = !show;
  b.classList.toggle('nudge', show && isTouch && !(meta && meta.appNudged));
}
const fullscreenAllowed = () => !appStandalone() && !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
function toggleFullscreen(on) {
  if (!on) { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); return; }
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).then(() => {
    const o = window.screen && window.screen.orientation;   // `screen` alone is the game's current screen name
    if (isTouch && o && o.lock) o.lock('landscape').catch(() => {});
  }).catch(() => {});
}
addEventListener('beforeinstallprompt', e => { e.preventDefault(); APP.prompt = e; renderAppButton(); });
addEventListener('appinstalled', () => { APP.installed = true; APP.prompt = null; renderAppButton(); });
$('toinstall').onclick = appInstall;
appRegister();
renderAppButton();
