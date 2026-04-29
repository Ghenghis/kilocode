# Protected DaveAI Custom Files

These paths must **never** be overwritten by upstream sync without explicit
approval. Verified against actual source tree on 2026-04-26.

## `contract-kit-v17` (G:\Github\contract-kit-v17)

### Hub v2 routers (21 modules — all custom)

```
src/webui/hub/__init__.py
src/webui/hub/_http.py
src/webui/hub/auth.py
src/webui/hub/config.py
src/webui/hub/event_bus.py
src/webui/hub/mcp_server.py
src/webui/hub/panel_registry.py
src/webui/hub/routers/agents.py
src/webui/hub/routers/agents_bridge.py
src/webui/hub/routers/capabilities.py
src/webui/hub/routers/discord.py
src/webui/hub/routers/kilocode.py
src/webui/hub/routers/kom.py
src/webui/hub/routers/mcp.py
src/webui/hub/routers/openwebui.py
src/webui/hub/routers/permissions.py
src/webui/hub/routers/pipeline.py
src/webui/hub/routers/providers.py
src/webui/hub/routers/proxies.py
src/webui/hub/routers/repairs.py
src/webui/hub/routers/roadmap.py
src/webui/hub/routers/runtime.py
src/webui/hub/routers/services.py        ← v2.1.0 watchdog
src/webui/hub/routers/settings.py
src/webui/hub/routers/skills.py          ← v2.1.0 skills system
src/webui/hub/routers/staging.py
src/webui/hub/routers/tasks.py
src/webui/hub/routers/warroom.py
```

### Hub v2 frontend (panels + shell)

```
src/webui/panels/*.js
src/webui/shell.html
src/webui/dashboard.py
src/webui/hub_start.py
```

### Skills System v2.1.0

```
skills/registry.seed.json
skills/manifest.schema.json
skills/install_vps_skills.sh
```

### Hermes / ZeroClaw / Shiba integration

```
src/hermes/**
src/zeroclaw/**
src/integration/approval_store.py
src/integration/privacy_guard.py
```

### Settings Contract Kit

```
settings_contract_kit/**
config/agent_policies.json
```

### Documentation (v2.1.0)

```
docs/00_MASTER_INDEX.md
docs/01_ECOSYSTEM_OVERVIEW.md
docs/02_WEBUI_HUB.md
docs/04_HERMES_ORCHESTRATOR.md
docs/05_KILOCODE_VSIX.md
docs/06_ZEROCLAW_ADAPTERS.md
docs/09_API_REFERENCE.md
docs/11_SKILLS_AND_SERVICES.md
docs/12_TRUTH_AND_PROOF.md
docs/diagrams/09_skills_lifecycle.svg
docs/diagrams/10_service_watchdog.svg
```

### Tests

```
tests/e2e/cross_surface_parity.spec.ts
tests/e2e/live_binding_proof.spec.ts
tests/e2e/test_kilocode_agents.ts
tests/e2e/visual_complete_coverage.spec.ts
```

## `kilocode-Azure2` (G:\Github\kilocode-Azure2)

### V## audit gates (V01–V81 — all DaveAI work)

```
scripts/audit/v01_entrypoints.py … v81_service_lifecycle_truth.py
```

V57–V78 = Agentic Truth band. V79/V80/V81 = Skills/Services lifecycle.

### KiloCode 21 agents (verified: 21 markdown files at .kilo/agents/)

```
.kilo/agents/kc-main.md
.kilo/agents/kc-01.md … kc-20.md
```

### Custom services (20 subdirs)

```
packages/kilo-vscode/src/services/autocomplete/**
packages/kilo-vscode/src/services/browser-automation/**
packages/kilo-vscode/src/services/cli-backend/**
packages/kilo-vscode/src/services/code-actions/**
packages/kilo-vscode/src/services/commit-message/**
packages/kilo-vscode/src/services/governance/**
packages/kilo-vscode/src/services/hermes/**
packages/kilo-vscode/src/services/hub-services/**       ← v2.1.0 HubServicesService
packages/kilo-vscode/src/services/marketplace/**
packages/kilo-vscode/src/services/memory/**
packages/kilo-vscode/src/services/onboarding/**
packages/kilo-vscode/src/services/profile/**
packages/kilo-vscode/src/services/routing/**
packages/kilo-vscode/src/services/ssh/**
packages/kilo-vscode/src/services/telemetry/**
packages/kilo-vscode/src/services/terminal/**
packages/kilo-vscode/src/services/training/**
packages/kilo-vscode/src/services/vps/**
packages/kilo-vscode/src/services/workstation/**
packages/kilo-vscode/src/services/zeroclaw/**
packages/kilo-vscode/src/services/SettingsAgentAPI.ts
packages/kilo-vscode/src/services/ApiKeyScannerService.ts
packages/kilo-vscode/src/services/RemoteStatusService.ts
packages/kilo-vscode/src/services/KiloLogger.ts
```

### Custom panels

```
packages/kilo-vscode/src/panels/HubPanel.ts
packages/kilo-vscode/src/panels/SettingsEditorProvider.ts
```

## Allowlist for upstream cherry-picks (kilocode-Azure2)

Only these top-level paths may receive upstream updates without DaveAI review:

```
packages/kilo-vscode/src/api/**          (upstream-owned API client)
packages/kilo-vscode/src/i18n/**         (translations)
packages/kilo-vscode/src/utils/diff/**   (pure utility)
package.json                              (dependency bumps only)
tsconfig*.json
.eslintrc*
.prettierrc*
LICENSE
```

Anything not on the allowlist requires manual review.
