# 11 — Skills & Services

> Canonical reference for the **Skills System** (10-component layer) and the
> **Service Lifecycle Watchdog** (14-service registry with auto-start).
>
> Audit gates: `V79_skills_inventory` · `V80_skills_audit_truth` ·
> `V81_service_lifecycle_truth`.

---

## Skills System

<img src="diagrams/09_skills_lifecycle.svg" alt="Skills System Lifecycle" width="100%"/>

### What it is

The Skills System is a **10-component layer** baked into
`src/webui/hub/routers/skills.py` that allows agents and users to install, audit,
approve, and execute standalone capability units called **skills**.

### 10 Components

| # | Component | API surface | Notes |
|---|-----------|-------------|-------|
| 1 | Registry  | `GET /api/skills/registry` | On-disk JSON, loaded at startup |
| 2 | Install   | `POST /api/skills/install` | Validates manifest schema before write |
| 3 | Auditor   | `POST /api/skills/{id}/audit` | Enforces 5 audit rules (see below) |
| 4 | Verdict   | Embedded in audit response | PASS / PASS_REQUIRES_APPROVAL / FAIL / QUARANTINE |
| 5 | Permissions | `GET/PUT /api/skills/{id}/permissions` | Per-skill capability grant |
| 6 | Approve   | `PUT {approved:true}` | Human gate for dangerous skills |
| 7 | Execute   | `POST /api/skills/{id}/execute` | Routes to ZeroClaw for shell/fs/git |
| 8 | Evidence  | Auto-written after each run | `~/daveai/skills/evidence/<id>/<run>.json` |
| 9 | Voyager learn loop | `POST /api/skills/learn` | Proposed manifests + feedback |
|10 | Marketplace | `GET /api/skills/marketplace` | Curated catalog for KiloCode |

### 5 Audit Rules

1. **Manifest schema valid** — all required fields present, `version` is semver,
   `executor` is in enum.
2. **No quarantine keywords** — `obliterat` · `jailbreak` · `guardrail-bypass` ·
   `uncensored` · `refusal-bypass`.  Any match → `QUARANTINE` (permanent, no override).
3. **Dangerous permissions require approval** — `fs_delete` · `git_push` · `shell` ·
   `browser` → verdict `PASS_REQUIRES_APPROVAL`.
4. **Entrypoint exists** (if local executor) — file/module must be resolvable at
   install time.
5. **ID uniqueness** — re-installing same ID at different version bumps registry; same
   version with different body is refused as `FAIL`.

### Verdict flow

```
Install request
  │
  ├─ schema invalid?              → FAIL   (not registered)
  ├─ quarantine keyword match?    → QUARANTINE (registered, permanently blocked)
  ├─ dangerous permissions?       → PASS_REQUIRES_APPROVAL (registered, approval gate)
  └─ all clear?                   → PASS   (auto-runnable)
```

### Execute flow

```
POST /api/skills/{id}/execute
  │
  ├─ verdict == QUARANTINE?  → 403 Forbidden (stopped here)
  ├─ verdict == FAIL?        → 403 Forbidden (stopped here)
  ├─ verdict == PASS_REQUIRES_APPROVAL && !approved? → 403 Forbidden
  │
  └─ route to executor
       ├─ python / node / runtime → isolated subprocess via ShellAdapter
       ├─ shell                  → ShellAdapter whitelist check
       ├─ fs_write / fs_delete   → FilesystemAdapter path jail
       └─ git_push               → GitAdapter blocked-ops check
  │
  └─ write_evidence(skill_id, run_id, result)
     emit SSE: skill.executed
```

### Storage layout

```
~/daveai/skills/              (Windows: %USERPROFILE%\daveai\skills\)
├── registry.json             ← installed skills list
├── registry.seed.json        ← canonical seed (6 skills, 1 quarantined)
├── manifest.schema.json      ← JSON Schema for manifest validation
├── install_vps_skills.sh     ← VPS bootstrap seed installer
├── skills/
│   ├── <skill_id>/
│   │   ├── manifest.json
│   │   └── <entrypoint files>
├── evidence/
│   └── <skill_id>/
│       └── <run_id>.json
└── logs/
    └── <skill_id>.jsonl
```

### Seed registry (6 skills)

| Skill ID           | Executor | Dangerous | Verdict                    |
|--------------------|----------|-----------|----------------------------|
| `summarize_file`   | python   | No        | PASS                       |
| `run_tests`        | shell    | Yes       | PASS_REQUIRES_APPROVAL     |
| `git_commit_push`  | git_push | Yes       | PASS_REQUIRES_APPROVAL     |
| `web_research`     | browser  | Yes       | PASS_REQUIRES_APPROVAL     |
| `fs_backup`        | shell    | Yes       | PASS_REQUIRES_APPROVAL     |
| `obliteratus`      | shell    | —         | **QUARANTINE**             |

---

## Service Lifecycle Watchdog

<img src="diagrams/10_service_watchdog.svg" alt="Service Lifecycle Watchdog" width="100%"/>

### What it is

The **Service Lifecycle Watchdog** is the auto-start and health-monitoring layer in
`src/webui/hub/routers/services.py`. It maintains a registry of 14 services,
probes them on demand, and auto-starts any that are down and have a `start_cmd`.

