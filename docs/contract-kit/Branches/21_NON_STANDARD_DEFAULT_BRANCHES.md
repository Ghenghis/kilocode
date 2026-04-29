# Non-Standard Default Branches

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master` — **and the rule applies to whatever the repo's current default branch actually is, including non-standard names like `integration/main` and `clean-master`.** The default branch may only mirror upstream after verified backups exist. Any attempted push to a protected default branch is a critical failure and must stop the run.

## Why this matters

V3 doc 08 hard-codes the protection regex as:

```
^(refs/heads/)?(main|master)$
```

That regex is too narrow. Phase 0 discovery proved at least two repos in this contract use non-standard defaults:

| Repo | Default branch | State at discovery |
|---|---|---|
| `contract-kit-v17` | `integration/main` | 14 commits behind, 15 dirty md files |
| `kilocode-7.2.4` | `clean-master` | dirty, `node_modules` tracked |

Standard defaults (for reference, all `main` except where noted): `kilocode-Azure2`, `kilocode`, `kilocode-Azure`, `hermes-agent-fresh`, `hermes.daveai.tech-new`, `open-webui`, `open-webui-current`, `PixelClaw`, plus `hermes.daveai.tech` on `master`.

A repo that renames its default to `integration/main` would silently allow direct pushes under the V3 hook — defeating the rule entirely. The protection must be **config-driven per repo**, not a hard-coded regex.

## Discovering the default branch (per repo)

Use these probes in order. The first two are authoritative; the rest are best-effort.

```bash
# 1. PREFERRED — server's view of the default branch
git symbolic-ref refs/remotes/origin/HEAD
# → refs/remotes/origin/integration/main

# 2. PREFERRED when gh is available — direct from GitHub API
gh api repos/<owner>/<repo> --jq .default_branch
# → integration/main

# 3. NOT RELIABLE — local-only, often unset or stale
git config --get init.defaultBranch

# 4. FALLBACK — when 1 and 2 are unavailable
git branch --list main master integration/main clean-master
# pick the only existing match
```

If `origin/HEAD` is missing, set it once:

```bash
git remote set-head origin --auto
```

Record the resolved default branch in the repo inventory (doc 05) under the **Default branch** column — and never assume it is `main`.

## Updated protected-branches list (per repo)

The hook config file from doc 17 (`.git/hooks-config/protected-branches`) must be populated with **every logical default**, not just `main` and `master`. One pattern per line, no comments, no blanks treated as significant.

### `contract-kit-v17/.git/hooks-config/protected-branches`

```
integration/main
main
master
```

### `kilocode-7.2.4/.git/hooks-config/protected-branches`

```
clean-master
main
master
```

### All other repos (`.git/hooks-config/protected-branches`)

```
main
master
```

The defensive `main`/`master` entries on the non-standard repos prevent a future renamer from accidentally creating an unprotected branch under a name the rule already implicitly covers.

## Hook regex update

Replace the V3 doc 08 hook body. The new hook is config-driven and falls back to `main|master` only when no config file exists.

```bash
#!/usr/bin/env bash
# Pre-push hook — config-driven default-branch protection
PROTECTED_FILE="$(git rev-parse --git-common-dir)/hooks-config/protected-branches"
BLOCKED=0

while read local_ref local_sha remote_ref remote_sha; do
  if [ -f "$PROTECTED_FILE" ]; then
    while read -r p; do
      [ -z "$p" ] && continue
      if [[ "$local_ref" =~ ^(refs/heads/)?$p$ ]] || [[ "$remote_ref" =~ ^(refs/heads/)?$p$ ]]; then
        BLOCKED=1; break
      fi
    done < "$PROTECTED_FILE"
  else
    # default fallback — V3 behavior
    [[ "$local_ref" =~ ^(refs/heads/)?(main|master)$ ]] && BLOCKED=1
    [[ "$remote_ref" =~ ^(refs/heads/)?(main|master)$ ]] && BLOCKED=1
  fi

  if [ "$BLOCKED" = "1" ]; then
    echo "BLOCKED: pushing to a protected default branch ($local_ref → $remote_ref) is prohibited by DaveAI rescue contract."
    echo "         See $PROTECTED_FILE for the active protection list."
    exit 1
  fi
