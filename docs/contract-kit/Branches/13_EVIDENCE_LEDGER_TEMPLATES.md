# Evidence Ledger Templates

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


## `repo_inventory.md`
```md
# Repo Inventory
Date:
Operator:
Machine:
Git version:
Evidence root:

| Repo | Root | Current branch | Default | Origin | Upstream | HEAD | Dirty | Status |
|---|---|---|---|---|---|---|---|---|
```

## `feature_fingerprint_matrix.md`
```md
# Feature Fingerprint Matrix

| Feature ID | Repo | Purpose | Files | Commits | Branch | Method | Dependencies | Status |
|---|---|---|---|---|---|---|---|---|
```

## `branch_creation_log.md`
```md
# Branch Creation Log

## Branch: 
Repo:
Base commit:
Base source: upstream/main or upstream/master
Extraction method:
Commands run:
Diff stat:
Validation commands:
Result:
Owner:
Verifier:
Challenger:
Security result:
```

## `blockers.md`
```md
# Blockers

| ID | Repo | Severity | Description | Evidence | Required human action | Status |
|---|---|---|---|---|---|---|
```

## `final_verdict.md`
```md
# Final Verdict

Repo:
Status: PASS / BLOCKED / FAIL
Backups proven:
Restore proven:
Upstream remote proven:
Main/master clean:
Main/master synced:
Feature branches created:
Feature branches pushed:
Security scan passed:
Build/test passed:
Known blockers:
Next action:
```
