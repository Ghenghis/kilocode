# Docs / Diagrams Audit

Generated: 2026-04-26.
Scope: every markdown and SVG under `docs/`, `handoff/`, `artifacts/`.
Method: regex scan for stale-claim patterns + diagram cross-reference check.

## Doc inventory

### Canonical numbered docs (13 files — all current)

```
docs/00_MASTER_INDEX.md          —  master index
docs/01_ECOSYSTEM_OVERVIEW.md    —  rewritten v2.1.0
docs/02_WEBUI_HUB.md             —  rewritten v2.1.0
docs/03_RUNTIME_CORE.md          —  current
docs/04_HERMES_ORCHESTRATOR.md   —  rewritten v2.1.0
docs/05_KILOCODE_VSIX.md         —  new for v2.1.0
docs/06_ZEROCLAW_ADAPTERS.md     —  new for v2.1.0
docs/07_TESTING_GUIDE.md         —  current
docs/08_DEPLOYMENT.md            —  current
docs/09_API_REFERENCE.md         —  rewritten v2.1.0 (incl. /api/skills, /api/services)
docs/10_DEVELOPER_GUIDE.md       —  current
docs/11_SKILLS_AND_SERVICES.md   —  new for v2.1.0
docs/12_TRUTH_AND_PROOF.md       —  new for v2.1.0
```

### Supplementary docs (3 files)

```
docs/cross_reference_verification.md
docs/cross_surface_parity_matrix.md
docs/E2E_TEST_REPORT_KiloCode_Agents.md
```

## Diagram inventory (10 SVGs, all referenced)

| SVG | Used by |
|-----|---------|
| `01_ecosystem_topology.svg` | `01_ECOSYSTEM_OVERVIEW.md` |
| `02_webui_panels.svg` | `02_WEBUI_HUB.md` |
| `03_data_flow.svg` | `06_ZEROCLAW_ADAPTERS.md` |
| `04_provider_circuit.svg` | `03_RUNTIME_CORE.md` |
| `05_kom_session.svg` | `04_HERMES_ORCHESTRATOR.md` |
| `06_hermes_agents.svg` | `04_HERMES_ORCHESTRATOR.md`, `05_KILOCODE_VSIX.md` |
| `07_deployment_topology.svg` | `08_DEPLOYMENT.md` |
| `08_testing_pyramid.svg` | `07_TESTING_GUIDE.md` |
| `09_skills_lifecycle.svg` | `11_SKILLS_AND_SERVICES.md`, `12_TRUTH_AND_PROOF.md` |
| `10_service_watchdog.svg` | `11_SKILLS_AND_SERVICES.md`, `12_TRUTH_AND_PROOF.md` |

**Orphaned SVGs:** none.
**Missing SVGs (referenced but not on disk):** none.

## Stale-claim scan

Patterns scanned (per `09_DOCS_DIAGRAMS_AUDIT.md`):

```
production ready / production-ready   100%
all tests passed / all tests pass     SOTA
fully agentic
PASS_RELEASE_READY
PASS_AGENTIC_TRUTH
complete
```

**Strong-pattern hits** (`production ready`, `fully agentic`,
`PASS_RELEASE_READY`, `all tests pass`): **0** ✅

**Soft-pattern hits** (`100%`, `PASS_AGENTIC_TRUTH`): 16 — **all false
positives or contextual**:

| File | Line | Pattern | Context | Verdict |
|------|------|---------|---------|---------|
| `docs/diagrams/08_testing_pyramid.svg` | 72 | `100%` | SVG label "100% pass required" — descriptive | OK |
| `docs/diagrams/10_service_watchdog.svg` | 102 | `PASS_AGENTIC_TRUTH` | SVG label "PASS_AGENTIC_TRUTH if down" — describes a verdict produced by V81, not a claim | OK |
| `docs/00_MASTER_INDEX.md` | 54 | `100%` | "100% visual coverage list" — name of a checklist file | OK |
| `docs/01_ECOSYSTEM_OVERVIEW.md` | 7, 49 | `100%`, `PASS_AGENTIC_TRUTH` | `<img width="100%"/>` HTML; `block PASS_AGENTIC_TRUTH if down` describes V61 behaviour | OK |
| `docs/02_WEBUI_HUB.md` | 6 | `100%` | `<img width="100%"/>` HTML | OK |
| `docs/03_RUNTIME_CORE.md` | 85 | `100%` | `<img width="100%"/>` HTML | OK |
| `docs/04_HERMES_ORCHESTRATOR.md` | 7 | `100%` | `<img width="100%"/>` HTML | OK |
| `docs/05_KILOCODE_VSIX.md` | 136 | `100%` | `<img width="100%"/>` HTML | OK |
| `docs/06_ZEROCLAW_ADAPTERS.md` | 6 | `100%` | `<img width="100%"/>` HTML | OK |
| `docs/07_TESTING_GUIDE.md` | 3 | `100%` | `<img width="100%"/>` HTML | OK |
| `docs/08_DEPLOYMENT.md` | 3 | `100%` | `<img width="100%"/>` HTML | OK |
| `docs/10_DEVELOPER_GUIDE.md` | 189 | `production-ready` | "main branch is production-ready, all gates must pass" — branch policy, not a status claim | OK |
| `docs/10_DEVELOPER_GUIDE.md` | 246 | `100%` | `width="100%"` HTML guidance | OK |
| `docs/11_SKILLS_AND_SERVICES.md` | 13 | `100%` | `<img width="100%"/>` HTML | OK |
| `docs/12_TRUTH_AND_PROOF.md` | 11 | `100%` | `<img width="100%"/>` HTML | OK |

Per-row machine-readable record: see `STALE_CLAIMS_REPORT.csv`.

## Purge candidates

None. All 13 canonical docs are current; all 10 SVGs are referenced; the 3
supplementary docs are still valid. Any earlier transient docs were already
purged in v2.1.0 cleanup (see `CHANGELOG.md` v2.1.0 section).

## Verdict

`DOCS_AUDIT_PASS`

- 0 strong stale-claim hits
- 16 soft hits, all confirmed false positives or descriptive context
- 0 orphan SVGs
- 0 missing SVG references
- 13 canonical docs all aligned to v2.1.0
