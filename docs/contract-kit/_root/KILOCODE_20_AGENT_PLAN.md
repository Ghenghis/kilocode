# KiloCode 20-Agent Contract Kit Completion Plan

**Objective:** Complete Contract Kit V17 using KiloCode's 20-agent parallel architecture
**Approach:** Agents work in isolated worktrees, SSH/VPS ops handed to Windsurf
**Timeline:** Parallel execution reduces 300 hours → ~40 hours wall-clock

---

## 🎯 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│           KILOCODE AGENT ORCHESTRATOR (20 Agents)               │
├─────────────────────────────────────────────────────────────────┤
│  Agent Pool 1 (Core Runtime)    │  Agent Pool 2 (Adapters)      │
│  ├── Agent-01: EventBus         │  ├── Agent-06: BaseAdapter    │
│  ├── Agent-02: ProviderRouter   │  ├── Agent-07: GitAdapter     │
│  ├── Agent-03: CircuitBreaker   │  ├── Agent-08: ShellAdapter   │
│  ├── Agent-04: SettingsManager  │  ├── Agent-09: Filesystem     │
│  └── Agent-05: HealthMonitor    │  └── Agent-10: Research       │
├─────────────────────────────────────────────────────────────────┤
│  Agent Pool 3 (Hermes)          │  Agent Pool 4 (WebUI/KiloCode)  │
│  ├── Agent-11: Intake           │  ├── Agent-16: ControlCenter  │
│  ├── Agent-12: ContractCreate   │  ├── Agent-17: ProviderPanel  │
│  ├── Agent-13: TaskFanout       │  ├── Agent-18: AgentPanel     │
│  ├── Agent-14: Validation       │  ├── Agent-19: RuntimeSync    │
│  └── Agent-15: Evidence         │  └── Agent-20: SettingsPanel  │
├─────────────────────────────────────────────────────────────────┤
│  WINDSURF HANDOFF (VPS Operations)                              │
│  ├── Deploy compiled code to VPS                               │
│  ├── Start/stop/restart services                               │
│  ├── Run E2E tests on live VPS                                 │
│  ├── Verify restart-safe behavior                              │
│  └── Final acceptance verification                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 👥 Agent Assignments (20 Parallel Workstreams)

### Pool 1: Core Runtime (Agents 1-5)
**Target:** `src/runtime/core.py` + `src/runtime/__init__.py`

| Agent | Responsibility | Methods to Implement | Output |
|-------|---------------|---------------------|--------|
| **Agent-01** | EventBus | `connect()`, `publish()`, `subscribe()`, `disconnect()` | Working NATS integration |
| **Agent-02** | ProviderRouter | `route_request()`, `get_provider_status()`, `failover()` | Provider selection logic |
| **Agent-03** | CircuitBreaker | `check_state()`, `record_success()`, `record_failure()`, `open()`, `close()` | Failover mechanism |
| **Agent-04** | SettingsManager | `load_settings()`, `save_settings()`, `validate()`, `get()`, `set()` | Canonical settings API |
| **Agent-05** | HealthMonitor | `health_check()`, `check_dependencies()`, `report_status()` | Health aggregation |

**Handoff to Windsurf:** 
- Deploy Runtime API to VPS port 8080
- Verify health endpoint responds
- Test settings endpoints

---

### Pool 2: ZeroClaw Adapters (Agents 6-10)
**Target:** `src/zeroclaw/adapters.py` + `src/zeroclaw/__init__.py`

| Agent | Responsibility | Methods to Implement | Output |
|-------|---------------|---------------------|--------|
| **Agent-06** | BaseAdapter (Core) | `execute()`, `validate()`, `sanitize()`, `log_operation()` | Abstract base concrete |
| **Agent-07** | GitAdapter | `clone()`, `commit()`, `push()`, `pull()`, `branch()`, `diff()` | Git operations |
| **Agent-08** | ShellAdapter | `run_command()`, `check_output()`, `stream_output()`, `timeout_handler()` | Shell execution |
| **Agent-09** | FilesystemAdapter | `read()`, `write()`, `delete()`, `list()`, `exists()`, `stat()` | File operations |
| **Agent-10** | ResearchAdapter | `search()`, `scrape()`, `summarize()`, `cache_result()` | Web research |

**Handoff to Windsurf:**
- Test adapters in Hermes containers
- Verify SSH/git/shell operations work
- Run adapter unit tests

---

### Pool 3: Hermes Orchestrator (Agents 11-15)
**Target:** `src/hermes/orchestrator.py` + `src/hermes/__init__.py`

