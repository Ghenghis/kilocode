# 05 — KiloCode VS Code Extension

> **Operator workbench inside VS Code.** Verified by gates `V57_SETTINGS_INVENTORY`,
> `V58_SETTINGS_PLAYWRIGHT_E2E`, `V59_SECRETSTORAGE_PERSISTENCE`,
> and `V81_service_lifecycle_truth`.

---

## What it is

KiloCode is a VS Code extension (package `kilo-code`, version `7.2.21-EVO2`) that
delivers the **21-agent implementation family** directly inside the IDE. It embeds
a live Hub v2 panel, manages canonical settings through `vscode.SecretStorage`,
monitors all 14 ecosystem services via `HubServicesService`, and exposes KOM
(KiloCode Orchestrator Mode) sessions alongside the full diff/tool-result UI.

**Repo:** `G:\Github\kilocode-Azure2\packages\kilo-vscode\`

---

## Service map

```
kilo-vscode/src/
├── extension.ts               ← activate(): registers all services + commands
├── services/
│   ├── hub-services/
│   │   ├── HubServicesService.ts  ← status bar, /api/services/ensure, poll
│   │   └── index.ts
│   ├── hermes/                ← Hermes orchestrator bridge
│   ├── zeroclaw/              ← ZeroClaw safe-exec client
│   ├── memory/                ← Shiba memory read/write
│   ├── routing/               ← Provider router (MiniMax → LM Studio fallback)
│   ├── governance/            ← Capability policy checks
│   ├── telemetry/             ← Privacy-safe telemetry
│   ├── ssh/                   ← VPS SSH tasks
│   ├── vps/                   ← VPS deployment helpers
│   ├── marketplace/           ← Skill marketplace client
│   ├── training/              ← Agent training data
│   ├── profile/               ← User profile + identity
│   ├── terminal/              ← Integrated terminal tasks
│   ├── onboarding/            ← First-run wizard
│   ├── autocomplete/          ← Code completion agents
│   ├── code-actions/          ← Quick-fix agents
│   ├── commit-message/        ← Auto commit message
│   ├── browser-automation/    ← Playwright browser tasks
│   ├── cli-backend/           ← CLI command bridge
│   ├── SettingsAgentAPI.ts    ← Settings read/write + SecretStorage
│   ├── ApiKeyScannerService.ts← API key presence scanner
│   ├── RemoteStatusService.ts ← Remote status polling
│   └── KiloLogger.ts          ← Structured logger
├── panels/
│   ├── HubPanel.ts            ← Embedded WebView of shell.html
│   └── SettingsEditorProvider.ts ← Canonical settings editor WebView
└── agents/
    └── agentProfiles.ts       ← 21-agent definitions
```

---

## `HubServicesService` — service lifecycle in VS Code

`HubServicesService.ts` is the **primary wiring point** between KiloCode and the
Hub's Service Lifecycle Watchdog.

### What it does

1. **Status bar item** — creates `$(server) DaveAI: N/14` with colour coding:
   - Green: all required services up
   - Yellow: optional services down only
   - Red: one or more `required` services down
2. **Activation ensure** — calls `POST /api/services/ensure` when extension
   activates (configurable via `daveai.hub.autoEnsure`).
3. **Periodic poll** — calls `GET /api/services/status` every `daveai.hub.pollSeconds`
   (default 30s) and updates the status bar.
4. **Quick-pick** — clicking the status bar item opens a per-service list with
   inline Start/Stop/Notes actions.
5. **SSE listener** — subscribes to `/events` and reacts to `services.ensured`,
   `service.started`, `service.stopped` events.

### VS Code settings consumed

```jsonc
{
  "daveai.hub.baseUrl":     "http://localhost:8095",  // Hub origin
  "daveai.hub.adminToken":  "",                        // optional bearer
  "daveai.hub.pollSeconds": 30,                        // status bar refresh rate
  "daveai.hub.autoEnsure":  true                       // call /ensure on activate
}
```

### Extension wiring (`extension.ts`)

```typescript
import { HubServicesService } from './services/hub-services';

export async function activate(context: vscode.ExtensionContext) {
  const hubSvc = new HubServicesService(context);
  await hubSvc.start();                    // status bar + ensure + poll
  context.subscriptions.push(hubSvc);

  // ... other services, commands, panels
}
```

Verified by `V81_service_lifecycle_truth` — checks that the import chain,
`createStatusBarItem`, and `POST /api/services/ensure` calls all exist in source.

---

## HubPanel — embedded Hub WebUI

`panels/HubPanel.ts` opens `shell.html` (Hub v2 SPA) inside a VS Code WebView:

```typescript
vscode.window.createWebviewPanel(
  'kilocode.hub', 'DaveAI Hub',
  vscode.ViewColumn.Beside,
  { enableScripts: true, retainContextWhenHidden: true }
)
```

The panel sets `src` to `http://localhost:8095` and forwards `message` events
between VS Code and the Hub SPA. A `/sync` reporter fires every 30s to push
active file context into the Hub so agents stay aware of what the developer is
editing.

Commands:
- `kilo-code.hub.open` — opens/shows the Hub panel
- `kilo-code.hub.refresh` — force-refreshes the WebView

---

## 21-Agent family

<img src="diagrams/06_hermes_agents.svg" alt="21-Agent Family" width="100%"/>

