/**
 * WATCHER — makes ARIA a genuinely autonomous/"living" agent rather than
 * purely reactive. Polls configured repos on an interval (works for anyone,
 * no public URL needed — unlike routes/webhook.js which requires GitHub to
 * be able to reach you). Finds issues labeled `ai-fix` and solves them
 * automatically, same convention the webhook path already uses so behavior
 * is consistent regardless of which trigger fired.
 */
const fs = require('fs');
const path = require('path');
const gh = require('./github');

const FILE = path.join(__dirname, '../data/watcher.json');
const LABEL = 'ai-fix';

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
  catch { return { enabled: false, intervalMinutes: 15, repos: [], processedIssues: {}, lastRun: null, model: null }; }
}
function save(s) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(s)); }

function status() { return load(); }

function setEnabled(enabled) { const s = load(); s.enabled = !!enabled; save(s); return s; }
function setIntervalMinutes(min) { const s = load(); s.intervalMinutes = Math.max(5, Number(min) || 15); save(s); return s; }
function setModel(model) { const s = load(); s.model = model || null; save(s); return s; }

function addRepo(owner, repo) {
  const s = load();
  const key = `${owner}/${repo}`;
  if (!s.repos.includes(key)) s.repos.push(key);
  save(s);
  return s;
}
function removeRepo(owner, repo) {
  const s = load();
  const key = `${owner}/${repo}`;
  s.repos = s.repos.filter(r => r !== key);
  delete s.processedIssues[key];
  save(s);
  return s;
}

let _running = false;
let _log = [];
function getLog() { return _log; }
function pushLog(msg) { _log.unshift({ msg, ts: new Date().toISOString() }); _log = _log.slice(0, 50); }

// One pass over every watched repo — checks for ai-fix-labeled issues not yet processed,
// solves them. Safe to call repeatedly (tracks processed issue numbers per repo so nothing
// gets solved twice), safe to call even if disabled (caller decides whether to schedule it).
async function runOnce() {
  if (_running) return { skipped: 'already running' };
  _running = true;
  const s = load();
  const contributor = require('./contributor');
  const results = [];
  try {
    for (const key of s.repos) {
      const [owner, repo] = key.split('/');
      if (!owner || !repo) continue;
      try {
        const issues = await gh.listIssues(owner, repo, 'open', LABEL);
        const done = s.processedIssues[key] || [];
        const fresh = issues.filter(i => !done.includes(i.number));
        for (const issue of fresh) {
          pushLog(`🔍 Found ${LABEL} issue #${issue.number} in ${key}: ${issue.title}`);
          try {
            const r = await contributor.solveIssue(owner, repo, issue.number, s.model || undefined);
            pushLog(r.prUrl ? `✅ Solved #${issue.number} → ${r.prUrl}` : `⚠️ #${issue.number} did not produce a PR (${r.error || 'see log'})`);
            results.push({ repo: key, issue: issue.number, prUrl: r.prUrl || null });
          } catch (e) {
            pushLog(`❌ #${issue.number} in ${key} failed: ${e.message}`);
          }
          s.processedIssues[key] = [...(s.processedIssues[key] || []), issue.number];
        }
      } catch (e) {
        pushLog(`❌ Couldn't check ${key}: ${e.message}`);
      }
    }
    s.lastRun = new Date().toISOString();
    save(s);
  } finally {
    _running = false;
  }
  return { checked: s.repos.length, solved: results.length, results };
}

let _timer = null;
function startScheduler() {
  if (_timer) clearInterval(_timer);
  const tick = async () => {
    const s = load();
    if (!s.enabled || !s.repos.length) return;
    try { await runOnce(); } catch (e) { pushLog(`❌ Scheduler tick failed: ${e.message}`); }
  };
  _timer = setInterval(tick, 60 * 1000); // check every minute whether it's time to run
  let lastFired = 0;
  const gatedTick = async () => {
    const s = load();
    const intervalMs = (s.intervalMinutes || 15) * 60 * 1000;
    if (Date.now() - lastFired < intervalMs) return;
    lastFired = Date.now();
    await tick();
  };
  clearInterval(_timer);
  _timer = setInterval(gatedTick, 60 * 1000);
  return true;
}
function stopScheduler() { if (_timer) clearInterval(_timer); _timer = null; }

module.exports = { status, setEnabled, setIntervalMinutes, setModel, addRepo, removeRepo, runOnce, startScheduler, stopScheduler, getLog };
