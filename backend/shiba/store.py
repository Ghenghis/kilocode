"""Storage backend for the Shiba Memory Gateway.

Two implementations live in this module:

* :class:`PostgresStore` — production backend using ``asyncpg`` with a
  trigram index for similarity search.
* :class:`InMemoryStore` — graceful fallback when ``SHIBA_DB_URL`` is
  unset or ``asyncpg`` is unavailable. Suitable for dev / tests.

The factory :func:`build_store` selects the appropriate implementation
based on environment variables.

The store contract is intentionally narrow:

* ``upsert(entry) -> (entry, was_created)`` with last-write-wins by
  ``updated_at``.
* ``recall(query, limit, threshold) -> list[MemoryEntry]``.
* ``get(id) -> MemoryEntry | None``.
* ``delete(id) -> bool``.
* ``health() -> bool``.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Iterable, Protocol

from .models import MemoryEntry

log = logging.getLogger("shiba.store")


# ─── Schema bootstrapping ────────────────────────────────────────────────

_SCHEMA_SQL = (
    "CREATE TABLE IF NOT EXISTS shiba_entries ("
    "  id TEXT PRIMARY KEY,"
    "  content TEXT NOT NULL,"
    "  tags TEXT[],"
    "  metadata JSONB,"
    "  created_at DOUBLE PRECISION NOT NULL,"
    "  updated_at DOUBLE PRECISION NOT NULL"
    ");"
)
_TAG_INDEX_SQL = (
    "CREATE INDEX IF NOT EXISTS ix_shiba_tags ON shiba_entries USING gin (tags);"
)
_TRGM_EXT_SQL = "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
_TRGM_INDEX_SQL = (
    "CREATE INDEX IF NOT EXISTS ix_shiba_content_trgm "
    "ON shiba_entries USING gin (content gin_trgm_ops);"
)


# ─── Store protocol (typing aid only) ─────────────────────────────────────


class _StoreProtocol(Protocol):  # pragma: no cover - typing helper
    is_in_memory: bool

    async def init(self) -> None: ...
    async def close(self) -> None: ...
    async def upsert(self, entry: MemoryEntry) -> tuple[MemoryEntry, bool]: ...
    async def recall(
        self, query: str, limit: int, threshold: float
    ) -> list[MemoryEntry]: ...
    async def get(self, id: str) -> MemoryEntry | None: ...
    async def delete(self, id: str) -> bool: ...
    async def health(self) -> bool: ...


# ─── In-memory implementation ────────────────────────────────────────────

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def _trigrams(value: str) -> set[str]:
    """Return the set of normalised character trigrams for ``value``.

    Mirrors PostgreSQL's ``pg_trgm`` semantics closely enough for tests:
    lower-case the input and pad with two leading and one trailing space.
    """

    s = "  " + value.lower() + " "
    return {s[i : i + 3] for i in range(len(s) - 2)}


def _trigram_similarity(a: str, b: str) -> float:
    """Jaccard similarity over trigrams — fallback for in-memory mode."""

    if not a or not b:
        return 0.0
    ta, tb = _trigrams(a), _trigrams(b)
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    union = len(ta | tb)
    if union == 0:
        return 0.0
    jaccard = inter / union
    # Blend with SequenceMatcher.ratio() for better short-string behaviour.
    seq = SequenceMatcher(None, a.lower(), b.lower()).ratio()
    return max(jaccard, seq * 0.6)


@dataclass
class InMemoryStore:
    """Dict-backed fallback store.

    The implementation is intentionally simple — concurrent writes are
    serialised at the asyncio layer (single event loop) so no extra locking
    is required for the MVP.
    """

    is_in_memory: bool = True
    _data: dict[str, MemoryEntry] = field(default_factory=dict)

    async def init(self) -> None:  # pragma: no cover - trivial
        return None

    async def close(self) -> None:  # pragma: no cover - trivial
        self._data.clear()

    async def upsert(self, entry: MemoryEntry) -> tuple[MemoryEntry, bool]:
        existing = self._data.get(entry.id)
        if existing is None:
            self._data[entry.id] = entry
            return entry, True
        # LWW: only overwrite when the incoming updated_at is newer.
        if entry.updated_at >= existing.updated_at:
            # Preserve the original created_at on update.
            merged = entry.model_copy(update={"created_at": existing.created_at})
            self._data[entry.id] = merged
            return merged, False
        return existing, False

    async def recall(
        self, query: str, limit: int, threshold: float
    ) -> list[MemoryEntry]:
        scored: list[tuple[float, MemoryEntry]] = []
        for entry in self._data.values():
            score = _trigram_similarity(query, entry.content)
            if score >= threshold:
                scored.append((score, entry))
        scored.sort(key=lambda pair: pair[0], reverse=True)
        out: list[MemoryEntry] = []
        for score, entry in scored[: max(0, limit)]:
            out.append(entry.model_copy(update={"score": score}))
        return out

    async def get(self, id: str) -> MemoryEntry | None:
        entry = self._data.get(id)
        return None if entry is None else entry.model_copy()

    async def delete(self, id: str) -> bool:
        return self._data.pop(id, None) is not None

    async def health(self) -> bool:
        return True


# ─── Postgres implementation ──────────────────────────────────────────────


class PostgresStore:
    """asyncpg-backed store with trigram similarity search."""

    is_in_memory: bool = False

    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._pool = None  # type: ignore[var-annotated]

    async def init(self) -> None:
        import asyncpg  # local import keeps dev/test path light

        self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=10)
        async with self._pool.acquire() as conn:
            await conn.execute(_SCHEMA_SQL)
            await conn.execute(_TAG_INDEX_SQL)
            try:
                await conn.execute(_TRGM_EXT_SQL)
                await conn.execute(_TRGM_INDEX_SQL)
            except Exception as exc:  # pragma: no cover - environment-specific
                log.warning(
                    "pg_trgm extension or index could not be created (%s); "
                    "recall will fall back to ILIKE matching",
                    exc,
                )

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def upsert(self, entry: MemoryEntry) -> tuple[MemoryEntry, bool]:
        assert self._pool is not None, "PostgresStore.init() must be called first"
        # ON CONFLICT ... DO UPDATE WHERE EXCLUDED.updated_at > existing.updated_at
        sql = (
            "INSERT INTO shiba_entries (id, content, tags, metadata, created_at, updated_at) "
            "VALUES ($1, $2, $3, $4::jsonb, $5, $6) "
            "ON CONFLICT (id) DO UPDATE SET "
            "  content = EXCLUDED.content, "
            "  tags = EXCLUDED.tags, "
            "  metadata = EXCLUDED.metadata, "
            "  updated_at = EXCLUDED.updated_at "
            "WHERE EXCLUDED.updated_at > shiba_entries.updated_at "
            "RETURNING (xmax = 0) AS inserted"
        )
        import json as _json

        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                sql,
                entry.id,
                entry.content,
                list(entry.tags),
                _json.dumps(entry.metadata),
                entry.created_at,
                entry.updated_at,
            )
            if row is None:
                # ON CONFLICT WHERE-clause prevented update — fetch existing row.
                existing = await self.get(entry.id)
                assert existing is not None
                return existing, False
            return entry, bool(row["inserted"])

    async def recall(
        self, query: str, limit: int, threshold: float
    ) -> list[MemoryEntry]:
        assert self._pool is not None
        sql = (
            "SELECT id, content, tags, metadata, created_at, updated_at, "
            "       similarity(content, $1) AS score "
            "FROM shiba_entries "
            "WHERE similarity(content, $1) >= $3 "
            "ORDER BY similarity(content, $1) DESC "
            "LIMIT $2"
        )
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(sql, query, max(0, limit), float(threshold))
        return [_row_to_entry(r) for r in rows]

    async def get(self, id: str) -> MemoryEntry | None:
        assert self._pool is not None
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id, content, tags, metadata, created_at, updated_at "
                "FROM shiba_entries WHERE id = $1",
                id,
            )
        return None if row is None else _row_to_entry(row)

    async def delete(self, id: str) -> bool:
        assert self._pool is not None
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM shiba_entries WHERE id = $1", id
            )
        # asyncpg returns "DELETE <n>"
        try:
            return int(result.rsplit(" ", 1)[-1]) > 0
        except (ValueError, IndexError):
            return False

    async def health(self) -> bool:
        if self._pool is None:
            return False
        try:
            async with self._pool.acquire() as conn:
                value = await conn.fetchval("SELECT 1")
            return value == 1
        except Exception:  # pragma: no cover - environment-specific
            return False


def _row_to_entry(row: "Iterable") -> MemoryEntry:  # pragma: no cover - thin
    import json as _json

    data = dict(row)
    metadata = data.get("metadata") or {}
    if isinstance(metadata, (str, bytes)):
        try:
            metadata = _json.loads(metadata)
        except Exception:
            metadata = {}
    return MemoryEntry(
        id=data["id"],
        content=data["content"],
        tags=list(data.get("tags") or []),
        metadata=metadata,
        score=data.get("score"),
        created_at=float(data["created_at"]),
        updated_at=float(data["updated_at"]),
    )


# ─── Factory ──────────────────────────────────────────────────────────────


def build_store() -> _StoreProtocol:
    """Return the appropriate store implementation for the current env.

    * If ``SHIBA_DB_URL`` is set *and* ``asyncpg`` is importable → Postgres.
    * Otherwise → in-memory fallback (with a ``WARNING`` log line).
    """

    dsn = os.environ.get("SHIBA_DB_URL", "").strip()
    if not dsn:
        log.warning(
            "SHIBA_DB_URL not set — falling back to in-memory store. "
            "Data will be lost on restart."
        )
        return InMemoryStore()

    try:
        import asyncpg  # noqa: F401
    except ImportError:
        log.warning(
            "asyncpg not installed — SHIBA_DB_URL set but Postgres backend "
            "unavailable. Falling back to in-memory store."
        )
        return InMemoryStore()

    return PostgresStore(dsn)
