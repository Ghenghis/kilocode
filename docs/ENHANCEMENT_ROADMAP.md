# KiloCode Ecosystem — Enhancement Roadmap

> **Branch context:** `feat/azure-voice-studio` → `integration/main`
> **Last updated:** 2026-04-28
> **Scope:** All 11 custom SolidJS settings tabs + their backing Node.js services
> **Owner:** KiloCode Agents

---

## How to Read This Document

Each tab section contains:
- **Current state** — what is actually wired up today (verified against source)
- **Target state** — what it should be after all three phases complete
- **Phase 1 items** — critical fixes + SOTA feature additions (ship first)
- **Phase 2 items** — polish, UX consistency, animation, error states
- **Phase 3 items** — E2E test matrix

Success criteria are measurable: a criterion is met when an automated check can assert it without human judgment.

---

## Phase Overview

| Phase | Theme | Target Completion |
|-------|-------|-------------------|
| 1 — Critical & SOTA | Fix broken flows; add game-changing features | 6 weeks from kick-off |
| 2 — Polish | UX consistency; design system alignment | 4 weeks after Phase 1 |
| 3 — Verification | E2E test matrix; coverage gates | 3 weeks after Phase 2 |

---

## Global Success Criteria (apply to all tabs)

| # | Criterion | Measurable Bar |
|---|-----------|----------------|
| G1 | No tab opens in an empty/broken state | 0 tabs with 0 data-testid="empty-state-error" on fresh install |
| G2 | Every destructive action has a confirmation step | 100% of actions tagged `riskLevel="high"/"critical"` show confirm dialog |
| G3 | All HTTP calls have a 5s timeout and surface the error in-tab | 0 calls without `AbortSignal.timeout` |
| G4 | State persists across VS Code restarts | All settings round-trip through `workspaceState` or `secrets` |
| G5 | No console errors on tab mount | 0 uncaught exceptions per tab in Playwright trace |
| G6 | All env-var overrides documented in one canonical location | `docs/ARCHITECTURE.md` env table is source of truth |

---

## Tab 1 — ZeroClawTab (AI Provider Multi-Target Execution Engine)

### Current State
- Task submission form: project path, risk level, workspace scope, network/write policy, resource limits
- Task list with status badges (queued/running/completed/failed/blocked)
- Approval records panel
- Circuit breaker display (closed/open/half-open)
- Rate-limit monitor for endpoints
- Template gallery (3 templates)
- **Gaps:** Task form is blank on mount (Gap 9 from master roadmap — auto-fill not wired). No real-time log streaming. No cost estimation before submission. No diff preview of changed files. Templates cannot be saved by the user.

### Target State
ZeroClaw tab functions as a full execution cockpit: workspace path pre-filled, risk inferred from task description via NLP heuristic, real-time log tail during execution, cost estimate shown before approval, changed-file diff viewable inline, and user-defined templates persisted in `workspaceState`.

### Phase 1 — Critical Fixes + SOTA Features

| ID | Item | Rationale |
|----|------|-----------|
| ZC-1 | Auto-fill `projectPath` from active VS Code workspace folder on mount | Gap 9 fix — tab is useless blank |
| ZC-2 | Auto-fill `workspaceScope` default from workspace root | Prevents scope misconfig on first run |
| ZC-3 | Wire real-time SSE log streaming from `GET /tasks/{id}/events` into the log panel | Core feature — operators need live logs |
| ZC-4 | Add pre-submission cost estimate: call `GET /estimate` on Hermes before confirm | SOTA: gate on cost, not just risk |
| ZC-5 | Semantic risk inference: analyze task description text and auto-suggest `riskLevel` | SOTA: LLM-assisted risk triage |
| ZC-6 | Persist user-defined task templates in `workspaceState` (add/edit/delete UI) | Required for operator efficiency |
| ZC-7 | Changed-files diff viewer: after task completion, show inline git diff for each `changedFile` | SOTA: traceability per execution |
| ZC-8 | Circuit-breaker manual reset button (currently read-only) | Operators need break-glass control |
| ZC-9 | Export task history as JSONL (for audit feeds) | Governance requirement |

### Phase 2 — Polish

| ID | Item |
|----|------|
| ZC-P1 | Add CSS transition on task status badge state changes (queued→running→done) |
| ZC-P2 | Collapse completed tasks older than 24h into an accordion by default |
| ZC-P3 | Show sparkline of last 10 task durations next to each template |
| ZC-P4 | Empty state illustration when no tasks have ever been submitted |
| ZC-P5 | Keyboard shortcut `Ctrl+Enter` to submit task from description field |

### Phase 3 — E2E Tests

