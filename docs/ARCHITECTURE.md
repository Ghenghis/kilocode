# KiloCode Ecosystem — Architecture Reference

> **Last updated:** 2026-04-28
> **Status:** Authoritative — derived from source-of-truth service files
> **Scope:** All services that the KiloCode VS Code extension touches

---

## Table of Contents

1. [Service Topology](#1-service-topology)
2. [Data Flow Diagrams](#2-data-flow-diagrams)
3. [Environment Variable Mapping](#3-environment-variable-mapping)
4. [Port / URL Mapping](#4-port--url-mapping)
5. [Message Protocol Reference](#5-message-protocol-reference)
6. [Security Boundaries](#6-security-boundaries)

---

## 1. Service Topology

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                     VS CODE EXTENSION HOST (Node.js)                        ║
║                                                                              ║
║  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  ┌───────────────┐  ║
║  │  extension  │  │  KiloProvider│  │  HermesClient  │  │  SSHService   │  ║
║  │   .ts       │  │  .ts         │  │  (bridge API)  │  │  (22 live)    │  ║
║  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘  └───────┬───────┘  ║
║         │                │                  │                    │           ║
║  ┌──────▼──────────────────────────────────────────────────────────────┐    ║
║  │                  postMessage ↔ Webview bridge                       │    ║
║  └──────────────────────────────────┬────────────────────────────────-─┘    ║
║                                     │                                        ║
╚═════════════════════════════════════╪════════════════════════════════════════╝
                                      │ VS Code webview boundary
╔═════════════════════════════════════╪════════════════════════════════════════╗
║                     WEBVIEW (SolidJS / Vite)                                ║
║                                                                              ║
║  Settings.tsx                       │                                        ║
║  ├── ZeroClawTab    HermesTab        │ OpenClawTab   HubTab                  ║
║  ├── VPSTab         SSHTab          │ TrainingTab   MemoryTab               ║
║  ├── GovernanceTab  SpeechTab       │ RoutingTab                            ║
╚══════════════════════════════════════════════════════════════════════════════╝
                          │
                          │ HTTP (outbound from extension host)
        ┌─────────────────┼────────────────────────────────────────────┐
        │                 │                                            │
        ▼                 ▼                                            ▼
  ┌───────────┐    ┌─────────────┐                            ┌──────────────┐
  │  Hermes   │    │    Hub      │                            │   Shiba /    │
  │  Bridge   │    │  (ops svc)  │                            │  Memory RAG  │
  │ :18789    │    │  :8095      │                            │  :7002       │
  └─────┬─────┘    └──────┬──────┘                            └──────┬───────┘
        │                 │                                           │
        │ Bridge B        │                                           │
        │ (internal)      │ /api/*                                    │ /recall
        ▼                 ▼                                           ▼
  ┌───────────┐    ┌─────────────────────────────┐         ┌─────────────────┐
  │ ZeroClaw  │    │  Hub Services               │         │  Vector Store   │
  │ Execution │    │  (training, governance,     │         │  (local embed.) │
  │ Engine    │    │   routing APIs)             │         └─────────────────┘
  └───────────┘    └─────────────────────────────┘
        │
        │  task execution
        ▼
  ┌─────────────────────────────────────────────────────────┐
  │  AI Providers (external)                                │
  │  Anthropic · OpenAI · Azure OpenAI · Ollama · LM Studio │
  │  + 20+ OpenClaw channel providers                       │
  └─────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────┐
  │  OpenClaw Gateway  :18789                               │
  │  ├── Telegram   ├── Discord    ├── Slack                │
  │  ├── WhatsApp   ├── Signal     ├── iMessage             │
  │  ├── Matrix     ├── Teams      ├── WeChat               │
  │  ├── Line       ├── Twitch     ├── IRC                  │
  │  ├── Nostr      ├── Zalo       ├── QQ                   │
  │  ├── Feishu     ├── Mattermost ├── Google Chat          │
  │  ├── Webchat    ├── Webhook    └── BlueBubbles          │
  └─────────────────────────────────────────────────────────┘
```

### Component Roles

| Component | Location | Role |
|-----------|----------|------|
| **extension.ts** | `packages/kilo-vscode/src/` | Extension entry point; instantiates all services; owns VS Code lifecycle |
| **KiloProvider** | `src/KiloProvider.ts` | Routes webview messages to the correct service handler |
| **HermesClient** | `src/services/hermes/HermesClient.ts` | HTTP client to Hermes Bridge A API only; KiloCode never calls Bridge B |
| **HermesPipeline** | `src/services/hermes/HermesPipeline.ts` | Manages active task state machine in extension host |
| **ZeroClawService** | `src/services/zeroclaw/ZeroClawService.ts` | Constructs task submissions; tracks tasks locally |
| **RoutingService** | `src/services/routing/RoutingService.ts` | Selects AI provider per request based on role/risk/cost/privacy |
| **MemoryService** | `src/services/memory/MemoryService.ts` | CRUD + recall against Shiba/RAG endpoint; TF-IDF recall (pre-embedding) |
| **GovernanceService** | `src/services/governance/GovernanceService.ts` | Dangerous action catalog; audit log; tier assignments |
| **SSHService** | `src/services/ssh/SSHService.ts` | SSH profile CRUD; `~/.ssh/config` import; connection management |
| **VPSService** | `src/services/vps/VPSService.ts` | VPS server inventory; metrics polling; deploy history |
| **HubServicesService** | `src/services/hub-services.ts` | Status bar watchdog polling `/api/services/status` |
| **Hermes Bridge** | External `:18789` | Mission control; routes KiloCode tasks to ZeroClaw; owns policy/ledger/memory |
| **OpenClaw Gateway** | External `:18789` (same host) | Multi-platform messaging gateway; routes 20+ channels to local AI |
| **Hub** | External `:8095` | Operations surface; services health, audit gates, PR queue, quota, secret-scan |
| **Shiba / Memory RAG** | External `:7002` | KV + vector store for agent memory; `hermes.json`/`shiba.json` config |

---

## 2. Data Flow Diagrams

### 2a. Task Execution Pipeline (KiloCode → Hermes → ZeroClaw)

```
User submits task in ZeroClawTab
        │
        ▼
KiloProvider receives "zeroclaw:submit"
        │
        ▼
ZeroClawService.submit(TaskSubmission)
  └── builds TaskEnvelope {task_id, origin:"kilocode", user_intent, project_path,
                             approval_mode, constraints}
        │
        │  POST /tasks
        ▼
Hermes Bridge API (:18789)
  ├── validates envelope
  ├── applies policy (risk, scope, network, write)
  ├── stores in ledger
  └── creates ZeroClaw job (Bridge B — internal, KiloCode does NOT call this)
        │
        │  GET /tasks/{id}/events  (SSE stream)
        ▼
HermesPipeline subscribes to SSE
  └── emits TaskStatusEvent on each state transition:
        queued → planning → awaiting_approval → executing_in_zeroclaw
        → validating → completed / failed / blocked
        │
        ▼
Extension host posts state update to webview
        │
        ▼
ZeroClawTab / HermesTab reactive update (SolidJS signal)

If state == "awaiting_approval":
  → GovernanceService records approval request
  → Operator approves in GovernanceTab
  → KiloCode posts approval to Hermes: POST /tasks/{id}/approve
  → Hermes transitions task to "executing_in_zeroclaw"
```

### 2b. Provider Routing (KiloCode → RoutingService → AI Provider)

```
AI request arrives (chat, completion, etc.)
        │
        ▼
RoutingService.route(RouteRequest)
  ├── reads RoutingConfig from workspaceState
  ├── for each provider in fallbackOrder:
  │     ├── check circuitBreaker == "closed"
  │     ├── check roles includes taskType
  │     ├── check privacyMode == "local_preferred" → prefer local providers
  │     ├── check estimatedCost < costThreshold
  │     └── if all pass → SELECT provider, record RouteDecision
  └── if no provider passes → return error (all routes blocked)
        │
        ▼
RoutingDecision returned to KiloProvider
        │
        ▼
KiloProvider forwards request to selected provider's API
        │
        ▼
Response returned → failure count updated in RoutingService
  └── if failure → circuitBreaker transitions:
        closed →(3 failures)→ open →(30s)→ half-open →(success)→ closed
```

### 2c. Memory Recall (Agent → MemoryService → Shiba)

```
Agent requests memory recall (query string)
        │
        ▼
MemoryService.recall(query, project, scope)
  ├── Step 1: resolve endpoint
  │     priority: workspaceState → .kilo/hermes.json → .kilo/shiba.json
  │              → ~/.kilo/hermes.json → default http://localhost:7002
  ├── Step 2: try remote endpoint
  │     POST {endpoint}/recall  {query, project, scope}
  │     timeout: 3s
  │     on success → return RecallResult
  └── Step 3: fallback to local TF-IDF
        (scan in-memory entries, compute TF-IDF similarity)
        return RecallResult with relevanceScores
        │
        ▼
MemoryTab displays RecallResultEntry[] with relevanceScore
Agent uses top-N entries as context injection
```

### 2d. OpenClaw Message Flow (Platform → Gateway → Agent → Response)

```
User sends message on Telegram / Discord / Slack / etc.
        │
        ▼
OpenClaw Gateway (:18789) receives via channel webhook/bot
        │
        ▼
Routing rule evaluation (pattern match → action)
  ├── route_to_agent → forward to assigned Agent
  ├── respond_direct → respond with assigned Model
  ├── ignore → drop message
  └── forward → relay to another channel
        │
        ▼
Assigned Agent (model: Ollama / LM Studio / OpenAI / Anthropic)
  └── processes message, returns response text
        │
        ▼
OpenClaw Gateway formats response for source platform
        │
        ▼
User receives response in original platform
        │
KiloCode OpenClawTab polls /status for metrics
  (activeChannels, messagesHandled, avgResponseMs)
```

### 2e. SSH → VPS Probe Pipeline (Gap 7 — implementation target)

```
Operator adds VPS server in VPSTab
  └── assigns SSH profile
        │
        ▼
SSHService.connect(profile)
  └── on connection established:
        │
        ▼
VPSService.probeServer(serverId, sshSession)  ← [TO BE IMPLEMENTED]
  ├── uname -a                   → os, kernel, arch
  ├── hostname -f                → FQDN
  ├── uptime -p                  → uptime string
  ├── free -m                    → RAM total/used
  ├── df -h --output=target,pcent,size,used  → disk mounts
  ├── nproc                      → CPU count
  ├── curl -s ifconfig.me        → public IP (3s timeout)
  ├── docker ps --format json    → containers (if docker present)
  └── systemctl list-units --state=running --type=service
                                 → running services
        │
        ▼
VPSService.update(serverId, probeResult)
        │
        ▼
VPSTab reactive update
```

---

## 3. Environment Variable Mapping

**Canonical env var names** — these are the authoritative names. Any code using an alternate name should be migrated to these.

### KiloCode Extension Host

| Variable | Service That Reads It | Default | Purpose |
|----------|-----------------------|---------|---------|
| `HERMES_API_KEY` | `HermesClient`, `hermes-webview.ts`, `memory-webview.ts`, `zeroclaw-webview.ts`, `routing-webview.ts` | `vscode.secrets` first | Auth token for Hermes Bridge API |
| `KILOCODE_API_KEY` | `HermesClient` (fallback) | — | Alias for `HERMES_API_KEY` |
| `MINIMAX_API_KEY` | `HermesClient` (fallback) | — | Alias for `HERMES_API_KEY` |
| `ANTHROPIC_API_KEY` | `HermesClient` (fallback), `RoutingService` | — | Direct Anthropic API key |
| `KILO_HUB_BASE_URL` | `training-webview.ts` | `http://localhost:8095` | Hub base URL for training APIs |
| `KILO_HUB_BASE` | `hermes-webview.ts`, `zeroclaw-webview.ts`, `routing-webview.ts` | `https://hermes.daveai.tech` | Hub base URL (remote default) |
| `KILO_HUB_TOKEN` | `memory-webview.ts` | `vscode.secrets` first | Auth token for Hub API |
| `HUB_URL` | `HubPanel.ts` | `http://localhost:8095` | Hub iframe embed URL |
| `AZURE_SPEECH_KEY` | `ApiKeyScannerService` | — | Azure Cognitive Services TTS key |
| `VITE_AZURE_SPEECH_KEY` | `ApiKeyScannerService` (alias) | — | Build-time alias for Azure key |
| `AZURE_SPEECH_REGION` | `ApiKeyScannerService` | — | Azure region (e.g., `eastus`) |
| `GITHUB_TOKEN` | `ApiKeyScannerService` | — | GitHub API token for PR operations |
| `GH_TOKEN` | `ApiKeyScannerService` (alias) | — | Alias for `GITHUB_TOKEN` |
| `GIT_SSH_COMMAND` | `SSHService` | — | Custom SSH command for git operations |

### CRITICAL: Env Var Fragmentation

> The Hub URL is referenced under **three different names** in the codebase, causing silent misconfiguration:
>
> | Alias | Location | Should Be |
> |-------|----------|-----------|
> | `HUB_URL` | `HubPanel.ts` | `KILO_HUB_BASE_URL` |
> | `KILO_HUB_BASE` | `hermes-webview.ts`, `zeroclaw-webview.ts`, `routing-webview.ts` | `KILO_HUB_BASE_URL` |
> | `KILO_HUB_BASE_URL` | `training-webview.ts` | CANONICAL |
>
> **Action required (HB-6):** Normalize all references to `KILO_HUB_BASE_URL`.

### VS Code Settings Keys

| Setting Key | Used By | Default |
|-------------|---------|---------|
| `kilo-code.new.hermes.enabled` | `HermesStatusService` | `false` |
| `kilo-code.new.hermes.baseUrl` | `HermesStatusService` | `http://187.77.30.206:18789` |
| `kilo-code.new.hermes.approvalMode` | `HermesStatusService` | `"manual"` |
| `kilo-code.new.hermes.workspaceScopeOnly` | `HermesStatusService` | `true` |
| `kiloCode.hermesBaseUrl` | `HubServicesService` | `http://localhost:8000` |
| `daveai.hub.baseUrl` | `AutoUpdateService` | `http://localhost:8082` |
| `kilo.hub.baseUrl` | `training-webview.ts` | `http://localhost:8095` |

> **Note:** `kiloCode.hermesBaseUrl` in `HubServicesService` defaults to `:8000`, which differs from the canonical `:8095`. This is a secondary fragmentation bug.

---

## 4. Port / URL Mapping

### Local Service Ports

| Service | Default Port | Default URL | Config Override |
|---------|-------------|-------------|-----------------|
| **Hermes Bridge / OpenClaw Gateway** | 18789 | `http://187.77.30.206:18789` | `kilo-code.new.hermes.baseUrl` or `KILO_HUB_BASE` |
| **Hub (operations surface)** | 8095 | `http://localhost:8095` | `KILO_HUB_BASE_URL` / `HUB_URL` / `kilo.hub.baseUrl` |
| **Hub (auto-update service)** | 8082 | `http://localhost:8082` | `daveai.hub.baseUrl` |
| **Hub (services watchdog)** | 8000 | `http://localhost:8000` | `kiloCode.hermesBaseUrl` |
| **Shiba / Memory RAG** | 7002 | `http://localhost:7002` | `.kilo/hermes.json` → `.kilo/shiba.json` → `SHIBA_ENDPOINT` |
| **KiloCode CLI Backend** | dynamic | `http://127.0.0.1:{port}` | Auto-selected at startup |
| **Ollama** | 11434 | `http://localhost:11434` | Provider config in RoutingTab |
| **LM Studio** | 1234 | `http://localhost:1234` | Provider config in RoutingTab |
| **OpenClaw Webchat UI** | 18789 | `http://localhost:18789/webchat` | Same as gateway |

### Remote / Cloud URLs

| Service | URL | Auth |
|---------|-----|------|
| **Hub (remote)** | `https://hermes.daveai.tech` | `KILO_HUB_TOKEN` |
| **KiloCode Marketplace API** | `https://api.kilo.ai/api/marketplace` | None (public) |
| **Azure TTS** | `https://{region}.tts.speech.microsoft.com/` | `AZURE_SPEECH_KEY` |
| **Anthropic API** | `https://api.anthropic.com` | `ANTHROPIC_API_KEY` |
| **OpenAI API** | `https://api.openai.com` | Provider config |
| **HuggingFace Hub** | `https://huggingface.co` | `HF_TOKEN` (TrainingTab upload) |

### Hub API Endpoints Used by KiloCode

| Endpoint | Method | Used By |
|----------|--------|---------|
| `/health` | GET | `HermesClient.health()` |
| `/tasks` | POST | `HermesClient.createTask()` |
| `/tasks/{id}` | GET | `HermesClient.getTask()` |
| `/tasks/{id}/events` | GET (SSE) | `HermesPipeline` |
| `/tasks/{id}/approve` | POST | Governance approval flow |
| `/api/services/status` | GET | `HubServicesService` |
| `/api/services/{id}/restart` | POST | HubTab restart (target: HB-2) |
| `/api/training/jobs` | GET/POST | `training-webview.ts` |
| `/api/canonical-settings` | GET | `governance-webview.ts` |
| `/api/runtime/kilocode/sync` | POST | `HubPanel.ts` |

---

## 5. Message Protocol Reference

### WebView → Extension Host (webview postMessage)

All messages follow the shape `{ type: string, ...payload }`.

| Message Type | Handler | Description |
|-------------|---------|-------------|
| `zeroclaw:submit` | `zeroclaw-webview.ts` | Submit a task to ZeroClaw via Hermes |
| `zeroclaw:cancel` | `zeroclaw-webview.ts` | Cancel a running task |
| `zeroclaw:approve` | `zeroclaw-webview.ts` | Approve a pending task |
| `zeroclaw:reject` | `zeroclaw-webview.ts` | Reject a pending task |
| `hermes:ping` | `hermes-webview.ts` | Health-check the Hermes bridge |
| `hermes:saveKey` | `hermes-webview.ts` | Persist Hermes API key to VS Code secrets |
| `hermes:clearKey` | `hermes-webview.ts` | Clear stored Hermes API key |
| `memory:recall` | `memory-webview.ts` | Query the Shiba RAG endpoint |
| `memory:write` | `memory-webview.ts` | Write a memory entry |
| `memory:delete` | `memory-webview.ts` | Delete a memory entry by ID |
| `routing:getHealth` | `routing-webview.ts` | Fetch all provider health statuses |
| `routing:saveConfig` | `routing-webview.ts` | Persist routing config to workspaceState |
| `training:detectGPU` | `training-webview.ts` | Trigger GPU detection |
| `training:getJobs` | `training-webview.ts` | Fetch training job list |
| `training:launchJob` | `training-webview.ts` | Submit a new training job |
| `training:cancelJob` | `training-webview.ts` | Cancel a running training job |
| `governance:seedDefaults` | `governance-webview.ts` | Seed default dangerous actions + risk behaviors |
| `governance:getAuditLog` | `governance-webview.ts` | Fetch governance audit log |
| `ssh:getProfiles` | `ssh-webview.ts` | Load SSH profiles |
| `ssh:connect` | `ssh-webview.ts` | Initiate SSH connection |
| `ssh:disconnect` | `ssh-webview.ts` | Disconnect SSH session |
| `ssh:generateKey` | `ssh-webview.ts` | Generate new SSH key pair |
| `vps:getServers` | `vps-webview.ts` | Load VPS server list |
| `vps:getMetrics` | `vps-webview.ts` | Fetch metrics for a server |
| `vps:deploy` | `vps-webview.ts` | Trigger deployment on a VPS |
| `vps:rollback` | `vps-webview.ts` | Roll back last deployment |
| `speech:*` | `SpeechTab` | All speech messages handled in-webview via `speak()` / Azure SDK |

### Extension Host → WebView (extension postMessage)

| Message Type | Sent By | Description |
|-------------|---------|-------------|
| `zeroclaw:taskStatus` | `HermesPipeline` | SSE-proxied task state update |
| `hermes:healthResult` | `hermes-webview.ts` | Ping result {ok, latency_ms, version} |
| `memory:recallResult` | `memory-webview.ts` | Recall query results |
| `routing:healthUpdate` | `routing-webview.ts` | Provider health snapshot |
| `training:gpuDetected` | `training-webview.ts` | GPU detection result |
| `training:jobUpdate` | `training-webview.ts` | Job progress update |
| `governance:auditLog` | `governance-webview.ts` | Audit log entries |
| `ssh:profiles` | `ssh-webview.ts` | Profile list |
| `ssh:sessionStatus` | `ssh-webview.ts` | Connection status change |
| `vps:servers` | `vps-webview.ts` | Server list |
| `vps:metrics` | `vps-webview.ts` | Metrics snapshot |

---

## 6. Security Boundaries

### Trust Zones

```
Zone 1: VS Code Extension Host (trusted)
  - Full Node.js access
  - Holds all API keys (via vscode.secrets or process.env)
  - Makes all outbound HTTP calls
  - Never sends raw API keys to webview

Zone 2: VS Code Webview (semi-trusted)
  - SolidJS/browser context
  - No direct network access (CSP enforced)
  - Communicates via postMessage only
  - Receives sanitized data from Zone 1
  - NEVER receives API keys

Zone 3: External Services (untrusted)
  - Hermes Bridge, Hub, Shiba, AI Providers
  - All calls from Zone 1 only
  - Auth via HERMES_API_KEY / KILO_HUB_TOKEN (Bearer tokens)
  - TLS required for all remote URLs

Zone 4: Local AI Services (local-trusted)
  - Ollama (:11434), LM Studio (:1234)
  - No auth required (localhost only)
  - Treated as trusted when privacy_mode == "local_preferred"
```

### Secret Storage Priority (HermesClient, in order)

1. `vscode.secrets.get(HERMES_SECRET_KEY)` — VS Code encrypted secret store
2. `process.env.HERMES_API_KEY`
3. `process.env.KILOCODE_API_KEY`
4. `process.env.MINIMAX_API_KEY`
5. `process.env.ANTHROPIC_API_KEY`
6. `undefined` → unauthenticated requests (Hermes may still respond to health pings)

### Approval Gate Architecture

```
Action requested
     │
     ▼
GovernanceService.checkAction(action, actor)
     ├── lookup action in DangerousAction catalog
     ├── check actor.tier >= action.minimumTier
     │     if FAIL → throw GovernanceError("insufficient tier")
     ├── check action.requiresApproval
     │     if TRUE → create ApprovalRecord{status:"pending"}
     │               send to Hermes for quorum check
     │               wait for ApprovalRecord{status:"approved"/"rejected"}
     │     if FAIL → throw GovernanceError("approval rejected")
     └── if all pass → allow action, write ApprovalRecord{status:"auto"} to audit log
```