done
exit 0
```

Record the deployed hook path, contents hash, and the protected-branches file contents in evidence for every repo.

## Renaming default branches (when migrating master → main, or main → integration/main)

Renaming a default branch is a coordinated five-step procedure. Skipping any step strands collaborators or breaks CI silently.

1. **Communicate the change** to all collaborators before touching anything. Pin a notice in the repo's primary chat channel; include the cutover time.
2. **GitHub: rename via Settings or API**
   ```bash
   gh api -X POST "repos/<owner>/<repo>/branches/<old>/rename" -f new_name='<new>'
   # or: Settings → Branches → rename
   ```
   This atomically updates open PRs, `origin/HEAD`, and branch protections.
3. **Locally on every checkout** (every clone, every worktree):
   ```bash
   git branch -m <old> <new>
   git fetch origin
   git branch -u origin/<new>
   git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/<new>
   git remote prune origin
   ```
4. **Update CI/CD references** — workflow `on:` filters, deploy targets, dashboards, badge URLs, doc links, environment protection rules. Search for the old name across `.github/workflows/`, `.gitlab-ci.yml`, deploy scripts, and READMEs.
5. **Update `protected-branches` config** in this contract (doc 17 + this doc) and re-deploy hooks.

Record the rename event with a Phase 0 discovery row showing the old and new `git symbolic-ref refs/remotes/origin/HEAD` values.

## Worktrees with detached defaults

`contract-kit-v17` currently has worktrees at `.claude/worktrees/<name>`. Each worktree has its own `HEAD` and its own `.git` file pointing at `<repo>/.git/worktrees/<name>/`, but they share the object store and refs.

Hook deployment rules:

- If `core.hooksPath` is set globally for the repo, install once — every worktree inherits it.
- If `core.hooksPath` is unset, the hooks live in the per-worktree `hooks/` dir. Install per-worktree, or set `core.hooksPath` once and link.
- The `hooks-config/protected-branches` file lives under the **main** `.git` dir, not the worktree's `.git`. `git rev-parse --git-dir` from inside a worktree returns the worktree's git dir, so the hook should resolve via `git rev-parse --git-common-dir` instead when worktrees are in use:

```bash
PROTECTED_FILE="$(git rev-parse --git-common-dir)/hooks-config/protected-branches"
```

Use `--git-common-dir` in the production hook for any repo that ever uses worktrees. It collapses to the same path as `--git-dir` in non-worktree clones.

## Special case: `contract-kit-v17` `integration/main`

- **Why this name (assumed convention):** `integration/*` is the merge-only feature-stream prefix; `main` is reserved for an eventual upstream-mirror lane. As of Phase 0, no upstream remote exists, so `main` is unused and `integration/main` is the de-facto default.
- **Phase 7 implication:** This repo has no `upstream` remote, so the V3 "sync to upstream" procedure (doc 08, `Safe sync procedure`) is **N/A**. Phase 7 for `contract-kit-v17` means: confirm `integration/main` is clean, all in-flight features are properly branched off, and the 14-commit/15-dirty-file backlog has been resolved through PRs — not by direct push.
- **Recommendation (longer-term):** Either rename `integration/main` → `main` and create a separate true-integration branch (e.g. `integration/next`), **or** document this naming convention prominently so external tooling, contributors, and CI templates do not mistake `integration/main` for an ephemeral feature branch and prune it.

## Special case: `kilocode-7.2.4` `clean-master`

- This is a **snapshot repo**, frozen at upstream version v7.2.4. The `clean-master` name was almost certainly an intentional signal: "this is a curated freeze, not a moving target."
- Treat it as an **immutable archive**: no new feature branches should target this repo. Forks and derivative work belong in `kilocode` / `kilocode-Azure` / `kilocode-Azure2`, not here.
- Hot-patch protocol when an emergency fix to the v7.2.4 freeze is unavoidable:
  1. Branch from `clean-master` as `hotfix/v7.2.4-<purpose>`.
  2. Make the minimal change.
  3. Open a PR back into `clean-master`.
  4. Merge **only** with explicit operator approval recorded in evidence.
  5. Tag the merge commit `v7.2.4-hotfix-<n>` so the freeze remains traceable.

The dirty `node_modules` state at discovery is a separate hygiene issue — see doc 05 for cleanup; it does not change the archive policy.

## Discovery audit script

Run this against every repo path in the manifest (doc 16) at the start of every run to catch silent default-branch drift.

```bash
#!/usr/bin/env bash
# audit-default-branches.sh — emit one block per repo
set -u

REPOS=(
  "/g/Github/contract-kit-v17"
  "/g/Github/kilocode-7.2.4"
  "/g/Github/kilocode"
  "/g/Github/kilocode-Azure"
  "/g/Github/kilocode-Azure2"
  "/g/Github/hermes-agent-fresh"
  "/g/Github/hermes.daveai.tech"
  "/g/Github/hermes.daveai.tech-new"
  "/g/Github/open-webui"
  "/g/Github/open-webui-current"
  "/g/Github/PixelClaw"
)

for repo in "${REPOS[@]}"; do
  (
    cd "$repo" 2>/dev/null || { echo "=== $repo === MISSING"; exit 0; }
    echo "=== $repo ==="
    git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || echo "no origin/HEAD"
    echo "current: $(git branch --show-current)"
    echo "init.defaultBranch: $(git config --get init.defaultBranch || echo '(unset)')"
    PROT="$(git rev-parse --git-common-dir)/hooks-config/protected-branches"
    if [ -f "$PROT" ]; then
      echo "protected-branches:"
      sed 's/^/  /' "$PROT"
    else
      echo "protected-branches: (none — falling back to main|master)"
    fi
  )
done
```

Persist the output as `evidence/phase-0/default-branch-audit.txt` for every run. Diff it against the previous run; any change requires an operator-acknowledged note before continuing.

## Cross-references

- **Doc 08** — Main/Master Protection and Sync Protocol. The hook regex defined there is **superseded** by the config-driven hook in this doc for any repo carrying a `protected-branches` file.
- **Doc 17** — Hook deployment and `.git/hooks-config/` layout. This doc consumes that layout.
- **Doc 16** — Repo manifest. Source of truth for the audit-script repo list.
- **Doc 05** — Repo Inventory and Upstream Truth. The **Default branch** column there must reflect whatever `git symbolic-ref refs/remotes/origin/HEAD` reports, never an assumption.
