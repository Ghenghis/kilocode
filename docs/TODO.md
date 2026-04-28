# KiloCode Ecosystem — Prioritized Implementation TODO

> **Last updated:** 2026-04-28
> **Branch:** `feat/azure-voice-studio` → `integration/main`
> **Reference:** `docs/ENHANCEMENT_ROADMAP.md` for full feature specs
> **Reference:** `docs/ARCHITECTURE.md` for service topology and env var mapping
>
> Each item is tagged: [Tab affected] · Priority (P0=blocking/P1=critical/P2=important/P3=nice)
> Items within the same priority are ordered: prerequisites first.

---

## P0 — Blocking Bugs (Fix Before Any New Features)

These items prevent existing functionality from working correctly.

| ID | Item | Tab(s) | File(s) | Why Blocking |
|----|------|--------|---------|-------------|
| P0-1 | **Normalize Hub URL env vars** — three conflicting names (`HUB_URL`, `KILO_HUB_BASE`, `KILO_HUB_BASE_URL`) cause silent misconfiguration when deploying. Migrate all to `KILO_HUB_BASE_URL`. | HubTab, all webviews | `src/panels/HubPanel.ts`, `src/kilo-provider/handlers/hermes-webview.ts`, `src/kilo-provider/handlers/routing-webview.ts`, `src/kilo-provider/handlers/zeroclaw-webview.ts` | Operators setting `KILO_HUB_BASE_URL` don't affect HubPanel — HubPanel reads `HUB_URL` instead. Silent failure. |
| P0-2 | **ZeroClawTab projectPath auto-fill** — tab form is completely blank on mount; operators cannot submit a task without manually typing the workspace path. | ZeroClawTab | `src/kilo-provider/handlers/zeroclaw-webview.ts`, `ZeroClawTab.tsx` | Tab is non-functional for first-time use. Gap 9 from master roadmap. |
| P0-3 | **HubServicesService URL mismatch** — `HubServicesService` defaults to `http://localhost:8000` but Hub canonical port is `:8095`. Status bar always shows `DaveAI: --` even when Hub is running. | Status bar | `src/services/hub-services.ts` | Misleads operator into thinking Hub is down. |
| P0-4 | **Known-hosts panel empty** — `SSHTab` Known Hosts panel calls `sshGetKnownHosts` but `SSHService` never parses `~/.ssh/known_hosts`. Panel is always empty. | SSHTab | `src/services/ssh/SSHService.ts` | Gap 6 (known_hosts parser). Security risk: operators cannot verify host keys. |
| P0-5 | **GovernanceTab auto-population** — authority tier pre-population not wired. Tab opens with empty tier assignments even though `GovernanceService.seedDefaults()` seeds dangerous actions. | GovernanceTab | `src/services/governance/GovernanceService.ts`, `GovernanceTab.tsx` | Governance cannot function without at least one admin tier assignment. |

---

## P1 — Critical Features (Phase 1 Core)

Implement in order — later items may depend on earlier ones.

### Infrastructure & Cross-Cutting

| ID | Item | Tab(s) | Estimated Effort |
|----|------|--------|------------------|
| P1-INF-1 | Add `AbortSignal.timeout(5000)` to every fetch call that lacks it (audit all service files) | All | 2h |
| P1-INF-2 | Add `data-testid` attributes to all interactive elements in all 11 tabs (prerequisite for Phase 3 tests) | All | 4h |
| P1-INF-3 | Create `docs/.env.example` listing all env vars from `docs/ARCHITECTURE.md` env table with descriptions | All | 1h |
| P1-INF-4 | Wire `TabSkeleton` into all 11 tabs for initial data load state | All | 3h |

### ZeroClawTab

| ID | Item | Ref | Estimated Effort |
|----|------|-----|------------------|
| P1-ZC-1 | Auto-fill `projectPath` from `vscode.workspace.workspaceFolders[0].uri.fsPath` on mount | ZC-1 | 2h |
| P1-ZC-2 | Auto-fill `workspaceScope` default to workspace root | ZC-2 | 1h |
| P1-ZC-3 | Wire SSE log streaming from `GET /tasks/{id}/events` into log panel via `HermesPipeline` SSE bridge | ZC-3 | 4h |
| P1-ZC-4 | Add pre-submission cost estimate call (`GET /estimate` on Hermes) | ZC-4 | 3h |
| P1-ZC-5 | Persist user-defined task templates in `workspaceState` with add/edit/delete UI | ZC-6 | 4h |
| P1-ZC-6 | Wire circuit-breaker manual reset button (`POST /circuit-breaker/reset/{endpointId}`) | ZC-8 | 2h |

### HermesTab

