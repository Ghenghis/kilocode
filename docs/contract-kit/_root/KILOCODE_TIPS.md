# KILOCODE TIPS & BEST PRACTICES
# Everything You Need to Complete 90-95% Successfully

---

## 🎯 SUCCESS FRAMEWORK

### The 90-95% Completion Strategy
**KiloCode completes:** Code implementation, unit tests, integration, packages  
**Windsurf completes:** VPS deployment, live E2E testing, final verification  

**Your Goal:** Get to 95% complete, then handoff 5% to Windsurf via `KILOCODE_HANDOFF_FOR_WINDSURF.md`

---

## 📚 DOCUMENTATION HIERARCHY

### READ IN THIS ORDER:

1. **START_HERE.md** ← READ FIRST
   - Complete kickoff instructions
   - 20-agent dispatch sequence
   - Timeline (16 hours to 95%)

2. **KILOCODE_CORRECTIONS.md** ← READ SECOND
   - Exact paths
   - Common mistakes to avoid
   - Path verification

3. **KILOCODE_KICKOFF.md** ← READ THIRD
   - Detailed agent task cards
   - Method specifications
   - Acceptance criteria

4. **kilocode-agents.yaml** ← REFERENCE
   - Agent configuration
   - Dependencies
   - Handoff triggers

5. **THIS FILE (KILOCODE_TIPS.md)** ← REFERENCE WHILE WORKING
   - Tips & tricks
   - Problem solving
   - Best practices

---

## 🚀 EFFICIENT AGENT DISPATCH

### Batch Processing (Don't Overthink)

**Phase 1 (Agents 1-10):** Can ALL start immediately  
**Phase 2 (Agents 11-20):** Start after Phase 1 completes  
**Integration (Agent-00):** Runs after all 20 complete

### Python Dispatch Script
```python
import subprocess
import asyncio

REPO = "g:\\Github\\contract-kit-v17"

async def dispatch_agent(agent_id: str, methods: list):
    """Dispatch single agent to implement methods"""
    
    worktree = f"g:\\Github\\agent-worktrees\\{agent_id}"
    
    # Read source file
    with open(f"{REPO}\\src\\runtime\\core.py") as f:
        source = f.read()
    
    # Find TODO markers for this agent's methods
    for method in methods:
        # Implement method
        # Write tests
        pass
    
    # Commit
    subprocess.run(
        ["git", "add", "."],
        cwd=worktree,
        check=True
    )
    subprocess.run(
        ["git", "commit", "-m", f"{agent_id}: Implemented all assigned methods"],
        cwd=worktree,
        check=True
    )
    
    # Mark complete
    with open(f"{REPO}\\.agent-complete-{agent_id}", "w") as f:
        f.write(f"{agent_id} complete\n")

# Dispatch all Phase 1 agents
async def dispatch_phase_1():
    agents = [
        ("agent-01", ["connect", "disconnect", "publish", "subscribe", "unsubscribe", "request"]),
        ("agent-02", ["route_request", "get_provider_status", "failover", "update_provider_metrics", "get_optimal_provider"]),
        # ... etc
    ]
    
    tasks = [dispatch_agent(aid, methods) for aid, methods in agents]
    await asyncio.gather(*tasks)
```

---

## 💡 IMPLEMENTATION PATTERNS

### Pattern 1: Method Implementation Template

```python
# BEFORE (Stub to implement):
async def method_name(self, param: Type) -> ReturnType:
    """
    Description of what this method does.
    
    Args:
        param: Description
        
    Returns:
        Description
    """
    raise NotImplementedError("TODO: Implement method_name")

# AFTER (Implemented):
async def method_name(self, param: Type) -> ReturnType:
    """
    Description of what this method does.
    
    Args:
        param: Description
        
    Returns:
        Description
    """
    # Step 1: Validate inputs
    if not param:
        raise ValueError("param cannot be empty")
    
    # Step 2: Core logic
    result = await self._internal_operation(param)
    
    # Step 3: Update state
    self._state[param.id] = result
    
    # Step 4: Return
    return ReturnType(data=result)
```

