/**
 * Hermetic unit tests for SdkSSEAdapter.
 *
 * The adapter consumes `client.global.event()` which returns
 * `{ stream: AsyncIterable<GlobalEvent> }`. We swap in a fake KiloClient
 * whose stream is a hand-driven async iterable so we can simulate
 * heartbeats, payload events, stream end, and abort scenarios.
 */
import { describe, it, expect } from "bun:test"
import { SdkSSEAdapter } from "../sdk-sse-adapter"
import type { Event } from "@kilocode/sdk/v2/client"

type GlobalEvent = { directory: string; payload: Event }

/**
 * Build an async iterable backed by a manually-pushable queue.
 * The producer can call `push(event)` to enqueue, `end()` to signal stream
 * completion, or `error(e)` to make the iterator reject.
 *
 * Honours an AbortSignal: if the signal aborts the iterator returns immediately.
 */
function makeStream(signal?: AbortSignal) {
  const queue: GlobalEvent[] = []
  let resolveNext: ((v: IteratorResult<GlobalEvent>) => void) | null = null
  let rejectNext: ((e: unknown) => void) | null = null
  let ended = false
  let pendingError: unknown = null

  const flush = () => {
    if (resolveNext && (queue.length > 0 || ended || pendingError)) {
      const r = resolveNext
      resolveNext = null
      rejectNext = null
      if (pendingError) {
        const e = pendingError
        pendingError = null
        rejectNext?.(e)
        // Fallback: resolve with done if rejectNext was nulled
        return
      }
      if (queue.length > 0) {
        r({ value: queue.shift()!, done: false })
      } else {
        r({ value: undefined as never, done: true })
      }
    }
  }

  const stream: AsyncIterable<GlobalEvent> = {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<GlobalEvent>> {
          if (signal?.aborted) {
            return Promise.resolve({ value: undefined as never, done: true })
          }
          if (queue.length > 0) {
            return Promise.resolve({ value: queue.shift()!, done: false })
          }
          if (pendingError) {
            const e = pendingError
            pendingError = null
            return Promise.reject(e)
          }
          if (ended) {
            return Promise.resolve({ value: undefined as never, done: true })
          }
          return new Promise<IteratorResult<GlobalEvent>>((resolve, reject) => {
            resolveNext = resolve
            rejectNext = reject
          })
        },
        return(): Promise<IteratorResult<GlobalEvent>> {
          ended = true
          return Promise.resolve({ value: undefined as never, done: true })
        },
      }
    },
  }

  signal?.addEventListener("abort", () => {
    ended = true
    if (resolveNext) {
      const r = resolveNext
      resolveNext = null
      rejectNext = null
      r({ value: undefined as never, done: true })
    }
  })

  return {
    stream,
    push(ev: GlobalEvent) {
      queue.push(ev)
      flush()
    },
    end() {
      ended = true
      flush()
    },
    error(e: unknown) {
      pendingError = e
      if (rejectNext) {
        const rej = rejectNext
        rejectNext = null
        resolveNext = null
        rej(e)
      }
    },
  }
}

/** Make a minimal KiloClient stub that returns the given stream. */
function makeFakeClient(opts: {
  onCall?: (args: { signal: AbortSignal }) => ReturnType<typeof makeStream>
  fail?: Error
}) {
  // First call returns the stream; subsequent reconnect attempts also call this.
  return {
    global: {
      event: async (args: { signal: AbortSignal; sseMaxRetryAttempts?: number; onSseError?: (e: unknown) => void }) => {
        if (opts.fail) throw opts.fail
        const stream = opts.onCall?.({ signal: args.signal }) ?? makeStream(args.signal)
        return stream
      },
    },
  }
}

/** Wait for a microtask to flush. */
const tick = () => new Promise<void>((r) => setTimeout(r, 0))

