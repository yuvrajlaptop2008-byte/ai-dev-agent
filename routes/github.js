const router = require('express').Router();
const gh = require('../services/github');

const h = fn => async (req, res) => { try { res.json(await fn(req, res)); } catch (e) { res.status(500).json({ error: e.message }); } };

router.get('/repos/:owner', h(req => gh.getUserRepos(req.params.owner)));
router.get('/repos/:owner/:repo', h(req => gh.getRepo(req.params.owner, req.params.repo)));
router.get('/repos/:owner/:repo/issues', h(req => gh.listIssues(req.params.owner, req.params.repo, req.query.state || 'open')));
router.get('/repos/:owner/:repo/issues/:n', h(req => gh.getIssue(req.params.owner, req.params.repo, req.params.n)));
router.post('/repos/:owner/:repo/issues/:n/comment', h(req => gh.commentIssue(req.params.owner, req.params.repo, req.params.n, req.body.body)));
router.patch('/repos/:owner/:repo/issues/:n', h(req => gh.updateIssue(req.params.owner, req.params.repo, req.params.n, req.body)));
router.get('/repos/:owner/:repo/prs', h(req => gh.listPRs(req.params.owner, req.params.repo, req.query.state || 'open')));
router.post('/repos/:owner/:repo/prs', h(req => gh.createPR(req.params.owner, req.params.repo, req.body.title, req.body.body, req.body.head, req.body.base || 'main')));
router.get('/repos/:owner/:repo/branches', h(req => gh.listBranches(req.params.owner, req.params.repo)));
router.get('/repos/:owner/:repo/commits', h(req => gh.listCommits(req.params.owner, req.params.repo, 20)));
router.get('/repos/:owner/:repo/contents', h(req => gh.listContents(req.params.owner, req.params.repo, req.query.path || '')));
router.get('/repos/:owner/:repo/workflows', h(req => gh.listWorkflows(req.params.owner, req.params.repo)));
router.post('/issues', h(req => gh.createIssue(req.body.owner, req.body.repo, req.body.title, req.body.body, req.body.labels ? req.body.labels.split(',').map(l=>l.trim()) : [], [])));
router.get('/search/repos', h(req => gh.searchRepos(req.query.q)));
router.get('/search/code', h(req => gh.searchCode(req.query.q, req.query.owner, req.query.repo)));
router.get('/me', h(() => gh.getAuthenticatedUser()));
router.get('/me/repos', h(req => gh.listMyRepos(req.query.type ? { type: req.query.type } : {})));
router.delete('/repos/:owner/:repo', h(req => gh.deleteRepo(req.params.owner, req.params.repo)));
router.patch('/repos/:owner/:repo', h(req => gh.updateRepoSettings(req.params.owner, req.params.repo, req.body)));
router.post('/repos/:owner/:repo/collaborators', h(req => gh.addCollaborator(req.params.owner, req.params.repo, req.body.username, req.body.permission || 'push')));
router.put('/repos/:owner/:repo/topics', h(req => gh.setRepoTopics(req.params.owner, req.params.repo, req.body.topics)));

module.exports = router;
