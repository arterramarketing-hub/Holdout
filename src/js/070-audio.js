// ============================================================ AUDIO — procedural soundscape
// Realistic weapons audio without sample files: every gunshot, blast, near-miss and ricochet is
// synthesised once into a stereo sample buffer (sub-millisecond attack, saturated muzzle blast, a
// low pressure thump, early reflections off the ruins and treeline, a long rolling outdoor tail,
// the action cycling), then played back with per-shot variation, distance low-pass and stereo
// placement around the camera. Buffers render a few at a time after the first tap, most-used first.
let AC = null, master = null, noiseBuf = null, verbIn = null, shaper = null;
const amb = { started: false, windGain: null, windFilt: null, droneGain: null, rainGain: null, chatterT: 7, burstT: 6 };
const SFX = { buf: {}, queue: [], voices: 0, ready: false };
const SR_SYN = 32000;
function audio() {
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain(); master.gain.value = 0.8;
      const comp = AC.createDynamicsCompressor();   // slow enough attack that muzzle transients punch through
      comp.threshold.value = -12; comp.knee.value = 6; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25;
      SFX.muffle = AC.createBiquadFilter(); SFX.muffle.type = 'lowpass'; SFX.muffle.frequency.value = 20000;
      master.connect(SFX.muffle); SFX.muffle.connect(comp); comp.connect(AC.destination);
      noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const ir = AC.createBuffer(2, Math.floor(AC.sampleRate * 1.8), AC.sampleRate);   // outdoor reverb impulse
      for (let ch = 0; ch < 2; ch++) {
        const c = ir.getChannelData(ch);
        for (let i = 0; i < c.length; i++) c[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / c.length, 2.8);
      }
      const conv = AC.createConvolver(), wet = AC.createGain();
      conv.buffer = ir; wet.gain.value = 0.3;
      verbIn = AC.createGain();
      verbIn.connect(conv); conv.connect(wet); wet.connect(master);
      shaper = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; shaper[i] = Math.tanh(x * 3.2) / Math.tanh(3.2); }
      SFX.queue = sfxJobs();
      setTimeout(pumpSfx, 30);
    } catch (e) { return null; }
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
function envelope(g, t, gain, attack, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
  g.gain.setTargetAtTime(0.0001, t + attack, Math.max(0.005, (dur - attack) / 4));
}
function noise(o) {   // filtered noise burst for UI and weather: {freq, dur, gain, q, type, slide, attack, delay, drive, verb}
  const ac = audio(); if (!ac || (meta && meta.muted) || !o.gain) return;
  const t = ac.currentTime + (o.delay || 0);
  const src = ac.createBufferSource(); src.buffer = noiseBuf;
  src.loop = true; src.loopStart = Math.random() * 1.2; src.loopEnd = src.loopStart + 0.6;
  const f = ac.createBiquadFilter(); f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.freq, t);
  if (o.slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.freq + o.slide), t + o.dur);
  f.Q.value = o.q || 1;
  let node = f;
  if (o.drive) { const ws = ac.createWaveShaper(); ws.curve = shaper; f.connect(ws); node = ws; }
  const g = ac.createGain();
  envelope(g, t, o.gain, o.attack || 0.002, o.dur);
  src.connect(f); node.connect(g); g.connect(master);
  if (o.verb) { const s = ac.createGain(); s.gain.value = o.verb; g.connect(s); s.connect(verbIn); }
  src.start(t); src.stop(t + o.dur + 0.1);
}
function beep(freq, dur, type, gain, slide, delay = 0, verb = 0) {
  const ac = audio(); if (!ac || (meta && meta.muted)) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(28, freq + slide), t + dur);
  envelope(g, t, gain, 0.003, dur);
  o.connect(g); g.connect(master);
  if (verb) { const s = ac.createGain(); s.gain.value = verb; g.connect(s); s.connect(verbIn); }
  o.start(t); o.stop(t + dur + 0.1);
}
function distMul(x, y) { // sounds fall off with distance from the camera's soldier
  if (screen !== 'battle') return 1;
  const t = camTarget(); if (!t) return 1;
  return clamp(650 / (650 + Math.hypot(x - t.x, y - t.y)), 0.12, 1);
}
function panOf(x, y) {   // −1 left … 1 right of the camera
  if (screen !== 'battle') return 0;
  const t = camTarget(); if (!t) return 0;
  const dx = x - t.x, dy = y - t.y;
  return clamp((dx * Math.cos(cam.yaw) + dy * Math.sin(cam.yaw)) / (Math.hypot(dx, dy) + 90), -0.85, 0.85);
}


// Sound picks its own variants and playback rates from its own dice: the simulation's rand() decides the fight, and a
// front plays out the same whether or not the audio is running (which is what makes a seeded test reproducible).
let sfxSeed = 0x9e3779b9;
const aRnd = () => ((sfxSeed = (sfxSeed * 1664525 + 1013904223) >>> 0) / 4294967296);
const aRand = (a, b) => a + aRnd() * (b - a);
const aRandi = (a, b) => a + Math.floor(aRnd() * (b - a + 1));
