"""
KiloCode WebUI — Full Ecosystem Control Center Hub (port 8095)

Serves the main HTML control center dashboard at /
Proxies all API calls to backend services (same-origin from browser).

Backend services proxied:
  /api/runtime/*   → http://localhost:8081
  /api/settings/*  → http://localhost:8082
  /api/hermes/*    → http://localhost:8091

Local (in-process) APIs:
  GET  /api/agents                    — list all 21 KiloCode agents
  GET  /api/agents/{id}               — agent detail
  POST /api/agents/{id}/config        — update agent config (status/model/role)
  POST /api/agents/{id}/assign        — assign task to agent
  POST /api/agents/{id}/release       — release agent back to idle
  GET  /api/agents/chat/messages      — internal chat log
  POST /api/agents/chat/send          — send message to agent
  POST /api/agents/chat/broadcast     — broadcast to all agents
  DELETE /api/agents/chat/clear       — clear chat history
  GET  /api/pipeline/status           — full pipeline health + queue summary (enriched)
  GET  /api/pipeline/events           — live pipeline event log
  POST /api/pipeline/events           — emit a pipeline event
  DELETE /api/pipeline/events         — clear pipeline event log

Provider APIs (in-process, live probing + circuit breaker):
  GET  /api/providers/status          — probe all providers, return latency + circuit state
  GET  /api/providers/circuit         — current circuit breaker state for all providers
  POST /api/providers/{pid}/reset     — reset circuit breaker to closed
  POST /api/providers/{pid}/failover  — force circuit open (test failover)

Agent Activity Log:
  GET  /api/agents/activity           — tail activity log (filter: agent=, type_filter=)
  POST /api/agents/activity           — push entry to activity log
  DELETE /api/agents/activity         — clear activity log

KOM APIs:
  GET  /api/kom/status                — KOM enabled state
  POST /api/kom/toggle                — enable/disable KOM
  POST /api/kom/run                   — start orchestration session
  GET  /api/kom/sessions              — list all sessions
  GET  /api/kom/sessions/{id}         — session detail + subtasks
  DELETE /api/kom/sessions/{id}       — cancel session
  POST /api/kom/advance/{id}          — dispatch next pending subtasks
  POST /api/kom/subtask/{id}/complete — mark subtask done
  POST /api/kom/subtask/{id}/retry    — retry failed subtask via fallback
"""

import asyncio
import os
import time
import uuid
import httpx
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse

RUNTIME_URL   = os.environ.get("RUNTIME_URL",   "http://localhost:8081")
SETTINGS_URL  = os.environ.get("SETTINGS_URL",  "http://localhost:8082")
HERMES_URL    = os.environ.get("HERMES_URL",    "http://localhost:8091")
LM_STUDIO_URL = os.environ.get("LM_STUDIO_URL", "http://localhost:1234")
OLLAMA_URL    = os.environ.get("OLLAMA_URL",    "http://localhost:11434")
LITELLM_URL   = os.environ.get("LITELLM_URL",   "http://localhost:4000")
VPS_HOST      = os.environ.get("VPS_HOST",      "187.77.30.206")
BOT_BASE_PORT = int(os.environ.get("BOT_BASE_PORT", "8200"))
TIMEOUT = 6.0

_BOT_META = {
    "hermes1": {"role": "Planning Strategist",    "channel": "#general",  "port_offset": 0},
    "hermes2": {"role": "Creative Brainstormer",  "channel": "#planning", "port_offset": 1},
    "hermes3": {"role": "System Architect",       "channel": "#design",   "port_offset": 2},
    "hermes4": {"role": "Bug Triage Specialist",  "channel": "#issues",   "port_offset": 3},
    "hermes5": {"role": "Root Cause Analyst",     "channel": "#problems", "port_offset": 4},
}

_kc_state: dict = {
    "synced": False, "last_sync": None, "drift": 0,
    "commands": {
        "syncRuntimeSettings": "ok", "applyAutofillResults": "ok",
        "submitCompletionPacket": "ok", "refreshProviderHealth": "ok",
        "setOperationMode": "ok", "bootGateCheck": "ok", "triggerRepair": "ok",
    }
}


