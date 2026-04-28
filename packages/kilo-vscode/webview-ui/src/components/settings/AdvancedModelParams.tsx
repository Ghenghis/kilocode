/**
 * AdvancedModelParams — collapsible "Advanced Parameters" panel.
 *
 * Drop this inside any model / agent config view:
 *
 *   <AdvancedModelParams
 *     params={cfg()}
 *     onChange={update}
 *     globalSystemPrompt="You are a helpful assistant."
 *     supportsTopK={false}
 *     supportsOpenAIPenalties={false}
 *   />
 *
 * All values are wired to `onChange` which callers map to `updateConfig`.
 * No new npm deps — only SolidJS + VS Code CSS custom properties.
 */

import { Component, createSignal, For, Show } from "solid-js"

// ---------------------------------------------------------------------------
// Public props / param shape
// ---------------------------------------------------------------------------

/** The subset of AgentConfig / model config that this panel can edit. */
export interface ModelParamValues {
  temperature?: number
  top_p?: number
  /** Top-K (integer 1–200). Not supported by all providers. */
  top_k?: number
  /** Max output tokens. `undefined` = model default. */
  max_tokens?: number
  /** Up to 4 stop sequences. */
  stop_sequences?: string[]
  /** System prompt override for this model/mode. */
  system_prompt?: string
  /** OpenAI-style frequency penalty (-2 to 2). */
  frequency_penalty?: number
  /** OpenAI-style presence penalty (-2 to 2). */
  presence_penalty?: number
  /** Optional reproducibility seed. */
  seed?: number
}

interface Props {
  params: ModelParamValues
  /** Called on every change with a partial patch. */
  onChange: (patch: Partial<ModelParamValues>) => void
  /** The global system prompt shown in the "Reset to global" helper. */
  globalSystemPrompt?: string
  /**
   * Pass `true` for providers that support top-k (e.g. Google, Anthropic).
   * The Top-K row is hidden when false.
   */
  supportsTopK?: boolean
  /**
   * Pass `true` for OpenAI-compatible providers.
   * Frequency/presence penalty sliders are only shown when true.
   */
  supportsOpenAIPenalties?: boolean
  /** Current model's default max-output-token value for the helper text. */
  modelDefaultMaxTokens?: number
}

// ---------------------------------------------------------------------------
// Defaults — used for "Reset all to defaults" and placeholder rendering
// ---------------------------------------------------------------------------

