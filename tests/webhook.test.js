const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const http = require('http');
const { startServer, stopServer, PORT } = require('./_server-helper');

const SECRET = 'test_webhook_secret_123';
let server;

test('webhook signature verification', async (t) => {
  server = await startServer({ GITHUB_WEBHOOK_SECRET: SECRET });

  const payload = JSON.stringify({ action: 'opened', issue: { number: 1 }, repository: { owner: { login: 'x' }, name: 'y' } });

  function post(body, sig) {
    return new Promise((resolve) => {
      const req = http.request({ hostname: 'localhost', port: PORT, path: '/api/webhook', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'x-hub-signature-256': sig, 'x-github-event': 'issues' } }, (res) => {
        let data = ''; res.on('data', (d) => (data += d)); res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', (e) => resolve({ error: e.message }));
      req.write(body);
      req.end();
    });
  }

  await t.test('valid signature (computed the way GitHub actually computes it) is accepted', async () => {
    const validSig = 'sha256=' + crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
    const r = await post(payload, validSig);
    assert.strictEqual(r.status, 200);
  });

  await t.test('tampered signature is rejected', async () => {
    const r = await post(payload, 'sha256=' + 'deadbeef'.repeat(8));
    assert.strictEqual(r.status, 401);
  });

  await t.test('missing signature is rejected', async () => {
    const r = await post(payload, '');
    assert.strictEqual(r.status, 401);
  });

  await stopServer(server);
});
