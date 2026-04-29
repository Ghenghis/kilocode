# KiloCode Ecosystem — Authoritative New Roadmap
**Date:** 2026-04-22  
**Author:** Windsurf (Cascade) — generated from full codebase audit  
**Truth source:** This document replaces all contradictory status claims in older docs  
**WebUI is PRIMARY hub. KiloCode is secondary. Agents (Hermes, ZeroClaw) automate the ecosystem.**

---

## Reality Check — What the Old Docs Got Wrong

| Old Claim | Actual Truth |
|---|---|
| "100% source complete, only deploy remains" | Source is ~70% real — many methods were stubs that have since been filled by agents. Real gaps remain in WebUI HTML/UI, boot-gate, and VSIX panels. |
| "409/409 tests passing" | Tests pass because most E2E tests use mocks, not live stack. Live proof is missing. |
| "5 blockers, zero code tasks" | Wrong — code tasks remain: full WebUI dashboard, boot-gate panel, provider health panel, real Playwright tests, VSIX commands. |
| Ports: runtime=8080, hermes=8090, webui=7860 | **Ports changed** — runtime=8081, hermes=8091, webui=8095, settings=8082. Systemd files are WRONG and must be fixed. |
| "No KiloCode integration yet" | Correct — VSIX commands/panels not wired. Deferred until WebUI is primary hub. |
| CHECKLIST shows 0% for all stub methods | Many stubs were implemented by Windsurf sessions. CHECKLIST.md is stale and should not be used. |

---

## Ecosystem Architecture (Canonical)

```
                     ┌─────────────────────────────────┐
                     │   WebUI Dashboard (port 8095)   │  ← PRIMARY HUB
                     │   Full control center for:      │
                     │   - All service ports           │
                     │   - Canonical settings          │
                     │   - Hermes / ZeroClaw control   │
                     │   - Agent autofill + repair     │
                     │   - Audit trail                 │
                     │   - Boot-gate / safemode        │
                     │   - Provider health             │
                     │   - Evidence + repair timeline  │
                     └────────────┬────────────────────┘
                                  │ HTTP proxy API
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
┌────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
│ Runtime Core   │   │ Settings Service     │   │ Hermes Orchestrator  │
│ (port 8081)    │   │ (port 8082)          │   │ (port 8091)          │
│ - EventBus     │   │ - Canonical truth    │   │ - Intake API         │
│ - CircuitBreak │   │ - Port registry      │   │ - ZeroClaw dispatch  │
│ - ProviderRoute│   │ - Audit trail        │   │ - Agent repair       │
│ - Queue/events │   │ - Auto-fill          │   │ - NATS publish       │
└────────────────┘   └──────────────────────┘   └──────────────────────┘
         │                        │                        │
         └────────────────────────┴────────────────────────┘
                                  │
                             NATS (4222)
                                  │
         ┌────────────────────────┘
         ▼
┌──────────────────────┐      ┌──────────────────────┐
│ ZeroClaw Gateway     │      │ KiloCode (VSIX)      │
│ - Git adapter        │      │ (SECONDARY client)   │
│ - Shell adapter      │      │ - Syncs from runtime │
│ - Filesystem adapter │      │ - Task/completion    │
│ - Research adapter   │      │ - Settings autofill  │
│ - Repair worker      │      │ - Provider status    │
└──────────────────────┘      └──────────────────────┘
```

---

## Phase 1 — Fix & Deploy Core (IMMEDIATE — deploy gaps)

### 1A. Fix Port Mismatches in Systemd Units
**Problem:** Systemd files use OLD ports (8080, 8090, 7860). Services run on NEW ports (8081, 8091, 8095, 8082).  
**Files to fix:**
- `deploy/systemd/kilocode-runtime.service` → port 8081 (not 8080)
- `deploy/systemd/kilocode-hermes.service` → port 8091 (not 8090)
- `deploy/systemd/kilocode-webui.service` → port 8095 (not 7860), module `src.webui.dashboard:app`
- **Add** `deploy/systemd/kilocode-settings.service` → port 8082, module `src.runtime.settings_canonical:app`

**Status:** ❌ Not done  
**Effort:** 20 min  

