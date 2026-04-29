# Failure Mode Library

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.

## Purpose

V3 docs 03 / 06 / 07 / 11 describe the happy path. Doc 12 describes generic disaster recovery. This doc fills the gap between them: a per-failure-mode lookup table for every realistic thing that can go wrong during Phases 0-9, with concrete diagnosis commands, recovery procedures, evidence to capture, and severity classification.

## How to use

1. A phase step fails or produces an unexpected result.
2. Identify which phase you were in (Phase 0-9) and what the symptom is.
3. Find the matching `Fx.y` entry below.
4. Run the **Diagnosis** commands to confirm.
5. Execute the **Recovery** procedure exactly as written. Do not improvise.
6. Capture **Evidence** items into `<EVIDENCE_ROOT>/incidents/Fx.y_<repo>_<UTC-timestamp>/`.
7. Apply **Severity**: CRITICAL halts everything; HIGH halts the affected repo; MEDIUM marks BLOCKED + continues other repos; LOW is a fix-in-place warning.
8. If no entry matches, treat as CRITICAL and stop. Do not invent recovery.

Each entry: Symptom / Cause / Diagnosis / Recovery / Evidence / Severity.

---

## Phase 0 — Freeze and preserve

### F0.1 — Repo path is not a git repo
- **Symptom**: `git -C <path> rev-parse --git-dir` errors with `fatal: not a git repository`. Affects `kilocode-7.2.3`, `hermes-agent`, `Claw-Clean-Room`, etc.
- **Cause**: Snapshot dir, ZIP extraction, or staging copy that was never `git init`-ed.
- **Diagnosis**: `git -C <path> rev-parse --git-dir`; `ls -la <path>/.git`; `find <path> -maxdepth 2 -name ".git"`.
- **Recovery**: DO NOT `git init`. Record path in `<EVIDENCE_ROOT>/blockers/F0.1_<name>.md`. Mark non-repo in manifest. Skip Phases 1-9 for this path.
- **Evidence**: dir listing, file count, total size, `rev-parse` output.
- **Severity**: MEDIUM.

### F0.2 — Two repos have identical HEAD
- **Symptom**: e.g. `open-webui` vs `open-webui-current` report identical SHA.
- **Cause**: Duplicate clone.
- **Diagnosis**: `git -C <A> rev-parse HEAD`; same on B; `stat -c '%Y' <A> <B>` for mtime.
- **Recovery**: Most-recent mtime wins canonical; rename other to `<name>.READONLY_MIRROR/`. Record in `<EVIDENCE_ROOT>/canonicalization/`.
- **Severity**: MEDIUM.

### F0.3 — Repo has nested .git inside (not a registered submodule)
- **Symptom**: `find <repo> -name .git -type d` returns >1 result; `git submodule status` empty.
- **Cause**: Legacy nested clone or rescue copy dropped inside a working tree.
- **Recovery**: Catalog each nested `.git` separately. Phase 1 backups independent for each.
- **Severity**: MEDIUM.

---

## Phase 1 — Backup before mutation

### F1.1 — Mirror clone fails with "object missing"
- **Symptom**: `git clone --mirror` errors with `fatal: object <sha> missing`.
- **Cause**: Source object store corrupt — packfile damage.
- **Diagnosis**: `git -C <repo> fsck --full --no-dangling`; `git count-objects -v`.
- **Recovery**: If bundle succeeds → bundle is primary. If both fail → escalate to F1.2.
- **Severity**: HIGH.

### F1.2 — Bundle creation fails with packfile corruption
- **Recovery**: Fresh clone from origin into `<tmp>/<repo>_fresh`; mirror+bundle from the fresh clone. Original is now flagged "corrupt local — do not extract from".
- **Severity**: HIGH.

### F1.3 — Working tree archive too large (>10GB)
- **Cause**: `node_modules/`, `.venv/`, `dist/`, model weights, etc.
- **Recovery**: Generate TWO records: smaller archive with heavy dirs excluded + `full_size.log` listing them. Excludes default: `node_modules .venv venv .next dist build target .cache __pycache__ .pytest_cache coverage`.
- **Severity**: LOW.

