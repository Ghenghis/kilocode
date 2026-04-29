"""Hub v2 router — Shared Capability Backend for 21 Agents (/api/capabilities/*).

Phase 12 — Shared Capability Backend:
  GET  /api/capabilities              — list all capabilities
  GET  /api/capabilities/{agent_id}   — capabilities for specific agent
  POST /api/capabilities/invoke       — invoke a capability with policy check
  GET  /api/capabilities/audit        — audit log of all invocations
"""
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from backend.webui.hub.auth import require_write
from backend.webui.hub.event_bus import emit

# Load agent policies from config
_CONFIG_PATH = Path(__file__).parent.parent.parent.parent.parent / "config" / "agent_policies.json"
_agent_policies: Dict[str, Dict[str, Any]] = {}

# Capability registry
_capabilities: Dict[str, Dict[str, Any]] = {
    "ssh": {
        "id": "ssh",
        "name": "SSH Connection",
        "description": "Establish SSH connection to remote hosts",
        "scope": ["read", "write"],
        "risk_level": "high",
        "requires_approval": True,
    },
    "scp": {
        "id": "scp",
        "name": "SCP/SFTP Transfer",
        "description": "Transfer files via SCP or SFTP",
        "scope": ["read", "write"],
        "risk_level": "medium",
        "requires_approval": True,
    },
    "exec": {
        "id": "exec",
        "name": "Shell Execution",
        "description": "Execute shell commands",
        "scope": ["write"],
        "risk_level": "high",
        "requires_approval": True,
    },
    "file_read": {
        "id": "file_read",
        "name": "File Read",
        "description": "Read file contents",
        "scope": ["read"],
        "risk_level": "low",
        "requires_approval": False,
    },
    "file_write": {
        "id": "file_write",
        "name": "File Write",
        "description": "Write/modify files",
        "scope": ["write"],
        "risk_level": "medium",
        "requires_approval": True,
    },
    "git": {
        "id": "git",
        "name": "Git Operations",
        "description": "Git clone, pull, commit, push",
        "scope": ["read", "write"],
        "risk_level": "medium",
        "requires_approval": True,
    },
    "docker": {
        "id": "docker",
        "name": "Docker Control",
        "description": "Docker build, run, compose",
        "scope": ["write"],
        "risk_level": "high",
        "requires_approval": True,
    },
    "http": {
        "id": "http",
        "name": "HTTP Request",
        "description": "Make HTTP/HTTPS requests",
        "scope": ["read"],
        "risk_level": "low",
        "requires_approval": False,
    },
    "mcp": {
        "id": "mcp",
        "name": "MCP Tool",
        "description": "Invoke MCP tools",
        "scope": ["read", "write"],
        "risk_level": "medium",
        "requires_approval": True,
    },
    "settings_read": {
        "id": "settings_read",
        "name": "Settings Read",
        "description": "Read canonical settings",
        "scope": ["read"],
        "risk_level": "low",
        "requires_approval": False,
    },
    "settings_write": {
        "id": "settings_write",
        "name": "Settings Write",
        "description": "Write canonical settings",
        "scope": ["write"],
        "risk_level": "high",
        "requires_approval": True,
    },
    "validate": {
        "id": "validate",
        "name": "Validate Configuration",
        "description": "Validate settings/repairs",
        "scope": ["read"],
        "risk_level": "low",
        "requires_approval": False,
    },
    "repair": {
        "id": "repair",
        "name": "Repair Operation",
        "description": "Execute repair actions",
        "scope": ["write"],
        "risk_level": "high",
        "requires_approval": True,
    },
    "promote": {
        "id": "promote",
        "name": "Promote Deployment",
        "description": "Promote to production",
        "scope": ["write"],
        "risk_level": "critical",
        "requires_approval": True,
    },
    "rollback": {
        "id": "rollback",
        "name": "Rollback Deployment",
        "description": "Rollback deployment",
        "scope": ["write"],
        "risk_level": "critical",
        "requires_approval": True,
    },
}

# Audit log
_audit_log: List[Dict[str, Any]] = []


def _load_policies():
    """Load agent policies from config file."""
    global _agent_policies
    if _CONFIG_PATH.exists():
        try:
            with open(_CONFIG_PATH, 'r') as f:
                _agent_policies = json.load(f).get("agents", {})
        except Exception:
            _agent_policies = _default_policies()
    else:
        _agent_policies = _default_policies()


