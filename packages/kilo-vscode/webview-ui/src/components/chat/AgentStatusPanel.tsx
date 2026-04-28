/**
 * AgentStatusPanel — collapsible live panel showing all 21 MAOS agents.
 *
 * Each row shows:
 *   - Status indicator: idle / active (animated spinner) / queued / error
 *   - Agent display name and color swatch
 *   - Current task description (from the latest SubtaskPart or ToolPart)
 *   - Steps completed count
 *   - Last active time (relative)
 *   - Queue depth (pending tool calls)
 *
 * Active agents float to the top. Clicking an agent row scrolls/highlights
 * that agent's contribution in the message list via a custom DOM event.
 *
 * Data is derived from session messages and parts — no new IPC needed.
 */

import { Component, For, Show, createMemo, createSignal } from "solid-js"
import { Icon } from "@kilocode/kilo-ui/icon"
import { Spinner } from "@kilocode/kilo-ui/spinner"
import { Tooltip } from "@kilocode/kilo-ui/tooltip"
import { useSession } from "../../context/session"
import type { Message, Part, ToolPart } from "../../types/messages"

// ── Static MAOS agent registry ───────────────────────────────────────

export interface MAOSAgent {
  id: string
  name: string
  color: string
}

export const MAOS_AGENTS: MAOSAgent[] = [
  { id: "kc-main", name: "Orchestrator", color: "#9B59B6" },
  { id: "kc-01", name: "Integration Lead", color: "#FF6B6B" },
  { id: "kc-02", name: "Creative Brainstormer", color: "#4ECDC4" },
  { id: "kc-03", name: "System Architect", color: "#45B7D1" },
  { id: "kc-04", name: "Bug Triage Specialist", color: "#96CEB4" },
  { id: "kc-05", name: "Root Cause Analyst", color: "#FFEAA7" },
  { id: "kc-06", name: "Code Generator", color: "#DDA0DD" },
  { id: "kc-07", name: "Code Reviewer", color: "#FFB6C1" },
  { id: "kc-08", name: "Test Writer", color: "#98D8C8" },
  { id: "kc-09", name: "Debugger", color: "#F7DC6F" },
  { id: "kc-10", name: "Refactorer", color: "#BB8FCE" },
  { id: "kc-11", name: "Documenter", color: "#85C1E2" },
  { id: "kc-12", name: "Security Auditor", color: "#E74C3C" },
  { id: "kc-13", name: "Performance Analyst", color: "#F39C12" },
  { id: "kc-14", name: "API Integrator", color: "#16A085" },
  { id: "kc-15", name: "Database Specialist", color: "#8E44AD" },
  { id: "kc-16", name: "DevOps Engineer", color: "#27AE60" },
  { id: "kc-17", name: "Frontend Specialist", color: "#E67E22" },
  { id: "kc-18", name: "Backend Specialist", color: "#2C3E50" },
  { id: "kc-19", name: "Research Analyst", color: "#34495E" },
  { id: "kc-20", name: "Prompt Engineer", color: "#9B59B6" },
]

// Build a lookup: canonical name → MAOSAgent (case-insensitive)
const AGENT_BY_NAME = new Map<string, MAOSAgent>(
  MAOS_AGENTS.map((a) => [a.name.toLowerCase(), a]),
)

export function resolveAgentByName(agentName: string | undefined): MAOSAgent | undefined {
  if (!agentName) return undefined
  const key = agentName.toLowerCase()
  // Try exact
  const exact = AGENT_BY_NAME.get(key)
  if (exact) return exact
  // Try partial match
  for (const [k, v] of AGENT_BY_NAME) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return undefined
}

// ── Per-agent runtime status ─────────────────────────────────────────

export type AgentStatus = "idle" | "active" | "queued" | "error"

export interface AgentRuntime {
  agent: MAOSAgent
  status: AgentStatus
  taskDescription: string
  stepsCompleted: number
  queueDepth: number
  lastActiveMs: number | undefined
  /** MessageID of the last message from this agent — used for jump-to */
  lastMessageID: string | undefined
  /** Recent tool call names */
  recentTools: string[]
}

// ── Derive runtime data from messages ────────────────────────────────

