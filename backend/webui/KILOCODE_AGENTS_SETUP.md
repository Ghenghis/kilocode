# KiloCode 20 Agents Setup Instructions

## Problem
User reinstalled VS Code and only sees Hermes, not the 20 KiloCode agents.

## Root Cause
The 20 KiloCode agents need to be configured in the KiloCode CLI runtime, not just in Hub v2. The agents are loaded from markdown configuration files in the `.kilo/agents/` directory.

## Solution Implemented

### 1. Created 20 KiloCode Agent Configuration Files
Location: `G:\Github\kilocode-Azure2\.kilo\agents\`

Created files:
- kc-01.md (Integration Lead)
- kc-02.md (Creative Brainstormer)
- kc-03.md (System Architect)
- kc-04.md (Bug Triage Specialist)
- kc-05.md (Root Cause Analyst)
- kc-06.md (Code Generator)
- kc-07.md (Code Reviewer)
- kc-08.md (Test Writer)
- kc-09.md (Debugger)
- kc-10.md (Refactorer)
- kc-11.md (Documenter)
- kc-12.md (Security Auditor)
- kc-13.md (Performance Analyst)
- kc-14.md (API Integrator)
- kc-15.md (Database Specialist)
- kc-16.md (DevOps Engineer)
- kc-17.md (Frontend Specialist)
- kc-18.md (Backend Specialist)
- kc-19.md (Research Analyst)
- kc-20.md (Prompt Engineer)

Each agent has:
- Unique name and description
- Specialized role and capabilities
- Color coding for UI
- 5-step iteration limit
- Subagent mode

### 2. Hub v2 Integration
Added agents bridge router to connect Hub v2 to actual KiloCode CLI:
- `G:\Github\contract-kit-v17\src\webui\hub\routers\agents_bridge.py`
- Updated agents panel to use real KiloCode agents with fallback to mock data

## Manual Build Instructions

### Step 1: Build KiloCode CLI
```bash
cd G:\Github\kilocode-Azure2
bun run build
```

This will:
- Build the KiloCode CLI with the new agent configurations
- Create the CLI binary at `packages/opencode/dist/cli.exe`

### Step 2: Build VS Code Extension
```bash
cd G:\Github\kilocode-Azure2\packages\kilo-vscode
bun run compile
```

This will:
- Build the VS Code extension
- Bundle the CLI binary into the extension
- Create the extension package

### Step 3: Install Extension in VS Code
Option A - Development Mode:
```bash
cd G:\Github\kilocode-Azure2
bun run extension
```

Option B - Install VSIX:
```bash
cd G:\Github\kilocode-Azure2\packages\kilo-vscode
bun run package
# Then install the generated .vsix file in VS Code
```

### Step 4: Verify Agents in VS Code
1. Open VS Code
2. Open KiloCode extension sidebar
3. Check the agent selector (@ autocomplete)
4. You should see 20 agents: kc-01 through kc-20

## Verification Commands

### Check Agent Files Exist
```bash
ls G:\Github\kilocode-Azure2\.kilo\agents\
```

### Test Hub v2 Agents Bridge
```bash
cd G:\Github\contract-kit-v17\src\webui
python test_kilocode_agents.py
```

### Check Hub v2 Mock Agents (Fallback)
```bash
curl http://localhost:8095/api/agents
```

## Troubleshooting

### If agents don't appear in VS Code:
1. Verify agent files exist in `.kilo/agents/`
2. Rebuild the CLI: `bun run build`
3. Rebuild the extension: `bun run compile`
4. Restart VS Code
5. Check VS Code Extension Host logs for errors

### If Hub v2 shows mock agents instead of real ones:
1. Check if CLI binary exists at `packages/opencode/dist/cli.exe`
2. Verify the CLI path in `agents_bridge.py` is correct
3. Restart Hub v2 after building CLI

## Summary
- ✅ Created 20 KiloCode agent configuration files
- ✅ Added Hub v2 agents bridge for integration
- ⏳ Need to build KiloCode CLI (manual step)
- ⏳ Need to build VS Code extension (manual step)
- ⏳ Need to install extension in VS Code (manual step)

The agents are now properly configured. The build process needs to be completed manually to package them into the extension.
