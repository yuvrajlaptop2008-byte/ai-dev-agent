const router = require('express').Router();
const or = require('../services/openrouter');
const gh = require('../services/github');
const { db } = require('../db');

router.get('/', async (req, res) => {
  const out = { ok: true, checks: {} };

  try { await gh.getAuthenticatedUser(); out.checks.github = 'ok'; }
  catch (e) { out.checks.github = `error: ${e.message}`; out.ok = false; }

  try {
    const r = await or.chat([{ role: 'user', content: 'ping' }], or.DEFAULT_MODEL, [], null, { max_tokens: 5 });
    out.checks.openrouter = r?.choices?.length ? 'ok' : 'no response';
  } catch (e) { out.checks.openrouter = `error: ${e.message}`; out.ok = false; }

  out.checks.modelHealth = or.modelHealth();
  out.checks.modelCache = or.getCacheInfo();

  try { out.checks.mcpServers = db.prepare('SELECT COUNT(*) c FROM mcp_servers WHERE enabled=1').get().c; } catch { out.checks.mcpServers = 0; }

  res.json(out);
});

module.exports = router;