### 1B. Fix WebUI Systemd Module Path
**Problem:** `kilocode-webui.service` points to `src.webui.app:app` — this module doesn't exist.  
**Fix:** Change to `src.webui.dashboard:app`  
**Status:** ❌ Not done  

### 1C. Deploy Settings Service to VPS
**Files:** `src/runtime/settings_canonical.py` (✅ written, not deployed)  
**What's needed:**
- SCP file to VPS
- Install `kilocode-settings.service`
- Open firewall port 8082
- Persist iptables  
**Status:** ❌ Not deployed  

### 1D. Deploy Dashboard to VPS
**Files:** `src/webui/dashboard.py` (✅ written, not deployed)  
**What's needed:**
- SCP file to VPS
- Restart kilocode-webui to serve new dashboard
- Verify `http://localhost:8095/` returns HTML dashboard  
**Status:** ❌ Not deployed  

---

## Phase 2 — Complete WebUI as Primary Hub (CODE WORK)

WebUI is the main control center. These panels are **missing or incomplete**:

### 2A. Boot-Gate / Safemode Panel  ❌ MISSING
**Contract:** `use-me-addon/10_BOOT_GATE_REPAIR_COMPLETION_CONTRACT.md`  
**What's needed in `dashboard.py` / new tab:**
- On-boot health matrix (runtime, hermes, settings, NATS, providers)
- If any critical check fails → show SAFEMODE banner, block normal UI
- Repair button triggers agent repair + revalidation
- Unlock transition shown when all checks pass
- Captured proof: pass/fail log, timestamp, which agent repaired

**This is acceptance gate F — nothing can be declared done without it.**  

### 2B. Provider Health Panel  ❌ INCOMPLETE
**What's needed:**
- Live provider status: LiteLLM, Ollama, MiniMax, SiliconFlow
- Circuit breaker state per provider (open/half-open/closed)
- Failover order visible
- "Force failover" button for testing
- Last health check timestamp
- Currently the overview tab shows ports only — provider health is absent

### 2C. Evidence + Repair Timeline Panel  ❌ MISSING
**Contract:** `use-me-addon/07_WEBUI_COMPLETION_CONTRACT.md`  
**What's needed:**
- Evidence items from `AgentAccessAPI` (already implemented in `control_center.py`)
- Repair history timeline with agent/timestamp/result
- Active repair packet status
- Link to safemode unlock history

### 2D. Active Queue / Packets Panel  ❌ MISSING
**What's needed:**
- Current queue depth (from runtime EventBus)
- Active packets in flight (task_id, type, status)
- Hermes intake status
- ZeroClaw execution status (which adapter running)

### 2E. WebUI Settings → KiloCode Sync Status  ❌ MISSING
**What's needed:**
- Show `sync_state.kilocode_synced` / `webui_synced` from canonical settings
- Force-sync button (pushes settings to KiloCode endpoint)
- Last sync timestamp + drift detection

### 2F. Agent Command Panel (Hermes/ZeroClaw dispatch from UI)  ❌ MISSING
**What's needed:**
- Text input to compose and send intake packets directly from WebUI
- Select task_type (shell/git/filesystem/research/repair)
- Show task result inline
- History of dispatched commands with outcomes

---

## Phase 3 — Agent Automation Wiring (Hermes/ZeroClaw → WebUI)

### 3A. Hermes → WebUI Writeback  ❌ NOT WIRED
**What's needed:**
- Hermes pushes evidence/repair results to `AgentAccessAPI` (already has endpoints)
- Hermes calls `POST /settings/repair` after detecting drift
- Hermes calls `POST /settings/validate` on boot
- Configure Hermes to know `SETTINGS_URL=http://localhost:8082`

### 3B. ZeroClaw → WebUI Evidence Push  ❌ NOT WIRED
- ZeroClaw adapters post completion evidence to WebUI `AgentAccessAPI`
- Repair results surfaced in Evidence panel
- Currently ZeroClaw only returns results locally — no push

### 3C. Agent-Triggered Safemode Repair  ❌ NOT WIRED
- On boot: runtime triggers `GET /health` on itself + hermes + settings
- If any fail → publish `safemode.enter` event to NATS
- Hermes subscribes to `safemode.enter` → starts repair
- On repair success → publish `safemode.exit` → WebUI unlocks

