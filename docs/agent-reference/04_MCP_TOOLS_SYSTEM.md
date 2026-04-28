# KiloCode MCP & Tools System
> FOR AGENTS. Typed, structured, exhaustive.

---

## 1. Key Source Files

| Purpose | Path |
|---|---|
| MCP config schema | `packages/opencode/src/config/mcp.ts` |
| MCP service (connect/discover/auth) | `packages/opencode/src/mcp/index.ts` |
| MCP OAuth token store | `packages/opencode/src/mcp/auth.ts` |
| Permission schema | `packages/opencode/src/config/permission.ts` |
| Permission service (evaluate/ask/reply) | `packages/opencode/src/permission/index.ts` |
| Permission evaluate (last-match-wins) | `packages/opencode/src/permission/evaluate.ts` |
| Permission bash arity table | `packages/opencode/src/permission/arity.ts` |
| Built-in tool base types | `packages/opencode/src/tool/tool.ts` |
| Tool registry (all tools assembled) | `packages/opencode/src/tool/registry.ts` |
| Global path resolution (XDG) | `packages/opencode/src/global/index.ts` |
| Settings MCP UI edit view | `packages/kilo-vscode/webview-ui/src/components/settings/McpEditView.tsx` |

---

## 2. Config Schema

### 2.1 ConfigMCP (discriminated union)

```typescript
// Source: packages/opencode/src/config/mcp.ts

type ConfigMCP.Info = ConfigMCP.Local | ConfigMCP.Remote

interface ConfigMCP.Local {
  type: "local"
  command: string[]                          // [cmd, ...args], required
  environment?: Record<string, string>       // injected into process env
  enabled?: boolean                          // default: true
  timeout?: number                           // ms, default: 30_000
}

interface ConfigMCP.Remote {
  type: "remote"
  url: string                                // full URL of the HTTP endpoint
  enabled?: boolean                          // default: true
  headers?: Record<string, string>           // sent with every request
  oauth?: ConfigMCP.OAuth | false            // false = disable OAuth auto-detect
  timeout?: number                           // ms, default: 30_000
}

interface ConfigMCP.OAuth {
  clientId?: string        // omit → dynamic client registration (RFC 7591)
  clientSecret?: string
  scope?: string
  redirectUri?: string     // default: http://127.0.0.1:19876/mcp/oauth/callback
}
```

### 2.2 Config file location on disk

Global config is XDG-based. The app name on disk is `kilo`.

| XDG variable | Typical Linux/macOS | Typical Windows |
|---|---|---|
| `$XDG_CONFIG_HOME/kilo/` | `~/.config/kilo/` | `%APPDATA%\kilo\` |
| `$XDG_DATA_HOME/kilo/` | `~/.local/share/kilo/` | `%LOCALAPPDATA%\kilo\` |

Config file candidates (first existing file wins, fallback to `kilo.jsonc`):

```
$XDG_CONFIG_HOME/kilo/kilo.jsonc       ← preferred
$XDG_CONFIG_HOME/kilo/kilo.json
$XDG_CONFIG_HOME/kilo/opencode.jsonc
$XDG_CONFIG_HOME/kilo/opencode.json
$XDG_CONFIG_HOME/kilo/config.json
```

MCP OAuth token store (not config): `$XDG_DATA_HOME/kilo/mcp-auth.json`

### 2.3 MCP block in config file

```jsonc
{
  "mcp": {
    "my-local-server": {
      "type": "local",
      "command": ["npx", "-y", "@some/mcp-server"],
      "environment": { "API_KEY": "abc" },
      "timeout": 10000
    },
    "my-remote-server": {
      "type": "remote",
      "url": "https://api.example.com/mcp",
      "headers": { "Authorization": "Bearer token" },
      "oauth": false
    }
  }
}
```

Project-level config files are discovered in the project tree under:
- `.opencode/` / `.kilo/` / `.kilocode/` directories
- `opencode.json` / `kilo.json` / `kilo.jsonc` in project root

---

## 3. MCP Server Types

### 3.1 `local` (stdio transport)

- Transport: `StdioClientTransport` from `@modelcontextprotocol/sdk/client/stdio.js`
- Process spawned with `command[0]` as binary and `command[1..]` as args
- Working directory: project instance directory (`Instance.directory`)
- **KiloCode patch**: `docker run` / `podman run` commands auto-inject `--rm` flag (prevents container accumulation)
- **Windows patch**: process `type` property forced to `"kilo-bun"` to trigger `windowsHide:true` in MCP SDK (suppresses CMD flash)
- stderr piped and logged at `info` level

### 3.2 `remote` (StreamableHTTP + SSE fallback)

- Transport attempt order:
  1. `StreamableHTTPClientTransport` (preferred)
  2. `SSEClientTransport` (fallback if StreamableHTTP fails)
- Both transports share the same `McpOAuthProvider` instance when OAuth is enabled
- Transport loop stops early on `needs_auth` or `needs_client_registration` status

### 3.3 MCPStatus (discriminated union)

```typescript
type MCPStatus =
  | { status: "connected" }
  | { status: "disabled" }
  | { status: "failed"; error: string }
  | { status: "needs_auth" }
  | { status: "needs_client_registration"; error: string }
