/**
 * ProviderCapabilityMatrix — visual grid of configured providers × capability
 * dimensions with static lookup data.  No API calls needed.
 *
 * Columns: Vision | Function calling | Streaming | Ctx>100k | Ctx>200k |
 *          Price tier | Speed
 *
 * Clicking a row calls the optional onSelectProvider callback so the parent
 * can navigate to that provider's config section.
 */

import { Component, For, Show, createMemo, createSignal } from "solid-js"
import { Card } from "@kilocode/kilo-ui/card"
import { ProviderIcon } from "@kilocode/kilo-ui/provider-icon"
import { useProvider } from "../../context/provider"
import { providerIcon } from "./provider-catalog"

// ─── Types ────────────────────────────────────────────────────────────────────

type CellValue = "yes" | "no" | "partial" | "unknown"
type PriceTier = "free" | "cheap" | "mid" | "pro"
type SpeedTier = "fast" | "mid" | "slow"

interface ProviderCapabilities {
  vision: CellValue
  functionCalling: CellValue
  streaming: CellValue
  contextOver100k: CellValue
  contextOver200k: CellValue
  priceTier: PriceTier
  speedTier: SpeedTier
  /** Estimated cost per 1 M input tokens in USD, or null if unknown */
  costPer1MInput: number | null
}

// ─── Static lookup table ──────────────────────────────────────────────────────
// Data reflects publicly documented capabilities as of early 2026.
// "partial" = supported only on select models within the provider.

const PROVIDER_CAPABILITIES: Readonly<Record<string, ProviderCapabilities>> = {
  anthropic: {
    vision: "yes",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "yes",
    contextOver200k: "yes",
    priceTier: "pro",
    speedTier: "mid",
    costPer1MInput: 3.0,
  },
  openai: {
    vision: "yes",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "yes",
    contextOver200k: "partial",
    priceTier: "mid",
    speedTier: "fast",
    costPer1MInput: 2.5,
  },
  google: {
    vision: "yes",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "yes",
    contextOver200k: "yes",
    priceTier: "cheap",
    speedTier: "fast",
    costPer1MInput: 0.075,
  },
  "google-vertex": {
    vision: "yes",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "yes",
    contextOver200k: "yes",
    priceTier: "mid",
    speedTier: "fast",
    costPer1MInput: 0.075,
  },
  mistral: {
    vision: "partial",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "yes",
    contextOver200k: "no",
    priceTier: "cheap",
    speedTier: "fast",
    costPer1MInput: 0.1,
  },
  groq: {
    vision: "partial",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "no",
    priceTier: "cheap",
    speedTier: "fast",
    costPer1MInput: 0.05,
  },
  deepseek: {
    vision: "partial",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "yes",
    contextOver200k: "no",
    priceTier: "cheap",
    speedTier: "mid",
    costPer1MInput: 0.07,
  },
  openrouter: {
    vision: "partial",
    functionCalling: "partial",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "partial",
    priceTier: "mid",
    speedTier: "mid",
    costPer1MInput: null,
  },
  "amazon-bedrock": {
    vision: "yes",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "yes",
    contextOver200k: "yes",
    priceTier: "pro",
    speedTier: "mid",
    costPer1MInput: null,
  },
  azure: {
    vision: "yes",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "yes",
    contextOver200k: "partial",
    priceTier: "pro",
    speedTier: "mid",
    costPer1MInput: null,
  },
  xai: {
    vision: "yes",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "yes",
    contextOver200k: "no",
    priceTier: "mid",
    speedTier: "fast",
    costPer1MInput: 2.0,
  },
  cohere: {
    vision: "no",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "yes",
    contextOver200k: "no",
    priceTier: "mid",
    speedTier: "fast",
    costPer1MInput: 0.15,
  },
  perplexity: {
    vision: "partial",
    functionCalling: "no",
    streaming: "yes",
    contextOver100k: "yes",
    contextOver200k: "no",
    priceTier: "mid",
    speedTier: "mid",
    costPer1MInput: 1.0,
  },
  ollama: {
    vision: "partial",
    functionCalling: "partial",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "partial",
    priceTier: "free",
    speedTier: "slow",
    costPer1MInput: 0,
  },
  "ollama-cloud": {
    vision: "partial",
    functionCalling: "partial",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "partial",
    priceTier: "free",
    speedTier: "slow",
    costPer1MInput: 0,
  },
  cerebras: {
    vision: "no",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "yes",
    contextOver200k: "no",
    priceTier: "cheap",
    speedTier: "fast",
    costPer1MInput: 0.1,
  },
  fireworks: {
    vision: "partial",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "no",
    priceTier: "cheap",
    speedTier: "fast",
    costPer1MInput: 0.2,
  },
  togetherai: {
    vision: "partial",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "no",
    priceTier: "cheap",
    speedTier: "fast",
    costPer1MInput: 0.2,
  },
  deepinfra: {
    vision: "partial",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "no",
    priceTier: "cheap",
    speedTier: "fast",
    costPer1MInput: 0.1,
  },
  nvidia: {
    vision: "partial",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "no",
    priceTier: "mid",
    speedTier: "fast",
    costPer1MInput: 0.4,
  },
  venice: {
    vision: "partial",
    functionCalling: "partial",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "no",
    priceTier: "cheap",
    speedTier: "mid",
    costPer1MInput: 0.5,
  },
  siliconflow: {
    vision: "partial",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "no",
    priceTier: "cheap",
    speedTier: "fast",
    costPer1MInput: 0.14,
  },
  vercel: {
    vision: "partial",
    functionCalling: "partial",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "no",
    priceTier: "mid",
    speedTier: "fast",
    costPer1MInput: null,
  },
  "github-copilot": {
    vision: "partial",
    functionCalling: "partial",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "no",
    priceTier: "mid",
    speedTier: "fast",
    costPer1MInput: null,
  },
  "github-models": {
    vision: "partial",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "no",
    priceTier: "free",
    speedTier: "mid",
    costPer1MInput: 0,
  },
  cloudflare: {
    vision: "partial",
    functionCalling: "partial",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "no",
    priceTier: "cheap",
    speedTier: "fast",
    costPer1MInput: 0.11,
  },
  gitlab: {
    vision: "partial",
    functionCalling: "partial",
    streaming: "yes",
    contextOver100k: "partial",
    contextOver200k: "no",
    priceTier: "mid",
    speedTier: "mid",
    costPer1MInput: null,
  },
  alibaba: {
    vision: "partial",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "yes",
    contextOver200k: "no",
    priceTier: "cheap",
    speedTier: "fast",
    costPer1MInput: 0.14,
  },
  kilo: {
    vision: "yes",
    functionCalling: "yes",
    streaming: "yes",
    contextOver100k: "yes",
    contextOver200k: "yes",
    priceTier: "mid",
    speedTier: "fast",
    costPer1MInput: null,
  },
}

