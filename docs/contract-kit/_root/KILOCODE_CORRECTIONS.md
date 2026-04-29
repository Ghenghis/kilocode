# KILOCODE CORRECTIONS & EXACT PATHS
# CRITICAL: Prevent Path and Location Mistakes

## ⚠️ COMMON MISTAKES TO AVOID

### Mistake #1: Wrong Repository Location
**WRONG:** Creating files in `g:\Github\kilocode-Azure2\`  
**CORRECT:** All work happens in `g:\Github\contract-kit-v17\`

```
❌ INCORRECT: g:\Github\kilocode-Azure2\any-file.md
❌ INCORRECT: g:\Github\hermes-agent-2026.4.13\any-file.md
❌ INCORRECT: C:\Users\Admin\any-file.md

✅ CORRECT: g:\Github\contract-kit-v17\any-file.md
```

### Mistake #2: Creating Files That Already Exist
**FILES ALREADY CREATED - DO NOT RECREATE:**
- `g:\Github\contract-kit-v17\START_HERE.md` ← EXISTS
- `g:\Github\contract-kit-v17\KILOCODE_KICKOFF.md` ← EXISTS
- `g:\Github\contract-kit-v17\kilocode-agents.yaml` ← EXISTS
- `g:\Github\contract-kit-v17\KILOCODE_HANDOFF_FOR_WINDSURF.md` ← EXISTS (template)
- `g:\Github\contract-kit-v17\agent_monitor_dashboard.py` ← EXISTS
- `g:\Github\contract-kit-v17\agent_00_integration_lead.py` ← EXISTS

**CHECK BEFORE CREATING:**
```python
import os
repo = "g:\\Github\\contract-kit-v17"
filepath = os.path.join(repo, "FILENAME.md")

if os.path.exists(filepath):
    print(f"EXISTS: {filepath} - DO NOT RECREATE")
else:
    print(f"MISSING: {filepath} - Can create")
```

### Mistake #3: Creating New Directories
**DO NOT CREATE:**
- ❌ `g:\Github\contract-kit-v17\kilocode-azure2\`
- ❌ `g:\Github\contract-kit-v17\agents\`
- ❌ `g:\Github\contract-kit-v17\worktrees\`
- ❌ Any new directories inside contract-kit-v17

**USE EXISTING STRUCTURE:**
- ✅ `g:\Github\contract-kit-v17\src\` (already exists)
- ✅ `g:\Github\contract-kit-v17\tests\` (already exists)
- ✅ `g:\Github\contract-kit-v17\configs\` (already exists)
- ✅ `g:\Github\contract-kit-v17\diagrams\` (already exists)

### Mistake #4: Wrong Worktree Location
**WRONG:** Creating worktrees inside contract-kit-v17  
**CORRECT:** Worktrees are SIBLING directories

```
DIRECTORY STRUCTURE:

❌ WRONG:
g:\Github\contract-kit-v17\
  ├── agent-worktrees\        ← DON'T CREATE THIS INSIDE
  │   ├── agent-01\
  │   └── agent-02\

✅ CORRECT:
g:\Github\                         ← GitHub folder
  ├── contract-kit-v17\          ← Main repo
  │   ├── src\
  │   └── ...
  ├── agent-worktrees\           ← Sibling directory
  │   ├── agent-01\              ← Each agent worktree
  │   ├── agent-02\
  │   └── ...
