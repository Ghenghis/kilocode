# Repo Inventory and Upstream Truth

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


## Discovery procedure
For each candidate folder, run:

```bash
cd "<candidate>"
git rev-parse --is-inside-work-tree
git rev-parse --show-toplevel
git remote -v
git branch --show-current
git status --short --branch
```

Record actual repo root. If nested repos exist, list each separately.

## Required repo table
Create this table in `repo_inventory.md`:

| Repo label | Actual root | Current branch | Default branch | Origin URL | Upstream URL | Local HEAD | Origin HEAD | Upstream HEAD | Dirty? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|

## Upstream remote rules
If `upstream` remote exists, fetch it.
If it does not exist, do not guess silently. Try to infer from:

1. GitHub fork parent metadata if available.
2. README/source references.
3. Existing origin fork relationship.
4. Operator-provided known upstream.

If upstream cannot be proven, mark repo BLOCKED, preserve backups, and continue with other repos.

## Divergence proof commands
```bash
git fetch --all --prune
git remote show origin
git remote show upstream
git rev-parse HEAD
git rev-parse origin/main || git rev-parse origin/master
git rev-parse upstream/main || git rev-parse upstream/master
git merge-base HEAD upstream/main || git merge-base HEAD upstream/master
git rev-list --left-right --count HEAD...upstream/main || git rev-list --left-right --count HEAD...upstream/master
git log --left-right --cherry-pick --oneline HEAD...upstream/main || git log --left-right --cherry-pick --oneline HEAD...upstream/master
```

## Main/master sync principle
`main/master` is not the user's development lane anymore. It is an upstream mirror lane. All user work moves to feature branches or release branches.
