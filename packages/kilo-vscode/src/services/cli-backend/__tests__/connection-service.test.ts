/**
 * Hermetic unit tests for KiloConnectionService.
 *
 * Strategy:
 *   - We CANNOT use `mock.module("../sdk-sse-adapter", ...)` here because
 *     sibling test files (sdk-sse-adapter.test.ts) import the same module
 *     and bun:test's mock registry is process-global. The mock would leak.
 *   - Instead, we patch ServerManager.prototype and SdkSSEAdapter.prototype
 *     methods in beforeEach + restore in afterEach. This is local to the
 *     instance lifecycle and does not poison other test files.
 *   - createKiloClient is mocked via mock.module on "@kilocode/sdk/v2/client"
 *     because that package is only consumed at runtime from connection-service
 *     itself; sdk-sse-adapter.test.ts uses it as a type-only import.
 */
import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test"
import { ServerManager } from "../server-manager"
import { SdkSSEAdapter } from "../sdk-sse-adapter"

// ─── createKiloClient mock (type-only deps elsewhere; safe) ───────────────

const fakeKiloClient = { __fake: true }
mock.module("@kilocode/sdk/v2/client", () => ({
  createKiloClient: (_opts: unknown) => fakeKiloClient,
}))

const { KiloConnectionService } = await import("../connection-service")

// ─── Prototype patching helpers ───────────────────────────────────────────

interface FakeAdapterState {
  eventListeners: Array<(event: unknown) => void>
  errorListeners: Array<(error: Error) => void>
  stateListeners: Array<(state: "connecting" | "connected" | "disconnected") => void>
  connected: boolean
  disposed: boolean
  reconnectCalls: number
}

const adapterStates = new WeakMap<SdkSSEAdapter, FakeAdapterState>()
let lastAdapter: SdkSSEAdapter | null = null
let autoConnect = true

function emitState(adapter: SdkSSEAdapter, s: "connecting" | "connected" | "disconnected"): void {
  const st = adapterStates.get(adapter)
  if (!st) return
  for (const fn of st.stateListeners) fn(s)
}

function emitError(adapter: SdkSSEAdapter, e: Error): void {
  const st = adapterStates.get(adapter)
  if (!st) return
  for (const fn of st.errorListeners) fn(e)
}

function emitEvent(adapter: SdkSSEAdapter, ev: unknown): void {
  const st = adapterStates.get(adapter)
  if (!st) return
  for (const fn of st.eventListeners) fn(ev)
}

interface FakeServerState {
  disposed: boolean
  getServerCalls: number
}
const serverStates = new WeakMap<ServerManager, FakeServerState>()
let lastServerManager: ServerManager | null = null

// ─── Saved originals (restored in afterEach) ──────────────────────────────

const sm = ServerManager.prototype as unknown as {
  getServer: () => Promise<{ port: number; password: string; process: unknown }>
  dispose: () => void
}
const sse = SdkSSEAdapter.prototype as unknown as {
  connect: () => void
  disconnect: () => void
  reconnect: () => void
  dispose: () => void
  onEvent: (fn: (e: unknown) => void) => () => void
  onError: (fn: (e: Error) => void) => () => void
  onStateChange: (fn: (s: "connecting" | "connected" | "disconnected") => void) => () => void
}

const originalSm = {
  getServer: sm.getServer,
  dispose: sm.dispose,
}
const originalSse = {
  connect: sse.connect,
  disconnect: sse.disconnect,
  reconnect: sse.reconnect,
  dispose: sse.dispose,
  onEvent: sse.onEvent,
  onError: sse.onError,
  onStateChange: sse.onStateChange,
}