const PARAM_DEFAULTS: Required<ModelParamValues> = {
  temperature: 1.0,
  top_p: 1.0,
  top_k: 40,
  max_tokens: 0,   // 0 = "model default" (not sent to API)
  stop_sequences: [],
  system_prompt: "",
  frequency_penalty: 0,
  presence_penalty: 0,
  seed: 0,         // 0 = "not set" (not sent to API)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Inline shared label style */
const SECTION_LABEL: Record<string, string> = {
  "font-size": "10px",
  "font-weight": "700",
  "letter-spacing": "0.08em",
  "text-transform": "uppercase",
  color: "var(--vscode-descriptionForeground)",
  "margin-bottom": "4px",
}

/** Shared input style */
function inputStyle(width = "80px"): Record<string, string> {
  return {
    width,
    height: "24px",
    padding: "0 6px",
    "font-size": "12px",
    border: "1px solid var(--vscode-input-border, rgba(128,128,128,0.35))",
    "border-radius": "4px",
    background: "var(--vscode-input-background, #3c3c3c)",
    color: "var(--vscode-input-foreground, #d4d4d4)",
    outline: "none",
    "box-sizing": "border-box",
  }
}

/** Range slider + numeric label row */
interface SliderRowProps {
  label: string
  description?: string
  value: number
  min: number
  max: number
  step: number
  markers?: Array<{ value: number; label: string }>
  onChange: (v: number) => void
  format?: (v: number) => string
}

const SliderRow: Component<SliderRowProps> = (props) => {
  const fmt = () => props.format ?? ((v: number) => v.toFixed(props.step < 1 ? 2 : 0))

  return (
    <div style={{ "margin-bottom": "14px" }}>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          "margin-bottom": "2px",
        }}
      >
        <span
          style={{
            "font-size": "12px",
            "font-weight": "500",
            color: "var(--vscode-foreground, #d4d4d4)",
          }}
        >
          {props.label}
        </span>
        <span
          style={{
            "font-size": "12px",
            "font-family": "var(--vscode-editor-font-family, monospace)",
            color: "var(--vscode-foreground, #d4d4d4)",
            "min-width": "40px",
            "text-align": "right",
          }}
        >
          {fmt()(props.value)}
        </span>
      </div>

      {props.description && (
        <div
          style={{
            "font-size": "11px",
            color: "var(--vscode-descriptionForeground)",
            "margin-bottom": "4px",
          }}
        >
          {props.description}
        </div>
      )}

      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onInput={(e) => props.onChange(Number((e.target as HTMLInputElement).value))}
        style={{
          width: "100%",
          cursor: "pointer",
          "accent-color": "var(--kc-accent, var(--vscode-button-background, #007fd4))",
        }}
      />

      {/* Marker labels below the track */}
      <Show when={props.markers && props.markers.length > 0}>
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            "margin-top": "2px",
          }}
        >
          <For each={props.markers}>
            {(m) => (
              <button
                type="button"
                title={`Set to ${m.value}`}
                onClick={() => props.onChange(m.value)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  "font-size": "10px",
                  color: Math.abs(props.value - m.value) < 0.005
                    ? "var(--kc-accent, var(--vscode-button-background, #007fd4))"
                    : "var(--vscode-descriptionForeground)",
                  padding: "0",
                  "white-space": "nowrap",
                }}
              >
                {m.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tag input for stop sequences
// ---------------------------------------------------------------------------

interface TagInputProps {
  tags: string[]
  max: number
  placeholder: string
  onChange: (tags: string[]) => void
}

const TagInput: Component<TagInputProps> = (props) => {
  const [inputVal, setInputVal] = createSignal("")

  const addTag = () => {
    const v = inputVal().trim()
    if (!v) return
    if (props.tags.length >= props.max) return
    if (props.tags.includes(v)) return
    props.onChange([...props.tags, v])
    setInputVal("")
  }

  return (
    <div
      style={{
        display: "flex",
        "flex-wrap": "wrap",
        gap: "4px",
        padding: "4px 6px",
        "min-height": "32px",
        border: "1px solid var(--vscode-input-border, rgba(128,128,128,0.35))",
        "border-radius": "4px",
        background: "var(--vscode-input-background, #3c3c3c)",
        "align-items": "center",
      }}
    >
      <For each={props.tags}>
        {(tag) => (
          <span
            style={{
              display: "inline-flex",
              "align-items": "center",
              gap: "3px",
              padding: "1px 6px",
              "border-radius": "3px",
              background: "var(--vscode-badge-background, rgba(128,128,128,0.25))",
              color: "var(--vscode-badge-foreground, #d4d4d4)",
              "font-size": "11px",
              "font-family": "var(--vscode-editor-font-family, monospace)",
            }}
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove stop sequence "${tag}"`}
              onClick={() => props.onChange(props.tags.filter((t) => t !== tag))}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0",
                "line-height": "1",
                color: "var(--vscode-descriptionForeground)",
                "font-size": "10px",
              }}
            >
              ✕
            </button>
          </span>
        )}
      </For>
      <Show when={props.tags.length < props.max}>
        <input
          type="text"
          value={inputVal()}
          placeholder={props.placeholder}
          onInput={(e) => setInputVal((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addTag()
            }
          }}
          style={{
            flex: "1",
            "min-width": "80px",
            background: "none",
            border: "none",
            outline: "none",
            "font-size": "11px",
            color: "var(--vscode-input-foreground, #d4d4d4)",
            padding: "0",
          }}
        />
      </Show>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const AdvancedModelParams: Component<Props> = (props) => {
  const [open, setOpen] = createSignal(false)
  const [sysPromptOpen, setSysPromptOpen] = createSignal(false)

  const p = () => props.params

  const sysPromptLen = () => (p().system_prompt ?? "").length

  // Clamp helpers
  const temperature = () => p().temperature ?? 1.0
  const topP = () => p().top_p ?? 1.0
  const topK = () => p().top_k ?? 40
  const freqPenalty = () => p().frequency_penalty ?? 0
  const presPenalty = () => p().presence_penalty ?? 0

  const handleReset = () => {
    props.onChange({
      temperature: undefined,
      top_p: undefined,
      top_k: undefined,
      max_tokens: undefined,
      stop_sequences: undefined,
      system_prompt: undefined,
      frequency_penalty: undefined,
      presence_penalty: undefined,
      seed: undefined,
    })
  }

  return (
    <div style={{ "margin-top": "12px" }}>
      {/* ── Collapsible header ──────────────────────────────────────────────── */}
      <button
        type="button"
        aria-expanded={open()}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          "align-items": "center",
          gap: "6px",
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "6px 0",
          color: "var(--vscode-foreground, #d4d4d4)",
          "font-size": "12px",
          "font-weight": "600",
          "text-align": "left",
          "border-top": "1px solid var(--vscode-widget-border, rgba(128,128,128,0.25))",
          "border-bottom": open() ? "none" : "none",
        }}
      >
        <span
          style={{
            display: "inline-block",
            "font-size": "9px",
            transition: "transform 0.15s",
            transform: open() ? "rotate(0deg)" : "rotate(-90deg)",
          }}
          aria-hidden="true"
        >
          ▾
        </span>
        Advanced Parameters
        <Show when={hasAnyOverride(p())}>
          <span
            title="Some parameters are overridden"
            style={{
              display: "inline-block",
              width: "6px",
              height: "6px",
              "border-radius": "50%",
              background: "var(--vscode-notificationsInfoIcon-foreground, #3794ff)",
              "margin-left": "2px",
            }}
          />
        </Show>
      </button>

      <Show when={open()}>
        <div
          style={{
            padding: "12px 0 4px 0",
          }}
        >
          {/* ── Temperature ─────────────────────────────────────────────────── */}
          <SliderRow
            label="Temperature"
            description="Controls randomness. Lower values produce more deterministic output."
            value={temperature()}
            min={0}
            max={2}
            step={0.01}
            markers={[
              { value: 0, label: "Deterministic (0)" },
              { value: 0.7, label: "Balanced (0.7)" },
              { value: 1.0, label: "Creative (1.0)" },
              { value: 2.0, label: "Very random (2.0)" },
            ]}
            onChange={(v) => props.onChange({ temperature: v })}
          />

          {/* ── Top-P ───────────────────────────────────────────────────────── */}
          <SliderRow
            label="Top-P (nucleus sampling)"
            description="Only tokens whose cumulative probability exceeds this threshold are considered. 1.0 = disabled."
            value={topP()}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => props.onChange({ top_p: v })}
          />

          {/* ── Top-K ───────────────────────────────────────────────────────── */}
          <Show when={props.supportsTopK}>
            <div style={{ "margin-bottom": "14px" }}>
              <div style={{ display: "flex", "align-items": "center", "justify-content": "space-between", "margin-bottom": "4px" }}>
                <span style={{ "font-size": "12px", "font-weight": "500", color: "var(--vscode-foreground, #d4d4d4)" }}>
                  Top-K
                </span>
                <span style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)" }}>
                  1–200 integer
                </span>
              </div>
              <div style={{ "font-size": "11px", color: "var(--vscode-descriptionForeground)", "margin-bottom": "4px" }}>
                Limits vocabulary to the K most likely next tokens. Only supported by select providers.
              </div>
              <input
                type="number"
                min={1}
                max={200}
                step={1}
                value={topK()}
                onInput={(e) => {
                  const v = parseInt((e.target as HTMLInputElement).value, 10)
                  if (!isNaN(v)) props.onChange({ top_k: Math.min(200, Math.max(1, v)) })
                }}
                style={inputStyle("80px")}
              />
            </div>
          </Show>

          {/* ── Max tokens ──────────────────────────────────────────────────── */}
          <div style={{ "margin-bottom": "14px" }}>
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                "margin-bottom": "4px",
              }}
            >
              <span
                style={{
                  "font-size": "12px",
                  "font-weight": "500",
                  color: "var(--vscode-foreground, #d4d4d4)",
                }}
              >
                Max Output Tokens
              </span>
            </div>
            <div
              style={{
                "font-size": "11px",
                color: "var(--vscode-descriptionForeground)",
                "margin-bottom": "4px",
              }}
            >
              {props.modelDefaultMaxTokens
                ? `Leave blank for model default (currently ${props.modelDefaultMaxTokens.toLocaleString()} tokens).`
                : "Leave blank for model default."}
            </div>
            <input
              type="number"
              min={1}
              step={1}
              placeholder="Model default"
              value={(p().max_tokens ?? 0) > 0 ? String(p().max_tokens) : ""}
              onInput={(e) => {
                const raw = (e.target as HTMLInputElement).value.trim()
                if (!raw) {
                  props.onChange({ max_tokens: undefined })
                  return
                }
                const v = parseInt(raw, 10)
                if (!isNaN(v) && v > 0) props.onChange({ max_tokens: v })
              }}
              style={inputStyle("120px")}
            />
          </div>

          {/* ── Stop sequences ──────────────────────────────────────────────── */}
          <div style={{ "margin-bottom": "14px" }}>
            <div
              style={{
                "font-size": "12px",
                "font-weight": "500",
                color: "var(--vscode-foreground, #d4d4d4)",
                "margin-bottom": "4px",
              }}
            >
              Stop Sequences
              <span
                style={{
                  "margin-left": "6px",
                  "font-size": "10px",
                  "font-weight": "400",
                  color: "var(--vscode-descriptionForeground)",
                }}
              >
                (max 4, press Enter to add)
              </span>
            </div>
            <TagInput
              tags={p().stop_sequences ?? []}
              max={4}
              placeholder={
                (p().stop_sequences?.length ?? 0) >= 4
                  ? "Max 4 reached"
                  : 'e.g. "\\n\\n" or "END"'
              }
              onChange={(tags) => props.onChange({ stop_sequences: tags.length ? tags : undefined })}
            />
          </div>

          {/* ── System prompt override ──────────────────────────────────────── */}
          <div style={{ "margin-bottom": "14px" }}>
            <div
              style={{
                display: "flex",
                "align-items": "center",
                "justify-content": "space-between",
                "margin-bottom": "4px",
              }}
            >
              <span
                style={{
                  "font-size": "12px",
                  "font-weight": "500",
                  color: "var(--vscode-foreground, #d4d4d4)",
                }}
              >
                System Prompt Override
              </span>
              <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
                <Show when={p().system_prompt}>
                  <button
                    type="button"
                    title="Reset to global system prompt"
                    onClick={() => {
                      props.onChange({ system_prompt: undefined })
                      setSysPromptOpen(false)
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      "font-size": "11px",
                      color: "var(--kc-accent, var(--vscode-button-background, #007fd4))",
                      padding: "0",
                      "text-decoration": "underline",
                    }}
                  >
                    Reset to global
                  </button>
                </Show>
                <button
                  type="button"
                  onClick={() => setSysPromptOpen((v) => !v)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    "font-size": "11px",
                    color: "var(--vscode-descriptionForeground)",
                    padding: "0",
                  }}
                >
                  {sysPromptOpen() ? "Collapse ▴" : "Expand ▾"}
                </button>
              </div>
            </div>
            <div
              style={{
                "font-size": "11px",
                color: "var(--vscode-descriptionForeground)",
                "margin-bottom": "4px",
              }}
            >
              Overrides the global system prompt for this model/mode only.
            </div>

            <Show when={sysPromptOpen()}>
              <div style={{ position: "relative" }}>
                <textarea
                  value={p().system_prompt ?? ""}
                  placeholder={props.globalSystemPrompt
                    ? `Global: "${props.globalSystemPrompt.slice(0, 60)}${props.globalSystemPrompt.length > 60 ? "…" : ""}"`
                    : "Enter system prompt override…"}
                  rows={5}
                  onInput={(e) => {
                    const v = (e.target as HTMLTextAreaElement).value
                    props.onChange({ system_prompt: v || undefined })
                  }}
                  style={{
                    width: "100%",
                    "box-sizing": "border-box",
                    padding: "6px 8px",
                    "font-size": "12px",
                    "font-family": "var(--vscode-editor-font-family, monospace)",
                    border: "1px solid var(--vscode-input-border, rgba(128,128,128,0.35))",
                    "border-radius": "4px",
                    background: "var(--vscode-input-background, #3c3c3c)",
                    color: "var(--vscode-input-foreground, #d4d4d4)",
                    resize: "vertical",
                    outline: "none",
                  }}
                />
                <div
                  style={{
                    "font-size": "10px",
                    "text-align": "right",
                    color: sysPromptLen() > 4000
                      ? "var(--vscode-errorForeground, #f44747)"
                      : "var(--vscode-descriptionForeground)",
                    "margin-top": "2px",
                  }}
                >
                  {sysPromptLen().toLocaleString()} chars
                  {sysPromptLen() > 4000 && " — very long prompts may affect performance"}
                </div>
              </div>
            </Show>
          </div>

          {/* ── OpenAI penalties ────────────────────────────────────────────── */}
          <Show when={props.supportsOpenAIPenalties}>
            <SliderRow
              label="Frequency Penalty"
              description="Reduces likelihood of repeating the same tokens. Range -2 to 2."
              value={freqPenalty()}
              min={-2}
              max={2}
              step={0.01}
              onChange={(v) => props.onChange({ frequency_penalty: v })}
              format={(v) => v.toFixed(2)}
            />
            <SliderRow
              label="Presence Penalty"
              description="Increases likelihood of introducing new topics. Range -2 to 2."
              value={presPenalty()}
              min={-2}
              max={2}
              step={0.01}
              onChange={(v) => props.onChange({ presence_penalty: v })}
              format={(v) => v.toFixed(2)}
            />
          </Show>

          {/* ── Seed ────────────────────────────────────────────────────────── */}
          <div style={{ "margin-bottom": "14px" }}>
            <div
              style={{
                "font-size": "12px",
                "font-weight": "500",
                color: "var(--vscode-foreground, #d4d4d4)",
                "margin-bottom": "4px",
              }}
            >
              Seed
              <span
                style={{
                  "margin-left": "6px",
                  "font-size": "10px",
                  "font-weight": "400",
                  color: "var(--vscode-descriptionForeground)",
                }}
              >
                optional — integer for reproducibility
              </span>
            </div>
            <input
              type="number"
              min={0}
              step={1}
              placeholder="Not set (random)"
              value={(p().seed ?? 0) > 0 ? String(p().seed) : ""}
              onInput={(e) => {
                const raw = (e.target as HTMLInputElement).value.trim()
                if (!raw) {
                  props.onChange({ seed: undefined })
                  return
                }
                const v = parseInt(raw, 10)
                if (!isNaN(v) && v >= 0) props.onChange({ seed: v })
              }}
              style={inputStyle("120px")}
            />
          </div>

          {/* ── Reset all ───────────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              "justify-content": "flex-end",
              "padding-top": "4px",
              "border-top": "1px solid var(--vscode-widget-border, rgba(128,128,128,0.2))",
            }}
          >
            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: "4px 12px",
                "font-size": "11px",
                "border-radius": "4px",
                border:
                  "1px solid var(--vscode-button-secondaryBorder, rgba(128,128,128,0.4))",
                background:
                  "var(--vscode-button-secondaryBackground, transparent)",
                color:
                  "var(--vscode-button-secondaryForeground, var(--vscode-foreground, #d4d4d4))",
                cursor: "pointer",
              }}
            >
              Reset all to defaults
            </button>
          </div>
        </div>
      </Show>
    </div>
  )
}

/** Returns true when at least one param is set to a non-default value. */
function hasAnyOverride(p: ModelParamValues): boolean {
  if (p.temperature !== undefined) return true
  if (p.top_p !== undefined) return true
  if (p.top_k !== undefined) return true
  if (p.max_tokens !== undefined && p.max_tokens > 0) return true
  if (p.stop_sequences && p.stop_sequences.length > 0) return true
  if (p.system_prompt) return true
  if (p.frequency_penalty !== undefined && p.frequency_penalty !== 0) return true
  if (p.presence_penalty !== undefined && p.presence_penalty !== 0) return true
  if (p.seed !== undefined && p.seed > 0) return true
  return false
}

// Re-export PARAM_DEFAULTS so callers can use it for reset logic.
export { PARAM_DEFAULTS }

export default AdvancedModelParams
