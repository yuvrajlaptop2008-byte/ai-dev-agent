const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');

const PORT = 3099; // dedicated test port, avoids clashing with a dev server on 3001
const DATA_DIR = path.join(__dirname, '../data');

function startServer(env = {}, opts = {}) {
  return new Promise((resolve, reject) => {
    if (opts.clean !== false) { try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {} }
    const child = fork(path.join(__dirname, '../server.js'), [], {
      env: { ...process.env, PORT, WORKSPACE: '/tmp/aria-test-workspace', ...env },
      silent: true,
    });
    let ready = false;
    const timer = setTimeout(() => { if (!ready) reject(new Error('server did not start in time')); }, 8000);
    child.stdout.on('data', (d) => {
      if (!ready && d.toString().includes('ARIA')) { ready = true; clearTimeout(timer); setTimeout(() => resolve(child), 300); }
    });
    child.stderr.on('data', (d) => { /* surfaced via child.stderr if a test needs it */ });
    child.on('error', reject);
  });
}

function stopServer(child) {
  return new Promise((resolve) => {
    if (!child || child.killed) return resolve();
    child.once('exit', resolve);
    child.kill();
    setTimeout(resolve, 1000); // don't hang the test suite if it's slow to exit
  });
}

module.exports = { startServer, stopServer, PORT };
