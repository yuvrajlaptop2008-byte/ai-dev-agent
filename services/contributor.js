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

  const r = await chat([{ role: 'user', content: prompt }], model || 'deepseek/deepseek-r1:free');
  try {
    let txt = r.choices[0].message.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    return JSON.parse(txt);
  } catch { return issues.slice(0,3).map(i => ({ number: i.number, title: i.title, reason: 'Selected automatically', difficulty: 'medium' })); }
}

// ── FULL ISSUE SOLVE WORKFLOW ─────────────────────────────
async function solveIssue(owner, repo, issueNumber, model) {
  const log = [];
  const addLog = (msg) => { log.push(msg); console.log(msg); };

  addLog(`🔍 Reading issue #${issueNumber}...`);
  const issue = await gh.getIssue(owner, repo, issueNumber);
  
  // Research the problem
  addLog(`🌐 Researching solution...`);
  const searchResults = await browser.search(`${issue.title} fix solution github`, 5);
  
  // Understand codebase
  addLog(`📁 Analyzing codebase...`);
  let repoStructure = '';
  try {
    const contents = await gh.listContents(owner, repo, '');
    repoStructure = contents.map(f => `${f.type} ${f.path}`).join('\n');
  } catch {}

  // Generate fix
  addLog(`🧠 Generating fix...`);
  const prompt = `You are an expert software engineer contributing to ${owner}/${repo}.

ISSUE #${issueNumber}: ${issue.title}
Body: ${issue.body?.slice(0, 2000) || 'No description'}
Comments: ${issue.comments?.slice(0,3).map(c => c.body).join('\n') || 'none'}

Repo structure:
${repoStructure.slice(0, 1000)}

Research findings:
${searchResults.slice(0,3).map(r => `- ${r.title}: ${r.snippet}`).join('\n')}

Create a complete fix. Return JSON:
{
  "analysis": "what causes this issue",
  "approach": "how you will fix it",
  "branch_name": "fix/issue-${issueNumber}-short-description",
  "files_to_change": [
    {"path": "file/path.js", "change_description": "what to change", "new_content": "FULL file content or null if you need to read first"}
  ],
  "pr_title": "fix: ...",
  "pr_body": "markdown PR description with what was done, how tested",
  "issue_comment": "comment to post on the issue explaining the fix"
}
JSON only.`;

  const r = await chat([{ role: 'user', content: prompt }], model || 'anthropic/claude-3.5-sonnet');
  let fix;
  try {
    let txt = r.choices[0].message.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    fix = JSON.parse(txt);
  } catch { return { log, error: 'Failed to parse fix' }; }

  addLog(`📋 Plan: ${fix.approach}`);

  // Create branch
  addLog(`🌿 Creating branch: ${fix.branch_name}...`);
  try {
    // Try to get default branch
    const repoInfo = await gh.getRepo(owner, repo);
    const baseBranch = repoInfo.default_branch || 'main';
    await gh.createBranch(owner, repo, fix.branch_name, baseBranch);
  } catch (e) {
    addLog(`⚠️ Branch create failed: ${e.message} - trying main`);
    try { await gh.createBranch(owner, repo, fix.branch_name, 'main'); } catch {}
  }

  // Apply file changes
  for (const fileChange of (fix.files_to_change || [])) {
    addLog(`✏️ Updating ${fileChange.path}...`);
    try {
      let content = fileChange.new_content;
      let sha;
      
      // Get current SHA if file exists
      try {
        const existing = await gh.getFile(owner, repo, fileChange.path, fix.branch_name);
        sha = existing.sha;
        if (!content) {
          // Need to generate content based on existing
          const genPrompt = `Current file ${fileChange.path}:\n${existing.content.slice(0,3000)}\n\nChange needed: ${fileChange.change_description}\n\nReturn ONLY the complete new file content, no markdown:`;
          const gr = await chat([{ role:'user', content: genPrompt }], model || 'anthropic/claude-3.5-sonnet');
          content = gr.choices[0].message.content.replace(/^```\w*\n?/,'').replace(/\n?```$/,'');
        }
      } catch { /* new file */ }

      if (content) {
        await gh.putFile(owner, repo, fileChange.path, content, `${fix.pr_title} - ${fileChange.path}`, sha);
        addLog(`✅ Updated ${fileChange.path}`);
      }
    } catch (e) { addLog(`❌ Failed to update ${fileChange.path}: ${e.message}`); }
  }

  // Create PR
  addLog(`🔀 Creating PR...`);
  let prUrl = '';
  try {
    const repoInfo = await gh.getRepo(owner, repo);
    const pr = await gh.createPR(owner, repo, fix.pr_title, fix.pr_body, fix.branch_name, repoInfo.default_branch || 'main');
    prUrl = pr.html_url;
    addLog(`✅ PR created: ${prUrl}`);
  } catch (e) { addLog(`❌ PR failed: ${e.message}`); }

  // Comment on issue
  if (fix.issue_comment && prUrl) {
    const comment = `${fix.issue_comment}\n\n🔀 PR: ${prUrl}`;
    await gh.commentIssue(owner, repo, issueNumber, comment);
    addLog(`💬 Commented on issue`);
  }

  return { log, fix, prUrl, issue };
}

