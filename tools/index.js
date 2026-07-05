/**
 * TOOLS - 80+ tools for the autonomous agent
 */
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const execAsync = promisify(exec);

const brain = require('../services/brain');
const browser = require('../services/browser');
const vscode = require('../services/vscode');
const gh = require('../services/github');
const builder = require('../services/builder');
const webllm = require('../services/webllm');

const WORKSPACE = process.env.WORKSPACE || '/tmp/agent-workspace';

// ── HELPERS ──────────────────────────────────────────────
const abs = (p) => path.isAbsolute(p) ? p : path.join(WORKSPACE, p);
const sh = async (cmd, cwd = WORKSPACE, timeout = 45000) => {
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, timeout, env: { ...process.env, HOME: '/tmp' } });
    return ((stdout || '') + (stderr ? `\nSTDERR:\n${stderr}` : '')).slice(0, 8000);
  } catch (e) { return `EXIT ${e.code}:\n${((e.stdout || '') + (e.stderr || e.message)).slice(0, 4000)}`; }
};

// ═══════════════════════════════════════════════════════════
// TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════
const READ_ONLY_TOOLS = new Set([
  'read_file','list_files','search_in_files','web_search','fetch_url','deep_research','read_website',
  'search_npm','search_pypi','fetch_github_readme','fetch_docs','fetch_api','analyze_image',
  'github_get_issue','github_list_issues','github_get_file','github_list_files','github_list_branches',
  'github_list_prs','github_get_repo','github_search_code','github_search_repos','github_list_commits',
  'github_list_workflows','github_workflow_runs','recall','search_memory','analyze_code','vscode_list_extensions','github_whoami','github_list_my_repos'
]);

