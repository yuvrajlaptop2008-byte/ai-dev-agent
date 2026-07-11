# GitHub API Quick Notes

- File writes (`github_put_file`) need the current `sha` when updating an existing file —
  get it from `github_get_file` first, omit it only when creating a new file.
- `github_create_pr` needs `head` (source branch) and `base` (target, usually the repo's
  default branch — check with `github_get_repo` rather than assuming `main`).
- Rate limits: batch bulk operations with pacing (see `github_batch` pattern in the `git`/
  `github` service layer) rather than firing dozens of calls at once.
- Labels/topics must already exist or be created — `github_add_labels` doesn't fail if a
  label is new, GitHub auto-creates it with a default color.