| ID | Item | Ref | Estimated Effort |
|----|------|-----|------------------|
| P1-H-1 | Pipeline stage diagram: render `TaskState` on a horizontal state machine SVG | H-1 | 5h |
| P1-H-2 | Throughput ring buffer: store `messagesPerMin` in `workspaceState` (60-entry ring buffer) | H-2 | 3h |
| P1-H-3 | SLA breach counter: track tasks exceeding configured `timeoutSec` | H-3 | 2h |
| P1-H-4 | Auto-reconnect with exponential backoff + jitter (replace simple interval) | H-8 | 3h |

### OpenClawTab

| ID | Item | Ref | Estimated Effort |
|----|------|-----|------------------|
| P1-OC-1 | One-click webhook URL builder with copy button | OC-1 | 2h |
| P1-OC-2 | DLQ replay UI: list failed messages, retry button per message | OC-3 | 4h |
| P1-OC-3 | Channel test message: `POST /channels/{id}/test` and show result | OC-7 | 3h |
| P1-OC-4 | TLS status badge for gateway URL | OC-6 | 1h |
| P1-OC-5 | EU AI Act disclosure toggle per channel (default on, customizable message) | SOTA D3-5 | 2h |

### HubTab

| ID | Item | Ref | Estimated Effort |
|----|------|-----|------------------|
| P1-HB-1 | P0-1 env var normalization (see P0-1 above) | HB-6 | 2h |
| P1-HB-2 | Per-service uptime sparkline (store last 10 health checks in `workspaceState`) | HB-1 | 3h |
| P1-HB-3 | One-click service restart button with confirm dialog | HB-2 | 3h |
| P1-HB-4 | Secret-scan result drill-down (file path + line number from scan result) | HB-5 | 2h |

### VPSTab

| ID | Item | Ref | Estimated Effort |
|----|------|-----|------------------|
| P1-VPS-1 | Safe read-only probe pipeline on SSH connect (uname, uptime, free, df, docker ps, systemctl) | VPS-1 | 8h |
| P1-VPS-2 | Alert threshold config per server with VS Code notification on breach | VPS-2 | 4h |
| P1-VPS-3 | Public IP detection via `curl -s ifconfig.me` in probe (3s timeout) | VPS-6 | 1h |
| P1-VPS-4 | One-click rollback with pre/post health check | VPS-5 | 5h |

### SSHTab

| ID | Item | Ref | Estimated Effort |
|----|------|-----|------------------|
| P1-SSH-1 | Known-hosts parser: `SSHService.getKnownHosts()` reads `~/.ssh/known_hosts` | SSH-1 | 4h |
| P1-SSH-2 | TOFU dialog: show fingerprint on unknown host, persist trust decision | SSH-2 | 5h |
| P1-SSH-3 | Port-forward tunnel manager UI + backend | SSH-3 | 6h |
| P1-SSH-4 | Key age warning: mtime check + amber badge + "Rotate" button | SSH-5 | 2h |

### TrainingTab

| ID | Item | Ref | Estimated Effort |
|----|------|-----|------------------|
| P1-TR-1 | Live loss curve chart: SVG line chart from `lossHistory` array, updates in real-time | TR-1 | 4h |
| P1-TR-2 | VRAM budget estimator: formula + gauge vs. available VRAM | TR-2 | 3h |
| P1-TR-3 | QLoRA 4-bit config: expose `load_in_4bit`, `bnb_4bit_quant_type`, `bnb_4bit_compute_dtype` | TR-7 | 3h |
| P1-TR-4 | Checkpoint auto-resume: detect existing checkpoints, offer resume from step N | TR-8 | 4h |
| P1-TR-5 | Dataset annotation UI: render `DatasetItem` cards with Accept/Reject/Edit | TR-4 | 5h |

### MemoryTab

| ID | Item | Ref | Estimated Effort |
|----|------|-----|------------------|
| P1-MEM-1 | Upgrade recall from TF-IDF to embedding-based search via local Ollama `embeddings` API | MEM-1 | 6h |
| P1-MEM-2 | Semantic de-duplication: cosine similarity check before write, warn if > 0.92 | MEM-2 | 4h |
| P1-MEM-3 | TTL/decay config: per-scope TTL settings, background expiry job | MEM-3 | 4h |
| P1-MEM-4 | Token budget dashboard: total tokens vs. max budget, warn at 80% | MEM-7 | 2h |
| P1-MEM-5 | Bulk import: accept JSONL file, validate against `MemoryEntry` schema, insert | MEM-5 | 3h |

### GovernanceTab