| Test ID | Scenario | Assert |
|---------|----------|--------|
| ZC-E1 | Mount tab with active workspace → projectPath is pre-filled | `data-testid="project-path"` value === workspaceFolder |
| ZC-E2 | Submit low-risk task → status transitions queued→running→completed | Status badge sequence matches |
| ZC-E3 | Submit high-risk task → approval gate appears | `data-testid="approval-dialog"` visible |
| ZC-E4 | Circuit-breaker shows "open" when provider 503s three times | Badge reads "open" |
| ZC-E5 | Export JSONL → file contains all task records | Row count matches task list length |

---

## Tab 2 — OpenClawTab (Multi-Platform AI Gateway, 20+ Channels)

### Current State
- 21 channel types supported in the type definition
- Channel list with status badges (active/idle/error/unconfigured)
- Model assignment per channel
- Agent assignment per channel
- Routing rules (pattern → action)
- Gateway health card (URL, latency, uptime, active channels, messages today)
- **Gaps:** No in-tab webhook URL builder (operators must manually construct URLs). No channel health history (sparklines). No per-channel cost breakdown. No bulk-enable/disable. Message replay from DLQ is typed but not wired in UI. No HTTPS/TLS status indicator.

### Target State
OpenClaw tab is a full gateway operations dashboard: all 21 channels configurable with one-click webhook URL copy, per-channel message throughput sparklines, DLQ replay UI, and bulk operations. Cost per channel visible.

### Phase 1 — Critical Fixes + SOTA Features

| ID | Item | Rationale |
|----|------|-----------|
| OC-1 | One-click webhook URL builder: auto-generate `{gatewayUrl}/webhook/{channelId}` with copy button | Eliminates #1 operator friction point |
| OC-2 | Per-channel message throughput sparkline (last 60 min, 1-min buckets) | SOTA: real-time observability |
| OC-3 | Dead-letter queue (DLQ) replay UI: list failed messages, one-click retry per message | SOTA: message resilience |
| OC-4 | Bulk enable/disable all channels in a single toggle (with confirmation) | Operator efficiency for maintenance windows |
| OC-5 | Per-channel cost breakdown: estimated USD cost for messages today | Cost governance |
| OC-6 | TLS/HTTPS status badge for gateway URL (green lock vs. red warning) | Security hygiene |
| OC-7 | Channel test message: send `ping` and assert response within 2s | Replaces manual debugging |
| OC-8 | Model capability filter: only show models that support the channel's message types | Prevents misconfiguration |
| OC-9 | Context-aware routing: route by channel type AND message intent (keyword/regex match) | SOTA: intent-aware omnichannel routing |

### Phase 2 — Polish

| ID | Item |
|----|------|
| OC-P1 | Group channels into categories (Social, Messaging, Developer, Custom) with collapse |
| OC-P2 | Channel card skeleton loader while status is being fetched |
| OC-P3 | "Last active" relative timestamp under each channel name |
| OC-P4 | Color-coded status dots with pulse animation for "active" state |
| OC-P5 | Drag-to-reorder routing rules (currently only priority number edit) |

### Phase 3 — E2E Tests

| Test ID | Scenario | Assert |
|---------|----------|--------|
| OC-E1 | Enable Telegram channel → webhook URL auto-populates | URL field contains `/webhook/telegram` |
| OC-E2 | Send test message to active channel → response within 2s | Toast shows "OK" |
| OC-E3 | DLQ has 3 failed messages → replay all → DLQ count goes to 0 | DLQ badge reads "0" |
| OC-E4 | Gateway offline → all channel badges show "error" within 10s | Badge count equals channel count |
| OC-E5 | Bulk disable all → gateway reports 0 active channels | Status card `activeChannels` === 0 |

---

## Tab 3 — HermesTab (LLM Pipeline / Message Broker)

### Current State
- Enable/disable toggle with URL config
- Approval mode selector (auto-all / auto-low / manual)
- Live health ping (on-demand + auto-refresh)
- API key management (store/clear via VS Code secrets)
- Agent-Assist panel
- Active task tracker with state machine
- Channel info list (active/stale/error, queue depth)
- Message trace panel (direction, size, latency, status, preview)
- Dead-letter entries
- Queue stats (pendingCount, throughputPerMin, bytesInToday)
- **Gaps:** No throughput history chart. No SLA breach alerts. No message schema validator. Pipeline stages not visualized. No approval escalation path when approver is offline.

### Target State
Hermes tab provides a full pipeline control plane: throughput chart (last 24h), SLA breach counter, pipeline stage diagram showing which stage each active task is in, and approval escalation with fallback designees.

### Phase 1 — Critical Fixes + SOTA Features

