"""Build Holdout's index.html from src/.

The game is one classic script. The sources are that script, its stylesheet and its markup cut into files. The build
joins them in filename order into the single index.html that GitHub Pages and the Artifact serve, so top-level names
stay shared exactly as they were in one file.

  src/shell.html      the document; @@header, @@css, @@markup and @@js mark where the parts go
  src/header.txt      the design notes comment
  src/css/*.css       the stylesheet, in filename order
  src/markup.html     the body markup
  src/js/*.js         the game script, in filename order
  src/pwa/            the installed app: manifest.webmanifest and the service worker template sw.js (the build fills in
                      a version hashed from everything it caches, so every build ships a new worker)
  icons/              the app icons (tools/icons.py draws them)

usage:
  python3 tools/build.py            write index.html
  python3 tools/build.py --check    exit 1 if index.html, manifest.webmanifest or sw.js is not what src/ builds (the audit gate)
  python3 tools/build.py --preview  also copy it to the local preview server, when that folder exists
  python3 tools/build.py --site DIR assemble only what GitHub Pages publishes into DIR (CI deploys this)
"""
import hashlib
import json
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src')
OUT = os.path.join(ROOT, 'index.html')
PREVIEW = os.path.expanduser('~/.claude/holdout-preview/www/index.html')


def body_lines(path):   # a source file's lines, exactly: one trailing newline is the file's own, not a blank line
    text = open(path, encoding='utf-8', newline='').read()
    if text.endswith('\n'):
        text = text[:-1]
    return text.split('\n')


def part(folder, ext):
    d = os.path.join(SRC, folder)
    names = sorted(n for n in os.listdir(d) if n.endswith(ext) and not n.startswith('.'))
    if not names:
        sys.exit(f'no {ext} files in src/{folder}')
    out = []
    for n in names:
        out += body_lines(os.path.join(d, n))
    return out


def build():
    parts = {
        '@@header': body_lines(os.path.join(SRC, 'header.txt')),
        '@@css': part('css', '.css'),
        '@@markup': body_lines(os.path.join(SRC, 'markup.html')),
        '@@js': part('js', '.js'),
    }
    shell = open(os.path.join(SRC, 'shell.html'), encoding='utf-8', newline='').read().split('\n')
    out, seen = [], set()
    for ln in shell:
        if ln in parts:
            out += parts[ln]
            seen.add(ln)
        else:
            out.append(ln)
    missing = set(parts) - seen
    if missing:
        sys.exit(f'shell.html is missing {sorted(missing)}')
    return '\n'.join(out)


ICONS = ['icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png']
SITE_FILES = ['index.html', 'manifest.webmanifest', 'sw.js'] + ICONS   # everything the published site is made of, relative to the repository root


def app_files(html):   # the built manifest and service worker, from src/pwa and the page they serve
    manifest = open(os.path.join(SRC, 'pwa', 'manifest.webmanifest'), encoding='utf-8', newline='').read()
    json.loads(manifest)   # a broken manifest fails the build, not an install on someone's phone
    h = hashlib.sha256(html.encode('utf-8') + manifest.encode('utf-8'))
    for rel in ICONS:
        h.update(open(os.path.join(ROOT, rel), 'rb').read())
    shell = ['./', './index.html', './manifest.webmanifest'] + ['./' + rel for rel in ICONS]
    sw = open(os.path.join(SRC, 'pwa', 'sw.js'), encoding='utf-8', newline='').read()
    sw = sw.replace('@@VERSION', h.hexdigest()[:12]).replace('@@PRECACHE', json.dumps(shell))
    return {'manifest.webmanifest': manifest, 'sw.js': sw}


def assemble_site(out, html):
    out = os.path.abspath(out)
    if out in (ROOT, SRC) or ROOT.startswith(out + os.sep) or os.path.exists(os.path.join(out, '.git')):
        sys.exit(f'refusing to assemble the site into {out}')
    shutil.rmtree(out, ignore_errors=True)
    os.makedirs(out)
    built = dict(app_files(html), **{'index.html': html})
    for rel in SITE_FILES:
        dst = os.path.join(out, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if rel in built:
            with open(dst, 'w', encoding='utf-8', newline='') as f:
                f.write(built[rel])
        else:
            shutil.copyfile(os.path.join(ROOT, rel), dst)
    open(os.path.join(out, '.nojekyll'), 'w').close()   # served as plain files, no Jekyll pass
    print(f'site assembled in {out}: {", ".join(sorted(SITE_FILES))}')


def main():
    html = build()
    if '--site' in sys.argv:
        i = sys.argv.index('--site')
        if i + 1 >= len(sys.argv):
            sys.exit('--site needs a folder')
        assemble_site(sys.argv[i + 1], html)
        return
    digest = hashlib.sha256(html.encode('utf-8')).hexdigest()[:12]
    built = dict(app_files(html), **{'index.html': html})
    if '--check' in sys.argv:
        stale = [rel for rel, text in built.items()
                 if not os.path.exists(os.path.join(ROOT, rel)) or open(os.path.join(ROOT, rel), encoding='utf-8', newline='').read() != text]
        if stale:
            print(f'{", ".join(stale)} STALE: run python3 tools/build.py')
            sys.exit(1)
        print(f'index.html is current ({len(html.encode("utf-8"))} bytes, sha256 {digest}); manifest.webmanifest and sw.js too')
        return
    for rel, text in built.items():
        with open(os.path.join(ROOT, rel), 'w', encoding='utf-8', newline='') as f:
            f.write(text)
    print(f'built index.html ({len(html.encode("utf-8"))} bytes, sha256 {digest}), manifest.webmanifest and sw.js')
    if '--preview' in sys.argv and os.path.isdir(os.path.dirname(PREVIEW)):
        www = os.path.dirname(PREVIEW)
        for rel in SITE_FILES:
            os.makedirs(os.path.dirname(os.path.join(www, rel)), exist_ok=True)
            shutil.copyfile(os.path.join(ROOT, rel), os.path.join(www, rel))
        print('copied to the preview server')


if __name__ == '__main__':
    main()