### 3D. Auto-Fill Loop on First Boot  ❌ NOT WIRED
- Settings service calls `auto-fill` on startup
- WebUI shows remaining questions that need user input
- Hermes can probe environment and answer inferable questions
- Only secrets surface to user

---

## Phase 4 — Real E2E Proof (Playwright + Live Stack)

### 4A. Live Playwright Tests  ❌ ALL MOCK-BASED TODAY
**File:** `tests/e2e/test_webui.py` — uses `localhost:8000`, wrong ports, mock data  
**What's needed:**
- Update all E2E tests to use real ports (8081/8082/8091/8095)
- Tests hit real services (not mocks)
- Playwright tests cover all 7 acceptance gates:
  1. Control center loads with real data
  2. Provider panel shows real provider state
  3. Settings question flow works end-to-end
  4. Evidence panel loads real evidence from AgentAccessAPI
  5. Repair timeline shows real repair attempt
  6. Safemode blocks normal UI on critical failure
  7. Unlock transition happens after validation pass

### 4B. Live Intake Packet Proof  ❌ NOT PROVEN LIVE
- POST to `http://localhost:8091/intake` with real task
- Verify Hermes receives, ZeroClaw executes, result returns
- Log captured and surfaced in WebUI

### 4C. Provider Failover Proof  ❌ NOT PROVEN LIVE
- Kill LiteLLM or Ollama
- Verify circuit breaker opens (visible in WebUI)
- Verify failover to next provider happens
- Restore provider, verify circuit closes

### 4D. Boot/Restart Safety Proof  ❌ NOT PROVEN LIVE
- `systemctl restart kilocode-runtime` → health check passes within 30s
- `systemctl restart kilocode-hermes` → intake works after restart
- `systemctl restart kilocode-settings` → audit trail persists across restart
- Evidence ledger written to `~/.kilocode/settings_audit.json` survives restart

---

## Phase 5 — KiloCode VSIX (SECONDARY — after WebUI complete)

**Do not start until Phases 1–3 are complete.**

### 5A. VSIX Commands  ❌ NOT IMPLEMENTED
Per `use-me-addon/08_VSIX_COMPLETION_CONTRACT.md`:
- `Sync Runtime Settings` command
- `Open Missing Settings` command
- `Apply Autofill Results` command
- `Set Standard/YOLO/Anonymous Mode` commands
- `Queue Active Task` command
- `Submit Completion Packet` command
- `Refresh Provider Health` command

### 5B. VSIX Panels  ❌ NOT IMPLEMENTED
- `RuntimeStatusPanel` — shows runtime health
- `ActiveTaskPanel` — current task in flight
- `CompletionPacketPanel` — submit completion evidence
- `SettingsAutofillPanel` — shows questions/answers
- `ProviderStatusPanel` — provider health from runtime
- `EvidenceReturnPanel` — evidence from AgentAccessAPI

### 5C. KiloCode → WebUI Sync  ❌ NOT WIRED
- VSIX polls `GET /settings/state` on startup
- VSIX submits completion packets to runtime
- Completion surfaces in WebUI evidence panel
- Settings changes in WebUI propagate to KiloCode VSIX

---

## Phase 6 — Monitoring, Metrics, Observability

These are NEW additions not in original roadmap:

### 6A. WebUI Real-Time Refresh  ❌ MISSING
- Auto-refresh overview every 30s (not just on tab click)
- WebSocket or SSE stream for live event updates from NATS
- Queue depth as live counter, not polled

### 6B. Agent Activity Log in WebUI  ❌ MISSING
- Live tail of Hermes dispatch log
- ZeroClaw adapter execution log
- Filter by agent / task type / time range

### 6C. Health History  ❌ MISSING
- Last 24h health check results stored in settings audit
- Graph of service uptime per hour visible in WebUI
- Alert badge when any service has been down

---

## What Is Actually Done (Verified)

