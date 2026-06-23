const { Octokit } = require('@octokit/rest');
const { get } = require('../db');

function getOctokit() {
  const token = process.env.GITHUB_TOKEN || get('github_token');
  return new Octokit({ auth: token });
}

async function getIssue(owner, repo, issue_number) {
  const ok = getOctokit();
  const { data } = await ok.issues.get({ owner, repo, issue_number });
  const comments = await ok.issues.listComments({ owner, repo, issue_number });
  return { ...data, comments: comments.data };
}

async function listIssues(owner, repo, state = 'open') {
  const ok = getOctokit();
  const { data } = await ok.issues.listForRepo({ owner, repo, state, per_page: 30 });
  return data;
}

async function createIssueComment(owner, repo, issue_number, body) {
  const ok = getOctokit();
  const { data } = await ok.issues.createComment({ owner, repo, issue_number, body });
  return data;
}

async function closeIssue(owner, repo, issue_number, comment) {
  const ok = getOctokit();
  if (comment) await ok.issues.createComment({ owner, repo, issue_number, body: comment });
  return ok.issues.update({ owner, repo, issue_number, state: 'closed' });
}

async function createPR(owner, repo, title, body, head, base = 'main') {
  const ok = getOctokit();
  const { data } = await ok.pulls.create({ owner, repo, title, body, head, base });
  return data;
}

async function getRepoContents(owner, repo, path = '') {
  const ok = getOctokit();
  const { data } = await ok.repos.getContent({ owner, repo, path });
  return data;
}

async function getFileContent(owner, repo, path) {
  const ok = getOctokit();
  const { data } = await ok.repos.getContent({ owner, repo, path });
  if (data.encoding === 'base64') {
    return Buffer.from(data.content, 'base64').toString('utf8');
  }
  return data.content;
}

async function updateFile(owner, repo, path, content, message, sha) {
  const ok = getOctokit();
  const { data } = await ok.repos.createOrUpdateFileContents({
    owner, repo, path,
    message,
    content: Buffer.from(content).toString('base64'),
    sha
  });
  return data;
}

async function searchCode(query, owner, repo) {
  const ok = getOctokit();
  const q = repo ? `${query} repo:${owner}/${repo}` : `${query} user:${owner}`;
  const { data } = await ok.search.code({ q });
  return data.items;
}

async function getUserRepos(username) {
  const ok = getOctokit();
  const { data } = await ok.repos.listForUser({ username, per_page: 50, sort: 'updated' });
  return data;
}

module.exports = {
  getIssue, listIssues, createIssueComment, closeIssue,
  createPR, getRepoContents, getFileContent, updateFile,
  searchCode, getUserRepos, getOctokit
};