| Agent | Responsibility | Methods to Implement | Output |
|-------|---------------|---------------------|--------|
| **Agent-11** | Intake | `intake()`, `normalize_request()`, `validate_input()` | Request normalization |
| **Agent-12** | ContractCreate | `create_contract()`, `generate_id()`, `set_criteria()` | Contract lifecycle |
| **Agent-13** | TaskFanout | `fanout_tasks()`, `distribute_to_agents()`, `track_progress()` | Task distribution |
| **Agent-14** | Validation | `validate_execution()`, `check_criteria()`, `generate_report()` | Acceptance validation |
| **Agent-15** | Evidence | `collect_evidence()`, `attach_artifact()`, `verify_proof()` | Evidence pipeline |

**Handoff to Windsurf:**
- Deploy Hermes orchestrator to all 5 containers
- Test task flow: intake → contract → fanout → validation
- Verify evidence collection

---

### Pool 4: WebUI & KiloCode (Agents 16-20)
**Target:** `src/webui/control_center.py` + `src/kilocode/runtime_sync.py`

| Agent | Responsibility | Methods to Implement | Output |
|-------|---------------|---------------------|--------|
| **Agent-16** | ControlCenterApp | `mount_panel()`, `get_routes()`, `health_check()` | Main app shell |
| **Agent-17** | ProviderPanel | `get_status()`, `get_metrics()`, `render_ui()` | Provider dashboard |
| **Agent-18** | AgentPanel | `list_agents()`, `get_agent()`, `render_ui()` | Agent management |
| **Agent-19** | RuntimeSync | `sync_task_state()`, `push_update()`, `pull_status()` | VSIX sync |
| **Agent-20** | SettingsPanel | `get_settings()`, `update_setting()`, `autofill()` | Settings UI |

**Handoff to Windsurf:**
- Deploy WebUI to Open WebUI integration
- Test control center panels load
- Verify VSIX integration points

---

## 🔄 Agent Workflow Pattern

### Phase 1: Isolated Development (Parallel)
```
Each Agent:
  1. Clone contract-kit-v17 to worktree
  2. Read target file(s) 
  3. Identify TODO/stub markers
  4. Implement methods with tests
  5. Run local smoke tests
  6. Commit to worktree branch
  7. Push branch to origin
```

### Phase 2: Cross-Agent Integration (Sequential)
```
Integration Lead (Agent-00):
  1. Review all 20 agent branches
  2. Merge into integration branch
  3. Resolve conflicts
  4. Run integration tests
  5. Build deployment package
  6. Handoff to Windsurf for VPS ops
```

### Phase 3: Windsurf VPS Operations (Handoff)
```
Windsurf receives:
  - Compiled contract-kit-v17 package
  - Deployment scripts
  - Test suite
  - Configuration templates

Windsurf executes:
  1. Deploy to VPS 187.77.30.206
  2. Start all services
  3. Run E2E tests
  4. Verify restart-safe behavior
  5. Report results back to KiloCode
```

---

## 📋 Per-Agent Task Specification

### Agent Template (Each agent receives)

```yaml
agent_id: "Agent-01"
name: "EventBus Implementer"
pool: "Core Runtime"
target_files:
  - src/runtime/core.py (lines 45-180)
  - src/runtime/__init__.py

methods_to_implement:
  - name: "connect"
    signature: "async def connect(self) -> bool"
    description: "Connect to NATS server"
    acceptance_criteria:
      - "Successfully connects to nats://localhost:4222"
      - "Sets self.connected = True"
      - "Returns True on success, False on failure"
    
  - name: "publish"
    signature: "async def publish(self, subject: str, message: dict) -> bool"
    description: "Publish message to NATS subject"
    acceptance_criteria:
      - "Message serialized to JSON"
      - "Published to correct subject"
      - "Returns True on success"
  
  - name: "subscribe"
    signature: "async def subscribe(self, subject: str, callback: Callable) -> str"
    description: "Subscribe to NATS subject with callback"
    acceptance_criteria:
      - "Returns subscription ID"
      - "Callback invoked on message"
      - "Can unsubscribe via ID"

test_requirements:
  - "Unit test: connect_success"
  - "Unit test: connect_failure"
  - "Unit test: publish_roundtrip"
  - "Unit test: subscribe_callback"
  - "Integration test: with_mock_nats"

dependencies:
  - "nats-py library"
  - "asyncio"

handoff_trigger: "All tests pass, code committed"
handoff_to: "Integration Lead (Agent-00)"
```

---

## 🖥️ Windsurf Handoff Specifications

### Handoff Point 1: Runtime API Deployment
**Trigger:** Pool 1 completes EventBus + ProviderRouter

**Windsurf receives:**
```
Deliverables:
  - src/runtime/ (compiled Python)
  - requirements.txt
  - runtime-api.service (systemd)
  - deploy_runtime_api.py
  
VPS Target: 187.77.30.206
Actions:
  1. Upload /opt/runtime-api/
  2. Install dependencies
  3. Start systemd service
  4. Verify: curl http://localhost:8080/health
  5. Report: Health status + any errors
```

