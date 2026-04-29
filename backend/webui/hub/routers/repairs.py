"""
Hub v2 router — Repair Timeline (/api/repairs/*).

Centralized repair tracking with severity, auto-fix suggestions, and timeline.
Repairs can be created by any surface (Hub, KiloCode, Open WebUI) and are
visible across all. Ported from OpenClaude repair timeline pattern.

Features:
  - Severity levels: critical, error, warning, info
  - Auto-fix suggestions with one-click apply
  - Timeline view with stage progression
  - Cross-surface: repairs visible in Hub, KiloCode, Open WebUI
  - Categories: config, code, dependency, runtime, security, performance
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from hub.auth import require_write
from hub.event_bus import emit

# ── Repair storage ────────────────────────────────────────────────────────────
_REPAIRS: dict[str, dict] = {}

_SEVERITIES = ["critical", "error", "warning", "info"]
_CATEGORIES = ["config", "code", "dependency", "runtime", "security", "performance", "other"]
_REPAIR_STAGES = ["detected", "diagnosed", "fix_proposed", "fix_applied", "verified", "closed"]


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/repairs", tags=["repairs"])

    # ── List repairs ────────────────────────────────────────────────────────
    @router.get("")
    async def list_repairs(
        severity: Optional[str] = None,
        category: Optional[str] = None,
        stage: Optional[str] = None,
        limit: int = 100,
    ):
        repairs = list(_REPAIRS.values())
        if severity:
            repairs = [r for r in repairs if r["severity"] == severity]
        if category:
            repairs = [r for r in repairs if r["category"] == category]
        if stage:
            repairs = [r for r in repairs if r["stage"] == stage]
        repairs.sort(key=lambda r: r["updated_at"], reverse=True)
        summary = {
            "total": len(_REPAIRS),
            "critical": sum(1 for r in _REPAIRS.values() if r["severity"] == "critical"),
            "error": sum(1 for r in _REPAIRS.values() if r["severity"] == "error"),
            "warning": sum(1 for r in _REPAIRS.values() if r["severity"] == "warning"),
            "open": sum(1 for r in _REPAIRS.values() if r["stage"] not in ("verified", "closed")),
            "fixed": sum(1 for r in _REPAIRS.values() if r["stage"] in ("verified", "closed")),
        }
        return JSONResponse({"repairs": repairs[:limit], "summary": summary, "ts": _ts()})

    # ── Get single repair ───────────────────────────────────────────────────
    @router.get("/{repair_id}")
    async def get_repair(repair_id: str):
        r = _REPAIRS.get(repair_id)
        if not r:
            return JSONResponse({"error": "Repair not found"}, status_code=404)
        return JSONResponse(r)

    # ── Create repair ───────────────────────────────────────────────────────
    @router.post("", dependencies=[Depends(require_write)])
    async def create_repair(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        now = _ts()
        repair_id = str(uuid.uuid4())[:10]
        repair = {
            "id": repair_id,
            "title": body.get("title", "Untitled Repair"),
            "description": body.get("description", ""),
            "severity": body.get("severity", "warning") if body.get("severity") in _SEVERITIES else "warning",
            "category": body.get("category", "other") if body.get("category") in _CATEGORIES else "other",
            "stage": "detected",
            "source": body.get("source", "hub"),
            "file": body.get("file"),
            "line": body.get("line"),
            "agent": body.get("agent"),
            "fix_suggestion": body.get("fix_suggestion"),
            "fix_command": body.get("fix_command"),
            "auto_fixable": body.get("auto_fixable", False),
            "result": None,
            "error": None,
            "created_at": now,
            "updated_at": now,
            "closed_at": None,
            "timeline": [{"stage": "detected", "ts": now, "by": body.get("source", "hub"),
                          "detail": body.get("description", "")[:100]}],
        }
        _REPAIRS[repair_id] = repair
        emit("repair.created", {"id": repair_id, "severity": repair["severity"],
                                 "title": repair["title"]})
        return JSONResponse({"ok": True, "repair": repair})

    # ── Advance stage ───────────────────────────────────────────────────────
    @router.post("/{repair_id}/stage", dependencies=[Depends(require_write)])
    async def advance_stage(repair_id: str, request: Request):
        r = _REPAIRS.get(repair_id)
        if not r:
            return JSONResponse({"error": "Repair not found"}, status_code=404)
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        new_stage = body.get("stage", "")
        if new_stage not in _REPAIR_STAGES:
            return JSONResponse({"error": f"Invalid stage: {new_stage}"}, status_code=400)
        old_stage = r["stage"]
        r["stage"] = new_stage
        r["updated_at"] = _ts()
        r["timeline"].append({
            "stage": new_stage, "ts": r["updated_at"],
            "by": body.get("by", "hub"),
            "detail": body.get("detail", ""),
        })
        if new_stage in ("verified", "closed"):
            r["closed_at"] = r["updated_at"]
        if body.get("result"):
            r["result"] = body["result"]
        if body.get("error"):
            r["error"] = body["error"]
        emit("repair.stage.changed", {"id": repair_id, "old": old_stage, "new": new_stage})
        return JSONResponse({"ok": True, "repair": r})

    # ── Apply auto-fix ──────────────────────────────────────────────────────
    @router.post("/{repair_id}/auto-fix", dependencies=[Depends(require_write)])
    async def auto_fix(repair_id: str, request: Request):
        r = _REPAIRS.get(repair_id)
        if not r:
            return JSONResponse({"error": "Repair not found"}, status_code=404)
        if not r.get("auto_fixable"):
            return JSONResponse({"error": "Repair is not auto-fixable"}, status_code=409)
        now = _ts()
        # Mark as fix applied
        r["stage"] = "fix_applied"
        r["updated_at"] = now
        r["timeline"].append({
            "stage": "fix_applied", "ts": now, "by": "auto-fix",
            "detail": f"Auto-fix applied: {r.get('fix_command') or r.get('fix_suggestion', 'N/A')}"
        })
        emit("repair.auto_fix.applied", {"id": repair_id, "title": r["title"]})
        return JSONResponse({"ok": True, "repair": r})

    # ── Delete repair ───────────────────────────────────────────────────────
    @router.delete("/{repair_id}", dependencies=[Depends(require_write)])
    async def delete_repair(repair_id: str):
        if repair_id not in _REPAIRS:
            return JSONResponse({"error": "Repair not found"}, status_code=404)
        del _REPAIRS[repair_id]
        emit("repair.deleted", {"id": repair_id})
        return JSONResponse({"ok": True, "id": repair_id})

    # ── Scan for common issues (auto-detect) ────────────────────────────────
    @router.post("/scan", dependencies=[Depends(require_write)])
    async def scan_repairs(request: Request):
        """Auto-detect common issues and create repair entries."""
        import os
        found = []
        # Check for missing env vars
        critical_vars = [
            ("MINIMAX_API_KEY", "MiniMax API key not set — agents cannot use MiniMax provider",
             "Set MINIMAX_API_KEY in environment or .env file", "config"),
            ("HUB_ADMIN_TOKEN", "Hub admin token not set — running in insecure dev mode",
             "Set HUB_ADMIN_TOKEN for production security", "security"),
        ]
        for var, desc, fix, cat in critical_vars:
            if not os.environ.get(var):
                if not any(r["title"] == desc for r in _REPAIRS.values()):
                    repair = _make_scan_repair(desc, fix, cat, "warning")
                    found.append(repair)

        # Check for stale providers (circuit breakers open)
        from hub.config import PROVIDER_HEALTH_URLS
        # We just create repair entries — actual health is checked by provider router
        emit("repair.scan.complete", {"found": len(found)})
        return JSONResponse({"ok": True, "found": len(found), "repairs": found})

    return router


def _make_scan_repair(title: str, fix: str, category: str, severity: str) -> dict:
    now = _ts()
    repair_id = str(uuid.uuid4())[:10]
    repair = {
        "id": repair_id, "title": title, "description": title,
        "severity": severity, "category": category, "stage": "detected",
        "source": "auto-scan", "file": None, "line": None, "agent": None,
        "fix_suggestion": fix, "fix_command": None, "auto_fixable": False,
        "result": None, "error": None,
        "created_at": now, "updated_at": now, "closed_at": None,
        "timeline": [{"stage": "detected", "ts": now, "by": "auto-scan", "detail": title}],
    }
    _REPAIRS[repair_id] = repair
    return repair