/** Fallback for unknown / custom providers. */
const UNKNOWN_CAPS: ProviderCapabilities = {
  vision: "unknown",
  functionCalling: "unknown",
  streaming: "unknown",
  contextOver100k: "unknown",
  contextOver200k: "unknown",
  priceTier: "mid",
  speedTier: "mid",
  costPer1MInput: null,
}

// ─── Cell renderers ───────────────────────────────────────────────────────────

const CELL_STYLES: Record<CellValue, { symbol: string; color: string; bg: string }> = {
  yes: {
    symbol: "✓",
    color: "var(--vscode-testing-iconPassed, #4caf50)",
    bg: "color-mix(in srgb, var(--vscode-testing-iconPassed, #4caf50) 10%, transparent)",
  },
  no: {
    symbol: "✗",
    color: "var(--vscode-testing-iconFailed, #f44336)",
    bg: "color-mix(in srgb, var(--vscode-testing-iconFailed, #f44336) 10%, transparent)",
  },
  partial: {
    symbol: "~",
    color: "var(--vscode-editorWarning-foreground, #cca700)",
    bg: "color-mix(in srgb, var(--vscode-editorWarning-foreground, #cca700) 10%, transparent)",
  },
  unknown: {
    symbol: "—",
    color: "var(--vscode-disabledForeground, #888)",
    bg: "transparent",
  },
}

const PRICE_LABELS: Record<PriceTier, { label: string; color: string }> = {
  free: { label: "free", color: "var(--vscode-testing-iconPassed, #4caf50)" },
  cheap: { label: "cheap", color: "var(--vscode-testing-iconPassed, #73c991)" },
  mid: { label: "mid", color: "var(--vscode-editorWarning-foreground, #cca700)" },
  pro: { label: "pro", color: "var(--vscode-testing-iconFailed, #f44336)" },
}

const SPEED_LABELS: Record<SpeedTier, { label: string; color: string }> = {
  fast: { label: "fast", color: "var(--vscode-testing-iconPassed, #4caf50)" },
  mid: { label: "mid", color: "var(--vscode-editorWarning-foreground, #cca700)" },
  slow: { label: "slow", color: "var(--vscode-testing-iconFailed, #f44336)" },
}

