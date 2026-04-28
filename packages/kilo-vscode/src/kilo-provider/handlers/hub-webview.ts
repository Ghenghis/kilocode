/**
 * hub-webview.ts — DaveAI Hub tab extension handler.
 *
 * Bridges webview messages from HubTab.tsx → VS Code host operations.
 *
 * The Hub tab uses direct browser fetch() for its health-poll loop, so this
 * handler focuses on the operations that cannot be done from the sandboxed
 * webview:
 *
 *   hubAction        → executes a named quick-deploy action in a VS Code
 *                       terminal (deploy-vps, sync-upstream, rotate-secrets,
 *                       build-vsix, health-all, export-audit)
 *   hubProxyFetch    → proxy-fetches a Hub API endpoint through the extension
 *                       host (bypasses webview CSP for direct-localhost calls)
 *   hubOpenExternal  → opens a URL in the system browser
 *
 * Hub URL resolution order (same as governance-webview):
 *   1. workspace setting  kilocode.updates.hubBaseUrl
 *   2. workspace setting  daveai.hub.baseUrl
 *   3. fallback           http://localhost:8082
 *
 * Response message types sent back to webview:
 *   hubActionStarted  { action, terminal }
 *   hubProxyResult    { requestId, ok, status, body, error? }
 */

import * as vscode from "vscode"

// ─── Hub URL / auth helpers ───────────────────────────────────────────────────

const HUB_DEFAULT_URL = "http://localhost:8082"
const FETCH_TIMEOUT_MS = 15_000

function resolveHubBaseUrl(): string {
  const updatesCfg = vscode.workspace.getConfiguration("kilocode.updates")
  const updatesUrl = updatesCfg.get<string>("hubBaseUrl")
  if (updatesUrl && updatesUrl.trim()) return updatesUrl.replace(/\/$/, "")

  const daveCfg = vscode.workspace.getConfiguration("daveai.hub")
  const daveUrl = daveCfg.get<string>("baseUrl")
  if (daveUrl && daveUrl.trim()) return daveUrl.replace(/\/$/, "")

  return HUB_DEFAULT_URL
}

function adminToken(): string {
  return vscode.workspace.getConfiguration("daveai.hub").get<string>("adminToken", "")
}

function authHeaders(): Record<string, string> {
  const token = adminToken()
  const hdrs: Record<string, string> = { "content-type": "application/json" }
  if (token) hdrs.authorization = `Bearer ${token}`
  return hdrs
}

// ─── Quick-deploy action map ──────────────────────────────────────────────────

/**
 * Maps hubAction.action values to shell commands executed in VS Code terminal.
 * Commands are designed to work from the workspace root on Windows/Linux/macOS.
 */
const ACTION_COMMANDS: Record<string, string> = {
  "deploy-vps":
    "pwsh -NoProfile -File scripts/deploy-vps.ps1 || bash scripts/deploy-vps.sh",
  "sync-upstream":
    "pwsh -NoProfile -File scripts/cherry_pick_upstream.ps1 -Phase Safe || bash scripts/cherry_pick_upstream.sh --phase safe",
  "rotate-secrets":
    "pwsh -NoProfile -File scripts/rotate-secrets.ps1 || bash scripts/rotate-secrets.sh",
  "build-vsix":
    "node esbuild.js --production && npx @vscode/vsce package --no-dependencies",
  "health-all":
    "pwsh -NoProfile -File scripts/health-check.ps1 || bash scripts/health-check.sh",
  "export-audit":
    "pwsh -NoProfile -File scripts/export-audit.ps1 || bash scripts/export-audit.sh",
}

// ─── Context type ─────────────────────────────────────────────────────────────

export interface HubWebviewContext {
  extensionContext: vscode.ExtensionContext
  postMessage: (msg: unknown) => void
  /** Test seam — override fetch implementation. */
  fetchImpl?: typeof fetch
}

function getFetch(ctx: HubWebviewContext): typeof fetch {
  if (ctx.fetchImpl) return ctx.fetchImpl
  const g = globalThis as unknown as { fetch?: typeof fetch }
  if (g.fetch) return g.fetch
  throw new Error("No fetch implementation available")
}

// ─── Proxy fetch helper ───────────────────────────────────────────────────────

async function proxyFetch(
  ctx: HubWebviewContext,
  url: string,
  method: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; body: unknown; error?: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const init: RequestInit = {
      method,
      headers: authHeaders(),
      signal: ctrl.signal,
    }
    if (body !== undefined) {
      init.body = JSON.stringify(body)
    }
    const fetchFn = getFetch(ctx)
    const res = await fetchFn(url, init)
    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = JSON.parse(text)
    } catch { /* keep raw text */ }
    return { ok: res.ok, status: res.status, body: parsed }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, body: null, error: msg }
  } finally {
    clearTimeout(timer)
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

/**
 * Returns true when the message was consumed, false otherwise.
 */
export async function handleHubWebviewMessage(
  msg: Record<string, unknown>,
  ctx: HubWebviewContext,
): Promise<boolean> {
  const type = msg.type as string | undefined
  if (typeof type !== "string") return false
  if (!type.startsWith("hub")) return false

  switch (type) {
    // ─── Quick Deploy Actions ─────────────────────────────────────────────
    case "hubAction": {
      const action = (msg.action as string | undefined) ?? ""
      const command = ACTION_COMMANDS[action]

      if (!command) {
        console.warn(`[hub-webview] Unknown hubAction: ${action}`)
        ctx.postMessage({ type: "hubActionResult", action, ok: false, error: `Unknown action: ${action}` })
        return true
      }

      const workspaceRoot =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()

      const terminal = vscode.window.createTerminal({
        name: `Hub › ${action}`,
        cwd: workspaceRoot,
      })
      terminal.show(false /* preserveFocus */)
      terminal.sendText(command)

      ctx.postMessage({ type: "hubActionStarted", action, command })
      return true
    }

    // ─── Proxy Fetch (lets webview bypass CSP for localhost calls) ────────
    case "hubProxyFetch": {
      const requestId = (msg.requestId as string | undefined) ?? ""
      const path = (msg.path as string | undefined) ?? "/"
      const method = ((msg.method as string | undefined) ?? "GET").toUpperCase()
      const hubBase = (msg.hubBase as string | undefined) ?? resolveHubBaseUrl()
      const url = `${hubBase.replace(/\/$/, "")}${path}`

      const result = await proxyFetch(ctx, url, method, msg.body)
      ctx.postMessage({ type: "hubProxyResult", requestId, ...result })
      return true
    }

    // ─── Open Hub URL in browser ──────────────────────────────────────────
    case "hubOpenExternal": {
      const url = (msg.url as string | undefined) ?? resolveHubBaseUrl()
      try {
        await vscode.env.openExternal(vscode.Uri.parse(url))
      } catch (err) {
        console.warn("[hub-webview] openExternal failed:", err)
      }
      return true
    }

    default:
      // Unrecognised hub* message — return false so the legacy switch can
      // still handle hub-prefixed messages added by upstream in the future.
      return false
  }
}

// ─── Test seams ───────────────────────────────────────────────────────────────

export const __test = {
  resolveHubBaseUrl,
  ACTION_COMMANDS,
  HUB_DEFAULT_URL,
  proxyFetch,
}
