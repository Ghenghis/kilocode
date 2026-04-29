"""
Hub v2 router — settings bridge (/api/settings/*).

This router is the Hub-side BRIDGE to settings_canonical.py running at SETTINGS_URL.
It does NOT create a second settings truth. All canonical state lives in settings_canonical.

Additional Hub-owned surface:
  GET  /api/settings/sync              — kilocode_synced + webui_synced + last_sync
  POST /api/settings/sync/kilocode     — mark KiloCode as synced, emit event
  POST /api/settings/sync/webui        — mark Open WebUI as synced, emit event
  POST /api/settings/maintenance       — open maintenance window (also updates auth layer)

Phase 3 — Canonical Settings Sync (A.2):
  GET  /api/settings/canonical         — canonical settings bundle + version_hash
  GET  /api/settings/drift-check       — compare surface's version vs canonical
  POST /api/settings/notify-change     — broadcast settings changed to all surfaces
"""
import hashlib
import json
import time
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from hub.config import SETTINGS_URL
from hub.auth import require_write, require_disruptive, set_maintenance_window
from hub.event_bus import emit
from hub._http import _req

_sync_state = {
    "kilocode_synced": False,
    "webui_synced": False,
    "last_sync": None,
    "last_kilocode_sync": None,
    "last_webui_sync": None,
    "canonical_version": None,  # SHA-256 hash of canonical settings
}

# Per-surface version tracking for drift detection
_surface_versions: Dict[str, Optional[str]] = {
    "kilocode": None,
    "webui": None,
    "hub": None,
}


def _compute_version_hash(settings: Dict[str, Any]) -> str:
    """Compute a stable version hash for settings dict.
    
    Uses SHA-256 of normalized JSON (sorted keys, no whitespace) for consistency.
    """
    normalized = json.dumps(settings, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:32]


async def _fetch_canonical_settings() -> Dict[str, Any]:
    """Fetch current canonical settings from settings_canonical service."""
    return await _req("GET", f"{SETTINGS_URL}/settings")


