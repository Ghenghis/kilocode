"""Hub v2 router — War Room collaboration surface (/api/warroom/*).

War Room W.5 — Collaboration Surface:
  GET  /api/warroom/state              — current war room state
  GET  /api/warroom/threads            — active collaboration threads
  POST /api/warroom/threads            — create new thread
  GET  /api/warroom/threads/{id}      — thread details
  POST /api/warroom/threads/{id}/message — add message to thread
  GET  /api/warroom/approvals          — pending durable approvals
  GET  /api/warroom/agents             — agent presence/status
  GET  /api/warroom/activity           — recent activity stream
"""
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from hub.auth import require_write
from hub.event_bus import emit

# Import war room modules
import sys
from pathlib import Path
integration_path = Path(__file__).parent.parent.parent.parent / "integration"
if str(integration_path) not in sys.path:
    sys.path.insert(0, str(integration_path))

try:
    from approval_store import ApprovalStore, get_store
    from privacy_guard import PrivacyGuard, get_guard
    from task_ledger import TaskLedger, get_ledger
    from identity import IdentityMapping
    _warroom_available = True
except ImportError:
    _warroom_available = False
    # Fallback implementations
    class MockStore:
        def list_pending(self, **kwargs): return []
        def get_stats(self): return {"pending": 0}
    class MockGuard:
        def prepare_for_export(self, d, **kwargs): return d
    def get_store(): return MockStore()
    def get_guard(): return MockGuard()


# War Room state
_threads: Dict[str, Dict[str, Any]] = {}
_agent_presence: Dict[str, Dict[str, Any]] = {}
_activity_log: List[Dict[str, Any]] = []

# The 21 agents
_KILOCODE_AGENTS = [
    "kc-main", "kc-01", "kc-02", "kc-03", "kc-04", "kc-05", "kc-06", "kc-07",
    "kc-08", "kc-09", "kc-10", "kc-11", "kc-12", "kc-13", "kc-14", "kc-15",
    "kc-16", "kc-17", "kc-18", "kc-19", "kc-20",
]


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _add_activity(activity_type: str, actor: str, details: Dict[str, Any]) -> None:
    """Add entry to activity log."""
    entry = {
        "id": str(uuid.uuid4())[:8],
        "ts": time.time(),
        "iso_ts": _ts(),
        "type": activity_type,
        "actor": actor,
        "details": details,
    }
    _activity_log.insert(0, entry)
    if len(_activity_log) > 500:
        _activity_log.pop()
    emit("warroom.activity", entry)


