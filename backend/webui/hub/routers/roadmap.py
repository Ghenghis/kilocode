"""Hub v2 router — Interactive Roadmap (/api/roadmap/*).

Phase 9 — Interactive Roadmap Panel:
  GET  /api/roadmap              — full roadmap with phases and tasks
  GET  /api/roadmap/phases/{id}  — single phase details
  POST /api/roadmap/tasks/{id}/toggle — toggle task completion
  POST /api/roadmap/tasks/{id}/assign — assign task to agent
"""
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from backend.webui.hub.auth import require_write
from backend.webui.hub.event_bus import emit

# Roadmap data structure matching the integration plan phases
_roadmap: Dict[str, Any] = {
    "version": "2.0",
    "updated_at": time.time(),
    "phases": [
        {
            "id": "phase-1",
            "number": 1,
            "name": "Provider Detection Engine",
            "status": "completed",
            "progress": 100,
            "tasks": [
                {"id": "p1-t1", "text": "GET /api/providers/detect endpoint", "done": True, "owner": "Runtime"},
                {"id": "p1-t2", "text": "GET/POST /api/providers/profiles CRUD", "done": True, "owner": "Runtime"},
                {"id": "p1-t3", "text": "Provider panel renders detection + tone badges", "done": True, "owner": "WebUI"},
                {"id": "p1-t4", "text": "KiloCode provider card reads Hub", "done": True, "owner": "Integrator"},
                {"id": "p1-t5", "text": "Open WebUI provider detection via MCP", "done": True, "owner": "Integrator"},
            ],
        },
        {
            "id": "phase-2",
            "number": 2,
            "name": "Control Center ViewModel",
            "status": "completed",
            "progress": 100,
            "tasks": [
                {"id": "p2-t1", "text": "GET /api/overview returns ViewModel", "done": True, "owner": "Runtime"},
                {"id": "p2-t2", "text": "Overview panel renders badges + cards", "done": True, "owner": "WebUI"},
                {"id": "p2-t3", "text": "KiloCode Hub panel shows compact status", "done": True, "owner": "Integrator"},
                {"id": "p2-t4", "text": "Port truncateMiddle(), getPathTail()", "done": True, "owner": "WebUI"},
            ],
        },
        {
            "id": "phase-3",
            "number": 3,
            "name": "Settings Validation & Sync UX",
            "status": "completed",
            "progress": 100,
            "tasks": [
                {"id": "p3-t1", "text": "POST /api/settings/validate endpoint", "done": True, "owner": "Runtime"},
                {"id": "p3-t2", "text": "POST /api/settings/autofill endpoint", "done": True, "owner": "Runtime"},
                {"id": "p3-t3", "text": "Settings panel: validation cards, auto-fix", "done": True, "owner": "WebUI"},
                {"id": "p3-t4", "text": "KiloCode reads/writes through Hub", "done": True, "owner": "Integrator"},
                {"id": "p3-t5", "text": "Open WebUI reads/writes through Hub MCP", "done": True, "owner": "Integrator"},
            ],
        },
        {
            "id": "phase-4",
            "number": 4,
            "name": "Task / Progress UX",
            "status": "completed",
            "progress": 100,
            "tasks": [
                {"id": "p4-t1", "text": "Pipeline progress: spinner → % → ✓/✗", "done": True, "owner": "WebUI"},
                {"id": "p4-t2", "text": "KOM session aggregate completion bar", "done": True, "owner": "WebUI"},
                {"id": "p4-t3", "text": "Cancel confirmation dialog", "done": True, "owner": "WebUI"},
                {"id": "p4-t4", "text": "Retry with backoff indicator", "done": True, "owner": "WebUI"},
                {"id": "p4-t5", "text": "Tasks visible in KiloCode via /events", "done": True, "owner": "Integrator"},
                {"id": "p4-t6", "text": "Tasks visible in Open WebUI via MCP", "done": True, "owner": "Integrator"},
            ],
        },
        {
            "id": "phase-5",
            "number": 5,
            "name": "Permission & Safety UX",
            "status": "completed",
            "progress": 100,
            "tasks": [
                {"id": "p5-t1", "text": "GET /api/permissions/pending + POST resolve", "done": True, "owner": "Runtime"},
                {"id": "p5-t2", "text": "Permission overlay: scope, risk, approve/deny", "done": True, "owner": "WebUI"},
                {"id": "p5-t3", "text": "Permission audit log", "done": True, "owner": "WebUI"},
                {"id": "p5-t4", "text": "Auto-approve rules for trusted agents", "done": True, "owner": "Runtime"},
                {"id": "p5-t5", "text": "KiloCode sees permission requests via SSE", "done": True, "owner": "Integrator"},
            ],
        },
        {
            "id": "phase-6",
            "number": 6,
            "name": "Repair Timeline",
            "status": "completed",
            "progress": 100,
            "tasks": [
                {"id": "p6-t1", "text": "Structured repair results with before/after", "done": True, "owner": "Runtime"},
                {"id": "p6-t2", "text": "Repair timeline visualization", "done": True, "owner": "WebUI"},
                {"id": "p6-t3", "text": "Selective repair + dry-run mode", "done": True, "owner": "WebUI + Runtime"},
                {"id": "p6-t4", "text": "Repair events emitted to SSE", "done": True, "owner": "Runtime"},
            ],
        },
        {
            "id": "phase-7",
            "number": 7,
            "name": "Diff / Tool-Result Rendering",
            "status": "completed",
            "progress": 100,
            "tasks": [
                {"id": "p7-t1", "text": "Diff rendering with syntax highlighting", "done": True, "owner": "WebUI"},
                {"id": "p7-t2", "text": "Tool-result cards (file reads, commands, search)", "done": True, "owner": "WebUI"},
                {"id": "p7-t3", "text": "Code block copy + language detection", "done": True, "owner": "WebUI"},
                {"id": "p7-t4", "text": "Collapsible long outputs (>20 lines)", "done": True, "owner": "WebUI"},
            ],
        },
        {
            "id": "phase-8",
            "number": 8,
            "name": "MCP Management UI",
            "status": "completed",
            "progress": 100,
            "tasks": [
                {"id": "p8-t1", "text": "GET /api/mcp/servers + POST tools/{id}/approve", "done": True, "owner": "Runtime"},
                {"id": "p8-t2", "text": "MCP server health panel", "done": True, "owner": "WebUI"},
                {"id": "p8-t3", "text": "MCP tool approval UI", "done": True, "owner": "WebUI"},
                {"id": "p8-t4", "text": "MCP logs viewer (stream)", "done": True, "owner": "WebUI"},
            ],
        },
        {
            "id": "phase-9",
            "number": 9,
            "name": "Interactive Roadmap Panel",
            "status": "in_progress",
            "progress": 80,
            "tasks": [
                {"id": "p9-t1", "text": "GET /api/roadmap + POST tasks/{id}/toggle", "done": True, "owner": "Runtime"},
                {"id": "p9-t2", "text": "Roadmap panel: phase cards, progress bars", "done": True, "owner": "WebUI"},
            ],
        },
        {
            "id": "phase-10",
            "number": 10,
            "name": "Playwright E2E Test Suite",
            "status": "in_progress",
            "progress": 30,
            "tasks": [
                {"id": "p10-t1", "text": "10A: Hub-only tests (31+ cases)", "done": False, "owner": "Auditor"},
                {"id": "p10-t2", "text": "10B: Cross-surface parity tests", "done": False, "owner": "Auditor"},
                {"id": "p10-t3", "text": "10C: Live deployment tests", "done": False, "owner": "Auditor"},
            ],
        },
        {
            "id": "phase-11",
            "number": 11,
            "name": "Cross-Surface Parity Matrix",
            "status": "not_started",
            "progress": 0,
            "tasks": [
                {"id": "p11-t1", "text": "Fill every cell in parity matrix", "done": False, "owner": "Auditor"},
                {"id": "p11-t2", "text": "Wire parity matrix into roadmap panel", "done": False, "owner": "WebUI"},
            ],
        },
        {
            "id": "phase-12",
            "number": 12,
            "name": "Shared Capability Backend",
            "status": "not_started",
            "progress": 0,
            "tasks": [
                {"id": "p12-t1", "text": "Capability registry: enumerate all capabilities", "done": False, "owner": "Runtime"},
                {"id": "p12-t2", "text": "Per-agent policy config (JSON/YAML)", "done": False, "owner": "Runtime"},
                {"id": "p12-t3", "text": "Policy enforcement middleware", "done": False, "owner": "Runtime"},
                {"id": "p12-t4", "text": "Audit log for capability invocations", "done": False, "owner": "Runtime"},
            ],
        },
        {
            "id": "phase-13",
            "number": 13,
            "name": "KiloCode ↔ Hub ↔ Open WebUI Live Binding",
            "status": "not_started",
            "progress": 0,
            "tasks": [
                {"id": "p13-t1", "text": "Prove HubPanel.ts opens live Hub", "done": False, "owner": "Integrator"},
                {"id": "p13-t2", "text": "Prove Open WebUI accesses Hub", "done": False, "owner": "Integrator"},
                {"id": "p13-t3", "text": "Prove same state visible from both", "done": False, "owner": "Integrator"},
                {"id": "p13-t4", "text": "Prove Hub actions update both surfaces", "done": False, "owner": "Integrator"},
            ],
        },
        {
            "id": "phase-14",
            "number": 14,
            "name": "21-Agent Default Enforcement",
            "status": "in_progress",
            "progress": 60,
            "tasks": [
                {"id": "p14-t1", "text": "Enforce kc-main as default Open WebUI agent", "done": True, "owner": "Integrator"},
                {"id": "p14-t2", "text": "Enforce MiniMax M2.7-highspeed as default", "done": True, "owner": "Integrator"},
                {"id": "p14-t3", "text": "Keep Hermes/ZeroClaw as alternate lanes", "done": True, "owner": "Integrator"},
                {"id": "p14-t4", "text": "Verify same agent names/colors/roles", "done": False, "owner": "Integrator"},
            ],
        },
        {
            "id": "phase-15",
            "number": 15,
            "name": "Canonical Settings Sync",
            "status": "completed",
            "progress": 100,
            "tasks": [
                {"id": "p15-t1", "text": "Hub/runtime canonical settings = only truth", "done": True, "owner": "Runtime"},
                {"id": "p15-t2", "text": "KiloCode reads/writes through Hub", "done": True, "owner": "Integrator"},
                {"id": "p15-t3", "text": "Open WebUI reads/writes through Hub", "done": True, "owner": "Integrator"},
                {"id": "p15-t4", "text": "Hermes/ZeroClaw autofill inferable values", "done": True, "owner": "Runtime"},
                {"id": "p15-t5", "text": "Every write stores audit fields", "done": True, "owner": "Runtime"},
            ],
        },
        {
            "id": "phase-16",
            "number": 16,
            "name": "Real-Time Event Bus Proof",
            "status": "in_progress",
            "progress": 50,
            "tasks": [
                {"id": "p16-t1", "text": "SSE /events endpoint live", "done": True, "owner": "Runtime"},
                {"id": "p16-t2", "text": "Explicit proof run for all events", "done": False, "owner": "Auditor"},
            ],
        },
        {
            "id": "phase-17",
            "number": 17,
            "name": "Release Blocking Proof Gate",
            "status": "not_started",
            "progress": 0,
            "tasks": [
                {"id": "p17-t1", "text": "Hub runtime starts cleanly on :8095", "done": False, "owner": "Project"},
                {"id": "p17-t2", "text": "/events, /mcp, /panels/manifest.json respond", "done": False, "owner": "Project"},
                {"id": "p17-t3", "text": "Open WebUI pipeline exposes 21 agents", "done": False, "owner": "Project"},
                {"id": "p17-t4", "text": "KiloCode Hub panel opens and stays live", "done": False, "owner": "Project"},
                {"id": "p17-t5", "text": "Cross-surface parity test passes", "done": False, "owner": "Project"},
                {"id": "p17-t6", "text": "Protected write route fails without token", "done": False, "owner": "Project"},
                {"id": "p17-t7", "text": "Disruptive route fails without maintenance window", "done": False, "owner": "Project"},
                {"id": "p17-t8", "text": "Staging → promote → rollback path works", "done": False, "owner": "Project"},
                {"id": "p17-t9", "text": "All Playwright suites pass", "done": False, "owner": "Project"},
            ],
        },
    ],
}


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/roadmap", tags=["roadmap"])

    @router.get("/")
    async def get_roadmap():
        """Get full roadmap with phases and tasks."""
        total_tasks = sum(len(p["tasks"]) for p in _roadmap["phases"])
        completed_tasks = sum(
            sum(1 for t in p["tasks"] if t["done"])
            for p in _roadmap["phases"]
        )
        
        return JSONResponse({
            "roadmap": _roadmap,
            "summary": {
                "total_phases": len(_roadmap["phases"]),
                "completed_phases": sum(1 for p in _roadmap["phases"] if p["status"] == "completed"),
                "total_tasks": total_tasks,
                "completed_tasks": completed_tasks,
                "overall_progress": round(completed_tasks / total_tasks * 100, 1) if total_tasks else 0,
            },
            "ts": time.time(),
        })

    @router.get("/phases/{phase_id}")
    async def get_phase(phase_id: str):
        """Get single phase details."""
        phase = next((p for p in _roadmap["phases"] if p["id"] == phase_id), None)
        if not phase:
            return JSONResponse({"error": "Phase not found"}, status_code=404)
        return JSONResponse({"phase": phase, "ts": time.time()})

    @router.post("/tasks/{task_id}/toggle", dependencies=[Depends(require_write)])
    async def toggle_task(task_id: str, request: Request):
        """Toggle task completion status."""
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        toggled_by = body.get("by", "unknown")
        
        for phase in _roadmap["phases"]:
            for task in phase["tasks"]:
                if task["id"] == task_id:
                    task["done"] = not task.get("done", False)
                    task["toggled_at"] = time.time()
                    task["toggled_by"] = toggled_by
                    
                    # Recalculate phase progress
                    done_count = sum(1 for t in phase["tasks"] if t["done"])
                    phase["progress"] = round(done_count / len(phase["tasks"]) * 100)
                    
                    # Update phase status based on progress
                    if phase["progress"] == 100:
                        phase["status"] = "completed"
                    elif phase["progress"] > 0:
                        phase["status"] = "in_progress"
                    else:
                        phase["status"] = "not_started"
                    
                    _roadmap["updated_at"] = time.time()
                    
                    emit("roadmap.task.toggled", {
                        "task_id": task_id,
                        "done": task["done"],
                        "phase_id": phase["id"],
                        "by": toggled_by,
                    })
                    
                    return JSONResponse({
                        "ok": True,
                        "task_id": task_id,
                        "done": task["done"],
                        "phase_progress": phase["progress"],
                    })
        
        return JSONResponse({"error": "Task not found"}, status_code=404)

    @router.post("/tasks/{task_id}/assign", dependencies=[Depends(require_write)])
    async def assign_task(task_id: str, request: Request):
        """Assign task to an owner."""
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        new_owner = body.get("owner", "unknown")
        
        for phase in _roadmap["phases"]:
            for task in phase["tasks"]:
                if task["id"] == task_id:
                    old_owner = task.get("owner", "unassigned")
                    task["owner"] = new_owner
                    task["assigned_at"] = time.time()
                    _roadmap["updated_at"] = time.time()
                    
                    emit("roadmap.task.assigned", {
                        "task_id": task_id,
                        "owner": new_owner,
                        "old_owner": old_owner,
                    })
                    
                    return JSONResponse({
                        "ok": True,
                        "task_id": task_id,
                        "owner": new_owner,
                        "old_owner": old_owner,
                    })
        
        return JSONResponse({"error": "Task not found"}, status_code=404)

    @router.get("/summary")
    async def get_summary():
        """Get roadmap summary for dashboard display."""
        total_tasks = sum(len(p["tasks"]) for p in _roadmap["phases"])
        completed_tasks = sum(
            sum(1 for t in p["tasks"] if t["done"])
            for p in _roadmap["phases"]
        )
        
        phases_summary = [
            {
                "id": p["id"],
                "number": p["number"],
                "name": p["name"],
                "status": p["status"],
                "progress": p["progress"],
            }
            for p in _roadmap["phases"]
        ]
        
        return JSONResponse({
            "overall_progress": round(completed_tasks / total_tasks * 100, 1) if total_tasks else 0,
            "completed_phases": sum(1 for p in _roadmap["phases"] if p["status"] == "completed"),
            "in_progress_phases": sum(1 for p in _roadmap["phases"] if p["status"] == "in_progress"),
            "total_phases": len(_roadmap["phases"]),
            "completed_tasks": completed_tasks,
            "total_tasks": total_tasks,
            "phases": phases_summary,
            "ts": time.time(),
        })

    return router
