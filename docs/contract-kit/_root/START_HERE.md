# 🚀 START HERE - KiloCode 20-Agent Execution

**Mission:** Complete Contract Kit V17 to 95% using 20 parallel agents  
**Target:** Only 5% remaining (VPS deployment) for Windsurf handoff  
**Duration:** ~16 hours wall-clock  

---

## ⚡ IMMEDIATE ACTION REQUIRED

### Step 1: DISPATCH PHASE 1 (Agents 1-10) - DO THIS NOW

```bash
cd G:\Github\contract-kit-v17

# Create worktrees for all 20 agents
python -c "
import subprocess
for i in range(1, 21):
    agent = f'agent-{i:02d}'
    subprocess.run(['git', 'worktree', 'add', f'../agent-worktrees/{agent}', '-b', f'{agent}-branch'], check=True)
    print(f'Created worktree for {agent}')
"

# Dispatch Phase 1 agents IMMEDIATELY
# These 10 agents can all start NOW (no dependencies)
```

**KiloCode VSIX: Execute these commands:**

1. **Open KiloCode VSIX Panel** (Ctrl+Shift+P → "KiloCode: Open Agent Panel")

2. **Dispatch Agents 1-10:**
   ```
   Click: "Dispatch Agents"
   Select: agent-01, agent-02, agent-03, agent-04, agent-05
   Select: agent-06, agent-07, agent-08, agent-09, agent-10
   API: MiniMax
   Model: MiniMax-Text-01
   Instructions: "Read KILOCODE_KICKOFF.md for your specific task"
   ```

3. **Start Monitoring:**
   ```bash
   python agent_monitor_dashboard.py
   ```

---

## 📋 WHAT EACH AGENT DOES (From KILOCODE_KICKOFF.md)

### Phase 1: Foundation (START NOW)

| Agent | Task | File | Methods | Est. Time |
|-------|------|------|---------|-----------|
| **Agent-01** | Implement EventBus | `src/runtime/core.py` | 6 methods | 6 hours |
| **Agent-02** | Implement ProviderRouter | `src/runtime/core.py` | 5 methods | 6 hours |
| **Agent-03** | Implement CircuitBreaker | `src/runtime/core.py` | 6 methods | 5 hours |
| **Agent-04** | Implement SettingsManager | `src/runtime/core.py` | 6 methods | 5 hours |
| **Agent-05** | Implement RuntimeCoreAPI | `src/runtime/core.py` | 5 methods | 6 hours |
| **Agent-06** | Implement BaseAdapter | `src/zeroclaw/adapters.py` | 6 methods | 6 hours |
| **Agent-07** | Implement GitAdapter | `src/zeroclaw/adapters.py` | 7 methods | 6 hours |
| **Agent-08** | Implement ShellAdapter | `src/zeroclaw/adapters.py` | 5 methods | 5 hours |
| **Agent-09** | Implement FilesystemAdapter | `src/zeroclaw/adapters.py` | 8 methods | 5 hours |
| **Agent-10** | Implement ResearchAdapter | `src/zeroclaw/adapters.py` | 5 methods | 6 hours |

### Phase 2: Orchestration (START AFTER Phase 1)

| Agent | Task | File | Methods | Est. Time |
|-------|------|------|---------|-----------|
| **Agent-11** | Implement Intake | `src/hermes/orchestrator.py` | 5 methods | 5 hours |
| **Agent-12** | Implement Contract Lifecycle | `src/hermes/orchestrator.py` | 6 methods | 6 hours |
| **Agent-13** | Implement Task Fanout | `src/hermes/orchestrator.py` | 6 methods | 6 hours |
| **Agent-14** | Implement Validation | `src/hermes/orchestrator.py` | 6 methods | 6 hours |
| **Agent-15** | Implement Evidence | `src/hermes/orchestrator.py` | 5 methods | 5 hours |
| **Agent-16** | Implement ControlCenter | `src/webui/control_center.py` | 5 methods | 5 hours |
| **Agent-17** | Implement ProviderPanel | `src/webui/control_center.py` | 5 methods | 5 hours |
| **Agent-18** | Implement AgentPanel | `src/webui/control_center.py` | 5 methods | 5 hours |
| **Agent-19** | Implement RuntimeSync | `src/kilocode/runtime_sync.py` | 6 methods | 6 hours |
| **Agent-20** | Implement SettingsPanel | `src/webui/control_center.py` | 5 methods | 5 hours |

---

## 🎯 90-95% vs 5-10% SPLIT

