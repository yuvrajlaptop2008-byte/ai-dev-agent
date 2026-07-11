---
name: github
description: Full GitHub API workflow — clone/fork repos, PRs, issues, comments, labels, milestones, releases, Actions, repo management.
keywords: github, issue, pull request, PR, repo, release, label, milestone, fork, actions
tools: github_get_issue, github_list_issues, github_create_issue, github_update_issue, github_close_issue, github_comment, github_add_labels, github_get_file, github_put_file, github_list_files, github_list_branches, github_create_branch, github_delete_branch, github_list_prs, github_create_pr, github_merge_pr, github_review_pr, github_get_repo, github_create_repo, github_fork_repo, github_search_code, github_search_repos, github_list_commits, github_create_release, github_list_workflows, github_workflow_runs, github_whoami, github_list_my_repos, github_delete_repo, github_update_repo, github_add_collaborator, github_archive_repo, github_set_topics
---

# GitHub Skill

Complete GitHub workflow coverage via the real GitHub API (Octokit) — the same actions a human
does through github.com or the `gh` CLI, callable directly.

## Features
- Clone / fork repositories
- Create, comment on, close, and label issues
- Create, review, and merge Pull Requests
- Read and write repository files
- Manage branches, releases, milestones-adjacent labels
- Trigger and inspect GitHub Actions
- Full repo management: create, delete, archive, transfer, topics, collaborators
- Search code and repos across GitHub

## If a raw `gh` CLI is available in the environment
Prefer it for anything not covered above via `bash`/`git_terminal` — e.g. `gh pr checks`,
`gh issue view --comments`, `gh release list`. Fall back to it freely; don't avoid the shell.

## When to use
Anything that doesn't require a local clone: reading/writing single files, managing issues/PRs,
repo settings, releases. For multi-file changes or real git history, pair with the `git` skill
(clone → edit → commit → push) — or better, activate `github-pr-workflow` which bundles both.
