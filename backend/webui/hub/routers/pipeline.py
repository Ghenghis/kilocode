"""Hub v2 router — pipeline status and events (/api/pipeline/*)."""
import uuid
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from backend.webui.hub.auth import require_write
from backend.webui.hub.config import SETTINGS_URL
from backend.webui.hub._http import _req

_PIPELINE_EVENTS: list = []


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])

    @router.get("/status")
    async def pipeline_status():
        hermes_r, zc_r = await asyncio.gather(
            _req("GET", SETTINGS_URL + "/health"),
            _req("GET", SETTINGS_URL + "/kilocode/zeroclaw/tasks"),
        )
        zc_tasks = zc_r.get("tasks", []) if not zc_r.get("error") else []
        active_zc = [t for t in zc_tasks if t.get("status") in ("pending", "running", "waiting_approval")]
        return JSONResponse({
            "ts": _ts(),
            "zeroclaw_queue": len(zc_tasks),
            "zeroclaw_active": len(active_zc),
            "events_buffered": len(_PIPELINE_EVENTS),
            "services": {
                "runtime": not hermes_r.get("error"),
                "zeroclaw": not zc_r.get("error"),
            },
        })

    @router.get("/events")
    async def get_events(limit: int = 100):
        return JSONResponse({"events": _PIPELINE_EVENTS[:limit], "count": len(_PIPELINE_EVENTS)})

    @router.post("/events", dependencies=[Depends(require_write)])
    async def push_event(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        evt = {
            "id": str(uuid.uuid4())[:8],
            "ts": _ts(),
            "type": body.get("type", "info"),
            "agent": body.get("agent", "system"),
            "detail": body.get("detail", ""),
        }
        _PIPELINE_EVENTS.insert(0, evt)
        if len(_PIPELINE_EVENTS) > 200:
            _PIPELINE_EVENTS.pop()
        return JSONResponse({"ok": True, "event": evt})

    @router.delete("/events", dependencies=[Depends(require_write)])
    async def clear_events():
        _PIPELINE_EVENTS.clear()
        return JSONResponse({"ok": True})

    return router
