/**
 * TaskProgressEstimator — live ETA and step-remaining display for running tasks.
 *
 * Algorithm:
 *   1. Count completed steps in the current session (StepFinishPart count).
 *   2. Estimate total steps via a simple complexity heuristic:
 *      - Base = max(5, completedSteps * 1.3)  (assume ~30% more to go)
 *      - Clamped to [completedSteps+1, 60]
 *   3. "Estimated time remaining" = (stepsRemaining * avgSecsPerStep)
 *      where avgSecsPerStep is derived from elapsed time / completedSteps.
 *   4. Shows "~N steps remaining · ~Xm Ys left" while busy.
 *   5. Shows "Completed in Xm Ys" when the session goes idle.
 *
 * No network calls or historical DB — purely local reactive derivation.
 */

import { Component, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { useSession } from "../../context/session"
import type { Part } from "../../types/messages"

// ── Helpers ───────────────────────────────────────────────────────────

function countSteps(parts: Record<string, Part[]>): number {
  let n = 0
  for (const ps of Object.values(parts)) {
    for (const p of ps) {
      if (p.type === "step-finish") n++
    }
  }
  return n
}

function formatDuration(seconds: number): string {
  if (seconds < 5) return "< 5s"
  if (seconds < 60) return `~${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return s === 0 ? `~${m}m` : `~${m}m ${s}s`
}

// ── Component ─────────────────────────────────────────────────────────

export const TaskProgressEstimator: Component = () => {
  const session = useSession()

  const [elapsed, setElapsed] = createSignal(0)

  // Keep elapsed counter ticking while busy
  createEffect(() => {
    const since = session.busySince()
    const status = session.status()
    if (status !== "busy" || !since) {
      setElapsed(0)
      return
    }
    setElapsed(Math.floor((Date.now() - since) / 1000))
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - since) / 1000)), 1000)
    onCleanup(() => clearInterval(id))
  })

  const allParts = createMemo(() => {
    const msgs = session.messages()
    const result: Record<string, Part[]> = {}
    for (const m of msgs) {
      const p = session.getParts(m.id)
      if (p.length > 0) result[m.id] = p
    }
    return result
  })

  const completed = createMemo(() => countSteps(allParts()))

  // Estimate total steps
  const estimatedTotal = createMemo(() => {
    const c = completed()
    if (c === 0) return 8 // default cold start estimate
    const rough = Math.ceil(c * 1.35)
    return Math.min(Math.max(c + 1, rough), 80)
  })

  const remaining = createMemo(() => Math.max(0, estimatedTotal() - completed()))

  // Average seconds per step
  const avgSecsPerStep = createMemo(() => {
    const c = completed()
    const e = elapsed()
    if (c < 2 || e < 1) return 12 // fallback default
    return e / c
  })

  const etaSecs = createMemo(() => remaining() * avgSecsPerStep())

  const busy = () => session.status() === "busy"

  // Track last completed duration for "Completed in Xs" display
  const [lastDuration, setLastDuration] = createSignal<number | undefined>(undefined)
  createEffect(() => {
    if (session.status() === "idle" && elapsed() > 0) {
      setLastDuration(elapsed())
    }
    if (session.status() === "busy") {
      setLastDuration(undefined)
    }
  })

  return (
    <Show when={busy() || lastDuration() !== undefined}>
      <div class="tpe-root">
        <Show when={busy()}>
          <span class="tpe-steps">
            {completed() > 0 ? (
              <>
                <span class="tpe-completed">{completed()}</span>
                <span class="tpe-sep"> / ~</span>
                <span class="tpe-total">{estimatedTotal()}</span>
                <span class="tpe-label"> steps</span>
              </>
            ) : (
              <span class="tpe-label">Starting...</span>
            )}
          </span>
          <Show when={remaining() > 0 && completed() > 1}>
            <span class="tpe-sep">·</span>
            <span class="tpe-eta">{formatDuration(etaSecs())} left</span>
          </Show>
        </Show>
        <Show when={!busy() && lastDuration() !== undefined}>
          <span class="tpe-done">Completed in {formatDuration(lastDuration()!)}</span>
        </Show>
      </div>
    </Show>
  )
}
