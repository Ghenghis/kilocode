"""Hub v2 router — MCP server management (/api/mcp/*).

Phase 8 — MCP Management UI:
  GET  /api/mcp/servers              — list MCP servers with health
  POST /api/mcp/servers/{id}/enable  — enable/disable server
  GET  /api/mcp/tools                — list available tools
  POST /api/mcp/tools/{id}/approve    — approve a tool for use
  POST /api/mcp/tools/{id}/deny      — deny a tool
  GET  /api/mcp/logs                 — stream MCP operation logs
"""
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from backend.webui.hub.auth import require_write
from backend.webui.hub.event_bus import emit

# In-memory MCP state (would be backed by DB in production)
_mcp_servers: Dict[str, Dict[str, Any]] = {
    "filesystem": {
        "id": "filesystem",
        "name": "File System",
        "enabled": True,
        "status": "healthy",
        "tools": ["read_file", "write_file", "list_directory", "search_files"],
        "last_check": time.time(),
    },
    "git": {
        "id": "git",
        "name": "Git Operations",
        "enabled": True,
        "status": "healthy", 
        "tools": ["git_status", "git_diff", "git_commit", "git_push"],
        "last_check": time.time(),
    },
    "github": {
        "id": "github",
        "name": "GitHub API",
        "enabled": False,
        "status": "disabled",
        "tools": ["create_pr", "merge_pr", "list_issues", "create_issue"],
        "last_check": None,
    },
    "web_search": {
        "id": "web_search",
        "name": "Web Search",
        "enabled": True,
        "status": "healthy",
        "tools": ["search", "fetch_url"],
        "last_check": time.time(),
    },
}

_mcp_tools: Dict[str, Dict[str, Any]] = {}
_mcp_logs: List[Dict[str, Any]] = []
_tool_approvals: Dict[str, str] = {}  # tool_id -> "approved" | "denied" | "pending"


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _add_log(level: str, message: str, metadata: Optional[Dict] = None):
    """Add an entry to the MCP operation log."""
    entry = {
        "id": str(uuid.uuid4())[:8],
        "ts": time.time(),
        "iso_ts": _ts(),
        "level": level,
        "message": message,
        "metadata": metadata or {},
    }
    _mcp_logs.insert(0, entry)
    # Keep only last 1000 logs
    if len(_mcp_logs) > 1000:
        _mcp_logs.pop()
    emit("mcp.log", entry)


# Initialize tool registry from servers
def _init_tools():
    global _mcp_tools
    for server_id, server in _mcp_servers.items():
        for tool_name in server.get("tools", []):
            tool_id = f"{server_id}:{tool_name}"
            if tool_id not in _mcp_tools:
                _mcp_tools[tool_id] = {
                    "id": tool_id,
                    "name": tool_name,
                    "server": server_id,
                    "description": f"{tool_name} from {server['name']}",
                    "approval": _tool_approvals.get(tool_id, "pending"),
                    "usage_count": 0,
                    "last_used": None,
                }


