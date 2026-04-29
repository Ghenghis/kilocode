"""
Hub v2 router — Permissions & Safety (/api/permissions/*).

Centralized permission and safety policy for all 21 KC agents + surfaces.
Each agent has a capability policy (what it can do) and a risk level.
Disruptive actions require explicit approval and an active maintenance window.

Features:
  - Per-agent capability policy (allow/deny per tool)
  - Global safety rules (e.g. no shell exec without approval)
  - Approval queue for gated actions
  - Audit log for all permission decisions
  - Cross-surface: KiloCode, Open WebUI, and Hub all check the same policy
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from backend.webui.hub.auth import require_write, get_maintenance_window
from backend.webui.hub.event_bus import emit

# ── Default capabilities ──────────────────────────────────────────────────────
_CAPABILITIES = [
    "code_read", "code_write", "code_execute",
    "file_read", "file_write", "file_delete",
    "shell_exec", "ssh_exec", "scp_transfer",
    "git_read", "git_write", "git_push",
    "docker_read", "docker_write", "docker_exec",
    "db_read", "db_write", "db_migrate",
    "network_request", "api_call",
    "settings_read", "settings_write",
    "agent_spawn", "agent_assign",
]

_RISK_LEVELS = {
    "safe": {"color": "#22c55e", "requires_approval": False, "requires_maintenance": False},
    "moderate": {"color": "#f59e0b", "requires_approval": False, "requires_maintenance": False},
    "elevated": {"color": "#f97316", "requires_approval": True, "requires_maintenance": False},
    "disruptive": {"color": "#ef4444", "requires_approval": True, "requires_maintenance": True},
}

# ── Per-agent policies ────────────────────────────────────────────────────────
# Default: all agents can read, only kc-main and specific specialists can write/exec
_DEFAULT_POLICY = {cap: "allow" for cap in _CAPABILITIES if "read" in cap}
_DEFAULT_POLICY.update({cap: "deny" for cap in _CAPABILITIES if "read" not in cap})

_AGENT_POLICIES: dict[str, dict] = {}

_CAPABILITY_RISK: dict[str, str] = {
    "code_read": "safe", "code_write": "moderate", "code_execute": "elevated",
    "file_read": "safe", "file_write": "moderate", "file_delete": "elevated",
    "shell_exec": "disruptive", "ssh_exec": "disruptive", "scp_transfer": "elevated",
    "git_read": "safe", "git_write": "moderate", "git_push": "elevated",
    "docker_read": "safe", "docker_write": "elevated", "docker_exec": "disruptive",
    "db_read": "safe", "db_write": "elevated", "db_migrate": "disruptive",
    "network_request": "moderate", "api_call": "moderate",
    "settings_read": "safe", "settings_write": "moderate",
    "agent_spawn": "moderate", "agent_assign": "safe",
}

# ── Approval queue ────────────────────────────────────────────────────────────
_APPROVAL_QUEUE: list[dict] = []
_AUDIT_LOG: list[dict] = []


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _get_agent_policy(agent_id: str) -> dict:
    """Get effective policy for an agent (custom or default)."""
    if agent_id in _AGENT_POLICIES:
        return _AGENT_POLICIES[agent_id]
    # kc-main gets elevated defaults
    if agent_id == "kc-main":
        return {cap: "allow" for cap in _CAPABILITIES}
    return dict(_DEFAULT_POLICY)


def check_permission(agent_id: str, capability: str) -> dict:
    """Check if agent has permission for a capability. Returns verdict + reasoning."""
    policy = _get_agent_policy(agent_id)
    decision = policy.get(capability, "deny")
    risk = _CAPABILITY_RISK.get(capability, "moderate")
    risk_info = _RISK_LEVELS.get(risk, _RISK_LEVELS["moderate"])

    mw = get_maintenance_window()
    needs_mw = risk_info["requires_maintenance"]
    needs_approval = risk_info["requires_approval"]

    if decision == "deny":
        return {"allowed": False, "reason": f"{capability} denied by policy for {agent_id}",
                "risk": risk, "needs_approval": False, "needs_maintenance": False}

    if needs_mw and not mw:
        return {"allowed": False, "reason": f"{capability} requires maintenance window",
                "risk": risk, "needs_approval": needs_approval, "needs_maintenance": True}

    if needs_approval:
        return {"allowed": False, "reason": f"{capability} requires approval (risk: {risk})",
                "risk": risk, "needs_approval": True, "needs_maintenance": needs_mw}

    return {"allowed": True, "reason": "Permitted", "risk": risk,
            "needs_approval": False, "needs_maintenance": False}


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/permissions", tags=["permissions"])

    # ── Get all capabilities + risk levels ──────────────────────────────────
    @router.get("/capabilities")
    async def list_capabilities():
        return JSONResponse({
            "capabilities": _CAPABILITIES,
            "risk_levels": _RISK_LEVELS,
            "capability_risk": _CAPABILITY_RISK,
        })

    # ── Get agent policy ────────────────────────────────────────────────────
    @router.get("/policy/{agent_id}")
    async def get_policy(agent_id: str):
        policy = _get_agent_policy(agent_id)
        return JSONResponse({"agent_id": agent_id, "policy": policy})

    # ── Update agent policy ─────────────────────────────────────────────────
    @router.post("/policy/{agent_id}", dependencies=[Depends(require_write)])
    async def update_policy(agent_id: str, request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        policy = body.get("policy", {})
        _AGENT_POLICIES[agent_id] = {**_get_agent_policy(agent_id), **policy}
        _audit("policy_updated", agent_id, f"Updated: {list(policy.keys())}")
        emit("permission.policy.updated", {"agent_id": agent_id, "changed": list(policy.keys())})
        return JSONResponse({"ok": True, "agent_id": agent_id, "policy": _AGENT_POLICIES[agent_id]})

    # ── Check permission ────────────────────────────────────────────────────
    @router.post("/check")
    async def check_perm(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        agent_id = body.get("agent_id", "")
        capability = body.get("capability", "")
        result = check_permission(agent_id, capability)
        _audit("check", agent_id, f"{capability} → {'allowed' if result['allowed'] else 'denied'}")
        return JSONResponse({"agent_id": agent_id, "capability": capability, **result})

    # ── Request approval ────────────────────────────────────────────────────
    @router.post("/request-approval", dependencies=[Depends(require_write)])
    async def request_approval(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        req_entry = {
            "id": str(uuid.uuid4())[:8],
            "agent_id": body.get("agent_id", ""),
            "capability": body.get("capability", ""),
            "description": body.get("description", ""),
            "risk": _CAPABILITY_RISK.get(body.get("capability", ""), "moderate"),
            "status": "pending",
            "requested_at": _ts(),
            "decided_at": None,
            "decided_by": None,
        }
        _APPROVAL_QUEUE.insert(0, req_entry)
        if len(_APPROVAL_QUEUE) > 200:
            _APPROVAL_QUEUE.pop()
        _audit("approval_requested", req_entry["agent_id"],
               f"{req_entry['capability']}: {req_entry['description'][:60]}")
        emit("permission.approval.requested", {"id": req_entry["id"], "agent_id": req_entry["agent_id"],
                                                 "capability": req_entry["capability"]})
        return JSONResponse({"ok": True, "request": req_entry})

    # ── Approve / deny ──────────────────────────────────────────────────────
    @router.post("/approve/{request_id}", dependencies=[Depends(require_write)])
    async def approve_request(request_id: str, request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        entry = next((r for r in _APPROVAL_QUEUE if r["id"] == request_id), None)
        if not entry:
            return JSONResponse({"error": "Request not found"}, status_code=404)
        entry["status"] = "approved"
        entry["decided_at"] = _ts()
        entry["decided_by"] = body.get("by", "user")
        _audit("approved", entry["agent_id"], f"{entry['capability']} approved by {entry['decided_by']}")
        emit("permission.approved", {"id": request_id, "agent_id": entry["agent_id"]})
        return JSONResponse({"ok": True, "request": entry})

    @router.post("/deny/{request_id}", dependencies=[Depends(require_write)])
    async def deny_request(request_id: str, request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        entry = next((r for r in _APPROVAL_QUEUE if r["id"] == request_id), None)
        if not entry:
            return JSONResponse({"error": "Request not found"}, status_code=404)
        entry["status"] = "denied"
        entry["decided_at"] = _ts()
        entry["decided_by"] = body.get("by", "user")
        entry["reason"] = body.get("reason", "")
        _audit("denied", entry["agent_id"], f"{entry['capability']} denied: {body.get('reason', '')}")
        emit("permission.denied", {"id": request_id, "agent_id": entry["agent_id"]})
        return JSONResponse({"ok": True, "request": entry})

    # ── Approval queue ──────────────────────────────────────────────────────
    @router.get("/queue")
    async def get_queue(status: Optional[str] = None):
        q = _APPROVAL_QUEUE
        if status:
            q = [r for r in q if r["status"] == status]
        return JSONResponse({"queue": q[:50], "pending": sum(1 for r in _APPROVAL_QUEUE if r["status"] == "pending")})

    # ── Audit log ───────────────────────────────────────────────────────────
    @router.get("/audit")
    async def get_audit(limit: int = 50):
        return JSONResponse({"audit": _AUDIT_LOG[:limit], "count": len(_AUDIT_LOG)})

    return router


def _audit(action: str, agent_id: str, detail: str) -> None:
    entry = {"ts": _ts(), "action": action, "agent_id": agent_id, "detail": detail}
    _AUDIT_LOG.insert(0, entry)
    if len(_AUDIT_LOG) > 500:
        _AUDIT_LOG.pop()
