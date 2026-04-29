/**
 * message-bus.ts — Shared dispatcher for VS Code webview ↔ extension messages.
 *
 * Why this exists
 * ───────────────
 * Many components historically registered their own
 * `window.addEventListener("message", handler)` in `onMount`. With ~28 settings
 * tabs (and other panels), multiple of them stayed mounted concurrently or were
 * remounted on every tab click, which produced two distinct problems:
 *
 *   1. Listener fan-out. Every webview message was dispatched N times (once per
 *      mounted listener). Combined with the extension posting many status
 *      updates per second, this turned into a per-message O(N) cost across
 *      every webview frame.
 *
 *   2. postMessage flood on mount. When a tab is opened, several components run
 *      their `onMount` and immediately post 1-3 status-request messages. With
 *      enough tabs being opened in quick succession, the extension host can be
 *      flooded with 30-80 messages instantaneously, which on slower machines
 *      contributed to VS Code becoming unresponsive ("tabs crash VS Code on
 *      cumulative click").
 *
 * What this module provides
 * ─────────────────────────
 *  - `subscribeToMessages(handler)` — single window listener, fan-out internally.
 *  - `postMessageDebounced(message, key, ms)` — coalesce repeated calls of the
 *    same `key` within `ms` milliseconds; only the last call's payload is sent.
 *  - `postMessage(message)` — pass-through wrapper around `acquireVsCodeApi()`.
 *
 * The module is intentionally context-free so it can be imported from anywhere
 * (components, hooks, plain modules) without requiring a Solid `<Provider>`.
 */

import type { ExtensionMessage, VSCodeAPI, WebviewMessage } from "../types/messages"

// ── VS Code API singleton ───────────────────────────────────────────────────

let cachedApi: VSCodeAPI | undefined

function getApi(): VSCodeAPI {
  if (cachedApi) return cachedApi
  // In a real VS Code webview, `acquireVsCodeApi` is injected globally.
  if (typeof acquireVsCodeApi === "function") {
    cachedApi = acquireVsCodeApi()
  } else {
    // Browser/dev fallback — no-op so importing this module never throws.
    cachedApi = {
      postMessage: (msg) => console.log("[message-bus] mock postMessage:", msg),
      getState: () => undefined,
      setState: () => {},
    }
  }
  return cachedApi
}

// ── Instrumentation (off by default) ────────────────────────────────────────
//
// Enable from the DevTools console with:
//
//     window.__KILO_MSG_TRACE__ = true
//
// Disable with:
//
//     window.__KILO_MSG_TRACE__ = false
//
// While enabled, every outgoing postMessage and every incoming extension
// message is logged with a high-resolution timestamp, the message `type`,
// and (for outgoing) the call site if a stack is available. The trace is
// also pushed into `window.__KILO_MSG_LOG__` (a ring buffer capped at
// 2000 entries) so a frozen webview can be inspected post-mortem by
// reading the buffer once VS Code becomes responsive again.
//
// Used by docs/FREEZE_DIAGNOSTIC.md to capture exact send/receive sequence
// while reproducing the freeze.

interface TraceEntry {
  t: number // ms since page load (performance.now)
  dir: "out" | "in"
  type: string
  payload: unknown
}

const TRACE_BUFFER_MAX = 2000
const traceBuffer: TraceEntry[] = []

declare global {
  interface Window {
    __KILO_MSG_TRACE__?: boolean
    __KILO_MSG_LOG__?: TraceEntry[]
    __KILO_MSG_LOG_CLEAR__?: () => void
    __KILO_MSG_LOG_DUMP__?: () => string
  }
}

function isTracing(): boolean {
  return typeof window !== "undefined" && window.__KILO_MSG_TRACE__ === true
}

function recordTrace(dir: "out" | "in", type: string, payload: unknown): void {
  const entry: TraceEntry = {
    t: typeof performance !== "undefined" ? performance.now() : Date.now(),
    dir,
    type,
    payload,
  }
  traceBuffer.push(entry)
  if (traceBuffer.length > TRACE_BUFFER_MAX) traceBuffer.shift()
  // Cheap-formatted console line, easy to grep in DevTools.
  // eslint-disable-next-line no-console
  console.debug(`[msg-trace ${dir.toUpperCase()} +${entry.t.toFixed(1)}ms]`, type, payload)
}

