# 38 — PR Template and CODEOWNERS

> ABSOLUTE RULE: Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master`. `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.

Canonical, copy-pasteable specification for the PR template, `CODEOWNERS`, issue templates, label set, and review behaviors that every repo in the ecosystem must apply. Composes:

- doc 06 — Feature Card schema
- doc 10 — Cross-Repo Link Discipline
- doc 18 — GitHub Branch Protection
- doc 20 — In-Tree Service Map
- doc 23 — Release Channel and Auto-Update
- doc 27 — Secrets and Supply Chain Hardening
- doc 29 — Canonical Branch Naming

If any other doc disagrees with this on PR-template field shape, label set, or CODEOWNERS path matching, **this doc wins**.

---

## 1. Required PR template fields

| # | Field | Required? | Source | Validates against |
|---|---|---|---|---|
| 1 | Feature card ID + link | Always | doc 06 | `<EVIDENCE_ROOT>/feature-cards/<id>.md` exists |
| 2 | Branch name | Always | doc 29 | Must match canonical regex |
| 3 | In-tree service touched | If any | doc 20 | Must list each `packages/.../services/<service>/` path |
| 4 | Cross-repo links | If any | doc 10 | Must point to sibling-repo PR or feature-card cross-link |
| 5 | Lockfile changes | Always (yes/no + justification) | doc 27 | "yes" allowed only on `chore/...-deps-...` cards |
| 6 | Workflow file changes | Always (yes/no) | doc 27 | "yes" forces CODEOWNERS gate |
| 7 | Secret scan tier + result | Always | doc 27 | Tier 1 minimum |
| 8 | Build/test gates: PASS/FAIL | Always | doc 09 | Each gate from feature card's `Validation commands` |
| 9 | Rollback method | Always (verbatim) | doc 06 | Copy from feature card verbatim |
| 10 | Owner / Verifier / Challenger sub-agent IDs | Always | doc 26 | Three distinct IDs |

Empty-on-purpose allowed only for fields 3 and 4 (write `none`, do not delete the field).

---

## 2. `.github/pull_request_template.md` (paste verbatim into every repo)

```md
<!--
  Canonical PR template — see docs 38 / 06 / 18 / 27 / 29 of contract-kit-v17.
  DO NOT delete fields. If a field is not applicable, write "none" — do not omit.
-->

## Feature card

- **Feature card ID:** <!-- e.g. F-KILO-2026-04-27-001 -->
- **Feature card link:** <!-- absolute path or repo-relative link to <EVIDENCE_ROOT>/feature-cards/<id>.md -->

## Branch

- **Branch name:** <!-- bash validate_branch_name.sh "<branch>" must exit 0 -->
- **Base branch:** <!-- usually integration/main or main -->

## Scope

- **In-tree service(s) touched (doc 20):** <!-- e.g. packages/kilo-vscode/src/services/hermes/ ; or "none" -->
- **Cross-repo links (doc 10):** <!-- list sibling-repo PR URLs ; or "none" -->

## Supply-chain (doc 27)

- **Lockfile changes:** <!-- yes/no -->
  - **If yes — justification:** <!-- mandatory; reference a chore/...-deps-... card -->
- **Workflow file (.github/workflows/*) changes:** <!-- yes/no -->
  - **If yes:** security-reviewer CODEOWNERS approval REQUIRED.
- **Secret scan tier run + result:**
  - Tier 1: <!-- PASS / FAIL — paste git grep summary -->
  - Tier 2: <!-- PASS / FAIL / SKIPPED-NO-TOOL — paste gitleaks JSON path -->
  - Tier 3 (release/integration only): <!-- PASS / FAIL / N/A -->

## Validation gates (doc 09)

| Gate | Command | Result |
|---|---|---|
| build | <!-- e.g. bun run build --> | <!-- PASS/FAIL --> |
| test | <!-- e.g. bun test --> | <!-- PASS/FAIL --> |
| lint | <!-- e.g. bun run lint --> | <!-- PASS/FAIL --> |

If any gate is FAIL, this PR MUST stay in Draft.

## Rollback method (verbatim from feature card)

<!-- Copy verbatim. Do not paraphrase. Reviewers compare line-for-line. -->

## Sub-agent attribution (doc 26)

- **Owner:** <!-- e.g. A08 -->
- **Verifier:** <!-- e.g. A06 — must differ from Owner -->
- **Challenger:** <!-- e.g. A20 — must differ from Owner and Verifier -->

## Reviewer checklist

- [ ] Branch name matches doc 29 regex
- [ ] Feature card exists and matches branch
- [ ] No drive-by lockfile changes (or `chore/...-deps-...` card)
- [ ] No workflow changes (or security reviewer approved)
- [ ] Secret scan Tier 1 PASS attached
- [ ] Build/test/lint gates PASS
- [ ] Rollback method verbatim from card
- [ ] All review threads resolved
- [ ] Last push has been re-approved (doc 18 last-push approval rule)
```

