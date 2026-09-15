# Holdout

[![Tests](https://github.com/arterramarketing-hub/Holdout/actions/workflows/ci.yml/badge.svg)](https://github.com/arterramarketing-hub/Holdout/actions/workflows/ci.yml)

A browser squad shooter in an N64 style: you and three squadmates against eight at a time, fought through Valmont, a
mountain town, for thirteen sectors of a theater map. Models, textures, animation, sound and music are all generated
in code; there are no asset files.

Play: open `index.html` in a browser (three.js loads from a CDN, so it needs a connection), or serve the folder over
http. It is also published on GitHub Pages from this repository.

- First person with manual aim by default; V switches to third person.
- Each sector is fought over three landmark objectives; hold more than the enemy to bleed their reserves, then
  kill the Warlord.
- Desktop: WASD move, mouse aims (click to capture it), left mouse fires, right mouse aims down sights, Shift
  sprints, G throws a grenade, R reloads, 1/2/3 killstreaks, M mutes, O settings.
- Phone (landscape): left thumb moves (push to the rim to sprint), right thumb looks; fire, ADS, reload and
  grenade buttons on the right.
- Controller: sticks move and look, RT fire, LT sights, RB grenade, X reload, Y view, L3 sprint, D-pad killstreaks.
- Settings include graphics quality (Auto, Low, Medium, High) and squad callouts; the firing range next to settings
  on the start menu teaches the controls.

## Working on it

`index.html` is a build product. Edit the sources and rebuild:

```
src/shell.html     the document, with @@header @@css @@markup @@js where the parts go
src/header.txt     the design notes (the comment at the top of index.html)
src/css/*.css      the stylesheet, joined in filename order
src/markup.html    the body markup
src/js/*.js        the game script, joined in filename order (one classic script: top-level names are shared)
```

```
python3 tools/build.py            # write index.html
python3 tools/build.py --check    # confirm index.html matches src/
python3 tools/test.py             # the test suites in headless Chrome (desktop and touch passes)
python3 tools/test.py --only nav  # a subset
python3 tools/test.py --baseline  # re-record tests/baseline.json
```

Tests live in `tests/suites/*.test.js` and drive the game directly (`tick`, `G.frame`, a first-person bot) against an
in-memory save, so a run never touches a real campaign. The runner needs Google Chrome installed (or `CHROME` set to
its path).

## Tests on GitHub, and the published site

`.github/workflows/ci.yml` runs every suite on each push and pull request, in headless Chrome on Ubuntu. When a push
to `main` passes, the workflow assembles the site (`python3 tools/build.py --site _site`: only what is published)
and pushes it as a single commit to the `gh-pages` branch. A failing run publishes nothing, so the live game stays on
the last build that passed.

GitHub Pages serves whichever branch **Settings › Pages › Build and deployment › Branch** names. Set it to
`gh-pages` and `/ (root)` once the first run is green; while it still says `main`, every push goes live untested.
