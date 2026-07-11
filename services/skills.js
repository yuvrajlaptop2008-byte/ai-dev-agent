/**
 * SKILLS — on-demand capability bundles (Hermes-style SKILL.md layout).
 * Only lightweight metadata (name+description) is always in context; the full
 * tool schemas for a skill are loaded into the agent's tool list only when
 * `activate_skill` is called for it — saves tokens on every call that doesn't
 * need git/github/browser.
 */
const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '../skills');

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    meta[key] = val;
  }
  return { meta, body: m[2].trim() };
}

let _cache = null;
function loadAll() {
  if (_cache) return _cache;
  _cache = {};
  if (!fs.existsSync(SKILLS_DIR)) return _cache;
  for (const name of fs.readdirSync(SKILLS_DIR)) {
    const skillMdPath = path.join(SKILLS_DIR, name, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) continue;
    const raw = fs.readFileSync(skillMdPath, 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    _cache[name] = {
      name: meta.name || name,
      description: meta.description || '',
      keywords: (meta.keywords || '').split(',').map(s => s.trim()).filter(Boolean),
      tools: (meta.tools || '').split(',').map(s => s.trim()).filter(Boolean),
      activates: (meta.activates || '').split(',').map(s => s.trim()).filter(Boolean),
      body,
    };
  }
  return _cache;
}

function listSkillMeta() {
  const all = loadAll();
  return Object.values(all).map(s => ({ name: s.name, description: s.description }));
}

function getSkill(name) {
  return loadAll()[name] || null;
}

// Resolve a skill name to the full set of tool names it (and anything it auto-activates) grants.
function resolveToolNames(name, seen = new Set()) {
  const s = getSkill(name);
  if (!s || seen.has(name)) return [];
  seen.add(name);
  let names = [...s.tools];
  for (const dep of s.activates) names = names.concat(resolveToolNames(dep, seen));
  return [...new Set(names)];
}

// Best-effort auto-suggest: which skills look relevant to a task, by keyword overlap.
function suggestSkills(task) {
  const t = (task || '').toLowerCase();
  const all = loadAll();
  return Object.values(all)
    .filter(s => s.keywords.some(k => t.includes(k.toLowerCase())))
    .map(s => s.name);
}

module.exports = { listSkillMeta, getSkill, resolveToolNames, suggestSkills, SKILLS_DIR };
