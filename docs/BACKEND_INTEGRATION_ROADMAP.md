# KiloCode Backend Integration — Implementation Roadmap
# OpenHands + Goose + Hermes Routing

> **Status:** Pre-implementation planning document
> **Date:** 2026-04-28
> **Dependency doc:** `docs/BACKEND_INTEGRATION_ARCHITECTURE.md`

---

## Overview

5 phases, ~5 weeks of focused work.

| Phase | Week | Theme | Deliverable |
|-------|------|-------|-------------|
| 1 | 1 | Foundation | Interfaces, storage, UI skeleton, KiloNative shim |
| 2 | 2 | OpenHands | OpenHands adapter, Docker launch, stream output |
| 3 | 3 | Goose | Goose adapter, stdio protocol, computer-use |
| 4 | 4 | Hermes Routing | Intent classifier, auto-selection, audit trail |
| 5 | 5 | Polish | Profiles editor UI, security gate, logs viewer, tests |

Each phase is self-contained and shippable. Phases 2 and 3 can run in parallel if two developers
are available.

---

## Phase 1 — Foundation (Week 1)

**Goal:** Core plumbing in place. Existing behavior unchanged. UI skeleton visible.

### 1.1 TypeScript interfaces package

**Files to create:**
```
packages/kilo-vscode/src/services/agent-backends/
  types.ts           ← All interfaces from Architecture §5.1
  AccessProfile.ts   ← AccessProfile + all sub-config types from §4
  BackendAdapter.ts  ← BackendAdapter interface + BackendSession + AgentEvent
  BackendRouter.ts   ← BackendRouter class (routing logic, §3)
  index.ts           ← re-exports
```

**Complexity:** Low — pure TypeScript, no external calls.

**Key decisions:**
- Keep all types in `agent-backends/` to avoid circular imports with existing services.
- `AccessProfile.ts` references `SSHProfile` from the existing SSH service by id only (no import
  of the SSHService class — avoids coupling).
- `ZeroClawPolicySnapshot` is a flat snapshot type (not the full `ZeroClawTask`) to decouple the
  backend adapter interface from ZeroClaw internals.

**Dependencies:** None (pure types).

---

### 1.2 Access Profile storage service

**Files to create:**
```
packages/kilo-vscode/src/services/agent-backends/
  AccessProfileService.ts
```

**Files to edit:**
```
packages/kilo-vscode/src/extension.ts
  ← instantiate AccessProfileService, register as singleton
```

`AccessProfileService` responsibilities:
- CRUD for `AccessProfile[]` in VS Code `globalState` (`kilo-code.accessProfiles`)
- Credential fields (any field ending in `Password`, `apiKey`, `token`, `privateKey`) stored in
  `SecretStorage` under `kilo-code.accessProfile.${id}.credentials`
- `getProfile(id)` merges non-secret globalState fields with SecretStorage credential fields
- `listProfiles(backendId?)` returns all profiles (without credential values) optionally filtered
  by `compatibleBackends`
- Fires a VS Code `EventEmitter<void>` `onDidChange` when profiles are modified (webview subscribes
  via `postMessage`)
- Migrates existing `SSHProfile` entries from `SSHTab` into VpsSsh-type `AccessProfile`s on first
  load (migration flag: `kilo-code.accessProfiles.migratedSshProfiles`)

**Complexity:** Low-medium.

**Dependencies:** Phase 1.1 types.

---

### 1.3 BackendSelector UI component

**Files to create:**
```
packages/kilo-vscode/webview-ui/src/components/chat/
  BackendSelector.tsx      ← dropdown button component
  BackendSelector.css      ← scoped styles (follow existing CSS conventions)
```

**Files to edit:**
```
packages/kilo-vscode/webview-ui/src/components/chat/PromptInput.tsx
  ← import BackendSelector, render after ModelSelector in the toolbar row
```

