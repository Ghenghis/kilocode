# GitHub Protection Setup

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.

This doc is the turnkey companion to `08_MAIN_MASTER_PROTECTION_AND_SYNC_PROTOCOL.md`. Doc 08 lists the GitHub-side protection requirements as a checklist; this doc gives the exact `gh` CLI commands and ruleset JSON to apply them across every repo in the ecosystem.

## Why GitHub-side protection is mandatory in addition to the local pre-push hook

The local `pre-push` hook in doc 08 is necessary but **not sufficient**. It only fires when somebody pushes from a clone that has the hook installed. The following bypass paths exist and can only be closed server-side:

- **Force-push from GUI clients** (GitHub Desktop, SourceTree, Tower, JetBrains VCS) on machines where the hook was never installed or was deleted.
- **Web edits** via the GitHub UI (the "Edit" pencil, file upload, "commit directly to `main`") never run client hooks.
- **GitHub Actions writes** using `GITHUB_TOKEN` or a PAT can push to default branches without ever touching a developer machine.
- **Codespaces / dev containers / fresh clones** created by another contributor will not inherit `.git/hooks/pre-push`.
- **Force-push from a different working copy** of the same repo by the same user, where the hook was not copied.

GitHub-side rulesets close every one of these. The local hook stays in place as a fast first line of defense; the GitHub ruleset is the authoritative gate.

## Prerequisites

- `gh` CLI 2.x (`gh --version` should show `gh version 2.x`).
- Authenticated as the **owner** of each target repo, or as a member with the `admin` role on that repo.
- Network access to `api.github.com`.

Verify before applying anything:

```bash
gh auth status
gh api user --jq .login
```

`gh auth status` must show `Logged in to github.com as <owner>`. `gh api user` must return the login that owns the repos below (typically `Ghenghis` or `AiDave71`).

If you are not admin on a target repo, the `POST /rulesets` call returns `403`. Record that as a blocker (see "Failure modes") and move on.

## Branch ruleset JSON template

The new GitHub Repository Rulesets API replaces classic branch protection. Save the following as `ruleset.json` in your working directory before running the per-repo commands.

```json
{
  "name": "v3-default-branch-lockdown",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH", "refs/heads/main", "refs/heads/master"], "exclude": [] } },
  "rules": [
    {"type": "deletion"},
    {"type": "non_fast_forward"},
    {"type": "pull_request", "parameters": {"required_approving_review_count": 1, "dismiss_stale_reviews_on_push": true, "require_code_owner_review": false, "require_last_push_approval": true, "required_review_thread_resolution": true}},
    {"type": "required_linear_history"},
    {"type": "required_signatures"}
  ],
  "bypass_actors": [{"actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "pull_request"}]
}
```

Notes:

- `~DEFAULT_BRANCH` is a GitHub built-in include token — it covers whatever the repo currently calls its default, which matters for `contract-kit-v17` where the default is `integration/main` rather than `main`.
- The explicit `refs/heads/main` and `refs/heads/master` entries belt-and-brace cover the case where someone renames the default later but a stale `main` or `master` ref still exists.
- `actor_id: 5` is the numeric `RepositoryRole` id for `admin`. Confirm with `gh api repos/<owner>/<repo>/roles --jq '.[] | select(.name=="admin") | .id'` if the value drifts.
- `bypass_mode: "pull_request"` means even admins must go through a PR — the role can bypass the merge restriction only by merging via a PR, not by direct push.
- Drop `required_signatures` for repos where contributors don't have signing keys configured; otherwise every commit must be GPG/SSH signed.

## Per-repo apply commands

Run from the directory containing `ruleset.json`. Each command applies the same template against the named repo.

### 1. github.com/Ghenghis/kilocode (origin of kilocode-Azure2)

```bash
gh api repos/Ghenghis/kilocode/rulesets --method POST --input ruleset.json
```

### 2. github.com/AiDave71/kilocode (alternate origin of kilocode-Azure2)

```bash
gh api repos/AiDave71/kilocode/rulesets --method POST --input ruleset.json
```

You must be authenticated as `AiDave71` or as a collaborator with admin role to apply this. If your active `gh` login is `Ghenghis`, switch with `gh auth switch -u AiDave71` first, or skip and record as a blocker.

### 3. github.com/Ghenghis/kilocode-RVC (origin of kilocode RVC fork)

```bash
gh api repos/Ghenghis/kilocode-RVC/rulesets --method POST --input ruleset.json
```

### 4. github.com/Ghenghis/Kilocode-Azure (origin of kilocode-Azure legacy)