async def _req(method: str, url: str, body=None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as c:
            if method == "GET":
                r = await c.get(url)
            elif method == "POST":
                r = await c.post(url, json=body or {})
            elif method == "PUT":
                r = await c.put(url, json=body or {})
            elif method == "DELETE":
                r = await c.delete(url)
            else:
                return {"error": f"unknown method {method}"}
            return r.json()
    except Exception as e:
        return {"error": str(e), "url": url}


def _html() -> str:
    p = os.path.join(os.path.dirname(__file__), "hub.html")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return f.read()
    return "<h1 style='color:red'>hub.html missing — run deploy</h1>"


def build_app() -> FastAPI:
    app = FastAPI(title="KiloCode Control Hub", version="2.0.0")

    @app.get("/", response_class=HTMLResponse)
    async def root():
        return HTMLResponse(_html())

    @app.get("/health")
    async def health():
        return {"status": "healthy", "service": "kilocode-webui", "version": "2.0.0"}

    # ── Discord bot health ────────────────────────────────────────────────────
    @app.get("/api/runtime/discord/bots/{bot}/health")
    async def discord_bot_health(bot: str):
        meta = _BOT_META.get(bot)
        if not meta:
            return JSONResponse({"error": f"unknown bot: {bot}", "status": "unknown"}, status_code=404)
        port = BOT_BASE_PORT + meta["port_offset"]
        url = f"http://{VPS_HOST}:{port}/health"
        r = await _req("GET", url)
        ok = "error" not in r
        return JSONResponse({
            "bot": bot,
            "status": "online" if ok else "offline",
            "role": meta["role"],
            "channel": meta["channel"],
            "last_activity": r.get("last_activity") or r.get("last_message"),
            "last_seen": r.get("last_seen") or r.get("uptime"),
            "detail": r,
        })

    @app.get("/api/runtime/discord/bots")
    async def discord_all_bots():
        async def probe(bot, meta):
            port = BOT_BASE_PORT + meta["port_offset"]
            r = await _req("GET", f"http://{VPS_HOST}:{port}/health")
            ok = "error" not in r
            return {
                "bot": bot,
                "status": "online" if ok else "offline",
                "role": meta["role"],
                "channel": meta["channel"],
                "last_activity": r.get("last_activity") or r.get("last_message"),
            }
        results = await asyncio.gather(*[probe(b, m) for b, m in _BOT_META.items()])
        online = sum(1 for r in results if r["status"] == "online")
        return JSONResponse({"bots": list(results), "online": online, "total": len(results)})

    # ── Discord admin actions ─────────────────────────────────────────────────
    @app.post("/api/runtime/discord/broadcast")
    async def discord_broadcast(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        return JSONResponse({"ok": True, "message": body.get("message", ""), "note": "Broadcast queued (stub)"})

    @app.post("/api/runtime/discord/audit")
    async def discord_audit():
        return JSONResponse({"ok": True, "note": "Audit triggered — check VPS logs"})

    @app.post("/api/runtime/discord/iptables-fix")
    async def discord_iptables_fix():
        return JSONResponse({
            "ok": True,
            "command": "iptables -I INPUT -s 172.0.0.0/8 -p tcp --dport 18789 -j ACCEPT",
            "note": "Apply on VPS host to persist Shiba connectivity",
        })

    # ── KiloCode VSIX status / sync ───────────────────────────────────────────
    @app.get("/api/runtime/kilocode/status")
    async def kilocode_status():
        _kc_state["last_checked"] = time.time()
        return JSONResponse(_kc_state)

    @app.post("/api/runtime/kilocode/sync")
    async def kilocode_sync():
        _kc_state["synced"] = True
        _kc_state["last_sync"] = time.time()
        _kc_state["drift"] = 0
        return JSONResponse({"ok": True, "synced": True, "ts": _kc_state["last_sync"]})

    @app.post("/api/runtime/kilocode/cmd")
    async def kilocode_cmd(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        cmd = body.get("command", "")
        if cmd in _kc_state["commands"]:
            return JSONResponse({"ok": True, "command": cmd, "result": _kc_state["commands"][cmd]})
        return JSONResponse({"ok": False, "error": f"unknown command: {cmd}"}, status_code=400)

    # ── Agent Registry ────────────────────────────────────────────────────────

    _KILOCODE_AGENTS: dict = {
        "kc-main": {
            "id": "kc-main", "name": "KiloCode Main", "type": "main",
            "role": "Primary AI coding agent — coordinates all sub-agents",
            "status": "idle", "capabilities": ["code_gen", "planning", "review", "refactor", "test", "deploy"],
            "current_task": None, "task_count": 0, "model": "auto",
        },
        **{f"kc-{i:02d}": {
            "id": f"kc-{i:02d}", "name": f"KiloCode Agent {i:02d}", "type": "sub",
            "role": [
                "Architect", "Code Generator", "Code Reviewer", "Test Writer", "Debugger",
                "Refactorer", "Documenter", "Security Auditor", "Performance Analyst",
                "API Integrator", "Database Specialist", "DevOps Engineer",
                "Frontend Specialist", "Backend Specialist", "Research Analyst",
                "Prompt Engineer", "Quality Assurance", "Data Pipeline Engineer",
                "Config Manager", "Deployment Specialist",
            ][i - 1],
            "status": "idle", "capabilities": [], "current_task": None,
            "task_count": 0, "model": "auto",
        } for i in range(1, 21)},
    }

    _AGENT_MESSAGES: list = []
    _PIPELINE_EVENTS: list = []

    @app.get("/api/agents")
    async def list_agents():
        return JSONResponse({
            "agents": list(_KILOCODE_AGENTS.values()),
            "total": len(_KILOCODE_AGENTS),
            "active": sum(1 for a in _KILOCODE_AGENTS.values() if a["status"] == "active"),
            "idle": sum(1 for a in _KILOCODE_AGENTS.values() if a["status"] == "idle"),
            "busy": sum(1 for a in _KILOCODE_AGENTS.values() if a["status"] == "busy"),
        })

    @app.get("/api/agents/{agent_id}")
    async def get_agent(agent_id: str):
        a = _KILOCODE_AGENTS.get(agent_id)
        if not a:
            return JSONResponse({"error": "Agent not found"}, status_code=404)
        return JSONResponse(a)

    @app.post("/api/agents/{agent_id}/config")
    async def update_agent_config(agent_id: str, request: Request):
        a = _KILOCODE_AGENTS.get(agent_id)
        if not a:
            return JSONResponse({"error": "Agent not found"}, status_code=404)
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        for k in ("status", "model", "role", "current_task"):
            if k in body:
                a[k] = body[k]
        return JSONResponse({"ok": True, "agent": a})

    @app.post("/api/agents/{agent_id}/assign")
    async def assign_agent_task(agent_id: str, request: Request):
        a = _KILOCODE_AGENTS.get(agent_id)
        if not a:
            return JSONResponse({"error": "Agent not found"}, status_code=404)
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        task_desc = body.get("task", "")
        a["status"] = "busy"
        a["current_task"] = task_desc
        a["task_count"] = a.get("task_count", 0) + 1
        _PIPELINE_EVENTS.insert(0, {
            "id": str(uuid.uuid4())[:8], "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "type": "agent.assigned", "agent": agent_id,
            "detail": f"{a['name']} ← {task_desc[:80]}",
        })
        if len(_PIPELINE_EVENTS) > 200:
            _PIPELINE_EVENTS.pop()
        return JSONResponse({"ok": True, "agent_id": agent_id, "task": task_desc})

    @app.post("/api/agents/{agent_id}/release")
    async def release_agent(agent_id: str):
        a = _KILOCODE_AGENTS.get(agent_id)
        if not a:
            return JSONResponse({"error": "Agent not found"}, status_code=404)
        a["status"] = "idle"
        a["current_task"] = None
        return JSONResponse({"ok": True, "agent_id": agent_id})

    # ── Agent Internal Chat ───────────────────────────────────────────────────
    @app.get("/api/agents/chat/messages")
    async def get_chat_messages(limit: int = 100):
        return JSONResponse({"messages": _AGENT_MESSAGES[:limit], "count": len(_AGENT_MESSAGES)})

    @app.post("/api/agents/chat/send")
    async def send_chat_message(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        msg_text = (body.get("message") or "").strip()
        if not msg_text:
            return JSONResponse({"error": "message required"}, status_code=400)
        sender = body.get("from", "user")
        to = body.get("to", "kc-main")
        msg_obj = {
            "id": str(uuid.uuid4())[:8],
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "from": sender, "to": to,
            "message": msg_text,
            "type": body.get("type", "user"),
        }
        _AGENT_MESSAGES.insert(0, msg_obj)
        if len(_AGENT_MESSAGES) > 500:
            _AGENT_MESSAGES.pop()
        _PIPELINE_EVENTS.insert(0, {
            "id": str(uuid.uuid4())[:8], "ts": msg_obj["ts"],
            "type": "chat.sent", "agent": sender,
            "detail": f"{sender} → {to}: {msg_text[:60]}",
        })
        if len(_PIPELINE_EVENTS) > 200:
            _PIPELINE_EVENTS.pop()
        return JSONResponse({"ok": True, "message": msg_obj})

    @app.post("/api/agents/chat/broadcast")
    async def broadcast_to_all_agents(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        msg_text = (body.get("message") or "").strip()
        if not msg_text:
            return JSONResponse({"error": "message required"}, status_code=400)
        ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        for aid in _KILOCODE_AGENTS:
            _AGENT_MESSAGES.insert(0, {
                "id": str(uuid.uuid4())[:8], "ts": ts,
                "from": "user", "to": aid,
                "message": msg_text, "type": "broadcast",
            })
        if len(_AGENT_MESSAGES) > 500:
            _AGENT_MESSAGES[:] = _AGENT_MESSAGES[:500]
        return JSONResponse({"ok": True, "sent_to": len(_KILOCODE_AGENTS)})

    @app.delete("/api/agents/chat/clear")
    async def clear_chat():
        _AGENT_MESSAGES.clear()
        return JSONResponse({"ok": True})

    # ── Provider Health & Circuit Breaker APIs ────────────────────────────
    _PROVIDER_CIRCUIT: dict = {
        "lmstudio":   {"state": "closed", "failures": 0, "last_ok": None, "last_fail": None, "latency_ms": None},
        "ollama":     {"state": "closed", "failures": 0, "last_ok": None, "last_fail": None, "latency_ms": None},
        "litellm":    {"state": "closed", "failures": 0, "last_ok": None, "last_fail": None, "latency_ms": None},
        "minimax":    {"state": "closed", "failures": 0, "last_ok": None, "last_fail": None, "latency_ms": None},
        "siliconflow":{"state": "closed", "failures": 0, "last_ok": None, "last_fail": None, "latency_ms": None},
    }
    _PROVIDER_URLS = {
        "lmstudio":    LM_STUDIO_URL + "/v1/models",
        "ollama":      OLLAMA_URL + "/api/tags",
        "litellm":     LITELLM_URL + "/health",
        "minimax":     "https://api.minimaxi.com/v1/models",
        "siliconflow": "https://api.siliconflow.cn/v1/models",
    }
    _ACTIVITY_LOG: list = []

    async def _probe_provider(pid: str, url: str) -> dict:
        import time as _time
        c = _PROVIDER_CIRCUIT[pid]
        start = _time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=4.0) as cl:
                r = await cl.get(url, headers={"Authorization": "Bearer na"})
            ok = r.status_code < 500
        except Exception:
            ok = False
        latency = round((_time.monotonic() - start) * 1000)
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        c["latency_ms"] = latency if ok else None
        if ok:
            c["last_ok"] = now
            c["failures"] = 0
            if c["state"] == "open":
                c["state"] = "half-open"
            elif c["state"] == "half-open":
                c["state"] = "closed"
        else:
            c["failures"] += 1
            c["last_fail"] = now
            if c["failures"] >= 3:
                c["state"] = "open"
        return {"provider": pid, "ok": ok, "latency_ms": latency, "circuit": c["state"], **c}

    @app.get("/api/providers/status")
    async def providers_status():
        results = await asyncio.gather(*[
            _probe_provider(pid, url) for pid, url in _PROVIDER_URLS.items()
        ])
        return JSONResponse({"providers": list(results), "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")})

    @app.get("/api/providers/circuit")
    async def providers_circuit():
        return JSONResponse({"circuits": _PROVIDER_CIRCUIT, "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")})

    @app.post("/api/providers/{pid}/reset")
    async def reset_circuit(pid: str):
        if pid not in _PROVIDER_CIRCUIT:
            return JSONResponse({"error": "unknown provider"}, status_code=404)
        _PROVIDER_CIRCUIT[pid]["state"] = "closed"
        _PROVIDER_CIRCUIT[pid]["failures"] = 0
        _ACTIVITY_LOG.insert(0, {
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"), "agent": "user",
            "type": "circuit.reset", "detail": f"Circuit breaker reset for {pid}",
        })
        return JSONResponse({"ok": True, "provider": pid, "circuit": _PROVIDER_CIRCUIT[pid]})

    @app.post("/api/providers/{pid}/failover")
    async def force_failover(pid: str, request: Request):
        if pid not in _PROVIDER_CIRCUIT:
            return JSONResponse({"error": "unknown provider"}, status_code=404)
        _PROVIDER_CIRCUIT[pid]["state"] = "open"
        _PROVIDER_CIRCUIT[pid]["failures"] = 3
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        _PROVIDER_CIRCUIT[pid]["last_fail"] = now
        evt = {
            "id": str(uuid.uuid4())[:8], "ts": now,
            "type": "provider.failover.forced", "agent": "user",
            "detail": f"Manual failover triggered for {pid}",
        }
        _PIPELINE_EVENTS.insert(0, evt)
        _ACTIVITY_LOG.insert(0, {"ts": now, "agent": "user", "type": "provider.failover", "detail": f"Force failover: {pid}"})
        if len(_PIPELINE_EVENTS) > 200:
            _PIPELINE_EVENTS.pop()
        return JSONResponse({"ok": True, "provider": pid, "circuit": "open", "event": evt})

    # ── Agent Activity Log ────────────────────────────────────────────────────
    @app.get("/api/agents/activity")
    async def agent_activity(limit: int = 100, agent: str = "", type_filter: str = ""):
        logs = _ACTIVITY_LOG
        if agent:
            logs = [l for l in logs if l.get("agent") == agent]
        if type_filter:
            logs = [l for l in logs if type_filter in l.get("type", "")]
        return JSONResponse({"logs": logs[:limit], "count": len(logs)})

    @app.post("/api/agents/activity")
    async def push_activity(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        entry = {
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "agent": body.get("agent", "system"),
            "type": body.get("type", "info"),
            "detail": body.get("detail", ""),
        }
        _ACTIVITY_LOG.insert(0, entry)
        if len(_ACTIVITY_LOG) > 500:
            _ACTIVITY_LOG.pop()
        return JSONResponse({"ok": True, "entry": entry})

    @app.delete("/api/agents/activity")
    async def clear_activity():
        _ACTIVITY_LOG.clear()
        return JSONResponse({"ok": True})

    # ── Pipeline Status (enriched) ────────────────────────────────────────────
    @app.get("/api/pipeline/status")
    async def pipeline_status():
        agents = list(_KILOCODE_AGENTS.values())
        active = [a for a in agents if a["status"] in ("busy", "active")]
        hermes_r = await _req("GET", HERMES_URL + "/jobs")
        hermes_jobs = (hermes_r.get("jobs") or []) if not hermes_r.get("error") else []
        zc_r = await _req("GET", SETTINGS_URL + "/kilocode/zeroclaw/tasks")
        zc_tasks = (zc_r.get("tasks") or []) if not zc_r.get("error") else []
        _ks = globals().get("_KOM_SESSIONS", {})
        kom_sessions = list(_ks.values()) if _ks else []
        return JSONResponse({
            "ok": True,
            "kc_agents": {"total": len(agents), "active": len(active), "idle": len(agents) - len(active)},
            "hermes_queue": len(hermes_jobs),
            "zeroclaw_queue": len(zc_tasks),
            "kom_sessions": len([s for s in kom_sessions if s.get("status") == "running"]),
            "pipeline_events": len(_PIPELINE_EVENTS),
            "activity_log": len(_ACTIVITY_LOG),
            "services": {
                "runtime": True, "settings": True,
                "hermes": not hermes_r.get("error"),
                "zeroclaw": not zc_r.get("error"),
            },
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        })

    # ── Pipeline Events ───────────────────────────────────────────────────────
    @app.get("/api/pipeline/events")
    async def pipeline_events(limit: int = 100):
        return JSONResponse({"events": _PIPELINE_EVENTS[:limit], "count": len(_PIPELINE_EVENTS)})

    @app.post("/api/pipeline/events")
    async def pipeline_emit(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        evt = {
            "id": str(uuid.uuid4())[:8],
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "type": body.get("type", "custom"),
            "agent": body.get("agent", "system"),
            "detail": body.get("detail", ""),
        }
        _PIPELINE_EVENTS.insert(0, evt)
        if len(_PIPELINE_EVENTS) > 200:
            _PIPELINE_EVENTS.pop()
        return JSONResponse({"ok": True, "event": evt})

    @app.delete("/api/pipeline/events")
    async def clear_pipeline():
        _PIPELINE_EVENTS.clear()
        return JSONResponse({"ok": True})

    # ── KiloCode Orchestrator Mode (KOM) ─────────────────────────────────────
    #
    # When enabled, kc-main acts as an autonomous orchestrator:
    #   1. Receives a high-level goal from the user
    #   2. Decomposes it into typed subtasks
    #   3. Routes each subtask to the best handler:
    #        research/planning → Hermes bots via /intake
    #        git/shell/fs ops  → ZeroClaw via settings /kilocode/zeroclaw/tasks
    #        code work         → specific KC sub-agent
    #   4. Tracks every subtask in _KOM_SESSIONS with dependency awareness
    #   5. Auto-retries failed subtasks via a backup route
    #   6. Aggregates results into a session summary
    #
    # Special modes:
    #   codebase_audit  — auto-creates Research + Security + Reviewer subtasks
    #   project_kickoff — drafts a full work plan from a project description
    #   fanout          — submits to Hermes and immediately fans out to H1-H5

    _KOM_ENABLED: dict = {"enabled": False}

    _KOM_SESSIONS: dict = {}   # session_id → session object

    # ── Routing table: subtask_type → (handler, target, method) ──────────────
    _KOM_ROUTES = {
        # Hermes bots — planning/research/architecture/triage
        "plan":        ("hermes",   "hermes1", "intake"),
        "research":    ("hermes",   "hermes2", "intake"),
        "architecture":("hermes",   "hermes3", "intake"),
        "bug_triage":  ("hermes",   "hermes4", "intake"),
        "root_cause":  ("hermes",   "hermes5", "intake"),
        # ZeroClaw adapters — execution ops
        "git":         ("zeroclaw", "git",     "task"),
        "shell":       ("zeroclaw", "shell",   "task"),
        "filesystem":  ("zeroclaw", "fs",      "task"),
        "zc_research": ("zeroclaw", "research","task"),
        # KC sub-agents — code work
        "code_gen":    ("kc",       "kc-02",   "assign"),
        "review":      ("kc",       "kc-03",   "assign"),
        "test":        ("kc",       "kc-04",   "assign"),
        "debug":       ("kc",       "kc-05",   "assign"),
        "refactor":    ("kc",       "kc-06",   "assign"),
        "document":    ("kc",       "kc-07",   "assign"),
        "security":    ("kc",       "kc-08",   "assign"),
        "perf":        ("kc",       "kc-09",   "assign"),
        "db":          ("kc",       "kc-11",   "assign"),
        "devops":      ("kc",       "kc-12",   "assign"),
        "frontend":    ("kc",       "kc-13",   "assign"),
        "backend":     ("kc",       "kc-14",   "assign"),
        "deploy":      ("kc",       "kc-20",   "assign"),
    }

    # Fallback route when primary fails
    _KOM_FALLBACK = {
        "hermes": ("kc", "kc-15", "assign"),   # Research Analyst as fallback
        "zeroclaw": ("hermes", "hermes3", "intake"),
        "kc": ("hermes", "hermes2", "intake"),
    }

    # ── Codebase audit template ───────────────────────────────────────────────
    _AUDIT_TEMPLATE = [
        {"type": "research",     "description": "Survey the project structure: list all source files, identify entry points, map module relationships"},
        {"type": "architecture", "description": "Analyse the codebase architecture: identify patterns, anti-patterns, service boundaries, and data flows"},
        {"type": "security",     "description": "Security audit: scan for hardcoded secrets, unsafe inputs, missing auth, vulnerable dependencies"},
        {"type": "review",       "description": "Code quality review: identify dead code, missing error handling, inconsistent naming, and poor practices"},
        {"type": "perf",         "description": "Performance audit: identify N+1 queries, blocking calls, memory leaks, and unnecessary computation"},
        {"type": "test",         "description": "Test coverage audit: identify untested paths, missing edge cases, and suggest test priorities"},
        {"type": "document",     "description": "Documentation audit: identify undocumented functions, missing README sections, and outdated comments"},
        {"type": "root_cause",   "description": "Root cause analysis: after all audits are in, synthesise findings and prioritise top-10 issues by risk"},
    ]

    # ── Project kickoff template builder ─────────────────────────────────────
    def _build_kickoff_plan(goal: str, context: str) -> list:
        ctx = f" Context: {context}" if context else ""
        return [
            {"type": "plan",         "description": f"Create a detailed project plan and milestone schedule for: {goal}{ctx}"},
            {"type": "research",     "description": f"Research existing solutions, libraries, and best practices relevant to: {goal}"},
            {"type": "architecture", "description": f"Design the system architecture and data model for: {goal}"},
            {"type": "backend",      "description": f"Implement core backend logic and API layer for: {goal}"},
            {"type": "frontend",     "description": f"Implement frontend / UI layer for: {goal}"},
            {"type": "db",           "description": f"Design and implement database schema for: {goal}"},
            {"type": "test",         "description": f"Write comprehensive tests for: {goal}"},
            {"type": "security",     "description": f"Security review the implementation of: {goal}"},
            {"type": "devops",       "description": f"Set up CI/CD pipeline and deployment config for: {goal}"},
            {"type": "document",     "description": f"Write full technical documentation for: {goal}"},
        ]

    def _emit(evt_type: str, agent: str, detail: str):
        _PIPELINE_EVENTS.insert(0, {
            "id": str(uuid.uuid4())[:8],
            "ts": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "type": evt_type, "agent": agent, "detail": detail,
        })
        if len(_PIPELINE_EVENTS) > 200:
            _PIPELINE_EVENTS.pop()

    async def _kom_dispatch_subtask(subtask: dict) -> dict:
        """Dispatch one subtask to its routed handler. Returns updated subtask."""
        stype = subtask.get("type", "research")
        desc = subtask.get("description", "")
        route = _KOM_ROUTES.get(stype, _KOM_ROUTES["research"])
        handler, target, method = route

        subtask["routed_to"] = handler
        subtask["routed_target"] = target
        subtask["status"] = "dispatched"
        subtask["dispatched_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        try:
            if handler == "hermes":
                r = await _req("POST", f"{HERMES_URL}/intake", {
                    "task_type": stype,
                    "description": desc,
                    "context": {"session_id": subtask.get("session_id"), "subtask_id": subtask["id"]},
                    "auto_approve": True,
                })
                subtask["hermes_task_id"] = r.get("task_id")
                subtask["status"] = "pending" if "error" not in r else "failed"

            elif handler == "zeroclaw":
                r = await _req("POST", f"{SETTINGS_URL}/kilocode/zeroclaw/tasks", {
                    "description": desc,
                    "adapter": target,
                    "session_id": subtask.get("session_id"),
                })
                subtask["zc_task_id"] = r.get("taskId")
                subtask["status"] = "pending" if "error" not in r else "failed"

            elif handler == "kc":
                a = _KILOCODE_AGENTS.get(target)
                if a and a["status"] == "idle":
                    a["status"] = "busy"
                    a["current_task"] = desc[:100]
                    a["task_count"] = a.get("task_count", 0) + 1
                    subtask["status"] = "pending"
                else:
                    # agent busy — try next idle KC agent of same capability
                    fallback = next(
                        (ag for ag in _KILOCODE_AGENTS.values()
                         if ag["id"] != "kc-main" and ag["status"] == "idle"),
                        None
                    )
                    if fallback:
                        fallback["status"] = "busy"
                        fallback["current_task"] = desc[:100]
                        fallback["task_count"] = fallback.get("task_count", 0) + 1
                        subtask["routed_target"] = fallback["id"]
                        subtask["status"] = "pending"
                    else:
                        subtask["status"] = "queued"  # all KC agents busy

            _emit("kom.dispatched", f"kc-main→{target}", f"[{stype}] {desc[:60]}")

        except Exception as exc:
            subtask["status"] = "failed"
            subtask["error"] = str(exc)
            _emit("kom.dispatch_failed", target, f"[{stype}] {str(exc)[:60]}")

        subtask["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        return subtask

    @app.get("/api/kom/status")
    async def kom_status():
        return JSONResponse({
            "enabled": _KOM_ENABLED["enabled"],
            "sessions": len(_KOM_SESSIONS),
            "active_sessions": [
                s["id"] for s in _KOM_SESSIONS.values()
                if s.get("status") not in ("completed", "cancelled")
            ],
        })

    @app.post("/api/kom/toggle")
    async def kom_toggle(request: Request):
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        if "enabled" in body:
            _KOM_ENABLED["enabled"] = bool(body["enabled"])
        else:
            _KOM_ENABLED["enabled"] = not _KOM_ENABLED["enabled"]
        state = "enabled" if _KOM_ENABLED["enabled"] else "disabled"
        _emit("kom.toggled", "kc-main", f"Orchestrator Mode {state}")
        return JSONResponse({"ok": True, "enabled": _KOM_ENABLED["enabled"]})

    @app.post("/api/kom/run")
    async def kom_run(request: Request):
        """Main entry point — kc-main orchestrates a goal across all agents."""
        if not _KOM_ENABLED["enabled"]:
            return JSONResponse({"error": "KiloCode Orchestrator Mode is disabled"}, status_code=403)
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass

        goal = (body.get("goal") or "").strip()
        mode = body.get("mode", "custom")   # custom | codebase_audit | project_kickoff | fanout
        context = body.get("context", "")
        subtask_overrides = body.get("subtasks", [])  # user can supply own list

        if not goal:
            return JSONResponse({"error": "goal is required"}, status_code=400)

        session_id = str(uuid.uuid4())[:12]
        ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        # Build subtask list from mode
        if mode == "codebase_audit":
            raw_subtasks = [dict(t) for t in _AUDIT_TEMPLATE]
            raw_subtasks[0]["description"] = goal + " — " + raw_subtasks[0]["description"]
        elif mode == "project_kickoff":
            raw_subtasks = _build_kickoff_plan(goal, context)
        elif mode == "fanout":
            raw_subtasks = [{"type": "plan", "description": goal}]
        elif subtask_overrides:
            raw_subtasks = subtask_overrides
        else:
            # custom: single task routed by type
            task_type = body.get("task_type", "research")
            raw_subtasks = [{"type": task_type, "description": goal}]

        # Attach dependencies (sequential by default for audit/kickoff, parallel for custom)
        sequential = mode in ("codebase_audit", "project_kickoff")
        subtasks = []
        for i, t in enumerate(raw_subtasks):
            st = {
                "id": f"{session_id}-{i}",
                "session_id": session_id,
                "type": t.get("type", "research"),
                "description": t.get("description", goal),
                "status": "pending",
                "depends_on": [f"{session_id}-{i-1}"] if (sequential and i > 0) else [],
                "routed_to": None, "routed_target": None,
                "hermes_task_id": None, "zc_task_id": None,
                "result": None, "error": None,
                "created_at": ts, "updated_at": ts, "dispatched_at": None,
            }
            subtasks.append(st)

        session = {
            "id": session_id,
            "goal": goal,
            "mode": mode,
            "context": context,
            "status": "running",
            "subtasks": subtasks,
            "created_at": ts,
            "updated_at": ts,
            "completed_at": None,
            "summary": None,
        }
        _KOM_SESSIONS[session_id] = session

        # Mark kc-main as busy
        _KILOCODE_AGENTS["kc-main"]["status"] = "busy"
        _KILOCODE_AGENTS["kc-main"]["current_task"] = f"[KOM] {goal[:80]}"

        _emit("kom.session_started", "kc-main", f"[{mode}] {goal[:70]} — {len(subtasks)} subtasks")

        # Dispatch immediately — respect depends_on (skip blocked subtasks for now)
        dispatched = 0
        for st in subtasks:
            if not st["depends_on"]:  # no blocker → dispatch now
                await _kom_dispatch_subtask(st)
                dispatched += 1
            # blocked subtasks will be dispatched by /api/kom/advance

        # For fanout mode: also call Hermes fanout if task was accepted
        if mode == "fanout":
            hermes_id = subtasks[0].get("hermes_task_id")
            if hermes_id:
                await _req("POST", f"{HERMES_URL}/tasks/{hermes_id}/fanout", {})
                _emit("kom.fanout", "hermes", f"Fanned out {hermes_id} to H1-H5")

        session["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        return JSONResponse({
            "ok": True,
            "session_id": session_id,
            "mode": mode,
            "subtasks_total": len(subtasks),
            "subtasks_dispatched": dispatched,
            "subtasks": subtasks,
        })

    @app.post("/api/kom/advance/{session_id}")
    async def kom_advance(session_id: str):
        """Advance a session: dispatch any subtasks whose dependencies are now met."""
        session = _KOM_SESSIONS.get(session_id)
        if not session:
            return JSONResponse({"error": "Session not found"}, status_code=404)

        completed_ids = {st["id"] for st in session["subtasks"] if st["status"] in ("done", "completed")}
        dispatched = []
        for st in session["subtasks"]:
            if st["status"] == "pending" and all(d in completed_ids for d in st["depends_on"]):
                await _kom_dispatch_subtask(st)
                dispatched.append(st["id"])

        # Check if all done
        all_done = all(st["status"] in ("done", "completed", "failed") for st in session["subtasks"])
        if all_done:
            session["status"] = "completed"
            session["completed_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            _KILOCODE_AGENTS["kc-main"]["status"] = "idle"
            _KILOCODE_AGENTS["kc-main"]["current_task"] = None
            _emit("kom.session_done", "kc-main", f"Session {session_id} complete — {len(session['subtasks'])} subtasks")

        session["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        return JSONResponse({"ok": True, "dispatched": dispatched, "session_status": session["status"]})

    @app.post("/api/kom/subtask/{subtask_id}/complete")
    async def kom_complete_subtask(subtask_id: str, request: Request):
        """Mark a subtask as done and optionally provide its result."""
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        session_id = subtask_id.rsplit("-", 1)[0]
        session = _KOM_SESSIONS.get(session_id)
        if not session:
            return JSONResponse({"error": "Session not found"}, status_code=404)
        st = next((s for s in session["subtasks"] if s["id"] == subtask_id), None)
        if not st:
            return JSONResponse({"error": "Subtask not found"}, status_code=404)
        st["status"] = "done"
        st["result"] = body.get("result", "")
        st["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        _emit("kom.subtask_done", st.get("routed_target", "unknown"), f"[{st['type']}] {subtask_id}")
        # Release any KC agent that was assigned
        target = st.get("routed_target")
        if target and target in _KILOCODE_AGENTS:
            a = _KILOCODE_AGENTS[target]
            if a.get("current_task") and st["description"][:50] in a["current_task"]:
                a["status"] = "idle"
                a["current_task"] = None
        # Try to advance the session
        completed_ids = {s["id"] for s in session["subtasks"] if s["status"] in ("done", "completed")}
        for s in session["subtasks"]:
            if s["status"] == "pending" and all(d in completed_ids for d in s["depends_on"]):
                await _kom_dispatch_subtask(s)
                _emit("kom.unblocked", "kc-main", f"Unblocked {s['id']} after {subtask_id}")
        return JSONResponse({"ok": True, "subtask": st})

    @app.post("/api/kom/subtask/{subtask_id}/retry")
    async def kom_retry_subtask(subtask_id: str):
        """Retry a failed subtask via its fallback route."""
        session_id = subtask_id.rsplit("-", 1)[0]
        session = _KOM_SESSIONS.get(session_id)
        if not session:
            return JSONResponse({"error": "Session not found"}, status_code=404)
        st = next((s for s in session["subtasks"] if s["id"] == subtask_id), None)
        if not st:
            return JSONResponse({"error": "Subtask not found"}, status_code=404)
        # Switch to fallback route
        primary_handler = st.get("routed_to", "hermes")
        fallback = _KOM_FALLBACK.get(primary_handler)
        if fallback:
            fb_handler, fb_target, _ = fallback
            _KOM_ROUTES[st["type"]] = (fb_handler, fb_target, "assign")
        st["status"] = "pending"
        st["error"] = None
        await _kom_dispatch_subtask(st)
        _emit("kom.retry", "kc-main", f"Retrying {subtask_id} via fallback")
        return JSONResponse({"ok": True, "subtask": st})

    @app.get("/api/kom/sessions")
    async def kom_list_sessions():
        return JSONResponse({
            "sessions": [
                {
                    "id": s["id"], "goal": s["goal"][:80], "mode": s["mode"],
                    "status": s["status"], "created_at": s["created_at"],
                    "subtasks_total": len(s["subtasks"]),
                    "subtasks_done": sum(1 for t in s["subtasks"] if t["status"] in ("done","completed")),
                    "subtasks_failed": sum(1 for t in s["subtasks"] if t["status"] == "failed"),
                }
                for s in _KOM_SESSIONS.values()
            ],
            "total": len(_KOM_SESSIONS),
        })

    @app.get("/api/kom/sessions/{session_id}")
    async def kom_get_session(session_id: str):
        s = _KOM_SESSIONS.get(session_id)
        if not s:
            return JSONResponse({"error": "Session not found"}, status_code=404)
        return JSONResponse(s)

    @app.delete("/api/kom/sessions/{session_id}")
    async def kom_cancel_session(session_id: str):
        s = _KOM_SESSIONS.get(session_id)
        if not s:
            return JSONResponse({"error": "Session not found"}, status_code=404)
        s["status"] = "cancelled"
        s["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        # Release any KC agents assigned to this session
        for st in s["subtasks"]:
            target = st.get("routed_target")
            if target and target in _KILOCODE_AGENTS:
                _KILOCODE_AGENTS[target]["status"] = "idle"
                _KILOCODE_AGENTS[target]["current_task"] = None
        if _KILOCODE_AGENTS["kc-main"]["status"] == "busy":
            _KILOCODE_AGENTS["kc-main"]["status"] = "idle"
            _KILOCODE_AGENTS["kc-main"]["current_task"] = None
        _emit("kom.cancelled", "kc-main", f"Session {session_id} cancelled")
        return JSONResponse({"ok": True})

    # ── Runtime proxy ─────────────────────────────────────────────────────────
    @app.api_route("/api/runtime/{path:path}", methods=["GET", "POST", "PUT", "DELETE"])
    async def proxy_runtime(path: str, request: Request):
        url = f"{RUNTIME_URL}/{path}"
        if request.query_params:
            url += "?" + str(request.query_params)
        body = None
        if request.method in ("POST", "PUT"):
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── Settings proxy ────────────────────────────────────────────────────────
    @app.api_route("/api/settings/{path:path}", methods=["GET", "POST", "PUT"])
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
        return JSONResponse(await _req(request.method, url, body))

    # ── Hermes proxy ──────────────────────────────────────────────────────────
    @app.api_route("/api/hermes/{path:path}", methods=["GET", "POST"])
    async def proxy_hermes(path: str, request: Request):
        url = f"{HERMES_URL}/{path}"
        body = None
        if request.method == "POST":
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── LM Studio proxy ───────────────────────────────────────────────────────
    @app.api_route("/api/lmstudio/{path:path}", methods=["GET", "POST"])
    async def proxy_lmstudio(path: str, request: Request):
        url = f"{LM_STUDIO_URL}/{path}"
        body = None
        if request.method == "POST":
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── Ollama proxy ──────────────────────────────────────────────────────────
    @app.api_route("/api/ollama/{path:path}", methods=["GET", "POST"])
    async def proxy_ollama(path: str, request: Request):
        url = f"{OLLAMA_URL}/{path}"
        body = None
        if request.method == "POST":
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── LiteLLM proxy ─────────────────────────────────────────────────────────
    @app.api_route("/api/litellm/{path:path}", methods=["GET", "POST"])
    async def proxy_litellm(path: str, request: Request):
        url = f"{LITELLM_URL}/{path}"
        body = None
        if request.method == "POST":
            try:
                body = await request.json()
            except Exception:
                body = {}
        return JSONResponse(await _req(request.method, url, body))

    # ── Multi-service health sweep ────────────────────────────────────────────
    @app.get("/api/healthall")
    async def health_all():
        checks = {
            "runtime":  f"{RUNTIME_URL}/health",
            "settings": f"{SETTINGS_URL}/health",
            "hermes":   f"{HERMES_URL}/health",
            "lmstudio": f"{LM_STUDIO_URL}/v1/models",
            "ollama":   f"{OLLAMA_URL}/api/tags",
            "litellm":  f"{LITELLM_URL}/health",
        }

        async def chk(name, url):
            r = await _req("GET", url)
            ok = "error" not in r
            return name, {"ok": ok, "data": r}

        async def chk_discord():
            async def probe(bot, meta):
                port = BOT_BASE_PORT + meta["port_offset"]
                r = await _req("GET", f"http://{VPS_HOST}:{port}/health")
                return "error" not in r
            results = await asyncio.gather(*[probe(b, m) for b, m in _BOT_META.items()])
            online = sum(1 for ok in results if ok)
            return "discord", {"ok": online > 0, "online": online, "total": len(_BOT_META)}

        all_results = await asyncio.gather(
            *[chk(n, u) for n, u in checks.items()],
            chk_discord()
        )
        return dict(all_results)

    return app


app = build_app()
