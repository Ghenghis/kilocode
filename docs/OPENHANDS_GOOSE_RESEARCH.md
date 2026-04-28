# OpenHands & Goose Integration Research
## For KiloCode Backend Switcher Feature

**Research Date**: 2026-04-28  
**Researcher**: KiloCode Agents (Claude Sonnet 4.6)  
**Purpose**: Drive implementation of OpenHands and Goose as switchable execution backends in KiloCode VS Code extension  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [OpenHands (All-Hands-AI)](#2-openhands-all-hands-ai)
   - Architecture
   - Agents
   - CLI & Headless Mode
   - Python SDK
   - REST API & WebSocket
   - Configuration Schema
   - Workspace & Sandbox
   - MCP Integration
   - Security Model
   - Limitations & Gotchas
3. [Goose (Block / AAIF)](#3-goose-block--aaif)
   - Architecture
   - CLI Commands
   - Computer Controller Extension
   - Configuration Schema
   - Extensions / MCP
   - Security Model
   - API & Programmatic Access
   - Limitations & Gotchas
4. [Computer-Use Agents Research](#4-computer-use-agents-research-2025-2026)
5. [Capability-Based Agent Routing](#5-capability-based-agent-routing)
6. [VS Code Extension Integration Patterns](#6-vs-code-extension-integration-patterns)
7. [Capability Matrix](#7-capability-matrix)
8. [Recommended Implementation Approach](#8-recommended-implementation-approach)
9. [Research Paper References](#9-research-paper-references)
10. [Verified Versions & Sources](#10-verified-versions--sources)

---

## 1. Executive Summary

**OpenHands** (GitHub: `OpenHands/OpenHands`, formerly All-Hands-AI/OpenHands) is a production-ready, open-source AI software development platform. It provides:
- A Docker-sandboxed runtime for safe code execution
- A headless CLI (`openhands --headless`) and a Python SDK (`openhands-sdk`)
- A REST/WebSocket server at `localhost:3000`
- A cloud API at `app.all-hands.dev`
- Strong sandboxing: network-restricted Docker containers with volume allowlists

**Goose** (GitHub: `block/goose`, now `aaif-goose/goose` under Linux Foundation AAIF) is an open-source, Rust-built on-machine AI agent focused on local automation. It provides:
- A CLI (`goose run`, `goose session`, `goose serve`)
- Computer Controller extension for GUI automation (mouse, keyboard, screenshots)
- Full MCP ecosystem support (3,000+ servers)
- No sandboxing — runs with full user permissions on the local machine

**For KiloCode**, the recommended integration is:
- **OpenHands**: Via `openhands --headless --json` subprocess with JSONL event streaming, or via Python SDK for deeper integration
- **Goose**: Via `goose run --output-format stream-json` subprocess, or via `goose serve` + ACP/HTTP for persistent sessions
- **Routing**: Keyword/intent classifier in KiloCode chat to detect task type and suggest backend switch

---

## 2. OpenHands (All-Hands-AI)

### 2.1 Current Architecture (2025-2026)

**Versions**:
- OpenHands v1.0.0 released: **December 16, 2025** (uses new software-agent-sdk)
- Latest stable as of research date: **v1.14.0** (April 2, 2026)
- PyPI packages: `openhands-ai` (v1.6.0 as of March 30, 2026), `openhands-sdk`

**IMPORTANT NAMING COLLISION**: There is an unrelated `openhands` package on PyPI from AI4Bharat (sign-language recognition). Use `pip install openhands-ai` to get the correct package.

**GitHub**: `https://github.com/OpenHands/OpenHands` (formerly `All-Hands-AI/OpenHands`)  
**Documentation**: `https://docs.openhands.dev`  
**SDK Repo**: `https://github.com/OpenHands/software-agent-sdk`

#### Runtime Architecture

OpenHands uses a **client-server Docker architecture** with three-tier image tagging:

```
[OpenHands CLI / SDK / Web UI]
        |
        | REST / WebSocket (Socket.IO)
        v
[OpenHands Backend Server] — port 3000 (FastAPI + static React frontend)
        |
        | REST API (action-observation cycle)
        v
[Agent Server Docker Container] — dynamic port allocation
  ├── ActionExecutor
  │     ├── Bash shell environment
  │     ├── Browser (Playwright/Chromium)
  │     ├── Plugin system (Jupyter, VSCode, agent-skills)
  │     └── Current working directory state
  └── Agent (CodeActAgent, BrowsingAgent, etc.)
```

**Docker Image Tags (three-tier)**:
- Source tag: `oh_{source_hash}_{base_image}` (most specific)
- Lock tag: `oh_{16_char_md5}_{base_image}` (base image + deps hash)
- Versioned tag: `oh_v{version}_{base_image}` (generic, used as fallback)

**Container Registry**: `ghcr.io/openhands/agent-server`  
**Latest tag** (as of research): `1.15.0-python`

#### V1 SDK Architecture (November 2025)

The V1 SDK (`openhands-sdk`) introduced a modular four-package design:

| Package | Purpose |
|---------|---------|
| `openhands.sdk` | Core abstractions: Agent, LLM, Conversation, Tool, Event |
| `openhands.tools` | Built-in tool implementations |
| `openhands.workspace` | Execution environments (local, Docker, remote) |
| `openhands.agent_server` | REST/WebSocket API server |

**Key design principles** (from arXiv:2511.03690):
- **Event-sourcing pattern**: All interactions are immutable events appended to a log
- **Stateless agent**: Agent is an immutable configuration; all state lives in `ConversationState`
- **Optional sandboxing**: Docker is opt-in, not mandatory (v1 default: local execution)
- **Deterministic replay**: Sessions can be recovered from persisted event log
- **Unified tool contract**: MCP tools and native tools share identical Action-Execution-Observation interface

---

### 2.2 OpenHands Agents

#### CodeActAgent (Primary Generalist Agent)

The default and primary agent. Implements the **CodeAct framework**: unifies all agent actions into a single code-based action space.

**Capabilities**:
- Natural language conversation for clarification
- Bash command execution (interactive bash shell)
- Python code execution via interactive interpreter
- File read/write operations
- Web browsing (via delegation to BrowsingAgent)
- SWE-Bench performance: **27% resolve rate** with Claude 3.5 Sonnet; **43.2% on SWE-bench Verified** with Claude 3.7 Sonnet

**Configuration**: Default agent; no special setup required.

#### BrowsingAgent (Specialist Web Agent)

Specialized agent for web navigation and web-based task execution.

**Capabilities**:
- Built on **browser-use** library (`github.com/browser-use/browser-use`)
- Playwright/Chromium browser automation inside Docker sandbox
- Navigate URLs, click, scroll, type, extract content
- DOM manipulation via BrowserGym action primitives

**Invocation**: CodeActAgent can delegate to BrowsingAgent via `AgentDelegateAction`.

#### Other Agents in AgentHub

Additional agents are available in the AgentHub registry (implementation-defined). The OpenHands platform supports creating custom agents using the SDK.

---

### 2.3 CLI & Headless Mode

#### Installation

```bash
# Via uv (recommended, requires Python 3.12+)
uv tool install openhands --python 3.12
uv tool upgrade openhands --python 3.12

# Via pip
pip install openhands-ai  # NOT 'openhands' (naming conflict)

# Standalone binary
curl -fsSL https://install.openhands.dev/install.sh | sh
```

#### Core CLI Commands

```bash
# Interactive CLI (TUI)
openhands

# Headless automation (no Docker required)
openhands --headless -t "Fix the bug in auth.py and add a regression test"
openhands --headless -f task.txt

# Headless with structured JSONL output
openhands --headless --json -t "Create Flask app" > output.jsonl

# With auto-approval (no confirmation prompts)
openhands --headless --always-approve -t "Task description"

# Resume previous conversation
openhands --resume
openhands --resume --last
openhands --resume abc123def456  # specific ID

# Launch GUI server (Docker-based)
openhands serve
openhands serve --mount-cwd      # mount current directory
openhands serve --gpu            # enable GPU (requires nvidia-docker)

# Launch web-accessible CLI
openhands web --host 127.0.0.1 --port 12000

# Cloud
openhands login
openhands cloud  # create conversation on OpenHands Cloud
```

#### Complete Flag Reference

| Flag | Description |
|------|-------------|
| `-t, --task <TEXT>` | Seeds conversation with initial task |
| `-f, --file <FILE>` | Seeds conversation from a file |
| `--headless` | Non-interactive; auto-executes all actions (NO `--llm-approve` available) |
| `--json` | Stream JSONL output in headless mode |
| `--always-approve` | Auto-approve all actions (interactive mode) |
| `--llm-approve` | Use LLM-based security analyzer for approvals (NOT available in headless) |
| `--resume [ID]` | Continue previous conversation |
| `--last` | Resume most recent conversation (use with `--resume`) |
| `--override-with-envs` | Apply environment variable overrides |

#### JSONL Event Format

Each line in `--json` output is a JSON object:

```json
{"type": "action", "action": "write", "path": "app.py", ...}
{"type": "observation", "content": "File created successfully", ...}
{"type": "action", "action": "run", "command": "python app.py", ...}
{"type": "observation", "content": "Server started on port 5000", ...}
```

Event fields: `type` (action/observation), `action`/`result`, content/metadata.

#### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Error or task failure |
| `2` | Invalid arguments |

#### Configuration Files (`~/.openhands/`)

| File | Purpose |
|------|---------|
| `agent_settings.json` | Agent and LLM settings |
| `cli_config.json` | CLI preferences |
| `mcp.json` | MCP server configurations |

---

### 2.4 Python SDK

#### Installation

```bash
pip install openhands-sdk openhands-tools
# Optional: workspace backends
pip install openhands-workspace-docker
```

#### Basic Usage

```python
import os
from openhands.sdk import LLM, Agent, Conversation, Tool
from openhands.tools.file_editor import FileEditorTool
from openhands.tools.task_tracker import TaskTrackerTool
from openhands.tools.terminal import TerminalTool

# Configure LLM
llm = LLM(
    model="anthropic/claude-sonnet-4-5-20250929",  # LiteLLM convention: provider/model
    api_key=os.getenv("LLM_API_KEY"),
)

# Define agent with tools
agent = Agent(
    llm=llm,
    tools=[
        Tool(name=TerminalTool.name),
        Tool(name=FileEditorTool.name),
        Tool(name=TaskTrackerTool.name),
    ],
)

# Run locally (in-process, no Docker)
cwd = os.getcwd()
conversation = Conversation(agent=agent, workspace=cwd)
conversation.send_message("Write 3 facts about the current project into FACTS.txt.")
conversation.run()
```

#### Remote Workspace (Docker-isolated)

```python
from openhands.workspace import RemoteWorkspace

# Start agent server subprocess
workspace = RemoteWorkspace(host="localhost", port=8000)
conversation = Conversation(agent=agent, workspace=workspace)
# Same API as local — transparently uses HTTP/WebSocket
conversation.run()
```

#### Starting the Local Agent Server

```bash
python -m openhands.agent_server --port 8000 --host 127.0.0.1
# GET /health  → 200 when ready
```

Environment variables:
- `LOG_JSON="true"` — JSON-formatted logging
- `LLM_API_KEY` — provider API key
- `LLM_MODEL` — model (LiteLLM format)
- `LLM_BASE_URL` — optional custom endpoint

#### MCP Configuration in SDK

```python
mcp_config = {
    "mcpServers": {
        "fetch": {
            "command": "uvx",
            "args": ["mcp-server-fetch"]
        },
        "notion": {
            "url": "https://mcp.notion.com/mcp",
            "auth": "oauth"
        }
    }
}

agent = Agent(llm=llm, tools=[...], mcp_config=mcp_config)
```

Supports filter_tools_regex for allowlisting specific tools:
```python
filter_tools_regex="^(?!dangerous_tool)(.*)"
```

---

### 2.5 REST API & WebSocket (Self-Hosted)

#### Server

OpenHands backend serves at **`http://localhost:3000`** (Docker deployment).  
Agent server subprocess at **`http://localhost:8000`** (SDK local server).

#### REST Endpoints (v1 API — Self-Hosted)

All endpoints prefixed with `/api`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/conversations` | Create/start conversation |
| `GET` | `/api/conversations/{id}` | Get conversation status |
| `POST` | `/api/conversations/{id}/messages` | Send message to conversation |
| `GET` | `/api/conversations/search` | List conversations |
| `GET` | `/health` | Health check (agent server) |

#### Cloud API (v1, current)

Base URL: `https://app.all-hands.dev`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/app-conversations` | Start conversation |
| `GET` | `/api/v1/app-conversations/start-tasks` | Check start task status |
| `GET` | `/api/v1/app-conversations` | Get conversation status |
| `POST` | `/api/v1/app-conversations/stream-start` | Stream start updates (SSE) |
| `GET` | `/api/v1/app-conversations/search` | List conversations |

**Authentication**: Bearer token in `Authorization` header. Obtain from `app.all-hands.dev` Settings → API Keys.

**Cloud conversation statuses**:
- `sandbox_status`: STARTING, RUNNING, PAUSED, ERROR, MISSING
- `execution_status`: idle, running, paused, waiting_for_confirmation, **finished**, **error**, **stuck**

**V0 API deprecated** — removal April 1, 2026.

#### WebSocket (Socket.IO) — Self-Hosted

```javascript
// Connect
const socket = io("http://localhost:3000", {
  query: {
    conversation_id: "abc123",
    latest_event_id: -1,         // -1 for new connections
    providers_set: "anthropic"   // optional
  }
});

// Receive events
socket.on("oh_event", (event) => {
  // event: { id, source, timestamp, message?, type, action, args, result }
  console.log(event);
});

// Send user action
socket.emit("oh_user_action", {
  type: "message",
  source: "user",
  message: "Fix the failing test in auth_test.py"
});
```

**Note**: The cloud API uses polling rather than WebSocket due to stateless HTTP design.

---

### 2.6 Configuration Schema

#### Environment Variables

| Variable | Type | Default | Purpose |
|----------|------|---------|---------|
| `LLM_API_KEY` | string | required | Provider API key |
| `LLM_MODEL` | string | required | Model (LiteLLM: `provider/model`) |
| `LLM_BASE_URL` | string | none | Custom LLM endpoint |
| `OH_PERSISTENCE_DIR` | string | `~/.openhands` | State storage directory |
| `OH_WEB_URL` | string | none | External URL for callbacks |
| `SANDBOX_VOLUMES` | string | none | Mount spec: `host:container[:mode]` |
| `SANDBOX_USER_ID` | int | current user | File ownership in container |
| `RUNTIME` | enum | `docker` | `docker`, `process`, `remote` |
| `AGENT_SERVER_IMAGE_REPOSITORY` | string | `ghcr.io/openhands/agent-server` | Docker image repo |
| `AGENT_SERVER_IMAGE_TAG` | string | `1.15.0-python` | Docker image tag |

#### Runtime Options

- `RUNTIME=docker` (default): Full Docker sandbox isolation — recommended for production
- `RUNTIME=process` or `RUNTIME=local`: No sandboxing, runs on host — for CI/dev environments only
- `RUNTIME=remote`: Delegates to a remote agent server via HTTP

---

### 2.7 Workspace & Sandbox

#### Volume Mounting

```bash
# Mount current directory as workspace
export SANDBOX_VOLUMES=$PWD:/workspace:rw

# Multiple mounts
export SANDBOX_VOLUMES="/home/user/project:/workspace:rw,/data:/data:ro"

# CLI shortcut
openhands serve --mount-cwd
```

**Overlay mode** (read-only mounts with copy-on-write): append `:ro,overlay`

#### Docker Network Security

- **Default**: Network disabled inside sandbox
- **Enable network**: `allow_network=True` parameter with `allowed_domains` list
- **HTTP/HTTPS egress**: Passes through host proxy enforcing network policy
- **Blocked**: Raw TCP, UDP, ICMP, private IP ranges, loopback, link-local
- Only explicitly allowlisted domains are reachable

#### Process Runtime (No Docker)

```bash
export RUNTIME=process
openhands -t "task"
```

**Warning**: Agent can read/write any file accessible to your user account, execute arbitrary commands. No isolation. Use only in controlled environments.

---

### 2.8 MCP Integration

The SDK treats MCP tools identically to native tools via `MCPToolDefinition` extending `ToolDefinition`. `MCPToolExecutor` delegates to FastMCP's `MCPClient`.

Configuration supports:
- `command`-based local servers (uvx, npx)
- `url`-based remote HTTP/SSE servers
- OAuth authentication (not suitable for headless mode)
- `filter_tools_regex` for allowlisting

MCP config for CLI stored in `~/.openhands/mcp.json`.

---

### 2.9 Microagents / AGENTS.md

OpenHands supports **microagents**: specialized Markdown prompts in `.openhands/microagents/` directory:
- `repo.md` — repository-specific instructions (auto-loaded)
- `knowledge/` — keyword-triggered domain expertise
- `tasks/` — task-specific workflow prompts

These are automatically detected and loaded without manual configuration. This enables per-repository customization of agent behavior.

---

### 2.10 Security Model

| Layer | Mechanism |
|-------|-----------|
| Code execution | Docker container with network restrictions |
| File access | Volume mount allowlist (`SANDBOX_VOLUMES`) |
| Network | Domain allowlist; raw TCP/UDP/ICMP blocked |
| Action approval | `--always-approve` (auto), `--llm-approve` (LLM-gated), default (prompt) |
| Secrets | Stored in `~/.openhands/` settings; never in code |
| Security analysis | `SecurityAnalyzer` in SDK rates tool calls; `ConfirmationPolicy` pauses on risk |

---

### 2.11 Limitations & Known Gotchas

1. **Docker required for sandbox**: Default mode requires Docker. Process runtime has no isolation.
2. **Headless mode cannot use `--llm-approve`**: All actions auto-execute.
3. **No native webhooks** in Cloud API: Clients must poll.
4. **PyPI naming collision**: `openhands` package on PyPI is wrong. Use `openhands-ai`.
5. **Cloud API v0 deprecated**: Remove April 1, 2026. Use v1 API.
6. **OAuth MCP servers not headless-compatible**: OAuth flows require browser interaction.
7. **Complex patch performance drops**: SWE-bench resolve rate falls sharply when patches touch 7+ files.
8. **Docker socket dependency**: OpenHands needs `/var/run/docker.sock` to spawn runtime containers — does not work in environments without Docker.
9. **Port conflicts**: Dynamic port allocation for runtime; ensure ports are available.
10. **Event streaming latency**: WebSocket-based; polling pattern needed for Cloud API.

---

## 3. Goose (Block / AAIF)

### 3.1 Current Architecture (2025-2026)

**Latest Version**: April 8, 2026 release  
**GitHub**: `https://github.com/block/goose` (moved to `aaif-goose/goose` under Linux Foundation AAIF)  
**Documentation**: `https://goose-docs.ai` and `https://block.github.io/goose`  
**Language**: Rust (built as Cargo workspace with multiple crates)

**Key announcement**: In December 2025, Goose became part of the Linux Foundation's **Agentic AI Foundation (AAIF)**, alongside Anthropic's MCP and OpenAI's AGENTS.md.

#### Component Architecture

```
Goose v1.x — Three-binary architecture (being consolidated):
├── goose (CLI)          — In-process agent, full lifecycle management
├── goosed (server)      — REST+SSE HTTP API, 103 endpoints; spawned by desktop app
└── goose-acp-server     — Wraps agent behind ACP (Agent Client Protocol, JSON-RPC 2.0)

Future (consolidating to single binary):
├── goose (CLI mode)     — Interactive terminal
└── goose serve (server mode) — ACP over HTTP/WebSocket
```

#### Three Architectural Layers

1. **Interface layer**: Desktop app (Electron/TypeScript) or CLI
2. **Agent core**: LLM reasoning loop (Rust); manages tool calls, conversation state
3. **Extensions**: MCP servers providing tools, prompts, and resources

#### Crate Structure (Rust Workspace)

| Crate | Purpose |
|-------|---------|
| `goose` | Core agent logic |
| `goose-mcp` | MCP extension servers (developer, computercontroller, memory, tutorial) |
| `goose-server` | HTTP server for desktop app integration |
| `goose-acp` | ACP protocol implementation |

---

### 3.2 CLI Commands (Complete Reference)

#### Session Management

```bash
# Start interactive session
goose session
goose session --session-id my-session
goose session --resume --session-id my-session
goose session --fork --session-id my-session  # branch from history

# List/manage sessions
goose session list [-f json|yaml|markdown] [--limit 10]
goose session remove --session-id my-session
goose session export --session-id my-session -o export.json --format json
goose session diagnostics --session-id my-session
```

#### Headless Task Execution

```bash
# Run from text
goose run -t "Analyze the codebase and write a summary to README.md"

# Run from file
goose run -i instructions.txt

# Run from stdin
echo "Fix the failing tests" | goose run

# With output format
goose run -t "task" --output-format json         # JSON after completion
goose run -t "task" --output-format stream-json  # Streaming JSON events
goose run -t "task" --output-format text         # Plain text (default)

# Other run flags
goose run -t "task" --no-session                 # Don't save session
goose run -t "task" --max-turns 50               # Limit turns
goose run -t "task" -q                           # Quiet mode
goose run --recipe myrecipe.yaml                 # Use a recipe
```

#### Server Mode

```bash
# New serve subcommand (April 2026+)
goose serve  # Exposes ACP interface over HTTP/WebSocket

# Run as ACP server over stdio
goose acp

# Run as internal MCP server
goose mcp <server-name>
```

#### Configuration

```bash
goose configure          # Interactive setup wizard
goose info               # Show version, config path, session storage
goose info -v            # Verbose (includes extension details)
goose --version
goose update             # Update to latest stable
goose update --canary    # Update to canary build
```

#### Project Management

```bash
goose project            # Work on last project or create new
goose projects           # Choose from saved projects
```

#### Scheduling

```bash
goose schedule add --schedule-id daily-audit --cron "0 9 * * *" --recipe-source audit.yaml
goose schedule list
goose schedule remove --schedule-id daily-audit
goose schedule run-now --schedule-id daily-audit
```

#### Interactive Slash Commands (in session)

| Command | Purpose |
|---------|---------|
| `/mode auto` | Full automation — no confirmation |
| `/mode approve` | Prompt before every tool call |
| `/mode smart_approve` | LLM decides which tools need approval |
| `/mode chat` | Chat only, no tool execution |
| `/extension <cmd>` | Add stdio extension dynamically |
| `/builtin <name>` | Enable built-in extension |
| `/plan <msg>` | Enter planning mode |
| `/compact` | Summarize context to save tokens |
| `/recipe [path]` | Generate recipe from conversation |
| `/clear` | Reset conversation history |
| `/exit` | Exit session |

---

### 3.3 Computer Controller Extension

The Computer Controller is Goose's built-in GUI automation capability, implemented in the `goose-mcp` crate as a platform-specific extension.

#### Technical Implementation

**Location in codebase**:
- macOS: `crates/goose-mcp/src/computercontroller/platform/macos.rs`
- Windows: `crates/goose-mcp/src/computercontroller/platform/windows.rs`

**Screenshot library**: `xcap` crate (captures full display and individual windows)

**macOS specifics**:
- Uses `osascript -e` for AppleScript automation
- Hardcoded `/tmp` path for temporary files
- Requires system permissions: screen recording, accessibility

**Windows specifics**:
- Uses PowerShell for system-level scripts
- Requires accessibility permissions

#### Capabilities

| Capability | macOS | Windows | Linux |
|------------|-------|---------|-------|
| Screenshots | xcap (full/window) | xcap | xcap |
| Mouse control | pyautogui/native | pyautogui | pyautogui |
| Keyboard input | pyautogui/native | pyautogui | pyautogui |
| AppleScript/Automation | yes (osascript) | no | no |
| PowerShell scripts | no | yes | no |
| Web scraping | yes | yes | yes |
| File caching | yes | yes | yes |
| OCR | via extensions | via extensions | via extensions |

#### Enabling Computer Controller

**Via config.yaml**:
```yaml
extensions:
  computercontroller:
    bundled: true
    enabled: true
    name: computercontroller
    timeout: 300
    type: builtin
```

**Via CLI**:
```bash
goose session --with-builtin computercontroller
```

**Via interactive session**:
```
/builtin computercontroller
```

#### System Permissions Required

- **macOS**: System Preferences → Security & Privacy → Privacy → Screen Recording + Accessibility
- **Windows**: UAC may prompt; accessibility features must be enabled
- **Linux**: Varies by display server (X11 vs Wayland); Wayland has restrictions

#### Security Warning

The Computer Controller runs with full user permissions. There is NO sandboxing. The agent can:
- Take screenshots (including sensitive content on screen)
- Control keyboard/mouse globally
- Execute arbitrary AppleScript (macOS) or PowerShell (Windows)
- Read/write any accessible file

**Goose web (localhost:3000 HTTP server) was removed in v1.25.0** due to a critical RCE vulnerability discovered November 23, 2025 (wildcard CORS + unauthenticated WebSocket). Goosed server on desktop still runs but is localhost-only.

---

### 3.4 Configuration Schema

#### Config File Locations

| OS | Path |
|----|------|
| macOS/Linux | `~/.config/goose/config.yaml` |
| Windows | `%APPDATA%\Block\goose\config\config.yaml` |

#### Related Files

| File | Purpose |
|------|---------|
| `config.yaml` | Provider, model, extensions, general settings |
| `permission.yaml` | Tool permission levels |
| `secrets.yaml` | API keys (file-based storage only) |
| `permissions/tool_permissions.json` | Runtime permission decisions (auto-managed) |
| `prompts/` | Custom prompt templates |

#### Configuration Priority

1. Environment variables (highest)
2. `config.yaml` file settings
3. Default values (lowest)

#### Complete config.yaml Schema

```yaml
# Provider & Model
GOOSE_PROVIDER: "anthropic"          # Required: provider name
GOOSE_MODEL: "claude-sonnet-4-5"     # Required: model identifier
GOOSE_TEMPERATURE: 0.7               # float 0.0-1.0
GOOSE_MAX_TOKENS: 8192               # integer
GOOSE_MODE: "auto"                   # auto | approve | smart_approve | chat
GOOSE_MAX_TURNS: 1000                # max conversation turns

# Planning mode (falls back to GOOSE_PROVIDER/GOOSE_MODEL if not set)
GOOSE_PLANNER_PROVIDER: "anthropic"
GOOSE_PLANNER_MODEL: "claude-opus-4"

# Tool shim for models without native tool support
GOOSE_TOOLSHIM: false
GOOSE_TOOLSHIM_OLLAMA_MODEL: ""

# Context
GOOSE_INPUT_LIMIT: null              # Override Ollama context window

# CLI display
GOOSE_CLI_MIN_PRIORITY: 0.0          # float 0.0-1.0 (filter tool outputs)
GOOSE_CLI_THEME: "dark"              # dark | light | ansi
GOOSE_CLI_SHOW_COST: false           # show token cost estimates

# Security
GOOSE_ALLOWLIST: null                # URL to allowlist YAML for extensions
SECURITY_PROMPT_ENABLED: false       # prompt injection detection
SECURITY_PROMPT_THRESHOLD: 0.8      # float 0.01-1.0
SECURITY_PROMPT_CLASSIFIER_ENABLED: false
SECURITY_PROMPT_CLASSIFIER_ENDPOINT: null
SECURITY_PROMPT_CLASSIFIER_TOKEN: null

# Auto-compact
GOOSE_AUTO_COMPACT_THRESHOLD: 0.8   # float 0.0-1.0 (context fill ratio)

# Recipes
GOOSE_RECIPE_GITHUB_REPO: null       # "org/repo" for shared recipes

# Observability
GOOSE_TELEMETRY_ENABLED: false
otel_exporter_otlp_endpoint: null
otel_exporter_otlp_timeout: 5000     # milliseconds

# Extensions configuration
extensions:
  developer:
    bundled: true
    enabled: true
    name: developer
    timeout: 300
    type: builtin

  computercontroller:
    bundled: true
    enabled: false                   # Enable to use GUI automation
    name: computercontroller
    timeout: 300
    type: builtin

  # Custom stdio extension example
  my_mcp_server:
    bundled: false
    enabled: true
    name: my_mcp_server
    display_name: "My MCP Server"
    timeout: 60
    type: stdio
    cmd: "uvx"
    args: ["my-mcp-package"]
    description: "Custom MCP server"
    env_keys: ["MY_API_KEY"]         # Keys to fetch from keyring
    envs:
      SOME_VAR: "value"

  # Remote streamable HTTP extension
  remote_server:
    bundled: false
    enabled: true
    name: remote_server
    type: streamable_http
    uri: "https://my-mcp-server.com/mcp"
    # headers with auth tokens configured separately

# Slash commands
slash_commands:
  - command: "audit"
    recipe_path: "./recipes/security-audit.yaml"
```

#### Provider Configuration

Goose supports 15+ providers: Anthropic, OpenAI, Google (Gemini), Ollama, OpenRouter, Azure OpenAI, AWS Bedrock, Databricks, GitHub Copilot, Zhipu, and more.

API keys stored in system keyring (macOS Keychain, Windows Credential Manager, Linux Secret Service) or `secrets.yaml` fallback.

---

### 3.5 Extensions / MCP Ecosystem

Goose's extension system is built entirely on MCP. Extension types:

| Type | Description | Example |
|------|-------------|---------|
| `builtin` | Compiled into binary (Rust code) | developer, computercontroller, memory |
| `stdio` | Child process via stdio | Any MCP server via `uvx` or `npx` |
| `streamable_http` | Remote HTTP/SSE server | Hosted MCP services |
| Platform | In-process system capabilities | Search, subagents |
| Frontend | Provided by desktop UI | Desktop-specific tools |

**Built-in extensions**:
- `developer` (default): file read/write, shell commands, git operations, code analysis
- `computercontroller`: GUI automation (screenshots, mouse, keyboard)
- `memory`: persistent knowledge storage
- `tutorial`: interactive learning

**Available via ecosystem** (3,000+ MCP servers):
- GitHub, Google Drive, Slack, Notion, Jira
- Docker, Kubernetes, AWS, Azure
- PostgreSQL, SQLite, MongoDB
- Browser automation (Playwright, Selenium)
- 70+ documented first-party extensions

---

### 3.6 Security Model

**Goose has NO built-in sandboxing.** It runs directly on the host with the user's full permissions.

| Security Feature | Status |
|-----------------|--------|
| OS-level sandboxing | None |
| Filesystem restrictions | None (respects `.gooseignore`, `.gitignore`) |
| Network egress filtering | None by default |
| Tool permission tiers | Per-tool Allow/Ask/Never settings |
| Extension allowlist | Via `GOOSE_ALLOWLIST` env var (URL to YAML) |
| Prompt injection detection | Optional ML classifier (disabled by default) |
| Shell execution | Full user shell (`$SHELL`, defaults to bash) |
| AppleScript (macOS) | Unrestricted `osascript` |
| Self-update mechanism | `curl | bash` pattern — security risk |

#### Permission Modes

| Mode | Behavior |
|------|----------|
| `auto` | Execute all tools without confirmation |
| `approve` | Prompt user before every tool call |
| `smart_approve` | LLM decides which tools need confirmation |
| `chat` | Chat-only; no tool execution |

#### Tool-Level Permissions

Each tool can be configured in `permission.yaml`:
- **Always Allow**: Execute without prompting
- **Ask Before**: Prompt before executing
- **Never Allow**: Block entirely

#### Extension Allowlist

```bash
# Set allowlist URL (remote YAML file defining allowed extensions)
export GOOSE_ALLOWLIST="https://internal.company.com/goose-allowlist.yaml"
```

When set, only extensions matching the allowlist are permitted. Unlisted extensions are blocked at install time.

---

### 3.7 API & Programmatic Access

#### Headless / Automation Mode

```bash
# Text input
goose run -t "Create a Python script that monitors disk usage"

# File input
goose run -i task.txt

# Stdin
cat task.txt | goose run

# With JSON output (stream-json streams events; json waits for completion)
goose run -t "task" --output-format stream-json
goose run -t "task" --output-format json

# CI/CD (no session persistence, auto mode)
GOOSE_MODE=auto goose run --no-session -t "Run security audit"
```

**Note on JSON output**: As of April 2026, `--output-format json` and `--output-format stream-json` are available but the feature was in active development. The `stream-json` format outputs events as they occur; `json` outputs after completion. Structured output for recipes (with response schema validation) is available for recipe-based workflows.

#### ACP (Agent Client Protocol) Server

Goose implements ACP — a JSON-RPC 2.0 based protocol for agent-client communication:

```bash
goose acp          # Run as ACP server over stdio
goose serve        # Run as ACP server over HTTP/WebSocket (April 2026+)
```

**Protocol**: JSON-RPC 2.0 over:
- stdio (for local integration)
- HTTP (planned `goose serve`)
- WebSocket upgrade

**Client SDK**: TypeScript SDK planned as `@gooseprotocol/sdk`.

#### Integration via Extensions / Deep Links

Goose supports deep link installation:
```
goose://extension?cmd=uvx&arg=my-mcp&name=my_server&id=my_server
```

This enables VS Code extensions or other tools to programmatically install Goose extensions.

---

### 3.8 Limitations & Known Gotchas

1. **No sandboxing**: Full host access. Must trust the agent and LLM fully.
2. **Computer controller needs system permissions**: Requires granting screen recording and accessibility access on macOS; accessibility on Windows.
3. **Goose web removed**: HTTP server (`localhost:3000`) removed in v1.25.0 due to RCE vulnerability.
4. **goosed API non-standard**: The internal 103-endpoint REST+SSE server used by the desktop app is not documented publicly and will be replaced by ACP.
5. **JSON output**: `--output-format json/stream-json` is relatively new; plain text remains most stable.
6. **Linux Wayland limitations**: Computer controller has restricted capabilities under Wayland (vs X11).
7. **Config changes require restart**: Changes to `config.yaml` require restarting Goose.
8. **No multi-project isolation**: All projects share the same Goose installation and permissions.
9. **Self-update curl|bash**: Security risk in enterprise environments; pin versions manually.
10. **Windows WSL complexity**: Running Goose in WSL2 requires additional setup for GUI/computer-use features.

---

## 4. Computer-Use Agents Research (2025-2026)

### 4.1 Key Benchmarks

#### OSWorld (NeurIPS 2024, updated 2025)

**Paper**: "OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer Environments"  
**arXiv**: [2404.07972](https://arxiv.org/abs/2404.07972)  
**Project**: `https://os-world.github.io/`

- **Tasks**: 369 computer tasks across Ubuntu, Windows, macOS
- **Includes**: Real web/desktop apps, OS file I/O, multi-app workflows
- **Human baseline**: 72.36% success rate
- **Best AI (at publication)**: 12.24%

**2025-2026 Results on OSWorld-Verified**:

| Model/System | Score | Notes |
|-------------|-------|-------|
| Claude Mythos Preview | 79.6% | OSWorld-Verified (2026) |
| Holo3-122B-A10B | 78.8% | OSWorld-Verified |
| GPT-5.5 | 78.7% | OSWorld-Verified |
| Claude Opus 4.7 | 78.0% | OSWorld-Verified |
| GPT-5.4 | 75.0% | OSWorld-Verified |
| UI-TARS-2 | 47.5% | OSWorld (original) |
| Agent S2 + Claude 3.7 | 34.5% | 50 steps |
| Claude 3.7 Computer Use | 28.0% | 100 steps |
| UI-TARS | 24.6% | 50 steps |

**OSWorld-Human** (2026): Established human efficiency baselines showing top agents take **1.4-2.7× more steps** than human annotators.

#### ScreenSpot-Pro (2025)

**Paper**: "ScreenSpot-Pro: GUI Grounding for Professional High-Resolution Computer Use"  
**arXiv**: [2504.07981](https://arxiv.org/abs/2504.07981)  
**Venue**: ACM Multimedia 2025

- Focus: Professional high-resolution desktop environments
- 23 applications across 5 industries and 3 operating systems
- Best model: RegionFocus + Qwen2.5-VL-72B achieves **61.6%** (new SOTA)
- LASER on GTA1-7B: **55.7%** (new SOTA among 7B models)

#### WebArena

Finite, well-defined web browsing tasks. Less complex than OSWorld. Used for web agent evaluation.

### 4.2 Claude Computer Use (Anthropic)

**Released**: October 22, 2024 (public beta)  
**API header required**: `anthropic-beta: computer-use-2025-01-24`  
**Required model**: `claude-sonnet-4-5` or later

**Capabilities**:
- Visual screenshot analysis
- Mouse control (pixel-accurate)
- Keyboard input
- Multi-step workflow chaining
- Adapts to unexpected UI changes

**Technical details**:
- Client-side tool: screenshots and inputs are captured in YOUR environment, not Anthropic
- Adds 466-499 tokens to system prompt
- Processes screenshot images + action requests as part of API call
- Anthropic does NOT retain screenshots after response

**Current limitations**:
- Primarily Mac-optimized (limited Windows/Linux support as of early 2025)
- Not suitable for tasks requiring perfect precision
- Human oversight strongly recommended
- Cannot handle tasks with sensitive information autonomously

**Performance**: Claude 3.7 achieved 28% on OSWorld; Claude Opus 4.7 achieved 78% on OSWorld-Verified (2026).

### 4.3 State of the Art (2026)

**GUI-Owl family** (native end-to-end multimodal GUI foundation model):
- Sizes: 2B/4B/8B/32B/235B (Instruct & Thinking variants)
- Domains: desktop, mobile, browser automation
- 32B model achieves **75.45%** on GUI Knowledge Benchmark (vs o3 at 73.30%, Gemini-2.5-Pro at 71.69%)
- SOTA on 20+ GUI benchmarks as of early 2026

**Key research directions (2026)**:
- Reinforcement fine-tuning (RFT) replacing supervised fine-tuning for GUI tasks
- "Simple Thinking" strategies balancing planning vs speed
- Continuous reward functions for high-precision grounding
- Decomposed grounding with visual test-time scaling

### 4.4 Key Challenges for Computer-Use Agents

From "A Comprehensive Survey of Agents for Computer Use" (arXiv:2501.16150, 2026):

1. **Generalization**: Systems fail across diverse environments
2. **Dynamic UI handling**: Cannot reliably handle UI changes mid-task
3. **Multi-app workflows**: Cross-application task coordination is poor
4. **Dense UI environments**: Too many UI elements confuse agents
5. **Learning efficiency**: Over-reliance on static prompting; needs adaptive learning
6. **Planning depth**: Reasoning limited to current screen context

**Overall conclusion**: "ACUs are not yet mature for everyday use" despite rapid 2025-2026 progress.

### 4.5 Why Goose for Computer-Use?

Goose's Computer Controller is pragmatically better than alternatives for **local machine operations** for these reasons:

1. **Native integration**: Built into the core agent loop, not bolted on as an afterthought
2. **MCP extensibility**: Can chain GUI automation with any of 3,000+ MCP tools
3. **Local privacy**: No screenshots sent to cloud; all processing is local
4. **Full OS access**: Can run shell commands immediately after GUI operations
5. **Rust performance**: Low latency for rapid GUI interactions

**Compared to OpenHands**: OpenHands' browser automation is sandboxed and focused on web (not desktop GUI). For local machine GUI control, Goose is superior.

**Compared to Anthropic Computer Use API**: Goose doesn't require Claude specifically; works with any LLM provider. Goose also integrates file I/O and shell in the same session.

---

## 5. Capability-Based Agent Routing

### 5.1 Multi-Agent Routing Patterns (2024-2026)

#### Classification Methods (ranked by sophistication)

1. **Rule-based**: Keyword matching (e.g., "browser", "GUI", "screenshot" → Goose Computer Controller). Fast, predictable, but brittle.
2. **ML classifier**: Trained intent classifier. Requires dataset but adapts better.
3. **LLM-based routing** (current SOTA): LLM analyzes user message and returns structured routing decision. Most flexible; understands context, synonyms, implicit intents.

#### LangGraph Supervisor Pattern

```python
# Conceptual example for KiloCode routing
from langgraph.prebuilt import create_supervisor

supervisor = create_supervisor(
    agents={
        "kilo_native": kilo_native_agent,     # default VS Code coding
        "openhands": openhands_agent,         # full dev runtime
        "goose": goose_agent,                 # computer-use/GUI/local ops
    },
    system_prompt="""Route to:
    - 'kilo_native': code completion, simple file edits, questions
    - 'openhands': complex multi-file changes, running tests, Docker builds, web browsing
    - 'goose': GUI automation, desktop control, screenshots, local app control
    Return one of: kilo_native, openhands, goose"""
)
```

#### Key Routing Best Practices

1. **Clear role boundaries**: Prevent agent overlap; define exclusive capability domains
2. **Preserve context**: Pass conversation history to maintain coherent multi-turn interactions
3. **Implement fallbacks**: Uncertain queries → default agent (Kilo Native)
4. **Log routing decisions**: Enable debugging and pattern analysis
5. **Structured output**: Use typed schemas (Pydantic/Zod) to constrain routing responses
6. **Monitor production drift**: Continuously evaluate routing accuracy

### 5.2 VS Code Agent HQ & Model Management (November 2025)

VS Code v1.106-v1.107 (October-November 2025) added:
- **Agent HQ**: Centralized management of all registered agents
- **Language Models Editor**: Centralized management of all LLMs (Copilot, third-party, BYOK)
- **Multi-agent orchestration**: Experimental support for agent-to-agent delegation
- **Security controls**: Sensitive file edit controls per agent

### 5.3 Capability Signals for Routing (KiloCode-Specific)

Task keywords/patterns that signal backend preference:

**→ OpenHands**:
- "run tests", "fix failing test", "CI pipeline", "Docker", "bash script"
- "SWE-bench", "GitHub issue", "pull request", "repository analysis"
- "install packages", "set up environment", "web scraping"
- Multi-file refactoring spanning 5+ files
- "browse the web", "fetch URL", "extract data from website"

**→ Goose Computer Controller**:
- "take a screenshot", "click on", "open application", "GUI"
- "automate", "computer use", "control my screen"
- "drag and drop", "keyboard shortcut", "type in"
- "open Figma/Photoshop/Excel" (non-IDE apps)
- "screen recording", "visual test"

**→ Kilo Native (default)**:
- Code completion, autocomplete, inline suggestions
- Simple file edits, quick fixes
- Questions about code, documentation
- Formatting, linting

---

## 6. VS Code Extension Integration Patterns

### 6.1 Process Spawning Architecture

For KiloCode, both OpenHands and Goose will be invoked as external processes from the VS Code extension host.

```typescript
import { spawn, ChildProcess } from 'child_process';

interface BackendProcess {
  process: ChildProcess;
  output: string[];
  onEvent: (event: AgentEvent) => void;
}

function spawnOpenHands(task: string, workspace: string): BackendProcess {
  const proc = spawn('openhands', [
    '--headless',
    '--json',
    '--always-approve',
    '-t', task
  ], {
    cwd: workspace,
    env: {
      ...process.env,
      LLM_API_KEY: getApiKey(),
      LLM_MODEL: getModel(),
      SANDBOX_VOLUMES: `${workspace}:/workspace:rw`,
      RUNTIME: 'docker'  // or 'process' for no-Docker environments
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  proc.stdout.on('data', (data: Buffer) => {
    const lines = data.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        onAgentEvent(event);
      } catch {
        // non-JSON output (startup messages, etc.)
      }
    }
  });

  proc.stderr.on('data', (data: Buffer) => {
    console.error('OpenHands stderr:', data.toString());
  });

  return { process: proc, output: [], onEvent: onAgentEvent };
}

function spawnGoose(task: string, workspace: string): BackendProcess {
  const proc = spawn('goose', [
    'run',
    '-t', task,
    '--output-format', 'stream-json',
    '--no-session'
  ], {
    cwd: workspace,
    env: {
      ...process.env,
      GOOSE_PROVIDER: getProvider(),
      GOOSE_MODEL: getModel(),
      GOOSE_MODE: 'auto'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  proc.stdout.on('data', (data: Buffer) => {
    // Parse stream-json events
    streamJsonParser.feed(data.toString());
  });

  return { process: proc, output: [], onEvent: onAgentEvent };
}
```

### 6.2 Webview → Extension Host Communication

KiloCode uses postMessage protocol between SolidJS/React webview and extension host:

```typescript
// Extension host → Webview
panel.webview.postMessage({
  type: 'agentEvent',
  backend: 'openhands',
  event: { type: 'action', action: 'write', path: 'app.py' }
});

panel.webview.postMessage({
  type: 'backendStatus',
  backend: 'openhands',
  status: 'running'  // 'idle' | 'running' | 'finished' | 'error'
});

// Webview → Extension host
window.addEventListener('message', (event) => {
  const msg = event.data;
  if (msg.type === 'switchBackend') {
    vscode.postMessage({ type: 'switchBackend', backend: msg.backend });
  }
  if (msg.type === 'sendTask') {
    vscode.postMessage({ type: 'sendTask', task: msg.task, backend: msg.backend });
  }
});
```

### 6.3 OpenHands Server Mode Integration

For persistent sessions, use OpenHands' Socket.IO WebSocket:

```typescript
import { io, Socket } from 'socket.io-client';

let socket: Socket;
let conversationId: string;

async function startOpenHandsConversation(task: string): Promise<void> {
  // Start conversation via REST
  const response = await fetch('http://localhost:3000/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initial_message: task })
  });
  const { conversation_id } = await response.json();
  conversationId = conversation_id;

  // Connect to WebSocket for streaming events
  socket = io('http://localhost:3000', {
    query: {
      conversation_id: conversationId,
      latest_event_id: -1,
      providers_set: 'anthropic'
    }
  });

  socket.on('oh_event', (event) => {
    // Forward to webview
    panel.webview.postMessage({ type: 'agentEvent', event });
  });
}

function sendMessageToAgent(message: string): void {
  socket.emit('oh_user_action', {
    type: 'message',
    source: 'user',
    message
  });
}
```

### 6.4 Process Lifecycle Management

```typescript
class BackendManager {
  private processes: Map<string, ChildProcess> = new Map();

  async launch(backend: 'openhands' | 'goose', task: string): Promise<void> {
    // Kill existing process for this backend
    this.stop(backend);

    const proc = backend === 'openhands'
      ? spawnOpenHands(task, getWorkspacePath())
      : spawnGoose(task, getWorkspacePath());

    this.processes.set(backend, proc.process);

    proc.process.on('close', (code) => {
      this.processes.delete(backend);
      panel.webview.postMessage({
        type: 'backendStatus',
        backend,
        status: code === 0 ? 'finished' : 'error',
        exitCode: code
      });
    });
  }

  stop(backend: string): void {
    const proc = this.processes.get(backend);
    if (proc) {
      proc.kill('SIGTERM');
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 5000);
      this.processes.delete(backend);
    }
  }

  dispose(): void {
    for (const [backend, proc] of this.processes) {
      this.stop(backend);
    }
  }
}
```

### 6.5 Backend Detection & Health Check

```typescript
async function checkBackendAvailability(): Promise<{
  openhands: boolean;
  goose: boolean;
  dockerAvailable: boolean;
}> {
  const [openhandsCheck, gooseCheck, dockerCheck] = await Promise.allSettled([
    execa('openhands', ['--version']),
    execa('goose', ['--version']),
    execa('docker', ['info'])
  ]);

  return {
    openhands: openhandsCheck.status === 'fulfilled',
    goose: gooseCheck.status === 'fulfilled',
    dockerAvailable: dockerCheck.status === 'fulfilled'
  };
}
```

### 6.6 Remote Extension Considerations

When running in VS Code Remote Development (SSH, Dev Containers, Codespaces):
- Spawn processes on the remote host (extension host runs there)
- Do NOT attempt to reach `localhost:3000` from the webview HTML directly
- Forward ports if needed via VS Code port forwarding API
- For OpenHands Docker: Docker must be available on the remote host

```typescript
// Port forwarding for OpenHands server
const portForward = await vscode.env.openExternalUri(
  vscode.Uri.parse('http://localhost:3000')
);
```

---

## 7. Capability Matrix

| Capability | Kilo Native | OpenHands | Goose |
|-----------|-------------|-----------|-------|
| **Code completion/autocomplete** | ★★★ | ★★ | ★★ |
| **Simple file edits** | ★★★ | ★★★ | ★★★ |
| **Multi-file refactoring** | ★★ | ★★★ | ★★★ |
| **Shell command execution** | ★ | ★★★ (sandboxed) | ★★★ (unsandboxed) |
| **Run tests / CI** | ★ | ★★★ | ★★ |
| **Docker builds** | ✗ | ★★★ | ★★ |
| **Web browsing** | ✗ | ★★★ (Playwright) | ★★ (via MCP) |
| **GUI automation** | ✗ | ✗ | ★★★ |
| **Screenshots** | ✗ | ✗ (sandbox) | ★★★ |
| **Mouse/keyboard control** | ✗ | ✗ | ★★★ |
| **Desktop app control** | ✗ | ✗ | ★★★ (macOS best) |
| **Git operations** | ★ | ★★★ | ★★★ |
| **MCP tools** | ★★ | ★★★ | ★★★ |
| **Code review / analysis** | ★★★ | ★★★ | ★★ |
| **Security (sandboxed)** | ★★★ | ★★★ | ★ (no sandbox) |
| **Works without Docker** | ★★★ | ★ (process mode) | ★★★ |
| **Works without install** | ★★★ | ✗ | ✗ |
| **Streaming output** | N/A | ★★★ (JSONL/WS) | ★★ (stream-json) |
| **Session persistence** | ★★ | ★★★ | ★★★ |
| **Resume previous session** | ★★ | ★★★ | ★★★ |
| **Cost efficiency** | ★★★ | ★★ | ★★ |
| **Setup complexity** | ★★★ | ★★ (Docker req.) | ★★★ |

---

## 8. Recommended Implementation Approach

### 8.1 Phase 1: Backend Switcher UI (No External Agents)

Add a backend selector to KiloCode's settings/chat UI:

```typescript
// Settings schema addition
{
  "kilocode.executionBackend": {
    "type": "string",
    "enum": ["kilo-native", "openhands", "goose"],
    "default": "kilo-native",
    "description": "Execution backend for complex tasks"
  }
}
```

Status indicator in chat header:
```
[🔷 Kilo Native ▼] → dropdown: Kilo Native | OpenHands | Goose
```

### 8.2 Phase 2: OpenHands Integration

**Recommended approach**: Subprocess with JSONL streaming

```typescript
// Step 1: Detect if openhands is installed
// Step 2: Check if Docker is available (for sandbox mode)
// Step 3: Spawn: openhands --headless --json --always-approve -t <task>
// Step 4: Parse JSONL events → display in KiloCode chat panel
// Step 5: On exit code 0 → success; 1 → show error
```

**Workspace binding**:
```bash
export SANDBOX_VOLUMES="${vscode.workspace.rootPath}:/workspace:rw"
```

**Fallback (no Docker)**:
```bash
export RUNTIME=process
```

**For persistent conversations** (multi-turn): Use the Python SDK's `RemoteConversation` or the Socket.IO WebSocket API after `openhands serve --mount-cwd`.

### 8.3 Phase 3: Goose Integration

**Recommended approach**: Subprocess with stream-json output

```bash
goose run -t "<task>" --output-format stream-json --no-session
```

**For computer-use**: Require user to enable Computer Controller in Goose config AND grant OS permissions. Show warning dialog:

```
⚠️ Computer Controller requires:
- macOS: Screen Recording + Accessibility permissions
- Windows: Accessibility permissions
- Full local machine access (no sandboxing)
Enable? [Yes, I understand the risks] [Cancel]
```

**For persistent sessions** with multi-turn: Use `goose session --resume` or `goose serve` (ACP) when available.

### 8.4 Phase 4: Intent-Based Routing

Add a routing layer that suggests the appropriate backend:

```typescript
function suggestBackend(userMessage: string): BackendSuggestion {
  const gooseSignals = [
    'screenshot', 'click', 'gui', 'open app', 'computer use',
    'automate', 'drag', 'keyboard shortcut', 'desktop'
  ];
  const openhandsSignals = [
    'run test', 'failing test', 'docker', 'bash', 'install',
    'browse', 'web scrape', 'repository', 'github issue'
  ];

  const lower = userMessage.toLowerCase();
  const gooseScore = gooseSignals.filter(s => lower.includes(s)).length;
  const openhandsScore = openhandsSignals.filter(s => lower.includes(s)).length;

  if (gooseScore > 0 && gooseScore >= openhandsScore) {
    return { backend: 'goose', confidence: 'high', reason: 'GUI/computer-use task detected' };
  } else if (openhandsScore > 0) {
    return { backend: 'openhands', confidence: 'high', reason: 'Dev runtime task detected' };
  }
  return { backend: 'kilo-native', confidence: 'medium', reason: 'Default' };
}
```

Show non-intrusive suggestion: `💡 This looks like a computer-use task. Switch to Goose? [Switch] [Dismiss]`

### 8.5 Security Considerations for KiloCode Users

**OpenHands (Docker mode)**:
- Inform users: "OpenHands runs code in an isolated Docker container"
- Allow users to review `SANDBOX_VOLUMES` setting before proceeding
- Offer to start in `--always-approve` (auto) or with manual approval

**Goose**:
- Display clear warning: "Goose runs with your full user permissions — no sandboxing"
- For Computer Controller: show explicit permission dialog
- Log all commands executed to a KiloCode audit log
- Recommend users set `GOOSE_MODE=approve` for first-time use

**Both backends**:
- Never pass sensitive VS Code secrets (API keys, tokens) via environment to subprocesses unless explicitly authorized
- Offer a "dry run" preview mode where possible
- Provide "Stop Agent" button that sends SIGTERM + SIGKILL after 5s

### 8.6 Configuration in KiloCode Settings UI

Add to KiloCode's settings panel:

```
BACKENDS
────────────────────────────────────────
[x] OpenHands    [Install] [Configure]
    Runtime: ● Docker (recommended) ○ Process
    Model: [claude-sonnet-4-5     ▼]
    Workspace: /project (auto from VS Code)

[ ] Goose        [Install] [Configure]
    Model: [claude-sonnet-4-5     ▼]
    Computer Controller: [ ] Enable (requires OS permissions)
    Mode: ● Auto ○ Approve ○ Smart Approve

ROUTING
────────────────────────────────────────
Auto-suggest backend: [x]
Default fallback: [Kilo Native ▼]
```

---

## 9. Research Paper References

| Title | Authors | Venue | Date | ID/URL |
|-------|---------|-------|------|--------|
| OpenHands: An Open Platform for AI Software Developers as Generalist Agents | Wang et al. | ICLR 2025 | 2025 | [arXiv:2407.16741](https://arxiv.org/abs/2407.16741) |
| The OpenHands Software Agent SDK: A Composable and Extensible Foundation for Production Agents | OpenHands team | arXiv | Nov 2025 | [arXiv:2511.03690](https://arxiv.org/abs/2511.03690) |
| OSWorld: Benchmarking Multimodal Agents for Open-Ended Tasks in Real Computer Environments | Xie et al. | NeurIPS 2024 | 2024 | [arXiv:2404.07972](https://arxiv.org/abs/2404.07972) |
| OSWorld-Human: Benchmarking the Efficiency of Computer-Use Agents | WukLab | arXiv | 2026 | [arXiv:2506.16042](https://arxiv.org/html/2506.16042v1) |
| ScreenSpot-Pro: GUI Grounding for Professional High-Resolution Computer Use | Li et al. | ACM MM 2025 | 2025 | [arXiv:2504.07981](https://arxiv.org/abs/2504.07981) |
| GUI Agents: A Survey | Various | ACL 2025 Findings | Sep 2025 | [arXiv:2412.13501](https://arxiv.org/abs/2412.13501) |
| A Comprehensive Survey of Agents for Computer Use: Foundations, Challenges, and Future Directions | Various | arXiv | Jan 2026 | [arXiv:2501.16150](https://arxiv.org/abs/2501.16150) |
| Towards Trustworthy GUI Agents: A Survey | Various | arXiv | Mar 2026 | [arXiv:2503.23434](https://arxiv.org/abs/2503.23434) |
| UI-AGILE: Advancing GUI Agents with Effective Reinforcement Learning and Precise Inference-Time Grounding | Various | arXiv | Jul 2025 | [arXiv:2507.22025](https://arxiv.org/html/2507.22025v4) |
| Mobile-Agent-v3: Fundamental Agents for GUI Automation | Various | arXiv | Sep 2025 | [arXiv:2508.15144](https://arxiv.org/pdf/2508.15144) |
| Modality-Native Routing in Agent-to-Agent Networks | Various | arXiv | Apr 2026 | [arXiv:2604.12213](https://arxiv.org/html/2604.12213v1) |

---

## 10. Verified Versions & Sources

### OpenHands

| Item | Value | Source |
|------|-------|--------|
| GitHub repo | `OpenHands/OpenHands` | [github.com/OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) |
| v1.0.0 release date | December 16, 2025 | [newreleases.io](https://newreleases.io/project/github/OpenHands/OpenHands/release/1.0.0) |
| Latest version (research date) | v1.14.0 (April 2, 2026) | [PyPI openhands-ai](https://pypi.org/project/openhands-ai/) |
| Agent server image | `ghcr.io/openhands/agent-server:1.15.0-python` | [docs.openhands.dev](https://docs.openhands.dev/openhands/usage/run-openhands/local-setup) |
| Docker image | `docker.openhands.dev/openhands/openhands:1.6` | [docs.openhands.dev](https://docs.openhands.dev/openhands/usage/run-openhands/local-setup) |
| SDK paper | arXiv:2511.03690v1 | [arxiv.org](https://arxiv.org/html/2511.03690v1) |
| ICLR 2025 paper | arXiv:2407.16741 | [proceedings.iclr.cc](https://proceedings.iclr.cc/paper_files/paper/2025/file/a4b6ad6b48850c0c331d1259fc66a69c-Paper-Conference.pdf) |

### Goose

| Item | Value | Source |
|------|-------|--------|
| Original GitHub repo | `block/goose` (now `aaif-goose/goose`) | [github.com/block/goose](https://github.com/block/goose) |
| AAIF announcement | December 2025 | [linuxfoundation.org](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation) |
| Latest version (research date) | April 8, 2026 release | [github.com/block/goose/releases](https://github.com/block/goose/releases) |
| Goose web removed | v1.25.0 | [verialabs.com](https://verialabs.com/blog/securing-open-source-part-1-block-goose/) |
| RCE vulnerability remediated | November 23, 2025 | [verialabs.com](https://verialabs.com/blog/securing-open-source-part-1-block-goose/) |
| Computer Controller crate | `crates/goose-mcp/src/computercontroller/` | [github.com/block/goose](https://github.com/block/goose) |
| Documentation | goose-docs.ai | [goose-docs.ai](https://goose-docs.ai/) |

### Key Documentation URLs

| Resource | URL |
|----------|-----|
| OpenHands docs | https://docs.openhands.dev |
| OpenHands CLI guide | https://www.glukhov.org/ai-devtools/openhands/ |
| OpenHands Cloud API | https://docs.openhands.dev/openhands/usage/cloud/cloud-api |
| OpenHands SDK | https://docs.openhands.dev/sdk/getting-started |
| OpenHands WebSocket | https://docs.openhands.dev/openhands/usage/developers/websocket-connection |
| Goose docs | https://goose-docs.ai |
| Goose config | https://goose-docs.ai/docs/guides/config-files/ |
| Goose CLI commands | https://goose-docs.ai/docs/guides/goose-cli-commands/ |
| Goose security | https://block.github.io/goose/blog/2025/03/31/securing-mcp/ |
| Goose security audit | https://verialabs.com/blog/securing-open-source-part-1-block-goose/ |
| OSWorld benchmark | https://os-world.github.io/ |
| OSWorld-Verified | https://benchlm.ai/benchmarks/osWorldVerified |

---

*Document generated 2026-04-28 by KiloCode Agents research agent. All data verified against live sources as of research date. Sources: OpenHands documentation (docs.openhands.dev), Goose documentation (goose-docs.ai, block.github.io/goose), arXiv papers, GitHub repositories, DeepWiki analyses, and security research.*