```bash
gh api repos/Ghenghis/Kilocode-Azure/rulesets --method POST --input ruleset.json
```

Note the capital `K` — GitHub repo names are case-sensitive in the URL.

### 5. github.com/Ghenghis/kilocode-7.2.4 (origin of kilocode-7.2.4 snapshot)

```bash
gh api repos/Ghenghis/kilocode-7.2.4/rulesets --method POST --input ruleset.json
```

### 6. github.com/Ghenghis/open-webui (origin of open-webui-current + duplicate)

```bash
gh api repos/Ghenghis/open-webui/rulesets --method POST --input ruleset.json
```

### 7. github.com/Ghenghis/hermes-agent (origin of hermes-agent-fresh)

```bash
gh api repos/Ghenghis/hermes-agent/rulesets --method POST --input ruleset.json
```

### 8. github.com/Ghenghis/hermes.daveai.tech (origin of hermes.daveai.tech + new)

```bash
gh api repos/Ghenghis/hermes.daveai.tech/rulesets --method POST --input ruleset.json
```

If the empty companion repo `hermes.daveai.tech-new` has no commits yet, see "Failure modes — Empty repo" below.

### 9. github.com/Ghenghis/contract-kit-v17 — special case (default branch is `integration/main`)

The default for this repo is `integration/main`, not `main`. The `~DEFAULT_BRANCH` token in the JSON template handles this automatically, but to belt-and-brace also include `refs/heads/integration/main`. Save a copy of `ruleset.json` as `ruleset.contract-kit.json` with this `conditions` block:

```json
"conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH", "refs/heads/main", "refs/heads/master", "refs/heads/integration/main"], "exclude": [] } }
```

Then:

```bash
gh api repos/Ghenghis/contract-kit-v17/rulesets --method POST --input ruleset.contract-kit.json
```

### 10. github.com/Ghenghis/PixelClaw (origin of PixelClaw)

```bash
gh api repos/Ghenghis/PixelClaw/rulesets --method POST --input ruleset.json
```

## Verify protection is active

For each repo, after the POST returns `201 Created`, confirm:

```bash
gh api repos/<owner>/<repo>/rulesets --jq '.[] | {id, name, enforcement, target}'
gh api repos/<owner>/<repo>/branches/<default>/protection 2>&1 | head -5
```

The first command must show your ruleset with `enforcement: active`. The second confirms the protection surface is reachable from the legacy endpoint as well.

### ⚠️ DANGEROUS VERIFICATION — MUST FAIL — DO NOT RUN UNCONDITIONALLY ⚠️

> **WARNING**: The next command is a **negative test**. Its expected behavior is to **be refused** by the server. If the server *accepts* the push, you have just force-pushed the default branch and broken your own protection. Read every line of these gates before running.
>
> **Preconditions — ALL must be satisfied or DO NOT run this command:**
> 1. The ruleset POST/PUT in §"Per-repo apply commands" returned 201/200 for this repo and `enforcement: active` is confirmed by the verify GET above.
> 2. You are operating from a **sandbox / throwaway clone** of the repo, NOT the canonical working tree.
> 3. You are authenticated as a GitHub user/account that the ruleset's `bypass_actors` list does **NOT** include — otherwise you may successfully force-push (because admin bypass is enabled with `bypass_mode: "pull_request"` only, but a non-admin should be the one running this test).
> 4. You have an existing local backup (mirror + bundle) of this repo from doc 04 / Phase 1.
> 5. The push is to the **same SHA** that's currently on the protected branch (i.e. the force-push is a no-op contents-wise) — this proves the rule rejects the *type of push*, not the *content*. Use `HEAD` of `origin/<default>` as the source.
>
> **Use this exact form** (no shorter, no other refspec) and **expect non-zero exit code**:

```bash
# MUST FAIL — this is a negative test of GitHub-side branch protection.
# If this command exits 0, your protection is broken. STOP and re-apply the ruleset.
DEFAULT_BRANCH=$(gh api repos/<OWNER>/<REPO> --jq .default_branch)
HEAD_SHA=$(gh api repos/<OWNER>/<REPO>/branches/$DEFAULT_BRANCH --jq .commit.sha)
git push --force-with-lease=$DEFAULT_BRANCH:$HEAD_SHA \
  origin "$HEAD_SHA:refs/heads/$DEFAULT_BRANCH"
echo "exit code = $?"
```

**Expected outcome — every one of these:**
- `remote: error: GH013: Repository rule violations` in the output.
- HTTP `422` from the server.
- Local exit code is non-zero (typically 1).
- The default branch's SHA on the server is **unchanged** — verify with `gh api repos/<OWNER>/<REPO>/branches/$DEFAULT_BRANCH --jq .commit.sha` after the test; it must equal `$HEAD_SHA` from before the test.

