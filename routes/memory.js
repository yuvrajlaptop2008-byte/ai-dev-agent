const router = require('express').Router();
const { db, get, set } = require('../db');

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  // Mask keys
  if (settings.github_token) settings.github_token = settings.github_token.slice(0, 8) + '...';
  if (settings.openrouter_key) settings.openrouter_key = settings.openrouter_key.slice(0, 8) + '...';
  res.json(settings);
});

router.post('/', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });
  set(key, value);
  // Update env
  if (key === 'github_token') process.env.GITHUB_TOKEN = value;
  if (key === 'openrouter_key') process.env.OPENROUTER_API_KEY = value;
  res.json({ ok: true });
});

router.post('/bulk', (req, res) => {
  const { settings } = req.body;
  Object.entries(settings).forEach(([k, v]) => {
    set(k, v);
    if (k === 'github_token') process.env.GITHUB_TOKEN = v;
    if (k === 'openrouter_key') process.env.OPENROUTER_API_KEY = v;
  });
  res.json({ ok: true });
});

module.exports = router;
