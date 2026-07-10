const router = require('express').Router();
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const vscode = require('../services/vscode');

const WORKSPACE = process.env.WORKSPACE || '/tmp/agent-workspace';
const abs = p => path.isAbsolute(p) ? p : path.join(WORKSPACE, p);

const h = fn => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(500).json({ error: e.message }); } };

router.get('/', h(async req => {
  await fs.mkdir(WORKSPACE, { recursive: true });
  const p = abs(req.query.path || '');
  const items = await fs.readdir(p, { withFileTypes: true });
  return items.map(i => ({ name: i.name, type: i.isDirectory() ? 'dir' : 'file', path: path.join(req.query.path || '', i.name) }));
}));

router.get('/read', h(async req => ({ content: await fs.readFile(abs(req.query.path), 'utf8') })));
router.post('/write', h(async req => { const p = abs(req.body.path); await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, req.body.content); return { ok: true }; }));
router.delete('/delete', h(async req => { await fs.unlink(abs(req.query.path)); return { ok: true }; }));

router.post('/exec', h(async req => {
  try {
    const cwd = req.body.cwd ? abs(req.body.cwd) : WORKSPACE;
    await fs.mkdir(cwd, { recursive: true });
    const { stdout, stderr } = await execAsync(req.body.command, { cwd, timeout: 60000, env: { ...process.env, HOME: '/tmp' } });
    return { stdout, stderr };
  } catch (e) { return { stdout: e.stdout || '', stderr: e.stderr || e.message, code: e.code }; }
}));

// VSCode integration endpoints
router.post('/vscode/open', h(async req => { const r = await vscode.open(req.body.path || WORKSPACE); return { result: r }; }));
router.post('/vscode/open-folder', h(async req => { const r = await vscode.open(req.body.path || WORKSPACE, { newWindow: false }); return { result: r }; }));
router.post('/vscode/install-ext', h(async req => { const r = await vscode.installExtension(req.body.id); return { result: r }; }));
router.post('/vscode/list-ext', h(async () => { const r = await vscode.listExtensions(); return { result: r.join('\n') || 'No extensions found' }; }));
router.post('/vscode/create-workspace', h(async req => { const ws = await vscode.createWorkspace(req.body.name, req.body.folders); return { result: `✅ Workspace: ${ws}` }; }));
router.post('/vscode/setup-project', h(async req => { const r = await vscode.setupProject(abs(req.body.path || WORKSPACE), req.body.type || 'node'); return { result: r.join('\n') }; }));
router.post('/vscode/create-launch', h(async req => { await vscode.createLaunchConfig(abs(req.body.path || WORKSPACE)); return { result: '✅ .vscode/launch.json created' }; }));
router.post('/vscode/create-tasks', h(async req => { await vscode.createTasks(abs(req.body.path || WORKSPACE)); return { result: '✅ .vscode/tasks.json created' }; }));
router.post('/vscode/create-settings', h(async req => { await vscode.createSettings(abs(req.body.path || WORKSPACE)); return { result: '✅ .vscode/settings.json created' }; }));
router.post('/vscode/create-project', h(async req => {
  const tools = require('../tools');
  const result = await tools.execute('create_project', { name: req.body.name, type: req.body.type, description: req.body.description }, {});
  return { result };
}));

module.exports = router;
