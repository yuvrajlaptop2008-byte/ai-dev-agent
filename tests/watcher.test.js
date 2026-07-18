const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WATCHER_FILE = path.join(__dirname, '../data/watcher.json');

test('watcher service', async (t) => {
  // isolate from any real watcher.json on disk
  try { fs.rmSync(WATCHER_FILE, { force: true }); } catch {}
  delete require.cache[require.resolve('../services/watcher')];
  const watcher = require('../services/watcher');

  await t.test('starts disabled with no watched repos', () => {
    const s = watcher.status();
    assert.strictEqual(s.enabled, false);
    assert.deepStrictEqual(s.repos, []);
  });

  await t.test('setEnabled toggles and persists', () => {
    watcher.setEnabled(true);
    assert.strictEqual(watcher.status().enabled, true);
    watcher.setEnabled(false);
    assert.strictEqual(watcher.status().enabled, false);
  });

  await t.test('setIntervalMinutes enforces a 5-minute floor', () => {
    watcher.setIntervalMinutes(1);
    assert.strictEqual(watcher.status().intervalMinutes, 5, 'should clamp to the 5-minute minimum');
    watcher.setIntervalMinutes(60);
    assert.strictEqual(watcher.status().intervalMinutes, 60);
  });

  await t.test('addRepo/removeRepo manage the watch list without duplicates', () => {
    watcher.addRepo('owner1', 'repo1');
    watcher.addRepo('owner1', 'repo1'); // duplicate add should be a no-op
    assert.deepStrictEqual(watcher.status().repos, ['owner1/repo1']);
    watcher.addRepo('owner2', 'repo2');
    assert.strictEqual(watcher.status().repos.length, 2);
    watcher.removeRepo('owner1', 'repo1');
    assert.deepStrictEqual(watcher.status().repos, ['owner2/repo2']);
  });

  await t.test('removeRepo also clears that repo\'s processed-issue history', () => {
    const s1 = require('fs').readFileSync(WATCHER_FILE, 'utf8');
    watcher.addRepo('owner3', 'repo3');
    // simulate having processed an issue by writing state directly, then removing the repo
    const raw = JSON.parse(fs.readFileSync(WATCHER_FILE, 'utf8'));
    raw.processedIssues['owner3/repo3'] = [42];
    fs.writeFileSync(WATCHER_FILE, JSON.stringify(raw));
    watcher.removeRepo('owner3', 'repo3');
    const after = watcher.status();
    assert.strictEqual(after.processedIssues['owner3/repo3'], undefined);
  });

  await t.test('runOnce with zero watched repos returns immediately with checked:0', async () => {
    try { fs.rmSync(WATCHER_FILE, { force: true }); } catch {}
    delete require.cache[require.resolve('../services/watcher')];
    const freshWatcher = require('../services/watcher');
    const result = await freshWatcher.runOnce();
    assert.strictEqual(result.checked, 0);
    assert.strictEqual(result.solved, 0);
  });

  try { fs.rmSync(WATCHER_FILE, { force: true }); } catch {}
});