`BackendSelector` accepts:
```typescript
interface BackendSelectorProps {
  currentBackend: BackendId | "auto"
  onSelect: (id: BackendId | "auto") => void
  backendStatuses: Record<BackendId, BackendStatusSummary>
}
```

`BackendStatusSummary` (lightweight, for toolbar — not the full `BackendStatus`):
```typescript
interface BackendStatusSummary {
  available: boolean
  label: string
  statusColor: "green" | "yellow" | "red" | "gray"
}
```

Backend status is polled every 30 seconds via `postMessage` to the extension host. The host calls
`adapter.getStatus()` for each enabled adapter and returns results.

**Store the selection:**
- Per-session override stored in `session.backendOverride` in the session context (SolidJS signal)
- Global default stored in VS Code workspace state: `kilo-code.agentBackends.routing.manualOverride`

**Complexity:** Low-medium (UI only, no backend calls needed in Phase 1).

**Dependencies:** Phase 1.1 types.

---

### 1.4 KiloNativeAdapter shim

**Files to create:**
```
packages/kilo-vscode/src/services/agent-backends/
  adapters/KiloNativeAdapter.ts
```

`KiloNativeAdapter` wraps the existing `KiloProvider` session flow. It:
1. Translates an incoming `AgentMessage` into the existing `KiloProvider.sendMessage()` call format.
2. Subscribes to the existing Part/PartUpdate event stream.
3. Translates `Part` events to `AgentEvent` objects:

| Part type | AgentEvent type |
|-----------|-----------------|
| `TextPart` (delta) | `text_delta` |
| `ToolPart` (running) | `tool_call` |
| `ToolPart` (completed) | `tool_result` |
| `StepFinishPart` | `cost_delta` |
| session `busy→idle` transition | `session_complete` |
| error | `session_error` |

4. `isAvailable()` always returns `true`.
5. `launch()` creates a new OpenCode session via the existing `KiloConnectionService`.

**Critical constraint:** This adapter MUST NOT change any existing behavior. It is a pure
translation layer. All existing code paths continue to work unchanged for users who never touch the
backend selector.

**Complexity:** Medium (requires understanding Part event shapes and session lifecycle).

**Dependencies:** Phase 1.1 types, existing `KiloProvider`, `KiloConnectionService`.

---

### 1.5 BackendRouter skeleton

**Files to create:**
```
packages/kilo-vscode/src/services/agent-backends/
  BackendRouter.ts
```

Phase 1 BackendRouter:
- Only `kilo-native` adapter registered
- `route()` always returns KiloNative
- Manual override stored but not yet used in routing (just read for the UI state)
- Hermes classification stubbed out: `classifyCapabilities()` returns empty array

This becomes the real router in Phase 4. Phase 1 just establishes the integration points.

**Complexity:** Low.

---

### 1.6 Extension host wiring

**Files to edit:**
```
packages/kilo-vscode/src/extension.ts
  ← instantiate AccessProfileService, KiloNativeAdapter, BackendRouter
  ← add postMessage handlers:
      "getBackendStatuses"  → calls adapter.getStatus() for each enabled adapter
      "listAccessProfiles"  → calls AccessProfileService.listProfiles()
      "saveAccessProfile"   → calls AccessProfileService.save(profile)
      "deleteAccessProfile" → calls AccessProfileService.delete(id)
      "getBackendOverride"  → reads workspace state
      "setBackendOverride"  → writes workspace state
```

**Complexity:** Low (follows existing postMessage patterns in KiloProvider).

---

### Phase 1 Acceptance Criteria

- [ ] `BackendSelector` dropdown visible in chat toolbar
- [ ] "Kilo Native" shows as selected and available (green dot)
- [ ] "OpenHands" and "Goose" show as "not configured" (gray)
- [ ] Selecting "Kilo Native" in the dropdown changes no behavior
- [ ] Access Profiles list accessible (empty state with "Add Profile" CTA)
- [ ] All existing KiloCode tests pass

---

## Phase 2 — OpenHands Integration (Week 2)

**Goal:** Full OpenHands adapter. User can run an OpenHands session from KiloCode chat.

