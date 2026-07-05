/**
 * REPOINDEX - Caches file listings/contents per repo so the agent doesn't
 * re-fetch unchanged files across iterations/tasks. Big token saver.
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '../data/repoindex.json');
const TTL = 20 * 60 * 1000;

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } }
function save(idx) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(idx)); }

function key(owner, repo, p) { return `${owner}/${repo}:${p || ''}`; }

function get(owner, repo, p) {
  const idx = load();
  const e = idx[key(owner, repo, p)];
  if (e && Date.now() - e.t < TTL) return e.v;
  return null;
}
function set(owner, repo, p, value) {
  const idx = load();
  idx[key(owner, repo, p)] = { v: value, t: Date.now() };
  const keys = Object.keys(idx);
  if (keys.length > 500) keys.slice(0, keys.length - 500).forEach(k => delete idx[k]);
  save(idx);
}
function invalidate(owner, repo) {
  const idx = load();
  for (const k of Object.keys(idx)) if (k.startsWith(`${owner}/${repo}:`)) delete idx[k];
  save(idx);
}

module.exports = { get, set, invalidate };
