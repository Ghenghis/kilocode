# 37 — Operator Daily Runbook (Steady-State Operations)

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.

## Purpose

Docs 28 (command order) and 24 (failure modes) describe **what to do during a run**. This doc describes **what to do every day, every week, every month, every quarter** when no run is active — operator hygiene that keeps the kit honest between runs.

## How to use

1. Each section is a checklist scoped to a cadence (daily / weekly / monthly / quarterly).
2. Run top-to-bottom. Stop at first FAIL → §6 incident response.
3. Capture sign-off at the end of the day per §9.
4. Branch any fix work as `feat/<scope>-<short>` per doc 29.

---

## 1. Daily checklist (5–15 minutes)

### 1.1 Hub health
```bash
curl -fsS -o /dev/null -w "hub-health=%{http_code}\n" https://hub.daveai.tech/api/hub/health
# Expected: hub-health=200
```
- Non-200 / network / TLS error → §6.
- Log to `<EVIDENCE_ROOT>/daily/$(date -u +%Y-%m-%d)/health.log`.

### 1.2 Cloudflare uptime
- Open Cloudflare Analytics → Health Checks for `hub.daveai.tech` and `hermes.daveai.tech`.
- Confirm last-24h uptime ≥ 99.5%.
- Screenshot to `<EVIDENCE_ROOT>/daily/$(date -u +%Y-%m-%d)/cloudflare.png`.

### 1.3 Pre-push hook bypass log
```bash
for repo in \
  G:/Github/kilocode-Azure2 G:/Github/open-webui-current \
  G:/Github/hermes-agent-fresh G:/Github/contract-kit-v17 \
  G:/Github/PixelClaw G:/Github/hermes.daveai.tech \
  G:/Github/kilocode G:/Github/kilocode-Azure G:/Github/kilocode-7.2.4 ; do
  log="$repo/.git/hook-logs/pre-push-blocks.log"
  [ -f "$log" ] && grep -E "BYPASS" "$log" | tail -n 20
done
```
- Every BYPASS line should match a recorded operator audit entry with co-signature.
- Unexplained BYPASS → HIGH → §6.2.

### 1.4 GitHub Actions — last 24h
```bash
gh run list --limit 50 --json status,conclusion,name,headBranch,createdAt \
  | jq '[.[] | select(.createdAt > (now - 86400 | todate))] \
        | group_by(.conclusion) | map({(.[0].conclusion // "in_progress"): length}) | add'
```
- Any `failure`/`cancelled`/`timed_out` → classify (flake/real/config), file in `<EVIDENCE_ROOT>/daily/<date>/actions.md`.
- Repeated failures on same workflow → MEDIUM, freeze further pushes to that workflow's branch.

### 1.5 Default-branch push attempts
```bash
gh api repos/{owner}/{repo}/activity \
  --jq '.[] | select(.activity_type=="push") \
              | select(.ref=="refs/heads/main" or .ref=="refs/heads/master")' \
  | tee -a "<EVIDENCE_ROOT>/daily/$(date -u +%Y-%m-%d)/main-push-attempts.txt"
```
- Expected: empty.
- Any line where `actor` is operator → CRITICAL → §6.3.
- Refused attempts (HTTP 403) are healthy — record but do not escalate.

### 1.6 Disk free
```bash
df -h "$(dirname "$EVIDENCE_ROOT")"
# threshold: ≥ 20% free
```
- Below 20% → MEDIUM, schedule cold-storage rotation (§3).
- Below 5% → HIGH (will block next backup, doc 24 F1.5).

### 1.7 Daily sign-off
Append §9 sign-off to `<EVIDENCE_ROOT>/daily/$(date -u +%Y-%m-%d)/signoff.md`.

---

## 2. Weekly checklist (Mondays UTC)