| ID | Item | Rationale |
|----|------|-----------|
| H-1 | Pipeline stage diagram: visualize active tasks on the state machine (queued→planning→awaiting_approval→executing→validating→done) | SOTA: real-time pipeline observability |
| H-2 | Throughput history sparkline: messages/min over last 60 minutes (store in `workspaceState`, ring buffer of 60 entries) | Capacity planning visibility |
| H-3 | SLA breach counter: track tasks exceeding configured timeout, show badge | Operations-critical |
| H-4 | Approval escalation config: if primary approver is offline > N minutes, auto-escalate to secondary | SOTA: resilient approval chains |
| H-5 | Message schema validator: paste a task envelope, validate against the `TaskEnvelope` schema, show errors inline | Developer productivity |
| H-6 | Channel health history: per-channel status history over last 10 checks | Replaces "stale" status ambiguity |
| H-7 | Priority lanes: allow tagging tasks as "urgent" to jump the queue (requires Hermes API support) | SOTA: priority-aware message brokering |
| H-8 | Auto-reconnect with exponential backoff + jitter (currently simple interval) | Network resilience |

### Phase 2 — Polish

| ID | Item |
|----|------|
| H-P1 | Animated progress bar inside pipeline stage diagram |
| H-P2 | Dead-letter entries show message preview on hover (tooltip) |
| H-P3 | Queue stats update with a subtle flash animation on change |
| H-P4 | Connection status badge transitions animate (smooth color change) |
| H-P5 | Keyboard shortcut to trigger manual health ping |

### Phase 3 — E2E Tests

| Test ID | Scenario | Assert |
|---------|----------|--------|
| H-E1 | Hermes offline → health badge shows "error" within auto-refresh interval | Badge reads "error" |
| H-E2 | Task submitted → pipeline stage diagram updates through all states | Each stage highlighted in sequence |
| H-E3 | Throughput ring buffer fills 60 entries → oldest entry evicted | Buffer length stays at 60 |
| H-E4 | SLA threshold exceeded → breach counter increments | Counter > 0 |
| H-E5 | API key stored → tab reloads → key source reads "secret" | `keySource` === "secret" |

---

## Tab 4 — HubTab (Operations Surface)

### Current State
- Configurable Hub URL with presets (8082/8090/3000/5000/custom)
- Connection timeout config
- Live summary: services up/total, audit gates, PRs, quota %, secret-scan
- Auto-refresh (5s/15s/30s/60s)
- Exponential backoff on failures (1→2→4…30s) with countdown
- Port conflict detection (phpMyAdmin warning)
- Last-connected timestamp
- Quota progress bar
- **Gaps:** No historical uptime chart per service. No one-click service restart from tab. No comparison between environments (local vs. remote Hub). No PR merge readiness score. Secret-scan results not linkable to source file.

### Target State
Hub tab is a unified operations pane: per-service uptime spark chart, one-click restart with approval, environment comparison (local vs. remote), and PR merge readiness that includes test coverage and secret-scan pass/fail.

### Phase 1 — Critical Fixes + SOTA Features

| ID | Item | Rationale |
|----|------|-----------|
| HB-1 | Per-service uptime sparkline: last 10 health checks stored in `workspaceState` | SOTA: time-series service health |
| HB-2 | One-click service restart: call `POST /api/services/{id}/restart` with confirm dialog | Operations requirement |
| HB-3 | Environment switcher: toggle between Local (8095) and Remote (hermes.daveai.tech) with diff view | Operators work across two environments |
| HB-4 | PR merge readiness score: aggregate test status + secret-scan + audit gates into 0–100 score | SOTA: unified release gate |
| HB-5 | Secret-scan result drill-down: click a hit-kind to see file path + line number | Actionable security visibility |
| HB-6 | Normalize HUB URL env vars: settle on `KILO_HUB_BASE_URL` everywhere (currently `HUB_URL`, `KILO_HUB_BASE`, `KILO_HUB_BASE_URL` all exist) | Critical: env var fragmentation causes silent misconfig |
| HB-7 | Status bar integration: Hub service count already shown; wire it to update from HubTab state | Avoid duplicate polling |

### Phase 2 — Polish

| ID | Item |
|----|------|
| HB-P1 | Quota progress bar turns red at >80%, animates pulsing |
| HB-P2 | Services list sorts: down services always first |
| HB-P3 | Audit gate summary expands to show which gates are failing |
| HB-P4 | "Last connected Xm ago" updates every 30s without full refresh |
| HB-P5 | Skeleton loader cards during initial fetch |

### Phase 3 — E2E Tests

