/**
 * openclaw-webview.ts — OpenClaw local AI gateway extension handler.
 *
 * Bridges webview messages from OpenClawTab.tsx → VS Code host operations
 * and the OpenClaw REST API.
 *
 * OpenClaw default gateway: http://localhost:18789
 * Config:  ~/.openclaw/openclaw.json
 * Project: https://github.com/Ghenghis/openclaw
 *
 * Message types handled:
 *   openclawConnect          → try HTTP to gateway, push openclawStatusUpdate
 *   openclawDisconnect       → push openclawStatusUpdate (disconnected)
 *   openclawOpenUrl          → open URL in system browser
 *   openclawCheckUpdates     → open OpenClaw GitHub releases in browser
 *   openclawViewChangelog    → open OpenClaw CHANGELOG in browser
 *   openclawRequestChannels  → GET /api/channels, push openclawChannelsUpdate
 *   openclawScanModels       → GET /api/models + scan Ollama/LMStudio ports,
 *                              push openclawModelsUpdate
 *   openclawToggleChannel    → POST /api/channels/:id/toggle, push openclawChannelToggled
 *   openclawTestChannel      → POST /api/channels/:id/test, push openclawChannelTested
 *   openclawSaveAgentPrompt  → POST /api/agents/:id/prompt, push openclawAgentUpdated
 *   openclawAddChannel       → open OpenClaw channel-config UI in browser
 *   openclawCreateAgent      → POST /api/agents, push openclawAgentsUpdate
 *   openclawExportLog        → GET /api/log/export, save to workspace tmp file
 *
 * When OpenClaw is not reachable, each handler posts an error response so the
 * tab can degrade gracefully rather than silently hanging.
 */

import * as vscode from "vscode"
import * as path from "path"
import * as fs from "fs"

// ─── Constants ────────────────────────────────────────────────────────────────

const OPENCLAW_DEFAULT_URL = "http://localhost:18789"
const OPENCLAW_RELEASES_URL = "https://github.com/Ghenghis/openclaw/releases"
const OPENCLAW_CHANGELOG_URL = "https://github.com/Ghenghis/openclaw/blob/main/CHANGELOG.md"
const FETCH_TIMEOUT_MS = 10_000

// ─── Context type ─────────────────────────────────────────────────────────────

export interface OpenClawWebviewContext {
  extensionContext: vscode.ExtensionContext
  postMessage: (msg: unknown) => void
  /** Test seam — override fetch implementation. */
  fetchImpl?: typeof fetch
}

// ─── URL resolution ───────────────────────────────────────────────────────────

function resolveGatewayUrl(ctx: OpenClawWebviewContext, urlOverride?: string): string {
  if (urlOverride && urlOverride.trim()) return urlOverride.trim().replace(/\/$/, "")
  const stored = ctx.extensionContext.workspaceState.get<string>("openclaw.gatewayUrl")
  if (stored && stored.trim()) return stored.trim().replace(/\/$/, "")
  return OPENCLAW_DEFAULT_URL
}

