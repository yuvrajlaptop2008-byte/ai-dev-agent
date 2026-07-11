---
name: github-pr-workflow
description: The full engineering workflow — analyze repo, plan, branch, code, test, commit, push, open PR, respond to review, merge.
keywords: pull request, PR workflow, contribute, solve issue, ship, branch and merge
tools: git_clone, git_op, git_terminal, github_get_repo, github_create_branch, github_get_file, github_put_file, github_create_pr, github_review_pr, github_merge_pr, github_comment
activates: git, github
---

# GitHub PR Workflow Skill

The standard path from "here's a task" to "merged." Activating this skill also activates
`git` and `github` — you get their full tool sets too.

## Flow
```
Repository
    ↓
Create Branch
    ↓
Modify Code
    ↓
Commit
    ↓
Push
    ↓
Open PR
    ↓
Review
    ↓
Merge
```

## Full engineering loop (from a task/issue to shipped)
```
User
    ↓
Analyze Repository
    ↓
Create Plan
    ↓
Create Branch
    ↓
Modify Files
    ↓
Run Tests
    ↓
Commit
    ↓
Push
    ↓
Create Pull Request
    ↓
Wait / Respond to Review
    ↓
Merge
```

## Conventions
See `templates/commit-message.md` and `templates/pr-description.md` — follow them, don't
freelance the format.

## Concrete steps
1. `github_get_repo` — confirm default branch, don't assume `main`
2. `git_clone` (or work file-by-file via `github_get_file`/`github_put_file` for small changes)
3. `git_op checkoutNew` / `github_create_branch` — `feature/<slug>` or `fix/<slug>`
4. Make the actual changes, matching the repo's existing style
5. `run_tests` if the repo has any — don't open a PR on failing tests
6. `git_op commit` with a Conventional Commits message (see template)
7. `git_op push`
8. `github_create_pr` with a real description (see template) — link the issue: `Closes #N`
9. If review comments come back, address them and push again — don't just re-request review
10. `github_merge_pr` once approved (or leave for the human if that's the convention on that repo)
