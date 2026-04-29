# POST-COMPLETION: ECOSYSTEM CONSOLIDATION PLAN
# Consolidate KiloCode + Hermes + WebUI into Single Repository

**Target Repo:** https://github.com/Ghenghis/hermes.daveai.tech  
**Source:** g:\Github\contract-kit-v17 (after KiloCode 95% completion)  
**Goal:** Single unified repository containing entire ecosystem  
**Timing:** After KiloCode achieves 95%, before Windsurf VPS deployment  

---

## 🎯 CONSOLIDATION OVERVIEW

### Current State (Multiple Repos)
```
Repositories:
├── g:\Github\contract-kit-v17\        (KiloCode work in progress)
├── g:\Github\kilocode-Azure2\        (KiloCode VSIX - external)
├── g:\Github\hermes-agent-2026.4.13\ (Hermes agent - external)
└── https://github.com/Ghenghis/hermes.daveai.tech (Empty - target)
```

### Desired State (Single Repo)
```
https://github.com/Ghenghis/hermes.daveai.tech
├── src/
│   ├── kilocode/          (From contract-kit-v17)
│   ├── hermes/            (From contract-kit-v17)
│   ├── webui/             (From contract-kit-v17)
│   ├── runtime/           (From contract-kit-v17)
│   ├── zeroclaw/          (From contract-kit-v17)
│   └── integration.py     (Wiring layer)
├── tests/
├── deploy/
├── docs/
└── .github/workflows/     (CI/CD)
```

---

## 📋 CONSOLIDATION PHASES

### Phase 1: KiloCode Completion (16 hours)
**Status:** In Progress  
**Location:** `g:\Github\contract-kit-v17\`  
**Output:** 95% complete contract kit

**Deliverables:**
- ✅ 170 methods implemented
- ✅ All unit tests passing
- ✅ 4 deployment packages
- ✅ `KILOCODE_HANDOFF_FOR_WINDSURF.md` generated

**Trigger for Phase 2:** `python verify_contract.py` reports all checks pass

---

### Phase 2: Repository Consolidation (2 hours)
**Trigger:** KiloCode achieves 95%  
**Action:** Consolidate into `hermes.daveai.tech`  
**Performed by:** Windsurf (or automated script)

#### Step 2.1: Prepare Target Repository
```bash
# Clone target repository
git clone https://github.com/Ghenghis/hermes.daveai.tech.git
cd hermes.daveai.tech

# Create directory structure
mkdir -p src/{kilocode,hermes,webui,runtime,zeroclaw,proof}
mkdir -p tests
mkdir -p deploy
mkdir -p docs
mkdir -p .github/workflows
```

#### Step 2.2: Copy Source Code from contract-kit-v17
```bash
# Source repository
SOURCE="g:\\Github\\contract-kit-v17"
TARGET="hermes.daveai.tech"

# Copy core implementation
cp -r $SOURCE\src\kilocode\* $TARGET\src\kilocode\
cp -r $SOURCE\src\hermes\* $TARGET\src\hermes\
cp -r $SOURCE\src\webui\* $TARGET\src\webui\
cp -r $SOURCE\src\runtime\* $TARGET\src\runtime\
cp -r $SOURCE\src\zeroclaw\* $TARGET\src\zeroclaw\
cp -r $SOURCE\src\proof\* $TARGET\src\proof\
cp $SOURCE\src\integration.py $TARGET\src\

# Copy tests
cp -r $SOURCE\tests\* $TARGET\tests\

# Copy deployment packages
cp -r $SOURCE\deploy\* $TARGET\deploy\

# Copy documentation
cp $SOURCE\README.md $TARGET\
cp $SOURCE\KILOCODE_HANDOFF_FOR_WINDSURF.md $TARGET\
cp $SOURCE\COMPLETION_ROADMAP.md $TARGET\docs\
cp $SOURCE\ARCHITECTURE.md $TARGET\docs\
```

#### Step 2.3: Consolidate Configuration Files
```bash
# Create unified requirements.txt
cat > $TARGET\requirements.txt << 'EOF'
# Core dependencies
fastapi>=0.104.0
uvicorn>=0.24.0
pydantic>=2.5.0

# Async/NATS
nats-py>=2.6.0
asyncio-mqtt>=0.16.0
aiohttp>=3.9.0

# Database
sqlalchemy>=2.0.0
psycopg2-binary>=2.9.0

# Web scraping
beautifulsoup4>=4.12.0
lxml>=4.9.0

# Testing
pytest>=7.4.0
pytest-asyncio>=0.21.0
pytest-cov>=4.1.0

# Utilities
python-dotenv>=1.0.0
pyyaml>=6.0.1
structlog>=23.2.0
EOF

# Create unified package.json (if needed for WebUI)
# Create docker-compose.yml for local development
# Create Dockerfile for containerization
```

#### Step 2.4: Update Imports for Consolidated Structure
```python
# File: $TARGET\src\__init__.py
"""
Hermes DaveAI Tech - Unified Ecosystem
Contains: KiloCode, Hermes, WebUI, Runtime, ZeroClaw
"""

