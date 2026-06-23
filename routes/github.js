const router = require('express').Router();
const gh = require('../services/github');

router.get('/repos/:owner', async (req, res) => {
  try { res.json(await gh.getUserRepos(req.params.owner)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/repos/:owner/:repo/issues', async (req, res) => {
  try { res.json(await gh.listIssues(req.params.owner, req.params.repo, req.query.state || 'open')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/repos/:owner/:repo/issues/:number', async (req, res) => {
  try { res.json(await gh.getIssue(req.params.owner, req.params.repo, parseInt(req.params.number))); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/repos/:owner/:repo/issues/:number/comment', async (req, res) => {
  try { res.json(await gh.createIssueComment(req.params.owner, req.params.repo, parseInt(req.params.number), req.body.body)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/repos/:owner/:repo/contents', async (req, res) => {
  try { res.json(await gh.getRepoContents(req.params.owner, req.params.repo, req.query.path || '')); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
