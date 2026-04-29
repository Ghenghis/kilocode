# Master Execution Manifest

**Contract Kit**: v17 Parallel Execution System  
**Total Duration**: 6 days  
**Teams**: A (Audit), B (WebUI), C (Runtime), D (Hermes), E (Integration)

---

## Executive Summary

This manifest defines the parallel execution strategy for implementing the contract kit across 5 agent teams. The system uses overlapping milestones with continuous auditing to ensure quality.

---

## Team Assignments

| Team | Name | Allocation | Primary Focus |
|------|------|------------|---------------|
| A | Audit & Compliance | 25% | Cross-team auditing, fix verification |
| B | WebUI Development | 25% | ControlCenterApp, Panels, Services |
| C | Runtime Development | 25% | EventBus, API, CircuitBreaker, Router |
| D | Hermes Development | 20% | Orchestrator, ZeroClaw Adapters |
| E | Integration | 15% | Module wiring, Proof module, Tests |

---

## Parallel Execution Timeline

### Day 1: Foundation (10% Milestone)

```
Team B ──────────────────────────────────────────────────────────
  └─ WEB-001: ControlCenterApp (4h) ──────────────────────►
  └─ WEB-008: EventBusClient (2h) ──────────────────────►
  └─ WEB-009: APIClient (2h) ────────────────────────────►

Team C ──────────────────────────────────────────────────────────
  └─ RT-001: EventBus/NATS (4h) ──────────────────────────►
  └─ RT-003: CircuitBreaker (3h) ──────────────────────────►

Team D ──────────────────────────────────────────────────────────
  └─ HER-001: HermesOrchestrator (6h) ────────────────────────►

Team A ──────────────────────────────────────────────────────────
  └─ OVL-001: 10% Milestone Audit ─────────────────────────►
  └─ OVL-004: WebUI↔Runtime Peer Review ─────────────────►
  └─ OVL-005: Runtime↔Hermes Peer Review ─────────────────►
```

**Day 1 Deliverables**:
- [ ] WEB-001: ControlCenterApp skeleton
- [ ] WEB-008: EventBusClient
- [ ] WEB-009: APIClient
- [ ] RT-001: EventBus with NATS
- [ ] RT-003: CircuitBreaker
- [ ] HER-001: HermesOrchestrator intake/contract phases
- [ ] OVL-001: 10% audit complete

---

### Day 2: Module Development (25% Milestone)

```
Team B ──────────────────────────────────────────────────────────
  └─ WEB-002: ProviderPanel (3h) ─────────────────────────►
  └─ WEB-003: AgentPanel (3h) ────────────────────────────►
  └─ WEB-004: WorkflowPanel (3h) ─────────────────────────►

Team C ──────────────────────────────────────────────────────────
  └─ RT-002: RuntimeCoreAPI (6h) ─────────────────────────────►
  └─ RT-004: ProviderRouter (4h) ────────────────────────►

Team D ──────────────────────────────────────────────────────────
  └─ HER-002: GitAdapter (3h) ─────────────────────────────►
  └─ HER-003: ShellAdapter (3h) ───────────────────────────►
  └─ HER-004: FilesystemAdapter (2h) ─────────────────────►

Team A ──────────────────────────────────────────────────────────
  └─ OVL-006: Hermes↔ZeroClaw Peer Review ─────────────────►
  └─ OVL-007: Integration Peer Review ─────────────────────►
```

**Day 2 Deliverables**:
- [ ] WEB-002: ProviderPanel
- [ ] WEB-003: AgentPanel
- [ ] WEB-004: WorkflowPanel
- [ ] RT-002: RuntimeCoreAPI (all routes)
- [ ] RT-004: ProviderRouter
- [ ] HER-002: GitAdapter
- [ ] HER-003: ShellAdapter
- [ ] HER-004: FilesystemAdapter

---

### Day 3: Completion (50% Milestone)

