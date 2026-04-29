"""Hub v2 router — KiloCode VSIX status/sync (/api/runtime/kilocode/*)."""
import time
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from backend.webui.hub.auth import require_write
from backend.webui.hub.event_bus import emit

_kc_state: dict = {
    "synced": False,
    "last_sync": None,
    "last_checked": None,
    "drift": 0,
    "version": None,
    "commands": {
        "syncRuntimeSettings": "ok",
        "applyAutofillResults": "ok",
        "runHealthCheck": "ok",
        "triggerRepair": "ok",
    },
}


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/runtime/kilocode", tags=["kilocode"])

    @router.get("/status")
    async def kilocode_status():
        _kc_state["last_checked"] = time.time()
        return JSONResponse(_kc_state)

    @router.post("/sync", dependencies=[Depends(require_write)])
    async def kilocode_sync(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        _kc_state["synced"] = True
        _kc_state["last_sync"] = time.time()
        _kc_state["drift"] = 0
        if "version" in body:
            _kc_state["version"] = body["version"]
        emit("kilocode.synced", {"ts": _kc_state["last_sync"], "version": _kc_state.get("version")})
        return JSONResponse({"ok": True, "synced": True, "ts": _kc_state["last_sync"]})

    @router.post("/cmd", dependencies=[Depends(require_write)])
    async def kilocode_cmd(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        cmd = body.get("command", "")
        if cmd in _kc_state["commands"]:
            return JSONResponse({"ok": True, "command": cmd, "result": _kc_state["commands"][cmd]})
        return JSONResponse({"ok": False, "error": f"unknown command: {cmd}"}, status_code=400)

    return router
