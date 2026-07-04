const router = require('express').Router();
const crypto = require('crypto');
const contributor = require('../services/contributor');
const gh = require('../services/github');

const SECRET = process.env.GITHUB_WEBHOOK_SECRET || '';

function verify(req) {
  if (!SECRET) return true;
  const sig = req.headers['x-hub-signature-256'];
  if (!sig) return false;
  const hmac = crypto.createHmac('sha256', SECRET).update(JSON.stringify(req.body)).digest('hex');
  return sig === `sha256=${hmac}`;
}

router.post('/', async (req, res) => {
  if (!verify(req)) return res.status(401).json({ error: 'bad signature' });
  const event = req.headers['x-github-event'];
  const body = req.body;
  res.json({ ok: true }); // ack immediately

  try {
    if (event === 'issues' && body.action === 'opened') {
      const { owner, name: repo } = body.repository.owner ? { owner: body.repository.owner.login, name: body.repository.name } : {};
      await gh.addLabels(owner, repo, body.issue.number, ['needs-triage']).catch(() => {});
    }
    if (event === 'issues' && body.action === 'labeled' && body.label?.name === 'ai-fix') {
      const owner = body.repository.owner.login, repo = body.repository.name;
      contributor.solveIssue(owner, repo, body.issue.number, 'anthropic/claude-3.5-sonnet').catch(() => {});
    }
  } catch (e) { console.error('webhook error', e.message); }
});

module.exports = router;
