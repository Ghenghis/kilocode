# 09 — API Reference

> **Complete endpoint reference for all Hub v2 routers.**
> Version 2.1.0 — includes `/api/services` (Service Lifecycle Watchdog)
> and `/api/skills` (Skills System) added in v2.1.0.
>
> Base URL (local dev): `http://localhost:8095`

---

## Hub v2 — Core

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Serve `shell.html` (Hub SPA) |
| GET | `/health` | Hub process health |
| GET | `/events` | SSE event stream (all surfaces subscribe) |
| GET | `/mcp` | MCP server (fastapi-mcp v0.4.0) |
| GET | `/panels/manifest.json` | Auto-discovered panel list |
| GET | `/panels/{name}.js` | Serve panel module |

---

## `/api/services` — Service Lifecycle Watchdog ⭐ NEW

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/services` | — | List all 14 registered services with last cached probe |
| GET | `/api/services/status` | — | **Probe all services NOW** (no auto-start) |
| POST | `/api/services/ensure` | `{services?: [id]}` | Probe + auto-start any down service with `start_cmd` |
| GET | `/api/services/{id}` | — | Single service detail + tail of spawn log |
| POST | `/api/services/{id}/start` | — | Start one service (calls `ensure_service(id)`) |
| POST | `/api/services/{id}/stop` | — | Stop one service (requires `stop_cmd`) |

### GET /api/services/status — Response
```json
{
  "ok": true,
  "ts": "2026-04-26T10:00:00Z",
  "total": 14,
  "healthy": 11,
  "down_required": ["hermes"],
  "down_optional": ["ollama", "shiba"],
  "results": {
    "hub":        {"id": "hub",     "healthy": true,  "status_code": 200, "latency_ms": 4,   "ts": "...", "reason": null},
    "minimax":    {"id": "minimax", "healthy": true,  "status_code": 401, "latency_ms": 312, "ts": "...", "reason": null},
    "hermes":     {"id": "hermes",  "healthy": false, "status_code": null,"latency_ms": null,"ts": "...", "reason": "connection_refused"},
    "ollama":     {"id": "ollama",  "healthy": false, "status_code": null,"latency_ms": null,"ts": "...", "reason": "connection_refused"}
  }
}
```

**Probe rule:** `status_code < 500` = healthy. `401/403/404` = server reachable.
`connection_refused / timeout / 5xx` = down.

### POST /api/services/ensure — Response
```json
{
  "ok": true,
  "started": ["ollama"],
  "failed": [],
  "healthy": 12,
  "total": 14,
  "down_required": ["hermes"],
  "results": { "...": "same shape as /status" }
}
```

---

## `/api/skills` — Skills System ⭐ NEW

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/skills/registry` | — | Full skill registry (all installed skills) |
| GET | `/api/skills/health` | — | Counts: total, active, quarantined, unapproved + storage paths |
| GET | `/api/skills/marketplace` | — | Curated installable skill catalog |
| POST | `/api/skills/install` | `{manifest: SkillManifest}` | Install new skill (audits before write) |
| POST | `/api/skills/{id}/audit` | — | Re-audit an existing skill |
| GET | `/api/skills/{id}/permissions` | — | Read permissions + approval state |
| PUT | `/api/skills/{id}/permissions` | `{permissions?, approved?}` | Update permissions / approve skill |
| GET | `/api/skills/{id}/runtime` | — | Use counts, last run timestamp, recent evidence |
| GET | `/api/skills/{id}/logs` | `?n=50` | Last N event log entries from `logs/<id>.jsonl` |
| POST | `/api/skills/{id}/execute` | `{params?: {}}` | Queue execution (routes to ZeroClaw for shell/fs/git) |
| POST | `/api/skills/learn` | `{trigger, proposed_manifest, feedback}` | Voyager learn loop entry |

### SkillManifest schema
```json
{
  "id": "string (required, unique)",
  "name": "string (required)",
  "version": "semver (required)",
  "description": "string (required)",
  "permissions": ["fs_read","fs_write","fs_delete","shell","git_push",
                  "network_get","network_post","browser","memory_read","memory_write"],
  "executor": "python|node|shell|browser|runtime",
  "entrypoint": "module.function or path/to/script"
}
```

### POST /api/skills/install — Response
```json
{
  "ok": true,
  "audit": {
    "skill_id": "my_skill",
    "verdict": "PASS",
    "dangerous": false,
    "quarantine": false,
    "quarantine_reason": "",
    "errors": [],
    "manifest_sha256": "abc123...",
    "audited_at": "2026-04-26T10:00:00Z",
    "auditor": "hub.skills.router"
  },
  "registered": true
}
```

