# 28 — Operator Command Order (Canonical Run Sequence)

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.

> READ THIS FIRST. This is the **only** sequence sanctioned for executing the V3 contract end-to-end. Do not start at any later step. Do not skip gates. Do not run write-side scripts before read-side gates have passed and the operator has signed off.

## Purpose

The other docs (00-27) describe **what** to do; this doc tells you **in what order**. The contract has hard gates between phases: a write-side step that runs without its preceding read-side gate is a contract violation.

This doc is also the **operator-runbook** that an external auditor would follow to verify the run was performed correctly.

## How to use

1. Start at Step 1.
2. Each step lists: prerequisites, action, success criteria, evidence captured, "STOP & ASK" conditions, and the next step on PASS.
3. Stop and surface the result to the operator at every **GATE** marker. Do not proceed past a gate without explicit operator OK.
4. If any step fails, jump to doc 24 (Failure Mode Library) and apply the matching `Fx.y` recovery before resuming.

---

## Step 1 — Operator orientation (READ-ONLY, no commands)

**Prerequisites**: none.
**Action**: Operator + executing agent both read these docs in this order:
1. `00_READ_ME_FIRST_OPERATOR_VERDICT.md` (the verdict + scope)
2. `01_MASTER_PROMPT_FOR_CLAUDE_CODE.md` (the absolute rule)
3. `02_20_AGENT_ASSIGNMENT_MAP.md` (roles)
4. `03_PHASE_ROADMAP_NO_GAPS.md` (the 9 phases)
5. **This doc (`28_OPERATOR_COMMAND_ORDER.md`)**
6. `16_ECOSYSTEM_REPO_MANIFEST.md` (concrete repo identities)
7. `29_NAMING_CONVENTION_CANONICAL.md` (canonical branch naming)
8. `30_ZEROCLAW_SCOPE_RESOLUTION.md` (ZeroClaw multi-repo answer)
9. `INDEX.md` (cross-reference between all docs)

**Success**: Operator confirms in chat / signed note that they have read all nine.
**Evidence**: `<EVIDENCE_ROOT>/00_orientation_signoff.md` with operator signature line.
**STOP & ASK if**: any doc is missing, internally contradictory, or the operator does not understand a section.
**Next**: Step 2.

---

## Step 2 — Phase 0 read-only discovery

**Prerequisites**: Step 1 PASS.
**Action**: Run discovery commands per `19_PER_REPO_COMMAND_PLAYBOOK.md` Phase 0 block for every repo in the manifest (doc 16). Aggregate output via `25_EVIDENCE_LEDGER_AUTOMATION.md` `populate_ledgers.sh` script.

```bash
# 2a. Set evidence root (UTC date)
export EVIDENCE_ROOT="G:/Github/_repo_rescue_evidence/$(date -u +%Y-%m-%d)"
mkdir -p "$EVIDENCE_ROOT"/{mirrors,bundles,raw_per_repo,scripts,blockers,canonicalization,incidents,agents}

# 2b. Default-branch audit (doc 21)
bash audit-default-branches.sh > "$EVIDENCE_ROOT/default-branch-audit.txt"

# 2c. Per-repo Phase 0 ledger population (read-only)
bash populate_ledgers.sh "$EVIDENCE_ROOT" \
  G:/Github/kilocode-Azure2 \
  G:/Github/open-webui-current \
  G:/Github/hermes-agent-fresh \
  G:/Github/contract-kit-v17 \
  G:/Github/PixelClaw \
  G:/Github/hermes.daveai.tech \
  G:/Github/kilocode \
  G:/Github/kilocode-Azure \
  G:/Github/kilocode-7.2.4
```

**Success**: `<EVIDENCE_ROOT>/repo_inventory.md` and `<EVIDENCE_ROOT>/upstream_remote_proof.md` exist with one section per repo. `default-branch-audit.txt` is non-empty.
**Evidence**: above three files plus `<EVIDENCE_ROOT>/raw_per_repo/<repo>/<UTC>/...` snapshots.
**STOP & ASK if**: any repo from manifest doc 16 is missing from the ledger; any repo has unrecognized origin/upstream; any repo is dirty in an unexplained way.
**Next**: Step 3 (GATE).

### GATE A — Phase 0 Operator Sign-Off

