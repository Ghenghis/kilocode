# Index — V3 Upstream Branch Rescue Contract

> ⚠️ **READ THIS FIRST**: This contract is **only safe** when started from `28_OPERATOR_COMMAND_ORDER.md` (the canonical run sequence). Do not skip ahead. Do not start at any later step. Phase 1+ writes are gated behind operator sign-off after Phase 0 read-only discovery.

> **ABSOLUTE RULE** (applies to every doc): Never commit, merge, rebase, reset, force-push, or push user work directly on `main` or `master` (or any repo's logical default — see doc 21). `main/master` may only mirror upstream after verified backups exist. Any attempted push to `main/master` is a critical failure and must stop the run.

## Core V3 (read in order at orientation per doc 28 Step 1)

1. `00_READ_ME_FIRST_OPERATOR_VERDICT.md` — Verdict, scope, minimum-success definition
2. `01_MASTER_PROMPT_FOR_CLAUDE_CODE.md` — Mission, operating mode, forbidden commands
3. `02_20_AGENT_ASSIGNMENT_MAP.md` — Roster A01-A20 + quorum rules
4. `03_PHASE_ROADMAP_NO_GAPS.md` — 9 phases, 100 numbered steps
5. `04_BACKUP_AND_RESTORE_PROOF_PROTOCOL.md` — Mirror + bundle + worktree archive + restore tests
6. `05_REPO_INVENTORY_AND_UPSTREAM_TRUTH.md` — Discovery procedure
7. `06_FEATURE_FINGERPRINTING_AND_BRANCH_EXTRACTION.md` — Feature cards + extraction ladder (A/B/C/D)
8. `07_BRANCH_NAMING_CONVENTION_PROTOCOL.md` — Original V3 naming (superseded on prefix shape by doc 29)
9. `08_MAIN_MASTER_PROTECTION_AND_SYNC_PROTOCOL.md` — Hook policy + safe sync procedure
10. `09_VALIDATION_GATES.md` — Universal + project-specific validation
11. `10_CROSS_REPO_HUB_AND_ECOSYSTEM_PROTOCOL.md` — Cross-repo feature matrix
12. `11_RELEASE_BRANCH_ASSEMBLY_PROTOCOL.md` — Release branch composition
13. `12_ROLLBACK_AND_DISASTER_RECOVERY.md` — Generic recovery + secret incident
14. `13_EVIDENCE_LEDGER_TEMPLATES.md` — Markdown templates for ledgers
15. `14_WHAT_WAS_MISSING_AND_HOW_V3_FIXES_IT.md` — Gap analysis vs prior kits
16. `15_RESEARCH_SOURCES_AND_RATIONALE.md` — Source citations

## Concrete-this-ecosystem extensions (added 2026-04-27 + corrections)

17. `16_ECOSYSTEM_REPO_MANIFEST.md` — **Concrete repo paths + remotes + roles** for all 11 repos
18. `17_PRE_PUSH_HOOK_INSTALLER.md` — Turnkey installer (bash + PowerShell), uninstall, smoke-test
19. `18_GITHUB_PROTECTION_SETUP.md` — `gh` CLI commands + ruleset JSON; **DANGEROUS verification has MUST-FAIL banner**
20. `19_PER_REPO_COMMAND_PLAYBOOK.md` — Phase 0-9 commands per repo, no placeholders
21. `20_IN_TREE_SERVICES_PROTOCOL.md` — How to handle services that live inside another repo (Hermes, ZeroClaw, Hub-UI)
22. `21_NON_STANDARD_DEFAULT_BRANCHES.md` — Handles `integration/main`, `clean-master`, etc.
23. `22_CLAUDE_CODE_WORKTREE_AND_SUBAGENT_PROTOCOL.md` — Sandbox constraints + parent/sub-agent capability matrix
24. `23_RELEASE_PROVENANCE_AND_AUTO_UPDATE.md` — VSIX/release must come from `release/*`; SHA256+SLSA+manifest signing
25. `24_FAILURE_MODE_LIBRARY.md` — Per-failure-mode lookup F0.1-FX.5 with diagnosis + recovery + severity
26. `25_EVIDENCE_LEDGER_AUTOMATION.md` — Bash + PowerShell scripts to populate ledgers from `git status`
27. `26_TWENTY_AGENT_DISPATCH_TEMPLATES.md` — Ready-to-paste prompts for A02-A20 + quorum simulation
28. `27_SECRETS_AND_SUPPLY_CHAIN_HARDENING.md` — Tier 1-4 secret scans, lockfile integrity, workflow injection, dep confusion, VSIX supply chain
29. `28_OPERATOR_COMMAND_ORDER.md` — **CANONICAL RUN SEQUENCE** (Steps 1-12, GATE A-Z)
30. `29_NAMING_CONVENTION_CANONICAL.md` — **Canonical** branch naming (canonicalizes on `feat/`); supersedes drift in 07/17/20
31. `30_ZEROCLAW_SCOPE_RESOLUTION.md` — ZeroClaw is a separate scope; canonical Rust source at `G:/Github/upgrade/zeroclaw/` (`zeroclawlabs` v0.6.0); 5 in-tree adapters; promotion plan

## Operational ecosystem coverage (added 2026-04-27 wave 2)

32. `31_VPS_AND_HOSTINGER_DEPLOYMENT_TOPOLOGY.md` — Cloudflare DNS + Hostinger VPS topology, Caddy/Nginx templates, deploy cadence, rollback
33. `32_CICD_AND_GITHUB_ACTIONS_BLUEPRINT.md` — `pr-validate.yml` + `release.yml` + `nightly-audit.yml`; per-runtime variants (Bun/Python/npm/cargo); SHA-pinned actions; secret inventory
34. `33_DEVELOPER_ONBOARDING_RUNBOOK.md` — Day 0 + Day 1 onboarding for new devs and Claude-Code sessions
35. `35_DOCKER_AND_CONTAINER_DISCIPLINE.md` — `FROM` digest-pin; multi-stage; distroless preference; `.dockerignore` baseline; SBOM; vuln scan gate
36. `37_OPERATOR_DAILY_RUNBOOK.md` — Daily/weekly/monthly/quarterly checklists; incident response routing; go-bag
37. `38_PR_TEMPLATE_AND_CODEOWNERS.md` — Canonical `.github/pull_request_template.md`, `CODEOWNERS` (baseline + per-repo overrides), issue templates, label set
38. `39_INCIDENT_RUNBOOK.md` — 6-phase incident lifecycle (DETECT/TRIAGE/CONTAIN/ERADICATE/RECOVER/LEARN), roles, status templates, postmortem template
39. `40_DEPENDENCY_LIFECYCLE.md` — Pinning policy (exact/~minor/^major/exact); add/upgrade/remove checklists; license-allow list; SBOM cadence

## Reading order by role

### Operator (human Dave)
1. `00` — verdict
2. `28` — command order (start here for any run)
3. `16` — repo manifest (what's in scope)
4. `17_GATE_A`, `_GATE_B`, etc. — sign-off templates throughout doc 28
5. `24` — failure modes (when something breaks)

### Run Captain (parent process / Claude Code orchestrator)
1. `01` — master prompt
2. `28` — command order (canonical sequence)
3. `22` — worktree + sub-agent capabilities
4. `26` — agent dispatch templates
5. `25` — ledger automation scripts
6. `29` — canonical naming (validate every branch name)
7. `30` — ZeroClaw scope (special-case)

### Sub-agents (A02-A20)
Each role has a dedicated prompt template in doc 26. Sub-agents should also reference:
1. `01` — absolute rule (always)
2. Their role's section in `02`
3. The relevant phase doc (`04`/`06`/`09`) for their phase
4. `24` — failure modes for their phase

### External auditor
1. `00` — verdict
2. `28` — what should have been run, in order
3. `13` — ledger templates
4. `24` — failure-mode library to spot what was skipped
5. The actual evidence root (`G:\Github\_repo_rescue_evidence\<DATE>\`) for the run being audited

## Canonical conflict-resolution table

When two docs conflict, the later "concrete" doc wins on the disagreement:

| Topic | Authoritative doc |
|---|---|
| Run sequence + gates | `28_OPERATOR_COMMAND_ORDER.md` |
| Branch naming (prefix shape, scope tokens) | `29_NAMING_CONVENTION_CANONICAL.md` |
| Repo identities (paths, remotes, defaults) | `16_ECOSYSTEM_REPO_MANIFEST.md` |
| Default-branch protection (per repo) | `21_NON_STANDARD_DEFAULT_BRANCHES.md` (config-driven) |
| ZeroClaw scope | `30_ZEROCLAW_SCOPE_RESOLUTION.md` |
| In-tree services (Hermes/Hub-UI/ZeroClaw client) | `20_IN_TREE_SERVICES_PROTOCOL.md` |
| Sub-agent capability boundaries | `22_CLAUDE_CODE_WORKTREE_AND_SUBAGENT_PROTOCOL.md` |
| Release provenance | `23_RELEASE_PROVENANCE_AND_AUTO_UPDATE.md` |
| Failure recovery | `24_FAILURE_MODE_LIBRARY.md` |

## Placeholder policy

Some docs (17, 18, 26) intentionally contain placeholders that are **template parameters** to be filled in at run-time:

- `<EVIDENCE_ROOT>` — operator's evidence root for the current run, set as `$EVIDENCE_ROOT` env var
- `<OWNER>/<REPO>` (in doc 18 generic verify section) — iterated over the per-repo list above the section
- `[BRACKETED]` (in doc 26) — agent-dispatch template parameters filled by the parent before invoking the Agent tool
- `<repo>` (in doc 17 CLI usage) — operator-supplied path argument

These are **not** unfilled bugs. They are runtime parameters. Doc 16 (manifest) supplies the concrete values that get plugged in.

If a doc shows a placeholder where the manifest has a concrete value (e.g. `<branch_name>` instead of `feat/daveai-hermes-retry`), that IS a bug — open a `docs/branches-*` PR to fix.

## Status of this kit

**Phase 0 discovery completed**: 2026-04-27. Evidence at `G:\Github\_repo_rescue_evidence\2026-04-27\repo_inventory.md`.

**Phase 1+ pending**: requires operator GATE A sign-off. See doc 28 Step 2.

**Known drift acknowledged + reconciled in this revision**:
- ZeroClaw scope was wrongly described as "no standalone repo" → corrected in doc 30.
- Branch-name shape was inconsistent across docs (`feature/` vs `feat/`) → canonicalized in doc 29.
- Doc 18 had a bare `git push --force` example without MUST-FAIL banner → corrected in doc 18.
- Some docs contained unfilled placeholders → policy clarified above; per-repo concrete values in docs 16/19.

**Pending enhancements (planned wave 2)**:
- VPS / Hostinger deployment topology
- CI / GitHub Actions blueprint
- Developer onboarding runbook
- Monitoring + observability
- Docker / container discipline
- DB / migration lifecycle
- Operator daily runbook
- PR template + CODEOWNERS canonical files
