# Main/Master Protection and Sync Protocol

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.


## Local protection
Install local hooks after backup proof and before extraction pushes.

### Pre-push hook policy
The hook must block pushes to `main` or `master`.

```bash
#!/usr/bin/env bash
protected='^(refs/heads/)?(main|master)$'
while read local_ref local_sha remote_ref remote_sha; do
  if [[ "$local_ref" =~ $protected || "$remote_ref" =~ $protected ]]; then
    echo "BLOCKED: pushing to main/master is prohibited by DaveAI rescue contract."
    exit 1
  fi
done
exit 0
```

Record hook path and contents in evidence.

## GitHub protection checklist
For every GitHub repo/fork, verify settings where permissions allow:

- Protect `main/master`.
- Require pull request before merging.
- Block force pushes.
- Block deletions.
- Require status checks if CI exists.
- Restrict who can push to matching branches if available.
- Require linear history if it matches repo policy.

If the user lacks permission, record as blocker and rely on local hook plus behavior rules.

## Safe sync procedure
Only after all backups and feature branches are proven:

```bash
git fetch upstream --prune
git switch main || git switch master
git status --short
```

If dirty, stop.

Then:

```bash
git reset --hard upstream/main
# or if default is master:
git reset --hard upstream/master
```

Do not push the synced default branch unless the operator explicitly wants the fork default branch updated and branch protections are confirmed.

## Sync proof
Record:

```bash
git rev-parse HEAD
git rev-parse upstream/main || git rev-parse upstream/master
git status --short --branch
git rev-list --left-right --count HEAD...upstream/main || git rev-list --left-right --count HEAD...upstream/master
```