| Component | File | Status |
|---|---|---|
| Runtime Core API | `src/runtime/core.py` | ✅ 687 lines, FastAPI, EventBus, CircuitBreaker, ProviderRouter |
| Canonical Settings Service | `src/runtime/settings_canonical.py` | ✅ Written — **not deployed to VPS yet** |
| Hermes Orchestrator | `src/hermes/orchestrator.py` | ✅ 44KB — needs real NATS wiring on VPS |
| ZeroClaw Gateway | `src/zeroclaw/adapters.py` | ✅ 44KB — needs real subprocess wiring proof |
| WebUI Control Center (backend) | `src/webui/control_center.py` | ✅ 56KB — AgentAccessAPI, all panels backend |
| WebUI Dashboard (new full UI) | `src/webui/dashboard.py` | ✅ Written — **not deployed to VPS yet** |
| Agents Panel | `src/webui/agents_panel.py` | ✅ 18KB |
| Proof Module | `src/proof/` | ✅ ProofTestRunner, CoverageTracker, etc. |
| Blockchain Audit | `src/blockchain_audit/` | ✅ AuditChain, ConsensusEngine, etc. |
| Unit tests (280) | `tests/unit/` | ✅ All passing |
| Integration tests (112) | `tests/integration/` | ✅ All passing |
| E2E tests | `tests/e2e/` | ⚠️ All mock-based — live proof missing |
| Deploy scripts | `deploy/scripts/` | ⚠️ Exist but port mismatches in systemd |
| Systemd services | `deploy/systemd/` | ❌ Wrong ports, missing settings service |
| Settings systemd unit | (needs creation) | ❌ Missing |
| WebUI boot-gate panel | (needs implementation) | ❌ Missing |
| Provider health panel | (needs implementation) | ❌ Missing |
| Evidence/repair timeline | (needs implementation) | ❌ Missing |
| Active queue panel | (needs implementation) | ❌ Missing |
| Agent command panel | (needs implementation) | ❌ Missing |
| Real Playwright E2E | (needs implementation) | ❌ Missing |
| VSIX commands/panels | (needs implementation) | ❌ Phase 5 |
| Hermes→WebUI writeback | (needs wiring) | ❌ Phase 3 |
| ZeroClaw→WebUI evidence | (needs wiring) | ❌ Phase 3 |
| Safemode event loop | (needs wiring) | ❌ Phase 3 |

---

## Acceptance Gates Status

| Gate | Description | Status |
|---|---|---|
| A | No contradictions in handoff docs | ⚠️ Old docs still contradicting — this NEW_ROADMAP.md replaces them |
| B | Source in unified repo / patch targets | ⚠️ Local only, not pushed to hermes.daveai.tech yet |
| C | WebUI all routes + panels wired to real data | ❌ Boot-gate, provider, evidence, queue panels missing |
| D | VSIX sync/autofill/task/completion proven | ❌ Phase 5 |
| E | Hermes/ZeroClaw packet lifecycle proven live | ❌ VPS deploy needed |
| F | Boot/repair/restart safety proven | ❌ Safemode loop not wired |
| G | Full E2E settings+workflow+repair+restart | ❌ Depends on C, E, F |

---

## Ordered Execution Plan

```
Week 1 — Immediate
  ├── Fix systemd port mismatches (1A, 1B)              → 20 min
  ├── Add kilocode-settings.service systemd unit        → 15 min
  ├── Deploy settings_canonical.py + dashboard.py       → 30 min (SCP + restart)
  ├── Verify 4 services healthy on VPS                  → 20 min
  └── [Gate C partial] Ports + settings panels live     ✓

Week 1-2 — WebUI Hub Completion
  ├── Add boot-gate/safemode panel to dashboard (2A)    → 3h
  ├── Add provider health panel to dashboard (2B)       → 2h
  ├── Add evidence + repair timeline panel (2C)         → 2h
  ├── Add active queue / packets panel (2D)             → 1.5h
  ├── Add KiloCode sync status panel (2E)               → 1h
  ├── Add agent command dispatch panel (2F)             → 2h
  └── [Gate C complete] WebUI is full hub               ✓

Week 2 — Agent Automation Wiring
  ├── Wire Hermes → settings service on boot (3A)       → 2h
  ├── Wire ZeroClaw → evidence push (3B)                → 1.5h
  ├── Wire safemode event loop (3C)                     → 2h
  ├── Wire auto-fill loop on first boot (3D)            → 1h
  └── [Gate E + F partial] Agents wired to WebUI        ✓

Week 2-3 — Real E2E Proof
  ├── Fix E2E test ports + remove mocks (4A)            → 2h
  ├── Live intake packet proof (4B)                     → 1h
  ├── Provider failover proof (4C)                      → 1h
  ├── Boot/restart safety proof (4D)                    → 1h
  └── [Gates E, F, G complete] Full E2E proven          ✓

Week 3+ — KiloCode VSIX (Phase 5)
  ├── VSIX commands implemented (5A)                    → 4h
  ├── VSIX panels wired to runtime (5B)                 → 4h
  └── KiloCode ↔ WebUI sync proven (5C)                → 2h

Ongoing — Monitoring (Phase 6)
  ├── WebUI auto-refresh + SSE stream (6A)              → 2h
  ├── Agent activity log panel (6B)                     → 2h
  └── Health history + alerts (6C)                      → 2h
```