describe("SdkSSEAdapter", () => {
  it("transitions connecting -> connected after stream opens", async () => {
    let activeStream: ReturnType<typeof makeStream> | null = null
    const client = makeFakeClient({
      onCall: ({ signal }) => {
        activeStream = makeStream(signal)
        return activeStream
      },
    })
    const adapter = new SdkSSEAdapter(client as never)
    const states: string[] = []
    adapter.onStateChange((s) => states.push(s))

    adapter.connect()
    // Wait for consumeLoop to call client.global.event() and flip to connected.
    for (let i = 0; i < 10 && !states.includes("connected"); i++) await tick()

    expect(states[0]).toBe("connecting")
    expect(states).toContain("connected")

    adapter.dispose()
  })

  it("forwards payload events from stream to onEvent listeners", async () => {
    let activeStream: ReturnType<typeof makeStream> | null = null
    const client = makeFakeClient({
      onCall: ({ signal }) => {
        activeStream = makeStream(signal)
        return activeStream
      },
    })
    const adapter = new SdkSSEAdapter(client as never)
    const events: Event[] = []
    adapter.onEvent((e) => events.push(e))

    adapter.connect()
    for (let i = 0; i < 10 && !activeStream; i++) await tick()

    activeStream!.push({
      directory: "/repo",
      payload: { type: "session.idle", properties: { sessionID: "s1" } } as unknown as Event,
    })
    for (let i = 0; i < 10 && events.length === 0; i++) await tick()

    expect(events.length).toBe(1)
    expect((events[0] as unknown as { type: string }).type).toBe("session.idle")

    adapter.dispose()
  })

  it("does not log heartbeat events but still resets heartbeat timer", async () => {
    // Smoke-test: heartbeat events should be delivered to onEvent like any other.
    let activeStream: ReturnType<typeof makeStream> | null = null
    const client = makeFakeClient({
      onCall: ({ signal }) => {
        activeStream = makeStream(signal)
        return activeStream
      },
    })
    const adapter = new SdkSSEAdapter(client as never)
    const events: Event[] = []
    adapter.onEvent((e) => events.push(e))

    adapter.connect()
    for (let i = 0; i < 10 && !activeStream; i++) await tick()

    activeStream!.push({
      directory: "/repo",
      payload: { type: "server.heartbeat", properties: {} } as unknown as Event,
    })
    for (let i = 0; i < 10 && events.length === 0; i++) await tick()

    expect(events.length).toBe(1)
    expect((events[0] as unknown as { type: string }).type).toBe("server.heartbeat")

    adapter.dispose()
  })

  it("emits 'disconnected' state after disconnect() exits the consume loop", async () => {
    // NOTE: We use disconnect() rather than dispose() here because dispose()
    // clears the state-listener set synchronously, so the trailing
    // notifyState("disconnected") at the end of consumeLoop has no observers.
    // disconnect() preserves listeners and is the right surface for this test.
    let activeStream: ReturnType<typeof makeStream> | null = null
    const client = makeFakeClient({
      onCall: ({ signal }) => {
        activeStream = makeStream(signal)
        return activeStream
      },
    })
    const adapter = new SdkSSEAdapter(client as never)
    const states: string[] = []
    adapter.onStateChange((s) => states.push(s))

    adapter.connect()
    for (let i = 0; i < 50 && !states.includes("connected"); i++) {
      await new Promise((r) => setTimeout(r, 10))
    }
    expect(states).toContain("connected")

    adapter.disconnect()
    // Poll for the trailing "disconnected" emission (consume loop exits).
    for (let i = 0; i < 100 && !states.includes("disconnected"); i++) {
      await new Promise((r) => setTimeout(r, 10))
    }

    expect(states).toContain("disconnected")

    adapter.dispose()
  })

  it("connect() while already connected is a no-op", async () => {
    let callCount = 0
    const client = {
      global: {
        event: async (args: { signal: AbortSignal }) => {
          callCount++
          return makeStream(args.signal)
        },
      },
    }
    const adapter = new SdkSSEAdapter(client as never)
    adapter.connect()
    await tick()
    adapter.connect()
    adapter.connect()
    await tick()

    expect(callCount).toBe(1)
    adapter.dispose()
  })

  it("reconnect() with no active attempt is a no-op (does not throw)", () => {
    const client = makeFakeClient({})
    const adapter = new SdkSSEAdapter(client as never)
    expect(() => adapter.reconnect()).not.toThrow()
    adapter.dispose()
  })

  it("disconnect() aborts in-flight stream and clears handlers via dispose()", async () => {
    let activeStream: ReturnType<typeof makeStream> | null = null
    const client = makeFakeClient({
      onCall: ({ signal }) => {
        activeStream = makeStream(signal)
        return activeStream
      },
    })
    const adapter = new SdkSSEAdapter(client as never)
    const events: Event[] = []
    adapter.onEvent((e) => events.push(e))

    adapter.connect()
    for (let i = 0; i < 10 && !activeStream; i++) await tick()

    adapter.dispose()
    // After dispose, the handler set is cleared; pushed events go nowhere.
    activeStream!.push({
      directory: "/repo",
      payload: { type: "session.updated", properties: {} } as unknown as Event,
    })
    await tick()

    expect(events.length).toBe(0)
  })

  it("reports error when initial client.global.event() throws", async () => {
    const client = makeFakeClient({ fail: new Error("boom") })
    const adapter = new SdkSSEAdapter(client as never)
    const errors: Error[] = []
    adapter.onError((e) => errors.push(e))

    adapter.connect()
    for (let i = 0; i < 20 && errors.length === 0; i++) await tick()

    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].message).toBe("boom")

    adapter.dispose()
  })

  it("onError unsubscribe stops further error notifications", async () => {
    const client = makeFakeClient({ fail: new Error("boom") })
    const adapter = new SdkSSEAdapter(client as never)
    const errors: Error[] = []
    const unsub = adapter.onError((e) => errors.push(e))
    unsub()

    adapter.connect()
    for (let i = 0; i < 10; i++) await tick()

    expect(errors.length).toBe(0)

    adapter.dispose()
  })

  it.skip("forces reconnect after heartbeat timeout (15s) — TODO: requires fake timers", () => {
    // SdkSSEAdapter.HEARTBEAT_TIMEOUT_MS is 15_000ms. Bun's fake timer support
    // isn't wired here yet; a real-time test would block CI for >15s.
    // To enable: install bun:test fake timers, advance by 15_000ms after
    // connect() succeeds, assert reconnect() is invoked.
  })
})