if (typeof window !== "undefined") {
  // Expose live buffer + helpers. Off-by-default flag means no traffic until
  // the user opts in from DevTools.
  window.__KILO_MSG_LOG__ = traceBuffer
  window.__KILO_MSG_LOG_CLEAR__ = () => {
    traceBuffer.length = 0
  }
  window.__KILO_MSG_LOG_DUMP__ = () => {
    return traceBuffer
      .map((e) => `${e.t.toFixed(1)}\t${e.dir}\t${e.type}`)
      .join("\n")
  }
}

// ── Subscription / fan-out ──────────────────────────────────────────────────

type MessageHandler = (message: ExtensionMessage) => void

const handlers = new Set<MessageHandler>()
let listenerInstalled = false

function ensureListenerInstalled(): void {
  if (listenerInstalled || typeof window === "undefined") return
  window.addEventListener("message", dispatchEvent)
  listenerInstalled = true
}

function dispatchEvent(event: MessageEvent): void {
  const msg = event.data as ExtensionMessage
  if (isTracing()) {
    const t = (msg as { type?: string } | undefined)?.type ?? "<no-type>"
    recordTrace("in", t, msg)
  }
  // Iterate over a snapshot so a handler that unsubscribes during dispatch
  // doesn't disturb the iteration order.
  const snapshot = Array.from(handlers)
  for (const handler of snapshot) {
    try {
      handler(msg)
    } catch (err) {
      // One bad handler must not break the others.
      console.error("[message-bus] handler threw:", err)
    }
  }
}

/**
 * Subscribe to incoming extension messages. Returns an unsubscribe function;
 * call it from `onCleanup` (or equivalent) to avoid leaks.
 *
 * Multiple subscribers share a single underlying `window.addEventListener`,
 * so adding a 6th subscriber does not 6x the per-message cost.
 */
export function subscribeToMessages(handler: MessageHandler): () => void {
  ensureListenerInstalled()
  handlers.add(handler)
  return () => {
    handlers.delete(handler)
  }
}

/** For tests only — clears all subscribers and resets the listener flag. */
export function __resetMessageBus(): void {
  if (listenerInstalled && typeof window !== "undefined") {
    window.removeEventListener("message", dispatchEvent)
  }
  handlers.clear()
  listenerInstalled = false
  pendingDebounced.clear()
}

// ── Outgoing: plain post and debounced post ─────────────────────────────────

/**
 * Pass-through `postMessage`. Equivalent to `useVSCode().postMessage(msg)`,
 * but doesn't require a Solid context so plain modules can use it.
 */
export function postMessage(message: WebviewMessage): void {
  if (isTracing()) {
    const t = (message as { type?: string } | undefined)?.type ?? "<no-type>"
    recordTrace("out", t, message)
  }
  getApi().postMessage(message)
}

interface PendingDebounced {
  timer: ReturnType<typeof setTimeout>
  message: WebviewMessage
}

const pendingDebounced = new Map<string, PendingDebounced>()

/**
 * Coalesce repeated `postMessage` calls that share the same `key` into a
 * single delivery. If `postMessageDebounced(msg, "k", 50)` is called 7 times
 * within 50ms, only one message — the LAST one — is sent after the trailing
 * 50ms quiet period.
 *
 * Use this for high-traffic mount-time status pings (e.g.
 * `requestHermesStatus`, `requestZeroClawStatus`) where dropping duplicates
 * is harmless and the user only cares about the latest payload.
 *
 * NOTE: this is intentionally trailing-edge, not leading-edge. If you need
 * the first call to fire immediately, use `postMessage` directly.
 */
export function postMessageDebounced(message: WebviewMessage, key: string, ms = 50): void {
  const existing = pendingDebounced.get(key)
  if (existing) {
    clearTimeout(existing.timer)
  }
  const timer = setTimeout(() => {
    pendingDebounced.delete(key)
    if (isTracing()) {
      const t = (message as { type?: string } | undefined)?.type ?? "<no-type>"
      recordTrace("out", `${t} [debounced:${key}]`, message)
    }
    getApi().postMessage(message)
  }, ms)
  pendingDebounced.set(key, { timer, message })
}

/**
 * Cancel a pending debounced message (if any) for the given key. Useful when
 * a component unmounts before its trailing-edge fire would have run.
 */
export function cancelDebounced(key: string): void {
  const existing = pendingDebounced.get(key)
  if (existing) {
    clearTimeout(existing.timer)
    pendingDebounced.delete(key)
  }
}