### Pattern 2: Unit Test Template

```python
import pytest
from your_module import YourClass

class TestYourMethod:
    """Tests for YourClass.method_name"""
    
    @pytest.fixture
    def instance(self):
        """Create test instance"""
        return YourClass(config={"test": True})
    
    @pytest.mark.asyncio
    async def test_success_case(self, instance):
        """Test successful execution"""
        result = await instance.method_name("valid_input")
        assert result is not None
        assert result.success is True
    
    @pytest.mark.asyncio
    async def test_error_case(self, instance):
        """Test error handling"""
        with pytest.raises(ValueError):
            await instance.method_name(None)
    
    @pytest.mark.asyncio
    async def test_edge_case(self, instance):
        """Test edge case"""
        result = await instance.method_name("")
        assert result.success is False
```

### Pattern 3: Async Pattern

```python
# Always use async/await for I/O operations
import asyncio

class AsyncComponent:
    async def async_operation(self):
        """Always await async operations"""
        
        # Good: await async function
        result = await self._async_helper()
        
        # Good: use asyncio.gather for parallel
        results = await asyncio.gather(
            self._task1(),
            self._task2(),
            self._task3()
        )
        
        return results
    
    async def _async_helper(self):
        """Helper that does async work"""
        await asyncio.sleep(0.1)  # Simulate I/O
        return {"status": "ok"}
```

---

## 🧪 TESTING STRATEGY

### Test Coverage Targets
- **Minimum:** 80% coverage per agent
- **Target:** 90% coverage
- **Focus on:** Public methods, error paths, edge cases

### Test Organization
```
tests/
├── conftest.py              # Shared fixtures
├── test_runtime.py          # Agent-01..05 tests
├── test_adapters.py         # Agent-06..10 tests
├── test_hermes.py           # Agent-11..15 tests
├── test_webui.py            # Agent-16..20 tests
└── test_integration.py      # Integration tests (Agent-00)
```

### Quick Test Run
```bash
# Run all tests
cd g:\Github\contract-kit-v17
python -m pytest tests/ -v --tb=short

# Run specific agent's tests
python -m pytest tests/test_runtime.py::TestEventBus -v

# Check coverage
python -m pytest tests/ --cov=src --cov-report=term-missing

# Generate coverage report
python -m pytest tests/ --cov=src --cov-report=html
```

---

## 🔍 DEBUGGING TIPS

### When Agent Gets Stuck

1. **Check worktree exists:**
   ```bash
   ls -la g:\Github\agent-worktrees\agent-XX\
   ```

2. **Check git status:**
   ```bash
   cd g:\Github\agent-worktrees\agent-XX
   git status
   ```

3. **Check for errors:**
   ```bash
   cat g:\Github\contract-kit-v17\.agent-failed-agent-XX
   ```

4. **Test imports:**
   ```python
   import sys
   sys.path.insert(0, 'g:\\Github\\agent-worktrees\\agent-XX\\src')
   from runtime import EventBus  # Test import
   ```

### Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `ModuleNotFoundError` | Wrong Python path | Add `sys.path.insert(0, 'g:\\Github\\contract-kit-v17\\src')` |
| `IndentationError` | Mixed tabs/spaces | Use 4 spaces consistently |
| `ImportError` | Circular import | Refactor to avoid cycles |
| `SyntaxError` | Missing colon/paren | Check line mentioned |
| `AttributeError` | Wrong attribute name | Check class definition |

---

## ⚡ SPEED OPTIMIZATION

### Parallelize Everything

**Don't:**
- Implement one method, test it, commit, next method
- Sequential processing

**Do:**
- Implement ALL methods for agent, then test ALL, then commit once
- Batch operations

### Example: Fast Agent Implementation