### 2.1 OpenHandsAdapter

**Files to create:**
```
packages/kilo-vscode/src/services/agent-backends/
  adapters/OpenHandsAdapter.ts
  adapters/openhands-docker.ts   ← Docker launch helpers
  adapters/openhands-sse.ts      ← SSE stream parser
```

**`OpenHandsAdapter` implementation steps:**

1. **`isAvailable()`**: Check `kilo-code.agentBackends.openhands.enabled` && (Docker available OR
   pre-running server reachable). Uses `child_process.execSync('docker info')` (cached 60s).

2. **`getStatus()`**: Ping `${serverUrl}/health`. Parse version. Check Docker image presence if
   launch mode = docker.

3. **`launch(config)`**:
   - If launch mode = `docker`:
     - `buildDockerRunArgs(config)` — generates the `docker run` argument array from the access
       profile's `localDocker` config, merging with OpenHands defaults
     - Spawn `docker run ...` as a child process
     - Poll `${serverUrl}/health` up to 30s (500ms intervals)
     - On timeout: kill container, reject with descriptive error
   - POST `${serverUrl}/api/conversations` with:
     ```json
     {
       "initial_user_message": null,
       "workspace_mount_path": "<from access profile>",
       "agent_cls": "CodeActAgent",
       "llm_config": { "model": "<from config>" }
     }
     ```
   - Store conversation ID in `session.metadata.conversationId`

4. **`send(session, message)`**:
   - POST `${serverUrl}/api/conversations/${id}/messages`
   - Body: `{ "role": "user", "content": message.content }`

5. **`stream(session)`**:
   - Open `EventSource` on `${serverUrl}/api/conversations/${id}/events`
   - Parse OpenHands events (see Architecture Appendix A)
   - Yield `AgentEvent` objects
   - On `AgentFinishAction`: yield `session_complete`, close EventSource
   - On `ErrorObservation`: yield `session_error`, close EventSource

6. **`approve(session, requestId, approved)`**:
   - POST `${serverUrl}/api/conversations/${id}/messages`
   - Body: `{ "role": "user", "content": approved ? "Confirm." : "Reject and stop." }`
   - Note: OpenHands 0.29 does not have a dedicated approval endpoint; user message is used.
     A future version with native approval API should be handled behind a version check.

7. **`stop(session)`**:
   - DELETE `${serverUrl}/api/conversations/${id}`
   - If launch mode = docker: `docker stop <containerName>`

8. **`getArtifacts(session)`**:
   - GET `${serverUrl}/api/conversations/${id}`
   - Parse `file_edits` from the response into `SessionArtifact[]`

**`buildDockerNetworkArgs(profile)` logic:**
```typescript
// When networkPolicy = "allowlist", we cannot use standard Docker network restriction
// (iptables). Instead:
//   1. Create a user-defined bridge network per session
//   2. Start a squid or tinyproxy sidecar container on the same network
//   3. Configure HTTPS_PROXY in the OpenHands container environment
//   4. Sidecar allows only the allowlist domains (configured via ACL)
//
// When networkPolicy = "deny":
//   --network none
//
// When networkPolicy = "open":
//   (default bridge network, no restriction)
```

**Complexity:** High (Docker lifecycle, SSE streaming, network sandboxing).

**Dependencies:** Phase 1, Docker CLI on the developer machine.

---

### 2.2 OpenHands settings panel

**Files to create:**
```
packages/kilo-vscode/webview-ui/src/components/settings/
  AgentBackendsTab.tsx          ← full tab component (Panels 1–3 from Architecture §8.2)
```

**Files to edit:**
```
packages/kilo-vscode/webview-ui/src/components/settings/Settings.tsx
  ← add "agentBackends" to TAB_GROUPS integrations array
  ← add lazy import: const AgentBackendsTab = lazy(() => import("./AgentBackendsTab"))
  ← add to TAB_LABELS, tab-icons.tsx
```

