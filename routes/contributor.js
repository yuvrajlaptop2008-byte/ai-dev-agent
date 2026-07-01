const router = require('express').Router();
const c = require('../services/contributor');
const h = fn => async (req, res) => { try { res.json(await fn(req)); } catch(e) { res.status(500).json({ error: e.message }); }};

router.get('/find-issues/:owner/:repo', h(req => c.findGoodIssues(req.params.owner, req.params.repo, req.query.model)));
router.post('/solve-issue', h(req => c.solveIssue(req.body.owner, req.body.repo, req.body.issue_number, req.body.model)));
router.post('/auto-label', h(req => c.autoLabelIssues(req.body.owner, req.body.repo, req.body.model)));
router.post('/improve-readme', h(req => c.improveReadme(req.body.owner, req.body.repo, req.body.model)));
router.post('/add-contributing', h(req => c.addContributing(req.body.owner, req.body.repo)));
router.post('/add-templates', h(req => c.addIssueTemplates(req.body.owner, req.body.repo)));
router.post('/add-ci', h(req => c.addCIWorkflow(req.body.owner, req.body.repo, req.body.model)));
router.post('/write-tests', h(req => c.writeTests(req.body.owner, req.body.repo, req.body.model)));

module.exports = router;
