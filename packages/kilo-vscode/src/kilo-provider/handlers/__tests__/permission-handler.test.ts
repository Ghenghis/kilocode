/**
 * Tests for permission-handler.ts (multi-dir recovery + permission reply).
 *
 * Coverage focus:
 *   1. recoveryDirs deduplicates workspace + sessionDirectories
 *   2. recoverablePermissions filters: only tracked sessions, dedupes by id
 *   3. fetchAndSendPendingPermissions iterates all dirs, posts per recoverable perm
 *   4. fetchAndSendPendingPermissions silent-catches backend error (no throw, no infinite loop)
 *   5. handlePermissionResponse with no client → emits permissionError without throwing
 *
 * Test runner: bun:test (project default).
 */

import { describe, expect, it } from "bun:test"
import {
  recoveryDirs,
  recoverablePermissions,
  fetchAndSendPendingPermissions,
  handlePermissionResponse,
  type PermissionContext,
  type RecoverablePermission,
} from "../permission-handler"

// ─── Fakes ──────────────────────────────────────────────────────────────

interface FakeClientOpts {
  list?: (args: { directory: string }) => Promise<{ data: RecoverablePermission[] | undefined }>
  reply?: () => Promise<void>
  saveAlwaysRules?: () => Promise<void>
}

function makeClient(opts: FakeClientOpts = {}) {
  const calls = {
    list: [] as string[],
    reply: 0,
    saveAlwaysRules: 0,
  }
  const client = {
    permission: {
      list: async (args: { directory: string }) => {
        calls.list.push(args.directory)
        if (opts.list) return opts.list(args)
        return { data: [] as RecoverablePermission[] }
      },
      reply: async (_a: unknown, _o: { throwOnError: true }) => {
        calls.reply++
        if (opts.reply) return opts.reply()
      },
      saveAlwaysRules: async (_a: unknown, _o: { throwOnError: true }) => {
        calls.saveAlwaysRules++
        if (opts.saveAlwaysRules) return opts.saveAlwaysRules()
      },
    },
  }
  return { client, calls }
}

function makeCtx(client: ReturnType<typeof makeClient>["client"] | null = null): {
  ctx: PermissionContext
  posted: unknown[]
} {
  const posted: unknown[] = []
  return {
    posted,
    ctx: {
      client: client as unknown as PermissionContext["client"],
      currentSessionId: "session-current",
      trackedSessionIds: new Set<string>(["s1", "s2"]),
      sessionDirectories: new Map<string, string>([
        ["s1", "/repo/a"],
        ["s2", "/repo/b"],
      ]),
      postMessage: (m: unknown) => posted.push(m),
      getWorkspaceDirectory: () => "/repo",
    },
  }
}

const perm = (id: string, sessionID: string): RecoverablePermission =>
  ({
    id,
    sessionID,
    permission: "edit",
    patterns: ["**/*.ts"],
    always: false,
    metadata: {},
    tool: "edit",
  }) as unknown as RecoverablePermission

// ─── Tests ──────────────────────────────────────────────────────────────

describe("recoveryDirs", () => {
  it("dedupes workspace + sessionDirectories preserving uniqueness", () => {
    const dirs = recoveryDirs(
      "/repo",
      new Map([
        ["a", "/repo"],
        ["b", "/repo/sub"],
        ["c", "/repo/sub"],
      ]),
    )
    expect(dirs.sort()).toEqual(["/repo", "/repo/sub"])
  })
})

describe("recoverablePermissions", () => {
  it("filters out untracked sessions and dedupes by id", () => {
    const tracked = new Set<string>(["s1"])
    const seen = new Set<string>()
    const out = recoverablePermissions(
      [perm("p1", "s1"), perm("p1", "s1"), perm("p2", "s2"), perm("p3", "s1")],
      tracked,
      seen,
    )
    expect(out.map((p) => p.id)).toEqual(["p1", "p3"])
  })
})

describe("fetchAndSendPendingPermissions", () => {
  it("iterates all recovery dirs and posts one permissionRequest per recoverable perm", async () => {
    const { client, calls } = makeClient({
      list: async (args) => {
        if (args.directory === "/repo") return { data: [perm("p1", "s1")] }
        if (args.directory === "/repo/a") return { data: [perm("p1", "s1"), perm("p2", "s2")] }
        return { data: [perm("p3", "s2")] }
      },
    })
    const t = makeCtx(client)
    await fetchAndSendPendingPermissions(t.ctx)
    // 3 unique dirs (workspace + s1 dir + s2 dir)
    expect(new Set(calls.list).size).toBe(3)
    // Three unique permissions across calls (p1/p2/p3) — all tracked
    const types = t.posted.map((m) => (m as { type: string }).type)
    expect(types).toEqual(["permissionRequest", "permissionRequest", "permissionRequest"])
    const ids = t.posted.map((m) => (m as { permission: { id: string } }).permission.id)
    expect(new Set(ids)).toEqual(new Set(["p1", "p2", "p3"]))
  })

  it("backend error is silently caught (does NOT throw or loop forever)", async () => {
    const { client } = makeClient({
      list: async () => {
        throw new Error("backend gone")
      },
    })
    const t = makeCtx(client)
    // Must complete (no infinite loop, no throw bubbling up)
    await fetchAndSendPendingPermissions(t.ctx)
    expect(t.posted).toHaveLength(0)
  })

  it("returns silently when client is null (no work attempted)", async () => {
    const t = makeCtx(null)
    await fetchAndSendPendingPermissions(t.ctx)
    expect(t.posted).toHaveLength(0)
  })
})

describe("handlePermissionResponse", () => {
  it("no client → emits permissionError and does not throw", async () => {
    const t = makeCtx(null)
    await handlePermissionResponse(t.ctx, "p-1", "s1", "once", [], [])
    expect(t.posted).toHaveLength(1)
    expect((t.posted[0] as { type: string }).type).toBe("permissionError")
  })

  it("happy path: saveAlwaysRules then reply (sequential, no race)", async () => {
    const { client, calls } = makeClient()
    const t = makeCtx(client)
    await handlePermissionResponse(t.ctx, "p-1", "s1", "always", ["edit:**/*.ts"], [])
    expect(calls.saveAlwaysRules).toBe(1)
    expect(calls.reply).toBe(1)
    // No error posts
    expect(t.posted).toHaveLength(0)
  })

  it("reply failure surfaces as permissionError (no silent swallow)", async () => {
    const { client } = makeClient({
      reply: async () => {
        throw new Error("reply failed")
      },
    })
    const t = makeCtx(client)
    await handlePermissionResponse(t.ctx, "p-1", "s1", "once", [], [])
    const out = t.posted[0] as { type: string; permissionID: string }
    expect(out.type).toBe("permissionError")
    expect(out.permissionID).toBe("p-1")
  })
})
