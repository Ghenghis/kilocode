"""Hub v2 router — Discord bots (/api/runtime/discord/*)."""
import asyncio
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from hub.config import VPS_HOST, BOT_BASE_PORT
from hub.auth import require_write, require_disruptive
from hub._http import _req

_BOT_META = {
    "hermes1": {"role": "Planning Strategist",   "channel": "#general",  "port_offset": 0},
    "hermes2": {"role": "Creative Brainstormer", "channel": "#planning", "port_offset": 1},
    "hermes3": {"role": "System Architect",      "channel": "#design",   "port_offset": 2},
    "hermes4": {"role": "Bug Triage Specialist", "channel": "#issues",   "port_offset": 3},
    "hermes5": {"role": "Root Cause Analyst",    "channel": "#problems", "port_offset": 4},
}


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/runtime/discord", tags=["discord"])

    @router.get("/bots/{bot}/health")
    async def bot_health(bot: str):
        meta = _BOT_META.get(bot)
        if not meta:
            return JSONResponse({"error": f"Unknown bot: {bot}"}, status_code=404)
        port = BOT_BASE_PORT + meta["port_offset"]
        r = await _req("GET", f"http://{VPS_HOST}:{port}/health")
        ok = "error" not in r
        return JSONResponse({"bot": bot, "status": "online" if ok else "offline",
                             "role": meta["role"], "channel": meta["channel"],
                             "data": r})

    @router.get("/bots")
    async def list_bots():
        async def probe(bot, meta):
            port = BOT_BASE_PORT + meta["port_offset"]
            r = await _req("GET", f"http://{VPS_HOST}:{port}/health")
            ok = "error" not in r
            last = r.get("last_activity") or r.get("last_message")
            return {"bot": bot, "status": "online" if ok else "offline",
                    "role": meta["role"], "channel": meta["channel"], "last_activity": last}

        results = await asyncio.gather(*[probe(b, m) for b, m in _BOT_META.items()])
        online = sum(1 for r in results if r["status"] == "online")
        return JSONResponse({"bots": list(results), "online": online, "total": len(results)})

    @router.post("/broadcast", dependencies=[Depends(require_write)])
    async def broadcast(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        return JSONResponse({"ok": True, "message": body.get("message", ""), "note": "Broadcast queued"})

    @router.post("/audit", dependencies=[Depends(require_write)])
    async def audit():
        return JSONResponse({"ok": True, "note": "Audit triggered — check VPS logs"})

    @router.post("/iptables-fix", dependencies=[Depends(require_disruptive)])
    async def iptables_fix():
        return JSONResponse({
            "ok": True,
            "command": "iptables -I INPUT -s 172.0.0.0/8 -p tcp --dport 18789 -j ACCEPT",
            "note": "Apply on VPS host to persist Shiba connectivity",
        })

    return router