from .kilocode import RuntimeSync, ActiveTaskPanel
from .hermes import HermesOrchestrator, TaskPacket
from .webui import ControlCenterApp
from .runtime import RuntimeCoreAPI, EventBus, ProviderRouter
from .zeroclaw import GitAdapter, ShellAdapter, FilesystemAdapter, ResearchAdapter
from .integration import ContractKitIntegration

__version__ = "17.0.0"
__all__ = [
    # KiloCode
    "RuntimeSync",
    "ActiveTaskPanel",
    # Hermes
    "HermesOrchestrator",
    "TaskPacket",
    # WebUI
    "ControlCenterApp",
    # Runtime
    "RuntimeCoreAPI",
    "EventBus",
    "ProviderRouter",
    # ZeroClaw
    "GitAdapter",
    "ShellAdapter",
    "FilesystemAdapter",
    "ResearchAdapter",
    # Integration
    "ContractKitIntegration",
]
```

#### Step 2.5: Commit to Consolidated Repo
```bash
cd hermes.daveai.tech

git add .
git commit -m "Consolidate KiloCode + Hermes + WebUI ecosystem v17.0.0

- Import contract-kit-v17 at 95% completion
- All 170 methods implemented
- All tests passing (>80% coverage)
- 4 deployment packages included
- Ready for VPS deployment

git push origin main
```

---

### Phase 3: VPS Deployment (Windsurf - 2 hours)
**Trigger:** Consolidation complete  
**Location:** VPS 187.77.30.206  
**Performed by:** Windsurf

#### From Consolidated Repo
```bash
# Windsurf clones consolidated repo
git clone https://github.com/Ghenghis/hermes.daveai.tech.git

# Deploy from single unified source
```

**Benefits of Consolidated Deployment:**
- Single source of truth
- Easier version control
- Simplified CI/CD
- Unified documentation
- One deployment command

---

## 🗂️ CONSOLIDATED REPOSITORY STRUCTURE

```
hermes.daveai.tech/
│
├── .github/
│   └── workflows/
│       ├── ci.yml              # Run tests on PR
│       ├── deploy-vps.yml      # Deploy to VPS
│       └── release.yml         # Create releases
│
├── src/                        # Unified source code
│   ├── __init__.py            # Package exports
│   ├── integration.py         # System wiring
│   │
│   ├── kilocode/              # KiloCode VSIX integration
│   │   ├── __init__.py
│   │   ├── runtime_sync.py    # (22 methods)
│   │   └── extensions/        # VSIX extensions
│   │
│   ├── hermes/                # Hermes orchestration
│   │   ├── __init__.py
│   │   ├── orchestrator.py  # (27 methods)
│   │   └── contracts/         # Contract definitions
│   │
│   ├── webui/                 # Web control center
│   │   ├── __init__.py
│   │   ├── control_center.py # (25 methods)
│   │   └── static/            # UI assets
│   │
│   ├── runtime/               # Core runtime
│   │   ├── __init__.py
│   │   ├── core.py            # (30 methods)
│   │   └── config/            # Settings schemas
│   │
│   ├── zeroclaw/              # Adapter layer
│   │   ├── __init__.py
│   │   ├── adapters.py        # (31 methods)
│   │   └── security/          # Security policies
│   │
│   └── proof/                 # E2E testing & evidence
│       ├── __init__.py
│       └── validators/
│
├── tests/                     # Unified test suite
│   ├── __init__.py
│   ├── conftest.py           # Shared fixtures
│   ├── test_kilocode.py      # KiloCode tests
│   ├── test_hermes.py        # Hermes tests
│   ├── test_webui.py         # WebUI tests
│   ├── test_runtime.py       # Runtime tests
│   ├── test_adapters.py      # Adapter tests
│   └── test_integration.py   # E2E tests
│
├── deploy/                    # Deployment artifacts
│   ├── docker/
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   └── entrypoint.sh
│   ├── systemd/
│   │   ├── hermes.service
│   │   └── runtime-api.service
│   ├── scripts/
│   │   ├── deploy-vps.sh
│   │   └── setup-nginx.sh
│   └── packages/              # Built packages (Phase 2 output)
│       ├── core-runtime-package.tar.gz
│       ├── zeroclaw-adapters-package.tar.gz
│       ├── hermes-orchestrator-package.tar.gz
│       └── webui-kilocode-package.tar.gz
│
├── docs/                      # Documentation
│   ├── README.md              # Main documentation
│   ├── API.md                 # API reference
│   ├── DEPLOYMENT.md          # Deployment guide
│   ├── ARCHITECTURE.md        # System architecture
│   └── DEVELOPMENT.md         # Developer guide
│
├── configs/                   # Configuration schemas
│   ├── settings_schema.json
│   ├── nats_subjects.yaml
│   └── packet_schema.yaml
│
├── scripts/                   # Utility scripts
│   ├── setup.py
│   ├── run-tests.sh
│   └── monitor-agents.py
│
├── requirements.txt           # Python dependencies
├── package.json               # Node dependencies (WebUI)
├── .env.example               # Environment template
├── .gitignore
└── LICENSE
```

---

## 🔄 WORKFLOW SEQUENCE

### Complete Timeline

```
Hour 0:   KiloCode dispatches Agents 1-10 (Phase 1)
Hour 6:   KiloCode dispatches Agents 11-20 (Phase 2)
Hour 12:  Agent-00 runs integration (Phase 3)
Hour 16:  KiloCode achieves 95% ✓
          │
          ├── verify_contract.py passes
          ├── KILOCODE_HANDOFF_FOR_WINDSURF.md generated
          └── All packages built
          │
