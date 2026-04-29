"""
Hermes Gateway Server — FastAPI entrypoint for the Hermes orchestration layer.

Provides:
  GET  /health                    — liveness status
  POST /intake                    — submit a new task contract
  GET  /tasks/{contract_id}       — get contract status
  POST /tasks/{contract_id}/fanout — fan out subtasks
  GET  /jobs                      — list all active contracts (Bridge B)
"""

import logging
import os
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from src.hermes.orchestrator import HermesOrchestrator

logger = logging.getLogger(__name__)

app = FastAPI(title="Hermes Gateway", version="1.0.0")
_orchestrator: Optional[HermesOrchestrator] = None
_start_time = time.time()


# ── Pydantic models ──────────────────────────────────────────────────────────

class IntakeRequest(BaseModel):
    task_type: str = "shell"
    description: str
    evidence: List[Any] = []
    context: Dict[str, Any] = {}
    auto_approve: bool = False


# ── Lifecycle ────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup() -> None:
    global _orchestrator
    _orchestrator = HermesOrchestrator()
    logger.info(
        "Hermes Gateway started. runtime=%s shiba=%s nats=%s",
        os.getenv("RUNTIME_URL", "http://runtime-core:8000"),
        os.getenv("SHIBA_URL",   "http://shiba:18789"),
        os.getenv("NATS_URL",    "nats://nats:4222"),
    )


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "service": "hermes-gateway",
        "uptime_s": round(time.time() - _start_time, 1),
        "contracts_active": len(_orchestrator.contracts) if _orchestrator else 0,
    }


@app.post("/intake")
async def intake(req: IntakeRequest) -> Dict[str, Any]:
    if _orchestrator is None:
        raise HTTPException(503, "Orchestrator not ready")
    task_id = str(uuid.uuid4())
    raw_input = {
        "task_id": task_id,
        "task_type": req.task_type,
        "description": req.description,
        "evidence": req.evidence,
        "context": req.context,
        "auto_approve": req.auto_approve,
    }
    try:
        result = await _orchestrator.intake(raw_input)
        return {"task_id": task_id, "status": "accepted", **result}
    except Exception as exc:
        logger.exception("intake error")
        raise HTTPException(500, str(exc)) from exc


@app.get("/tasks/{contract_id}")
async def get_task(contract_id: str) -> Dict[str, Any]:
    if _orchestrator is None:
        raise HTTPException(503, "Orchestrator not ready")
    status = await _orchestrator.get_contract_status(contract_id)
    if not status:
        raise HTTPException(404, f"Contract {contract_id} not found")
    return status


@app.post("/tasks/{contract_id}/fanout")
async def fanout(contract_id: str) -> Dict[str, Any]:
    if _orchestrator is None:
        raise HTTPException(503, "Orchestrator not ready")
    try:
        subtasks = await _orchestrator.task_fanout(contract_id)
        return {"contract_id": contract_id, "subtasks": subtasks, "count": len(subtasks)}
    except Exception as exc:
        logger.exception("fanout error")
        raise HTTPException(500, str(exc)) from exc


@app.get("/jobs")
async def list_jobs() -> Dict[str, Any]:
    """Bridge B — list all active contracts."""
    if _orchestrator is None:
        raise HTTPException(503, "Orchestrator not ready")
    contracts = [
        {"contract_id": k, "status": v.get("status", "unknown")}
        for k, v in (_orchestrator.contracts or {}).items()
    ]
    return {"jobs": contracts, "count": len(contracts)}
