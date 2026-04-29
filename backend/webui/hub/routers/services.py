"""Hub v2 router — Service Lifecycle / Auto-start Watchdog (/api/services/*).

Solves the "services not running" problem.

Every time:
  - Hub starts
  - KiloCode VS Code extension activates
  - Open WebUI loads
  - the dashboard refreshes

… the front-end calls /api/services/ensure (or /api/services/status), which:
  1. Probes every registered service.
  2. For DOWN services that have a `start_cmd`, attempts a controlled start.
  3. Records status, evidence, and timestamps.
  4. Returns a unified status object the UI can display.

Endpoints:
  GET  /api/services           -- list all known services + last probe
  GET  /api/services/status    -- probe everything now (no start)
  POST /api/services/ensure    -- probe and auto-start missing local services
  POST /api/services/{id}/start -- explicit start (auth required)
  POST /api/services/{id}/stop  -- explicit stop (auth required)
  GET  /api/services/{id}      -- single service detail + recent log

Design rules:
  - No service is ever started for the user without an explicit `start_cmd`
    in its manifest.
  - Remote services (VPS/Hostinger) are only probed, never started from here.
  - All start attempts are logged to artifacts/services/<id>.log.
  - Last-known status is cached so the UI is fast (no probe storm).
"""
from __future__ import annotations
import asyncio
import json
import os
import shlex
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from hub.auth import require_write
from hub.event_bus import emit
from hub.config import (
    HERMES_URL, LM_STUDIO_URL, OLLAMA_URL, LITELLM_URL,
    OPENWEBUI_URL, OPENWEBUI_PIPELINES_URL, RUNTIME_URL, SETTINGS_URL,
    PROVIDER_HEALTH_URLS, TIMEOUT,
)


# ── Storage ───────────────────────────────────────────────────────────────────
ARTIFACTS_ROOT = Path(os.environ.get("ARTIFACTS_ROOT",
                                     str(Path(__file__).resolve().parents[3] / "artifacts")))
SERVICES_DIR = ARTIFACTS_ROOT / "services"
SERVICES_DIR.mkdir(parents=True, exist_ok=True)
STATUS_CACHE = SERVICES_DIR / "_status_cache.json"


