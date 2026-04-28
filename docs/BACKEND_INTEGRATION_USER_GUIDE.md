# KiloCode Backend Integration — User Guide
# Kilo Native, OpenHands Developer Runtime, Goose Computer Operator

> **Applies to:** KiloCode v4.x+
> **Date:** 2026-04-28

---

## Table of Contents

1. [Overview — What Each Backend Does](#1-overview)
2. [Kilo Native](#2-kilo-native)
3. [OpenHands Developer Runtime](#3-openhands-developer-runtime)
4. [Goose Computer Operator](#4-goose-computer-operator)
5. [Access Profiles](#5-access-profiles)
6. [Security](#6-security)
7. [Hermes Auto-Routing](#7-hermes-auto-routing)

---

## 1. Overview

KiloCode now supports three execution backends. You choose which one handles each conversation
using the **Backend Selector** dropdown in the chat toolbar, or let Hermes pick automatically.

### What each backend is good at

**Kilo Native** — the default. Code editing, quick questions, autocomplete, file navigation. Lives
entirely inside VS Code. No extra software required. Works offline. Best for your everyday coding
tasks.

**OpenHands Developer Runtime** — a full software development agent running inside a Docker
container. Give it a vague goal like "add pagination to the user table" and it will plan the
changes, edit multiple files, run the tests, fix failures, and report back. Requires Docker.

**Goose Computer Operator** — an AI agent that can control your local computer. It can click
buttons, read screen content, fill forms, navigate applications, and run scripts. Best for tasks
that require interacting with a GUI program or automating something on your desktop. Requires the
Goose CLI.

### When to use which

| Task | Use |
|------|-----|
| Write a function, fix a bug, explain code | Kilo Native |
| Generate a commit message, autocomplete | Kilo Native |
| Refactor across many files | OpenHands |
| Run the full test suite and fix failures | OpenHands |
| Set up a new library with tests and docs | OpenHands |
| Automate a GUI workflow in another app | Goose |
| Control a web browser interactively | Goose |
| SSH into a server and run operations | Goose |
| Read what's on your screen | Goose |

---

## 2. Kilo Native

### What it does

Kilo Native is the original KiloCode experience. The AI runs in the VS Code extension process and
communicates with AI providers (Anthropic, OpenAI, Azure, Ollama, and 20+ others). File edits
appear directly in your editor. Tool calls (bash, file write, browser) run subject to your
existing Auto Approve settings.

### When to use it

- You want fast responses without starting a Docker container or external process.
- You are doing standard coding work: write, edit, refactor, explain, autocomplete.
- You are offline or on a metered connection.
- You want to use a local model via Ollama or LM Studio without any extra setup.
- You need the exact same behavior as KiloCode has always had.

### What it cannot do

- It cannot run an isolated test suite against your codebase without touching your live files.
- It cannot see your screen or interact with GUI applications.
- It cannot be given a vague multi-step goal and left to work autonomously over many minutes — for
  that level of autonomy, OpenHands is the better choice.

### Configuration

No additional setup required beyond the existing KiloCode configuration. Kilo Native is always
available and always the fallback backend.

---

## 3. OpenHands Developer Runtime

### What it does

OpenHands is an autonomous software development agent. When you send it a task, it:
1. Reads your codebase
2. Plans a sequence of code changes
3. Edits files, runs shell commands, executes tests — all inside a Docker container
4. Shows you what it did via file diffs and a log of actions
5. Asks for your approval before applying anything (unless you disable approval gates)

The key difference from Kilo Native: OpenHands runs inside a Docker container that is isolated
from your system. It cannot accidentally break your live environment. It can run your full test
suite, install packages, execute build commands, and browse the web — all in the sandbox.

### When to use it

- "Migrate all my API calls from v2 to v3 and update the tests."
- "Add TypeScript strict mode. Fix all the type errors."
- "Set up Jest, add tests for the auth module, make them pass."
- "Refactor the database layer to use the repository pattern."
- Any task where you want the AI to make many changes and run tests to validate them, without
  risking your local environment.

### Setup requirements

**1. Docker Desktop** (or Docker Engine on Linux)
- Install from https://docs.docker.com/get-docker/
- Ensure Docker is running before starting an OpenHands session.
- KiloCode will tell you if Docker is not available when you try to use OpenHands.

**2. OpenHands enabled in KiloCode settings**
- Open Settings (gear icon) → Integrations → Agent Backends
- Toggle OpenHands on
- Set launch mode to "Managed Docker" (recommended) or point to a pre-running server

**3. Docker image** (auto-pulled on first use)
- Default image: `ghcr.io/all-hands-ai/runtime:0.29`
- First launch will pull the image (~2–3 GB). Subsequent launches are instant.
- You can pre-pull with: `docker pull ghcr.io/all-hands-ai/runtime:0.29`

**4. An Access Profile with the workspace mounted**
- KiloCode creates a default "OpenHands Sandbox" profile automatically when you enable OpenHands.
- The default profile mounts your VS Code workspace folder into the container.
- You can create additional profiles for different projects or security policies.

### What gets shown in chat

When OpenHands is working, you see:
- A streaming log of what OpenHands is thinking
- File change diffs (collapsible) for each file it edits
- Command outputs (stdout/stderr from shell commands it runs)
- Test run results
- An approval request before any file write is applied (configurable)

### Example conversation

```
You: The user profile page is slow. Profile it, find the bottleneck, and fix it.

[OpenHands]
Planning... I'll start by looking at the profile page component and its data fetching.

Reading: src/pages/UserProfile.tsx
Reading: src/hooks/useUserData.ts
Running: node --prof-process to generate a CPU profile...

Found: useUserData fetches all user posts on mount but only displays the last 3.
Fix: add pagination, fetch only the first page.

Editing: src/hooks/useUserData.ts [diff shown]
Editing: src/pages/UserProfile.tsx [diff shown]
Running: npm test -- --testPathPattern=UserProfile...
✓ All 12 tests pass.

Done. The profile page now fetches 10 items instead of all 847.
Estimated improvement: ~4.2s → ~0.3s initial load.
```

You review the diffs and click Approve to apply them to your actual files.

### Resource usage

OpenHands sessions use Docker resources. For typical coding tasks:
- Memory: 2–4 GB per session
- CPU: moderate (1–2 cores during active execution)
- Disk: ~3 GB for the Docker image + workspace copy

You can set memory and CPU limits in the Access Profile settings.

### Multiple simultaneous sessions

By default, KiloCode allows 1 OpenHands session at a time. You can increase this in Agent Backends
settings (OpenHands Configuration → Max concurrent sessions), but each additional session
multiplies the Docker resource usage.

---

## 4. Goose Computer Operator

### What it does

Goose is a local AI agent that can operate your computer. Unlike OpenHands (which works in an
isolated Docker container on your code), Goose works on your actual machine and can:
- Take screenshots and read what is on your screen
- Click buttons, type text, scroll, and interact with any application
- Open applications and navigate their interfaces
- Run shell commands locally (not in a container)
- Browse the web using your local browser
- Connect to remote machines via SSH and run operations there
- Use MCP (Model Context Protocol) extensions for specialized tools

### When to use it

- "Open Figma and export all the icons to my project's src/assets folder."
- "Go to the GitHub PR page and approve all the review comments I left."
- "Connect to the production VPS and check the nginx error logs."
- "Open Postman, run the test collection, and copy the results."
- "What does the error message on screen say?"
- Any task involving a GUI program that has no CLI or API.

### Setup requirements

**1. Goose CLI**
- Install: `brew install block/goose/goose` (macOS) or `pip install goose-ai` or download from
  https://github.com/block/goose/releases
- After installing: `goose --version` should work in your terminal
- Configure your AI provider in Goose: `goose configure`

**2. Goose enabled in KiloCode settings**
- Open Settings → Integrations → Agent Backends
- Toggle Goose on
- KiloCode will auto-detect the Goose binary from your PATH. If it is not found, specify the
  path manually.

**3. Accessibility permissions (for computer-use tasks)**

Goose needs OS-level accessibility permission to control GUI applications.

- **macOS:** System Settings → Privacy & Security → Accessibility → enable "Code" (or the name
  of your VS Code installation). Click "Check Accessibility Permission" in KiloCode settings to
  verify.
- **Windows:** No additional setup needed. UIAutomation is available by default.
- **Linux:** The AT-SPI2 accessibility bus must be running. On most desktop distributions it is
  active by default. Check with: `dbus-send --session --print-reply --dest=org.a11y.Bus
  /org/a11y/bus org.a11y.Bus.GetAddress`

If you only plan to use Goose for shell commands and SSH (not GUI control), you do not need
accessibility permissions.

### What gets shown in chat

When Goose is working, you see:
- Streaming text of what Goose is doing
- Screenshots (small thumbnails, click to expand) before each GUI action — you can see exactly
  what Goose sees before it clicks
- Command outputs from shell commands
- Approval requests for risky actions (configurable)

### The pause hotkey

When Goose is controlling your desktop, you can press **Ctrl+Shift+Esc** (default) to
immediately stop it. You can change this hotkey in the Access Profile settings
(Computer Use Configuration → Pause Hotkey).

### Example conversations

**Computer-use example:**
```
You: Go to https://bundlephobia.com and check the size of the lodash package.

[Goose]
Taking screenshot... [screenshot shown: browser start page]
Opening browser and navigating to bundlephobia.com...
[screenshot shown: bundlephobia homepage]
Typing "lodash" into the search box...
[screenshot shown: search results]

lodash 4.17.21: 24.5 kB minified + gzipped (72.3 kB minified)
```

**SSH + VPS example:**
```
You: SSH into the prod VPS and check how much disk space the nginx logs are using.

[Goose]
Connecting to prod-vps (187.77.30.206) via SSH profile "Production VPS"...
Running: du -sh /var/log/nginx/
Output: 4.2G  /var/log/nginx/

The nginx logs are using 4.2 GB. Want me to rotate and compress them?
```

### Important limitations

- Goose operates on your **live machine**, not in a sandbox. It can modify real files, open real
  applications, and interact with real websites.
- Use appropriate security policies and approval gates when running Goose on sensitive systems.
- Goose cannot run entirely in the background — computer-use tasks require an active display.
- Remote operations (SSH) do not need a display and work headlessly.

---

## 5. Access Profiles

Access Profiles define what a backend session is allowed to do: which files it can touch, what
network connections it can make, whether it needs your approval before taking action.

### How to create a profile

1. Open Settings → Integrations → Agent Backends
2. Scroll to "Access Profiles"
3. Click "+ New Profile"
4. Choose a profile type and fill in the fields
5. Click Save

### Profile types

| Type | Use for |
|------|---------|
| Local Repo | Kilo Native or OpenHands working on a local project |
| Local Docker Sandbox | OpenHands with a custom Docker image |
| VPS / SSH | Goose or Kilo Native operating on a remote server |
| Remote GPU | Training jobs on a remote GPU machine |
| Browser Automation | Headless browser tasks |
| Computer Use | Goose GUI control on your local desktop |
| Custom | Any backend with a custom launch command |

### Example 1: VPS Profile

Goal: Allow Goose to connect to your production VPS and run operations.

1. First, create an SSH profile in Settings → Integrations → SSH & Remote.
   - Name: "Prod VPS"
   - Host: your VPS IP
   - User: deploy
   - Auth: SSH key
2. Create an Access Profile:
   - Type: VPS / SSH
   - Name: "Production VPS — read-only audit"
   - SSH Profile: "Prod VPS" (select from dropdown)
   - Working Directory: /var/www/app
   - Sudo: off
   - Docker: on (if you want to run docker commands)
   - Security:
     - Allowed Paths: /var/www/app, /var/log, /tmp
     - Write Policy: Read Only (for a read-only audit scenario)
     - Network: Deny
     - Require approval for: All
3. Assign to Goose backend

For a deployment profile where you want Goose to actually make changes, use Write Policy:
"Approved" and require approval for "file_delete" and "process_spawn".

### Example 2: Remote GPU Training Profile

Goal: Submit training jobs to a remote A100 machine.

1. Create an SSH profile for your GPU machine.
2. Create an Access Profile:
   - Type: Remote GPU
   - Name: "A100 Cluster — NLP training"
   - SSH Profile: "A100 Machine"
   - Training Framework: PyTorch
   - Job Submit Command: `python train.py --config configs/run.yaml`
   - Checkpoint Dir: /data/checkpoints
   - Log Dir: /data/logs
   - Max Job Duration: 240 minutes
   - Security:
     - Allowed Paths: /data, /home/user/code
     - Write Policy: Approved
     - Network Allowlist: huggingface.co, wandb.ai
3. Assign to Kilo Native or Goose backend

### Example 3: Custom OpenHands Image

If your project needs a specific runtime (Node.js 22, Python 3.12, custom tools):

1. Build your Docker image:
   ```dockerfile
   FROM ghcr.io/all-hands-ai/runtime:0.29
   RUN apt-get install -y my-custom-tool
   RUN pip install my-python-package
   ```
2. Create an Access Profile:
   - Type: Local Docker Sandbox
   - Name: "MyApp OpenHands — custom image"
   - Docker Image: myapp-openhands:latest
   - Pull Policy: Never (local only)
   - Volumes: mount your project directory
   - Environment Variables: any non-secret vars your app needs
3. Assign to OpenHands backend

### Managing credentials in profiles

When a profile requires a password, API key, or private key, KiloCode stores it in your OS
keychain (via VS Code's SecretStorage) — not in plain-text settings files. These fields are
marked with a lock icon in the profile editor.

If you share a settings file or sync it via VS Code Settings Sync, credentials are not included.
You will need to re-enter them on each machine.

---

## 6. Security

### Understanding the security model

Every backend session runs through two security layers:

1. **ZeroClaw Policy** — enforced by KiloCode before any backend receives a task. Defines what
   the backend is allowed to do: file paths, network access, write policy, resource limits.

2. **Approval Gates** — when the backend wants to do something risky (delete a file, run a
   command, make a network request + file change together), KiloCode pauses and asks you to
   confirm before proceeding.

### What is safe by default

All new access profiles start with conservative defaults:
- Files: read/write only within the workspace folder
- Writes: buffered (shown as diffs; you click Approve to apply)
- Network: allowlist (only AI provider endpoints)
- Approval required for: high-risk actions, file deletion

This means even if OpenHands or Goose gets confused about what to do, it cannot damage your
system without your explicit approval.

### What requires extra care

**VPS / SSH profiles:** When Goose is connected to a remote server, actions there are real and
may not be reversible. Always:
- Set Write Policy to "Approved" for anything you care about
- Explicitly list the allowed paths
- Keep Sudo disabled unless you need it
- Review every approval request carefully before clicking Approve

**Computer Use:** Goose can click anything on your screen, including confirmation dialogs, purchase
buttons, or delete confirmations. Use `restrictToWindows` in the profile to limit which
applications Goose is allowed to interact with.

**Network policy "open":** When network policy is "open", the backend can make HTTP requests to
any URL. This is appropriate for some tasks (web scraping, API testing) but means the backend
could in principle exfiltrate information. Only use "open" when you trust the task and the AI
model.

### Approval gate behavior

When a backend wants to do something that requires approval, the chat shows:

```
OpenHands wants to:
  Delete 2 files:                              MEDIUM RISK
  • src/old-auth.ts
  • src/old-auth-types.ts

  [Reject]                    [Approve]
```

- Click **Approve** to let the action proceed.
- Click **Reject** to stop the action. The backend is informed and may try an alternative.
- If you close the approval dock without responding, the session pauses until you respond.

### YOLO mode

YOLO mode disables all approval gates. Every action the backend wants to take happens immediately,
without asking you.

**This is dangerous and intentionally inconvenient to enable.** To turn on YOLO mode:

1. Settings → Integrations → Agent Backends → Security Policies
2. Toggle "YOLO Mode"
3. Read and check the confirmation: "I understand that all approval gates are bypassed and the
   backend can modify files, run commands, and make network requests without asking."
4. Click Enable

YOLO mode is set per-profile and affects all sessions using that profile. A red banner appears at
the top of the Agent Backends settings tab whenever any profile has YOLO mode enabled.

When to use YOLO mode: long-running autonomous tasks where you trust the model and the scope is
well-defined (e.g., "run the full test suite and fix all type errors in a sandboxed container that
will be discarded anyway"). Do not use YOLO mode on profiles with VPS/SSH access or computer-use
access to real systems.

### Secrets are never in messages

KiloCode scans all content flowing through any backend for API keys, tokens, passwords, and other
credential patterns. Any match is redacted before it reaches the chat UI or the AI provider.
This scan runs even when YOLO mode is active.

### Audit log

Every routing decision, session start/stop, approval, and blocked action is logged. To view:
Settings → Integrations → Agent Backends → scroll to Audit Log Viewer.

The audit log is stored locally, retained for 30 days by default (configurable), and never sent
to telemetry.

---

## 7. Hermes Auto-Routing

### What Hermes does

Hermes is KiloCode's orchestration pipeline. When auto-routing is enabled, Hermes reads your
message, classifies what kind of task it is, and automatically selects the most capable backend.

You do not need to think about which backend to use — just describe what you want, and Hermes
routes it correctly.

### How automatic selection works

1. You type a message and hit Enter.
2. Hermes analyzes the message text, looking for signals:
   - Does it mention running tests, a test framework, CI?  → OpenHands
   - Does it mention clicking, the GUI, a specific application window?  → Goose
   - Does it mention SSH, a server, a VPS, a service?  → Goose
   - Does it ask to explain code, write a function, fix a bug in context?  → Kilo Native
3. Hermes scores each backend against the detected signals.
4. The highest-scoring available backend is selected.
5. If Hermes is unavailable (offline, wrong version), KiloCode falls back to a local
   keyword-matching classifier built into the extension.

### The backend selector shows what was chosen

When Hermes selects a backend automatically, the backend badge in the chat header shows which one
was chosen and why (hover over the badge to see the routing reason).

### Overriding automatic selection

You have three ways to override:

**1. Per-message (BackendSelector dropdown):**
Click the Backend dropdown in the chat toolbar. Select "Kilo Native", "OpenHands", or "Goose".
This override applies to the current session only.

**2. Per-session lock:**
After selecting a backend in the dropdown, it stays selected for the entire conversation. Starting
a new conversation resets to auto.

**3. Global default:**
Settings → Integrations → Agent Backends → Routing Rules → Manual Override. Set a fixed backend
for all new conversations.

### Multi-backend tasks

Some tasks involve both code changes and GUI interaction. Example:
> "Refactor the login form validation to use Zod, then open the browser and verify it works in the
> app."

Hermes recognizes this requires both OpenHands (code refactor) and Goose (browser verification)
and runs them sequentially:
- Phase 1: OpenHands handles the code work
- Phase 2: Goose opens the browser and verifies

Both sub-sessions appear in the chat with separate status badges. You can interrupt either one
independently.

### Fallback behavior

If the auto-selected backend becomes unavailable mid-routing (Docker stopped, Goose crashed):
- KiloCode automatically falls back to Kilo Native
- A yellow warning badge appears: "Using Kilo Native — OpenHands unavailable"
- A "Switch to OpenHands" button appears when OpenHands becomes available again

### Disabling auto-routing

If you always want to choose the backend manually and never want Hermes to decide:
Settings → Integrations → Agent Backends → Routing Rules → set Auto-routing to Off.

---

*End of BACKEND_INTEGRATION_USER_GUIDE.md*
