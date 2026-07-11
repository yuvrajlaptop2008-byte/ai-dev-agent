# Git Command Reference

| Intent | Command |
|---|---|
| Start a repo | `git init` |
| Clone | `git clone <url>` |
| New branch | `git checkout -b feature/x` |
| Stage everything | `git add .` |
| Commit | `git commit -m "feat: ..."` (Conventional Commits) |
| Sync | `git pull` / `git push` |
| Merge | `git merge <branch>` |
| Rebase | `git rebase <branch>` |
| See changes | `git diff` / `git diff --staged` |
| State | `git status` |
| History | `git log --oneline` |
| Shelve WIP | `git stash` / `git stash pop` |
| Undo (soft) | `git reset --mixed HEAD~1` |
| Undo (commit, safe) | `git revert <sha>` |

## Conflict resolution
Read both sides of every `<<<<<<<` marker, understand intent on each, resolve correctly.
Never blindly keep "ours" or "theirs" without reading the actual diff.