The operator reviews `<EVIDENCE_ROOT>/repo_inventory.md` and writes:
```md
GATE A acknowledged. Phase 0 inventory accepted as truth for run <UTC date>.
Operator: <name>  Date: <UTC>
```
in `<EVIDENCE_ROOT>/00_GATE_A_signoff.md`. **No write commands run before this file exists.**

---

## Step 3 — Phase 1 backups (parallel, read-from-source-only)

**Prerequisites**: GATE A signed.
**Action**: For each in-scope repo, dispatch A03 Backup Officer (or run inline):

```bash
# 3a. Per-repo: mirror, bundle, working-tree archive (doc 19 Phase 1 commands)
# Run in background, parallel-safe — see doc 22 §"Pattern: Phase 1 backups in parallel"

# 3b. Verify with restore-test (doc 25)
bash populate_backup_log.sh "$EVIDENCE_ROOT" --restore-test
```

**Success**: `<EVIDENCE_ROOT>/backup_restore_proof.md` shows `Restore-test: PASS` for every in-scope repo. SHA256 hashes match across runs.
**Evidence**: `<EVIDENCE_ROOT>/mirrors/<repo>.mirror.git/`, `<EVIDENCE_ROOT>/bundles/<repo>.bundle`, `<EVIDENCE_ROOT>/<repo>.worktree.tar.gz`, `<EVIDENCE_ROOT>/SHA256SUMS.txt`, `<EVIDENCE_ROOT>/backup_restore_proof.md`.
**STOP & ASK if**: any repo's restore-test FAILs (apply F1.4 / F1.1 from doc 24); disk fills (F1.5); a backup completed but restore HEAD ≠ source HEAD.
**Next**: Step 4 (GATE).

### GATE B — Phase 1 Operator Sign-Off

Operator writes to `<EVIDENCE_ROOT>/01_GATE_B_signoff.md`:
```md
GATE B acknowledged. Phase 1 backups + restore-test PASS for all in-scope repos.
SHA256SUMS file: <path>
Operator: <name>  Date: <UTC>
```
**No mutation commands (resets, hooks affecting refs, branch deletes) run before GATE B.**

---

## Step 4 — Install branch protection (local hooks + GitHub-side)

**Prerequisites**: GATE B signed.
**Action**:
```bash
# 4a. Install local pre-push hooks across every repo (doc 17)
bash install_branch_protection.sh

# 4b. Apply GitHub-side rulesets (doc 18)
bash apply_github_protection.sh
```

**Success**:
- Every in-scope repo has `.git/hooks/pre-push` (sha256 recorded) + `.git/hooks-config/protected-branches`.
- `<EVIDENCE_ROOT>/hook_install_log.md` shows smoke-test PASS for every repo.
- `<EVIDENCE_ROOT>/github_protection_apply.md` shows HTTP 201 (or PUT-update) for every reachable repo. 403 entries explicitly logged as BLOCKER.

**Evidence**: above two files.
**STOP & ASK if**: any smoke-test FAIL (hook failed to reject protected push); any 403 BLOCKER (operator must escalate auth before continuing); core.hooksPath redirect detected (manual review).
**Next**: Step 5.

---

## Step 5 — Phase 2 upstream truth

**Prerequisites**: GATE B signed; protection installed (Step 4).
**Action**: Per repo, dispatch A05 Upstream Analyst OR run doc 19 Phase 2 commands. For repos lacking `upstream` (open-webui-current, hermes-agent-fresh, contract-kit-v17), apply F2.1 from doc 24 (infer or BLOCKED).

**Success**: `<EVIDENCE_ROOT>/upstream_remote_proof.md` and per-repo divergence reports under `<EVIDENCE_ROOT>/upstream/divergence-<repo>.md` exist.
**Evidence**: above + any blockers in `<EVIDENCE_ROOT>/blockers/F2.*_<repo>.md`.
**STOP & ASK if**: any repo's upstream is unreachable AND no inference candidate exists; any repo's divergence vs upstream exceeds 500 commits (review needed).
**Next**: Step 6.

---

## Step 6 — Phase 3 contamination inventory

**Prerequisites**: Step 5 PASS.
**Action**: Per doc 19 Phase 3. Use F3.1 cherry-mark technique to separate already-upstream commits from local-only.

**Success**: `<EVIDENCE_ROOT>/<repo>/phase3/files-diff.txt`, `local-only-commits.txt`, `dep-changes.diff` exist for every in-scope repo.
**Next**: Step 7.