### What KiloCode Completes (90-95%):
- ✅ All 170 methods implemented
- ✅ All unit tests passing (>80% coverage)
- ✅ All 20 agent branches merged
- ✅ Integration tests passing
- ✅ 4 deployment packages built
- ✅ `KILOCODE_HANDOFF_FOR_WINDSURF.md` generated
- ✅ Code committed to `integration/main`

### What Windsurf Completes (5-10%):
- ⏳ Upload packages to VPS 187.77.30.206
- ⏳ Start Runtime API service
- ⏳ Deploy to 5 Hermes containers
- ⏳ Configure nginx/Open WebUI
- ⏳ Run E2E tests on live infrastructure
- ⏳ Verify restart-safe behavior
- ⏳ Generate final acceptance report

---

## 🖥️ KILOCODE VSIX COMMANDS

### Command 1: Create Worktrees
```python
# In KiloCode Python terminal
import subprocess
import os

os.chdir("G:\\Github\\contract-kit-v17")

for i in range(1, 21):
    agent = f"agent-{i:02d}"
    try:
        subprocess.run([
            "git", "worktree", "add", 
            f"../agent-worktrees/{agent}",
            "-b", f"{agent}-branch"
        ], check=True)
        print(f"✓ Created {agent}")
    except Exception as e:
        print(f"✗ {agent}: {e}")
```

### Command 2: Dispatch Phase 1
```yaml
# In KiloCode Agent Dispatch Panel:
dispatch:
  phase: 1
  agents:
    - agent-01
    - agent-02
    - agent-03
    - agent-04
    - agent-05
    - agent-06
    - agent-07
    - agent-08
    - agent-09
    - agent-10
  api: minimax
  model: MiniMax-Text-01
  context_files:
    - KILOCODE_KICKOFF.md
    - kilocode-agents.yaml
  instructions: |
    Read your task in KILOCODE_KICKOFF.md
    Implement all methods assigned to you
    Write unit tests for your methods
    Commit to your branch when complete
    Create .agent-complete-{your-id} marker file
```

### Command 3: Monitor Progress
```bash
# Terminal 1: Run dashboard
python agent_monitor_dashboard.py

# Terminal 2: Check git status
cd G:\Github\contract-kit-v17
watch -n 5 "git branch -a | grep agent"

# Terminal 3: Check completion markers
ls -la .agent-complete-* 2>/dev/null | wc -l
```

### Command 4: Dispatch Phase 2 (After Phase 1)
```yaml
dispatch:
  phase: 2
  agents:
    - agent-11
    - agent-12
    - agent-13
    - agent-14
    - agent-15
    - agent-16
    - agent-17
    - agent-18
    - agent-19
    - agent-20
  api: minimax
  model: MiniMax-Text-01
  depends_on: phase-1-complete
```

### Command 5: Run Integration (After Phase 2)
```bash
# When all 20 agents complete:
python agent_00_integration_lead.py G:\Github\contract-kit-v17

# This will:
# 1. Merge all 20 branches
# 2. Resolve conflicts
# 3. Run integration tests
# 4. Build 4 packages
# 5. Generate KILOCODE_HANDOFF_FOR_WINDSURF.md
```

---

## ✅ COMPLETION CHECKLIST

### Phase 1 Complete (6 hours)
- [ ] All 10 agents dispatched
- [ ] All 10 branches created
- [ ] Worktrees populated with code
- [ ] Monitoring dashboard showing progress

### Phase 2 Complete (12 hours total)
- [ ] All 10 Phase 2 agents dispatched
- [ ] All 20 agents showing COMPLETE status
- [ ] All branches have commits
- [ ] All .agent-complete-* markers exist

### Integration Complete (16 hours total)
- [ ] Agent-00 integration script run
- [ ] All 20 branches merged to integration/main
- [ ] No merge conflicts remaining
- [ ] All integration tests passing
- [ ] 4 deployment packages built
- [ ] `KILOCODE_HANDOFF_FOR_WINDSURF.md` generated
- [ ] 95% completion achieved

### Handoff Ready
- [ ] Handoff document committed to git
- [ ] Document contains all VPS deployment instructions
- [ ] Document contains all E2E test commands
- [ ] Document contains troubleshooting guide
- [ ] Ready for Windsurf to execute final 5%

---

## 📊 EXPECTED OUTPUTS

### After Phase 1:
```
../agent-worktrees/
├── agent-01/src/runtime/core.py (EventBus implemented)
├── agent-02/src/runtime/core.py (ProviderRouter implemented)
├── agent-03/src/runtime/core.py (CircuitBreaker implemented)
├── agent-04/src/runtime/core.py (SettingsManager implemented)
├── agent-05/src/runtime/core.py (RuntimeCoreAPI implemented)
├── agent-06/src/zeroclaw/adapters.py (BaseAdapter implemented)
├── agent-07/src/zeroclaw/adapters.py (GitAdapter implemented)
├── agent-08/src/zeroclaw/adapters.py (ShellAdapter implemented)
├── agent-09/src/zeroclaw/adapters.py (FilesystemAdapter implemented)
└── agent-10/src/zeroclaw/adapters.py (ResearchAdapter implemented)
```