| ID | Item | Ref | Estimated Effort |
|----|------|-----|------------------|
| P1-GOV-1 | Release checklist template builder (standard gates pre-populated) | GOV-1 | 3h |
| P1-GOV-2 | Rollback plan template builder (structured form) | GOV-2 | 3h |
| P1-GOV-3 | Wire authority tier pre-population from `GovernanceService.getDefaultTiers()` | P0-5 | 2h |
| P1-GOV-4 | Audit anomaly detection: z-score per actor, alert on > 2σ deviation | GOV-4 | 6h |
| P1-GOV-5 | Approval escalation SLA: auto-escalate pending approvals after N minutes | GOV-6 | 4h |

### SpeechTab

| ID | Item | Ref | Estimated Effort |
|----|------|-----|------------------|
| P1-SP-1 | Local TTS fallback: auto-detect Piper or Kokoro on PATH | SP-1 | 4h |
| P1-SP-2 | Whisper.cpp STT integration: configure `whisper-server` endpoint | SP-2 | 5h |
| P1-SP-3 | Voice preview: play 5-word sample on voice click | SP-5 | 2h |
| P1-SP-4 | Pronunciation dictionary bulk import from CSV | SP-7 | 2h |

### RoutingTab

| ID | Item | Ref | Estimated Effort |
|----|------|-----|------------------|
| P1-RT-1 | Wire `@solid-dnd` drag-reorder for routing rules list | RT-1 | 4h |
| P1-RT-2 | P50/P95/P99 latency breakdown: extend ring buffer to 100 entries, compute percentiles | RT-4 | 3h |
| P1-RT-3 | Auto-healing routing: promote next provider when circuit opens, no user action needed | RT-6 | 4h |
| P1-RT-4 | Budget cap enforcement: block routing when `estimatedCost` exceeds daily cap | RT-7 | 3h |
| P1-RT-5 | Semantic routing condition type in rule editor: `task_intent` keyword/regex match | RT-2 | 4h |

---

## P2 — Polish (Phase 2)

Implement after all P1 items for the same tab are complete.

### UX Consistency (all tabs)

| ID | Item |
|----|------|
| P2-UX-1 | All destructive buttons: `variant="destructive"` from `kilo-ui/button` |
| P2-UX-2 | All form saves: 2-second "Saved" toast with undo |
| P2-UX-3 | All error states: raw error message (collapsible) + "Copy error" button |
| P2-UX-4 | All tabs: settings-reset button with confirm dialog |
| P2-UX-5 | All tabs: respond to VS Code theme changes via CSS custom properties only |
| P2-UX-6 | All tabs: empty state illustration (SVG) when no data exists yet |

### Per-Tab Polish (see ENHANCEMENT_ROADMAP.md Phase 2 sections for full details)

| ID | Tab | Item |
|----|-----|------|
| P2-ZC-1 | ZeroClaw | Status badge CSS transition animations |
| P2-ZC-2 | ZeroClaw | Completed tasks > 24h collapsed by default |
| P2-OC-1 | OpenClaw | Channel categories with collapse grouping |
| P2-OC-2 | OpenClaw | Drag-to-reorder routing rules |
| P2-H-1 | Hermes | Animated progress in pipeline stage diagram |
| P2-HB-1 | Hub | Quota bar turns red at >80% with pulse animation |
| P2-VPS-1 | VPS | CPU/RAM shown as gauge rings |
| P2-VPS-2 | VPS | Deploy history timeline (horizontal) |
| P2-SSH-1 | SSH | Profile groups collapsible with connection count badge |
| P2-SSH-2 | SSH | "Copy public key" button next to fingerprint |
| P2-TR-1 | Training | Loss curve: epoch boundary vertical lines |
| P2-TR-2 | Training | GPU VRAM gauge animates on update |
| P2-TR-3 | Training | Dataset preview table virtualized (only render visible rows) |
| P2-MEM-1 | Memory | Recall result cards: relevance score as colored bar |
| P2-MEM-2 | Memory | Tag cloud visualization |
| P2-GOV-1 | Governance | Audit log: risk level as color-coded row background |
| P2-GOV-2 | Governance | Pending approval records: elapsed time counter |
| P2-SP-1 | Speech | Voice picker: latency estimate badge (cloud vs. local) |
| P2-SP-2 | Speech | Push-to-talk "Record shortcut" click-to-capture |
| P2-RT-1 | Routing | Circuit breaker: time since last state change |
| P2-RT-2 | Routing | Route decision log: trace as expandable tree |

---

## P3 — Verification (Phase 3 E2E Tests)

Implement after P2 for each tab. See `docs/ENHANCEMENT_ROADMAP.md` Phase 3 sections for full test scenarios.

### Test Infrastructure (prerequisite for all tab tests)