```

---

## 📍 EXACT PATH REFERENCE

### Main Repository (Read/Write Here)
```
g:\Github\contract-kit-v17\
```

### Source Files (Implement Here)
```
g:\Github\contract-kit-v17\src\runtime\core.py
g:\Github\contract-kit-v17\src\runtime\__init__.py
g:\Github\contract-kit-v17\src\zeroclaw\adapters.py
g:\Github\contract-kit-v17\src\zeroclaw\__init__.py
g:\Github\contract-kit-v17\src\hermes\orchestrator.py
g:\Github\contract-kit-v17\src\hermes\__init__.py
g:\Github\contract-kit-v17\src\webui\control_center.py
g:\Github\contract-kit-v17\src\webui\__init__.py
g:\Github\contract-kit-v17\src\kilocode\runtime_sync.py
g:\Github\contract-kit-v17\src\kilocode\__init__.py
g:\Github\contract-kit-v17\src\integration.py
g:\Github\contract-kit-v17\src\proof\
```

### Test Files (Write Tests Here)
```
g:\Github\contract-kit-v17\tests\test_runtime.py
g:\Github\contract-kit-v17\tests\test_adapters.py
g:\Github\contract-kit-v17\tests\test_hermes.py
g:\Github\contract-kit-v17\tests\test_webui.py
g:\Github\contract-kit-v17\tests\test_kilocode.py
g:\Github\contract-kit-v17\tests\test_integration.py
```

### Documentation (Read Only - Already Created)
```
g:\Github\contract-kit-v17\START_HERE.md                         ← READ THIS FIRST
g:\Github\contract-kit-v17\KILOCODE_KICKOFF.md                    ← Agent task specs
g:\Github\contract-kit-v17\kilocode-agents.yaml                  ← Dispatch config
g:\Github\contract-kit-v17\KILOCODE_CORRECTIONS.md               ← This file
g:\Github\contract-kit-v17\KILOCODE_TIPS.md                       ← Tips & tricks
g:\Github\contract-kit-v17\KILOCODE_CONTRACT.md                  ← Completion contract
g:\Github\contract-kit-v17\COMPLETION_ROADMAP.md                  ← SVG visual roadmap
g:\Github\contract-kit-v17\GAP_ANALYSIS.md                       ← Gap analysis
```

### Python Scripts (Run These)
```
g:\Github\contract-kit-v17\agent_monitor_dashboard.py           ← Run for monitoring
g:\Github\contract-kit-v17\agent_00_integration_lead.py          ← Run after Phase 2
g:\Github\contract-kit-v17\run_contract_kit.py                  ← Main entry point
```

### Worktrees (Create Sibling, Not Child)
```
g:\Github\agent-worktrees\agent-01\
g:\Github\agent-worktrees\agent-02\
g:\Github\agent-worktrees\agent-03\
...
g:\Github\agent-worktrees\agent-20\
```

---

## 🔧 CORRECT GIT WORKTREE COMMANDS

### Create Worktrees (Run from contract-kit-v17)
```bash
cd g:\Github\contract-kit-v17

# Create sibling directory for worktrees first
mkdir g:\Github\agent-worktrees

# Create agent worktrees (sibling directories, NOT inside repo)
git worktree add g:\Github\agent-worktrees\agent-01 agent-01-branch
git worktree add g:\Github\agent-worktrees\agent-02 agent-02-branch
git worktree add g:\Github\agent-worktrees\agent-03 agent-03-branch
# ... continue for all 20 agents
```

### Python Way (Recommended)
```python
import subprocess
import os

REPO_ROOT = "g:\\Github\\contract-kit-v17"
WORKTREE_ROOT = "g:\\Github\\agent-worktrees"

def create_agent_worktree(agent_num: int):
    agent_id = f"agent-{agent_num:02d}"
    branch = f"{agent_id}-branch"
    worktree_path = os.path.join(WORKTREE_ROOT, agent_id)
    
    # Ensure worktree root exists
    os.makedirs(WORKTREE_ROOT, exist_ok=True)
    
    # Create worktree
    subprocess.run(
        ["git", "worktree", "add", worktree_path, branch],
        cwd=REPO_ROOT,
        check=True
    )
    print(f"✓ Created {agent_id} at {worktree_path}")

# Create all 20 worktrees
for i in range(1, 21):
    create_agent_worktree(i)
