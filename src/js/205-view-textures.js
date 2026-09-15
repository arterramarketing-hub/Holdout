// ---------- textures ----------
const CELL = 64, ATLAS = 512, PAD = 3, COLS = ATLAS / CELL;
const CELLS = { coat: 0, coatFront: 1, face: 2, skin: 3, metal: 4, wood: 5, helm: 6, leather: 7, puttee: 8, pants: 9,
  burlap: 10, crate: 11, mask: 12, hood: 13, white: 14, hide: 15, webbing: 16, stone: 17, leaf: 18, cape: 19, cloth: 0 };
function makeRng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function finishTex(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  else { t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; }
  return t;
}
function paintCanvas(size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  return c;
}
function paintAtlas() {   // every character texture, painted at 4x and shrunk so it reads like a hand-painted N64 map
  const B = CELL * 4, rnd = makeRng(7);
  const big = paintCanvas(B * COLS, g => {
    const cell = (i, base, fn) => {
      g.save(); g.translate((i % COLS) * B, ((i / COLS) | 0) * B);
      g.beginPath(); g.rect(0, 0, B, B); g.clip();
      g.fillStyle = base; g.fillRect(0, 0, B, B);
      if (fn) fn();
      g.restore();
    };
    const speck = (n, cols, w = 3, h = w) => {
      for (let k = 0; k < n; k++) { g.fillStyle = cols[(rnd() * cols.length) | 0]; g.fillRect(rnd() * B, rnd() * B, w, h); }
    };
    const vshade = (top, bottom) => {
      const gr = g.createLinearGradient(0, 0, 0, B);
      gr.addColorStop(0, top); gr.addColorStop(1, bottom);
      g.fillStyle = gr; g.fillRect(0, 0, B, B);
    };
    const folds = (n, a) => {
      for (let k = 0; k < n; k++) {
        const x = rnd() * B, w = 10 + rnd() * 26, gr = g.createLinearGradient(x - w, 0, x + w, 0);
        gr.addColorStop(0, 'rgba(40,30,20,0)'); gr.addColorStop(0.5, `rgba(40,30,20,${a})`); gr.addColorStop(1, 'rgba(40,30,20,0)');
        g.fillStyle = gr; g.fillRect(x - w, 0, w * 2, B);
      }
    };
    const wool = () => { speck(900, ['rgba(0,0,0,0.07)', 'rgba(255,255,255,0.08)'], 3, 2); folds(9, 0.22); vshade('rgba(255,255,255,0.1)', 'rgba(30,20,10,0.24)'); };
    const blob = (n, col, w, h) => {
      for (let k = 0; k < n; k++) {
        g.fillStyle = col; g.beginPath();
        g.ellipse(rnd() * B, rnd() * B, w * (0.5 + rnd()), h * (0.5 + rnd()), rnd() * Math.PI, 0, TAU); g.fill();
      }
    };
    const camo = () => {   // multi-tone battlefield camo; the palette colour tints it per army
      blob(40, 'rgba(120,100,70,0.34)', 26, 12);
      blob(34, 'rgba(70,84,50,0.38)', 20, 10);
      blob(26, 'rgba(50,42,32,0.3)', 12, 6);
      blob(22, 'rgba(255,250,230,0.26)', 16, 7);
      speck(700, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.06)'], 2, 2);
      folds(5, 0.14);
      vshade('rgba(255,255,255,0.08)', 'rgba(30,20,10,0.22)');
    };
    cell(CELLS.coat, '#e6e2d4', camo);
    cell(CELLS.coatFront, '#e6e2d4', () => {   // combat shirt; the front of a cylinder UV sits at u = 0.5
      camo();
      g.fillStyle = 'rgba(40,36,28,0.4)'; g.fillRect(B * 0.5 - 2, 0, 4, B);
      g.fillStyle = 'rgba(60,54,40,0.35)'; g.fillRect(B * 0.3, B * 0.3, B * 0.13, B * 0.09); g.fillRect(B * 0.57, B * 0.3, B * 0.13, B * 0.09);
    });
    cell(CELLS.face, '#f2d4b2', () => {   // the front of a sphere UV sits at u = 0.75
      speck(200, ['rgba(160,100,70,0.08)'], 4);
      const cx = B * 0.75, ey = B * 0.52;
      g.fillStyle = 'rgba(210,120,90,0.24)';
      g.beginPath(); g.ellipse(cx - 32, ey + 30, 16, 10, 0, 0, TAU); g.ellipse(cx + 32, ey + 30, 16, 10, 0, 0, TAU); g.fill();
      g.fillStyle = '#4a2e1a'; g.fillRect(cx - 44, ey - 26, 32, 8); g.fillRect(cx + 12, ey - 26, 32, 8);
      for (const ox of [-27, 27]) {
        g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(cx + ox, ey, 14, 11, 0, 0, TAU); g.fill();
        g.fillStyle = '#3a4c6c'; g.beginPath(); g.ellipse(cx + ox + 2, ey + 1, 8, 10, 0, 0, TAU); g.fill();
        g.fillStyle = '#0e1218'; g.beginPath(); g.arc(cx + ox + 2, ey + 1, 4, 0, TAU); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(cx + ox - 2, ey - 5, 3, 3);
      }
      g.fillStyle = 'rgba(150,90,60,0.4)';
      g.beginPath(); g.moveTo(cx, ey + 4); g.lineTo(cx - 9, ey + 34); g.lineTo(cx + 7, ey + 36); g.fill();
      g.fillStyle = '#8a4a3a'; g.fillRect(cx - 15, ey + 52, 30, 5);
      g.fillStyle = 'rgba(70,56,44,0.16)'; g.fillRect(cx - 40, ey + 44, 80, 40);   // stubble
      g.fillStyle = 'rgba(60,50,40,0.18)'; g.fillRect(cx - 50, ey - 44, 100, 14);  // camo cream smudge
    });
    cell(CELLS.skin, '#f2d4b2', () => speck(200, ['rgba(160,100,70,0.1)'], 4));
    cell(CELLS.metal, '#c6cace', () => {
      speck(400, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.18)'], 5, 2);
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(0, B * 0.18, B, 10);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, B * 0.8, B, 16);
    });
    cell(CELLS.wood, '#d8a46a', () => {
      for (let y = 0; y < B; y += 10 + rnd() * 10) { g.fillStyle = 'rgba(90,50,20,0.35)'; g.fillRect(0, y, B, 2 + rnd() * 3); }
      speck(200, ['rgba(90,50,20,0.15)', 'rgba(255,230,180,0.15)'], 8, 2);
    });
    cell(CELLS.helm, '#dcd6c2', () => {   // helmet cover: rough fabric, velcro patches, bungee lines (also tyres)
      speck(900, ['rgba(0,0,0,0.1)', 'rgba(255,255,255,0.1)'], 3, 3);
      blob(18, 'rgba(90,80,60,0.22)', 18, 10);
      g.fillStyle = 'rgba(60,54,42,0.4)'; g.fillRect(B * 0.1, B * 0.42, B * 0.16, B * 0.12); g.fillRect(B * 0.6, B * 0.42, B * 0.16, B * 0.12);
      g.strokeStyle = 'rgba(40,36,30,0.45)'; g.lineWidth = 5;
      for (const y of [0.25, 0.7]) { g.beginPath(); g.moveTo(0, B * y); g.lineTo(B, B * y + 10); g.stroke(); }
      vshade('rgba(255,255,255,0.14)', 'rgba(20,20,10,0.28)');
    });
    cell(CELLS.leather, '#d2aa82', () => {
      speck(300, ['rgba(60,30,10,0.12)'], 6, 3);
      for (let k = 0; k < 10; k++) { g.fillStyle = 'rgba(60,30,10,0.3)'; g.fillRect(0, rnd() * B, B, 3); }
      vshade('rgba(255,240,220,0.12)', 'rgba(30,15,5,0.3)');
    });
    cell(CELLS.puttee, '#e6e2d4', () => {   // lower leg: camo trouser bloused over a laced combat boot
      camo();
      g.fillStyle = 'rgba(130,100,70,0.75)'; g.fillRect(0, B * 0.62, B, B * 0.38);
      g.strokeStyle = 'rgba(40,30,20,0.6)'; g.lineWidth = 4;
      for (let y = B * 0.66; y < B; y += 16) { g.beginPath(); g.moveTo(B * 0.4, y); g.lineTo(B * 0.6, y + 8); g.moveTo(B * 0.6, y); g.lineTo(B * 0.4, y + 8); g.stroke(); }
      g.fillStyle = 'rgba(30,24,18,0.35)'; g.fillRect(0, B * 0.6, B, 8);
    });
    cell(CELLS.pants, '#e6e2d4', () => { camo(); g.fillStyle = 'rgba(50,44,34,0.25)'; g.fillRect(B * 0.62, B * 0.2, B * 0.2, B * 0.24); });
    cell(CELLS.burlap, '#dccb9e', () => {
      for (let y = 0; y < B; y += 6) { g.fillStyle = 'rgba(90,70,40,0.12)'; g.fillRect(0, y, B, 2); }
      for (let x = 0; x < B; x += 6) { g.fillStyle = 'rgba(90,70,40,0.1)'; g.fillRect(x, 0, 2, B); }
      g.fillStyle = 'rgba(80,60,30,0.35)'; g.fillRect(0, B * 0.47, B, 8);
      vshade('rgba(255,255,230,0.1)', 'rgba(50,40,20,0.28)');
    });
    cell(CELLS.crate, '#d8d4c0', () => {   // painted ammunition crate: rails, stencil block, rope handle
      speck(500, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.08)'], 4, 3);
      g.fillStyle = 'rgba(40,40,30,0.35)'; g.fillRect(0, B * 0.12, B, 12); g.fillRect(0, B * 0.84, B, 12);
      g.fillStyle = 'rgba(255,255,240,0.55)';
      for (let k = 0; k < 5; k++) g.fillRect(B * (0.22 + k * 0.11), B * 0.34, B * 0.08, B * 0.12);
      g.fillRect(B * 0.22, B * 0.52, B * 0.5, B * 0.05);
      g.strokeStyle = 'rgba(30,26,20,0.6)'; g.lineWidth = 8; g.beginPath(); g.arc(B * 0.5, B * 0.7, B * 0.1, 0, Math.PI); g.stroke();
      g.fillStyle = 'rgba(60,60,60,0.5)'; for (const [x, y] of [[0, 0], [B - 26, 0], [0, B - 26], [B - 26, B - 26]]) g.fillRect(x, y, 26, 26);
    });
    cell(CELLS.mask, '#4c4a46', () => {   // knit balaclava with tactical goggles; lenses catch an orange glint
      for (let x = 0; x < B; x += 7) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, 0, 3, B); }
      speck(400, ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0.1)'], 3);
      const cx = B * 0.75, ey = B * 0.48;
      g.fillStyle = '#1a1a18'; g.fillRect(0, ey - 12, B, 22);
      g.beginPath(); g.ellipse(cx, ey, 60, 30, 0, 0, TAU); g.fill();
      for (const ox of [-28, 28]) {
        const gr = g.createLinearGradient(cx + ox - 20, ey - 18, cx + ox + 20, ey + 18);
        gr.addColorStop(0, '#ffb050'); gr.addColorStop(0.35, '#a03a14'); gr.addColorStop(1, '#1a0a06');
        g.fillStyle = gr; g.beginPath(); g.ellipse(cx + ox, ey, 23, 19, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,240,200,0.8)'; g.fillRect(cx + ox - 12, ey - 10, 7, 5);
      }
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(cx - 22, ey + 50, 44, 26);
    });
    cell(CELLS.hood, '#d8d4c8', () => {   // knit cap
      for (let x = 0; x < B; x += 8) { g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(x, 0, 3, B); }
      speck(400, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.08)'], 3);
      vshade('rgba(255,255,255,0.1)', 'rgba(30,20,10,0.24)');
    });
    cell(CELLS.white, '#ffffff');
    cell(CELLS.hide, '#e2dcd0', () => {   // quad bike plastics: panel seams, decal stripe, mud thrown up from below
      speck(300, ['rgba(0,0,0,0.06)', 'rgba(255,255,255,0.1)'], 6, 3);
      g.fillStyle = 'rgba(40,36,30,0.4)'; g.fillRect(0, B * 0.35, B, 5); g.fillRect(B * 0.48, 0, 5, B);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, B * 0.2, B, 14);
      for (let k = 0; k < 40; k++) {
        const x = rnd() * B, y = B * (0.6 + rnd() * 0.4), r = 6 + rnd() * 18, gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(90,70,40,0.4)'); gr.addColorStop(1, 'rgba(90,70,40,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    });
    cell(CELLS.webbing, '#e0dccb', () => {   // MOLLE: rows of nylon strap with bar-tack stitching
      speck(300, ['rgba(0,0,0,0.06)'], 3);
      for (let y = 10; y < B; y += 32) {
        g.fillStyle = 'rgba(40,36,26,0.34)'; g.fillRect(0, y, B, 6); g.fillRect(0, y + 18, B, 4);
        g.fillStyle = 'rgba(30,26,18,0.5)';
        for (let x = 12; x < B; x += 40) g.fillRect(x, y, 5, 22);
      }
      vshade('rgba(255,255,255,0.08)', 'rgba(30,20,10,0.24)');
    });
    cell(CELLS.stone, '#c4c2ba', () => speck(500, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.12)'], 8));
    cell(CELLS.leaf, '#b4d494', () => speck(500, ['rgba(40,80,20,0.2)', 'rgba(240,255,200,0.15)'], 8));
    cell(CELLS.cape, '#d8d4cc', () => {   // bomb-suit armour fabric: quilted panels, bolts, scorch
      speck(600, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.08)'], 3);
      g.strokeStyle = 'rgba(30,28,24,0.5)'; g.lineWidth = 6;
      for (let v = 0; v <= B; v += B / 4) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, B); g.moveTo(0, v); g.lineTo(B, v); g.stroke(); }
      g.fillStyle = 'rgba(220,210,190,0.7)';
      for (let x = B / 8; x < B; x += B / 4) for (let y = B / 8; y < B; y += B / 4) { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); }
      blob(8, 'rgba(20,16,12,0.25)', 24, 16);
    });
  });
  return paintCanvas(ATLAS, (g, s) => { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, s, s); });
}
function buildTextures() {
  return {
    atlas: finishTex(paintAtlas(), false),
    blob: finishTex(paintCanvas(32, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.4)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }), false),
    crater: finishTex(paintCanvas(64, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(30,22,16,0.9)'); gr.addColorStop(0.55, 'rgba(60,45,30,0.75)');
      gr.addColorStop(0.8, 'rgba(90,70,45,0.35)'); gr.addColorStop(1, 'rgba(90,70,45,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }), false),
    glow: finishTex(paintCanvas(32, (g, s) => {
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }), false),
    ring: finishTex(paintCanvas(64, (g, s) => {
      g.strokeStyle = '#ffffff'; g.lineWidth = 5;
      g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 5, 0, TAU); g.stroke();
    }), false),
    bloom: finishTex(paintCanvas(64, (g, s) => {   // a muzzle bloom: a hot centre that falls away softly, no hard edge anywhere
      const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      [[0, 1], [0.1, 0.92], [0.24, 0.55], [0.42, 0.24], [0.62, 0.08], [0.82, 0.02], [1, 0]].forEach(([o, a]) => gr.addColorStop(o, `rgba(255,255,255,${a})`));
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }), false),
  };
}

