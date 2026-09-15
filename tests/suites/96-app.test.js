// The installed app: the manifest and icons, the page's app tags, when the worker registers, what it caches, and the
// install entries. Runs late in the desktop pass because registering a worker takes over the test page.
suite('installed app', t => {
  const pngSize = async url => {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ' → ' + r.status);
    const b = new DataView(await r.arrayBuffer());
    if (b.getUint32(0) !== 0x89504e47) throw new Error(url + ' is not a PNG');
    return [b.getUint32(16), b.getUint32(20)];
  };
  const withManifestLink = fn => {
    const l = document.createElement('link'); l.rel = 'manifest'; l.href = '../manifest.webmanifest';
    document.head.appendChild(l);
    try { return fn(); } finally { l.remove(); }
  };
  t.test('the manifest opens full screen in landscape, and every icon is a PNG of its stated size', async () => {
    const m = await (await fetch('/manifest.webmanifest')).json();
    assert.eq(m.name, 'Holdout'); assert.eq(m.short_name, 'Holdout');
    assert.eq(m.display, 'fullscreen'); assert.eq(m.orientation, 'landscape');
    assert.eq(m.start_url, './'); assert.eq(m.scope, './');
    assert.eq(m.background_color, '#05080f'); assert.eq(m.theme_color, '#05080f');
    const purposes = m.icons.map(i => i.purpose).join(',');
    assert.ok(/any/.test(purposes) && /maskable/.test(purposes), 'any and maskable icons');
    assert.ok(m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512'), '192 and 512');
    for (const i of m.icons) assert.eq((await pngSize('/' + i.src)).join('x'), i.sizes, i.src);
    assert.eq((await pngSize('/icons/apple-touch-icon.png')).join('x'), '180x180');
    assert.eq((await pngSize('/icons/favicon-32.png')).join('x'), '32x32');
  });
  t.test('the real page carries the app tags, each marked so the Artifact form drops them', async () => {
    const html = await (await fetch('/index.html')).text();
    const tags = html.match(/^<(link|meta)\b[^>]*\bdata-pwa\b[^>]*>$/gm) || [];
    for (const want of ['rel="manifest"', 'rel="apple-touch-icon"', 'rel="icon"', 'name="theme-color"', 'apple-mobile-web-app-capable', 'apple-mobile-web-app-status-bar-style'])
      assert.ok(tags.some(tg => tg.includes(want)), want);
    assert.ok(!document.querySelector('link[rel="manifest"]'), 'the test page, like the Artifact, has none');
  });
  t.test('the worker registers only on its own top-level page with the manifest link', () => {
    assert.ok(!appHosted(), 'no manifest link: nothing to register');
    assert.eq(appRegister(), false);
    withManifestLink(() => assert.ok(appHosted(), 'with the link, on 127.0.0.1, top level'));
  });
  t.test('the worker caches the page, the icons and three.js, and a new build replaces the old cache', async () => {
    const stale = await caches.open('holdout-oldbuild');
    await stale.put('/stale-probe', new Response('old'));
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    try {
      await waitFor(() => reg.active && reg.active.state === 'activated', 30000, 'the worker to activate');
      const keys = await caches.keys();
      const mine = keys.find(k => k.startsWith('holdout-') && k !== 'holdout-oldbuild');
      assert.ok(mine, 'a build cache: ' + keys.join(', '));
      assert.ok(!keys.includes('holdout-oldbuild'), 'the old build cache is gone');
      const c = await caches.open(mine);
      for (const u of ['/index.html', '/manifest.webmanifest', '/icons/icon-512.png', '/icons/apple-touch-icon.png'])
        assert.ok(await c.match(u), 'cached ' + u);
      assert.ok(await c.match(THREE_URL), 'three.module.js');
      assert.ok(await c.match(THREE_URL.replace('three.module.js', 'three.core.js')), 'three.core.js');
      const src = await (await fetch('/sw.js')).text();
      assert.ok(src.includes(mine), 'the cache is named after this build');
    } finally {
      await reg.unregister();
      for (const k of await caches.keys()) if (k.startsWith('holdout-')) await caches.delete(k);
    }
  }, { timeout: 60000 });
  t.test('an install prompt shows the start menu button and the settings row, and pressing either uses it', () => {
    newCampaign(); showScreen('map');
    const b = $('toinstall');
    APP.prompt = null; APP.installed = false; renderAppButton();
    assert.ok(b.hidden, 'nothing to install yet');
    let asked = 0;
    const ev = new Event('beforeinstallprompt', { cancelable: true });
    ev.prompt = () => { asked++; return Promise.resolve(); };
    dispatchEvent(ev);
    assert.ok(!b.hidden && b.offsetWidth > 0, 'the button shows');
    showSettings();
    assert.ok($('o_inst'), 'Install app row');
    $('o_inst').click();
    assert.eq(asked, 1, 'the browser prompt was used');
    assert.ok(!$('o_inst') && b.hidden, 'and both entries go away');
    hideModal();
    dispatchEvent(ev); b.click();
    assert.eq(asked, 2, 'the start menu button uses it too');
    dispatchEvent(new Event('appinstalled'));
    dispatchEvent(ev);
    assert.ok(b.hidden, 'nothing offered once installed');
    APP.installed = false; APP.prompt = null; renderAppButton();
  });
  t.test('on an iPhone the entries show the Add to Home Screen steps; running installed, nothing is offered', () => {
    newCampaign(); showScreen('map'); APP.prompt = null; APP.installed = false;
    const ua = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1', configurable: true });
    try {
      withManifestLink(() => {
        renderAppButton();
        assert.ok(!$('toinstall').hidden, 'the button shows on an iPhone');
        showSettings();
        assert.eq($('o_inst').textContent, 'How');
        $('o_inst').click();
        assert.ok(/Add to Home Screen/.test(el.modalbox.textContent), 'the steps');
        hideModal();
        Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
        renderAppButton();
        assert.ok($('toinstall').hidden, 'already running from the home screen');
        showSettings();
        assert.ok(!$('o_inst') && !$('o_fs'), 'no install or full screen rows installed');
        hideModal();
        delete navigator.standalone;
      });
    } finally {
      if (ua) Object.defineProperty(navigator, 'userAgent', ua); else delete navigator.userAgent;
      renderAppButton();
    }
    assert.ok($('toinstall').hidden, 'back to a desktop browser with no prompt');
  });
  t.test('Full screen is offered where the page may take the screen', () => {
    showSettings();
    assert.eq(!!$('o_fs'), !!(document.fullscreenEnabled && document.documentElement.requestFullscreen));
    hideModal();
  });
});
