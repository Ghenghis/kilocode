/**
 * ThinkingVisualization — Feature 5
 *
 * Animated "thinking" panel shown while any agent is processing.
 * Shows:
 *   - Current agent name (kc-01…kc-20 or kc-main)
 *   - Current action label derived from the last tool part (Reading file /
 *     Executing bash / Analyzing…)
 *   - Elapsed time
 *   - Completed sub-steps with ✓ marks (last 5 tool calls in this session turn)
 */

import {
  Component,
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
} from "solid-js"
import { useSession } from "../../context/session"
import type { Part, ToolPart } from "../../types/messages"

// Friendly action labels keyed by tool name
const TOOL_LABELS: Record<string, string> = {
  read:          "Reading file",
  write:         "Writing file",
  edit:          "Editing file",
  bash:          "Executing bash",
  glob:          "Searching files",
  grep:          "Searching content",
  task:          "Delegating to sub-agent",
  web_search:    "Searching web",
  web_fetch:     "Fetching URL",
  todowrite:     "Updating todos",
  mcp:           "Calling MCP tool",
  computer:      "Using computer",
}

function labelForTool(toolName: string): string {
  const lower = toolName.toLowerCase()
  for (const [key, label] of Object.entries(TOOL_LABELS)) {
    if (lower.includes(key)) return label
  }
  return "Analyzing..."
}

export const ThinkingVisualization: Component = () => {
  const session = useSession()

  // ── Elapsed timer ────────────────────────────────────────────────────────
  const [elapsed, setElapsed] = createSignal(0)

  createEffect(() => {
    const since = session.busySince()
    const status = session.status()
    if (status === "idle" || !since) {
      setElapsed(0)
      return
    }
    setElapsed(Math.floor((Date.now() - since) / 1000))
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - since) / 1000))
    }, 1000)
    onCleanup(() => clearInterval(id))
  })

  const formatElapsed = () => {
    const s = elapsed()
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    return `${m}m ${s % 60}s`
  }

  // ── Derive current action from latest message parts ────────────────────
  const lastAssistantParts = createMemo<Part[]>(() => {
    const msgs = session.messages()
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === "assistant") {
        return session.getParts(msgs[i].id)
      }
    }
    return []
  })

  /** Most recent running or pending tool. */
  const currentTool = createMemo<ToolPart | undefined>(() => {
    const parts = lastAssistantParts()
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]
      if (p.type === "tool") {
        const tp = p as ToolPart
        if (tp.state?.status === "running" || tp.state?.status === "pending") return tp
      }
    }
    return undefined
  })

  const currentAction = createMemo(() => {
    const ct = currentTool()
    if (ct) return labelForTool(ct.tool)
    return session.statusText() ?? "Thinking..."
  })

  /** Last 5 completed sub-steps for the current turn. */
  const completedSteps = createMemo<Array<{ tool: string; label: string }>>(() => {
    const parts = lastAssistantParts()
    const done: Array<{ tool: string; label: string }> = []
    for (const p of parts) {
      if (p.type !== "tool") continue
      const tp = p as ToolPart
      if (tp.state?.status === "completed") {
        done.push({ tool: tp.tool, label: labelForTool(tp.tool) })
      }
    }
    return done.slice(-5)
  })

  /** Agent name: read from the last user message's agent field. */
  const agentName = createMemo(() => {
    const msgs = session.messages()
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m.role === "user" && m.agent) {
        return m.agent
      }
    }
    return "kc-main"
  })

  const isBusy = createMemo(() => session.status() !== "idle")

  // ── Animate dots ─────────────────────────────────────────────────────────
  const [dotFrame, setDotFrame] = createSignal(0)
  createEffect(() => {
    if (!isBusy()) { setDotFrame(0); return }
    const id = setInterval(() => setDotFrame((v) => (v + 1) % 4), 500)
    onCleanup(() => clearInterval(id))
  })
  const dots = () => ".".repeat(dotFrame())

  return (
    <Show when={isBusy()}>
      <div class="thinking-viz">
        {/* Agent + elapsed */}
        <div class="thinking-viz-header">
          <span class="thinking-viz-agent">{agentName()}</span>
          <span class="thinking-viz-elapsed">{formatElapsed()}</span>
        </div>

        {/* Current action with animated dots */}
        <div class="thinking-viz-action">
          <span class="thinking-viz-action-dot" />
          <span class="thinking-viz-action-text">
            {currentAction()}
            <span class="thinking-viz-dots" aria-hidden="true">{dots()}</span>
          </span>
        </div>

        {/* Completed sub-steps */}
        <Show when={completedSteps().length > 0}>
          <ul class="thinking-viz-steps">
            <For each={completedSteps()}>
              {(step) => (
                <li class="thinking-viz-step">
                  <span class="thinking-viz-step-check">✓</span>
                  <span class="thinking-viz-step-label">{step.label}</span>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </div>
    </Show>
  )
}
