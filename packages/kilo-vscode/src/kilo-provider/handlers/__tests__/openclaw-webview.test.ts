/**
 * Tests for openclaw-webview.ts
 *
 * Verifies:
 *   1. Non-openclaw messages are ignored (returns false)
 *   2. openclawConnect — success path sends openclawStatusUpdate (connected)
 *   3. openclawConnect — failure path sends openclawStatusUpdate (disconnected + error)
 *   4. openclawDisconnect sends disconnected status
 *   5. openclawOpenUrl calls vscode.env.openExternal
 *   6. openclawCheckUpdates — success posts updateInfo; failure opens GitHub
 *   7. openclawViewChangelog opens GitHub changelog
 *   8. openclawRequestChannels — success posts channels; failure posts empty + error
 *   9. openclawScanModels — merges OpenClaw + Ollama models
 *  10. openclawToggleChannel posts channelToggled
 *  11. openclawTestChannel posts channelTested
 *  12. openclawSaveAgentPrompt posts agentUpdated
 *  13. openclawCreateAgent posts agentsUpdate
 *  14. Gateway URL is resolved from workspaceState fallback
 */

import { handleOpenClawWebviewMessage, __test } from "../openclaw-webview"

// ── vscode mock ───────────────────────────────────────────────────────────────

const openedUris: string[] = []
const shownDocs: string[] = []

