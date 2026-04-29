/**
 * Tests for cloud-session.ts (cloud session list / preview / import-and-send).
 *
 * Coverage focus (multi-step partial-failure surface):
 *   1. handleRequestCloudSessions returns "Not connected" when client is null
 *   2. handleRequestCloudSessions happy path posts cloudSessionsLoaded
 *   3. handleRequestCloudSessions backend error → posts error message
 *   4. handleImportAndSend rolls back on import failure (no send attempted)
 *   5. handleImportAndSend partial-failure: import OK, send fails → emits sendMessageFailed
 *   6. handleImportAndSend tracks the new session ID in trackedSessionIds
 *
 * Test runner: bun:test (project default).
 */

import { describe, expect, it } from "bun:test"
import {
  handleRequestCloudSessions,
  handleImportAndSend,
  type CloudSessionContext,
} from "../cloud-session"

// ─── Fakes ──────────────────────────────────────────────────────────────

interface FakeClientOpts {
  cloudSessions?: () => Promise<{ data: { cliSessions: unknown[]; nextCursor: string | null } | undefined }>
  importSession?: () => Promise<{ data: { id: string } | undefined }>
  promptAsync?: () => Promise<unknown>
  sessionCommand?: () => Promise<unknown>
}

function makeClient(opts: FakeClientOpts = {}) {
  const calls = {
    cloudSessions: 0,
    import: 0,
    prompt: 0,
    command: 0,
  }
  const client = {
    kilo: {
      cloudSessions: async (_a: { cursor?: string; limit?: number; gitUrl?: string }) => {
        calls.cloudSessions++
        if (opts.cloudSessions) return opts.cloudSessions()
        return { data: { cliSessions: [{ id: "s1" }], nextCursor: null } }
      },
      cloud: {
        session: {
          import: async (_a: { sessionId: string; directory: string }) => {
            calls.import++
            if (opts.importSession) return opts.importSession()
            // Shape compatible with sessionToWebview() — needs .time.created etc.
            return {
              data: {
                id: "local-imported-1",
                parentID: null,
                title: "Imported",
                time: { created: 0, updated: 0 },
                version: "v2",
                directory: "/repo",
              },
            }
          },
          get: async () => ({ data: undefined }),
        },
      },
    },
    session: {
      promptAsync: async (_a: unknown, _o: { throwOnError: true }) => {
        calls.prompt++
        if (opts.promptAsync) return opts.promptAsync()
        return {}
      },
      command: async (_a: unknown, _o: { throwOnError: true }) => {
        calls.command++
        if (opts.sessionCommand) return opts.sessionCommand()
        return {}
      },
    },
  }
  return { client, calls }
}

function makeCtx(client: ReturnType<typeof makeClient>["client"] | null = null): {
  ctx: CloudSessionContext
  posted: unknown[]
  trackedSessionIds: Set<string>
} {
  const posted: unknown[] = []
  const trackedSessionIds = new Set<string>()
  return {
    posted,
    trackedSessionIds,
    ctx: {
      client: client as unknown as CloudSessionContext["client"],
      currentSession: null,
      trackedSessionIds,
      connectionService: {
        recordMessageSessionId: () => {},
      },
      postMessage: (m: unknown) => posted.push(m),
      getWorkspaceDirectory: () => "/repo",
      gatherEditorContext: async () => ({}) as unknown as Awaited<ReturnType<CloudSessionContext["gatherEditorContext"]>>,
    },
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe("handleRequestCloudSessions", () => {
  it("emits 'Not connected' error when client is null", async () => {
    const t = makeCtx(null)
    await handleRequestCloudSessions(t.ctx, {})
    expect(t.posted).toHaveLength(1)
    const out = t.posted[0] as { type: string; message: string }
    expect(out.type).toBe("error")
    expect(out.message).toMatch(/Not connected/)
  })

  it("happy path posts cloudSessionsLoaded with sessions + nextCursor", async () => {
    const { client } = makeClient()
    const t = makeCtx(client)
    await handleRequestCloudSessions(t.ctx, { cursor: "abc", limit: 25 })
    expect(t.posted).toHaveLength(1)
    const out = t.posted[0] as { type: string; sessions: unknown[]; nextCursor: string | null }
    expect(out.type).toBe("cloudSessionsLoaded")
    expect(out.sessions).toHaveLength(1)
    expect(out.nextCursor).toBeNull()
  })

  it("backend error surfaces as type=error (cursor-malformed-equivalent)", async () => {
    const { client } = makeClient({
      cloudSessions: async () => {
        throw new Error("invalid cursor: malformed")
      },
    })
    const t = makeCtx(client)
    await handleRequestCloudSessions(t.ctx, { cursor: "{{not-base64}}" })
    expect(t.posted).toHaveLength(1)
    const out = t.posted[0] as { type: string; message: string }
    expect(out.type).toBe("error")
    expect(out.message).toMatch(/invalid cursor/i)
  })
})

describe("handleImportAndSend", () => {
  it("import failure → cloudSessionImportFailed and NO send attempted", async () => {
    const { client, calls } = makeClient({
      importSession: async () => {
        throw new Error("import boom")
      },
    })
    const t = makeCtx(client)
    await handleImportAndSend(t.ctx, "cloud-1", "hello")
    expect(calls.import).toBe(1)
    expect(calls.prompt).toBe(0)
    expect(calls.command).toBe(0)
    const types = t.posted.map((m) => (m as { type: string }).type)
    expect(types).toEqual(["cloudSessionImportFailed"])
    const failed = t.posted[0] as { error: string }
    expect(failed.error).toMatch(/import boom/)
  })

  it("partial failure: import OK but send fails → emits sendMessageFailed (rollback signal)", async () => {
    const { client, calls } = makeClient({
      promptAsync: async () => {
        throw new Error("send boom")
      },
    })
    const t = makeCtx(client)
    await handleImportAndSend(t.ctx, "cloud-1", "hello")
    expect(calls.import).toBe(1)
    expect(calls.prompt).toBe(1)
    const types = t.posted.map((m) => (m as { type: string }).type)
    expect(types).toEqual(["cloudSessionImported", "sendMessageFailed"])
    const fail = t.posted[1] as { error: string; sessionID: string }
    expect(fail.error).toMatch(/send boom/)
    expect(fail.sessionID).toBe("local-imported-1")
  })

  it("happy path tracks the new local session in trackedSessionIds", async () => {
    const { client } = makeClient()
    const t = makeCtx(client)
    await handleImportAndSend(t.ctx, "cloud-1", "hello")
    expect(t.trackedSessionIds.has("local-imported-1")).toBe(true)
    const types = t.posted.map((m) => (m as { type: string }).type)
    expect(types).toEqual(["cloudSessionImported"])
  })

  it("returns early with cloudSessionImportFailed when client is null", async () => {
    const t = makeCtx(null)
    await handleImportAndSend(t.ctx, "cloud-1", "hi")
    const out = t.posted[0] as { type: string; error: string }
    expect(out.type).toBe("cloudSessionImportFailed")
    expect(out.error).toMatch(/Not connected/)
  })
})
