"""Hub v2 — Bridge to actual KiloCode CLI agents."""
import subprocess
import json
import asyncio
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from backend.webui.hub.auth import require_write
from backend.webui.hub.event_bus import emit

# Path to KiloCode CLI binary
KILO_BIN = "G:/Github/kilocode-Azure2/packages/opencode/dist/cli.exe"

def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/agents", tags=["agents"])
    
    async def _run_kilo_command(args: List[str]) -> Dict[str, Any]:
        """Run a KiloCode CLI command and return JSON response."""
        try:
            # Check if binary exists
            import os
            if not os.path.exists(KILO_BIN):
                return {"error": "KiloCode CLI not found", "path": KILO_BIN}
            
            # Run command
            proc = await asyncio.create_subprocess_exec(
                KILO_BIN, *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            
            if proc.returncode != 0:
                return {"error": f"CLI error: {stderr.decode()}"}
            
            try:
                return json.loads(stdout.decode())
            except json.JSONDecodeError:
                return {"error": "Invalid JSON from CLI", "raw": stdout.decode()}
                
        except Exception as e:
            return {"error": str(e)}
    
    @router.get("/kilo/status")
    async def kilocode_status():
        """Get actual KiloCode agent status from CLI."""
        result = await _run_kilo_command(["agent", "list", "--json"])
        if "error" in result:
            return JSONResponse({"error": result["error"]}, status_code=500)
        
        # Transform CLI response to Hub format
        agents = []
        if "agents" in result:
            for cli_agent in result["agents"]:
                agents.append({
                    "id": cli_agent.get("id", "unknown"),
                    "name": cli_agent.get("name", cli_agent.get("id", "Unknown")),
                    "status": cli_agent.get("status", "idle"),
                    "role": cli_agent.get("role", "Agent"),
                    "current_task": cli_agent.get("current_task"),
                    "model": cli_agent.get("model", "auto"),
                    "type": "kilo-cli"
                })
        
        return JSONResponse({
            "agents": agents,
            "total": len(agents),
            "source": "kilo-cli",
            "connected": True
        })
    
    @router.post("/kilo/{agent_id}/assign")
    async def assign_kilo_agent(agent_id: str, request: Request):
        """Assign task to actual KiloCode agent."""
        require_write(request)
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        task = body.get("task", "")
        if not task:
            return JSONResponse({"error": "Task required"}, status_code=400)
        
        # Run assignment command
        result = await _run_kilo_command([
            "agent", "assign", agent_id, "--task", task
        ])
        
        if "error" in result:
            return JSONResponse({"error": result["error"]}, status_code=500)
        
        emit("agent.assigned", {"agent_id": agent_id, "task": task, "source": "kilo-cli"})
        return JSONResponse({"ok": True, "agent_id": agent_id, "task": task})
    
    @router.post("/kilo/{agent_id}/release")
    async def release_kilo_agent(agent_id: str):
        """Release actual KiloCode agent."""
        require_write(request)
        
        result = await _run_kilo_command(["agent", "release", agent_id])
        
        if "error" in result:
            return JSONResponse({"error": result["error"]}, status_code=500)
        
        emit("agent.released", {"agent_id": agent_id, "source": "kilo-cli"})
        return JSONResponse({"ok": True, "agent_id": agent_id})
    
    @router.get("/kilo/sessions")
    async def kilocode_sessions():
        """Get KiloCode sessions."""
        result = await _run_kilo_command(["session", "list", "--json"])
        if "error" in result:
            return JSONResponse({"error": result["error"]}, status_code=500)
        return JSONResponse(result)
    
    return router
