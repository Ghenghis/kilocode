/**
 * Regression test for HermesStatusService — Wave 2 race-conditions PR.
 *
 * Hermetic: relies on the shared vscode mock from
 * `packages/kilo-vscode/tests/setup/vscode-mock.ts` (preloaded by bunfig.toml).
 * No network, no fake-timers — we drive the ping path by calling `refresh()`
 * directly, which is exactly what the `setInterval` callback does on each tick.
 */
import { describe, it, expect, mock } from "bun:test"

import { HermesStatusService } from "../HermesStatusService"
import type { HermesClient } from "../HermesClient"
import type { HermesConfig, HermesHealth } from "../types"

interface FakeClient {
  setConfig: (cfg: HermesConfig) => void
  health: ReturnType<typeof mock>
}

function makeFakeClient(label: string): FakeClient {
  return {
    setConfig: () => {},
    health: mock(
      async (): Promise<HermesHealth> => ({
        ok: true,
        latency_ms: 1,
        bridge_reachable: true,
        version: label,
      }),
    ),
  }
}

function makeCtx(): { ctx: { subscriptions: { dispose: () => void }[] }; cleanup: () => void } {
  const subs: { dispose: () => void }[] = []
  return {
    ctx: { subscriptions: subs },
    cleanup: () => {
      for (const s of subs) {
        try {
          s.dispose()
        } catch {
          /* best-effort */
        }
      }
    },
  }
}

/**
 * Override the vscode workspace config so `getConfig()` reports the pipeline
 * as enabled. The shared mock returns the caller-supplied default, so by
 * patching `getConfiguration` here we don't have to touch the global mock.
 * We also stub `onDidChangeConfiguration` (not in the shared mock) so the
 * service constructor can register its watcher.
 */
async function withEnabledConfig<T>(fn: () => Promise<T>): Promise<T> {
  const vscode = require("vscode") as {
    workspace: {
      getConfiguration: () => unknown
      onDidChangeConfiguration?: (cb: unknown) => { dispose: () => void }
    }
  }
  const originalGet = vscode.workspace.getConfiguration
  const originalOnChange = vscode.workspace.onDidChangeConfiguration
  vscode.workspace.getConfiguration = () => ({
    get: <V>(key: string, fallback?: V): V => {
      if (key === "enabled") return true as unknown as V
      if (key === "baseUrl") return "http://hermes.test:8091" as unknown as V
      if (key === "approvalMode") return "auto-low" as unknown as V
      if (key === "workspaceScopeOnly") return true as unknown as V
      return fallback as V
    },
    update: async () => {},
  })
  vscode.workspace.onDidChangeConfiguration = () => ({ dispose: () => {} })
  try {
    // IMPORTANT: await the inner function so the config patch stays in
    // place across all awaits inside it. A non-async wrapper would restore
    // the originals as soon as the Promise was *created*, which would let
    // the default (enabled=false) leak in mid-test.
    return await fn()
  } finally {
    vscode.workspace.getConfiguration = originalGet
    vscode.workspace.onDidChangeConfiguration = originalOnChange
  }
}

describe("HermesStatusService — stale-closure race (Wave 2)", () => {
  it("uses the most-recently-set client on each ping tick", async () => {
    await withEnabledConfig(async () => {
      const { ctx, cleanup } = makeCtx()
      const svc = new HermesStatusService(
        ctx as unknown as ConstructorParameters<typeof HermesStatusService>[0],
      )

      const clientA = makeFakeClient("A")
      svc.setClient(clientA as unknown as HermesClient)

      // setClient → rewire() does its own refresh() in addition to the
      // explicit refresh() below, so wait for those to drain and snapshot
      // the call count instead of asserting on a fixed number.
      await svc.refresh()
      const aCallsAfterFirstTick = clientA.health.mock.calls.length
      expect(aCallsAfterFirstTick).toBeGreaterThanOrEqual(1)

      // Replace with client B. The fix ensures the interval callback (and
      // refresh()) reads `this.client` fresh — without it, A would still be
      // pinged on the next tick.
      const clientB = makeFakeClient("B")
      svc.setClient(clientB as unknown as HermesClient)

      // Drive a second tick — exactly what `setInterval` does.
      await svc.refresh()

      // B was called, A was NOT called any additional times after the swap.
      expect(clientB.health.mock.calls.length).toBeGreaterThanOrEqual(1)
      expect(clientA.health.mock.calls.length).toBe(aCallsAfterFirstTick)

      svc.dispose()
      cleanup()
    })
  })

  it("skips the tick when no client has been set yet", async () => {
    await withEnabledConfig(async () => {
      const { ctx, cleanup } = makeCtx()
      const svc = new HermesStatusService(
        ctx as unknown as ConstructorParameters<typeof HermesStatusService>[0],
      )

      // No setClient() call — refresh() must be a no-op rather than throwing.
      await expect(svc.refresh()).resolves.toBeUndefined()

      svc.dispose()
      cleanup()
    })
  })
})
