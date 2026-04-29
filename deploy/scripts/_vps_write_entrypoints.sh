#!/bin/bash
# Write ASGI entry point files for all three kilocode services
set -euo pipefail

# ── Runtime entry point ──────────────────────────────────────────────────────
cat > /opt/kilocode/src/runtime/__main__.py <<'EOF'
"""ASGI entry point for kilocode-runtime (uvicorn src.runtime.__main__:app)"""
from src.runtime.core import RuntimeCoreAPI

_api = RuntimeCoreAPI(title="Contract Kit Runtime", version="1.0.0")
app = _api.app
EOF

# ── Hermes entry point ───────────────────────────────────────────────────────
cat > /opt/kilocode/src/hermes/__main__.py <<'EOF'
"""ASGI entry point for kilocode-hermes (uvicorn src.hermes.__main__:app)"""
import asyncio
from fastapi import FastAPI, HTTPException
from typing import Dict, Any
from src.hermes.orchestrator import HermesOrchestrator

_orchestrator = HermesOrchestrator()
app = FastAPI(title="Hermes Orchestrator", version="1.0.0")

@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"status": "healthy", "service": "kilocode-hermes"}

@app.post("/intake")
async def intake(payload: Dict[str, Any]) -> Dict[str, Any]:
    try:
        result = await _orchestrator.intake(payload)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/contract/{contract_id}")
async def contract_status(contract_id: str) -> Dict[str, Any]:
    try:
        return await _orchestrator.get_contract_status(contract_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
EOF

# ── WebUI entry point ────────────────────────────────────────────────────────
cat > /opt/kilocode/src/webui/__main__.py <<'EOF'
"""ASGI entry point for kilocode-webui (uvicorn src.webui.__main__:app)"""
from fastapi import FastAPI
from typing import Dict, Any
from src.webui.control_center import ControlCenterApp

_cc = ControlCenterApp()
app = FastAPI(title="KiloCode WebUI", version="1.0.0")

@app.get("/health")
async def health() -> Dict[str, Any]:
    return {"status": "healthy", "service": "kilocode-webui"}

@app.get("/")
async def root() -> Dict[str, Any]:
    return {"service": "kilocode-webui", "status": "running"}
EOF

# ── Verify files written ─────────────────────────────────────────────────────
echo "Entry points written:"
ls -la /opt/kilocode/src/runtime/__main__.py
ls -la /opt/kilocode/src/hermes/__main__.py
ls -la /opt/kilocode/src/webui/__main__.py

# ── Quick import test ────────────────────────────────────────────────────────
echo ""
echo "Testing imports..."
cd /opt/kilocode
source venv/bin/activate
python -c "
import sys
sys.path.insert(0, '/opt/kilocode')
from src.runtime.core import RuntimeCoreAPI
print('  runtime.core: OK')
from src.hermes.orchestrator import HermesOrchestrator
print('  hermes.orchestrator: OK')
from src.webui.control_center import ControlCenterApp
print('  webui.control_center: OK')
print('All imports: PASS')
"