def _default_policies() -> Dict[str, Dict[str, Any]]:
    """Default policies for all 21 agents."""
    return {
        "kc-main": {
            "capabilities": ["*"],  # All capabilities
            "description": "Orchestrator - can delegate and use all read capabilities",
            "auto_approve_safe": True,
        },
        "kc-01": {"capabilities": ["http", "file_read", "validate"], "description": "Integration Lead"},
        "kc-02": {"capabilities": ["http", "file_read", "file_write"], "description": "Creative Brainstormer"},
        "kc-03": {"capabilities": ["file_read", "validate", "http"], "description": "System Architect"},
        "kc-04": {"capabilities": ["file_read", "http", "validate"], "description": "Bug Triage Specialist"},
        "kc-05": {"capabilities": ["file_read", "http", "exec"], "description": "Root Cause Analyst"},
        "kc-06": {"capabilities": ["file_read", "file_write", "git"], "description": "Code Generator - file write, test, git — NOT live deploy"},
        "kc-07": {"capabilities": ["file_read", "validate"], "description": "Code Reviewer"},
        "kc-08": {"capabilities": ["file_read", "file_write", "exec"], "description": "Test Writer"},
        "kc-09": {"capabilities": ["file_read", "exec", "http"], "description": "Debugger"},
        "kc-10": {"capabilities": ["file_read", "file_write", "git"], "description": "Refactorer"},
        "kc-11": {"capabilities": ["file_read", "file_write", "git"], "description": "Documenter"},
        "kc-12": {"capabilities": ["file_read", "validate", "http"], "description": "Security Auditor - inspect, audit, limited write"},
        "kc-13": {"capabilities": ["file_read", "exec", "http"], "description": "Performance Analyst"},
        "kc-14": {"capabilities": ["http", "file_read", "file_write"], "description": "API Integrator"},
        "kc-15": {"capabilities": ["file_read", "exec", "http"], "description": "Database Specialist"},
        "kc-16": {"capabilities": ["ssh", "scp", "exec", "docker"], "description": "DevOps Engineer - deploy, restart, logs, Docker, SSH"},
        "kc-17": {"capabilities": ["file_read", "file_write", "http"], "description": "Frontend Specialist"},
        "kc-18": {"capabilities": ["file_read", "file_write", "exec"], "description": "Backend Specialist"},
        "kc-19": {"capabilities": ["http", "file_read"], "description": "Research Analyst - search, retrieval, read-only"},
        "kc-20": {"capabilities": ["file_read", "file_write", "http"], "description": "Prompt Engineer"},
    }


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _check_policy(agent_id: str, capability_id: str) -> bool:
    """Check if agent is allowed to use capability."""
    policy = _agent_policies.get(agent_id, {})
    allowed = policy.get("capabilities", [])
    return "*" in allowed or capability_id in allowed


def _add_audit(agent_id: str, capability_id: str, action: str, result: str, metadata: Dict = None):
    """Add entry to audit log."""
    entry = {
        "id": str(uuid.uuid4())[:8],
        "ts": time.time(),
        "iso_ts": _ts(),
        "agent_id": agent_id,
        "capability_id": capability_id,
        "action": action,
        "result": result,
        "metadata": metadata or {},
    }
    _audit_log.insert(0, entry)
    if len(_audit_log) > 1000:
        _audit_log.pop()
    emit("capability.invoked", entry)


_load_policies()


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/capabilities", tags=["capabilities"])

    @router.get("/")
    async def list_capabilities():
        """List all available capabilities."""
        caps = []
        for cid, c in _capabilities.items():
            caps.append({
                "id": c["id"],
                "name": c["name"],
                "description": c["description"],
                "scope": c["scope"],
                "risk_level": c["risk_level"],
                "requires_approval": c["requires_approval"],
            })
        return JSONResponse({
            "capabilities": caps,
            "total": len(caps),
            "ts": time.time(),
        })

    @router.get("/{agent_id}")
    async def agent_capabilities(agent_id: str):
        """Get capabilities available to a specific agent."""
        if agent_id not in _agent_policies:
            return JSONResponse({"error": "Agent not found"}, status_code=404)
        
        policy = _agent_policies[agent_id]
        allowed = policy.get("capabilities", [])
        
        caps = []
        for cid, c in _capabilities.items():
            if "*" in allowed or cid in allowed:
                caps.append({
                    "id": c["id"],
                    "name": c["name"],
                    "description": c["description"],
                    "risk_level": c["risk_level"],
                    "requires_approval": c["requires_approval"],
                })
        
        return JSONResponse({
            "agent_id": agent_id,
            "description": policy.get("description", ""),
            "capabilities": caps,
            "count": len(caps),
            "ts": time.time(),
        })

    @router.post("/invoke")
    async def invoke_capability(request: Request):
        """Invoke a capability with policy enforcement."""
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        agent_id = body.get("agent_id", "unknown")
        capability_id = body.get("capability_id", "")
        params = body.get("params", {})
        
        # Validate capability exists
        if capability_id not in _capabilities:
            _add_audit(agent_id, capability_id, "invoke", "denied", {"reason": "unknown_capability"})
            return JSONResponse({"error": "Capability not found"}, status_code=404)
        
        cap = _capabilities[capability_id]
        
        # Check policy
        if not _check_policy(agent_id, capability_id):
            _add_audit(agent_id, capability_id, "invoke", "denied", {"reason": "policy_violation"})
            return JSONResponse({
                "error": f"Agent {agent_id} not authorized for capability {capability_id}",
                "policy_violation": True,
            }, status_code=403)
        
        # Check approval requirement
        if cap.get("requires_approval"):
            # In production, check approval store
            _add_audit(agent_id, capability_id, "invoke", "pending_approval", params)
            return JSONResponse({
                "ok": False,
                "requires_approval": True,
                "message": f"Capability {capability_id} requires approval before execution",
            })
        
        # Simulate execution
        _add_audit(agent_id, capability_id, "invoke", "success", params)
        
        return JSONResponse({
            "ok": True,
            "capability_id": capability_id,
            "agent_id": agent_id,
            "result": {"status": "executed", "simulated": True},
        })

    @router.get("/audit")
    async def get_audit(limit: int = 100, agent_id: Optional[str] = None):
        """Get audit log of capability invocations."""
        logs = _audit_log[:limit]
        if agent_id:
            logs = [l for l in logs if l["agent_id"] == agent_id]
        return JSONResponse({
            "logs": logs,
            "total": len(_audit_log),
            "returned": len(logs),
        })

    @router.get("/agents")
    async def list_agents():
        """List all agents with their policies."""
        agents = []
        for aid, policy in _agent_policies.items():
            caps = policy.get("capabilities", [])
            agents.append({
                "id": aid,
                "description": policy.get("description", ""),
                "capabilities_count": len(caps) if caps != ["*"] else len(_capabilities),
                "is_admin": "*" in caps,
            })
        return JSONResponse({
            "agents": agents,
            "total": len(agents),
        })

    return router