// Numeric columns: Vision, Func, Stream, Ctx100k, Ctx200k
type NumericCol = "vision" | "functionCalling" | "streaming" | "contextOver100k" | "contextOver200k"

const COLUMN_DEFS: ReadonlyArray<{
  key: NumericCol
  label: string
  abbrev: string
}> = [
  { key: "vision",           label: "Vision",      abbrev: "Vis" },
  { key: "functionCalling",  label: "Functions",   abbrev: "Fn" },
  { key: "streaming",        label: "Streaming",   abbrev: "Strm" },
  { key: "contextOver100k",  label: "Ctx >100k",   abbrev: ">100k" },
  { key: "contextOver200k",  label: "Ctx >200k",   abbrev: ">200k" },
]

// ─── Grid column template ─────────────────────────────────────────────────────
// icon + name | 5 caps | price | speed | cost
const GRID = "24px 1fr repeat(5, 38px) 52px 48px 76px"

// ─── Sub-components ───────────────────────────────────────────────────────────

const CapCell: Component<{ value: CellValue }> = (props) => {
  const s = () => CELL_STYLES[props.value]
  return (
    <div
      style={{
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        "font-size": "12px",
        "font-weight": "700",
        color: s().color,
        background: s().bg,
        "border-radius": "3px",
        height: "22px",
        width: "32px",
      }}
      title={props.value}
    >
      {s().symbol}
    </div>
  )
}

const PriceCell: Component<{ tier: PriceTier }> = (props) => {
  const p = () => PRICE_LABELS[props.tier]
  return (
    <span
      style={{
        "font-size": "11px",
        padding: "1px 5px",
        "border-radius": "3px",
        background: `color-mix(in srgb, ${p().color} 14%, transparent)`,
        color: p().color,
        "font-weight": "600",
      }}
    >
      {p().label}
    </span>
  )
}

const SpeedCell: Component<{ tier: SpeedTier }> = (props) => {
  const s = () => SPEED_LABELS[props.tier]
  return (
    <span
      style={{
        "font-size": "11px",
        padding: "1px 5px",
        "border-radius": "3px",
        background: `color-mix(in srgb, ${s().color} 14%, transparent)`,
        color: s().color,
        "font-weight": "600",
      }}
    >
      {s().label}
    </span>
  )
}

const HeaderCell: Component<{ label: string; title?: string }> = (props) => (
  <div
    title={props.title ?? props.label}
    style={{
      "font-size": "10px",
      "font-weight": "600",
      "text-transform": "uppercase",
      "letter-spacing": "0.04em",
      color: "var(--text-weak-base, var(--vscode-descriptionForeground))",
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "text-align": "center",
    }}
  >
    {props.label}
  </div>
)

// ─── Legend ───────────────────────────────────────────────────────────────────

const Legend: Component = () => (
  <div
    style={{
      display: "flex",
      "flex-wrap": "wrap",
      gap: "10px",
      "font-size": "11px",
      color: "var(--text-weak-base, var(--vscode-descriptionForeground))",
      "margin-top": "8px",
    }}
  >
    {(Object.entries(CELL_STYLES) as Array<[CellValue, (typeof CELL_STYLES)[CellValue]]>).map(([val, s]) => (
      <span style={{ display: "inline-flex", "align-items": "center", gap: "4px" }}>
        <span style={{ color: s.color, "font-weight": "700" }}>{s.symbol}</span>
        {val === "yes" ? "supported" : val === "no" ? "not supported" : val === "partial" ? "select models" : "unknown"}
      </span>
    ))}
    <span style={{ display: "inline-flex", "align-items": "center", gap: "4px" }}>
      Price = estimated cost per 1M input tokens
    </span>
  </div>
)

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  /** Optional callback: fired when user clicks a provider row. */
  onSelectProvider?: (providerID: string) => void
}