```python
# FAST: Batch all work, commit once
async def implement_all_methods(agent_id, methods):
    # 1. Implement all methods in memory
    implementations = {}
    for method_name in methods:
        implementations[method_name] = generate_implementation(method_name)
    
    # 2. Write all to file at once
    write_all_methods_to_file(implementations)
    
    # 3. Write all tests at once
    write_all_tests(methods)
    
    # 4. Run tests once
    run_tests()
    
    # 5. Commit once
    git_commit(f"{agent_id}: All {len(methods)} methods implemented")
    
    # Total: 1 file write, 1 test run, 1 commit

# SLOW: Individual operations
async def implement_slowly(agent_id, methods):
    for method_name in methods:
        # 1. Implement one method
        # 2. Write to file
        # 3. Write one test
        # 4. Run tests
        # 5. Commit
        # Total: N file writes, N test runs, N commits
        pass
```

---

## 🎨 CODE QUALITY

### Follow Existing Style

**Before writing code:**
1. Read the existing file you're modifying
2. Match indentation (spaces, not tabs)
3. Match naming conventions
4. Match docstring format

### Example: Match Style

```python
# Read existing file first to understand style
with open('g:\\Github\\contract-kit-v17\\src\\runtime\\core.py') as f:
    existing = f.read()

# Match the existing style:
# - If they use double quotes, use double quotes
# - If they use type hints, use type hints
# - If they use dataclasses, use dataclasses
# - Match their docstring format
```

### Docstring Template

```python
def method_name(self, param: Type) -> ReturnType:
    """
    Brief description of what method does.
    
    Longer description if needed. Explain the purpose,
    any important details, and side effects.
    
    Args:
        param: Description of parameter
        
    Returns:
        Description of return value
        
    Raises:
        ValueError: When input is invalid
        RuntimeError: When operation fails
        
    Example:
        >>> result = await instance.method_name("test")
        >>> result.status
        'success'
    """
    pass
```

---

## 📊 MONITORING PROGRESS

### Use Dashboard

```bash
# Terminal 1: Run live dashboard
python g:\Github\contract-kit-v17\agent_monitor_dashboard.py

# Shows:
# - Real-time agent status
# - Methods completed
# - Test coverage
# - Errors
```

### Quick Status Check

```bash
# Check how many agents complete
cd g:\Github\contract-kit-v17
ls -la .agent-complete-* 2>/dev/null | wc -l

# Check git branches
git branch -a | grep agent

# Check last commits
git log --oneline --all --graph | head -30
```

### Python Status Check

```python
import os
import json

REPO = "g:\\Github\\contract-kit-v17"

def check_agent_status():
    """Check status of all 20 agents"""
    
    agents = [f"agent-{i:02d}" for i in range(1, 21)]
    
    for agent in agents:
        complete_marker = os.path.join(REPO, f".agent-complete-{agent}")
        failed_marker = os.path.join(REPO, f".agent-failed-{agent}")
        stats_file = os.path.join(REPO, f".agent-stats-{agent}.json")
        
        if os.path.exists(complete_marker):
            status = "✓ COMPLETE"
            if os.path.exists(stats_file):
                with open(stats_file) as f:
                    stats = json.load(f)
                status += f" | {stats.get('coverage', 0):.0f}% coverage"
        elif os.path.exists(failed_marker):
            status = "✗ FAILED"
        else:
            status = "⚪ IN_PROGRESS or NOT_STARTED"
        
        print(f"{agent}: {status}")

check_agent_status()
```

---

## 🤝 INTEGRATION BEST PRACTICES

### Merge Conflict Resolution

**Common conflicts in __init__.py:**
```python
# File: src/runtime/__init__.py

# CONFLICT: Two agents added to __all__
# Agent-01 added: "EventBus"
# Agent-02 added: "ProviderRouter"

# RESOLUTION: Include both
__all__ = [
    "RuntimeCoreAPI",
    "EventBus",        # From agent-01
    "ProviderRouter",  # From agent-02
    "CircuitBreaker",  # From agent-03
    # ... etc
]
```

