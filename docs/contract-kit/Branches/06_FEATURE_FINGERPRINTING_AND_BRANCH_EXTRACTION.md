# Feature Fingerprinting and Branch Extraction

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


## Feature card format
Every extracted branch must have a feature card:

```md
# Feature Card
Repo:
Feature ID:
Branch name:
Feature type: feature / fix / chore / docs / integration / security
User-facing purpose:
Files expected:
Commits expected:
Dependencies:
Cross-repo links:
Extraction method:
Validation commands:
Rollback method:
Owner:
Verifier:
Challenger:
Status:
```

## Fingerprinting sources
Use all available evidence:

- Unique commits on polluted `main/master`.
- File diff against upstream default branch.
- Directory ownership.
- Import graph.
- Package/dependency changes.
- UI surface names.
- API route names.
- Docker/compose/service changes.
- README/docs references.
- Recent local file timestamps only as supporting evidence, not sole proof.

## Extraction method ladder
Use the safest method that fits the evidence.

### Method A — Clean cherry-pick
Best when commits are already feature-focused.

```bash
git switch -c <branch_name> upstream/main
git cherry-pick <commit_sha>
```

Use `--no-commit` when multiple commits need review before final commit:

```bash
git cherry-pick --no-commit <sha1> <sha2>
git diff --stat
git commit -m "<repo>: <feature summary>"
```

### Method B — Patch extraction
Best when commits are mixed but diff hunks can be isolated.

```bash
git diff upstream/main...polluted-main -- <file_or_path> > <feature>.patch
git switch -c <branch_name> upstream/main
git apply --check <feature>.patch
git apply <feature>.patch
git diff --stat
git commit -m "<repo>: <feature summary>"
```

### Method C — File checkout extraction
Best when a feature is contained in clear files.

```bash
git switch -c <branch_name> upstream/main
git checkout polluted-main -- path/to/feature/file path/to/feature/folder
git diff --stat
git commit -m "<repo>: <feature summary>"
```

### Method D — Manual replay
Best when upstream has changed too much and old patches do not apply cleanly.

Rules:

- Use old branch as reference only.
- Re-implement minimal feature on clean upstream base.
- Cite every copied file/function in feature card.
- Run full tests.

## Branch rejection rules
Reject and split a branch if:

- It changes unrelated app areas.
- It mixes UI, backend, docs, and infrastructure without one feature purpose.
- It includes secrets or private keys.
- It modifies lock files without dependency reason.
- It cannot explain why each file belongs.
- It passes build only by relying on another unmerged feature branch without declaring dependency.

## Branch acceptance proof
Each branch needs:

```bash
git status --short --branch
git diff --stat upstream/main...HEAD
git diff --name-status upstream/main...HEAD
git log --oneline --decorate upstream/main..HEAD
```

Plus project-specific validation from `09_VALIDATION_GATES.md`.
