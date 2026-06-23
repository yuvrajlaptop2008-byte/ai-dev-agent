const router = require('express').Router();
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const WORKSPACE = process.env.WORKSPACE || '/tmp/agent-workspace';

router.get('/', async (req, res) => {
  try {
    await fs.mkdir(WORKSPACE, { recursive: true });
    const p = path.join(WORKSPACE, req.query.path || '');
    const items = await fs.readdir(p, { withFileTypes: true });
    res.json(items.map(i => ({ name: i.name, type: i.isDirectory() ? 'dir' : 'file', path: path.join(req.query.path || '', i.name) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/read', async (req, res) => {
  try {
    const p = path.join(WORKSPACE, req.query.path);
    const content = await fs.readFile(p, 'utf8');
    res.json({ content });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/write', async (req, res) => {
  try {
    const p = path.join(WORKSPACE, req.body.path);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, req.body.content);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/exec', async (req, res) => {
  try {
    const { stdout, stderr } = await execAsync(req.body.command, { cwd: WORKSPACE, timeout: 30000 });
    res.json({ stdout, stderr });
  } catch (e) { res.json({ stdout: '', stderr: e.message, code: e.code }); }
});

module.exports = router;