### 2.1 Dependency-signature audits (doc 27)
```bash
npm audit signatures --json     > "<EVIDENCE_ROOT>/weekly/$(date -u +%G-W%V)/npm-audit-signatures.json"
pnpm audit --json               > "<EVIDENCE_ROOT>/weekly/$(date -u +%G-W%V)/pnpm-audit.json"
safety check --json             > "<EVIDENCE_ROOT>/weekly/$(date -u +%G-W%V)/safety.json"
cargo audit --json              > "<EVIDENCE_ROOT>/weekly/$(date -u +%G-W%V)/cargo-audit.json"
```
- `severity: high` or `signature_failure` → MEDIUM, open `feat/security-<advisory-id>` per doc 29.

### 2.2 GitHub branch-protection ruleset audit
```bash
gh api repos/{owner}/{repo}/rulesets --jq '.[] | {id,name,enforcement,target}' \
  > "<EVIDENCE_ROOT>/weekly/$(date -u +%G-W%V)/rulesets-<repo>.json"
diff "<EVIDENCE_ROOT>/baselines/rulesets-<repo>.json" \
     "<EVIDENCE_ROOT>/weekly/$(date -u +%G-W%V)/rulesets-<repo>.json"
```
- Drift (deleted rule, weakened bypass list, disabled enforcement) → HIGH → §6.4.

### 2.3 Hermes drift check (doc 20)
```bash
bash scripts/hermes-drift-check.sh \
  --hub https://hub.daveai.tech/api/hub/openapi.json \
  --local G:/Github/hermes-agent-fresh \
  > "<EVIDENCE_ROOT>/weekly/$(date -u +%G-W%V)/hermes-drift.md"
```
- Drift → MEDIUM, feature card per doc 20.

### 2.4 ZeroClaw adapter drift check (doc 30)
```bash
bash scripts/zeroclaw-adapter-drift.sh \
  > "<EVIDENCE_ROOT>/weekly/$(date -u +%G-W%V)/zeroclaw-adapter-drift.md"
```
- Drift → MEDIUM. `release_together: true` flag set → HIGH.

### 2.5 Backup-archive rotation (operator-approval gate)
```bash
find "$(dirname "$EVIDENCE_ROOT")/_repo_rescue_evidence" \
  -maxdepth 1 -type d -name '20*' -mtime +30 \
  | sort \
  > "<EVIDENCE_ROOT>/weekly/$(date -u +%G-W%V)/rotation-candidates.txt"
```
- Operator reviews, signs off in `<EVIDENCE_ROOT>/weekly/.../rotation-approval.md`, then archive (do not delete) per §3.4.
- DO NOT delete without sign-off. DO NOT auto-prune.

---

## 3. Monthly checklist (first UTC day)

### 3.1 Tier 4 full-history gitleaks (doc 27)
```bash
for repo in <every repo in doc 16 manifest>; do
  gitleaks detect --source "$repo" --log-opts="--all" \
    --report-path "<EVIDENCE_ROOT>/monthly/$(date -u +%Y-%m)/gitleaks-$(basename $repo).json"
done
```
- Any HIT → CRITICAL → §6.1.

### 3.2 Dependency tree review
```bash
npm ls --all --json    > "<EVIDENCE_ROOT>/monthly/$(date -u +%Y-%m)/npm-tree.json"
pnpm list -r --depth Infinity --json \
                       > "<EVIDENCE_ROOT>/monthly/$(date -u +%Y-%m)/pnpm-tree.json"
pip list --format=json > "<EVIDENCE_ROOT>/monthly/$(date -u +%Y-%m)/pip-tree.json"
cargo tree --format '{p} {l}' \
                       > "<EVIDENCE_ROOT>/monthly/$(date -u +%Y-%m)/cargo-tree.txt"
```
Diff against last month; investigate any package added without a feature card.

### 3.3 Action-pin SHA freshness
```bash
grep -RhE 'uses:\s+\S+@[a-f0-9]{40}' .github/workflows \
  | sort -u \
  > "<EVIDENCE_ROOT>/monthly/$(date -u +%Y-%m)/action-pins.txt"
```
- SHA points to yanked release or > 12mo stale → MEDIUM, `feat/actions-pin-refresh-<YYYY-MM>`.

