const { Octokit } = require('@octokit/rest');
const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const getKey = () => process.env.GITHUB_TOKEN;
let _octo;
const getOctokit = () => {
  if (_octo) return _octo;
  _octo = new Octokit({ auth: getKey(), retry: { enabled: true, retries: 3 }, throttle: { onRateLimit: () => true, onSecondaryRateLimit: () => true } });
  return _octo;
};

// ─── ISSUES ────────────────────────────────────────────────
async function getIssue(owner, repo, n) {
  const ok = getOctokit();
  const { data } = await ok.issues.get({ owner, repo, issue_number: +n });
  const comments = await ok.issues.listComments({ owner, repo, issue_number: +n, per_page: 20 });
  return { ...data, comments: comments.data };
}
async function listIssues(owner, repo, state = 'open', labels = '') {
  const { data } = await getOctokit().issues.listForRepo({ owner, repo, state, labels, per_page: 50 });
  return data;
}
async function createIssue(owner, repo, title, body, labels = [], assignees = []) {
  const { data } = await getOctokit().issues.create({ owner, repo, title, body, labels, assignees });
  return data;
}
async function updateIssue(owner, repo, n, updates) {
  const { data } = await getOctokit().issues.update({ owner, repo, issue_number: +n, ...updates });
  return data;
}
async function closeIssue(owner, repo, n, comment) {
  const ok = getOctokit();
  if (comment) await ok.issues.createComment({ owner, repo, issue_number: +n, body: comment });
  return ok.issues.update({ owner, repo, issue_number: +n, state: 'closed' });
}
async function commentIssue(owner, repo, n, body) {
  const { data } = await getOctokit().issues.createComment({ owner, repo, issue_number: +n, body });
  return data;
}
async function addLabels(owner, repo, n, labels) {
  return getOctokit().issues.addLabels({ owner, repo, issue_number: +n, labels });
}
async function assignIssue(owner, repo, n, assignees) {
  return getOctokit().issues.addAssignees({ owner, repo, issue_number: +n, assignees });
}

// ─── PULL REQUESTS ─────────────────────────────────────────
async function listPRs(owner, repo, state = 'open') {
  const { data } = await getOctokit().pulls.list({ owner, repo, state, per_page: 30 });
  return data;
}
async function createPR(owner, repo, title, body, head, base = 'main') {
  const { data } = await getOctokit().pulls.create({ owner, repo, title, body, head, base });
  return data;
}
async function mergePR(owner, repo, n, method = 'squash') {
  const { data } = await getOctokit().pulls.merge({ owner, repo, pull_number: +n, merge_method: method });
  return data;
}
async function getPRDiff(owner, repo, n) {
  const { data } = await getOctokit().pulls.get({ owner, repo, pull_number: +n, mediaType: { format: 'diff' } });
  return data;
}
async function reviewPR(owner, repo, n, body, event = 'COMMENT') {
  const { data } = await getOctokit().pulls.createReview({ owner, repo, pull_number: +n, body, event });
  return data;
}

// ─── FILES & REPO CONTENT ──────────────────────────────────
async function getFile(owner, repo, filePath, ref) {
  const params = { owner, repo, path: filePath };
  if (ref) params.ref = ref;
  const { data } = await getOctokit().repos.getContent(params);
  if (data.encoding === 'base64') return { content: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha };
  return { content: data.content, sha: data.sha };
}
async function putFile(owner, repo, filePath, content, message, sha) {
  const params = { owner, repo, path: filePath, message, content: Buffer.from(content).toString('base64') };
  if (sha) params.sha = sha;
  const { data } = await getOctokit().repos.createOrUpdateFileContents(params);
  return data;
}
async function deleteFile(owner, repo, filePath, message, sha) {
  return getOctokit().repos.deleteFile({ owner, repo, path: filePath, message, sha });
}
async function listContents(owner, repo, p = '', ref) {
  const params = { owner, repo, path: p };
  if (ref) params.ref = ref;
  const { data } = await getOctokit().repos.getContent(params);
  return Array.isArray(data) ? data : [data];
}

// ─── BRANCHES ──────────────────────────────────────────────
async function listBranches(owner, repo) {
  const { data } = await getOctokit().repos.listBranches({ owner, repo, per_page: 30 });
  return data;
}
async function createBranch(owner, repo, branchName, fromBranch = 'main') {
  const ok = getOctokit();
  const { data: ref } = await ok.git.getRef({ owner, repo, ref: `heads/${fromBranch}` });
  const { data } = await ok.git.createRef({ owner, repo, ref: `refs/heads/${branchName}`, sha: ref.object.sha });
  return data;
}
async function deleteBranch(owner, repo, branchName) {
  return getOctokit().git.deleteRef({ owner, repo, ref: `heads/${branchName}` });
}

