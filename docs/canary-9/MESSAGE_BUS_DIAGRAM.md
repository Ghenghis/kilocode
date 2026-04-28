# KiloCode IPC / Message Bus — Visual Reference (canary.9)

> **Scope:** This document visualises the bidirectional message bus that connects the SolidJS WebView
> to the VS Code Extension Host (Node.js / `KiloProvider.ts`).  It supplements the typed reference in
> `docs/agent-reference/08_IPC_PROTOCOL.md` with diagrams and a catalogue of the new message types
> introduced in canary.9.

---

## 1. Overview

KiloCode uses the VS Code WebView IPC mechanism as its sole transport layer between UI and backend:

| Direction | Mechanism | TypeScript type |
|-----------|-----------|-----------------|
| WebView → Extension | `vscode.postMessage(msg)` | `WebviewMessage` |
| Extension → WebView | `webview.postMessage(msg)` | `ExtensionMessage` |

All messages are plain JSON objects with a discriminant `type` string field.  There is no shared
memory, no `window.*` globals, and no HTTP between the two sides — only `postMessage` / `onMessage`.

**Key invariants:**

- Every outbound message from the webview is handled synchronously in
  `KiloProvider.setupWebviewMessageHandler()`.
- Most request/response pairs are **fire-and-forget** on the webview side; the response arrives as a
  separate push message (often with a matching `requestId`).
- Streaming AI output flows via SSE from the CLI server → Extension Host → WebView as batched
  `partUpdated` / `partsUpdated` messages.
- The handshake sequence is strictly `webviewReady` → burst of ~10 state-sync messages from the
  extension (see `ready`, `connectionState`, `profileData`, `providersLoaded`, `configLoaded`, …).

---

## 2. Message Flow Diagram

