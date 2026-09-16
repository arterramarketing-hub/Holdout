// ---------- music: two cues written in code, played on the audio clock ----------
const MUS = { bus: null, sting: null, send: null, cue: null, next: 0, step: 0, int: 0.2, heat: -1e9, level: -1, phase: 'idle', switchAt: 0 };
const MUS_BASE = 2;      // the music bus at a slider of 1
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);   // MIDI note number to Hz
const CUES = {
  menu: { bpm: 72, chords: [[50, 53, 57, 62], [46, 50, 53, 58], [53, 57, 60, 65], [48, 52, 55, 60]] },   // Dm Bb F C, two bars each
};
const MOODS = {   // the battle cue in six moods, picked by the time of day and the weather (tr = semitones from D minor)
  day:   { bpm: 104, tr: 0, progs: [[[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], [[50, 53, 57], [51, 55, 58], [48, 52, 55], [50, 53, 57]]],   // i VI VII V | i bII VII i
           pad: 680, padGain: 0.03, padA: 0.25, ost: 'saw16', ostCut: 2600, bass: 2, bassGain: 1, hat: 1, drums: [0, 7, 10], drumPitch: 1, drumGain: 1, rim: true, fills: true, brass: 1, brassA: 0.05 },
  dawn:  { bpm: 96, tr: 2, progs: [[[50, 53, 57], [55, 59, 62], [46, 50, 53], [48, 52, 55]]],   // i IV VI VII: E dorian, lifting
           pad: 1100, padGain: 0.028, padA: 0.6, ost: 'pluck8', ostCut: 3400, bass: 2, bassGain: 0.8, hat: 0.7, drums: [0, 10], drumPitch: 1, drumGain: 0.8, rim: true, fills: false, brass: 0.8, brassA: 0.12, bell: true },
  dusk:  { bpm: 98, tr: -5, progs: [[[50, 53, 57], [46, 50, 53], [48, 52, 55], [52, 55, 59]]],   // i VI VII v: A minor, the light going
           pad: 760, padGain: 0.032, padA: 0.45, ost: 'echo16', ostCut: 2000, bass: 2, bassGain: 0.9, hat: 0.8, drums: [0, 7, 10], drumPitch: 0.9, drumGain: 0.9, rim: true, fills: true, brass: 0.85, brassA: 0.08 },
  night: { bpm: 88, tr: -2, progs: [[[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]]],   // i VI iv V: C minor in the dark
           pad: 480, padGain: 0.036, padA: 0.8, ost: 'ping', ostCut: 1400, bass: 4, bassGain: 0.9, hat: 0.35, drums: [0, 11], drumPitch: 0.75, drumGain: 1, rim: false, fills: false, brass: 0.55, brassA: 0.1, drone: true },
  rain:  { bpm: 92, tr: 0, progs: [[[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]]],   // i VI iv V: D minor under the rain
           pad: 620, padGain: 0.04, padA: 0.5, ost: 'pluck8down', ostCut: 2400, bass: 2, bassGain: 0.9, hat: 0.6, drums: [0, 10], drumPitch: 0.85, drumGain: 0.85, rim: true, fills: false, brass: 0.6, brassA: 0.1, trem: true },
  fog:   { bpm: 84, tr: 4, progs: [[[50, 53, 57], [48, 52, 55], [46, 50, 53], [48, 52, 55]]],   // i VII VI VII: F sharp minor, ghostly
           pad: 900, padGain: 0.036, padA: 1.2, ost: 'swell', ostCut: 1800, bass: 16, bassGain: 1.1, hat: 0.25, drums: [0], drumPitch: 0.7, drumGain: 1, rim: false, fills: false, brass: 0.45, brassA: 0.2, bell: true, drone: true },
};
const moodNow = () => state.weather === 'rain' ? 'rain' : state.weather === 'fog' ? 'fog'
  : ['dawn', 'day', 'dusk', 'night'][Math.round(((state.tod % 4) + 4) % 4) % 4];
const cueBpm = cue => cue === 'menu' ? CUES.menu.bpm : (MOODS[cue.slice(7)] || MOODS.day).bpm;
function mTone(c, t, o) {   // one voice: {type, f, f2 glide target, glide, dur, gain, a, r, perc, lp, lp2, sweep, q, detune, pan, dest, send, sendAmt}
  const osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || o.dur));
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);
  let node = osc;
  if (o.lp) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = o.q || 0.7;
    f.frequency.setValueAtTime(o.lp, t);
    if (o.lp2) f.frequency.exponentialRampToValueAtTime(o.lp2, t + (o.sweep || o.dur));
    node.connect(f); node = f;
  }
  const a = o.a == null ? 0.005 : o.a;
  g.gain.setValueAtTime(0.0001, t);
  if (o.perc) { g.gain.exponentialRampToValueAtTime(o.gain, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur); }
  else {
    g.gain.linearRampToValueAtTime(o.gain, t + a);
    g.gain.setValueAtTime(o.gain, t + Math.max(a + 0.001, o.dur - (o.r || 0.3)));
    g.gain.linearRampToValueAtTime(0.0001, t + o.dur);
  }
  node.connect(g); node = g;
  if (o.trem) {   // a slow tremble on the note (the rain pad): gain swings between half and full
    const tg = c.createGain(), lfo = c.createOscillator(), depth = c.createGain();
    tg.gain.value = 0.75; depth.gain.value = 0.25; lfo.frequency.value = 5.2;
    lfo.connect(depth); depth.connect(tg.gain); lfo.start(t); lfo.stop(t + o.dur + 0.05);
    node.connect(tg); node = tg;
  }
  if (o.pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = o.pan; node.connect(p); node = p; }
  node.connect(o.dest);
  if (o.send) { const s = c.createGain(); s.gain.value = o.sendAmt || 0.3; g.connect(s); s.connect(o.send); }
  osc.start(t); osc.stop(t + o.dur + 0.05);
}
function mNoise(c, nb, t, dur, type, freq, q, gain, dest) {   // a filtered noise hit: hats, the skin of a drum, a rim
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = nb;
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
}
function musStep(c, bus, send, nb, t, cue, step, k) {   // everything that sounds on one sixteenth note; k = how hot the fight is (0..1)
  const spb = 60 / cueBpm(cue) / 4, bar = Math.floor(step / 16), s16 = step % 16;
  if (cue === 'menu') {
    const C = CUES.menu;
    const chord = C.chords[Math.floor(bar / 2) % 4], phrase = bar % 8;
    if (step % 32 === 0) {   // a new chord every two bars: a detuned pad, the bass under it, a bell at the top of a phrase
      const len = spb * 32 + 0.9;
      chord.forEach((n, i) => { for (const dt of [-7, 7]) mTone(c, t, { type: 'sawtooth', f: NOTE(n), detune: dt + (i - 1.5) * 2, dur: len, gain: 0.02, a: 1.4, r: 1.3, lp: 950, q: 0.4, pan: (i - 1.5) * 0.24, dest: bus, send, sendAmt: 0.55 }); });
      mTone(c, t, { type: 'triangle', f: NOTE(chord[0] - 12), dur: len, gain: 0.07, a: 0.9, r: 1.1, lp: 420, dest: bus });
      if (phrase % 4 === 0) mTone(c, t + spb * 2, { type: 'sine', f: NOTE(chord[2] + 24), dur: 3, gain: 0.02, perc: true, a: 0.01, dest: bus, send, sendAmt: 0.9 });
    }
    if (s16 === 0 || s16 === 3) {   // a slow heartbeat, with a click a phone speaker can actually reproduce
      mTone(c, t, { type: 'sine', f: s16 ? 70 : 82, f2: 42, glide: 0.22, dur: 0.42, gain: s16 ? 0.07 : 0.1, perc: true, a: 0.004, dest: bus });
      mNoise(c, nb, t, 0.05, 'lowpass', 1400, 0.6, s16 ? 0.02 : 0.03, bus);
    }
    if (phrase >= 2 && step % 2 === 0 && Math.random() < 0.85) {   // a soft plucked arpeggio over the chord
      const pat = [0, 2, 1, 3, 2, 1, 3, 2], idx = pat[(step / 2) % 8], n = (idx < 3 ? chord[idx] : chord[0] + 12) + 12;
      mTone(c, t, { type: 'triangle', f: NOTE(n), dur: 0.75, gain: 0.03, perc: true, a: 0.004, lp: 2400, pan: (step / 2) % 2 ? 0.2 : -0.2, dest: bus, send, sendAmt: 0.45 });
    }
    return;
  }
  const M = MOODS[cue.slice(7)] || MOODS.day, prog = M.progs[Math.floor(bar / 8) % M.progs.length];
  const chord = prog[bar % 4].map(n => n + M.tr), root = chord[0];
  const lOst = smooth(0.28, 0.5, k), lDrum = smooth(0.48, 0.72, k), lBrass = smooth(0.7, 0.9, k) * M.brass;
  if (s16 === 0) {   // the chord: a pad, dark or bright with the mood; a drone under the night and the fog; a bell over the dawn
    chord.forEach((n, i) => mTone(c, t, { type: 'sawtooth', f: NOTE(n), detune: (i - 1) * 6, dur: spb * 16 + 0.3, gain: M.padGain, a: M.padA, r: 0.4, lp: M.pad, q: 0.5, trem: M.trem, dest: bus, send, sendAmt: 0.35 }));
    if (M.drone) mTone(c, t, { type: 'triangle', f: NOTE(root - 12), dur: spb * 16 + 0.25, gain: 0.08, a: 0.5, r: 0.5, lp: 300, dest: bus });
    if (M.bell && bar % 4 === 0) mTone(c, t + spb * 2, { type: 'sine', f: NOTE(chord[2] + 24), dur: 3.2, gain: 0.032, perc: true, a: 0.01, dest: bus, send, sendAmt: 0.9 });
    if (lBrass > 0.01) for (const [n, d] of [[root, -5], [root + 7, 5], [root + 12, 0]])   // brass stabs on the chord change
      mTone(c, t, { type: 'sawtooth', f: NOTE(n), detune: d, dur: 0.95, gain: 0.058 * lBrass, a: M.brassA, r: 0.55, lp: 500, lp2: 1900, sweep: 0.25, q: 1, dest: bus, send, sendAmt: 0.3 });
    if (bar % 4 === 0 && k > 0.85) for (const [n, typ] of [[root - 24, 'sawtooth'], [root - 12, 'sawtooth'], [root - 12, 'square']])   // a braam on a new phrase at full tilt
      mTone(c, t, { type: typ, f: NOTE(n), dur: 3, gain: 0.045, a: 0.08, r: 2, lp: 160, lp2: 1500, sweep: 1.4, q: 2, dest: bus, send, sendAmt: 0.4 });
  }
  if (step % M.bass === 0) {   // the bass pulse: eighths by day, quarters at night, one note a bar in the fog
    const up = M.bass === 2 && s16 % 8 === 6;
    mTone(c, t, { type: 'sawtooth', f: NOTE(root - 12 + (up ? 12 : 0)), dur: spb * Math.min(M.bass, 8) * 0.85, gain: (s16 % 8 === 0 ? 0.12 : 0.085) * M.bassGain, perc: true, a: 0.004, lp: 900, lp2: 200, sweep: spb * 1.5, q: 2.5, dest: bus });
  }
  if (M.hat > 0) mNoise(c, nb, t, 0.035, 'highpass', 7500, 0.7, (s16 % 4 === 2 ? 0.03 : 0.014) * (0.5 + k) * M.hat, bus);   // hats, leaning on the offbeats
  if (lOst > 0.01) musLine(M, c, bus, send, t, spb, step, s16, chord, root, lOst);
  if (lDrum > 0.01) {   // taiko, a rim on the backbeat, and rolls into every fourth bar where the mood allows
    const fill = M.fills && bar % 4 === 3 && s16 >= 12;
    if (M.drums.includes(s16) || (M.fills && k > 0.8 && s16 === 3) || fill) {
      mTone(c, t, { type: 'sine', f: fill ? 120 + (s16 - 12) * 20 : 150 * M.drumPitch, f2: 55 * M.drumPitch, glide: 0.2, dur: 0.5, gain: (s16 === 0 ? 0.19 : 0.13) * lDrum * M.drumGain, perc: true, a: 0.002, dest: bus, send, sendAmt: 0.25 });
      mNoise(c, nb, t, 0.09, 'lowpass', M.drumPitch < 0.9 ? 450 : 700, 0.5, 0.06 * lDrum * M.drumGain, bus);
    }
    if (M.rim && (s16 === 4 || s16 === 12)) {
      mNoise(c, nb, t, 0.14, 'bandpass', 1900, 0.9, 0.065 * lDrum, bus);
      mTone(c, t, { type: 'triangle', f: 210, f2: 140, glide: 0.08, dur: 0.1, gain: 0.045 * lDrum, perc: true, a: 0.001, dest: bus });
    }
  }
}
function musLine(M, c, bus, send, t, spb, step, s16, chord, root, l) {   // the melodic line that builds with the fight, one voice per mood
  const tone = p => (p < 3 ? chord[p] : root + 12) + 12;
  if (M.ost === 'saw16') {   // day: spiccato sixteenths over the chord
    const p = [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 3, 2, 1, 2][s16];
    mTone(c, t, { type: 'sawtooth', f: NOTE(tone(p)), dur: spb * 0.9, gain: (s16 % 4 === 0 ? 0.058 : 0.04) * l, perc: true, a: 0.003, lp: 2600, lp2: 800, sweep: spb * 0.8, q: 1.5, pan: s16 % 2 ? 0.28 : -0.28, dest: bus, send, sendAmt: 0.2 });
  } else if (M.ost === 'echo16') {   // dusk: a dotted figure, and its echo three sixteenths later
    const p = { 0: 0, 3: 2, 6: 1, 8: 3, 11: 2, 14: 1 }[s16];
    if (p != null) {
      const f = NOTE(tone(p));
      mTone(c, t, { type: 'sawtooth', f, dur: spb * 1.4, gain: 0.055 * l, perc: true, a: 0.004, lp: M.ostCut, lp2: 700, sweep: spb, q: 1.2, pan: -0.25, dest: bus, send, sendAmt: 0.35 });
      mTone(c, t + spb * 3, { type: 'sawtooth', f, dur: spb * 1.4, gain: 0.024 * l, perc: true, a: 0.004, lp: M.ostCut * 0.75, lp2: 600, sweep: spb, q: 1, pan: 0.3, dest: bus, send, sendAmt: 0.5 });
    }
  } else if (M.ost === 'pluck8' || M.ost === 'pluck8down') {   // dawn: rising plucked eighths; rain: falling ones
    if (step % 2 === 0) {
      const rise = M.ost === 'pluck8', p = (rise ? [0, 1, 2, 3, 2, 1, 2, 3] : [3, 2, 1, 0, 2, 1, 0, 1])[(step / 2) % 8];
      mTone(c, t, { type: 'triangle', f: NOTE(tone(p) + (rise ? 12 : 0)), dur: 0.6, gain: 0.06 * l, perc: true, a: 0.003, lp: M.ostCut, pan: (step / 2) % 2 ? 0.25 : -0.25, dest: bus, send, sendAmt: 0.5 });
    }
  } else if (M.ost === 'ping') {   // night: sparse high pings in the dark
    const i = [0, 6, 11].indexOf(s16);
    if (i >= 0) mTone(c, t, { type: 'sine', f: NOTE(tone([0, 2, 3][i]) + 12), dur: 1.3, gain: 0.055 * l, perc: true, a: 0.004, dest: bus, send, sendAmt: 0.9 });
  } else if (M.ost === 'swell') {   // fog: slow swells on the beat
    if (s16 % 4 === 0) mTone(c, t, { type: 'sawtooth', f: NOTE(tone((s16 / 4) % 4)), dur: spb * 4, gain: 0.045 * l, a: spb * 3, r: spb * 0.8, lp: M.ostCut, q: 0.6, pan: s16 % 8 ? 0.3 : -0.3, dest: bus, send, sendAmt: 0.6 });
  }
}
function musHeat() {   // how hot the fight is, 0..1: enemies near and close, rounds flying, you hurt, the Warlord
  const me = soldiers[state.controlled];
  if (!me) return 0.2;
  let near = 0, close = 0;
  for (const e of enemies) {
    const d = Math.hypot(e.x - me.x, e.y - me.y);
    if (d < 1400) near += e.boss ? 2 : 1;
    if (d < 600) close++;
  }
  const firing = performance.now() - MUS.heat < 2500 ? 0.25 : 0;
  const hurt = me.alive ? clamp(1 - me.hp / me.maxHp, 0, 1) * 0.25 : 0.3;
  return clamp(0.15 + near * 0.05 + close * 0.09 + firing + hurt + (state.bossRef ? 0.45 : 0), 0, 1);   // eight on the field: each counts for less
}
function updateMusic(dt) {
  if (!AC || !master || !noiseBuf) return;
  if (!MUS.bus) {
    MUS.bus = AC.createGain(); MUS.bus.gain.value = 0.0001; MUS.bus.connect(master);
    MUS.sting = AC.createGain(); MUS.sting.gain.value = 0.3; MUS.sting.connect(master);
    MUS.send = AC.createGain(); MUS.send.gain.value = 0.6; MUS.send.connect(verbIn);   // the shared outdoor reverb
  }
  const now = AC.currentTime, level = meta && meta.opts && meta.opts.music != null ? meta.opts.music : 0.6;
  const fight = screen === 'battle' && (state.mode === 'play' || state.mode === 'dying' || state.mode === 'spectate');
  const want = level <= 0.001 || (meta && meta.muted) ? null : fight ? 'battle:' + moodNow() : 'menu';   // the battle cue follows the sky
  const g = MUS.bus.gain;
  if (want !== MUS.cue && MUS.phase !== 'out') {   // fade the old cue out, then start the new one on a fresh bar
    g.cancelScheduledValues(now); g.setValueAtTime(Math.max(0.0001, g.value), now); g.linearRampToValueAtTime(0.0001, now + 0.6);
    MUS.phase = 'out'; MUS.switchAt = now + 0.65;
  }
  if (MUS.phase === 'out' && now >= MUS.switchAt) {
    MUS.cue = want; MUS.step = 0; MUS.next = now + 0.05; MUS.phase = want ? 'in' : 'idle';
    if (want) { g.cancelScheduledValues(now); g.setValueAtTime(0.0001, now); g.linearRampToValueAtTime(level * MUS_BASE, now + 1.4); MUS.level = level; }
  }
  if (!MUS.cue || MUS.phase === 'out') return;
  if (MUS.level !== level && now > MUS.switchAt + 1.5) { g.cancelScheduledValues(now); g.setTargetAtTime(level * MUS_BASE, now, 0.08); MUS.level = level; }   // the settings slider
  const heat = MUS.cue.startsWith('battle') ? musHeat() : 0;
  MUS.int += (heat - MUS.int) * Math.min(1, dt * (heat > MUS.int ? 0.9 : 0.25));   // rises fast, cools slowly
  if (MUS.next < now - 0.25) MUS.next = now + 0.05;   // the page stalled or was hidden: pick up from here, no catch-up burst
  const spb = 60 / cueBpm(MUS.cue) / 4;
  while (MUS.next < now + 0.15) { musStep(AC, MUS.bus, MUS.send, noiseBuf, MUS.next, MUS.cue, MUS.step, MUS.int); MUS.next += spb; MUS.step++; }
}
function musStinger(kind) {   // a sector taken, a front lost, the Warlord arriving: over the top of the cue change
  if (!AC || !MUS.sting || (meta && meta.muted)) return;
  const lv = meta && meta.opts && meta.opts.music != null ? meta.opts.music : 0.6;
  if (lv <= 0.001) return;
  const c = AC, t = c.currentTime + 0.05, d = MUS.sting, send = MUS.send;
  d.gain.setValueAtTime(lv * MUS_BASE, c.currentTime);
  if (kind === 'win') {   // D major opening up, a drum under it, a bell after
    [50, 54, 57, 62, 66].forEach((n, i) => mTone(c, t + i * 0.03, { type: 'sawtooth', f: NOTE(n), detune: (i - 2) * 5, dur: 3.2, gain: 0.038, a: 0.35, r: 1.8, lp: 500, lp2: 2200, sweep: 0.8, q: 0.8, dest: d, send, sendAmt: 0.5 }));
    mTone(c, t, { type: 'sine', f: 140, f2: 50, glide: 0.3, dur: 0.9, gain: 0.24, perc: true, a: 0.002, dest: d, send, sendAmt: 0.4 });
    mTone(c, t + 0.4, { type: 'sine', f: NOTE(78), dur: 3, gain: 0.02, perc: true, a: 0.01, dest: d, send, sendAmt: 0.9 });
  } else if (kind === 'lose') {   // D minor sagging and closing down
    [38, 50, 53, 57].forEach((n, i) => mTone(c, t, { type: i ? 'sawtooth' : 'square', f: NOTE(n), f2: NOTE(n - 2), glide: 2.8, dur: 3.4, gain: i ? 0.032 : 0.036, a: 0.15, r: 2, lp: 1200, lp2: 180, sweep: 3, q: 1, dest: d, send, sendAmt: 0.5 }));
    mTone(c, t, { type: 'sine', f: 110, f2: 38, glide: 0.4, dur: 1.2, gain: 0.24, perc: true, a: 0.002, dest: d });
  } else if (kind === 'boss') {   // a braam
    [26, 38, 38].forEach((n, i) => mTone(c, t, { type: i === 2 ? 'square' : 'sawtooth', f: NOTE(n), dur: 3.5, gain: 0.055, a: 0.06, r: 2.5, lp: 140, lp2: 1600, sweep: 1.2, q: 2, dest: d, send, sendAmt: 0.5 }));
    mTone(c, t, { type: 'sine', f: 120, f2: 42, glide: 0.35, dur: 1, gain: 0.26, perc: true, a: 0.002, dest: d });
  }
}