### 3.4 VSIX manifest provenance audit (doc 23)
```bash
bash scripts/vsix-provenance-audit.sh \
  > "<EVIDENCE_ROOT>/monthly/$(date -u +%Y-%m)/vsix-provenance.md"
```
- Any artifact missing a step → HIGH, freeze auto-update channel.

### 3.5 Cold-storage rotation
After §2.5 operator approval:
```bash
rsync -a --remove-source-files \
  "$(dirname "$EVIDENCE_ROOT")/_repo_rescue_evidence/<old-date>/" \
  "<COLD_STORAGE_ROOT>/_repo_rescue_evidence/<old-date>/"
sha256sum "<COLD_STORAGE_ROOT>/_repo_rescue_evidence/<old-date>/"**/* \
  > "<COLD_STORAGE_ROOT>/_repo_rescue_evidence/<old-date>.SHA256SUMS.txt"
```
Verify checksums match original before removing source.

---

## 4. Quarterly checklist

### 4.1 SBOM diff vs prior quarter
```bash
syft packages dir:. -o spdx-json \
  > "<EVIDENCE_ROOT>/quarterly/$(date -u +%Y-Q%q)/sbom.spdx.json"
diff <(jq -S '.packages' "<EVIDENCE_ROOT>/quarterly/<prior>/sbom.spdx.json") \
     <(jq -S '.packages' "<EVIDENCE_ROOT>/quarterly/$(date -u +%Y-Q%q)/sbom.spdx.json")
```
Net-new top-level packages must each map to a feature card.

### 4.2 Manifest signing key rotation review
- Confirm signing key < 12 months old.
- Approaching expiry → generate next key, publish public half, update allowed-signer list, schedule overlap.
- Record fingerprints in `<EVIDENCE_ROOT>/quarterly/<Q>/keys.md`.

### 4.3 In-tree audit (doc 20)
```bash
bash scripts/in-tree-audit.sh \
  > "<EVIDENCE_ROOT>/quarterly/$(date -u +%Y-Q%q)/in-tree-audit.md"
```

### 4.4 Repo manifest re-verification (doc 16)
```bash
bash audit-default-branches.sh \
  > "<EVIDENCE_ROOT>/quarterly/$(date -u +%Y-Q%q)/manifest-recheck.txt"
diff <EVIDENCE_ROOT>/quarterly/<prior>/manifest-recheck.txt \
     <EVIDENCE_ROOT>/quarterly/$(date -u +%Y-Q%q)/manifest-recheck.txt
```
Any unexplained delta → MEDIUM, update doc 16, re-run §2.2.

---

## 6. Incident response

### 6.1 SECRET hit
- doc 24 **F6.4** + doc 27 incident report template.
- Halt all push activity for affected repo.
- Rotate credential at provider dashboard BEFORE any history rewrite.
- File `<EVIDENCE_ROOT>/incidents/F6.4_<repo>_<UTC>/`.

### 6.2 HOOK BYPASS (unexplained)
- Pull matching audit log line.
- If reason field empty or co-signature absent → HIGH.
- File `<EVIDENCE_ROOT>/incidents/HOOK_BYPASS_<repo>_<UTC>/`.

### 6.3 PROTECTION DRIFT
- doc 24 cross-references + doc 18.
- Re-apply: `bash apply_github_protection.sh <repo>`; confirm 200/201.
- Diff post-apply against `<EVIDENCE_ROOT>/baselines/rulesets-<repo>.json`.
- Drift caused by a person → require operator-signed RCA memo.

### 6.4 CRITICAL push to default detected
- Halt all repos (ABSOLUTE-RULE event).
- Snapshot remote default-branch SHA, capture push event, identify actor.
- Restore from Phase 1 backup if working tree changed (doc 24 F7.2).
- File at CRITICAL severity, operator co-signature mandatory before any further write.

