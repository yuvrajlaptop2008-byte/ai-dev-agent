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
  const plan = await architect(idea, model || 'meta-llama/llama-3.3-70b-instruct:free');
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
        const content = await generateFile(plan.name, plan.description, plan.architecture, f.path, f.purpose, model || 'meta-llama/llama-3.3-70b-instruct:free');
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

async function strengthenProfile(username, model, opts = {}) {
  const contributor = require('./contributor');
  const log = [];
  const push = (m) => { log.push(m); };
  const usedModel = model || 'meta-llama/llama-3.3-70b-instruct:free';

  push(`🔍 Scanning ${username}'s repos...`);
  const repos = await gh.getUserRepos(username);
  const results = [];

  for (const r of repos.slice(0, opts.limit || 15)) {
    const owner = r.owner.login, name = r.name;
    if (r.fork && !opts.includeForks) continue;
    const fixed = [];
    try {
      const info = await gh.getRepo(owner, name);

      if (!info.description) {
        const prompt = `One-line professional description (max 100 chars, no period at end) for a repo named "${name}", language ${info.language || 'unknown'}. Look at repo purpose from its name. Return ONLY the description text.`;
        try {
          const rr = await chat([{ role: 'user', content: prompt }], usedModel, [], null, { max_tokens: 100, temperature: 0.4 });
          const desc = rr.choices[0].message.content.trim().replace(/^["']|["']$/g, '').slice(0, 120);
          await gh.updateRepoSettings(owner, name, { description: desc });
          fixed.push('description');
        } catch {}
      }

      if (!info.topics || info.topics.length === 0) {
        try {
          const topics = [info.language, ...name.split(/[-_]/)].filter(Boolean).map(t => t.toLowerCase()).filter(t => /^[a-z0-9-]+$/.test(t)).slice(0, 6);
          if (topics.length) { await gh.setRepoTopics(owner, name, topics); fixed.push('topics'); }
        } catch {}
      }

      let readme = '';
      try { readme = (await gh.getFile(owner, name, 'README.md')).content; } catch {}
      if (!readme || readme.trim().length < 100) {
        try { await contributor.improveReadme(owner, name, usedModel); fixed.push('README'); } catch {}
      }

      let hasLicense = false;
      try { await gh.getFile(owner, name, 'LICENSE'); hasLicense = true; } catch {}
      if (!hasLicense) {
        try {
          const mit = `MIT License\n\nCopyright (c) ${new Date().getFullYear()} ${username}\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.\n`;
          await gh.putFile(owner, name, 'LICENSE', mit, 'chore: add MIT license');
          fixed.push('LICENSE');
        } catch {}
      }

      let hasCI = false;
      try { await gh.getFile(owner, name, '.github/workflows/ci.yml'); hasCI = true; } catch {}
      if (!hasCI) {
        try { await contributor.addCIWorkflow(owner, name, usedModel); fixed.push('CI'); } catch {}
      }

      push(`${fixed.length ? '✅' : 'ℹ️'} ${name}: ${fixed.length ? fixed.join(', ') : 'already solid'}`);
      results.push({ repo: name, stars: info.stargazers_count, fixed });
    } catch (e) { push(`❌ ${name}: ${e.message}`); }
  }

  return { log, results };
}

// Generates/updates the special <username>/<username> profile README shown on the GitHub profile page.
async function buildProfileReadme(username, model) {
  const usedModel = model || 'meta-llama/llama-3.3-70b-instruct:free';
  const repos = await gh.getUserRepos(username);
  const top = repos.filter(r => !r.fork).sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 6);

  const prompt = `Write a professional GitHub profile README.md for the user "${username}".
Their notable repos: ${top.map(r => `${r.name} (${r.language || ''}, ⭐${r.stargazers_count}): ${r.description || ''}`).join(' | ')}

Include: a strong intro line, tech stack badges (shields.io) inferred from their repo languages, a "Featured Projects" section linking the repos above, and a GitHub stats card (github-readme-stats.vercel.app). Keep it clean, no filler, no placeholder text like "[Your bio here]" — write real content based on the repo data given.
Return ONLY the markdown.`;

  const r = await chat([{ role: 'user', content: prompt }], usedModel, [], null, { max_tokens: 3000, temperature: 0.4 });
  const readme = r.choices[0].message.content.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');

  let profileRepoExists = true;
  try { await gh.getRepo(username, username); } catch { profileRepoExists = false; }
  if (!profileRepoExists) await gh.createRepo(username, `${username}'s GitHub profile`, false);

  let sha;
  try { sha = (await gh.getFile(username, username, 'README.md')).sha; } catch {}
  await gh.putFile(username, username, 'README.md', readme, 'docs: update profile README', sha);

  return { url: `https://github.com/${username}`, readme: readme.slice(0, 500) };
}

module.exports = { architect, generateFile, buildProject, strengthenProfile, buildProfileReadme };