Phase 2 implements Panel 1 (Backend Enable/Disable) and Panel 2 (OpenHands Configuration) only.
Panels for Goose, Profiles, Routing, Security are stubs.

**Complexity:** Medium.

---

### 2.3 Event stream → WebView bridge

**Files to edit:**
```
packages/kilo-vscode/src/KiloProvider.ts
  ← add handling for "startBackendSession" postMessage:
      1. BackendRouter.route() → BackendSession
      2. Wire adapter.stream() → postMessage loop sending "backendEvent" messages
      3. Store active sessions in Map<sessionId, BackendSession>
  ← add "approveBackendAction" handler
  ← add "stopBackendSession" handler

packages/kilo-vscode/webview-ui/src/components/chat/MessageList.tsx
  ← handle "backendEvent" messages from extension:
      - text_delta: append to current assistant message
      - tool_call / tool_result: render ToolCallBlock
      - file_changed: render diff inline
      - approval_request: emit to PermissionDock
      - screenshot: render inline image (for computer-use in Phase 3)
      - session_complete / session_error: end streaming state
```

**Complexity:** Medium-high (touches the core message rendering path).

---

### 2.4 OpenHands access profile defaults

Create a `getDefaultOpenHandsProfile()` function in `AccessProfileService.ts` that returns a
sensible `local-docker` type profile when none exists. This is auto-created the first time
OpenHands is enabled, so the user doesn't need to manually create a profile.

---

### Phase 2 Acceptance Criteria

- [ ] User can enable OpenHands in Agent Backends tab
- [ ] User can configure server URL and launch mode
- [ ] With Docker running + image present, "Test Connection" shows green
- [ ] User can select "OpenHands" in BackendSelector
- [ ] Sending a message routes through OpenHands adapter
- [ ] OpenHands responses stream back to the chat UI
- [ ] Approval requests surface in the PermissionDock
- [ ] File changes from OpenHands show as diffs in chat
- [ ] Stopping the session kills the Docker container

---

## Phase 3 — Goose Integration (Week 3)

**Goal:** Full Goose adapter. Computer-use sessions from KiloCode.

### 3.1 GooseAdapter

**Files to create:**
```
packages/kilo-vscode/src/services/agent-backends/
  adapters/GooseAdapter.ts
  adapters/goose-stdio.ts         ← stdin/stdout protocol handler
  adapters/goose-computer-use.ts  ← screen capture, accessibility checks
```

**`GooseAdapter` implementation steps:**

1. **`isAvailable()`**: Check `kilo-code.agentBackends.goose.enabled` &&
   `goose --version` resolves (use `which goose` or configured path, cache result 60s).

2. **`getStatus()`**: Run `goose version` and parse output. If computer-use profile:
   check OS-level accessibility permission (platform-specific).

3. **`launch(config)`**:
   - Build env vars from access profile (non-secret) + SecretStorage lookups
   - `GOOSE_ALLOWED_PATHS` from `security.allowedPaths`
   - `GOOSE_NETWORK_POLICY` from `security.networkPolicy`
   - If computer-use: call `checkAccessibilityPermission()` first; reject if not granted
   - Spawn: `goose run --format json-stream --no-session-file [--profile <name>]`
   - Return session with `childProcess` reference in `session.metadata`

4. **`send(session, message)`**:
   - Write to `childProcess.stdin`:
     ```json
     {"type":"user_message","content":"<text>","session_id":"<id>"}\n
     ```

5. **`stream(session)`**:
   - `readline` on `childProcess.stdout`
   - Parse JSON events per Architecture Appendix B
   - Yield `AgentEvent` objects
   - Handle `childProcess.on('exit')` → yield `session_error` if non-zero exit

6. **`approve(session, requestId, approved)`**:
   - Write to stdin:
     ```json
     {"type":"approve","action_id":"<id>","approved":<bool>}\n
     ```

7. **`stop(session)`**:
   - Write `{"type":"stop"}\n` to stdin
   - Wait up to 3s for process exit, then `childProcess.kill('SIGTERM')`
   - If still alive after 1s: `childProcess.kill('SIGKILL')`