const T = {

  // ── 1. THINKING & REASONING ───────────────────────────
  think: async ({ reasoning, approach }) => {
    const out = `🧠 THINKING:\n${reasoning}${approach ? `\n\n📋 APPROACH:\n${approach}` : ''}`;
    await brain.saveMemory(`thought_${Date.now()}`, { reasoning, approach }, 'thoughts');
    return out;
  },

  deep_think: async ({ problem, context }, ctx) => {
    return brain.deepThink(problem, ctx?.model || 'meta-llama/llama-3.3-70b-instruct:free', context);
  },

  make_plan: async ({ goal, context }, ctx) => {
    const plan = await brain.createPlan(goal, ctx?.model || 'meta-llama/llama-3.3-70b-instruct:free', context);
    await brain.saveMemory(`plan_${Date.now()}`, plan, 'plans');
    return JSON.stringify(plan, null, 2);
  },

  decide: async ({ options, criteria }, ctx) => {
    const d = await brain.decide(options, criteria, ctx?.model || 'meta-llama/llama-3.3-70b-instruct:free');
    return JSON.stringify(d, null, 2);
  },

  analyze_code: async ({ code, language, task }, ctx) => {
    return brain.analyzeCode(code, language, task, ctx?.model || 'meta-llama/llama-3.3-70b-instruct:free');
  },

  // ── 2. MEMORY ─────────────────────────────────────────
  remember: async ({ key, value, category }) => {
    await brain.saveMemory(key, value, category || 'general');
    return `✅ Remembered: [${category || 'general'}] ${key}`;
  },

  recall: async ({ key, category }) => {
    const v = await brain.getMemory(key || '*', category || 'general');
    return v ? JSON.stringify(v, null, 2) : 'Nothing found in memory';
  },

  search_memory: async ({ query }) => {
    const r = await brain.searchMemory(query);
    return r.length ? JSON.stringify(r, null, 2) : 'No memory matches found';
  },

  // ── 3. BASH / SHELL ───────────────────────────────────
  bash: async ({ command, cwd, timeout_ms }) => sh(command, cwd ? abs(cwd) : WORKSPACE, timeout_ms || 45000),

  bash_interactive: async ({ commands, cwd }) => {
    const results = [];
    for (const cmd of commands) {
      const r = await sh(cmd, cwd ? abs(cwd) : WORKSPACE);
      results.push({ cmd, result: r });
    }
    return results.map(r => `$ ${r.cmd}\n${r.result}`).join('\n\n');
  },

  // ── 4. FILE SYSTEM ───────────────────────────────────
  read_file: async ({ path: p, start_line, end_line }) => {
    const content = await fs.readFile(abs(p), 'utf8');
    if (start_line || end_line) {
      const lines = content.split('\n');
      return lines.slice((start_line || 1) - 1, end_line || lines.length).join('\n').slice(0, 10000);
    }
    return content.length > 12000 ? content.slice(0, 12000) + '\n... [truncated]' : content;
  },

  write_file: async ({ path: p, content, append, create_dirs }) => {
    const full = abs(p);
    await fs.mkdir(path.dirname(full), { recursive: true });
    if (append) await fs.appendFile(full, content);
    else await fs.writeFile(full, content);
    const stat = await fs.stat(full);
    return `✅ ${append ? 'Appended to' : 'Written'} ${full} (${stat.size} bytes)`;
  },

  patch_file: async ({ path: p, old_text, new_text }) => {
    const full = abs(p);
    let content = await fs.readFile(full, 'utf8');
    if (!content.includes(old_text)) return `❌ Text not found in ${p}`;
    content = content.replace(old_text, new_text);
    await fs.writeFile(full, content);
    return `✅ Patched ${p}`;
  },

  list_files: async ({ path: p, recursive, pattern }) => {
    const dir = p ? abs(p) : WORKSPACE;
    if (recursive) {
      const pat = pattern ? `--include="${pattern}"` : '';
      const { stdout } = await execAsync(`find "${dir}" ${pat} -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/__pycache__/*" | sort | head -300`).catch(() => ({ stdout: '' }));
      return stdout || 'Empty directory';
    }
    const items = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    return items.map(i => `${i.isDirectory() ? '📁' : '📄'} ${i.name}`).join('\n') || 'Empty';
  },

  delete_file: async ({ path: p }) => {
    await fs.unlink(abs(p));
    return `✅ Deleted ${p}`;
  },

  move_file: async ({ from, to }) => {
    const src = abs(from), dst = abs(to);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.rename(src, dst);
    return `✅ Moved ${from} → ${to}`;
  },

  copy_file: async ({ from, to }) => {
    const src = abs(from), dst = abs(to);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
    return `✅ Copied ${from} → ${to}`;
  },

  search_in_files: async ({ pattern, path: p, file_ext }) => {
    const dir = p ? abs(p) : WORKSPACE;
    const inc = file_ext ? `--include="*.${file_ext}"` : '';
    const { stdout } = await execAsync(`grep -r ${inc} -n "${pattern}" "${dir}" 2>/dev/null | head -50`).catch(() => ({ stdout: '' }));
    return stdout || 'Not found';
  },

  // ── 5. WEB / BROWSER ─────────────────────────────────
  github_whoami: async () => {
    const u = await gh.getAuthenticatedUser();
    return `${u.login} | ${u.name || ''} | public repos: ${u.public_repos} | followers: ${u.followers}`;
  },

  github_list_my_repos: async ({ type }) => {
    const repos = await gh.listMyRepos(type ? { type } : {});
    return repos.map(r => `${r.private ? '🔒' : '🌐'} ${r.full_name} ⭐${r.stargazers_count} — ${r.description || ''}`).join('\n');
  },

  github_delete_repo: async ({ owner, repo }, ctx) => {
    await gh.deleteRepo(owner || ctx?.owner, repo || ctx?.repo);
    return `✅ Deleted ${owner || ctx?.owner}/${repo || ctx?.repo}`;
  },

  github_update_repo: async ({ owner, repo, description, homepage, private: priv, has_issues, has_wiki }, ctx) => {
    const settings = {};
    if (description !== undefined) settings.description = description;
    if (homepage !== undefined) settings.homepage = homepage;
    if (priv !== undefined) settings.private = priv;
    if (has_issues !== undefined) settings.has_issues = has_issues;
    if (has_wiki !== undefined) settings.has_wiki = has_wiki;
    await gh.updateRepoSettings(owner || ctx?.owner, repo || ctx?.repo, settings);
    return `✅ Repo settings updated`;
  },

  github_add_collaborator: async ({ owner, repo, username, permission }, ctx) => {
    await gh.addCollaborator(owner || ctx?.owner, repo || ctx?.repo, username, permission || 'push');
    return `✅ ${username} added as collaborator`;
  },

  github_archive_repo: async ({ owner, repo, archived }, ctx) => {
    await gh.archiveRepo(owner || ctx?.owner, repo || ctx?.repo, archived !== false);
    return `✅ Repo ${archived !== false ? 'archived' : 'unarchived'}`;
  },

  github_set_topics: async ({ owner, repo, topics }, ctx) => {
    await gh.setRepoTopics(owner || ctx?.owner, repo || ctx?.repo, topics);
    return `✅ Topics set: ${topics.join(', ')}`;
  },

  // ── OS / DEVICE ──────────────────────────────────────────
  create_folder: async ({ path: p }) => {
    const full = abs(p);
    await fs.mkdir(full, { recursive: true });
    return `✅ Folder created: ${full}`;
  },

  open_url: async ({ url }) => {
    const cmd = process.platform === 'darwin' ? `open "${url}"` : process.platform === 'win32' ? `start "" "${url}"` : `xdg-open "${url}"`;
    return sh(`${cmd} 2>&1 || echo "no display available, URL: ${url}"`);
  },

  open_app: async ({ command }) => {
    return sh(`(${command} > /tmp/app.log 2>&1 &) ; sleep 1; echo "launched: ${command}"`);
  },

  browser_automate: async ({ url, actions }) => {
    try {
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const results = [];
      for (const a of (actions || [])) {
        if (a.type === 'click') await page.click(a.selector).catch(e => results.push(`click failed: ${e.message}`));
        if (a.type === 'type') await page.type(a.selector, a.text).catch(e => results.push(`type failed: ${e.message}`));
        if (a.type === 'wait') await new Promise(r => setTimeout(r, a.ms || 1000));
        if (a.type === 'screenshot') { const buf = await page.screenshot({ encoding: 'base64' }); results.push(`screenshot captured (${buf.length} b64 chars)`); }
      }
      const title = await page.title();
      const content = await page.evaluate(() => document.body.innerText.slice(0, 3000));
      await browser.close();
      return `Page: ${title}\n${content}\n${results.join('\n')}`;
    } catch (e) {
      return `Browser automation unavailable (${e.message}). Falling back: use fetch_url/web_search instead.`;
    }
  },

  ask_web_llm: async ({ provider, prompt }) => {
    try {
      const r = await webllm.ask(provider, prompt);
      return r.response;
    } catch (e) { return `${e.message} (use webllm_login tool once first, or rely on your own tools instead)`; }
  },

  webllm_login: async ({ provider }) => {
    const r = await webllm.openLoginWindow(provider);
    return r.message;
  },

  build_project: async ({ idea, private: priv }, ctx) => {
    const r = await builder.buildProject(idea, ctx?.model || 'meta-llama/llama-3.3-70b-instruct:free', { private: priv });
    return `${r.log.join('\n')}\n\nRepo: ${r.repo}`;
  },

  analyze_image: async ({ image_url, question }, ctx) => {
    const { chat } = require('../services/openrouter');
    const model = 'google/gemini-2.0-flash-exp:free';
    const r = await chat([{ role: 'user', content: [{ type: 'text', text: question || 'Describe this image in detail.' }, { type: 'image_url', image_url: { url: image_url } }] }], model);
    return r.choices[0].message.content;
  },

  web_search: async ({ query, num_results }) => {
    const results = await browser.search(query, num_results || 8);
    if (!results.length) return 'No search results found';
    return results.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\n${r.url ? `URL: ${r.url}` : ''}`).join('\n\n');
  },

  fetch_url: async ({ url }) => {
    const page = await browser.fetchPage(url);
    if (page.error) return `Error: ${page.error}`;
    return `TITLE: ${page.title || 'N/A'}\nURL: ${url}\n\n${page.content}`;
  },

  deep_research: async ({ topic, depth }) => {
    const report = await browser.deepResearch(topic, depth || 2);
    const brain_svc = require('../services/brain');
    const { chat } = require('../services/openrouter');

    // Synthesize
    const sources = [
      ...report.searchResults.map(r => `[Search] ${r.title}: ${r.snippet}`),
      ...report.pageContents.map(p => `[Page: ${p.title}] ${p.content?.slice(0, 1500)}`)
    ];

    const synthesis = await brain_svc.synthesizeResearch(topic, sources, 'meta-llama/llama-3.3-70b-instruct:free');
    return `🔍 DEEP RESEARCH: ${topic}\n\n${synthesis}\n\n---\nSources checked: ${report.searchResults.length} search results + ${report.pageContents.length} pages`;
  },

  read_website: async ({ url, extract }) => {
    const snap = await browser.siteSnapshot(url);
    return JSON.stringify(snap, null, 2);
  },

  search_npm: async ({ query }) => {
    const r = await browser.searchNPM(query);
    return r.length ? r.map(p => `📦 ${p.name}@${p.version}\n   ${p.description}\n   ${p.url}`).join('\n\n') : 'Not found';
  },

  search_pypi: async ({ query }) => {
    const r = await browser.searchPyPI(query);
    return r.length ? r.map(p => `🐍 ${p.name}@${p.version}\n   ${p.description}`).join('\n\n') : 'Not found';
  },

  fetch_github_readme: async ({ owner, repo }) => browser.fetchGitHubReadme(owner, repo),

  fetch_docs: async ({ url }) => {
    const page = await browser.fetchDocs(url);
    return `${page.title}\n\n${page.content?.slice(0, 8000)}`;
  },

  fetch_api: async ({ url, method, body, headers }) => {
    try {
      const r = await axios({ method: method || 'GET', url, data: body ? JSON.parse(body) : undefined, headers: { 'Content-Type': 'application/json', 'User-Agent': 'AIDevAgent/1.0', ...(headers ? JSON.parse(headers) : {}) }, timeout: 20000 });
      return JSON.stringify(r.data, null, 2).slice(0, 8000);
    } catch (e) { return `Error ${e.response?.status}: ${e.message}\n${JSON.stringify(e.response?.data || {})}`; }
  },

  // ── 6. GITHUB - ISSUES ──────────────────────────────
  github_get_issue: async ({ owner, repo, issue_number }, ctx) => {
    const o = owner || ctx?.owner, r = repo || ctx?.repo;
    const d = await gh.getIssue(o, r, issue_number);
    return JSON.stringify({ number: d.number, title: d.title, state: d.state, body: d.body, labels: d.labels?.map(l => l.name), assignees: d.assignees?.map(a => a.login), url: d.html_url, comments: d.comments.slice(0, 8).map(c => ({ user: c.user.login, body: c.body })) }, null, 2);
  },

  github_list_issues: async ({ owner, repo, state, labels }, ctx) => {
    const issues = await gh.listIssues(owner || ctx?.owner, repo || ctx?.repo, state || 'open', labels || '');
    return issues.map(i => `#${i.number} [${i.state}] ${i.title}\n  Labels: ${i.labels.map(l => l.name).join(', ') || 'none'} | Assignees: ${i.assignees.map(a => a.login).join(', ') || 'none'}`).join('\n');
  },

  github_create_issue: async ({ owner, repo, title, body, labels, assignees }, ctx) => {
    const d = await gh.createIssue(owner || ctx?.owner, repo || ctx?.repo, title, body, labels || [], assignees || []);
    return `✅ Issue #${d.number}: ${d.html_url}`;
  },

  github_update_issue: async ({ owner, repo, issue_number, title, body, state, labels }, ctx) => {
    const u = {}; if (title) u.title = title; if (body) u.body = body; if (state) u.state = state; if (labels) u.labels = labels;
    const d = await gh.updateIssue(owner || ctx?.owner, repo || ctx?.repo, issue_number, u);
    return `✅ Issue #${d.number} updated`;
  },

  github_close_issue: async ({ owner, repo, issue_number, comment }, ctx) => {
    await gh.closeIssue(owner || ctx?.owner, repo || ctx?.repo, issue_number, comment);
    return `✅ Issue #${issue_number} closed`;
  },

  github_comment: async ({ owner, repo, issue_number, body }, ctx) => {
    const d = await gh.commentIssue(owner || ctx?.owner, repo || ctx?.repo, issue_number, body);
    return `✅ Comment posted: ${d.html_url}`;
  },

  github_add_labels: async ({ owner, repo, issue_number, labels }, ctx) => {
    await gh.addLabels(owner || ctx?.owner, repo || ctx?.repo, issue_number, labels);
    return `✅ Labels: ${labels.join(', ')}`;
  },

  // ── 7. GITHUB - FILES ───────────────────────────────
  github_get_file: async ({ owner, repo, path: p, ref }, ctx) => {
    const { content, sha } = await gh.getFile(owner || ctx?.owner, repo || ctx?.repo, p, ref);
    return `SHA: ${sha}\n\n${content.slice(0, 10000)}`;
  },

  github_put_file: async ({ owner, repo, path: p, content, message, sha }, ctx) => {
    const d = await gh.putFile(owner || ctx?.owner, repo || ctx?.repo, p, content, message || 'AI Agent: update', sha);
    return `✅ File updated: ${p}`;
  },

  github_list_files: async ({ owner, repo, path: p, ref }, ctx) => {
    const items = await gh.listContents(owner || ctx?.owner, repo || ctx?.repo, p || '', ref);
    return items.map(i => `${i.type === 'dir' ? '📁' : '📄'} ${i.path} ${i.size ? `(${i.size}b)` : ''}`).join('\n');
  },

  // ── 8. GITHUB - BRANCHES & PRs ───────────────────────
  github_list_branches: async ({ owner, repo }, ctx) => {
    const b = await gh.listBranches(owner || ctx?.owner, repo || ctx?.repo);
    return b.map(b => `${b.name}${b.protected ? ' 🔒' : ''}`).join('\n');
  },

  github_create_branch: async ({ owner, repo, branch, from_branch }, ctx) => {
    await gh.createBranch(owner || ctx?.owner, repo || ctx?.repo, branch, from_branch || 'main');
    return `✅ Branch created: ${branch}`;
  },

  github_delete_branch: async ({ owner, repo, branch }, ctx) => {
    await gh.deleteBranch(owner || ctx?.owner, repo || ctx?.repo, branch);
    return `✅ Branch deleted: ${branch}`;
  },

  github_list_prs: async ({ owner, repo, state }, ctx) => {
    const prs = await gh.listPRs(owner || ctx?.owner, repo || ctx?.repo, state || 'open');
    return prs.map(p => `#${p.number} [${p.state}] ${p.title}\n  ${p.head?.ref} → ${p.base?.ref}`).join('\n');
  },

  github_create_pr: async ({ owner, repo, title, body, head, base }, ctx) => {
    const d = await gh.createPR(owner || ctx?.owner, repo || ctx?.repo, title, body, head, base || 'main');
    return `✅ PR #${d.number}: ${d.html_url}`;
  },

  github_merge_pr: async ({ owner, repo, pr_number, method }, ctx) => {
    const d = await gh.mergePR(owner || ctx?.owner, repo || ctx?.repo, pr_number, method || 'squash');
    return `✅ PR merged`;
  },

  github_review_pr: async ({ owner, repo, pr_number, body, event }, ctx) => {
    await gh.reviewPR(owner || ctx?.owner, repo || ctx?.repo, pr_number, body, event || 'COMMENT');
    return `✅ Review posted`;
  },

  // ── 9. GITHUB - REPO OPS ────────────────────────────
  github_get_repo: async ({ owner, repo }, ctx) => {
    const d = await gh.getRepo(owner || ctx?.owner, repo || ctx?.repo);
    return `${d.full_name}\n⭐${d.stargazers_count} 🍴${d.forks_count} 🔍${d.open_issues_count} issues\nLang: ${d.language} | License: ${d.license?.name}\n${d.description || ''}\n${d.html_url}`;
  },

  github_create_repo: async ({ name, description, private: priv }) => {
    const d = await gh.createRepo(name, description, priv || false);
    return `✅ Repo: ${d.html_url}`;
  },

  github_fork_repo: async ({ owner, repo }) => {
    const d = await gh.forkRepo(owner, repo);
    return `✅ Forked: ${d.html_url}`;
  },

  github_search_code: async ({ query, owner, repo }, ctx) => {
    const items = await gh.searchCode(query, owner || ctx?.owner, repo || ctx?.repo);
    return items.map(i => `📄 ${i.repository.full_name}/${i.path}`).join('\n') || 'No results';
  },

  github_search_repos: async ({ query }) => {
    const items = await gh.searchRepos(query);
    return items.map(r => `⭐${r.stargazers_count} ${r.full_name} - ${r.description || ''}`).join('\n');
  },

  github_list_commits: async ({ owner, repo, n }, ctx) => {
    const commits = await gh.listCommits(owner || ctx?.owner, repo || ctx?.repo, n || 10);
    return commits.map(c => `${c.sha.slice(0, 7)} ${c.commit.message.split('\n')[0]} (${c.commit.author.name})`).join('\n');
  },

  github_create_release: async ({ owner, repo, tag, name, body }, ctx) => {
    const d = await gh.createRelease(owner || ctx?.owner, repo || ctx?.repo, tag, name, body);
    return `✅ Release: ${d.html_url}`;
  },

  github_list_workflows: async ({ owner, repo }, ctx) => {
    const wf = await gh.listWorkflows(owner || ctx?.owner, repo || ctx?.repo);
    return wf.map(w => `${w.id}: ${w.name} [${w.state}]`).join('\n');
  },

  github_workflow_runs: async ({ owner, repo }, ctx) => {
    const runs = await gh.listRuns(owner || ctx?.owner, repo || ctx?.repo);
    return runs.map(r => `${r.name} [${r.status}/${r.conclusion || 'pending'}] ${r.created_at}`).join('\n');
  },

  // ── 10. GIT LOCAL ───────────────────────────────────
  git_clone: async ({ owner, repo, dir }, ctx) => {
    const o = owner || ctx?.owner, r = repo || ctx?.repo;
    const target = dir ? abs(dir) : path.join(WORKSPACE, `${o}_${r}`);
    await gh.cloneRepo(o, r, target);
    return `✅ Cloned ${o}/${r} to ${target}`;
  },

  git_op: async ({ repo_dir, operation, args }) => {
    const dir = abs(repo_dir);
    let parsedArgs = {};
    if (args) { try { parsedArgs = typeof args === 'string' ? JSON.parse(args) : args; } catch {} }
    const r = await gh.gitOps(dir, operation, parsedArgs);
    return JSON.stringify(r, null, 2).slice(0, 4000);
  },

  // ── 11. VSCODE ──────────────────────────────────────
  vscode_open: async ({ path: p, line }) => {
    if (line) return vscode.openAtLine(p || WORKSPACE, line);
    return vscode.open(p || WORKSPACE);
  },

  vscode_open_folder: async ({ path: p }) => vscode.open(abs(p || WORKSPACE), { newWindow: false }),

  vscode_install_extension: async ({ extension_id }) => vscode.installExtension(extension_id),

  vscode_list_extensions: async () => {
    const exts = await vscode.listExtensions();
    return exts.length ? exts.join('\n') : 'No extensions found (VSCode may not be available in this environment)';
  },

  vscode_create_workspace: async ({ name, folders }) => {
    const ws = await vscode.createWorkspace(name || 'agent-workspace', folders);
    return `✅ Workspace: ${ws}`;
  },

  vscode_setup_project: async ({ path: p, type }) => {
    const results = await vscode.setupProject(abs(p || WORKSPACE), type || 'node');
    return results.join('\n');
  },

  vscode_create_launch: async ({ path: p, configs }) => {
    await vscode.createLaunchConfig(abs(p || WORKSPACE), configs);
    return `✅ .vscode/launch.json created`;
  },

  vscode_create_tasks: async ({ path: p, tasks }) => {
    await vscode.createTasks(abs(p || WORKSPACE), tasks);
    return `✅ .vscode/tasks.json created`;
  },

  vscode_create_settings: async ({ path: p, settings }) => {
    await vscode.createSettings(abs(p || WORKSPACE), settings || {});
    return `✅ .vscode/settings.json created`;
  },

  vscode_diff: async ({ file1, file2 }) => vscode.showDiff(abs(file1), abs(file2)),

  // ── 12. CODE GENERATION ─────────────────────────────
  create_project: async ({ name, type, description }) => {
    const projDir = path.join(WORKSPACE, name);
    await fs.mkdir(projDir, { recursive: true });
    const results = [];

    if (type === 'node' || type === 'express') {
      await fs.writeFile(path.join(projDir, 'package.json'), JSON.stringify({ name, version: '1.0.0', description: description || '', scripts: { start: 'node index.js', dev: 'nodemon index.js', test: 'jest' }, dependencies: {} }, null, 2));
      await fs.writeFile(path.join(projDir, 'index.js'), `// ${name}\nconst express = require('express');\nconst app = express();\napp.use(express.json());\n\napp.get('/', (req, res) => res.json({ message: 'Hello from ${name}!' }));\n\nconst PORT = process.env.PORT || 3000;\napp.listen(PORT, () => console.log(\`${name} running on port \${PORT}\`));\n`);
      await fs.writeFile(path.join(projDir, '.env'), 'PORT=3000\nNODE_ENV=development\n');
      results.push('Created Node.js/Express project');
    } else if (type === 'python') {
      await fs.writeFile(path.join(projDir, 'main.py'), `"""${description || name}"""\n\ndef main():\n    print("Hello from ${name}!")\n\nif __name__ == "__main__":\n    main()\n`);
      await fs.writeFile(path.join(projDir, 'requirements.txt'), '# Add your dependencies here\n');
      results.push('Created Python project');
    } else if (type === 'react') {
      results.push(await sh(`npm create vite@latest "${projDir}" -- --template react --yes 2>&1 | tail -5`, WORKSPACE));
    }

    await fs.writeFile(path.join(projDir, '.gitignore'), 'node_modules/\n.env\n*.log\ndist/\n__pycache__/\n.venv/\n');
    await fs.writeFile(path.join(projDir, 'README.md'), `# ${name}\n\n${description || ''}\n\n## Setup\n\n\`\`\`bash\n# Install dependencies\nnpm install\n# Run\nnpm start\n\`\`\`\n`);

    const setup = await vscode.setupProject(projDir, type);
    results.push(...setup);

    return `✅ Project created at ${projDir}\n${results.join('\n')}`;
  },

  run_tests: async ({ dir, command }) => {
    const cwd = abs(dir || WORKSPACE);
    const cmd = command || 'npm test 2>&1 || python -m pytest -v 2>&1 || echo "No test runner found"';
    return sh(cmd, cwd, 60000);
  },

  // ── 13. PACKAGES ────────────────────────────────────
  npm_install: async ({ dir, packages, save_dev }) => {
    const cwd = abs(dir || WORKSPACE);
    const flag = save_dev ? '--save-dev' : '';
    const cmd = packages?.length ? `npm install ${packages.join(' ')} ${flag} --ignore-scripts` : 'npm install --ignore-scripts';
    return sh(cmd, cwd, 120000);
  },

  pip_install: async ({ packages, dir }) => {
    const cwd = abs(dir || WORKSPACE);
    return sh(`pip install ${packages.join(' ')} --break-system-packages -q 2>&1`, cwd, 120000);
  },
};

