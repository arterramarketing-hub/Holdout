"""Run Holdout's automated tests in headless Chrome.

Builds tests/run.html (index.html with the test pre-script before the game and the harness, helpers and suites after
it), serves the repository on a throwaway local port, opens the page in headless Chrome once per pass, and prints what
the suites post back. Exit code 1 if anything failed.

  passes:  desktop  a 1280x720 window, mouse and keyboard
           touch    an 844x390 phone that reports touch support
           small    a 740x360 phone, touch
           wide     a 1920x1080 desktop
           tall     a 900x1200 desktop window taller than it is wide
           baseline the reference measurements later phases are held to (only with --baseline)

usage:
  python3 tools/test.py                    every pass but the baseline
  python3 tools/test.py --only ballistics  just the tests whose "suite › name" contains the text
  python3 tools/test.py --pass touch       one pass
  python3 tools/test.py --baseline         run the baseline pass and write tests/baseline.json
  python3 tools/test.py --soak             several whole fronts back to back with everything switched on (slow)
  python3 tools/test.py --headed           watch it in a visible window
  python3 tools/test.py --source old.html --suites 'tests/scratch/*.js'   another build, other suites (comparisons)

Chrome is found at $CHROME, the macOS app, or google-chrome / chromium on the PATH. Before the passes, one probe
window measures the browser's own frame, so every pass gets exactly its inner size on any platform. With CI set (as
on GitHub Actions) timeouts are longer, failures become ::error annotations, and a results table goes to the run
summary.
"""
import glob
import http.server
import json
import os
import re
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.join(ROOT, 'tests')
CI = bool(os.environ.get('CI'))
LINUX = sys.platform.startswith('linux')
# inner sizes: the window around them is measured by calibrate()
PASSES = {'desktop': ((1280, 720), ''), 'touch': ((844, 390), '&touch=1'), 'small': ((740, 360), '&touch=1'), 'wide': ((1920, 1080), ''),
          'tall': ((900, 1200), ''), 'baseline': ((1280, 720), ''), 'soak': ((1280, 720), '')}
DEFAULT_PASSES = ['desktop', 'touch', 'small', 'wide', 'tall']
CALIBRATE = b"""<!doctype html><meta charset="utf-8"><body><script>
addEventListener('load', () => setTimeout(() => fetch('/__results', { method: 'POST',
  body: JSON.stringify({ iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio, ua: navigator.userAgent }) }), 100));
</script></body>"""


def find_chrome():
    for c in [os.environ.get('CHROME'), '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']:
        if c and os.path.exists(c):
            return c
    for name in ('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'):
        found = shutil.which(name)
        if found:
            return found
    return None


def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        return sys.argv[i + 1] if i + 1 < len(sys.argv) else default
    return default


def build_page():
    html = open(arg('--source', os.path.join(ROOT, 'index.html')), encoding='utf-8').read()
    html = re.sub(r'^\s*<(link|meta)\b[^>]*\bdata-pwa\b[^>]*>\s*\n', '', html, flags=re.M | re.I)   # like the Artifact form: the app suite adds these back itself
    game = html.rfind('<script>')
    end = html.rfind('</script>')
    if game < 0 or end < game:
        sys.exit('index.html has no game script')
    suites = sorted(glob.glob(arg('--suites', os.path.join(TESTS, 'suites', '*.test.js'))))
    after = ['harness.js', 'helpers.js'] + [os.path.relpath(s, TESTS) for s in suites]
    tail = ''.join(f'<script src="{s}"></script>\n' for s in after)
    base_path = os.path.join(TESTS, 'baseline.json')
    if os.path.exists(base_path):
        tail = f'<script>window.HT_BASELINE = {open(base_path).read()};</script>\n' + tail
    page = html[:game] + '<script src="pre.js"></script>\n' + html[game:end + len('</script>')] + '\n' + tail + html[end + len('</script>'):]
    open(os.path.join(TESTS, 'run.html'), 'w', encoding='utf-8').write(page)
    return len(suites)


class Results:
    def __init__(self):
        self.data = None
        self.event = threading.Event()