**Common conflicts in core.py:**
```python
# File: src/runtime/core.py

# CONFLICT: Two methods in same class
# RESOLUTION: Keep both methods, organize by dependency order

class RuntimeCoreAPI:
    # EventBus methods (Agent-01)
    async def connect(self): ...
    async def publish(self): ...
    
    # ProviderRouter methods (Agent-02)
    async def route_request(self): ...
    
    # CircuitBreaker methods (Agent-03)
    def check_state(self): ...
```

### Integration Testing

```python
# tests/test_integration.py

import pytest
from integration import ContractKitIntegration

@pytest.mark.asyncio
async def test_full_pipeline():
    """Test entire pipeline works after integration"""
    
    integration = ContractKitIntegration(config={
        "nats_url": "nats://localhost:4222",
        "runtime_port": 8080
    })
    
    await integration.initialize()
    
    # Test: Create and process task
    task = {
        "description": "Integration test task",
        "acceptance_criteria": ["Complete successfully"]
    }
    
    result = await integration.process_task(task)
    
    assert result["status"] == "success"
    assert "contract_id" in result
    assert "intake" in result
    assert "contract" in result
    assert "fanout" in result
```

---

## 📝 HANDOFF DOCUMENTATION

### What Goes in Handoff

**KiloCode generates:** `KILOCODE_HANDOFF_FOR_WINDSURF.md`

**Must include:**
1. Package locations (4 tar.gz files)
2. VPS deployment commands
3. E2E test commands
4. Expected outputs
5. Troubleshooting guide

### Handoff Template Sections

```markdown
# WINDSURF HANDOFF DOCUMENT

## 1. EXECUTIVE SUMMARY
- What's been completed (90-95%)
- What's remaining (5-10%)
- Success criteria

## 2. DELIVERABLES
- List of 4 packages with locations
- Test results summary
- Integration status

## 3. DEPLOYMENT INSTRUCTIONS
- Step-by-step VPS commands
- Service startup commands
- Configuration details

## 4. E2E TEST PROCEDURES
- All 10 test commands
- Expected outputs
- Pass/fail criteria

## 5. TROUBLESHOOTING
- Common issues
- Debug commands
- Escalation process
```

---

## 🎯 SUCCESS CHECKLIST

### Per Agent Completion
- [ ] All assigned methods implemented
- [ ] Unit tests passing
- [ ] Coverage > 80%
- [ ] No TODO markers
- [ ] Code committed to branch
- [ ] `.agent-complete-{id}` marker created

### Phase 1 Completion (Agents 1-10)
- [ ] All 10 agents report COMPLETE
- [ ] All worktrees have commits
- [ ] No blocking failures

### Phase 2 Completion (Agents 11-20)
- [ ] All 10 agents report COMPLETE
- [ ] All worktrees have commits
- [ ] Integration smoke tests pass

### Integration Completion
- [ ] Agent-00 script runs successfully
- [ ] All 20 branches merged
- [ ] No unresolved conflicts
- [ ] All integration tests pass
- [ ] 4 packages built
- [ ] Handoff document generated

### 95% Milestone
- [ ] All code implemented
- [ ] All tests passing
- [ ] Packages ready
- [ ] Handoff ready
- [ ] Only VPS deployment remaining

---

## 🚀 FINAL TIPS

1. **Read first, code second** - Always read documentation before implementing

2. **Batch operations** - Don't do one method at a time, do all at once

3. **Test early** - Write tests alongside implementation, not after

4. **Commit often** - But batch commits, don't commit per method

5. **Use absolute paths** - Never relative paths

6. **Check existence** - Verify files exist before reading/writing

7. **Monitor progress** - Use dashboard to track all 20 agents

8. **Handoff cleanly** - Generate complete handoff document

9. **Don't touch VPS** - Leave SSH/docker to Windsurf

10. **Stay focused** - Complete 95%, don't try to do 100%

---

## 📞 EMERGENCY CONTACTS

**If stuck:**
1. Re-read `KILOCODE_CORRECTIONS.md`
2. Check `START_HERE.md` for sequence
3. Verify paths with provided scripts
4. Don't guess - verify everything

---

**Version:** 1.0  
**Use:** Reference while implementing  
**Update:** Add new tips as discovered