The SVG below is 1000 × 800.  Blue arrows represent WebView → Extension messages; green arrows
represent Extension → WebView messages.

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800" viewBox="0 0 1000 800"
     font-family="'Segoe UI', system-ui, sans-serif" font-size="12">

  <!-- ── background ── -->
  <rect width="1000" height="800" fill="#0f1117"/>

  <!-- ══════════════════════════════════════════════
       LEFT PANEL — WebView (SolidJS)
  ══════════════════════════════════════════════ -->
  <rect x="20" y="20" width="260" height="760" rx="10" fill="#1a1f2e" stroke="#2d3a52" stroke-width="1.5"/>
  <text x="150" y="48" text-anchor="middle" fill="#93c5fd" font-size="14" font-weight="bold">WebView (SolidJS)</text>
  <text x="150" y="64" text-anchor="middle" fill="#64748b" font-size="11">vscode.postMessage()</text>

  <!-- Chat component -->
  <rect x="35" y="80" width="230" height="56" rx="6" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1"/>
  <text x="150" y="100" text-anchor="middle" fill="#93c5fd" font-weight="bold">Chat</text>
  <text x="150" y="116" text-anchor="middle" fill="#64748b" font-size="10">sendMessage · abort</text>
  <text x="150" y="129" text-anchor="middle" fill="#64748b" font-size="10">questionReply · suggestionAccept</text>

  <!-- History component -->
  <rect x="35" y="148" width="230" height="56" rx="6" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1"/>
  <text x="150" y="168" text-anchor="middle" fill="#93c5fd" font-weight="bold">History</text>
  <text x="150" y="184" text-anchor="middle" fill="#64748b" font-size="10">loadSessions · deleteSession</text>
  <text x="150" y="197" text-anchor="middle" fill="#64748b" font-size="10">toggleFavoriteSession · requestSessionPreview</text>

  <!-- Settings — Providers tab -->
  <rect x="35" y="216" width="230" height="72" rx="6" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1"/>
  <text x="150" y="236" text-anchor="middle" fill="#93c5fd" font-weight="bold">Settings › Providers</text>
  <text x="150" y="252" text-anchor="middle" fill="#64748b" font-size="10">testProviderKey · connectProvider</text>
  <text x="150" y="265" text-anchor="middle" fill="#64748b" font-size="10">testCustomProviderModel</text>
  <text x="150" y="278" text-anchor="middle" fill="#64748b" font-size="10">testCustomProviderConnection · detectCustomProviderEnv</text>

  <!-- Settings — Context/Rules tab -->
  <rect x="35" y="300" width="230" height="60" rx="6" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1"/>
  <text x="150" y="320" text-anchor="middle" fill="#93c5fd" font-weight="bold">Settings › Context</text>
  <text x="150" y="336" text-anchor="middle" fill="#64748b" font-size="10">requestRulesFiles · createRulesFile</text>
  <text x="150" y="349" text-anchor="middle" fill="#64748b" font-size="10">previewSystemPrompt</text>

  <!-- Settings — Language tab -->
  <rect x="35" y="372" width="230" height="44" rx="6" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1"/>
  <text x="150" y="392" text-anchor="middle" fill="#93c5fd" font-weight="bold">Settings › Language</text>
  <text x="150" y="408" text-anchor="middle" fill="#64748b" font-size="10">requestVSCodeLanguage · setLanguage</text>

  <!-- Agent Manager -->
  <rect x="35" y="428" width="230" height="60" rx="6" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1"/>
  <text x="150" y="448" text-anchor="middle" fill="#93c5fd" font-weight="bold">Agent Manager</text>
  <text x="150" y="464" text-anchor="middle" fill="#64748b" font-size="10">checkpointCreateBranch · configureMaos</text>
  <text x="150" y="477" text-anchor="middle" fill="#64748b" font-size="10">agentManager.* (worktree/session ops)</text>

  <!-- Notifications / Hub -->
  <rect x="35" y="500" width="230" height="56" rx="6" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1"/>
  <text x="150" y="520" text-anchor="middle" fill="#93c5fd" font-weight="bold">Notifications / Hub</text>
  <text x="150" y="536" text-anchor="middle" fill="#64748b" font-size="10">testNotification · requestNotifications</text>
  <text x="150" y="549" text-anchor="middle" fill="#64748b" font-size="10">dismissNotification</text>

  <!-- Browser / SW -->
  <rect x="35" y="568" width="230" height="56" rx="6" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1"/>
  <text x="150" y="588" text-anchor="middle" fill="#93c5fd" font-weight="bold">Browser / Service Worker</text>
  <text x="150" y="604" text-anchor="middle" fill="#64748b" font-size="10">requestBrowserSettings</text>
  <text x="150" y="617" text-anchor="middle" fill="#64748b" font-size="10">[reports: swRegistrationFailed/Ok]</text>

  <!-- Import / Config -->
  <rect x="35" y="636" width="230" height="56" rx="6" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1"/>
  <text x="150" y="656" text-anchor="middle" fill="#93c5fd" font-weight="bold">Import &amp; Config</text>
  <text x="150" y="672" text-anchor="middle" fill="#64748b" font-size="10">importKiloConfig · updateConfig</text>
  <text x="150" y="685" text-anchor="middle" fill="#64748b" font-size="10">requestConfig · requestGlobalConfig</text>

  <!-- ══════════════════════════════════════════════
       CENTER — Message Bus channel
  ══════════════════════════════════════════════ -->
  <rect x="350" y="20" width="300" height="760" rx="10" fill="#111827" stroke="#374151" stroke-width="1.5"/>
  <text x="500" y="48" text-anchor="middle" fill="#e5e7eb" font-size="14" font-weight="bold">Message Bus</text>
  <text x="500" y="64" text-anchor="middle" fill="#6b7280" font-size="11">postMessage / onMessage</text>

  <!-- Blue (WV→EH) arrows -->
  <!-- Chat row -->
  <line x1="265" y1="108" x2="350" y2="108" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arrowB)"/>
  <text x="307" y="103" text-anchor="middle" fill="#60a5fa" font-size="9">sendMessage</text>

  <!-- History row -->
  <line x1="265" y1="176" x2="350" y2="176" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arrowB)"/>
  <text x="307" y="171" text-anchor="middle" fill="#60a5fa" font-size="9">loadSessions</text>

  <!-- Providers row -->
  <line x1="265" y1="252" x2="350" y2="252" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arrowB)"/>
  <text x="307" y="247" text-anchor="middle" fill="#60a5fa" font-size="9">testProviderKey</text>

  <!-- Context/Rules row -->
  <line x1="265" y1="325" x2="350" y2="325" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arrowB)"/>
  <text x="307" y="320" text-anchor="middle" fill="#60a5fa" font-size="9">requestRulesFiles</text>

  <!-- Language row -->
  <line x1="265" y1="394" x2="350" y2="394" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arrowB)"/>
  <text x="307" y="389" text-anchor="middle" fill="#60a5fa" font-size="9">requestVSCodeLanguage</text>

  <!-- Agent Manager row -->
  <line x1="265" y1="458" x2="350" y2="458" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arrowB)"/>
  <text x="307" y="453" text-anchor="middle" fill="#60a5fa" font-size="9">checkpointCreateBranch</text>

  <!-- Notifications row -->
  <line x1="265" y1="528" x2="350" y2="528" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arrowB)"/>
  <text x="307" y="523" text-anchor="middle" fill="#60a5fa" font-size="9">testNotification</text>

  <!-- Browser row -->
  <line x1="265" y1="596" x2="350" y2="596" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arrowB)"/>
  <text x="307" y="591" text-anchor="middle" fill="#60a5fa" font-size="9">requestBrowserSettings</text>

  <!-- Import row -->
  <line x1="265" y1="660" x2="350" y2="660" stroke="#3b82f6" stroke-width="1.5" marker-end="url(#arrowB)"/>
  <text x="307" y="655" text-anchor="middle" fill="#60a5fa" font-size="9">importKiloConfig</text>

  <!-- Green (EH→WV) arrows — return paths offset downward -->
  <line x1="650" y1="123" x2="735" y2="123" stroke="#22c55e" stroke-width="1.5" marker-start="url(#arrowG)"/>
  <text x="692" y="118" text-anchor="middle" fill="#4ade80" font-size="9">partUpdated/sessionStatus</text>

  <line x1="650" y1="191" x2="735" y2="191" stroke="#22c55e" stroke-width="1.5" marker-start="url(#arrowG)"/>
  <text x="692" y="186" text-anchor="middle" fill="#4ade80" font-size="9">sessionsLoaded / sessionPreviewLoaded</text>

  <line x1="650" y1="267" x2="735" y2="267" stroke="#22c55e" stroke-width="1.5" marker-start="url(#arrowG)"/>
  <text x="692" y="262" text-anchor="middle" fill="#4ade80" font-size="9">testProviderKeyResult</text>

  <line x1="650" y1="340" x2="735" y2="340" stroke="#22c55e" stroke-width="1.5" marker-start="url(#arrowG)"/>
  <text x="692" y="335" text-anchor="middle" fill="#4ade80" font-size="9">rulesFilesLoaded / systemPromptPreview</text>

  <line x1="650" y1="409" x2="735" y2="409" stroke="#22c55e" stroke-width="1.5" marker-start="url(#arrowG)"/>
  <text x="692" y="404" text-anchor="middle" fill="#4ade80" font-size="9">vscodeLanguageDetected / languageChanged</text>

  <line x1="650" y1="473" x2="735" y2="473" stroke="#22c55e" stroke-width="1.5" marker-start="url(#arrowG)"/>
  <text x="692" y="468" text-anchor="middle" fill="#4ade80" font-size="9">agentManager.state / hubStatusUpdate</text>

  <line x1="650" y1="543" x2="735" y2="543" stroke="#22c55e" stroke-width="1.5" marker-start="url(#arrowG)"/>
  <text x="692" y="538" text-anchor="middle" fill="#4ade80" font-size="9">notificationsLoaded</text>

  <line x1="650" y1="611" x2="735" y2="611" stroke="#22c55e" stroke-width="1.5" marker-start="url(#arrowG)"/>
  <text x="692" y="606" text-anchor="middle" fill="#4ade80" font-size="9">browserSettingsLoaded / browserStatusUpdate</text>

  <line x1="650" y1="675" x2="735" y2="675" stroke="#22c55e" stroke-width="1.5" marker-start="url(#arrowG)"/>
  <text x="692" y="670" text-anchor="middle" fill="#4ade80" font-size="9">kiloConfigImported / configLoaded</text>

  <!-- bus internals label -->
  <text x="500" y="380" text-anchor="middle" fill="#374151" font-size="28" font-weight="bold">⇄</text>
  <text x="500" y="410" text-anchor="middle" fill="#6b7280" font-size="11">JSON objects</text>
  <text x="500" y="428" text-anchor="middle" fill="#6b7280" font-size="11">discriminant: type</text>

  <!-- SSE note inside bus -->
  <rect x="370" y="460" width="260" height="54" rx="6" fill="#1f2937" stroke="#374151"/>
  <text x="500" y="480" text-anchor="middle" fill="#9ca3af" font-size="10" font-weight="bold">SSE (CLI Server)</text>
  <text x="500" y="495" text-anchor="middle" fill="#6b7280" font-size="9">partUpdated / partsUpdated batches</text>
  <text x="500" y="508" text-anchor="middle" fill="#6b7280" font-size="9">mapped by mapSSEEventToWebviewMessage()</text>

  <!-- ══════════════════════════════════════════════
       RIGHT PANEL — Extension Host
  ══════════════════════════════════════════════ -->
  <rect x="720" y="20" width="260" height="760" rx="10" fill="#1a2e1a" stroke="#2d522d" stroke-width="1.5"/>
  <text x="850" y="48" text-anchor="middle" fill="#86efac" font-size="14" font-weight="bold">Extension Host (Node.js)</text>
  <text x="850" y="64" text-anchor="middle" fill="#4b7050" font-size="11">KiloProvider.ts</text>

  <!-- Handler boxes -->
  <rect x="735" y="80" width="230" height="56" rx="6" fill="#14291f" stroke="#22c55e" stroke-width="1"/>
  <text x="850" y="100" text-anchor="middle" fill="#86efac" font-weight="bold">Chat Handler</text>
  <text x="850" y="116" text-anchor="middle" fill="#4b7050" font-size="10">handleSendMessage() → SSE stream</text>
  <text x="850" y="129" text-anchor="middle" fill="#4b7050" font-size="10">handleAbort() · questionReply()</text>

  <rect x="735" y="148" width="230" height="56" rx="6" fill="#14291f" stroke="#22c55e" stroke-width="1"/>
  <text x="850" y="168" text-anchor="middle" fill="#86efac" font-weight="bold">Session Handler</text>
  <text x="850" y="184" text-anchor="middle" fill="#4b7050" font-size="10">handleLoadSessions() → sessionsLoaded</text>
  <text x="850" y="197" text-anchor="middle" fill="#4b7050" font-size="10">toggleFavoriteSession() · sessionPreview()</text>

  <rect x="735" y="216" width="230" height="72" rx="6" fill="#14291f" stroke="#22c55e" stroke-width="1"/>
  <text x="850" y="236" text-anchor="middle" fill="#86efac" font-weight="bold">Provider / Key Handler</text>
  <text x="850" y="252" text-anchor="middle" fill="#4b7050" font-size="10">handleTestProviderKey() → HTTP probe</text>
  <text x="850" y="265" text-anchor="middle" fill="#4b7050" font-size="10">handleTestCustomProviderModel()</text>
  <text x="850" y="278" text-anchor="middle" fill="#4b7050" font-size="10">handleDetectCustomProviderEnv()</text>

  <rect x="735" y="300" width="230" height="60" rx="6" fill="#14291f" stroke="#22c55e" stroke-width="1"/>
  <text x="850" y="320" text-anchor="middle" fill="#86efac" font-weight="bold">Rules / Prompt Handler</text>
  <text x="850" y="336" text-anchor="middle" fill="#4b7050" font-size="10">handleRequestRulesFiles() → rulesFilesLoaded</text>
  <text x="850" y="349" text-anchor="middle" fill="#4b7050" font-size="10">handlePreviewSystemPrompt() → systemPromptPreview</text>

  <rect x="735" y="372" width="230" height="44" rx="6" fill="#14291f" stroke="#22c55e" stroke-width="1"/>
  <text x="850" y="392" text-anchor="middle" fill="#86efac" font-weight="bold">Language Handler</text>
  <text x="850" y="408" text-anchor="middle" fill="#4b7050" font-size="10">handleRequestVSCodeLanguage() → vscodeLanguageDetected</text>

  <rect x="735" y="428" width="230" height="60" rx="6" fill="#14291f" stroke="#22c55e" stroke-width="1"/>
  <text x="850" y="448" text-anchor="middle" fill="#86efac" font-weight="bold">Agent Manager Handler</text>
  <text x="850" y="464" text-anchor="middle" fill="#4b7050" font-size="10">handleCheckpointCreateBranch()</text>
  <text x="850" y="477" text-anchor="middle" fill="#4b7050" font-size="10">handleConfigureMaos() · worktree ops</text>

  <rect x="735" y="500" width="230" height="56" rx="6" fill="#14291f" stroke="#22c55e" stroke-width="1"/>
  <text x="850" y="520" text-anchor="middle" fill="#86efac" font-weight="bold">Notification Handler</text>
  <text x="850" y="536" text-anchor="middle" fill="#4b7050" font-size="10">handleTestNotification() → hubStatusUpdate</text>
  <text x="850" y="549" text-anchor="middle" fill="#4b7050" font-size="10">pushNotificationsLoaded()</text>

  <rect x="735" y="568" width="230" height="56" rx="6" fill="#14291f" stroke="#22c55e" stroke-width="1"/>
  <text x="850" y="588" text-anchor="middle" fill="#86efac" font-weight="bold">Browser / SW Handler</text>
  <text x="850" y="604" text-anchor="middle" fill="#4b7050" font-size="10">handleRequestBrowserSettings()</text>
  <text x="850" y="617" text-anchor="middle" fill="#4b7050" font-size="10">push: browserStatusUpdate / swRegistration*</text>

  <rect x="735" y="636" width="230" height="56" rx="6" fill="#14291f" stroke="#22c55e" stroke-width="1"/>
  <text x="850" y="656" text-anchor="middle" fill="#86efac" font-weight="bold">Config Import Handler</text>
  <text x="850" y="672" text-anchor="middle" fill="#4b7050" font-size="10">handleImportKiloConfig() → kiloConfigImported</text>
  <text x="850" y="685" text-anchor="middle" fill="#4b7050" font-size="10">handleUpdateConfig() → configLoaded</text>

  <!-- ══════════════════════════════════════════════
       ARROW MARKERS
  ══════════════════════════════════════════════ -->
  <defs>
    <marker id="arrowB" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#3b82f6"/>
    </marker>
    <marker id="arrowG" markerWidth="8" markerHeight="6" refX="1" refY="3" orient="auto">
      <polygon points="8 0, 0 3, 8 6" fill="#22c55e"/>
    </marker>
  </defs>

  <!-- ══════════════════════════════════════════════
       LEGEND
  ══════════════════════════════════════════════ -->
  <rect x="370" y="540" width="260" height="54" rx="6" fill="#1f2937" stroke="#374151"/>
  <line x1="385" y1="561" x2="435" y2="561" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowB)"/>
  <text x="445" y="565" fill="#93c5fd" font-size="11">WebView → Extension</text>
  <line x1="385" y1="582" x2="435" y2="582" stroke="#22c55e" stroke-width="2" marker-end="url(#arrowB)"/>
  <text x="445" y="586" fill="#86efac" font-size="11">Extension → WebView</text>

