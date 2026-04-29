/**
 * Unit tests for MemoryService remote-sync integration with the Shiba
 * Memory Gateway — runner: ``bun test``.
 *
 * Hermetic: every test stubs ``globalThis.fetch`` so no real network
 * calls are made. The shared ``vscode`` mock comes from
 * ``packages/kilo-vscode/tests/setup/vscode-mock.ts`` (preloaded by
 * bunfig.toml).
 */
import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { MemoryService } from "../MemoryService"

// ─── Helpers ────────────────────────────────────────────

interface FetchCall {
  url: string
  init: RequestInit
  bodyJson: unknown
}

function makeTempStore(): { ctx: { globalStorageUri: { fsPath: string } }; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kilo-memsvc-"))
  const cleanup = () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      /* best-effort */
    }
  }
  return { ctx: { globalStorageUri: { fsPath: dir } }, cleanup }
}

function installFetchMock(handlers: {
  write?: (body: unknown) => { ok: boolean; status?: number; bodyJson?: unknown }
  recall?: (body: unknown) => { ok: boolean; status?: number; bodyJson?: unknown }
}): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = []
  const original = globalThis.fetch

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const bodyText = typeof init?.body === "string" ? init.body : ""
    let bodyJson: unknown = null
    try {
      bodyJson = bodyText ? JSON.parse(bodyText) : null
    } catch {
      bodyJson = bodyText
    }
    calls.push({ url, init: init ?? {}, bodyJson })

    const route = url.endsWith("/write") ? handlers.write : url.endsWith("/recall") ? handlers.recall : undefined
    if (!route) {
      return new Response("not mocked", { status: 404 })
    }
    const out = route(bodyJson)
    return new Response(JSON.stringify(out.bodyJson ?? {}), {
      status: out.status ?? (out.ok ? 200 : 500),
    })
  }) as typeof fetch

  return {
    calls,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

/** Build a MemoryService and force the connection state used by tests. */
function buildService(opts: { connected: boolean; endpoint?: string }): {
  svc: MemoryService
  cleanup: () => void
} {
  const { ctx, cleanup } = makeTempStore()
  const svc = new MemoryService(ctx as unknown as Parameters<typeof MemoryService.prototype.constructor>[0])

  if (opts.connected) {
    // Patch the private connection — we don't want autoConnect's HTTP
    // probe firing during tests.
    ;(svc as unknown as { connection: { status: string; endpoint: string } }).connection = {
      status: "connected",
      endpoint: opts.endpoint ?? "http://shiba.test:18789",
    }
  } else {
    ;(svc as unknown as { connection: { status: string; endpoint: string } }).connection = {
      status: "disconnected",
      endpoint: "local:///tmp/memory.json",
    }
  }

  return {
    svc,
    cleanup: () => {
      svc.dispose()
      cleanup()
    },
  }
}

/** Wait until ``cond()`` returns true, polling every 5ms. Bails after timeoutMs. */
async function waitFor(cond: () => boolean, timeoutMs = 200): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeoutMs) return
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

// ─── Tests ──────────────────────────────────────────────

