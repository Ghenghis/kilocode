"""Unit tests for the Shiba Memory Gateway — runner: ``pytest``.

These tests exercise the FastAPI app via ``httpx.AsyncClient`` and the
``ASGITransport`` so no actual TCP socket is opened. The in-memory store
is used throughout (``SHIBA_DB_URL`` is forcibly cleared before any
shiba module is imported).

Loading strategy
----------------

The repo's ``backend/__init__.py`` eagerly imports siblings that depend
on a top-level ``src`` package which doesn't exist in this checkout. We
side-step that by injecting a stub ``backend`` package into
``sys.modules`` BEFORE the gateway modules are imported, then loading
``backend.shiba.*`` from disk via ``importlib.util.spec_from_file_location``.
That keeps the production import path identical (still
``backend.shiba.gateway_server``) without dragging in the broken
imports.
"""

from __future__ import annotations

import importlib.util
import os
import pathlib
import sys
import types
from typing import Any

import pytest
import pytest_asyncio

# Auto-mark every async test in this module so we don't need to repeat
# ``@pytest.mark.asyncio`` on each test fn.
pytestmark = pytest.mark.asyncio(loop_scope="function")

# ─── Bootstrap a clean ``backend.shiba`` import without touching the
# repo's broken backend/__init__.py. Must happen before any shiba imports.
# ─────────────────────────────────────────────────────────────────────────

os.environ.pop("SHIBA_DB_URL", None)
os.environ["SHIBA_KEY"] = "test-shiba-key"

_REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
_SHIBA_DIR = _REPO_ROOT / "backend" / "shiba"


def _install_stub_backend_package() -> None:
    """Replace ``backend`` (and ``backend.shiba``) in ``sys.modules``."""

    backend_pkg = types.ModuleType("backend")
    backend_pkg.__path__ = [str(_REPO_ROOT / "backend")]
    sys.modules["backend"] = backend_pkg

    shiba_pkg = types.ModuleType("backend.shiba")
    shiba_pkg.__path__ = [str(_SHIBA_DIR)]
    shiba_pkg.__version__ = "0.1.0"  # mirror the real value
    sys.modules["backend.shiba"] = shiba_pkg


def _load(submodule: str):
    """Load ``backend.shiba.<submodule>`` directly from disk."""

    fq = f"backend.shiba.{submodule}"
    spec = importlib.util.spec_from_file_location(
        fq, str(_SHIBA_DIR / f"{submodule}.py")
    )
    assert spec and spec.loader, f"could not build spec for {fq}"
    module = importlib.util.module_from_spec(spec)
    sys.modules[fq] = module
    spec.loader.exec_module(module)
    return module


_install_stub_backend_package()
_load("models")
_load("store")
gateway_server = _load("gateway_server")

from httpx import ASGITransport, AsyncClient  # noqa: E402


# ─── Fixtures ────────────────────────────────────────────────────────────


@pytest.fixture()
def app():
    """Return a fresh FastAPI app + a clean in-memory store per test."""

    fastapi_app = gateway_server.create_app()
    return fastapi_app


@pytest_asyncio.fixture()
async def client(app):
    """Async HTTP client wired up to the app via ASGI transport.

    The ``async with`` block triggers the FastAPI lifespan, which calls
    ``store.init()`` — important so the trigram index code path runs even
    though the in-memory store is a no-op there.
    """

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport, base_url="http://shiba.test"
    ) as ac:
        # Run startup explicitly so handlers see an initialised store.
        async with app.router.lifespan_context(app):
            yield ac


def _auth() -> dict[str, str]:
    return {"X-Shiba-Key": os.environ["SHIBA_KEY"]}


# ─── Tests ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_health_is_unauthenticated_and_reports_in_memory(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["store"] == "in-memory"
    assert "version" in body and isinstance(body["version"], str)


@pytest.mark.asyncio
async def test_root_endpoint_compat_shape(client):
    resp = await client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["service"] == "Shiba Gateway"
    assert body["store"] == "in-memory"
    assert isinstance(body["port"], int)


