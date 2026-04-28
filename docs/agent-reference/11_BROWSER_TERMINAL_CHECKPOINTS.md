# KiloCode Browser, Terminal & Checkpoints
> FOR AGENTS. Typed, structured, exhaustive.

---

## 1. Browser Automation

### 1.1 Architecture

KiloCode exposes two distinct browser automation surfaces depending on client mode:

| Mode | Mechanism | Key package |
|------|-----------|-------------|
| **VSCode (new)** | Playwright MCP server (`@playwright/mcp@latest`) registered via `BrowserAutomationService` | `packages/kilo-vscode/src/services/browser-automation/browser-automation-service.ts` |
| **CLI** | User-configured MCP entry in `kilo.jsonc` pointing to `npx @playwright/mcp@latest` | `packages/opencode/src/mcp/` |
| **VSCode (legacy)** | Built-in Puppeteer-controlled headless Chromium (`browser_action` tool) | `packages/kilo-docs/pages/automate/tools/browser-action.md` |

### 1.2 BrowserAutomationService (VSCode new mode)

```typescript
// packages/kilo-vscode/src/services/browser-automation/browser-automation-service.ts
type BrowserAutomationState =
  | "disabled"
  | "registering"
  | "connected"
  | "failed"
  | "disconnected"

interface BrowserAutomationServiceConfig {
  // vscode setting: kilo-code.new.browserAutomation.enabled
  enabled: boolean
  // vscode setting: kilo-code.new.browserAutomation.headless (default: false)
  headless: boolean
  // vscode setting: kilo-code.new.browserAutomation.useSystemChrome (default: true)
  useSystemChrome: boolean
}
```

**Lifecycle:**
1. On `enabled=true`: calls `client.mcp.add({ name: "kilo-playwright", config: { type: "local", command: ["npx", "@playwright/mcp@latest", ...flags] } })`
2. On `enabled=false`: calls `client.mcp.disconnect({ name: "kilo-playwright" })`
3. Re-registers automatically on CLI backend reconnect via `reregisterIfEnabled()`

**MCP server name:** `kilo-playwright`

### 1.3 Legacy `browser_action` Tool (VSCode legacy / Puppeteer)

The `browser_action` tool is a built-in agent tool that controls a Puppeteer-managed Chromium instance.

#### BrowserAction variants table

| `action` value | Required params | Description |
|----------------|-----------------|-------------|
| `launch` | `url: string` | Starts a new browser session and navigates to URL. Returns screenshot. |
| `click` | `coordinate: string` (`"x,y"`) | Clicks at viewport-relative coordinates. Returns screenshot. |
| `type` | `text: string` | Types text into the currently focused element. Returns screenshot. |
| `scroll_down` | — | Scrolls down by one page height. Returns screenshot. |
| `scroll_up` | — | Scrolls up by one page height. Returns screenshot. |
| `close` | — | Terminates or disconnects from the browser session. |

```typescript
// Conceptual type (no single source-of-truth TS interface; derived from docs)
type BrowserActionName =
  | "launch"
  | "click"
  | "type"
  | "scroll_down"
  | "scroll_up"
  | "close"

interface BrowserActionInput {
  action: BrowserActionName
  url?: string        // required for "launch"
  coordinate?: string // required for "click" — format: "x,y"
  text?: string       // required for "type"
}
```

**Constraints:**
- Sessions must follow the sequence: `launch` → (N × `click | type | scroll_*`) → `close`
- Only one `browser_action` per message turn
- No other tool can be called while the browser session is open
- Viewport defaults: 900×600; configurable to 1280×800, 768×1024, 360×640
- Screenshot format: WebP (fallback PNG), quality default 75%

**Modes:**
- **Local**: Fresh Chromium via Puppeteer; no cookies/extensions; `close` kills the process
- **Remote**: Connects to Chrome on `localhost:9222` (remote debugging port); `close` disconnects only

### 1.4 CLI Playwright MCP Tools (new mode)

When configured via MCP, the following tools are provided by `@playwright/mcp`:

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to a URL |
| `browser_click` | Click an element by selector or accessibility label |
| `browser_type` | Type text into an input |
| `browser_screenshot` | Capture screenshot of current page |
| `browser_scroll` | Scroll page or element |
| `browser_hover` | Hover over an element |
| `browser_select` | Select option from dropdown |
| `browser_drag` | Drag element to target |

---

## 2. PTY / Terminal

### 2.1 Core Types

