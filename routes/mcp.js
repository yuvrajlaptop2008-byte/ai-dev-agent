const router = require('express').Router();
const { db } = require('../db');
const { v4: uuid } = require('uuid');
const axios = require('axios');

router.get('/servers', (req, res) => {
  res.json(db.prepare('SELECT * FROM mcp_servers').all().map(s => ({ ...s, config: JSON.parse(s.config) })));
});

router.post('/servers', (req, res) => {
  const { name, url, type, config } = req.body;
  const id = uuid();
  db.prepare('INSERT INTO mcp_servers VALUES (?,?,?,?,1,?)').run(id, name, url, type || 'sse', JSON.stringify(config || {}));
  res.json({ id, name, url });
});

router.put('/servers/:id', (req, res) => {
  const { name, url, enabled, config } = req.body;
  db.prepare('UPDATE mcp_servers SET name=?,url=?,enabled=?,config=? WHERE id=?')
    .run(name, url, enabled ? 1 : 0, JSON.stringify(config || {}), req.params.id);
  res.json({ ok: true });
});

router.delete('/servers/:id', (req, res) => {
  db.prepare('DELETE FROM mcp_servers WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Test MCP server connection
router.post('/servers/:id/test', async (req, res) => {
  const server = db.prepare('SELECT * FROM mcp_servers WHERE id=?').get(req.params.id);
  if (!server) return res.status(404).json({ error: 'Not found' });
  try {
    const r = await axios.get(server.url + '/health', { timeout: 5000 });
    res.json({ ok: true, status: r.status });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Call MCP tool
router.post('/call', async (req, res) => {
  const { serverId, tool, args } = req.body;
  const server = db.prepare('SELECT * FROM mcp_servers WHERE id=?').get(serverId);
  if (!server) return res.status(404).json({ error: 'Server not found' });

  try {
    const r = await axios.post(`${server.url}/tools/${tool}`, args, { timeout: 30000 });
    res.json(r.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
