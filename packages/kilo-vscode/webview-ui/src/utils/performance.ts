/**
 * Performance utilities for the KiloCode MAOS webview.
 *
 * Provides debounce, throttle, render measurement, and a deep-equality
 * derived memo helper — all without introducing new npm dependencies.
 */

// ── Debounce ──────────────────────────────────────────────────────────────────

/**
 * Returns a debounced version of `fn` that delays invocation until `ms`
 * milliseconds have elapsed since the last call.
 *
 * TypeScript's function overload ensures the returned value carries the
 * same signature as the input so callers don't need casts.
 */
export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined
  const debounced = (...args: Parameters<T>): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      fn(...args)
    }, ms)
  }
  return debounced as unknown as T
}

// ── Throttle ──────────────────────────────────────────────────────────────────

/**
 * Returns a throttled version of `fn` that fires at most once per `ms`
 * milliseconds.  The trailing call after the last invocation is also
 * scheduled so callers never miss the final value.
 */
export function throttle<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastArgs: Parameters<T> | undefined
  let lastCall = 0

  const throttled = (...args: Parameters<T>): void => {
    lastArgs = args
    const now = Date.now()
    const remaining = ms - (now - lastCall)

    if (remaining <= 0) {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
      lastCall = now
      fn(...args)
      lastArgs = undefined
    } else if (timer === undefined) {
      timer = setTimeout(() => {
        timer = undefined
        lastCall = Date.now()
        if (lastArgs) {
          fn(...lastArgs)
          lastArgs = undefined
        }
      }, remaining)
    }
  }

  return throttled as unknown as T
}

// ── Render measurement ────────────────────────────────────────────────────────

/**
 * Wraps `performance.mark` / `performance.measure` to time a component
 * render or arbitrary synchronous block.
 *
 * Usage:
 * ```ts
 * const end = measureRender("MessageList")
 * // ... render work ...
 * end()  // emits a performance measure entry
 * ```
 */
export function measureRender(name: string): () => void {
  if (typeof performance === "undefined") return () => {}
  const startMark = `${name}:start`
  const endMark = `${name}:end`
  performance.mark(startMark)
  return () => {
    performance.mark(endMark)
    try {
      performance.measure(name, startMark, endMark)
    } catch {
      // Some environments throw when marks are missing
    }
  }
}

// ── Deep-equality helpers ─────────────────────────────────────────────────────

/** Shallow-deep equality: checks object keys one level down. */
function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a === null || b === null) return false
  if (typeof a !== "object" || typeof b !== "object") return false
  const aKeys = Object.keys(a as object)
  const bKeys = Object.keys(b as object)
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    if (!Object.is((a as any)[k], (b as any)[k])) return false
  }
  return true
}

function arraysShallowEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (!shallowEqual(a[i], b[i])) return false
  }
  return true
}

// ── createDerivedMemo ─────────────────────────────────────────────────────────

/**
 * SolidJS helper that memoizes `compute()` and only re-runs it when the
 * array returned by `deps()` changes by shallow-deep-equality comparison.
 *
 * This is useful when a derived computation depends on several signals but
 * the downstream consumers should only be re-evaluated when the actual
 * *values* change, not every time a parent signal ticks (even if the
 * derived value would be the same).
 *
 * Example:
 * ```ts
 * import { createSignal } from "solid-js"
 * import { createDerivedMemo } from "../utils/performance"
 *
 * const [messages, setMessages] = createSignal<Message[]>([])
 * const [status, setStatus] = createSignal("idle")
 *
 * // Only recomputes when messages count OR status string actually change
 * const summary = createDerivedMemo(
 *   () => [messages().length, status()],
 *   () => ({ count: messages().length, busy: status() === "busy" }),
 * )
 * ```
 *
 * Note: this returns a plain memoized value, not a SolidJS signal.
 * Import `createMemo` from "solid-js" separately when you need a reactive
 * accessor — this helper is intended for cases where the computation itself
 * is expensive and deps are stable primitives.
 */
export function createDerivedMemo<T>(deps: () => unknown[], compute: () => T): () => T {
  // Lazy import to avoid a hard dependency on solid-js in non-component code.
  // At call time we're always inside a component tree, so this is safe.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createMemo } = require("solid-js") as typeof import("solid-js")

  let prevDeps: unknown[] | undefined
  let prevResult: T

  return createMemo<T>(() => {
    const nextDeps = deps()
    if (prevDeps === undefined || !arraysShallowEqual(nextDeps, prevDeps)) {
      prevDeps = nextDeps
      prevResult = compute()
    }
    return prevResult
  })
}
