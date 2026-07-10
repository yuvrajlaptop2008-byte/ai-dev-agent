const router = require('express').Router();
const rotation = require('../services/rotation');
router.get('/status', (req, res) => res.json(rotation.status()));
router.post('/openrouter-keys', (req, res) => { rotation.setOpenrouterKeys(req.body.keys || []); res.json({ ok:true, status: rotation.status() }); });
router.post('/model-pool', (req, res) => { rotation.setModelPool(req.body.models || []); res.json({ ok:true, status: rotation.status() }); });
module.exports = router;
