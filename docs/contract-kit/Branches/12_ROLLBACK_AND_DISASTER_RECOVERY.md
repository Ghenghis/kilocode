# Rollback and Disaster Recovery

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


## When to rollback
Rollback immediately if:

- `main/master` was accidentally committed to.
- A push to `main/master` occurred.
- Backup restore proof is missing.
- Feature extraction loses files.
- Secret is found in history.
- Upstream reset happened before feature extraction proof.
- Branch contains unrelated changes and cannot be split safely.

## Restore from mirror
```bash
git clone "<evidence_root>/<repo_name>.mirror.git" "<restore_root>/<repo_name>_restore_from_mirror"
```

## Restore from bundle
```bash
git clone "<evidence_root>/<repo_name>.bundle" "<restore_root>/<repo_name>_restore_from_bundle"
```

## Recover accidental local main commit
If not pushed:

```bash
git branch rescue/accidental-main-commit
# verify branch exists, then reset main after proof
```

If pushed:

1. Stop all work.
2. Record pushed commit SHA.
3. Do not force-push without explicit human approval.
4. Create rescue branch from pushed SHA.
5. Use GitHub protection/audit logs if available.
6. Decide whether revert PR or force reset is safest.

## Secret incident
If a secret was committed:

1. Stop.
2. Rotate the secret in the provider dashboard.
3. Do not rely only on deleting the file.
4. Decide whether history rewrite is required.
5. Record incident and remediation.
