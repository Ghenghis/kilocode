"""
Canonical Settings Service — single source of truth for all settings.

Implements the full API surface from settings_contract_kit:
  GET  /settings/state
  GET  /settings/questions
  POST /settings/questions/{id}/answer
  POST /settings/apply
  POST /settings/auto-fill
  POST /settings/repair
  POST /settings/validate
  GET  /settings/audit
  POST /mode/{mode}
  POST /maintenance/window
  GET  /ports
  PUT  /ports/{service}
  POST /ports/apply
"""

import time
import uuid
import os
import socket
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

class AnswerPayload(BaseModel):
    value: Any
    changed_by: str = "user"


class ApplyPayload(BaseModel):
    settings: Dict[str, Any]
    changed_by: str = "user"


class RepairPayload(BaseModel):
    subsystem: Optional[str] = None
    changed_by: str = "agent"


class MaintenancePayload(BaseModel):
    scheduled_at: Optional[str] = None
    duration_minutes: int = 10
    reason: str = ""


class PortUpdatePayload(BaseModel):
    port: int
    changed_by: str = "user"


# ---------------------------------------------------------------------------
# Evidence store (in-memory, persisted to simple JSON on disk)
# ---------------------------------------------------------------------------

AUDIT_PATH = os.path.expanduser("~/.kilocode/settings_audit.json")


def _load_audit() -> List[Dict[str, Any]]:
    try:
        import json
        with open(AUDIT_PATH) as f:
            return json.load(f)
    except Exception:
        return []


def _save_audit(entries: List[Dict[str, Any]]) -> None:
    try:
        import json
        os.makedirs(os.path.dirname(AUDIT_PATH), exist_ok=True)
        with open(AUDIT_PATH, "w") as f:
            json.dump(entries[-500:], f, indent=2)
    except Exception:
        pass


