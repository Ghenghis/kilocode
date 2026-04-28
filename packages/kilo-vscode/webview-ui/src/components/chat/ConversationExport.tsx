/**
 * ConversationExport — modal for exporting the current conversation.
 *
 * Formats: Markdown / JSON / HTML / Plain text
 * Range:   Full conversation / Last N messages / Selected messages (multi-select IDs)
 * Options: Include tool calls / Include system prompt / Include timestamps
 *
 * Triggers a browser download via URL.createObjectURL(new Blob([content])).
 *
 * Wire-in: render <ConversationExport open={open()} onClose={...} /> anywhere
 * in ChatView or TaskHeader, and gate on a `createSignal(false)`.
 */

import { Component, Show, For, createSignal, createMemo } from "solid-js"
import type { Message, TextPart, ToolPart } from "../../types/messages"
import type { MessageTurn } from "../../context/session-queue"

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type ExportFormat = "markdown" | "json" | "html" | "text"
export type ExportRange = "full" | "last-n" | "selected"

export interface ConversationExportProps {
  open: boolean
  onClose: () => void
  /** All resolved message turns in display order */
  turns: MessageTurn[]
  /** Optional set of selected message IDs from multi-select mode */
  selectedMessageIds?: Set<string>
  /** Session title for filename */
  sessionTitle?: string
}

// ──────────────────────────────────────────────────────────────────────────────
// Format helpers
// ──────────────────────────────────────────────────────────────────────────────