### 5 Trigger points

| # | Trigger | Action |
|---|---------|--------|
| 1 | Extension activate | `HubServicesService.start()` calls `POST /api/services/ensure` |
| 2 | Hub startup | `lifespan` context calls `ensure_all()` for required services |
| 3 | Status bar poll | Every 30 s calls `GET /api/services/status` (probe only) |
| 4 | SSE event | `services.ensured` reloads KiloCode status bar |
| 5 | Manual quick-pick | User clicks status bar → Start action |

### Probe rule

```
HTTP < 500  →  healthy   (includes 401 / 403 / 404 — server is running)
5xx / timeout / connection_refused  →  down
```

### `ensure_all()` flow

```
ensure_all(service_ids?)
  │
  ├─ for each service in registry (or provided ids)
  │     probe() → result
  │     if !healthy && service.start_cmd
  │         spawn_service(service)  ← runs start_cmd in background
  │         probe() again after 3 s
  │         if still unhealthy → log "failed to start"
  │
  └─ SSE: services.ensured  {started, failed, healthy, total}
```

Spawn safety: each service is spawned at most once per 60 s (`_spawn_cooldown`).
If a service has no `start_cmd`, it is listed as `down_optional` (if optional) or
`down_required` (if required) but never auto-started.

### 14-Service registry

| ID               | Port  | Category     | Required | Start cmd                         |
|------------------|-------|--------------|----------|------------------------------------|
| `hub`            | 8095  | Core         | ✅        | —                                  |
| `runtime_core`   | 8081  | Core         | ✅        | `python src/runtime/main.py`       |
| `settings`       | 8082  | Core         | ✅        | `python settings_canonical/main.py`|
| `hermes`         | 8091  | Orchestrator | ✅        | `python src/hermes/main.py`        |
| `zeroclaw`       | 8090  | Safe-exec    | ✅        | `python src/zeroclaw/main.py`      |
| `discord_bot_h1` | —     | Discord      | ❌        | `python src/hermes/bots/h1.py`     |
| `discord_bot_h2` | —     | Discord      | ❌        | `python src/hermes/bots/h2.py`     |
| `discord_bot_h3` | —     | Discord      | ❌        | `python src/hermes/bots/h3.py`     |
| `discord_bot_h4` | —     | Discord      | ❌        | `python src/hermes/bots/h4.py`     |
| `discord_bot_h5` | —     | Discord      | ❌        | `python src/hermes/bots/h5.py`     |
| `lm_studio`      | 1234  | LLM          | ❌        | LM Studio GUI                      |
| `ollama`         | 11434 | LLM          | ❌        | `ollama serve`                     |
| `litellm`        | 4000  | LLM Proxy    | ❌        | `litellm --config litellm.yaml`    |
| `shiba`          | 8086  | Memory DB    | ❌        | `python src/shiba/main.py`         |

`minimax` · `siliconflow` · `open_webui` are also probed (external, no start_cmd).

---

## Hub UI — Skills & Services panels

### Skills panel (`panels/skills.js`)

- **Registry tab** — table of all installed skills with verdict badge, permissions, last run
- **Marketplace tab** — curated install catalog; click to install
- **Audit tab** — re-audit a selected skill; shows raw audit JSON
- **Execute tab** — select skill, provide params JSON, run; shows evidence JSON
- **Logs tab** — tail of `logs/<skill_id>.jsonl`

### Services panel (`panels/services.js`)

- **Status grid** — 14 services with live health badge (green/red/grey)
- **Ensure All button** — fires `POST /api/services/ensure`; shows `started[]` toast
- **Per-service card** — click → start / stop / view spawn log
- **Auto-refresh** — polls every 30 s via SSE `services.ensured` event

---

## KiloCode status bar integration

`HubServicesService.ts` creates a status bar item that updates on each poll:

```
$(server) DaveAI: 12/14   ← green (all required up)
$(server) DaveAI: 11/14   ← yellow (optional down only)
$(server) DaveAI: 10/14   ← red (required service down)
```

Clicking the status bar opens a quick-pick list with:
- Service name + health icon
- Start / Stop action (calls `/api/services/{id}/start`)
- View Notes (opens spawn log)

---

## Audit gates

| Gate | What it checks |
|------|----------------|
| `V79_skills_inventory` | skills router, schema, seed, install script, quarantine |
| `V80_skills_audit_truth` | 5 audit rules present in `skills.py` source |
| `V81_service_lifecycle_truth` | Hub wiring, KiloCode `HubServicesService`, startup hooks |

All three gates are in `G:\Github\kilocode-Azure2\scripts\audit\`.

---

## See also

- [`06_ZEROCLAW_ADAPTERS.md`](06_ZEROCLAW_ADAPTERS.md) — ZeroClaw executor details.
- [`05_KILOCODE_VSIX.md`](05_KILOCODE_VSIX.md) — `HubServicesService` activation.
- [`09_API_REFERENCE.md`](09_API_REFERENCE.md) — full `/api/skills` + `/api/services` endpoint table.
- [`12_TRUTH_AND_PROOF.md`](12_TRUTH_AND_PROOF.md) — V79/V80/V81 gate evidence.