describe("MemoryService remote sync (Shiba)", () => {
  let restore: (() => void) | null = null
  let teardown: (() => void) | null = null

  afterEach(() => {
    if (restore) {
      restore()
      restore = null
    }
    if (teardown) {
      teardown()
      teardown = null
    }
  })

  describe("writeMemory → remote push", () => {
    it("posts to /write when the connection is active", async () => {
      const { calls, restore: rs } = installFetchMock({
        write: () => ({ ok: true, bodyJson: { id: "abc", created: true } }),
      })
      restore = rs

      const { svc, cleanup } = buildService({ connected: true })
      teardown = cleanup

      const entry = svc.writeMemory({
        summary: "test summary",
        content: "test content for shiba",
        factType: "decision",
        scope: "global",
      })

      await waitFor(() => calls.length >= 1)
      expect(calls.length).toBe(1)

      const call = calls[0]
      expect(call.url).toBe("http://shiba.test:18789/write")
      const body = call.bodyJson as { id: string; content: string; tags: string[]; metadata: Record<string, unknown> }
      expect(body.id).toBe(entry.id)
      expect(body.content).toBe("test content for shiba")
      expect(body.tags).toContain("decision")
      expect(body.tags).toContain("global")
      const headers = call.init.headers as Record<string, string>
      expect(headers["X-Shiba-Key"]).toBe("shiba-local-key")
    })

    it("does NOT post when the connection is disconnected", async () => {
      const { calls, restore: rs } = installFetchMock({
        write: () => ({ ok: true, bodyJson: { id: "x", created: true } }),
      })
      restore = rs

      const { svc, cleanup } = buildService({ connected: false })
      teardown = cleanup

      svc.writeMemory({
        summary: "no-remote",
        content: "should stay local",
        factType: "fix",
        scope: "task",
      })

      // Give the event loop a tick to drain any micro-tasks.
      await new Promise((r) => setTimeout(r, 30))
      expect(calls.length).toBe(0)
    })

    it("does not throw and queues the entry when remote returns 5xx", async () => {
      const { calls, restore: rs } = installFetchMock({
        write: () => ({ ok: false, status: 503, bodyJson: { error: "down" } }),
      })
      restore = rs

      const { svc, cleanup } = buildService({ connected: true })
      teardown = cleanup

      const entry = svc.writeMemory({
        summary: "remote-fail",
        content: "remote will say 503",
        factType: "recall",
        scope: "project",
      })

      // Local entry is still returned synchronously — no throw.
      expect(entry.id).toBeTruthy()

      await waitFor(() => svc.getRemoteRetryQueueDepth() >= 1)
      expect(calls.length).toBe(1)
      expect(svc.getRemoteRetryQueueDepth()).toBe(1)
    })

    it("survives a network exception (fetch throws) without failing the local write", async () => {
      const original = globalThis.fetch
      globalThis.fetch = (async () => {
        throw new Error("ECONNREFUSED")
      }) as typeof fetch
      restore = () => {
        globalThis.fetch = original
      }

      const { svc, cleanup } = buildService({ connected: true })
      teardown = cleanup

      const entry = svc.writeMemory({
        summary: "net-fail",
        content: "fetch will throw",
        factType: "contract",
        scope: "global",
      })

      expect(entry.id).toBeTruthy()
      // Wait for the rejected fetch promise + catch handler to run.
      await waitFor(() => svc.getRemoteRetryQueueDepth() >= 1)
      expect(svc.getRemoteRetryQueueDepth()).toBe(1)
    })
  })

  describe("recallWithRemote → merge with LWW", () => {
    it("merges remote results into the local recall response", async () => {
      const { calls, restore: rs } = installFetchMock({
        recall: () => ({
          ok: true,
          bodyJson: {
            memories: [
              {
                id: "remote-only-1",
                content: "kubernetes service mesh notes",
                tags: ["k8s"],
                score: 0.9,
                created_at: 1000,
                updated_at: 2000,
              },
            ],
            total: 1,
          },
        }),
      })
      restore = rs

      const { svc, cleanup } = buildService({ connected: true })
      teardown = cleanup

      // Seed a local entry that should ALSO appear in the merged result.
      svc.writeMemory({
        summary: "local kubernetes",
        content: "local kubernetes deployment notes",
        factType: "decision",
        scope: "global",
      })

      const merged = await svc.recallWithRemote("kubernetes")

      // Was a recall call actually made?
      const recallCalls = calls.filter((c) => c.url.endsWith("/recall"))
      expect(recallCalls.length).toBe(1)

      const ids = merged.results.map((r) => r.id)
      expect(ids).toContain("remote-only-1")
      // Local entry id is mem-...
      expect(ids.some((id) => id.startsWith("mem-"))).toBe(true)
      expect(merged.status).toBe("success")
    })

    it("LWW: when an id exists in both local and remote, the newer timestamp wins", async () => {
      const { svc, cleanup } = buildService({ connected: true })
      teardown = cleanup

      // Seed a local entry first…
      const localEntry = svc.writeMemory({
        summary: "shared",
        content: "OLD local content",
        factType: "decision",
        scope: "global",
      })

      // …then the remote returns the SAME id with a newer updated_at.
      const newerSeconds = (localEntry.timestamp + 60_000) / 1000
      const { calls, restore: rs } = installFetchMock({
        recall: () => ({
          ok: true,
          bodyJson: {
            memories: [
              {
                id: localEntry.id,
                content: "NEW remote content",
                tags: [],
                score: 0.8,
                created_at: newerSeconds,
                updated_at: newerSeconds,
              },
            ],
            total: 1,
          },
        }),
        // Allow the seed write to also "succeed" silently.
        write: () => ({ ok: true, bodyJson: { id: localEntry.id, created: true } }),
      })
      restore = rs

      const merged = await svc.recallWithRemote("shared")
      const winner = merged.results.find((r) => r.id === localEntry.id)
      expect(winner).toBeDefined()
      expect(winner!.content).toBe("NEW remote content")
      // The merged record should reflect the remote-newer LWW reason.
      expect(winner!.matchReason.toLowerCase()).toContain("remote-newer")
      expect(calls.filter((c) => c.url.endsWith("/recall")).length).toBe(1)
    })

    it("returns local-only results when the remote /recall fails", async () => {
      const { restore: rs } = installFetchMock({
        recall: () => ({ ok: false, status: 502, bodyJson: { error: "bad gateway" } }),
      })
      restore = rs

      const { svc, cleanup } = buildService({ connected: true })
      teardown = cleanup

      svc.writeMemory({
        summary: "fallback test",
        content: "purely local fallback content",
        factType: "decision",
        scope: "global",
      })

      const result = await svc.recallWithRemote("fallback content")
      expect(result.results.length).toBeGreaterThan(0)
      // Status reflects whatever local returned — must be "success".
      expect(result.status).toBe("success")
      // No remote ids leaked in.
      expect(result.results.every((r) => !r.id.startsWith("remote-"))).toBe(true)
    })
  })
})
