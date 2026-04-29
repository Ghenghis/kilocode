/**
 * Tests for PromptInput's module-level draft storage and cleanup helpers.
 *
 * The component itself (DOM, Solid signals, vscode bridge) cannot run under
 * `bun test`, but the draft Maps and their cap/prune helpers were extracted
 * into `prompt-drafts-store.ts` precisely so they can be exercised here in
 * isolation.
 *
 * Each test resets the three module-level Maps in `beforeEach` because they
 * are real singletons — leaking entries across tests would silently mask
 * eviction bugs.
 */
import { describe, it, expect, beforeEach } from "bun:test"
import {
  __test,
  drafts,
  reviewDrafts,
  imageDrafts,
  enforceDraftCap,
  pruneDraftsForSession,
  MAX_DRAFTS,
  MAX_IMAGE_DRAFTS,
  EVICT_BATCH,
} from "../prompt-drafts-store"

const reset = () => {
  drafts.clear()
  reviewDrafts.clear()
  imageDrafts.clear()
}

beforeEach(reset)

describe("__test export shape", () => {
  it("exposes the internals tests rely on", () => {
    expect(__test.drafts).toBe(drafts)
    expect(__test.reviewDrafts).toBe(reviewDrafts)
    expect(__test.imageDrafts).toBe(imageDrafts)
    expect(__test.enforceDraftCap).toBe(enforceDraftCap)
    expect(__test.pruneDraftsForSession).toBe(pruneDraftsForSession)
    expect(__test.MAX_DRAFTS).toBe(MAX_DRAFTS)
  })
})

describe("enforceDraftCap", () => {
  it("evicts the oldest EVICT_BATCH entries when cap is exceeded by ≥1", () => {
    const map = new Map<string, number>()
    const cap = 5
    // Fill to cap + 1 so eviction triggers exactly once.
    for (let i = 0; i < cap + 1; i++) map.set(`k${i}`, i)
    expect(map.size).toBe(cap + 1)

    const removed = enforceDraftCap(map, cap)

    // EVICT_BATCH=50 but the map only has 6 entries; loop stops when it runs
    // out of keys, so it evicts min(EVICT_BATCH, size) — i.e. all of them
    // up to EVICT_BATCH. Key insight: the *oldest* keys go first.
    expect(removed).toBeGreaterThan(0)
    expect(removed).toBeLessThanOrEqual(EVICT_BATCH)
    // k0 (oldest) must be gone before k5 (newest).
    expect(map.has("k0")).toBe(false)
    if (map.size > 0) {
      // Whatever survived must be later-inserted than what was removed.
      const survivors = [...map.keys()]
      expect(survivors[survivors.length - 1]).toBe(`k${cap}`)
    }
  })

  it("is a no-op when size is at or below the cap", () => {
    const map = new Map<string, number>()
    for (let i = 0; i < 10; i++) map.set(`k${i}`, i)

    expect(enforceDraftCap(map, 10)).toBe(0)
    expect(enforceDraftCap(map, 100)).toBe(0)
    expect(map.size).toBe(10)
    // Nothing was reordered.
    expect([...map.keys()][0]).toBe("k0")
    expect([...map.keys()][9]).toBe("k9")
  })

  it("evicts exactly EVICT_BATCH entries when the overflow is large", () => {
    const map = new Map<string, number>()
    const cap = 100
    // Insert cap + 200 entries — enforceDraftCap should still remove only
    // EVICT_BATCH per call (amortized cleanup, not a hard trim).
    for (let i = 0; i < cap + 200; i++) map.set(`k${i}`, i)

    const removed = enforceDraftCap(map, cap)
    expect(removed).toBe(EVICT_BATCH)
    expect(map.size).toBe(cap + 200 - EVICT_BATCH)
    // Oldest cohort was evicted.
    expect(map.has("k0")).toBe(false)
    expect(map.has(`k${EVICT_BATCH - 1}`)).toBe(false)
    expect(map.has(`k${EVICT_BATCH}`)).toBe(true)
  })
})