def _ts() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ── Service registry ──────────────────────────────────────────────────────────
# Each entry:
#   id           : stable identifier
#   name         : human label
#   kind         : local | remote | provider
#   probe_url    : URL whose 2xx/3xx response = healthy
#   start_cmd    : shell list to start it (None = remote, never start)
#   start_cwd    : working directory for start_cmd
#   stop_cmd     : optional shell list to stop it
#   required     : True = blocks PASS_AGENTIC_TRUTH if down
#   notes        : human-readable hint shown in UI
SERVICES: list[dict] = [
    # ── Hub itself (always-on; we just probe) ───────────────────────────────
    {
        "id": "hub",
        "name": "Hub v2 (control plane)",
        "kind": "local",
        "probe_url": "http://localhost:8095/health",
        "start_cmd": None,
        "required": True,
        "notes": "If Hub is down you cannot see this page. Start with `python -m hub_start`.",
    },

    # ── Local providers ─────────────────────────────────────────────────────
    {
        "id": "lmstudio",
        "name": "LM Studio (local fallback)",
        "kind": "provider",
        "probe_url": PROVIDER_HEALTH_URLS["lmstudio"],
        "start_cmd": None,
        "required": False,
        "notes": "Start LM Studio desktop app. IP 100.117.190.97:1234 (Tailscale).",
    },
    {
        "id": "ollama",
        "name": "Ollama (local provider)",
        "kind": "provider",
        "probe_url": PROVIDER_HEALTH_URLS["ollama"],
        "start_cmd": ["ollama", "serve"],
        "required": False,
        "notes": "Auto-startable if `ollama` is on PATH.",
    },
    {
        "id": "litellm",
        "name": "LiteLLM proxy",
        "kind": "provider",
        "probe_url": PROVIDER_HEALTH_URLS["litellm"],
        "start_cmd": None,  # User runs litellm via docker-compose.hermes.yml
        "required": False,
        "notes": "Provided by docker-compose.hermes.yml. `docker compose up -d litellm`.",
    },

    # ── Remote providers (probe only) ────────────────────────────────────────
    {
        "id": "minimax",
        "name": "MiniMax (api.minimaxi.chat)",
        "kind": "remote",
        "probe_url": PROVIDER_HEALTH_URLS["minimax"],
        "start_cmd": None,
        "required": True,
        "notes": "Remote. Needs MINIMAX_API_KEY. Token plan: platform.minimax.io.",
    },
    {
        "id": "siliconflow",
        "name": "SiliconFlow (research)",
        "kind": "remote",
        "probe_url": PROVIDER_HEALTH_URLS["siliconflow"],
        "start_cmd": None,
        "required": False,
        "notes": "Remote. ZeroClaw research only.",
    },

    # ── Open WebUI stack ─────────────────────────────────────────────────────
    {
        "id": "openwebui",
        "name": "Open WebUI",
        "kind": "local",
        "probe_url": OPENWEBUI_URL,
        "start_cmd": None,
        "required": True,
        "notes": "Docker container `open-webui`. `docker compose up -d open-webui`.",
    },
    {
        "id": "openwebui_pipelines",
        "name": "Open WebUI Pipelines server",
        "kind": "local",
        "probe_url": OPENWEBUI_PIPELINES_URL,
        "start_cmd": None,
        "required": True,
        "notes": "Docker container `pipelines`. Hosts hermes_router/echo/zeroclaw/shiba/kilocode.",
    },

    # ── Hermes / ZeroClaw / Shiba / Truth ───────────────────────────────────
    {
        "id": "hermes",
        "name": "Hermes router",
        "kind": "local",
        "probe_url": HERMES_URL + "/health",
        "start_cmd": None,
        "required": True,
        "notes": "Hermes container. `docker compose -f docker-compose.hermes.yml up -d hermes`.",
    },
    {
        "id": "zeroclaw",
        "name": "ZeroClaw safe-exec",
        "kind": "local",
        "probe_url": "http://localhost:8090/health",
        "start_cmd": None,
        "required": True,
        "notes": "ZeroClaw HTTP shim. See zeroclaw/ folder.",
    },
    {
        "id": "shiba",
        "name": "Shiba memory (Postgres)",
        "kind": "local",
        "probe_url": "http://localhost:18789/health",
        "start_cmd": None,
        "required": False,
        "notes": "Shiba memory pipeline. Backed by shiba-postgres container.",
    },

    # ── Runtime / Settings / Truth ──────────────────────────────────────────
    {
        "id": "runtime",
        "name": "Runtime service",
        "kind": "local",
        "probe_url": RUNTIME_URL + "/health",
        "start_cmd": None,
        "required": False,
        "notes": "KiloCode runtime bridge.",
    },
    {
        "id": "settings",
        "name": "Settings service",
        "kind": "local",
        "probe_url": SETTINGS_URL + "/health",
        "start_cmd": None,
        "required": False,
        "notes": "Settings persistence service.",
    },

    # ── Skills system ────────────────────────────────────────────────────────
    {
        "id": "skills",
        "name": "Skills registry",
        "kind": "local",
        "probe_url": "http://localhost:8095/api/skills/health",
        "start_cmd": None,
        "required": True,
        "notes": "Hub-internal. Always up if Hub is up.",
    },
]


