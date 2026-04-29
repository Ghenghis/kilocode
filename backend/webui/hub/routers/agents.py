"""Hub v2 router — KiloCode agent registry and chat (/api/agents/*)."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from hub.auth import require_write
from hub.event_bus import emit

# ── Agent registry — sourced from KiloCode official repo ──────────────────────
# https://github.com/Kilo-Org/kilocode
# packages/opencode/src/kilocode/agent/index.ts  (patchAgents)
# packages/opencode/src/agent/agent.ts            (native agents)
# Default provider: MiniMax MiniMax-Text-01
_KC_AGENTS = [
    {"id": "kc-01", "name": "Integration Lead",      "color": "#FF6B6B", "role": "Project integration and coordination across components"},
    {"id": "kc-02", "name": "Creative Brainstormer",  "color": "#4ECDC4", "role": "Innovative ideas and creative solutions to problems"},
    {"id": "kc-03", "name": "System Architect",       "color": "#45B7D1", "role": "System architecture design and technical frameworks"},
    {"id": "kc-04", "name": "Bug Triage Specialist",  "color": "#96CEB4", "role": "Bug analysis, prioritization, and classification"},
    {"id": "kc-05", "name": "Root Cause Analyst",     "color": "#FFEAA7", "role": "Deep issue analysis to find true root causes"},
    {"id": "kc-06", "name": "Code Generator",         "color": "#DDA0DD", "role": "Clean, efficient, production-ready code generation"},
    {"id": "kc-07", "name": "Code Reviewer",          "color": "#FFB6C1", "role": "Thorough code reviews and quality checks"},
    {"id": "kc-08", "name": "Test Writer",            "color": "#98D8C8", "role": "Comprehensive test suites and testing strategies"},
    {"id": "kc-09", "name": "Debugger",               "color": "#F7DC6F", "role": "Debugging complex issues and system problems"},
    {"id": "kc-10", "name": "Refactorer",             "color": "#BB8FCE", "role": "Code refactoring, optimization, and tech debt reduction"},
    {"id": "kc-11", "name": "Documenter",             "color": "#85C1E2", "role": "Comprehensive documentation and technical guides"},
    {"id": "kc-12", "name": "Security Auditor",       "color": "#E74C3C", "role": "Security analysis and vulnerability assessments"},
    {"id": "kc-13", "name": "Performance Analyst",    "color": "#F39C12", "role": "System performance analysis and optimization"},
    {"id": "kc-14", "name": "API Integrator",         "color": "#16A085", "role": "API design, architecture, and third-party integrations"},
    {"id": "kc-15", "name": "Database Specialist",    "color": "#8E44AD", "role": "Database design, query optimization, and data modeling"},
    {"id": "kc-16", "name": "DevOps Engineer",        "color": "#27AE60", "role": "CI/CD pipelines, deployment, and infrastructure"},
    {"id": "kc-17", "name": "Frontend Specialist",    "color": "#E67E22", "role": "Frontend development and user interface design"},
    {"id": "kc-18", "name": "Backend Specialist",     "color": "#2C3E50", "role": "Backend development and server architecture"},
    {"id": "kc-19", "name": "Research Analyst",       "color": "#34495E", "role": "Research and analysis for informed decision making"},
    {"id": "kc-20", "name": "Prompt Engineer",        "color": "#9B59B6", "role": "Prompt engineering and AI interaction optimization"},
]

_AGENTS: dict = {
    "kc-main": {
        "id": "kc-main", "name": "KiloCode Main", "type": "main",
        "role": "Primary AI coding agent — coordinates all 20 sub-agents",
        "status": "idle", "capabilities": ["code_gen", "planning", "review", "refactor", "test", "deploy"],
        "current_task": None, "task_count": 0, "model": "MiniMax-M2.7-highspeed",
        "color": "#FFFFFF",
    },
    **{
        a["id"]: {
            "id": a["id"], "name": a["name"], "type": "sub",
            "role": a["role"], "color": a["color"],
            "status": "idle", "capabilities": [], "current_task": None,
            "task_count": 0, "model": "MiniMax-M2.7-highspeed",
        }
        for a in _KC_AGENTS
    },
}

_MESSAGES: list = []
_PIPELINE_EVENTS: list = []
_ACTIVITY_LOG: list = []


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/agents", tags=["agents"])

    @router.get("")
    async def list_agents():
        return JSONResponse({
            "agents": list(_AGENTS.values()),
            "total": len(_AGENTS),
            "active": sum(1 for a in _AGENTS.values() if a["status"] == "active"),
            "idle": sum(1 for a in _AGENTS.values() if a["status"] == "idle"),
            "busy": sum(1 for a in _AGENTS.values() if a["status"] == "busy"),
        })

    # ── Agent chat (MUST be before /{agent_id} to avoid route shadowing) ───
    @router.get("/chat/messages")
    async def get_messages(limit: int = 100):
        return JSONResponse({"messages": _MESSAGES[:limit]})

    @router.post("/chat/send", dependencies=[Depends(require_write)])
    async def send_message(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        text = body.get("message") or body.get("content", "")
        msg = {"id": str(uuid.uuid4())[:8], "ts": _ts(),
               "from": body.get("from", "user"), "to": body.get("to", "broadcast"),
               "message": text, "content": text, "type": body.get("type", "chat")}
        _MESSAGES.insert(0, msg)
        if len(_MESSAGES) > 500:
            _MESSAGES.pop()
        emit("agent.chat.message", msg)
        return JSONResponse({"ok": True, "message": msg})

    @router.post("/chat/broadcast", dependencies=[Depends(require_write)])
    async def broadcast_message(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        text = body.get("message") or body.get("content", "")
        msg = {"id": str(uuid.uuid4())[:8], "ts": _ts(), "from": "hub",
               "to": "all", "message": text, "content": text, "type": "broadcast"}
        _MESSAGES.insert(0, msg)
        emit("agent.chat.broadcast", msg)
        return JSONResponse({"ok": True, "message": msg})

    @router.delete("/chat/clear", dependencies=[Depends(require_write)])
    async def clear_chat():
        _MESSAGES.clear()
        return JSONResponse({"ok": True})

    # ── Activity log (MUST be before /{agent_id} to avoid route shadowing) ─
    @router.get("/activity")
    async def agent_activity(limit: int = 100, agent: str = "", type_filter: str = ""):
        logs = _ACTIVITY_LOG
        if agent:
            logs = [l for l in logs if l.get("agent") == agent]
        if type_filter:
            logs = [l for l in logs if type_filter in l.get("type", "")]
        return JSONResponse({"logs": logs[:limit], "count": len(logs)})

    @router.post("/activity", dependencies=[Depends(require_write)])
    async def push_activity(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        entry = {"ts": _ts(), "agent": body.get("agent", "system"),
                 "type": body.get("type", "info"), "detail": body.get("detail", "")}
        _ACTIVITY_LOG.insert(0, entry)
        if len(_ACTIVITY_LOG) > 500:
            _ACTIVITY_LOG.pop()
        return JSONResponse({"ok": True, "entry": entry})

    @router.delete("/activity", dependencies=[Depends(require_write)])
    async def clear_activity():
        _ACTIVITY_LOG.clear()
        return JSONResponse({"ok": True})

    # ── Single agent routes (parameterized — MUST be AFTER specific routes) ─
    @router.get("/{agent_id}")
    async def get_agent(agent_id: str):
        a = _AGENTS.get(agent_id)
        if not a:
            return JSONResponse({"error": "Agent not found"}, status_code=404)
        return JSONResponse(a)

    @router.post("/{agent_id}/config", dependencies=[Depends(require_write)])
    async def update_agent_config(agent_id: str, request: Request):
        a = _AGENTS.get(agent_id)
        if not a:
            return JSONResponse({"error": "Agent not found"}, status_code=404)
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        for k in ("status", "model", "role", "current_task"):
            if k in body:
                a[k] = body[k]
        emit("agent.config.updated", {"agent_id": agent_id})
        return JSONResponse({"ok": True, "agent": a})

    @router.post("/{agent_id}/assign", dependencies=[Depends(require_write)])
    async def assign_agent(agent_id: str, request: Request):
        a = _AGENTS.get(agent_id)
        if not a:
            return JSONResponse({"error": "Agent not found"}, status_code=404)
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        task_desc = body.get("task", "")
        a["status"] = "busy"
        a["current_task"] = task_desc
        a["task_count"] = a.get("task_count", 0) + 1
        evt = {"id": str(uuid.uuid4())[:8], "ts": _ts(), "type": "agent.assigned",
               "agent": agent_id, "detail": f"{a['name']} ← {task_desc[:80]}"}
        _PIPELINE_EVENTS.insert(0, evt)
        if len(_PIPELINE_EVENTS) > 200:
            _PIPELINE_EVENTS.pop()
        emit("agent.assigned", {"agent_id": agent_id, "task": task_desc})
        return JSONResponse({"ok": True, "agent_id": agent_id, "task": task_desc})

    @router.post("/{agent_id}/release", dependencies=[Depends(require_write)])
    async def release_agent(agent_id: str):
        a = _AGENTS.get(agent_id)
        if not a:
            return JSONResponse({"error": "Agent not found"}, status_code=404)
        a["status"] = "idle"
        a["current_task"] = None
        emit("agent.released", {"agent_id": agent_id})
        return JSONResponse({"ok": True, "agent_id": agent_id})

    return router


def get_pipeline_events() -> list:
    """Shared access for pipeline router."""
    return _PIPELINE_EVENTS