---

## Step 7 — Phase 4 feature fingerprinting (dispatch A06)

**Prerequisites**: Step 6 PASS.
**Action**: Dispatch A06 Feature Fingerprinter per `26_TWENTY_AGENT_DISPATCH_TEMPLATES.md`. A06 emits feature cards under `<EVIDENCE_ROOT>/feature-cards/<REPO_NAME>-FC-NN.md`. Branch names in cards MUST follow doc 29 canonical convention.

For each card, also dispatch A09 Dependency Mapper (parallel) → emits `<EVIDENCE_ROOT>/dependency-graph/<FC-id>.md`.

**Success**: every local-only commit appears in exactly one feature card (per A06 contract). Cross-repo feature matrix entry exists for any card touching multiple repos (doc 10).
**Evidence**: `<EVIDENCE_ROOT>/feature-cards/`, `<EVIDENCE_ROOT>/dependency-graph/`.
**STOP & ASK if**: A06 returns >0 UNCLASSIFIED-*-99 cards (need re-fingerprint); cross-repo matrix incomplete.
**Next**: Step 8 (GATE).

### GATE C — Feature Card Operator Sign-Off

Operator reviews each feature card and writes to `<EVIDENCE_ROOT>/04_GATE_C_signoff.md`:
```md
GATE C: Feature card set frozen for this run.
Cards: <list of <FC-id>: <branch-name>>
Operator: <name>  Date: <UTC>
```
**No branch-extraction commands run before GATE C.**

---

## Step 8 — Phase 5-6 extraction (per-card quorum)

**Prerequisites**: GATE C signed.
**Action**: For EACH feature card, dispatch the FIVE-AGENT QUORUM (foreground, parallel):

| Role | Agent | Returns |
|---|---|---|
| Owner | A08 | Plan + commands |
| Verifier | A06 (re-check) OR A16 (build/test) | PASS / FAIL |
| Challenger | A20 | REJECT / ACCEPT_WITH_CONCERNS / ACCEPT |
| Security | A15 | CLEAN / HITS_FOUND |
| Git Safety | A02 | APPROVE / REJECT |

**Acceptance rule**: All 5 PASS → parent (A01) executes A08's commands. Any single FAIL → BLOCKED, route to recovery (doc 24 F5.x / F6.x).

After successful extraction, run `record_branch.sh` (doc 25) to log the branch's provenance.

**Success**: `<EVIDENCE_ROOT>/branch_creation_log.md` has one entry per card; security_scan_log.md has CLEAN entry per branch; build_test_results/<branch>.txt = PASS.
**Evidence**: above + `<EVIDENCE_ROOT>/agents/<agent-id>/<UTC>.md` per dispatch.
**Next**: Step 9.

---

## Step 9 — Phase 7 sync main/master (HIGHLY GATED)

**Prerequisites**: Step 8 PASS for ALL feature cards in scope.
**Action**: For EACH repo, in this exact order:
1. Verify Phase 1 backup proof still exists (re-hash mirror + bundle).
2. Verify `git status --porcelain` is empty (F7.1 if not).
3. Verify all local-only commits are now on feature branches (cross-check with branch_creation_log).
4. **STOP** — request explicit operator approval per repo.
5. Once approved: `git fetch upstream --prune; git checkout <default>; git reset --hard upstream/<default>`.
6. **DO NOT push** unless operator explicitly approves the fork-mirror push.
7. Record sync proof.

### GATE D — Per-Repo Phase 7 Approval

Per repo, operator writes to `<EVIDENCE_ROOT>/07_GATE_D_<repo>_signoff.md`:
```md
GATE D: Phase 7 sync approved for <repo>.
- Backup re-verified: SHA256 match
- Working tree clean: yes
- All local commits captured on feature branches: yes
- Push to fork main: <yes/no>
Operator: <name>  Date: <UTC>
```

**Next**: Step 10.

---

## Step 10 — Phase 8 cross-repo validation

**Prerequisites**: Step 9 PASS for all repos in scope.
**Action**: Dispatch A10/A11/A12/A13/A14 specialists per repo + A16 Build/Test Runner per branch. A14 runs the cross-repo Hub API contract test.

