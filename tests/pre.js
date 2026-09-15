// Runs before the game script in tests/run.html.
// - Saves go to an in-memory store, so a test run never reads or writes a real campaign.
// - The main loop is parked: the suite drives the game with G.step (simulation) and G.frame (one render).
// - ?touch=1 makes the page look like a touch device ('ontouchstart' in window), for the phone pass.
(() => {
  const store = new Map();
  const mem = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
    clear: () => store.clear(),
    key: i => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
  Object.defineProperty(window, 'localStorage', { value: mem, configurable: true });
  const P = new URLSearchParams(location.search);
  if (P.has('touch')) window.ontouchstart = null;
  window.__rafQueue = [];
  window.requestAnimationFrame = fn => { window.__rafQueue.push(fn); return window.__rafQueue.length; };
  window.cancelAnimationFrame = () => {};
  window.__bootErrors = [];
  window.addEventListener('error', e => window.__bootErrors.push(String(e.message || e)));
})();
