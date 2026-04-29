"""
Hub v2 — create_app() factory.

Auto-includes all routers. To add a new router:
  1. Create hub/routers/myrouter.py exposing create_router()
  2. Add it to ROUTERS list below
  No other changes needed.
"""
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from hub.config import HUB_ADMIN_TOKEN
from hub.event_bus import create_events_router
from hub.panel_registry import create_router as panel_router
from hub.mcp_server import attach_mcp

# ── Router imports ─────────────────────────────────────────────────────────────
from hub.routers import discord, kilocode, agents, providers, pipeline, kom, proxies, runtime, settings, openwebui, staging, agents_bridge, tasks, permissions, repairs, mcp, roadmap, capabilities, warroom, skills, services as services_router


def create_app(base_url: str = "http://localhost:8095") -> FastAPI:
    app = FastAPI(
        title="Hub v2 — Universal Control Plane",
        description=(
            "Modular control plane for KiloCode, Open WebUI, Hermes, ZeroClaw, "
            "providers, agents, pipelines, memory, VPS, and infrastructure. "
            "Exposes all functionality via MCP for Claude, Cursor, and Windsurf."
        ),
        version="2.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Core endpoints ─────────────────────────────────────────────────────────
    @app.get("/health", tags=["hub"])
    async def health():
        return JSONResponse({
            "status": "ok",
            "version": "2.0.0",
            "auth": "enabled" if HUB_ADMIN_TOKEN else "dev-mode",
        })

    # ── SSE event bus ──────────────────────────────────────────────────────────
    app.include_router(create_events_router())

    # ── Panel registry ─────────────────────────────────────────────────────────
    app.include_router(panel_router())

    # ── Domain routers ─────────────────────────────────────────────────────────
    # Shared state: pipeline_events and kc_agents passed to routers that need them
    _agents_router = agents.create_router()
    _pipeline_router = pipeline.create_router()

    # KOM needs references to pipeline_events list and kc_agents dict from agents router
    from hub.routers.agents import _PIPELINE_EVENTS as _ape, _AGENTS as _kca
    _kom_router = kom.create_router(pipeline_events=_ape, kc_agents=_kca)

    app.include_router(discord.create_router())
    app.include_router(kilocode.create_router())
    app.include_router(_agents_router)
    app.include_router(agents_bridge.create_router())
    app.include_router(providers.create_router())
    app.include_router(_pipeline_router)
    app.include_router(_kom_router)
    app.include_router(runtime.create_router())
    app.include_router(settings.create_router())
    app.include_router(openwebui.create_router())
    app.include_router(staging.create_router())
    app.include_router(tasks.create_router())
    app.include_router(permissions.create_router())
    app.include_router(repairs.create_router())
    app.include_router(mcp.create_router())
    app.include_router(roadmap.create_router())
    app.include_router(capabilities.create_router())
    app.include_router(warroom.create_router())
    app.include_router(skills.create_router())
    app.include_router(services_router.create_router())

    # ── Auto-start watchdog: fire one ensure pass shortly after boot. ─────────
    @app.on_event("startup")
    async def _services_autostart():
        import asyncio as _aio
        _aio.create_task(services_router.background_ensure_on_startup(0.5))

    # Proxies last (catch-all /api/runtime/* would shadow specific routes if first)
    app.include_router(proxies.create_router())

    # ── Static: serve panels/ directory ───────────────────────────────────────
    panels_dir = Path(__file__).parent.parent / "panels"
    if panels_dir.exists():
        app.mount("/panels-static", StaticFiles(directory=str(panels_dir)), name="panels-static")

    # ── Shell UI ───────────────────────────────────────────────────────────────
    shell_path = Path(__file__).parent.parent / "shell.html"

    @app.get("/", response_class=HTMLResponse, tags=["hub"])
    async def shell():
        if shell_path.exists():
            return HTMLResponse(shell_path.read_text(encoding="utf-8"))
        return HTMLResponse("<h1>Hub v2</h1><p>shell.html not found — run hub_start.py</p>")

    # ── MCP server ─────────────────────────────────────────────────────────────
    attach_mcp(app, base_url=base_url)

    return app
