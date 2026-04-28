/**
 * FileChangeFeatures — game-changing file change awareness for KiloCode canary.10
 *
 * Feature 1: Inline file diff preview
 *   - Expandable inline diff inside a chat message when a toolResult includes a diff object.
 *   - Renders added (green +), removed (red -), context lines, line numbers.
 *   - "Open file" and "Revert this change" action buttons.
 *
 * Feature 2: File change timeline panel
 *   - Collapsible panel listing all files modified in the current task.
 *   - File icon + path, lines added/removed, timestamp, action buttons.
 *   - Accessible via "Changes (N)" badge in the chat toolbar.
 *
 * Feature 3: Multi-file edit preview card
 *   - Shown before a series of file edits with summary + per-file details.
 *   - "Apply all" / "Review each" / "Cancel" buttons.
 *   - Responds to `previewFileEdits` message type.
 *
 * Feature 4: Checkpoint auto-create badge
 *   - Small "📍 Checkpoint saved" toast that fades after 3 seconds.
 *   - Triggered by a `checkpointCreated` message type.
 */

import {
  Component,
  For,
  Show,
  createSignal,
  createMemo,
  onCleanup,
  onMount,
  JSX,
} from "solid-js"
import { Icon } from "@kilocode/kilo-ui/icon"
import { useVSCode } from "../../context/vscode"
import type { PreviewFileEdit, PreviewFileEditsMessage } from "../../types/messages"

// ─────────────────────────────────────────────────────────────────────────────
// Shared types
// ─────────────────────────────────────────────────────────────────────────────

export interface FileDiffHunk {
  /** 1-based start line in the original file */
  oldStart: number
  /** 1-based start line in the new file */
  newStart: number
  lines: FileDiffLine[]
}

export type FileDiffLineType = "add" | "remove" | "context"

export interface FileDiffLine {
  type: FileDiffLineType
  content: string
  /** Line number in the original file (undefined for added lines) */
  oldLine?: number
  /** Line number in the new file (undefined for removed lines) */
  newLine?: number
}

export interface FileDiff {
  /** Relative or absolute path of the file */
  file: string
  hunks: FileDiffHunk[]
  additions: number
  deletions: number
  /** Patch string in unified diff format (used as fallback) */
  patch?: string
}

export interface FileChangeEntry {
  file: string
  additions: number
  deletions: number
  timestamp: number
  status?: "added" | "deleted" | "modified"
}

// PreviewFileEdit is imported from ../../types/messages

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a unified diff patch string into FileDiffHunks.
 * Handles standard `@@ -a,b +c,d @@` headers.
 */
export function parsePatch(patch: string): FileDiffHunk[] {
  const hunks: FileDiffHunk[] = []
  const lines = patch.split("\n")
  let current: FileDiffHunk | null = null
  let oldLine = 0
  let newLine = 0

  for (const raw of lines) {
    const hunkHeader = raw.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/)
    if (hunkHeader) {
      current = { oldStart: parseInt(hunkHeader[1], 10), newStart: parseInt(hunkHeader[2], 10), lines: [] }
      oldLine = current.oldStart
      newLine = current.newStart
      hunks.push(current)
      continue
    }
    if (!current) continue

    if (raw.startsWith("+") && !raw.startsWith("+++")) {
      current.lines.push({ type: "add", content: raw.slice(1), newLine: newLine++ })
    } else if (raw.startsWith("-") && !raw.startsWith("---")) {
      current.lines.push({ type: "remove", content: raw.slice(1), oldLine: oldLine++ })
    } else if (raw.startsWith(" ")) {
      current.lines.push({ type: "context", content: raw.slice(1), oldLine: oldLine++, newLine: newLine++ })
    }
  }

  return hunks
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