| Test ID | Scenario | Assert |
|---------|----------|--------|
| HB-E1 | Hub at 8095 reachable → connected badge within 5s | Badge === "connected" |
| HB-E2 | 3 consecutive failures → backoff reaches 4s → shown in countdown | Countdown text contains "4s" |
| HB-E3 | phpMyAdmin detected on configured port → warning banner visible | Warning banner `data-testid="port-conflict"` visible |
| HB-E4 | Service restart clicked → confirm dialog → restart call made | `POST /api/services/{id}/restart` in network log |
| HB-E5 | Auto-refresh 5s → data updates every 5s ± 1s | 6 fetches within 30s window |

---

## Tab 5 — VPSTab (VPS Server Management)

### Current State
- Server list with status (online/offline/degraded/unknown)
- Metrics panel: CPU, RAM, disks
- Service list per server (running/stopped/failed, PID, CPU%, mem%)
- Docker container list (name, image, status, ports)
- Deploy history with rollback availability
- Sparkline: last 10 response times per server
- **Gaps:** Gap 7 from master roadmap — no "probe on SSH connect" pipeline. Server inventory fields empty until manually entered. No alerting threshold config. No log tail from remote services. No Caddy/nginx config view. No multi-server comparison.

### Target State
VPS tab auto-populates server inventory on first SSH connection (hostname, distro, uptime, CPU/RAM/disk, Docker, services, public IP via safe read-only probe). Alert thresholds configurable per-server. Service logs streamable in-tab.

### Phase 1 — Critical Fixes + SOTA Features

| ID | Item | Rationale |
|----|------|-----------|
| VPS-1 | Safe read-only probe pipeline: on SSH connect, run `uname -a`, `uptime`, `free -m`, `df -h`, `docker ps`, `systemctl list-units --state=running` and populate server fields automatically | Gap 7 fix — critical for usability |
| VPS-2 | Alert threshold config per server: CPU %, RAM %, disk % with configurable thresholds → VS Code notification on breach | SOTA: proactive ops alerting |
| VPS-3 | Remote service log tail: click a service → stream last 100 lines of `journalctl -u {service} -n 100 -f` into in-tab terminal panel | SOTA: embedded log streaming |
| VPS-4 | Multi-server comparison view: side-by-side metric cards for all servers | Enables fleet health at a glance |
| VPS-5 | One-click rollback with pre/post health check: verify service is running after rollback before marking success | SOTA: gated rollback |
| VPS-6 | Public IP detection: include `curl -s ifconfig.me` in safe probe (non-blocking, timeout 3s) | Eliminates manual IP entry |
| VPS-7 | Caddy/nginx config preview: `cat /etc/caddy/Caddyfile` or `/etc/nginx/nginx.conf` inline in expandable panel | Operational transparency |

### Phase 2 — Polish

| ID | Item |
|----|------|
| VPS-P1 | CPU/RAM metrics shown as mini gauge rings, not just numbers |
| VPS-P2 | Deploy history timeline visualization (horizontal) |
| VPS-P3 | Server status dots pulse green/red/amber |
| VPS-P4 | Docker container badge shows port mappings on hover |
| VPS-P5 | Multi-server sparklines aligned on shared time axis |

### Phase 3 — E2E Tests

| Test ID | Scenario | Assert |
|---------|----------|--------|
| VPS-E1 | Add server + SSH connects → hostname auto-populated | Hostname field non-empty |
| VPS-E2 | CPU > threshold → VS Code notification fires | Notification toast visible |
| VPS-E3 | Click rollback → confirm → POST rollback → health check passes | Deploy entry status === "success" |
| VPS-E4 | Log tail opened → 100 lines appear within 5s | Line count >= 100 |
| VPS-E5 | Multi-server view → all servers shown simultaneously | Card count matches server count |

---

## Tab 6 — SSHTab (SSH Key / Connection Manager)

### Current State
- SSH profile management (name, host, port, user, authMode, keyPath, jumpHost, group, labels, connectionTimeoutMs)
- Session status (disconnected/connecting/connected/error)
- Remote file browser (tree, expand)
- Connection log panel
- Known-hosts management (list, add, remove)
- Key generation (RSA/ED25519) with fingerprint display
- Connection attempt history
- Error history with codes
- **Gaps:** Known-hosts parser not wired (Gap 6 from master roadmap). No SSH agent (key forwarding) config. No port-forward tunnel management. No TOFU (Trust On First Use) UI for new host keys. No key rotation reminder (warn if key > N days old).

### Target State
SSH tab is a complete connection manager: known-hosts fully parsed and displayed, TOFU dialog on unknown host, port-forward tunnels manageable in-tab, SSH agent config, and key age warnings.

### Phase 1 — Critical Fixes + SOTA Features