---

## 3. Canonical `.github/CODEOWNERS` (baseline)

```codeowners
# Canonical baseline (doc 38). Per-repo overrides appended at bottom.
# Last match wins. Do NOT re-sort.

# 1. Default fallback
*                                       @daveai/maintainers

# 2. Per-language defaults
*.py                                    @daveai/backend-reviewers
*.pyi                                   @daveai/backend-reviewers
*.ts                                    @daveai/frontend-reviewers
*.tsx                                   @daveai/frontend-reviewers
*.js                                    @daveai/frontend-reviewers
*.jsx                                   @daveai/frontend-reviewers
*.svelte                                @daveai/frontend-reviewers
*.rs                                    @daveai/rust-reviewers
*.go                                    @daveai/backend-reviewers
*.sh                                    @daveai/devops-reviewers
*.ps1                                   @daveai/devops-reviewers
Dockerfile                              @daveai/devops-reviewers
docker-compose*.yml                     @daveai/devops-reviewers

# 3. Architect gate — contract docs
docs/Branches/*                         @daveai/architects
docs/Branches/**                        @daveai/architects

# 4. Security gate — workflows, lockfiles, CODEOWNERS itself (doc 27)
.github/workflows/*                     @daveai/security-reviewers
.github/workflows/**                    @daveai/security-reviewers
.github/CODEOWNERS                      @daveai/security-reviewers
.github/actions/**                      @daveai/security-reviewers

# Lockfiles
*lock*                                  @daveai/security-reviewers
package-lock.json                       @daveai/security-reviewers
pnpm-lock.yaml                          @daveai/security-reviewers
bun.lock                                @daveai/security-reviewers
bun.lockb                               @daveai/security-reviewers
yarn.lock                               @daveai/security-reviewers
poetry.lock                             @daveai/security-reviewers
Pipfile.lock                            @daveai/security-reviewers
Cargo.lock                              @daveai/security-reviewers
go.sum                                  @daveai/security-reviewers
requirements*.txt                       @daveai/security-reviewers

# 5. Per-repo overrides appended below this line by §4
```

---

## 4. Per-repo CODEOWNERS variations

### 4.1 `kilocode-Azure2`

```codeowners
packages/kilo-vscode/src/services/auto-update/**     @daveai/release-channel-reviewers
packages/kilo-vscode/src/services/hermes/**          @daveai/hermes-reviewers
packages/kilo-vscode/src/services/zeroclaw/**        @daveai/zeroclaw-reviewers
packages/kilo-vscode/src/services/routing/**         @daveai/routing-reviewers
packages/kilo-vscode/src/services/marketplace/**     @daveai/security-reviewers @daveai/marketplace-reviewers
packages/kilo-vscode/webview-ui/**                   @daveai/frontend-reviewers
packages/opencode/**                                 @daveai/upstream-reviewers
```

### 4.2 `open-webui-current`

```codeowners
backend/**                              @daveai/backend-reviewers
src/lib/**                              @daveai/frontend-reviewers
src/routes/**                           @daveai/frontend-reviewers
backend/open_webui/hub_bridge/**        @daveai/hub-bridge-reviewers @daveai/security-reviewers
pipelines/**                            @daveai/backend-reviewers
```

### 4.3 `hermes-agent-fresh`

```codeowners
src/orchestrator/**                     @daveai/hermes-reviewers
src/providers/**                        @daveai/hermes-reviewers @daveai/security-reviewers
src/runtime/**                          @daveai/hermes-reviewers
src/api/**                              @daveai/hermes-reviewers @daveai/api-reviewers
```

