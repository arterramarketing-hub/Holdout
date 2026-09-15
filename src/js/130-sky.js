// ============================================================ TIME OF DAY & WEATHER
// Each battle rolls a time of day and weather. Night, fog and rain shorten sight lines,
// which caps squad weapon range, lock-on range and enemy gunner range alike.
const TOD_NAMES = ['DAWN', 'DAY', 'DUSK', 'NIGHT'];
const SKY_VIS = [0.9, 1, 0.88, 0.78];
const WEATHER = {
  clear: { vis: 1, label: 'CLEAR' }, overcast: { vis: 0.95, label: 'OVERCAST' },
  fog: { vis: 0.8, label: 'FOG' }, rain: { vis: 0.85, label: 'RAIN' },
};
function visMul() {
  const t = ((state.tod % 4) + 4) % 4, i = Math.floor(t);
  return clamp(lerp(SKY_VIS[i], SKY_VIS[(i + 1) % 4], t - i) * (WEATHER[state.weather] || WEATHER.clear).vis, 0.7, 1);
}
const todName = () => TOD_NAMES[Math.round(state.tod) % 4];
const skyName = tod => TOD_NAMES[Math.round(tod) % 4];
// The sky a sector will be fought under is rolled the first time the briefing shows it, and that is the sky you get
// when you deploy; fighting there (won, lost or left) clears it, so the next visit brings new weather.
const FORECAST = {};
function forecastFor(t) {
  const f = FORECAST[t.id];
  if (f && f.theater === meta.theater) return f;
  let tod, weather;
  if (t.id === 1 && meta.theater === 0 && !meta.story.seen[1]) { tod = 0.15; weather = 'clear'; }   // "the line broke at dawn"
  else {
    const r = Math.random();
    tod = r < 0.15 ? 0.1 + Math.random() * 0.3 : r < 0.55 ? 0.8 + Math.random() * 0.6
      : r < 0.8 ? 1.85 + Math.random() * 0.4 : 2.85 + Math.random() * 0.4;
    const w = Math.random(), wet = Math.min(0.2, 0.04 * effTier(t));
    weather = w < 0.12 + wet ? 'rain' : w < 0.3 + wet ? 'fog' : w < 0.5 + wet ? 'overcast' : 'clear';
  }
  return (FORECAST[t.id] = { tod, weather, theater: meta.theater });
}
function rollSky(tid) {
  const f = forecastFor(TERRITORIES[tid]);
  state.tod = f.tod; state.weather = f.weather;
  delete FORECAST[tid];
}

