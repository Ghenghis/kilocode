/**
 * test-diagnostics.ts — canary.10 test/diagnostic message handlers.
 *
 * Handles:
 *   - testMcpTool       → testMcpToolResult       (MCP server reachability ping)
 *   - testNotification  → testNotificationResult  (sample VS Code notification)
 *   - testProviderKey   → testProviderKeyResult   (provider /v1/models probe)
 *
 * All log output masks API keys via `maskKey` from custom-provider-detect.
 */

import * as vscode from "vscode"
import type { KiloClient } from "@kilocode/sdk/v2/client"
import { maskKey, testCustomProviderConnection } from "../../shared/custom-provider-detect"

type PostMessage = (msg: unknown) => void

/** Lazy singleton — avoids creating an OutputChannel until a "log" notification is requested. */
let _logChannel: vscode.OutputChannel | undefined
function logChannel(): vscode.OutputChannel {
  return (_logChannel ??= vscode.window.createOutputChannel("Kilo — Notifications"))
}

// ============================================================================
// testMcpTool
// ============================================================================

export interface TestMcpToolRequest {
  type: "testMcpTool"
  serverName: string
  /** Tool name to record in the result; SDK has no direct tools/call endpoint, so this is informational. */
  toolName?: string
  /** Reserved for future tools/call wiring; ignored today. */
  args?: Record<string, unknown>
}

/**
 * Test an MCP server: connect (idempotent on the backend) then verify status === "connected".
 * Returns latency from request start through status confirmation.
 */
export async function handleTestMcpTool(
  client: KiloClient | undefined,
  workspaceDir: string,
  post: PostMessage,
  msg: TestMcpToolRequest,
): Promise<void> {
  const started = Date.now()
  const { serverName, toolName } = msg

  if (!client) {
    post({
      type: "mcpToolTestResult",
      serverName,
      toolName,
      ok: false,
      latencyMs: 0,
      error: "MCP client unavailable",
    })
    return
  }

  try {
    await client.mcp.connect({ name: serverName, directory: workspaceDir }, { throwOnError: true })
    const { data: status } = await client.mcp.status({ directory: workspaceDir }, { throwOnError: true })
    const latencyMs = Date.now() - started
    const entry = (status as Record<string, { status: string; error?: string }> | undefined)?.[serverName]
    if (!entry) {
      post({
        type: "mcpToolTestResult",
        serverName,
        toolName,
        ok: false,
        latencyMs,
        error: `Server "${serverName}" not present in MCP status`,
      })
      return
    }
    if (entry.status === "connected") {
      post({
        type: "mcpToolTestResult",
        serverName,
        toolName,
        ok: true,
        latencyMs,
        response: { status: entry.status },
      })
      return
    }
    post({
      type: "mcpToolTestResult",
      serverName,
      toolName,
      ok: false,
      latencyMs,
      error: entry.error ?? `Server status: ${entry.status}`,
    })
  } catch (err) {
    post({
      type: "mcpToolTestResult",
      serverName,
      toolName,
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ============================================================================
// testNotification
// ============================================================================

export type NotificationChannel = "popup" | "log" | "system"

export interface TestNotificationRequest {
  type: "testNotification"
  channel?: NotificationChannel
  message?: string
}

const DEFAULT_NOTIFICATION_TEXT = "Test notification from KiloCode — settings are working!"

/** Fire a sample notification on the requested channel and confirm via testNotificationResult. */
export async function handleTestNotification(
  post: PostMessage,
  msg: TestNotificationRequest,
): Promise<void> {
  const channel = msg.channel ?? "popup"
  const text = msg.message ?? DEFAULT_NOTIFICATION_TEXT
  try {
    if (channel === "popup") {
      // Fire-and-forget: don't block on user dismissal
      void vscode.window.showInformationMessage(text)
    } else if (channel === "log") {
      const ch = logChannel()
      ch.appendLine(`[${new Date().toISOString()}] ${text}`)
      ch.show(true)
    } else {
      // "system" channel — VS Code has no tray API; fall back to status-bar message.
      vscode.window.setStatusBarMessage(text, 5_000)
    }
    post({ type: "testNotificationResult", ok: true, channel })
  } catch (err) {
    post({
      type: "testNotificationResult",
      ok: false,
      channel,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// ============================================================================
// testProviderKey
// ============================================================================

export interface TestProviderKeyRequest {
  type: "testProviderKey"
  providerID: string
  /** Cleartext API key from the webview. Masked in any log output. */
  apiKey?: string
  /** Optional override; otherwise a built-in default per provider is used. */
  baseUrl?: string
}

interface ProviderProbeConfig {
  baseUrl: string
  shape: "openai" | "ollama"
  needsKey: boolean
}

/** Built-in /v1/models endpoints per provider id. */
const PROVIDER_PROBES: Record<string, ProviderProbeConfig> = {
  openai: { baseUrl: "https://api.openai.com/v1", shape: "openai", needsKey: true },
  anthropic: { baseUrl: "https://api.anthropic.com/v1", shape: "openai", needsKey: true },
  groq: { baseUrl: "https://api.groq.com/openai/v1", shape: "openai", needsKey: true },
  together: { baseUrl: "https://api.together.xyz/v1", shape: "openai", needsKey: true },
  mistral: { baseUrl: "https://api.mistral.ai/v1", shape: "openai", needsKey: true },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", shape: "openai", needsKey: true },
  kilocode: { baseUrl: "https://kilocode.ai/api/v1", shape: "openai", needsKey: true },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", shape: "openai", needsKey: true },
  fireworks: { baseUrl: "https://api.fireworks.ai/inference/v1", shape: "openai", needsKey: true },
  ollama: { baseUrl: "http://localhost:11434", shape: "ollama", needsKey: false },
  lmstudio: { baseUrl: "http://localhost:1234/v1", shape: "openai", needsKey: false },
}

/** Validate a provider API key by probing the provider's /models endpoint. */
export async function handleTestProviderKey(
  post: PostMessage,
  msg: TestProviderKeyRequest,
): Promise<void> {
  const { providerID, apiKey, baseUrl } = msg
  const cfg = PROVIDER_PROBES[providerID]
  if (!cfg && !baseUrl) {
    post({
      type: "testProviderKeyResult",
      providerID,
      ok: false,
      latencyMs: 0,
      error: `Unknown provider "${providerID}" — provide baseUrl override`,
    })
    return
  }
  const probe = {
    baseUrl: baseUrl ?? cfg!.baseUrl,
    shape: (cfg?.shape ?? "openai") as "openai" | "ollama",
    needsKey: cfg?.needsKey ?? true,
  }
  if (probe.needsKey && !apiKey) {
    post({
      type: "testProviderKeyResult",
      providerID,
      ok: false,
      latencyMs: 0,
      error: "API key required",
    })
    return
  }
  // Diagnostic log line (key masked)
  console.log(
    `[Kilo] testProviderKey provider=${providerID} key=${maskKey(apiKey)} baseUrl=${probe.baseUrl}`,
  )
  const result = await testCustomProviderConnection({
    baseUrl: probe.baseUrl,
    apiKey,
    shape: probe.shape,
  })
  post({
    type: "testProviderKeyResult",
    providerID,
    ok: result.ok,
    latencyMs: result.latencyMs,
    error: result.error,
    modelCount: result.modelCount,
  })
}