### Verdict enum
| Verdict | Meaning |
|---------|---------|
| `PASS` | Auto-runnable |
| `PASS_REQUIRES_APPROVAL` | Dangerous permissions — human must `PUT /permissions {approved:true}` |
| `FAIL` | Manifest invalid — not registered |
| `QUARANTINE` | Matches quarantine keyword — blocked permanently |

### POST /api/skills/{id}/execute — 403 on quarantine
```json
{"error": "skill is quarantined", "verdict": "QUARANTINE"}
```

---

## `/api/providers` — Provider Detection & Circuit Breakers

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/providers/status` | — | All providers with live probe status |
| GET | `/api/providers/circuit` | — | Circuit breaker state per provider |
| GET | `/api/providers/latency` | — | Latest latency measurement per provider |
| GET | `/api/providers/profiles` | — | Saved provider profiles |
| POST | `/api/providers/profiles` | `{name, config}` | Save provider profile |
| POST | `/api/providers/{id}/reset` | — | Reset circuit breaker |
| POST | `/api/providers/{id}/failover` | — | Force failover to next provider |

**Provider IDs:** `minimax` · `siliconflow` · `lm_studio` · `ollama` · `litellm`

---

## `/api/runtime` — Control Center ViewModel

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/runtime/status` | Runtime status summary (badges, cards) |
| GET | `/api/runtime/metrics` | Uptime, request counts, error rates |
| GET | `/runtime/kilocode/status` | KiloCode VSIX sync status + drift |
| POST | `/runtime/kilocode/cmd` | `{"cmd": str, "args": {}}` — run VSIX command |

---

## `/api/settings` — Canonical Settings

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/settings` | — | Full settings dump (keys only, no secret values) |
| GET | `/api/settings/{key}` | — | Single key |
| POST | `/api/settings` | `{key: value, ...}` | Upsert (write requires auth) |
| POST | `/api/settings/sync` | — | Push sync to KiloCode VSIX |
| GET | `/api/settings/autofill` | — | Autofill suggestions (inferable values) |
| POST | `/api/settings/autofill` | — | Apply all autofill suggestions |
| GET | `/api/settings/questions` | — | Pending question prompts |
| POST | `/api/settings/questions/{id}/answer` | `{"answer": str}` | Answer a question |
| GET | `/api/settings/audit` | — | Audit log of all setting changes |
| POST | `/api/settings/repair` | `{"type": str, "context": {}}` | Trigger repair flow |
| GET | `/api/settings/boot-gate` | — | Boot gate status |
| POST | `/api/settings/boot-gate` | `{"enabled": bool}` | Toggle boot gate |
| GET | `/api/settings/safemode` | — | Safemode flag |
| POST | `/api/settings/safemode` | `{"enabled": bool}` | Toggle safemode |

---

## `/api/agents` — 21-Agent Table

| Method | Path | Body/Query | Description |
|--------|------|---------|-------------|
| GET | `/api/agents` | — | All 21 agent profiles |
| GET | `/api/agents/{id}` | — | Single agent detail |
| GET | `/api/agents/activity` | `agent, type, limit` | Activity log |
| POST | `/api/agents/activity` | `{agent, type, message, metadata?}` | Push activity entry |
| POST | `/api/agents/{id}/chat` | `{message, context?}` | Chat with agent |

---

## `/api/kom` — KiloCode Orchestrator Mode

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/kom/status` | — | Enabled flag, active session, all sessions |
| GET | `/api/kom/sessions` | — | All KOM sessions |
| POST | `/api/kom/toggle` | `{"enable": bool}` | Enable/disable KOM |
| POST | `/api/kom/start` | `{"goal": str, "mode": str}` | Start session |
| GET | `/api/kom/session/{id}` | — | Session detail + subtasks |
| POST | `/api/kom/session/{id}/dispatch` | `{subtask_type, agent, params}` | Dispatch subtask |
| POST | `/api/kom/subtask/{id}/complete` | `{result, status}` | Mark subtask done |
| POST | `/api/kom/cancel/{id}` | — | Cancel session |

**KOM modes:** `codebase_audit` · `full_pipeline` · `repair` · `custom`

---

## `/api/permissions` — Approval Queue

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/permissions/pending` | — | All pending approvals |
| POST | `/api/permissions/{id}/approve` | — | Approve |
| POST | `/api/permissions/{id}/deny` | — | Deny |
| GET | `/api/permissions/audit` | — | Approval audit log |

---

## `/api/warroom` — War Room Collaboration

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/warroom/presence` | — | 21-agent presence grid |
| POST | `/api/warroom/presence` | `{agent_id, status, activity}` | Update presence |
| GET | `/api/warroom/threads` | — | Collaboration threads |
| POST | `/api/warroom/threads` | `{agent_id, message, thread_id?}` | Post to thread |
| GET | `/api/warroom/activity` | — | Combined activity stream |

