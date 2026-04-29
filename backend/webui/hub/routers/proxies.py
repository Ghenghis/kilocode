"""Hub v2 router — external service proxies (hermes, lmstudio, ollama, litellm, runtime, healthall)."""
import asyncio
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from backend.webui.hub.config import HERMES_URL, LM_STUDIO_URL, OLLAMA_URL, LITELLM_URL, RUNTIME_URL, SETTINGS_URL, VPS_HOST, BOT_BASE_PORT
from backend.webui.hub.auth import require_write
from backend.webui.hub._http import _req


def create_router() -> APIRouter:
    router = APIRouter(tags=["proxies"])

    # ── Hermes proxy ───────────────────────────────────────────────────────────
    @router.api_route("/api/hermes/{path:path}", methods=["GET", "POST"], include_in_schema=False, operation_id="proxy_hermes_catchall")
    async def proxy_hermes(path: str, request: Request):
        url = f"{HERMES_URL}/{path}"
        body = None
        if request.method == "POST":
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── LM Studio proxy ────────────────────────────────────────────────────────
    @router.api_route("/api/lmstudio/{path:path}", methods=["GET", "POST"], include_in_schema=False, operation_id="proxy_lmstudio_catchall")
    async def proxy_lmstudio(path: str, request: Request):
        url = f"{LM_STUDIO_URL}/{path}"
        body = None
        if request.method == "POST":
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── Ollama proxy ───────────────────────────────────────────────────────────
    @router.api_route("/api/ollama/{path:path}", methods=["GET", "POST"], operation_id="proxy_ollama_catchall", include_in_schema=False)
    async def proxy_ollama(path: str, request: Request):
        url = f"{OLLAMA_URL}/{path}"
        body = None
        if request.method == "POST":
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── LiteLLM proxy ──────────────────────────────────────────────────────────
    @router.api_route("/api/litellm/{path:path}", methods=["GET", "POST"], operation_id="proxy_litellm_catchall", include_in_schema=False)
    async def proxy_litellm(path: str, request: Request):
        url = f"{LITELLM_URL}/{path}"
        body = None
        if request.method == "POST":
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── Runtime catch-all proxy ────────────────────────────────────────────────
    @router.api_route("/api/runtime/{path:path}", methods=["GET", "POST", "PUT", "DELETE"], operation_id="proxy_runtime_catchall", include_in_schema=False)
    async def proxy_runtime(path: str, request: Request):
        url = f"{RUNTIME_URL}/{path}"
        if request.query_params:
            url += "?" + str(request.query_params)
        body = None
        if request.method in ("POST", "PUT"):
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── Multi-service health sweep ─────────────────────────────────────────────
    @router.get("/api/healthall")
    async def health_all():
        checks = {
            "runtime":  f"{RUNTIME_URL}/health",
            "settings": f"{SETTINGS_URL}/health",
            "hermes":   f"{HERMES_URL}/health",
            "lmstudio": f"{LM_STUDIO_URL}/v1/models",
            "ollama":   f"{OLLAMA_URL}/api/tags",
            "litellm":  f"{LITELLM_URL}/health",
        }

        async def chk(name, url):
            r = await _req("GET", url)
            return name, {"ok": "error" not in r, "data": r}

        async def chk_discord():
            from backend.webui.hub.routers.discord import _BOT_META
            async def probe(bot, meta):
                port = BOT_BASE_PORT + meta["port_offset"]
                r = await _req("GET", f"http://{VPS_HOST}:{port}/health")
                return "error" not in r
            results = await asyncio.gather(*[probe(b, m) for b, m in _BOT_META.items()])
            online = sum(1 for ok in results if ok)
            return "discord", {"ok": online > 0, "online": online, "total": len(_BOT_META)}

        all_results = await asyncio.gather(
            *[chk(n, u) for n, u in checks.items()],
            chk_discord(),
        )
        return JSONResponse(dict(all_results))

    return router