---

## Port Registry (Canonical — use these everywhere)

| Service | Port | Systemd Unit | Status |
|---|---|---|---|
| kilocode-runtime | **8081** | `kilocode-runtime.service` | ✅ Live but unit says 8080 (fix needed) |
| kilocode-settings | **8082** | `kilocode-settings.service` | ❌ Unit missing |
| kilocode-webui | **8095** | `kilocode-webui.service` | ⚠️ Unit says 7860 + wrong module |
| kilocode-hermes | **8091** | `kilocode-hermes.service` | ⚠️ Unit says 8090 |
| nats | **4222** | nats.service | ✅ |
| nats-monitor | **8222** | nats.service | ✅ |
| open-webui | **7860** | open-webui (docker) | ✅ |
| litellm | **4000** | litellm (docker) | ✅ |
| ollama | **11434** | ollama.service | ✅ |
| shiba-gateway | **18789** | shiba-gateway.service | ✅ (iptables needed on reboot) |
| edge-tts | **5050** | (docker) | ✅ |

---

## Files To Create / Fix (Summary)

| File | Action | Priority |
|---|---|---|
| `deploy/systemd/kilocode-runtime.service` | Fix port 8080→8081 | HIGH |
| `deploy/systemd/kilocode-hermes.service` | Fix port 8090→8091 | HIGH |
| `deploy/systemd/kilocode-webui.service` | Fix port 7860→8095, fix module path | HIGH |
| `deploy/systemd/kilocode-settings.service` | CREATE NEW | HIGH |
| `src/webui/dashboard.py` | Add boot-gate, provider, evidence, queue, agent-cmd panels | HIGH |
| `tests/e2e/test_webui.py` | Fix ports, remove mocks, add live Playwright tests | HIGH |
| `tests/e2e/test_settings.py` | CREATE — test all settings_canonical endpoints live | HIGH |
| `tests/e2e/test_e2e_full.py` | CREATE — full settings+workflow+repair+restart lifecycle | HIGH |
| `src/webui/control_center.py` | Verify AgentAccessAPI endpoints wired in dashboard proxy | MEDIUM |
| `src/kilocode/vsix_commands.py` | CREATE — VSIX command handlers | PHASE 5 |
| `src/kilocode/vsix_panels.py` | CREATE — VSIX panel definitions | PHASE 5 |

---

## Success Definition (Updated)

**The ecosystem is COMPLETE when:**

1. `http://localhost:8095/` serves full WebUI dashboard with all panels live
2. `http://localhost:8082/settings/state` returns real canonical settings
3. `http://localhost:8081/health`, `/api/8091/health`, `/api/8082/health` all healthy
4. Boot-gate panel shows real health matrix on load
5. Safemode activates when any critical service is down, blocks normal UI
6. Agent repair (Hermes) is triggered from WebUI and result appears in evidence panel
7. Provider failover is visible in WebUI when a provider goes down
8. Playwright E2E tests pass against live stack (not mocks)
9. `systemctl restart kilocode-runtime` + health recovers within 30s
10. Settings audit trail persists across service restarts
11. KiloCode VSIX syncs settings from runtime on startup (Phase 5)
12. All acceptance gates A–G pass