**Success**: `<EVIDENCE_ROOT>/validation/<repo>-<branch>.md` PASS for every branch; A14 returns MATCHED for every Hub API consumer pair.
**Next**: Step 11.

---

## Step 11 — Phase 9 release branch assembly (operator-driven)

**Prerequisites**: Step 10 PASS.
**Action**: Dispatch A18 Release Planner. A18 returns release-branch composition. Operator decides which features ship in this release. Parent assembles release branches per `11_RELEASE_BRANCH_ASSEMBLY_PROTOCOL.md`.

For each release artifact, follow `23_RELEASE_PROVENANCE_AND_AUTO_UPDATE.md`: built only from `release/*` branch, signed tag, SLSA attestation.

**Next**: Step 12.

---

## Step 12 — Final verdict

**Prerequisites**: Steps 1-11 PASS.
**Action**:
```bash
bash assemble_final_verdict.sh "$EVIDENCE_ROOT"
```
Dispatch A19 Documentation Auditor → confirms ledgers complete.

**Success**: `<EVIDENCE_ROOT>/final_verdict.md` shows `Overall: PASS` and A19 returns COMPLETE.

### GATE Z — Run Closure

Operator writes to `<EVIDENCE_ROOT>/Z_FINAL_signoff.md`:
```md
Run closed for <UTC date>.
Verdict: PASS / BLOCKED / FAIL
Branches created: <count>
Branches blocked: <count + reasons>
Operator: <name>  Date: <UTC>
```

---

## Quick reference — flat command sequence

```bash
# === STEP 1: Read 9 docs (no commands)

# === STEP 2: Phase 0 discovery (READ-ONLY)
export EVIDENCE_ROOT="G:/Github/_repo_rescue_evidence/$(date -u +%Y-%m-%d)"
mkdir -p "$EVIDENCE_ROOT"/{mirrors,bundles,raw_per_repo,scripts,blockers,canonicalization,incidents,agents,feature-cards,dependency-graph,validation,upstream}
bash audit-default-branches.sh > "$EVIDENCE_ROOT/default-branch-audit.txt"
bash populate_ledgers.sh "$EVIDENCE_ROOT" <repo paths>
# >>> GATE A operator sign-off <<<

# === STEP 3: Phase 1 backups (writes ONLY to $EVIDENCE_ROOT)
# Per-repo mirror+bundle+tarball (parallel, doc 22)
bash populate_backup_log.sh "$EVIDENCE_ROOT" --restore-test
# >>> GATE B operator sign-off <<<

# === STEP 4: Branch protection
bash install_branch_protection.sh
bash apply_github_protection.sh

# === STEP 5: Phase 2 upstream truth (per-repo from doc 19)
# === STEP 6: Phase 3 contamination inventory
# === STEP 7: Phase 4 fingerprinting (dispatch A06 + A09)
# >>> GATE C operator sign-off <<<

# === STEP 8: Phase 5-6 extraction (5-agent quorum per card)

# === STEP 9: Phase 7 sync (per-repo)
# >>> GATE D per-repo operator sign-off <<<

# === STEP 10: Phase 8 cross-repo validation (A10-A14, A16)

# === STEP 11: Phase 9 release assembly (A18)

# === STEP 12: Final verdict
bash assemble_final_verdict.sh "$EVIDENCE_ROOT"
# >>> GATE Z operator sign-off <<<
```

---

## What this doc replaces

Where docs 03 / 04 / 05 / 06 were ambiguous about ordering, **this doc is canonical**. If any other doc instructs running a step that this doc places later, **this doc wins**.

## What this doc does NOT do

- Does not replace per-phase content of docs 03-15. Those describe **what** the phase contains; this doc tells you **when** to run it.
- Does not replace the FAILURE MODE LIBRARY (doc 24). When a step fails, jump there.
- Does not replace per-repo specifics (doc 19). The flat sequence above references the playbook for repo-specific commands.

## Cross-references

- `00`–`15`: V3 contract core.
- `16`: ecosystem manifest (paths consumed at every step).
- `17`–`18`: branch-protection installers.
- `19`: per-repo concrete commands.
- `21`: non-standard default branches.
- `22`: worktree/sub-agent constraints.
- `24`: failure mode library (when steps fail).
- `25`: ledger automation scripts.
- `26`: 20-agent dispatch templates.
- `29`: canonical branch naming.
- `30`: ZeroClaw scope resolution.