Hour 16:  ⬇️ CONSOLIDATION BEGINS (Phase 4)
          │
Hour 17:  Copy contract-kit-v17 → hermes.daveai.tech
          Update imports, configs
          Commit to GitHub
          │
Hour 18:  ⬇️ WINDSURF VPS DEPLOYMENT (Phase 5)
          │
Hour 19:  Clone hermes.daveai.tech
          Deploy to VPS 187.77.30.206
          Run E2E tests
          Verify restart-safe
          │
Hour 20:  🎉 100% COMPLETE - ECOSYSTEM LIVE
```

---

## 🎯 BENEFITS OF CONSOLIDATION

### For Development
- ✅ Single repository to clone
- ✅ Unified version control
- ✅ Easier cross-component changes
- ✅ Single CI/CD pipeline
- ✅ One issue tracker
- ✅ Unified documentation

### For Deployment
- ✅ Single source to deploy
- ✅ Consistent versions across components
- ✅ Easier rollback
- ✅ One deployment script
- ✅ Clear dependency tree

### For Maintenance
- ✅ Single place for bug reports
- ✅ Unified changelog
- ✅ Coordinated releases
- ✅ Easier testing
- ✅ Better visibility

---

## 📝 CONSOLIDATION CHECKLIST

### Pre-Consolidation (Before Phase 2)
- [ ] KiloCode achieves 95% completion
- [ ] `verify_contract.py` passes all checks
- [ ] `KILOCODE_HANDOFF_FOR_WINDSURF.md` generated
- [ ] All 4 packages built in `deploy/`
- [ ] All tests passing
- [ ] No TODO markers remaining

### Consolidation (Phase 2)
- [ ] Clone `hermes.daveai.tech` repository
- [ ] Create directory structure
- [ ] Copy all source from contract-kit-v17
- [ ] Update imports for consolidated structure
- [ ] Merge configuration files
- [ ] Create unified requirements.txt
- [ ] Add GitHub Actions workflows
- [ ] Commit with descriptive message
- [ ] Push to GitHub

### Post-Consolidation Verification
- [ ] Repository is public/accessible
- [ ] All files present
- [ ] README.md explains structure
- [ ] Tests run in CI
- [ ] Deployment scripts work

### Windsurf Deployment (Phase 3)
- [ ] Clone consolidated repo
- [ ] Deploy to VPS 187.77.30.206
- [ ] Run E2E tests
- [ ] Verify restart-safe
- [ ] 100% completion achieved

---

## 🚀 EXECUTION COMMANDS

### Phase 1-3: KiloCode (Already documented in START_HERE.md)
```bash
cd g:\Github\contract-kit-v17
# Follow START_HERE.md instructions
```

### Phase 4: Consolidation (New - Run after 95%)
```bash
# Automated consolidation script
python consolidate_to_hermes_repo.py \
  --source g:\Github\contract-kit-v17 \
  --target hermes.daveai.tech \
  --push
```

### Phase 5: Windsurf Deployment (From consolidated repo)
```bash
# Windsurf executes from hermes.daveai.tech
git clone https://github.com/Ghenghis/hermes.daveai.tech.git
cd hermes.daveai.tech
./deploy/scripts/deploy-vps.sh 187.77.30.206
```

---

## 🎉 SUCCESS DEFINITION

**Phase 1-3 Success (KiloCode):**
- 95% complete in contract-kit-v17
- All deliverables per KILOCODE_CONTRACT.md

**Phase 4 Success (Consolidation):**
- All code in hermes.daveai.tech
- Clean, organized structure
- Ready for deployment

**Phase 5 Success (Windsurf):**
- Deployed from hermes.daveai.tech
- All services running on VPS
- E2E tests passing
- Restart-safe verified
- **100% ECOSYSTEM COMPLETE**

---

**Consolidation Plan Version:** 1.0  
**Trigger:** KiloCode 95% completion  
**Target Repository:** https://github.com/Ghenghis/hermes.daveai.tech  
**Final Goal:** Single unified ecosystem repository
