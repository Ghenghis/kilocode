"""
Hub v2 router — Task / Progress tracking (/api/tasks/*).

Cross-surface task model: Hub, KiloCode, and Open WebUI share the same task state.
Every task moves through stages: pending → queued → running → review → done | failed.
Each stage transition emits SSE events for live UI refresh across all surfaces.

Features:
  - Full CRUD for tasks
  - Stage-based progress tracking with timestamps
  - Agent assignment + routing
  - Approval gates (tasks can be blocked on approval)
  - Progress percentage + sub-step tracking
  - Cross-surface visibility (KiloCode, Open WebUI, Hub all see same state)
"""
import uuid
import time
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from backend.webui.hub.auth import require_write
from backend.webui.hub.event_bus import emit

# ── Task storage ──────────────────────────────────────────────────────────────
_TASKS: dict[str, dict] = {}
_TASK_HISTORY: list[dict] = []

# Valid stage transitions
_STAGES = ["pending", "queued", "running", "review", "done", "failed", "cancelled"]
_STAGE_ORDER = {s: i for i, s in enumerate(_STAGES)}


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _make_task(body: dict) -> dict:
    """Create a new task dict from request body."""
    now = _ts()
    task_id = body.get("id") or str(uuid.uuid4())[:10]
    return {
        "id": task_id,
        "title": body.get("title", "Untitled Task"),
        "description": body.get("description", ""),
        "stage": "pending",
        "progress": 0,
        "agent": body.get("agent"),
        "source": body.get("source", "hub"),
        "priority": body.get("priority", "normal"),
        "tags": body.get("tags", []),
        "needs_approval": body.get("needs_approval", False),
        "approved": False,
        "approved_by": None,
        "approved_at": None,
        "steps": body.get("steps", []),
        "current_step": 0,
        "result": None,
        "error": None,
        "created_at": now,
        "updated_at": now,
        "started_at": None,
        "completed_at": None,
        "stage_history": [{"stage": "pending", "ts": now, "by": body.get("source", "hub")}],
    }