```

---

## ❌ THINGS KILOCODE SHOULD NEVER DO

1. **NEVER create directories inside contract-kit-v17**  
   Wrong: `g:\Github\contract-kit-v17\new-folder\`  
   All work happens in existing structure

2. **NEVER clone other repos**  
   Wrong: `git clone kilocode-Azure2`  
   Work only in contract-kit-v17

3. **NEVER create files that already exist**  
   Check existence first with `os.path.exists()`

4. **NEVER modify VPS directly**  
   No SSH commands
   No docker commands on VPS
   No HTTP requests to 187.77.30.206
   Handoff to Windsurf for VPS operations

5. **NEVER use relative paths**  
   Wrong: `src/runtime/core.py`  
   Right: `g:\Github\contract-kit-v17\src\runtime\core.py`

6. **NEVER create files outside contract-kit-v17**  
   Wrong: `C:\Users\Admin\file.md`  
   Right: `g:\Github\contract-kit-v17\file.md`

7. **NEVER delete existing files**  
   Unless explicitly told to fix a specific bug

8. **NEVER overwrite without checking**  
   If file exists, read it first before modifying

---

## ✅ THINGS KILOCODE SHOULD ALWAYS DO

1. **ALWAYS use absolute paths**  
   `g:\Github\contract-kit-v17\src\runtime\core.py`

2. **ALWAYS check file existence first**  
   ```python
   if os.path.exists(filepath):
       # Read existing, don't recreate
   ```

3. **ALWAYS read documentation first**  
   Read `START_HERE.md` before any action

4. **ALWAYS work in worktrees for agents**  
   `g:\Github\agent-worktrees\agent-01\`

5. **ALWAYS commit work to git**  
   ```bash
   git add .
   git commit -m "Agent-XX: Implemented Y"
   ```

6. **ALWAYS create completion markers**  
   ```python
   # When agent finishes
   Path("g:\\Github\\contract-kit-v17\\.agent-complete-agent-01").touch()
   ```

7. **ALWAYS handoff VPS work to Windsurf**  
   Generate `KILOCODE_HANDOFF_FOR_WINDSURF.md` for VPS operations

---

## 🔍 VERIFICATION CHECKLIST

Before any action, verify:
- [ ] I'm in `g:\Github\contract-kit-v17\` or sibling worktree
- [ ] I'm not creating duplicate files
- [ ] I'm using absolute paths
- [ ] I'm not touching VPS/SSH/Docker directly
- [ ] I'm reading documentation first
- [ ] I'm working in correct directory structure

---

## 📝 PATH VERIFICATION CODE

```python
import os

def verify_location():
    """Verify KiloCode is working in correct location"""
    
    # Required paths
    REQUIRED = {
        "repo": "g:\\Github\\contract-kit-v17",
        "src": "g:\\Github\\contract-kit-v17\\src",
        "runtime": "g:\\Github\\contract-kit-v17\\src\\runtime",
        "zeroclaw": "g:\\Github\\contract-kit-v17\\src\\zeroclaw",
        "hermes": "g:\\Github\\contract-kit-v17\\src\\hermes",
        "webui": "g:\\Github\\contract-kit-v17\\src\\webui",
        "kilocode": "g:\\Github\\contract-kit-v17\\src\\kilocode",
    }
    
    all_ok = True
    for name, path in REQUIRED.items():
        exists = os.path.exists(path)
        symbol = "✓" if exists else "✗"
        print(f"{symbol} {name}: {path}")
        if not exists:
            all_ok = False
    
    if not all_ok:
        print("\n✗ ERROR: Some required paths missing!")
        print("Working in wrong directory?")
        return False
    
    print("\n✓ All paths verified!")
    return True

# Run verification
if __name__ == "__main__":
    verify_location()
```

---

## 🎯 QUICK REFERENCE CARD

| Task | Correct Path | Wrong Path |
|------|--------------|------------|
| Main repo | `g:\Github\contract-kit-v17\` | Any other location |
| Source code | `g:\Github\contract-kit-v17\src\...` | Outside repo |
| Agent work | `g:\Github\agent-worktrees\agent-XX\` | Inside repo |
| Tests | `g:\Github\contract-kit-v17\tests\...` | Outside repo |
| Documentation | `g:\Github\contract-kit-v17\*.md` | kilocode-Azure2 |
| VPS scripts | `KILOCODE_HANDOFF_FOR_WINDSURF.md` | Direct SSH commands |

---

**Version:** 1.0  
**Purpose:** Prevent path/location mistakes  
**Reference:** Keep open while working