_init_tools()


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/mcp", tags=["mcp"])

    # ── Server Management ─────────────────────────────────────────────────────
    
    @router.get("/servers")
    async def list_servers():
        """List all MCP servers with their health status."""
        servers = []
        for sid, s in _mcp_servers.items():
            servers.append({
                "id": s["id"],
                "name": s["name"],
                "enabled": s["enabled"],
                "status": s["status"],
                "tool_count": len(s.get("tools", [])),
                "last_check": s.get("last_check"),
                "last_check_rel": _reltime(s.get("last_check")),
            })
        return JSONResponse({
            "servers": servers,
            "healthy": sum(1 for s in servers if s["status"] == "healthy"),
            "total": len(servers),
            "ts": time.time(),
        })

    @router.post("/servers/{server_id}/enable", dependencies=[Depends(require_write)])
    async def enable_server(server_id: str):
        """Enable an MCP server."""
        if server_id not in _mcp_servers:
            return JSONResponse({"error": "Server not found"}, status_code=404)
        
        _mcp_servers[server_id]["enabled"] = True
        _mcp_servers[server_id]["status"] = "healthy"
        _mcp_servers[server_id]["last_check"] = time.time()
        
        _add_log("info", f"MCP server {server_id} enabled", {"server_id": server_id})
        emit("mcp.server.enabled", {"server_id": server_id})
        
        return JSONResponse({
            "ok": True,
            "server_id": server_id,
            "enabled": True,
        })

    @router.post("/servers/{server_id}/disable", dependencies=[Depends(require_write)])
    async def disable_server(server_id: str):
        """Disable an MCP server."""
        if server_id not in _mcp_servers:
            return JSONResponse({"error": "Server not found"}, status_code=404)
        
        _mcp_servers[server_id]["enabled"] = False
        _mcp_servers[server_id]["status"] = "disabled"
        
        _add_log("info", f"MCP server {server_id} disabled", {"server_id": server_id})
        emit("mcp.server.disabled", {"server_id": server_id})
        
        return JSONResponse({
            "ok": True,
            "server_id": server_id,
            "enabled": False,
        })

    @router.get("/servers/{server_id}/health")
    async def server_health(server_id: str):
        """Get detailed health info for a specific server."""
        if server_id not in _mcp_servers:
            return JSONResponse({"error": "Server not found"}, status_code=404)
        
        s = _mcp_servers[server_id]
        return JSONResponse({
            "id": s["id"],
            "name": s["name"],
            "enabled": s["enabled"],
            "status": s["status"],
            "tools": s.get("tools", []),
            "last_check": s.get("last_check"),
        })

    # ── Tool Management ───────────────────────────────────────────────────────
    
    @router.get("/tools")
    async def list_tools(server: Optional[str] = None):
        """List MCP tools, optionally filtered by server."""
        tools = []
        for tid, t in _mcp_tools.items():
            if server and t["server"] != server:
                continue
            tools.append({
                "id": t["id"],
                "name": t["name"],
                "server": t["server"],
                "description": t["description"],
                "approval": t["approval"],
                "usage_count": t["usage_count"],
                "last_used": t["last_used"],
            })
        
        # Approval summary
        approved = sum(1 for t in tools if t["approval"] == "approved")
        pending = sum(1 for t in tools if t["approval"] == "pending")
        denied = sum(1 for t in tools if t["approval"] == "denied")
        
        return JSONResponse({
            "tools": tools,
            "summary": {"approved": approved, "pending": pending, "denied": denied, "total": len(tools)},
            "ts": time.time(),
        })

    @router.post("/tools/{tool_id}/approve", dependencies=[Depends(require_write)])
    async def approve_tool(tool_id: str, request: Request):
        """Approve an MCP tool for use."""
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        if tool_id not in _mcp_tools:
            return JSONResponse({"error": "Tool not found"}, status_code=404)
        
        approved_by = body.get("approved_by", "unknown")
        reason = body.get("reason", "")
        
        _mcp_tools[tool_id]["approval"] = "approved"
        _tool_approvals[tool_id] = "approved"
        
        _add_log("info", f"MCP tool {tool_id} approved by {approved_by}", {
            "tool_id": tool_id,
            "approved_by": approved_by,
            "reason": reason,
        })
        emit("mcp.tool.approved", {"tool_id": tool_id, "approved_by": approved_by})
        
        return JSONResponse({
            "ok": True,
            "tool_id": tool_id,
            "approval": "approved",
            "approved_by": approved_by,
        })

    @router.post("/tools/{tool_id}/deny", dependencies=[Depends(require_write)])
    async def deny_tool(tool_id: str, request: Request):
        """Deny an MCP tool."""
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        if tool_id not in _mcp_tools:
            return JSONResponse({"error": "Tool not found"}, status_code=404)
        
        denied_by = body.get("denied_by", "unknown")
        reason = body.get("reason", "")
        
        _mcp_tools[tool_id]["approval"] = "denied"
        _tool_approvals[tool_id] = "denied"
        
        _add_log("warning", f"MCP tool {tool_id} denied by {denied_by}", {
            "tool_id": tool_id,
            "denied_by": denied_by,
            "reason": reason,
        })
        emit("mcp.tool.denied", {"tool_id": tool_id, "denied_by": denied_by})
        
        return JSONResponse({
            "ok": True,
            "tool_id": tool_id,
            "approval": "denied",
            "denied_by": denied_by,
        })

    # ── Logs ───────────────────────────────────────────────────────────────────
    
    @router.get("/logs")
    async def get_logs(limit: int = 100, level: Optional[str] = None):
        """Get MCP operation logs."""
        logs = _mcp_logs[:limit]
        if level:
            logs = [l for l in logs if l["level"] == level]
        return JSONResponse({
            "logs": logs,
            "total": len(_mcp_logs),
            "returned": len(logs),
        })

    @router.post("/invoke/{tool_id}")
    async def invoke_tool(tool_id: str, request: Request):
        """Invoke an MCP tool (records usage)."""
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        if tool_id not in _mcp_tools:
            return JSONResponse({"error": "Tool not found"}, status_code=404)
        
        tool = _mcp_tools[tool_id]
        
        # Check approval
        if tool["approval"] != "approved":
            return JSONResponse({
                "error": f"Tool {tool_id} not approved (status: {tool['approval']})",
                "requires_approval": True,
            }, status_code=403)
        
        # Update usage stats
        tool["usage_count"] += 1
        tool["last_used"] = time.time()
        
        _add_log("info", f"MCP tool {tool_id} invoked", {
            "tool_id": tool_id,
            "args": body.get("args", {}),
        })
        
        # In real implementation, this would call the actual MCP tool
        return JSONResponse({
            "ok": True,
            "tool_id": tool_id,
            "result": {"status": "success", "data": "MCP tool result would go here"},
        })

    return router


def _reltime(ts: Optional[float]) -> str:
    """Convert timestamp to relative time string."""
    if not ts:
        return "never"
    delta = time.time() - ts
    if delta < 60:
        return f"{int(delta)}s ago"
    if delta < 3600:
        return f"{int(delta/60)}m ago"
    if delta < 86400:
        return f"{int(delta/3600)}h ago"
    return f"{int(delta/86400)}d ago"
