suite('full front', t => {
  t.test('a new campaign\'s first front plays to FRONT SECURED with no errors', () => {
    newCampaign(); seed(1);
    battle();
    const r = botFront(600);
    assert.eq(r.mode, 'cleared', `ended ${r.mode} after ${r.seconds} s (${r.down}/${r.total})`);
    assert.range(r.maxOnField, 1, CFG.enemyCap, 'enemies on the field at once');
    assert.range(r.maxCalls, 1, 140, 'draw calls');
    return r;
  }, { timeout: 300000 });
});
