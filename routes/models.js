const router = require('express').Router();
const or = require('../services/openrouter');
router.get('/', async (req, res) => {
  const models = await or.getModels();
  res.json({ models, presets: or.MODEL_PRESETS, free: or.getFreeModels() });
});
router.post('/refresh', async (req, res) => {
  const models = await or.getModels(true);
  res.json({ ok: true, info: or.getCacheInfo() });
});
router.get('/info', (req, res) => res.json(or.getCacheInfo()));
module.exports = router;