jest.mock("vscode", () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "/workspace" } }],
  },
  window: {
    showTextDocument: async (uri: { fsPath?: string; toString(): string }) => {
      shownDocs.push(uri.fsPath ?? uri.toString())
    },
  },
  env: {
    openExternal: async (uri: { toString(): string }) => {
      openedUris.push(uri.toString())
      return true
    },
  },
  Uri: {
    parse: (s: string) => ({ toString: () => s }),
    file: (p: string) => ({ fsPath: p, toString: () => `file://${p}` }),
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(fetchImpl?: typeof fetch) {
  const posted: unknown[] = []
  const store = new Map<string, unknown>()
  const workspaceState = {
    get<T>(k: string, def?: T) { return (store.get(k) as T) ?? def },
    async update(k: string, v: unknown) { store.set(k, v) },
    store,
  }
  const extensionContext = { workspaceState } as unknown as import("vscode").ExtensionContext
  return {
    posted,
    store,
    ctx: { extensionContext, postMessage: (m: unknown) => posted.push(m), fetchImpl },
  }
}

function mockFetchJson(body: unknown, status = 200): typeof fetch {
  return jest.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as typeof fetch
}

function mockFetchNetworkError(): typeof fetch {
  return jest.fn(async () => { throw new Error("ECONNREFUSED") }) as unknown as typeof fetch
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("handleOpenClawWebviewMessage", () => {
  beforeEach(() => {
    openedUris.length = 0
    shownDocs.length = 0
  })
  afterEach(() => jest.clearAllMocks())

  it("returns false for non-openclaw messages", async () => {
    const { ctx } = makeCtx()
    expect(await handleOpenClawWebviewMessage({ type: "hubAction" }, ctx)).toBe(false)
    expect(await handleOpenClawWebviewMessage({ type: "sshConnect" }, ctx)).toBe(false)
    expect(await handleOpenClawWebviewMessage({ type: "governance.load" }, ctx)).toBe(false)
  })

  describe("openclawConnect", () => {
    it("posts connected=true on success", async () => {
      const { ctx, posted } = makeCtx(
        mockFetchJson({ version: "1.2.0", uptime_s: 3600, channels: 5 }),
      )
      const result = await handleOpenClawWebviewMessage(
        { type: "openclawConnect", url: "http://localhost:18789" },
        ctx,
      )
      expect(result).toBe(true)
      const resp = posted[0] as {
        type: string
        connected: boolean
        version: string
        activeChannels: number
      }
      expect(resp.type).toBe("openclawStatusUpdate")
      expect(resp.connected).toBe(true)
      expect(resp.version).toBe("1.2.0")
      expect(resp.activeChannels).toBe(5)
    })

    it("posts connected=false with error on network failure", async () => {
      const { ctx, posted } = makeCtx(mockFetchNetworkError())
      await handleOpenClawWebviewMessage({ type: "openclawConnect", url: "http://localhost:18789" }, ctx)
      const resp = posted[0] as { type: string; connected: boolean; error: string }
      expect(resp.type).toBe("openclawStatusUpdate")
      expect(resp.connected).toBe(false)
      expect(resp.error).toMatch(/ECONNREFUSED/)
    })

    it("persists gateway URL in workspaceState on success", async () => {
      const { ctx, store } = makeCtx(mockFetchJson({ version: "1.0", channels: 2 }))
      await handleOpenClawWebviewMessage(
        { type: "openclawConnect", url: "http://localhost:18789" },
        ctx,
      )
      expect(store.get("openclaw.gatewayUrl")).toBe("http://localhost:18789")
    })
  })

  describe("openclawDisconnect", () => {
    it("posts connected=false", async () => {
      const { ctx, posted } = makeCtx()
      const result = await handleOpenClawWebviewMessage({ type: "openclawDisconnect" }, ctx)
      expect(result).toBe(true)
      const resp = posted[0] as { type: string; connected: boolean }
      expect(resp.type).toBe("openclawStatusUpdate")
      expect(resp.connected).toBe(false)
    })
  })

  describe("openclawOpenUrl", () => {
    it("opens the URL in the browser", async () => {
      const { ctx } = makeCtx()
      const result = await handleOpenClawWebviewMessage(
        { type: "openclawOpenUrl", url: "http://localhost:18789/webchat" },
        ctx,
      )
      expect(result).toBe(true)
      expect(openedUris).toContain("http://localhost:18789/webchat")
    })
  })

  describe("openclawCheckUpdates", () => {
    it("posts updateInfo on API success", async () => {
      const { ctx, posted } = makeCtx(
        mockFetchJson({ current: "1.2.0", latest: "1.3.0", hasUpdate: true }),
      )
      await handleOpenClawWebviewMessage({ type: "openclawCheckUpdates" }, ctx)
      const resp = posted[0] as { type: string; current: string; latest: string; hasUpdate: boolean }
      expect(resp.type).toBe("openclawUpdateInfo")
      expect(resp.hasUpdate).toBe(true)
    })

    it("opens GitHub releases page when API unreachable", async () => {
      const { ctx } = makeCtx(mockFetchNetworkError())
      await handleOpenClawWebviewMessage({ type: "openclawCheckUpdates" }, ctx)
      expect(openedUris.some((u) => u.includes("releases"))).toBe(true)
    })
  })

  describe("openclawViewChangelog", () => {
    it("opens GitHub changelog in browser", async () => {
      const { ctx } = makeCtx()
      const result = await handleOpenClawWebviewMessage({ type: "openclawViewChangelog" }, ctx)
      expect(result).toBe(true)
      expect(openedUris.some((u) => u.includes("CHANGELOG"))).toBe(true)
    })
  })

  describe("openclawRequestChannels", () => {
    it("posts channels on success", async () => {
      const { ctx, posted } = makeCtx(
        mockFetchJson([{ id: "telegram", name: "Telegram", type: "telegram", enabled: true }]),
      )
      await handleOpenClawWebviewMessage({ type: "openclawRequestChannels" }, ctx)
      const resp = posted[0] as { type: string; channels: unknown[] }
      expect(resp.type).toBe("openclawChannelsUpdate")
      expect(resp.channels).toHaveLength(1)
    })

    it("posts empty channels + error on failure", async () => {
      const { ctx, posted } = makeCtx(mockFetchNetworkError())
      await handleOpenClawWebviewMessage({ type: "openclawRequestChannels" }, ctx)
      const resp = posted[0] as { type: string; channels: unknown[]; error: string }
      expect(resp.type).toBe("openclawChannelsUpdate")
      expect(resp.channels).toEqual([])
      expect(resp.error).toBeTruthy()
    })
  })

  describe("openclawScanModels", () => {
    it("merges OpenClaw and Ollama models", async () => {
      // Mock fetch to return different responses for different URLs
      const fetchMock = jest.fn(async (url: string) => {
        if (url.includes("18789")) {
          return new Response(
            JSON.stringify([{ id: "oc-model", name: "OpenClaw Model", provider: "openai" }]),
            { status: 200, headers: { "content-type": "application/json" } },
          )
        }
        if (url.includes("11434")) {
          return new Response(
            JSON.stringify({ models: [{ name: "llama3:8b" }] }),
            { status: 200, headers: { "content-type": "application/json" } },
          )
        }
        return new Response("{}", { status: 404 })
      }) as unknown as typeof fetch

      const { ctx, posted } = makeCtx(fetchMock)
      // Pre-set gateway URL
      await ctx.extensionContext.workspaceState.update("openclaw.gatewayUrl", "http://localhost:18789")
      await handleOpenClawWebviewMessage({ type: "openclawScanModels" }, ctx)

      const resp = posted[0] as { type: string; models: unknown[] }
      expect(resp.type).toBe("openclawModelsUpdate")
      // Should have both OpenClaw model + Ollama model
      const ids = resp.models.map((m) => (m as { id: string }).id)
      expect(ids).toContain("oc-model")
      expect(ids).toContain("llama3:8b")
    })
  })

  describe("openclawToggleChannel", () => {
    it("posts channelToggled on success", async () => {
      const { ctx, posted } = makeCtx(mockFetchJson({ ok: true }))
      const result = await handleOpenClawWebviewMessage(
        { type: "openclawToggleChannel", channelId: "telegram", enabled: true },
        ctx,
      )
      expect(result).toBe(true)
      const resp = posted[0] as { type: string; channelId: string; enabled: boolean; ok: boolean }
      expect(resp.type).toBe("openclawChannelToggled")
      expect(resp.channelId).toBe("telegram")
      expect(resp.enabled).toBe(true)
      expect(resp.ok).toBe(true)
    })
  })

  describe("openclawTestChannel", () => {
    it("posts channelTested on success", async () => {
      const { ctx, posted } = makeCtx(mockFetchJson({ ok: true, latency_ms: 42 }))
      await handleOpenClawWebviewMessage({ type: "openclawTestChannel", channelId: "discord" }, ctx)
      const resp = posted[0] as { type: string; channelId: string; ok: boolean; latency_ms: number }
      expect(resp.type).toBe("openclawChannelTested")
      expect(resp.ok).toBe(true)
      expect(resp.latency_ms).toBe(42)
    })
  })

  describe("openclawSaveAgentPrompt", () => {
    it("posts agentUpdated on success", async () => {
      const { ctx, posted } = makeCtx(mockFetchJson({ ok: true }))
      await handleOpenClawWebviewMessage(
        { type: "openclawSaveAgentPrompt", agentId: "agent-1", prompt: "You are helpful." },
        ctx,
      )
      const resp = posted[0] as { type: string; agentId: string; ok: boolean }
      expect(resp.type).toBe("openclawAgentUpdated")
      expect(resp.agentId).toBe("agent-1")
      expect(resp.ok).toBe(true)
    })
  })

  describe("openclawCreateAgent", () => {
    it("posts agentsUpdate after creating and refreshing", async () => {
      // First call: create → returns agent. Second call: list → returns agents array.
      let callCount = 0
      const fetchMock = jest.fn(async () => {
        callCount++
        if (callCount === 1) {
          return new Response(JSON.stringify({ agent: { id: "new-1" } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        }
        return new Response(
          JSON.stringify([{ id: "new-1", name: "New Agent" }]),
          { status: 200, headers: { "content-type": "application/json" } },
        )
      }) as unknown as typeof fetch

      const { ctx, posted } = makeCtx(fetchMock)
      await handleOpenClawWebviewMessage({ type: "openclawCreateAgent" }, ctx)
      const resp = posted[0] as { type: string; agents: unknown[] }
      expect(resp.type).toBe("openclawAgentsUpdate")
      expect(resp.agents).toHaveLength(1)
    })
  })

  describe("gateway URL resolution", () => {
    it("uses workspaceState URL when no explicit URL provided", async () => {
      const capturedUrls: string[] = []
      const fetchMock = jest.fn(async (url: string) => {
        capturedUrls.push(url)
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      }) as unknown as typeof fetch

      const { ctx } = makeCtx(fetchMock)
      await ctx.extensionContext.workspaceState.update("openclaw.gatewayUrl", "http://localhost:9876")
      await handleOpenClawWebviewMessage({ type: "openclawRequestChannels" }, ctx)
      expect(capturedUrls[0]).toContain("9876")
    })

    it("falls back to default URL when workspaceState is empty", async () => {
      const { ctx } = makeCtx()
      const url = __test.resolveGatewayUrl(ctx, undefined)
      expect(url).toBe(__test.OPENCLAW_DEFAULT_URL)
    })
  })
})