def get_tasks() -> dict:
    """Shared accessor for other routers (overview, etc.)."""
    return _TASKS


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/tasks", tags=["tasks"])

    # ── List ────────────────────────────────────────────────────────────────
    @router.get("")
    async def list_tasks(
        stage: Optional[str] = None,
        agent: Optional[str] = None,
        source: Optional[str] = None,
        limit: int = 100,
    ):
        tasks = list(_TASKS.values())
        if stage:
            tasks = [t for t in tasks if t["stage"] == stage]
        if agent:
            tasks = [t for t in tasks if t.get("agent") == agent]
        if source:
            tasks = [t for t in tasks if t.get("source") == source]
        tasks.sort(key=lambda t: t["updated_at"], reverse=True)
        summary = {
            "total": len(_TASKS),
            "pending": sum(1 for t in _TASKS.values() if t["stage"] == "pending"),
            "running": sum(1 for t in _TASKS.values() if t["stage"] == "running"),
            "review": sum(1 for t in _TASKS.values() if t["stage"] == "review"),
            "done": sum(1 for t in _TASKS.values() if t["stage"] == "done"),
            "failed": sum(1 for t in _TASKS.values() if t["stage"] == "failed"),
        }
        return JSONResponse({"tasks": tasks[:limit], "summary": summary, "ts": _ts()})

    # ── Get single ──────────────────────────────────────────────────────────
    @router.get("/{task_id}")
    async def get_task(task_id: str):
        t = _TASKS.get(task_id)
        if not t:
            return JSONResponse({"error": "Task not found"}, status_code=404)
        return JSONResponse(t)

    # ── Create ──────────────────────────────────────────────────────────────
    @router.post("", dependencies=[Depends(require_write)])
    async def create_task(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        task = _make_task(body)
        _TASKS[task["id"]] = task
        _history("created", task)
        emit("task.created", {"id": task["id"], "title": task["title"], "stage": "pending"})
        return JSONResponse({"ok": True, "task": task})

    # ── Update stage ────────────────────────────────────────────────────────
    @router.post("/{task_id}/stage", dependencies=[Depends(require_write)])
    async def update_stage(task_id: str, request: Request):
        t = _TASKS.get(task_id)
        if not t:
            return JSONResponse({"error": "Task not found"}, status_code=404)
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        new_stage = body.get("stage", "")
        if new_stage not in _STAGES:
            return JSONResponse({"error": f"Invalid stage: {new_stage}. Valid: {_STAGES}"}, status_code=400)
        # Enforce approval gate
        if new_stage == "running" and t.get("needs_approval") and not t.get("approved"):
            return JSONResponse({"error": "Task requires approval before running"}, status_code=409)
        old_stage = t["stage"]
        t["stage"] = new_stage
        t["updated_at"] = _ts()
        t["stage_history"].append({"stage": new_stage, "ts": t["updated_at"], "by": body.get("by", "hub")})
        if new_stage == "running" and not t.get("started_at"):
            t["started_at"] = t["updated_at"]
        if new_stage in ("done", "failed", "cancelled"):
            t["completed_at"] = t["updated_at"]
        if body.get("result"):
            t["result"] = body["result"]
        if body.get("error"):
            t["error"] = body["error"]
        _history("stage_changed", t, detail=f"{old_stage} → {new_stage}")
        emit("task.stage.changed", {"id": task_id, "old": old_stage, "new": new_stage})
        return JSONResponse({"ok": True, "task": t})

    # ── Update progress ─────────────────────────────────────────────────────
    @router.post("/{task_id}/progress", dependencies=[Depends(require_write)])
    async def update_progress(task_id: str, request: Request):
        t = _TASKS.get(task_id)
        if not t:
            return JSONResponse({"error": "Task not found"}, status_code=404)
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        if "progress" in body:
            t["progress"] = max(0, min(100, int(body["progress"])))
        if "current_step" in body:
            t["current_step"] = body["current_step"]
        if "steps" in body:
            t["steps"] = body["steps"]
        t["updated_at"] = _ts()
        emit("task.progress", {"id": task_id, "progress": t["progress"], "step": t["current_step"]})
        return JSONResponse({"ok": True, "task": t})

    # ── Approve task (for approval-gated tasks) ─────────────────────────────
    @router.post("/{task_id}/approve", dependencies=[Depends(require_write)])
    async def approve_task(task_id: str, request: Request):
        t = _TASKS.get(task_id)
        if not t:
            return JSONResponse({"error": "Task not found"}, status_code=404)
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        t["approved"] = True
        t["approved_by"] = body.get("by", "user")
        t["approved_at"] = _ts()
        t["updated_at"] = t["approved_at"]
        _history("approved", t, detail=f"Approved by {t['approved_by']}")
        emit("task.approved", {"id": task_id, "by": t["approved_by"]})
        return JSONResponse({"ok": True, "task": t})

    # ── Reject / deny approval ──────────────────────────────────────────────
    @router.post("/{task_id}/reject", dependencies=[Depends(require_write)])
    async def reject_task(task_id: str, request: Request):
        t = _TASKS.get(task_id)
        if not t:
            return JSONResponse({"error": "Task not found"}, status_code=404)
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        t["stage"] = "failed"
        t["error"] = body.get("reason", "Rejected")
        t["completed_at"] = _ts()
        t["updated_at"] = t["completed_at"]
        t["stage_history"].append({"stage": "failed", "ts": t["updated_at"], "by": body.get("by", "user")})
        _history("rejected", t, detail=body.get("reason", "Rejected"))
        emit("task.rejected", {"id": task_id, "reason": t["error"]})
        return JSONResponse({"ok": True, "task": t})

    # ── Delete ──────────────────────────────────────────────────────────────
    @router.delete("/{task_id}", dependencies=[Depends(require_write)])
    async def delete_task(task_id: str):
        if task_id not in _TASKS:
            return JSONResponse({"error": "Task not found"}, status_code=404)
        del _TASKS[task_id]
        emit("task.deleted", {"id": task_id})
        return JSONResponse({"ok": True, "id": task_id})

    # ── History ─────────────────────────────────────────────────────────────
    @router.get("/history/all")
    async def task_history(limit: int = 50):
        return JSONResponse({"history": _TASK_HISTORY[:limit], "count": len(_TASK_HISTORY)})

    return router


def _history(action: str, task: dict, detail: str = "") -> None:
    """Record task history entry."""
    entry = {
        "ts": _ts(),
        "action": action,
        "task_id": task["id"],
        "title": task.get("title", ""),
        "stage": task.get("stage", ""),
        "detail": detail,
    }
    _TASK_HISTORY.insert(0, entry)
    if len(_TASK_HISTORY) > 500:
        _TASK_HISTORY.pop()
