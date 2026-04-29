"""FastAPI server for the Shiba Memory Gateway.

Run via::

    python -m uvicorn backend.shiba.gateway_server:app --host 0.0.0.0 --port 18789

All configuration comes from environment variables (NEVER from a ``.env``
file directly — the deployment harness is responsible for populating
``os.environ`` ahead of process start).

Recognised env vars
-------------------

``SHIBA_DB_URL``
    Postgres DSN. When unset the gateway falls back to an in-memory store.
``SHIBA_KEY``
    Shared secret required in the ``X-Shiba-Key`` request header. Defaults
    to ``"shiba-local-key"`` (the dev value used by the existing pipelines).
``SHIBA_GATEWAY_PORT``
    Port for the ``__main__`` runner; defaults to ``18789``.
``SHIBA_CORS_ORIGINS``
    Comma-separated list of allowed origins. ``*`` is rejected — only
    explicit origins are honoured. Defaults to ``http://localhost,http://127.0.0.1``.
"""

from __future__ import annotations

import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from typing import Awaitable, Callable

from fastapi import Depends, FastAPI, Header, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .models import (
    MemoryEntry,
    RecallRequest,
    RecallResponse,
    WriteRequest,
    WriteResponse,
)
from .store import build_store

log = logging.getLogger("shiba.gateway")


# ─── Helpers ──────────────────────────────────────────────────────────────


def _default_key() -> str:
    return os.environ.get("SHIBA_KEY", "shiba-local-key")


def _cors_origins() -> list[str]:
    raw = os.environ.get(
        "SHIBA_CORS_ORIGINS", "http://localhost,http://127.0.0.1"
    )
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    # Refuse to allow "*": it's incompatible with credentialled requests and
    # rarely what an MVP needs.
    return [o for o in origins if o != "*"]


# ─── State container ──────────────────────────────────────────────────────


class _AppState:
    """Holds the store reference for the lifetime of the app."""

    def __init__(self) -> None:
        self.store = build_store()


# ─── Lifespan ─────────────────────────────────────────────────────────────


@asynccontextmanager
async def _lifespan(app: FastAPI):
    state: _AppState = app.state.shiba  # type: ignore[attr-defined]
    try:
        await state.store.init()
        log.info(
            "shiba gateway starting (store=%s, version=%s)",
            "in-memory" if state.store.is_in_memory else "postgres",
            __version__,
        )
        yield
    finally:
        try:
            await state.store.close()
        except Exception as exc:  # pragma: no cover - best effort
            log.warning("error closing shiba store: %s", exc)


# ─── App factory ──────────────────────────────────────────────────────────


def create_app() -> FastAPI:
    """Create a fresh ``FastAPI`` app instance.

    Exposed for tests so each test run gets an isolated in-memory store.
    Production callers should use the module-level ``app`` (built once at
    import time so uvicorn's ``--reload`` cycles stay cheap).
    """

    state = _AppState()

    fastapi_app = FastAPI(
        title="Shiba Memory Gateway",
        version=__version__,
        lifespan=_lifespan,
    )
    fastapi_app.state.shiba = state

    origins = _cors_origins()
    if origins:
        fastapi_app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
            allow_headers=["Content-Type", "X-Shiba-Key"],
        )

    _register_routes(fastapi_app)
    return fastapi_app


# ─── Auth dependency ──────────────────────────────────────────────────────


async def _require_key(
    x_shiba_key: str | None = Header(default=None, alias="X-Shiba-Key"),
) -> None:
    expected = _default_key()
    if not x_shiba_key or x_shiba_key != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid X-Shiba-Key",
        )


# ─── Routes ───────────────────────────────────────────────────────────────


def _register_routes(fastapi_app: FastAPI) -> None:
    def _store():
        return fastapi_app.state.shiba.store  # type: ignore[attr-defined]

    def _store_label() -> str:
        return "in-memory" if _store().is_in_memory else "postgres"

    @fastapi_app.get("/")
    async def root() -> dict:
        """Compatibility shim for older probes that hit ``/``."""

        port = int(os.environ.get("SHIBA_GATEWAY_PORT", "18789"))
        return {
            "service": "Shiba Gateway",
            "port": port,
            "store": _store_label(),
        }

    @fastapi_app.get("/health")
    async def health() -> dict:
        ok = await _store().health()
        return {"ok": bool(ok), "store": _store_label(), "version": __version__}

    @fastapi_app.post("/write", response_model=WriteResponse)
    async def write(
        body: WriteRequest, _auth: None = Depends(_require_key)
    ) -> WriteResponse:
        now = time.time()
        entry_id = body.id or uuid.uuid4().hex
        created_at = body.created_at if body.created_at is not None else now
        updated_at = body.updated_at if body.updated_at is not None else now
        entry = MemoryEntry(
            id=entry_id,
            content=body.content,
            tags=body.tags,
            metadata=body.metadata,
            created_at=created_at,
            updated_at=updated_at,
        )
        stored, created = await _store().upsert(entry)
        return WriteResponse(id=stored.id, created=created)

    @fastapi_app.post("/recall", response_model=RecallResponse)
    async def recall(
        body: RecallRequest, _auth: None = Depends(_require_key)
    ) -> RecallResponse:
        memories = await _store().recall(
            body.query, body.limit, body.threshold
        )
        return RecallResponse(memories=memories, total=len(memories))

    @fastapi_app.get("/entries/{entry_id}", response_model=MemoryEntry)
    async def get_entry(
        entry_id: str, _auth: None = Depends(_require_key)
    ) -> MemoryEntry:
        entry = await _store().get(entry_id)
        if entry is None:
            raise HTTPException(status_code=404, detail="entry not found")
        return entry

    @fastapi_app.delete(
        "/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT
    )
    async def delete_entry(
        entry_id: str, _auth: None = Depends(_require_key)
    ) -> Response:
        deleted = await _store().delete(entry_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="entry not found")
        return Response(status_code=status.HTTP_204_NO_CONTENT)


# ─── Module-level app ─────────────────────────────────────────────────────

app = create_app()


# ─── __main__ entrypoint ──────────────────────────────────────────────────


def main() -> None:  # pragma: no cover - CLI shim
    import uvicorn

    port = int(os.environ.get("SHIBA_GATEWAY_PORT", "18789"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":  # pragma: no cover
    main()