function installPatches(): void {
  sm.getServer = async function (this: ServerManager) {
    let s = serverStates.get(this)
    if (!s) {
      s = { disposed: false, getServerCalls: 0 }
      serverStates.set(this, s)
      lastServerManager = this
    }
    s.getServerCalls++
    return { port: 12345, password: "pw", process: {} as never }
  }
  sm.dispose = function (this: ServerManager) {
    const s = serverStates.get(this)
    if (s) s.disposed = true
  }

  sse.connect = function (this: SdkSSEAdapter) {
    let s = adapterStates.get(this)
    if (!s) {
      s = {
        eventListeners: [],
        errorListeners: [],
        stateListeners: [],
        connected: false,
        disposed: false,
        reconnectCalls: 0,
      }
      adapterStates.set(this, s)
    }
    s.connected = true
    if (autoConnect) {
      setTimeout(() => emitState(this, "connected"), 0)
    }
  }
  sse.disconnect = function (this: SdkSSEAdapter) {
    /* no-op for tests */
  }
  sse.reconnect = function (this: SdkSSEAdapter) {
    const s = adapterStates.get(this)
    if (s) s.reconnectCalls++
  }
  sse.dispose = function (this: SdkSSEAdapter) {
    const s = adapterStates.get(this)
    if (s) s.disposed = true
  }
  sse.onEvent = function (this: SdkSSEAdapter, fn) {
    let s = adapterStates.get(this)
    if (!s) {
      s = {
        eventListeners: [],
        errorListeners: [],
        stateListeners: [],
        connected: false,
        disposed: false,
        reconnectCalls: 0,
      }
      adapterStates.set(this, s)
    }
    s.eventListeners.push(fn)
    return () => {
      s!.eventListeners = s!.eventListeners.filter((x) => x !== fn)
    }
  }
  sse.onError = function (this: SdkSSEAdapter, fn) {
    let s = adapterStates.get(this)
    if (!s) {
      s = {
        eventListeners: [],
        errorListeners: [],
        stateListeners: [],
        connected: false,
        disposed: false,
        reconnectCalls: 0,
      }
      adapterStates.set(this, s)
    }
    s.errorListeners.push(fn)
    return () => {
      s!.errorListeners = s!.errorListeners.filter((x) => x !== fn)
    }
  }
  sse.onStateChange = function (this: SdkSSEAdapter, fn) {
    let s = adapterStates.get(this)
    if (!s) {
      s = {
        eventListeners: [],
        errorListeners: [],
        stateListeners: [],
        connected: false,
        disposed: false,
        reconnectCalls: 0,
      }
      adapterStates.set(this, s)
    }
    s.stateListeners.push(fn)
    lastAdapter = this
    return () => {
      s!.stateListeners = s!.stateListeners.filter((x) => x !== fn)
    }
  }
}

function uninstallPatches(): void {
  sm.getServer = originalSm.getServer
  sm.dispose = originalSm.dispose
  sse.connect = originalSse.connect
  sse.disconnect = originalSse.disconnect
  sse.reconnect = originalSse.reconnect
  sse.dispose = originalSse.dispose
  sse.onEvent = originalSse.onEvent
  sse.onError = originalSse.onError
  sse.onStateChange = originalSse.onStateChange
}

// ─── Test infra ───────────────────────────────────────────────────────────