```typescript
// packages/opencode/src/pty/pty.ts — low-level PTY process handle
interface Disp {
  dispose(): void
}

interface Exit {
  exitCode: number
  signal?: number | string
}

interface Opts {
  name: string          // terminal type e.g. "xterm-256color"
  cols?: number
  rows?: number
  cwd?: string
  env?: Record<string, string>
}

interface Proc {
  pid: number
  onData(listener: (data: string) => void): Disp
  onExit(listener: (event: Exit) => void): Disp
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(signal?: string): void
}
```

```typescript
// packages/opencode/src/pty/index.ts — public session info type
// Schema ref: "Pty"
interface Pty_Info {
  id: PtyID          // branded string, prefix "pty"
  title: string
  command: string
  args: string[]
  cwd: string
  status: "running" | "exited"
  pid: number
}

interface Pty_CreateInput {
  command?: string
  args?: string[]
  cwd?: string
  title?: string
  env?: Record<string, string>
}

interface Pty_UpdateInput {
  title?: string
  size?: { rows: number; cols: number }
}
```

### 2.2 Spawn Flow

```typescript
// Pseudo-code of Pty.create()
// packages/opencode/src/pty/index.ts
async function create(input: CreateInput): Promise<Info> {
  const id = PtyID.ascending()
  const command = input.command || Shell.preferred()
  const args = input.args ?? []
  if (Shell.login(command)) args.push("-l")

  const env = {
    ...process.env,
    ...input.env,
    ...shell.env,         // from Plugin "shell.env" trigger
    TERM: "xterm-256color",
    KILO_TERMINAL: "1",
    // KILO_SERVER_PASSWORD and KILO_SERVER_USERNAME are explicitly DELETED
  }
  if (process.platform === "win32") {
    env.LC_ALL = env.LC_CTYPE = env.LANG = "C.UTF-8"
  }

  const proc = spawn(command, args, { name: "xterm-256color", cwd, env })
  // proc.onData → buffer (ring, 2 MB max) + broadcast to WebSocket subscribers
  // proc.onExit → publishes Pty.Event.Exited + calls remove(id)
  bus.publish(Pty.Event.Created, { info })
  return info
}
```

**Implementation backends:**
- **Bun runtime:** `packages/opencode/src/pty/pty.bun.ts` — wraps `bun-pty`
- **Node runtime:** `packages/opencode/src/pty/pty.node.ts` — wraps `@lydell/node-pty`

**Buffer constants:**
- `BUFFER_LIMIT = 2 MB` — oldest bytes are trimmed when exceeded
- `BUFFER_CHUNK = 64 KB` — chunk size for WebSocket replay sends

### 2.3 IPC — Bus Events

```typescript
// packages/opencode/src/pty/index.ts
namespace Pty.Event {
  Created: BusEvent<{ info: Pty.Info }>           // "pty.created"
  Updated: BusEvent<{ info: Pty.Info }>           // "pty.updated"
  Exited:  BusEvent<{ id: PtyID; exitCode: number }> // "pty.exited"
  Deleted: BusEvent<{ id: PtyID }>                // "pty.deleted"
}
```

### 2.4 REST API

Base path: `/pty` (instance-scoped)

| Method | Path | `operationId` | Description |
|--------|------|---------------|-------------|
| GET | `/pty` | `pty.list` | List all active PTY sessions |
| POST | `/pty` | `pty.create` | Spawn new PTY session |
| GET | `/pty/:ptyID` | `pty.get` | Get session info |
| PUT | `/pty/:ptyID` | `pty.update` | Update title or resize |
| DELETE | `/pty/:ptyID` | `pty.remove` | Kill and remove session |
| GET (WS) | `/pty/:ptyID/connect` | `pty.connect` | WebSocket for I/O |

### 2.5 WebSocket Protocol (`/pty/:ptyID/connect`)

**Query param:** `cursor` (integer) — byte offset to replay from.  
- `cursor = -1`: request no backfill (tail-only)
- `cursor = 0` (default): replay full buffer from beginning
- `cursor = N`: replay from offset N

**Frame encoding:**
- **Data frame:** raw UTF-8 text string → terminal output chunk
- **Control frame:** `[0x00, ...UTF-8 JSON bytes]` — format: `{ cursor: number }` — sent after backfill completes

**Client → server:** any string or ArrayBuffer message is written directly to the PTY process stdin.

---

## 3. Checkpoint / Snapshot System

### 3.1 Storage Location

```
${XDG_DATA_HOME}/kilo/snapshot/<project-id>/<worktree-hash>/
```

