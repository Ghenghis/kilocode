# Windsurf Handoff Protocol

**Purpose:** Define exact interface between KiloCode agents and Windsurf for VPS operations  
**Rule:** Agents NEVER touch VPS directly - all SSH/ops handed to Windsurf  

---

## 🚫 Agent Restrictions

KiloCode agents CANNOT:
- SSH to 187.77.30.206
- Run docker commands on VPS
- Restart services
- Access production databases
- Run E2E tests requiring live services

KiloCode agents CAN:
- Write code
- Run unit tests (mocked)
- Commit to git branches
- Build deployment packages
- Request Windsurf to deploy/test

---

## 🔄 Handoff Protocol

### Step 1: Agent Completes Work
```python
# Agent finishes implementation
agent.complete({
    "agent_id": "Agent-01",
    "pool": "Core Runtime",
    "deliverables": [
        "src/runtime/core.py",
        "tests/test_eventbus.py"
    ],
    "tests_passing": True,
    "coverage": "85%",
    "branch": "agent-01-eventbus"
})
```

### Step 2: Integration Lead Merges
```python
# Agent-00 (Integration Lead) reviews and merges
integration.merge_branches([
    "agent-01-eventbus",
    "agent-02-provider-router",
    # ... all pool-1 branches
])
```

### Step 3: Build Deployment Package
```bash
# Agent-00 creates deployable package
python build_deploy_package.py \
  --pool=core-runtime \
  --output=deploy/core-runtime-v1.tar.gz
```

### Step 4: Request Windsurf Handoff
```python
# System generates handoff request
handoff.create({
    "request_id": "HANDOFF-001",
    "type": "DEPLOY_AND_TEST",
    "pool": "Core Runtime",
    "package": "deploy/core-runtime-v1.tar.gz",
    "vps_target": "187.77.30.206",
    "operations": [
        "upload_package",
        "install_dependencies", 
        "restart_service",
        "run_health_checks",
        "report_results"
    ],
    "timeout_minutes": 30,
    "callback_branch": "integration/runtime-tested"
})
```

### Step 5: Windsurf Executes
Windsurf receives handoff request and:
1. Downloads deployment package
2. SSH to VPS
3. Executes all operations
4. Captures logs/results
5. Reports success/failure
6. Pushes results to callback branch

### Step 6: Agents Continue
KiloCode agents pull results from callback branch and continue with next phase.

---

## 📦 Handoff Package Format

### Package Structure
```
handoff-{POOL}-{VERSION}.tar.gz
├── source/                    # Compiled source code
│   └── src/
│       └── runtime/
├── tests/                     # Test suite
│   └── test_*.py
├── deploy/                    # Deployment scripts
│   ├── install.sh
│   ├── service.service
│   └── nginx.conf
├── config/                    # Configuration
│   ├── .env.template
│   └── settings.yaml
└── handoff.yaml              # Handoff manifest
```

### handoff.yaml Format
```yaml
handoff_id: "HANDOFF-001"
timestamp: "2026-04-21T20:00:00Z"
pool: "Core Runtime"
version: "v1.0.0"

source:
  branch: "integration/core-runtime"
  commit: "abc123"
  files:
    - src/runtime/core.py
    - src/runtime/__init__.py

tests:
  unit_tests: "tests/test_runtime.py"
  coverage: "85%"
  passing: true
  
vps_operations:
  - name: "upload"
    command: "scp -r source/ root@187.77.30.206:/opt/runtime/"
    
  - name: "install_deps"
    command: "ssh root@187.77.30.206 'pip install -r /opt/runtime/requirements.txt'"
    
  - name: "restart_service"
    command: "ssh root@187.77.30.206 'systemctl restart runtime-api'"
    
  - name: "health_check"
    command: "ssh root@187.77.30.206 'curl -s http://localhost:8080/health'"
    expected_output: '{"status":"ok"}'
    
  - name: "run_e2e"
    command: "ssh root@187.77.30.206 'cd /opt/runtime && pytest tests/e2e/ -v'"
    
verification:
  health_endpoint: "http://187.77.30.206:8080/health"
  expected_status: 200
  timeout_seconds: 60

callback:
  branch: "integration/runtime-tested"
  report_file: "test-report.json"
```

