// Holdout's test harness: a tiny runner for the suites in tests/suites, loaded after the game script.
//   suite('name', t => { t.test('does a thing', async () => { ... }); }, { pass: 'desktop' | 'touch' | 'baseline' });
// Assertions throw; a test passes when it returns (or resolves) without throwing and raised no page errors.
(() => {
  const P = new URLSearchParams(location.search);
  const PASS = P.get('pass') || 'desktop', ONLY = P.get('only'), REPORT = P.has('report');
  const H = window.HT = { suites: [], results: [], errors: [], baseline: {}, pass: PASS, done: false };
  window.addEventListener('error', e => H.errors.push(String(e.message || e)));
  window.addEventListener('unhandledrejection', e => H.errors.push('unhandled rejection: ' + String((e.reason && e.reason.stack) || e.reason)));
  const origError = console.error.bind(console);
  console.error = (...a) => { H.errors.push('console.error: ' + a.map(String).join(' ')); origError(...a); };

  window.suite = (name, fn, opts = {}) => H.suites.push({ name, fn, pass: opts.pass || 'desktop' });

  const fmt = v => { try { return typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v); } catch (e) { return String(v); } };
  window.assert = {
    ok(cond, label = 'expected true') { if (!cond) throw new Error(label); },
    eq(a, b, label = '') { if (a !== b) throw new Error(`${label ? label + ': ' : ''}expected ${fmt(b)}, got ${fmt(a)}`); },
    near(a, b, tol, label = '') { if (!(Math.abs(a - b) <= tol)) throw new Error(`${label ? label + ': ' : ''}expected ${b} ± ${tol}, got ${a}`); },
    range(v, lo, hi, label = '') { if (!(v >= lo && v <= hi)) throw new Error(`${label ? label + ': ' : ''}expected ${lo}..${hi}, got ${v}`); },
    deepEq(a, b, label = '') { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error(`${label ? label + ': ' : ''}expected ${y}, got ${x}`); },
  };

  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function waitFor(cond, ms, label) {
    const t0 = performance.now();
    while (!cond()) { if (performance.now() - t0 > ms) throw new Error('timed out waiting for ' + label); await wait(50); }
  }
  window.waitFor = waitFor;

  async function run() {
    await waitFor(() => typeof VIEW !== 'undefined' && (VIEW.ready || VIEW.failed), 60000, 'the 3D engine');
    const bootEl = document.getElementById('boot');
    if (bootEl) bootEl.click();
    await wait(700);
    const t0 = performance.now();
    for (const s of H.suites) {
      if (s.pass !== PASS) continue;
      const tests = [];
      s.fn({ test: (name, fn, opts = {}) => tests.push({ name, fn, timeout: opts.timeout || 90000 }) });
      for (const t of tests) {
        const full = `${s.name} › ${t.name}`;
        if (ONLY && !full.toLowerCase().includes(ONLY.toLowerCase())) continue;
        const errs0 = H.errors.length, started = performance.now();
        let ok = true, error = null, info;
        try {
          info = await Promise.race([Promise.resolve().then(() => t.fn()), wait(t.timeout).then(() => { throw new Error(`timed out after ${t.timeout / 1000} s`); })]);
        } catch (e) { ok = false; error = String((e && e.message) || e); }
        const pageErrs = H.errors.slice(errs0);
        if (ok && pageErrs.length) { ok = false; error = 'page errors: ' + pageErrs.slice(0, 3).join(' | '); }
        H.results.push({ suite: s.name, name: t.name, ok, ms: Math.round(performance.now() - started), error, info: info === undefined ? null : info });
        try { if (window.afterEachTest) window.afterEachTest(); } catch (e) { H.errors.push('afterEach: ' + e.message); }
      }
    }
    H.done = true;
    const failed = H.results.filter(r => !r.ok).length;
    const summary = { pass: PASS, passed: H.results.length - failed, failed, total: H.results.length, seconds: Math.round((performance.now() - t0) / 1000),
      results: H.results, bootErrors: window.__bootErrors, baseline: H.baseline, ua: navigator.userAgent, size: [innerWidth, innerHeight] };
    render(summary);
    if (REPORT) { try { await fetch('/__results', { method: 'POST', body: JSON.stringify(summary) }); } catch (e) { /* the page is also readable by hand */ } }
  }
  function render(sum) {   // readable when the page is opened by hand
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:9999;overflow:auto;background:#05080f;color:#c9d1dc;font:12px/1.5 ui-monospace,monospace;padding:16px 20px';
    box.innerHTML = `<b style="color:${sum.failed ? '#ff4d3d' : '#86dd90'}">${sum.passed}/${sum.total} passed · ${sum.pass} pass · ${sum.seconds} s</b><br><br>` +
      sum.results.map(r => `<div style="color:${r.ok ? '#86dd90' : '#ff4d3d'}">${r.ok ? '✓' : '✗'} ${r.suite} › ${r.name} <span style="color:#7b879a">${r.ms} ms</span>` +
        (r.error ? `<div style="color:#ffa596;margin-left:18px">${r.error.replace(/</g, '&lt;')}</div>` : '') + '</div>').join('');
    document.body.appendChild(box);
  }
  window.addEventListener('load', () => { run().catch(e => { H.errors.push('runner: ' + e.message); H.done = true; if (REPORT) fetch('/__results', { method: 'POST', body: JSON.stringify({ pass: PASS, fatal: String(e.message), results: H.results, total: 0, failed: 1, passed: 0 }) }); }); });
})();
