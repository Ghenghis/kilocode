/**
 * Unit tests for AutoApproveService — runner: `bun test`.
 *
 * Stubs `vscode` so the service can be exercised outside the extension host.
 * Covers the public surface: conditions CRUD, rate-limit normalisation,
 * audit-log circular-buffer behaviour, and tolerance for malformed
 * globalState shapes (the documented "side-effect-free at construction" path).
 */
import { describe, it, expect, beforeEach, mock } from "bun:test"

class FakeMemento {
  private s = new Map<string, unknown>()
  get<T>(k: string, d?: T): T | undefined {
    return this.s.has(k) ? (this.s.get(k) as T) : d
  }
  async update(k: string, v: unknown) {
    if (v === undefined) this.s.delete(k)
    else this.s.set(k, v)
  }
  // Test-only escape hatch for forcing malformed state shapes.
  _setRaw(k: string, v: unknown) {
    this.s.set(k, v)
  }
}

// AutoApproveService doesn't use any vscode runtime APIs (only types), but we
// register a richer stub here to avoid cross-file mock cache collisions when
// the suite is run alongside services that DO call into vscode.workspace.
mock.module("vscode", () => ({
  workspace: {
    getConfiguration: () => ({ get: <T>(_k: string, d?: T) => d }),
    onDidChangeConfiguration: () => ({ dispose: () => {} }),
    workspaceFolders: undefined,
  },
  window: {},
  commands: { registerCommand: () => ({ dispose: () => {} }) },
}))

import { AutoApproveService } from "../AutoApproveService"

function makeContext() {
  return {
    globalState: new FakeMemento(),
    subscriptions: [],
  } as unknown as import("vscode").ExtensionContext
}

describe("AutoApproveService.conditions", () => {
  let svc: AutoApproveService

  beforeEach(() => {
    svc = new AutoApproveService(makeContext())
  })

  it("starts with an empty list and round-trips an added condition", async () => {
    expect(svc.getConditions()).toEqual([])
    const added = await svc.addCondition({ type: "glob", value: "src/**/*.ts", action: "allow" })
    expect(added.id).toMatch(/^cond_/)
    expect(svc.getConditions()).toEqual([added])
  })

  it("normalises invalid action values to 'allow' and stringifies the value", async () => {
    const c = await svc.addCondition({
      type: "count",
      // Cast so we can simulate a renderer sending a bad action through the bridge.
      action: "bogus" as unknown as "allow",
      value: 42 as unknown as string,
    })
    expect(c.action).toBe("allow")
    expect(c.value).toBe("42")
  })

  it("removeCondition returns false for unknown id and true after a successful delete", async () => {
    const a = await svc.addCondition({ type: "glob", value: "a", action: "allow" })
    expect(await svc.removeCondition("does-not-exist")).toBe(false)
    expect(await svc.removeCondition(a.id)).toBe(true)
    expect(svc.getConditions()).toEqual([])
  })
})

describe("AutoApproveService.rateLimits", () => {
  it("returns defaults when nothing has been persisted", () => {
    const svc = new AutoApproveService(makeContext())
    expect(svc.getRateLimits()).toEqual({ toolsPerMinute: 60, enabled: false })
  })

  it("setRateLimit floors fractional toolsPerMinute and preserves untouched fields", async () => {
    const svc = new AutoApproveService(makeContext())
    const next = await svc.setRateLimit({ toolsPerMinute: 12.9, enabled: true })
    expect(next).toEqual({ toolsPerMinute: 12, enabled: true })

    // A subsequent partial update must not clobber the unspecified fields.
    const after = await svc.setRateLimit({ enabled: false })
    expect(after).toEqual({ toolsPerMinute: 12, enabled: false })
  })

  it("falls back to defaults when persisted state is the wrong shape", () => {
    const ctx = makeContext()
    ;(ctx.globalState as unknown as FakeMemento)._setRaw("kilo-code.autoApprove.rateLimits", "not-an-object")
    const svc = new AutoApproveService(ctx)
    expect(svc.getRateLimits()).toEqual({ toolsPerMinute: 60, enabled: false })
  })
})

describe("AutoApproveService.auditLog", () => {
  it("appendLog stamps timestamp and getCountWindow only counts entries within the last 60s", async () => {
    const svc = new AutoApproveService(makeContext())
    const now = Date.now()
    await svc.appendLog({ action: "write_to_file", source: "agent", timestamp: now - 120_000 })
    await svc.appendLog({ action: "execute_command", source: "agent", timestamp: now - 1_000 })
    await svc.appendLog({ action: "read_file", source: "agent" })

    expect(svc.getLog().length).toBe(3)
    const win = svc.getCountWindow()
    expect(win.windowMs).toBe(60_000)
    // Only the two recent entries fall inside the rolling window.
    expect(win.count).toBe(2)
  })

  it("trims the audit log to the circular-buffer size (100 entries)", async () => {
    const svc = new AutoApproveService(makeContext())
    for (let i = 0; i < 105; i++) {
      await svc.appendLog({ action: `act-${i}`, source: "agent" })
    }
    const log = svc.getLog()
    expect(log.length).toBe(100)
    // The oldest 5 should have been trimmed off the front of the buffer.
    expect(log[0].action).toBe("act-5")
    expect(log[log.length - 1].action).toBe("act-104")
  })

  it("getLog returns [] when persisted state is malformed", () => {
    const ctx = makeContext()
    ;(ctx.globalState as unknown as FakeMemento)._setRaw("kilo-code.autoApprove.log", { not: "an array" })
    const svc = new AutoApproveService(ctx)
    expect(svc.getLog()).toEqual([])
  })
})