### After Phase 2:
```
../agent-worktrees/
├── agent-11/src/hermes/orchestrator.py (Intake implemented)
├── agent-12/src/hermes/orchestrator.py (Contract lifecycle implemented)
├── agent-13/src/hermes/orchestrator.py (Task fanout implemented)
├── agent-14/src/hermes/orchestrator.py (Validation implemented)
├── agent-15/src/hermes/orchestrator.py (Evidence implemented)
├── agent-16/src/webui/control_center.py (ControlCenter implemented)
├── agent-17/src/webui/control_center.py (ProviderPanel implemented)
├── agent-18/src/webui/control_center.py (AgentPanel implemented)
├── agent-19/src/kilocode/runtime_sync.py (RuntimeSync implemented)
└── agent-20/src/webui/control_center.py (SettingsPanel implemented)
```

### After Integration:
```
G:\Github\contract-kit-v17/
├── src/                    (All code merged)
├── tests/                  (All tests passing)
├── deploy/
│   ├── core-runtime-package.tar.gz
│   ├── zeroclaw-adapters-package.tar.gz
│   ├── hermes-orchestrator-package.tar.gz
│   └── webui-kilocode-package.tar.gz
├── KILOCODE_HANDOFF_FOR_WINDSURF.md  ← WINDSURF USES THIS
└── integration/main        (Merged branch)
```

---

## 🎉 SUCCESS CRITERIA

**KiloCode has succeeded when:**
1. All 170 methods implemented across 6 modules
2. All unit tests passing (>80% coverage)
3. All 20 agent branches merged
4. Integration tests passing
5. 4 deployment packages built
6. `KILOCODE_HANDOFF_FOR_WINDSURF.md` generated and committed
7. 95% completion achieved

**Windsurf takes over when:**
- KiloCode generates handoff document
- Document contains VPS deployment commands
- Document contains E2E test procedures
- Only VPS execution + verification remains

---

## 🚨 TROUBLESHOOTING

### Problem: Agent not starting
```bash
# Check worktree exists
ls -la ../agent-worktrees/agent-01/

# If missing, recreate:
git worktree add ../agent-worktrees/agent-01 -b agent-01-branch
```

### Problem: Agent shows FAILED
```bash
# Check error log
cat .agent-failed-agent-01

# Redispatch agent after fixing issue
# (Modify code, then redispatch)
```

### Problem: Merge conflict
```bash
# Integration lead (Agent-00) handles this
python agent_00_integration_lead.py

# If conflicts persist, manual resolution:
git checkout integration/main
git merge agent-01-branch
# Resolve conflicts in editor
git commit -m "Merge agent-01 (conflicts resolved)"
```

---

## ⏱️ TIMELINE SUMMARY

| Phase | Time | Action |
|-------|------|--------|
| 0:00 | 0 min | Dispatch Phase 1 (Agents 1-10) |
| 0:05 | 5 min | Dashboard shows all agents IN_PROGRESS |
| 6:00 | 6 hours | Phase 1 complete (all agents COMPLETE) |
| 6:00 | 6 hours | Dispatch Phase 2 (Agents 11-20) |
| 12:00 | 12 hours | Phase 2 complete |
| 12:00 | 12 hours | Run Agent-00 integration |
| 16:00 | 16 hours | Integration complete, handoff ready |

**Total: 16 hours to 95% completion**

---

## 🎯 NEXT STEP

**RIGHT NOW:**
1. Open KiloCode VSIX
2. Dispatch Agents 1-10
3. Run `python agent_monitor_dashboard.py`
4. Watch progress in real-time

**DO NOT WAIT** - Agents 1-10 have no dependencies and can all start immediately.

---

**Documents for Reference:**
- `KILOCODE_KICKOFF.md` - Detailed agent task specifications
- `kilocode-agents.yaml` - Agent configuration
- `KILOCODE_HANDOFF_TEMPLATE.md` - What gets generated for Windsurf
- `agent_monitor_dashboard.py` - Real-time progress tracking
- `agent_00_integration_lead.py` - Merge orchestration

---

**START TIME:** {NOW}  
**TARGET COMPLETION:** +16 hours  
**WINDSURF HANDOFF:** KILOCODE_HANDOFF_FOR_WINDSURF.md  

**→ DISPATCH AGENTS 1-10 NOW ←**