const ProviderCapabilityMatrix: Component<Props> = (props) => {
  const provider = useProvider()
  const [collapsed, setCollapsed] = createSignal(true)

  /** Visible rows: connected providers only — keeps the matrix compact. */
  const rows = createMemo(() => {
    const allProviders = provider.providers()
    const connected = provider.connected()
    return connected
      .filter((id) => id !== "kilo") // Kilo gateway handled separately in ProvidersTab
      .map((id) => ({ id, name: allProviders[id]?.name ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })

  const caps = (id: string): ProviderCapabilities => PROVIDER_CAPABILITIES[id] ?? UNKNOWN_CAPS

  const formatCost = (c: number | null): string => {
    if (c === null) return "—"
    if (c === 0) return "free"
    return `$${c.toFixed(2)}`
  }

  return (
    <div style={{ "margin-top": "20px" }}>
      {/* Collapsible header */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          "margin-bottom": "8px",
          cursor: "pointer",
          "user-select": "none",
        }}
        onClick={() => setCollapsed((v) => !v)}
      >
        <div style={{ display: "flex", "align-items": "center", gap: "6px" }}>
          <span style={{ "font-size": "12px", "font-weight": "600", color: "var(--vscode-foreground)" }}>
            {collapsed() ? "▶" : "▼"}
          </span>
          <span style={{ "font-size": "13px", "font-weight": "600", color: "var(--vscode-foreground)" }}>
            Provider Comparison
          </span>
        </div>
        <span
          style={{
            "font-size": "11px",
            color: "var(--text-weak-base, var(--vscode-descriptionForeground))",
          }}
        >
          {rows().length} connected provider{rows().length !== 1 ? "s" : ""} · click row to configure
        </span>
      </div>

      <Show when={!collapsed()}>
        <Show
          when={rows().length > 0}
          fallback={
            <Card>
              <div
                style={{
                  "font-size": "12px",
                  color: "var(--text-weak-base, var(--vscode-descriptionForeground))",
                  padding: "8px 0",
                }}
              >
                No providers connected yet. Connect a provider above to see it in the comparison matrix.
              </div>
            </Card>
          }
        >
          <Card>
            {/* Column headers */}
            <div
              style={{
                display: "grid",
                "grid-template-columns": GRID,
                gap: "6px",
                padding: "4px 4px 8px",
                "border-bottom": "1px solid var(--border-weak-base)",
                "margin-bottom": "2px",
                "align-items": "center",
              }}
            >
              <div />
              <div />
              <For each={COLUMN_DEFS}>
                {(col) => <HeaderCell label={col.abbrev} title={col.label} />}
              </For>
              <HeaderCell label="Price" title="Price tier" />
              <HeaderCell label="Speed" title="Response speed tier" />
              <HeaderCell label="$/1M tok" title="Est. cost per 1M input tokens" />
            </div>

            {/* Data rows */}
            <For each={rows()}>
              {(row, index) => {
                const c = () => caps(row.id)
                return (
                  <div
                    style={{
                      display: "grid",
                      "grid-template-columns": GRID,
                      gap: "6px",
                      "align-items": "center",
                      padding: "5px 4px",
                      "border-bottom":
                        index() < rows().length - 1 ? "1px solid var(--border-weak-base)" : "none",
                      cursor: props.onSelectProvider ? "pointer" : "default",
                      "border-radius": "3px",
                    }}
                    onClick={() => props.onSelectProvider?.(row.id)}
                    onMouseEnter={(e) => {
                      if (props.onSelectProvider)
                        e.currentTarget.style.background =
                          "var(--bg-hover-base, var(--vscode-list-hoverBackground))"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent"
                    }}
                  >
                    {/* Icon */}
                    <ProviderIcon id={providerIcon(row.id)} width={16} height={16} />

                    {/* Name */}
                    <span
                      style={{
                        "font-size": "12px",
                        "font-weight": "500",
                        overflow: "hidden",
                        "text-overflow": "ellipsis",
                        "white-space": "nowrap",
                        color: "var(--vscode-foreground)",
                      }}
                    >
                      {row.name}
                    </span>

                    {/* 5 capability columns */}
                    <For each={COLUMN_DEFS}>
                      {(col) => <CapCell value={c()[col.key]} />}
                    </For>

                    {/* Price tier */}
                    <div style={{ display: "flex", "justify-content": "center" }}>
                      <PriceCell tier={c().priceTier} />
                    </div>

                    {/* Speed tier */}
                    <div style={{ display: "flex", "justify-content": "center" }}>
                      <SpeedCell tier={c().speedTier} />
                    </div>

                    {/* Cost per 1M */}
                    <span
                      style={{
                        "font-size": "11px",
                        color: "var(--text-weak-base, var(--vscode-descriptionForeground))",
                        "text-align": "right",
                        "padding-right": "4px",
                        "font-family": "var(--vscode-editor-font-family, monospace)",
                      }}
                    >
                      {formatCost(c().costPer1MInput)}
                    </span>
                  </div>
                )
              }}
            </For>
          </Card>

          <Legend />
        </Show>
      </Show>
    </div>
  )
}

export default ProviderCapabilityMatrix