| ID | Item | Effort |
|----|------|--------|
| P3-INF-1 | Set up Playwright + `@vscode/test-electron` test harness | 8h |
| P3-INF-2 | Create HAR fixtures for all external HTTP endpoints (Hermes, Hub, Shiba) | 6h |
| P3-INF-3 | Add `data-testid` audit script (CI step: fail if any interactive element lacks `data-testid`) | 2h |
| P3-INF-4 | Configure performance budget check: tab first-paint < 300ms | 2h |

### Per-Tab Test Suites (5 scenarios each, see roadmap for full specs)

| ID | Tab | Scenarios |
|----|-----|-----------|
| P3-ZC | ZeroClawTab | ZC-E1 through ZC-E5 |
| P3-OC | OpenClawTab | OC-E1 through OC-E5 |
| P3-H | HermesTab | H-E1 through H-E5 |
| P3-HB | HubTab | HB-E1 through HB-E5 |
| P3-VPS | VPSTab | VPS-E1 through VPS-E5 |
| P3-SSH | SSHTab | SSH-E1 through SSH-E5 |
| P3-TR | TrainingTab | TR-E1 through TR-E5 |
| P3-MEM | MemoryTab | MEM-E1 through MEM-E5 |
| P3-GOV | GovernanceTab | GOV-E1 through GOV-E5 |
| P3-SP | SpeechTab | SP-E1 through SP-E5 |
| P3-RT | RoutingTab | RT-E1 through RT-E5 |

### Coverage Gate

CI must enforce: all 55 E2E scenarios pass, 0 flakes, tab first-paint < 300ms, 0 console errors on mount.

---

## SOTA Research Items (Deferred — Requires Design Approval)

These are game-changing features from `docs/SOTA_FEATURES.md` that require architecture decisions before implementation.

| ID | Item | Domain | Prerequisite |
|----|------|--------|-------------|
| SOTA-1 | Semantic response cache in RoutingService (40–60% hit rate) | Load Balancing | embedding endpoint available |
| SOTA-2 | Hybrid Vector + Graph RAG in MemoryService | Memory/RAG | P1-MEM-1 (embedding recall) must land first |
| SOTA-3 | Hindsight reflection: auto-generate memory entries after task completion | Memory/RAG | P1-MEM-1 + HermesPipeline SSE landed |
| SOTA-4 | Cross-channel context sharing (Telegram + Discord same user) | Multi-platform | P1-MEM-1 + federated memory design |
| SOTA-5 | Proactive outreach: agent-initiated messages on events | Multi-platform | OpenClaw `POST /channels/{id}/send` endpoint |
| SOTA-6 | Hash-chained immutable audit log | Agent Governance | GovernanceService refactor |
| SOTA-7 | Approval quorum (N-of-M multi-party authorization) | Agent Governance | GovernanceTab approval UI redesign |
| SOTA-8 | Time-bound delegated authority (temporal RBAC) | Agent Governance | `TierAssignment.expiresAt` schema migration |
| SOTA-9 | Predictive circuit breaker + slow-start recovery | Load Balancing | RoutingService latency history (P1-RT-2 first) |
| SOTA-10 | Adaptive quantization selection in TrainingTab | Local LLM | GPU detection returns full capability data |

---

## Gap Tracker (from master-roadmap.md)

| Gap | Description | Status | Primary TODO |
|-----|-------------|--------|-------------|
| Gap 6 | SSH known_hosts parser | P0-4 | P1-SSH-1 |
| Gap 7 | VPS safe inventory probe | Pending | P1-VPS-1 |
| Gap 8 | Memory auto-attach (Hermes/Shiba) | Pending | P1-MEM-1 |
| Gap 9 | ZeroClaw context bootstrap | P0-2 | P1-ZC-1, P1-ZC-2 |
| Gap 10 | Governance default seeding | Partial | P1-GOV-1, P1-GOV-2, P1-GOV-3 |
| Gap 11 | CLI Backend health recovery | Pending | Not scoped in this roadmap |
| Gap 12 | Migration-as-onboarding | Pending | Not scoped in this roadmap |

---

## Quick-Start for New Agents

If you are picking up a work item:

1. Read `docs/ARCHITECTURE.md` — understand which service handles your tab before touching UI code.
2. Check `docs/ENHANCEMENT_ROADMAP.md` — find the tab section and read "Current State" carefully.
3. Check `docs/SOTA_FEATURES.md` — if your item is tagged "SOTA", read the corresponding feature section for implementation guidance.
4. Add `data-testid` attributes to every interactive element you create or modify (required for P3).
5. All HTTP calls must have `AbortSignal.timeout(5000)` — check before submitting PR.
6. Run existing tests before and after your change: `bun test` from `packages/kilo-vscode/`.