**Forbidden cases — DO NOT RUN if any are true:**
- The ruleset POST returned 403 (you don't have admin and ruleset wasn't applied).
- The ruleset POST returned 422 with `enforcement: disabled` (rule exists but isn't enforcing).
- You're authenticated as the repo owner whose `bypass_actors` entry has `bypass_mode` other than `pull_request`.
- You don't have a recent (same-run) Phase 1 backup of this repo.

**If the command unexpectedly exits 0**: STOP IMMEDIATELY. Re-fetch the branch's SHA, restore from backup if the SHA changed, re-apply the ruleset, and file an incident report at `<EVIDENCE_ROOT>/incidents/F18.1_<owner>_<repo>_<UTC>.md` per doc 24 severity HIGH.

## Required status checks integration

If a repo has GitHub Actions workflows, attach them as required status checks so the PR cannot merge until they pass.

Discover workflow names:

```bash
gh workflow list -R Ghenghis/kilocode
```

The `NAME` column gives the human name; the `check_run` context that GitHub records is the workflow's `name:` field as it appears in `.github/workflows/*.yml`.

Amend the ruleset to require those checks. Add a new rule object to `rules`:

```json
{
  "type": "required_status_checks",
  "parameters": {
    "strict_required_status_checks_policy": true,
    "required_status_checks": [
      {"context": "build"},
      {"context": "test"},
      {"context": "lint"}
    ]
  }
}
```

To update an existing ruleset rather than creating a new one, fetch its id first:

```bash
RULESET_ID=$(gh api repos/<owner>/<repo>/rulesets --jq '.[] | select(.name=="v3-default-branch-lockdown") | .id')
gh api repos/<owner>/<repo>/rulesets/$RULESET_ID --method PUT --input ruleset.json
```

## Bypass policy

Only the repo owner (`Ghenghis` or `AiDave71` for the AiDave71-owned fork) may be listed in `bypass_actors`. The `bypass_mode` is `pull_request`, which means even the owner must merge via a PR — they may dismiss review requirements but cannot push directly.

Emergency procedure — when a hotfix must land and CI is broken:

1. Open a PR with the fix.
2. Document the emergency in the PR description, including the broken CI failure mode and why it cannot wait.
3. The owner uses the bypass to merge without the failing required check.
4. Within 24 hours, file a follow-up issue to fix CI and remove the bypass justification.
5. Record the bypass event in the evidence directory: `<EVIDENCE_ROOT>/github_protection_bypass.md` with the PR URL, timestamp, actor, reason, and follow-up issue link. The GitHub audit log retains the event independently — both records must exist.

Never use bypass for "routine" pushes. Every bypass is a blocker entry in the evidence trail.

## Removing protection (DANGEROUS)

Never `DELETE` a ruleset. Disable it instead so the audit trail and rule body are retained:

```bash
RULESET_ID=$(gh api repos/<owner>/<repo>/rulesets --jq '.[] | select(.name=="v3-default-branch-lockdown") | .id')
gh api repos/<owner>/<repo>/rulesets/$RULESET_ID --method PUT --input - <<'JSON'
{ "enforcement": "disabled" }
JSON
```

Audit-log requirement: any disable action must be paired with an entry in `<EVIDENCE_ROOT>/github_protection_disable.md` recording who, when, why, and the planned re-enable date. The default re-enable window is 24 hours; longer windows require operator sign-off.

## Cross-repo apply script — `apply_github_protection.sh`

```bash
#!/usr/bin/env bash
set -u
EVIDENCE_ROOT="${EVIDENCE_ROOT:-./evidence}"
mkdir -p "$EVIDENCE_ROOT"
LOG="$EVIDENCE_ROOT/github_protection_apply.md"
echo "# GitHub Protection Apply Log — $(date -u +%FT%TZ)" > "$LOG"
echo "" >> "$LOG"
echo "| Repo | HTTP | Ruleset ID | Notes |" >> "$LOG"
echo "|------|------|------------|-------|" >> "$LOG"

REPOS=(
  "Ghenghis/kilocode"
  "AiDave71/kilocode"
  "Ghenghis/kilocode-RVC"
  "Ghenghis/Kilocode-Azure"
  "Ghenghis/kilocode-7.2.4"
  "Ghenghis/open-webui"
  "Ghenghis/hermes-agent"
  "Ghenghis/hermes.daveai.tech"
  "Ghenghis/contract-kit-v17"
  "Ghenghis/PixelClaw"
)

for repo in "${REPOS[@]}"; do
  if [[ "$repo" == "Ghenghis/contract-kit-v17" ]]; then
    INPUT=ruleset.contract-kit.json
  else
    INPUT=ruleset.json
  fi

  RESP=$(gh api "repos/$repo/rulesets" --method POST --input "$INPUT" -i 2>&1) || true
  STATUS=$(printf '%s' "$RESP" | head -1 | awk '{print $2}')
  ID=$(printf '%s' "$RESP" | tail -1 | jq -r '.id // empty' 2>/dev/null || echo "")

  case "$STATUS" in
    201) NOTE="applied" ;;
    422) NOTE="exists — try PUT to update" ;;
    403) NOTE="BLOCKER: not admin on $repo" ;;
    404) NOTE="BLOCKER: repo missing or no read access" ;;
    *)   NOTE="unexpected: $STATUS" ;;
  esac
  echo "| $repo | $STATUS | $ID | $NOTE |" >> "$LOG"
done

echo "" >> "$LOG"
echo "Done. Review $LOG and resolve every BLOCKER row before claiming the ecosystem is protected." >> "$LOG"
```

The script never deletes anything, never disables existing rules, and produces a machine-readable evidence row per repo. Failure rows are not fatal — they are surfaced as blockers and the next iteration re-runs them after the auth/permission issue is resolved.

## Forks-of-forks edge case

Several origins above (`Ghenghis/kilocode`, `AiDave71/kilocode`, `Ghenghis/kilocode-RVC`, `Ghenghis/Kilocode-Azure`, `Ghenghis/kilocode-7.2.4`) are forks of `Kilo-Org/kilocode`. The protection rule does **not** concern itself with pushing back to upstream — fork users typically cannot push to `Kilo-Org` anyway. The rule exists because:

- Force-pushing the fork's `main` rewrites history that downstream extraction branches were cut from. Any `git rebase --onto fork/main` afterward in a working clone will produce silent merge-base drift.
- The fork's `main` is the contract that the safe-sync procedure in doc 08 depends on. If `main` can be force-pushed, `git reset --hard upstream/main` followed by `git push origin main` on a sibling clone can clobber the fork's recorded sync point and erase the audit trail.
- Forks inherit the `~DEFAULT_BRANCH` semantics — if the fork's default is `main`, the ruleset locks `main`, regardless of what `Kilo-Org/kilocode`'s default is. Apply the rule to every fork's default branch independently.

## Failure modes

- **`422 Unprocessable Entity` — "ruleset already exists"**: a rule with the same `name` is already attached. Update with PUT instead of POST:

  ```bash
  RULESET_ID=$(gh api repos/<owner>/<repo>/rulesets --jq '.[] | select(.name=="v3-default-branch-lockdown") | .id')
  gh api repos/<owner>/<repo>/rulesets/$RULESET_ID --method PUT --input ruleset.json
  ```

- **`403 Forbidden` — "must be repo admin"**: your `gh` login is not admin on the target. Record in `<EVIDENCE_ROOT>/github_protection_apply.md` as `BLOCKER: not admin on <owner>/<repo>`. Either re-auth as the owner (`gh auth switch -u <owner>`) or escalate. Do not retry blindly.

- **Repo without an upstream remote**: irrelevant. Rulesets concern the repo's own default branch, not its `upstream` remote. Apply normally.

- **Empty repo (no commits, e.g. `hermes.daveai.tech-new`)**: a ruleset can be created, but `~DEFAULT_BRANCH` resolves to nothing because the default branch ref does not exist yet. The POST will succeed but the rule has no effect. Defer protection to first-commit: add the ruleset apply step to the first-commit checklist for that repo, and record `DEFERRED: no commits yet` in the evidence log.

- **Branch name with slashes (`integration/main`)**: GitHub accepts `refs/heads/integration/main` literally. Do not URL-encode the slash. The ruleset matches it as written.

- **Signature requirement breaks contributors**: if `required_signatures` blocks legitimate work because contributors lack signing keys, drop that rule from the ruleset rather than disabling enforcement. Re-apply via PUT.

## Cross-references

- `08_MAIN_MASTER_PROTECTION_AND_SYNC_PROTOCOL.md` — the local pre-push hook, sync procedure, and the high-level checklist this doc operationalizes.
- `12_ROLLBACK_AND_DISASTER_RECOVERY.md` — what to do when a force-push or destructive merge slipped through before protection was applied.
- `16_ECOSYSTEM_REPO_MANIFEST.md` — the manifest that records, per repo, whether GitHub-side protection was confirmed, deferred, or blocked, with the evidence path.