8. **`getArtifacts(session)`**: Parse `file_write` events accumulated during the session.

**`checkAccessibilityPermission()` per platform:**
```
Windows:  UIAutomation available by default — no check needed
macOS:    AXIsProcessTrusted() via native module OR
          check System Preferences > Privacy > Accessibility for the VS Code process
Linux:    Check AT-SPI bus available: dbus-send --session ... AT_SPI2 service
```

The extension ships a small platform-native helper for the macOS check. On platforms where the
check cannot be automated, `getStatus()` returns a `details` entry directing the user to enable
it manually, with a direct link to the system preferences pane.

**Complexity:** High (stdio process management, cross-platform accessibility, computer-use session
management).

**Dependencies:** Phase 1, Goose CLI installed on the developer machine.

---

### 3.2 Computer-use session management

**Files to create:**
```
packages/kilo-vscode/src/services/agent-backends/
  adapters/GooseScreenCapture.ts   ← wraps screenshot events
```

**Files to edit:**
```
packages/kilo-vscode/webview-ui/src/components/chat/MessageList.tsx
  ← render "screenshot" AgentEvent as inline image with caption
  ← show "Goose sees:" label above screenshot
```

Goose emits `screenshot` events before each GUI action (when `screenshotBeforeAction: true`).
These render inline in the chat as small thumbnails (max 320px wide) that expand on click.

**Pause hotkey:**
The `computerUse.pauseHotkey` from the access profile is registered as a VS Code keybinding when a
Goose computer-use session is active. Activating it sends `{"type":"stop"}` to the Goose process.
The keybinding is deregistered when the session ends.

**Complexity:** Medium.

---

### 3.3 Goose settings panel (Panel 3 in AgentBackendsTab)

Fill in the Goose panel (stub from Phase 2):
- CLI path input with auto-detect button
- Protocol selector
- Extensions checklist (populated by `goose extensions list --format json`)
- Computer-use enable toggle + "Check Accessibility Permission" button
- Default session profile dropdown

**Complexity:** Low-medium.

---

### 3.4 MCP extension integration

Goose supports MCP extensions. The adapter reads the `enabledExtensions` list from settings and
passes them as `--extension <name>` flags on spawn. A `listAvailableExtensions()` method calls
`goose extensions list --format json` and returns the result for the settings UI.

**Files to edit:**
```
packages/kilo-vscode/src/services/agent-backends/adapters/GooseAdapter.ts
  ← add listAvailableExtensions(): Promise<GooseExtension[]>
```

**Complexity:** Low.

---

### Phase 3 Acceptance Criteria

- [ ] User can configure Goose CLI path in Agent Backends tab
- [ ] "Test Connection" shows Goose version
- [ ] Selecting "Goose" in BackendSelector works
- [ ] Sending a message routes through GooseAdapter
- [ ] Goose text responses stream back to chat
- [ ] Computer-use: screenshots appear inline in chat
- [ ] Pause hotkey stops Goose immediately
- [ ] File writes from Goose show as diffs
- [ ] Approval requests from Goose surface in PermissionDock
- [ ] MCP extensions list populates in settings

---

## Phase 4 — Hermes Routing (Week 4)

**Goal:** Automatic intent-based backend selection. Manual override + audit trail.

### 4.1 Capability tagger (local fallback)

**Files to create:**
```
packages/kilo-vscode/src/services/agent-backends/
  CapabilityTagger.ts
```

The `CapabilityTagger` implements keyword-based intent classification. This runs locally when
Hermes is unavailable.

```typescript
class CapabilityTagger {
  tag(message: string, context?: ClassifyContext): CapabilityTag[] {
    // Applies keyword cluster rules (see Architecture §3.2)
    // Returns deduplicated, sorted-by-confidence capability tag array
  }

  selectBackend(tags: CapabilityTag[]): BackendId {
    // Applies capability weight table (Architecture §3.3)
    // Returns backend with highest summed weight
  }
}
```