### 4.4 `contract-kit-v17`

```codeowners
docs/**                                 @daveai/architects
src/webui/hub/**                        @daveai/hub-reviewers
src/webui/hub/services/**               @daveai/hub-reviewers @daveai/devops-reviewers
src/hermes/**                           @daveai/hub-reviewers @daveai/hermes-reviewers
src/zeroclaw/**                         @daveai/hub-reviewers @daveai/zeroclaw-reviewers
src/blockchain_audit/**                 @daveai/security-reviewers @daveai/hub-reviewers
src/runtime/**                          @daveai/hub-reviewers
artifacts/**                            @daveai/architects
.claude/**                              @daveai/architects
```

### 4.5 ZeroClaw (post-promotion per doc 30)

```codeowners
zeroclawlabs/runtime/**                 @daveai/zeroclaw-reviewers
zeroclawlabs/apps/tauri/**              @daveai/zeroclaw-reviewers @daveai/desktop-reviewers
zeroclawlabs/crates/aardvark-sys/**     @daveai/zeroclaw-reviewers @daveai/security-reviewers
zeroclawlabs/crates/robot-kit/**        @daveai/zeroclaw-reviewers
Cargo.toml                              @daveai/zeroclaw-reviewers @daveai/security-reviewers
```

If a referenced team does not exist, the apply-script in doc 18 records `BLOCKER: missing team @daveai/<name>` and the team must be created before commit.

---

## 5. Required PR labels

| Label | Color | When |
|---|---|---|
| `feat` | `#0e8a16` | Mirrors `feat/` prefix |
| `fix` | `#d73a4a` | Mirrors `fix/` prefix |
| `chore` | `#fef2c0` | Mirrors `chore/` prefix |
| `docs` | `#0075ca` | Mirrors `docs/` prefix |
| `test` | `#bfdadc` | Mirrors `test/` prefix |
| `refactor` | `#cccccc` | Mirrors `refactor/` prefix |
| `perf` | `#ffd33d` | Mirrors `perf/` prefix |
| `integration` | `#5319e7` | Mirrors `integration/` prefix |
| `release` | `#1d76db` | `release/` prefix; triggers Tier 4 secret scan |
| `hotfix` | `#b60205` | `hotfix/` prefix; bypass under doc 18 emergency |
| `cross-repo` | `#7057ff` | Has cross-repo links (doc 10) |
| `deps` | `#ee0701` | REQUIRED on lockfile changes (doc 27) |
| `security` | `#000000` | Workflow files, CODEOWNERS, secrets, marketplace |

Bootstrap script:
```bash
gh label create feat        --color 0e8a16 --description "New feature work"
gh label create fix         --color d73a4a --description "Bug fix"
gh label create chore       --color fef2c0 --description "Maintenance"
gh label create docs        --color 0075ca --description "Docs-only"
gh label create test        --color bfdadc --description "Test additions/refactors"
gh label create refactor    --color cccccc --description "Pure refactor"
gh label create perf        --color ffd33d --description "Performance"
gh label create integration --color 5319e7 --description "Cross-repo integration"
gh label create release     --color 1d76db --description "Release branch"
gh label create hotfix      --color b60205 --description "Emergency patch"
gh label create cross-repo  --color 7057ff --description "Has cross-repo links (doc 10)"
gh label create deps        --color ee0701 --description "Dependency / lockfile change (doc 27)"
gh label create security    --color 000000 --description "Touches security boundary"
```

---

## 6. Required PR review behaviors

Enforced by doc 18 ruleset.

| Behavior | Effect |
|---|---|
| 1+ approving review | Cannot merge with zero approvals; author cannot self-approve |
| Stale-review dismissal on push | New commit dismisses prior approvals |
| Last-push approval required | Most recent push must be approved by someone other than the pusher |
| All review threads resolved | Every conversation marked Resolved before merge |
| Linear history | Merge commits forbidden; squash or rebase only |
| Signed commits | Each commit GPG/SSH-signed (may be relaxed per doc 18) |

CODEOWNERS review enforcement (`require_code_owner_review`) is currently disabled at ruleset level; CODEOWNERS still routes review requests automatically and the gate becomes mandatory only for paths flagged in §3.

---