```

---

## 4. Tool Namespacing

MCP tools are registered into the AI SDK tool map with the key:

```
{sanitized_server_name}_{sanitized_tool_name}
```

`sanitize(s)` replaces all characters outside `[a-zA-Z0-9_-]` with `_`.

Example:
- Server name: `my-mcp` → `my_mcp`
- MCP tool: `get file` → `get_file`
- Registered key: `my_mcp_get_file`

Built-in tools use their plain `id` (no prefix): `bash`, `read`, `glob`, `grep`, `edit`, `write`, etc.

---

## 5. Tool Discovery Flow

```mermaid
flowchart TD
    A[Config loaded: cfg.mcp] --> B{entry has 'type' field?}
    B -- No --> C[Skip: log error 'Ignoring MCP config entry without type']
    B -- Yes --> D{enabled === false?}
    D -- Yes --> E[State: disabled]
    D -- No --> F{type === 'local'?}
    F -- Yes --> G[StdioClientTransport\nspawn command with env]
    F -- No --> H[Try StreamableHTTPClientTransport]
    H --> I{Connect success?}
    I -- No --> J[Try SSEClientTransport]
    J --> K{Connect success?}
    K -- No --> L{Auth error?}
    L -- Yes --> M[State: needs_auth or\nneeds_client_registration]
    L -- No --> N[State: failed with error]
    K -- Yes --> O[client.listTools]
    G --> P{Connect success?}
    P -- No --> N
    P -- Yes --> O
    I -- Yes --> O
    O --> Q{listTools success?}
    Q -- No --> R[close client → State: failed]
    Q -- Yes --> S[Store: clients[key] = client\ndefs[key] = tools[]\nstatus[key] = connected]
    S --> T[Register notification handler\nfor ToolListChangedNotification]
    T --> U[tools map: key = sanitize server + '_' + sanitize toolName]
```

**Live updates**: When the MCP server emits `ToolListChanged`, `client.listTools()` is re-called and the tool cache (`defs[name]`) is replaced. A `mcp.tools.changed` bus event is published.

---

## 6. Permission System

### 6.1 PermissionConfig (config file shape)

```typescript
// Source: packages/opencode/src/config/permission.ts

type PermissionAction = "ask" | "allow" | "deny" | null  // null = delete sentinel

type PermissionObjectConfig = Record<string, PermissionAction>  // pattern → action

type PermissionRuleConfig = PermissionAction | PermissionObjectConfig

interface PermissionConfig {
  // File-system permissions (accept pattern → action map or scalar action)
  read?:               PermissionRuleConfig
  edit?:               PermissionRuleConfig
  glob?:               PermissionRuleConfig
  grep?:               PermissionRuleConfig
  list?:               PermissionRuleConfig
  bash?:               PermissionRuleConfig
  task?:               PermissionRuleConfig
  external_directory?: PermissionRuleConfig
  lsp?:                PermissionRuleConfig
  skill?:              PermissionRuleConfig

  // Scalar-only permissions (no pattern map, just action)
  todowrite?:   PermissionAction
  question?:    PermissionAction
  webfetch?:    PermissionAction
  websearch?:   PermissionAction
  codesearch?:  PermissionAction
  doom_loop?:   PermissionAction

  // Catch-all: any MCP tool or custom key
  [key: string]: PermissionRuleConfig | undefined
}
```

Scalar string shorthand: `"bash": "allow"` is equivalent to `"bash": { "*": "allow" }`.

### 6.2 Internal Rule type

```typescript
// Source: packages/opencode/src/permission/index.ts

interface Rule {
  permission: string   // tool id or wildcard, e.g. "bash", "edit", "*"
  pattern:    string   // glob pattern matched against tool argument, e.g. "/home/user/*"
  action:     "allow" | "deny" | "ask"
}

