// ---------- N64 output: 480-line hi-res render, RGB555 with ordered dither, whole-number nearest upscale ----------
const N64 = { lines: 480, scale: 1, target: null, scene: null, cam: null, mat: null };
function initN64() {
  N64.target = new THREE.WebGLRenderTarget(4, 4, { depthBuffer: true });
  N64.target.texture.minFilter = N64.target.texture.magFilter = THREE.NearestFilter;
  N64.scene = new THREE.Scene();
  N64.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  N64.mat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: N64.target.texture }, uScale: { value: 1 }, uSize: { value: new THREE.Vector2(4, 4) } },
    vertexShader: 'void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uScale;
      uniform vec2 uSize;
      const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
      vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      void main() {
        vec2 texel = floor(gl_FragCoord.xy / uScale);
        vec3 c = toSRGB(texture2D(tDiffuse, (texel + 0.5) / uSize).rgb);
        vec2 p = mod(texel, 4.0);
        float d = BAYER[int(p.x) + int(p.y) * 4] / 16.0 - 0.47;
        gl_FragColor = vec4(floor(c * 31.0 + d + 0.5) / 31.0, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), N64.mat);
  quad.frustumCulled = false;
  N64.scene.add(quad);
  VIEW.renderer.info.autoReset = false;
}
function n64Render() {
  const r = VIEW.renderer;
  r.info.reset();
  r.setRenderTarget(N64.target);
  r.render(VIEW.scene, VIEW.camera);
  r.setRenderTarget(null);
  r.render(N64.scene, N64.cam);
}