</svg>
```

---

## 3. New Message Types in canary.9

The following message types were added or first documented in this session (canary.9).  Entries marked
**WV→EH** travel from the WebView to the Extension Host; **EH→WV** travel the opposite direction.

| Message type | Direction | Sender component | Handler (KiloProvider.ts) | Purpose |
|---|---|---|---|---|
| `testProviderKey` | WV→EH | Settings › Providers | `handleTestProviderKey()` | Trigger a live HTTP connectivity probe for a provider's stored API key |
| `testProviderKeyResult` | EH→WV | KiloProvider | — (push) | Return `{ ok, error? }` result of the connectivity probe |
| `requestRulesFiles` | WV→EH | Settings › Context | `handleRequestRulesFiles()` | Request the list of active `.kilo/rules/*.md` files for the workspace |
| `rulesFilesLoaded` | EH→WV | KiloProvider | — (push) | Return `RulesFileInfo[]` (path, size, source, mode) |
| `createRulesFile` | WV→EH | Settings › Context | `handleCreateRulesFile()` | Scaffold a new empty rules file at the given workspace-relative path |
| `previewSystemPrompt` | WV→EH | Settings › Context | `handlePreviewSystemPrompt()` | Assemble and return the complete system prompt for the active mode |
| `systemPromptPreview` | EH→WV | KiloProvider | — (push) | Return assembled `content: string` of the system prompt |
| `requestVSCodeLanguage` | WV→EH | Settings › Language | `handleRequestVSCodeLanguage()` | Ask the extension host for the VS Code display language / locale |
| `vscodeLanguageDetected` | EH→WV | KiloProvider | — (push) | Return detected locale string (e.g. `"en"`, `"ja"`) |
| `testNotification` | WV→EH | Settings › Notifications | `handleTestNotification()` | Fire a test VS Code notification to validate notification settings |
| `checkpointCreateBranch` | WV→EH | Agent Manager | `handleCheckpointCreateBranch()` | Create a git branch from a conversation checkpoint snapshot |
| `testCustomProviderModel` | WV→EH | Settings › Custom Providers | `handleTestCustomProviderModel()` | Validate that a specific model ID is reachable on a custom base URL |
| `testCustomProviderConnection` | WV→EH | Settings › Custom Providers | `handleTestCustomProviderConnection()` | Verify the base URL + API key of a custom provider are reachable |
| `detectCustomProviderEnv` | WV→EH | Settings › Custom Providers | `handleDetectCustomProviderEnv()` | Auto-detect environment variables that supply a key for a custom provider |
| `toggleFavoriteSession` | WV→EH | History | `handleToggleFavoriteSession()` | Star or un-star a session in the sidebar history list |
| `requestSessionPreview` | WV→EH | History | `handleRequestSessionPreview()` | Fetch a lightweight preview (latest N messages) for a session |
| `sessionPreviewLoaded` | EH→WV | KiloProvider | — (push) | Return `{ sessionID, messages[] }` preview payload |
| `hubStatusUpdate` | EH→WV | KiloProvider / Hub | — (push) | Broadcast current hub connectivity / channel status to the webview |
| `browserStatusUpdate` | EH→WV | KiloProvider / Browser | — (push) | Push browser agent status (headless/headed, connection state) |
| `swRegistrationFailed` | EH→WV | KiloProvider / SW | — (push) | Notify the webview that Service Worker registration failed |
| `swRegistrationOk` | EH→WV | KiloProvider / SW | — (push) | Confirm successful Service Worker registration and scope |
| `configureMaos` | WV→EH | Agent Manager / MAOS | `handleConfigureMaos()` | Configure the Multi-Agent Orchestration System parameters |
| `importKiloConfig` | WV→EH | Import / Config | `handleImportKiloConfig()` | Import a `.kilo/config.json` blob from an external source |
| `kiloConfigImported` | EH→WV | KiloProvider | — (push) | Confirm successful config import and trigger a `configLoaded` refresh |

---

## 4. Sequence Diagram — "Test API Key" Flow

The flow below shows the full round-trip from a user clicking the "Test" button next to a provider
API key, through the debounce timer, the IPC round-trip, and back to the UI badge.

```
  User (Browser)          WebView UI              Extension Host        External API
       │                       │                        │                    │
       │   click "Test Key"    │                        │                    │
       │──────────────────────>│                        │                    │
       │                       │  debounce 800 ms       │                    │
       │                       │  (cancel any pending)  │                    │
       │                       │                        │                    │
       │                       │  set badge = "testing" │                    │
       │                       │  (spinner shown)       │                    │
       │                       │                        │                    │
       │                  [800 ms elapses]               │                    │
       │                       │                        │                    │
       │                       │  postMessage({         │                    │
       │                       │    type: "testProvider │                    │
       │                       │    Key",               │                    │
       │                       │    requestId: "uuid1", │                    │
       │                       │    providerID: "openai"│                    │
       │                       │  })                    │                    │
       │                       │───────────────────────>│                    │
       │                       │                        │                    │
       │                       │                        │  HTTP GET/POST      │
       │                       │                        │  (minimal models    │
       │                       │                        │   list probe)       │
       │                       │                        │───────────────────>│
       │                       │                        │                    │
       │                       │                        │  200 OK / 401 Err  │
       │                       │                        │<───────────────────│
       │                       │                        │                    │
       │                       │  webview.postMessage({ │                    │
       │                       │    type: "testProvider │                    │
       │                       │    KeyResult",         │                    │
       │                       │    requestId: "uuid1", │                    │
       │                       │    providerID:"openai" │                    │
       │                       │    ok: true,           │                    │
       │                       │    error?: "..."       │                    │
       │                       │  })                    │                    │
       │                       │<───────────────────────│                    │
       │                       │                        │                    │
       │  badge = green "OK"   │                        │                    │
       │  or red "Invalid key" │                        │                    │
       │<──────────────────────│                        │                    │
       │                       │                        │                    │
```

**Implementation notes:**

- The debounce is applied in the Settings component (webview side) using a `setTimeout` / `clearTimeout`
  pattern.  Any keystroke in the API key field cancels the pending test.
- The `requestId` is a `crypto.randomUUID()` generated at call-site.  The handler stores an
  in-flight map `requestId → AbortController` so a second call with the same `providerID` can cancel
  the first HTTP probe.
- HTTP probes are intentionally lightweight — typically a `GET /v1/models` with a `HEAD`-first
  fallback — to avoid consuming quota.
- The result badge state is stored in a SolidJS signal and automatically cleaned up on unmount.

---

## 5. Error Handling Patterns

### 5.1 Named Error Types (`type` field)

Several message types are explicitly paired with error variants:

| Success message | Error message | Fields |
|---|---|---|
| `testProviderKeyResult { ok: true }` | `testProviderKeyResult { ok: false, error }` | `error?: string` |
| `configUpdated` | `configUpdateFailed` | `message, details?` |
| `permissionResolved` | `permissionError` | `permissionID` |
| `questionResolved` | `questionError` | `requestID` |
| `suggestionResolved` | `suggestionError` | `requestID` |
| `sendMessage` (success via SSE) | `sendMessageFailed` | `error, text, sessionID?, draftID?` |
| `sessionStatus { status: "idle" }` | `sessionError` | `sessionID, error.name, error.data?` |
| `marketplaceInstallResult { success: true }` | `marketplaceInstallResult { success: false, error }` | `success, slug, error?` |
| `azureKeyValidationResult { valid: true }` | `azureKeyValidationResult { valid: false, error }` | `valid, error?` |
| `agentManager.applyWorktreeDiffResult` (success) | same type, `status: "conflict" \| "error"` | `status, message, conflicts?` |

### 5.2 Connection State Machine

The `connectionState` message drives a global error overlay:

```
  connecting ──► connected ──► disconnected
       │              │              │
       │         (SSE drops)         │
       │              └──────────────┘
       │                     │
       │            retryConnection →
       └────────────────────── reconnect loop
                         error (fatal)
```

States: `"connecting"` | `"connected"` | `"disconnected"` | `"error"`.

The webview surfaces a banner for `disconnected` and a blocking overlay for `error`.  The user can
manually trigger reconnection via `{ type: "retryConnection" }`.

### 5.3 Session Retry Back-off

`sessionStatus` with `status: "retry"` carries additional fields used to render a countdown timer:

```typescript
{
  type: "sessionStatus",
  sessionID: string,
  status: "retry",
  attempt: number,      // 1-based retry count
  message: string,      // human-readable reason
  next: number          // epoch ms of next attempt
}
```

The webview derives a live countdown from `next - Date.now()` via a `setInterval`.

### 5.4 `requestId` Correlation

All async request/response pairs that are not backed by SSE use a `requestId` UUID to correlate the
response with the originating call.  Pattern:

```typescript
// Webview send
const requestId = crypto.randomUUID()
vscode.postMessage({ type: "testProviderKey", requestId, providerID })

// Webview receive handler
case "testProviderKeyResult":
  if (msg.requestId !== requestId) return  // stale response, discard
  handleResult(msg.ok, msg.error)
```

Message types using this pattern: `testProviderKey`, `fetchCustomProviderModels`,
`requestChatCompletion`, `requestFileSearch`, `requestTerminalContext`, `enhancePrompt`,
`authorizeProviderOAuth`, `connectProvider`, `disconnectProvider`, `saveCustomProvider`.

### 5.5 Unhandled Messages

The extension's `setupWebviewMessageHandler()` switch statement has a default branch that logs
unknown message types to the VS Code output channel (`KiloCode`) at `debug` level.  Webview-side
unknown messages from the extension are silently ignored by the SolidJS context providers.

### 5.6 Service Worker Registration Errors

`swRegistrationFailed` is a unidirectional push from the extension to the webview, used when the
KiloCode service worker (used for offline support and request interception) fails to register.  The
webview degrades gracefully — features requiring the SW are disabled, and a non-blocking warning
badge is shown.  `swRegistrationOk` clears that badge.

---

*Generated for canary.9 — cross-reference `docs/agent-reference/08_IPC_PROTOCOL.md` for the full
typed union reference and SSE mapping table.*
