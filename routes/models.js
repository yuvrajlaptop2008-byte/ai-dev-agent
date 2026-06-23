const router = require('express').Router();
const { getModels, MODELS } = require('../services/openrouter');
const { get, set } = require('../db');

router.get('/', async (req, res) => {
  try {
    const models = await getModels();
    res.json({ models: models.map(m => ({ id: m.id, name: m.name, pricing: m.pricing })), presets: MODELS });
  } catch (e) {
    res.json({ models: [], presets: MODELS });
  }
});

router.get('/default', (req, res) => {
  res.json({ model: get('default_model') || 'anthropic/claude-3.5-sonnet' });
});

router.post('/default', (req, res) => {
  set('default_model', req.body.model);
  res.json({ ok: true });
});

module.exports = router;
