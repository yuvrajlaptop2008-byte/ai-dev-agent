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
    const owner = body.repository?.owner?.login;
    const repo = body.repository?.name;

    if (event === 'issues' && body.action === 'opened') {
      await gh.addLabels(owner, repo, body.issue.number, ['needs-triage']).catch(() => {});
    }
    if (event === 'issues' && body.action === 'labeled' && body.label?.name === 'ai-fix') {
      contributor.solveIssue(owner, repo, body.issue.number, 'anthropic/claude-3.5-sonnet').catch(() => {});
    }
    if (event === 'pull_request' && body.action === 'opened') {
      const diff = await gh.getPRDiff(owner, repo, body.pull_request.number).catch(() => null);
      if (diff) {
        const brain = require('../services/brain');
        const review = await brain.analyzeCode(String(diff).slice(0, 6000), 'diff', 'Review this PR diff for bugs, security issues, and code quality. Be concise.', 'anthropic/claude-3.5-sonnet');
        await gh.reviewPR(owner, repo, body.pull_request.number, `🤖 ARIA auto-review:\n\n${review.slice(0, 3000)}`, 'COMMENT').catch(() => {});
      }
    }
    if (event === 'check_run' && body.check_run?.conclusion === 'failure') {
      await gh.commentIssue(owner, repo, body.check_run.pull_requests?.[0]?.number, `⚠️ CI check "${body.check_run.name}" failed. Label this PR \`ai-fix\` to have ARIA investigate.`).catch(() => {});
    }
  } catch (e) { console.error('webhook error', e.message); }
});

module.exports = router;