const FileIcon = (): JSX.Element => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    class="file-change-file-icon"
    aria-hidden="true"
  >
    <path
      d="M3 2C3 1.44772 3.44772 1 4 1H10.1716C10.4368 1 10.6911 1.10536 10.8787 1.29289L13.7071 4.12132C13.8946 4.30886 14 4.56312 14 4.82843V13C14 13.5523 13.5523 14 13 14H4C3.44772 14 3 13.5523 3 13V2Z"
      fill="var(--vscode-editorLineNumber-foreground, #858585)"
      stroke="var(--vscode-editorLineNumber-foreground, #858585)"
      stroke-width="0.5"
    />
  </svg>
)

function getFilename(path: string): string {
  const sep = path.includes("/") ? "/" : "\\"
  const idx = path.lastIndexOf(sep)
  return idx === -1 ? path : path.slice(idx + 1)
}

function getDirectory(path: string): string {
  const sep = path.includes("/") ? "/" : "\\"
  const idx = path.lastIndexOf(sep)
  return idx <= 0 ? "" : path.slice(0, idx + 1)
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 1 — Inline File Diff Preview
// ─────────────────────────────────────────────────────────────────────────────

interface InlineFileDiffProps {
  diff: FileDiff
  /** When true the diff body is shown by default */
  defaultOpen?: boolean
  onOpenFile?: (file: string) => void
  onRevert?: (file: string) => void
}

export const InlineFileDiff: Component<InlineFileDiffProps> = (props) => {
  const [open, setOpen] = createSignal(props.defaultOpen ?? false)

  const hunks = createMemo(() => {
    if (props.diff.hunks?.length) return props.diff.hunks
    if (props.diff.patch) return parsePatch(props.diff.patch)
    return []
  })

  const dir = createMemo(() => getDirectory(props.diff.file))
  const filename = createMemo(() => getFilename(props.diff.file))

  return (
    <div class="inline-diff" data-open={open() ? "" : undefined}>
      {/* Header row */}
      <button
        class="inline-diff-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open()}
        aria-label={`Toggle diff for ${props.diff.file}`}
      >
        <div class="inline-diff-file-info">
          <FileIcon />
          <span class="inline-diff-filepath">
            <Show when={dir()}>
              <span class="inline-diff-dir">{`⁦${dir()}⁩`}</span>
            </Show>
            <span class="inline-diff-filename">{filename()}</span>
          </span>
        </div>
        <div class="inline-diff-meta">
          <Show when={props.diff.additions > 0}>
            <span class="inline-diff-add">+{props.diff.additions}</span>
          </Show>
          <Show when={props.diff.deletions > 0}>
            <span class="inline-diff-del">-{props.diff.deletions}</span>
          </Show>
          <Icon name={open() ? "chevron-up" : "chevron-down"} size="small" />
        </div>
      </button>

      {/* Diff body */}
      <Show when={open()}>
        <div class="inline-diff-body" role="region" aria-label={`Diff for ${props.diff.file}`}>
          <div class="inline-diff-actions">
            <Show when={props.onOpenFile}>
              <button
                class="inline-diff-action-btn"
                onClick={() => props.onOpenFile?.(props.diff.file)}
                title="Open file in editor"
              >
                <Icon name="external-link" size="small" />
                Open file
              </button>
            </Show>
            <Show when={props.onRevert}>
              <button
                class="inline-diff-action-btn inline-diff-action-btn--danger"
                onClick={() => props.onRevert?.(props.diff.file)}
                title="Revert this change"
              >
                <Icon name="rotate-ccw" size="small" />
                Revert
              </button>
            </Show>
          </div>
          <div class="inline-diff-table-wrapper">
            <table class="inline-diff-table" aria-label="Diff view">
              <tbody>
                <For each={hunks()}>
                  {(hunk) => (
                    <>
                      {/* Hunk separator */}
                      <tr class="inline-diff-hunk-header" aria-label="Hunk separator">
                        <td class="inline-diff-lineno" />
                        <td class="inline-diff-lineno" />
                        <td class="inline-diff-hunk-info" colspan="1">
                          @@ -{hunk.oldStart} +{hunk.newStart} @@
                        </td>
                      </tr>
                      <For each={hunk.lines}>
                        {(line) => (
                          <tr
                            class="inline-diff-line"
                            data-type={line.type}
                          >
                            <td class="inline-diff-lineno inline-diff-lineno--old">
                              {line.type !== "add" ? line.oldLine : ""}
                            </td>
                            <td class="inline-diff-lineno inline-diff-lineno--new">
                              {line.type !== "remove" ? line.newLine : ""}
                            </td>
                            <td class="inline-diff-code">
                              <span class="inline-diff-sigil" aria-hidden="true">
                                {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
                              </span>
                              <span class="inline-diff-content">{line.content}</span>
                            </td>
                          </tr>
                        )}
                      </For>
                    </>
                  )}
                </For>
                <Show when={hunks().length === 0}>
                  <tr>
                    <td colspan="3" class="inline-diff-empty">No diff available</td>
                  </tr>
                </Show>
              </tbody>
            </table>
          </div>
        </div>
      </Show>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 2 — File Change Timeline Panel
// ─────────────────────────────────────────────────────────────────────────────

interface FileChangeTimelineProps {
  entries: FileChangeEntry[]
  onViewDiff?: (file: string) => void
  onOpen?: (file: string) => void
  onRevert?: (file: string) => void
  onClose?: () => void
}

export const FileChangeTimeline: Component<FileChangeTimelineProps> = (props) => {
  const totalAdded = createMemo(() => props.entries.reduce((s, e) => s + e.additions, 0))
  const totalDeleted = createMemo(() => props.entries.reduce((s, e) => s + e.deletions, 0))

  return (
    <div class="file-change-timeline" role="complementary" aria-label="File change timeline">
      <div class="file-change-timeline-header">
        <div class="file-change-timeline-title">
          <Icon name="layers" size="small" />
          <span>Changes</span>
          <span class="file-change-timeline-badge">{props.entries.length}</span>
        </div>
        <div class="file-change-timeline-summary">
          <Show when={totalAdded() > 0}>
            <span class="inline-diff-add">+{totalAdded()}</span>
          </Show>
          <Show when={totalDeleted() > 0}>
            <span class="inline-diff-del">-{totalDeleted()}</span>
          </Show>
        </div>
        <Show when={props.onClose}>
          <button
            class="file-change-timeline-close"
            onClick={() => props.onClose?.()}
            aria-label="Close file change timeline"
          >
            <Icon name="x" size="small" />
          </button>
        </Show>
      </div>

      <div class="file-change-timeline-list" role="list">
        <Show
          when={props.entries.length > 0}
          fallback={
            <p class="file-change-timeline-empty">No file changes yet.</p>
          }
        >
          <For each={props.entries}>
            {(entry) => {
              const dir = createMemo(() => getDirectory(entry.file))
              const filename = createMemo(() => getFilename(entry.file))
              const relTime = createMemo(() => formatRelativeTime(entry.timestamp))
              return (
                <div class="file-change-entry" role="listitem">
                  <div class="file-change-entry-info">
                    <FileIcon />
                    <div class="file-change-entry-path">
                      <Show when={dir()}>
                        <span class="file-change-entry-dir">{`⁦${dir()}⁩`}</span>
                      </Show>
                      <span class="file-change-entry-filename">{filename()}</span>
                    </div>
                  </div>
                  <div class="file-change-entry-meta">
                    <Show when={entry.additions > 0}>
                      <span class="inline-diff-add">+{entry.additions}</span>
                    </Show>
                    <Show when={entry.deletions > 0}>
                      <span class="inline-diff-del">-{entry.deletions}</span>
                    </Show>
                    <span class="file-change-entry-time" title={new Date(entry.timestamp).toLocaleString()}>
                      {relTime()}
                    </span>
                  </div>
                  <div class="file-change-entry-actions">
                    <Show when={props.onViewDiff}>
                      <button
                        class="file-change-entry-btn"
                        title="View diff"
                        onClick={() => props.onViewDiff?.(entry.file)}
                      >
                        <Icon name="diff" size="small" />
                        Diff
                      </button>
                    </Show>
                    <Show when={props.onOpen}>
                      <button
                        class="file-change-entry-btn"
                        title="Open file"
                        onClick={() => props.onOpen?.(entry.file)}
                      >
                        <Icon name="external-link" size="small" />
                        Open
                      </button>
                    </Show>
                    <Show when={props.onRevert}>
                      <button
                        class="file-change-entry-btn file-change-entry-btn--danger"
                        title="Revert change"
                        onClick={() => props.onRevert?.(entry.file)}
                      >
                        <Icon name="rotate-ccw" size="small" />
                        Revert
                      </button>
                    </Show>
                  </div>
                </div>
              )
            }}
          </For>
        </Show>
      </div>
    </div>
  )
}

/** Toolbar badge that opens/closes the FileChangeTimeline panel */
export const FileChangesBadge: Component<{
  count: number
  onClick: () => void
  active: boolean
}> = (props) => (
  <button
    class="file-changes-badge-btn"
    classList={{ "file-changes-badge-btn--active": props.active }}
    title={`File changes (${props.count})`}
    aria-label={`Show file changes (${props.count} files)`}
    aria-pressed={props.active}
    onClick={props.onClick}
  >
    <Icon name="layers" size="small" />
    <Show when={props.count > 0}>
      <span class="file-changes-badge-count">{props.count}</span>
      <span class="file-changes-badge-label">Changes</span>
    </Show>
  </button>
)

// ─────────────────────────────────────────────────────────────────────────────
// Feature 3 — Multi-file Edit Preview Card
// ─────────────────────────────────────────────────────────────────────────────

export interface MultiFileEditPreviewProps {
  files: PreviewFileEdit[]
  onApplyAll: () => void
  onReviewEach: () => void
  onCancel: () => void
}

export const MultiFileEditPreview: Component<MultiFileEditPreviewProps> = (props) => {
  const totalLines = createMemo(() => props.files.reduce((s, f) => s + (f.linesChanged ?? 0), 0))
  const totalAdded = createMemo(() => props.files.reduce((s, f) => s + (f.additions ?? 0), 0))
  const totalDeleted = createMemo(() => props.files.reduce((s, f) => s + (f.deletions ?? 0), 0))

  return (
    <div class="multi-file-preview" role="dialog" aria-label="Preview file changes" aria-modal="true">
      <div class="multi-file-preview-header">
        <Icon name="layers" size="small" />
        <span class="multi-file-preview-title">Preview changes</span>
      </div>
      <div class="multi-file-preview-summary">
        <span class="multi-file-preview-count">
          <strong>{props.files.length}</strong> {props.files.length === 1 ? "file" : "files"} will be modified
        </span>
        <Show when={totalAdded() > 0 || totalDeleted() > 0}>
          <span class="multi-file-preview-stats">
            <Show when={totalAdded() > 0}>
              <span class="inline-diff-add">+{totalAdded()}</span>
            </Show>
            <Show when={totalDeleted() > 0}>
              <span class="inline-diff-del">-{totalDeleted()}</span>
            </Show>
          </span>
        </Show>
        <Show when={totalLines() > 0 && totalAdded() === 0 && totalDeleted() === 0}>
          <span class="multi-file-preview-stats">{totalLines()} lines</span>
        </Show>
      </div>
      <div class="multi-file-preview-list" role="list">
        <For each={props.files}>
          {(f) => {
            const dir = createMemo(() => getDirectory(f.file))
            const filename = createMemo(() => getFilename(f.file))
            return (
              <div class="multi-file-preview-item" role="listitem">
                <div class="multi-file-preview-item-info">
                  <FileIcon />
                  <span class="multi-file-preview-item-path">
                    <Show when={dir()}>
                      <span class="multi-file-preview-item-dir">{`⁦${dir()}⁩`}</span>
                    </Show>
                    <span class="multi-file-preview-item-filename">{filename()}</span>
                  </span>
                </div>
                <div class="multi-file-preview-item-meta">
                  <Show when={(f.additions ?? 0) > 0}>
                    <span class="inline-diff-add">+{f.additions}</span>
                  </Show>
                  <Show when={(f.deletions ?? 0) > 0}>
                    <span class="inline-diff-del">-{f.deletions}</span>
                  </Show>
                  <Show when={!f.additions && !f.deletions && (f.linesChanged ?? 0) > 0}>
                    <span class="multi-file-preview-item-lines">{f.linesChanged} lines</span>
                  </Show>
                </div>
              </div>
            )
          }}
        </For>
      </div>
      <div class="multi-file-preview-actions">
        <button class="multi-file-preview-btn multi-file-preview-btn--primary" onClick={props.onApplyAll}>
          <Icon name="check" size="small" />
          Apply all
        </button>
        <button class="multi-file-preview-btn multi-file-preview-btn--secondary" onClick={props.onReviewEach}>
          <Icon name="search" size="small" />
          Review each
        </button>
        <button class="multi-file-preview-btn multi-file-preview-btn--ghost" onClick={props.onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature 4 — Checkpoint Auto-create Badge
// ─────────────────────────────────────────────────────────────────────────────

interface CheckpointToastProps {
  label?: string
}

export const CheckpointToast: Component<CheckpointToastProps> = (props) => {
  const [visible, setVisible] = createSignal(true)
  let fadeTimer: ReturnType<typeof setTimeout>

  onMount(() => {
    fadeTimer = setTimeout(() => setVisible(false), 3000)
    onCleanup(() => clearTimeout(fadeTimer))
  })

  return (
    <Show when={visible()}>
      <div
        class="checkpoint-toast"
        role="status"
        aria-live="polite"
        aria-label="Checkpoint saved"
      >
        <span class="checkpoint-toast-icon" aria-hidden="true">📍</span>
        <span class="checkpoint-toast-label">{props.label ?? "Checkpoint saved"}</span>
      </div>
    </Show>
  )
}

/**
 * CheckpointToastHost — mounts at the app root and listens for `checkpointCreated`
 * VSCode extension messages, showing a 3-second fade toast.
 */
export const CheckpointToastHost: Component = () => {
  const vscode = useVSCode()
  const [checkpoints, setCheckpoints] = createSignal<Array<{ id: number; label?: string }>>([])
  let nextId = 0

  const cleanup = vscode.onMessage((msg: { type: string; label?: string }) => {
    if (msg.type !== "checkpointCreated") return
    const id = nextId++
    const label = msg.label
    setCheckpoints((prev) => [...prev, { id, label }])
    // Auto-remove after 3.5 s (the toast itself fades at 3 s)
    setTimeout(() => {
      setCheckpoints((prev) => prev.filter((c) => c.id !== id))
    }, 3500)
  })

  onCleanup(cleanup)

  return (
    <div class="checkpoint-toast-host" aria-live="polite">
      <For each={checkpoints()}>
        {(cp) => <CheckpointToast label={cp.label} />}
      </For>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MultiFileEditPreviewHost — listens for `previewFileEdits` messages
// ─────────────────────────────────────────────────────────────────────────────

interface PreviewState {
  files: PreviewFileEdit[]
  requestId?: string
}

export const MultiFileEditPreviewHost: Component = () => {
  const vscode = useVSCode()
  const [preview, setPreview] = createSignal<PreviewState | null>(null)

  const cleanup = vscode.onMessage((rawMsg) => {
    const msg = rawMsg as PreviewFileEditsMessage
    if (msg.type !== "previewFileEdits" || !msg.files?.length) return
    setPreview({ files: msg.files, requestId: msg.requestId })
  })
  onCleanup(cleanup)

  const dismiss = (response: "applyAll" | "reviewEach" | "cancel") => {
    const p = preview()
    if (p) {
      vscode.postMessage({ type: "previewFileEditsResponse", response, requestId: p.requestId })
    }
    setPreview(null)
  }

  return (
    <Show when={preview()}>
      {(p) => (
        <div class="multi-file-preview-overlay" role="presentation">
          <MultiFileEditPreview
            files={p().files}
            onApplyAll={() => dismiss("applyAll")}
            onReviewEach={() => dismiss("reviewEach")}
            onCancel={() => dismiss("cancel")}
          />
        </div>
      )}
    </Show>
  )
}