function getTextFromMessage(msg: Message, includeTools: boolean): string {
  if (!msg.parts) {
    return msg.content ?? ""
  }
  const parts = msg.parts as Array<TextPart | ToolPart | { type: string }>
  const lines: string[] = []
  for (const part of parts) {
    if (part.type === "text") {
      const tp = part as TextPart
      if (tp.text?.trim()) lines.push(tp.text.trim())
    } else if (includeTools && part.type === "tool") {
      const tp = part as ToolPart
      const state = tp.state
      const input = JSON.stringify(state.input ?? {}, null, 2)
      const output = state.status === "completed" ? state.output : state.status === "error" ? `ERROR: ${state.error}` : "(pending)"
      lines.push(`[Tool: ${tp.tool}]\nInput: ${input}\nOutput: ${output}`)
    }
  }
  return lines.join("\n\n")
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function isoTimestamp(msg: Message): string {
  return msg.time?.created ? new Date(msg.time.created).toISOString() : msg.createdAt ?? ""
}

// ──────────────────────────────────────────────────────────────────────────────
// Markdown export
// ──────────────────────────────────────────────────────────────────────────────

function exportMarkdown(
  turns: MessageTurn[],
  opts: { includeTools: boolean; includeTimestamps: boolean; includeSystemPrompt: boolean },
): string {
  const lines: string[] = []
  for (const turn of turns) {
    const userMsg = turn.user
    const assistantMessages = turn.assistant ?? []

    // User
    if (opts.includeTimestamps) lines.push(`<!-- ${isoTimestamp(userMsg)} -->`)
    lines.push("## User")
    lines.push("")
    const userText = getTextFromMessage(userMsg as unknown as Message, false)
    lines.push(userText || "_(no text)_")
    lines.push("")

    // Assistant messages
    for (const aMsg of assistantMessages) {
      if (opts.includeTimestamps) lines.push(`<!-- ${isoTimestamp(aMsg as unknown as Message)} -->`)
      lines.push("## Assistant")
      lines.push("")
      const aText = getTextFromMessage(aMsg as unknown as Message, opts.includeTools)
      lines.push(aText || "_(no text)_")
      lines.push("")
    }
  }
  return lines.join("\n")
}

// ──────────────────────────────────────────────────────────────────────────────
// Plain text export
// ──────────────────────────────────────────────────────────────────────────────

function exportText(
  turns: MessageTurn[],
  opts: { includeTools: boolean; includeTimestamps: boolean },
): string {
  const lines: string[] = []
  for (const turn of turns) {
    const userMsg = turn.user
    const assistantMessages = turn.assistant ?? []

    if (opts.includeTimestamps) lines.push(`[${isoTimestamp(userMsg as unknown as Message)}]`)
    lines.push("USER:")
    lines.push(getTextFromMessage(userMsg as unknown as Message, false) || "(no text)")
    lines.push("")

    for (const aMsg of assistantMessages) {
      if (opts.includeTimestamps) lines.push(`[${isoTimestamp(aMsg as unknown as Message)}]`)
      lines.push("ASSISTANT:")
      lines.push(getTextFromMessage(aMsg as unknown as Message, opts.includeTools) || "(no text)")
      lines.push("")
    }
  }
  return lines.join("\n")
}

// ──────────────────────────────────────────────────────────────────────────────
// JSON export
// ──────────────────────────────────────────────────────────────────────────────

function exportJSON(
  turns: MessageTurn[],
  opts: { includeTools: boolean; includeTimestamps: boolean },
  sessionTitle: string,
): string {
  const messages = turns.flatMap((turn) => {
    const result: Record<string, unknown>[] = []

    const userMsg = turn.user as unknown as Message
    const userEntry: Record<string, unknown> = {
      role: "user",
      content: getTextFromMessage(userMsg, false),
    }
    if (opts.includeTimestamps) userEntry.timestamp = isoTimestamp(userMsg)
    result.push(userEntry)

    for (const aMsg of (turn.assistant ?? []) as unknown as Message[]) {
      const aEntry: Record<string, unknown> = {
        role: "assistant",
        content: getTextFromMessage(aMsg, opts.includeTools),
      }
      if (opts.includeTimestamps) aEntry.timestamp = isoTimestamp(aMsg)
      if (opts.includeTools && aMsg.parts) {
        aEntry.parts = aMsg.parts
      }
      result.push(aEntry)
    }

    return result
  })

  return JSON.stringify(
    {
      title: sessionTitle,
      exportedAt: new Date().toISOString(),
      messages,
    },
    null,
    2,
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// HTML export
// ──────────────────────────────────────────────────────────────────────────────

function exportHTML(
  turns: MessageTurn[],
  opts: { includeTools: boolean; includeTimestamps: boolean },
  sessionTitle: string,
): string {
  const rows: string[] = []

  for (const turn of turns) {
    const userMsg = turn.user as unknown as Message
    const ts = opts.includeTimestamps ? `<small class="ts">${escapeHtml(isoTimestamp(userMsg))}</small>` : ""
    const userText = escapeHtml(getTextFromMessage(userMsg, false) || "(no text)")
      .replace(/\n/g, "<br>")
    rows.push(`
      <div class="turn">
        <div class="msg user">
          <div class="role">User ${ts}</div>
          <div class="body">${userText}</div>
        </div>`)

    for (const aMsg of (turn.assistant ?? []) as unknown as Message[]) {
      const aTs = opts.includeTimestamps ? `<small class="ts">${escapeHtml(isoTimestamp(aMsg))}</small>` : ""
      const aText = escapeHtml(getTextFromMessage(aMsg, opts.includeTools) || "(no text)")
        .replace(/```([\s\S]*?)```/g, (_m, c) => `<pre><code>${c}</code></pre>`)
        .replace(/\n/g, "<br>")
      rows.push(`
        <div class="msg assistant">
          <div class="role">Assistant ${aTs}</div>
          <div class="body">${aText}</div>
        </div>`)
    }

    rows.push(`</div>`)
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(sessionTitle)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #1e1e1e; color: #d4d4d4; line-height: 1.6; }
    h1 { font-size: 18px; margin-bottom: 24px; color: #ffffff; }
    .turn { margin-bottom: 24px; }
    .msg { padding: 12px 16px; border-radius: 8px; margin-bottom: 8px; }
    .msg.user { background: #252526; border-left: 3px solid #007acc; }
    .msg.assistant { background: #1e1e1e; border-left: 3px solid #3b9f3b; }
    .role { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin-bottom: 6px; }
    .ts { font-weight: 400; margin-left: 8px; font-size: 10px; opacity: 0.65; }
    .body { font-size: 13px; word-break: break-word; }
    pre { background: #0d0d0d; border-radius: 6px; padding: 12px; overflow-x: auto; font-size: 12px; }
    code { font-family: 'Cascadia Code', 'Fira Code', monospace; }
  </style>
</head>
<body>
  <h1>${escapeHtml(sessionTitle)}</h1>
  ${rows.join("\n")}
</body>
</html>`
}

// ──────────────────────────────────────────────────────────────────────────────
// Download helper
// ──────────────────────────────────────────────────────────────────────────────

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function safeFilename(title: string): string {
  return title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60) || "conversation"
}

// ──────────────────────────────────────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────────────────────────────────────

export const ConversationExport: Component<ConversationExportProps> = (props) => {
  const [format, setFormat] = createSignal<ExportFormat>("markdown")
  const [range, setRange] = createSignal<ExportRange>("full")
  const [lastN, setLastN] = createSignal(10)
  const [includeTools, setIncludeTools] = createSignal(false)
  const [includeTimestamps, setIncludeTimestamps] = createSignal(true)
  const [includeSystemPrompt, setIncludeSystemPrompt] = createSignal(false)
  const [exporting, setExporting] = createSignal(false)

  const hasSelected = createMemo(
    () => (props.selectedMessageIds?.size ?? 0) > 0,
  )

  const effectiveTurns = createMemo((): MessageTurn[] => {
    const all = props.turns
    const r = range()
    if (r === "full") return all
    if (r === "last-n") return all.slice(-Math.max(1, lastN()))
    if (r === "selected" && props.selectedMessageIds) {
      return all.filter((t) => props.selectedMessageIds!.has(t.user.id))
    }
    return all
  })

  const doExport = async () => {
    if (exporting()) return
    setExporting(true)
    try {
      const turns = effectiveTurns()
      const title = props.sessionTitle ?? "Conversation"
      const opts = {
        includeTools: includeTools(),
        includeTimestamps: includeTimestamps(),
        includeSystemPrompt: includeSystemPrompt(),
      }
      const fmt = format()
      const base = safeFilename(title)

      switch (fmt) {
        case "markdown": {
          const md = exportMarkdown(turns, opts)
          downloadFile(md, `${base}.md`, "text/markdown")
          break
        }
        case "json": {
          const json = exportJSON(turns, opts, title)
          downloadFile(json, `${base}.json`, "application/json")
          break
        }
        case "html": {
          const html = exportHTML(turns, opts, title)
          downloadFile(html, `${base}.html`, "text/html")
          break
        }
        case "text": {
          const txt = exportText(turns, opts)
          downloadFile(txt, `${base}.txt`, "text/plain")
          break
        }
      }
    } finally {
      setExporting(false)
      props.onClose()
    }
  }

  return (
    <Show when={props.open}>
      {/* Backdrop */}
      <div
        class="cex-backdrop"
        role="presentation"
        onClick={props.onClose}
      />

      {/* Modal */}
      <div
        class="cex-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Export conversation"
      >
        {/* Header */}
        <div class="cex-header">
          <span class="cex-title">Export Conversation</span>
          <button
            class="cex-close-btn"
            onClick={props.onClose}
            aria-label="Close export dialog"
            type="button"
          >
            &#x2715;
          </button>
        </div>

        {/* Body */}
        <div class="cex-body">
          {/* Format selector */}
          <div class="cex-section">
            <div class="cex-section-label">Format</div>
            <div class="cex-radio-group">
              <For each={["markdown", "json", "html", "text"] as ExportFormat[]}>
                {(f) => (
                  <label class="cex-radio-label">
                    <input
                      type="radio"
                      name="cex-format"
                      value={f}
                      checked={format() === f}
                      onChange={() => setFormat(f)}
                    />
                    <span class="cex-radio-text">{f.charAt(0).toUpperCase() + f.slice(1)}</span>
                  </label>
                )}
              </For>
            </div>
          </div>

          {/* Range selector */}
          <div class="cex-section">
            <div class="cex-section-label">Range</div>
            <div class="cex-radio-group cex-radio-group--col">
              <label class="cex-radio-label">
                <input
                  type="radio"
                  name="cex-range"
                  value="full"
                  checked={range() === "full"}
                  onChange={() => setRange("full")}
                />
                <span class="cex-radio-text">Full conversation ({props.turns.length} turns)</span>
              </label>
              <label class="cex-radio-label">
                <input
                  type="radio"
                  name="cex-range"
                  value="last-n"
                  checked={range() === "last-n"}
                  onChange={() => setRange("last-n")}
                />
                <span class="cex-radio-text">
                  Last&nbsp;
                  <input
                    class="cex-n-input"
                    type="number"
                    min="1"
                    max={props.turns.length}
                    value={lastN()}
                    onInput={(e) => setLastN(Math.max(1, parseInt(e.currentTarget.value, 10) || 1))}
                    onClick={(e) => { e.stopPropagation(); setRange("last-n") }}
                  />
                  &nbsp;messages
                </span>
              </label>
              <Show when={hasSelected()}>
                <label class="cex-radio-label">
                  <input
                    type="radio"
                    name="cex-range"
                    value="selected"
                    checked={range() === "selected"}
                    onChange={() => setRange("selected")}
                  />
                  <span class="cex-radio-text">
                    Selected messages ({props.selectedMessageIds?.size ?? 0})
                  </span>
                </label>
              </Show>
            </div>
          </div>

          {/* Include options */}
          <div class="cex-section">
            <div class="cex-section-label">Include</div>
            <div class="cex-checkbox-group">
              <label class="cex-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeTools()}
                  onChange={(e) => setIncludeTools(e.currentTarget.checked)}
                />
                <span>Tool calls</span>
              </label>
              <label class="cex-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeTimestamps()}
                  onChange={(e) => setIncludeTimestamps(e.currentTarget.checked)}
                />
                <span>Timestamps</span>
              </label>
              <label class="cex-checkbox-label">
                <input
                  type="checkbox"
                  checked={includeSystemPrompt()}
                  onChange={(e) => setIncludeSystemPrompt(e.currentTarget.checked)}
                />
                <span>System prompt (if available)</span>
              </label>
            </div>
          </div>

          {/* Preview line count */}
          <div class="cex-preview-note">
            Exporting {effectiveTurns().length} turn{effectiveTurns().length !== 1 ? "s" : ""} as{" "}
            <strong>{format().toUpperCase()}</strong>
          </div>
        </div>

        {/* Footer */}
        <div class="cex-footer">
          <button class="cex-cancel-btn" onClick={props.onClose} type="button">
            Cancel
          </button>
          <button
            class="cex-export-btn"
            onClick={doExport}
            disabled={exporting() || effectiveTurns().length === 0}
            type="button"
          >
            {exporting() ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>
    </Show>
  )
}