Concrete path construction:
```typescript
// packages/opencode/src/snapshot/index.ts, line 95
gitdir = path.join(Global.Path.data, "snapshot", ctx.project.id, Hash.fast(ctx.worktree))
// Global.Path.data = ${XDG_DATA_HOME}/kilo   (see packages/opencode/src/global/index.ts)
// ctx.project.id   = stable project identifier
// Hash.fast(ctx.worktree) = fast hash of the absolute worktree path
```

The `gitdir` is an independent bare Git repository (separate from the project repo) used exclusively to track file state.

**Snapshot is disabled when:**
- `config.snapshot === false`
- `Flag.KILO_CLIENT === "acp"` (ACP clients)
- `ctx.project.vcs !== "git"`

### 3.2 Core Types

```typescript
// packages/opencode/src/snapshot/index.ts
import z from "zod"

// Snapshot.Patch — identifies a set of changed files at a tree hash
const Patch = z.object({
  hash: z.string(),          // git tree hash produced by write-tree
  files: z.string().array(), // absolute paths of changed files
})
type Patch = z.infer<typeof Patch>

// Snapshot.FileDiff — per-file diff details (schema ref: "SnapshotFileDiff")
const FileDiff = z.object({
  file: z.string(),
  patch: z.string(),         // unified diff text
  additions: z.number(),
  deletions: z.number(),
  status: z.enum(["added", "deleted", "modified"]).optional(),
})
type FileDiff = z.infer<typeof FileDiff>
```

### 3.3 Service Interface

```typescript
// packages/opencode/src/snapshot/index.ts
interface Snapshot_Interface {
  init(): Effect<void>
  cleanup(): Effect<void>

  // Stages current working-tree changes into the shadow git repo,
  // then calls git write-tree. Returns the tree hash or undefined.
  track(): Effect<string | undefined>

  // Given a tree hash, returns a Patch listing changed files
  // (excludes gitignored files from the reported set).
  patch(hash: string): Effect<Patch>

  // Full-restore: git read-tree + git checkout-index -a -f
  restore(snapshot: string): Effect<void>

  // Per-file revert: for each Patch, checks out files from the
  // stored tree hash; deletes files that did not exist in the snapshot.
  revert(patches: Patch[]): Effect<void>

  // Returns a unified diff string from hash to current working tree.
  diff(hash: string): Effect<string>

  // Returns per-file FileDiff array comparing two tree hashes.
  // Results are cached (up to 100 entries, LRU eviction).
  diffFull(from: string, to: string): Effect<FileDiff[]>
}
```

### 3.4 Checkpoint Creation Flow

```mermaid
flowchart TD
    A[Agent calls Snapshot.track()] --> B{enabled?}
    B -- no --> Z[return undefined]
    B -- yes --> C[git init gitdir if not exists]
    C --> D[sync exclude rules from project .git/info/exclude]
    D --> E[git diff-files + ls-files --others\n→ list modified + untracked files]
    E --> F[filter: check-ignore against project .gitignore]
    F --> G[git add --all --sparse those files into shadow index]
    G --> H[git write-tree → tree hash]
    H --> I[return tree hash / store in PatchPart or SnapshotPart]
```

**Git flags used during staging:**
- `core.autocrlf=false`, `core.longpaths=true`, `core.symlinks=true`, `core.fsmonitor=false`
- `core.quotepath=false` for listing
- Files larger than **2 MB** (untracked only) are excluded via `sync()` into the shadow `.git/info/exclude`

### 3.5 Session Message Parts Carrying Snapshots

```typescript
// packages/opencode/src/session/message-v2.ts

// Embedded in a StepStartPart or StepFinishPart:
interface StepStartPart {
  type: "step-start"
  snapshot?: string  // tree hash recorded at step start
  // ...base fields
}

interface StepFinishPart {
  type: "step-finish"
  snapshot?: string  // tree hash recorded at step finish
  // ...base fields
}

// Standalone snapshot reference (schema ref: "SnapshotPart"):
interface SnapshotPart {
  type: "snapshot"
  snapshot: string   // tree hash
  id: PartID
  sessionID: SessionID
  messageID: MessageID
}

// Accumulates per-tool-call file changes (schema ref: "PatchPart"):
interface PatchPart {
  type: "patch"
  hash: string       // tree hash at the time of the patch
  files: string[]    // absolute paths of changed files
  id: PartID
  sessionID: SessionID
  messageID: MessageID
}
```

### 3.6 Revert Flow