function sfxHeartbeat() {   // the world goes muffled and you hear your own pulse
  for (let k = 0; k < 3; k++) {
    beep(58, 0.16, 'sine', 0.4, -18, k * 0.62);
    beep(52, 0.2, 'sine', 0.3, -14, k * 0.62 + 0.2);
  }
}
function sfxBreak(x, y, mat) {   // cover giving way: splintering wood, slumping sandbags, crumbling stone
  const m = distMul(x, y);
  playBuf('fall:' + aRandi(0, 1), { gain: 0.5 * m, rate: mat === 'wood' ? 1.7 : 0.8, x, y, force: true });
  if (mat !== 'dirt') playBuf('blastf', { gain: 0.22 * m, lp: mat === 'wood' ? 2500 : 900, rate: 1.4, x, y });
  for (let k = 0; k < 4; k++) playBuf('tink:' + aRandi(0, 2), { gain: 0.03 * m, rate: mat === 'wood' ? 0.45 : 0.7, delay: 0.05 + k * 0.07, x, y });
}
function sfxDive() { noise({ freq: 700, type: 'bandpass', q: 0.8, dur: 0.3, gain: 0.12, slide: -400, attack: 0.02 }); }

const pickL = a => a[randi(0, a.length - 1)];
const WARLORD_EPITHETS = ['Carrier of the Other', 'Eater of Lines', 'The Borrowed Crown', 'Breaker of the Ninth', 'Mouth of the Hungry Passenger'];

