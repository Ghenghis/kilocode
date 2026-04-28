/**
 * ToolCallBlock — rich, collapsible display for a single tool invocation.
 *
 * Features:
 * - Tool name with icon badge, colour-coded by category
 * - Animated execution state: pending → running → success / error
 * - Per-tool wall-clock timing shown after completion
 * - Collapsible input params (pretty-printed JSON, collapsed by default)
 * - Collapsible output (truncated to 8 lines, "Show more" toggle, streaming live)
 * - Clickable file-path link that posts openFile to the extension
 * - Error display in red with a retry button
 * - Diff stat "+N −M lines" if the tool wrote a file
 */

import { Component, createMemo, createSignal, Show, onMount, onCleanup } from "solid-js"
import { Icon, type IconProps } from "@kilocode/kilo-ui/icon"
import type { ToolPart, ToolState } from "../../types/messages"
import { useVSCode } from "../../context/vscode"
import { useToast } from "../ui/ToastSystem"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolCallBlockProps {
  /** The ToolPart to render. Reactive — pass a live getter when streaming. */
  part: ToolPart
  /**
   * Optional diff stat for file-writing tools.
   * Computed externally from inlineFileDiffs so this component stays pure.
   */
  diffStat?: { additions: number; deletions: number }
}

// ---------------------------------------------------------------------------
// Tool category helpers
// ---------------------------------------------------------------------------

type ToolCategory = "file" | "shell" | "web" | "code" | "other"

const FILE_TOOLS = new Set([
  "read", "write", "edit", "patch", "glob", "list", "readfile", "writefile",
  "editfile", "patchfile", "listdirectory", "readdir", "ls",
])
const SHELL_TOOLS = new Set([
  "bash", "shell", "exec", "run", "terminal", "command", "execute",
])
const WEB_TOOLS = new Set([
  "fetch", "web", "browse", "search", "websearch", "webcrawl", "webbrowse",
  "screenshot", "puppeteer",
])
const CODE_TOOLS = new Set([
  "grep", "ripgrep", "find", "codebase_search", "codebasesearch", "semantic_search",
  "symbolfinder", "ast", "lsp", "diagnostics",
])

function getCategory(tool: string): ToolCategory {
  const t = tool.toLowerCase().replace(/[-_]/g, "")
  if (FILE_TOOLS.has(t)) return "file"
  if (SHELL_TOOLS.has(t)) return "shell"
  if (WEB_TOOLS.has(t)) return "web"
  if (CODE_TOOLS.has(t)) return "code"
  return "other"
}

// Category → icon name (VS Code Codicon names used by @kilocode/kilo-ui/icon)
const CATEGORY_ICON: Record<ToolCategory, IconProps["name"]> = {
  file: "file",
  shell: "terminal",
  web: "globe",
  code: "search",
  other: "tools",
}

// ---------------------------------------------------------------------------
// JSON syntax highlighter (pure HTML string, no external dep)
// ---------------------------------------------------------------------------

function syntaxHighlightJson(json: string): string {
  // Escape first, then apply spans
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "kc-json-number"
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "kc-json-key" : "kc-json-string"
        } else if (/true|false/.test(match)) {
          cls = "kc-json-bool"
        } else if (/null/.test(match)) {
          cls = "kc-json-null"
        }
        return `<span class="${cls}">${match}</span>`
      },
    )
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

function getStatus(state: ToolState): "pending" | "running" | "success" | "error" {
  switch (state.status) {
    case "pending": return "pending"
    case "running": return "running"
    case "completed": return "success"
    case "error": return "error"
  }
}

// Detect whether a string looks like an absolute file path
function looksLikeFilePath(s: string): boolean {
  return /^(?:[A-Za-z]:\\|\/)[^\n\r]{2,}$/.test(s.trim())
}

