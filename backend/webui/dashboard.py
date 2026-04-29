"""
KiloCode WebUI — Full Ecosystem Control Center Hub (port 8095)

Serves the main HTML control center dashboard at /
Proxies all API calls to backend services (same-origin from browser).

Backend services proxied:
  /api/runtime/*   → http://localhost:8081
  /api/settings/*  → http://localhost:8082
  /api/hermes/*    → http://localhost:8091
"""

import os
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse

RUNTIME_URL  = os.environ.get("RUNTIME_URL",  "http://localhost:8081")
SETTINGS_URL = os.environ.get("SETTINGS_URL", "http://localhost:8082")
HERMES_URL   = os.environ.get("HERMES_URL",   "http://localhost:8091")
LM_STUDIO_URL = os.environ.get("LM_STUDIO_URL", "http://localhost:1234")
OLLAMA_URL   = os.environ.get("OLLAMA_URL",   "http://localhost:11434")
LITELLM_URL  = os.environ.get("LITELLM_URL",  "http://localhost:4000")
TIMEOUT = 6.0


async def _req(method: str, url: str, body=None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            if method == "GET":
                r = await c.get(url)
            elif method == "POST":
                r = await c.post(url, json=body or {})
            elif method == "PUT":
                r = await c.put(url, json=body or {})
            elif method == "DELETE":
                r = await c.delete(url)
            else:
                return {"error": f"unknown method {method}"}
            return r.json()
    except Exception as e:
        return {"error": str(e), "url": url}


def _html() -> str:
    p = os.path.join(os.path.dirname(__file__), "hub.html")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return f.read()
    return "<h1 style='color:red'>hub.html missing — run deploy</h1>"


def build_app() -> FastAPI:
    app = FastAPI(title="KiloCode Control Hub", version="2.0.0")

    @app.get("/", response_class=HTMLResponse)
    async def root():
        return HTMLResponse(_html())

    @app.get("/health")
    async def health():
        return {"status": "healthy", "service": "kilocode-webui", "version": "2.0.0"}

    # ── Runtime proxy ─────────────────────────────────────────────────────────
    @app.api_route("/api/runtime/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
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

    # ── Settings proxy ────────────────────────────────────────────────────────
    @app.api_route("/api/settings/{path:path}", methods=["GET", "POST", "PUT"])
    async def proxy_settings(path: str, request: Request):
        url = f"{SETTINGS_URL}/{path}"
        if request.query_params:
            url += "?" + str(request.query_params)
        body = None
        if request.method in ("POST", "PUT"):
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── Hermes proxy ──────────────────────────────────────────────────────────
    @app.api_route("/api/hermes/{path:path}", methods=["GET", "POST"])
    async def proxy_hermes(path: str, request: Request):
        url = f"{HERMES_URL}/{path}"
        body = None
        if request.method == "POST":
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── LM Studio proxy ───────────────────────────────────────────────────────
    @app.api_route("/api/lmstudio/{path:path}", methods=["GET", "POST"])
    async def proxy_lmstudio(path: str, request: Request):
        url = f"{LM_STUDIO_URL}/{path}"
        body = None
        if request.method == "POST":
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── Ollama proxy ──────────────────────────────────────────────────────────
    @app.api_route("/api/ollama/{path:path}", methods=["GET", "POST"])
    async def proxy_ollama(path: str, request: Request):
        url = f"{OLLAMA_URL}/{path}"
        body = None
        if request.method == "POST":
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── LiteLLM proxy ─────────────────────────────────────────────────────────
    @app.api_route("/api/litellm/{path:path}", methods=["GET", "POST"])
    async def proxy_litellm(path: str, request: Request):
        url = f"{LITELLM_URL}/{path}"
        body = None
        if request.method == "POST":
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── Multi-service health sweep ────────────────────────────────────────────
    @app.get("/api/healthall")
    async def health_all():
        import asyncio
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
            ok = "error" not in r
            return name, {"ok": ok, "data": r}
        results = await asyncio.gather(*[chk(n, u) for n, u in checks.items()])
        return dict(results)

    return app


app = build_app()
