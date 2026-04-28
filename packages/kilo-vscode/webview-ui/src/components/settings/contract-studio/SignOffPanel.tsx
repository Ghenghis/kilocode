/**
 * SignOffPanel — non-coder acceptance UX (Anchor 3, "user-acceptance-signed").
 *
 * Lists every acceptance criterion in the active contract. For each row:
 *   • Plain-English criterion text
 *   • "View test recording" button → opens the trace.zip URL the host posts
 *     for the matching verification run (Playwright trace, Cypress replay).
 *   • "Approve" / "Needs work" buttons that post `contract:trace:approve` or
 *     `contract:trace:reject` with `{ criterionId, traceUrl, signedBy }` —
 *     the host writes a time-stamped audit trail.
 *
 * Visual states:
 *   • ✅ approved — green, signature time + name shown
 *   • ⏳ awaiting — yellow, both buttons enabled
 *   • ❌ rejected — red, "Approve" only re-enabled if a fresh trace lands
 *
 * On mount the panel posts `contract:trace:list` to load existing sign-off
 * statuses; later updates arrive via `contract:trace:update`.
 *
 * SolidJS rules: signals at top, `<For>`, `onCleanup`. No new deps.
 */

import { Component, createSignal, For, Show, onMount, onCleanup } from "solid-js"
import { Icon } from "@kilocode/kilo-ui/icon"
import { Button } from "@kilocode/kilo-ui/button"
import { useVSCode } from "../../../context/vscode"

// ── Wire types ──────────────────────────────────────────────────────────

type SignOffStatus = "approved" | "awaiting" | "rejected"

interface CriterionWire {
  id: string
  text: string
  storyId?: string
  /** Latest trace.zip URL (CI artifact link or local file URI). */
  traceUrl?: string
  status: SignOffStatus
  signedBy?: string
  signedAt?: string
  /** Optional reviewer note saved in the audit trail. */
  note?: string
}

interface TraceListResultWire {
  type: "contract:trace:list:result"
  docPath?: string
  criteria: CriterionWire[]
  /** Display name of the current user — used as `signedBy` on approve. */
  currentUser?: string
}

interface TraceUpdateWire {
  type: "contract:trace:update"
  docPath?: string
  criterion: CriterionWire
}

// ── Props ────────────────────────────────────────────────────────────────

interface SignOffPanelProps {
  docPath?: string
}

// ── Style tokens (mirrors GatesPanel) ────────────────────────────────────

const paneBorder = "1px solid var(--vscode-panel-border)"
const dimText = "var(--vscode-descriptionForeground)"
const cardBg = "var(--vscode-editorWidget-background)"

const STATUS_COLOURS: Record<SignOffStatus, string> = {
  approved: "var(--vscode-testing-iconPassed, #4ec9b0)",
  awaiting: "var(--vscode-editorWarning-foreground, #cca700)",
  rejected: "var(--vscode-editorError-foreground, #f48771)",
}

// kilo-ui icon names (see packages/ui/src/components/icon.tsx). We use
// "circle-check" for approved, "history" as a stand-in for a clock, and
// "circle-x" for rejected — there is no dedicated "error" or "clock" glyph.
const STATUS_GLYPH: Record<SignOffStatus, "circle-check" | "history" | "circle-x"> = {
  approved: "circle-check",
  awaiting: "history",
  rejected: "circle-x",
}

const STATUS_TITLE: Record<SignOffStatus, string> = {
  approved: "Approved",
  awaiting: "Awaiting sign-off",
  rejected: "Rejected — needs work",
}

// ── Component ────────────────────────────────────────────────────────────

