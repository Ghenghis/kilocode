/**
 * GatesPanel — non-coder-friendly view of the Contract Kit Creator rubric.
 *
 * Renders the 25 gates (12 RubricCritic + 13 anchor gates) with traffic-light
 * status, plain-English copy from `PlainEnglishLabels.ts`, an expandable
 * "why this matters" tooltip, an "Apply suggested fix" button when the gate
 * exposes an `autoFix`, and an "Override with reason" button that posts to
 * the GovernanceService audit log.
 *
 * Behaviour spec:
 *   • Top summary: "X of Y gates passing" with a colour-coded bar.
 *   • Sections grouped by category (Truth, Proof, Safety, Compliance), each
 *     collapsible. Expanded by default so non-coders see everything.
 *   • Click a row → posts `contract:editor:scrollToLine` so the editor
 *     scrolls to and highlights the offending line.
 *   • Subscribes to `contract:rubric:result` from the host. When `docPath`
 *     and `markdown` are passed in via props, also re-runs the rubric on
 *     edits, debounced 500ms.
 *   • SolidJS rules: signals at top, `<For>`, `onCleanup` for the listener.
 *
 * No new dependencies. Uses the existing kilo-ui Button + Icon components
 * and inline style props (matches the idiom in `ContractStudioTab.tsx`).
 */

import { Component, createSignal, createMemo, For, Show, onMount, onCleanup, createEffect } from "solid-js"
import { Icon } from "@kilocode/kilo-ui/icon"
import { Button } from "@kilocode/kilo-ui/button"
import { useVSCode } from "../../../context/vscode"
import {
  CATEGORY_ORDER,
  CATEGORY_TITLES,
  GateCategoryDisplay,
  PLAIN_ENGLISH_LABELS,
  PlainEnglishEntry,
  lookupGate,
} from "./PlainEnglishLabels"

// ── Wire-format types ────────────────────────────────────────────────────

type GateSeverity = "error" | "warn" | "info"

interface GateIssueWire {
  gateId?: string
  severity: GateSeverity
  message: string
  suggestion?: string
  line?: number
  column?: number
  /** When true, the host is willing to call autoFix on click. */
  autoFix?: boolean
}

interface RubricResultWire {
  type: "contract:rubric:result"
  docPath?: string
  score?: number
  passedGates?: string[]
  failedGates?: string[]
  issues?: GateIssueWire[]
}

// ── Display row ──────────────────────────────────────────────────────────

interface GateRow {
  id: string
  status: "ok" | "warn" | "error"
  entry: PlainEnglishEntry
  issue?: GateIssueWire
}

interface GatesPanelProps {
  /** Active doc path; passed through on rubric run + autoFix posts. */
  docPath?: string
  /** Latest markdown — re-runs rubric (debounced) when this changes. */
  markdown?: string
  /** Optional doc-type id, defaults to "prd". */
  docType?: string
}

// ── Style tokens (mirrors ContractStudioTab) ─────────────────────────────

const paneBorder = "1px solid var(--vscode-panel-border)"
const dimText = "var(--vscode-descriptionForeground)"
const cardBg = "var(--vscode-editorWidget-background)"

const STATUS_COLOURS: Record<GateRow["status"], string> = {
  ok: "var(--vscode-testing-iconPassed, #4ec9b0)",
  warn: "var(--vscode-editorWarning-foreground, #cca700)",
  error: "var(--vscode-editorError-foreground, #f48771)",
}

// kilo-ui icon names — see packages/ui/src/components/icon.tsx for the full
// set. We use "circle-check" / "warning" / "circle-x" because there is no
// dedicated "error" glyph in that pack.
const STATUS_GLYPH: Record<GateRow["status"], "circle-check" | "warning" | "circle-x"> = {
  ok: "circle-check",
  warn: "warning",
  error: "circle-x",
}

const STATUS_ARIA: Record<GateRow["status"], string> = {
  ok: "Passing",
  warn: "Needs attention",
  error: "Failing",
}

// ── Component ────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 500

