/**
 * Tests for hub-webview.ts
 *
 * Verifies:
 *   1. Non-hub messages are ignored (returns false)
 *   2. hubAction executes the correct terminal command
 *   3. Unknown hubAction posts an error response
 *   4. hubProxyFetch proxies the request and posts hubProxyResult
 *   5. hubProxyFetch surfaces fetch errors gracefully
 *   6. hubOpenExternal calls vscode.env.openExternal
 *   7. Unrecognised hub* messages return false (future-proofing)
 */

import { handleHubWebviewMessage, __test } from "../hub-webview"

// ── Minimal vscode mock ───────────────────────────────────────────────────────

const createdTerminals: Array<{ name: string; command: string }> = []
const openedUris: string[] = []

jest.mock("vscode", () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: "/workspace" } }],
    getConfiguration: () => ({
      get: (_key: string, fallback?: unknown) => fallback ?? "",
    }),
  },
  window: {
    createTerminal: (opts: { name: string }) => ({
      show: jest.fn(),
      sendText: (cmd: string) => {
        createdTerminals.push({ name: opts.name, command: cmd })
      },
      dispose: jest.fn(),
    }),
  },
  env: {
    openExternal: async (uri: { toString(): string }) => {
      openedUris.push(uri.toString())
      return true
    },
  },
  Uri: {
    parse: (s: string) => ({ toString: () => s }),
  },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCtx(fetchImpl?: typeof fetch) {
  const posted: unknown[] = []
  const workspaceState = {
    store: new Map<string, unknown>(),
    get<T>(k: string, def?: T) { return (this.store.get(k) as T) ?? def },
    async update(k: string, v: unknown) { this.store.set(k, v) },
  }
  const extensionContext = { workspaceState } as unknown as import("vscode").ExtensionContext
  return {
    posted,
    ctx: { extensionContext, postMessage: (m: unknown) => posted.push(m), fetchImpl },
  }
}

function mockFetchSuccess(body: unknown): typeof fetch {
  return jest.fn(async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as typeof fetch
}

function mockFetchError(status: number, text: string): typeof fetch {
  return jest.fn(async () =>
    new Response(text, { status }),
  ) as unknown as typeof fetch
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("handleHubWebviewMessage", () => {
  beforeEach(() => {
    createdTerminals.length = 0
    openedUris.length = 0
  })
  afterEach(() => jest.clearAllMocks())

  it("returns false for non-hub messages", async () => {
    const { ctx } = makeCtx()
    expect(await handleHubWebviewMessage({ type: "openclawConnect" }, ctx)).toBe(false)
    expect(await handleHubWebviewMessage({ type: "governance.load" }, ctx)).toBe(false)
    expect(await handleHubWebviewMessage({ type: "sshConnect" }, ctx)).toBe(false)
  })

  it("returns false for missing type", async () => {
    const { ctx } = makeCtx()
    expect(await handleHubWebviewMessage({ action: "build-vsix" }, ctx)).toBe(false)
  })

  describe("hubAction", () => {
    it("opens a terminal and runs the build-vsix command", async () => {
      const { ctx, posted } = makeCtx()
      const result = await handleHubWebviewMessage({ type: "hubAction", action: "build-vsix" }, ctx)
      expect(result).toBe(true)
      expect(createdTerminals).toHaveLength(1)
      expect(createdTerminals[0].name).toContain("build-vsix")
      expect(createdTerminals[0].command).toMatch(/esbuild/)
      const ack = posted[0] as { type: string; action: string }
      expect(ack.type).toBe("hubActionStarted")
      expect(ack.action).toBe("build-vsix")
    })

    it("opens a terminal for deploy-vps", async () => {
      const { ctx } = makeCtx()
      await handleHubWebviewMessage({ type: "hubAction", action: "deploy-vps" }, ctx)
      expect(createdTerminals[0].command).toMatch(/deploy-vps/)
    })

    it("posts error for unknown action", async () => {
      const { ctx, posted } = makeCtx()
      const result = await handleHubWebviewMessage({ type: "hubAction", action: "nuke-everything" }, ctx)
      expect(result).toBe(true)
      const resp = posted[0] as { type: string; ok: boolean; error: string }
      expect(resp.type).toBe("hubActionResult")
      expect(resp.ok).toBe(false)
      expect(resp.error).toMatch(/Unknown action/)
    })

    it("all 6 actions have commands defined", () => {
      const { ACTION_COMMANDS } = __test
      const expectedActions = ["deploy-vps", "sync-upstream", "rotate-secrets", "build-vsix", "health-all", "export-audit"]
      for (const a of expectedActions) {
        expect(ACTION_COMMANDS[a]).toBeTruthy()
      }
    })
  })

  describe("hubProxyFetch", () => {
    it("proxies GET and posts hubProxyResult on success", async () => {
      const { ctx, posted } = makeCtx(mockFetchSuccess({ services: [], prs: [] }))
      const result = await handleHubWebviewMessage(
        { type: "hubProxyFetch", requestId: "req-1", path: "/api/services", method: "GET", hubBase: "http://localhost:8082" },
        ctx,
      )
      expect(result).toBe(true)
      const resp = posted[0] as { type: string; requestId: string; ok: boolean; body: unknown }
      expect(resp.type).toBe("hubProxyResult")
      expect(resp.requestId).toBe("req-1")
      expect(resp.ok).toBe(true)
      expect(resp.body).toEqual({ services: [], prs: [] })
    })

    it("posts hubProxyResult with error when fetch fails", async () => {
      const { ctx, posted } = makeCtx(mockFetchError(503, "Service Unavailable"))
      await handleHubWebviewMessage(
        { type: "hubProxyFetch", requestId: "req-2", path: "/api/services", hubBase: "http://localhost:8082" },
        ctx,
      )
      const resp = posted[0] as { type: string; ok: boolean; status: number }
      expect(resp.type).toBe("hubProxyResult")
      expect(resp.ok).toBe(false)
      expect(resp.status).toBe(503)
    })
  })

  describe("hubOpenExternal", () => {
    it("opens the URL in the system browser", async () => {
      const { ctx } = makeCtx()
      const result = await handleHubWebviewMessage(
        { type: "hubOpenExternal", url: "http://localhost:8082/ui" },
        ctx,
      )
      expect(result).toBe(true)
      expect(openedUris).toContain("http://localhost:8082/ui")
    })
  })

  it("returns false for unknown hub* messages (future-proofing)", async () => {
    const { ctx } = makeCtx()
    const result = await handleHubWebviewMessage({ type: "hubSomeNewMessageNotYetImplemented" }, ctx)
    expect(result).toBe(false)
  })

  describe("__test exports", () => {
    it("exposes HUB_DEFAULT_URL and ACTION_COMMANDS", () => {
      expect(__test.HUB_DEFAULT_URL).toBe("http://localhost:8082")
      expect(typeof __test.ACTION_COMMANDS).toBe("object")
      expect(__test.ACTION_COMMANDS["build-vsix"]).toBeTruthy()
    })
  })
})