function fakeContext(): import("vscode").ExtensionContext {
  return {} as never
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

// ─── Tests ────────────────────────────────────────────────────────────────

describe("KiloConnectionService", () => {
  beforeEach(() => {
    autoConnect = true
    lastAdapter = null
    lastServerManager = null
    installPatches()
    // Stub fetch so health-poll never hits the network.
    globalThis.fetch = (async () => ({ ok: true })) as unknown as typeof fetch
  })

  afterEach(() => {
    uninstallPatches()
  })

  // ─── Lifecycle ────────────────────────────────────────────────────────

  it("connect() succeeds and transitions disconnected -> connecting -> connected", async () => {
    const svc = new KiloConnectionService(fakeContext())
    const states: string[] = []
    svc.onStateChange((s) => states.push(s))

    await svc.connect("/repo")

    expect(svc.getConnectionState()).toBe("connected")
    expect(states[0]).toBe("connecting")
    expect(states).toContain("connected")
    expect(svc.getServerInfo()).toEqual({ port: 12345 })
    expect(svc.getServerConfig()).toEqual({ baseUrl: "http://127.0.0.1:12345", password: "pw" })

    svc.dispose()
  })

  it("getClient() throws when not connected; works after connect()", async () => {
    const svc = new KiloConnectionService(fakeContext())
    expect(() => svc.getClient()).toThrow(/Not connected/)

    await svc.connect("/repo")
    expect(svc.getClient()).toBe(fakeKiloClient as never)

    svc.dispose()
  })

  it("connect() is idempotent — second call while connected returns immediately", async () => {
    const svc = new KiloConnectionService(fakeContext())
    await svc.connect("/repo")
    expect(serverStates.get(lastServerManager!)!.getServerCalls).toBe(1)

    await svc.connect("/repo")
    expect(serverStates.get(lastServerManager!)!.getServerCalls).toBe(1)

    svc.dispose()
  })

  it("concurrent connect() calls share a single in-flight promise", async () => {
    autoConnect = false
    const svc = new KiloConnectionService(fakeContext())

    const p1 = svc.connect("/repo")
    const p2 = svc.connect("/repo")
    await tick()

    expect(lastAdapter).not.toBeNull()
    emitState(lastAdapter!, "connected")
    await Promise.all([p1, p2])

    expect(svc.getConnectionState()).toBe("connected")
    expect(serverStates.get(lastServerManager!)!.getServerCalls).toBe(1)

    svc.dispose()
  })

  it("disconnect via dispose() tears down server manager and SSE adapter", async () => {
    const svc = new KiloConnectionService(fakeContext())
    await svc.connect("/repo")
    const adapter = lastAdapter!
    const serverMgr = lastServerManager!

    svc.dispose()

    expect(adapterStates.get(adapter)!.disposed).toBe(true)
    expect(serverStates.get(serverMgr)!.disposed).toBe(true)
    expect(svc.getConnectionState()).toBe("disconnected")
    expect(svc.getServerInfo()).toBeNull()
    expect(svc.getServerConfig()).toBeNull()
  })

  // ─── Error / reconnect-style paths ────────────────────────────────────

  it("connect() rejects and sets state=error when SSE emits error before connected", async () => {
    autoConnect = false
    const svc = new KiloConnectionService(fakeContext())
    const states: string[] = []
    svc.onStateChange((s) => states.push(s))

    const promise = svc.connect("/repo")
    await tick()
    emitError(lastAdapter!, new Error("sse boom"))

    await expect(promise).rejects.toThrow("sse boom")
    expect(svc.getConnectionState()).toBe("error")
    expect(states).toContain("error")

    svc.dispose()
  })

  it("connect() rejects when SSE emits 'disconnected' before ever reaching 'connected'", async () => {
    autoConnect = false
    const svc = new KiloConnectionService(fakeContext())

    const promise = svc.connect("/repo")
    await tick()
    emitState(lastAdapter!, "disconnected")

    await expect(promise).rejects.toThrow(/SSE connection ended/)

    svc.dispose()
  })

  // ─── Multi-listener (multi-client) state isolation ────────────────────

  it("multi-listener: unsubscribing one listener does not affect the other", async () => {
    const svc = new KiloConnectionService(fakeContext())
    const a: string[] = []
    const b: string[] = []
    const unsubA = svc.onStateChange((s) => a.push(s))
    svc.onStateChange((s) => b.push(s))

    await svc.connect("/repo")
    expect(a).toContain("connected")
    expect(b).toContain("connected")

    unsubA()
    emitState(lastAdapter!, "disconnected")

    expect(a.filter((s) => s === "disconnected").length).toBe(0)
    expect(b).toContain("disconnected")

    svc.dispose()
  })

  it("multi-listener: events broadcast to all subscribed event listeners", async () => {
    const svc = new KiloConnectionService(fakeContext())
    await svc.connect("/repo")

    const a: unknown[] = []
    const b: unknown[] = []
    svc.onEvent((e) => a.push(e))
    svc.onEvent((e) => b.push(e))

    emitEvent(lastAdapter!, { type: "session.idle", properties: {} })

    expect(a.length).toBe(1)
    expect(b.length).toBe(1)

    svc.dispose()
  })

  // ─── Helper / Map management ──────────────────────────────────────────

  it("recordMessageSessionId + pruneSession remove all matching entries", async () => {
    const svc = new KiloConnectionService(fakeContext())
    svc.recordMessageSessionId("m1", "s1")
    svc.recordMessageSessionId("m2", "s1")
    svc.recordMessageSessionId("m3", "s2")

    const partEvent = {
      type: "message.part.updated",
      properties: { part: { type: "text", id: "p1", text: "", messageID: "m1" } },
    } as unknown as import("@kilocode/sdk/v2/client").Event
    expect(svc.resolveEventSessionId(partEvent)).toBe("s1")

    svc.pruneSession("s1")
    expect(svc.resolveEventSessionId(partEvent)).toBeUndefined()

    const partEvent3 = {
      type: "message.part.updated",
      properties: { part: { type: "text", id: "p3", text: "", messageID: "m3" } },
    } as unknown as import("@kilocode/sdk/v2/client").Event
    expect(svc.resolveEventSessionId(partEvent3)).toBe("s2")

    svc.dispose()
  })

  it("recordMessageSessionId ignores empty messageId or sessionId", async () => {
    const svc = new KiloConnectionService(fakeContext())
    svc.recordMessageSessionId("", "s1")
    svc.recordMessageSessionId("m1", "")
    const partEvent = {
      type: "message.part.updated",
      properties: { part: { type: "text", id: "p1", text: "", messageID: "m1" } },
    } as unknown as import("@kilocode/sdk/v2/client").Event
    expect(svc.resolveEventSessionId(partEvent)).toBeUndefined()
    svc.dispose()
  })

  // ─── Bounded retry ────────────────────────────────────────────────────
  // KiloConnectionService does NOT auto-retry on failure — it surfaces the
  // error. The retry loop is owned by HealthRecoveryService. Verify that
  // a failed connect() is terminal until something external triggers reconnect.

  it("does not auto-retry after a failed connect(); state stays 'error'", async () => {
    autoConnect = false
    const svc = new KiloConnectionService(fakeContext())

    const p = svc.connect("/repo")
    await tick()
    emitError(lastAdapter!, new Error("first failure"))
    await expect(p).rejects.toThrow("first failure")

    const adapterAfterFailure = lastAdapter
    await new Promise((r) => setTimeout(r, 50))
    // No new SdkSSEAdapter has been constructed.
    expect(lastAdapter).toBe(adapterAfterFailure)
    expect(svc.getConnectionState()).toBe("error")

    svc.dispose()
  })
})