function getFetch(ctx: OpenClawWebviewContext): typeof fetch {
  if (ctx.fetchImpl) return ctx.fetchImpl
  const g = globalThis as unknown as { fetch?: typeof fetch }
  if (g.fetch) return g.fetch
  throw new Error("No fetch implementation available")
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

type FetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

async function ocFetch<T>(
  ctx: OpenClawWebviewContext,
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: unknown,
): Promise<FetchResult<T>> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
  try {
    const init: RequestInit = {
      method,
      headers: { "content-type": "application/json" },
      signal: ctrl.signal,
    }
    if (body !== undefined) init.body = JSON.stringify(body)
    const fetchFn = getFetch(ctx)
    const res = await fetchFn(url, init)
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      return { ok: false, status: res.status, error: `HTTP ${res.status}: ${text.slice(0, 200)}` }
    }
    const data = (await res.json()) as T
    return { ok: true, data }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, error: msg }
  } finally {
    clearTimeout(timer)
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleOpenClawWebviewMessage(
  msg: Record<string, unknown>,
  ctx: OpenClawWebviewContext,
): Promise<boolean> {
  const type = msg.type as string | undefined
  if (typeof type !== "string") return false
  if (!type.startsWith("openclaw")) return false

  // Persist gateway URL whenever a URL-bearing message arrives.
  const msgUrl = msg.url as string | undefined
  if (msgUrl && (type === "openclawConnect" || type === "openclawOpenUrl")) {
    const base = msgUrl.replace(/\/$/, "").replace(/\/[^/]+$/, "")
    if (base.startsWith("http")) {
      await ctx.extensionContext.workspaceState.update("openclaw.gatewayUrl", base)
    }
  }

  const gatewayUrl = resolveGatewayUrl(ctx, type === "openclawConnect" ? msgUrl : undefined)

  switch (type) {
    // ─── Connect ─────────────────────────────────────────────────────────
    case "openclawConnect": {
      const start = Date.now()
      const result = await ocFetch<{ version?: string; uptime_s?: number; channels?: number }>(
        ctx,
        `${gatewayUrl}/api/status`,
      )
      const latency_ms = Date.now() - start

      if (result.ok) {
        await ctx.extensionContext.workspaceState.update("openclaw.gatewayUrl", gatewayUrl)
        ctx.postMessage({
          type: "openclawStatusUpdate",
          connected: true,
          gatewayUrl,
          latency_ms,
          version: result.data.version,
          uptime_s: result.data.uptime_s,
          activeChannels: result.data.channels ?? 0,
        })
      } else {
        ctx.postMessage({
          type: "openclawStatusUpdate",
          connected: false,
          gatewayUrl,
          error: result.error,
        })
      }
      return true
    }

    // ─── Disconnect ───────────────────────────────────────────────────────
    case "openclawDisconnect": {
      ctx.postMessage({ type: "openclawStatusUpdate", connected: false, gatewayUrl })
      return true
    }

    // ─── Open URL in browser ──────────────────────────────────────────────
    case "openclawOpenUrl": {
      const url = (msg.url as string | undefined) ?? gatewayUrl
      try {
        await vscode.env.openExternal(vscode.Uri.parse(url))
      } catch (err) {
        console.warn("[openclaw-webview] openExternal failed:", err)
      }
      return true
    }

    // ─── Check for updates ────────────────────────────────────────────────
    case "openclawCheckUpdates": {
      // First try the API; fall back to GitHub releases page.
      const result = await ocFetch<{ latest?: string; current?: string; hasUpdate?: boolean }>(
        ctx,
        `${gatewayUrl}/api/version`,
      )
      if (result.ok) {
        ctx.postMessage({
          type: "openclawUpdateInfo",
          current: result.data.current,
          latest: result.data.latest,
          hasUpdate: result.data.hasUpdate ?? false,
        })
      } else {
        // Gateway unreachable — open releases page in browser.
        try { await vscode.env.openExternal(vscode.Uri.parse(OPENCLAW_RELEASES_URL)) } catch { /* ignore */ }
        ctx.postMessage({ type: "openclawUpdateInfo", error: result.error })
      }
      return true
    }

    // ─── View changelog ───────────────────────────────────────────────────
    case "openclawViewChangelog": {
      try { await vscode.env.openExternal(vscode.Uri.parse(OPENCLAW_CHANGELOG_URL)) } catch { /* ignore */ }
      return true
    }

    // ─── Request channels ─────────────────────────────────────────────────
    case "openclawRequestChannels": {
      const result = await ocFetch<{ channels?: unknown[] } | unknown[]>(
        ctx,
        `${gatewayUrl}/api/channels`,
      )
      if (result.ok) {
        const channels = Array.isArray(result.data)
          ? result.data
          : (result.data as { channels?: unknown[] }).channels ?? []
        ctx.postMessage({ type: "openclawChannelsUpdate", channels })
      } else {
        ctx.postMessage({ type: "openclawChannelsUpdate", channels: [], error: result.error })
      }
      return true
    }

    // ─── Scan models ──────────────────────────────────────────────────────
    case "openclawScanModels": {
      const [ocResult, ollamaResult] = await Promise.allSettled([
        ocFetch<{ models?: unknown[] } | unknown[]>(ctx, `${gatewayUrl}/api/models`),
        ocFetch<{ models?: unknown[] }>(ctx, "http://localhost:11434/api/tags"),
      ])

      const models: unknown[] = []

      if (ocResult.status === "fulfilled" && ocResult.value.ok) {
        const d = ocResult.value.data
        const list = Array.isArray(d) ? d : ((d as { models?: unknown[] }).models ?? [])
        models.push(...list)
      }

      if (ollamaResult.status === "fulfilled" && ollamaResult.value.ok) {
        const ollamaModels = (ollamaResult.value.data.models ?? []) as Array<{ name: string }>
        for (const m of ollamaModels) {
          if (!models.some((ex) => (ex as { id?: string }).id === m.name)) {
            models.push({
              id: m.name,
              name: m.name,
              provider: "ollama",
              baseUrl: "http://localhost:11434",
              available: true,
              contextLength: 4096,
              capabilities: ["chat"],
            })
          }
        }
      }

      const error =
        ocResult.status === "fulfilled" && !ocResult.value.ok ? ocResult.value.error : undefined

      ctx.postMessage({ type: "openclawModelsUpdate", models, error })
      return true
    }

    // ─── Toggle channel ───────────────────────────────────────────────────
    case "openclawToggleChannel": {
      const channelId = (msg.channelId as string | undefined) ?? ""
      const enabled = Boolean(msg.enabled)
      const result = await ocFetch<{ ok?: boolean }>(
        ctx,
        `${gatewayUrl}/api/channels/${encodeURIComponent(channelId)}/toggle`,
        "POST",
        { enabled },
      )
      ctx.postMessage({
        type: "openclawChannelToggled",
        channelId,
        enabled,
        ok: result.ok,
        error: result.ok ? undefined : (result as { error: string }).error,
      })
      return true
    }

    // ─── Test channel ─────────────────────────────────────────────────────
    case "openclawTestChannel": {
      const channelId = (msg.channelId as string | undefined) ?? ""
      const result = await ocFetch<{ ok?: boolean; latency_ms?: number }>(
        ctx,
        `${gatewayUrl}/api/channels/${encodeURIComponent(channelId)}/test`,
        "POST",
        {},
      )
      ctx.postMessage({
        type: "openclawChannelTested",
        channelId,
        ok: result.ok,
        latency_ms: result.ok ? (result.data as { latency_ms?: number }).latency_ms : undefined,
        error: result.ok ? undefined : (result as { error: string }).error,
      })
      return true
    }

    // ─── Save agent prompt ────────────────────────────────────────────────
    case "openclawSaveAgentPrompt": {
      const agentId = (msg.agentId as string | undefined) ?? ""
      const prompt = (msg.prompt as string | undefined) ?? ""
      const result = await ocFetch<{ ok?: boolean }>(
        ctx,
        `${gatewayUrl}/api/agents/${encodeURIComponent(agentId)}/prompt`,
        "POST",
        { prompt },
      )
      ctx.postMessage({
        type: "openclawAgentUpdated",
        agentId,
        ok: result.ok,
        error: result.ok ? undefined : (result as { error: string }).error,
      })
      return true
    }

    // ─── Add channel ──────────────────────────────────────────────────────
    case "openclawAddChannel": {
      // Open the OpenClaw channel-config web UI.
      try { await vscode.env.openExternal(vscode.Uri.parse(`${gatewayUrl}/channels/new`)) } catch { /* ignore */ }
      return true
    }

    // ─── Create agent ─────────────────────────────────────────────────────
    case "openclawCreateAgent": {
      const result = await ocFetch<{ agent?: unknown }>(
        ctx,
        `${gatewayUrl}/api/agents`,
        "POST",
        { name: "New Agent", model: "ollama/llama3:8b", systemPrompt: "" },
      )
      if (result.ok) {
        // Refresh agents list after creation.
        const list = await ocFetch<{ agents?: unknown[] } | unknown[]>(
          ctx,
          `${gatewayUrl}/api/agents`,
        )
        const agents = list.ok
          ? Array.isArray(list.data)
            ? list.data
            : ((list.data as { agents?: unknown[] }).agents ?? [])
          : []
        ctx.postMessage({ type: "openclawAgentsUpdate", agents })
      } else {
        ctx.postMessage({
          type: "openclawAgentsUpdate",
          agents: [],
          error: (result as { error: string }).error,
        })
      }
      return true
    }

    // ─── Export log ───────────────────────────────────────────────────────
    case "openclawExportLog": {
      const result = await ocFetch<string | unknown[]>(
        ctx,
        `${gatewayUrl}/api/log/export`,
      )
      if (result.ok) {
        try {
          const workspaceRoot =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()
          const tmpDir = path.join(workspaceRoot, ".kilo", "tmp")
          if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
          const outPath = path.join(
            tmpDir,
            `openclaw-log-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
          )
          const content =
            typeof result.data === "string"
              ? result.data
              : JSON.stringify(result.data, null, 2)
          fs.writeFileSync(outPath, content, "utf-8")
          await vscode.window.showTextDocument(vscode.Uri.file(outPath))
          ctx.postMessage({ type: "openclawLogExported", path: outPath, ok: true })
        } catch (writeErr) {
          ctx.postMessage({
            type: "openclawLogExported",
            ok: false,
            error: writeErr instanceof Error ? writeErr.message : String(writeErr),
          })
        }
      } else {
        ctx.postMessage({
          type: "openclawLogExported",
          ok: false,
          error: (result as { error: string }).error,
        })
      }
      return true
    }

    default:
      return false
  }
}

// ─── Test seams ───────────────────────────────────────────────────────────────

export const __test = {
  OPENCLAW_DEFAULT_URL,
  OPENCLAW_RELEASES_URL,
  OPENCLAW_CHANGELOG_URL,
  resolveGatewayUrl,
  ocFetch,
}