type Ruleset = Rule[]
```

### 6.3 Evaluation: last-matching-wildcard-rule wins

```typescript
// Source: packages/opencode/src/permission/evaluate.ts

export function evaluate(permission: string, pattern: string, ...rulesets: Rule[][]): Rule {
  const rules = rulesets.flat()
  // Wildcard.match on both dimensions; findLast = last matching rule wins
  const match = rules.findLast(
    (rule) => Wildcard.match(permission, rule.permission) && Wildcard.match(pattern, rule.pattern)
  )
  return match ?? { action: "ask", permission, pattern: "*" }  // default: ask
}
```

**Key semantics:**
- Rulesets are evaluated in order: `[configRuleset, approvedRuleset, sessionRuleset]`
- Later rules override earlier rules (last match wins across all flattened rulesets)
- If no rule matches: default action is `"ask"`
- `"deny"` terminates immediately (`DeniedError` thrown, no prompt shown)
- `"allow"` skips the prompt (unless the path is a protected config file)
- `"ask"` triggers a `permission.asked` bus event; UI presents approve/reject dialog

### 6.4 Reply types

```typescript
type Reply = "once" | "always" | "reject"
```

- `"once"`: allow this call only
- `"always"`: add rule to persistent approved set (written to global config)
- `"reject"`: emit `DeniedError`; all pending requests for same session also rejected

### 6.5 Protected config paths

KiloCode overrides `"allow"` to `"ask"` for edits to config files (paths covered by `ConfigProtection.isRequest`). The `"always"` option is downgraded to `"once"` for these paths even after approval.

### 6.6 Session-scoped allow-everything

```typescript
// allowEverything({ enable: true, sessionID }) adds:
{ permission: "*", pattern: "*", action: "allow" }
// to session-local ruleset only — does not persist to global config
```

---

## 7. Built-in Tools

All built-in tools are registered in `packages/opencode/src/tool/registry.ts`. Tool IDs are lowercase strings with no prefix.

| Tool ID | Permission key | Description |
|---|---|---|
| `bash` | `bash` | Execute shell commands; asks permission per parsed command token |
| `read` | `read` | Read file content (text, image, PDF) or list directory entries |
| `glob` | `glob` | Find files matching a glob pattern via ripgrep |
| `grep` | `grep` | Search file content with regex via ripgrep |
| `edit` | `edit` | Exact-string replace in a file (used for non-GPT-4 models) |
| `write` | `edit` | Write/overwrite a complete file (always goes through `edit` permission) |
| `multiedit` | `edit` | Batch exact-string replacements in a single file |
| `apply_patch` | `edit` | Apply unified diff patch (used for GPT-4 and e2e mode) |
| `task` | `task` | Spawn a sub-agent with isolated session |
| `webfetch` | `webfetch` | Fetch and extract text content from a URL |
| `websearch` | `websearch` | Web search via Exa API |
| `codesearch` | `codesearch` | Code-focused search via Exa API |
| `todowrite` | `todowrite` | Create/update the session TODO list |
| `question` | `question` | Ask user a clarifying question (optional, feature-flagged) |
| `skill` | `skill` | Load a named skill (injects instructions into context) |
| `lsp` | `lsp` | LSP diagnostics and hover (experimental, feature-flagged) |
| `plan` | *(none)* | Enter/exit plan mode (feature-flagged) |
| `suggest` | *(none)* | KiloCode suggestion tool |
| `invalid` | *(none)* | Placeholder emitted when an unknown tool call is received |

**Notes:**
- `edit` and `apply_patch` are mutually exclusive at runtime (GPT-4 + e2e mode → `apply_patch`; all others → `edit`)
- `codesearch` and `websearch` only included when Exa is enabled (`KiloToolRegistry.exa(providerID)`)
- `question` only included when `KiloToolRegistry.question()` returns true
- `lsp` only included when `Flag.KILO_EXPERIMENTAL_LSP_TOOL` is set
- `plan` only included when `KiloToolRegistry.plan()` returns true
- EDIT_TOOLS for permission mapping: `["edit", "write", "apply_patch", "multiedit"]` all map to the `"edit"` permission key

---

## 8. MCP vs Built-in Tool Registration

```typescript
// How the agent sees both in one tool map (simplified from session internals):
const allTools: Record<string, Tool> = {
  // Built-in tools (from ToolRegistry.tools())
  bash: builtinBashTool,
  read: builtinReadTool,
  // ...

  // MCP tools (from MCP.tools())
  "my_mcp_list_files": mcpDynamicTool,
  "my_mcp_run_query":  mcpDynamicTool,
}
```

MCP tools are wrapped with `dynamicTool()` from the AI SDK:
- `inputSchema` is coerced to `type: "object"` with `additionalProperties: false`
- `execute` calls `client.callTool()` with optional timeout
- Timeout: `entry.timeout ?? cfg.experimental.mcp_timeout ?? 30_000`

---

## 9. Settings UI: Adding/Editing MCP Servers

Location: `packages/kilo-vscode/webview-ui/src/components/settings/McpEditView.tsx`

**Transport auto-detection in UI:**
```typescript
const transport = () => cfg().type ?? (cfg().url ? "remote" : "local")
```
If `type` is absent, presence of `url` field implies `remote`, otherwise `local`.

**Fields editable via UI:**
- Transport type toggle (`local` / `remote`)
- `local`: command (binary), args (newline-separated), environment key/value pairs
- `remote`: URL, headers key/value pairs, OAuth settings
- `enabled` toggle
- `timeout` (ms)

**Config write path:**
UI calls `updateConfig({ mcp: { ...existing, [name]: partial } })` which patches the project-level config file via `Config.update()`.

---

## 10. OAuth Flow (remote servers)

```
opencode mcp auth <name>
  → MCP.startAuth(name)
  → McpOAuthProvider constructed with optional clientId/secret
  → McpOAuthCallback.ensureRunning() starts local HTTP server on :19876
  → StreamableHTTPClientTransport.connect() → UnauthorizedError thrown
  → capturedUrl = OAuth authorization URL from redirect
  → open(authorizationUrl) in browser
  → User authorizes → callback to http://127.0.0.1:19876/mcp/oauth/callback
  → MCP.finishAuth(name, code) → transport.finishAuth(code)
  → Client re-connects → listTools → registered in state