def _privacy_safe(data: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure data is privacy-safe before export."""
    guard = get_guard()
    return guard.prepare_for_export(data, export_context="warroom")


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/warroom", tags=["warroom"])

    # ── State & Overview ──────────────────────────────────────────────────────
    
    @router.get("/state")
    async def get_state():
        """Get current war room state summary."""
        approval_store = get_store()
        approval_stats = approval_store.get_stats()
        
        active_threads = len([t for t in _threads.values() if not t.get("closed")])
        online_agents = len([a for a in _agent_presence.values() if a.get("online")])
        
        state = {
            "ts": time.time(),
            "active_threads": active_threads,
            "total_threads": len(_threads),
            "online_agents": online_agents,
            "total_agents": len(_KILOCODE_AGENTS),
            "pending_approvals": approval_stats.get("pending", 0),
            "warroom_available": _warroom_available,
        }
        return JSONResponse(_privacy_safe({"state": state}))

    @router.get("/activity")
    async def get_activity(limit: int = 50):
        """Get recent war room activity."""
        logs = _activity_log[:limit]
        return JSONResponse(_privacy_safe({"activity": logs, "total": len(_activity_log)}))

    # ── Thread Management ───────────────────────────────────────────────────
    
    @router.get("/threads")
    async def list_threads(active_only: bool = False):
        """List collaboration threads."""
        threads = []
        for tid, t in _threads.items():
            if active_only and t.get("closed"):
                continue
            threads.append({
                "id": t["id"],
                "title": t["title"],
                "created_by": t["created_by"],
                "created_at": t["created_at"],
                "message_count": len(t.get("messages", [])),
                "closed": t.get("closed", False),
                "participant_count": len(set(m["sender"] for m in t.get("messages", []))),
            })
        
        # Sort by most recent message
        threads.sort(key=lambda x: x["created_at"], reverse=True)
        return JSONResponse(_privacy_safe({"threads": threads}))

    @router.post("/threads", dependencies=[Depends(require_write)])
    async def create_thread(request: Request):
        """Create a new collaboration thread."""
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        thread_id = f"thread-{uuid.uuid4().hex[:12]}"
        thread = {
            "id": thread_id,
            "title": body.get("title", "Untitled Thread"),
            "created_by": body.get("created_by", "unknown"),
            "created_at": time.time(),
            "messages": [],
            "closed": False,
            "metadata": body.get("metadata", {}),
        }
        _threads[thread_id] = thread
        
        _add_activity("thread_created", thread["created_by"], {"thread_id": thread_id, "title": thread["title"]})
        emit("warroom.thread.created", {"thread_id": thread_id, "title": thread["title"]})
        
        return JSONResponse(_privacy_safe({"ok": True, "thread": thread}))

    @router.get("/threads/{thread_id}")
    async def get_thread(thread_id: str):
        """Get thread details with messages."""
        if thread_id not in _threads:
            return JSONResponse({"error": "Thread not found"}, status_code=404)
        
        thread = _threads[thread_id]
        return JSONResponse(_privacy_safe({"thread": thread}))

    @router.post("/threads/{thread_id}/message", dependencies=[Depends(require_write)])
    async def post_message(thread_id: str, request: Request):
        """Add a message to a thread."""
        if thread_id not in _threads:
            return JSONResponse({"error": "Thread not found"}, status_code=404)
        
        thread = _threads[thread_id]
        if thread.get("closed"):
            return JSONResponse({"error": "Thread is closed"}, status_code=400)
        
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        message = {
            "id": f"msg-{uuid.uuid4().hex[:8]}",
            "sender": body.get("sender", "unknown"),
            "sender_type": body.get("sender_type", "agent"),  # agent, user, system
            "content": body.get("content", ""),
            "timestamp": time.time(),
            "type": body.get("type", "text"),  # text, command, result, approval
            "metadata": body.get("metadata", {}),
        }
        
        thread["messages"].append(message)
        
        _add_activity("message_posted", message["sender"], {
            "thread_id": thread_id,
            "message_id": message["id"],
            "type": message["type"],
        })
        emit("warroom.message", {"thread_id": thread_id, "message": message})
        
        return JSONResponse(_privacy_safe({"ok": True, "message": message}))

    # ── Agent Presence ────────────────────────────────────────────────────────
    
    @router.get("/agents")
    async def get_agents():
        """Get agent presence and status."""
        agents = []
        for agent_id in _KILOCODE_AGENTS:
            presence = _agent_presence.get(agent_id, {})
            agents.append({
                "id": agent_id,
                "online": presence.get("online", False),
                "last_seen": presence.get("last_seen"),
                "current_task": presence.get("current_task"),
                "status": presence.get("status", "idle"),
            })
        return JSONResponse(_privacy_safe({"agents": agents}))

    @router.post("/agents/{agent_id}/heartbeat")
    async def agent_heartbeat(agent_id: str, request: Request):
        """Update agent presence."""
        if agent_id not in _KILOCODE_AGENTS:
            return JSONResponse({"error": "Unknown agent"}, status_code=404)
        
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        _agent_presence[agent_id] = {
            "online": True,
            "last_seen": time.time(),
            "current_task": body.get("current_task"),
            "status": body.get("status", "idle"),
        }
        
        emit("warroom.agent.heartbeat", {"agent_id": agent_id})
        return JSONResponse({"ok": True})

    # ── Durable Approvals Integration ──────────────────────────────────────────
    
    @router.get("/approvals")
    async def get_pending_approvals():
        """Get pending durable approvals."""
        if not _warroom_available:
            return JSONResponse({"approvals": [], "note": "War Room modules not available"})
        
        store = get_store()
        pending = store.list_pending()
        
        approvals = []
        for req in pending:
            approvals.append({
                "request_id": req.request_id,
                "requester_id": req.requester_id,
                "action_type": req.action_type,
                "resource_id": req.resource_id,
                "risk_level": req.risk_level,
                "requested_at": req.requested_at,
                "expires_at": req.requested_at + req.timeout_seconds,
                "time_remaining": max(0, req.requested_at + req.timeout_seconds - time.time()),
            })
        
        return JSONResponse(_privacy_safe({"approvals": approvals, "total": len(approvals)}))

    @router.post("/approvals/{request_id}/resolve", dependencies=[Depends(require_write)])
    async def resolve_approval(request_id: str, request: Request):
        """Resolve a pending approval."""
        if not _warroom_available:
            return JSONResponse({"error": "War Room modules not available"}, status_code=503)
        
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        store = get_store()
        resolution = body.get("resolution", "denied")  # approved or denied
        resolver_id = body.get("resolver_id", "unknown")
        reason = body.get("reason", "")
        
        ok = store.resolve_request(request_id, resolution, resolver_id, reason)
        if not ok:
            return JSONResponse({"error": "Approval request not found or already resolved"}, status_code=404)
        
        _add_activity("approval_resolved", resolver_id, {
            "request_id": request_id,
            "resolution": resolution,
            "reason": reason,
        })
        emit("warroom.approval.resolved", {
            "request_id": request_id,
            "resolution": resolution,
            "resolver_id": resolver_id,
        })
        
        return JSONResponse({"ok": True, "request_id": request_id, "resolution": resolution})

    # ── Task Ledger Integration ────────────────────────────────────────────────
    
    @router.get("/tasks")
    async def get_warroom_tasks():
        """Get tasks visible in war room."""
        if not _warroom_available:
            return JSONResponse({"tasks": [], "note": "War Room modules not available"})
        
        ledger = get_ledger()
        tasks = ledger.list_tasks()
        
        return JSONResponse(_privacy_safe({"tasks": tasks}))

    return router
