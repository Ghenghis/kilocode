# Release Branch Assembly Protocol

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


Release branches are the only place where selected feature branches are assembled for a DaveAI release. `main/master` remains upstream-clean.

## Naming
Use repo convention if present. Otherwise:

- `release/daveai-YYYY-MM-DD-rc1`
- `release/daveai-vX.Y.Z-rc1`

## Create release branch
From clean upstream base:

```bash
git fetch upstream --prune
git switch -c release/daveai-YYYY-MM-DD-rc1 upstream/main
# or upstream/master when applicable
```

## Merge selected feature branches
Use no fast-forward so the release ledger remains clear:

```bash
git merge --no-ff feature/<name>
```

If conflicts occur, resolve only on release branch.

## Release proof
Record:

```bash
git log --oneline --decorate --graph --max-count=80
git diff --stat upstream/main...HEAD || git diff --stat upstream/master...HEAD
git status --short --branch
```

## Forbidden release behavior
- Do not merge release branch into `main/master`.
- Do not force-push release branch unless explicitly approved.
- Do not hide failed feature branches by manually copying their files into release.
- Do not tag a release if validation gates fail.
