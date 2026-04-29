/**
 * Unit tests for BrowserAutomationService — runner: `bun test`.
 *
 * Stubs `vscode` and a fake `KiloConnectionService` so we can drive the state
 * machine without an extension host or a real CLI backend / Playwright MCP.
 * Covers: settings-driven enable/disable, register success → "connected",
 * register failure → "failed", and the no-client guard returning `null` from
 * getServerStatus.
 */
import { describe, it, expect, beforeEach, mock } from "bun:test"

// ─── vscode mock ────────────────────────────────────────────────────
//
// `getConfiguration` returns whatever the test put into `cfgStore` for that
// section's keys. We also expose `triggerConfigChange` so tests can simulate
// the workspace settings event the service listens to.
const cfgStore: Record<string, unknown> = {}
let configListener: ((e: { affectsConfiguration: (s: string) => boolean }) => void) | undefined

mock.module("vscode", () => ({
  workspace: {
    getConfiguration: (_section: string) => ({
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        const full = `${_section}.${key}`
        return full in cfgStore ? (cfgStore[full] as T) : defaultValue
      },
    }),
    onDidChangeConfiguration: (cb: typeof configListener) => {
      configListener = cb
      return { dispose: () => { configListener = undefined } }
    },
    workspaceFolders: [{ uri: { fsPath: "/fake/workspace" } }],
  },
}))

import { BrowserAutomationService } from "../browser-automation-service"

// ─── Fake CLI client + connection service ───────────────────────────

interface FakeMcpAdd {
  status: Record<string, { status: string; error?: string }>
}

function makeClient(opts: {
  addImpl?: () => Promise<{ data: FakeMcpAdd["status"] }>
  disconnectImpl?: () => Promise<void>
  statusImpl?: () => Promise<{ data: Record<string, unknown> }>
}) {
  return {
    mcp: {
      add: opts.addImpl ?? (async () => ({ data: {} })),
      disconnect: opts.disconnectImpl ?? (async () => {}),
      status: opts.statusImpl ?? (async () => ({ data: {} })),
    },
  }
}

function makeConnService(client: ReturnType<typeof makeClient> | null) {
  return {
    getClient: () => {
      if (!client) throw new Error("not connected")
      return client
    },
  } as unknown as import("../../cli-backend").KiloConnectionService
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("BrowserAutomationService", () => {
  beforeEach(() => {
    for (const k of Object.keys(cfgStore)) delete cfgStore[k]
    configListener = undefined
  })

  it("starts in 'disabled' and unregister is a no-op when settings are off", async () => {
    const svc = new BrowserAutomationService(makeConnService(makeClient({})))
    expect(svc.getState()).toBe("disabled")

    cfgStore["kilo-code.new.browserAutomation.enabled"] = false
    await svc.syncWithSettings()
    expect(svc.getState()).toBe("disabled")
    svc.dispose()
  })

  it("syncWithSettings(enabled=true) transitions disabled → registering → connected", async () => {
    const transitions: string[] = []

    cfgStore["kilo-code.new.browserAutomation.enabled"] = true
    const client = makeClient({
      addImpl: async () => ({
        data: { "kilo-playwright": { status: "connected" } },
      }),
    })
    const svc = new BrowserAutomationService(makeConnService(client))
    svc.onStateChange((s) => transitions.push(s))

    await svc.syncWithSettings()
    expect(svc.getState()).toBe("connected")
    expect(transitions).toEqual(["registering", "connected"])
    svc.dispose()
  })

  it("transitions to 'failed' when client.mcp.add throws", async () => {
    cfgStore["kilo-code.new.browserAutomation.enabled"] = true
    const client = makeClient({
      addImpl: async () => {
        throw new Error("backend unreachable")
      },
    })
    const svc = new BrowserAutomationService(makeConnService(client))

    await svc.syncWithSettings()
    expect(svc.getState()).toBe("failed")
    svc.dispose()
  })

  it("transitions to 'failed' when no SDK client is available", async () => {
    cfgStore["kilo-code.new.browserAutomation.enabled"] = true
    const svc = new BrowserAutomationService(makeConnService(null))

    await svc.syncWithSettings()
    expect(svc.getState()).toBe("failed")
    svc.dispose()
  })

  it("getServerStatus returns null when the connection service has no client", async () => {
    const svc = new BrowserAutomationService(makeConnService(null))
    expect(await svc.getServerStatus()).toBeNull()
    svc.dispose()
  })

  it("dispose() detaches state listeners and the configuration listener", async () => {
    const svc = new BrowserAutomationService(makeConnService(makeClient({})))
    let calls = 0
    svc.onStateChange(() => {
      calls++
    })
    svc.dispose()

    // After dispose, the workspace.onDidChangeConfiguration disposable was
    // returned and torn down; the service should no longer hold listeners.
    expect(configListener).toBeUndefined()
    // Subsequent direct state pokes should not fan out (no listeners left).
    cfgStore["kilo-code.new.browserAutomation.enabled"] = false
    await svc.syncWithSettings()
    expect(calls).toBe(0)
  })
})