const SignOffPanel: Component<SignOffPanelProps> = (props) => {
  const vscode = useVSCode()
  const post = (m: Record<string, unknown>) => vscode.postMessage(m as never)

  const [criteria, setCriteria] = createSignal<CriterionWire[]>([])
  const [currentUser, setCurrentUser] = createSignal<string>("")
  const [pendingId, setPendingId] = createSignal<string | null>(null)

  // ── Host wiring ────────────────────────────────────────────────────────

  const onMessage = (event: MessageEvent) => {
    const msg = event.data as { type?: unknown }
    if (!msg || typeof msg.type !== "string") return
    if (msg.type === "contract:trace:list:result") {
      const m = msg as TraceListResultWire
      if (props.docPath && m.docPath && m.docPath !== props.docPath) return
      setCriteria(m.criteria ?? [])
      setCurrentUser(m.currentUser ?? "")
      return
    }
    if (msg.type === "contract:trace:update") {
      const m = msg as TraceUpdateWire
      if (props.docPath && m.docPath && m.docPath !== props.docPath) return
      const incoming = m.criterion
      setCriteria((prev) => {
        const idx = prev.findIndex((c) => c.id === incoming.id)
        if (idx === -1) return [...prev, incoming]
        const copy = prev.slice()
        copy[idx] = incoming
        return copy
      })
      setPendingId((p) => (p === incoming.id ? null : p))
    }
  }

  onMount(() => {
    window.addEventListener("message", onMessage)
    post({ type: "contract:trace:list", docPath: props.docPath })
  })
  onCleanup(() => window.removeEventListener("message", onMessage))

  // ── Actions ────────────────────────────────────────────────────────────

  const viewTrace = (c: CriterionWire) => {
    if (!c.traceUrl) {
      post({ type: "contract:trace:request", docPath: props.docPath, criterionId: c.id })
      return
    }
    post({ type: "contract:trace:open", docPath: props.docPath, criterionId: c.id, traceUrl: c.traceUrl })
  }

  const approve = (c: CriterionWire) => {
    setPendingId(c.id)
    post({
      type: "contract:trace:approve",
      docPath: props.docPath,
      criterionId: c.id,
      traceUrl: c.traceUrl,
      signedBy: currentUser() || "you",
    })
  }

  const reject = (c: CriterionWire) => {
    setPendingId(c.id)
    post({
      type: "contract:trace:reject",
      docPath: props.docPath,
      criterionId: c.id,
      traceUrl: c.traceUrl,
      signedBy: currentUser() || "you",
    })
  }

  // ── Summary counts ────────────────────────────────────────────────────

  const approvedCount = () => criteria().filter((c) => c.status === "approved").length
  const totalCount = () => criteria().length

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
      aria-label="Sign-off panel"
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
        <Icon name="checklist" size="small" />
        <div style={{ "font-size": "13px", "font-weight": 600 }}>
          {approvedCount()} of {totalCount()} acceptance items approved
        </div>
        <div style={{ "margin-left": "auto", "font-size": "12px", color: dimText }}>
          <Show when={currentUser()} fallback={<span>not signed in</span>}>
            <span>signing as {currentUser()}</span>
          </Show>
        </div>
      </div>

      {/* Empty state */}
      <Show
        when={criteria().length > 0}
        fallback={
          <div
            style={{
              padding: "16px",
              "border-radius": "6px",
              background: cardBg,
              border: paneBorder,
              "font-size": "13px",
              color: dimText,
            }}
          >
            No acceptance criteria found in this contract yet. Add a "Given / When / Then" block
            and the studio will list it here.
          </div>
        }
      >
        <ul style={{ "list-style": "none", margin: 0, padding: 0, display: "flex", "flex-direction": "column", gap: "8px" }}>
          <For each={criteria()}>
            {(c) => (
              <li
                style={{
                  "border-radius": "6px",
                  background: cardBg,
                  border: paneBorder,
                  padding: "10px 12px",
                }}
                data-criterion-id={c.id}
              >
                <div style={{ display: "flex", "align-items": "flex-start", gap: "10px" }}>
                  <span
                    title={STATUS_TITLE[c.status]}
                    aria-label={STATUS_TITLE[c.status]}
                    style={{
                      color: STATUS_COLOURS[c.status],
                      display: "inline-flex",
                      "align-items": "center",
                      "margin-top": "1px",
                    }}
                  >
                    <Icon name={STATUS_GLYPH[c.status]} size="small" />
                  </span>
                  <div style={{ flex: 1, "min-width": 0 }}>
                    <div style={{ "font-size": "13px", "font-weight": 500 }}>{c.text}</div>
                    <Show when={c.storyId}>
                      <div style={{ "font-size": "11px", color: dimText, "margin-top": "2px" }}>
                        Story: <code>{c.storyId}</code>
                      </div>
                    </Show>
                    <Show when={c.signedBy && c.signedAt}>
                      <div style={{ "font-size": "11px", color: dimText, "margin-top": "4px" }}>
                        {c.status === "approved" ? "Approved" : "Last action"} by{" "}
                        <strong>{c.signedBy}</strong> at{" "}
                        <time dateTime={c.signedAt}>{c.signedAt}</time>
                        <Show when={c.note}>
                          <span> — {c.note}</span>
                        </Show>
                      </div>
                    </Show>

                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        "margin-top": "8px",
                        "flex-wrap": "wrap",
                      }}
                    >
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => viewTrace(c)}
                        title="Open the recording of the test that backs this acceptance item."
                      >
                        <Icon name="play" size="small" />
                        <span style={{ "margin-left": "4px" }}>View test recording</span>
                      </Button>
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => approve(c)}
                        disabled={pendingId() === c.id || c.status === "approved"}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="small"
                        onClick={() => reject(c)}
                        disabled={pendingId() === c.id || c.status === "rejected"}
                      >
                        Needs work
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </div>
  )
}

export default SignOffPanel