function deriveAgentRuntimes(
  messages: Message[],
  parts: Record<string, Part[]>,
  busyAgentName: string | undefined,
): AgentRuntime[] {
  // Accumulate stats per agent id
  const stats = new Map<
    string,
    {
      stepsCompleted: number
      queueDepth: number
      lastActiveMs: number | undefined
      taskDescription: string
      lastMessageID: string | undefined
      recentTools: string[]
      hasError: boolean
    }
  >()

  for (const msg of messages) {
    if (msg.role !== "assistant") continue
    const agentKey = msg.agent?.trim().toLowerCase() ?? ""
    const resolved = resolveAgentByName(agentKey)
    const id = resolved?.id ?? "kc-main"

    let entry = stats.get(id)
    if (!entry) {
      entry = {
        stepsCompleted: 0,
        queueDepth: 0,
        lastActiveMs: undefined,
        taskDescription: "",
        lastMessageID: undefined,
        recentTools: [],
        hasError: false,
      }
      stats.set(id, entry)
    }

    entry.lastMessageID = msg.id

    const msgTime = msg.time?.completed ?? msg.time?.created
    if (msgTime && (!entry.lastActiveMs || msgTime > entry.lastActiveMs)) {
      entry.lastActiveMs = msgTime
    }

    // Count steps and collect tool names from parts
    const ps = parts[msg.id] ?? []
    for (const p of ps) {
      if (p.type === "step-finish") {
        entry.stepsCompleted++
      }
      if (p.type === "tool") {
        const tp = p as ToolPart
        if (tp.state.status === "error") entry.hasError = true
        if (tp.state.status === "pending" || tp.state.status === "running") entry.queueDepth++
        const toolName = tp.tool
        if (!entry.recentTools.includes(toolName)) {
          entry.recentTools = [toolName, ...entry.recentTools].slice(0, 5)
        }
      }
      if (p.type === "text") {
        const textP = p as { type: "text"; text: string }
        if (textP.text && textP.text.length > 4 && !entry.taskDescription) {
          entry.taskDescription = textP.text.slice(0, 80)
        }
      }
    }

    // Also extract subtask descriptions
    for (const p of ps) {
      if (p.type === "tool") {
        const tp = p as ToolPart & { state: { input?: { description?: string } } }
        if (tp.tool === "task" && tp.state.input?.description) {
          entry.taskDescription = String(tp.state.input.description).slice(0, 80)
        }
      }
    }
  }

  // Build result list, starting with known MAOS agents
  const result: AgentRuntime[] = MAOS_AGENTS.map((agent) => {
    const s = stats.get(agent.id)
    const isActive =
      busyAgentName !== undefined &&
      (resolveAgentByName(busyAgentName)?.id === agent.id ||
        (agent.id === "kc-main" && !resolveAgentByName(busyAgentName)))

    let status: AgentStatus = "idle"
    if (isActive) status = "active"
    else if (s?.hasError) status = "error"
    else if (s && s.queueDepth > 0) status = "queued"

    return {
      agent,
      status,
      taskDescription: s?.taskDescription ?? "",
      stepsCompleted: s?.stepsCompleted ?? 0,
      queueDepth: s?.queueDepth ?? 0,
      lastActiveMs: s?.lastActiveMs,
      lastMessageID: s?.lastMessageID,
      recentTools: s?.recentTools ?? [],
    }
  })

  // Sort: active first, then queued, then those with history, then idle
  return result.sort((a, b) => {
    const rank = (r: AgentRuntime) => {
      if (r.status === "active") return 0
      if (r.status === "error") return 1
      if (r.status === "queued") return 2
      if (r.stepsCompleted > 0 || r.taskDescription) return 3
      return 4
    }
    return rank(a) - rank(b)
  })
}

// ── Relative time helper ──────────────────────────────────────────────

