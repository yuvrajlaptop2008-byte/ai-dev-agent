const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { startServer, stopServer, PORT } = require('./_server-helper');
const { io } = require(path.join(__dirname, '../frontend/node_modules/socket.io-client'));

let server;

test('Socket.IO agent lifecycle', async (t) => {
  server = await startServer();

  await t.test('agent-start fires with a real runId on a FRESH run (regression test for the v20 bug where this only fired on Continue)', async () => {
    const socket = io(`http://localhost:${PORT}`, { path: '/socket.io', transports: ['websocket'] });
    const result = await new Promise((resolve) => {
      socket.on('connect', () => socket.emit('run-agent', { task: 'hello', mode: 'fast' }));
      socket.on('agent-start', (d) => resolve({ fired: true, runId: d.runId }));
      setTimeout(() => resolve({ fired: false }), 4000);
    });
    socket.close();
    assert.strictEqual(result.fired, true, 'agent-start should fire on a fresh run');
    assert.ok(result.runId, 'agent-start should include a real runId');
  });

  await t.test('stop-agent using the runId from agent-start successfully acknowledges', async () => {
    const socket = io(`http://localhost:${PORT}`, { path: '/socket.io', transports: ['websocket'] });
    const result = await new Promise((resolve) => {
      socket.on('connect', () => socket.emit('run-agent', { task: 'hello', mode: 'fast' }));
      socket.on('agent-start', (d) => socket.emit('stop-agent', { runId: d.runId }));
      socket.on('agent-stop-ack', (d) => resolve(d));
      setTimeout(() => resolve({ ok: false, timedOut: true }), 4000);
    });
    socket.close();
    assert.strictEqual(result.ok, true, 'stop-agent should successfully find and stop the run');
  });

  await stopServer(server);
});