**Unit test file:**
```
packages/kilo-vscode/src/services/agent-backends/
  __tests__/CapabilityTagger.test.ts
```
Minimum 20 test cases covering all capability tags.

**Complexity:** Low.

---

### 4.2 Hermes routing hook

**Files to edit:**
```
packages/kilo-vscode/src/services/agent-backends/BackendRouter.ts
  ← implement full classify() using HermesClient first, CapabilityTagger fallback
  ← implement resolveWithFallback() with full fallback chain
  ← integrate ZeroClawService.buildPolicy()
```

**Hermes classify call:**
```typescript
// POST ${hermesBaseUrl}/classify
// (new Hermes endpoint — must be coordinated with Hermes bridge deployment)
// Request: ClassifyRequest (Architecture §3.2)
// Response: ClassifyResponse
// Timeout: 2000ms — fall through to local tagger on timeout
```

The `/classify` endpoint is a new addition to the Hermes Bridge API. If the deployed Hermes
version does not support it (404 response), the router falls back to `CapabilityTagger` permanently
and logs a warning.

**Complexity:** Medium.

**Dependencies:** Hermes bridge API update (coordinate with infra).

---

### 4.3 Automatic backend selection in message send path

**Files to edit:**
```
packages/kilo-vscode/src/KiloProvider.ts
  ← intercept message send when BackendRouter is available
  ← if manual override: skip classification, use override
  ← if auto: call BackendRouter.route()
  ← annotate the outgoing session with backendId for display
```

The routing decision happens before the message is sent to any backend. If the user has a global
or session-level manual override, it bypasses classification entirely.

**Implementation note:** The routing decision must complete before the session's loading state
begins in the UI. Target: classification + adapter.launch() within 3s. If exceeded, fall back to
KiloNative and emit a warning.

**Complexity:** Medium-high (core message send path, must not break existing sessions).

---

### 4.4 User override + session annotation

**Files to edit:**
```
packages/kilo-vscode/webview-ui/src/components/chat/TaskHeader.tsx
  ← render BackendBadge when active backend != kilo-native
  ← show backend status in header

packages/kilo-vscode/webview-ui/src/context/session.ts
  ← add backendId signal to session context
  ← add backendOverride signal (per-session)
```

The `BackendBadge` shows:
- Backend name + icon
- Colored dot (Architecture §7.2)
- Clicking opens mini status popover

---

### 4.5 Audit trail

**Files to create:**
```
packages/kilo-vscode/src/services/agent-backends/
  AuditService.ts
```

`AuditService`:
- `record(entry: AuditEntry): void` — appends to ring buffer in global state
- `query(filter: AuditFilter): AuditEntry[]` — filtered retrieval for settings UI
- `export(): string` — JSON export
- Ring buffer: 10,000 entries max; auto-trim oldest on overflow
- On extension activate: trim entries older than `auditRetentionDays` setting

**Files to edit:**
```
packages/kilo-vscode/src/services/agent-backends/BackendRouter.ts
  ← call AuditService.record() on each routing decision:
      { routing_decision, tags, selected_backend, fallback_used, reason }

packages/kilo-vscode/src/KiloProvider.ts
  ← wire AuditService to agent event stream:
      record approval_request events with outcome
      record session_complete/session_error with summary
```

**Complexity:** Low.

---

### Phase 4 Acceptance Criteria

- [ ] With Hermes available: message "refactor the auth module" routes to OpenHands
- [ ] With Hermes unavailable: local tagger routes correctly
- [ ] "computer-use: click the submit button" routes to Goose
- [ ] Manual override in BackendSelector bypasses classification
- [ ] Routing decision visible in audit log immediately
- [ ] Approval events logged with outcome
- [ ] Fallback to KiloNative when selected backend unavailable — warning shown

---

## Phase 5 — Polish (Week 5)

### 5.1 Access Profiles editor UI