| ID | Item | Rationale |
|----|------|-----------|
| SSH-1 | Wire known-hosts parser: call `sshGetKnownHosts` and display results in Known Hosts panel | Gap 6 fix — panel currently empty |
| SSH-2 | TOFU dialog: on first connection to unknown host, show key fingerprint and ask "Trust permanently / Trust once / Reject" | SOTA: security-correct host verification |
| SSH-3 | Port-forward tunnel manager: configure `LocalPort:RemoteHost:RemotePort` tunnels, start/stop per tunnel | SOTA: developer productivity |
| SSH-4 | SSH agent forwarding toggle per profile (`ForwardAgent yes/no`) | Required for jump-host workflows |
| SSH-5 | Key age warning: if `keyPath` file mtime > 365 days, show amber warning badge with "Rotate" button | Security hygiene SOTA |
| SSH-6 | Bulk import from 1Password/Bitwarden CLI (detect `op` or `bw` in PATH, list SSH keys) | SOTA: secret manager integration |
| SSH-7 | Connection latency histogram: last 20 connect times shown per profile | Diagnosing slow hosts |

### Phase 2 — Polish

| ID | Item |
|----|------|
| SSH-P1 | Profile groups collapsible with per-group connection count badge |
| SSH-P2 | "Copy public key" button next to key fingerprint display |
| SSH-P3 | Status dot animates connecting → connected with brief flash |
| SSH-P4 | Known-hosts table sortable by hostname |
| SSH-P5 | Error history entries expire after 7 days (auto-prune) |

### Phase 3 — E2E Tests

| Test ID | Scenario | Assert |
|---------|----------|--------|
| SSH-E1 | Import `~/.ssh/config` → profiles list non-empty | Profile count > 0 |
| SSH-E2 | Connect to unknown host → TOFU dialog appears | Dialog `data-testid="tofu-dialog"` visible |
| SSH-E3 | Generate ED25519 key → fingerprint appears | Fingerprint field non-empty |
| SSH-E4 | Add tunnel config → start tunnel → `data-testid="tunnel-status"` shows "active" | Status === "active" |
| SSH-E5 | Key older than 365 days → rotation warning badge visible | Badge `data-testid="key-age-warning"` visible |

---

## Tab 7 — TrainingTab (Local GPU / Model Training Management)

### Current State
- Dataset registration (JSONL/Parquet/CSV/folder formats)
- Dataset validation (passed/failed/pending)
- Dataset preview (row sample)
- Duplicate check
- Training job creation (LoRA/QLoRA/custom presets)
- Hyperparameter config (LR, epochs, batch size, warmup steps)
- Resource limits (max GPU MB, timeout)
- Job status tracker with progress bar
- Loss history display
- Checkpoint management
- GPU detection (via `trainingDetectGPU` — Gap 5 completed)
- Consent settings
- **Gaps:** No loss curve chart (only raw history). No comparison between runs. No VRAM usage estimate before launch. No model export pipeline to Ollama/HuggingFace. Dataset annotation UI types exist but not rendered.

### Target State
Training tab provides a full local fine-tuning workbench: live loss curve chart, run comparison, VRAM estimate before launch, dataset annotation UI, and one-click export to Ollama or push to HuggingFace.

### Phase 1 — Critical Fixes + SOTA Features

| ID | Item | Rationale |
|----|------|-----------|
| TR-1 | Live loss curve chart: render `lossHistory` array as an SVG line chart updating in real-time during run | SOTA: training observability |
| TR-2 | VRAM estimate before launch: formula `(model_params × precision_bytes × 1.2) / 1e9` GB, shown as gauge vs. available VRAM | Prevents OOM crashes — SOTA |
| TR-3 | Run comparison table: select multiple completed runs and compare loss, duration, LR, batch size side-by-side | SOTA: experiment tracking |
| TR-4 | Dataset annotation UI: render `DatasetItem` cards with Accept/Reject/Edit actions, store annotations in `workspaceState` | Enables iterative dataset curation |
| TR-5 | One-click Ollama export: on job completion, call `ollama create <model>` with the checkpoint path | SOTA: inference-ready workflow |
| TR-6 | HuggingFace push: `huggingface-cli upload` wrapper in the backend, progress shown in tab | SOTA: model sharing workflow |
| TR-7 | QLoRA 4-bit quantization config: expose `load_in_4bit`, `bnb_4bit_quant_type`, `bnb_4bit_compute_dtype` as form fields | SOTA: 2026 default quantization path |
| TR-8 | Checkpoint auto-resume: detect existing checkpoints for a job, offer "resume from step N" on relaunch | Resilience: prevents restarting from scratch |

### Phase 2 — Polish

| ID | Item |
|----|------|
| TR-P1 | Loss curve shows vertical dotted lines at epoch boundaries |
| TR-P2 | GPU VRAM gauge animates fill on update |
| TR-P3 | Checkpoint list shows size-on-disk badge |
| TR-P4 | Dataset preview table virtualizes rows (only render visible rows) |
| TR-P5 | Run comparison highlights best (lowest loss) cell in green |

