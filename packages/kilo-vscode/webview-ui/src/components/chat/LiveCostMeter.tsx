/**
 * LiveCostMeter — Feature 4
 *
 * Persistent cost counter at the bottom of chat:
 *   "$0.0023 this session"
 * Updates in real-time after each StepFinishPart arrives.
 * Breakdown on hover: input tokens × rate + output tokens × rate.
 *
 * Model pricing table (USD per 1M tokens, input / output).
 * Fallback: 0 / 0 (free / unknown providers show $0.0000).
 */

import { Component, Show, createMemo } from "solid-js"
import { Tooltip } from "@kilocode/kilo-ui/tooltip"
import { useSession } from "../../context/session"
import { useProvider } from "../../context/provider"

// ── Pricing table (USD / 1M tokens) ──────────────────────────────────────────
// Source: public Anthropic / OpenAI pricing pages, April 2026.
const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic Claude models
  "claude-opus-4-5":        { input: 15,   output: 75   },
  "claude-opus-4":          { input: 15,   output: 75   },
  "claude-sonnet-4-6":      { input: 3,    output: 15   },
  "claude-sonnet-4-5":      { input: 3,    output: 15   },
  "claude-sonnet-4":        { input: 3,    output: 15   },
  "claude-haiku-4-5":       { input: 0.8,  output: 4    },
  "claude-haiku-4":         { input: 0.8,  output: 4    },
  "claude-3-5-sonnet-latest":{ input: 3,   output: 15   },
  "claude-3-5-haiku-latest": { input: 0.8, output: 4    },
  "claude-3-opus-latest":    { input: 15,  output: 75   },
  // OpenAI
  "gpt-4o":                 { input: 2.5,  output: 10   },
  "gpt-4o-mini":            { input: 0.15, output: 0.6  },
  "gpt-4-turbo":            { input: 10,   output: 30   },
  "o1":                     { input: 15,   output: 60   },
  "o3-mini":                { input: 1.1,  output: 4.4  },
  // Google Gemini
  "gemini-2-5-pro":         { input: 1.25, output: 10   },
  "gemini-2-5-flash":       { input: 0.075,output: 0.3  },
  "gemini-2-0-flash":       { input: 0.075,output: 0.3  },
}

function lookupPricing(modelID: string): { input: number; output: number } {
  // Exact match first
  if (PRICING[modelID]) return PRICING[modelID]
  // Fuzzy: find first entry whose key is a substring of the modelID
  for (const [key, val] of Object.entries(PRICING)) {
    if (modelID.includes(key) || key.includes(modelID)) return val
  }
  return { input: 0, output: 0 }
}

export const LiveCostMeter: Component = () => {
  const session = useSession()
  const provider = useProvider()

  const sel = createMemo(() => session.selected())
  const modelID = createMemo(() => sel()?.modelID ?? "")

  const pricing = createMemo(() => lookupPricing(modelID()))

  /** Aggregate token counts across all assistant messages in this session. */
  const totals = createMemo(() => {
    let input = 0, output = 0, cacheRead = 0, cacheWrite = 0
    for (const m of session.messages()) {
      if (m.role !== "assistant" || !m.tokens) continue
      input     += m.tokens.input
      output    += m.tokens.output
      cacheRead += m.tokens.cache?.read  ?? 0
      cacheWrite+= m.tokens.cache?.write ?? 0
    }
    return { input, output, cacheRead, cacheWrite }
  })

  const sessionCost = createMemo(() => {
    // Use the session.costBreakdown() total if available (already computed)
    const breakdown = session.costBreakdown()
    if (breakdown.length > 0) {
      return breakdown.reduce((s, e) => s + e.cost, 0)
    }
    // Fallback: compute from token counts × pricing rates
    const p = pricing()
    const t = totals()
    const inputCost  = (t.input  / 1_000_000) * p.input
    const outputCost = (t.output / 1_000_000) * p.output
    // Cache reads are typically discounted (≈10% of input price)
    const cacheCost  = (t.cacheRead / 1_000_000) * p.input * 0.1
    return inputCost + outputCost + cacheCost
  })

  const hasData = createMemo(() => {
    const t = totals()
    return t.input > 0 || t.output > 0
  })

  const fmtCost = (n: number) => {
    if (n === 0) return "$0.0000"
    if (n < 0.001) return `$${n.toFixed(6)}`
    if (n < 0.01)  return `$${n.toFixed(4)}`
    return `$${n.toFixed(4)}`
  }

  const fmtNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  const tooltip = createMemo(() => {
    const t = totals()
    const p = pricing()
    if (!hasData()) return "No tokens recorded yet"
    const lines = [
      `Input:  ${fmtNum(t.input)} tokens × $${p.input}/M = ${fmtCost((t.input / 1_000_000) * p.input)}`,
      `Output: ${fmtNum(t.output)} tokens × $${p.output}/M = ${fmtCost((t.output / 1_000_000) * p.output)}`,
    ]
    if (t.cacheRead > 0)  lines.push(`Cache read:  ${fmtNum(t.cacheRead)} tokens (10% rate)`)
    if (t.cacheWrite > 0) lines.push(`Cache write: ${fmtNum(t.cacheWrite)} tokens`)
    lines.push(`Model: ${modelID() || "unknown"}`)
    return lines.join("\n")
  })

  return (
    <Show when={hasData()}>
      <Tooltip value={tooltip()} placement="top">
        <div class="live-cost-meter">
          <span class="live-cost-icon">💰</span>
          <span class="live-cost-value">{fmtCost(sessionCost())}</span>
          <span class="live-cost-label"> this session</span>
        </div>
      </Tooltip>
    </Show>
  )
}
