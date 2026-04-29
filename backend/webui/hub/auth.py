"""
Hub v2 — Auth layer.

Two FastAPI dependencies:
  require_write       — all config/repair/write routes
  require_disruptive  — promote/rollback/restart/port-changes (token + maintenance window)
"""
import time
from typing import Optional
from fastapi import Request, HTTPException
from hub.config import HUB_ADMIN_TOKEN

# ── Maintenance window state (shared with staging router) ──────────────────────
_maintenance_window: Optional[dict] = None


def set_maintenance_window(window: Optional[dict]) -> None:
    global _maintenance_window
    _maintenance_window = window


def get_maintenance_window() -> Optional[dict]:
    return _maintenance_window


def _maintenance_window_active() -> bool:
    if _maintenance_window is None:
        return False
    scheduled_at = _maintenance_window.get("scheduled_at")
    duration_minutes = _maintenance_window.get("duration_minutes", 10)
    if scheduled_at is None:
        return True  # no scheduled time = open window
    try:
        import datetime
        start = datetime.datetime.fromisoformat(scheduled_at.replace("Z", "+00:00"))
        end = start + datetime.timedelta(minutes=duration_minutes)
        now = datetime.datetime.now(datetime.timezone.utc)
        return start <= now <= end
    except Exception:
        return False


def require_write(request: Request) -> None:
    """
    FastAPI dependency for write / repair / config routes.
    Requires Authorization: Bearer <HUB_ADMIN_TOKEN> when token is configured.
    In dev mode (no token set) passes through with a warning.
    """
    if not HUB_ADMIN_TOKEN:
        return  # dev mode: no token configured
    auth = request.headers.get("Authorization", "")
    if auth != f"Bearer {HUB_ADMIN_TOKEN}":
        raise HTTPException(status_code=401, detail="Hub write token required")


def require_disruptive(request: Request) -> None:
    """
    FastAPI dependency for destructive/live-altering routes:
    promote, rollback, restart, port changes, iptables.
    Requires token AND an active maintenance window.
    """
    require_write(request)
    if not HUB_ADMIN_TOKEN:
        return  # dev mode: skip maintenance check too
    if not _maintenance_window_active():
        raise HTTPException(
            status_code=403,
            detail="Maintenance window required for disruptive actions. "
                   "POST /api/settings/maintenance to open one.",
        )