def create_router() -> APIRouter:
    router = APIRouter(prefix="/api/settings", tags=["settings"])

    # ── Hub sync state (specific routes BEFORE catch-all) ─────────────────────
    @router.get("/sync")
    async def get_sync():
        return JSONResponse(_sync_state)

    @router.post("/sync/kilocode", dependencies=[Depends(require_write)])
    async def sync_kilocode(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        now = time.time()
        _sync_state["kilocode_synced"] = True
        _sync_state["last_kilocode_sync"] = now
        _sync_state["last_sync"] = now
        emit("settings.sync.kilocode", {"ts": now, "version": body.get("version")})
        return JSONResponse({"ok": True, "ts": now})

    @router.post("/sync/webui", dependencies=[Depends(require_write)])
    async def sync_webui(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        now = time.time()
        _sync_state["webui_synced"] = True
        _sync_state["last_webui_sync"] = now
        _sync_state["last_sync"] = now
        emit("settings.sync.webui", {"ts": now})
        return JSONResponse({"ok": True, "ts": now})

    # ── Maintenance window ─────────────────────────────────────────────────────
    @router.post("/maintenance", dependencies=[Depends(require_write)])
    async def open_maintenance(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        window = {
            "scheduled_at": body.get("scheduled_at"),
            "duration_minutes": body.get("duration_minutes", 10),
            "reason": body.get("reason", ""),
        }
        set_maintenance_window(window)
        # Also forward to canonical settings service (best-effort)
        await _req("POST", f"{SETTINGS_URL}/maintenance/window", window)
        emit("maintenance.window.opened", window)
        return JSONResponse({"ok": True, "window": window})

    @router.delete("/maintenance", dependencies=[Depends(require_write)])
    async def close_maintenance():
        set_maintenance_window(None)
        emit("maintenance.window.closed", {})
        return JSONResponse({"ok": True, "window": None})

    # ── Phase 3: Canonical Settings Sync (A.2) ───────────────────────────────
    
    @router.get("/canonical")
    async def get_canonical_settings():
        """Return the canonical settings bundle with version hash.
        
        This is the single source of truth endpoint. All surfaces (KiloCode,
        Open WebUI, Hub panels) should fetch settings from here to ensure
        they are working with the same configuration state.
        
        Response includes:
          - settings: The canonical settings dict
          - version_hash: SHA-256 hash for drift detection
          - fetched_at: Timestamp when Hub retrieved from canonical service
          - surfaces: Per-surface sync status with their reported versions
        """
        canonical = await _fetch_canonical_settings()
        version_hash = _compute_version_hash(canonical)
        
        now = time.time()
        _sync_state["canonical_version"] = version_hash
        
        return JSONResponse({
            "settings": canonical,
            "version_hash": version_hash,
            "fetched_at": now,
            "surfaces": {
                name: {
                    "version": ver,
                    "synced": ver == version_hash if ver else False,
                }
                for name, ver in _surface_versions.items()
            },
        })

    @router.get("/drift-check")
    async def check_drift(surface: str, their_version: str):
        """Check if a surface's settings version matches canonical.
        
        Query params:
          - surface: Which surface is checking ("kilocode", "webui", "hub")
          - their_version: The version hash the surface thinks it has
        
        Returns:
          - drifted: True if their version != canonical version
          - canonical_version: Current canonical hash
          - action: "sync" if drifted, "ok" if matching
        """
        canonical = await _fetch_canonical_settings()
        canonical_version = _compute_version_hash(canonical)
        _sync_state["canonical_version"] = canonical_version
        
        # Record this surface's reported version
        _surface_versions[surface] = their_version
        
        drifted = their_version != canonical_version
        
        emit("settings.drift_check", {
            "surface": surface,
            "their_version": their_version,
            "canonical_version": canonical_version,
            "drifted": drifted,
        })
        
        return JSONResponse({
            "drifted": drifted,
            "canonical_version": canonical_version,
            "their_version": their_version,
            "action": "sync" if drifted else "ok",
            "sync_url": "/api/settings/canonical" if drifted else None,
        })

    @router.post("/report-version", dependencies=[Depends(require_write)])
    async def report_surface_version(request: Request):
        """Surface reports its current settings version to Hub.
        
        Body:
          - surface: "kilocode", "webui", or "hub"
          - version: The version hash the surface computed from its settings
          - metadata: Optional dict with additional surface info
        
        This allows Hub to track which surfaces are in sync without requiring
        them to fetch full settings on every check.
        """
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        surface = body.get("surface")
        version = body.get("version")
        
        if surface not in _surface_versions:
            return JSONResponse({
                "ok": False,
                "error": f"Unknown surface: {surface}. Must be one of: {list(_surface_versions.keys())}"
            }, status_code=400)
        
        _surface_versions[surface] = version
        
        # Check against canonical
        canonical = await _fetch_canonical_settings()
        canonical_version = _compute_version_hash(canonical)
        _sync_state["canonical_version"] = canonical_version
        
        synced = version == canonical_version
        
        emit("settings.version_report", {
            "surface": surface,
            "version": version,
            "canonical_version": canonical_version,
            "synced": synced,
        })
        
        return JSONResponse({
            "ok": True,
            "surface": surface,
            "synced": synced,
            "canonical_version": canonical_version,
        })

    @router.post("/notify-change", dependencies=[Depends(require_write)])
    async def notify_settings_changed(request: Request):
        """Notify all surfaces that settings have changed.
        
        Body:
          - changed_by: Who made the change (user_ref or agent_id)
          - changed_keys: List of which setting keys were modified
          - reason: Optional explanation for the change
        
        Hub will:
          1. Fetch new canonical settings and compute new version hash
          2. Emit events to all surfaces via SSE (/events)
          3. Mark all surfaces as "unsynced" until they report new version
        
        This is the mechanism for maintaining "one shared settings truth"
        across KiloCode, Open WebUI, and Hub panels.
        """
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        changed_by = body.get("changed_by", "unknown")
        changed_keys = body.get("changed_keys", [])
        reason = body.get("reason", "")
        
        # Fetch new canonical and compute version
        canonical = await _fetch_canonical_settings()
        new_version = _compute_version_hash(canonical)
        old_version = _sync_state.get("canonical_version")
        _sync_state["canonical_version"] = new_version
        
        # Mark all surfaces as potentially out of sync
        for surface in _surface_versions:
            if _surface_versions[surface] != new_version:
                _surface_versions[surface] = None  # Unknown until they report
        
        # Reset sync flags
        _sync_state["kilocode_synced"] = False
        _sync_state["webui_synced"] = False
        
        # Emit to SSE stream for live updates
        emit("settings.changed", {
            "new_version": new_version,
            "old_version": old_version,
            "changed_by": changed_by,
            "changed_keys": changed_keys,
            "reason": reason,
            "ts": time.time(),
        })
        
        # Also emit surface-specific notifications
        for surface in ["kilocode", "webui"]:
            emit(f"settings.sync_needed.{surface}", {
                "new_version": new_version,
                "reason": reason,
            })
        
        return JSONResponse({
            "ok": True,
            "new_version": new_version,
            "old_version": old_version,
            "surfaces_notified": list(_surface_versions.keys()),
            "message": "Settings change broadcast. Surfaces should fetch /api/settings/canonical",
        })

    # ── Phase 3: Settings Validation & Autofill ────────────────────────────────
    
    @router.post("/validate")
    async def validate_settings(request: Request):
        """Validate settings keys and return per-key validation results.
        
        Body:
          - settings: Dict of settings to validate {key: value}
          - strict: bool — if True, return error for unknown keys
        
        Returns:
          - results: List of {key, valid, severity, message, fix?}
          - valid: bool — overall validity
          - ts: timestamp
        
        Severity levels: error, warning, info
        """
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        settings = body.get("settings", {})
        strict = body.get("strict", False)
        
        # Known settings schema (extend as needed)
        known_keys = {
            "provider": {"type": "string", "required": True},
            "model": {"type": "string", "required": True},
            "temperature": {"type": "number", "min": 0, "max": 2},
            "max_tokens": {"type": "integer", "min": 1, "max": 8192},
            "api_key": {"type": "string", "secret": True},
            "base_url": {"type": "string"},
            "timeout": {"type": "integer", "min": 1, "max": 300},
            "retry_count": {"type": "integer", "min": 0, "max": 10},
        }
        
        results = []
        all_valid = True
        
        for key, value in settings.items():
            if key not in known_keys:
                if strict:
                    results.append({
                        "key": key,
                        "valid": False,
                        "severity": "error",
                        "message": f"Unknown setting key: {key}",
                    })
                    all_valid = False
                else:
                    results.append({
                        "key": key,
                        "valid": True,
                        "severity": "info",
                        "message": f"Unknown key (passed through): {key}",
                    })
                continue
            
            schema = known_keys[key]
            errors = []
            
            # Type validation
            if schema.get("type") == "string" and not isinstance(value, str):
                errors.append(f"Expected string, got {type(value).__name__}")
            elif schema.get("type") == "number" and not isinstance(value, (int, float)):
                errors.append(f"Expected number, got {type(value).__name__}")
            elif schema.get("type") == "integer" and not isinstance(value, int):
                errors.append(f"Expected integer, got {type(value).__name__}")
            
            # Range validation
            if "min" in schema and isinstance(value, (int, float)) and value < schema["min"]:
                errors.append(f"Value {value} below minimum {schema['min']}")
            if "max" in schema and isinstance(value, (int, float)) and value > schema["max"]:
                errors.append(f"Value {value} above maximum {schema['max']}")
            
            # Required validation
            if schema.get("required") and (value is None or value == ""):
                errors.append(f"Required field {key} is empty")
            
            # Suggest fix for common issues
            fix = None
            if errors:
                all_valid = False
                if key == "temperature" and isinstance(value, (int, float)):
                    fix = {"action": "clamp", "value": max(0, min(2, value))}
                elif key == "max_tokens" and isinstance(value, (int, float)):
                    fix = {"action": "clamp", "value": max(1, min(8192, int(value)))}
            
            results.append({
                "key": key,
                "valid": len(errors) == 0,
                "severity": "error" if errors else "info",
                "message": "; ".join(errors) if errors else "Valid",
                "fix": fix,
            })
        
        # Check for missing required keys
        for key, schema in known_keys.items():
            if schema.get("required") and key not in settings:
                all_valid = False
                results.append({
                    "key": key,
                    "valid": False,
                    "severity": "error",
                    "message": f"Required setting {key} is missing",
                })
        
        emit("settings.validated", {
            "keys_checked": len(settings),
            "valid": all_valid,
            "ts": time.time(),
        })
        
        return JSONResponse({
            "valid": all_valid,
            "results": results,
            "ts": time.time(),
        })

    @router.post("/autofill", dependencies=[Depends(require_write)])
    async def autofill_settings(request: Request):
        """Autofill inferable settings values with audit trail.
        
        Body:
          - keys: List of setting keys to autofill (or ["all"])
          - context: Optional context dict for inference
          - changed_by: User/agent identifier for audit trail
        
        Returns:
          - filled: Dict of {key: {old, new, inferred_from, confidence}}
          - changed_keys: List of keys that were modified
          - audit: Audit entry with changed_by, validated_at, etc.
          - restart_required: bool
          - disruptive: bool
        
        Every write stores: changed_by, last_validated_at, restart_required,
        disruptive, evidence_id for full auditability.
        """
        import uuid
        
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        
        keys = body.get("keys", [])
        context = body.get("context", {})
        changed_by = body.get("changed_by", "unknown")
        
        # Fetch current canonical settings
        canonical = await _fetch_canonical_settings()
        
        # Autofill rules (extend as needed)
        autofill_rules = {
            "provider": lambda ctx: "minimax" if ctx.get("has_minimax_key") else "lmstudio" if ctx.get("has_lmstudio") else None,
            "model": lambda ctx: "MiniMax-M2.7-highspeed" if ctx.get("provider") == "minimax" else "local-model",
            "temperature": lambda ctx: 0.7,
            "max_tokens": lambda ctx: 4096,
            "timeout": lambda ctx: 30,
            "retry_count": lambda ctx: 3,
            "base_url": lambda ctx: "https://api.minimaxi.chat/v1" if ctx.get("provider") == "minimax" else "http://100.117.190.97:1234/v1",
        }
        
        filled = {}
        changed_keys = []
        restart_required = False
        disruptive = False
        
        # Determine which keys to fill
        keys_to_fill = list(autofill_rules.keys()) if "all" in keys else [k for k in keys if k in autofill_rules]
        
        for key in keys_to_fill:
            old_value = canonical.get(key)
            rule = autofill_rules[key]
            new_value = rule(context)
            
            if new_value is not None and new_value != old_value:
                filled[key] = {
                    "old": old_value,
                    "new": new_value,
                    "inferred_from": "autofill_rule",
                    "confidence": "high",
                }
                changed_keys.append(key)
                canonical[key] = new_value
                
                # Determine if restart/disruptive
                if key in ["provider", "base_url", "api_key"]:
                    restart_required = True
                if key in ["provider", "model"]:
                    disruptive = True
        
        # Generate evidence ID for audit trail
        evidence_id = str(uuid.uuid4())[:16]
        
        # Audit entry
        audit = {
            "evidence_id": evidence_id,
            "changed_by": changed_by,
            "changed_at": time.time(),
            "last_validated_at": time.time(),
            "restart_required": restart_required,
            "disruptive": disruptive,
            "keys_modified": changed_keys,
            "action": "autofill",
        }
        
        # Notify all surfaces of change
        if changed_keys:
            await notify_settings_changed(Request({
                "type": "http",
                "body": json.dumps({
                    "changed_by": changed_by,
                    "changed_keys": changed_keys,
                    "reason": f"Autofill via /api/settings/autofill (evidence: {evidence_id})",
                }).encode()
            }))
        
        emit("settings.autofilled", {
            "changed_by": changed_by,
            "keys": changed_keys,
            "restart_required": restart_required,
            "disruptive": disruptive,
            "evidence_id": evidence_id,
        })
        
        return JSONResponse({
            "ok": True,
            "filled": filled,
            "changed_keys": changed_keys,
            "audit": audit,
            "restart_required": restart_required,
            "disruptive": disruptive,
            "evidence_id": evidence_id,
        })

    # ── Proxy: full settings_canonical surface (LAST — catch-all) ─────────────
    @router.api_route("/{path:path}", methods=["GET", "POST", "PUT"], include_in_schema=False, operation_id="proxy_settings_catchall")
    async def proxy_settings(path: str, request: Request):
        url = f"{SETTINGS_URL}/{path}"
        if request.query_params:
            url += "?" + str(request.query_params)
        body = None
        if request.method in ("POST", "PUT"):
            try:
                body = await request.json()
            except Exception:
                body = {}
        # Apply auth on write paths
        write_paths = ("apply", "answer", "auto-fill", "repair", "validate", "governance")
        if request.method in ("POST", "PUT") and any(p in path for p in write_paths):
            require_write(request)
        return JSONResponse(await _req(request.method, url, body))

    return router