---

## 7. Logs to retain

| Path | Retention | Notes |
|---|---|---|
| `<EVIDENCE_ROOT>/incidents/` | **forever** | Never auto-prune |
| `<EVIDENCE_ROOT>/daily/<date>/` | 90 days hot, then archive | |
| `<EVIDENCE_ROOT>/weekly/<YYYY-Www>/` | 1 year hot, then archive | |
| `<EVIDENCE_ROOT>/monthly/<YYYY-MM>/` | 2 years hot, then archive | |
| `<EVIDENCE_ROOT>/quarterly/<YYYY-Qn>/` | 5 years hot | |
| `<repo>/.git/hook-logs/pre-push-blocks.log` | **1 year** | Yearly rotation with operator sign-off |
| `<EVIDENCE_ROOT>/<old-date>/` | 30d hot, then cold-storage archive | Operator approval to rotate |
| `<EVIDENCE_ROOT>/baselines/` | forever | Reference snapshots |

---

## 8. Operator's "go-bag"

- **Backup mirrors**: `<EVIDENCE_ROOT>/mirrors/<repo>.mirror.git/`
- **Failure mode library**: `docs/Branches/24_FAILURE_MODE_LIBRARY.md`
- **Rollback recipes**: `docs/Branches/12_ROLLBACK_AND_DISASTER_RECOVERY.md`
- **Run sequence**: `docs/Branches/28_OPERATOR_COMMAND_ORDER.md`
- **Per-repo playbook**: `docs/Branches/19_PER_REPO_COMMAND_PLAYBOOK.md`
- **Ecosystem manifest**: `docs/Branches/16_ECOSYSTEM_REPO_MANIFEST.md`
- **Branch protection installers**: `scripts/install_branch_protection.sh`, `scripts/apply_github_protection.sh`
- **Evidence ledger automation**: `scripts/populate_ledgers.sh`, `populate_backup_log.sh`, `record_branch.sh`
- **Quick env**:
  ```bash
  export EVIDENCE_ROOT="G:/Github/_repo_rescue_evidence/$(date -u +%Y-%m-%d)"
  export COLD_STORAGE_ROOT="<set per site>"
  ```

---

## 9. Daily sign-off template

```
Daily ops 2026-MM-DD — clean / issues-found
Operator: <name>   Date: <UTC>
```

If `issues-found`:
```
Issues:
- <Fx.y or new-symptom>: <one-line summary> → <evidence path>
Follow-up branch(es): feat/<scope>-<short>
```

A day without sign-off is treated as **not run**.

---

## 10. Cross-references

- doc 04 — backup and restore proof — daily disk check (§1.6) protects this.
- doc 08 — main/master protection — daily push-attempts check (§1.5) verifies this.
- doc 10 — cross-repo feature matrix — weekly drift checks (§2.3, §2.4).
- doc 11 — release branch assembly — monthly VSIX provenance (§3.4).
- doc 12 — rollback and disaster recovery — go-bag (§8).
- doc 16 — ecosystem repo manifest — re-verified quarterly (§4.4).
- doc 17/18 — pre-push hook + GitHub protection — drift-checked weekly (§2.2), re-applied on incident (§6.3).
- doc 19 — per-repo command playbook.
- doc 20 — in-tree audit — weekly (§2.3, §2.4) and quarterly (§4.3).
- doc 23 — release provenance — monthly VSIX audit (§3.4).
- doc 24 — failure mode library — every incident routes through here.
- doc 27 — supply-chain audit — weekly (§2.1), monthly Tier 4 (§3.1), action-pin freshness (§3.3).
- doc 28 — operator command order — canonical run sequence (this is the non-run counterpart).
- doc 29 — canonical branch naming.
- doc 30 — ZeroClaw scope.
- doc 39 — incident runbook.
