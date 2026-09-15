suite('sky and music', t => {
  t.test('the six battle moods are all reachable', () => {
    newCampaign(); battle({ clear: true });
    const moods = new Set();
    for (const w of ['clear', 'overcast', 'fog', 'rain']) for (const tod of [0.1, 1, 2, 3]) { state.weather = w; state.tod = tod; frames(2); moods.add(moodNow()); }
    assert.deepEq([...moods].sort(), ['dawn', 'day', 'dusk', 'fog', 'night', 'rain']);
  });
});
