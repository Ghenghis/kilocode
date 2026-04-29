/**
 * Hermetic unit tests for HealthRecoveryService.
 *
 * The service depends on:
 *   - KiloConnectionService — we inject a hand-rolled fake whose `onStateChange`
 *     callbacks we can drive synchronously.
 *   - vscode (StatusBarItem, commands.registerCommand) — already mocked globally
 *     via tests/setup/vscode-mock.ts (preloaded by bunfig.toml).
 *   - KiloLogger — we mock the module to a no-op so we don't pollute test output.
 *
 * Notes on timing:
 *   The retry path uses real timers (1s minimum backoff for attempt 1). To keep
 *   tests fast we either short-circuit before timers fire, or fake out connect()
 *   so the in-flight reconnect is observable without waiting full backoff.
 */
import { describe, it, expect, mock, beforeEach } from "bun:test"

mock.module("../../KiloLogger", () => ({
  KiloLogger: {
    for: () => ({
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      time: () => () => {},
    }),
    showChannel: () => {},
  },
}))

const { HealthRecoveryService } = await import("../HealthRecoveryService")

// ─── Fake connection service ─────────────────────────────────────────────

type ConnState = "connecting" | "connected" | "disconnected" | "error"

function makeFakeConnectionService(initial: ConnState = "disconnected") {
  let state: ConnState = initial
  const listeners = new Set<(s: ConnState) => void>()
  const calls: { connect: number; dispose: number } = { connect: 0, dispose: 0 }
  let connectImpl: (dir: string) => Promise<void> = async () => {}

  return {
    getConnectionState: () => state,
    onStateChange: (fn: (s: ConnState) => void) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    getServerInfo: () => ({ port: 12345 }),
    getServerConfig: () => ({ baseUrl: "http://127.0.0.1:12345", password: "pw" }),
    connect: async (dir: string) => {
      calls.connect++
      return connectImpl(dir)
    },
    dispose: () => {
      calls.dispose++
    },

    // Test helpers
    emit(next: ConnState) {
      state = next
      for (const fn of listeners) fn(next)
    },
    setConnectImpl(impl: (dir: string) => Promise<void>) {
      connectImpl = impl
    },
    calls,
    listenerCount: () => listeners.size,
  }
}