**Files to edit:**
```
packages/kilo-vscode/webview-ui/src/components/settings/AgentBackendsTab.tsx
  ← implement Panel 4 (Access Profiles) fully
  ← ProfileEditorModal component (in-tab modal for edit/create)
```

`ProfileEditorModal`:
- Form fields for all `AccessProfile` sub-config types
- Conditional sections: only show `localRepo` fields when type = `local-repo`, etc.
- JSON mode toggle: shows/hides the raw JSON editor (using existing Monaco/CodeEditor if available)
- Credential fields render as `<input type="password">` with show/hide toggle
- Save writes non-secret fields to globalState, credential fields to SecretStorage
- Validation: required fields, URL format, path format, port ranges
- "Test profile" button: attempts a quick connectivity check for VPS/SSH/Docker profiles

**Complexity:** High (complex form, many field types, credential handling).

---

### 5.2 Security gate + approval flow

**Files to edit:**
```
packages/kilo-vscode/webview-ui/src/components/chat/PermissionDock.tsx
  ← extend to handle AgentEvent approval_request from any backend
  ← show risk level badge (low/medium/high with color coding)
  ← show affected paths list
  ← show preview diff if present
  ← auto-approve countdown timer (when autoApproveAfterMs > 0)

packages/kilo-vscode/webview-ui/src/components/settings/AgentBackendsTab.tsx
  ← implement Panel 6 (Security Policies)
  ← YOLO mode toggle with confirmation modal
  ← YOLO mode active banner (red) shown at top of tab when enabled
```

**YOLO mode activation flow:**
1. User toggles YOLO mode switch
2. Modal: "Warning: All approval gates will be bypassed. Any backend can modify files, run
   commands, and make network calls without asking. Are you sure?" with "I understand" checkbox
3. On confirm: save setting; register `kilo-code.yoloMode` workspace state
4. On extension activate: if any profile has `yoloMode: true`, show dismissible VS Code info
   notification: "KiloCode YOLO mode is active on profile [name]. Approval gates bypassed."

**Complexity:** Medium.

---

### 5.3 Logs and artifacts viewer

**Files to edit:**
```
packages/kilo-vscode/webview-ui/src/components/settings/AgentBackendsTab.tsx
  ← implement Panel 7 (Audit Log Viewer)

packages/kilo-vscode/webview-ui/src/components/chat/
  ← (optional) ArtifactsPanel.tsx — inline artifacts viewer in chat
      shows files written, screenshots, test reports from a completed session
```

Audit Log Viewer:
- Virtual list (reuse VirtualMessageList approach) for performance with 10k entries
- Filter bar: backend selector, event type checkboxes, date range, risk flag checkbox
- [Export JSON] — downloads via `vscode.env.openExternal` to a temp file
- Live auto-refresh toggle (polls every 5s via postMessage while a session is active)

**Complexity:** Medium.

---

### 5.4 Full test suite

**Files to create:**
```
packages/kilo-vscode/src/services/agent-backends/__tests__/
  CapabilityTagger.test.ts        ← 20+ intent classification cases
  BackendRouter.test.ts           ← routing decisions, fallback chain
  AccessProfileService.test.ts    ← CRUD, migration, credential separation
  KiloNativeAdapter.test.ts       ← event translation, pass-through correctness
  OpenHandsAdapter.test.ts        ← HTTP mock, Docker mock, SSE parsing
  GooseAdapter.test.ts            ← stdio mock, event parsing, process lifecycle
  AuditService.test.ts            ← ring buffer, query, export
```

**Test utilities to create:**
```
packages/kilo-vscode/src/services/agent-backends/__tests__/
  fixtures/openhands-events.json  ← sample SSE event stream
  fixtures/goose-events.ndjson    ← sample ndjson event stream
  mocks/MockHermesClient.ts
  mocks/MockZeroClawService.ts
  mocks/MockDockerProcess.ts
  mocks/MockGooseProcess.ts
```

**Complexity:** Medium (test infrastructure setup is the main work).

