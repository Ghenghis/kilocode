"""
Hub v2 router — Open WebUI bridge (/api/openwebui/*).

Proxies hermes.daveai.tech (Open WebUI) and its pipeline service.
This is the missing bridge that connects Hub to the Open WebUI environment.
"""
import asyncio
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
import httpx
from hub.config import OPENWEBUI_URL, OPENWEBUI_PIPELINES_URL, OPENWEBUI_API_KEY, TIMEOUT
from hub.auth import require_write
from hub.event_bus import emit


async def _owui_req(method: str, url: str, body=None, extra_headers: dict | None = None) -> dict:
    headers = {"Authorization": f"Bearer {OPENWEBUI_API_KEY}"}
    if extra_headers:
        headers.update(extra_headers)
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            if method == "GET":
                r = await client.get(url, headers=headers)
            else:
                r = await client.post(url, json=body or {}, headers=headers)
            try:
                return r.json()
            except Exception:
                return {"status_code": r.status_code, "text": r.text[:500]}
    except Exception as exc:
        return {"error": str(exc)}


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/openwebui", tags=["openwebui"])

    @router.get("/health")
    async def owui_health():
        r = await _owui_req("GET", f"{OPENWEBUI_URL}/health")
        ok = "error" not in r
        return JSONResponse({"ok": ok, "url": OPENWEBUI_URL, "data": r})

    @router.get("/models")
    async def owui_models():
        r = await _owui_req("GET", f"{OPENWEBUI_URL}/api/models")
        return JSONResponse(r)

    @router.get("/pipelines")
    async def owui_pipelines():
        r = await _owui_req("GET", f"{OPENWEBUI_PIPELINES_URL}/pipelines")
        return JSONResponse(r)

    @router.post("/pipelines/reload", dependencies=[Depends(require_write)])
    async def owui_pipelines_reload():
        r = await _owui_req("POST", f"{OPENWEBUI_PIPELINES_URL}/pipelines/reload")
        emit("openwebui.pipelines.reloaded", {})
        return JSONResponse(r)

    @router.get("/status")
    async def owui_status():
        health_r, models_r, pipes_r = await asyncio.gather(
            _owui_req("GET", f"{OPENWEBUI_URL}/health"),
            _owui_req("GET", f"{OPENWEBUI_URL}/api/models"),
            _owui_req("GET", f"{OPENWEBUI_PIPELINES_URL}/pipelines"),
        )
        health_ok = "error" not in health_r
        model_count = len(models_r.get("data", [])) if not models_r.get("error") else 0
        pipelines = pipes_r.get("data", []) if not pipes_r.get("error") else []
        pipeline_names = [p.get("id", p.get("name", "?")) for p in pipelines]
        return JSONResponse({
            "ok": health_ok,
            "url": OPENWEBUI_URL,
            "model_count": model_count,
            "pipeline_count": len(pipelines),
            "pipelines": pipeline_names,
        })

    @router.api_route("/proxy/{path:path}", methods=["GET", "POST"], include_in_schema=False, operation_id="proxy_owui_catchall")
    async def owui_proxy(path: str, request: Request):
        url = f"{OPENWEBUI_URL}/{path}"
        body = None
        if request.method == "POST":
            try:
                body = await request.json()
            except Exception:
                body = {}
        r = await _owui_req(request.method, url, body)
        return JSONResponse(r)

    return router