// ── AUTO-LABEL ISSUES ────────────────────────────────────
async function autoLabelIssues(owner, repo, model) {
  const issues = await gh.listIssues(owner, repo, 'open');
  const unlabeled = issues.filter(i => i.labels.length === 0).slice(0, 10);
  
  for (const issue of unlabeled) {
    const prompt = `Label this GitHub issue with 1-3 appropriate labels.
Title: ${issue.title}
Body: ${issue.body?.slice(0, 500) || ''}
Available: bug, enhancement, documentation, question, good first issue, help wanted, invalid, duplicate, wontfix
Return JSON: {"labels": ["label1", "label2"]} only.`;
    
    const r = await chat([{ role: 'user', content: prompt }], model || 'meta-llama/llama-3.3-70b-instruct:free');
    try {
      const txt = r.choices[0].message.content.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
      const { labels } = JSON.parse(txt);
      await gh.addLabels(owner, repo, issue.number, labels);
    } catch {}
  }
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

  const r = await chat([{ role: 'user', content: prompt }], model || 'anthropic/claude-3.5-sonnet', [], null, { max_tokens: 8000 });
  const newReadme = r.choices[0].message.content;
  
  let sha;
  try { const f = await gh.getFile(owner, repo, 'README.md'); sha = f.sha; } catch {}
  
  await gh.putFile(owner, repo, 'README.md', newReadme, 'docs: improve README with comprehensive documentation', sha);
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
  return '✅ CI workflow added';
}

// ── WRITE TESTS ──────────────────────────────────────────
async function writeTests(owner, repo, model) {
  const contents = await gh.listContents(owner, repo, '').catch(() => []);
  const sourceFiles = contents.filter(f => f.type === 'file' && (f.name.endsWith('.js') || f.name.endsWith('.py')) && !f.name.includes('test'));
  
  if (!sourceFiles.length) return 'No source files found';
  
  const results = [];
  for (const file of sourceFiles.slice(0, 3)) {
    try {
      const { content } = await gh.getFile(owner, repo, file.path);
      const isJS = file.name.endsWith('.js');
      
      const prompt = `Write comprehensive tests for this ${isJS ? 'JavaScript' : 'Python'} file.
File: ${file.path}
Content:
${content.slice(0, 3000)}

Write complete test file using ${isJS ? 'Jest/Mocha' : 'pytest/unittest'}.
Include: unit tests, edge cases, error cases.
Return ONLY the test file content.`;

      const r = await chat([{ role: 'user', content: prompt }], model || 'anthropic/claude-3.5-sonnet', [], null, { max_tokens: 6000 });
      const testContent = r.choices[0].message.content.replace(/^```\w*\n?/,'').replace(/\n?```$/,'');
      
      const testPath = isJS ? `tests/${file.name.replace('.js', '.test.js')}` : `tests/test_${file.name}`;
      await gh.putFile(owner, repo, testPath, testContent, `test: add tests for ${file.path}`);
      results.push(`✅ Tests for ${file.path}`);
    } catch (e) { results.push(`❌ ${file.path}: ${e.message}`); }
  }
  return results.join('\n');
}

module.exports = { findGoodIssues, solveIssue, autoLabelIssues, improveReadme, addContributing, addIssueTemplates, addCIWorkflow, writeTests };
