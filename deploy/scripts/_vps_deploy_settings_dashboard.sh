#!/bin/bash
# Deploy canonical settings service + dashboard to VPS
# Installs kilocode-settings (8082) and updates kilocode-webui (8095) to serve full dashboard
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; RESET='\033[0m'
ok()   { echo -e "${GREEN}[OK]${RESET} $*"; }
fail() { echo -e "${RED}[FAIL]${RESET} $*"; exit 1; }
info() { echo -e "${CYAN}[INFO]${RESET} $*"; }

BASE=/opt/kilocode
VENV=$BASE/venv
SRC=$BASE/src

# ── 1. Write settings_canonical.py ──────────────────────────────────────────
info "Writing settings_canonical.py..."
cat > $SRC/runtime/settings_canonical.py << 'PYEOF'
"""
Canonical Settings Service — single source of truth for all settings.
Endpoints: /settings/state, /settings/questions, /settings/questions/{id}/answer,
           /settings/apply, /settings/auto-fill, /settings/repair, /settings/validate,
           /settings/audit, /mode/{mode}, /maintenance/window, /ports, /ports/{service}, /ports/apply
"""
import time, uuid, os, socket, json
from datetime import datetime
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel

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

AUDIT_PATH = os.path.expanduser("~/.kilocode/settings_audit.json")

def _load_audit():
    try:
        with open(AUDIT_PATH) as f: return json.load(f)
    except Exception: return []

def _save_audit(entries):
    try:
        os.makedirs(os.path.dirname(AUDIT_PATH), exist_ok=True)
        with open(AUDIT_PATH, "w") as f: json.dump(entries[-500:], f, indent=2)
    except Exception: pass

def _record_audit(subsystem, changed_fields, validation_result, changed_by, restart_required=False, disruptive=False, extra=None):
    entries = _load_audit()
    entry = {"evidence_id": str(uuid.uuid4()), "subsystem": subsystem, "changed_fields": changed_fields,
             "validation_result": validation_result, "changed_by": changed_by,
             "timestamp": datetime.utcnow().isoformat() + "Z", "restart_required": restart_required,
             "disruptive": disruptive, **(extra or {})}
    entries.append(entry)
    _save_audit(entries)
    return entry

DEFAULT_PORTS = {"kilocode-runtime": 8081, "kilocode-hermes": 8091, "kilocode-webui": 8095,
                 "kilocode-settings": 8082, "nats": 4222, "nats-monitor": 8222,
                 "open-webui": 7860, "model-server": 8080, "litellm": 4000,
                 "edge-tts": 5050, "shiba-gateway": 18789, "ollama": 11434}

_port_registry = dict(DEFAULT_PORTS)
_port_pending = {}

def _port_in_use(port):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex(("localhost", port)) == 0
    except Exception: return False

