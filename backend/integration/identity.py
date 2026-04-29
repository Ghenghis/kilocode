"""
Pseudonymous Identity Model (War Room Phase W.1)

Provides stable, privacy-safe identifiers that can be shared across SSE
streams, telemetry exports, War Room views, and audit logs **without**
leaking raw user identity, session secrets, or environment details.

Design anchors (from INTERACTIVE_ROADMAP.md §9 and ACTION_PLAN.md §7):
- `user_ref`    — HMAC-SHA256 of the real user identity keyed by a rotating
                  service salt. Never reversible from the user_ref alone.
                  Stable while the salt is stable.
- `thread_id`   — Opaque random ID for a conversation / room thread. Not
                  derived from user identity. Safe to display and log.
- `session_id`  — Opaque random ID for a live client session. Rotated on
                  reconnect; never persisted with user identity outside
                  the protected identity mapping.
- `identity mapping`
                — A separate, protected bidirectional store that maps
                  real identity ↔ user_ref. Only code running in an
                  authorized component may access it. UI, SSE, telemetry,
                  and logs MUST use user_ref, never the real identity.

This module intentionally has **no runtime dependencies** beyond the
Python standard library so it can be imported from any surface (Hub
backend, test harness, tooling) without pulling in the full runtime.

Authoritative plan references:
- OPENCLAUDE_INTEGRATION_PLAN.md §"Definition of Done"
- INTERACTIVE_ROADMAP.md §9 "War Room Architecture"
- ACTION_PLAN.md §6 "W.1"
"""

from __future__ import annotations

import hmac
import hashlib
import json
import logging
import os
import secrets
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Salt management
# ---------------------------------------------------------------------------

_DEFAULT_SALT_ENV = "CKIT_IDENTITY_SALT"
_DEFAULT_SALT_FILE = Path(os.environ.get(
    "CKIT_IDENTITY_SALT_FILE",
    str(Path.home() / ".contract-kit" / "identity_salt"),
))


def _load_or_create_salt(salt_file: Path = _DEFAULT_SALT_FILE) -> bytes:
    """Load the rotating service salt from disk, generating it on first use.

    The salt is stored with ``0o600`` permissions where the platform supports
    it. The environment variable ``CKIT_IDENTITY_SALT`` overrides the file
    and is preferred for ephemeral or containerized deployments.
    """
    env = os.environ.get(_DEFAULT_SALT_ENV)
    if env:
        return env.encode("utf-8")

    try:
        if salt_file.exists():
            data = salt_file.read_bytes().strip()
            if data:
                return data
        salt_file.parent.mkdir(parents=True, exist_ok=True)
        data = secrets.token_bytes(32)
        salt_file.write_bytes(data)
        try:
            os.chmod(salt_file, 0o600)
        except OSError:
            # Non-POSIX filesystems (e.g. some Windows configurations) may
            # refuse chmod. Fall through; the directory ACL should still
            # protect the file.
            pass
        return data
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning(
            "Could not persist identity salt to %s (%s). "
            "Using an ephemeral in-memory salt for this process.",
            salt_file, exc,
        )
        return secrets.token_bytes(32)


# Module-level cached salt (deliberately not exposed).
_SALT_LOCK = threading.Lock()
_SALT_CACHE: Optional[bytes] = None


def _salt() -> bytes:
    global _SALT_CACHE
    with _SALT_LOCK:
        if _SALT_CACHE is None:
            _SALT_CACHE = _load_or_create_salt()
        return _SALT_CACHE


def rotate_salt(new_salt: Optional[bytes] = None) -> None:
    """Rotate the identity salt.

    Rotating the salt **invalidates** every existing ``user_ref`` mapping.
    Callers are responsible for rebuilding any persisted identity-mapping
    entries under the new salt.
    """
    global _SALT_CACHE
    with _SALT_LOCK:
        _SALT_CACHE = new_salt or secrets.token_bytes(32)


# ---------------------------------------------------------------------------
# Core derivations
# ---------------------------------------------------------------------------

def derive_user_ref(real_identity: str, *, version: int = 1) -> str:
    """Return the pseudonymous ``user_ref`` for a real identity.

    The returned string is prefixed with ``u_`` plus a version tag so the
    pseudonym space can evolve without collisions.

    ``real_identity`` should be whatever the caller considers the
    authoritative identity (e.g. an email, a Discord snowflake, a VS Code
    machine ID). Never pass a full auth token — the HMAC is stable but the
    raw token should not enter the mapping store.
    """
    if not real_identity:
        raise ValueError("real_identity must be non-empty")
    mac = hmac.new(_salt(), real_identity.encode("utf-8"), hashlib.sha256)
    return f"u_v{version}_{mac.hexdigest()[:24]}"


def new_thread_id() -> str:
    """Return a fresh, opaque thread/room identifier."""
    return f"th_{secrets.token_hex(12)}"


def new_session_id() -> str:
    """Return a fresh, opaque session identifier.

    Sessions are shorter-lived than threads; rotate on reconnect.
    """
    return f"s_{secrets.token_hex(10)}"


# ---------------------------------------------------------------------------
# Protected identity mapping
# ---------------------------------------------------------------------------

@dataclass
class IdentityRecord:
    """A single identity mapping entry.

    ``real_identity`` never leaves the mapping store. Callers receive only
    the ``user_ref`` and metadata.
    """
    user_ref: str
    real_identity: str
    created_at: float = field(default_factory=time.time)
    last_seen_at: float = field(default_factory=time.time)
    attrs: Dict[str, str] = field(default_factory=dict)