describe("module-level draft caps", () => {
  it("drafts Map respects MAX_DRAFTS after cap+1 inserts with eviction", () => {
    // Simulate the saveDraft flow: set then enforceDraftCap.
    for (let i = 0; i < MAX_DRAFTS + 1; i++) {
      drafts.set(`prompt:default:session:s${i}`, `text-${i}`)
      enforceDraftCap(drafts, MAX_DRAFTS)
    }
    // After overflow + amortized eviction, size sits between MAX-EVICT_BATCH+1
    // and MAX. The important invariant is: never above MAX after eviction.
    expect(drafts.size).toBeLessThanOrEqual(MAX_DRAFTS)
    // Oldest key was evicted.
    expect(drafts.has("prompt:default:session:s0")).toBe(false)
    // Newest key survived.
    expect(drafts.has(`prompt:default:session:s${MAX_DRAFTS}`)).toBe(true)
  })

  it("imageDrafts Map respects the more aggressive MAX_IMAGE_DRAFTS=50", () => {
    // imageDrafts has the smallest cap because data URLs are heavy.
    expect(MAX_IMAGE_DRAFTS).toBe(50)

    for (let i = 0; i < MAX_IMAGE_DRAFTS + 1; i++) {
      imageDrafts.set(`prompt:default:session:img${i}`, [])
      enforceDraftCap(imageDrafts, MAX_IMAGE_DRAFTS)
    }
    expect(imageDrafts.size).toBeLessThanOrEqual(MAX_IMAGE_DRAFTS)
    expect(imageDrafts.has("prompt:default:session:img0")).toBe(false)
    expect(imageDrafts.has(`prompt:default:session:img${MAX_IMAGE_DRAFTS}`)).toBe(true)
  })
})

describe("pruneDraftsForSession", () => {
  it("removes every key containing :session:<id> across all three maps", () => {
    // Mix of keys for two boxes and three sessions plus one pending key
    // that shares the same UUID as one of the deleted sessions.
    drafts.set("prompt:default:session:abc", "for-abc")
    drafts.set("prompt:sidebar:session:abc", "for-abc-sidebar")
    drafts.set("prompt:default:session:xyz", "for-xyz")
    drafts.set("prompt:default:pending:abc", "pending-abc-different")
    reviewDrafts.set("prompt:default:session:abc", [])
    reviewDrafts.set("prompt:default:session:xyz", [])
    imageDrafts.set("prompt:default:session:abc", [])

    const removed = pruneDraftsForSession("abc")

    // 2 in drafts (default+sidebar) + 1 in reviewDrafts + 1 in imageDrafts.
    expect(removed).toBe(4)
    expect(drafts.has("prompt:default:session:abc")).toBe(false)
    expect(drafts.has("prompt:sidebar:session:abc")).toBe(false)
    expect(reviewDrafts.has("prompt:default:session:abc")).toBe(false)
    expect(imageDrafts.has("prompt:default:session:abc")).toBe(false)
    // pending:abc must NOT be touched (it's a different draft scope).
    expect(drafts.has("prompt:default:pending:abc")).toBe(true)
    // xyz must remain.
    expect(drafts.has("prompt:default:session:xyz")).toBe(true)
    expect(reviewDrafts.has("prompt:default:session:xyz")).toBe(true)
  })

  it("is a no-op when no keys match the session id", () => {
    drafts.set("prompt:default:session:keep1", "k1")
    drafts.set("prompt:default:pending:keep2", "k2")
    reviewDrafts.set("prompt:default:session:keep1", [])

    const removed = pruneDraftsForSession("nonexistent")

    expect(removed).toBe(0)
    expect(drafts.size).toBe(2)
    expect(reviewDrafts.size).toBe(1)
  })

  it("ignores empty session ids", () => {
    drafts.set("prompt:default:session:abc", "x")
    expect(pruneDraftsForSession("")).toBe(0)
    expect(drafts.size).toBe(1)
  })
})

describe("Map insertion-order semantics", () => {
  it("setting an existing key does NOT move it — value is overwritten in place", () => {
    // This documents the LRU caveat: Map.set on an existing key keeps its
    // original insertion position. saveDraft callers wanting true LRU touch
    // would need to delete-then-set; the current implementation accepts
    // FIFO eviction in exchange for simpler code.
    drafts.set("a", "v1")
    drafts.set("b", "v2")
    drafts.set("c", "v3")
    drafts.set("a", "v1-updated") // re-set existing key

    expect(drafts.get("a")).toBe("v1-updated")
    // Order is still a, b, c — not b, c, a.
    expect([...drafts.keys()]).toEqual(["a", "b", "c"])
  })
})
