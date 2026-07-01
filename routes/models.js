const router = require('express').Router();
const { getModels, MODEL_PRESETS, FREE_MODELS } = require('../services/openrouter');
const { get, set } = require('../db');
router.get('/', async (req, res) => {
  try {
    const models = await getModels();
    res.json({ models, presets: MODEL_PRESETS, free: FREE_MODELS });
  } catch {
    res.json({ models: [], presets: MODEL_PRESETS, free: FREE_MODELS });
  }
});
router.get('/default', (req, res) => res.json({ model: get('default_model') || 'anthropic/claude-3.5-sonnet' }));
router.post('/default', (req, res) => { set('default_model', req.body.model); res.json({ ok: true }); });
module.exports = router;
