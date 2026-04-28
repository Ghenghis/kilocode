/**
 * AgentWorkloadChart — donut chart showing what % of the last task was handled
 * by each MAOS agent.
 *
 * "Workload" = proportion of StepFinishPart events attributed to each agent
 * (i.e. how many full agentic steps that agent completed).
 *
 * Rendered as an SVG donut (pure CSS/SVG — no charting library dependency).
 * Updates reactively; re-renders at task end (when session goes idle).
 *
 * Shows a legend below the chart with agent color, name, and percentage.
 * Only agents with > 0 steps are shown.
 */

import { Component, For, Show, createMemo } from "solid-js"
import { useSession } from "../../context/session"
import { MAOS_AGENTS, resolveAgentByName } from "./AgentStatusPanel"
import type { Message, Part } from "../../types/messages"

// ── Data derivation ───────────────────────────────────────────────────

interface AgentSlice {
  id: string
  name: string
  color: string
  steps: number
  pct: number
}

function deriveSlices(messages: Message[], parts: Record<string, Part[]>): AgentSlice[] {
  const counts = new Map<string, number>()

  for (const msg of messages) {
    if (msg.role !== "assistant") continue
    const ps = parts[msg.id] ?? []
    const stepCount = ps.filter((p) => p.type === "step-finish").length
    if (stepCount === 0) continue

    // Resolve to MAOS agent id
    const agentName = msg.agent?.trim().toLowerCase() ?? ""
    const resolved = resolveAgentByName(agentName)
    const id = resolved?.id ?? "kc-main"
    counts.set(id, (counts.get(id) ?? 0) + stepCount)
  }

  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0)
  if (total === 0) return []

  const slices: AgentSlice[] = []
  for (const [id, steps] of counts) {
    const def = MAOS_AGENTS.find((a) => a.id === id)
    if (!def) continue
    slices.push({
      id,
      name: def.name,
      color: def.color,
      steps,
      pct: Math.round((steps / total) * 100),
    })
  }

  return slices.sort((a, b) => b.steps - a.steps)
}

// ── SVG Donut ─────────────────────────────────────────────────────────

const RADIUS = 36
const CX = 50
const CY = 50
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP_DEG = 2 // degrees of gap between slices

function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

interface DonutArc {
  color: string
  strokeDasharray: string
  strokeDashoffset: number
  transform: string
}

function buildArcs(slices: AgentSlice[]): DonutArc[] {
  const total = slices.reduce((s, a) => s + a.pct, 0) || 100
  const arcs: DonutArc[] = []
  let cumulative = 0

  for (const slice of slices) {
    const fraction = slice.pct / total
    const arcLength = fraction * CIRCUMFERENCE
    // Leave a small visual gap by slightly reducing arc length
    const gapArc = (GAP_DEG / 360) * CIRCUMFERENCE
    const drawn = Math.max(0, arcLength - gapArc)

    // Rotate so slices start from the top (-90°)
    const startAngle = (cumulative / total) * 360 - 90
    arcs.push({
      color: slice.color,
      strokeDasharray: `${drawn} ${CIRCUMFERENCE - drawn}`,
      strokeDashoffset: 0,
      transform: `rotate(${startAngle} ${CX} ${CY})`,
    })
    cumulative += slice.pct
  }

  return arcs
}

// ── Component ─────────────────────────────────────────────────────────

export const AgentWorkloadChart: Component = () => {
  const session = useSession()

  const allParts = createMemo(() => {
    const result: Record<string, Part[]> = {}
    for (const m of session.messages()) {
      const p = session.getParts(m.id)
      if (p.length > 0) result[m.id] = p
    }
    return result
  })

  const slices = createMemo(() => deriveSlices(session.messages(), allParts()))
  const arcs = createMemo(() => buildArcs(slices()))
  const totalSteps = createMemo(() => slices().reduce((s, a) => s + a.steps, 0))

  return (
    <Show when={slices().length > 0}>
      <div class="awc-root">
        <div class="awc-header">
          <span class="awc-title">Agent Workload</span>
          <span class="awc-subtitle">{totalSteps()} steps total</span>
        </div>
        <div class="awc-body">
          {/* SVG Donut */}
          <svg class="awc-donut" viewBox="0 0 100 100" role="img" aria-label="Agent workload distribution">
            <circle
              cx={CX}
              cy={CY}
              r={RADIUS}
              fill="none"
              stroke="var(--vscode-panel-border)"
              stroke-width="14"
            />
            <For each={arcs()}>
              {(arc, i) => (
                <circle
                  cx={CX}
                  cy={CY}
                  r={RADIUS}
                  fill="none"
                  stroke={arc.color}
                  stroke-width="14"
                  stroke-dasharray={arc.strokeDasharray}
                  stroke-dashoffset={arc.strokeDashoffset}
                  transform={arc.transform}
                  style={{ transition: "stroke-dasharray 0.4s ease-out" }}
                />
              )}
            </For>
            {/* Center label */}
            <text x={CX} y={CY - 3} text-anchor="middle" class="awc-center-num">
              {slices().length}
            </text>
            <text x={CX} y={CY + 9} text-anchor="middle" class="awc-center-label">
              agents
            </text>
          </svg>

          {/* Legend */}
          <div class="awc-legend">
            <For each={slices()}>
              {(slice) => (
                <div class="awc-legend-item">
                  <span class="awc-legend-swatch" style={{ background: slice.color }} />
                  <span class="awc-legend-name">{slice.name}</span>
                  <span class="awc-legend-pct">{slice.pct}%</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  )
}