---

## `/api/repairs` — Repair Timeline

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/repairs` | — | Repair history (newest first) |
| POST | `/api/repairs` | `{type, target, dry_run?}` | Trigger repair |
| GET | `/api/repairs/{id}` | — | Repair detail (before/after) |

---

## `/api/mcp` — MCP Server Management

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mcp/servers` | All MCP server statuses |
| GET | `/api/mcp/tools` | All tools across all servers |
| POST | `/api/mcp/tools/{id}/approve` | Approve tool for agent use |
| GET | `/api/mcp/logs` | MCP event log (streaming) |

---

## `/api/pipeline` — Task Pipeline

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/pipeline/status` | — | Queue depths, in-flight count |
| GET | `/api/pipeline/events` | — | Pipeline event list (last 200) |
| POST | `/api/pipeline/events` | `{type, message, agent?, metadata?}` | Push event |

---

## `/api/roadmap` — Interactive Roadmap

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/roadmap` | — | All 17 phases with tasks |
| POST | `/api/roadmap/tasks/{id}/toggle` | — | Toggle task complete |
| GET | `/api/roadmap/progress` | — | Phase-level progress summary |

---

## `/api/capabilities` — Agent Capability Policy

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/capabilities` | — | 15 capabilities + agent policy matrix |
| GET | `/api/capabilities/{agent_id}` | — | Per-agent capability profile |
| POST | `/api/capabilities/check` | `{agent_id, capability}` | Policy check (returns allow/deny) |

---

## `/api/hermes` — Hermes Orchestrator Proxy

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/hermes/health` | — | Bot liveness + Discord guild |
| GET | `/api/hermes/tasks` | — | Active task list |
| POST | `/api/hermes/task` | TaskPacket | Submit task |
| POST | `/api/hermes/tasks/{id}/fanout` | — | Fan to all H1–H5 |

---

## `/api/zeroclaw` — ZeroClaw Adapter Status

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/zeroclaw/status` | Adapter availability + last exec |
| GET | `/api/zeroclaw/log` | Last 200 operation log entries |

---

## `/api/discord` — Hermes Discord Bots

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/discord/status` | H1–H5 bot liveness |
| POST | `/api/discord/broadcast` | Send message to all bot channels |

---

## `/api/openwebui` — Open WebUI Bridge

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/openwebui/status` | Open WebUI reachability |
| GET | `/api/openwebui/pipelines` | Active pipeline list |
| POST | `/api/openwebui/pipelines/reload` | Reload 21-agent pipeline |

---

## `/api/staging` — Staging → Promote → Rollback

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/staging/status` | Current staging state |
| POST | `/api/staging/validate` | Run pre-promote checks |
| POST | `/api/staging/promote` | Promote staging → production |
| POST | `/api/staging/rollback` | Roll back to previous state |

---

## `/api/maintenance` — Maintenance Window

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/api/maintenance/status` | — | Maintenance mode on/off |
| POST | `/api/maintenance/enable` | `{"reason": str}` | Enable maintenance mode |
| POST | `/api/maintenance/disable` | — | Disable maintenance mode |

---

## Upstream service endpoints (direct, not proxied)

### Runtime Core · :8081
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Runtime health |
| POST | `/api/runtime/task` | Submit task |
| GET | `/api/runtime/tasks` | Active tasks |

### Settings Service · :8082
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Settings health |
| GET | `/settings` | Full settings |
| POST | `/settings` | Upsert |

### Hermes Gateway · :8091
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Gateway health |
| POST | `/intake` | Submit TaskPacket |
| GET | `/tasks/{id}` | Task status |
| GET | `/jobs` | Active contracts |

### ZeroClaw Gateway · :8090
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Gateway + adapter registration |
| POST | `/execute` | `{adapter, op, params}` |
| GET | `/log` | Last 200 ops |

### LM Studio · :1234
| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/models` | Loaded models |
| POST | `/v1/chat/completions` | OpenAI-compat chat |

### Ollama · :11434
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/tags` | Model list |
| POST | `/api/chat` | Chat |

### LiteLLM Proxy · :4000
| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/chat/completions` | Routed completion |
| GET | `/v1/models` | All backends |
| GET | `/health` | Proxy health |

---

## Common response envelopes

```json
// Success
{"ok": true, "data": {}}

// Error
{"error": "description", "code": 400}

// Health
{"status": "ok", "service": "hub", "version": "2.1.0", "uptime_seconds": 3600}
```

## Auth

Reads: open.
Writes: `Authorization: Bearer <HUB_ADMIN_TOKEN>` if env var is set.
Disruptive routes (promote, rollback, skill execute with shell): additionally
check maintenance window via `auth.require_disruptive`.