def _record_audit(
    subsystem: str,
    changed_fields: List[str],
    validation_result: str,
    changed_by: str,
    restart_required: bool = False,
    disruptive: bool = False,
    extra: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    entries = _load_audit()
    entry = {
        "evidence_id": str(uuid.uuid4()),
        "subsystem": subsystem,
        "changed_fields": changed_fields,
        "validation_result": validation_result,
        "changed_by": changed_by,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "restart_required": restart_required,
        "disruptive": disruptive,
        **(extra or {}),
    }
    entries.append(entry)
    _save_audit(entries)
    return entry


# ---------------------------------------------------------------------------
# Port registry — tracks current ports for all services
# ---------------------------------------------------------------------------

DEFAULT_PORTS: Dict[str, int] = {
    "kilocode-runtime": 8081,
    "kilocode-hermes": 8091,
    "kilocode-webui": 8095,
    "nats": 4222,
    "nats-monitor": 8222,
    "open-webui": 7860,
    "model-server": 8080,
    "litellm": 4000,
    "edge-tts": 5050,
    "shiba-gateway": 18789,
    "ollama": 11434,
}

_port_registry: Dict[str, int] = dict(DEFAULT_PORTS)
_port_pending: Dict[str, int] = {}


def _port_in_use(port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(("localhost", port)) == 0
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Questions registry
# ---------------------------------------------------------------------------

_QUESTIONS: List[Dict[str, Any]] = [
    {
        "id": "minimax_api_key",
        "subsystem": "providers",
        "label": "MiniMax API Key",
        "type": "secret",
        "required": True,
        "answered": False,
        "inferable": False,
        "hint": "Find at https://platform.minimaxi.com/",
    },
    {
        "id": "litellm_base_url",
        "subsystem": "providers",
        "label": "LiteLLM Base URL",
        "type": "url",
        "required": True,
        "answered": bool(os.environ.get("LITELLM_BASE_URL")),
        "inferable": True,
        "default": "http://localhost:4000/v1",
        "current": os.environ.get("LITELLM_BASE_URL", "http://localhost:4000/v1"),
    },
    {
        "id": "ollama_base_url",
        "subsystem": "providers",
        "label": "Ollama Base URL",
        "type": "url",
        "required": False,
        "answered": True,
        "inferable": True,
        "current": os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
    },
    {
        "id": "webui_agent_token",
        "subsystem": "webui",
        "label": "WebUI Agent Token",
        "type": "secret",
        "required": True,
        "answered": bool(os.environ.get("WEBUI_AGENT_TOKEN")),
        "inferable": False,
        "hint": "Set WEBUI_AGENT_TOKEN env var",
    },
    {
        "id": "nats_url",
        "subsystem": "runtime",
        "label": "NATS URL",
        "type": "url",
        "required": False,
        "answered": True,
        "inferable": True,
        "current": os.environ.get("NATS_URL", "nats://localhost:4222"),
    },
]

_question_answers: Dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Canonical settings state
# ---------------------------------------------------------------------------

_canonical: Dict[str, Any] = {
    "providers": {
        "litellm": {
            "base_url": os.environ.get("LITELLM_BASE_URL", "http://localhost:4000/v1"),
            "enabled": True,
        },
        "ollama": {
            "base_url": os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
            "enabled": True,
        },
        "minimax": {
            "base_url": "https://api.minimaxi.com/v1",
            "enabled": bool(os.environ.get("MINIMAX_API_KEY")),
        },
    },
    "runtime": {
        "nats_url": os.environ.get("NATS_URL", "nats://localhost:4222"),
        "runtime_port": int(os.environ.get("RUNTIME_PORT", 8081)),
        "hermes_port": int(os.environ.get("HERMES_PORT", 8091)),
        "webui_port": int(os.environ.get("WEBUI_PORT", 8095)),
        "log_level": os.environ.get("LOG_LEVEL", "info"),
    },
    "mode": os.environ.get("KILOCODE_MODE", "standard"),
    "yolo_enabled": os.environ.get("YOLO_MODE", "false").lower() == "true",
    "sync_state": {
        "kilocode_synced": False,
        "webui_synced": False,
        "last_sync": None,
    },
    "maintenance_window": None,
    "last_validated": None,
    "last_changed_by": None,
}

VALID_MODES = {"standard", "yolo", "elevated", "readonly"}


# ---------------------------------------------------------------------------
# Auto-fill logic
# ---------------------------------------------------------------------------

def _auto_fill() -> Dict[str, Any]:
    filled = []
    skipped = []
    for q in _QUESTIONS:
        if q.get("inferable") and not q["answered"]:
            default = q.get("default") or q.get("current")
            if default:
                _question_answers[q["id"]] = default
                q["answered"] = True
                filled.append(q["id"])
            else:
                skipped.append(q["id"])
    return {
        "filled": filled,
        "skipped_need_user": skipped,
        "remaining_unanswered": [q["id"] for q in _QUESTIONS if not q["answered"]],
    }


# ---------------------------------------------------------------------------
# Validate logic
# ---------------------------------------------------------------------------

def _validate_state() -> Dict[str, Any]:
    issues = []

    # Check NATS reachable
    nats_port = _port_registry.get("nats", 4222)
    if not _port_in_use(nats_port):
        issues.append(f"NATS not reachable on port {nats_port}")

    # Check runtime
    rt_port = _port_registry.get("kilocode-runtime", 8081)
    if not _port_in_use(rt_port):
        issues.append(f"kilocode-runtime not reachable on port {rt_port}")

    # Check required unanswered questions
    unanswered = [q["id"] for q in _QUESTIONS if q["required"] and not q["answered"]]
    if unanswered:
        issues.append(f"Required questions unanswered: {unanswered}")

    result = "healthy" if not issues else "degraded"
    _canonical["last_validated"] = datetime.utcnow().isoformat() + "Z"
    return {"result": result, "issues": issues, "validated_at": _canonical["last_validated"]}


# ---------------------------------------------------------------------------
# Repair logic
# ---------------------------------------------------------------------------

def _repair(subsystem: Optional[str], changed_by: str) -> Dict[str, Any]:
    repaired = []
    failed = []

    # Auto-fill inferable settings
    fill_result = _auto_fill()
    repaired.extend(fill_result["filled"])

    # Subsystem-specific repairs
    if subsystem in (None, "providers"):
        if not _canonical["providers"]["litellm"]["base_url"]:
            _canonical["providers"]["litellm"]["base_url"] = "http://localhost:4000/v1"
            repaired.append("providers.litellm.base_url")
        if not _canonical["providers"]["ollama"]["base_url"]:
            _canonical["providers"]["ollama"]["base_url"] = "http://localhost:11434"
            repaired.append("providers.ollama.base_url")

    if subsystem in (None, "runtime"):
        for svc, default in DEFAULT_PORTS.items():
            if svc not in _port_registry:
                _port_registry[svc] = default
                repaired.append(f"port.{svc}")

    validation = _validate_state()
    audit = _record_audit(
        subsystem=subsystem or "all",
        changed_fields=repaired,
        validation_result=validation["result"],
        changed_by=changed_by,
        restart_required=False,
        disruptive=False,
    )

    return {
        "repaired": repaired,
        "failed": failed,
        "remaining_issues": validation["issues"],
        "validation": validation,
        "evidence_id": audit["evidence_id"],
    }


# ---------------------------------------------------------------------------
# FastAPI app builder
# ---------------------------------------------------------------------------

def build_settings_app() -> FastAPI:
    app = FastAPI(title="KiloCode Canonical Settings", version="1.0.0")

    # ── GET /settings/state ────────────────────────────────────────────────
    @app.get("/settings/state")
    async def settings_state() -> Dict[str, Any]:
        return {
            "canonical": _canonical,
            "ports": _port_registry,
            "pending_port_changes": _port_pending,
            "questions_remaining": [q for q in _QUESTIONS if not q["answered"]],
            "last_validated": _canonical.get("last_validated"),
            "mode": _canonical["mode"],
        }

    # ── GET /settings/questions ────────────────────────────────────────────
    @app.get("/settings/questions")
    async def settings_questions() -> List[Dict[str, Any]]:
        safe = []
        for q in _QUESTIONS:
            entry = {k: v for k, v in q.items() if k != "default"}
            if q.get("type") == "secret" and q["answered"]:
                entry["current"] = "***"
            safe.append(entry)
        return safe

    # ── POST /settings/questions/{id}/answer ──────────────────────────────
    @app.post("/settings/questions/{qid}/answer")
    async def answer_question(qid: str, payload: AnswerPayload) -> Dict[str, Any]:
        q = next((x for x in _QUESTIONS if x["id"] == qid), None)
        if not q:
            raise HTTPException(404, f"Question '{qid}' not found")
        _question_answers[qid] = payload.value
        q["answered"] = True
        if q.get("type") != "secret":
            q["current"] = payload.value
        audit = _record_audit(
            subsystem=q.get("subsystem", "unknown"),
            changed_fields=[qid],
            validation_result="pending",
            changed_by=payload.changed_by,
        )
        return {"question_id": qid, "answered": True, "evidence_id": audit["evidence_id"]}

    # ── POST /settings/apply ───────────────────────────────────────────────
    @app.post("/settings/apply")
    async def settings_apply(payload: ApplyPayload) -> Dict[str, Any]:
        changed = []
        for k, v in payload.settings.items():
            parts = k.split(".")
            target = _canonical
            for p in parts[:-1]:
                if p not in target:
                    target[p] = {}
                target = target[p]
            target[parts[-1]] = v
            changed.append(k)
        _canonical["last_changed_by"] = payload.changed_by
        validation = _validate_state()
        audit = _record_audit(
            subsystem="canonical",
            changed_fields=changed,
            validation_result=validation["result"],
            changed_by=payload.changed_by,
        )
        return {
            "applied": changed,
            "validation": validation,
            "evidence_id": audit["evidence_id"],
            "restart_required": False,
        }

    # ── POST /settings/auto-fill ───────────────────────────────────────────
    @app.post("/settings/auto-fill")
    async def settings_autofill() -> Dict[str, Any]:
        result = _auto_fill()
        audit = _record_audit(
            subsystem="auto-fill",
            changed_fields=result["filled"],
            validation_result="pending",
            changed_by="agent",
        )
        return {**result, "evidence_id": audit["evidence_id"]}

    # ── POST /settings/repair ──────────────────────────────────────────────
    @app.post("/settings/repair")
    async def settings_repair(request: Request) -> Dict[str, Any]:
        body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
        payload = RepairPayload(**body) if body else RepairPayload()
        return _repair(payload.subsystem, payload.changed_by)

    # ── POST /settings/validate ────────────────────────────────────────────
    @app.post("/settings/validate")
    async def settings_validate() -> Dict[str, Any]:
        result = _validate_state()
        _record_audit(
            subsystem="validate",
            changed_fields=[],
            validation_result=result["result"],
            changed_by="system",
        )
        return result

    # ── GET /settings/audit ────────────────────────────────────────────────
    @app.get("/settings/audit")
    async def settings_audit(limit: int = 50) -> List[Dict[str, Any]]:
        entries = _load_audit()
        return entries[-limit:]

    # ── POST /mode/{mode} ─────────────────────────────────────────────────
    @app.post("/mode/{mode}")
    async def set_mode(mode: str) -> Dict[str, Any]:
        if mode not in VALID_MODES:
            raise HTTPException(400, f"Invalid mode. Valid: {sorted(VALID_MODES)}")
        _canonical["mode"] = mode
        _canonical["yolo_enabled"] = mode == "yolo"
        audit = _record_audit(
            subsystem="mode",
            changed_fields=["mode"],
            validation_result="healthy",
            changed_by="user",
            disruptive=mode in ("yolo", "elevated"),
        )
        return {"mode": mode, "yolo_enabled": _canonical["yolo_enabled"], "evidence_id": audit["evidence_id"]}

    # ── POST /maintenance/window ───────────────────────────────────────────
    @app.post("/maintenance/window")
    async def maintenance_window(payload: MaintenancePayload) -> Dict[str, Any]:
        window = {
            "scheduled_at": payload.scheduled_at or datetime.utcnow().isoformat() + "Z",
            "duration_minutes": payload.duration_minutes,
            "reason": payload.reason,
            "approved": True,
            "approved_at": datetime.utcnow().isoformat() + "Z",
        }
        _canonical["maintenance_window"] = window
        audit = _record_audit(
            subsystem="maintenance",
            changed_fields=["maintenance_window"],
            validation_result="scheduled",
            changed_by="user",
            disruptive=True,
            extra={"window": window},
        )
        return {**window, "evidence_id": audit["evidence_id"]}

    # ── GET /ports ─────────────────────────────────────────────────────────
    @app.get("/ports")
    async def list_ports() -> Dict[str, Any]:
        statuses = {}
        for svc, port in _port_registry.items():
            statuses[svc] = {
                "port": port,
                "reachable": _port_in_use(port),
                "pending": _port_pending.get(svc),
            }
        return {"services": statuses, "pending_changes": _port_pending}

    # ── PUT /ports/{service} ───────────────────────────────────────────────
    @app.put("/ports/{service}")
    async def update_port(service: str, payload: PortUpdatePayload) -> Dict[str, Any]:
        if service not in _port_registry:
            raise HTTPException(404, f"Service '{service}' not in port registry")
        current = _port_registry[service]
        _port_pending[service] = payload.port
        audit = _record_audit(
            subsystem="ports",
            changed_fields=[f"port.{service}"],
            validation_result="pending-restart",
            changed_by=payload.changed_by,
            restart_required=True,
            disruptive=True,
            extra={"service": service, "from_port": current, "to_port": payload.port},
        )
        return {
            "service": service,
            "current_port": current,
            "pending_port": payload.port,
            "status": "pending — apply via POST /ports/apply after maintenance window",
            "evidence_id": audit["evidence_id"],
        }

    # ── POST /ports/apply ──────────────────────────────────────────────────
    @app.post("/ports/apply")
    async def apply_ports() -> Dict[str, Any]:
        applied = {}
        for svc, new_port in list(_port_pending.items()):
            _port_registry[svc] = new_port
            applied[svc] = new_port
            del _port_pending[svc]
        audit = _record_audit(
            subsystem="ports",
            changed_fields=list(applied.keys()),
            validation_result="applied",
            changed_by="system",
            restart_required=True,
            disruptive=True,
            extra={"applied": applied},
        )
        return {
            "applied": applied,
            "message": "Port changes applied. Restart affected services to take effect.",
            "evidence_id": audit["evidence_id"],
        }

    # ── GET /health ────────────────────────────────────────────────────────
    @app.get("/health")
    async def health() -> Dict[str, Any]:
        return {"status": "healthy", "service": "kilocode-settings"}

    return app


# Module-level app for uvicorn
app = build_settings_app()
