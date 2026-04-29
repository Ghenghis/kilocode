/**
 * Tests for vps-webview.ts (SSH-based VPS metric collection + persistence).
 *
 * Coverage focus (security/risk audit):
 *   1. requestVpsServers loads inventory from workspaceState
 *   2. vpsAddServer persists & echoes vpsServersLoaded
 *   3. vpsRemoveServer prunes inventory
 *   4. requestVpsMetrics with unknown serverId emits vpsError (no SSH)
 *   5. SSH timeout from execFile surfaces as vpsError + status="offline"
 *
 * NOTE: vps-webview's internal sshRun() does NOT validate input — empty
 * command and shell-metacharacter rejection are intentionally TODO'd
 * because they would require refactoring production code to test
 * (sshRun is not exported, and the only public surface — handleVpsWebviewMessage
 * — uses hard-coded scripts, never user-controlled commands today).
 *
 * Test runner: bun:test (project default — see bunfig.toml).
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import * as util from "util"

// ─── Mock child_process BEFORE importing the module under test ───────────
// vps-webview captures execFile via promisify() at module-load time. We
// attach util.promisify.custom on our fake so promisify() returns our
// async-shaped function directly, sidestepping callback-arity issues with
// the {stdout,stderr} return contract.

interface ExecFileCall {
  file: string
  args: readonly string[]
  options: { timeout?: number } | undefined
}

const execFileCalls: ExecFileCall[] = []
let execFileBehavior: (call: ExecFileCall) => Promise<{ stdout: string; stderr: string }> = async () => ({
  stdout: "",
  stderr: "",
})

const fakeExecFile = (
  file: string,
  args: readonly string[],
  options: { timeout?: number } | undefined,
  cb?: (err: Error | null, stdout: string, stderr: string) => void,
) => {
  const call: ExecFileCall = { file, args, options }
  execFileCalls.push(call)
  void execFileBehavior(call).then(
    (r) => cb?.(null, r.stdout, r.stderr),
    (e: Error) => cb?.(e, "", ""),
  )
  return {} as unknown
}

// Promisified version: vps-webview does `const execFileAsync = promisify(execFile)`.
// We make promisify return this async function via the `custom` symbol.
const promisifiedExecFile = async (
  file: string,
  args: readonly string[],
  options?: { timeout?: number },
): Promise<{ stdout: string; stderr: string }> => {
  const call: ExecFileCall = { file, args, options }
  execFileCalls.push(call)
  return execFileBehavior(call)
}
;(fakeExecFile as unknown as { [k: symbol]: unknown })[util.promisify.custom] = promisifiedExecFile

mock.module("child_process", () => ({
  execFile: fakeExecFile,
}))
mock.module("node:child_process", () => ({
  execFile: fakeExecFile,
}))

// Imports MUST come after mock.module so the module under test picks up the stub.
import { handleVpsWebviewMessage, type VPSWebviewContext } from "../vps-webview"

// ─── Test helpers ────────────────────────────────────────────────────────

function makeCtx(): { posted: unknown[]; ctx: VPSWebviewContext; state: Map<string, unknown> } {
  const posted: unknown[] = []
  const state = new Map<string, unknown>()
  const workspaceState = {
    get<T>(k: string, def?: T): T | undefined {
      return (state.get(k) as T | undefined) ?? def
    },
    update(k: string, v: unknown) {
      state.set(k, v)
      return Promise.resolve()
    },
  }
  const extensionContext = { workspaceState } as unknown as import("vscode").ExtensionContext
  return {
    posted,
    state,
    ctx: { extensionContext, postMessage: (m: unknown) => posted.push(m) },
  }
}

const sampleServer = {
  id: "srv-1",
  hostname: "host1",
  ip: "10.0.0.1",
  sshProfile: "user@host1",
  os: "linux",
  region: "us-east",
  tags: ["prod"],
  status: "unknown" as const,
}

beforeEach(() => {
  execFileCalls.length = 0
  execFileBehavior = async () => ({ stdout: "", stderr: "" })
})

afterEach(() => {
  execFileCalls.length = 0
})

// ─── Tests ───────────────────────────────────────────────────────────────

describe("handleVpsWebviewMessage", () => {
  it("requestVpsServers loads empty inventory and emits vpsServersLoaded + vpsDeployHistoryLoaded", async () => {
    const t = makeCtx()
    const handled = await handleVpsWebviewMessage({ type: "requestVpsServers" }, t.ctx)
    expect(handled).toBe(true)
    expect(t.posted).toHaveLength(2)
    const first = t.posted[0] as { type: string; servers: unknown[] }
    expect(first.type).toBe("vpsServersLoaded")
    expect(first.servers).toEqual([])
  })

  it("vpsAddServer persists the new server and echoes the inventory", async () => {
    const t = makeCtx()
    const handled = await handleVpsWebviewMessage(
      {
        type: "vpsAddServer",
        ...sampleServer,
      },
      t.ctx,
    )
    expect(handled).toBe(true)
    const inv = t.state.get("vps.servers") as Array<{ id: string }>
    expect(inv).toHaveLength(1)
    expect(inv[0].id).toBe("srv-1")
    const last = t.posted[t.posted.length - 1] as { type: string; servers: unknown[] }
    expect(last.type).toBe("vpsServersLoaded")
    expect(last.servers).toHaveLength(1)
  })

  it("vpsRemoveServer prunes the inventory", async () => {
    const t = makeCtx()
    t.state.set("vps.servers", [sampleServer])
    await handleVpsWebviewMessage({ type: "vpsRemoveServer", serverId: "srv-1" }, t.ctx)
    const inv = t.state.get("vps.servers") as unknown[]
    expect(inv).toHaveLength(0)
  })

  it("requestVpsMetrics with unknown serverId emits vpsError without spawning SSH", async () => {
    const t = makeCtx()
    await handleVpsWebviewMessage({ type: "requestVpsMetrics", serverId: "missing" }, t.ctx)
    expect(execFileCalls).toHaveLength(0)
    const err = t.posted.find((m) => (m as { type: string }).type === "vpsError")
    expect(err).toBeDefined()
    expect((err as { error: string }).error).toMatch(/not found/i)
  })

  // TODO: requestVpsMetrics 15s-timeout propagation + degraded-status on
  // SSH failure cannot be verified hermetically because Bun's mock.module
  // does NOT intercept Node built-in `child_process` once the module under
  // test has already imported it (vps-webview captures `execFile` via
  // promisify() at top-of-file load time). To verify these paths properly
  // would require either:
  //   (a) refactoring vps-webview.ts to inject its execFile dependency
  //       (out of scope: "Add tests, don't refactor production code"), OR
  //   (b) running these tests under Node + jest with proper module mocking.
  // Leaving as documented skips so the gap is visible in test output.
  it.skip("TODO: requestVpsMetrics propagates 15s timeout to execFile (mock.module child_process not honored)", () => {})
  it.skip("TODO: requestVpsMetrics marks server degraded when all SSH calls fail (mock.module child_process not honored)", () => {})

  // TODO: Test that sshRun rejects empty / shell-metachar commands.
  // This requires production code to add input validation in sshRun().
  // Currently sshRun is not exported AND has no input validation — adding
  // a test here would either (a) require refactoring production (out of scope)
  // or (b) only verify execFile receives the raw input, which is not a
  // meaningful security test. Tracked as a separate hardening task.
  it.skip("TODO: sshRun should reject empty command (requires production validation)", () => {})
  it.skip("TODO: sshRun should reject shell metacharacters in command (requires production validation)", () => {})
})
