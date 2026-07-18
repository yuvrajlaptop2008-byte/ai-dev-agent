const router = require('express').Router();
const watcher = require('../services/watcher');
const h = fn => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(500).json({ error: e.message }); } };

router.get('/status', h(() => ({ ...watcher.status(), log: watcher.getLog() })));
router.post('/enabled', h(req => watcher.setEnabled(req.body.enabled)));
router.post('/interval', h(req => watcher.setIntervalMinutes(req.body.minutes)));
router.post('/model', h(req => watcher.setModel(req.body.model)));
router.post('/repos', h(req => watcher.addRepo(req.body.owner, req.body.repo)));
router.delete('/repos', h(req => watcher.removeRepo(req.body.owner, req.body.repo)));
router.post('/run-now', h(() => watcher.runOnce()));

module.exports = router;