## 7. Forbidden PR patterns

1. **Bypassing review with admin merge** outside the doc 18 emergency procedure.
2. **Merging a draft PR.**
3. **Merging with red status checks.**
4. **Drive-by lockfile mutation** without a `deps` label.
5. **Workflow file changes from a fork** that introduce doc 27 §"Workflow injection prevention" patterns.
6. **Self-approval via second account.**
7. **Force-push during review.**

---

## 8. `.github/ISSUE_TEMPLATE/*`

### 8.1 `feature_card.yml`

```yaml
name: Feature card (doc 06)
description: Open a new feature card. The branch will be cut from this card.
title: "[FEAT] <repo>: <feature summary>"
labels: ["feat"]
body:
  - type: input
    id: repo
    attributes:
      label: Repo
      description: Canonical repo name from doc 16
    validations: { required: true }
  - type: input
    id: feature_id
    attributes:
      label: Feature ID
      description: Format F-<REPO>-<YYYY-MM-DD>-<NNN>
    validations: { required: true }
  - type: input
    id: branch_name
    attributes:
      label: Branch name
      description: Must match doc 29 regex.
    validations: { required: true }
  - type: dropdown
    id: feature_type
    attributes:
      label: Feature type
      options: [feature, fix, chore, docs, integration, security]
    validations: { required: true }
  - type: textarea
    id: user_facing_purpose
    attributes: { label: User-facing purpose }
    validations: { required: true }
  - type: textarea
    id: files_expected
    attributes: { label: Files expected }
    validations: { required: true }
  - type: textarea
    id: commits_expected
    attributes: { label: Commits expected }
  - type: textarea
    id: dependencies
    attributes: { label: Dependencies }
  - type: textarea
    id: cross_repo_links
    attributes: { label: Cross-repo links (doc 10) }
  - type: dropdown
    id: extraction_method
    attributes:
      label: Extraction method (doc 06 ladder)
      options:
        - "A — Clean cherry-pick"
        - "B — Patch extraction"
        - "C — File checkout extraction"
        - "D — Manual replay"
        - "N/A — fresh feature"
    validations: { required: true }
  - type: textarea
    id: validation_commands
    attributes:
      label: Validation commands
      description: Per doc 09. Become "Validation gates" in PR.
    validations: { required: true }
  - type: textarea
    id: rollback_method
    attributes:
      label: Rollback method
      description: Copied verbatim into PR template.
    validations: { required: true }
  - type: input
    id: owner
    attributes: { label: "Owner (sub-agent ID, doc 26)" }
    validations: { required: true }
  - type: input
    id: verifier
    attributes: { label: "Verifier (sub-agent ID, doc 26)" }
    validations: { required: true }
  - type: input
    id: challenger
    attributes: { label: "Challenger (sub-agent ID, doc 26)" }
    validations: { required: true }
  - type: dropdown
    id: status
    attributes:
      label: Status
      options: [proposed, in-progress, in-review, merged, abandoned]
    validations: { required: true }
```

### 8.2 `bug.yml`

```yaml
name: Bug report
description: A defect in shipped code. For security bugs, use Security incident template.
title: "[BUG] <repo>: <one-line summary>"
labels: ["fix"]
body:
  - type: input
    id: repo
    attributes: { label: Repo }
    validations: { required: true }
  - type: input
    id: version
    attributes: { label: Version / commit SHA where reproduced }
    validations: { required: true }
  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
    validations: { required: true }
  - type: textarea
    id: expected
    attributes: { label: Expected behavior }
    validations: { required: true }
  - type: textarea
    id: actual
    attributes: { label: Actual behavior }
    validations: { required: true }
  - type: textarea
    id: logs
    attributes: { label: Logs / stack trace (REDACT secrets) }
  - type: dropdown
    id: severity
    attributes:
      label: Severity (doc 24 scale)
      options: [LOW, MEDIUM, HIGH, CRITICAL]
    validations: { required: true }
  - type: input
    id: owner
    attributes: { label: "Owner (sub-agent ID, doc 26)" }
    validations: { required: true }
```

### 8.3 `security_incident.yml`