// ─── REPO OPERATIONS ───────────────────────────────────────
async function getUserRepos(username) {
  const { data } = await getOctokit().repos.listForUser({ username, per_page: 100, sort: 'updated' });
  return data;
}
async function getRepo(owner, repo) {
  const { data } = await getOctokit().repos.get({ owner, repo });
  return data;
}
async function createRepo(name, description = '', isPrivate = false) {
  const { data } = await getOctokit().repos.createForAuthenticatedUser({ name, description, private: isPrivate, auto_init: true });
  return data;
}
async function forkRepo(owner, repo) {
  const { data } = await getOctokit().repos.createFork({ owner, repo });
  return data;
}
async function starRepo(owner, repo) {
  return getOctokit().activity.starRepoForAuthenticatedUser({ owner, repo });
}
async function searchCode(q, owner, repo) {
  const query = repo ? `${q} repo:${owner}/${repo}` : owner ? `${q} user:${owner}` : q;
  const { data } = await getOctokit().search.code({ q: query, per_page: 20 });
  return data.items;
}
async function searchRepos(q) {
  const { data } = await getOctokit().search.repos({ q, sort: 'stars', per_page: 10 });
  return data.items;
}

// ─── GIT CLONE & LOCAL OPS ────────────────────────────────
async function cloneRepo(owner, repo, targetDir) {
  const token = getKey();
  const url = `https://${token}@github.com/${owner}/${repo}.git`;
  await fs.mkdir(targetDir, { recursive: true });
  const git = simpleGit();
  await git.clone(url, targetDir);
  return targetDir;
}
async function gitOps(repoDir, operation, args = {}) {
  const git = simpleGit(repoDir);
  await git.addConfig('user.email', 'agent@ai-dev.local');
  await git.addConfig('user.name', 'AI Dev Agent');
  switch (operation) {
    case 'status': return git.status();
    case 'add': return git.add(args.files || '.');
    case 'commit': return git.commit(args.message || 'AI: automated commit');
    case 'push': return git.push(args.remote || 'origin', args.branch || 'main');
    case 'pull': return git.pull(args.remote || 'origin', args.branch || 'main');
    case 'checkout': return git.checkout(args.branch);
    case 'checkoutNew': return git.checkoutLocalBranch(args.branch);
    case 'log': return git.log({ maxCount: args.n || 10 });
    case 'diff': return git.diff(args.files ? [args.files] : []);
    case 'stash': return git.stash();
    default: throw new Error(`Unknown git op: ${operation}`);
  }
}

// ─── ACTIONS & CI ──────────────────────────────────────────
async function listWorkflows(owner, repo) {
  const { data } = await getOctokit().actions.listRepoWorkflows({ owner, repo });
  return data.workflows;
}
async function listRuns(owner, repo) {
  const { data } = await getOctokit().actions.listWorkflowRunsForRepo({ owner, repo, per_page: 10 });
  return data.workflow_runs;
}
async function triggerWorkflow(owner, repo, workflowId, ref = 'main', inputs = {}) {
  return getOctokit().actions.createWorkflowDispatch({ owner, repo, workflow_id: workflowId, ref, inputs });
}

// ─── RELEASES ──────────────────────────────────────────────
async function listReleases(owner, repo) {
  const { data } = await getOctokit().repos.listReleases({ owner, repo, per_page: 10 });
  return data;
}
async function createRelease(owner, repo, tag, name, body, draft = false) {
  const { data } = await getOctokit().repos.createRelease({ owner, repo, tag_name: tag, name, body, draft });
  return data;
}

// ─── COMMITS ───────────────────────────────────────────────
async function listCommits(owner, repo, n = 10) {
  const { data } = await getOctokit().repos.listCommits({ owner, repo, per_page: n });
  return data;
}
async function getCommit(owner, repo, sha) {
  const { data } = await getOctokit().repos.getCommit({ owner, repo, ref: sha });
  return data;
}

module.exports = {
  getIssue, listIssues, createIssue, updateIssue, closeIssue, commentIssue, addLabels, assignIssue,
  listPRs, createPR, mergePR, getPRDiff, reviewPR,
  getFile, putFile, deleteFile, listContents,
  listBranches, createBranch, deleteBranch,
  getUserRepos, getRepo, createRepo, forkRepo, starRepo, searchCode, searchRepos,
  cloneRepo, gitOps,
  listWorkflows, listRuns, triggerWorkflow,
  listReleases, createRelease,
  listCommits, getCommit
};
