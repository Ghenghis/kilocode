/**
 * ToastSystem — centralized toast notification system for KiloCode webview.
 *
 * Provides:
 *  - ToastProvider: context wrapper (wire around the full app)
 *  - useToast(): hook returning { show, dismiss, dismissAll }
 *
 * Toast options:
 *  - message:   string
 *  - type:      "info" | "success" | "warning" | "error"
 *  - duration?: number (ms, default 4000; error toasts never auto-dismiss)
 *  - action?:   { label: string; onClick: () => void } — e.g. "Undo"
 *
 * Visual behaviour:
 *  - Slides in from bottom-right
 *  - Stacks up to MAX_VISIBLE (4); older ones shrink away behind
 *  - Progress bar shows time remaining for auto-dismissing toasts
 *  - Error toasts stay until the user clicks ×
 *  - Full CSS-transition-based animation — no external deps
 */

import {
  Component,
  createContext,
  createSignal,
  For,
  JSX,
  onCleanup,
  Show,
  useContext,
} from "solid-js"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ToastType = "info" | "success" | "warning" | "error"

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastOptions {
  message: string
  type: ToastType
  duration?: number    // ms; default 4000; error → no auto-dismiss
  action?: ToastAction
}

interface ToastEntry extends ToastOptions {
  id: string
  /** Whether this toast is in the "leaving" CSS phase */
  leaving: boolean
  /** Timestamp when the toast was shown (for progress bar) */
  shownAt: number
  /** Resolved duration in ms (Infinity for error toasts) */
  resolvedDuration: number
}

interface ToastContextValue {
  show: (opts: ToastOptions) => string
  dismiss: (id: string) => void
  dismissAll: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_DURATION = 4000
const LEAVE_ANIMATION_MS = 320
const MAX_VISIBLE = 4

let _idCounter = 0
function nextId(): string {
  return `toast-${++_idCounter}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>()

// ─────────────────────────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────────────────────────

const ICONS: Record<ToastType, string> = {
  success: "✓",
  info:    "ℹ",
  warning: "⚠",
  error:   "✗",
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress bar sub-component
// ─────────────────────────────────────────────────────────────────────────────

const ToastProgress: Component<{ duration: number; shownAt: number }> = (props) => {
  // We animate via a CSS transition on width from 100% → 0%
  // by setting the transition duration to `props.duration`ms and width to 0
  // after mount (next frame).
  let barRef: HTMLDivElement | undefined

  // One-shot rAF to trigger the CSS transition
  const raf = requestAnimationFrame(() => {
    if (barRef) {
      barRef.style.transition = `width ${props.duration}ms linear`
      barRef.style.width = "0%"
    }
  })
  onCleanup(() => cancelAnimationFrame(raf))

  return (
    <div class="kc-toast-progress-track">
      <div
        ref={barRef}
        class="kc-toast-progress-bar"
        style={{ width: "100%" }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Single toast item
// ─────────────────────────────────────────────────────────────────────────────

const ToastItem: Component<{ toast: ToastEntry; onDismiss: (id: string) => void }> = (props) => {
  const t = () => props.toast

  const handleAction = () => {
    t().action?.onClick()
    props.onDismiss(t().id)
  }

  return (
    <div
      class={`kc-toast kc-toast--${t().type}`}
      classList={{ "kc-toast--leaving": t().leaving }}
      role="alert"
      aria-live={t().type === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {/* Icon */}
      <span class="kc-toast-icon" aria-hidden="true">
        {ICONS[t().type]}
      </span>

      {/* Message */}
      <span class="kc-toast-message">{t().message}</span>

      {/* Optional action */}
      <Show when={t().action}>
        {(action) => (
          <button
            class="kc-toast-action"
            onClick={handleAction}
            type="button"
          >
            {action().label}
          </button>
        )}
      </Show>

      {/* Close button */}
      <button
        class="kc-toast-close"
        onClick={() => props.onDismiss(t().id)}
        type="button"
        aria-label="Dismiss notification"
        title="Dismiss"
      >
        ×
      </button>

      {/* Progress bar — only for auto-dismissing toasts */}
      <Show when={t().resolvedDuration !== Infinity}>
        <ToastProgress
          duration={t().resolvedDuration}
          shownAt={t().shownAt}
        />
      </Show>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ToastProvider
// ─────────────────────────────────────────────────────────────────────────────

export const ToastProvider: Component<{ children: JSX.Element }> = (props) => {
  const [toasts, setToasts] = createSignal<ToastEntry[]>([])
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  function removeFromState(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  function startLeaveAnimation(id: string) {
    // Flip the 'leaving' flag so CSS slide-out plays
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
    // Remove from state after animation completes
    const raf = setTimeout(() => removeFromState(id), LEAVE_ANIMATION_MS)
    onCleanup(() => clearTimeout(raf))
  }

  const dismiss = (id: string) => {
    const t = timers.get(id)
    if (t !== undefined) {
      clearTimeout(t)
      timers.delete(id)
    }
    startLeaveAnimation(id)
  }

  const dismissAll = () => {
    for (const id of timers.keys()) clearTimeout(timers.get(id)!)
    timers.clear()
    // Mark all as leaving
    setToasts((prev) => prev.map((t) => ({ ...t, leaving: true })))
    setTimeout(() => setToasts([]), LEAVE_ANIMATION_MS)
  }

  const show = (opts: ToastOptions): string => {
    const id = nextId()
    const resolvedDuration =
      opts.type === "error" ? Infinity : (opts.duration ?? DEFAULT_DURATION)

    const entry: ToastEntry = {
      ...opts,
      id,
      leaving: false,
      shownAt: Date.now(),
      resolvedDuration,
    }

    setToasts((prev) => {
      // Enforce MAX_VISIBLE: if we'd exceed it, evict the oldest non-leaving
      const active = prev.filter((t) => !t.leaving)
      if (active.length >= MAX_VISIBLE) {
        const oldest = active[0]
        dismiss(oldest.id)
        // Return trimmed list + new entry
        return [...prev.filter((t) => t.id !== oldest.id), entry]
      }
      return [...prev, entry]
    })

    if (resolvedDuration !== Infinity) {
      const timer = setTimeout(() => dismiss(id), resolvedDuration)
      timers.set(id, timer)
    }

    return id
  }

  onCleanup(() => {
    for (const t of timers.values()) clearTimeout(t)
    timers.clear()
  })

  // Visible toasts (most recent MAX_VISIBLE, non-leaving on top of leaving)
  const visibleToasts = () => {
    const all = toasts()
    return all.slice(-MAX_VISIBLE)
  }

  const ctx: ToastContextValue = { show, dismiss, dismissAll }

  return (
    <ToastContext.Provider value={ctx}>
      {props.children}

      {/* Toast region — bottom-right, stacking upward */}
      <div
        class="kc-toast-region"
        aria-label="Notifications"
        aria-live="polite"
        aria-relevant="additions"
      >
        <For each={visibleToasts()}>
          {(toast) => <ToastItem toast={toast} onDismiss={dismiss} />}
        </For>
      </div>
    </ToastContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// useToast hook
// ─────────────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider>")
  }
  return ctx
}
