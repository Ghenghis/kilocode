"""
Hub v2 router — staging / live promotion (/api/staging/*).

Flow: validate → promote → (rollback if needed)

- promote and rollback require require_disruptive (token + maintenance window)
- validate requires require_write (token only)
- promotion is only allowed if last validation passed within 1 hour
"""
import time
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from hub.config import STAGING_PORT, LIVE_PORT
from hub.auth import require_write, require_disruptive
from hub.event_bus import emit
from hub._http import _req

_PROMOTION_HISTORY: list = []
_staging_state: dict = {
    "staging_port": STAGING_PORT,
    "live_port": LIVE_PORT,
    "previous_port": None,
    "last_validated": None,
    "validation_passed": False,
    "promote_allowed": False,
    "last_promotion": None,
    "last_rollback": None,
    "status": "idle",
}

_VALIDATION_TTL = 3600  # seconds — validation expires after 1 hour


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _validation_still_valid() -> bool:
    lv = _staging_state.get("last_validated")
    if not lv or not _staging_state.get("validation_passed"):
        return False
    return (time.time() - lv) < _VALIDATION_TTL


async def _run_validation_suite(staging_port: int) -> dict:
    """Run health checks against the staging target."""
    base = f"http://localhost:{staging_port}"
    checks = {}
    for endpoint in ("/health", "/api/healthall"):
        r = await _req("GET", f"{base}{endpoint}")
        checks[endpoint] = "error" not in r
    passed = all(checks.values())
    return {"passed": passed, "checks": checks, "ts": _ts()}


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/staging", tags=["staging"])

    @router.get("/status")
    async def staging_status():
        state = dict(_staging_state)
        state["promote_allowed"] = _validation_still_valid()
        state["validation_expires_in"] = None
        if _staging_state.get("last_validated") and _staging_state.get("validation_passed"):
            remaining = _VALIDATION_TTL - (time.time() - _staging_state["last_validated"])
            state["validation_expires_in"] = max(0, round(remaining))
        return JSONResponse(state)

    @router.post("/validate", dependencies=[Depends(require_write)])
    async def validate_staging():
        _staging_state["status"] = "validating"
        emit("staging.validation.started", {"port": _staging_state["staging_port"]})

        result = await _run_validation_suite(_staging_state["staging_port"])

        _staging_state["last_validated"] = time.time()
        _staging_state["validation_passed"] = result["passed"]
        _staging_state["promote_allowed"] = result["passed"]
        _staging_state["status"] = "validated" if result["passed"] else "validation_failed"

        evidence_id = str(uuid.uuid4())
        entry = {
            "evidence_id": evidence_id,
            "type": "validation",
            "ts": _ts(),
            "staging_port": _staging_state["staging_port"],
            "passed": result["passed"],
            "checks": result["checks"],
        }
        _PROMOTION_HISTORY.insert(0, entry)
        if len(_PROMOTION_HISTORY) > 50:
            _PROMOTION_HISTORY.pop()

        emit("staging.validation.complete", {"passed": result["passed"], "evidence_id": evidence_id})
        return JSONResponse({
            "ok": result["passed"],
            "passed": result["passed"],
            "checks": result["checks"],
            "evidence_id": evidence_id,
            "promote_allowed": result["passed"],
        })

    @router.post("/promote", dependencies=[Depends(require_disruptive)])
    async def promote_staging():
        if not _validation_still_valid():
            return JSONResponse(
                {"error": "Cannot promote: validation expired or not passed. Run /api/staging/validate first."},
                status_code=409,
            )
        prev_live = _staging_state["live_port"]
        _staging_state["previous_port"] = prev_live
        _staging_state["live_port"] = _staging_state["staging_port"]
        _staging_state["last_promotion"] = time.time()
        _staging_state["promote_allowed"] = False
        _staging_state["validation_passed"] = False
        _staging_state["status"] = "promoted"

        evidence_id = str(uuid.uuid4())
        entry = {
            "evidence_id": evidence_id,
            "type": "promotion",
            "ts": _ts(),
            "from_port": prev_live,
            "to_port": _staging_state["live_port"],
        }
        _PROMOTION_HISTORY.insert(0, entry)
        if len(_PROMOTION_HISTORY) > 50:
            _PROMOTION_HISTORY.pop()

        emit("staging.promoted", {
            "from_port": prev_live,
            "to_port": _staging_state["live_port"],
            "evidence_id": evidence_id,
        })
        return JSONResponse({"ok": True, "evidence_id": evidence_id, **entry})

    @router.post("/rollback", dependencies=[Depends(require_disruptive)])
    async def rollback_staging():
        prev = _staging_state.get("previous_port")
        if prev is None:
            return JSONResponse({"error": "No previous port to roll back to."}, status_code=409)
        rolled_back_from = _staging_state["live_port"]
        _staging_state["live_port"] = prev
        _staging_state["previous_port"] = None
        _staging_state["last_rollback"] = time.time()
        _staging_state["status"] = "rolled_back"

        evidence_id = str(uuid.uuid4())
        entry = {
            "evidence_id": evidence_id,
            "type": "rollback",
            "ts": _ts(),
            "from_port": rolled_back_from,
            "to_port": _staging_state["live_port"],
        }
        _PROMOTION_HISTORY.insert(0, entry)
        if len(_PROMOTION_HISTORY) > 50:
            _PROMOTION_HISTORY.pop()

        emit("staging.rolled_back", {
            "from_port": rolled_back_from,
            "to_port": _staging_state["live_port"],
            "evidence_id": evidence_id,
        })
        return JSONResponse({"ok": True, "evidence_id": evidence_id, **entry})

    @router.get("/history")
    async def promotion_history(limit: int = 20):
        return JSONResponse({"history": _PROMOTION_HISTORY[:limit], "count": len(_PROMOTION_HISTORY)})

    return router
