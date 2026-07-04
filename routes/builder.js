const router = require('express').Router();
const b = require('../services/builder');
const h = fn => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(500).json({ error: e.message }); } };

router.post('/build', h(req => b.buildProject(req.body.idea, req.body.model, { private: req.body.private })));
router.get('/strengthen/:username', h(req => b.strengthenProfile(req.params.username, req.query.model)));

module.exports = router;