// Extract the first file path from the tool input, if any
function extractFilePath(input: Record<string, unknown>): string | undefined {
  for (const key of ["file_path", "path", "filepath", "file", "filename"]) {
    const v = input[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StateIndicator: Component<{ status: "pending" | "running" | "success" | "error" }> = (props) => (
  <span
    class={`kc-tool-state kc-tool-state-${props.status}`}
    title={props.status}
    aria-label={`Tool ${props.status}`}
  >
    <Show when={props.status === "pending"}>
      <span class="kc-tool-dot-pulse" />
    </Show>
    <Show when={props.status === "running"}>
      <span class="kc-tool-spinner" />
    </Show>
    <Show when={props.status === "success"}>
      <Icon name="check" size="small" />
    </Show>
    <Show when={props.status === "error"}>
      <Icon name={"error" as IconProps["name"]} size="small" />
    </Show>
  </span>
)

interface CollapsibleJsonProps {
  label: string
  value: unknown
  defaultOpen?: boolean
}

const CollapsibleJson: Component<CollapsibleJsonProps> = (props) => {
  const [open, setOpen] = createSignal(props.defaultOpen ?? false)
  const highlighted = createMemo(() => syntaxHighlightJson(prettyJson(props.value)))

  return (
    <div class="kc-tool-collapsible">
      <button
        class="kc-tool-collapsible-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open()}
      >
        <span class={`kc-tool-chevron ${open() ? "kc-tool-chevron--open" : ""}`}>
          <Icon name="chevron-right" size="small" />
        </span>
        <span class="kc-tool-collapsible-label">{props.label}</span>
      </button>
      <Show when={open()}>
        <pre
          class="kc-tool-json-pre"
          // eslint-disable-next-line solid/no-innerhtml
          innerHTML={highlighted()}
        />
      </Show>
    </div>
  )
}

interface CollapsibleOutputProps {
  output: string
  streaming?: boolean
}

const OUTPUT_LINE_LIMIT = 8

const CollapsibleOutput: Component<CollapsibleOutputProps> = (props) => {
  const [expanded, setExpanded] = createSignal(false)

  const lines = createMemo(() => props.output.split("\n"))
  const overLimit = createMemo(() => lines().length > OUTPUT_LINE_LIMIT)
  const visibleText = createMemo(() => {
    if (expanded() || !overLimit()) return props.output
    return lines().slice(0, OUTPUT_LINE_LIMIT).join("\n")
  })

  return (
    <div class="kc-tool-output">
      <pre class="kc-tool-output-pre">{visibleText()}</pre>
      <Show when={overLimit()}>
        <button class="kc-tool-output-toggle" onClick={() => setExpanded((v) => !v)}>
          {expanded()
            ? "Show less"
            : `Show more (${lines().length - OUTPUT_LINE_LIMIT} more lines)`}
        </button>
      </Show>
      <Show when={props.streaming}>
        <span class="kc-tool-streaming-indicator" aria-label="Streaming" />
      </Show>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const ToolCallBlock: Component<ToolCallBlockProps> = (props) => {
  const vscode = useVSCode()
  // useToast may be unavailable in Storybook / sub-agent contexts not wrapped
  // by ToastProvider — catch and degrade gracefully.
  let toast: ReturnType<typeof useToast> | undefined
  try { toast = useToast() } catch { toast = undefined }

  const state = createMemo(() => props.part.state)
  const status = createMemo(() => getStatus(state()))
  const category = createMemo(() => getCategory(props.part.tool))

  // Wall-clock timing: record when running starts, compute elapsed when done
  const [startedAt, setStartedAt] = createSignal<number | undefined>(undefined)
  const [elapsedMs, setElapsedMs] = createSignal<number | undefined>(undefined)

  // Track running start time reactively
  let prevStatus = status()
  const rafRef = { id: 0 }

  onMount(() => {
    const tick = () => {
      const s = status()
      if (s === "running" && prevStatus !== "running") {
        setStartedAt(Date.now())
        setElapsedMs(undefined)
      }
      if ((s === "success" || s === "error") && prevStatus === "running") {
        const t = startedAt()
        if (t !== undefined) setElapsedMs(Date.now() - t)

        // ── Toast notifications on state transition ──────────────────────────
        if (toast) {
          if (s === "success" && category() === "file") {
            // File successfully edited — show the filename if available
            const fp = extractFilePath(
              (state() as { input?: Record<string, unknown> }).input ?? {},
            )
            const name = fp ? fp.split(/[/\\]/).pop() ?? fp : props.part.tool
            toast.show({ message: `${name} updated`, type: "success" })
          } else if (s === "error") {
            const errState = state()
            const errMsg =
              errState.status === "error" ? errState.error : "Tool call failed"
            toast.show({ message: errMsg, type: "error" })
          }
        }
      }
      prevStatus = s
      rafRef.id = requestAnimationFrame(tick)
    }
    rafRef.id = requestAnimationFrame(tick)
    onCleanup(() => cancelAnimationFrame(rafRef.id))
  })

  const timing = createMemo(() => {
    const ms = elapsedMs()
    if (ms === undefined) return undefined
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`
  })

  // Input params (collapsed by default)
  const inputParams = createMemo<Record<string, unknown>>(() => {
    const s = state()
    return (s.input ?? {}) as Record<string, unknown>
  })

  // Output text
  const outputText = createMemo<string | undefined>(() => {
    const s = state()
    if (s.status === "completed") return s.output
    return undefined
  })

  // Error message
  const errorText = createMemo<string | undefined>(() => {
    const s = state()
    if (s.status === "error") return s.error
    return undefined
  })

  // File path from input — for clickable link
  const filePath = createMemo(() => extractFilePath(inputParams()))

  // Output as file path?
  const outputAsFilePath = createMemo(() => {
    const out = outputText()
    if (!out) return undefined
    const trimmed = out.trim()
    return looksLikeFilePath(trimmed) ? trimmed : undefined
  })

  // Whether the tool is a file-writing tool with a diff stat
  const hasDiff = createMemo(() => !!props.diffStat && (props.diffStat.additions > 0 || props.diffStat.deletions > 0))

  // Title shown in header (use state.title when available, fall back to tool name)
  const displayTitle = createMemo(() => {
    const s = state()
    if (s.status === "completed" || s.status === "running") {
      const t = (s as { title?: string }).title
      if (t) return t
    }
    return props.part.tool
  })

  // Streaming: running + output already has partial content
  const isStreaming = createMemo(
    () =>
      status() === "running" &&
      typeof (state() as unknown as { output?: string }).output === "string",
  )

  const streamingOutput = createMemo<string | undefined>(() => {
    if (!isStreaming()) return undefined
    return (state() as unknown as { output?: string }).output
  })

  const openFile = (path: string) => {
    vscode.postMessage({ type: "openFile", filePath: path })
  }

  const retryTool = () => {
    // retryToolRequest is a custom extension message not in the typed union —
    // use a best-effort cast so the extension can handle it if registered.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vscode.postMessage({ type: "retryToolRequest", partId: props.part.id } as any)
  }

  return (
    <div
      class={`kc-tool-block kc-tool-category-${category()}`}
      data-tool={props.part.tool}
      data-status={status()}
    >
      {/* ── Header ── */}
      <div class="kc-tool-block-header">
        {/* Category icon badge */}
        <span class={`kc-tool-icon-badge kc-tool-icon-badge--${category()}`} aria-hidden="true">
          <Icon name={CATEGORY_ICON[category()]} size="small" />
        </span>

        {/* Tool name */}
        <span class="kc-tool-name" title={props.part.tool}>
          {displayTitle()}
        </span>

        {/* File path link */}
        <Show when={filePath()}>
          {(fp) => (
            <button
              class="kc-tool-filepath-link"
              onClick={() => openFile(fp())}
              title={`Open ${fp()}`}
            >
              <Icon name="go-to-file" size="small" />
              <span class="kc-tool-filepath-label">{fp().split(/[/\\]/).pop()}</span>
            </button>
          )}
        </Show>

        {/* Spacer */}
        <span class="kc-tool-header-spacer" />

        {/* Diff stat */}
        <Show when={hasDiff()}>
          <span class="kc-tool-diff-stat" aria-label="Diff changes">
            <Show when={(props.diffStat?.additions ?? 0) > 0}>
              <span class="kc-tool-diff-add">+{props.diffStat!.additions}</span>
            </Show>
            <Show when={(props.diffStat?.deletions ?? 0) > 0}>
              <span class="kc-tool-diff-del">−{props.diffStat!.deletions}</span>
            </Show>
          </span>
        </Show>

        {/* Timing */}
        <Show when={timing()}>
          {(t) => <span class="kc-tool-timing">ran in {t()}</span>}
        </Show>

        {/* State indicator */}
        <StateIndicator status={status()} />
      </div>

      {/* ── Body ── */}
      <div class="kc-tool-block-body">
        {/* Input params — collapsed by default */}
        <Show when={Object.keys(inputParams()).length > 0}>
          <CollapsibleJson label="Input" value={inputParams()} defaultOpen={false} />
        </Show>

        {/* Live streaming output while running */}
        <Show when={isStreaming() && streamingOutput()}>
          {(out) => <CollapsibleOutput output={out()} streaming />}
        </Show>

        {/* Completed output */}
        <Show when={!isStreaming() && outputText()}>
          {(out) => (
            <Show
              when={outputAsFilePath()}
              fallback={<CollapsibleOutput output={out()} />}
            >
              {(fp) => (
                <div class="kc-tool-output-filepath">
                  <button
                    class="kc-tool-filepath-link kc-tool-filepath-link--output"
                    onClick={() => openFile(fp())}
                    title={`Open ${fp()}`}
                  >
                    <Icon name="go-to-file" size="small" />
                    <span>{fp()}</span>
                  </button>
                </div>
              )}
            </Show>
          )}
        </Show>

        {/* Error display */}
        <Show when={errorText()}>
          {(err) => (
            <div class="kc-tool-error">
              <Icon name={"error" as IconProps["name"]} size="small" />
              <span class="kc-tool-error-text">{err()}</span>
              <button class="kc-tool-retry-btn" onClick={retryTool} title="Retry this tool call">
                <Icon name="refresh" size="small" />
                Retry
              </button>
            </div>
          )}
        </Show>
      </div>
    </div>
  )
}
