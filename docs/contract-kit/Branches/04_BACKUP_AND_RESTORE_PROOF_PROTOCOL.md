# Backup and Restore Proof Protocol

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


No repo may be changed until this file is satisfied for that repo.

## Backup types required
For each repo, create all three:

### 1. Mirror backup
```bash
git clone --mirror "<repo_path>" "<evidence_root>/<repo_name>.mirror.git"
```

### 2. Bundle backup
From inside the repo:
```bash
git bundle create "<evidence_root>/<repo_name>.bundle" --all
```

### 3. Working tree archive
Archive the full folder, excluding dependency/cache/build folders only after listing them. Save untracked files too.

Recommended exclusions to review per repo:

- `node_modules/`
- `.venv/`
- `venv/`
- `.git/`
- `dist/`
- `build/`
- `.next/`
- `.turbo/`
- `.cache/`

Do not exclude source, docs, configs, env templates, scripts, package files, lock files, Docker files, or CI files.

## Required proof commands
Run and record:

```bash
git status --short --branch
git branch -avv
git remote -v
git log --oneline --decorate --graph -n 80
git reflog --date=iso -n 80
git rev-parse HEAD
git rev-parse --show-toplevel
```

## Restore test
Create a temporary restore folder outside the original repo.

### Mirror restore proof
```bash
git clone "<evidence_root>/<repo_name>.mirror.git" "<restore_root>/<repo_name>_mirror_restore"
cd "<restore_root>/<repo_name>_mirror_restore"
git rev-parse HEAD
git branch -avv
```

### Bundle restore proof
```bash
git clone "<evidence_root>/<repo_name>.bundle" "<restore_root>/<repo_name>_bundle_restore"
cd "<restore_root>/<repo_name>_bundle_restore"
git rev-parse HEAD
git branch -avv
```

## Pass criteria
Backup phase passes only if:

- Original HEAD hash recorded.
- Mirror restore HEAD matches original or contains original branch refs.
- Bundle restore HEAD matches original or contains original branch refs.
- Working tree archive exists and has non-zero size.
- Hashes for backup files are recorded.
- Evidence paths are outside the repo being modified.

If any test fails, do not continue.