### F1.4 — Restore test HEAD does not match original
- **Recovery**: `git pack-refs --all` in source; recreate mirror; re-run restore. If still mismatched → escalate to F1.1.
- **Severity**: HIGH.

### F1.5 — Disk full during backup
- **Recovery**: Pause; `df -h <EVIDENCE_ROOT>`; reclaim from prior `_repo_rescue_evidence/<old-date>/` only with operator approval; resume from scratch (don't append).
- **Severity**: HIGH.

### F1.6 — Backup failed for one repo, succeeded for others
- **Recovery**: Failed repo halts at Phase 2 gate. Others may proceed. Cross-repo features pause until all participants reach the same phase.
- **Severity**: MEDIUM (kit), HIGH (failed repo).

---

## Phase 2 — Remote and upstream truth

### F2.1 — `upstream` remote not configured
- **Affects**: `open-webui-current`, `hermes-agent-fresh`, `hermes.daveai.tech`, `contract-kit-v17`.
- **Recovery**: Try inference (`gh repo view <origin> --json parent`, README, `repository` field). If inferable → `git remote add upstream <url>` (read-only fetch). If not → BLOCKED in `<EVIDENCE_ROOT>/blockers/F2.1_<repo>.md`. Greenfield repos: explicitly record `upstream: NONE (greenfield)` and compare against `origin/<default>` only.
- **Severity**: MEDIUM.

### F2.2 — `git fetch upstream` returns 404
- **Recovery**: Search snapshot repos (e.g. `kilocode-7.2.4`) for last-known-good upstream commit; record explicitly: `divergence base: snapshot <name> @ <sha> (upstream unreachable)`. Never silently substitute another URL.
- **Severity**: MEDIUM.

### F2.3 — `git fetch origin` returns 403
- **Recovery**: `gh auth refresh -h github.com -s repo,workflow,read:org`. SSH: re-add public key. **DO NOT** embed credentials in URL.
- **Severity**: MEDIUM.

### F2.4 — Default branch on origin renamed since last fetch
- **Recovery**: `git remote set-head origin -a`; update protected-branches config; update local hook (doc 17); re-target affected feature cards.
- **Severity**: MEDIUM.

---

## Phase 3 — Main contamination inventory

### F3.1 — Local default has both upstream-cherry-picks AND original local commits, indistinguishable
- **Recovery**: `git log --left-right --cherry-pick --oneline HEAD...upstream/main`. `=`-marked are already-upstream and must be excluded. `<`-marked are real contamination. Cross-check with `git patch-id`.
- **Severity**: LOW.

### F3.2 — Renamed/deleted files broke import paths
- **Recovery**: Don't treat rename as separate "chore" card. Include rename in whichever feature card depends on it (`depends-on-rename: <sha>`). If multiple cards import → rename moves into shared **prerequisite** card.
- **Severity**: LOW.

### F3.3 — Submodule pointer changed but submodule wasn't backed up
- **Recovery**: Pause Phase 3 work touching the submodule. Treat submodule as own repo: Phase 0 + Phase 1 against it. Resume parent only after submodule backup verified.
- **Severity**: HIGH.

---

## Phase 4 — Feature fingerprinting

### F4.1 — Single commit touches 5 unrelated areas
- **Recovery**: Generate per-area patch via `git show <sha> -- <area>`. Each patch becomes input to its own feature branch. Each card records `provenance: split-from-<sha>`. Verify reconstruction (union of patches = original diff).
- **Severity**: LOW.

### F4.2 — Feature partially upstream-merged but partially local
- **Recovery**: Card declares `partial-upstream: true`. Only local-only subset is extracted. Base is `upstream/main` (already contains upstream subset).
- **Severity**: LOW.

### F4.3 — Feature spans multiple repos with cross-imports
- **Recovery**: Cross-repo matrix entry (doc 10) is mandatory. `release_together: true`. Phase 8 builds both branches together. Don't proceed Phase 5 until matrix entry exists + operator confirms.
- **Severity**: MEDIUM (BLOCK extraction).

---

## Phase 5 — Branch naming + extraction planning

### F5.1 — Branch name collides with existing branch
- **Recovery**: Check abandonment (no PR, no commits in 90d). If abandoned: archive via `git tag archive/<existing>-$(date +%F) <existing>`. If active: append `-v2`. Never force-overwrite without operator+verifier approval.
- **Severity**: LOW.

### F5.2 — No naming convention discoverable
- **Recovery**: Use canonical convention from doc 29.
- **Severity**: LOW.

### F5.3 — Two feature cards naturally have the same branch name
- **Recovery**: Re-fingerprint. If actually one feature → merge cards. If distinct → add discriminator (e.g. `feature/auth-token-refresh-cookie` vs `-header`).
- **Severity**: LOW.

---

## Phase 6 — Branch extraction

### F6.1 — Cherry-pick produces conflict
- **Recovery**: Abort. Try Method B (patch via `git format-patch ... | git apply --3way`). If fails → Method D (manual replay). Never blindly accept one side.
- **Severity**: LOW.

### F6.2 — Build fails ONLY on extracted branch (passes on polluted main)
- **Recovery**: Identify missing dependency. Decide: include it OR declare cross-branch dep (doc 10).
- **Severity**: LOW.

### F6.3 — Test passes on branch but fails on main
- **Recovery**: STOP. Investigate. Two possibilities: (a) test was wrong on main → record `branch_fixes_main_regression: <sha>`; (b) branch silently dropped a needed change → re-run extraction. NEVER silently "fix" the test on the branch.
- **Severity**: MEDIUM.

### F6.4 — Extracted branch contains secrets
- **Recovery**: STOP. Halt all push activity. Rotate secret in provider dashboard immediately. Mark branch BLOCKED. History rewrite is a separate operation outside this contract requiring operator approval.
- **Severity**: CRITICAL.

### F6.5 — Lock file churn during extraction
- **Recovery**: Stash lockfile diff. Generate fresh lockfile from base + branch's `package.json`. Record `lockfile: regenerated`.
- **Severity**: LOW.

---

## Phase 7 — Clean main/master sync

### F7.1 — Local main not clean when starting sync
- **Recovery**: STOP. No reset until `git status --porcelain` empty. Tracked uncommitted → commit to feature branch or stash with descriptive message. Untracked → add to feature branch or move to evidence root.
- **Severity**: HIGH.

### F7.2 — `git reset --hard upstream/main` deleted untracked files
- **Recovery**: STOP all work on this repo. Restore from Phase 1 working-tree archive into side path. Diff to identify lost files. File incident report. Patch contract / hook before proceeding.
- **Severity**: CRITICAL.

### F7.3 — Push to fork's main rejected by hook
- **Recovery**: Verify the four upstream-mirror conditions: backup verified, local default == upstream, no local commits remain, operator approval. Then either temporarily disable hook (with operator co-signature) or skip push entirely (preferred).
- **Severity**: LOW (hook working as intended).

---

## Phase 8 — Cross-repo integration validation

### F8.1 — Cross-repo build matrix incomplete
- **Recovery**: Re-scan via doc 10. Add missing matrix entries. Retroactively run Phase 5-7 for sibling repos if not at Phase 8.
- **Severity**: MEDIUM (BLOCK release).

### F8.2 — Hub API contract test fails
- **Recovery**: Identify drift side. Card MUST cover both sides. `release_together: true`. Operator decides between (a) revert upstream side, (b) catch lagging side up, (c) patch contract test for transition.
- **Severity**: MEDIUM.

---

## Phase 9 — Release branch protocol

### F9.1 — Release branch merge conflict
- **Recovery**: Resolve on release branch ONLY. DO NOT amend feature branches. If structural incompatibility → operator decides which feature ships; defer the other.
- **Severity**: LOW.

### F9.2 — Release tag fails signature
- **Recovery**: Configure GPG/SSH signing. Verify with test signature. DO NOT skip signing. Halt release if signing infrastructure unavailable.
- **Severity**: MEDIUM.

### F9.3 — Tag pushed to main accidentally
- **Recovery**: Verify server-side `main` SHA == `upstream/main` SHA before operation. If main moved → CRITICAL F7.x-class incident. Use `git push origin refs/tags/<tag>` (explicit refspec) going forward.
- **Severity**: LOW (no real change) or CRITICAL (main actually moved → F7.2).

---

## Cross-phase

### FX.1 — Operator presses Ctrl+C mid-phase
- **Recovery**: State captured incrementally. Resume from last completed phase, not interrupted one. Verify no half-written artifacts; delete partials before resume.
- **Severity**: LOW.

### FX.2 — Disk full
- See **F1.5**.

### FX.3 — Network down
- **Recovery**: Pause fetch/push. Local-only ops can continue if needed remote refs already fetched. When network returns, `git fetch --dry-run origin` then resume.
- **Severity**: LOW (transient).

### FX.4 — Main checkout HEAD changed externally during the run
- **Recovery**: STOP all in-flight work. Re-run Phase 0 to re-baseline. Re-run Phase 1 backup. Decide whether prior work (3-6) is valid.
- **Severity**: HIGH.

### FX.5 — Sub-agent claims completion without proof
- **Recovery**: Reject claim. Record discrepancy in `<EVIDENCE_ROOT>/incidents/FX.5_<repo>_<UTC-timestamp>/`. Re-dispatch with stricter prompt requiring `cat <each-file>` output. Apply quorum rule (Owner + Verifier + Challenger).
- **Severity**: HIGH.

---

## Severity ladder

| Severity | Definition | Action |
|---|---|---|
| **CRITICAL** | Rule violation occurred or imminent. Push-to-main happened/would; secret committed and would publish; backup unrecoverable while mutation started. | Halt all repos. Restore. File incident. Operator co-signature to resume. |
| **HIGH** | Data loss possible for the affected repo. Backup failed; restore failed; working tree mutated externally; sub-agent claim unverifiable. | Halt the affected repo. Other repos may continue. |
| **MEDIUM** | Phase blocked, no data risk. Upstream unreachable; naming clash unresolved; cross-repo matrix incomplete; signing not configured. | Mark BLOCKED. Continue other repos. |
| **LOW** | Warning-only or expected friction. Lockfile churn; cherry-pick conflict; non-collision naming clash; Phase 9 merge conflict. | Fix in place. No halt. |

### Severity decision flow

| Question | Yes → | No → |
|---|---|---|
| Was the ABSOLUTE RULE violated, or is it about to be? | CRITICAL | next |
| Is data loss possible for this repo (backup gone, working tree mutated, restore failed)? | HIGH | next |
| Is the phase blocked but recoverable without data risk? | MEDIUM | LOW |

---

## Cross-references

- `04_BACKUP_AND_RESTORE_PROOF_PROTOCOL.md` — backup gate.
- `08_MAIN_MASTER_PROTECTION_AND_SYNC_PROTOCOL.md` — protection policy.
- `12_ROLLBACK_AND_DISASTER_RECOVERY.md` — generic recovery.
- `14_WHAT_WAS_MISSING_AND_HOW_V3_FIXES_IT.md` — V3 gap analysis. New failure modes added here should be reflected back into doc 14's gap table.
- `16_ECOSYSTEM_REPO_MANIFEST.md` — repo identity (which repo has which upstream).
- `17_PRE_PUSH_HOOK_INSTALLER.md` — local hook mechanics for F7.3.

When a failure escalates beyond this doc: this doc (Fx.y) → doc 12 (generic recovery) → doc 14 (gap analysis if a new mode emerges) → kit-level review.