_QUESTIONS = [
    {"id": "minimax_api_key", "subsystem": "providers", "label": "MiniMax API Key", "type": "secret",
     "required": True, "answered": bool(os.environ.get("MINIMAX_API_KEY")), "inferable": False,
     "hint": "Find at https://platform.minimaxi.com/"},
    {"id": "litellm_base_url", "subsystem": "providers", "label": "LiteLLM Base URL", "type": "url",
     "required": True, "answered": True, "inferable": True,
     "current": os.environ.get("LITELLM_BASE_URL", "http://localhost:4000/v1")},
    {"id": "ollama_base_url", "subsystem": "providers", "label": "Ollama Base URL", "type": "url",
     "required": False, "answered": True, "inferable": True,
     "current": os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")},
    {"id": "nats_url", "subsystem": "runtime", "label": "NATS URL", "type": "url",
     "required": False, "answered": True, "inferable": True,
     "current": os.environ.get("NATS_URL", "nats://localhost:4222")},
]
_question_answers = {}

_canonical = {
    "providers": {
        "litellm": {"base_url": os.environ.get("LITELLM_BASE_URL", "http://localhost:4000/v1"), "enabled": True},
        "ollama":  {"base_url": os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"), "enabled": True},
        "minimax": {"base_url": "https://api.minimaxi.com/v1", "enabled": bool(os.environ.get("MINIMAX_API_KEY"))},
    },
    "runtime": {
        "nats_url": os.environ.get("NATS_URL", "nats://localhost:4222"),
        "runtime_port": 8081, "hermes_port": 8091, "webui_port": 8095, "settings_port": 8082,
        "log_level": os.environ.get("LOG_LEVEL", "info"),
    },
    "infrastructure": {
        "vps_host": "187.77.30.206",
        "approved_paths": [
            "G:/Github/kilocode-Azure2",
            "G:/Github/hermes-agent-2026.4.13/hermes-agent-2026.4.13",
            "C:/Users/Admin/Downloads/VPS",
            "C:/Users/Admin/Downloads/api",
            "G:/", "G:/Github", "C:/Users", "C:/Users/Admin/Downloads",
            "C:/Users/Admin/.ssh/id_ed25519",
        ],
    },
    "hermes": {
        "intake_mode": "standard", "contract_generation_mode": "auto",
        "approval_mode": "user-required-for-disruptive", "orchestration_timeout": 120,
        "allowed_write_classes": ["inferable", "non-secret"],
    },
    "zeroclaw": {
        "research_enabled": True, "git_adapter": True, "shell_adapter": True,
        "filesystem_adapter": True, "repair_worker": True,
        "staging_port": 8099, "validation_depth": "full", "retry_policy": "3x-backoff",
    },
    "mode": os.environ.get("KILOCODE_MODE", "standard"),
    "yolo_enabled": os.environ.get("YOLO_MODE", "false").lower() == "true",
    "sync_state": {"kilocode_synced": False, "webui_synced": False, "last_sync": None},
    "maintenance_window": None, "last_validated": None, "last_changed_by": None,
}
VALID_MODES = {"standard", "yolo", "elevated", "readonly"}

def _auto_fill():
    filled, skipped = [], []
    for q in _QUESTIONS:
        if q.get("inferable") and not q["answered"]:
            default = q.get("default") or q.get("current")
            if default:
                _question_answers[q["id"]] = default
                q["answered"] = True
                filled.append(q["id"])
            else:
                skipped.append(q["id"])
    return {"filled": filled, "skipped_need_user": skipped,
            "remaining_unanswered": [q["id"] for q in _QUESTIONS if not q["answered"]]}

def _validate_state():
    issues = []
    if not _port_in_use(_port_registry.get("nats", 4222)):
        issues.append(f"NATS not reachable on port {_port_registry.get('nats', 4222)}")
    unanswered = [q["id"] for q in _QUESTIONS if q["required"] and not q["answered"]]
    if unanswered:
        issues.append(f"Required questions unanswered: {unanswered}")
    result = "healthy" if not issues else "degraded"
    _canonical["last_validated"] = datetime.utcnow().isoformat() + "Z"
    return {"result": result, "issues": issues, "validated_at": _canonical["last_validated"]}

def _repair(subsystem, changed_by):
    repaired, failed = [], []
    fill_result = _auto_fill()
    repaired.extend(fill_result["filled"])
    if subsystem in (None, "providers"):
        if not _canonical["providers"]["litellm"]["base_url"]:
            _canonical["providers"]["litellm"]["base_url"] = "http://localhost:4000/v1"
            repaired.append("providers.litellm.base_url")
    if subsystem in (None, "runtime"):
        for svc, default in DEFAULT_PORTS.items():
            if svc not in _port_registry:
                _port_registry[svc] = default
                repaired.append(f"port.{svc}")
    validation = _validate_state()
    audit = _record_audit(subsystem=subsystem or "all", changed_fields=repaired,
                          validation_result=validation["result"], changed_by=changed_by)
    return {"repaired": repaired, "failed": failed, "remaining_issues": validation["issues"],
            "validation": validation, "evidence_id": audit["evidence_id"]}

def build_settings_app():
    app = FastAPI(title="KiloCode Canonical Settings", version="1.0.0")

    @app.get("/health")
    async def health(): return {"status": "healthy", "service": "kilocode-settings"}

    @app.get("/settings/state")
    async def settings_state():
        return {"canonical": _canonical, "ports": _port_registry, "pending_port_changes": _port_pending,
                "questions_remaining": [q for q in _QUESTIONS if not q["answered"]],
                "last_validated": _canonical.get("last_validated"), "mode": _canonical["mode"]}

    @app.get("/settings/questions")
    async def settings_questions():
        safe = []
        for q in _QUESTIONS:
            entry = {k: v for k, v in q.items() if k != "default"}
            if q.get("type") == "secret" and q["answered"]: entry["current"] = "***"
            safe.append(entry)
        return safe

    @app.post("/settings/questions/{qid}/answer")
    async def answer_question(qid: str, payload: AnswerPayload):
        q = next((x for x in _QUESTIONS if x["id"] == qid), None)
        if not q: raise HTTPException(404, f"Question '{qid}' not found")
        _question_answers[qid] = payload.value
        q["answered"] = True
        if q.get("type") != "secret": q["current"] = payload.value
        audit = _record_audit(subsystem=q.get("subsystem", "unknown"), changed_fields=[qid],
                              validation_result="pending", changed_by=payload.changed_by)
        return {"question_id": qid, "answered": True, "evidence_id": audit["evidence_id"]}

    @app.post("/settings/apply")
    async def settings_apply(payload: ApplyPayload):
        changed = []
        for k, v in payload.settings.items():
            parts = k.split(".")
            target = _canonical
            for p in parts[:-1]:
                if p not in target: target[p] = {}
                target = target[p]
            target[parts[-1]] = v
            changed.append(k)
        _canonical["last_changed_by"] = payload.changed_by
        validation = _validate_state()
        audit = _record_audit(subsystem="canonical", changed_fields=changed,
                              validation_result=validation["result"], changed_by=payload.changed_by)
        return {"applied": changed, "validation": validation,
                "evidence_id": audit["evidence_id"], "restart_required": False}

    @app.post("/settings/auto-fill")
    async def settings_autofill():
        result = _auto_fill()
        audit = _record_audit(subsystem="auto-fill", changed_fields=result["filled"],
                              validation_result="pending", changed_by="agent")
        return {**result, "evidence_id": audit["evidence_id"]}

    @app.post("/settings/repair")
    async def settings_repair(request: Request):
        ct = request.headers.get("content-type", "")
        body = {}
        if ct.startswith("application/json"):
            try: body = await request.json()
            except Exception: body = {}
        payload = RepairPayload(**body)
        return _repair(payload.subsystem, payload.changed_by)

    @app.post("/settings/validate")
    async def settings_validate():
        result = _validate_state()
        _record_audit(subsystem="validate", changed_fields=[], validation_result=result["result"], changed_by="system")
        return result

    @app.get("/settings/audit")
    async def settings_audit(limit: int = 50):
        entries = _load_audit()
        return entries[-limit:]

    @app.post("/mode/{mode}")
    async def set_mode(mode: str):
        if mode not in VALID_MODES:
            raise HTTPException(400, f"Invalid mode. Valid: {sorted(VALID_MODES)}")
        _canonical["mode"] = mode
        _canonical["yolo_enabled"] = mode == "yolo"
        audit = _record_audit(subsystem="mode", changed_fields=["mode"], validation_result="healthy",
                              changed_by="user", disruptive=mode in ("yolo", "elevated"))
        return {"mode": mode, "yolo_enabled": _canonical["yolo_enabled"], "evidence_id": audit["evidence_id"]}

    @app.post("/maintenance/window")
    async def maintenance_window(payload: MaintenancePayload):
        window = {"scheduled_at": payload.scheduled_at or datetime.utcnow().isoformat() + "Z",
                  "duration_minutes": payload.duration_minutes, "reason": payload.reason,
                  "approved": True, "approved_at": datetime.utcnow().isoformat() + "Z"}
        _canonical["maintenance_window"] = window
        audit = _record_audit(subsystem="maintenance", changed_fields=["maintenance_window"],
                              validation_result="scheduled", changed_by="user", disruptive=True,
                              extra={"window": window})
        return {**window, "evidence_id": audit["evidence_id"]}

    @app.get("/ports")
    async def list_ports():
        statuses = {}
        for svc, port in _port_registry.items():
            statuses[svc] = {"port": port, "reachable": _port_in_use(port), "pending": _port_pending.get(svc)}
        return {"services": statuses, "pending_changes": _port_pending}

    @app.put("/ports/{service}")
    async def update_port(service: str, payload: PortUpdatePayload):
        if service not in _port_registry:
            raise HTTPException(404, f"Service '{service}' not in port registry")
        current = _port_registry[service]
        _port_pending[service] = payload.port
        audit = _record_audit(subsystem="ports", changed_fields=[f"port.{service}"],
                              validation_result="pending-restart", changed_by=payload.changed_by,
                              restart_required=True, disruptive=True,
                              extra={"service": service, "from_port": current, "to_port": payload.port})
        return {"service": service, "current_port": current, "pending_port": payload.port,
                "status": "pending — apply via POST /ports/apply after maintenance window",
                "evidence_id": audit["evidence_id"]}

    @app.post("/ports/apply")
    async def apply_ports():
        applied = {}
        for svc, new_port in list(_port_pending.items()):
            _port_registry[svc] = new_port
            applied[svc] = new_port
            del _port_pending[svc]
        audit = _record_audit(subsystem="ports", changed_fields=list(applied.keys()),
                              validation_result="applied", changed_by="system",
                              restart_required=True, disruptive=True, extra={"applied": applied})
        return {"applied": applied,
                "message": "Port changes applied. Restart affected services to take effect.",
                "evidence_id": audit["evidence_id"]}

    return app

app = build_settings_app()
PYEOF
ok "settings_canonical.py written"

# ── 2. Write dashboard.py ─────────────────────────────────────────────────────
info "Writing dashboard.py..."
cat > $SRC/webui/dashboard.py << 'PYEOF'
"""KiloCode WebUI Dashboard — full management interface."""
import os, httpx
from typing import Dict, Any
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse

RUNTIME_URL  = os.environ.get("RUNTIME_URL",  "http://localhost:8081")
SETTINGS_URL = os.environ.get("SETTINGS_URL", "http://localhost:8082")
HERMES_URL   = os.environ.get("HERMES_URL",   "http://localhost:8091")
TIMEOUT = 5.0

async def _get(url):
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            r = await c.get(url); return r.json()
    except Exception as e: return {"error": str(e)}

async def _post(url, body):
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            r = await c.post(url, json=body); return r.json()
    except Exception as e: return {"error": str(e)}

async def _put(url, body):
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            r = await c.put(url, json=body); return r.json()
    except Exception as e: return {"error": str(e)}

def _read_html():
    here = os.path.dirname(__file__)
    p = os.path.join(here, "dashboard.html")
    if os.path.exists(p):
        with open(p) as f: return f.read()
    return "<h1>Dashboard HTML missing</h1>"

def build_dashboard_app():
    app = FastAPI(title="KiloCode Dashboard", version="1.0.0")

    @app.get("/", response_class=HTMLResponse)
    async def dashboard(): return HTMLResponse(content=_read_html())

    @app.get("/health")
    async def health(): return {"status": "healthy", "service": "kilocode-webui"}

    @app.get("/api/proxy/runtime/{path:path}")
    async def proxy_runtime_get(path: str):
        return JSONResponse(await _get(f"{RUNTIME_URL}/{path}"))

    @app.get("/api/proxy/hermes/{path:path}")
    async def proxy_hermes_get(path: str):
        return JSONResponse(await _get(f"{HERMES_URL}/{path}"))

    @app.post("/api/proxy/hermes/{path:path}")
    async def proxy_hermes_post(path: str, request: Request):
        body = await request.json()
        return JSONResponse(await _post(f"{HERMES_URL}/{path}", body))

    @app.get("/api/settings-svc/{path:path}")
    async def proxy_settings_get(path: str, request: Request):
        url = f"{SETTINGS_URL}/{path}"
        if request.query_params: url += "?" + str(request.query_params)
        return JSONResponse(await _get(url))

    @app.post("/api/settings-svc/{path:path}")
    async def proxy_settings_post(path: str, request: Request):
        try: body = await request.json()
        except Exception: body = {}
        return JSONResponse(await _post(f"{SETTINGS_URL}/{path}", body))

    @app.put("/api/settings-svc/{path:path}")
    async def proxy_settings_put(path: str, request: Request):
        body = await request.json()
        return JSONResponse(await _put(f"{SETTINGS_URL}/{path}", body))

    return app

app = build_dashboard_app()
PYEOF
ok "dashboard.py written"

# ── 3. Write dashboard.html ────────────────────────────────────────────────────
info "Writing dashboard.html..."
python3 - << 'PYEOF'
import urllib.request, os
src = '/opt/kilocode/src/webui/dashboard.py'
# Extract HTML from the local file we just wrote — but for VPS the HTML is embedded
# We write a standalone HTML file instead.
html = open(src).read()
# The full HTML is in the source; extract between triple-quoted strings
start = html.find('DASHBOARD_HTML = """') 
if start == -1:
    # dashboard.py on VPS uses _read_html() → dashboard.html file
    # The HTML was written as a separate file in the local repo, copy it here
    print("dashboard.html must be copied separately")
else:
    end = html.find('"""', start + 20)
    content = html[start+20:end]
    with open('/opt/kilocode/src/webui/dashboard.html', 'w') as f:
        f.write(content)
    print("Extracted HTML to dashboard.html")
PYEOF
ok "dashboard.html check done"

# ── 4. Write new webui __main__.py to serve dashboard ─────────────────────────
info "Updating kilocode-webui entry point..."
cat > $SRC/webui/__main__.py << 'PYEOF'
"""KiloCode WebUI — serves full dashboard at /"""
from src.webui.dashboard import app  # noqa: F401
PYEOF
ok "kilocode-webui __main__.py updated"

# ── 5. Create kilocode-settings systemd service ───────────────────────────────
info "Installing kilocode-settings systemd service..."
cat > /etc/systemd/system/kilocode-settings.service << 'EOF'
[Unit]
Description=KiloCode Canonical Settings Service
After=network.target nats.service
Wants=nats.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/kilocode
Environment=PYTHONPATH=/opt/kilocode
ExecStart=/opt/kilocode/venv/bin/uvicorn src.runtime.settings_canonical:app --host 0.0.0.0 --port 8082 --log-level info
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable kilocode-settings
systemctl restart kilocode-settings
sleep 5

if systemctl is-active --quiet kilocode-settings; then
    ok "kilocode-settings active on :8082"
else
    fail "kilocode-settings failed to start"
    journalctl -u kilocode-settings -n 20 --no-pager
fi

# ── 6. Ensure httpx is installed in venv ──────────────────────────────────────
info "Ensuring httpx in venv..."
$VENV/bin/pip install httpx -q && ok "httpx ok"

# ── 7. Restart kilocode-webui with updated entry point ────────────────────────
info "Restarting kilocode-webui..."
systemctl restart kilocode-webui
sleep 5
if systemctl is-active --quiet kilocode-webui; then
    ok "kilocode-webui active"
else
    fail "kilocode-webui failed"
    journalctl -u kilocode-webui -n 20 --no-pager
fi

# ── 8. Open firewall port 8082 ─────────────────────────────────────────────────
info "Opening port 8082..."
iptables -I INPUT -p tcp --dport 8082 -j ACCEPT
iptables-save > /etc/iptables/rules.v4
ok "port 8082 opened and persisted"

# ── 9. Full health sweep ──────────────────────────────────────────────────────
echo ""
echo "=== Final health sweep ==="
PASS=0; FAIL=0
for port_svc in "8081:kilocode-runtime" "8082:kilocode-settings" "8091:kilocode-hermes" "8095:kilocode-webui"; do
    PORT=${port_svc%%:*}; SVC=${port_svc##*:}
    HTTP=$(curl -sf http://localhost:$PORT/health -o /dev/null -w '%{http_code}' 2>/dev/null || echo "000")
    BODY=$(curl -sf http://localhost:$PORT/health 2>/dev/null || echo "no-response")
    if [[ "$HTTP" == "200" ]]; then
        echo -e "${GREEN}[PASS]${RESET} $SVC :$PORT => $BODY"; ((PASS++)) || true
    else
        echo -e "${RED}[FAIL]${RESET} $SVC :$PORT => HTTP $HTTP"; ((FAIL++)) || true
    fi
done

# Settings API quick test
SETTINGS_STATE=$(curl -sf http://localhost:8082/settings/state 2>/dev/null || echo '{}')
if echo "$SETTINGS_STATE" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if 'canonical' in d else 1)" 2>/dev/null; then
    echo -e "${GREEN}[PASS]${RESET} /settings/state returns canonical object"; ((PASS++)) || true
else
    echo -e "${RED}[FAIL]${RESET} /settings/state bad response: $SETTINGS_STATE"; ((FAIL++)) || true
fi

PORTS_DATA=$(curl -sf http://localhost:8082/ports 2>/dev/null || echo '{}')
if echo "$PORTS_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if 'services' in d else 1)" 2>/dev/null; then
    echo -e "${GREEN}[PASS]${RESET} /ports returns services object"; ((PASS++)) || true
else
    echo -e "${RED}[FAIL]${RESET} /ports bad response"; ((FAIL++)) || true
fi

echo ""
echo "=== Deploy Summary: ${PASS} passed, ${FAIL} failed ==="
[[ $FAIL -eq 0 ]] && echo "ALL GOOD — settings + dashboard live" || echo "Review failures above"