// ═══════════════════════════════════════════════════════════
// TOOL DEFINITIONS (OpenAI function calling format)
// ═══════════════════════════════════════════════════════════
function getToolDefs() {
  const P = (props, req = []) => ({ type: 'object', properties: props, required: req });
  const S = (d) => ({ type: 'string', description: d });
  const N = (d) => ({ type: 'number', description: d });
  const B = (d) => ({ type: 'boolean', description: d });
  const A = (d) => ({ type: 'array', items: { type: 'string' }, description: d });
  const fn = (name, desc, params) => ({ type: 'function', function: { name, description: desc, parameters: params } });

  return [
    // THINKING
    fn('think', '🧠 Reason step-by-step before acting. ALWAYS use this before complex decisions.', P({ reasoning: S('Your detailed step-by-step reasoning'), approach: S('The approach you decided on') }, ['reasoning'])),
    fn('deep_think', '🧠 Deep AI-powered analysis of a complex problem', P({ problem: S('The problem to analyze deeply'), context: S('Additional context') }, ['problem'])),
    fn('make_plan', '📋 Create a structured multi-phase plan for achieving a goal', P({ goal: S('The goal to achieve'), context: S('Additional context or constraints') }, ['goal'])),
    fn('decide', '⚖️ AI-powered decision making between options', P({ options: A('List of options to choose from'), criteria: S('Decision criteria and constraints') }, ['options', 'criteria'])),
    fn('analyze_code', '🔍 Deep AI analysis of code for bugs, security, performance', P({ code: S('Code to analyze'), language: S('Programming language'), task: S('What to look for') }, ['code'])),

    // MEMORY
    fn('remember', '💾 Store information in persistent memory for later use', P({ key: S('Memory key'), value: S('Value to store'), category: S('Category: general/code/research/tasks') }, ['key', 'value'])),
    fn('recall', '🔍 Retrieve stored memory', P({ key: S('Key to retrieve (* for all)'), category: S('Category (* for all)') })),
    fn('search_memory', '🔎 Search through all memories', P({ query: S('Search query') }, ['query'])),

    // SHELL
    fn('bash', '⚡ Execute shell/bash commands. Use for everything: install packages, run scripts, git, build, test, any CLI.', P({ command: S('Command to run'), cwd: S('Working directory (relative to workspace or absolute path)'), timeout_ms: N('Timeout in ms (default 45000)') }, ['command'])),
    fn('bash_interactive', '⚡ Run multiple bash commands in sequence', P({ commands: A('Array of commands to run in order'), cwd: S('Working directory') }, ['commands'])),

    // FILES
    fn('read_file', '📖 Read file content', P({ path: S('File path'), start_line: N('Start line number'), end_line: N('End line number') }, ['path'])),
    fn('write_file', '✏️ Create or overwrite a file', P({ path: S('File path'), content: S('Complete file content'), append: B('Append to file instead of overwrite') }, ['path', 'content'])),
    fn('patch_file', '🔧 Replace specific text in a file (for small edits)', P({ path: S('File path'), old_text: S('Exact text to replace'), new_text: S('Replacement text') }, ['path', 'old_text', 'new_text'])),
    fn('list_files', '📁 List files in a directory', P({ path: S('Directory path'), recursive: B('List recursively'), pattern: S('File pattern like *.js') })),
    fn('delete_file', '🗑️ Delete a file', P({ path: S('File path') }, ['path'])),
    fn('move_file', '📦 Move or rename a file', P({ from: S('Source path'), to: S('Destination path') }, ['from', 'to'])),
    fn('copy_file', '📋 Copy a file', P({ from: S('Source'), to: S('Destination') }, ['from', 'to'])),
    fn('search_in_files', '🔎 Search text across files (like grep)', P({ pattern: S('Search pattern (regex ok)'), path: S('Directory to search'), file_ext: S('File extension to search (e.g. js, py, ts)') }, ['pattern'])),

    // WEB
    fn('github_whoami', '🐙 Get authenticated GitHub account info', P({})),
    fn('github_list_my_repos', '🐙 List all repos in your own GitHub account', P({ type: S('all/owner/member') })),
    fn('github_delete_repo', '🐙 Permanently delete a repository', P({ owner: S('Owner'), repo: S('Repo') }, ['owner','repo'])),
    fn('github_update_repo', '🐙 Update repo settings (description, homepage, visibility, features)', P({ owner: S('Owner'), repo: S('Repo'), description: S('New description'), homepage: S('Homepage URL'), private: B('Private'), has_issues: B('Enable issues'), has_wiki: B('Enable wiki') })),
    fn('github_add_collaborator', '🐙 Add a collaborator to a repo', P({ owner: S('Owner'), repo: S('Repo'), username: S('GitHub username'), permission: S('pull/push/admin') }, ['username'])),
    fn('github_archive_repo', '🐙 Archive or unarchive a repo', P({ owner: S('Owner'), repo: S('Repo'), archived: B('true=archive, false=unarchive') })),
    fn('github_set_topics', '🐙 Set repo topics/tags for discoverability', P({ owner: S('Owner'), repo: S('Repo'), topics: A('Topic list') }, ['topics'])),
    fn('create_folder', '📁 Create a folder/directory', P({ path: S('Folder path') }, ['path'])),
    fn('open_url', '🌐 Open a URL in the default browser on this machine', P({ url: S('URL to open') }, ['url'])),
    fn('open_app', '🖥️ Launch an application/command on this machine', P({ command: S('Shell command to launch the app') }, ['command'])),
    fn('browser_automate', '🌐 Automate a real browser: navigate, click, type, screenshot (requires puppeteer + display; falls back gracefully)', P({ url: S('URL to visit'), actions: A('Array of action objects: {type:click/type/wait/screenshot, selector, text, ms}') }, ['url'])),
    fn('ask_web_llm', '🌐 Ask Claude.ai, ChatGPT, or Gemini directly through a logged-in browser session (for cross-checking or a second opinion)', P({ provider: S('claude, chatgpt, or gemini'), prompt: S('The question/prompt to send') }, ['provider','prompt'])),
    fn('webllm_login', '🌐 Open a visible browser window to log in to claude.ai/chatgpt.com/gemini once (session then persists)', P({ provider: S('claude, chatgpt, or gemini') }, ['provider'])),
    fn('build_project', '🚀 Design and ship a COMPLETE new open-source project (architecture, all files, README, tests, CI, LICENSE) to a brand new GitHub repo in one call', P({ idea: S('Description of the project to build'), private: B('Make repo private') }, ['idea'])),
    fn('analyze_image', '🖼️ Analyze/describe an image from a URL using vision AI', P({ image_url: S('Public image URL'), question: S('What to ask about the image') }, ['image_url'])),
    fn('web_search', '🌐 Search the web for information, docs, solutions', P({ query: S('Search query - be specific for better results'), num_results: N('Number of results (default 8)') }, ['query'])),
    fn('fetch_url', '🌐 Fetch and read any URL - websites, docs, APIs, GitHub raw files', P({ url: S('Full URL to fetch') }, ['url'])),
    fn('deep_research', '🔬 Deep multi-source research on a topic - searches + reads multiple pages and synthesizes findings', P({ topic: S('Topic to research thoroughly'), depth: N('Research depth 1-3 (default 2)') }, ['topic'])),
    fn('read_website', '🌐 Get a structured snapshot of any website', P({ url: S('URL to analyze'), extract: S('What specifically to extract') }, ['url'])),
    fn('search_npm', '📦 Search NPM for packages', P({ query: S('Package name or description') }, ['query'])),
    fn('search_pypi', '🐍 Search PyPI for Python packages', P({ query: S('Package name') }, ['query'])),
    fn('fetch_github_readme', '📖 Fetch README from any GitHub repo', P({ owner: S('Owner'), repo: S('Repo name') }, ['owner', 'repo'])),
    fn('fetch_docs', '📚 Fetch and read documentation from a URL', P({ url: S('Documentation URL') }, ['url'])),
    fn('fetch_api', '🔌 Make HTTP API calls', P({ url: S('API URL'), method: S('GET/POST/PUT/DELETE'), body: S('Request body as JSON string'), headers: S('Headers as JSON string') }, ['url'])),

    // GITHUB ISSUES
    fn('github_get_issue', '🐙 Get GitHub issue with full details and comments', P({ owner: S('Repo owner'), repo: S('Repo name'), issue_number: N('Issue number') }, ['issue_number'])),
    fn('github_list_issues', '🐙 List GitHub issues', P({ owner: S('Owner'), repo: S('Repo'), state: S('open/closed/all'), labels: S('Filter labels') })),
    fn('github_create_issue', '🐙 Create a new GitHub issue', P({ owner: S('Owner'), repo: S('Repo'), title: S('Title'), body: S('Body markdown'), labels: A('Labels'), assignees: A('Assignees') }, ['title', 'body'])),
    fn('github_update_issue', '🐙 Update issue title/body/state/labels', P({ owner: S('Owner'), repo: S('Repo'), issue_number: N('Issue #'), title: S('New title'), body: S('New body'), state: S('open/closed'), labels: A('Labels') }, ['issue_number'])),
    fn('github_close_issue', '🐙 Close a GitHub issue', P({ owner: S('Owner'), repo: S('Repo'), issue_number: N('Issue #'), comment: S('Closing comment') }, ['issue_number'])),
    fn('github_comment', '🐙 Post comment on issue or PR', P({ owner: S('Owner'), repo: S('Repo'), issue_number: N('Issue/PR #'), body: S('Comment body markdown') }, ['issue_number', 'body'])),
    fn('github_add_labels', '🐙 Add labels to issue', P({ owner: S('Owner'), repo: S('Repo'), issue_number: N('Issue #'), labels: A('Labels to add') }, ['issue_number', 'labels'])),

    // GITHUB FILES
    fn('github_get_file', '🐙 Read file from GitHub repo', P({ owner: S('Owner'), repo: S('Repo'), path: S('File path in repo'), ref: S('Branch or commit') }, ['path'])),
    fn('github_put_file', '🐙 Create or update file in GitHub repo', P({ owner: S('Owner'), repo: S('Repo'), path: S('File path'), content: S('New content'), message: S('Commit message'), sha: S('Current SHA (required for updates, get from github_get_file)') }, ['path', 'content', 'message'])),
    fn('github_list_files', '🐙 List files in GitHub repo directory', P({ owner: S('Owner'), repo: S('Repo'), path: S('Directory path'), ref: S('Branch') })),

    // GITHUB BRANCHES & PRs
    fn('github_list_branches', '🐙 List repo branches', P({ owner: S('Owner'), repo: S('Repo') })),
    fn('github_create_branch', '🐙 Create new branch', P({ owner: S('Owner'), repo: S('Repo'), branch: S('New branch name'), from_branch: S('Base branch (default: main)') }, ['branch'])),
    fn('github_delete_branch', '🐙 Delete a branch', P({ owner: S('Owner'), repo: S('Repo'), branch: S('Branch name') }, ['branch'])),
    fn('github_list_prs', '🐙 List pull requests', P({ owner: S('Owner'), repo: S('Repo'), state: S('open/closed/all') })),
    fn('github_create_pr', '🐙 Create pull request', P({ owner: S('Owner'), repo: S('Repo'), title: S('PR title'), body: S('PR description'), head: S('Source branch'), base: S('Target branch (default: main)') }, ['title', 'body', 'head'])),
    fn('github_merge_pr', '🐙 Merge a pull request', P({ owner: S('Owner'), repo: S('Repo'), pr_number: N('PR number'), method: S('merge/squash/rebase') }, ['pr_number'])),
    fn('github_review_pr', '🐙 Submit PR review', P({ owner: S('Owner'), repo: S('Repo'), pr_number: N('PR #'), body: S('Review body'), event: S('COMMENT/APPROVE/REQUEST_CHANGES') }, ['pr_number', 'body'])),

    // GITHUB REPO
    fn('github_get_repo', '🐙 Get repo info and stats', P({ owner: S('Owner'), repo: S('Repo') })),
    fn('github_create_repo', '🐙 Create new GitHub repo', P({ name: S('Repo name'), description: S('Description'), private: B('Is private') }, ['name'])),
    fn('github_fork_repo', '🐙 Fork a repository', P({ owner: S('Owner'), repo: S('Repo') }, ['owner', 'repo'])),
    fn('github_search_code', '🐙 Search code on GitHub', P({ query: S('Search query'), owner: S('Limit to owner'), repo: S('Limit to repo') }, ['query'])),
    fn('github_search_repos', '🐙 Search GitHub repositories', P({ query: S('Search query') }, ['query'])),
    fn('github_list_commits', '🐙 List recent commits', P({ owner: S('Owner'), repo: S('Repo'), n: N('Count (default 10)') })),
    fn('github_create_release', '🐙 Create a GitHub release', P({ owner: S('Owner'), repo: S('Repo'), tag: S('Tag name like v1.0.0'), name: S('Release name'), body: S('Release notes') }, ['tag', 'name'])),
    fn('github_list_workflows', '🐙 List GitHub Actions workflows', P({ owner: S('Owner'), repo: S('Repo') })),
    fn('github_workflow_runs', '🐙 Get recent workflow runs', P({ owner: S('Owner'), repo: S('Repo') })),

    // GIT LOCAL
    fn('git_clone', '📥 Clone a GitHub repo locally to the workspace', P({ owner: S('Owner'), repo: S('Repo'), dir: S('Target directory (optional)') }, ['owner', 'repo'])),
    fn('git_op', '🔀 Git operations on local repo: status/add/commit/push/pull/checkout/checkoutNew/log/diff/stash', P({ repo_dir: S('Local repo directory path'), operation: S('Operation: status/add/commit/push/pull/checkout/checkoutNew/log/diff/stash'), args: S('JSON string with args like {"message":"...", "branch":"...", "files":"..."}') }, ['repo_dir', 'operation'])),

    // VSCODE
    fn('vscode_open', '💻 Open file or path in VS Code', P({ path: S('Path to open (file or directory)'), line: N('Line number to jump to') })),
    fn('vscode_open_folder', '💻 Open a folder as VS Code workspace', P({ path: S('Folder path') })),
    fn('vscode_install_extension', '💻 Install a VS Code extension', P({ extension_id: S('Extension ID like esbenp.prettier-vscode') }, ['extension_id'])),
    fn('vscode_list_extensions','github_whoami','github_list_my_repos', '💻 List installed VS Code extensions', P({})),
    fn('vscode_create_workspace', '💻 Create a .code-workspace file', P({ name: S('Workspace name'), folders: A('Array of folder paths') }, ['name'])),
    fn('vscode_setup_project', '💻 Full VS Code project setup: settings, launch, tasks, snippets, workspace', P({ path: S('Project directory'), type: S('Project type: node/python/react/express') })),
    fn('vscode_create_launch', '💻 Create .vscode/launch.json for debugging', P({ path: S('Project directory'), configs: S('Custom launch configs as JSON string') })),
    fn('vscode_create_tasks', '💻 Create .vscode/tasks.json', P({ path: S('Project directory') })),
    fn('vscode_create_settings', '💻 Create .vscode/settings.json', P({ path: S('Project directory'), settings: S('Settings as JSON string') })),
    fn('vscode_diff', '💻 Show diff between two files in VS Code', P({ file1: S('First file'), file2: S('Second file') }, ['file1', 'file2'])),

    // CODE & PROJECT
    fn('create_project', '🏗️ Create a complete new project from scratch with structure, VSCode setup, gitignore, README', P({ name: S('Project name'), type: S('Type: node/express/react/python/fastapi'), description: S('Project description') }, ['name', 'type'])),
    fn('run_tests', '🧪 Run tests in a project', P({ dir: S('Project directory'), command: S('Test command (auto-detected if not provided)') })),
    fn('npm_install', '📦 Install NPM packages', P({ dir: S('Project directory'), packages: A('Package names (empty = npm install)'), save_dev: B('Save as devDependency') })),
    fn('pip_install', '🐍 Install Python packages', P({ packages: A('Package names'), dir: S('Working directory') }, ['packages'])),
  ];
}

async function execute(name, args, ctx) {
  if (!T[name]) throw new Error(`Unknown tool: ${name}`);
  return await T[name](args, ctx);
}

module.exports = { execute, getToolDefs, WORKSPACE, READ_ONLY_TOOLS };