---

## 🎯 Handoff Types

### Type 1: DEPLOY_AND_VERIFY
**Use:** New service deployment
**Operations:**
- Upload code
- Install dependencies
- Configure service
- Start service
- Run health checks

**Example:** Deploy Runtime API for first time

### Type 2: UPDATE_AND_ROLLBACK
**Use:** Update existing service with rollback option
**Operations:**
- Backup current version
- Upload new code
- Restart service
- Verify health
- [Conditional] Rollback if failed

**Example:** Update Hermes orchestrator

### Type 3: TEST_ONLY
**Use:** Run tests without changing code
**Operations:**
- Run E2E test suite
- Collect results
- Report pass/fail

**Example:** Run full E2E suite after all pools complete

### Type 4: RESTART_SAFE_VERIFY
**Use:** Prove restart-safe behavior
**Operations:**
- Record current state
- Stop all services
- Start all services
- Verify recovery
- Check data persistence

**Example:** Final acceptance verification

---

## 📊 Handoff Status Tracking

```
┌─────────────────────────────────────────────────────┐
│ HANDOFF STATUS BOARD                                │
├─────────────────────────────────────────────────────┤
│ HANDOFF-001 │ DEPLOY_AND_VERIFY │ PENDING          │
│             │ Core Runtime Pool │ Awaiting Windsurf│
├─────────────────────────────────────────────────────┤
│ HANDOFF-002 │ UPDATE_AND_ROLLBACK│ NOT_STARTED     │
│             │ ZeroClaw Adapters │ Blocked on 001   │
├─────────────────────────────────────────────────────┤
│ HANDOFF-003 │ TEST_ONLY         │ NOT_STARTED     │
│             │ Full E2E Suite    │ Blocked on 002  │
└─────────────────────────────────────────────────────┘
```

---

## 🔐 Security Model

### Agent Isolation
- Agents run in sandboxed worktrees
- No network access to VPS
- All credentials managed by Windsurf
- Code changes reviewed before handoff

### Windsurf Authorization
- Windsurf has SSH keys for VPS
- Windsurf executes only handoff.yaml commands
- Windsurf cannot modify agent code
- Windsurf reports results to git only

### Audit Trail
```
Agent Work → Git Branch → Review → Merge → Handoff Package → Windsurf Execute → Result → Git Callback
     ↑_________________________________________________________________________________________↓
```

---

## 🚀 Quick Reference

### Agent Creates Handoff Request
```python
from contract_kit import Handoff

handoff = Handoff.create(
    pool="Core Runtime",
    operations=[
        Operation.upload("/opt/runtime/"),
        Operation.install_deps(),
        Operation.restart_service("runtime-api"),
        Operation.health_check("http://localhost:8080/health"),
        Operation.run_tests("tests/e2e/test_runtime.py")
    ]
)
handoff.submit()
```

### Windsurf Receives and Executes
```bash
# Windsurf CLI
windsurf handoff receive HANDOFF-001
windsurf handoff execute HANDOFF-001 --vps=187.77.30.206
windsurf handoff report HANDOFF-001 --result=success
```

### Result Callback
```yaml
# windsurf-results/HANDOFF-001-result.yaml
handoff_id: "HANDOFF-001"
status: "SUCCESS"
timestamp: "2026-04-21T21:00:00Z"
results:
  upload: "OK"
  install_deps: "OK"
  restart_service: "OK"
  health_check: '{"status":"ok"}'
  tests: 
    passed: 15
    failed: 0
    coverage: "87%"
logs: |
  [2026-04-21T20:45:00Z] Starting upload...
  [2026-04-21T20:45:15Z] Upload complete
  [2026-04-21T20:45:16Z] Installing dependencies...
  ...
```

---

*Protocol Version: 1.0*  
*Agents: Isolated worktrees only*  
*Windsurf: VPS operations only*  
*Interface: Git + handoff.yaml*
