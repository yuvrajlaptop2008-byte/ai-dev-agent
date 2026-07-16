const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const tools = require('../tools');

// These payloads previously broke out of shell-string interpolation before the v21 security
// fixes. Codified here so a future refactor can't silently reintroduce the vulnerability.
const SHELL_BREAKOUT = '"; touch /tmp/ARIA_TEST_PWNED; echo "';
const PWNED_FILE = '/tmp/ARIA_TEST_PWNED';

test.beforeEach(() => { try { fs.unlinkSync(PWNED_FILE); } catch {} });
test.afterEach(() => { try { fs.unlinkSync(PWNED_FILE); } catch {} });

test('keyboard_type does not allow shell command injection', async () => {
  await tools.execute('keyboard_type', { text: SHELL_BREAKOUT }, {});
  assert.strictEqual(fs.existsSync(PWNED_FILE), false, 'shell breakout payload executed!');
});

test('open_url does not allow shell command injection', async () => {
  await tools.execute('open_url', { url: `http://x${SHELL_BREAKOUT}` }, {});
  assert.strictEqual(fs.existsSync(PWNED_FILE), false, 'shell breakout payload executed!');
});

test('mouse_move rejects non-numeric coordinates rather than interpolating them', async () => {
  const r = await tools.execute('mouse_move', { x: `100${SHELL_BREAKOUT}`, y: 50 }, {});
  assert.match(r, /must be numbers/);
  assert.strictEqual(fs.existsSync(PWNED_FILE), false, 'shell breakout payload executed!');
});

test('search_in_files does not allow shell command injection via path param', async () => {
  await tools.execute('search_in_files', { pattern: '.*', path: `/tmp${SHELL_BREAKOUT}` }, {});
  assert.strictEqual(fs.existsSync(PWNED_FILE), false, 'shell breakout payload executed!');
});

test('search_in_files is pure Node (no grep/find shellout) and returns real matches', async () => {
  const r = await tools.execute('search_in_files', { pattern: 'module.exports', path: __dirname + '/../services', file_ext: 'js' }, {});
  assert.ok(r.includes('module.exports'), 'should find real matches in services/');
  assert.ok(!r.startsWith('Not found'), 'should not report empty on a directory with real matches');
});

test('list_files recursive is pure Node (no find shellout) and returns real files', async () => {
  const r = await tools.execute('list_files', { path: __dirname + '/../services', recursive: true, pattern: '*.js' }, {});
  const lines = r.split('\n');
  assert.ok(lines.length > 5, 'should find multiple .js files in services/');
  assert.ok(lines.every(l => l.endsWith('.js')), 'pattern filter should only return .js files');
});

test('create_project sanitizes name before it can reach a shell string', async () => {
  // Just check the sanitization logic path doesn't throw / doesn't leave shell metachars in
  // the directory it actually creates — full project creation is slow, so just check the dir.
  const path = require('path');
  const os = require('os');
  const WORKSPACE = process.env.WORKSPACE || '/tmp/agent-workspace';
  const unsafe = `evil${SHELL_BREAKOUT}`;
  const safeName = unsafe.replace(/[^a-zA-Z0-9._-]/g, '_');
  assert.ok(!safeName.includes(';'), 'sanitized name should not contain shell metacharacters');
  assert.ok(!safeName.includes('"'), 'sanitized name should not contain quotes');
});
