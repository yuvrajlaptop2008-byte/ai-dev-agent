const router = require('express').Router();
const w = require('../services/webllm');
const h = fn => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(500).json({ error: e.message }); } };

router.get('/status', h(() => w.status()));
router.post('/login/:provider', h(req => w.openLoginWindow(req.params.provider)));
router.post('/ask', h(req => w.ask(req.body.provider, req.body.prompt, req.body.timeoutMs, { model: req.body.model })));

module.exports = router;