```mermaid
flowchart TD
    A[POST /session/:id/revert\nBody: RevertInput] --> B[SessionRevert.revert]
    B --> C[assertNotBusy — fails if agent is running]
    C --> D[Walk all messages to collect Patch parts\nthat come after the target message/part]
    D --> E{session.revert.snapshot exists?}
    E -- yes --> F[snap.restore(existing snapshot)\n=git read-tree + checkout-index -a -f]
    E -- no --> G[snap.track() → new snapshot hash\nstored as rev.snapshot]
    F --> H[compute diffs BEFORE file revert\nsummary.computeDiff on range messages]
    G --> H
    H --> I[snap.revert(collected patches)\n= per-file git checkout hash -- file\nOR delete if not in tree]
    I --> J[snap.diff(rev.snapshot) → unified diff string]
    J --> K[bus.publish Session.Event.Diff\n{sessionID, diff: FileDiff[]}]
    K --> L[sessions.setRevert — persist rev + summary to DB]
    L --> M[return updated Session.Info\nwith revert field populated]
```

**Revert input type:**
```typescript
// packages/opencode/src/session/revert.ts
interface SessionRevert_RevertInput {
  sessionID: SessionID
  messageID: MessageID
  partID?: PartID    // if set, revert starts mid-message at this part
}
```

**Session.Info.revert field (populated after revert):**
```typescript
// packages/opencode/src/session/session.ts — Session.Info
interface SessionRevert {
  messageID: MessageID
  partID?: PartID
  snapshot?: string  // tree hash of pre-revert state (used for unrevert)
  diff?: string      // unified diff of reverted changes
}
```

### 3.7 Unrevert Flow

```
POST /session/:id/unrevert
  → SessionRevert.unrevert({ sessionID })
  → if session.revert.snapshot: snap.restore(snapshot)
  → sessions.clearRevert(sessionID)
  → returns Session.Info with revert = undefined
```

### 3.8 Pruning

- **Retention:** 7 days — `git gc --prune=7.days`
- **Schedule:** runs on a background fiber, first fire after **1 minute** post-init, then every **1 hour**
- **Scope:** pruning operates per-gitdir (one gitdir per project × worktree combination)

```typescript
// packages/opencode/src/snapshot/index.ts
const prune = "7.days"
// Scheduled via Effect.repeat(Schedule.spaced(Duration.hours(1)))
//            .pipe(Effect.delay(Duration.minutes(1)))
```

### 3.9 IPC — Bus Events for Revert

| Event type | Schema | When emitted |
|------------|--------|--------------|
| `session.diff` | `{ sessionID: SessionID; diff: SnapshotFileDiff[] }` | After `snap.revert()` completes; carries per-file diff data |
| `session.updated` | `{ sessionID: SessionID; info: Session }` | After `setRevert()` persists to DB; `info.revert` is populated |

These are broadcast over the SSE event stream at `/event` (instance-scoped).

---

## 4. REST API — Revert Endpoints

| Method | Path | `operationId` | Body | Response |
|--------|------|---------------|------|----------|
| POST | `/session/:sessionID/revert` | `session.revert` | `{ messageID, partID? }` | `Session` (with `.revert` set) |
| POST | `/session/:sessionID/unrevert` | `session.unrevert` | _(none)_ | `Session` (with `.revert` cleared) |
| GET | `/session/:sessionID/diff` | `session.diff` | — | `SnapshotFileDiff[]` |

---

## 5. Key Source Files

| Concern | File |
|---------|------|
| Snapshot service (write-tree, revert, prune) | `packages/opencode/src/snapshot/index.ts` |
| Session revert orchestration | `packages/opencode/src/session/revert.ts` |
| Session info type + events | `packages/opencode/src/session/session.ts` |
| PatchPart / SnapshotPart message parts | `packages/opencode/src/session/message-v2.ts` |
| PTY low-level types | `packages/opencode/src/pty/pty.ts` |
| PTY service (create, connect, events) | `packages/opencode/src/pty/index.ts` |
| PTY schema (PtyID) | `packages/opencode/src/pty/schema.ts` |
| PTY REST + WebSocket routes | `packages/opencode/src/server/instance/pty.ts` |
| PTY Bun backend | `packages/opencode/src/pty/pty.bun.ts` |
| PTY Node backend | `packages/opencode/src/pty/pty.node.ts` |
| Global data path | `packages/opencode/src/global/index.ts` |
| Browser automation service (VSCode) | `packages/kilo-vscode/src/services/browser-automation/browser-automation-service.ts` |
| browser_action docs | `packages/kilo-docs/pages/automate/tools/browser-action.md` |
| Browser use docs (all modes) | `packages/kilo-docs/pages/code-with-ai/features/browser-use.md` |
| Kilocode DiffFull batch helper | `packages/opencode/src/kilocode/snapshot/diff-full.ts` |