### Phase 3 — E2E Tests

| Test ID | Scenario | Assert |
|---------|----------|--------|
| TR-E1 | Register valid JSONL dataset → validation status becomes "passed" | Status badge === "passed" |
| TR-E2 | Launch training job → loss curve chart renders with > 0 data points | SVG path element visible |
| TR-E3 | VRAM estimate shown before launch for 7B model on RTX 4060 | Estimate element non-empty |
| TR-E4 | Annotate 5 rows → annotations persisted across tab unmount/remount | Annotation count === 5 |
| TR-E5 | Duplicate check → result shows pair count | Pair count element visible |

---

## Tab 8 — MemoryTab (Shiba Memory / RAG System)

### Current State
- Memory entry list (fact/preference/instruction/code-snippet/decision)
- Scope filter (global/project/task)
- Recall query with relevance score
- Write history log
- Agent permission matrix (which agents can read which scopes)
- Agent recall trace (audit: who searched, what was returned)
- Connection status to Shiba endpoint (default: `http://localhost:7002`)
- Connection events log
- Token usage graph
- **Gaps:** No embedding visualization. No memory graph view (relationships between entries). No bulk import. No memory decay / TTL configuration. No semantic de-duplication. Recall uses TF-IDF in MemoryService — no vector search yet.

### Target State
Memory tab operates as a hybrid RAG control panel: vector search (replace TF-IDF with embeddings), semantic de-duplication, memory graph visualization, TTL/decay config, and bulk import from external knowledge bases.

### Phase 1 — Critical Fixes + SOTA Features

| ID | Item | Rationale |
|----|------|-----------|
| MEM-1 | Upgrade recall from TF-IDF to embedding-based semantic search: integrate `all-MiniLM-L6-v2` (384-dim) via local Ollama or remote endpoint | SOTA: 15–25% recall quality improvement |
| MEM-2 | Semantic de-duplication: before writing a new entry, compute cosine similarity against top-5 candidates, warn if similarity > 0.92 | Prevents memory bloat |
| MEM-3 | TTL/decay config: allow per-scope TTL (global: never, project: 90d, task: 7d) with auto-expiry background job | SOTA: temporal memory management |
| MEM-4 | Memory graph visualization: render entries as nodes, shared-tags and common-project as edges in a force-directed SVG | SOTA: GraphRAG locality |
| MEM-5 | Bulk import: accept JSONL file with entries in the `MemoryEntry` schema, validate and insert | Enables knowledge base migration |
| MEM-6 | Hindsight reflection: after each task completion, trigger a "what did we learn?" pass and auto-generate memory entries | SOTA: Mem0-style retention+reflection |
| MEM-7 | Token budget dashboard: show total tokens across all entries vs. configurable max budget, warn at 80% | Cost governance for RAG context |

### Phase 2 — Polish

| ID | Item |
|----|------|
| MEM-P1 | Recall result cards show relevance score as a colored bar |
| MEM-P2 | Tag cloud visualization for all unique tags in the memory store |
| MEM-P3 | Connection event log auto-scrolls to bottom on new event |
| MEM-P4 | Write history entries collapsible, default to showing only today |
| MEM-P5 | Memory graph nodes color-coded by `factType` |

### Phase 3 — E2E Tests

| Test ID | Scenario | Assert |
|---------|----------|--------|
| MEM-E1 | Write a memory entry → entry appears in list | Entry count increases by 1 |
| MEM-E2 | Recall query → results include relevance scores | All result cards have score > 0 |
| MEM-E3 | Duplicate entry attempt → similarity warning shown | Warning `data-testid="duplicate-warning"` visible |
| MEM-E4 | Bulk import 10 entries from JSONL → all 10 appear in list | Entry count increases by 10 |
| MEM-E5 | Connection to Shiba drops → status shows "disconnected" within auto-refresh | Status === "disconnected" |

---

## Tab 9 — GovernanceTab (Agent Approval Gates / Audit)

### Current State
- Authority tier system (observer/operator/admin/superadmin)
- Tier assignments list
- Approval records (pending/approved/rejected)
- Dangerous action catalog (pre-seeded with 8 actions — Gap 10 completed)
- Audit log (actor, action, risk, result, details)
- Release verdicts (pass/conditional_pass/fail)
- Risk thresholds config
- Policy decision log (rule matched, command, actor, outcome)
- **Gaps:** No release checklist template. No rollback plan template. Authority tier pre-population not wired. No RBAC export for external systems. No anomaly detection on audit log (unusual action patterns).

### Target State
Governance tab provides a full compliance control plane: RBAC export (JSON/CSV), release checklists, rollback plan templates, anomaly alerts on unusual audit patterns, and GDPR/EU AI Act compliance flags.

