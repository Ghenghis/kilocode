# 00 — Master Documentation Index

> **Single source of truth pointer.** This file lists every canonical doc in the
> ecosystem and where its truth/proof lives. If a doc is stale, this index is the
> first thing to update — that's how readers know what's authoritative.

**Version:** 2.1.0 (Skills + Services Lifecycle release)
**Generated:** 2026-04-26
**Truth verified by gates:** V52, V53, V54, V55, V56, V57, V58, V59, V60, V61, V62, V63, V69, V75, V77, V78, **V79, V80, V81**

---

## How to read this index

- 🟢 **Current** = doc reflects code at HEAD; passing audit gate cited.
- 🟡 **Partial** = doc covers most of the surface; a section may be stale (noted).
- 🔴 **Legacy** = doc preserved for history. Do not implement against it.

Every entry below cites the **proof** that justifies its status: either an audit
gate (`V##`) under `artifacts/agentic-truth/` or a Playwright spec under `tests/e2e/`.

---

## A. Canonical architecture (`docs/`)

| #  | Doc                                                              | Status | Covers                                                                  | Proof                                                 |
| -- | ---------------------------------------------------------------- | ------ | ----------------------------------------------------------------------- | ----------------------------------------------------- |
| 01 | [01_ECOSYSTEM_OVERVIEW.md](01_ECOSYSTEM_OVERVIEW.md)             | 🟢      | Service map, ports, env vars, healthall                                 | V56_RUNTIME_TRUTH_COMPLETE                            |
| 02 | [02_WEBUI_HUB.md](02_WEBUI_HUB.md)                               | 🟢      | Hub v2 panels, routers, `/api/*`                                        | V69_hub_dashboard_truth, V75_settings_all_tabs_truth  |
| 03 | [03_RUNTIME_CORE.md](03_RUNTIME_CORE.md)                         | 🟢      | Runtime task lifecycle, KiloCode bridge                                 | V52_RUNTIME_DISCOVERY, V53_RUNTIME_EXECUTION          |
| 04 | [04_HERMES_ORCHESTRATOR.md](04_HERMES_ORCHESTRATOR.md)           | 🟢      | KOM, H1–H5, RepairRouter, MiniMax routing                               | V61_HERMES_RUNTIME                                    |
| 05 | [05_KILOCODE_VSIX.md](05_KILOCODE_VSIX.md)                       | 🟢      | KiloCode extension activation, services, settings, HubServicesService   | V57_SETTINGS_INVENTORY, V58_SETTINGS_PLAYWRIGHT_E2E, V81_service_lifecycle_truth |
| 06 | [06_ZEROCLAW_ADAPTERS.md](06_ZEROCLAW_ADAPTERS.md)               | 🟢      | ZeroClaw safe-exec for shell/git/file/research                          | V62_ZEROCLAW_RUNTIME                                  |
| 07 | [07_TESTING_GUIDE.md](07_TESTING_GUIDE.md)                       | 🟢      | Unit, integration, Playwright E2E, audit gates                          | V54_PLAYWRIGHT_VISUAL, V55_HARD_FAIL_CONDITIONS       |
| 08 | [08_DEPLOYMENT.md](08_DEPLOYMENT.md)                             | 🟢      | systemd, docker-compose, VPS install, skills install                    | V77 settings parity, V81 service lifecycle             |
| 09 | [09_API_REFERENCE.md](09_API_REFERENCE.md)                       | 🟢      | Every HTTP endpoint across hub, runtime, settings, hermes, services, skills | (sourced live from FastAPI app)                  |
| 10 | [10_DEVELOPER_GUIDE.md](10_DEVELOPER_GUIDE.md)                   | 🟢      | Linting, code-quality, contributor flow                                 | (style guide)                                         |
| 11 | [11_SKILLS_AND_SERVICES.md](11_SKILLS_AND_SERVICES.md)           | 🟢      | **NEW**: Skills system + Service Lifecycle Watchdog                     | V79_skills_inventory, V80_skills_audit_truth, V81_service_lifecycle_truth |
| 12 | [12_TRUTH_AND_PROOF.md](12_TRUTH_AND_PROOF.md)                   | 🟢      | **NEW**: Catalog of every audit gate, last status, evidence             | (this is the proof catalog)                           |

---

## B. Operating handbooks (root)

