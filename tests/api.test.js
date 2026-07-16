const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { startServer, stopServer, PORT } = require('./_server-helper');

function get(p) {
  return new Promise((resolve) => {
    http.get({ hostname: 'localhost', port: PORT, path: p }, (res) => {
      let data = ''; res.on('data', (d) => (data += d)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
    }).on('error', (e) => resolve({ error: e.message }));
  });
}

let server;

test('REST API surface', async (t) => {
  server = await startServer();

  const routes = ['/api/models', '/api/mcp/servers', '/api/agent/runs', '/api/memory', '/api/brain/skills', '/api/rotation/status', '/api/webllm/status', '/api/chat/conversations'];
  for (const r of routes) {
    await t.test(`GET ${r} returns 200 with valid JSON`, async () => {
      const res = await get(r);
      assert.strictEqual(res.status, 200, `${r} returned ${res.status}`);
      assert.doesNotThrow(() => JSON.parse(res.data), `${r} did not return valid JSON`);
    });
  }

  await t.test('errors return proper JSON, not an HTML error page', async () => {
    const dataDir = path.join(__dirname, '../data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'store.json'), JSON.stringify({ settings: {}, conversations: [], messages: [], agent_runs: [{ id: 'broken1', task: 'x', status: 'done', steps: 'NOT VALID JSON{{{', result: 'y', created_at: 1 }], mcp_servers: [] }));
    await stopServer(server);
    server = await startServer({}, { clean: false });

    const res = await get('/api/agent/runs/broken1');
    assert.strictEqual(res.status, 500);
    assert.match(res.headers['content-type'] || '', /application\/json/, 'error response should be JSON, not HTML');
    const body = JSON.parse(res.data); // would throw if it were an HTML error page
    assert.ok(body.error, 'error response should have an error message field');
  });

  await stopServer(server);
});