function fakeContext(): import("vscode").ExtensionContext {
  return {
    extension: { packageJSON: { version: "0.0.1-test" } },
  } as never
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

describe("HealthRecoveryService", () => {
  beforeEach(() => {
    // No-op; mock state is fine across tests.
  })

  // ─── Initial state / construction ─────────────────────────────────────

  it("seeds initial health state from the connection service's current state", () => {
    const conn = makeFakeConnectionService("connected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())
    expect(svc.getState().status).toBe("healthy")
    svc.dispose()
  })

  it("initial state is 'disconnected' when underlying connection is disconnected", () => {
    const conn = makeFakeConnectionService("disconnected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())
    expect(svc.getState().status).toBe("disconnected")
    expect(svc.getState().errorCount).toBe(0)
    expect(svc.getState().retryAttempt).toBe(0)
    svc.dispose()
  })

  // ─── Happy-path: first-time connect ───────────────────────────────────

  it("first-time connect: handleConnectionState('connected') sets status='healthy'", () => {
    const conn = makeFakeConnectionService("disconnected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())

    conn.emit("connected")

    expect(svc.getState().status).toBe("healthy")
    expect(svc.getState().retryAttempt).toBe(0)
    expect(svc.getState().errorCount).toBe(0)
    expect(svc.getState().lastSuccessfulConnect).not.toBeNull()
    svc.dispose()
  })

  it("connecting state during the very first connect maps to 'recovering' only if not already healthy", () => {
    const conn = makeFakeConnectionService("disconnected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())

    conn.emit("connecting")
    expect(svc.getState().status).toBe("recovering")
    svc.dispose()
  })

  it("once healthy, transient 'connecting' does NOT flip status (avoids flapping)", () => {
    const conn = makeFakeConnectionService("disconnected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())
    conn.emit("connected")
    expect(svc.getState().status).toBe("healthy")

    conn.emit("connecting")
    // No flap — stays healthy.
    expect(svc.getState().status).toBe("healthy")
    svc.dispose()
  })

  // ─── State change subscription ────────────────────────────────────────

  it("onStateChange listeners are notified on transitions; unsubscribe stops further notifications", () => {
    const conn = makeFakeConnectionService("disconnected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())
    const seen: string[] = []
    const unsub = svc.onStateChange((s) => seen.push(s.status))

    conn.emit("connected")
    expect(seen).toContain("healthy")

    unsub()
    conn.emit("disconnected")
    // No new entries from this listener.
    const lengthAfterUnsub = seen.length
    conn.emit("connected")
    expect(seen.length).toBe(lengthAfterUnsub)
    svc.dispose()
  })

  // ─── Recovery escalation: error after healthy ─────────────────────────

  it("connection 'error' after healthy increments errorCount and schedules a retry (recovering)", () => {
    const conn = makeFakeConnectionService("disconnected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())
    conn.emit("connected")

    conn.emit("error")
    expect(svc.getState().errorCount).toBeGreaterThan(0)
    expect(svc.getState().status).toBe("recovering")
    expect(svc.getState().retryAttempt).toBe(1)
    expect(svc.getState().nextRetryAt).not.toBeNull()
    svc.dispose()
  })

  it("connection 'disconnected' also schedules retry with backoff", () => {
    const conn = makeFakeConnectionService("connected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())
    // Service state is seeded as 'healthy' because initial conn state is 'connected'.

    conn.emit("disconnected")
    expect(svc.getState().status).toBe("recovering")
    expect(svc.getState().retryAttempt).toBe(1)
    expect(svc.getState().lastError).toBeTruthy()
    svc.dispose()
  })

  it("multiple consecutive failures DO NOT double-schedule (single retry timer)", () => {
    const conn = makeFakeConnectionService("connected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())

    conn.emit("error")
    const attempt1 = svc.getState().retryAttempt
    conn.emit("error")
    // Second error while a retry is already scheduled should NOT bump attempt.
    expect(svc.getState().retryAttempt).toBe(attempt1)
    svc.dispose()
  })

  // ─── Cooldown: degraded grace window ──────────────────────────────────

  it("recovery from error->connected enters 'degraded' (visible cooldown), not 'healthy' immediately", () => {
    const conn = makeFakeConnectionService("connected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())

    // First, cause an error so errorCount > 0.
    conn.emit("error")
    expect(svc.getState().errorCount).toBeGreaterThan(0)

    // Then recover.
    conn.emit("connected")
    expect(svc.getState().status).toBe("degraded")
    // errorCount is NOT cleared until grace window elapses; the test just
    // confirms the immediate state is 'degraded' (cooldown), preventing
    // re-trigger on a transient blip.
    svc.dispose()
  })

  // ─── Retry attempt counter resets on success ──────────────────────────

  it("on successful reconnect, retryAttempt resets to 0", () => {
    const conn = makeFakeConnectionService("connected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())

    conn.emit("error")
    expect(svc.getState().retryAttempt).toBe(1)

    conn.emit("connected")
    expect(svc.getState().retryAttempt).toBe(0)
    expect(svc.getState().nextRetryAt).toBeNull()
    svc.dispose()
  })

  // ─── Diagnostics ──────────────────────────────────────────────────────

  it("getDiagnostics() includes status, server URL, version, and error info", () => {
    const conn = makeFakeConnectionService("connected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())
    conn.emit("connected")

    const diag = svc.getDiagnostics()
    expect(diag).toContain("CLI Backend Status: healthy")
    expect(diag).toContain("Server URL: http://127.0.0.1:12345")
    expect(diag).toContain("Version: 0.0.1-test")
    svc.dispose()
  })

  // ─── Dispose ──────────────────────────────────────────────────────────

  it("dispose() unregisters connection listener, clears timers, idempotent", () => {
    const conn = makeFakeConnectionService("disconnected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())
    expect(conn.listenerCount()).toBe(1)

    svc.dispose()
    expect(conn.listenerCount()).toBe(0)

    // Second dispose() does not throw.
    expect(() => svc.dispose()).not.toThrow()

    // After dispose, state events become no-ops (status frozen).
    const before = svc.getState().status
    conn.emit("connected")
    expect(svc.getState().status).toBe(before)
  })

  // ─── Manual restart ───────────────────────────────────────────────────

  it("restart() tears down connection, clears retry counter, then re-connects", async () => {
    const conn = makeFakeConnectionService("connected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())

    // Cause an error to bump retryAttempt.
    conn.emit("error")
    expect(svc.getState().retryAttempt).toBe(1)

    // Wire connect() to immediately simulate success via state event.
    conn.setConnectImpl(async () => {
      conn.emit("connected")
    })

    await svc.restart()

    expect(conn.calls.dispose).toBe(1)
    expect(conn.calls.connect).toBe(1)
    // After successful reconnect, retryAttempt reset.
    expect(svc.getState().retryAttempt).toBe(0)
    svc.dispose()
  })

  it("restart() handles connect() rejection by recording error and re-scheduling", async () => {
    const conn = makeFakeConnectionService("connected")
    const svc = new HealthRecoveryService(conn as never, fakeContext())

    conn.setConnectImpl(async () => {
      throw new Error("CLI restart failed")
    })

    await svc.restart()

    expect(svc.getState().lastError).toContain("CLI restart failed")
    expect(svc.getState().errorCount).toBeGreaterThan(0)
    expect(svc.getState().status).toBe("recovering")
    expect(svc.getState().retryAttempt).toBeGreaterThanOrEqual(1)
    svc.dispose()
  })
})
