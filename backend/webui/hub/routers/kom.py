"""
Hub v2 router — KiloCode Orchestrator Mode (/api/kom/*).

When enabled, kc-main acts as an autonomous orchestrator:
  1. Receives a high-level goal
  2. Decomposes into typed subtasks
  3. Routes each to the best handler (Hermes/ZeroClaw/KC agent)
  4. Tracks all subtasks with dependency awareness
  5. Auto-retries via fallback routes
  6. Aggregates results into a session summary

Special modes: codebase_audit, project_kickoff, fanout
"""
import uuid
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from hub.config import HERMES_URL, SETTINGS_URL
from hub.auth import require_write
from hub.event_bus import emit
from hub._http import _req

_KOM_ENABLED: dict = {"enabled": False}
_KOM_SESSIONS: dict = {}

_KOM_ROUTES = {
    "plan":        ("hermes",   "hermes1", "intake"),
    "research":    ("hermes",   "hermes2", "intake"),
    "architecture":("hermes",   "hermes3", "intake"),
    "review":      ("hermes",   "hermes4", "intake"),
    "root_cause":  ("hermes",   "hermes5", "intake"),
    "code":        ("kc",       "kc-02",   "assign"),
    "test":        ("kc",       "kc-04",   "assign"),
    "debug":       ("kc",       "kc-05",   "assign"),
    "refactor":    ("kc",       "kc-06",   "assign"),
    "document":    ("kc",       "kc-07",   "assign"),
    "security":    ("kc",       "kc-08",   "assign"),
    "perf":        ("kc",       "kc-09",   "assign"),
    "db":          ("kc",       "kc-11",   "assign"),
    "devops":      ("kc",       "kc-12",   "assign"),
    "frontend":    ("kc",       "kc-13",   "assign"),
    "backend":     ("kc",       "kc-14",   "assign"),
    "deploy":      ("kc",       "kc-20",   "assign"),
}
_KOM_FALLBACK = {
    "hermes":   ("kc",     "kc-15", "assign"),
    "zeroclaw": ("hermes", "hermes3", "intake"),
    "kc":       ("hermes", "hermes2", "intake"),
}
_AUDIT_TEMPLATE = [
    {"type": "research",     "description": "Survey the project structure: list all source files, identify entry points, map module relationships"},
    {"type": "architecture", "description": "Analyse the codebase architecture: identify patterns, anti-patterns, service boundaries, and data flows"},
    {"type": "security",     "description": "Security audit: scan for hardcoded secrets, unsafe inputs, missing auth, vulnerable dependencies"},
    {"type": "review",       "description": "Code quality review: identify dead code, missing error handling, inconsistent naming, and poor practices"},
    {"type": "perf",         "description": "Performance audit: identify N+1 queries, blocking calls, memory leaks, and unnecessary computation"},
    {"type": "test",         "description": "Test coverage audit: identify untested paths, missing edge cases, and suggest test priorities"},
    {"type": "document",     "description": "Documentation audit: identify undocumented functions, missing README sections, and outdated comments"},
    {"type": "root_cause",   "description": "Root cause analysis: synthesise findings and prioritise top-10 issues by risk"},
]
_KA: dict = {}  # injected by __init__


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _pe_emit(evt_type: str, agent: str, detail: str, pipeline_events: list) -> None:
    pipeline_events.insert(0, {
        "id": str(uuid.uuid4())[:8], "ts": _ts(),
        "type": evt_type, "agent": agent, "detail": detail,
    })
    if len(pipeline_events) > 200:
        pipeline_events.pop()


async def _dispatch_subtask(subtask: dict, pipeline_events: list) -> dict:
    stype = subtask.get("type", "research")
    desc = subtask.get("description", "")
    route = _KOM_ROUTES.get(stype, _KOM_ROUTES["research"])
    handler, target, method = route
    subtask.update({"routed_to": handler, "routed_target": target,
                    "status": "dispatched", "dispatched_at": _ts()})
    try:
        if handler == "hermes":
            r = await _req("POST", f"{HERMES_URL}/intake", {
                "task_type": stype, "description": desc,
                "context": {"session_id": subtask.get("session_id"), "subtask_id": subtask["id"]},
                "auto_approve": True,
            })
            subtask["hermes_task_id"] = r.get("task_id")
            subtask["status"] = "pending" if "error" not in r else "failed"
        elif handler == "zeroclaw":
            r = await _req("POST", f"{SETTINGS_URL}/kilocode/zeroclaw/tasks", {
                "description": desc, "adapter": target,
                "session_id": subtask.get("session_id"),
            })
            subtask["zc_task_id"] = r.get("taskId")
            subtask["status"] = "pending" if "error" not in r else "failed"
        elif handler == "kc":
            a = _KA.get(target) or next(
                (ag for ag in _KA.values() if ag["id"] != "kc-main" and ag["status"] == "idle"), None
            )
            if a:
                a["status"] = "busy"
                a["current_task"] = desc[:100]
                a["task_count"] = a.get("task_count", 0) + 1
                subtask["routed_target"] = a["id"]
                subtask["status"] = "pending"
            else:
                subtask["status"] = "queued"
        _pe_emit("kom.dispatched", f"kc-main→{target}", f"[{stype}] {desc[:60]}", pipeline_events)
    except Exception as exc:
        subtask["status"] = "failed"
        subtask["error"] = str(exc)
        _pe_emit("kom.dispatch_failed", target, f"[{stype}] {str(exc)[:60]}", pipeline_events)
    subtask["updated_at"] = _ts()
    return subtask