// ---------- painted environment textures: drawn large, shrunk to N64 sizes so they read soft ----------
function paintEnvTextures() {
  const rnd = makeRng(99);
  const soft = (size, scale, paint, repeat) => {
    const big = paintCanvas(size * scale, paint);
    const small = paintCanvas(size, (g, s) => { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(big, 0, 0, s, s); });
    return finishTex(small, repeat);
  };
  const wrap = (g, s, x, y, fn) => { for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) fn(x + ox, y + oy); };
  const blotch = (g, x, y, r, rgb, a) => {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  };
  const tex = {};
  tex.ground = soft(64, 4, (g, s) => {   // neutral light blotches + grass strokes; vertex colours carry the hue
    g.fillStyle = '#d8d8c6'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 70; k++) { const x = rnd() * s, y = rnd() * s, r = 18 + rnd() * 40; wrap(g, s, x, y, (px, py) => blotch(g, px, py, r, '140,140,120', 0.4)); }
    for (let k = 0; k < 60; k++) { const x = rnd() * s, y = rnd() * s, r = 14 + rnd() * 34; wrap(g, s, x, y, (px, py) => blotch(g, px, py, r, '245,245,225', 0.45)); }
    for (let k = 0; k < 1100; k++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(90,90,70,0.3)' : 'rgba(255,255,235,0.3)';
      g.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 2, 3 + rnd() * 6);
    }
  }, true);
  tex.bark = soft(64, 4, (g, s) => {
    g.fillStyle = '#6c5a46'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 90; k++) {
      const x = rnd() * s, w = 2 + rnd() * 6;
      g.fillStyle = rnd() < 0.6 ? 'rgba(40,30,22,0.55)' : 'rgba(150,130,100,0.35)';
      g.beginPath(); g.moveTo(x, 0);
      for (let y = 0; y <= s; y += 16) g.lineTo(x + Math.sin(y * 0.05 + k) * 4, y);
      g.lineTo(x + w, s); g.lineTo(x + w, 0); g.closePath(); g.fill();
    }
  }, true);
  tex.foliage = soft(128, 4, (g, s) => {   // a drooping spruce bough, transparent around it
    for (let k = 0; k < 170; k++) {
      const t = rnd(), x = s * (0.04 + rnd() * 0.92), y = s * (0.3 + t * 0.5 + Math.abs(x / s - 0.5) * 0.25);
      const r = s * (0.03 + rnd() * 0.06);
      g.fillStyle = ['#23461f', '#2f5a28', '#3a6c30'][(rnd() * 3) | 0];
      g.beginPath(); g.ellipse(x, y, r * 1.6, r, rnd() * 0.6 - 0.3, 0, TAU); g.fill();
    }
    for (let k = 0; k < 90; k++) {
      const x = s * (0.08 + rnd() * 0.84), y = s * (0.3 + rnd() * 0.42);
      g.fillStyle = rnd() < 0.5 ? '#5a8c3c' : '#6fa246';
      g.beginPath(); g.ellipse(x, y, s * 0.035, s * 0.016, 0, 0, TAU); g.fill();
    }
  }, false);
  tex.bush = soft(64, 4, (g, s) => {
    for (let k = 0; k < 120; k++) {
      const a = rnd() * Math.PI, rr = rnd() * 0.42, x = s * (0.5 + Math.cos(a) * rr), y = s * (0.95 - Math.sin(a) * rr * 1.4);
      g.fillStyle = ['#2e5226', '#3d6a30', '#4e7e38'][(rnd() * 3) | 0];
      g.beginPath(); g.arc(x, y, s * (0.04 + rnd() * 0.05), 0, TAU); g.fill();
    }
    for (let k = 0; k < 40; k++) {
      const a = rnd() * Math.PI, rr = rnd() * 0.36;
      g.fillStyle = '#78a44a'; g.beginPath(); g.arc(s * (0.5 + Math.cos(a) * rr), s * (0.9 - Math.sin(a) * rr * 1.4), s * 0.02, 0, TAU); g.fill();
    }
  }, false);
  tex.stone = soft(64, 4, (g, s) => {   // dressed stone courses, lighter faces, grime at the base
    g.fillStyle = '#7e7c76'; g.fillRect(0, 0, s, s);
    const rows = 4, rh = s / rows;
    for (let r0 = 0; r0 < rows; r0++) {
      let x = r0 % 2 ? -rh : 0;
      while (x < s) {
        const w = rh * (1.4 + rnd() * 0.9), v = 188 + (rnd() * 26 | 0), m = 5;
        const bx = x + m / 2, by = r0 * rh + m / 2, bw = w - m, bh = rh - m;
        g.fillStyle = `rgb(${v},${v},${v - 8})`; g.fillRect(bx, by, bw, bh);
        g.fillStyle = 'rgba(255,255,245,0.35)'; g.fillRect(bx, by, bw, 6);
        g.fillStyle = 'rgba(40,38,34,0.3)'; g.fillRect(bx, by + bh - 8, bw, 8);
        for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(60,58,52,0.18)'; g.fillRect(bx + rnd() * bw, by + rnd() * bh, 4, 3); }
        x += w;
      }
    }
    const gr = g.createLinearGradient(0, s * 0.6, 0, s);
    gr.addColorStop(0, 'rgba(50,48,40,0)'); gr.addColorStop(1, 'rgba(50,48,40,0.35)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }, true);
  tex.rock = soft(64, 4, (g, s) => {
    g.fillStyle = '#8a8580'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 60; k++) wrap(g, s, rnd() * s, rnd() * s, (x, y) => blotch(g, x, y, 10 + rnd() * 30, rnd() < 0.5 ? '60,56,52' : '170,166,158', 0.4));
    g.strokeStyle = 'rgba(40,36,32,0.5)'; g.lineWidth = 3;
    for (let k = 0; k < 10; k++) { g.beginPath(); let x = rnd() * s, y = rnd() * s; g.moveTo(x, y); for (let q = 0; q < 4; q++) { x += rnd() * 40 - 20; y += rnd() * 40; g.lineTo(x, y); } g.stroke(); }
  }, true);
  tex.cloud = soft(128, 2, (g, s) => {   // streaky painted cumulus
    for (let k = 0; k < 46; k++) {
      const x = s * (0.12 + rnd() * 0.76), y = s * (0.42 + rnd() * 0.22), rx = s * (0.08 + rnd() * 0.16);
      const gr = g.createRadialGradient(x, y, 0, x, y, rx);
      gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, rx * 0.34, 0, 0, TAU); g.fill();
    }
  }, false);
  tex.concrete = soft(64, 4, (g, s) => {   // poured concrete: panel seams, water stains, chips
    g.fillStyle = '#b8b6b0'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 50; k++) wrap(g, s, rnd() * s, rnd() * s, (x, y) => blotch(g, x, y, 10 + rnd() * 30, rnd() < 0.6 ? '90,88,80' : '220,218,210', 0.25));
    for (let k = 0; k < 14; k++) {
      const x = rnd() * s, gr = g.createLinearGradient(0, 0, 0, s);
      gr.addColorStop(0, 'rgba(60,56,50,0.3)'); gr.addColorStop(1, 'rgba(60,56,50,0)');
      g.fillStyle = gr; g.fillRect(x, 0, 3 + rnd() * 8, s * (0.3 + rnd() * 0.6));
    }
    g.fillStyle = 'rgba(50,48,44,0.45)'; g.fillRect(0, s / 2 - 2, s, 4); g.fillRect(s / 2 - 2, 0, 4, s);
    for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(70,68,62,0.35)'; g.fillRect(rnd() * s, rnd() * s, 3 + rnd() * 6, 2 + rnd() * 4); }
  }, true);
  tex.hesco = soft(64, 4, (g, s) => {   // HESCO bastion: geotextile bag behind a welded wire grid
    g.fillStyle = '#c8b894'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 40; k++) wrap(g, s, rnd() * s, rnd() * s, (x, y) => blotch(g, x, y, 12 + rnd() * 24, rnd() < 0.5 ? '120,100,70' : '230,220,190', 0.3));
    g.lineWidth = 4; g.strokeStyle = 'rgba(70,70,64,0.8)';
    for (let v = 0; v <= s; v += s / 4) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, s); g.moveTo(0, v); g.lineTo(s, v); g.stroke(); }
    g.lineWidth = 2; g.strokeStyle = 'rgba(230,230,220,0.35)';
    for (let v = 3; v <= s; v += s / 4) { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, s); g.moveTo(0, v); g.lineTo(s, v); g.stroke(); }
  }, true);
  tex.facade = soft(64, 4, (g, s) => {   // shelled apartment block: concrete bands, blown-out windows, scorch
    g.fillStyle = '#b4b0a6'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 30; k++) wrap(g, s, rnd() * s, rnd() * s, (x, y) => blotch(g, x, y, 10 + rnd() * 26, '80,76,70', 0.25));
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
      const x = s * (0.12 + c * 0.5), y = s * (0.18 + r * 0.5), w = s * 0.26, hh = s * 0.22;
      g.fillStyle = rnd() < 0.3 ? '#3a342c' : '#141414'; g.fillRect(x, y, w, hh);
      g.fillStyle = 'rgba(40,36,30,0.35)'; g.fillRect(x - 3, y + hh, w + 6, 6);
    }
    g.fillStyle = 'rgba(60,56,50,0.5)'; g.fillRect(0, s * 0.46, s, 6); g.fillRect(0, s * 0.96, s, 6);
  }, true);
  tex.house = soft(64, 4, (g, s) => {   // one bay of an alpine house: limewashed plaster, shuttered window, stone sill
    g.fillStyle = '#ece6da'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 40; k++) wrap(g, s, rnd() * s, rnd() * s, (x, y) => blotch(g, x, y, 10 + rnd() * 26, rnd() < 0.5 ? '150,140,120' : '255,250,240', 0.22));
    const wx = s * 0.34, wy = s * 0.24, ww = s * 0.32, wh = s * 0.42;
    g.fillStyle = '#5a4630'; g.fillRect(wx - s * 0.17, wy, s * 0.15, wh); g.fillRect(wx + ww + s * 0.02, wy, s * 0.15, wh);
    g.fillStyle = 'rgba(30,20,10,0.35)';
    for (let y = wy + 6; y < wy + wh; y += 10) { g.fillRect(wx - s * 0.17, y, s * 0.15, 3); g.fillRect(wx + ww + s * 0.02, y, s * 0.15, 3); }
    g.fillStyle = '#6a5438'; g.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
    g.fillStyle = '#1c2228'; g.fillRect(wx, wy, ww, wh);
    g.fillStyle = 'rgba(160,190,210,0.35)'; g.fillRect(wx + 4, wy + 4, ww * 0.35, wh * 0.4);
    g.fillStyle = '#6a5438'; g.fillRect(wx + ww / 2 - 3, wy, 6, wh); g.fillRect(wx, wy + wh / 2 - 3, ww, 6);
    g.fillStyle = '#9a948a'; g.fillRect(wx - 10, wy + wh + 4, ww + 20, 10);
    const gr = g.createLinearGradient(0, s * 0.75, 0, s);
    gr.addColorStop(0, 'rgba(60,50,40,0)'); gr.addColorStop(1, 'rgba(60,50,40,0.3)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }, true);
  tex.roof = soft(64, 4, (g, s) => {   // slate courses
    g.fillStyle = '#d8d4cc'; g.fillRect(0, 0, s, s);
    const rows = 8, rh = s / rows;
    for (let r = 0; r < rows; r++)
      for (let x = r % 2 ? -rh * 0.6 : 0; x < s; x += rh * 1.2) {
        const v = 170 + (rnd() * 60 | 0);
        g.fillStyle = `rgb(${v},${v},${v - 6})`; g.fillRect(x + 2, r * rh + 2, rh * 1.2 - 4, rh - 3);
        g.fillStyle = 'rgba(20,20,20,0.35)'; g.fillRect(x + 2, (r + 1) * rh - 5, rh * 1.2 - 4, 4);
      }
  }, true);
  tex.cobble = soft(64, 4, (g, s) => {   // setts laid in staggered rows
    g.fillStyle = '#7a766e'; g.fillRect(0, 0, s, s);
    const n = 8, c = s / n;
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
      const x = k * c + (r % 2 ? c / 2 : 0), v = 190 + (rnd() * 50 | 0);
      g.fillStyle = `rgb(${v},${v - 4},${v - 12})`;
      for (const ox of [0, -s]) { g.beginPath(); g.ellipse(x + ox + c / 2, r * c + c / 2, c * 0.44, c * 0.4, 0, 0, TAU); g.fill(); }
    }
  }, true);
  tex.asphalt = soft(64, 4, (g, s) => {   // worn asphalt: dark grain, pale aggregate, a crack or two
    g.fillStyle = '#6c6c6a'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 2600; k++) { g.fillStyle = rnd() < 0.5 ? 'rgba(30,30,30,0.35)' : 'rgba(210,210,200,0.2)'; g.fillRect(rnd() * s, rnd() * s, 2, 2); }
    for (let k = 0; k < 18; k++) wrap(g, s, rnd() * s, rnd() * s, (x, y) => blotch(g, x, y, 14 + rnd() * 30, rnd() < 0.5 ? '40,40,40' : '160,160,150', 0.16));
    g.strokeStyle = 'rgba(25,25,25,0.5)'; g.lineWidth = 2;
    for (let k = 0; k < 3; k++) { g.beginPath(); let x = rnd() * s, y = rnd() * s; g.moveTo(x, y); for (let q = 0; q < 5; q++) { x += rnd() * 30 - 15; y += rnd() * 30 - 15; g.lineTo(x, y); } g.stroke(); }
  }, true);
  tex.paving = soft(64, 4, (g, s) => {   // square flagstones, each its own shade
    g.fillStyle = '#8e8a82'; g.fillRect(0, 0, s, s);
    const n = 4, c = s / n;
    for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) {
      const v = 175 + (rnd() * 45 | 0);
      g.fillStyle = `rgb(${v},${v - 3},${v - 10})`; g.fillRect(q * c + 3, r * c + 3, c - 6, c - 6);
      for (let d = 0; d < 12; d++) { g.fillStyle = 'rgba(60,56,50,0.15)'; g.fillRect(q * c + 3 + rnd() * (c - 8), r * c + 3 + rnd() * (c - 8), 3, 3); }
    }
  }, true);
  tex.gravel = soft(64, 4, (g, s) => {
    g.fillStyle = '#9a9488'; g.fillRect(0, 0, s, s);
    for (let k = 0; k < 3000; k++) { const v = 90 + (rnd() * 140 | 0); g.fillStyle = `rgba(${v},${v - 6},${v - 14},0.6)`; g.fillRect(rnd() * s, rnd() * s, 2 + rnd() * 3, 2 + rnd() * 2); }
  }, true);
  tex.metalWall = soft(64, 4, (g, s) => {   // corrugated sheet: ridges and streaks of rust
    g.fillStyle = '#c8c8c4'; g.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 12) { g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(x, 0, 4, s); g.fillStyle = 'rgba(40,40,40,0.25)'; g.fillRect(x + 7, 0, 4, s); }
    for (let k = 0; k < 14; k++) { const x = rnd() * s, gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, 'rgba(120,70,30,0.35)'); gr.addColorStop(1, 'rgba(120,70,30,0)'); g.fillStyle = gr; g.fillRect(x, 0, 3 + rnd() * 6, s * (0.2 + rnd() * 0.7)); }
  }, true);
  tex.chain = soft(64, 4, (g, s) => {   // chain-link: a diamond mesh with holes, alpha-tested
    g.clearRect(0, 0, s, s); g.strokeStyle = 'rgba(196,200,204,1)'; g.lineWidth = 5;
    for (let k = -s; k < s * 2; k += s / 4) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + s, s); g.moveTo(k + s, 0); g.lineTo(k, s); g.stroke(); }
  }, true);
  return tex;
}
function crossCards(n) {   // n vertical quads crossed through the Y axis, base at y = 0: N64 foliage
  const pos = [], uv = [], nor = [], idx = [];
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, b = pos.length / 3;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    for (let q = 0; q < 4; q++) nor.push(0, 1, 0);   // lit like the ground so cards never go dark edge-on
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
function rockGeometry(seed) {   // faceted boulder: an icosahedron with its corners pushed around
  const g = new THREE.IcosahedronGeometry(1, 0), p = g.attributes.position, r = makeRng(seed), jit = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!jit.has(key)) jit.set(key, 0.72 + r() * 0.5);
    const s = jit.get(key);
    p.setXYZ(i, p.getX(i) * s, p.getY(i) * s * 0.68, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}
function groundColor(x, z, h, out) {   // alpine meadow outside; trodden earth inside the perimeter (streets and squares are laid over it)
  const n1 = Math.sin(x * 0.23 + Math.cos(z * 0.19) * 2.1) * Math.cos(z * 0.21 - x * 0.07);
  const n2 = Math.sin(x * 0.61 + z * 0.37) * Math.sin(z * 0.53 - x * 0.29);
  out.copy(colorOf('#8a9a52')).lerp(colorOf('#667a3e'), clamp(n1 * 0.6 + 0.2, 0, 1) * 0.7)
    .lerp(colorOf('#b4b46a'), clamp(n2, 0, 1) * 0.4);
  const sx = x / XS, sy = z / XS;
  const town = smooth(-80, 0, sy) * smooth(CFG.arenaH + 80, CFG.arenaH, sy) * smooth(-80, 0, sx) * smooth(CFG.arenaW + 80, CFG.arenaW, sx);
  if (town > 0) { out.lerp(colorOf('#8c7e64'), town * 0.8); out.multiplyScalar(0.94 + n2 * 0.06); }
  const roadX = ARENA.cx + (Math.sin(z * 0.11) * 6 + Math.sin(z * 0.043 + 1) * 4) * smooth(0, 14, Math.max(-z, z - ARENA.hd * 2));
  const road = (z < 0 && z > -70) || (z > ARENA.hd * 2 && z < ARENA.hd * 2 + 70) ? smooth(3.2, 1.6, Math.abs(x - roadX) + n2 * 0.45) * (1 - town) : 0;
  out.lerp(colorOf('#5e5c58'), road * 0.9);
  out.lerp(colorOf('#c8c8b8'), smooth(8, 26, h) * 0.35);
  return out;
}
function pushTop(A, cx, y, cz, w, d, col, tile) {   // a flat face looking up
  pushQuad(A, [cx - w / 2, y, cz + d / 2], [cx + w / 2, y, cz + d / 2], [cx + w / 2, y, cz - d / 2], [cx - w / 2, y, cz - d / 2], [0, 1, 0], w / tile, d / tile, col);
}
function pushSlab(A, cx, y, cz, w, t, d, col, tile) {   // a box you can see from underneath too: floor slabs, the platform
  pushWalls(A, cx, y, cz, w, t, d, col, tile);
  pushTop(A, cx, y + t, cz, w, d, col, tile);
  pushQuad(A, [cx - w / 2, y, cz - d / 2], [cx + w / 2, y, cz - d / 2], [cx + w / 2, y, cz + d / 2], [cx - w / 2, y, cz + d / 2], [0, -1, 0], w / tile, d / tile, col);
}
function buildGroundZones(E) {   // streets, squares, gravel and grass laid over the field, resolved on a 1 m grid so nothing overlaps
  const Wm = TOWN.w, Hm = TOWN.h, types = ['dirt', 'gravel', 'asphalt', 'cobble', 'paving', 'grass', 'concrete'], grid = new Int8Array(Wm * Hm).fill(-1);
  for (const [x0, y0, x1, y1, type] of TOWN.ground) {
    const ti = types.indexOf(type);
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(Hm, Math.ceil(y1)); y++)
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(Wm, Math.ceil(x1)); x++) grid[y * Wm + x] = ti;
  }
  const SURF = { dirt: [E.ground, 3.2, '#a8926a'], gravel: [E.gravel, 2.6, '#ffffff'], asphalt: [E.asphalt, 3.2, '#ffffff'], cobble: [E.cobble, 2.2, '#ffffff'],
    paving: [E.paving, 2.4, '#ffffff'], grass: [E.ground, 3.2, '#9ab45a'], concrete: [E.concrete, 3.2, '#e8e6e0'] };
  types.forEach((type, ti) => {
    const A = geoArrays(), [tex, tile, colHex] = SURF[type], col = colorOf(colHex);
    for (let y = 0; y < Hm; y++) for (let x = 0; x < Wm;) {
      if (grid[y * Wm + x] !== ti) { x++; continue; }
      let x1 = x;
      while (x1 < Wm && grid[y * Wm + x1] === ti) x1++;
      const v = [[x, 0.012, y + 1], [x1, 0.012, y + 1], [x1, 0.012, y], [x, 0.012, y]];   // counter-clockwise seen from above; uv in world metres
      for (const q of [0, 1, 2, 0, 2, 3]) { A.pos.push(...v[q]); A.nor.push(0, 1, 0); A.uv.push(v[q][0] / tile, v[q][2] / tile); A.col.push(col.r, col.g, col.b); }
      x = x1;
    }
    if (!A.pos.length) return;
    const t = tex.clone();
    t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    meshFrom(A, new THREE.MeshLambertMaterial({ map: t, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  });
}

