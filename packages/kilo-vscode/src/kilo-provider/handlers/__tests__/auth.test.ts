/**
 * Tests for auth.ts (login / logout / set-organization handlers).
 *
 * Coverage focus:
 *   1. handleLogin happy path → posts deviceAuthStarted, profileData, deviceAuthComplete
 *   2. handleLogin attempt-cancellation race (line 58/69) — stale attempt suppresses output
 *   3. handleLogin failure → posts deviceAuthFailed
 *   4. handleSetOrganization happy path cascades to profile + providers + agents
 *   5. handleSetOrganization profile error in cascade does NOT swallow agents/providers refresh
 *
 * Test runner: bun:test (project default).
 */

import { describe, expect, it } from "bun:test"
import { handleLogin, handleSetOrganization, type AuthContext } from "../auth"

// ─── Fake KiloClient ─────────────────────────────────────────────────────

interface OauthAuthorizeArgs {
  providerID: string
  method: number
  directory: string
}

interface FakeClientOptions {
  authorize?: () => Promise<{ data: { url: string; instructions?: string } }>
  callback?: () => Promise<{ data: unknown }>
  profile?: () => Promise<{ data: unknown }>
  organizationSet?: () => Promise<{ data: unknown }>
}

function makeClient(opts: FakeClientOptions = {}) {
  const calls = {
    authorize: 0,
    callback: 0,
    profile: 0,
    organizationSet: 0,
  }
  const client = {
    provider: {
      oauth: {
        authorize: async (_a: OauthAuthorizeArgs, _o: { throwOnError: true }) => {
          calls.authorize++
          if (opts.authorize) return opts.authorize()
          return {
            data: {
              url: "https://kilo.test/auth",
              instructions: "Open URL and enter code: ABCD-1234",
            },
          }
        },
        callback: async (_a: OauthAuthorizeArgs, _o: { throwOnError: true }) => {
          calls.callback++
          if (opts.callback) return opts.callback()
          return { data: {} }
        },
      },
    },
    kilo: {
      profile: async (_a?: undefined, _o?: { throwOnError: true }) => {
        calls.profile++
        if (opts.profile) return opts.profile()
        return { data: { id: "user-1", name: "Test" } }
      },
      organization: {
        set: async (_a: { organizationId: string | null }, _o: { throwOnError: true }) => {
          calls.organizationSet++
          if (opts.organizationSet) return opts.organizationSet()
          return { data: {} }
        },
      },
    },
    auth: {
      remove: async () => ({ data: {} }),
    },
  }
  return { client, calls }
}

function makeCtx(client: ReturnType<typeof makeClient>["client"] | null = null): {
  ctx: AuthContext
  posted: unknown[]
  hits: { dispose: number; providers: number; agents: number }
} {
  const posted: unknown[] = []
  const hits = { dispose: 0, providers: 0, agents: 0 }
  return {
    posted,
    hits,
    ctx: {
      client: client as unknown as AuthContext["client"],
      postMessage: (m: unknown) => posted.push(m),
      getWorkspaceDirectory: () => "/repo",
      disposeGlobal: async () => {
        hits.dispose++
      },
      fetchAndSendProviders: async () => {
        hits.providers++
      },
      fetchAndSendAgents: async () => {
        hits.agents++
      },
    },
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe("handleLogin", () => {
  it("happy path posts deviceAuthStarted, profileData, then deviceAuthComplete", async () => {
    const { client } = makeClient()
    const t = makeCtx(client)
    await handleLogin(t.ctx, 1, () => 1)
    const types = t.posted.map((m) => (m as { type: string }).type)
    expect(types).toEqual(["deviceAuthStarted", "profileData", "deviceAuthComplete"])
    const start = t.posted[0] as { code: string; verificationUrl: string; expiresIn: number }
    expect(start.code).toBe("ABCD-1234")
    expect(start.verificationUrl).toBe("https://kilo.test/auth")
    expect(start.expiresIn).toBe(900)
    expect(t.hits.dispose).toBe(1)
  })

  it("returns early without double-issuing device auth when attempt is stale (line 58 race)", async () => {
    // Simulates a duplicate concurrent handleLogin: the SECOND call's attempt
    // value will not match getAttempt() at the post-callback check, so its
    // success path is suppressed. We model this by making getAttempt return a
    // newer value than the attempt this call was started with.
    const { client, calls } = makeClient()
    const t = makeCtx(client)
    // attempt=1 was started, but getAttempt now returns 2 (cancelled by newer login)
    await handleLogin(t.ctx, 1, () => 2)
    const types = t.posted.map((m) => (m as { type: string }).type)
    // deviceAuthStarted is sent BEFORE the cancellation check; profile/complete are NOT.
    expect(types).toEqual(["deviceAuthStarted"])
    // dispose / profile fetch must NOT have run on the stale attempt
    expect(t.hits.dispose).toBe(0)
    expect(calls.profile).toBe(0)
  })

  it("failure during authorize posts deviceAuthFailed (and not Complete)", async () => {
    const { client } = makeClient({
      authorize: async () => {
        throw new Error("network down")
      },
    })
    const t = makeCtx(client)
    await handleLogin(t.ctx, 1, () => 1)
    const types = t.posted.map((m) => (m as { type: string }).type)
    expect(types).toEqual(["deviceAuthFailed"])
    const failed = t.posted[0] as { error: string }
    expect(failed.error).toMatch(/network down/)
  })

  it("returns silently when client is null", async () => {
    const t = makeCtx(null)
    await handleLogin(t.ctx, 1, () => 1)
    expect(t.posted).toHaveLength(0)
  })
})

describe("handleSetOrganization", () => {
  it("happy path cascades: dispose + profile + providers + agents (no error swallow gaps)", async () => {
    const { client, calls } = makeClient()
    const t = makeCtx(client)
    await handleSetOrganization(t.ctx, "org-42")
    expect(calls.organizationSet).toBe(1)
    expect(t.hits.dispose).toBe(1)
    expect(calls.profile).toBe(1)
    expect(t.hits.providers).toBe(1)
    expect(t.hits.agents).toBe(1)
    const types = t.posted.map((m) => (m as { type: string }).type)
    expect(types).toContain("profileData")
  })

  it("profile-fetch failure inside the success cascade does NOT block providers/agents refresh", async () => {
    let profileCalls = 0
    const { client } = makeClient({
      profile: async () => {
        profileCalls++
        throw new Error("profile temporarily down")
      },
    })
    const t = makeCtx(client)
    await handleSetOrganization(t.ctx, "org-42")
    // profile threw, but the cascade is wrapped per-step in try/catch, so:
    expect(t.hits.providers).toBe(1)
    expect(t.hits.agents).toBe(1)
    expect(profileCalls).toBeGreaterThan(0)
  })

  it("organization.set failure short-circuits and re-fetches profile (no providers/agents)", async () => {
    const { client } = makeClient({
      organizationSet: async () => {
        throw new Error("forbidden")
      },
    })
    const t = makeCtx(client)
    await handleSetOrganization(t.ctx, "org-42")
    // After org.set throws, the handler tries a best-effort profile re-fetch
    // and then returns BEFORE running providers/agents refresh.
    expect(t.hits.providers).toBe(0)
    expect(t.hits.agents).toBe(0)
  })
})