### Handoff Point 2: Adapter Testing
**Trigger:** Pool 2 completes all 4 adapters

**Windsurf receives:**
```
Deliverables:
  - src/zeroclaw/ (compiled Python)
  - test_adapters.py
  
VPS Target: hermes1-5 containers
Actions:
  1. Copy to /opt/hermes/src/zeroclaw/
  2. Test imports in each container
  3. Run adapter unit tests
  4. Verify: Git, Shell, Filesystem, Research ops
  5. Report: Test results + container status
```

### Handoff Point 3: Hermes Orchestrator
**Trigger:** Pool 3 completes workflow engine

**Windsurf receives:**
```
Deliverables:
  - src/hermes/ (compiled Python)
  - integration.py (wiring layer)
  - test_orchestrator.py
  
VPS Target: All 5 Hermes containers
Actions:
  1. Deploy to /opt/hermes/src/
  2. Test end-to-end flow:
     - Create task packet
     - Submit to hermes1
     - Verify fanout to H1-H5
     - Collect evidence
  3. Report: Task completion time + success rate
```

### Handoff Point 4: Full E2E Testing
**Trigger:** All 20 agents complete, integration done

**Windsurf receives:**
```
Deliverables:
  - Full contract-kit-v17 package
  - docker-compose.yml
  - tests/e2e/ (full suite)
  - deploy_contract_kit.py
  
VPS Target: 187.77.30.206 full stack
Actions:
  1. Deploy complete kit
  2. Start: NATS, PostgreSQL, Shiba, Runtime API, 5x Hermes
  3. Run all E2E tests
  4. Verify restart-safe:
     - Stop all services
     - Start all services
     - Verify recovery
  5. Generate test report
  6. Report: PASS/FAIL with logs
```

---

## ⏱️ Timeline Estimate

### Parallel Agent Execution (Wall-clock)

| Phase | Agents | Duration | Handoff |
|-------|--------|----------|---------|
| Pool 1: Core Runtime | 5 | 8 hours | → Windsurf deploys API |
| Pool 2: Adapters | 5 | 8 hours | → Windsurf tests adapters |
| Pool 3: Hermes | 5 | 8 hours | → Windsurf tests workflow |
| Pool 4: WebUI/KiloCode | 5 | 8 hours | → Windsurf deploys UI |
| Integration | 1 (lead) | 4 hours | → Windsurf E2E testing |
| **Total Wall-clock** | **20+1** | **~40 hours** | |

**vs Sequential (300 hours)** = **7.5x speedup**

---

## 🛠️ Agent Tooling Requirements

Each agent needs:

```bash
# KiloCode provides:
- File read/write access to worktree
- Git operations (branch, commit, push)
- Python interpreter
- pytest for testing
- Access to contract-kit-v17 docs

# No SSH/VPS access (handoff to Windsurf):
- Cannot run docker commands
- Cannot SSH to 187.77.30.206
- Cannot restart services
- Cannot run VPS E2E tests
```

---

## 📊 Success Metrics

### Per-Agent Completion
- [ ] All assigned methods implemented
- [ ] Unit tests passing (>80% coverage)
- [ ] No TODO markers remaining
- [ ] Code committed to branch
- [ ] Smoke tests successful

### Integration Completion  
- [ ] All 20 branches merged
- [ ] Integration tests passing
- [ ] No import errors
- [ ] Package builds successfully

### Windsurf VPS Verification
- [ ] All services deployed
- [ ] Health checks passing
- [ ] All 9 E2E tests passing
- [ ] Restart-safe verified
- [ ] Final report generated

---

## 🚀 Kickoff Command

To initiate this plan:

```bash
# 1. Create 20 agent worktrees
cd G:\Github\contract-kit-v17
for i in {01..20}; do
  git worktree add ../agent-worktrees/agent-$i -b agent-$i-branch
done

# 2. Dispatch agents (KiloCode manages this)
kilocode agents dispatch --config 20-agent-plan.yaml

# 3. Monitor progress
kilocode agents status --watch

# 4. Trigger handoffs when agents complete
kilocode handoff --trigger="pool-1-complete" --to=windsurf
```

---

## 📝 Notes

- **No agent has VPS/SSH access** - all remote ops handoff to Windsurf
- **Agents work in isolation** - no conflicts between worktrees
- **Integration lead coordinates** - single point of merge
- **Windsurf handles production** - only Windsurf touches VPS
- **Rollback plan:** Each agent branch can be reverted independently

---

*Plan Version: 1.0*  
*Agents: 20 parallel workstreams*  
*Estimated Wall-clock: 40 hours*  
*Handoff Points: 4 VPS operations*