def create_router(pipeline_events: list, kc_agents: dict) -> APIRouter:
    global _KA
    _KA = kc_agents
    router = APIRouter(prefix="/api/kom", tags=["kom"])

    @router.get("/status")
    async def kom_status():
        return JSONResponse({
            "enabled": _KOM_ENABLED["enabled"],
            "sessions": len(_KOM_SESSIONS),
            "active_sessions": [s["id"] for s in _KOM_SESSIONS.values() if s["status"] == "running"],
            "routes": list(_KOM_ROUTES.keys()),
        })

    @router.post("/enable", dependencies=[Depends(require_write)])
    async def kom_enable():
        _KOM_ENABLED["enabled"] = True
        emit("kom.enabled", {})
        return JSONResponse({"ok": True, "enabled": True})

    @router.post("/disable", dependencies=[Depends(require_write)])
    async def kom_disable():
        _KOM_ENABLED["enabled"] = False
        emit("kom.disabled", {})
        return JSONResponse({"ok": True, "enabled": False})

    @router.post("/sessions", dependencies=[Depends(require_write)])
    async def kom_create_session(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        goal = body.get("goal", "")
        mode = body.get("mode", "custom")
        context = body.get("context", "")
        if not goal:
            return JSONResponse({"error": "goal is required"}, status_code=400)
        session_id = str(uuid.uuid4())[:12]
        now = _ts()
        subtask_templates: list = []
        if mode == "codebase_audit":
            subtask_templates = [dict(t) for t in _AUDIT_TEMPLATE]
        elif mode == "project_kickoff":
            ctx_str = f" Context: {context}" if context else ""
            subtask_templates = [
                {"type": "plan",         "description": f"Create a project plan for: {goal}{ctx_str}"},
                {"type": "research",     "description": f"Research solutions for: {goal}"},
                {"type": "architecture", "description": f"Design architecture for: {goal}"},
                {"type": "backend",      "description": f"Implement backend for: {goal}"},
                {"type": "frontend",     "description": f"Implement frontend for: {goal}"},
                {"type": "db",           "description": f"Design database schema for: {goal}"},
                {"type": "test",         "description": f"Write tests for: {goal}"},
                {"type": "security",     "description": f"Security review for: {goal}"},
                {"type": "devops",       "description": f"Set up CI/CD for: {goal}"},
                {"type": "document",     "description": f"Write documentation for: {goal}"},
            ]
        else:
            subtask_templates = body.get("subtasks", [{"type": "research", "description": goal}])

        subtasks = []
        for i, t in enumerate(subtask_templates):
            subtasks.append({
                "id": f"{session_id}-{i}", "session_id": session_id,
                "type": t.get("type", "research"), "description": t.get("description", ""),
                "depends_on": t.get("depends_on", []), "status": "pending",
                "routed_to": None, "routed_target": None,
                "result": None, "error": None,
                "created_at": now, "updated_at": now, "dispatched_at": None,
            })

        session = {
            "id": session_id, "goal": goal, "mode": mode, "status": "running",
            "created_at": now, "updated_at": now, "completed_at": None,
            "subtasks": subtasks,
        }
        _KOM_SESSIONS[session_id] = session
        if _KA.get("kc-main"):
            _KA["kc-main"]["status"] = "busy"
            _KA["kc-main"]["current_task"] = goal[:100]

        # Dispatch subtasks with no dependencies
        ready = [s for s in subtasks if not s["depends_on"]]
        await asyncio.gather(*[_dispatch_subtask(s, pipeline_events) for s in ready])
        _pe_emit("kom.session_started", "kc-main", f"[{mode}] {goal[:80]}", pipeline_events)
        emit("kom.session.started", {"session_id": session_id, "mode": mode})
        return JSONResponse({"ok": True, "session_id": session_id, "session": session})

    @router.get("/sessions")
    async def kom_list_sessions():
        return JSONResponse({
            "sessions": [
                {"id": s["id"], "goal": s["goal"][:80], "mode": s["mode"],
                 "status": s["status"], "created_at": s["created_at"],
                 "subtasks_total": len(s["subtasks"]),
                 "subtasks_done": sum(1 for t in s["subtasks"] if t["status"] in ("done", "completed")),
                 "subtasks_failed": sum(1 for t in s["subtasks"] if t["status"] == "failed")}
                for s in _KOM_SESSIONS.values()
            ],
            "total": len(_KOM_SESSIONS),
        })

    @router.get("/sessions/{session_id}")
    async def kom_get_session(session_id: str):
        s = _KOM_SESSIONS.get(session_id)
        if not s:
            return JSONResponse({"error": "Session not found"}, status_code=404)
        return JSONResponse(s)

    @router.delete("/sessions/{session_id}", dependencies=[Depends(require_write)])
    async def kom_cancel_session(session_id: str):
        s = _KOM_SESSIONS.get(session_id)
        if not s:
            return JSONResponse({"error": "Session not found"}, status_code=404)
        s["status"] = "cancelled"
        s["updated_at"] = _ts()
        for st in s["subtasks"]:
            target = st.get("routed_target")
            if target and target in _KA:
                _KA[target]["status"] = "idle"
                _KA[target]["current_task"] = None
        if _KA.get("kc-main", {}).get("status") == "busy":
            _KA["kc-main"]["status"] = "idle"
            _KA["kc-main"]["current_task"] = None
        _pe_emit("kom.cancelled", "kc-main", f"Session {session_id} cancelled", pipeline_events)
        emit("kom.session.cancelled", {"session_id": session_id})
        return JSONResponse({"ok": True})

    @router.post("/subtask/{subtask_id}/complete", dependencies=[Depends(require_write)])
    async def kom_complete_subtask(subtask_id: str, request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        session_id = subtask_id.rsplit("-", 1)[0]
        s = _KOM_SESSIONS.get(session_id)
        if not s:
            return JSONResponse({"error": "Session not found"}, status_code=404)
        st = next((t for t in s["subtasks"] if t["id"] == subtask_id), None)
        if not st:
            return JSONResponse({"error": "Subtask not found"}, status_code=404)
        st["status"] = "done"
        st["result"] = body.get("result", "")
        st["updated_at"] = _ts()
        target = st.get("routed_target")
        if target and target in _KA:
            _KA[target]["status"] = "idle"
            _KA[target]["current_task"] = None
        # Check for newly unblocked subtasks
        completed = {t["id"] for t in s["subtasks"] if t["status"] in ("done", "completed")}
        newly_ready = [t for t in s["subtasks"]
                       if t["status"] == "pending" and all(d in completed for d in t["depends_on"])]
        await asyncio.gather(*[_dispatch_subtask(t, pipeline_events) for t in newly_ready])
        # Check session completion
        if all(t["status"] in ("done", "completed", "failed") for t in s["subtasks"]):
            s["status"] = "completed"
            s["completed_at"] = _ts()
            if _KA.get("kc-main"):
                _KA["kc-main"]["status"] = "idle"
                _KA["kc-main"]["current_task"] = None
            emit("kom.session.completed", {"session_id": session_id})
        return JSONResponse({"ok": True, "subtask": st})

    @router.post("/subtask/{subtask_id}/retry", dependencies=[Depends(require_write)])
    async def kom_retry_subtask(subtask_id: str):
        session_id = subtask_id.rsplit("-", 1)[0]
        s = _KOM_SESSIONS.get(session_id)
        if not s:
            return JSONResponse({"error": "Session not found"}, status_code=404)
        st = next((t for t in s["subtasks"] if t["id"] == subtask_id), None)
        if not st:
            return JSONResponse({"error": "Subtask not found"}, status_code=404)
        primary = st.get("routed_to", "hermes")
        fallback = _KOM_FALLBACK.get(primary)
        if fallback:
            _KOM_ROUTES[st["type"]] = fallback
        st["status"] = "pending"
        st["error"] = None
        await _dispatch_subtask(st, pipeline_events)
        _pe_emit("kom.retry", "kc-main", f"Retrying {subtask_id} via fallback", pipeline_events)
        return JSONResponse({"ok": True, "subtask": st})

    return router
