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
"""
import glob
import http.server
import json
import os
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
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
# headless windows lose 87 px of height to browser UI, so these give inner sizes of 1280x720, 844x390, 740x360, 1920x1080 and 900x1200
PASSES = {'desktop': ('1280,807', ''), 'touch': ('844,477', '&touch=1'), 'small': ('740,447', '&touch=1'), 'wide': ('1920,1167', ''),
          'tall': ('900,1287', ''), 'baseline': ('1280,807', ''), 'soak': ('1280,807', '')}
DEFAULT_PASSES = ['desktop', 'touch', 'small', 'wide', 'tall']


def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        return sys.argv[i + 1] if i + 1 < len(sys.argv) else default
    return default


def build_page():
    html = open(arg('--source', os.path.join(ROOT, 'index.html')), encoding='utf-8').read()
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


def run_pass(name, port, only, headed, timeout):
    size, extra = PASSES[name]
    results = Results()
    httpd = serve(results)
    port = httpd.server_address[1]
    url = f'http://127.0.0.1:{port}/tests/run.html?report=1&pass={name}{extra}'
    if only:
        url += '&only=' + urllib.parse.quote(only)
    profile = tempfile.mkdtemp(prefix='holdout-test-')
    cmd = [CHROME, f'--user-data-dir={profile}', '--no-first-run', '--no-default-browser-check', f'--window-size={size}',
           '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--mute-audio',
           '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling',
           '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', url]
    if not headed:
        cmd.insert(1, '--headless=new')
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    t0 = time.time()
    got = results.event.wait(timeout)
    proc.terminate()
    try:
        proc.wait(10)
    except subprocess.TimeoutExpired:
        proc.kill()
    httpd.shutdown()
    shutil.rmtree(profile, ignore_errors=True)
    if not got:
        return {'pass': name, 'fatal': f'no results after {timeout} s', 'results': [], 'failed': 1, 'passed': 0, 'total': 0}, time.time() - t0
    return results.data, time.time() - t0


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
    return data.get('failed', 1) == 0 and not data.get('fatal') and data.get('total', 0) > 0


def main():
    if not os.path.exists(CHROME):
        sys.exit('Google Chrome was not found; open tests/run.html?pass=desktop from a local server instead')
    n = build_page()
    only, headed = arg('--only'), '--headed' in sys.argv
    passes = ['baseline'] if '--baseline' in sys.argv else ['soak'] if '--soak' in sys.argv else [arg('--pass')] if arg('--pass') else DEFAULT_PASSES
    print(f'{n} suite files · passes: {", ".join(passes)}')
    all_ok = True
    for p in passes:
        data, wall = run_pass(p, 0, only, headed, timeout=1500 if p in ('baseline', 'soak') else 900)
        all_ok = report(data, wall) and all_ok
        if p == 'baseline' and data.get('baseline'):
            path = os.path.join(TESTS, 'baseline.json')
            json.dump(data['baseline'], open(path, 'w'), indent=2)
            print('  wrote tests/baseline.json:', json.dumps(data['baseline']))
    print('\nALL PASSED' if all_ok else '\nFAILURES')
    sys.exit(0 if all_ok else 1)


if __name__ == '__main__':
    main()
