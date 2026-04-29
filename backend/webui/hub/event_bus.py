"""
Hub v2 — SSE Event Bus.

Any router can call emit(event_type, payload) to broadcast to all SSE subscribers.

Usage in a router:
    from backend.webui.hub.event_bus import emit
    emit("hermes.status.changed", {"status": "online"})

Clients subscribe via:
    GET /events  →  text/event-stream
    data: {"type": "hermes.status.changed", "payload": {...}, "ts": "..."}
"""
import asyncio
import json
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

# ── Subscriber registry ────────────────────────────────────────────────────────
_subscribers: list[asyncio.Queue] = []


def emit(event_type: str, payload: Any = None) -> None:
    """Broadcast an event to all connected SSE clients (non-async, safe to call anywhere)."""
    message = json.dumps({
        "type": event_type,
        "payload": payload or {},
        "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    })
    dead = []
    for q in _subscribers:
        try:
            q.put_nowait(message)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        try:
            _subscribers.remove(q)
        except ValueError:
            pass


async def _subscribe() -> AsyncGenerator[str, None]:
    """Async generator yielding SSE-formatted messages for one client."""
    q: asyncio.Queue = asyncio.Queue(maxsize=200)
    _subscribers.append(q)
    try:
        while True:
            try:
                message = await asyncio.wait_for(q.get(), timeout=30.0)
                yield f"data: {message}\n\n"
            except asyncio.TimeoutError:
                yield ": heartbeat\n\n"
    finally:
        try:
            _subscribers.remove(q)
        except ValueError:
            pass


def create_events_router():
    """Returns an APIRouter with the GET /events endpoint."""
    from fastapi import APIRouter
    from fastapi.responses import StreamingResponse

    router = APIRouter()

    @router.get("/events", tags=["hub"])
    async def sse_events():
        """Server-Sent Events stream — subscribe for live Hub state updates."""
        return StreamingResponse(
            _subscribe(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    return router