All 21 agents are defined in `agents/agentProfiles.ts` and synchronised across:

| # | ID        | Role                   | Primary surface         |
| - | --------- | ---------------------- | ----------------------- |
| 0 | `kc-main` | Coordinator / router   | All surfaces            |
| 1 | `kc-01`   | Integration Lead       | Hub ↔ KiloCode ↔ WebUI  |
| 2 | `kc-02`   | Creative Brainstormer  | Chat / ideation         |
| 3 | `kc-03`   | System Architect       | Architecture docs       |
| 4 | `kc-04`   | Bug Triage Specialist  | Issue tracker           |
| 5 | `kc-05`   | Root Cause Analyst     | Repair flows            |
| 6 | `kc-06`   | Code Generator         | Implementation          |
| 7 | `kc-07`   | Code Reviewer          | PR review               |
| 8 | `kc-08`   | Test Writer            | E2E + unit tests        |
| 9 | `kc-09`   | Debugger               | Runtime errors          |
|10 | `kc-10`   | Refactorer             | Tech debt               |
|11 | `kc-11`   | Documenter             | Markdown / JSDoc        |
|12 | `kc-12`   | Security Auditor       | Policy gates            |
|13 | `kc-13`   | Performance Analyst    | Profiling               |
|14 | `kc-14`   | API Integrator         | Third-party APIs        |
|15 | `kc-15`   | Database Specialist    | Schema / migrations     |
|16 | `kc-16`   | DevOps Engineer        | Deployment / CI         |
|17 | `kc-17`   | Frontend Specialist    | UI / CSS / a11y         |
|18 | `kc-18`   | Backend Specialist     | Server / APIs           |
|19 | `kc-19`   | Research Analyst       | Evidence gathering      |
|20 | `kc-20`   | Prompt Engineer        | Model tuning            |

**Default model:** MiniMax M2.7-highspeed via `api.minimaxi.chat/v1`.
**Fallback:** LM Studio at `100.117.190.97:1234`.

Agents are also surfaced in:
- Open WebUI pipeline: `deploy/pipelines/kilocode_agents_pipeline.py`
- Hub backend: `src/webui/hub/routers/agents.py`
- War Room presence grid: `panels/warroom.js`
- Agent `.md` files: `.kilo/agents/`

---

## Settings — canonical truth

Settings are stored **server-side** in `settings_canonical.py` (port `:8082`).
KiloCode reads and writes them via `SettingsAgentAPI.ts`.
API keys are stored only in `vscode.SecretStorage` — never in `settings.json`,
never returned in `/settings` responses (only presence: `has_minimax_key: true`).

`SettingsEditorProvider.ts` renders a full settings editor WebView that mirrors
the Hub `panels/settings.js` UI. Changes from either surface emit a
`settings-changed` SSE event so the other updates immediately.

See [`settings_contract_kit/`](../settings_contract_kit/) for the canonical
settings architecture and authority matrix.

---

## Canonical settings tabs (verified by V75)

| Tab               | Key group                                   |
| ----------------- | ------------------------------------------- |
| General           | Hub URL, admin token, poll interval          |
| Providers         | MiniMax, SiliconFlow, LM Studio, Ollama keys |
| Agents            | Default agent, model override per agent     |
| Hermes            | Discord tokens H1–H5, guild ID              |
| ZeroClaw          | Allowed commands, path jail root             |
| Shiba             | DB URL, retention days                       |
| Security          | Maintenance window, disruptive route lock   |
| Skills            | Skills root, auto-approve verdicts           |
| Services          | Per-service probe URL overrides              |

23 screenshots, 137 controls tracked — gate `V75_settings_all_tabs_truth`.

---

## Skill execution from KiloCode

KiloCode can trigger skill execution via the Hub's Skills System:

```typescript
// POST http://localhost:8095/api/skills/{id}/execute
await hubClient.post(`/api/skills/${skillId}/execute`, { params });
```

The Hub routes execution to ZeroClaw for `shell` / `fs_write` / `git_push` executors.
Evidence is written to `~/daveai/skills/evidence/<id>/<run>.json`.
KiloCode's `marketplace/` service lists available skills from `GET /api/skills/marketplace`.

See [`11_SKILLS_AND_SERVICES.md`](11_SKILLS_AND_SERVICES.md) for the full skill pipeline.

---

## Build

```bash
cd G:\Github\kilocode-Azure2
bun install
bun run compile          # tsc --noEmit check
bun run package          # vsce package → kilocode-7.2.21-EVO2.vsix
code --install-extension kilocode-7.2.21-EVO2.vsix
```

Gates: `V06_COMPILE` · `V07_PACKAGE` · `V09_VSIX_MANIFEST` · `V15_ACTIVATION`

---

## See also

- [`01_ECOSYSTEM_OVERVIEW.md`](01_ECOSYSTEM_OVERVIEW.md) — service map, ports.
- [`02_WEBUI_HUB.md`](02_WEBUI_HUB.md) — Hub panels embedded in KiloCode.
- [`11_SKILLS_AND_SERVICES.md`](11_SKILLS_AND_SERVICES.md) — skill marketplace + execution.
- [`12_TRUTH_AND_PROOF.md`](12_TRUTH_AND_PROOF.md) — all V## audit gate statuses.