### Phase 1 — Critical Fixes + SOTA Features

| ID | Item | Rationale |
|----|------|-----------|
| GOV-1 | Release checklist template: pre-populate with standard gates (tests green, security scan clean, quota OK, rollback plan verified) | Gap 10 completion |
| GOV-2 | Rollback plan template builder: structured form (trigger condition, commands, verification steps, owner) | Gap 10 completion |
| GOV-3 | RBAC export: export tier assignments + dangerous action catalog as JSON or CSV for external system import | Enterprise integration |
| GOV-4 | Audit anomaly detection: flag when a single actor performs > 10 high-risk actions in 1 hour | SOTA: behavioral analytics |
| GOV-5 | EU AI Act compliance flags: mark each dangerous action with applicable regulatory categories (transparency, human oversight, safety) | 2026 regulatory requirement |
| GOV-6 | Approval escalation SLA: if pending approval sits > configured minutes, auto-escalate to next tier and notify | Prevents approval queue jam |
| GOV-7 | Policy rule editor: drag-and-drop rule reordering (currently only priority number) | Operator UX critical |

### Phase 2 — Polish

| ID | Item |
|----|------|
| GOV-P1 | Audit log shows risk level as color-coded row background |
| GOV-P2 | Pending approval records show elapsed time since creation |
| GOV-P3 | Release verdict badge animated (spinning while verdict computing) |
| GOV-P4 | Dangerous action catalog groups actions by service |
| GOV-P5 | Authority tier assignment form validates email format |

### Phase 3 — E2E Tests

| Test ID | Scenario | Assert |
|---------|----------|--------|
| GOV-E1 | Submit high-risk action → pending approval record created | Record visible in approval list |
| GOV-E2 | Approve action → record status changes to "approved" | Status === "approved" |
| GOV-E3 | Export RBAC → downloaded JSON contains tier assignments | File non-empty, valid JSON |
| GOV-E4 | > 10 high-risk actions in 1h by same actor → anomaly flag shown | Warning banner visible |
| GOV-E5 | Audit log filters by risk level "critical" → only critical rows shown | All visible rows have risk === "critical" |

---

## Tab 10 — SpeechTab (TTS / STT Configuration)

### Current State
- Azure Cognitive Services TTS integration
- Voice picker with locale filter and search
- Push-to-talk keybinding config (modifier + key)
- STT locale selection (22 BCP-47 locales)
- Volume control
- Pronunciation dictionary (custom entries)
- Voice presets (save/load/apply)
- Playback test
- `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` env var detection
- **Gaps:** No local TTS fallback (when Azure key absent). No real-time STT transcription preview. No voice clone integration. No speaker diarization config. No offline mode for STT (Whisper.cpp). No noise suppression toggle.

### Target State
Speech tab supports both cloud (Azure) and local (Whisper.cpp for STT, Kokoro/Piper for TTS) backends, with seamless fallback. Real-time transcription preview. Speaker-aware config for multi-user environments.

### Phase 1 — Critical Fixes + SOTA Features

| ID | Item | Rationale |
|----|------|-----------|
| SP-1 | Local TTS fallback: if no Azure key, auto-detect Piper or Kokoro on PATH and use instead | SOTA: offline-capable TTS |
| SP-2 | Whisper.cpp STT integration: configure `whisper-server` endpoint or embedded Whisper WASM for offline STT | SOTA: privacy-preserving local STT |
| SP-3 | Real-time STT transcription preview: show live rolling transcript in a panel while push-to-talk is held | SOTA: visual confirmation of STT |
| SP-4 | Noise suppression toggle: apply WebRTC noise suppression to STT mic input | SOTA: quality improvement in noisy envs |
| SP-5 | Voice preview: clicking a voice in the picker plays a 5-word sample using that exact voice | Eliminates blind voice selection |
| SP-6 | Multi-provider fallback chain: Azure → ElevenLabs → Kokoro → Piper (configurable priority list) | Resilience |
| SP-7 | Pronunciation dictionary bulk import from CSV | Operator efficiency for domain-specific terms |

### Phase 2 — Polish

| ID | Item |
|----|------|
| SP-P1 | Voice picker shows latency estimate (cloud vs. local badges) |
| SP-P2 | Push-to-talk key recording: click "Record shortcut" and press the desired keys |
| SP-P3 | Volume slider shows live waveform from mic while STT is active |
| SP-P4 | Preset cards show voice name + locale flag |
| SP-P5 | Pronunciation dictionary sortable by word, searchable |

### Phase 3 — E2E Tests