function relativeTime(ms: number | undefined): string {
  if (!ms) return ""
  const diff = Date.now() - ms
  if (diff < 5000) return "just now"
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`
  return `${Math.round(diff / 3_600_000)}h ago`
}

// ── Sub-component: expanded tool call list ───────────────────────────

const AgentToolList: Component<{ tools: string[] }> = (props) => (
  <div class="asp-tool-list">
    <For each={props.tools}>{(t) => <span class="asp-tool-chip">{t}</span>}</For>
  </div>
)

// ── Sub-component: single agent row ──────────────────────────────────

const AgentRow: Component<{ runtime: AgentRuntime }> = (props) => {
  const [open, setOpen] = createSignal(false)

  const handleClick = () => {
    setOpen((v) => !v)
    const mid = props.runtime.lastMessageID
    if (mid) {
      window.dispatchEvent(new CustomEvent("jumpToMessage", { detail: { messageID: mid } }))
    }
  }

  const rowAriaLabel = () => {
    const { agent, status, taskDescription } = props.runtime
    const statusText = status === "active" ? "active"
      : status === "queued" ? "queued"
      : status === "error" ? "error"
      : "idle"
    const taskPart = taskDescription ? `, running: ${taskDescription}` : ""
    return `Agent ${agent.id}: ${statusText}, ${agent.name}${taskPart}`
  }

  return (
    <div
      class="asp-row"
      classList={{
        "asp-row--active": props.runtime.status === "active",
        "asp-row--error": props.runtime.status === "error",
        "asp-row--idle": props.runtime.status === "idle" && !props.runtime.stepsCompleted,
      }}
      role="listitem"
    >
      <button
        class="asp-row-header"
        onClick={handleClick}
        aria-expanded={open()}
        aria-label={rowAriaLabel()}
      >
        {/* Status indicator */}
        <span class="asp-status-indicator">
          {props.runtime.status === "active" ? (
            <span role="status" aria-label="Processing">
              <Spinner class="asp-spinner" />
            </span>
          ) : (
            <span
              class="asp-status-dot"
              classList={{
                "asp-status-dot--idle": props.runtime.status === "idle",
                "asp-status-dot--queued": props.runtime.status === "queued",
                "asp-status-dot--error": props.runtime.status === "error",
              }}
              aria-hidden="true"
            />
          )}
        </span>

        {/* Color swatch + name */}
        <span class="asp-color-swatch" style={{ background: props.runtime.agent.color }} aria-hidden="true" />
        <span class="asp-agent-name">{props.runtime.agent.name}</span>

        {/* Task description */}
        <Show when={props.runtime.taskDescription}>
          <span class="asp-task-desc">{props.runtime.taskDescription}</span>
        </Show>

        {/* Steps */}
        <Show when={props.runtime.stepsCompleted > 0}>
          <Tooltip value="Steps completed" placement="top">
            <span class="asp-badge" aria-label={`${props.runtime.stepsCompleted} steps completed`}>
              {props.runtime.stepsCompleted}
            </span>
          </Tooltip>
        </Show>

        {/* Queue depth */}
        <Show when={props.runtime.queueDepth > 0}>
          <Tooltip value="Pending tool calls" placement="top">
            <span class="asp-badge asp-badge--queue" aria-label={`${props.runtime.queueDepth} pending tool calls`}>
              {props.runtime.queueDepth}
            </span>
          </Tooltip>
        </Show>

        {/* Last active */}
        <Show when={props.runtime.lastActiveMs}>
          <span class="asp-last-active" aria-label={`Last active ${relativeTime(props.runtime.lastActiveMs)}`}>
            {relativeTime(props.runtime.lastActiveMs)}
          </span>
        </Show>

        {/* Expand chevron (only if has recent tools) */}
        <Show when={props.runtime.recentTools.length > 0}>
          <Icon
            name="chevron-down"
            size="small"
            style={open() ? { transform: "rotate(180deg)" } : undefined}
            aria-hidden="true"
          />
        </Show>
      </button>

      {/* Expanded: recent tool calls */}
      <Show when={open() && props.runtime.recentTools.length > 0}>
        <div class="asp-row-detail">
          <span class="asp-row-detail-label">Recent tools:</span>
          <AgentToolList tools={props.runtime.recentTools} />
        </div>
      </Show>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────

interface AgentStatusPanelProps {
  collapsed?: boolean
  onToggle?: () => void
}

export const AgentStatusPanel: Component<AgentStatusPanelProps> = (props) => {
  const session = useSession()

  const messages = () => session.messages()

  const allParts = createMemo(() => {
    const msgs = messages()
    const result: Record<string, Part[]> = {}
    for (const m of msgs) {
      const p = session.getParts(m.id)
      if (p.length > 0) result[m.id] = p
    }
    return result
  })

  // Derive the currently active agent name from the busy session's latest message
  const busyAgentName = createMemo(() => {
    if (session.status() !== "busy") return undefined
    const msgs = messages()
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m.role === "assistant" && m.agent) return m.agent
    }
    return undefined
  })

  const runtimes = createMemo(() => deriveAgentRuntimes(messages(), allParts(), busyAgentName()))

  const activeCount = createMemo(() => runtimes().filter((r) => r.status === "active").length)
  const usedCount = createMemo(() => runtimes().filter((r) => r.stepsCompleted > 0 || r.taskDescription).length)

  return (
    <div class="asp-panel" classList={{ "asp-panel--collapsed": props.collapsed }}>
      {/* Panel header */}
      <button
        class="asp-panel-header"
        onClick={props.onToggle}
        aria-expanded={!props.collapsed}
        aria-label={`Agent Status panel — ${!props.collapsed ? "collapse" : "expand"}`}
        aria-controls="asp-agent-list"
      >
        <Icon name="robot" size="small" aria-hidden="true" />
        <span class="asp-panel-title">Agent Status</span>
        <Show when={activeCount() > 0}>
          <span class="asp-panel-badge asp-panel-badge--active" aria-label={`${activeCount()} agents active`}>
            {activeCount()} active
          </span>
        </Show>
        <Show when={usedCount() > 0 && activeCount() === 0}>
          <span class="asp-panel-badge" aria-label={`${usedCount()} agents used`}>{usedCount()} used</span>
        </Show>
        <Icon
          name="chevron-down"
          size="small"
          class="asp-panel-chevron"
          style={!props.collapsed ? { transform: "rotate(180deg)" } : undefined}
          aria-hidden="true"
        />
      </button>

      {/* Agent rows */}
      <Show when={!props.collapsed}>
        <div id="asp-agent-list" class="asp-list" role="list" aria-label="MAOS agents">
          <For each={runtimes()}>
            {(runtime) => (
              <Show when={runtime.status !== "idle" || runtime.stepsCompleted > 0 || runtime.taskDescription}>
                <AgentRow runtime={runtime} />
              </Show>
            )}
          </For>
          <Show when={usedCount() === 0 && session.status() === "idle"}>
            <div class="asp-empty">No agents active yet</div>
          </Show>
        </div>
      </Show>
    </div>
  )
}
