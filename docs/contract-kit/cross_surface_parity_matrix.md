# Cross-Surface Parity Matrix

**Phase 11 Documentation** — Maps feature availability across all War Room surfaces.

Last Updated: 2026-04-23  
Version: 2.0

## Overview

The War Room system operates across three primary surfaces with live state synchronization:

| Surface | Role | Primary Access |
|---------|------|----------------|
| **Hub v2** | Control Plane | Web UI (http://localhost:8095) |
| **KiloCode** | IDE Workbench | VS Code Extension + HubPanel |
| **Open WebUI** | Chat Interface | Web UI + MCP Pipeline |

Legend:
- ✅ Full support
- 🔶 Partial support / Read-only
- ❌ Not supported
- 📡 Via Event Stream
- 🔌 Via MCP

---

## Feature Matrix

### Core Infrastructure

| Feature | Hub v2 | KiloCode | Open WebUI | Notes |
|---------|:------:|:--------:|:----------:|-------|
| Provider Detection | ✅ | 🔌 | 🔌 | All surfaces detect via `/api/providers` |
| Provider Health | ✅ | 📡 | 📡 | Real-time circuit state sync |
| Settings Read | ✅ | ✅ | ✅ | Canonical settings sync |
| Settings Write | ✅ | 🔶 | 🔶 | Via Hub to maintain single truth |
| Settings Validation | ✅ | 🔌 | 🔌 | Per-key validation results |
| Settings Autofill | ✅ | 🔌 | 🔌 | Context-aware inference |

### Agent Management

| Feature | Hub v2 | KiloCode | Open WebUI | Notes |
|---------|:------:|:--------:|:----------:|-------|
| 21-Agent Registry | ✅ | ✅ | ✅ | Unified agent list |
| Agent Assignment | ✅ | ✅ | 🔶 | kc-main auto-assigned |
| Agent Status | ✅ | ✅ | 📡 | Live presence indicators |
| Agent Task View | ✅ | ✅ | 🔶 | Task list, limited in WebUI |
| Capability Check | ✅ | 🔌 | 🔌 | `/api/capabilities/{agent}` |
| Capability Invoke | ✅ | 🔌 | 🔌 | Policy-enforced execution |

### Task & Progress

| Feature | Hub v2 | KiloCode | Open WebUI | Notes |
|---------|:------:|:--------:|:----------:|-------|
| Task Creation | ✅ | ✅ | 🔶 | WebUI via pipeline only |
| Task Progress | ✅ | ✅ | 📡 | Progress bars, % complete |
| Pipeline Progress | ✅ | ✅ | 📡 | Spinner → % → ✓/✗ |
| Task Cancellation | ✅ | ✅ | ❌ | With confirmation dialog |
| Retry/Backoff | ✅ | ✅ | ❌ | Visual backoff indicator |

### Approval & Safety

| Feature | Hub v2 | KiloCode | Open WebUI | Notes |
|---------|:------:|:--------:|:----------:|-------|
| Permission Overlay | ✅ | ✅ | 🔶 | Scope, risk, approve/deny |
| Approval Queue | ✅ | ❌ | ❌ | War Room UI only |
| Durable Approvals | ✅ | ✅ | ✅ | Persistent across restarts |
| Auto-Approve Rules | ✅ | ✅ | ✅ | Trusted agent patterns |
| Audit Log | ✅ | 🔶 | 🔶 | Full history in Hub |
| Privacy Guard | ✅ | ✅ | ✅ | Redaction before export |

### Repair & Maintenance

| Feature | Hub v2 | KiloCode | Open WebUI | Notes |
|---------|:------:|:--------:|:----------:|-------|
| Repair Timeline | ✅ | ✅ | 📡 | Before/after visualization |
| Dry-Run Mode | ✅ | ✅ | ❌ | Test repairs before apply |
| Selective Repair | ✅ | ✅ | ❌ | Choose which fixes to apply |
| Repair Events | ✅ | ✅ | 📡 | SSE broadcast |

### UI/UX Features

| Feature | Hub v2 | KiloCode | Open WebUI | Notes |
|---------|:------:|:--------:|:----------:|-------|
| Diff Rendering | ✅ | ✅ | ❌ | Syntax highlighted diffs |
| Tool-Result Cards | ✅ | ✅ | 🔶 | File reads, commands, search |
| Code Block Copy | ✅ | ✅ | ❌ | One-click copy |
| Collapsible Output | ✅ | ✅ | ❌ | >20 lines auto-collapse |
| Language Detection | ✅ | ✅ | ❌ | Auto-detect from extension |

### MCP Management

| Feature | Hub v2 | KiloCode | Open WebUI | Notes |
|---------|:------:|:--------:|:----------:|-------|
| Server Health Panel | ✅ | ❌ | 🔶 | Visual server status |
| Tool Approval UI | ✅ | ❌ | ❌ | Approve/deny tools |
| MCP Logs Stream | ✅ | ❌ | 📡 | Real-time log viewer |
| Tool Invocation | ✅ | 🔌 | 🔌 | Via MCP bridge |

### Collaboration (War Room)

| Feature | Hub v2 | KiloCode | Open WebUI | Notes |
|---------|:------:|:--------:|:----------:|-------|
| Collaboration Threads | ✅ | ❌ | ❌ | Multi-agent discussions |
| Thread Messages | ✅ | ❌ | ❌ | Async collaboration |
| Agent Presence Grid | ✅ | 📡 | 📡 | 21-agent live status |
| Activity Stream | ✅ | 📡 | 📡 | Recent events feed |
| Approval Resolution | ✅ | 🔶 | 🔶 | Approve/deny requests |

### Roadmap & Planning

| Feature | Hub v2 | KiloCode | Open WebUI | Notes |
|---------|:------:|:--------:|:----------:|-------|
| Phase Cards | ✅ | ❌ | ❌ | Visual phase progress |
| Task Toggling | ✅ | ❌ | ❌ | Complete/incomplete tasks |
| Progress Bars | ✅ | ❌ | ❌ | Per-phase and overall |
| Assignment View | ✅ | ❌ | ❌ | Who owns what |

### Event System

| Feature | Hub v2 | KiloCode | Open WebUI | Notes |
|---------|:------:|:--------:|:----------:|-------|
| SSE Event Stream | ✅ | ✅ | ✅ | `/events` endpoint |
| Event Filtering | ✅ | ❌ | ❌ | Client-side filtering |
| Event Replay | ✅ | ❌ | ❌ | Historical events |
| Cross-Surface Sync | ✅ | ✅ | ✅ | All surfaces receive |

---

## Implementation Status by Phase

| Phase | Feature Set | Hub v2 | KiloCode | Open WebUI |
|-------|-------------|:------:|:--------:|:----------:|
| Phase 1 | Provider Detection | ✅ | ✅ | ✅ |
| Phase 2 | Control Center | ✅ | ✅ | 🔶 |
| Phase 3 | Settings Sync | ✅ | ✅ | ✅ |
| Phase 4 | Task Progress | ✅ | ✅ | 🔶 |
| Phase 5 | Permissions | ✅ | ✅ | 🔶 |
| Phase 6 | Repair Timeline | ✅ | ✅ | 📡 |
| Phase 7 | Diff/Tool Rendering | ✅ | ✅ | ❌ |
| Phase 8 | MCP Management | ✅ | 🔶 | 🔶 |
| Phase 9 | Roadmap Panel | ✅ | ❌ | ❌ |
| Phase 12 | Capability Backend | ✅ | ✅ | ✅ |
| W.3 | Durable Approvals | ✅ | ✅ | ✅ |
| W.4 | Privacy Guard | ✅ | ✅ | ✅ |
| W.5 | War Room UI | ✅ | ❌ | ❌ |

---

## Parity Gaps & Mitigations

### Gap 1: War Room Collaboration UI
**Issue**: Thread-based collaboration only available in Hub v2  
**Impact**: KiloCode and Open WebUI users cannot participate in multi-agent discussions  
**Mitigation**: 
- KiloCode shows approval requests in native UI
- Open WebUI receives activity notifications via MCP
- Future: Embed lightweight War Room widget

### Gap 2: Diff Rendering
**Issue**: Syntax-highlighted diffs not rendered in Open WebUI  
**Impact**: Code changes shown as plain text  
**Mitigation**:
- Open WebUI has native file preview
- Hub provides diff endpoint for external rendering

### Gap 3: MCP Tool Approval UI
**Issue**: Visual tool approval only in Hub v2  
**Impact**: KiloCode users must use command palette  
**Mitigation**:
- Approval events broadcast to all surfaces
- KiloCode can show native notification

### Gap 4: Roadmap Visualization
**Issue**: Interactive roadmap only in Hub v2  
**Impact**: Other surfaces show static status only  
**Mitigation**:
- `/api/roadmap/summary` provides data for all surfaces
- KiloCode could add roadmap panel

---

## Testing Coverage

### Automated Tests (Phase 10B)

| Test Suite | Features Covered | Status |
|------------|------------------|--------|
| `cross_surface_parity.spec.ts` | 47 test cases | ✅ Implemented |
| `providers.spec.ts` | Provider detection | ✅ Passing |
| `settings_sync.spec.ts` | Canonical settings | ✅ Passing |
| `agent_presence.spec.ts` | 21-agent validation | ✅ Passing |
| `mcp_management.spec.ts` | Tool approvals | ✅ Passing |
| `warroom.spec.ts` | Collaboration features | ✅ Passing |

### Manual Verification Required

- [ ] Open WebUI pipeline deployment test
- [ ] KiloCode HubPanel live binding test
- [ ] Cross-surface event latency measurement
- [ ] Recovery after network partition

---

## API Endpoints by Surface

### Hub v2 (All Endpoints)
```
GET  /api/providers/detect
GET  /api/providers/profiles
GET  /api/providers/status
GET  /api/overview
POST /api/settings/validate
POST /api/settings/autofill
GET  /api/agents
GET  /api/agents/kilo/status
GET  /api/mcp/servers
GET  /api/mcp/tools
POST /api/mcp/tools/{id}/approve
GET  /api/roadmap
GET  /api/roadmap/summary
GET  /api/warroom/state
GET  /api/warroom/agents
GET  /api/capabilities
GET  /api/capabilities/{agent_id}
GET  /events (SSE)
```

### KiloCode (Via Bridge)
```
GET  /api/runtime/kilocode/status
POST /api/runtime/kilocode/sync
POST /api/runtime/kilocode/cmd
GET  /api/agents/kilo/status
POST /api/agents/kilo/{id}/assign
```

### Open WebUI (Via MCP)
```
GET  /api/providers/detect (via MCP)
POST /api/settings/validate (via MCP)
GET  /api/agents (via MCP)
GET  /events (SSE fallback)
```

---

## Version Compatibility

| Component | Version | Required For |
|-----------|---------|--------------|
| Hub Runtime | ≥2.0 | Full parity |
| KiloCode Ext | ≥7.2.21-EVO2 | Settings sync |
| Open WebUI | ≥0.3.x | MCP pipeline |
| kilocode_agents_pipeline | ≥2.0.0 | 21-agent support |

---

## Next Steps

1. **Phase 10B**: Execute full parity test suite
2. **Phase 13**: Prove live binding (KiloCode ↔ Hub ↔ Open WebUI)
3. **Gap Mitigation**: Embed War Room widget in KiloCode
4. **Documentation**: Update per-surface feature guides

---

*This matrix is generated from integration plan and maintained alongside codebase changes.*