---

### 5.5 Error UX

Polish all error states introduced in phases 2–4:

| Error | UX |
|-------|----|
| Docker not found | "Docker is not running. Start Docker Desktop and try again." |
| OpenHands image pull failure | Shows pull progress, then specific error message |
| OpenHands health timeout | "OpenHands did not start within 30s. [View logs]" |
| Goose CLI not found | "Goose CLI not found. [Install instructions →]" |
| Goose accessibility denied | "Accessibility permission required for computer-use. [Open Settings →]" |
| Backend crash mid-session | Inline error in chat + "Retry with Kilo Native" button |
| Hermes classify timeout | Silent fallback to local tagger (no user-visible error) |
| ZeroClaw policy violation | "Action blocked by security policy. [Review policy →]" |

---

### Phase 5 Acceptance Criteria

- [ ] Access Profile CRUD works end-to-end (create, edit, delete, duplicate)
- [ ] Credentials stored in SecretStorage, not in settings JSON
- [ ] YOLO mode shows warning; clears approval gates; banner visible
- [ ] Audit log shows all routing decisions, approvals, session events
- [ ] Audit log filterable and exportable
- [ ] All test files created with passing tests
- [ ] All error states show actionable messages
- [ ] No regressions in existing KiloCode functionality

---

## Dependency Map

```
Phase 1 ───────────────────────────────────────────────────────────
  1.1 types
  1.2 AccessProfileService    depends on: 1.1
  1.3 BackendSelector UI      depends on: 1.1
  1.4 KiloNativeAdapter       depends on: 1.1, existing KiloProvider
  1.5 BackendRouter skeleton  depends on: 1.1, 1.4
  1.6 Extension wiring        depends on: 1.2, 1.4, 1.5

Phase 2 ─────────────── (can overlap with Phase 3) ──────────────────
  2.1 OpenHandsAdapter        depends on: Phase 1
  2.2 AgentBackendsTab UI     depends on: Phase 1
  2.3 Event stream bridge     depends on: 2.1, 2.2
  2.4 Default OH profile      depends on: 1.2

Phase 3 ─────────────── (can overlap with Phase 2) ──────────────────
  3.1 GooseAdapter            depends on: Phase 1
  3.2 Computer-use session    depends on: 3.1
  3.3 Goose settings panel    depends on: Phase 1
  3.4 MCP extension list      depends on: 3.1

Phase 4 ────────────────────────────────────────────────────────────
  4.1 CapabilityTagger        depends on: 1.1
  4.2 Hermes routing hook     depends on: 4.1, existing HermesClient
  4.3 Auto-selection          depends on: 4.2, 2.1, 3.1
  4.4 Override + annotation   depends on: 4.3
  4.5 Audit trail             depends on: 4.3

Phase 5 ────────────────────────────────────────────────────────────
  5.1 Profile editor UI       depends on: 1.2, Phase 2+3 settings
  5.2 Security gate           depends on: Phase 1–4
  5.3 Logs viewer             depends on: 4.5
  5.4 Test suite              depends on: all phases
  5.5 Error UX                depends on: all phases
```

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| OpenHands API changes between 0.29 and latest | Medium | High | Pin to tested version; version-check at launch |
| Goose stdio protocol not stable | Medium | High | Version-pin; fallback to HTTP if stdio breaks |
| Docker socket access denied in VS Code extension | Low | High | Document requirement; detect and show setup guide |
| Hermes `/classify` endpoint not yet deployed | High | Medium | Local CapabilityTagger is the primary fallback; no blocker |
| macOS accessibility permission flow changes with OS updates | Low | Medium | Runtime check; graceful error message |
| Performance regression in KiloProvider message path (Phase 4) | Medium | High | Benchmark before/after; async routing must not block UI |
| SecretStorage unavailable in some VS Code forks | Low | Medium | Graceful degradation: warn user, offer env-var alternative |

---

*End of BACKEND_INTEGRATION_ROADMAP.md*
