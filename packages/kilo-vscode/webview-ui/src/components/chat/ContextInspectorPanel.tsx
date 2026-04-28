/**
 * ContextInspectorPanel — Feature 1
 *
 * Floating draggable panel (toggle Ctrl+I or toolbar button) that shows exactly
 * what is in the current AI context:
 *   - System prompt preview (expandable, first 500 chars)
 *   - Active .kilo/rules/* files
 *   - @mention referenced files
 *   - Per-message token count
 *   - Tool-call history summary
 *   - Total tokens used / context window remaining
 */

import {
  Component,
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
  onMount,
  onCleanup,
} from "solid-js"
import { useSession } from "../../context/session"
import { useProvider } from "../../context/provider"
import type { Part, ToolPart } from "../../types/messages"
import { createFocusTrap, type FocusTrap } from "../../utils/focusTrap"

interface ContextInspectorPanelProps {
  open: boolean
  onClose: () => void
}

export const ContextInspectorPanel: Component<ContextInspectorPanelProps> = (props) => {
  const session = useSession()
  const provider = useProvider()

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [pos, setPos] = createSignal({ x: 0, y: 60 })
  let dragging = false
  let dragOffset = { x: 0, y: 0 }
  let panelRef: HTMLDivElement | undefined
  let focusTrap: FocusTrap | null = null

  // Focus trap — activate when panel opens, deactivate when it closes
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (open) {
          requestAnimationFrame(() => {
            if (panelRef) {
              focusTrap = createFocusTrap(panelRef)
            }
          })
        } else {
          focusTrap?.deactivate()
          focusTrap = null
        }
      },
    ),
  )

  onCleanup(() => {
    focusTrap?.deactivate()
  })

  function onMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (target.closest("[data-ci-no-drag]")) return
    dragging = true
    dragOffset = { x: e.clientX - pos().x, y: e.clientY - pos().y }
    e.preventDefault()
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragging) return
    setPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y })
  }

  function onMouseUp() { dragging = false }

  onMount(() => {
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", onMouseUp)
    onCleanup(() => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", onMouseUp)
    })
  })

  // ── Expandable system prompt ────────────────────────────────────────────────
  const [sysExpanded, setSysExpanded] = createSignal(false)

  // ── Data derivations ────────────────────────────────────────────────────────
  const messages = createMemo(() => session.messages())

  /** Collect all tool parts from all messages. */
  const toolHistory = createMemo(() => {
    const result: Array<{ tool: string; status: string; msgIdx: number }> = []
    messages().forEach((msg, idx) => {
      const parts: Part[] = session.getParts(msg.id)
      parts.forEach((p) => {
        if (p.type === "tool") {
          const tp = p as ToolPart
          result.push({
            tool: tp.tool,
            status: tp.state?.status ?? "?",
            msgIdx: idx + 1,
          })
        }
      })
    })
    return result.slice(-20) // show last 20 tool calls
  })

  /** Collect @-mentioned files from all user message text parts. */
  const mentionedFiles = createMemo(() => {
    const FILE_RE = /(?<![\w`])@(\.?[^\s`,.]*(?:\.[^\s`,.]+)*)/g
    const files = new Set<string>()
    messages().forEach((msg) => {
      if (msg.role !== "user") return
      const parts: Part[] = session.getParts(msg.id)
      parts.forEach((p) => {
        if (p.type === "text") {
          const matches = [...((p as { text: string }).text ?? "").matchAll(FILE_RE)]
          matches.forEach((m) => files.add(m[1]))
        }
      })
    })
    return [...files]
  })

  /** Per-message token count (from StepFinishPart data on assistant messages). */
  const msgTokens = createMemo(() => {
    return messages()
      .filter((m) => m.role === "assistant" && m.tokens)
      .map((m, i) => ({
        idx: i + 1,
        id: m.id.slice(-6),
        tokens: m.tokens!,
      }))
  })

  /** Context window totals. */
  const contextUsage = createMemo(() => session.contextUsage())
  const sel = createMemo(() => session.selected())
  const model = createMemo(() => {
    const s = sel()
    return s ? provider.findModel(s) : undefined
  })
  const contextLimit = createMemo(() => {
    const m = model()
    return m?.limit?.context ?? m?.contextLength ?? 0
  })

  /** Fake system-prompt preview — built from what we know about the env block. */
  const systemPromptPreview = createMemo(() => {
    const m = model()
    const sid = session.currentSessionID()
    if (!m || !sid) return ""
    return (
      `You are powered by the model named ${m.name ?? m.id}.\n` +
      `Session: ${sid.slice(-8)}\n` +
      `Context limit: ${(contextLimit() / 1000).toFixed(0)}K tokens\n` +
      `[AGENTS.md / rules are injected here by the extension host]`
    )
  })

  const fmtNum = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }

  return (
    <Show when={props.open}>
      <div
        ref={panelRef}
        class="ci-panel"
        style={{
          transform: `translate(${pos().x}px, ${pos().y}px)`,
        }}
        onMouseDown={onMouseDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ci-panel-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault()
            e.stopPropagation()
            props.onClose()
          }
        }}
      >
        {/* Header */}
        <div class="ci-header">
          <span id="ci-panel-title" class="ci-title">Context Inspector</span>
          <button
            class="ci-close"
            data-ci-no-drag
            onClick={props.onClose}
            aria-label="Close context inspector"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div class="ci-body" data-ci-no-drag>
          {/* System prompt */}
          <section class="ci-section" role="region" aria-label="System prompt preview">
            <div class="ci-section-title" id="ci-sec-sys">System Prompt</div>
            <div class="ci-sys-prompt" aria-labelledby="ci-sec-sys">
              {sysExpanded()
                ? systemPromptPreview()
                : systemPromptPreview().slice(0, 500) + (systemPromptPreview().length > 500 ? "…" : "")}
            </div>
            <Show when={systemPromptPreview().length > 500}>
              <button
                class="ci-expand-btn"
                onClick={() => setSysExpanded((v) => !v)}
                aria-expanded={sysExpanded()}
              >
                {sysExpanded() ? "Show less" : "Show more"}
              </button>
            </Show>
          </section>

          {/* Referenced files */}
          <section class="ci-section" role="region" aria-label="Referenced files">
            <div class="ci-section-title">
              Referenced Files (@mentions)
              <span class="ci-badge" aria-label={`${mentionedFiles().length} files`}>{mentionedFiles().length}</span>
            </div>
            <Show when={mentionedFiles().length > 0} fallback={<div class="ci-empty">None</div>}>
              <ul class="ci-file-list">
                <For each={mentionedFiles()}>
                  {(f) => <li class="ci-file-item">{f}</li>}
                </For>
              </ul>
            </Show>
          </section>

          {/* Per-message token count */}
          <section class="ci-section" role="region" aria-label="Message token counts">
            <div class="ci-section-title">Message Token Counts</div>
            <Show when={msgTokens().length > 0} fallback={<div class="ci-empty">No assistant turns yet</div>}>
              <ul class="ci-token-list">
                <For each={msgTokens()}>
                  {(entry) => (
                    <li class="ci-token-item">
                      <span class="ci-token-label">
                        Turn {entry.idx}
                        <span class="ci-token-id"> #{entry.id}</span>
                      </span>
                      <span class="ci-token-value">
                        <span aria-label={`Input ${fmtNum(entry.tokens.input)}, Output ${fmtNum(entry.tokens.output)}`}>
                          ↑{fmtNum(entry.tokens.input)} ↓{fmtNum(entry.tokens.output)}
                        </span>
                        <Show when={(entry.tokens.cache?.read ?? 0) > 0}>
                          <span class="ci-token-cache" aria-label={`Cache read ${fmtNum(entry.tokens.cache!.read)}`}>
                            {" "}cache↓{fmtNum(entry.tokens.cache!.read)}
                          </span>
                        </Show>
                      </span>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </section>

          {/* Context window */}
          <section class="ci-section" role="region" aria-label="Context window usage">
            <div class="ci-section-title">Context Window</div>
            <Show when={contextUsage()} fallback={<div class="ci-empty">No data yet</div>}>
              {(u) => {
                const used = u().tokens
                const limit = contextLimit()
                const remaining = limit > 0 ? limit - used : undefined
                const pct = limit > 0 ? Math.round((used / limit) * 100) : null
                return (
                  <div class="ci-ctx-stats">
                    <div class="ci-ctx-row">
                      <span>Used</span>
                      <span class="ci-ctx-val">
                        {fmtNum(used)}{pct !== null ? ` (${pct}%)` : ""}
                      </span>
                    </div>
                    <Show when={limit > 0}>
                      <div class="ci-ctx-row">
                        <span>Limit</span>
                        <span class="ci-ctx-val">{fmtNum(limit)}</span>
                      </div>
                    </Show>
                    <Show when={remaining !== undefined}>
                      <div class="ci-ctx-row">
                        <span>Remaining</span>
                        <span
                          class="ci-ctx-val"
                          classList={{ "ci-ctx-warn": pct !== null && pct >= 70 }}
                        >
                          {fmtNum(remaining!)}
                        </span>
                      </div>
                    </Show>
                  </div>
                )
              }}
            </Show>
          </section>

          {/* Tool call history */}
          <section class="ci-section" role="region" aria-label="Tool call history">
            <div class="ci-section-title">
              Tool Call History
              <span class="ci-badge" aria-label={`${toolHistory().length} tool calls`}>{toolHistory().length}</span>
            </div>
            <Show when={toolHistory().length > 0} fallback={<div class="ci-empty">No tool calls yet</div>}>
              <ul class="ci-tool-list">
                <For each={toolHistory()}>
                  {(entry) => (
                    <li class="ci-tool-item">
                      <span
                        class="ci-tool-status"
                        classList={{
                          "ci-tool-status--ok": entry.status === "completed",
                          "ci-tool-status--err": entry.status === "error",
                          "ci-tool-status--run": entry.status === "running",
                        }}
                        aria-label={
                          entry.status === "completed" ? "Completed"
                          : entry.status === "error" ? "Error"
                          : "Running"
                        }
                      >
                        <span aria-hidden="true">
                          {entry.status === "completed" ? "✓" : entry.status === "error" ? "✗" : "◌"}
                        </span>
                      </span>
                      <span class="ci-tool-name">{entry.tool}</span>
                      <span class="ci-tool-turn">turn {entry.msgIdx}</span>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </section>
        </div>
      </div>
    </Show>
  )
}