const GatesPanel: Component<GatesPanelProps> = (props) => {
  const vscode = useVSCode()
  const post = (m: Record<string, unknown>) => vscode.postMessage(m as never)

  // Latest rubric result from the host.
  const [issues, setIssues] = createSignal<GateIssueWire[]>([])
  const [passedGates, setPassedGates] = createSignal<string[]>([])
  const [failedGates, setFailedGates] = createSignal<string[]>([])
  const [score, setScore] = createSignal<number | null>(null)

  // Per-row "why this matters" expand state.
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({})

  // Per-category collapse state — all open by default.
  const initialCollapsed: Record<GateCategoryDisplay, boolean> = {
    truth: false,
    proof: false,
    safety: false,
    compliance: false,
  }
  const [collapsed, setCollapsed] = createSignal<Record<GateCategoryDisplay, boolean>>(initialCollapsed)

  // Override modal state.
  const [overrideForId, setOverrideForId] = createSignal<string | null>(null)
  const [overrideReason, setOverrideReason] = createSignal<string>("")

  // ── Build display rows from PLAIN_ENGLISH_LABELS + rubric result ──────
  const rows = createMemo<GateRow[]>(() => {
    const issueByGate = new Map<string, GateIssueWire>()
    for (const it of issues()) {
      if (it.gateId) issueByGate.set(it.gateId, it)
    }

    const failed = new Set(failedGates())
    const passed = new Set(passedGates())

    return Object.keys(PLAIN_ENGLISH_LABELS).map<GateRow>((id) => {
      const entry = lookupGate(id)
      const issue = issueByGate.get(id)
      let status: GateRow["status"] = "ok"
      if (failed.has(id) || (issue && issue.severity === "error")) {
        status = "error"
      } else if (issue && issue.severity === "warn") {
        status = "warn"
      } else if (issue && issue.severity === "info") {
        status = "warn"
      } else if (passed.has(id)) {
        status = "ok"
      } else if (issues().length === 0 && failedGates().length === 0 && passedGates().length === 0) {
        // No rubric run yet — treat as info-warn so user can see what is coming.
        status = "warn"
      }
      return { id, status, entry, issue }
    })
  })

  const passingCount = createMemo(() => rows().filter((r) => r.status === "ok").length)
  const totalCount = createMemo(() => rows().length)

  const grouped = createMemo<Record<GateCategoryDisplay, GateRow[]>>(() => {
    const out: Record<GateCategoryDisplay, GateRow[]> = {
      truth: [],
      proof: [],
      safety: [],
      compliance: [],
    }
    for (const r of rows()) {
      out[r.entry.category].push(r)
    }
    return out
  })

  // ── Host wiring ────────────────────────────────────────────────────────

  const onMessage = (event: MessageEvent) => {
    const msg = event.data as { type?: unknown } & RubricResultWire
    if (!msg || msg.type !== "contract:rubric:result") return
    if (props.docPath && msg.docPath && msg.docPath !== props.docPath) return
    setIssues(msg.issues ?? [])
    setPassedGates(msg.passedGates ?? [])
    setFailedGates(msg.failedGates ?? [])
    setScore(typeof msg.score === "number" ? msg.score : null)
  }

  // Debounced rubric re-run on edits.
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  createEffect(() => {
    const path = props.docPath
    // Track markdown so the effect re-runs.
    void props.markdown
    if (!path) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      post({ type: "contract:rubric:score", docPath: path })
    }, DEBOUNCE_MS)
  })

  onMount(() => {
    window.addEventListener("message", onMessage)
    if (props.docPath) {
      post({ type: "contract:rubric:score", docPath: props.docPath })
    }
  })
  onCleanup(() => {
    window.removeEventListener("message", onMessage)
    if (debounceTimer) clearTimeout(debounceTimer)
  })

  // ── Row actions ────────────────────────────────────────────────────────

  const onRowClick = (row: GateRow) => {
    if (!props.docPath || !row.issue?.line) return
    post({
      type: "contract:editor:scrollToLine",
      docPath: props.docPath,
      line: row.issue.line,
      column: row.issue.column ?? 0,
      gateId: row.id,
    })
  }

  const applyFix = (row: GateRow) => {
    if (!props.docPath || !row.issue) return
    post({
      type: "contract:gates:applyFix",
      docPath: props.docPath,
      gateId: row.id,
      issue: row.issue,
    })
  }

  const openOverride = (row: GateRow) => {
    setOverrideForId(row.id)
    setOverrideReason("")
  }

  const submitOverride = () => {
    const id = overrideForId()
    const reason = overrideReason().trim()
    if (!id || !reason) return
    post({
      type: "contract:gates:override",
      docPath: props.docPath,
      gateId: id,
      reason,
      // GovernanceService writes this to its append-only audit log.
      audit: true,
    })
    setOverrideForId(null)
    setOverrideReason("")
  }

  const cancelOverride = () => {
    setOverrideForId(null)
    setOverrideReason("")
  }

  const toggleExpanded = (id: string, e: MouseEvent) => {
    e.stopPropagation()
    setExpanded((m) => ({ ...m, [id]: !m[id] }))
  }

  const toggleCategory = (cat: GateCategoryDisplay) => {
    setCollapsed((m) => ({ ...m, [cat]: !m[cat] }))
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        "flex-direction": "column",
        gap: "8px",
        padding: "10px",
        height: "100%",
        overflow: "auto",
      }}
      role="region"
      aria-label="Contract gates panel"
    >
      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "10px",
          padding: "10px 12px",
          "border-radius": "6px",
          background: cardBg,
          border: paneBorder,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: "10px",
            height: "10px",
            "border-radius": "50%",
            background:
              passingCount() === totalCount()
                ? STATUS_COLOURS.ok
                : passingCount() === 0
                  ? STATUS_COLOURS.error
                  : STATUS_COLOURS.warn,
          }}
        />
        <div style={{ "font-size": "13px", "font-weight": 600 }}>
          {passingCount()} of {totalCount()} gates passing
        </div>
        <Show when={score() !== null}>
          <div style={{ "font-size": "12px", color: dimText, "margin-left": "auto" }}>
            score {(score() ?? 0).toFixed(2)}
          </div>
        </Show>
      </div>

      {/* Category sections */}
      <For each={CATEGORY_ORDER}>
        {(cat) => (
          <Show when={grouped()[cat].length > 0}>
            <section
              style={{
                "border-radius": "6px",
                background: cardBg,
                border: paneBorder,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => toggleCategory(cat)}
                style={{
                  display: "flex",
                  "align-items": "center",
                  gap: "6px",
                  width: "100%",
                  padding: "8px 10px",
                  "text-align": "left",
                  background: "transparent",
                  color: "var(--vscode-foreground)",
                  border: "none",
                  cursor: "pointer",
                  "font-size": "12px",
                  "font-weight": 600,
                }}
                aria-expanded={!collapsed()[cat]}
              >
                <Icon name={collapsed()[cat] ? "chevron-right" : "chevron-down"} size="small" />
                <span>{CATEGORY_TITLES[cat]}</span>
                <span style={{ "margin-left": "auto", color: dimText, "font-weight": 400 }}>
                  {grouped()[cat].filter((r) => r.status === "ok").length}/{grouped()[cat].length}
                </span>
              </button>

              <Show when={!collapsed()[cat]}>
                <ul style={{ "list-style": "none", margin: 0, padding: 0 }}>
                  <For each={grouped()[cat]}>
                    {(row) => (
                      <li
                        style={{ "border-top": paneBorder }}
                        data-gate-id={row.id}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => onRowClick(row)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              onRowClick(row)
                            }
                          }}
                          style={{
                            display: "flex",
                            "align-items": "flex-start",
                            gap: "8px",
                            padding: "8px 10px",
                            cursor: row.issue?.line ? "pointer" : "default",
                          }}
                        >
                          <span
                            aria-label={STATUS_ARIA[row.status]}
                            title={STATUS_ARIA[row.status]}
                            style={{
                              color: STATUS_COLOURS[row.status],
                              "margin-top": "1px",
                              display: "inline-flex",
                              "align-items": "center",
                            }}
                          >
                            <Icon name={STATUS_GLYPH[row.status]} size="small" />
                          </span>
                          <div style={{ flex: 1, "min-width": 0 }}>
                            <div style={{ "font-size": "13px", "font-weight": 500 }}>{row.entry.label}</div>
                            <div style={{ "font-size": "12px", color: dimText, "margin-top": "2px" }}>
                              {row.entry.whatItChecks}
                            </div>
                            <Show when={row.issue?.message}>
                              <div
                                style={{
                                  "font-size": "12px",
                                  color: STATUS_COLOURS[row.status],
                                  "margin-top": "4px",
                                }}
                              >
                                {row.issue?.message}
                                <Show when={row.issue?.line}>
                                  <span style={{ color: dimText, "margin-left": "6px" }}>
                                    (line {row.issue?.line})
                                  </span>
                                </Show>
                              </div>
                            </Show>

                            {/* Action row */}
                            <div
                              style={{
                                display: "flex",
                                "align-items": "center",
                                gap: "6px",
                                "margin-top": "6px",
                                "flex-wrap": "wrap",
                              }}
                            >
                              <button
                                type="button"
                                onClick={(e) => toggleExpanded(row.id, e)}
                                style={{
                                  background: "transparent",
                                  color: "var(--vscode-textLink-foreground)",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: 0,
                                  "font-size": "12px",
                                }}
                                aria-expanded={!!expanded()[row.id]}
                              >
                                {expanded()[row.id] ? "Hide details" : "Why this matters"}
                              </button>
                              <Show when={row.issue?.autoFix}>
                                <Button
                                  variant="ghost"
                                  size="small"
                                  onClick={() => applyFix(row)}
                                  title={row.entry.oneLinerFix}
                                >
                                  Apply suggested fix
                                </Button>
                              </Show>
                              <Show when={row.status !== "ok"}>
                                <Button
                                  variant="ghost"
                                  size="small"
                                  onClick={() => openOverride(row)}
                                  title="Skip this gate with a written reason. The reason is saved to the audit log."
                                >
                                  Override with reason
                                </Button>
                              </Show>
                            </div>

                            <Show when={expanded()[row.id]}>
                              <div
                                style={{
                                  "margin-top": "6px",
                                  padding: "8px 10px",
                                  "border-radius": "4px",
                                  background: "var(--vscode-textBlockQuote-background)",
                                  "font-size": "12px",
                                  "line-height": 1.5,
                                }}
                              >
                                <div>
                                  <strong>Why this matters.</strong> {row.entry.whyItMatters}
                                </div>
                                <div style={{ "margin-top": "4px" }}>
                                  <strong>How to fix.</strong> {row.entry.oneLinerFix}
                                </div>
                                <div style={{ "margin-top": "4px", color: dimText }}>
                                  Gate id: <code>{row.id}</code>
                                </div>
                              </div>
                            </Show>

                            <Show when={overrideForId() === row.id}>
                              <div
                                style={{
                                  "margin-top": "8px",
                                  padding: "8px 10px",
                                  "border-radius": "4px",
                                  background: "var(--vscode-input-background)",
                                  border: paneBorder,
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <label style={{ "font-size": "12px", "font-weight": 500 }}>
                                  Reason for override (audit-logged):
                                </label>
                                <textarea
                                  value={overrideReason()}
                                  onInput={(e) => setOverrideReason(e.currentTarget.value)}
                                  rows={2}
                                  style={{
                                    width: "100%",
                                    "margin-top": "4px",
                                    padding: "6px",
                                    "font-size": "12px",
                                    background: "var(--vscode-input-background)",
                                    color: "var(--vscode-input-foreground)",
                                    border: "1px solid var(--vscode-input-border)",
                                    "border-radius": "3px",
                                    resize: "vertical",
                                  }}
                                  placeholder="e.g. Risk accepted by Jane Doe — see ADR-0014."
                                />
                                <div style={{ display: "flex", gap: "6px", "margin-top": "6px" }}>
                                  <Button
                                    variant="primary"
                                    size="small"
                                    onClick={submitOverride}
                                    disabled={!overrideReason().trim()}
                                  >
                                    Save override
                                  </Button>
                                  <Button variant="ghost" size="small" onClick={cancelOverride}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </Show>
                          </div>
                        </div>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </section>
          </Show>
        )}
      </For>
    </div>
  )
}

export default GatesPanel
