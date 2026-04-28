# OpenHands & Goose Backend Switching — Status

## What Is Done

### UI Infrastructure (WebView)
- **BackendSelector.tsx** — dropdown/tab UI for selecting active backend
- **AgentBackendsTab.tsx** — settings tab that hosts BackendSelector
- **BackendContext.tsx** — React context; holds `activeBackend` state and posts `backendStateChanged` to the extension host

### Extension Host Infrastructure (Node.js)
- **`src/kilo-provider/backends/BackendManager.ts`** — new file managing process lifecycle
  - Tracks `activeBackend` state
  - Stops the previously-running backend before starting the new one
  - Emits `backendStatusUpdate` messages back to the WebView for status display
- **`src/KiloProvider.ts`** — wired in:
  - Imports `BackendManager`
  - Declares and initialises `_backendManager` in the constructor
  - Handles `backendStateChanged` message in the main switch
  - Handles `previewVoice`, `stopVoicePreview`, `setVoiceVolume`, `setTtsSpeed` passthrough messages
  - Disposes `_backendManager` in `dispose()`

---

## What Works Now

| Feature | Status |
|---|---|
| Switching backends in the UI | Works — posts `backendStateChanged` to extension host |
| Extension host receives backend switch | Works — `case "backendStateChanged"` in switch |
| OpenHands: detect running server | Works — HTTP probe to `/api/options/models` |
| OpenHands: display startup instructions if server absent | Works — `error` status with Docker command |
| Goose: detect CLI on PATH | Works — `which`/`where` check |
| Goose: spawn in ACP/stdio mode | Works — `cp.spawn("goose", ["acp"])` |
| Status propagation to WebView | Works — `backendStatusUpdate` messages |
| Output channel for logs | Works — "KiloCode Backends" output channel |
| Dispose / cleanup on extension deactivation | Works |
| Voice preview passthrough (browser TTS) | Works — `speakText`, `stopSpeaking`, `voiceVolumeChanged`, `ttsSpeedChanged` |

---

## What Needs Phase 2

### Task Routing
Currently, all task execution still goes through the KiloCode native backend regardless of the selected backend. Phase 2 must intercept task messages and route them:

- **OpenHands**: Send user messages as tasks to `POST /api/conversations` + stream SSE from `GET /api/conversations/{id}/events`
- **Goose**: Send tasks over the JSON-RPC stdio pipe opened on the `_gooseProcess` handle

### OpenHands Full Integration
- Parse SSE event stream from OpenHands server
- Map `AgentStateChangedObservation`, `AgentMessageObservation`, `CmdOutputObservation`, etc. to KiloCode session events
- Handle file edit / terminal output overlays in the diff viewer

### Goose Full Integration
- Implement ACP (Agent Communication Protocol) JSON-RPC framing over stdin/stdout
- Handle `goose/message` request/response cycle
- Map Goose tool calls to KiloCode UI events

### Configuration UI
- `openhandsServerUrl` field in settings (currently read from `config` passed by the UI or `OPENHANDS_URL` env var)
- `gooseCliPath` field in settings (currently read from `config` or `GOOSE_CLI_PATH` env var)

---

## How to Test (Manual)

### Switching to kilo-native
1. Open KiloCode sidebar
2. Go to Settings → Agent Backends
3. Select "KiloCode Native"
4. Open Output panel → "KiloCode Backends" channel
5. Expect: `[BackendManager] Switching: <prev> → kilo-native` + `backendStatusUpdate {status: "running"}`

### Switching to OpenHands (server not running)
1. Select "OpenHands" in the backend selector
2. Output channel should log the probe attempt
3. WebView should receive `backendStatusUpdate { status: "error", message: "OpenHands not found..." }` with Docker start command

### Switching to OpenHands (server running)
1. Start OpenHands Docker container on port 3000
2. Select "OpenHands"
3. Output channel: `[OpenHands] Connected to existing server at http://localhost:3000`
4. WebView: `backendStatusUpdate { status: "running" }`

### Switching to Goose (CLI not installed)
1. Select "Goose"
2. Output channel logs `which goose` failure
3. WebView: `backendStatusUpdate { status: "error", message: "Goose CLI not found..." }` with install command

### Switching to Goose (CLI installed)
1. Install goose CLI and ensure it is on PATH
2. Select "Goose"
3. Output channel: Goose stdout/stderr lines
4. WebView: `backendStatusUpdate { status: "running", pid: <N> }`

---

## Known Limitations

- **No actual task routing**: messages typed in the chat still go to KiloCode native even when another backend is selected
- **OpenHands managed process**: the `_openhandsProcess` field is allocated but never actually set to a spawned process in the current implementation — the probe either finds an existing server or fails. Spawning the Docker process from Node.js is deferred to Phase 2
- **Goose ACP protocol**: `goose acp` sub-command may not exist in all Goose versions; verify against your installed version
- **Windows path separator**: `where` is used on win32 for CLI detection; paths with spaces in `gooseCliPath` are passed directly to `spawnSync` which handles quoting
- **No retry logic**: if the OpenHands server starts slowly, the probe may fail on first switch; user must re-select the backend to re-probe