class IdentityMapping:
    """In-memory protected mapping between real identity and user_ref.

    This skeleton implementation keeps the store in memory and can optionally
    persist to a JSON file. In production this should be backed by the
    runtime's secrets store. The public surface is intentionally narrow:

    - ``register(real_identity)``      → user_ref (idempotent)
    - ``resolve_to_ref(real_identity)`` → Optional[user_ref]
    - ``touch(real_identity)``          → update ``last_seen_at``
    - ``forget(real_identity)``         → right-to-be-forgotten
    - ``attrs_for_ref(user_ref)``       → non-identifying attrs only

    There is deliberately **no** public method that returns the real
    identity given a user_ref. Reversal requires direct access to the
    underlying store, which is treated as a secret.
    """

    def __init__(self, persist_path: Optional[Path] = None) -> None:
        self._lock = threading.Lock()
        self._by_identity: Dict[str, IdentityRecord] = {}
        self._by_ref: Dict[str, str] = {}  # user_ref -> real_identity
        self._persist_path = persist_path
        if persist_path is not None and persist_path.exists():
            try:
                self._load()
            except Exception as exc:  # pragma: no cover - defensive
                logger.warning("Could not load identity mapping: %s", exc)

    # ---- public API --------------------------------------------------------

    def register(self, real_identity: str, **attrs: str) -> str:
        """Register a real identity, returning the stable ``user_ref``.

        Idempotent: repeated calls for the same identity return the same
        ``user_ref`` (under the current salt).
        """
        with self._lock:
            existing = self._by_identity.get(real_identity)
            if existing is not None:
                existing.last_seen_at = time.time()
                if attrs:
                    existing.attrs.update(attrs)
                self._persist_locked()
                return existing.user_ref

            ref = derive_user_ref(real_identity)
            record = IdentityRecord(
                user_ref=ref,
                real_identity=real_identity,
                attrs=dict(attrs),
            )
            self._by_identity[real_identity] = record
            self._by_ref[ref] = real_identity
            self._persist_locked()
            return ref

    def resolve_to_ref(self, real_identity: str) -> Optional[str]:
        """Return the ``user_ref`` for a real identity if registered."""
        with self._lock:
            rec = self._by_identity.get(real_identity)
            return rec.user_ref if rec else None

    def touch(self, real_identity: str) -> None:
        """Update ``last_seen_at`` for a registered identity. No-op if missing."""
        with self._lock:
            rec = self._by_identity.get(real_identity)
            if rec is not None:
                rec.last_seen_at = time.time()
                self._persist_locked()

    def forget(self, real_identity: str) -> bool:
        """Remove an identity from the mapping. Returns True if removed."""
        with self._lock:
            rec = self._by_identity.pop(real_identity, None)
            if rec is None:
                return False
            self._by_ref.pop(rec.user_ref, None)
            self._persist_locked()
            return True

    def attrs_for_ref(self, user_ref: str) -> Dict[str, str]:
        """Return the *non-identifying* attrs stored alongside a user_ref.

        This explicitly never returns the real identity.
        """
        with self._lock:
            real = self._by_ref.get(user_ref)
            if real is None:
                return {}
            rec = self._by_identity.get(real)
            return dict(rec.attrs) if rec else {}

    def __len__(self) -> int:
        with self._lock:
            return len(self._by_identity)

    # ---- persistence (optional) -------------------------------------------

    def _persist_locked(self) -> None:
        if self._persist_path is None:
            return
        try:
            self._persist_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                real: {
                    "user_ref": rec.user_ref,
                    "created_at": rec.created_at,
                    "last_seen_at": rec.last_seen_at,
                    "attrs": rec.attrs,
                }
                for real, rec in self._by_identity.items()
            }
            tmp = self._persist_path.with_suffix(self._persist_path.suffix + ".tmp")
            tmp.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
            tmp.replace(self._persist_path)
            try:
                os.chmod(self._persist_path, 0o600)
            except OSError:
                pass
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Could not persist identity mapping: %s", exc)

    def _load(self) -> None:
        assert self._persist_path is not None
        data = json.loads(self._persist_path.read_text(encoding="utf-8"))
        with self._lock:
            for real, entry in data.items():
                rec = IdentityRecord(
                    user_ref=entry["user_ref"],
                    real_identity=real,
                    created_at=float(entry.get("created_at", time.time())),
                    last_seen_at=float(entry.get("last_seen_at", time.time())),
                    attrs=dict(entry.get("attrs", {})),
                )
                self._by_identity[real] = rec
                self._by_ref[rec.user_ref] = real


# ---------------------------------------------------------------------------
# Convenience: a module-level default mapping for simple callers
# ---------------------------------------------------------------------------

_default_mapping: Optional[IdentityMapping] = None
_default_mapping_lock = threading.Lock()


def default_mapping() -> IdentityMapping:
    """Return a shared process-wide IdentityMapping.

    Most callers should inject their own IdentityMapping; this helper exists
    for simple scripts and quick wiring.
    """
    global _default_mapping
    with _default_mapping_lock:
        if _default_mapping is None:
            _default_mapping = IdentityMapping()
        return _default_mapping


__all__ = [
    "IdentityRecord",
    "IdentityMapping",
    "derive_user_ref",
    "new_thread_id",
    "new_session_id",
    "rotate_salt",
    "default_mapping",
]
