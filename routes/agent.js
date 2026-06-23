const router = require('express').Router();
const { db } = require('../db');

router.get('/runs', (req, res) => {
  const rows = db.prepare('SELECT id,task,status,created_at FROM agent_runs ORDER BY created_at DESC LIMIT 20').all();
  res.json(rows);
});

router.get('/runs/:id', (req, res) => {
  const run = db.prepare('SELECT * FROM agent_runs WHERE id=?').get(req.params.id);
  if (!run) return res.status(404).json({ error: 'Not found' });
  res.json({ ...run, steps: JSON.parse(run.steps) });
});

router.delete('/runs/:id', (req, res) => {
  db.prepare('DELETE FROM agent_runs WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