```yaml
name: Security incident (doc 27)
description: Leaked credential, supply-chain compromise, or workflow-injection finding.
title: "[SEC] <YYYY-MM-DD> <repo>: <kind>"
labels: ["security"]
body:
  - type: markdown
    attributes:
      value: |
        > Do NOT paste the secret value. Paste only first 6 + last 4 chars.
  - type: input
    id: discovered_at
    attributes: { label: "Discovered at (UTC ISO-8601)" }
    validations: { required: true }
  - type: input
    id: reporter
    attributes: { label: Reporter }
    validations: { required: true }
  - type: dropdown
    id: mode
    attributes:
      label: Detection mode
      options: [gitleaks, grep, trufflehog, manual, external-report]
    validations: { required: true }
  - type: textarea
    id: scope_repos
    attributes: { label: "Scope — repos affected" }
    validations: { required: true }
  - type: textarea
    id: scope_files
    attributes: { label: "Scope — files affected" }
    validations: { required: true }
  - type: input
    id: first_leak_commit
    attributes: { label: "First-leak commit SHA" }
  - type: textarea
    id: credentials_affected
    attributes:
      label: Credentials affected
      description: |
        Provider | Type | First6+Last4 | Privilege | Auto-renewable
    validations: { required: true }
  - type: textarea
    id: rotation_status
    attributes: { label: Rotation status }
  - type: input
    id: incident_doc_link
    attributes:
      label: Link to artifacts/repo-sync/SECURITY_INCIDENT_<YYYY-MM-DD>_<KIND>.md
    validations: { required: true }
  - type: dropdown
    id: severity
    attributes:
      label: Severity (doc 24 scale)
      options: [LOW, MEDIUM, HIGH, CRITICAL]
    validations: { required: true }
```

### 8.4 `deps_update.yml`

```yaml
name: Deps update (doc 27)
description: Lockfile / dependency tree change.
title: "[DEPS] <repo>: <package(s)> bump"
labels: ["chore", "deps"]
body:
  - type: input
    id: repo
    attributes: { label: Repo }
    validations: { required: true }
  - type: input
    id: branch_name
    attributes:
      label: Branch name
      description: Must be chore/<scope>-<package>-deps-<purpose> per doc 29.
    validations: { required: true }
  - type: textarea
    id: packages_changed
    attributes:
      label: Packages changed
      description: name | from | to | reason (CVE / feature / pin-bump)
    validations: { required: true }
  - type: textarea
    id: lockfiles_touched
    attributes: { label: Lockfiles touched }
    validations: { required: true }
  - type: textarea
    id: audit_output
    attributes:
      label: Audit output
      description: Paste npm audit signatures / pnpm audit / cargo audit output.
    validations: { required: true }
  - type: textarea
    id: rollback
    attributes: { label: Rollback method }
    validations: { required: true }
```

### 8.5 `config.yml`

```yaml
blank_issues_enabled: false
contact_links:
  - name: Operator runbook
    url: https://github.com/Ghenghis/contract-kit-v17/tree/integration/main/docs/Branches
    about: Pick the right doc before opening an issue.
```

---

## 9. Cross-references

- doc 06 — Feature card schema.
- doc 10 — Cross-repo link discipline.
- doc 18 — Branch protection enforces §6 + §7.
- doc 20 — In-tree service map.
- doc 23 — Auto-update CODEOWNERS rule.
- doc 27 — Lockfile + workflow gates.
- doc 29 — Canonical branch naming (regex in field 2).

---

## 10. Apply checklist (per repo)

Open `chore/<repo>-pr-template-codeowners` branch. Each step is a discrete commit:

1. Create `.github/pull_request_template.md` from §2 verbatim.
2. Create `.github/CODEOWNERS` from §3 baseline + §4 block.
3. Create `.github/ISSUE_TEMPLATE/feature_card.yml`, `bug.yml`, `security_incident.yml`, `deps_update.yml`, `config.yml` from §8.
4. Run `gh label create` block from §5.
5. Open PR using new template (meta — first PR validates the template).
6. After merge, apply (or update) doc 18 ruleset so `pull_request` rule values match §6.
7. Verify draft PR and red-status PR both fail to merge per §7.
8. Record at `<EVIDENCE_ROOT>/repo_onboarding/<repo>_doc38.md`: merged PR URL + ruleset apply log row.

If any step fails, file a doc 24 blocker entry rather than skipping.
