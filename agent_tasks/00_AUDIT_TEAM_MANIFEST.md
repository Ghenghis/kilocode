# Agent Team A (Auditors) - Team Manifest
**Team**: Audit & Compliance  
**Allocation**: 25% of total work  
**Role**: Continuous auditing across all phases with fix-on-discover protocol

---

## Team Responsibilities

### Core Audit Functions
1. **Phase Audits**: Audit each development phase at 10%, 50%, 90% completion
2. **Cross-Audits**: Review work products from Teams B, C, D, E
3. **Fix Verification**: Verify fixes are implemented correctly before sign-off
4. **Compliance Checking**: Ensure all code meets contract kit standards

### Audit Schedule
| Milestone | Audit Focus | Team Members |
|-----------|-------------|--------------|
| 10% | Initial patterns, source locations, dependencies | All auditors |
| 50% | Mid-point review, cross-team integration points | Senior auditors |
| 90% | Final verification, regression testing | Full team |

---

## Cross-Audit Responsibilities

### Team A ↔ Team B (WebUI)
- Verify WebUI components implement required interfaces
- Audit event handler registrations
- Check state management patterns
- Validate async method signatures

### Team A ↔ Team C (Runtime)
- Audit NATS event bus integration
- Verify FastAPI route implementations
- Check circuit breaker logic
- Validate provider routing algorithms

### Team A ↔ Team D (Hermes)
- Audit orchestrator fan-out patterns
- Verify ZeroClaw adapter contracts
- Check validation logic completeness
- Validate error propagation

### Team A ↔ Team E (Integration)
- Audit module wiring correctness
- Verify integration test coverage
- Check proof module implementation
- Validate end-to-end flows

---

## Fix-on-Discover Protocol

```
DISCOVER → DOCUMENT → ASSIGN → FIX → VERIFY → SIGN-OFF
    1         2         3       4       5          6
```

### Step Details
1. **Discover**: Identify non-compliance or defect
2. **Document**: Create issue in audit log with severity (P0/P1/P2)
3. **Assign**: Assign to responsible team with deadline
4. **Fix**: Team implements fix
5. **Verify**: Audit team verifies fix implementation
6. **Sign-Off**: Mark issue resolved in audit tracker

---

## Real Source Locations for Audit

### hermes-agent-2026.4.13 Source Locations
| File | Lines | Audit Focus |
|------|-------|-------------|
| `src/core/base_agent.py` | 70-150 | Agent base class implementation |
| `src/core/orchestrator.py` | 100-200 | Orchestrator patterns |
| `src/core/event_bus.py` | 50-120 | Event bus integration |
| `web/src/components/*.tsx` | All | WebUI component patterns |
| `gateway/run.py` | 1-100 | Gateway routing patterns |

### VPS Source Locations
| File | Purpose | Audit Focus |
|------|---------|-------------|
| `_scripts/hermes/deploy_hermes.py` | Deployment | Deployment pattern compliance |
| `_scripts/diagnostics/complete_e2e_audit.py` | Audit | Audit methodology |
| `_scripts/health/monitor.py` | Health checks | Health monitoring patterns |

### kilocode-Azure2 Source Locations
| File | Purpose | Audit Focus |
|------|---------|-------------|
| `packages/kilo-vscode/src/services/routing/` | Provider routing | Routing pattern compliance |
| `packages/kilo-core/src/agent/` | Agent core | Agent implementation patterns |

---

## Deliverables

1. **Audit Report** (per milestone): `audit_report_<team>_<milestone>.md`
2. **Fix Verification Log**: `fix_verification_log.md`
3. **Compliance Certificate**: `compliance_certificate_<phase>.md`
4. **Issue Tracker**: `audit_issues_<team>.md`

---

## Team Members & Assignments

| Auditor | Primary Team | Secondary Team | Focus Areas |
|---------|--------------|----------------|-------------|
| Auditor-1 | WebUI (B) | Runtime (C) | UI patterns, API contracts |
| Auditor-2 | Runtime (C) | Hermes (D) | Backend patterns, event flows |
| Auditor-3 | Hermes (D) | Integration (E) | Orchestration, adapters |
| Auditor-4 | Integration (E) | WebUI (B) | Module wiring, proofs |

---

## Communication Protocol

- **Daily Standup**: 09:00 UTC - Audit progress sync
- **Issue Escalation**: Immediate via audit channel
- **Milestone Reports**: Submitted at each 10% increment
- **Emergency Fix**: <2 hour response for P0 issues