| Test ID | Scenario | Assert |
|---------|----------|--------|
| SP-E1 | Azure key set → voice list loads > 0 voices | Voice count > 0 |
| SP-E2 | No Azure key, Piper on PATH → fallback TTS uses Piper | Provider label shows "Piper" |
| SP-E3 | Click voice preview → audio plays within 2s | Audio element `playing` === true |
| SP-E4 | Bulk import 10 pronunciation entries → dictionary shows 10 entries | Count === 10 |
| SP-E5 | PTT key recorded → shortcut appears in key display | Key field non-empty |

---

## Tab 11 — RoutingTab (Provider Routing Strategies)

### Current State
- Provider health dashboard (healthy/degraded/offline/unconfigured)
- Circuit breaker status per provider (closed/open/half-open)
- Request + failure counts, estimated cost per provider
- Route decision log with trace steps
- Routing config (auto/manual mode, fallback order, privacy mode, cost threshold)
- Named routing rules with priority (drag-reorder types exist but not wired)
- Recent latency sparklines per provider
- **Gaps:** Drag-reorder not wired in UI (only priority-number editing). No semantic routing (route by task content). No cost forecast for routing config change. No provider capability matrix visible from this tab. No latency percentile breakdown (only last-10).

### Target State
Routing tab provides intelligent routing with semantic content-aware dispatch, cost forecasting, full provider capability matrix, and P50/P95/P99 latency breakdown.

### Phase 1 — Critical Fixes + SOTA Features

| ID | Item | Rationale |
|----|------|-----------|
| RT-1 | Wire drag-reorder for routing rules: implement `@solid-dnd` drag-and-drop for the rules list | Currently typed but not rendered |
| RT-2 | Semantic routing: add a routing rule condition type "task_intent" using keyword/regex on user_intent field | SOTA: content-aware routing |
| RT-3 | Cost forecast: when user changes fallback order, show projected cost delta vs. current config based on last 7d traffic | SOTA: cost-aware routing config |
| RT-4 | P50/P95/P99 latency breakdown per provider: store latency ring buffer (100 entries), compute percentiles | SOTA: proper latency measurement |
| RT-5 | Provider capability matrix inline: show a compact version of `ProviderCapabilityMatrix` filtered to active providers | Routing-time capability check |
| RT-6 | Auto-healing routing: if a provider's circuit breaker opens, automatically promote the next provider in fallback order without user action | SOTA: zero-touch failover |
| RT-7 | Budget cap enforcement: if `estimatedCost` for any provider exceeds configured daily cap, block routing to that provider | Cost governance |

### Phase 2 — Polish

| ID | Item |
|----|------|
| RT-P1 | Provider health cards use animated status pulse |
| RT-P2 | Route decision log entries show trace as expandable tree |
| RT-P3 | Fallback order drag list shows "drag handle" grip icon |
| RT-P4 | Cost threshold slider has tooltip showing estimated daily cost |
| RT-P5 | Circuit breaker state shows time since last state change |

### Phase 3 — E2E Tests

| Test ID | Scenario | Assert |
|---------|----------|--------|
| RT-E1 | Drag rule from position 3 to position 1 → rule order persists after tab reload | Rule at position 1 matches dragged rule |
| RT-E2 | Provider circuit opens → next provider auto-promoted | Primary provider changes in routing config |
| RT-E3 | Cost forecast → changing fallback order → delta displayed | Delta element non-empty |
| RT-E4 | P99 latency shown for each provider | P99 value > P50 value for all providers |
| RT-E5 | Daily budget cap exceeded → provider blocked badge visible | Badge `data-testid="budget-blocked"` visible |

---

## Cross-Cutting Phase 2 Items (apply globally)

| ID | Item |
|----|------|
| UX-1 | All tabs use `TabSkeleton` during initial data load |
| UX-2 | All destructive buttons use `variant="destructive"` from `kilo-ui/button` |
| UX-3 | All form saves show a 2s toast "Saved" with undo option |
| UX-4 | All tabs respond to VS Code theme changes without reload (CSS custom properties only, no hardcoded colors) |
| UX-5 | All error states include the raw error message (collapsible) + a "Copy error" button |
| UX-6 | All tabs have a settings-reset button that restores defaults (with confirm dialog) |

---

## Cross-Cutting Phase 3 — E2E Test Infrastructure

| Item | Detail |
|------|--------|
| Test framework | Playwright + `@vscode/test-electron` |
| Coverage gate | Each tab must have >= 5 E2E scenarios passing |
| Flake tolerance | 0% flake tolerance — any flaky test is a P1 bug |
| CI integration | Tests run on every PR targeting `integration/main` |
| Mock strategy | All external HTTP calls mocked via Playwright `routeFromHAR` |
| Performance budget | Each tab must load (first paint) in < 300ms on simulated throttled connection |
