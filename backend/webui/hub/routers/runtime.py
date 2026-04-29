"""Hub v2 router — runtime state, overview ViewModel, KiloCode integration."""
import os
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from backend.webui.hub.auth import require_write
from backend.webui.hub.config import PROVIDER_HEALTH_URLS
from backend.webui.hub.routers.kilocode import _kc_state


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _get_runtime_tone(kc_synced: bool) -> str:
    """Semantic tone for runtime status (ported from OpenClaude presentation.js)."""
    if kc_synced:
        return "positive"
    return "warning"


def _get_provider_tone(online: int, total: int) -> str:
    """Semantic tone for provider status."""
    if total == 0:
        return "neutral"
    ratio = online / total
    if ratio >= 0.8:
        return "positive"
    if ratio >= 0.4:
        return "warning"
    return "critical"


def _truncate_middle(value: str, max_length: int = 40) -> str:
    """Truncate a string in the middle with ellipsis (ported from OpenClaude)."""
    if not value or len(value) <= max_length:
        return value or ""
    half = (max_length - 3) // 2
    return value[:half] + "…" + value[-half:]


def _get_path_tail(value: str) -> str:
    """Get the last path component (ported from OpenClaude)."""
    if not value:
        return ""
    parts = value.replace("\\", "/").rstrip("/").split("/")
    return parts[-1] if parts else ""


def create_router() -> APIRouter:
    router = APIRouter(tags=["runtime"])

    # ── Overview ViewModel (Phase 2 — ported from OpenClaude presentation.js) ──
    @router.get("/api/overview")
    async def overview_viewmodel():
        """Build the control center ViewModel for header badges + summary cards.
        Consumed by Hub overview panel, KiloCode HubPanel, and Open WebUI via MCP."""
        import asyncio
        import httpx

        # Probe providers
        online = 0
        total = len(PROVIDER_HEALTH_URLS)
        try:
            async with httpx.AsyncClient(timeout=3.0) as cl:
                for pid, url in PROVIDER_HEALTH_URLS.items():
                    try:
                        r = await cl.get(url, headers={"Authorization": "Bearer na"})
                        if r.status_code < 500:
                            online += 1
                    except Exception:
                        pass
        except Exception:
            pass

        cwd = os.getcwd()
        runtime_tone = _get_runtime_tone(_kc_state["synced"])
        provider_tone = _get_provider_tone(online, total)

        viewmodel = {
            "ts": _ts(),
            "headerBadges": [
                {"label": "Runtime", "value": "Hub v2", "tone": runtime_tone},
                {"label": "Provider", "value": f"{online}/{total} online", "tone": provider_tone},
                {"label": "KiloCode", "value": _kc_state["version"] or "not synced", "tone": runtime_tone},
            ],
            "summaryCards": [
                {"label": "Workspace", "value": _truncate_middle(cwd), "full": cwd, "tail": _get_path_tail(cwd)},
                {"label": "Active Model", "value": os.environ.get("MINIMAX_MODEL", "MiniMax-M2.7-highspeed")},
                {"label": "Launch CWD", "value": _truncate_middle(cwd, 30), "full": cwd},
            ],
            "kilocode": {
                "synced": _kc_state["synced"],
                "version": _kc_state["version"],
                "last_sync": _kc_state["last_sync"],
                "drift": _kc_state["drift"],
            },
            "providers": {"online": online, "total": total, "tone": provider_tone},
        }
        return JSONResponse(viewmodel)

    # NOTE: kilocode status/sync/cmd endpoints live in hub.routers.kilocode
    # (prefix=/api/runtime/kilocode). Do NOT duplicate them here.

    return router
