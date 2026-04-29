/**
 * Tests for migration.ts (legacy v5 → v7 migration handlers).
 *
 * Coverage focus (concurrency / silent-error guarantees):
 *   1. checkAndShowMigrationWizard returns early when migrationCheckInFlight=true
 *   2. checkAndShowMigrationWizard sets and clears migrationCheckInFlight around detection
 *   3. checkAndShowMigrationWizard does nothing when status is already set (already migrated)
 *   4. handleStartLegacyMigration happy path posts legacyMigrationComplete with results
 *   5. handleStartLegacyMigration migrate() throws → emits a single error result, sets lastMigrationHadErrors
 *
 * Test runner: bun:test (project default).
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

// ─── Mock migration-service BEFORE importing the module under test ───────

interface MigrationServiceFakeState {
  status: string | undefined
  detect: () => Promise<{
    hasData: boolean
    providers: unknown[]
    mcpServers: unknown[]
    customModes: unknown[]
    sessions: unknown[]
    defaultModel: unknown
    settings: unknown
  }>
  migrate: () => Promise<Array<{ item: string; category: string; status: string; message?: string }>>
  setStatusCalls: Array<string>
  clearLegacyCalls: number
}

const fake: MigrationServiceFakeState = {
  status: undefined,
  detect: async () => ({
    hasData: true,
    providers: [{ name: "openai" }],
    mcpServers: [],
    customModes: [],
    sessions: [{ id: "legacy-s1" }],
    defaultModel: { providerID: "openai", modelID: "gpt-4" },
    settings: {},
  }),
  migrate: async () => [
    { item: "openai", category: "providers", status: "ok" },
    { item: "legacy-s1", category: "sessions", status: "ok" },
  ],
  setStatusCalls: [],
  clearLegacyCalls: 0,
}

mock.module("../../../legacy-migration/migration-service", () => ({
  getMigrationStatus: () => fake.status,
  setMigrationStatus: async (_ctx: unknown, status: string) => {
    fake.setStatusCalls.push(status)
  },
  detectLegacyData: async () => fake.detect(),
  migrate: async () => fake.migrate(),
  clearLegacyData: async () => {
    fake.clearLegacyCalls++
  },
}))

// Imports after mock.module so the handler picks up stubs.
import {
  checkAndShowMigrationWizard,
  handleStartLegacyMigration,
  type MigrationContext,
} from "../migration"

// ─── Helpers ────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<MigrationContext> = {}): {
  ctx: MigrationContext
  posted: unknown[]
  hits: { dispose: number; refresh: number; broadcast: number }
} {
  const posted: unknown[] = []
  const hits = { dispose: 0, refresh: 0, broadcast: 0 }
  const globalState = new Map<string, unknown>()
  const secretsStore = new Map<string, string>()
  const extensionContext = {
    globalState: {
      get: <T>(k: string, def?: T) => (globalState.has(k) ? (globalState.get(k) as T) : def),
      update: async (k: string, v: unknown) => {
        globalState.set(k, v)
      },
    },
    secrets: {
      get: async (k: string) => secretsStore.get(k),
      store: async (k: string, v: string) => {
        secretsStore.set(k, v)
      },
      delete: async (k: string) => {
        secretsStore.delete(k)
      },
    },
    globalStorageUri: { fsPath: "/tmp/kilo" },
  }
  const ctx: MigrationContext = {
    client: { stub: true } as unknown as MigrationContext["client"],
    extensionContext,
    postMessage: (m: unknown) => posted.push(m),
    refreshSessions: () => {
      hits.refresh++
    },
    cachedLegacyData: null,
    migrationCheckInFlight: false,
    disposeGlobal: async () => {
      hits.dispose++
    },
    broadcastComplete: () => {
      hits.broadcast++
    },
    ...overrides,
  }
  return { ctx, posted, hits }
}

beforeEach(() => {
  fake.status = undefined
  fake.setStatusCalls.length = 0
  fake.clearLegacyCalls = 0
  fake.detect = async () => ({
    hasData: true,
    providers: [{ name: "openai" }],
    mcpServers: [],
    customModes: [],
    sessions: [{ id: "legacy-s1" }],
    defaultModel: { providerID: "openai", modelID: "gpt-4" },
    settings: {},
  })
  fake.migrate = async () => [{ item: "openai", category: "providers", status: "ok" }]
})

afterEach(() => {
  fake.setStatusCalls.length = 0
})

// ─── Tests ──────────────────────────────────────────────────────────────

describe("checkAndShowMigrationWizard", () => {
  it("returns early when migrationCheckInFlight is true (concurrent migration guard)", async () => {
    const t = makeCtx({ migrationCheckInFlight: true })
    let detectCalls = 0
    fake.detect = async () => {
      detectCalls++
      return {
        hasData: true,
        providers: [],
        mcpServers: [],
        customModes: [],
        sessions: [],
        defaultModel: undefined,
        settings: {},
      }
    }
    await checkAndShowMigrationWizard(t.ctx)
    expect(detectCalls).toBe(0)
    expect(t.posted).toHaveLength(0)
  })

  it("sets and clears migrationCheckInFlight around detection (no leak on success)", async () => {
    let observedFlagDuringDetect = false
    const t = makeCtx()
    fake.detect = async () => {
      observedFlagDuringDetect = t.ctx.migrationCheckInFlight
      return {
        hasData: true,
        providers: [],
        mcpServers: [],
        customModes: [],
        sessions: [],
        defaultModel: undefined,
        settings: {},
      }
    }
    await checkAndShowMigrationWizard(t.ctx)
    expect(observedFlagDuringDetect).toBe(true)
    expect(t.ctx.migrationCheckInFlight).toBe(false)
  })

  it("skips when getMigrationStatus reports already-completed (double-migration guard)", async () => {
    fake.status = "completed"
    const t = makeCtx()
    let detectCalls = 0
    fake.detect = async () => {
      detectCalls++
      return {
        hasData: true,
        providers: [],
        mcpServers: [],
        customModes: [],
        sessions: [],
        defaultModel: undefined,
        settings: {},
      }
    }
    await checkAndShowMigrationWizard(t.ctx)
    expect(detectCalls).toBe(0)
    expect(t.posted).toHaveLength(0)
  })

  it("legacy data with hasData=true emits migrationState with the detected payload", async () => {
    const t = makeCtx()
    await checkAndShowMigrationWizard(t.ctx)
    expect(t.posted).toHaveLength(1)
    const out = t.posted[0] as {
      type: string
      needed: boolean
      data: { providers: unknown[]; sessions: unknown[] }
    }
    expect(out.type).toBe("migrationState")
    expect(out.needed).toBe(true)
    expect(out.data.providers).toHaveLength(1)
    expect(out.data.sessions).toHaveLength(1)
    expect(t.ctx.cachedLegacyData).not.toBeNull()
  })
})

describe("handleStartLegacyMigration", () => {
  it("happy path posts legacyMigrationComplete with results, no error flag", async () => {
    const t = makeCtx()
    await handleStartLegacyMigration(t.ctx, {} as unknown as Parameters<typeof handleStartLegacyMigration>[1])
    const out = t.posted[t.posted.length - 1] as {
      type: string
      results: Array<{ status: string }>
    }
    expect(out.type).toBe("legacyMigrationComplete")
    expect(out.results.every((r) => r.status === "ok")).toBe(true)
    expect(t.ctx.lastMigrationHadErrors).toBe(false)
  })

  it("migrate() throws → single error result + lastMigrationHadErrors=true (silent-error coverage)", async () => {
    fake.migrate = async () => {
      throw new Error("disk full")
    }
    const t = makeCtx()
    await handleStartLegacyMigration(t.ctx, {} as unknown as Parameters<typeof handleStartLegacyMigration>[1])
    const out = t.posted[t.posted.length - 1] as {
      type: string
      results: Array<{ status: string; message?: string }>
    }
    expect(out.type).toBe("legacyMigrationComplete")
    expect(out.results).toHaveLength(1)
    expect(out.results[0].status).toBe("error")
    expect(out.results[0].message).toMatch(/disk full/)
    expect(t.ctx.lastMigrationHadErrors).toBe(true)
  })
})