@pytest.mark.asyncio
async def test_write_requires_shiba_key(client):
    resp = await client.post(
        "/write", json={"content": "no-key here", "tags": []}
    )
    assert resp.status_code == 401

    resp = await client.post(
        "/write",
        json={"content": "wrong-key here", "tags": []},
        headers={"X-Shiba-Key": "wrong"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_write_generates_id_when_missing(client):
    resp = await client.post(
        "/write",
        json={"content": "first memory", "tags": ["unit"]},
        headers=_auth(),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["created"] is True
    assert isinstance(body["id"], str) and len(body["id"]) >= 16


@pytest.mark.asyncio
async def test_write_upsert_lww_semantics(client):
    payload: dict[str, Any] = {
        "id": "fixed-id-1",
        "content": "v1",
        "tags": [],
        "created_at": 1000.0,
        "updated_at": 1000.0,
    }
    r1 = await client.post("/write", json=payload, headers=_auth())
    assert r1.status_code == 200
    assert r1.json() == {"id": "fixed-id-1", "created": True}

    # Second write with NEWER updated_at must update content.
    r2 = await client.post(
        "/write",
        json={**payload, "content": "v2", "updated_at": 2000.0},
        headers=_auth(),
    )
    assert r2.status_code == 200
    assert r2.json() == {"id": "fixed-id-1", "created": False}

    got = await client.get("/entries/fixed-id-1", headers=_auth())
    assert got.status_code == 200
    assert got.json()["content"] == "v2"

    # Stale write (older updated_at) must NOT overwrite v2.
    r3 = await client.post(
        "/write",
        json={**payload, "content": "stale", "updated_at": 500.0},
        headers=_auth(),
    )
    assert r3.status_code == 200
    got = await client.get("/entries/fixed-id-1", headers=_auth())
    assert got.json()["content"] == "v2"


@pytest.mark.asyncio
async def test_recall_returns_similar_entries(client):
    for content in [
        "kubernetes deployment manifests",
        "docker compose networking notes",
        "frosting recipe with vanilla",
    ]:
        await client.post(
            "/write",
            json={"content": content, "tags": ["seed"]},
            headers=_auth(),
        )

    resp = await client.post(
        "/recall",
        json={"query": "kubernetes deployment", "limit": 5, "threshold": 0.0},
        headers=_auth(),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    # The top hit must be the kubernetes-themed entry.
    assert "kubernetes" in body["memories"][0]["content"]
    # Score field is populated only on recall.
    assert isinstance(body["memories"][0]["score"], float)


@pytest.mark.asyncio
async def test_recall_respects_limit(client):
    for i in range(5):
        await client.post(
            "/write",
            json={"content": f"alpha bravo memory {i}", "tags": []},
            headers=_auth(),
        )
    resp = await client.post(
        "/recall",
        json={"query": "alpha bravo", "limit": 2, "threshold": 0.0},
        headers=_auth(),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert len(body["memories"]) == 2


@pytest.mark.asyncio
async def test_get_and_delete_entry_roundtrip(client):
    write = await client.post(
        "/write",
        json={"id": "rt-1", "content": "roundtrip"},
        headers=_auth(),
    )
    assert write.status_code == 200

    got = await client.get("/entries/rt-1", headers=_auth())
    assert got.status_code == 200
    assert got.json()["id"] == "rt-1"

    deleted = await client.delete("/entries/rt-1", headers=_auth())
    assert deleted.status_code == 204

    missing = await client.get("/entries/rt-1", headers=_auth())
    assert missing.status_code == 404

    # Deleting twice is also a 404.
    again = await client.delete("/entries/rt-1", headers=_auth())
    assert again.status_code == 404


@pytest.mark.asyncio
async def test_in_memory_fallback_when_db_url_missing(app):
    state = app.state.shiba
    assert state.store.is_in_memory is True

    # And the Postgres path is never selected when SHIBA_DB_URL is empty.
    store_module = sys.modules["backend.shiba.store"]
    assert isinstance(state.store, store_module.InMemoryStore)