def serve(results):
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k):
            super().__init__(*a, directory=ROOT, **k)

        def log_message(self, *a):
            pass

        def do_GET(self):
            if self.path.startswith('/__calibrate'):
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(CALIBRATE)))
                self.end_headers()
                self.wfile.write(CALIBRATE)
                return
            super().do_GET()

        def do_POST(self):
            if self.path.startswith('/__results'):
                n = int(self.headers.get('Content-Length', 0))
                results.data = json.loads(self.rfile.read(n) or b'{}')
                results.event.set()
            self.send_response(204)
            self.end_headers()

    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.ThreadingTCPServer(('127.0.0.1', 0), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def open_chrome(chrome, window, url, headed, results, timeout):   # one browser on one page until it posts results (or the time runs out)
    profile = tempfile.mkdtemp(prefix='holdout-test-')
    cmd = [chrome, f'--user-data-dir={profile}', '--no-first-run', '--no-default-browser-check', f'--window-size={window[0]},{window[1]}',
           '--force-device-scale-factor=1', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio',
           '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows']
    if LINUX:
        cmd += ['--no-sandbox', '--disable-dev-shm-usage']   # Ubuntu 24.04 refuses Chrome's sandbox to unprivileged users
    if not headed:
        cmd.insert(1, '--headless=new')
    proc = subprocess.Popen(cmd + [url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    got = results.event.wait(timeout)
    proc.terminate()
    try:
        proc.wait(10)
    except subprocess.TimeoutExpired:
        proc.kill()
    shutil.rmtree(profile, ignore_errors=True)
    return got


def calibrate(chrome, headed):   # how much bigger the window is than the page inside it
    probe = (1280, 800)
    results = Results()
    httpd = serve(results)
    got = open_chrome(chrome, probe, f'http://127.0.0.1:{httpd.server_address[1]}/__calibrate', headed, results, 120 if CI else 60)
    httpd.shutdown()
    if not got:
        sys.exit('Chrome never reported from the calibration page')
    d = results.data
    return (probe[0] - d['iw'], probe[1] - d['ih']), d


def run_pass(name, chrome, frame, only, headed, timeout):
    inner, extra = PASSES[name]
    results = Results()
    httpd = serve(results)
    port = httpd.server_address[1]
    url = f'http://127.0.0.1:{port}/tests/run.html?report=1&pass={name}{extra}'
    if only:
        url += '&only=' + urllib.parse.quote(only)
    t0 = time.time()
    got = open_chrome(chrome, (inner[0] + frame[0], inner[1] + frame[1]), url, headed, results, timeout)
    httpd.shutdown()
    if not got:
        return {'pass': name, 'fatal': f'no results after {timeout} s', 'results': [], 'failed': 1, 'passed': 0, 'total': 0}, time.time() - t0
    return results.data, time.time() - t0


def gh_error(title, message):   # a GitHub Actions annotation, with the workflow-command escapes
    esc = lambda v: str(v).replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
    print(f'::error title={esc(title).replace(":", "%3A").replace(",", "%2C")}::{esc(message)[:900]}')


def report(data, wall):
    name = data.get('pass')
    print(f'\n== {name} pass: {data.get("passed", 0)}/{data.get("total", 0)} passed in {wall:.0f} s (window {data.get("size")})')
    if data.get('fatal'):
        print('  FATAL:', data['fatal'])
    if data.get('bootErrors'):
        print('  errors while loading:', data['bootErrors'][:3])
    for r in data.get('results', []):
        mark = 'ok  ' if r['ok'] else 'FAIL'
        info = ''
        if r.get('info') is not None:
            info = '  ' + json.dumps(r['info'])[:160]
        print(f'  {mark} {r["suite"]} › {r["name"]} ({r["ms"]} ms){info}')
        if not r['ok']:
            print(f'       {r["error"]}')
            if CI:
                gh_error(f'{name} pass · {r["suite"]} › {r["name"]}', r['error'])
    if CI and data.get('fatal'):
        gh_error(f'{name} pass', data['fatal'])
    if not data.get('fatal') and not data.get('total'):
        print('  FATAL: no tests ran in this pass')
        if CI:
            gh_error(f'{name} pass', 'no tests ran')
    return data.get('failed', 1) == 0 and not data.get('fatal') and data.get('total', 0) > 0


def summary(rows):   # GitHub Actions: a table on the run's page
    path = os.environ.get('GITHUB_STEP_SUMMARY')
    if not path:
        return
    lines = ['## Holdout tests', '', '| Pass | Window | Passed | Time |', '|---|---|---|---|']
    fails = []
    for data, wall, ok in rows:
        size = data.get('size') or PASSES.get(data.get('pass'), ((0, 0),))[0]
        lines.append(f'| {"✅" if ok else "❌"} {data.get("pass")} | {size[0]}×{size[1]} | {data.get("passed", 0)}/{data.get("total", 0)} | {wall:.0f} s |')
        if data.get('fatal') or not data.get('total'):
            fails.append(f'- **{data.get("pass")}**: {data.get("fatal") or "no tests ran"}')
        for r in data.get('results', []):
            if not r['ok']:
                fails.append(f'- **{data.get("pass")}** · {r["suite"]} › {r["name"]}: `{str(r["error"])[:300]}`')
    if fails:
        lines += ['', '### Failures', ''] + fails
    with open(path, 'a', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')


def main():
    chrome = find_chrome()
    if not chrome:
        sys.exit('Google Chrome was not found (set CHROME to its path); or open tests/run.html?pass=desktop from a local server')
    n = build_page()
    only, headed = arg('--only'), '--headed' in sys.argv
    passes = ['baseline'] if '--baseline' in sys.argv else ['soak'] if '--soak' in sys.argv else [arg('--pass')] if arg('--pass') else DEFAULT_PASSES
    frame, probe = calibrate(chrome, headed)
    print(f'{n} suite files · passes: {", ".join(passes)} · window frame +{frame[0]}×+{frame[1]} px · pixel ratio {probe.get("dpr")}')
    all_ok, rows = True, []
    for p in passes:
        data, wall = run_pass(p, chrome, frame, only, headed, timeout=(1500 if p in ('baseline', 'soak') else 900) * (3 if CI else 1))
        ok = report(data, wall)
        rows.append((data, wall, ok))
        all_ok = ok and all_ok
        if p == 'baseline' and data.get('baseline'):
            path = os.path.join(TESTS, 'baseline.json')
            json.dump(data['baseline'], open(path, 'w'), indent=2)
            print('  wrote tests/baseline.json:', json.dumps(data['baseline']))
    summary(rows)
    print('\nALL PASSED' if all_ok else '\nFAILURES')
    sys.exit(0 if all_ok else 1)


if __name__ == '__main__':
    main()