# ── Probe ─────────────────────────────────────────────────────────────────────
async def probe(svc: dict) -> dict:
    """Probe a service. Healthy = HTTP 2xx-4xx (any non-5xx response means
    the server is reachable; 401/403/404 are still "up", just unauthed/wrong-path).
    A service is "down" only on connection refused, timeout, or 5xx.

    Per-service overrides:
      svc["expect_status"]  = list[int] of acceptable status codes (overrides default)
      svc["probe_method"]   = "GET" (default) or "HEAD"
    """
    url = svc.get("probe_url")
    if not url:
        return {"id": svc["id"], "healthy": False, "reason": "no probe_url"}
    method = svc.get("probe_method", "GET")
    expect = svc.get("expect_status")  # optional explicit allow-list
    started = time.time()
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as cli:
            r = await cli.request(method, url)
            elapsed = round((time.time() - started) * 1000)
            if expect:
                healthy = r.status_code in expect
            else:
                # Default: any non-5xx = reachable
                healthy = r.status_code < 500
            return {
                "id": svc["id"],
                "healthy": healthy,
                "status_code": r.status_code,
                "latency_ms": elapsed,
                "ts": _ts(),
                "reason": None if healthy else f"server_5xx_{r.status_code}",
            }
    except httpx.ConnectError:
        return {"id": svc["id"], "healthy": False, "reason": "connection_refused", "ts": _ts()}
    except httpx.TimeoutException:
        return {"id": svc["id"], "healthy": False, "reason": "timeout", "ts": _ts()}
    except Exception as e:
        return {"id": svc["id"], "healthy": False, "reason": f"error: {type(e).__name__}", "ts": _ts()}


async def probe_all() -> dict:
    results = await asyncio.gather(*(probe(s) for s in SERVICES), return_exceptions=False)
    by_id = {r["id"]: r for r in results}
    summary = {
        "ts": _ts(),
        "total": len(SERVICES),
        "healthy": sum(1 for r in results if r.get("healthy")),
        "down_required": [s["id"] for s in SERVICES
                          if s.get("required") and not by_id.get(s["id"], {}).get("healthy")],
        "down_optional": [s["id"] for s in SERVICES
                          if not s.get("required") and not by_id.get(s["id"], {}).get("healthy")],
        "results": by_id,
    }
    try:
        STATUS_CACHE.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    except Exception:
        pass
    return summary


# ── Auto-start ────────────────────────────────────────────────────────────────
def _spawn(cmd: list[str], cwd: str | None, log_path: Path) -> dict:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        # Detach so Hub keeps running.
        flags = 0
        if sys.platform == "win32":
            flags = subprocess.CREATE_NEW_PROCESS_GROUP | getattr(subprocess, "DETACHED_PROCESS", 0)
        with log_path.open("a", encoding="utf-8") as logf:
            logf.write(f"\n--- spawn {_ts()} {shlex.join(cmd)} ---\n")
            logf.flush()
            proc = subprocess.Popen(
                cmd,
                cwd=cwd,
                stdout=logf,
                stderr=subprocess.STDOUT,
                creationflags=flags if sys.platform == "win32" else 0,
                close_fds=True,
            )
        return {"ok": True, "pid": proc.pid, "log": str(log_path)}
    except FileNotFoundError as e:
        return {"ok": False, "reason": f"executable not found: {e}"}
    except Exception as e:
        return {"ok": False, "reason": f"spawn failed: {type(e).__name__}: {e}"}


async def ensure_service(svc: dict) -> dict:
    """Probe a service. If down and we have a start_cmd, try once."""
    p = await probe(svc)
    if p.get("healthy"):
        return {"id": svc["id"], "action": "already_healthy", "probe": p}

    start_cmd = svc.get("start_cmd")
    if not start_cmd:
        return {"id": svc["id"], "action": "noop_remote_or_unmanaged", "probe": p,
                "hint": svc.get("notes", "")}

    log_path = SERVICES_DIR / f"{svc['id']}.log"
    spawn = _spawn(start_cmd, svc.get("start_cwd"), log_path)
    if not spawn.get("ok"):
        return {"id": svc["id"], "action": "spawn_failed", "probe": p, "spawn": spawn}

    # Give it 3s to come up, then re-probe
    await asyncio.sleep(3)
    p2 = await probe(svc)
    return {
        "id": svc["id"],
        "action": "started" if p2.get("healthy") else "started_but_unhealthy",
        "spawn": spawn,
        "probe_after": p2,
    }