| Doc                                                       | Status | Purpose                                          |
| --------------------------------------------------------- | ------ | ------------------------------------------------ |
| [README.md](../README.md)                                 | 🟢      | Public landing — features, quick start, proof.   |
| [CHANGELOG.md](../CHANGELOG.md)                           | 🟢      | Release history. v2.1.0 = Skills + Services.     |
| [ARCHITECTURE.md](../ARCHITECTURE.md)                     | 🟢      | System SVG diagrams.                             |
| [ACTION_PLAN.md](../ACTION_PLAN.md)                       | 🟢      | 24–72h execution plan.                           |
| [INTERACTIVE_ROADMAP.md](../INTERACTIVE_ROADMAP.md)       | 🟢      | Strategic roadmap + War Room.                    |
| [FEATURES-LIST.md](../FEATURES-LIST.md)                   | 🟢      | Complete feature inventory.                      |
| [PROOF-E2E.md](../PROOF-E2E.md)                           | 🟢      | Playwright proof walkthrough.                    |
| [VISUAL_TEST_CHECKLIST.md](../VISUAL_TEST_CHECKLIST.md)   | 🟢      | 100% visual coverage list.                       |
| [PRODUCTION_READY.md](../PRODUCTION_READY.md)             | 🟢      | Production checklist.                            |
| [PROOF_PACK.md](../PROOF_PACK.md)                         | 🟢      | Compact proof bundle for stakeholders.           |

---

## C. Settings contract kit (`settings_contract_kit/`)

These docs are the **upstream source** for the Settings architecture. Keep them
authoritative for Settings; Hub `settings.py` and KiloCode `SettingsEditorProvider.ts`
must agree with these.

| Doc                                                                                                  | Status |
| ---------------------------------------------------------------------------------------------------- | ------ |
| `settings_contract_kit/00_SOURCE_OF_TRUTH.md`                                                         | 🟢      |
| `settings_contract_kit/01_CURRENT_PROBLEM_AND_GOAL.md`                                                | 🟢      |
| `settings_contract_kit/02_SERVER_SIDE_CANONICAL_SETTINGS_ARCHITECTURE.md`                             | 🟢      |
| `settings_contract_kit/03_KILOCODE_SETTINGS_INFORMATION_ARCHITECTURE.md`                              | 🟢      |
| `settings_contract_kit/04_HERMES_ZEROCLAW_MERGED_TAB.md`                                              | 🟢      |
| `settings_contract_kit/05_WEBUI_SETTINGS_AND_AGENT_CONTROL_CENTER.md`                                 | 🟢      |
| `settings_contract_kit/06_AUTOFILL_AND_AGENT_WRITEBACK_RULES.md`                                      | 🟢      |
| `settings_contract_kit/07_AGENT_AUTHORITY_MATRIX.md`                                                  | 🟢      |
| `settings_contract_kit/08_RUNTIME_API_AND_DATA_MODELS.md`                                             | 🟢      |
| `settings_contract_kit/09_E2E_SETTINGS_REPAIR_TEST_PLAN.md`                                           | 🟢      |
| `settings_contract_kit/10_WINDSURF_IMPLEMENTATION_ORDER.md`                                           | 🟢      |
| `settings_contract_kit/11_ACCEPTANCE_GATES.md`                                                        | 🟢      |

---

## D. Component-specific READMEs

| Path                                  | Owner       | Truth                                                                            |
| ------------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| `deploy/README.md`                    | DevOps      | Deployment scripts overview.                                                     |
| `openclaude/README.md`                | OpenClaw    | Mobile / Android client. Independent project.                                    |
| `skills/manifest.schema.json`         | Skills      | JSON-Schema for skill manifests (machine-truth, not docs).                       |
| `skills/registry.seed.json`           | Skills      | Seed registry shipped to VPS via `install_vps_skills.sh`.                        |

---

## E. Legacy / archived

These are kept for history only. **Do not implement against them.**

- `ACTION_PLAN.legacy-v1.md`
- `INTERACTIVE_ROADMAP.legacy-v1.md`
- `KiloCode_MAOS_README-updateme.md` (rename pending)
- `DaveAI_Ecosystem_Truth_Skills_Repack/**` (source pack — migrated into this repo)

---

## F. KiloCode-Azure2 satellite docs

The KiloCode VS Code extension lives in a separate repo (`G:\Github\kilocode-Azure2`).
Its docs are mirrored here for cross-reference but the canonical source is that repo.

| Path (relative to kilocode-Azure2)                | Mirror status | Purpose                                  |
| ------------------------------------------------- | ------------- | ---------------------------------------- |
| `README.md`                                        | 🟢             | Public landing for the extension.        |
| `START_HERE.md`                                    | 🟢             | New-contributor walkthrough.             |
| `MASTER_ACTION_PLAN.md`                            | 🟢             | Multi-week roadmap.                      |
| `VSIX_ZERO_TRUST_CONTRACT.md`                     | 🟢             | Release contract.                        |
| `artifacts/V##_*.md`                               | 🟢             | Per-gate evidence (V52..V81).            |

---

## How to extend this index

1. Add the new doc to the appropriate table (A/B/C/D).
2. Cite the audit gate or Playwright spec that **proves** it.
3. If no proof exists yet, mark 🟡 and open a follow-up to create one.
4. Update `docs/12_TRUTH_AND_PROOF.md` so the proof appears in the catalog.
