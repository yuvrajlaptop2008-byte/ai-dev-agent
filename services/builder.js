/**
 * BUILDER - Builds complete open-source projects from an idea and ships them
 * to a real new GitHub repo: architecture, code, tests, CI, docs, license.
 */
const gh = require('./github');
const { chat } = require('./openrouter');
const brain = require('./brain');

async function architect(idea, model) {
  const prompt = `You are a principal engineer designing a new open-source project.

Idea: ${idea}

Return JSON only:
{
  "name": "kebab-case-repo-name",
  "description": "one-line pitch",
  "tech_stack": "e.g. Node.js + TypeScript",
  "architecture": "2-3 sentence architecture summary",
  "files": [
    {"path": "src/index.js", "purpose": "entry point"},
    {"path": "package.json", "purpose": "manifest"}
  ]
}
List every file needed for a working MVP (10-25 files): source code, config, tests, README, LICENSE, CI workflow, .gitignore. Be concrete and complete.`;

  const r = await chat([{ role: 'user', content: prompt }], model, [], null, { max_tokens: 4000, temperature: 0.3 });
  let txt = r.choices[0].message.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(txt);
}

async function generateFile(projectName, description, architecture, filePath, purpose, model) {
  const prompt = `Project: ${projectName} — ${description}
Architecture: ${architecture}

Write the COMPLETE, production-quality content for this file: ${filePath}
Purpose: ${purpose}

Rules:
- Full working code, no placeholders, no "TODO: implement"
- Include imports, error handling, comments where helpful
- If it's package.json, include realistic scripts and deps
- If it's README.md, include badges, install, usage, examples, license section
- If it's a LICENSE, use MIT with "AI Dev Agent Contributors" as copyright holder
- Return ONLY the raw file content, no markdown fences, no explanation`;

  const r = await chat([{ role: 'user', content: prompt }], model, [], null, { max_tokens: 6000, temperature: 0.2 });
  return r.choices[0].message.content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
}

async function buildProject(idea, model, opts = {}) {
  const log = [];
  const push = (m) => { log.push(m); };

  push(`🧠 Architecting: ${idea}`);
  const plan = await architect(idea, model || 'anthropic/claude-3.5-sonnet');
  push(`📐 ${plan.name} — ${plan.description} (${plan.files.length} files)`);

  push(`🐙 Creating repo ${plan.name}...`);
  const repo = await gh.createRepo(plan.name, plan.description, opts.private || false);
  const owner = repo.owner.login;

  const CONCURRENCY = 3;
  const files = plan.files;
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (f) => {
      try {
        const content = await generateFile(plan.name, plan.description, plan.architecture, f.path, f.purpose, model || 'anthropic/claude-3.5-sonnet');
        await gh.putFile(owner, plan.name, f.path, content, `feat: add ${f.path}`);
        push(`✅ ${f.path}`);
      } catch (e) { push(`❌ ${f.path}: ${e.message}`); }
    }));
  }

  try {
    const kw = plan.tech_stack.toLowerCase().split(/[\s+]+/).filter(w => w.length > 2).slice(0, 5);
    await require('axios').put(`https://api.github.com/repos/${owner}/${plan.name}/topics`,
      { names: kw }, { headers: { Authorization: `token ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github.mercy-preview+json' } });
  } catch {}

  await brain.saveMemory(plan.name, { idea, description: plan.description, url: repo.html_url }, 'built_projects');

  push(`🎉 Shipped: ${repo.html_url}`);
  return { log, repo: repo.html_url, plan };
}

async function strengthenProfile(username, model) {
  const repos = await gh.getUserRepos(username);
  const results = [];
  for (const r of repos.slice(0, 10)) {
    try {
      const info = await gh.getRepo(r.owner.login, r.name);
      const gaps = [];
      if (!info.description) gaps.push('missing description');
      if (!info.has_wiki && info.open_issues_count === 0) gaps.push('no community docs');
      results.push({ repo: r.name, stars: info.stargazers_count, gaps });
    } catch {}
  }
  return results;
}

module.exports = { architect, generateFile, buildProject, strengthenProfile };