async def ensure_all() -> dict:
    """Probe every service; auto-start any startable ones that are down."""
    actions = await asyncio.gather(*(ensure_service(s) for s in SERVICES), return_exceptions=False)
    return {
        "ts": _ts(),
        "actions": {a["id"]: a for a in actions},
        "started": [a["id"] for a in actions if a.get("action") == "started"],
        "failed": [a["id"] for a in actions if a.get("action") in {"spawn_failed", "started_but_unhealthy"}],
        "noop": [a["id"] for a in actions if a.get("action") in {"already_healthy", "noop_remote_or_unmanaged"}],
    }


# ── Router ────────────────────────────────────────────────────────────────────
def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/services", tags=["services"])

    @router.get("")
    async def list_services():
        # Cheap: return registry + last cached status if available.
        cache: dict = {}
        if STATUS_CACHE.exists():
            try:
                cache = json.loads(STATUS_CACHE.read_text(encoding="utf-8"))
            except Exception:
                cache = {}
        return JSONResponse({
            "ok": True,
            "ts": _ts(),
            "services": [{
                "id": s["id"],
                "name": s["name"],
                "kind": s["kind"],
                "required": s.get("required", False),
                "notes": s.get("notes", ""),
                "auto_startable": bool(s.get("start_cmd")),
                "last_probe": cache.get("results", {}).get(s["id"], {}),
            } for s in SERVICES],
            "cached_summary": {k: v for k, v in cache.items() if k != "results"},
        })

    @router.get("/status")
    async def status_now():
        summary = await probe_all()
        emit("services.probed", {"healthy": summary["healthy"], "total": summary["total"]})
        return JSONResponse({"ok": True, **summary})

    @router.post("/ensure", dependencies=[Depends(require_write)])
    async def ensure_now():
        result = await ensure_all()
        emit("services.ensured", {"started": result["started"], "failed": result["failed"]})
        return JSONResponse({"ok": True, **result})

    @router.get("/{service_id}")
    async def detail(service_id: str):
        svc = next((s for s in SERVICES if s["id"] == service_id), None)
        if not svc:
            return JSONResponse({"error": "not_found"}, status_code=404)
        p = await probe(svc)
        log_path = SERVICES_DIR / f"{service_id}.log"
        log_tail = ""
        if log_path.exists():
            try:
                lines = log_path.read_text(encoding="utf-8").splitlines()
                log_tail = "\n".join(lines[-50:])
            except Exception:
                pass
        return JSONResponse({"ok": True, "service": svc, "probe": p, "log_tail": log_tail})

    @router.post("/{service_id}/start", dependencies=[Depends(require_write)])
    async def start(service_id: str):
        svc = next((s for s in SERVICES if s["id"] == service_id), None)
        if not svc:
            return JSONResponse({"error": "not_found"}, status_code=404)
        result = await ensure_service(svc)
        emit("service.started", {"id": service_id, "action": result.get("action")})
        return JSONResponse({"ok": True, **result})

    @router.post("/{service_id}/stop", dependencies=[Depends(require_write)])
    async def stop(service_id: str):
        svc = next((s for s in SERVICES if s["id"] == service_id), None)
        if not svc:
            return JSONResponse({"error": "not_found"}, status_code=404)
        stop_cmd = svc.get("stop_cmd")
        if not stop_cmd:
            return JSONResponse({"ok": False, "reason": "no_stop_cmd_configured", "id": service_id})
        log_path = SERVICES_DIR / f"{service_id}.log"
        spawn = _spawn(stop_cmd, svc.get("start_cwd"), log_path)
        emit("service.stopped", {"id": service_id})
        return JSONResponse({"ok": spawn.get("ok", False), "spawn": spawn, "id": service_id})

    return router


# ── Background ensure (called from app startup hook) ──────────────────────────
async def background_ensure_on_startup(delay_seconds: float = 0.5) -> None:
    """Used by Hub create_app() to fire-and-forget a single ensure pass."""
    try:
        await asyncio.sleep(delay_seconds)
        await ensure_all()
    except Exception:
        # Never let watchdog crash the Hub.
        pass