```
Team B ──────────────────────────────────────────────────────────
  └─ WEB-005: EvidencePanel (2h) ─────────────────────────►
  └─ WEB-006: RepairPanel (2h) ────────────────────────────►
  └─ WEB-007: SettingsPanel (2h) ─────────────────────────►

Team C ──────────────────────────────────────────────────────────
  └─ RT-005: SessionStore (2h) ───────────────────────────►
  └─ RT-006: HealthMonitor (2h) ──────────────────────────►

Team D ──────────────────────────────────────────────────────────
  └─ HER-005: ResearchAdapter (3h) ───────────────────────►
  └─ HER-006: ValidationEngine (2h) ──────────────────────►

Team A ──────────────────────────────────────────────────────────
  └─ OVL-002: 50% Milestone Audit ─────────────────────────────►
  └─ OVL-008: Fix Verification - Team B ──────────────────►
  └─ OVL-009: Fix Verification - Team C ──────────────────►
  └─ OVL-010: Fix Verification - Team D ──────────────────►
```

**Day 3 Deliverables**:
- [ ] WEB-005: EvidencePanel
- [ ] WEB-006: RepairPanel
- [ ] WEB-007: SettingsPanel
- [ ] RT-005: SessionStore
- [ ] RT-006: HealthMonitor
- [ ] HER-005: ResearchAdapter
- [ ] HER-006: ValidationEngine
- [ ] OVL-002: 50% audit complete
- [ ] All OVL-00x fix verifications complete

---

### Day 4: Integration Wiring (75% Milestone)

```
Team E ──────────────────────────────────────────────────────────
  └─ INT-001: Wire WebUI→Runtime (3h) ─────────────────────────►
  └─ INT-002: Wire Runtime→Hermes (3h) ─────────────────────────►
  └─ INT-003: Wire Hermes→ZeroClaw (2h) ───────────────────►

Team A ──────────────────────────────────────────────────────────
  └─ OVL-011: Fix Verification - Team E ───────────────────►
```

**Day 4 Deliverables**:
- [ ] INT-001: WebUI↔Runtime wired
- [ ] INT-002: Runtime↔Hermes wired
- [ ] INT-003: Hermes↔ZeroClaw wired

---

### Day 5: Proof Module & Testing (90% Milestone)

```
Team E ──────────────────────────────────────────────────────────
  └─ INT-004: Proof module (4h) ─────────────────────────────────►
  └─ INT-005: Integration tests (4h) ─────────────────────────────►

Team A ──────────────────────────────────────────────────────────
  └─ OVL-003: 90% Milestone Audit ─────────────────────────────►
```

**Day 5 Deliverables**:
- [ ] INT-004: Proof module complete
- [ ] INT-005: Integration tests written
- [ ] OVL-003: 90% audit complete

---

### Day 6: Finalization (100% Milestone)

```
Team E ──────────────────────────────────────────────────────────
  └─ INT-006: src/__init__.py (1h) ────────────────────────►
  └─ Run full integration test suite ─────────────────────────►

All Teams ───────────────────────────────────────────────────────
  └─ Address remaining audit findings ──────────────────────►

Team A ──────────────────────────────────────────────────────────
  └─ Final compliance certification ─────────────────────────►
```

**Day 6 Deliverables**:
- [ ] INT-006: Common types exported
- [ ] All integration tests pass
- [ ] Final audit sign-off
- [ ] Compliance certification issued

---

## Task Dependency Matrix

