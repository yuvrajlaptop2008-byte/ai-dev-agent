const router = require('express').Router();
const brain = require('../services/brain');
const browser = require('../services/browser');

const h = fn => async (req, res) => { try { res.json({ result: await fn(req) }); } catch (e) { res.status(500).json({ error: e.message }); } };

router.post('/think', h(req => brain.deepThink(req.body.problem, req.body.model || 'anthropic/claude-3.5-sonnet', req.body.context)));
router.post('/plan', h(req => brain.createPlan(req.body.goal, req.body.model || 'anthropic/claude-3.5-sonnet', req.body.context)));
router.post('/decide', h(req => brain.decide(req.body.options, req.body.criteria, req.body.model || 'anthropic/claude-3.5-sonnet')));
router.post('/research', h(async req => {
  const report = await browser.deepResearch(req.body.topic, req.body.depth || 2);
  const sources = [...report.searchResults.map(r => `${r.title}: ${r.snippet}`), ...report.pageContents.map(p => p.content?.slice(0, 1500))];
  return brain.synthesizeResearch(req.body.topic, sources, req.body.model || 'anthropic/claude-3.5-sonnet');
}));
router.post('/analyze', h(req => brain.analyzeCode(req.body.code, req.body.language, req.body.task, req.body.model || 'anthropic/claude-3.5-sonnet')));
router.get('/memory', h(() => brain.getMemory('*', '*')));
router.post('/memory', h(req => brain.saveMemory(req.body.key, req.body.value, req.body.category)));
router.get('/tasks', h(() => brain.getTasks()));
router.post('/search', h(req => browser.search(req.body.query, req.body.num)));
router.post('/fetch', h(req => browser.fetchPage(req.body.url)));

module.exports = router;