```

OAuth state is stored in `$XDG_DATA_HOME/kilo/mcp-auth.json`:
```typescript
interface McpAuth.Entry {
  tokens?: {
    accessToken: string
    refreshToken?: string
    expiresAt?: number
    scope?: string
  }
  clientInfo?: {
    clientId: string
    clientSecret?: string
    clientIdIssuedAt?: number
    clientSecretExpiresAt?: number
  }
  codeVerifier?: string
  oauthState?: string
  serverUrl?: string
}
```

Dynamic client registration (RFC 7591) is attempted automatically when `clientId` is not provided and the server supports it. Set `oauth: false` to disable all OAuth handling.

---

## 11. MCP Service Interface

```typescript
// Source: packages/opencode/src/mcp/index.ts

interface MCP.Interface {
  status():                          Effect<Record<string, MCPStatus>>
  clients():                         Effect<Record<string, MCPClient>>
  tools():                           Effect<Record<string, Tool>>      // namespaced tool map
  prompts():                         Effect<Record<string, PromptInfo & { client: string }>>
  resources():                       Effect<Record<string, ResourceInfo & { client: string }>>
  add(name: string, mcp: ConfigMCP.Info): Effect<{ status: Record<string, Status> | Status }>
  connect(name: string):             Effect<void>    // re-create with enabled:true
  disconnect(name: string):          Effect<void>    // close + set disabled
  getPrompt(clientName, name, args): Effect<GetPromptResult | undefined>
  readResource(clientName, uri):     Effect<ReadResourceResult | undefined>
  startAuth(mcpName):                Effect<{ authorizationUrl: string; oauthState: string }>
  authenticate(mcpName):             Effect<MCPStatus>   // full OAuth flow with browser open
  finishAuth(mcpName, code):         Effect<MCPStatus>
  removeAuth(mcpName):               Effect<void>
  supportsOAuth(mcpName):            Effect<boolean>
  hasStoredTokens(mcpName):          Effect<boolean>
  getAuthStatus(mcpName):            Effect<"authenticated" | "expired" | "not_authenticated">
}
```

---

## 12. Bash Tool Permission Pattern

The bash tool uses `tree-sitter` (bash + PowerShell grammars) to parse the command before asking for permission. Permission keys used:

- `external_directory`: asked for each directory outside the project root that a file-mutating command targets
- `bash`: asked for each parsed command token; pattern = full command text; `always` pattern = `BashArity.prefix(tokens).join(" ") + " *"`

`BashArity.prefix(tokens)` resolves the meaningful command prefix (e.g. `npm run` for `npm run dev`, `git` for `git checkout main`) using a hardcoded arity table of 150+ common commands.
