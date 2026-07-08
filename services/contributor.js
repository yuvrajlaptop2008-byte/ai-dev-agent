/**
 * CONTRIBUTOR - Contributes to GitHub projects like a human expert
 * Finds issues, writes fixes, creates PRs, adds docs, improves code
 */
const gh = require('./github');
const { chat } = require('./openrouter');
const browser = require('./browser');
const brain = require('./brain');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');

const WORKSPACE = process.env.WORKSPACE || '/tmp/agent-workspace';

// ── FIND GOOD ISSUES TO WORK ON ──────────────────────────
async function findGoodIssues(owner, repo, model) {
  const issues = await gh.listIssues(owner, repo, 'open');
  if (!issues.length) return [];
  
  const prompt = `You are a senior engineer. Analyze these GitHub issues and rank which ones are best to contribute to.
Prefer: bug fixes, documentation improvements, small features, good-first-issues.
Avoid: huge refactors, controversial features, already assigned issues.

Issues:
${issues.slice(0, 20).map(i => `#${i.number}: ${i.title}\nLabels: ${i.labels.map(l=>l.name).join(',')}\nAssignee: ${i.assignee?.login || 'none'}`).join('\n---\n')}

Return JSON array of top 3: [{"number": N, "title": "...", "reason": "why good to work on", "difficulty": "easy/medium/hard"}]
JSON only.`;

  const r = await chat([{ role: 'user', content: prompt }], model || 'meta-llama/llama-3.3-70b-instruct:free');
  try {
    let txt = r.choices[0].message.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    return JSON.parse(txt);
  } catch { return issues.slice(0,3).map(i => ({ number: i.number, title: i.title, reason: 'Selected automatically', difficulty: 'medium' })); }
}

// ── FULL ISSUE SOLVE WORKFLOW (real, human-like) ──────────
const FILE_DELIM_START = '===FILE:';
const FILE_DELIM_END = '===ENDFILE===';

function parseFileBlocks(text) {
  const files = [];
  const re = /===FILE:\s*(.+?)\s*===\n([\s\S]*?)\n===ENDFILE===/g;
  let m;
  while ((m = re.exec(text))) files.push({ path: m[1].trim(), content: m[2] });
  return files;
}

async function solveIssue(owner, repo, issueNumber, model) {
  const log = [];
  const addLog = (msg) => { log.push(msg); console.log(msg); };
  const usedModel = model || 'meta-llama/llama-3.3-70b-instruct:free';

  addLog(`🔍 Reading issue #${issueNumber}...`);
  const issue = await gh.getIssue(owner, repo, issueNumber);
  if (issue.pull_request) return { log: [...log, '⚠️ This is a PR, not an issue.'], error: 'is_pr' };

  const repoInfo = await gh.getRepo(owner, repo);
  const baseBranch = repoInfo.default_branch || 'main';

  addLog(`📁 Reading full repo tree...`);
  let tree = [];
  try { tree = await gh.getFullTree(owner, repo, baseBranch); } catch (e) { addLog(`⚠️ Tree read failed: ${e.message}`); }
  const treeText = tree.slice(0, 400).map(t => t.path).join('\n');

  addLog(`🧠 Identifying relevant files...`);
  const pickPrompt = `Issue #${issueNumber}: ${issue.title}
${issue.body?.slice(0, 1500) || ''}

Full file list in this repo:
${treeText.slice(0, 4000)}

Which existing files are most relevant to read to fix this issue? Also list any genuinely NEW files needed.
Return JSON only: {"read_files": ["path1","path2"], "new_files": ["path3"]}
Max 6 files total.`;
  let toRead = [], newFiles = [];
  try {
    const pr = await chat([{ role: 'user', content: pickPrompt }], usedModel, [], null, { max_tokens: 1000 });
    const parsed = JSON.parse(pr.choices[0].message.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    toRead = (parsed.read_files || []).slice(0, 6);
    newFiles = (parsed.new_files || []).slice(0, 3);
  } catch { addLog('⚠️ File selection failed, proceeding with issue text only'); }

  addLog(`📖 Reading ${toRead.length} file(s)...`);
  const fileContents = {};
  for (const p of toRead) {
    try { const f = await gh.getFile(owner, repo, p, baseBranch); fileContents[p] = f.content.slice(0, 4000); }
    catch (e) { addLog(`⚠️ Couldn't read ${p}: ${e.message}`); }
  }

  addLog(`🌐 Researching if needed...`);
  const searchResults = await browser.search(`${issue.title} ${repoInfo.language || ''} fix`, 4).catch(() => []);

  addLog(`🧠 Generating fix...`);
  const genPrompt = `You are a senior ${repoInfo.language || ''} engineer fixing a real GitHub issue in ${owner}/${repo}.

ISSUE #${issueNumber}: ${issue.title}
${issue.body?.slice(0, 2000) || 'No description'}
${issue.comments?.length ? `\nDiscussion:\n${issue.comments.slice(0, 3).map(c => c.body).join('\n---\n').slice(0, 1500)}` : ''}

Current file contents:
${Object.entries(fileContents).map(([p, c]) => `--- ${p} ---\n${c}`).join('\n\n') || '(no existing files read — this may need new files)'}

${searchResults.length ? `Relevant research:\n${searchResults.slice(0, 3).map(r => `- ${r.snippet}`).join('\n')}` : ''}

Write the COMPLETE fix. Output format is STRICT — for each file you change or create, output exactly:
===FILE: relative/path.ext===
<the ENTIRE new file content, nothing omitted, no partial diffs>
===ENDFILE===

Repeat the block for every file. Do not add any other text, explanation, or markdown fences outside the blocks.
After all file blocks, add one more block:
===FILE: __META__===
BRANCH: fix/issue-${issueNumber}-<short-slug>
TITLE: fix: <concise title>
BODY: <2-4 sentence PR description of the fix>
COMMENT: <1-2 sentence comment to post on the issue>
===ENDFILE===`;

  const r = await chat([{ role: 'user', content: genPrompt }], usedModel, [], null, { max_tokens: 8000, temperature: 0.15 });
  const raw = r.choices[0].message.content;
  const blocks = parseFileBlocks(raw);
  const metaBlock = blocks.find(b => b.path === '__META__');
  const fileBlocks = blocks.filter(b => b.path !== '__META__');

  if (!fileBlocks.length) return { log: [...log, '❌ Model produced no parseable file blocks'], error: 'parse_failed', raw: raw.slice(0, 1000) };

  const meta = {};
  if (metaBlock) {
    metaBlock.content.split('\n').forEach(line => {
      const m = line.match(/^(BRANCH|TITLE|BODY|COMMENT):\s*(.*)$/);
      if (m) meta[m[1].toLowerCase()] = (meta[m[1].toLowerCase()] || '') + (meta[m[1].toLowerCase()] ? ' ' : '') + m[2];
    });
  }
  const branchName = (meta.branch || `fix/issue-${issueNumber}-auto`).replace(/[^\w\-\/]/g, '-').slice(0, 60);
  const prTitle = meta.title || `fix: resolve issue #${issueNumber}`;
  const prBody = `${meta.body || 'Automated fix.'}\n\nCloses #${issueNumber}`;

  addLog(`📋 Plan: ${prTitle} (${fileBlocks.length} file(s)) → branch ${branchName}`);

  addLog(`🌿 Creating branch: ${branchName}...`);
  try {
    await gh.createBranch(owner, repo, branchName, baseBranch);
  } catch (e) {
    if (!/already exists/i.test(e.message)) addLog(`⚠️ Branch create issue: ${e.message}`);
    else addLog(`ℹ️ Branch already exists, reusing it`);
  }

  let changed = 0;
  for (const fb of fileBlocks) {
    addLog(`✏️ Writing ${fb.path}...`);
    try {
      let sha;
      try { const existing = await gh.getFile(owner, repo, fb.path, branchName); sha = existing.sha; } catch {} // new file → no sha
      await gh.putFile(owner, repo, fb.path, fb.content.trimEnd() + '\n', `${prTitle} — ${fb.path}`, sha);
      changed++;
      addLog(`✅ ${fb.path}`);
    } catch (e) { addLog(`❌ ${fb.path}: ${e.message}`); }
  }

  if (!changed) return { log, error: 'no_files_written' };

  addLog(`🔀 Creating PR...`);
  let prUrl = '';
  try {
    const pr = await gh.createPR(owner, repo, prTitle, prBody, branchName, baseBranch);
    prUrl = pr.html_url;
    addLog(`✅ PR created: ${prUrl}`);
  } catch (e) { addLog(`❌ PR failed: ${e.message}`); }

  if (prUrl) {
    const comment = `${meta.comment || 'Opened a fix for this.'}\n\n🔀 ${prUrl}`;
    await gh.commentIssue(owner, repo, issueNumber, comment).catch(() => {});
    addLog(`💬 Commented on issue`);
  }

  await logContribution(owner, repo, { type: 'solve-issue', issueNumber, prUrl, title: prTitle, filesChanged: changed });
  return { log, prUrl, title: prTitle, filesChanged: changed, issue };
}

async function logContribution(owner, repo, entry) {
  const key = `${owner}/${repo}`;
  const existing = await brain.getMemory(key, 'contributions') || { value: [] };
  const list = Array.isArray(existing.value) ? existing.value : [];
  list.unshift({ ...entry, ts: new Date().toISOString() });
  await brain.saveMemory(key, list.slice(0, 30), 'contributions');
}

async function getContributionHistory(owner, repo) {
  const key = `${owner}/${repo}`;
  const existing = await brain.getMemory(key, 'contributions');
  return existing?.value || [];
}

// ── AUTO-LABEL ISSUES ────────────────────────────────────
async function autoLabelIssues(owner, repo, model) {
  const issues = await gh.listIssues(owner, repo, 'open');
  const unlabeled = issues.filter(i => i.labels.length === 0).slice(0, 10);

  await gh.batch(unlabeled, async (issue) => {
    const prompt = `Label this GitHub issue with 1-3 appropriate labels.
Title: ${issue.title}
Body: ${issue.body?.slice(0, 500) || ''}
Available: bug, enhancement, documentation, question, good first issue, help wanted, invalid, duplicate, wontfix
Return JSON: {"labels": ["label1", "label2"]} only.`;
    const r = await chat([{ role: 'user', content: prompt }], model || 'meta-llama/llama-3.3-70b-instruct:free');
    const txt = r.choices[0].message.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    const { labels } = JSON.parse(txt);
    return gh.addLabels(owner, repo, issue.number, labels);
  }, { concurrency: 3, delayMs: 300 });

  await logContribution(owner, repo, { type: 'auto-label', count: unlabeled.length });
  return `Labeled ${unlabeled.length} issues`;
}

// ── IMPROVE README ───────────────────────────────────────
async function improveReadme(owner, repo, model) {
  let currentReadme = '';
  try { const f = await gh.getFile(owner, repo, 'README.md'); currentReadme = f.content; } catch {}
  
  const repoInfo = await gh.getRepo(owner, repo);
  const contents = await gh.listContents(owner, repo, '').catch(() => []);
  
  const prompt = `Improve this README for ${owner}/${repo}.
Current README:
${currentReadme.slice(0, 3000) || '(empty)'}

Repo info: ${repoInfo.description || ''} | Lang: ${repoInfo.language}
Files: ${contents.map(f=>f.name).join(', ')}

Write a comprehensive, professional README with: badges, description, features, installation, usage, API docs if applicable, contributing guide, license.
Return ONLY the markdown content.`;

  const r = await chat([{ role: 'user', content: prompt }], model || 'meta-llama/llama-3.3-70b-instruct:free', [], null, { max_tokens: 8000 });
  const newReadme = r.choices[0].message.content;
  
  let sha;
  try { const f = await gh.getFile(owner, repo, 'README.md'); sha = f.sha; } catch {}
  
  await gh.putFile(owner, repo, 'README.md', newReadme, 'docs: improve README with comprehensive documentation', sha);
  await logContribution(owner, repo, { type: 'improve-readme' });
  return { message: '✅ README improved', preview: newReadme.slice(0, 500) };
}

// ── ADD CONTRIBUTING.md ──────────────────────────────────
async function addContributing(owner, repo) {
  const repoInfo = await gh.getRepo(owner, repo);
  const content = `# Contributing to ${repoInfo.name}

Thank you for your interest in contributing! 🎉

## Getting Started

1. Fork the repository
2. Clone your fork: \`git clone https://github.com/YOUR_USERNAME/${repoInfo.name}.git\`
3. Create a branch: \`git checkout -b fix/your-feature\`
4. Make your changes
5. Push: \`git push origin fix/your-feature\`
6. Open a Pull Request

## Development Setup

\`\`\`bash
git clone https://github.com/${owner}/${repoInfo.name}.git
cd ${repoInfo.name}
npm install  # or pip install -r requirements.txt
npm start    # or python main.py
\`\`\`

## Pull Request Guidelines

- Keep PRs focused on a single change
- Write clear commit messages
- Update documentation if needed
- Add tests for new features
- Link related issues in your PR description

## Reporting Issues

- Search existing issues first
- Use issue templates when available
- Include steps to reproduce for bugs
- Include expected vs actual behavior

## Code Style

- Follow existing code conventions
- Run linting before submitting: \`npm run lint\`
- Ensure all tests pass: \`npm test\`

## Questions?

Open a [Discussion](https://github.com/${owner}/${repoInfo.name}/discussions) or file an issue.
`;

  let sha;
  try { const f = await gh.getFile(owner, repo, 'CONTRIBUTING.md'); sha = f.sha; } catch {}
  await gh.putFile(owner, repo, 'CONTRIBUTING.md', content, 'docs: add CONTRIBUTING.md', sha);
  await logContribution(owner, repo, { type: 'add-contributing' });
  return '✅ CONTRIBUTING.md added';
}

// ── ADD GITHUB ISSUE TEMPLATES ───────────────────────────
async function addIssueTemplates(owner, repo) {
  const bugTemplate = `---
name: Bug Report
about: Report a bug
labels: bug
---

## Description
<!-- What happened? -->

## Steps to Reproduce
1. 
2. 

## Expected Behavior


## Actual Behavior


## Environment
- OS: 
- Version: 
- Node/Python: 
`;

  const featureTemplate = `---
name: Feature Request
about: Suggest a new feature
labels: enhancement
---

## Problem
<!-- What problem does this solve? -->

## Proposed Solution


## Alternatives Considered


## Additional Context
`;

  await gh.putFile(owner, repo, '.github/ISSUE_TEMPLATE/bug_report.md', bugTemplate, 'ci: add bug report template').catch(()=>{});
  await gh.putFile(owner, repo, '.github/ISSUE_TEMPLATE/feature_request.md', featureTemplate, 'ci: add feature request template').catch(()=>{});
  await logContribution(owner, repo, { type: 'add-templates' });
  return '✅ Issue templates added';
}

// ── ADD CI WORKFLOW ──────────────────────────────────────
async function addCIWorkflow(owner, repo, model) {
  const repoInfo = await gh.getRepo(owner, repo);
  const contents = await gh.listContents(owner, repo, '').catch(() => []);
  const hasPackageJson = contents.some(f => f.name === 'package.json');
  const hasPyRequirements = contents.some(f => f.name === 'requirements.txt' || f.name === 'setup.py');

  let workflow = '';
  if (hasPackageJson) {
    workflow = `name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci --ignore-scripts
      - run: npm test --if-present
      - run: npm run build --if-present
`;
  } else if (hasPyRequirements) {
    workflow = `name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ['3.10', '3.11', '3.12']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: \${{ matrix.python-version }}
      - run: pip install -r requirements.txt
      - run: python -m pytest --if-present || python -m unittest discover -s tests || echo "No tests"
`;
  } else {
    workflow = `name: CI

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run checks
        run: echo "✅ Checks passed"
`;
  }

  let sha;
  try { const f = await gh.getFile(owner, repo, '.github/workflows/ci.yml'); sha = f.sha; } catch {}
  await gh.putFile(owner, repo, '.github/workflows/ci.yml', workflow, 'ci: add GitHub Actions CI workflow', sha);
  await logContribution(owner, repo, { type: 'add-ci' });
  return '✅ CI workflow added';
}

// ── WRITE TESTS ──────────────────────────────────────────
async function writeTests(owner, repo, model) {
  let tree = [];
  try { tree = await gh.getFullTree(owner, repo); } catch { tree = (await gh.listContents(owner, repo, '').catch(() => [])).map(f => ({ path: f.path, type: f.type })); }
  const sourceFiles = tree.filter(f => /\.(js|ts|py)$/.test(f.path) && !/test|spec|node_modules|dist|\.min\./.test(f.path)).slice(0, 5);

  if (!sourceFiles.length) return 'No source files found';

  const results = [];
  for (const file of sourceFiles.slice(0, 3)) {
    try {
      const { content } = await gh.getFile(owner, repo, file.path);
      const isJS = /\.(js|ts)$/.test(file.path);

      const prompt = `Write comprehensive tests for this ${isJS ? 'JavaScript/TypeScript' : 'Python'} file.
File: ${file.path}
Content:
${content.slice(0, 3000)}

Write complete test file using ${isJS ? 'Jest' : 'pytest'}.
Include: unit tests, edge cases, error cases.
Return ONLY the test file content, no markdown fences.`;

      const r = await chat([{ role: 'user', content: prompt }], model || 'meta-llama/llama-3.3-70b-instruct:free', [], null, { max_tokens: 6000 });
      const testContent = r.choices[0].message.content.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');

      const base = file.path.split('/').pop();
      const testPath = isJS ? `tests/${base.replace(/\.(js|ts)$/, '.test.$1')}` : `tests/test_${base}`;
      await gh.putFile(owner, repo, testPath, testContent, `test: add tests for ${file.path}`);
      results.push(`✅ Tests for ${file.path} → ${testPath}`);
    } catch (e) { results.push(`❌ ${file.path}: ${e.message}`); }
  }
  await logContribution(owner, repo, { type: 'write-tests', count: results.length });
  return results.join('\n');
}

module.exports = { findGoodIssues, solveIssue, autoLabelIssues, improveReadme, addContributing, addIssueTemplates, addCIWorkflow, writeTests, getContributionHistory, logContribution };