```
Task    │ Dependencies
────────┼────────────────────────────────────────────────────────
WEB-001 │ -
WEB-002 │ WEB-001
WEB-003 │ WEB-001
WEB-004 │ WEB-001
WEB-005 │ WEB-001
WEB-006 │ WEB-001
WEB-007 │ WEB-001
WEB-008 │ -
WEB-009 │ -
RT-001  │ -
RT-002  │ RT-001
RT-003  │ -
RT-004  │ RT-001, RT-003
RT-005  │ -
RT-006  │ RT-001, RT-004
HER-001 │ RT-001
HER-002 │ HER-001
HER-003 │ HER-001
HER-004 │ HER-001
HER-005 │ HER-001
HER-006 │ HER-001
INT-001 │ WEB-001, WEB-008, WEB-009, RT-002
INT-002 │ RT-001, HER-001
INT-003 │ HER-001, HER-002, HER-003, HER-004, HER-005
INT-004 │ HER-006
INT-005 │ INT-001, INT-002, INT-003, INT-004
INT-006 │ -
OVL-001 │ WEB-001, RT-001, HER-001, INT-001
OVL-002 │ WEB-002-009, RT-002-006, HER-002-006, INT-001-004
OVL-003 │ INT-005, INT-006
OVL-004 │ WEB-001, RT-002
OVL-005 │ RT-001, HER-001
OVL-006 │ HER-001, HER-002-005
OVL-007 │ INT-001-004
OVL-008 │ Issues from OVL-001, OVL-002, OVL-004
OVL-009 │ Issues from OVL-001, OVL-002, OVL-005
OVL-010 │ Issues from OVL-001, OVL-002, OVL-006
OVL-011 │ Issues from OVL-001, OVL-002, OVL-007
```

---

## Resource Requirements

### Team A (Audit)
- 4 auditors
- Audit tooling access
- Source code read access

### Team B (WebUI)
- Python 3.10+ environment
- WebUI component dependencies
- API client testing tools

### Team C (Runtime)
- NATS server instance
- Python async environment
- FastAPI testing tools

### Team D (Hermes)
- Git credentials (for GitAdapter testing)
- Shell execution environment
- Filesystem access

### Team E (Integration)
- Full environment access
- Test infrastructure
- Proof module dependencies

---

## Critical Path

```
Day 1: RT-001 (NATS EventBus) ──────────────────────┐
        └─ HER-001 (HermesOrchestrator) ────────────┼──► Day 4: Integration
        └─ RT-002 (RuntimeCoreAPI) ────────────────┤
                                                   │
Day 3: HER-002-006 (ZeroClaw Adapters) ─────────────┘
```

**Critical Path Tasks**: RT-001 → HER-001 → INT-001, INT-002, INT-003

---

## Verification Commands Summary

| Milestone | Command |
|-----------|---------|
| 10% | `python -c "from src.webui.control_center_app import ControlCenterApp"` |
| 25% | `python -c "from src.runtime.api import create_app"` |
| 50% | `python -c "from src.hermes.orchestrator import HermesOrchestrator"` |
| 75% | `python -c "from src.zeroclaw.adapters.git_adapter import GitAdapter"` |
| 90% | `python -c "from src.proof import ProofEngine"` |
| 100% | `python -m pytest tests/integration/ -v` |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| NATS connection issues | Medium | High | Mock event bus for testing |
| Adapter complexity | High | Medium | Start with simple adapters |
| Integration delays | Medium | High | Parallel wiring tasks |
| Audit findings backlog | Low | Medium | Daily fix sprints |
| Circular dependencies | Low | High | Architecture review on Day 2 |

---

## Success Criteria

1. **All tasks completed** within 6 days
2. **Zero P0 issues** at final audit
3. **All integration tests pass**
4. **End-to-end flow verified**
5. **Compliance certification issued**

---

## File Index

| File | Description |
|------|-------------|
| `00_AUDIT_TEAM_MANIFEST.md` | Team A responsibilities and protocols |
| `01_AUDIT_SOURCE_LOCATIONS.md` | Source patterns for auditing |
| `02_WEBUI_TASKS.md` | Team B task specifications |
| `03_RUNTIME_TASKS.md` | Team C task specifications |
| `04_HERMES_TASKS.md` | Team D task specifications |
| `05_INTEGRATION_TASKS.md` | Team E task specifications |
| `06_OVERLAPPING_AUDIT_TASKS.md` | Cross-team audit tasks |
| `07_EXECUTION_MANIFEST.md` | This file - master execution plan |

---

**Document Version**: 1.0  
**Created**: 2026-04-20  
**Status**: Active
