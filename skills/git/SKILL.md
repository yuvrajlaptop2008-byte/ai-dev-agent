---
name: git
description: Local git operations — init, clone, branch, stage, commit, merge, rebase, resolve conflicts, history, diff, restore.
keywords: git, commit, branch, merge, rebase, clone, stage, diff, stash, checkout
tools: git_clone, git_op, git_terminal
---

# Git Skill

Wraps local git as direct actions instead of asking the user to type commands.

## Commands covered
```
git init          git checkout -b <branch>   git diff
git clone         git add .                  git status
git commit -m     git pull / git push        git log
git merge         git rebase                 git stash
```

## Tools
- `git_clone(owner, repo, dir?)` — clone a GitHub repo locally
- `git_op(repo_dir, operation, args?)` — structured: status/add/commit/push/pull/fetch/checkout/
  checkoutNew/branch/deleteBranch/merge/rebase/cherryPick/tag/tags/pushTags/reset/revert/log/diff/
  diffStaged/stash/stashPop/remote/addRemote/blame/show/clean/raw
- `git_terminal(repo_dir, command)` — any raw git command via the real shell, for anything above
  doesn't cover (submodules, hooks, `gh` CLI, complex pipelines)

## When to use
Any time you need real git history, branching, or are touching multiple files in one repo —
clone first, work locally, push. For single-file edits on GitHub without needing a local
checkout, use the `github` skill's `github_put_file` instead (faster, no clone needed).

See `references/commands.md` for the full command reference.
